import { describe, expect, it } from 'vitest'
import { LANE_X, type Lane } from './config'
import {
  baseSpeed,
  rowSpacing,
  difficultyLevel,
  generateRow,
  isHazardFatal,
  moveLane,
  overlapsLane,
  seededRandom,
  totalScore,
} from './rules'

describe('车道与安全路段', () => {
  it('在左右边缘不会越界', () => {
    expect(moveLane(0, -1)).toBe(0)
    expect(moveLane(2, 1)).toBe(2)
    expect(moveLane(1, -1)).toBe(0)
  })

  it('一千行都有空道且安全道每次最多移动一格', () => {
    const random = seededRandom(20260926)
    let previous: Lane = 1
    for (let i = 0; i < 1000; i += 1) {
      const row = generateRow(previous, random)
      expect(Math.abs(row.safeLane - previous)).toBeLessThanOrEqual(1)
      expect(row.obstacles.length).toBeGreaterThanOrEqual(1)
      expect(row.obstacles.length).toBeLessThanOrEqual(2)
      expect(row.obstacles.every((obstacle) => obstacle.lane !== row.safeLane)).toBe(true)
      previous = row.safeLane
    }
  })

  it('相同随机种子得到相同路段', () => {
    expect(generateRow(1, seededRandom(7))).toEqual(generateRow(1, seededRandom(7)))
  })
})

describe('障碍与分数', () => {
  it('只有对应动作能穿过路障', () => {
    expect(isHazardFatal('barrier', 0, true)).toBe(true)
    expect(isHazardFatal('barrier', 1.2, false)).toBe(false)
    expect(isHazardFatal('beam', 2, false)).toBe(true)
    expect(isHazardFatal('beam', 0, true)).toBe(false)
    expect(isHazardFatal('car', 2, true)).toBe(true)
    expect(isHazardFatal('rival', 2, true)).toBe(true)
  })

  it('换道中按实际横向位置碰撞', () => {
    expect(overlapsLane(LANE_X[0], 0)).toBe(true)
    expect(overlapsLane(LANE_X[2], 0)).toBe(false)
  })

  it('距离和星星计分，速度有上限', () => {
    expect(totalScore(123.9, 4)).toBe(163)
    expect(baseSpeed(100_000)).toBe(28)
  })
})

describe('递进挑战', () => {
  it('后段提供三车道动作挑战且指定路线可通过', () => {
    const random = seededRandom(42)
    let challenges = 0
    const kinds = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const row = generateRow(1, random, 1200)
      row.obstacles.forEach(({ kind }) => kinds.add(kind))
      const hazard = row.obstacles.find(({ lane }) => lane === row.safeLane)
      if (hazard) {
        challenges++
        const rolling = hazard.kind === 'beam' || hazard.kind === 'gate'
        expect(isHazardFatal(hazard.kind, rolling ? 0 : 2, rolling)).toBe(false)
      }
      const next = generateRow(row.safeLane, random, 1200, false)
      expect(next.obstacles.every(({ lane }) => lane !== next.safeLane)).toBe(true)
    }
    expect(challenges).toBeGreaterThan(250)
    expect(kinds.size).toBe(7)
  })
  it('新障碍要求正确动作，难度与密度有上限', () => {
    for (const kind of ['spikes', 'crate'] as const) {
      expect(isHazardFatal(kind, 0, true)).toBe(true)
      expect(isHazardFatal(kind, 2, false)).toBe(false)
    }
    expect(isHazardFatal('crate', 1.2, false)).toBe(true)
    expect(isHazardFatal('gate', 0, false)).toBe(true)
    expect(isHazardFatal('gate', 0, true)).toBe(false)
    expect(isHazardFatal('gate', 2, true)).toBe(true)
    expect(rowSpacing(0, () => 0)).toBe(29)
    expect(rowSpacing(9000, () => 0)).toBe(19)
    expect(difficultyLevel(900)).toBe(4)
    expect(difficultyLevel(9000)).toBe(4)
  })
})
