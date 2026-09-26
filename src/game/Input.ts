export type Action = 'left' | 'right' | 'jump' | 'roll' | 'pause'

const KEY_ACTIONS: Record<string, Action> = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump',
  ArrowDown: 'roll', s: 'roll', S: 'roll',
  Escape: 'pause', p: 'pause', P: 'pause',
}

export class Input {
  private start: { x: number; y: number; id: number } | null = null

  constructor(private canvas: HTMLCanvasElement, private onAction: (action: Action) => void) {
    window.addEventListener('keydown', this.onKeyDown)
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerCancel)
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel)
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    const action = KEY_ACTIONS[event.key]
    if (!action || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return
    event.preventDefault()
    this.onAction(action)
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') return
    this.start = { x: event.clientX, y: event.clientY, id: event.pointerId }
    this.canvas.setPointerCapture(event.pointerId)
  }

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.start || this.start.id !== event.pointerId) return
    const dx = event.clientX - this.start.x
    const dy = event.clientY - this.start.y
    this.start = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return
    this.onAction(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'jump' : 'roll'))
  }

  private onPointerCancel = (): void => {
    this.start = null
  }
}
