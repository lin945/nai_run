import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const url = process.env.NAI_RUN_URL || 'http://127.0.0.1:5173/'
await mkdir('log', { recursive: true })

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const errors = []

async function newPage(options) {
  const context = await browser.newContext(options)
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(url, { waitUntil: 'networkidle' })
  return { context, page }
}

try {
  const desktop = await newPage({ viewport: { width: 1280, height: 800 } })
  assert.equal(await desktop.page.locator('canvas').count(), 1, '桌面应创建 WebGL 画布')
  await desktop.page.screenshot({ path: 'log/desktop-ready.png' })
  await desktop.page.getByRole('button', { name: /开始奔跑/ }).click()
  await desktop.page.keyboard.press('ArrowDown')
  await desktop.page.waitForTimeout(180)
  await desktop.page.screenshot({ path: 'log/desktop-roll.png' })
  await desktop.page.waitForTimeout(1100)
  await desktop.page.screenshot({ path: 'log/desktop-running.png' })
  const distanceText = await desktop.page.locator('#distance-value').innerText()
  assert.ok(parseInt(distanceText, 10) > 0, '开始后距离应增长')
  await desktop.page.keyboard.press('ArrowUp')
  await desktop.page.waitForTimeout(180)
  await desktop.page.screenshot({ path: 'log/desktop-jump.png' })
  await desktop.page.keyboard.press('p')
  assert.equal(await desktop.page.locator('#pause-panel.visible').count(), 1, '键盘应暂停游戏')
  await desktop.page.getByRole('button', { name: /继续奔跑/ }).click()
  assert.equal(await desktop.page.locator('#pause-panel.visible').count(), 0, '暂停后可继续')
  await desktop.page.locator('#gameover-panel.visible').waitFor({ timeout: 20_000 })
  await desktop.page.screenshot({ path: 'log/desktop-gameover.png' })
  await desktop.page.getByRole('button', { name: /再跑一次/ }).click()
  assert.equal(await desktop.page.locator('#gameover-panel.visible').count(), 0, '失败后可重开')
  await desktop.context.close()

  const mobile = await newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  assert.equal(await mobile.page.locator('canvas').count(), 1, '手机视口应创建 WebGL 画布')
  await mobile.page.screenshot({ path: 'log/mobile-ready.png' })
  await mobile.page.getByRole('button', { name: /开始奔跑/ }).click()
  const cdp = await mobile.context.newCDPSession(mobile.page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 540, id: 1 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 270, y: 540, id: 1 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await mobile.page.waitForTimeout(900)
  await mobile.page.screenshot({ path: 'log/mobile-running.png' })
  assert.ok(parseInt(await mobile.page.locator('#distance-value').innerText(), 10) > 0, '手机开始后距离应增长')
  assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, '手机布局不应横向溢出')
  await mobile.context.close()

  assert.deepEqual(errors, [], '页面不应报 JavaScript 错误')
  console.log('桌面与手机视口冒烟检查通过；截图保存在 log/。')
} finally {
  await browser.close()
}
