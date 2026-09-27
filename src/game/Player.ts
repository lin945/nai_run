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

const BODY_PIVOT_Y = 1.22
const BODY_PROFILE: [number, number][] = [
  [0, 0.49], [0.34, 0.55], [0.61, 0.75], [0.79, 1.03],
  [0.89, 1.35], [0.89, 1.60], [0.81, 1.87], [0.68, 2.14],
  [0.54, 2.42], [0.48, 2.69], [0.48, 2.87], [0.43, 3.04],
  [0.30, 3.17], [0.13, 3.22], [0, 3.23],
]
const SMOOTH_PROFILE = new THREE.SplineCurve(
  BODY_PROFILE.map(([radius, height]) => new THREE.Vector2(radius, height)),
).getPoints(96).map((point) => new THREE.Vector2(Math.max(0, point.x), point.y))
const FLOOR_Y = 0.0125

function bodyShift(y: number): number {
  return Math.max(0, y - 2.1) * 0.12 + Math.exp(-(((y - 1.35) / 0.55) ** 2)) * 0.05
}

function bodyRadius(y: number): number {
  for (let i = 1; i < SMOOTH_PROFILE.length; i += 1) {
    const { x: nextRadius, y: nextY } = SMOOTH_PROFILE[i]
    if (y <= nextY) {
      const { x: radius, y: previousY } = SMOOTH_PROFILE[i - 1]
      return THREE.MathUtils.lerp(radius, nextRadius, (y - previousY) / (nextY - previousY))
    }
  }
  return 0
}

function oval(
  parent: THREE.Object3D,
  material: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), material)
  mesh.position.set(...position)
  mesh.scale.set(...scale)
  mesh.castShadow = true
  parent.add(mesh)
  return mesh
}

function bodyGeometry(): THREE.LatheGeometry {
  const segments = 48
  const geometry = new THREE.LatheGeometry(SMOOTH_PROFILE, segments)
  geometry.scale(1, 1, 0.84)
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute
  const uvs = geometry.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < positions.count; i += 1) {
    const y = positions.getY(i)
    positions.setZ(i, positions.getZ(i) - bodyShift(y))
    uvs.setY(i, (y - 0.49) / (3.23 - 0.49))
  }
  geometry.computeVertexNormals()
  // The UV seam keeps duplicate vertices; share their normals after deformation.
  const normals = geometry.getAttribute('normal') as THREE.BufferAttribute
  const normal = new THREE.Vector3()
  const stride = SMOOTH_PROFILE.length
  for (let row = 0; row < stride; row += 1) {
    const last = segments * stride + row
    normal.set(
      normals.getX(row) + normals.getX(last),
      normals.getY(row) + normals.getY(last),
      normals.getZ(row) + normals.getZ(last),
    ).normalize()
    normals.setXYZ(row, normal.x, normal.y, normal.z)
    normals.setXYZ(last, normal.x, normal.y, normal.z)
  }
  for (let column = 0; column <= segments; column += 1) {
    normals.setXYZ(column * stride, 0, -1, 0)
    normals.setXYZ(column * stride + stride - 1, 0, 1, 0)
  }
  return geometry
}

