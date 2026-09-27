import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const url = process.env.NAI_RUN_URL || 'http://127.0.0.1:5173/'
const report = { url, checkedAt: new Date().toISOString(), checks: [], pageErrors: [] }
await mkdir('log', { recursive: true })

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await context.addInitScript(() => {
    const metrics = window.__naiPerformanceRegression = {
      draws: 0,
      drawMethods: {},
      renderCallbacks: 0,
      maxRenderCallbacksPerTimestamp: 0,
      media: { calls: 0, completed: 0, failures: [], completionMs: [] },
    }
    const renderCallbacks = new Map()
    const requestFrame = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (callback) => requestFrame((timestamp) => {
      const before = metrics.draws
      try {
        callback(timestamp)
      } finally {
        if (metrics.draws > before) {
          const count = (renderCallbacks.get(timestamp) || 0) + 1
          renderCallbacks.set(timestamp, count)
          metrics.renderCallbacks += 1
          metrics.maxRenderCallbacksPerTimestamp = Math.max(metrics.maxRenderCallbacksPerTimestamp, count)
        }
      }
    })
    for (const Context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Context) continue
      for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const original = Context.prototype[name]
        if (!original) continue
        Context.prototype[name] = function (...args) {
          metrics.draws += 1
          metrics.drawMethods[name] = (metrics.drawMethods[name] || 0) + 1
          return Reflect.apply(original, this, args)
        }
      }
    }
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function (...args) {
      const started = performance.now()
      metrics.media.calls += 1
      try {
        return Reflect.apply(play, this, args).then((result) => {
          metrics.media.completed += 1
          metrics.media.completionMs.push(performance.now() - started)
          return result
        }, (error) => {
          metrics.media.failures.push(`${error.name}: ${error.message}`)
          throw error
        })
      } catch (error) {
        metrics.media.failures.push(`${error.name}: ${error.message}`)
        throw error
      }
    }
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => report.pageErrors.push(error.message))
  const snapshot = () => page.evaluate(() => ({
    ...window.__naiPerformanceRegression,
    distance: Number(document.querySelector('#distance-value').textContent.replace(/[^\d]/g, '')),
  }))

  async function checkIdle(label) {
    // Allow a queued transition/resize frame to finish, then observe a stable interval.
    await page.waitForTimeout(200)
    const before = await snapshot()
    await page.waitForTimeout(350)
    const after = await snapshot()
    const check = { label, draws: after.draws - before.draws, distanceDelta: after.distance - before.distance }
    report.checks.push(check)
    assert.equal(check.draws, 0, `${label} 稳定后不应继续绘制`)
    assert.equal(check.distanceDelta, 0, `${label} 稳定后距离不应变化`)
  }

  async function checkRunning(label, startingDistance) {
    const before = await snapshot()
    await page.waitForFunction((distance) => {
      const current = Number(document.querySelector('#distance-value').textContent.replace(/[^\d]/g, ''))
      return current >= distance + 3
    }, startingDistance, { timeout: 10_000 })
    const after = await snapshot()
    const check = { label, draws: after.draws - before.draws, distance: after.distance }
    report.checks.push(check)
    assert.ok(check.draws > 0, `${label} 应继续绘制`)
    return after
  }

  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => {
    const button = document.querySelector('#start-button')
    return button && !button.disabled && window.__naiPerformanceRegression.draws > 0
  })
  assert.equal(await page.locator('canvas').count(), 1, '应创建一个 WebGL 画布')
  await checkIdle('ready')
  assert.equal((await snapshot()).media.calls, 0, '首次用户操作前不应播放声音')

  await page.locator('#start-button').click()
  // The tutorial's first row always has a car in the right lane at 34m.
  await page.keyboard.press('ArrowRight')
  await checkRunning('start', 0)
  await page.keyboard.press('p')
  await page.locator('#pause-panel.visible').waitFor()
  await checkIdle('paused')

  const beforeResize = await snapshot()
  await page.setViewportSize({ width: 1100, height: 760 })
  await page.waitForFunction((draws) => window.__naiPerformanceRegression.draws > draws, beforeResize.draws)
  report.checks.push({ label: 'paused-resize', draws: (await snapshot()).draws - beforeResize.draws })
  await checkIdle('paused-after-resize')

  const pausedDistance = (await snapshot()).distance
  await page.locator('#resume-button').click()
  await checkRunning('resume', pausedDistance)
  await page.keyboard.press('p')
  await page.locator('#pause-panel.visible').waitFor()
  await checkIdle('paused-again')
  await page.locator('#resume-button').click()
  await page.locator('#gameover-panel.visible').waitFor({ timeout: 20_000 })
  await checkIdle('gameover')
  const gameoverDistance = (await snapshot()).distance
  assert.ok(gameoverDistance >= 32 && gameoverDistance <= 35, '应撞到教程首行右侧车辆')
  report.checks.push({ label: 'tutorial-car-collision', distance: gameoverDistance })

  await page.locator('#restart-button').click()
  assert.equal(await page.locator('#gameover-panel.visible').count(), 0, '失败后可重开')
  await checkRunning('restart', 0)
  await page.keyboard.press('p')
  await page.locator('#pause-panel.visible').waitFor()
  await checkIdle('paused-after-restart')
  await page.waitForFunction(() => window.__naiPerformanceRegression.media.completed > 0)
  report.metrics = await snapshot()
  assert.ok(report.metrics.renderCallbacks > 0, '应观察到运行中的动画帧')
  assert.equal(report.metrics.maxRenderCallbacksPerTimestamp, 1, '每帧只能有一个执行绘制的动画回调，避免恢复后重复循环')
  assert.deepEqual(report.metrics.media.failures, [], '用户操作后声音应成功播放')
  assert.deepEqual(report.pageErrors, [], '页面不应出现 JavaScript 错误')
  report.passed = true
  console.log('性能行为回归通过：静止零绘制、缩放重绘、暂停恢复/重开、声音播放。')
  console.log(JSON.stringify({ checks: report.checks, metrics: report.metrics }, null, 2))
  await context.close()
} catch (error) {
  report.passed = false
  report.failure = error.stack || String(error)
  throw error
} finally {
  await writeFile('log/performance-regression.json', `${JSON.stringify(report, null, 2)}\n`)
  await browser.close()
}
