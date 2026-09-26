import * as THREE from 'three'
import {
  BOOST_SECONDS,
  GRAVITY,
  JUMP_VELOCITY,
  LANE_X,
  MAGNET_SECONDS,
  PLAYER_Z,
  ROLL_SECONDS,
  type Lane,
  type PickupKind,
} from './config'
import { Input, type Action } from './Input'
import { Player } from './Player'
import { moveLane, runningSpeed, totalScore } from './rules'
import { Sound } from './Sound'
import { World } from './World'
import { scoreStore } from '../platform/scoreStore'
import { Hud, type Phase } from '../ui/Hud'

const STEP = 1 / 60

export class Game {
  private readonly scene: THREE.Scene
  private readonly renderer: THREE.WebGLRenderer
  private readonly camera: THREE.PerspectiveCamera
  private readonly world: World
  private readonly player: Player
  private readonly hud: Hud
  private readonly sound: Sound
  private readonly cameraTarget = new THREE.Vector3()
  private phase: Phase = 'ready'
  private targetLane: Lane = 1
  private playerX = 0
  private jumpY = 0
  private jumpVelocity = 0
  private rollRemaining = 0
  private boostRemaining = 0
  private magnetRemaining = 0
  private distance = 0
  private stars = 0
  private score = 0
  private lastFrame = 0
  private accumulator = 0
  private isNarrow = false

