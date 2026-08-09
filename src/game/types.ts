export type Phase =
  | 'intro'
  | 'rescue-guide'
  | 'rescuing'
  | 'assign-guide'
  | 'production-proof'
  | 'repair-guide'
  | 'dusk'
  | 'defense'
  | 'slice-win'
  | 'slice-fail'

export type Resources = {
  power: number
  food: number
  scrap: number
  morale: number
}

export type GameSnapshot = {
  phase: Phase
  resources: Resources
  rescued: boolean
  assigned: boolean
  barricadeHp: number
  coreHp: number
  rescueProgress: number
  defenseElapsed: number
  defenseDuration: number
  overdriveUntil: number
  overdriveUsed: boolean
}
