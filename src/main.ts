import { scoreStore } from './platform/scoreStore'
import { Hud } from './ui/Hud'
import type { Game } from './game/Game'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Missing app root')

let game: Game | undefined
let loadFailed = false
const hud = new Hud(root, {
  start: () => {
    if (loadFailed) window.location.reload()
    else game?.start()
  },
  pause: () => game?.togglePause(),
  mute: () => {
    if (game) game.toggleMute()
    else {
      const muted = !scoreStore.muted()
      scoreStore.setMuted(muted)
      hud.setMuted(muted)
    }
  },
})
hud.setLoading(true)
hud.setMuted(scoreStore.muted())
hud.setBest(scoreStore.best())
performance.mark('nai-ui-ready')

async function prepareGame(): Promise<void> {
  try {
    const character = document.querySelector<HTMLImageElement>('#ready-character')
    const [{ Game }] = await Promise.all([
      import('./game/Game'),
      character?.decode().catch(() => undefined),
    ])
    // Let the already decoded menu image paint before building the 3D scene.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    game = new Game(hud)
  } catch (error) {
    loadFailed = true
    hud.setLoadError()
    console.error('Unable to prepare game', error)
  }
}

void prepareGame()
