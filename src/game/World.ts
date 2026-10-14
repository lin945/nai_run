import * as THREE from 'three'
import {
  LANE_X,
  PLAYER_Z,
  TRACK_WIDTH,
  VIEW_DISTANCE,
  type Lane,
  type ObstacleKind,
  type PickupKind,
  type RowPattern,
} from './config'
import { generateRow, isHazardFatal, overlapsLane, rowSpacing, seededRandom, type Random } from './rules'

interface Collectible {
  kind: PickupKind
  lane: Lane
  distance: number
  mesh: THREE.Group
  claimed: boolean
}

interface RowVisual {
  distance: number
  group: THREE.Group
  obstacles: { lane: Lane; kind: ObstacleKind }[]
  collectibles: Collectible[]
}

export interface WorldResult {
  collected: PickupKind[]
  crashed: boolean
}

const materials = new Map<string, THREE.MeshStandardMaterial>()

function material(color: string, emissive = false): THREE.MeshStandardMaterial {
  const key = `${color}-${emissive}`
  let result = materials.get(key)
  if (!result) {
    result = new THREE.MeshStandardMaterial({
      color,
      roughness: emissive ? 0.33 : 0.8,
      metalness: emissive ? 0.18 : 0,
      emissive: emissive ? new THREE.Color(color) : new THREE.Color('#000000'),
      emissiveIntensity: emissive ? 0.38 : 0,
    })
    materials.set(key, result)
  }
  return result
}

function block(
  parent: THREE.Object3D,
  color: string,
  position: [number, number, number],
  size: [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color))
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function ball(
  parent: THREE.Object3D,
  color: string,
  position: [number, number, number],
  size: [number, number, number],
  glow = false,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), material(color, glow))
  mesh.position.set(...position)
  mesh.scale.set(...size)
  mesh.castShadow = !glow
  parent.add(mesh)
  return mesh
}

function makeCar(color: string): THREE.Group {
  const group = new THREE.Group()
  block(group, color, [0, 0.83, 0], [2.22, 1.03, 3.2])
  block(group, '#fff2cf', [0, 1.52, 0.16], [1.82, 0.65, 1.86])
  block(group, '#91c8d2', [0, 1.56, -0.82], [1.54, 0.45, 0.08])
  block(group, '#91c8d2', [0, 1.56, 1.09], [1.54, 0.45, 0.08])
  for (const x of [-1.1, 1.1]) {
    for (const z of [-1.0, 1.0]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.15, 12), material('#3b4e58'))
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(x, 0.38, z)
      group.add(wheel)
    }
    ball(group, '#ffe7a4', [x * 0.69, 0.82, -1.63], [0.2, 0.15, 0.07], true)
  }
  return group
}

function makeRival(): THREE.Group {
  const group = new THREE.Group()
  ball(group, '#7a76b8', [0, 1.1, 0], [0.65, 0.82, 0.48])
  ball(group, '#a6a3d8', [0, 1.93, 0], [0.47, 0.48, 0.42])
  ball(group, '#fff4dd', [0, 1.07, -0.43], [0.45, 0.48, 0.1])
  for (const side of [-1, 1]) {
    ball(group, '#7a76b8', [side * 0.63, 1.15, 0], [0.19, 0.55, 0.19])
    ball(group, '#5a568d', [side * 0.32, 0.27, -0.08], [0.26, 0.36, 0.25])
    ball(group, '#efffec', [side * 0.19, 2.02, -0.4], [0.1, 0.13, 0.05])
  }
  return group
}

function makeBarrier(): THREE.Group {
  const group = new THREE.Group()
  block(group, '#eb6974', [0, 0.44, 0], [2.5, 0.75, 0.34])
  for (const x of [-0.8, 0, 0.8]) {
    block(group, '#fff2da', [x, 0.45, -0.19], [0.3, 0.5, 0.04]).rotation.z = -0.45
  }
  ball(group, '#7c9ea0', [-1.1, 0.1, 0], [0.13, 0.16, 0.22])
  ball(group, '#7c9ea0', [1.1, 0.1, 0], [0.13, 0.16, 0.22])
  return group
}

