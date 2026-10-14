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

export function generateRow(previousSafeLane: Lane, random: Random, distance = 0, allowChallenge = true): RowPattern {
  const choices = ([0, 1, 2] as Lane[]).filter(
    (lane) => Math.abs(lane - previousSafeLane) <= 1,
  )
  const safeLane = choices[Math.floor(random() * choices.length)] ?? previousSafeLane
  const occupied = ([0, 1, 2] as Lane[]).filter((lane) => lane !== safeLane)
  const progress = Math.min(1, Math.max(0, distance) / 900)
  const kinds: ObstacleKind[] = ['car', 'rival', 'barrier', 'beam', 'spikes', 'crate', 'gate']
  const obstacleCount = random() < 0.8 + progress * 0.2 ? 2 : 1
  const obstacles = occupied.slice(0, obstacleCount).map((lane) => ({
    lane,
    kind: kinds[Math.floor(random() * kinds.length)] ?? 'barrier',
  }))
  // Never force consecutive action rows: jumping and rolling need recovery time.
  if (distance >= 220 && allowChallenge && random() < 0.18 + progress * 0.22) {
    const actionKinds: ObstacleKind[] = ['barrier', 'spikes', 'crate', 'beam', 'gate']
    obstacles.push({ lane: safeLane, kind: actionKinds[Math.floor(random() * actionKinds.length)] ?? 'barrier' })
  }
  const bonusRoll = random()
  const bonus = bonusRoll < 0.055 ? 'boost' : bonusRoll < 0.11 ? 'magnet' : null

  return { safeLane, obstacles, bonus }
}

export function isHazardFatal(kind: ObstacleKind, jumpHeight: number, rolling: boolean): boolean {
  if (kind === 'barrier') return jumpHeight < 1.05
  if (kind === 'spikes') return jumpHeight < 1.25
  if (kind === 'crate') return jumpHeight < 1.65
  if (kind === 'beam' || kind === 'gate') return !rolling || jumpHeight > 0.15
  return true
}

export function overlapsLane(playerX: number, obstacleLane: Lane, halfWidth = 1.05): boolean {
  return Math.abs(playerX - LANE_X[obstacleLane]) < halfWidth + 0.45
}

export function baseSpeed(distanceMeters: number): number {
  return Math.min(MAX_SPEED, START_SPEED + distanceMeters * 0.012)
}

export function runningSpeed(distanceMeters: number, boosted: boolean): number {
  return baseSpeed(distanceMeters) * (boosted ? BOOST_MULTIPLIER : 1)
}

export function totalScore(distanceMeters: number, stars: number): number {
  return Math.floor(Math.max(0, distanceMeters)) + Math.max(0, stars) * 10
}

export function rowSpacing(distance: number, random: Random): number {
  return 29 - Math.min(10, Math.max(0, distance) / 90) + random() * 4
}

export function difficultyLevel(distance: number): number {
  return Math.min(4, 1 + Math.floor(Math.max(0, distance) / 300))
}
