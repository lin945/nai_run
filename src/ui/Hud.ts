import idleImage from '../../res/review.png'

export type Phase = 'ready' | 'running' | 'paused' | 'gameover'

interface HudActions {
  start: () => void
  pause: () => void
  mute: () => void
}

export class Hud {
  readonly stage: HTMLElement
  private readonly ready: HTMLElement
  private readonly pausePanel: HTMLElement
  private readonly gameOver: HTMLElement
  private readonly distanceLabel: HTMLElement
  private readonly scoreLabel: HTMLElement
  private readonly starsLabel: HTMLElement
  private readonly bestLabels: HTMLElement[]
  private readonly finalScore: HTMLElement
  private readonly finalDistance: HTMLElement
  private readonly finalStars: HTMLElement
  private readonly boostBar: HTMLElement
  private readonly magnetBar: HTMLElement
  private readonly soundButton: HTMLButtonElement
  private readonly pauseButton: HTMLButtonElement
  private readonly toast: HTMLElement
  private lastStats = ''
  private toastTimeout = 0

  constructor(root: HTMLElement, actions: HudActions) {
    root.innerHTML = `
      <main class="shell">
        <div class="stage" id="game-stage" aria-label="奶龙快跑 3D 游戏画面"></div>
        <div class="stage-vignette" aria-hidden="true"></div>
        <header class="hud-top">
          <div class="brand"><span class="brand-mark">★</span><span>奶龙<span class="brand-light">快跑</span></span></div>
          <div class="stats" aria-live="off">
            <div class="stat"><small>距离</small><strong id="distance-value">0 <em>m</em></strong></div>
            <div class="stat stat-primary"><small>分数</small><strong id="score-value">0</strong></div>
            <div class="stat stat-star"><small>星星</small><strong><span aria-hidden="true">★</span> <span id="stars-value">0</span></strong></div>
          </div>
          <div class="hud-actions">
            <button class="icon-button" id="sound-button" type="button" aria-label="关闭声音">♫</button>
            <button class="icon-button" id="pause-button" type="button" aria-label="暂停游戏">Ⅱ</button>
          </div>
        </header>
        <div class="powerups" aria-live="polite">
          <div class="powerup" id="boost-powerup"><span>⚡</span><div><b>极速冲刺</b><i id="boost-bar"></i></div></div>
          <div class="powerup" id="magnet-powerup"><span>◎</span><div><b>星星磁铁</b><i id="magnet-bar"></i></div></div>
        </div>
        <div class="toast" id="game-toast" role="status"></div>
        <div class="desktop-hint">← → 切换车道 <span>·</span> ↑ 跳跃 <span>·</span> ↓ 翻滚</div>
        <div class="mobile-hint">滑动屏幕：左右换道 · 上跳 · 下滚</div>

        <section class="overlay visible" id="ready-panel" aria-labelledby="ready-title">
          <div class="menu-card">
            <div class="menu-copy">
              <p class="eyebrow">THE LITTLE DRAGON RUN</p>
              <h1 id="ready-title">奶龙<span>快跑！</span></h1>
              <p class="subtitle">奔向星光，跑过缤纷街道。<br />准备好和奶龙一起出发了吗？</p>
              <div class="best-line">个人最高分 <strong class="best-value">0</strong></div>
              <button class="primary-button" id="start-button" type="button">开始奔跑 <span>➜</span></button>
              <p class="menu-tip">躲开车辆和路障，收集星星与神奇道具</p>
            </div>
            <div class="menu-art"><div class="art-halo"></div><img src="${idleImage}" alt="奶龙角色" /></div>
          </div>
        </section>

        <section class="overlay" id="pause-panel" aria-labelledby="pause-title">
          <div class="small-card">
            <span class="card-icon">⏸</span>
            <h2 id="pause-title">稍作休息</h2>
            <p>星星会等你回来。</p>
            <button class="primary-button" id="resume-button" type="button">继续奔跑 <span>➜</span></button>
          </div>
        </section>

        <section class="overlay" id="gameover-panel" aria-labelledby="gameover-title">
          <div class="small-card finish-card">
            <span class="card-icon">✦</span>
            <p class="eyebrow">RUN COMPLETE</p>
            <h2 id="gameover-title">这次跑了好远！</h2>
            <div class="final-score" id="final-score">0</div>
            <div class="final-stats"><span>距离 <b id="final-distance">0 m</b></span><span>星星 <b id="final-stars">0</b></span></div>
            <p class="best-line">个人最高分 <strong class="best-value">0</strong></p>
            <button class="primary-button" id="restart-button" type="button">再跑一次 <span>➜</span></button>
          </div>
        </section>
      </main>
    `
    const byId = (id: string): HTMLElement => {
      const element = root.querySelector<HTMLElement>(`#${id}`)
      if (!element) throw new Error(`Missing UI element: ${id}`)
      return element
    }
    this.stage = byId('game-stage')
    this.ready = byId('ready-panel')
    this.pausePanel = byId('pause-panel')
    this.gameOver = byId('gameover-panel')
    this.distanceLabel = byId('distance-value')
    this.scoreLabel = byId('score-value')
    this.starsLabel = byId('stars-value')
    this.bestLabels = [...root.querySelectorAll<HTMLElement>('.best-value')]
    this.finalScore = byId('final-score')
    this.finalDistance = byId('final-distance')
    this.finalStars = byId('final-stars')
    this.boostBar = byId('boost-bar')
    this.magnetBar = byId('magnet-bar')
    this.toast = byId('game-toast')
    this.soundButton = byId('sound-button') as HTMLButtonElement
    this.pauseButton = byId('pause-button') as HTMLButtonElement
    byId('start-button').addEventListener('click', actions.start)
    byId('restart-button').addEventListener('click', actions.start)
    byId('resume-button').addEventListener('click', actions.pause)
    this.pauseButton.addEventListener('click', actions.pause)
    this.soundButton.addEventListener('click', actions.mute)
  }