function makeBeam(): THREE.Group {
  const group = new THREE.Group()
  block(group, '#e59568', [-1.1, 1.06, 0], [0.2, 2.12, 0.45])
  block(group, '#e59568', [1.1, 1.06, 0], [0.2, 2.12, 0.45])
  block(group, '#ec6e78', [0, 2.03, 0], [2.4, 0.43, 0.5])
  for (const x of [-0.7, 0, 0.7]) {
    block(group, '#fff2da', [x, 2.03, -0.27], [0.28, 0.28, 0.03]).rotation.z = -0.4
  }
  return group
}

function makeNewHazard(kind: 'spikes' | 'crate' | 'gate'): THREE.Group {
  const group = new THREE.Group()
  if (kind === 'spikes') {
    block(group, '#554d69', [0, 0.12, 0], [2.5, 0.24, 1.15])
    for (const x of [-0.9, -0.3, 0.3, 0.9]) {
      for (const z of [-0.3, 0.3]) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.85, 6), material('#c6d8e5'))
        spike.position.set(x, 0.65, z)
        spike.castShadow = true
        group.add(spike)
      }
    }
    block(group, '#ffcc54', [0, 0.14, 0.59], [2.45, 0.16, 0.04])
  } else if (kind === 'crate') {
    block(group, '#b77a46', [0, 0.68, 0], [2.15, 1.36, 1.35])
    for (const x of [-0.92, 0.92]) block(group, '#f3cc8e', [x, 0.68, 0.7], [0.16, 1.36, 0.07])
    for (const y of [0.12, 1.24]) block(group, '#f3cc8e', [0, y, 0.7], [2.15, 0.18, 0.07])
    block(group, '#f3cc8e', [0, 0.68, 0.72], [0.16, 1.5, 0.07]).rotation.z = -0.85
  } else {
    for (const x of [-1.18, 1.18]) block(group, '#566487', [x, 1.55, 0], [0.22, 3.1, 0.5])
    block(group, '#66799d', [0, 2.32, 0], [2.45, 1.55, 0.65])
    for (const x of [-0.8, -0.4, 0, 0.4, 0.8]) {
      block(group, '#ffd460', [x, 1.66, 0.35], [0.18, 0.24, 0.05]).rotation.z = -0.45
    }
    // Bright downward chevrons signal that this obstacle requires a roll.
    for (const x of [-0.16, 0.16]) {
      block(group, '#d7f9fa', [x, 2.45, 0.35], [0.12, 0.5, 0.05]).rotation.z = x < 0 ? 0.65 : -0.65
    }
  }
  return group
}

function makeStar(): THREE.Group {
  const group = new THREE.Group()
  const shape = new THREE.Shape()
  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + point * Math.PI / 5
    const radius = point % 2 === 0 ? 0.63 : 0.28
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (point === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const star = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelSize: 0.055, bevelThickness: 0.055, bevelSegments: 2 }),
    material('#ffdc52', true),
  )
  star.castShadow = true
  group.add(star)
  ball(group, '#fff8cc', [0, 0, 0.19], [0.1, 0.1, 0.03], true)
  return group
}

function makeBonus(kind: 'boost' | 'magnet'): THREE.Group {
  const group = new THREE.Group()
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.74, 0.08, 8, 32),
    material(kind === 'boost' ? '#ff9e6a' : '#64d6dd', true),
  )
  group.add(ring)
  if (kind === 'boost') {
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.95, 5), material('#ffbc59', true))
    arrow.rotation.z = -Math.PI / 2
    group.add(arrow)
  } else {
    const magnet = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.14, 9, 24, Math.PI), material('#eb6071', true))
    magnet.rotation.z = Math.PI
    group.add(magnet)
    ball(group, '#f1f5e9', [-0.39, 0, 0], [0.17, 0.18, 0.17])
    ball(group, '#f1f5e9', [0.39, 0, 0], [0.17, 0.18, 0.17])
  }
  return group
}

