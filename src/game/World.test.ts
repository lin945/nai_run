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
