import './styles.css'
import { Game } from './game/Game'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Missing app root')

if (!document.createElement('canvas').getContext('webgl2')) {
  root.innerHTML = '<main class="unsupported"><div><h1>需要支持 WebGL 2 的浏览器</h1><p>请使用新版 Chrome、Edge 或 Safari 打开奶龙快跑。</p></div></main>'
} else {
  new Game(root)
}
