export type SoundName = 'start' | 'jump' | 'star' | 'boost' | 'magnet' | 'hit'

const SAMPLE_RATE = 22050
const MAX_VOICES = 4
const NOTES: Record<SoundName, [number, number, number]> = {
  start: [420, 650, 0.22],
  jump: [370, 620, 0.17],
  star: [730, 1000, 0.14],
  boost: [300, 820, 0.35],
  magnet: [470, 730, 0.31],
  hit: [260, 90, 0.34],
}

// At most six tiny clips live for the page lifetime, shared by every Sound instance.
const clips = new Map<SoundName, string>()

function clipUrl(name: SoundName): string {
  const cached = clips.get(name)
  if (cached) return cached

  const [from, to, duration] = NOTES[name]
  const samples = Math.ceil((duration + 0.01) * SAMPLE_RATE)
  const buffer = new ArrayBuffer(44 + samples * 2)
  const wav = new DataView(buffer)
  const text = (offset: number, value: string): void => {
    for (let i = 0; i < value.length; i += 1) wav.setUint8(offset + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  wav.setUint32(4, buffer.byteLength - 8, true)
  text(8, 'WAVEfmt ')
  wav.setUint32(16, 16, true)
  wav.setUint16(20, 1, true) // PCM
  wav.setUint16(22, 1, true) // mono
  wav.setUint32(24, SAMPLE_RATE, true)
  wav.setUint32(28, SAMPLE_RATE * 2, true)
  wav.setUint16(32, 2, true)
  wav.setUint16(34, 16, true)
  text(36, 'data')
  wav.setUint32(40, samples * 2, true)

  let phase = 0
  for (let i = 0; i < samples; i += 1) {
    const time = i / SAMPLE_RATE
    const frequency = from * (to / from) ** (Math.min(time, duration) / duration)
    const gain = time < 0.018
      ? 0.0001 * (0.085 / 0.0001) ** (time / 0.018)
      : 0.085 * (0.0001 / 0.085) ** ((time - 0.018) / (duration - 0.018))
    const wave = name === 'hit' ? 2 * (phase - Math.floor(phase + 0.5)) : Math.sin(phase * Math.PI * 2)
    wav.setInt16(44 + i * 2, Math.round(wave * gain * 32767), true)
    phase += frequency / SAMPLE_RATE
  }

  const url = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
  clips.set(name, url)
  return url
}

interface Voice {
  audio: HTMLAudioElement
  busy: boolean
  sequence: number
}

export class Sound {
  private voices: Voice[] = []
  private sequence = 0
  private muted: boolean

  constructor(muted: boolean) {
    this.muted = muted
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (!muted) return
    for (const voice of this.voices) {
      voice.busy = false
      voice.sequence = ++this.sequence
      voice.audio.pause()
      voice.audio.currentTime = 0
    }
  }

  play(name: SoundName): void {
    if (this.muted) return
    try {
      const url = clipUrl(name)
      let voice = this.voices.find((candidate) => !candidate.busy)
      if (!voice && this.voices.length < MAX_VOICES) {
        const audio = new Audio()
        audio.preload = 'auto'
        voice = { audio, busy: false, sequence: 0 }
        const created = voice
        audio.onended = audio.onerror = () => { created.busy = false }
        this.voices.push(voice)
      }
      voice ??= this.voices.reduce((oldest, candidate) => candidate.sequence < oldest.sequence ? candidate : oldest)
      const current = voice
      const sequence = ++this.sequence
      current.sequence = sequence
      current.busy = true
      current.audio.pause()
      if (current.audio.src !== url) current.audio.src = url
      current.audio.currentTime = 0
      // Invoke play in the caller's user gesture; catch autoplay/codec/abort failures.
      void current.audio.play().catch(() => {
        if (current.sequence === sequence) current.busy = false
      })
    } catch {
      // Audio support is optional and must not break gameplay.
    }
  }
}