  setPhase(phase: Phase): void {
    this.ready.classList.toggle('visible', phase === 'ready')
    this.pausePanel.classList.toggle('visible', phase === 'paused')
    this.gameOver.classList.toggle('visible', phase === 'gameover')
    this.pauseButton.hidden = phase === 'ready' || phase === 'gameover'
    this.pauseButton.textContent = phase === 'paused' ? '▶' : 'Ⅱ'
    this.pauseButton.setAttribute('aria-label', phase === 'paused' ? '继续游戏' : '暂停游戏')
  }

  setMuted(muted: boolean): void {
    this.soundButton.textContent = muted ? '♪̸' : '♫'
    this.soundButton.setAttribute('aria-label', muted ? '打开声音' : '关闭声音')
  }

  setBest(best: number): void {
    for (const label of this.bestLabels) label.textContent = best.toLocaleString('zh-CN')
  }

  setStats(distance: number, stars: number, score: number, boost: number, magnet: number): void {
    const text = `${Math.floor(distance)}:${stars}:${score}:${Math.ceil(boost * 10)}:${Math.ceil(magnet * 10)}`
    if (text === this.lastStats) return
    this.lastStats = text
    this.distanceLabel.textContent = `${Math.floor(distance).toLocaleString('zh-CN')} m`
    this.scoreLabel.textContent = score.toLocaleString('zh-CN')
    this.starsLabel.textContent = String(stars)
    this.boostBar.style.width = `${Math.max(0, Math.min(1, boost)) * 100}%`
    this.magnetBar.style.width = `${Math.max(0, Math.min(1, magnet)) * 100}%`
    this.boostBar.closest('.powerup')?.classList.toggle('active', boost > 0)
    this.magnetBar.closest('.powerup')?.classList.toggle('active', magnet > 0)
  }

  setFinal(distance: number, stars: number, score: number): void {
    this.finalScore.textContent = score.toLocaleString('zh-CN')
    this.finalDistance.textContent = `${Math.floor(distance).toLocaleString('zh-CN')} m`
    this.finalStars.textContent = String(stars)
  }

  flash(message: string): void {
    window.clearTimeout(this.toastTimeout)
    this.toast.textContent = message
    this.toast.classList.add('visible')
    this.toastTimeout = window.setTimeout(() => this.toast.classList.remove('visible'), 900)
  }
}