function disposeMeshes(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) child.geometry.dispose()
    if (child instanceof THREE.InstancedMesh) child.dispose()
  })
}

export class World {
  private readonly root = new THREE.Group()
  private readonly track: { distance: number; group: THREE.Group }[] = []
  private rows: RowVisual[] = []
  private random: Random = seededRandom(1)
  private nextRowDistance = 34
  private previousSafeLane: Lane = 1
  private rowCount = 0
  private previousChallenge = false
  private time = 0

  constructor(scene: THREE.Scene) {
    scene.add(this.root)
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(420, 440), material('#87917f'))
    grass.rotation.x = -Math.PI / 2
    grass.position.set(0, -0.29, -90)
    grass.receiveShadow = true
    this.root.add(grass)

    for (let index = 0; index < 13; index += 1) {
      const segment = this.makeSegment(index)
      this.track.push({ distance: index * 20 - 4, group: segment })
      this.root.add(segment)
    }
    for (const [x, y, z, size] of [
      [-45, 21, -95, 9], [37, 18, -110, 6], [-22, 16, -150, 7], [18, 23, -165, 10],
    ]) {
      const cloud = new THREE.Group()
      for (const offset of [-0.8, 0, 0.8]) {
        ball(cloud, '#fffaf0', [offset * size, 0, 0], [size * 0.85, size * 0.39, size * 0.44])
      }
      cloud.position.set(x, y, z)
      this.root.add(cloud)
    }
  }

  reset(seed: number): void {
    for (let index = 0; index < this.track.length; index += 1) {
      const segment = this.track[index]
      this.root.remove(segment.group)
      disposeMeshes(segment.group)
      segment.distance = index * 20 - 4
      segment.group = this.makeSegment(index)
      this.root.add(segment.group)
    }
    for (const row of this.rows) {
      this.root.remove(row.group)
      disposeMeshes(row.group)
    }
    this.rows = []
    this.random = seededRandom(seed)
    this.nextRowDistance = 34
    this.previousSafeLane = 1
    this.rowCount = 0
    this.previousChallenge = false
    this.time = 0
  }

  update(
    distance: number,
    dt: number,
    playerX: number,
    jumpY: number,
    rolling: boolean,
    magnet: boolean,
  ): WorldResult {
    this.time += dt
    for (const segment of this.track) {
      // Recycle only after the entire block has passed behind the camera.
      if (segment.distance < distance - 32) {
        const cycles = Math.ceil((distance - 32 - segment.distance) / (this.track.length * 20))
        segment.distance += cycles * this.track.length * 20
        this.root.remove(segment.group)
        disposeMeshes(segment.group)
        segment.group = this.makeSegment(Math.round((segment.distance + 4) / 20))
        this.root.add(segment.group)
      }
      segment.group.position.z = PLAYER_Z + distance - segment.distance
    }
    while (this.nextRowDistance < distance + VIEW_DISTANCE) {
      this.addRow(this.nextRowDistance)
      this.nextRowDistance += rowSpacing(this.nextRowDistance, this.random)
    }

    const result: WorldResult = { collected: [], crashed: false }
    for (const row of this.rows) {
      row.group.position.z = PLAYER_Z - (row.distance - distance)
      for (const item of row.collectibles) {
        if (item.claimed) continue
        item.mesh.rotation.y += dt * 2.3
        item.mesh.position.y = (item.kind === 'star' ? 1.45 : 1.6) + Math.sin(this.time * 4 + item.distance) * 0.13
        const gap = item.distance - distance
        const lateral = Math.abs(playerX - LANE_X[item.lane])
        const close = Math.abs(gap) < 1.2 && lateral < 1.2
        const pulled = item.kind === 'star' && magnet && gap > -2 && gap < 7 && lateral < 5.2
        if (close || pulled) {
          item.claimed = true
          item.mesh.visible = false
          result.collected.push(item.kind)
        }
      }
      if (Math.abs(row.distance - distance) < 1.25) {
        for (const obstacle of row.obstacles) {
          if (overlapsLane(playerX, obstacle.lane) && isHazardFatal(obstacle.kind, jumpY, rolling)) {
            result.crashed = true
            return result
          }
        }
      }
    }
    while (this.rows.length > 0 && this.rows[0].distance < distance - 22) {
      const old = this.rows.shift()!
      this.root.remove(old.group)
      disposeMeshes(old.group)
    }
    return result
  }

  private addRow(distance: number): void {
    const pattern: RowPattern = this.rowCount === 0
      ? { safeLane: 1, obstacles: [{ lane: 0, kind: 'barrier' }, { lane: 2, kind: 'car' }], bonus: 'magnet' }
      : generateRow(this.previousSafeLane, this.random, distance, !this.previousChallenge)
    if (this.rowCount === 2) pattern.bonus = 'boost'
    this.rowCount += 1
    this.previousSafeLane = pattern.safeLane
    this.previousChallenge = pattern.obstacles.some((obstacle) => obstacle.lane === pattern.safeLane)
    const group = new THREE.Group()
    const collectibles: Collectible[] = []
    for (const obstacle of pattern.obstacles) {
      const mesh = obstacle.kind === 'car'
        ? makeCar(this.random() < 0.5 ? '#f08d81' : '#76bac8')
        : obstacle.kind === 'rival'
          ? makeRival()
          : obstacle.kind === 'barrier'
            ? makeBarrier()
            : obstacle.kind === 'beam'
              ? makeBeam()
              : makeNewHazard(obstacle.kind)
      mesh.position.x = LANE_X[obstacle.lane]
      group.add(mesh)
    }
    for (const offset of [13, 9, 5]) {
      const mesh = makeStar()
      mesh.position.set(LANE_X[pattern.safeLane], 1.45, offset)
      group.add(mesh)
      collectibles.push({ kind: 'star', lane: pattern.safeLane, distance: distance - offset, mesh, claimed: false })
    }
    if (pattern.bonus) {
      const mesh = makeBonus(pattern.bonus)
      mesh.position.set(LANE_X[pattern.safeLane], 1.6, -5)
      group.add(mesh)
      collectibles.push({ kind: pattern.bonus, lane: pattern.safeLane, distance: distance + 5, mesh, claimed: false })
    }
    this.root.add(group)
    this.rows.push({ distance, group, obstacles: pattern.obstacles, collectibles })
  }

  private makeSegment(index: number): THREE.Group {
    const group = new THREE.Group()
    group.userData.streetIndex = index
    const random = seededRandom(index * 7919 + 41)
    block(group, '#596169', [0, -0.13, 0], [TRACK_WIDTH + 0.55, 0.28, 20])
    for (const x of [-1.6, 1.6]) {
      for (const z of [-7, -2, 3, 8]) {
        block(group, '#e9e6dc', [x, 0.02, z], [0.12, 0.025, 2.2])
      }
    }
    for (const side of [-1, 1]) block(group, '#e3d7aa', [side * 5.1, 0.02, 0], [0.09, 0.025, 20])
    for (const side of [-1, 1]) {
      block(group, '#a9aaa6', [side * 5.48, 0.08, 0], [0.32, 0.3, 20])
      block(group, '#bfc0b8', [side * 7.05, 0.07, 0], [2.85, 0.27, 20])
      for (const z of [-8, -4, 0, 4, 8]) {
        block(group, '#a7aaa5', [side * 7.05, 0.215, z], [2.7, 0.012, 0.035])
      }
      const lampX = side * 6.05
      block(group, '#414b50', [lampX, 2.95, -7], [0.13, 5.5, 0.13])
      block(group, '#414b50', [lampX - side * 0.5, 5.65, -7], [1.1, 0.12, 0.13])
      block(group, '#dce0d4', [lampX - side * 1.0, 5.58, -7], [0.52, 0.14, 0.3])
      block(group, '#737b73', [side * 7.25, 0.36, 4], [1.7, 0.38, 2.6])
      block(group, '#4f6548', [side * 7.25, 0.57, 4], [1.5, 0.05, 2.4])
      block(group, '#73634f', [side * 7.25, 1.6, 4], [0.25, 2.2, 0.25])
      for (const [x, y, z, radius] of [[0, 3.25, 0, 1], [0.5, 2.8, 0.3, 0.8], [-0.4, 2.9, -0.4, 0.9]]) {
        ball(group, '#597554', [side * 7.25 + x, y, 4 + z], [radius, radius * 1.2, radius])
      }
      for (const z of [-5, 5]) {
        const floors = 2 + Math.floor(random() * 4)
        const height = floors * 2.75 + 3.2
        const facade = ['#b6ab98', '#acb3b1', '#c4b9a8', '#9cabae'][Math.floor(random() * 4)]
        const buildingX = side * 12.1
        const faceX = side * 8.55
        block(group, facade, [buildingX, height / 2 + 0.2, z], [7, height, 9.65])
        block(group, '#737d80', [buildingX, height + 0.25, z], [7.2, 0.22, 9.8])
        block(group, '#616c70', [buildingX + side, height + 0.65, z + 1], [1.7, 0.65, 2.1])
        for (let floor = 0; floor < floors; floor += 1) {
          const y = 4.7 + floor * 2.75
          block(group, '#8c918a', [faceX, y - 1.0, z], [0.18, 0.15, 9.65])
          for (const offset of [-3.15, -1.05, 1.05, 3.15]) {
            block(group, '#e1ded2', [faceX - side * 0.06, y, z + offset], [0.16, 1.85, 1.48])
            block(group, '#536e7a', [faceX - side * 0.16, y, z + offset], [0.06, 1.57, 1.22])
            block(group, '#a0b3b7', [faceX - side * 0.2, y + 0.48, z + offset], [0.02, 0.08, 1.2])
            block(group, '#d9d8cc', [faceX - side * 0.23, y - 0.89, z + offset], [0.35, 0.13, 1.65])
          }
        }
        const awning = ['#526e67', '#8c5d4e', '#485c74'][Math.floor(random() * 3)]
        block(group, '#454e50', [faceX - side * 0.05, 1.52, z], [0.16, 2.5, 8.6])
        for (const offset of [-2.9, 0, 2.9]) {
          block(group, '#739198', [faceX - side * 0.15, 1.6, z + offset], [0.05, 2.15, 2.45])
          block(group, '#c0c8c4', [faceX - side * 0.2, 1.6, z + offset], [0.04, 2.2, 0.08])
        }
        block(group, awning, [faceX - side * 0.53, 2.99, z], [1.25, 0.19, 8.9])
        block(group, awning, [faceX - side * 1.08, 2.8, z], [0.13, 0.43, 8.9])
        block(group, '#d6d4c8', [faceX - side * 0.12, 0.36, z], [0.25, 0.3, 9.65])
      }
    }
    // Batch the facade details so richer streets do not multiply draw calls.
    const batches = new Map<THREE.Material, THREE.Mesh[]>()
    for (const child of [...group.children]) {
      if (child instanceof THREE.Mesh && child.geometry.type === 'BoxGeometry') {
        const mat = child.material as THREE.Material
        const batch = batches.get(mat) ?? []
        batch.push(child)
        batches.set(mat, batch)
      }
    }
    for (const [mat, meshes] of batches) {
      const instances = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, meshes.length)
      meshes.forEach((mesh, i) => {
        const bounds = mesh.geometry as THREE.BoxGeometry
        mesh.scale.set(bounds.parameters.width, bounds.parameters.height, bounds.parameters.depth)
        mesh.updateMatrix()
        instances.setMatrixAt(i, mesh.matrix)
        group.remove(mesh)
        mesh.geometry.dispose()
      })
      instances.castShadow = true
      instances.receiveShadow = true
      instances.instanceMatrix.needsUpdate = true
      instances.computeBoundingSphere()
      group.add(instances)
    }
    return group
  }
}
