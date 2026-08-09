export type Phase =
  | 'intro'
  | 'rescue-guide'
  | 'rescuing'
  | 'assign-guide'
  | 'assigning'
  | 'production-proof'
  | 'repair-guide'
  | 'repairing'
  | 'day-brief'
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

export type DayUpgrade = 'barricade' | 'battery'

export type GameSnapshot = {
  phase: Phase
  day: number
  resources: Resources
  rescued: boolean
  assigned: boolean
  barricadeHp: number
  barricadeMax: number
  coreHp: number
  rescueProgress: number
  assignmentProgress: number
  repairProgress: number
  defenseElapsed: number
  defenseDuration: number
  overdriveUntil: number
  overdriveReadyAt: number
  overdriveUsed: boolean
  overdriveCount: number
  repairReadyAt: number
  fieldRepairUntil: number
  fieldRepairCount: number
  dayUpgrade?: DayUpgrade
}
