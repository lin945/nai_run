export type SoundName = 'start' | 'jump' | 'star' | 'boost' | 'magnet' | 'hit'

export class Sound {
  private context: AudioContext | null = null
  private muted: boolean

  constructor(muted: boolean) {
    this.muted = muted
  }

  setMuted(muted: boolean): void {
    this.muted = muted
  }

  play(name: SoundName): void {
    if (this.muted) return
    try {
      this.context ??= new AudioContext()
      if (this.context.state === 'suspended') void this.context.resume()
      const context = this.context
      const notes: Record<SoundName, [number, number, number]> = {
        start: [420, 650, 0.22],
        jump: [370, 620, 0.17],
        star: [730, 1000, 0.14],
        boost: [300, 820, 0.35],
        magnet: [470, 730, 0.31],
        hit: [260, 90, 0.34],
      }
      const [from, to, duration] = notes[name]
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = name === 'hit' ? 'sawtooth' : 'sine'
      oscillator.frequency.setValueAtTime(from, context.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(to, context.currentTime + duration)
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.085, context.currentTime + 0.018)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + duration + 0.01)
    } catch {
      // Audio support is optional and must not break gameplay.
    }
  }
}
