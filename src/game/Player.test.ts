import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { Player, type PlayerPose } from './Player'

const TRACK_TOP_Y = 0.0125
const STANDING_POSE: PlayerPose = {
  x: 0,
  jumpY: 0,
  rolling: false,
  rollProgress: 0,
  lean: 0,
  running: false,
  dead: false,
  speed: 14,
  magnet: false,
}

function visibleHeight(root: THREE.Object3D): { bottom: number; top: number } {
  root.updateWorldMatrix(true, true)
  const point = new THREE.Vector3()
  let bottom = Infinity
  let top = -Infinity
  root.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const positions = object.geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i += 1) {
      point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld)
      bottom = Math.min(bottom, point.y)
      top = Math.max(top, point.y)
    }
  })
  expect(Number.isFinite(bottom)).toBe(true)
  expect(Number.isFinite(top)).toBe(true)
  return { bottom, top }
}

function expectGrounded(player: Player, jumpY = 0): void {
  const gap = visibleHeight(player.root).bottom - TRACK_TOP_Y - jumpY
  expect(gap).toBeGreaterThanOrEqual(0.005)
  expect(gap).toBeLessThanOrEqual(0.10)
}

describe('角色实际网格与跑道的位置', () => {
  it('站立时脚底贴近跑道且不穿地', () => {
    const player = new Player(new THREE.Scene())
    player.update(0, STANDING_POSE)
    expectGrounded(player)
  })

  it('跑步摆腿和左右倾斜时始终有可见网格贴地', () => {
    const player = new Player(new THREE.Scene())
    for (const lean of [-1, 0, 1]) {
      for (const dt of [0, 0.05, 0.08, 0.11]) {
        player.update(dt, { ...STANDING_POSE, running: true, lean })
        expectGrounded(player)
      }
    }
  })

  it('翻滚各角度不穿地、不悬空，整体低于站立形态', () => {
    const player = new Player(new THREE.Scene())
    player.update(0, STANDING_POSE)
    const standing = visibleHeight(player.root)
    for (const rollProgress of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]) {
      player.update(0, { ...STANDING_POSE, running: true, rolling: true, rollProgress })
      expectGrounded(player)
      const rolling = visibleHeight(player.root)
      expect(rolling.top - rolling.bottom).toBeLessThan((standing.top - standing.bottom) * 0.8)
    }
  })

  it('跳跃在贴地位置之上增加实际跳跃高度', () => {
    const player = new Player(new THREE.Scene())
    for (const jumpY of [0.4, 1.2, 2]) {
      player.update(0.07, { ...STANDING_POSE, running: true, jumpY, lean: 0.7 })
      expectGrounded(player, jumpY)
    }
  })

  it('死亡落地，残留的跳跃与翻滚状态不改变死亡姿态', () => {
    const player = new Player(new THREE.Scene())
    player.update(0, { ...STANDING_POSE, dead: true })
    expectGrounded(player)
    const fallen = visibleHeight(player.root)
    for (const rollProgress of [0.25, 0.75]) {
      player.update(0, {
        ...STANDING_POSE,
        dead: true,
        running: true,
        rolling: true,
        rollProgress,
        jumpY: 1.8,
      })
      expectGrounded(player)
      const interrupted = visibleHeight(player.root)
      expect(interrupted.bottom).toBeCloseTo(fallen.bottom, 5)
      expect(interrupted.top).toBeCloseTo(fallen.top, 5)
    }
  })
})
