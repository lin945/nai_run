import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { LANE_X } from './config'
import { World } from './World'

function preparedWorld(): World {
  const world = new World(new THREE.Scene())
  world.reset(1)
  world.update(0, 0, 0, 0, false, false)
  return world
}

describe('首段玩法', () => {
  it('中心安全道可拾取星星和吸铁石，收集物只结算一次', () => {
    const world = preparedWorld()
    expect(world.update(21, 0, 0, 0, false, false).collected).toContain('star')
    expect(world.update(21, 0, 0, 0, false, false).collected).toEqual([])
    expect(world.update(34, 0, 0, 0, false, false).crashed).toBe(false)
    expect(world.update(39, 0, 0, 0, false, false).collected).toContain('magnet')
  })

  it('低路障必须跳跃，磁铁能从相邻车道吸取星星', () => {
    const world = preparedWorld()
    expect(world.update(21, 0, LANE_X[2], 0, false, true).collected).toContain('star')
    expect(world.update(34, 0, LANE_X[0], 0, true, false).crashed).toBe(true)
    expect(world.update(34, 0, LANE_X[0], 1.2, false, false).crashed).toBe(false)
  })
})

describe('连续街景', () => {
  it('跨越20米边界时可见建筑保持连续移动，回收发生在镜头后方', () => {
    const scene = new THREE.Scene()
    const world = new World(scene)
    world.reset(1)
    world.update(19.9, 0, 0, 0, false, false)
    const root = scene.children[0]
    const streets = root.children.filter((child) => child.userData.streetIndex !== undefined)
    const before = streets.map((group) => group.position.z)
    world.update(20.1, 0, 0, 0, false, false)
    streets.forEach((group, index) => {
      expect(group.parent).toBe(root)
      expect(group.position.z - before[index]).toBeCloseTo(0.2)
    })
    world.update(28, 0, 0, 0, false, false)
    const departing = streets[0]
    expect(departing.position.z).toBeGreaterThan(37)
    world.update(28.1, 0, 0, 0, false, false)
    expect(departing.parent).toBeNull()
    expect(root.children.filter((child) => child.userData.streetIndex !== undefined)).toHaveLength(13)
    expect(root.children.some((child) => child.userData.streetIndex === 13)).toBe(true)
    world.reset(1)
    world.update(0, 0, 0, 0, false, false)
    expect(root.children.some((child) => child.userData.streetIndex === 0)).toBe(true)
    expect(root.children.some((child) => child.userData.streetIndex === 13)).toBe(false)
  })
})