  constructor(root: HTMLElement) {
    this.hud = new Hud(root, {
      start: () => this.start(),
      pause: () => this.togglePause(),
      mute: () => this.toggleMute(),
    })
    this.sound = new Sound(scoreStore.muted())
    this.hud.setMuted(scoreStore.muted())
    this.hud.setBest(scoreStore.best())
    this.hud.setPhase('ready')
    this.hud.setStats(0, 0, 0, 0, 0)

    const scene = new THREE.Scene()
    this.scene = scene
    scene.background = new THREE.Color('#97dce9')
    scene.fog = new THREE.Fog('#a7e4e9', 75, 205)
    scene.add(new THREE.HemisphereLight('#fff6df', '#8bc6be', 2.3))
    const sun = new THREE.DirectionalLight('#fff8dd', 2.2)
    sun.position.set(-18, 30, -30)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -19
    sun.shadow.camera.right = 19
    sun.shadow.camera.top = 26
    sun.shadow.camera.bottom = -12
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = 110
    scene.add(sun)

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 270)
    this.camera.position.set(0.5, 5.1, 16)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.domElement.setAttribute('aria-label', '奶龙快跑游戏区域')
    this.hud.stage.append(this.renderer.domElement)
    this.world = new World(scene)
    this.player = new Player(scene)
    this.world.reset(1)
    this.world.update(0, 0, 0, 0, false, false)
    new Input(this.renderer.domElement, (action) => this.handleAction(action))
    window.addEventListener('resize', () => this.resize())
    this.resize()
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.phase === 'running') this.togglePause()
    })
    requestAnimationFrame(this.frame)
  }

  private start(): void {
    this.phase = 'running'
    this.targetLane = 1
    this.playerX = 0
    this.jumpY = 0
    this.jumpVelocity = 0
    this.rollRemaining = 0
    this.boostRemaining = 0
    this.magnetRemaining = 0
    this.distance = 0
    this.stars = 0
    this.score = 0
    this.accumulator = 0
    this.world.reset(Date.now() & 0xffffffff)
    this.hud.setStats(0, 0, 0, 0, 0)
    this.hud.setPhase('running')
    this.sound.play('start')
  }

  private togglePause(): void {
    if (this.phase === 'running') this.phase = 'paused'
    else if (this.phase === 'paused') this.phase = 'running'
    else return
    this.accumulator = 0
    this.hud.setPhase(this.phase)
  }

  private toggleMute(): void {
    const muted = !scoreStore.muted()
    scoreStore.setMuted(muted)
    this.sound.setMuted(muted)
    this.hud.setMuted(muted)
  }

  private handleAction(action: Action): void {
    if (action === 'pause') {
      this.togglePause()
      return
    }
    if (this.phase === 'ready' || this.phase === 'gameover') {
      if (action === 'jump') this.start()
      return
    }
    if (this.phase !== 'running') return
    if (action === 'left' || action === 'right') {
      this.targetLane = moveLane(this.targetLane, action === 'left' ? -1 : 1)
    } else if (action === 'jump' && this.jumpY === 0 && this.rollRemaining === 0) {
      this.jumpVelocity = JUMP_VELOCITY
      this.sound.play('jump')
    } else if (action === 'roll' && this.jumpY === 0 && this.rollRemaining === 0) {
      this.rollRemaining = ROLL_SECONDS
    }
  }

  private step(dt: number): void {
    this.boostRemaining = Math.max(0, this.boostRemaining - dt)
    this.magnetRemaining = Math.max(0, this.magnetRemaining - dt)
    this.rollRemaining = Math.max(0, this.rollRemaining - dt)
    const speed = runningSpeed(this.distance, this.boostRemaining > 0)
    this.distance += speed * dt
    this.playerX += (LANE_X[this.targetLane] - this.playerX) * Math.min(1, dt * 12)

    if (this.jumpVelocity !== 0 || this.jumpY > 0) {
      this.jumpY += this.jumpVelocity * dt
      this.jumpVelocity -= GRAVITY * dt
      if (this.jumpY <= 0) {
        this.jumpY = 0
        this.jumpVelocity = 0
      }
    }

    const result = this.world.update(
      this.distance,
      dt,
      this.playerX,
      this.jumpY,
      this.rollRemaining > 0,
      this.magnetRemaining > 0,
    )
    for (const kind of result.collected) this.collect(kind)
    this.score = totalScore(this.distance, this.stars)
    if (result.crashed) {
      this.phase = 'gameover'
      const best = scoreStore.record(this.score)
      this.hud.setBest(best)
      this.hud.setFinal(this.distance, this.stars, this.score)
      this.hud.setPhase('gameover')
      this.sound.play('hit')
    }
  }

  private collect(kind: PickupKind): void {
    if (kind === 'star') {
      this.stars += 1
      this.sound.play('star')
    } else if (kind === 'boost') {
      this.boostRemaining = BOOST_SECONDS
      this.hud.flash('⚡ 极速冲刺！')
      this.sound.play('boost')
    } else {
      this.magnetRemaining = MAGNET_SECONDS
      this.hud.flash('◎ 星星磁铁！')
      this.sound.play('magnet')
    }
  }

  private frame = (now: number): void => {
    const dt = this.lastFrame ? Math.min((now - this.lastFrame) / 1000, 0.05) : 0
    this.lastFrame = now
    if (this.phase === 'running') {
      this.accumulator += dt
      let steps = 0
      while (this.accumulator >= STEP && steps < 3 && this.phase === 'running') {
        this.step(STEP)
        this.accumulator -= STEP
        steps += 1
      }
      if (steps === 3) this.accumulator = 0
    }

    const speed = runningSpeed(this.distance, this.boostRemaining > 0)
    const lean = Math.max(-1, Math.min(1, (LANE_X[this.targetLane] - this.playerX) / 2.7))
    this.player.update(dt, {
      x: this.playerX,
      jumpY: this.jumpY,
      rolling: this.rollRemaining > 0,
      rollProgress: this.rollRemaining > 0 ? 1 - this.rollRemaining / ROLL_SECONDS : 0,
      lean,
      running: this.phase === 'running',
      dead: this.phase === 'gameover',
      speed,
      magnet: this.magnetRemaining > 0,
    })
    const cameraX = this.playerX * (this.isNarrow ? 0.72 : 0.28) + 0.35
    this.camera.position.x += (cameraX - this.camera.position.x) * Math.min(1, dt * 2.7)
    this.camera.position.y += ((this.isNarrow ? 6.0 : 5.2) + this.jumpY * 0.13 - this.camera.position.y) * Math.min(1, dt * 2)
    this.camera.position.z += ((this.isNarrow ? 18.8 : 16) - this.camera.position.z) * Math.min(1, dt * 2)
    this.cameraTarget.set(this.playerX * (this.isNarrow ? 0.59 : 0.22), 1.2, PLAYER_Z - 24)
    this.camera.lookAt(this.cameraTarget)
    const targetFov = (this.isNarrow ? 66 : 58) + (this.boostRemaining > 0 ? 4 : 0)
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 2)
    if (Math.abs(targetFov - this.camera.fov) > 0.02) this.camera.updateProjectionMatrix()
    this.hud.setStats(
      this.distance,
      this.stars,
      this.score,
      this.boostRemaining / BOOST_SECONDS,
      this.magnetRemaining / MAGNET_SECONDS,
    )
    this.renderer.render(this.scene, this.camera)
    requestAnimationFrame(this.frame)
  }

  private resize(): void {
    const width = Math.max(1, this.hud.stage.clientWidth)
    const height = Math.max(1, this.hud.stage.clientHeight)
    this.isNarrow = width < 680
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isNarrow ? 1.35 : 1.7))
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }
}
