export const LANE_X = [-3.2, 0, 3.2] as const
export const PLAYER_Z = 6
export const TRACK_WIDTH = 10.6
export const START_SPEED = 14
export const MAX_SPEED = 22
export const BOOST_MULTIPLIER = 1.42
export const BOOST_SECONDS = 5
export const MAGNET_SECONDS = 8
export const JUMP_VELOCITY = 12
export const GRAVITY = 28
export const ROLL_SECONDS = 0.8
export const LANE_CHANGE_SECONDS = 0.23
export const VIEW_DISTANCE = 165

export type Lane = 0 | 1 | 2
export type ObstacleKind = 'car' | 'rival' | 'barrier' | 'beam'
export type PickupKind = 'star' | 'boost' | 'magnet'

export interface ObstacleSpec {
  lane: Lane
  kind: ObstacleKind
}

export interface RowPattern {
  safeLane: Lane
  obstacles: ObstacleSpec[]
  bonus: 'boost' | 'magnet' | null
}