function skinTexture(): THREE.DataTexture {
  const size = 512
  const pixels = new Uint8Array(size * size * 4)
  for (let row = 0; row < size; row += 1) {
    const y = 0.49 + (row + 0.5) / size * (3.23 - 0.49)
    const radius = bodyRadius(y)
    for (let column = 0; column < size; column += 1) {
      const angle = ((column + 0.5) / size - 0.5) * Math.PI * 2
      const x = radius * Math.sin(angle)
      const ellipse = (x / 0.67) ** 2 + ((y - 1.5) / 0.76) ** 2
      const blend = Math.cos(angle) > 0 ? 1 - THREE.MathUtils.smoothstep(ellipse, 0.98, 1.02) : 0
      const offset = (row * size + column) * 4
      pixels[offset] = THREE.MathUtils.lerp(250, 244, blend)
      pixels[offset + 1] = THREE.MathUtils.lerp(193, 227, blend)
      pixels[offset + 2] = THREE.MathUtils.lerp(55, 193, blend)
      pixels[offset + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

export class Player {
  readonly root = new THREE.Group()
  private readonly pivot = new THREE.Group()
  private readonly body = new THREE.Group()
  private readonly leftArm = new THREE.Group()
  private readonly rightArm = new THREE.Group()
  private readonly leftLeg = new THREE.Group()
  private readonly rightLeg = new THREE.Group()
  private readonly tail: THREE.Mesh
  private readonly shadow: THREE.Mesh
  private readonly magnetRing: THREE.Mesh
  private readonly supports: { mesh: THREE.Mesh; sphere: boolean; positions: THREE.BufferAttribute }[] = []
  private clock = 0

  constructor(scene: THREE.Scene) {
    const yellow = new THREE.MeshStandardMaterial({ color: '#fac137', roughness: 0.82 })
    const skin = new THREE.MeshStandardMaterial({ map: skinTexture(), roughness: 0.82 })
    const hand = new THREE.MeshStandardMaterial({ color: '#82786a', roughness: 0.95 })
    const foot = new THREE.MeshStandardMaterial({ color: '#67594c', roughness: 0.94 })
    const eyeWhite = new THREE.MeshStandardMaterial({ color: '#dce0ad', roughness: 0.65 })
    const eyeGreen = new THREE.MeshStandardMaterial({ color: '#58a18c', roughness: 0.32 })
    const pupil = new THREE.MeshStandardMaterial({ color: '#19252a', roughness: 0.16 })

    const torso = new THREE.Mesh(bodyGeometry(), skin)
    torso.castShadow = true
    torso.receiveShadow = true
    this.body.add(torso)
    for (const side of [-1, 1]) {
      oval(this.body, eyeWhite, [side * 0.26, 2.9, -0.46], [0.1, 0.116, 0.046])
      oval(this.body, eyeGreen, [side * 0.26, 2.9, -0.499], [0.078, 0.091, 0.026])
      oval(this.body, pupil, [side * 0.26, 2.9, -0.522], [0.046, 0.06, 0.019])
      oval(this.body, eyeWhite, [side * 0.26 - 0.018, 2.933, -0.54], [0.014, 0.017, 0.008])
    }
    const smile = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.1, 2.64, -0.482),
          new THREE.Vector3(0, 2.628, -0.493),
          new THREE.Vector3(0.1, 2.64, -0.482),
        ]),
        12, 0.008, 6, false,
      ),
      hand,
    )
    this.body.add(smile)

    for (const side of [-1, 1]) {
      const arm = side < 0 ? this.leftArm : this.rightArm
      arm.position.set(side * 0.71, 2.0, -0.04)
      oval(arm, yellow, [side * 0.1, -0.39, -0.04], [0.22, 0.52, 0.22]).rotation.z = side * 0.12
      oval(arm, hand, [side * 0.14, -0.84, -0.12], [0.16, 0.18, 0.15])
      for (const digit of [-1, 0, 1]) {
        oval(arm, hand, [side * 0.14 + digit * 0.073, -0.96, -0.16], [0.046, 0.075, 0.065])
      }

      const leg = side < 0 ? this.leftLeg : this.rightLeg
      leg.position.set(side * 0.38, 0.66, 0.02)
      oval(leg, yellow, [0, -0.2, 0.02], [0.22, 0.32, 0.23])
      oval(leg, foot, [0, -0.51, -0.18], [0.28, 0.1, 0.35])
      for (const digit of [-1, 0, 1]) {
        oval(leg, foot, [digit * 0.15, -0.52, -0.42], [0.078, 0.068, 0.12])
      }
    }
    const tail = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.18, 0), new THREE.Vector2(0.16, 0.09),
      new THREE.Vector2(0.11, 0.23), new THREE.Vector2(0.045, 0.36),
      new THREE.Vector2(0, 0.4),
    ], 24), yellow)
    tail.rotation.x = Math.PI / 2 - 0.2
    tail.position.set(0, 0.9, 0.61)
    tail.castShadow = true
    this.tail = tail
    this.body.add(tail)

    this.body.add(this.leftArm, this.rightArm, this.leftLeg, this.rightLeg)
    this.body.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        this.supports.push({
          mesh: child,
          sphere: child.geometry.type === 'SphereGeometry',
          positions: child.geometry.getAttribute('position') as THREE.BufferAttribute,
        })
      }
    })
    this.body.position.y = -BODY_PIVOT_Y
    this.pivot.position.y = BODY_PIVOT_Y
    this.pivot.add(this.body)
    this.root.add(this.pivot)
    scene.add(this.root)

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 32),
      new THREE.MeshBasicMaterial({ color: '#447889', transparent: true, opacity: 0.2, depthWrite: false }),
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

  private alignToGround(clearance: number): void {
    this.pivot.position.y = 0
    this.root.updateMatrixWorld(true)
    let lowest = Infinity
    for (const { mesh, sphere, positions } of this.supports) {
      const m = mesh.matrixWorld.elements
      if (sphere) {
        lowest = Math.min(lowest, m[13] - Math.hypot(m[1], m[5], m[9]))
      } else {
        for (let i = 0; i < positions.count; i += 1) {
          lowest = Math.min(lowest, m[1] * positions.getX(i) + m[5] * positions.getY(i) + m[9] * positions.getZ(i) + m[13])
        }
      }
    }
    this.pivot.position.y = FLOOR_Y + clearance - lowest
  }

  update(dt: number, pose: PlayerPose): void {
    const rolling = pose.rolling && !pose.dead
    const jumpY = pose.dead ? 0 : pose.jumpY
    if (pose.running && !pose.dead) this.clock += dt * pose.speed * 0.95
    const stride = pose.running && !rolling && !pose.dead ? Math.sin(this.clock) : 0
    this.root.position.set(pose.x, 0, PLAYER_Z)
    this.pivot.scale.set(rolling ? 0.9 : 1, rolling ? 0.5 : 1, rolling ? 0.72 : 1)
    this.pivot.rotation.x = pose.dead ? -0.45 : rolling ? pose.rollProgress * Math.PI * 2 : 0
    this.pivot.rotation.z = pose.dead ? -1.22 : pose.lean * 0.16
    this.pivot.rotation.y = pose.running && !rolling && !pose.dead ? Math.sin(this.clock * 0.5) * 0.05 : 0
    this.leftArm.rotation.x = rolling ? 0.9 : jumpY > 0 ? -1.0 : stride * 0.62
    this.rightArm.rotation.x = rolling ? 0.9 : jumpY > 0 ? -1.0 : -stride * 0.62
    this.leftLeg.rotation.x = rolling ? -0.9 : jumpY > 0 ? 0.42 : -stride * 0.58
    this.rightLeg.rotation.x = rolling ? -0.9 : jumpY > 0 ? -0.42 : stride * 0.58
    this.tail.scale.setScalar(rolling ? 0.25 : 1)
    this.alignToGround(0.012 + Math.abs(stride) * 0.02)
    this.root.position.y = jumpY
    this.root.updateMatrixWorld(true)
    this.shadow.position.x = pose.x
    this.shadow.scale.setScalar(1 - Math.min(0.42, jumpY * 0.14))
    ;(this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.2 - Math.min(0.12, jumpY * 0.05)
    this.magnetRing.visible = pose.magnet && !pose.dead
    this.magnetRing.position.y = 0.8 + Math.sin(this.clock * 0.4) * 0.12
    this.magnetRing.rotation.z += dt * 1.8
  }
}
