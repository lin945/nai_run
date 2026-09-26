import {
  BOOST_MULTIPLIER,
  LANE_X,
  MAX_SPEED,
  START_SPEED,
  type Lane,
  type ObstacleKind,
  type RowPattern,
} from './config'

export type Random = () => number

export function seededRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function moveLane(lane: Lane, direction: -1 | 1): Lane {
  return Math.max(0, Math.min(2, lane + direction)) as Lane
}

export function generateRow(previousSafeLane: Lane, random: Random): RowPattern {
  const choices = ([0, 1, 2] as Lane[]).filter(
    (lane) => Math.abs(lane - previousSafeLane) <= 1,
  )
  const safeLane = choices[Math.floor(random() * choices.length)] ?? previousSafeLane
  const occupied = ([0, 1, 2] as Lane[]).filter((lane) => lane !== safeLane)
  const kinds: ObstacleKind[] = ['car', 'rival', 'barrier', 'beam']
  const obstacleCount = random() < 0.72 ? 2 : 1
  const obstacles = occupied.slice(0, obstacleCount).map((lane) => ({
    lane,
    kind: kinds[Math.floor(random() * kinds.length)] ?? 'barrier',
  }))
  const bonusRoll = random()
  const bonus = bonusRoll < 0.055 ? 'boost' : bonusRoll < 0.11 ? 'magnet' : null

  return { safeLane, obstacles, bonus }
}

export function isHazardFatal(kind: ObstacleKind, jumpHeight: number, rolling: boolean): boolean {
  if (kind === 'barrier') return jumpHeight < 1.05
  if (kind === 'beam') return !rolling
  return true
}

export function overlapsLane(playerX: number, obstacleLane: Lane, halfWidth = 1.05): boolean {
  return Math.abs(playerX - LANE_X[obstacleLane]) < halfWidth + 0.45
}

export function baseSpeed(distanceMeters: number): number {
  return Math.min(MAX_SPEED, START_SPEED + distanceMeters * 0.006)
}

export function runningSpeed(distanceMeters: number, boosted: boolean): number {
  return baseSpeed(distanceMeters) * (boosted ? BOOST_MULTIPLIER : 1)
}

export function totalScore(distanceMeters: number, stars: number): number {
  return Math.floor(Math.max(0, distanceMeters)) + Math.max(0, stars) * 10
}
