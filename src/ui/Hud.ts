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
  private readonly startButton: HTMLButtonElement
  private readonly startLabel: HTMLElement
  private readonly startArrow: HTMLElement
  private readonly readyTip: HTMLElement
  private readonly toast: HTMLElement
  private lastStats = ''
  private toastTimeout = 0

  constructor(root: HTMLElement, actions: HudActions) {
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
    this.startButton = byId('start-button') as HTMLButtonElement
    this.startLabel = byId('start-label')
    this.startArrow = byId('start-arrow')
    this.readyTip = byId('ready-tip')
    this.startButton.addEventListener('click', actions.start)
    byId('restart-button').addEventListener('click', actions.start)
    byId('resume-button').addEventListener('click', actions.pause)
    this.pauseButton.addEventListener('click', actions.pause)
    this.soundButton.addEventListener('click', actions.mute)
  }

  setLoading(loading: boolean): void {
    this.startButton.disabled = loading
    this.startButton.setAttribute('aria-busy', String(loading))
    this.startLabel.textContent = loading ? '准备赛道…' : '开始奔跑'
    this.startArrow.hidden = loading
  }

  setLoadError(): void {
    this.setLoading(false)
    this.startLabel.textContent = '重新加载'
    this.readyTip.textContent = '赛道加载失败，请检查网络后重试，或使用新版浏览器打开。'
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
