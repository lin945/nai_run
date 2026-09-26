import * as THREE from 'three'
import { PLAYER_Z } from './config'

export interface PlayerPose {
  x: number
  jumpY: number
  rolling: boolean
  rollProgress: number
  lean: number
  running: boolean
  dead: boolean
  speed: number
  magnet: boolean
}

function oval(
  parent: THREE.Object3D,
  material: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), material)
  mesh.position.set(...position)
  mesh.scale.set(...scale)
  mesh.castShadow = true
  parent.add(mesh)
  return mesh
}

export class Player {
  readonly root = new THREE.Group()
  private readonly body = new THREE.Group()
  private readonly leftArm = new THREE.Group()
  private readonly rightArm = new THREE.Group()
  private readonly leftLeg = new THREE.Group()
  private readonly rightLeg = new THREE.Group()
  private readonly shadow: THREE.Mesh
  private readonly magnetRing: THREE.Mesh
  private clock = 0

  constructor(scene: THREE.Scene) {
    const yellow = new THREE.MeshStandardMaterial({ color: '#f9c747', roughness: 0.88 })
    const lightYellow = new THREE.MeshStandardMaterial({ color: '#ffdb64', roughness: 0.85 })
    const belly = new THREE.MeshStandardMaterial({ color: '#fff0be', roughness: 0.98 })
    const brown = new THREE.MeshStandardMaterial({ color: '#594032', roughness: 0.95 })
    const eyeWhite = new THREE.MeshStandardMaterial({ color: '#f8fff2', roughness: 0.4 })
    const eyeGreen = new THREE.MeshStandardMaterial({ color: '#4d9982', roughness: 0.2 })
    const eyeBlack = new THREE.MeshStandardMaterial({ color: '#1c2630', roughness: 0.1 })

    oval(this.body, yellow, [0, 1.36, 0], [0.93, 1.16, 0.71])
    oval(this.body, lightYellow, [0, 2.3, -0.14], [0.62, 0.7, 0.55])
    oval(this.body, belly, [0, 1.26, -0.61], [0.72, 0.79, 0.23])
    oval(this.body, lightYellow, [0, 2.0, -0.59], [0.3, 0.19, 0.17])
    for (const side of [-1, 1]) {
      oval(this.body, eyeWhite, [side * 0.3, 2.5, -0.55], [0.18, 0.22, 0.11])
      oval(this.body, eyeGreen, [side * 0.3, 2.5, -0.64], [0.13, 0.17, 0.065])
      oval(this.body, eyeBlack, [side * 0.3, 2.5, -0.69], [0.072, 0.105, 0.035])
      oval(this.body, eyeWhite, [side * 0.3 - 0.03, 2.56, -0.72], [0.03, 0.038, 0.019])
    }
    oval(this.body, yellow, [0, 0.98, 0.76], [0.34, 0.25, 0.5]).rotation.x = -0.4
    oval(this.body, lightYellow, [0, 2.92, 0.03], [0.17, 0.11, 0.25])

    this.leftArm.position.set(-0.82, 1.83, 0)
    this.rightArm.position.set(0.82, 1.83, 0)
    oval(this.leftArm, yellow, [-0.08, -0.4, -0.08], [0.28, 0.56, 0.27]).rotation.z = -0.28
    oval(this.rightArm, yellow, [0.08, -0.4, -0.08], [0.28, 0.56, 0.27]).rotation.z = 0.28
    oval(this.leftArm, brown, [-0.19, -0.84, -0.08], [0.25, 0.17, 0.24])
    oval(this.rightArm, brown, [0.19, -0.84, -0.08], [0.25, 0.17, 0.24])

    this.leftLeg.position.set(-0.42, 0.62, 0.04)
    this.rightLeg.position.set(0.42, 0.62, 0.04)
    oval(this.leftLeg, yellow, [0, -0.26, 0], [0.32, 0.47, 0.31])
    oval(this.rightLeg, yellow, [0, -0.26, 0], [0.32, 0.47, 0.31])
    oval(this.leftLeg, brown, [0, -0.57, -0.22], [0.39, 0.17, 0.52])
    oval(this.rightLeg, brown, [0, -0.57, -0.22], [0.39, 0.17, 0.52])

    this.body.add(this.leftArm, this.rightArm, this.leftLeg, this.rightLeg)
    this.root.add(this.body)
    scene.add(this.root)

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 32),
      new THREE.MeshBasicMaterial({ color: '#447889', transparent: true, opacity: 0.22, depthWrite: false }),
    )
    this.shadow.rotation.x = -Math.PI / 2
    this.shadow.position.set(0, 0.045, PLAYER_Z)
    scene.add(this.shadow)

    this.magnetRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.28, 0.045, 8, 40),
      new THREE.MeshBasicMaterial({ color: '#74eced', transparent: true, opacity: 0.66 }),
    )
    this.magnetRing.rotation.x = Math.PI / 2
    this.magnetRing.visible = false
    this.root.add(this.magnetRing)
  }

  update(dt: number, pose: PlayerPose): void {
    this.clock += dt * (pose.running ? pose.speed * 0.95 : 1.7)
    const stride = pose.running && !pose.rolling && !pose.dead ? Math.sin(this.clock) : 0
    this.root.position.set(pose.x, pose.jumpY, PLAYER_Z)
    this.body.position.y = pose.rolling ? -0.42 : pose.dead ? -0.28 : Math.abs(stride) * 0.065
    this.body.scale.y = pose.rolling ? 0.72 : 1
    this.body.rotation.x = pose.rolling ? pose.rollProgress * Math.PI * 2 : pose.dead ? -0.7 : 0
    this.body.rotation.z = pose.dead ? -0.9 : pose.lean * 0.19
    this.leftArm.rotation.x = pose.rolling ? 0.9 : pose.jumpY > 0 ? -1.1 : stride * 0.65
    this.rightArm.rotation.x = pose.rolling ? 0.9 : pose.jumpY > 0 ? -1.1 : -stride * 0.65
    this.leftLeg.rotation.x = pose.rolling ? -0.8 : pose.jumpY > 0 ? 0.42 : -stride * 0.55
    this.rightLeg.rotation.x = pose.rolling ? -0.8 : pose.jumpY > 0 ? -0.42 : stride * 0.55
    this.shadow.position.x = pose.x
    this.shadow.scale.setScalar(1 - Math.min(0.42, pose.jumpY * 0.14))
    ;(this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.22 - Math.min(0.13, pose.jumpY * 0.055)
    this.magnetRing.visible = pose.magnet
    this.magnetRing.position.y = 0.8 + Math.sin(this.clock * 0.4) * 0.12
    this.magnetRing.rotation.z += dt * 1.8
  }
}
