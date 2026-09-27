import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SoundName } from './Sound'

class FakeAudio {
  static instances: FakeAudio[] = []
  src = ''
  preload = ''
  currentTime = 0
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  pause = vi.fn()
  play = vi.fn((): Promise<void> => Promise.resolve())

  constructor() {
    FakeAudio.instances.push(this)
  }
}

let blobs: Blob[]

beforeEach(() => {
  vi.resetModules()
  FakeAudio.instances = []
  blobs = []
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('AudioContext', vi.fn(() => { throw new Error('AudioContext must not be constructed') }))
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    blobs.push(blob as Blob)
    return `blob:sound-${blobs.length}`
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('音效缓存与播放', () => {
  it('生成可解码的单声道 PCM WAV，采样不溢出且声音非静音', async () => {
    const { Sound } = await import('./Sound')
    const sound = new Sound(false)
    for (const name of ['start', 'jump', 'star', 'boost', 'magnet', 'hit'] as SoundName[]) sound.play(name)
    expect(blobs).toHaveLength(6)
    for (const blob of blobs) {
      expect(blob.type).toBe('audio/wav')
      const buffer = await blob.arrayBuffer()
      const view = new DataView(buffer)
      const text = (start: number, length: number): string => new TextDecoder().decode(buffer.slice(start, start + length))
      expect(text(0, 4)).toBe('RIFF')
      expect(text(8, 8)).toBe('WAVEfmt ')
      expect(text(36, 4)).toBe('data')
      expect(view.getUint32(4, true)).toBe(buffer.byteLength - 8)
      expect(view.getUint16(20, true)).toBe(1)
      expect(view.getUint16(22, true)).toBe(1)
      expect(view.getUint16(34, true)).toBe(16)
      expect(view.getUint32(28, true)).toBe(view.getUint32(24, true) * 2)
      expect(view.getUint32(40, true)).toBe(buffer.byteLength - 44)
      let peak = 0
      for (let i = 44; i < buffer.byteLength; i += 2) peak = Math.max(peak, Math.abs(view.getInt16(i, true)))
      expect(peak).toBeGreaterThan(1000)
      expect(peak).toBeLessThan(3000)
      expect(Math.abs(view.getInt16(buffer.byteLength - 2, true))).toBeLessThan(4)
    }
    expect(AudioContext).not.toHaveBeenCalled()
  })

  it('密集播放复用最多四个声部和六个 URL，跨实例复用音频缓存', async () => {
    const { Sound } = await import('./Sound')
    const sound = new Sound(false)
    const names: SoundName[] = ['start', 'jump', 'star', 'boost', 'magnet', 'hit']
    for (let i = 0; i < 60; i += 1) sound.play(names[i % names.length])
    expect(FakeAudio.instances).toHaveLength(4)
    expect(blobs).toHaveLength(6)
    expect(FakeAudio.instances[0].play).toHaveBeenCalledTimes(15)
    new Sound(false).play('star')
    expect(blobs).toHaveLength(6)
  })

  it('播放结束后的声部优先复用，静音立刻停止所有声部且不初始化新音频', async () => {
    const { Sound } = await import('./Sound')
    const sound = new Sound(true)
    sound.play('start')
    expect(FakeAudio.instances).toHaveLength(0)
    expect(blobs).toHaveLength(0)
    sound.setMuted(false)
    sound.play('jump')
    FakeAudio.instances[0].onended?.()
    sound.play('star')
    expect(FakeAudio.instances).toHaveLength(1)
    sound.play('magnet')
    for (const audio of FakeAudio.instances) {
      audio.pause.mockClear()
      audio.currentTime = 0.1
    }
    sound.setMuted(true)
    for (const audio of FakeAudio.instances) {
      expect(audio.pause).toHaveBeenCalledOnce()
      expect(audio.currentTime).toBe(0)
    }
    sound.play('hit')
    expect(blobs).toHaveLength(3)
    sound.setMuted(false)
    sound.play('start')
    expect(FakeAudio.instances).toHaveLength(2)
  })

  it('捕获 autoplay 拒绝并回收声部，音频失败不会导致未处理的 Promise rejection', async () => {
    const { Sound } = await import('./Sound')
    const sound = new Sound(false)
    sound.play('start')
    const voice = FakeAudio.instances[0]
    voice.onended?.()
    voice.play.mockRejectedValueOnce(new Error('NotAllowedError'))
    sound.play('jump')
    await Promise.resolve()
    sound.play('star')
    expect(FakeAudio.instances).toHaveLength(1)
    expect(voice.play).toHaveBeenCalledTimes(3)
  })

  it('被打断的旧 play 拒绝不会误释放已复用的声部', async () => {
    const { Sound } = await import('./Sound')
    const sound = new Sound(false)
    sound.play('start')
    const voice = FakeAudio.instances[0]
    voice.onended?.()
    let rejectOld!: (reason: Error) => void
    voice.play.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOld = reject }))
    sound.play('jump')
    sound.play('star')
    sound.play('boost')
    sound.play('magnet')
    sound.play('hit') // Steals the oldest voice, whose play promise is still pending.
    rejectOld(new Error('AbortError'))
    await Promise.resolve()
    sound.play('star')
    expect(voice.play).toHaveBeenCalledTimes(3)
    expect(FakeAudio.instances[1].play).toHaveBeenCalledTimes(2)
  })
})
