import type { SfxName } from './audio'

export type Phase =
  | 'title'
  | 'rescue'
  | 'rescuing'
  | 'assign'
  | 'assigning'
  | 'repair'
  | 'repairing'
  | 'dusk'
  | 'night'
  | 'dawn'
  | 'upgrade'
  | 'fail'

export type Kind = 'husk' | 'stalker' | 'runner' | 'brute'
export type NightEvent = 'none' | 'flicker' | 'curb' | 'brute'

export type Enemy = {
  id: number
  kind: Kind
  lane: 0 | 1
  t: number
  hp: number
  maxHp: number
  flash: number
  bite: number
  weave: number
  marked: boolean
}

export type Spark = {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  max: number
  color: string
  size: number
}

export type Popup = {
  x: number
  y: number
  z: number
  text: string
  life: number
  max: number
  color: string
}

export type Beam = {
  x1: number
  y1: number
  z1: number
  x2: number
  y2: number
  z2: number
  life: number
  max: number
}

export type Ranks = { barricade: number; battery: number; capacitor: number; clinic: number; rations: number }

export function emptyRanks(): Ranks {
  return { barricade: 0, battery: 0, capacitor: 0, clinic: 0, rations: 0 }
}

export function fillRanks(ranks?: Partial<Ranks> | null): Ranks {
  return {
    barricade: ranks?.barricade ?? 0,
    battery: ranks?.battery ?? 0,
    capacitor: ranks?.capacitor ?? 0,
    clinic: ranks?.clinic ?? 0,
    rations: ranks?.rations ?? 0,
  }
}

export const SAVE_KEY = 'cg_afterlight_guest_v1'

const listeners = new Set<() => void>()
const sfxListeners = new Set<(name: SfxName) => void>()

let uid = 1
let uiAcc = 0
let saveAcc = 0
let foot = 0

export const world = {
  rev: 0,
  phase: 'title' as Phase,
  day: 1,
  power: 40,
  scrap: 25,
  morale: 72,
  core: 100,
  barricade: 60,
  barricadeMax: 100,
  rescued: false,
  assigned: false,
  tutorial: true,
  tutorialDone: false,
  rescueT: 0,
  assignT: 0,
  repairT: 0,
  nightTime: 0,
  nightDuration: 28,
  overdriveUntil: 0,
  overdriveReady: 5,
  repairReady: 2.5,
  spawnAcc: 0,
  spawned: 0,
  spawnGoal: 6,
  kills: 0,
  leaks: 0,
  ranks: emptyRanks(),
  permanent: emptyRanks(),
  event: 'none' as NightEvent,
  eventUntil: 0,
  eventDone: false,
  eventProgress: 0,
  eventNeed: 0,
  lampSteady: false,
  lampOut: false,
  clinicUsed: false,
  clinicPulse: 0,
  banked: 0,
  bestNight: 0,
  muted: false,
  cleared: 0,
  failReason: '',
  enemies: [] as Enemy[],
  sparks: [] as Spark[],
  popups: [] as Popup[],
  beams: [] as Beam[],
  shake: 0,
  punch: 0,
  hitStop: 0,
  hurt: 0,
  fireCd: 0,
  firing: false,
  aim: { x: 0, z: 3.2 },
  reduceMotion: false,
  demo: false,
  hold: false,
  demoAcc: 0,
  preview: false,
}

type NightSnap = {
  day: number
  power: number
  scrap: number
  morale: number
  core: number
  barricade: number
  barricadeMax: number
  ranks: Ranks
}

let nightSnap: NightSnap | null = null

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function onSfx(listener: (name: SfxName) => void) {
  sfxListeners.add(listener)
  return () => { sfxListeners.delete(listener) }
}

function emit() {
  world.rev += 1
  listeners.forEach(listener => listener())
}

function sfx(name: SfxName) {
  if (world.muted) return
  sfxListeners.forEach(listener => listener(name))
}

function popup(x: number, y: number, z: number, text: string, color: string) {
  if (world.popups.length > 14) world.popups.shift()
  world.popups.push({ x, y, z, text, life: 0.75, max: 0.75, color })
}

function burst(x: number, y: number, z: number, color: string, count = 8) {
  for (let i = 0; i < count; i += 1) {
    if (world.sparks.length > 72) world.sparks.shift()
    const life = 0.32 + Math.random() * 0.22
    world.sparks.push({
      x, y, z,
      vx: (Math.random() - 0.5) * 2.6,
      vy: 1.1 + Math.random() * 2.4,
      vz: (Math.random() - 0.5) * 2.6,
      life,
      max: life,
      color,
      size: 0.65 + Math.random() * 0.7,
    })
  }
}

export function enemyPosition(enemy: Enemy): [number, number, number] {
  const lanes = [
    [[-2.35, 6.2], [-1.05, 3.48], [-0.15, -1.2]],
    [[2.35, 6.2], [1.05, 3.48], [0.15, -1.2]],
  ] as const
  const pts = lanes[enemy.lane]
  const gate = 0.62
  let x: number
  let z: number
  if (enemy.t <= gate) {
    const u = enemy.t / gate
    x = pts[0][0] + (pts[1][0] - pts[0][0]) * u
    z = pts[0][1] + (pts[1][1] - pts[0][1]) * u
  } else {
    const u = (enemy.t - gate) / (1 - gate)
    x = pts[1][0] + (pts[2][0] - pts[1][0]) * u
    z = pts[1][1] + (pts[2][1] - pts[1][1]) * u
  }
  if (enemy.kind === 'stalker' || enemy.kind === 'runner') {
    const weave = enemy.weave ?? enemy.id
    x += Math.sin(enemy.t * (enemy.kind === 'runner' ? 11 : 8) + weave) * (enemy.kind === 'runner' ? 0.62 : 0.38)
  }
  if (enemy.marked) x *= 0.35
  return [x, 0.22, z]
}

function inLight(enemy: Enemy) {
  return enemy.t > 0.4 && enemy.t < 0.76
}

function nightLength(day: number) {
  if (day <= 1) return 24
  if (day === 2) return 34
  if (day === 3) return 40
  return Math.min(48, 36 + (day - 3) * 3)
}

function waveFor(day: number): Kind[] {
  if (day <= 1) return ['husk', 'husk', 'husk', 'husk', 'husk', 'husk', 'husk']
  if (day === 2) return ['husk', 'stalker', 'runner', 'husk', 'stalker', 'husk', 'runner', 'stalker', 'husk', 'runner']
  if (day === 3) return ['stalker', 'husk', 'runner', 'brute', 'stalker', 'husk', 'runner', 'brute', 'stalker', 'husk', 'runner', 'brute']
  const wave: Kind[] = ['husk', 'stalker', 'runner', 'brute', 'husk', 'stalker', 'runner', 'husk', 'brute', 'stalker']
  const extra = Math.min(2, day - 3)
  for (let i = 0; i < extra; i += 1) wave.push(i % 2 === 0 ? 'runner' : 'husk')
  return wave
}

function spawnGoal(day: number) {
  return waveFor(day).length
}

function rollKind(day: number, index: number): Kind {
  const wave = waveFor(day)
  return wave[Math.min(index, wave.length - 1)]
}

function maxHp(kind: Kind, day = world.day) {
  if (day <= 1) return 30
  if (kind === 'brute') return day >= 3 ? 86 : 78
  if (kind === 'stalker') return 26
  if (kind === 'runner') return 18
  return 36
}

function speedFor(kind: Kind) {
  if (kind === 'brute') return 0.058
  if (kind === 'stalker') return 0.22
  if (kind === 'runner') return 0.33
  return 0.12
}

export function dawnOffers(): Array<keyof Ranks> {
  if (world.day <= 1) return ['barricade', 'clinic', 'rations']
  if (world.day === 2) {
    const third: keyof Ranks = world.ranks.clinic === 0 ? 'clinic' : world.ranks.rations === 0 ? 'rations' : 'barricade'
    return ['capacitor', 'battery', third]
  }
  return ['barricade', 'battery', 'capacitor']
}

export function upgradeCost(kind: keyof Ranks) {
  return 8 + world.ranks[kind] * 6
}

export function overdriveActive() {
  return world.phase === 'night' && world.nightTime < world.overdriveUntil && world.nightTime > 0
}

function applyMetaToFresh() {
  world.barricadeMax = 100 + world.permanent.barricade * 18
  world.barricade = Math.min(world.barricadeMax, 60 + world.permanent.barricade * 14)
  world.power = Math.min(99, 40 + world.permanent.battery * 8)
  world.ranks = emptyRanks()
  world.ranks.capacitor = world.permanent.capacitor
  world.ranks.clinic = world.permanent.clinic
  world.ranks.rations = world.permanent.rations
}

function blankRun() {
  world.day = 1
  world.scrap = 22
  world.morale = 72
  world.core = 100
  world.rescued = false
  world.assigned = false
  world.rescueT = 0
  world.assignT = 0
  world.repairT = 0
  world.nightTime = 0
  world.overdriveUntil = 0
  world.overdriveReady = 5
  world.repairReady = 2.5
  world.spawnAcc = 0
  world.spawned = 0
  world.kills = 0
  world.leaks = 0
  world.cleared = 0
  world.failReason = ''
  world.enemies = []
  world.fireCd = 0
  world.firing = false
  world.demo = false
  world.hold = false
  world.preview = false
  world.event = 'none'
  world.eventUntil = 0
  world.eventDone = false
  world.eventProgress = 0
  world.eventNeed = 0
  world.lampSteady = false
  world.lampOut = false
  world.clinicUsed = false
  world.clinicPulse = 0
  applyMetaToFresh()
  world.nightDuration = nightLength(1)
  world.spawnGoal = spawnGoal(1)
}

export function playFromTitle() {
  blankRun()
  if (world.tutorialDone) {
    world.phase = 'dusk'
    world.tutorial = false
    world.rescued = true
    world.assigned = true
    world.barricade = Math.min(world.barricadeMax, Math.max(world.barricade, 85))
  } else {
    world.phase = 'rescue'
    world.tutorial = true
  }
  sfx('start')
  emit()
  save()
}

export function skipTutorial() {
  if (world.phase === 'night' || world.phase === 'dawn' || world.phase === 'upgrade' || world.phase === 'fail') return
  blankRun()
  world.tutorialDone = true
  world.tutorial = false
  world.phase = 'dusk'
  world.rescued = true
  world.assigned = true
  world.barricade = Math.min(world.barricadeMax, 85)
  sfx('ui')
  emit()
  save()
}

export function beginRescue() {
  if (world.phase !== 'rescue') return
  world.phase = 'rescuing'
  world.rescueT = 0
  sfx('ui')
  emit()
}

export function beginAssign() {
  if (world.phase !== 'assign') return
  world.phase = 'assigning'
  world.assignT = 0
  foot = 0
  sfx('assign')
  emit()
}

export function beginRepair() {
  if (world.phase !== 'repair') return
  if (world.scrap < 10) {
    sfx('error')
    popup(-0.2, 1.8, 3.2, 'NEED 10 SCRAP', '#ffb4a8')
    emit()
    return
  }
  world.scrap -= 10
  world.phase = 'repairing'
  world.repairT = 0
  foot = 0
  sfx('repair')
  popup(0, 1.7, 3.3, '-10 SCRAP', '#ffd58a')
  emit()
}

export function beginNight() {
  if (world.phase !== 'dusk') return
  world.phase = 'night'
  world.nightTime = 0
  world.nightDuration = nightLength(world.day)
  world.spawnGoal = spawnGoal(world.day)
  world.spawned = 0
  world.spawnAcc = 0
  world.kills = 0
  world.leaks = 0
  world.overdriveUntil = 0
  world.overdriveReady = world.day === 1 ? 4.2 : 1.2
  world.repairReady = 1.4
  world.enemies = []
  world.fireCd = 0
  world.event = 'none'
  world.eventUntil = 0
  world.eventDone = false
  world.eventProgress = 0
  world.eventNeed = 0
  world.lampSteady = false
  world.lampOut = false
  world.clinicUsed = false
  if (world.ranks.rations > 0) {
    const bonus = 4 + world.ranks.rations * 2
    world.scrap = Math.min(99, world.scrap + bonus)
    world.morale = Math.min(100, world.morale + 6 + world.ranks.rations * 2)
    popup(-1.6, 1.5, 0.4, `+${bonus} RATIONS`, '#ffd58a')
  }
  nightSnap = {
    day: world.day,
    power: world.power,
    scrap: world.scrap,
    morale: world.morale,
    core: world.core,
    barricade: world.barricade,
    barricadeMax: world.barricadeMax,
    ranks: { ...world.ranks },
  }
  sfx('ui')
  emit()
  save()
}

export function openUpgrade() {
  if (world.phase !== 'dawn') return
  world.phase = 'upgrade'
  sfx('ui')
  emit()
}

export function chooseUpgrade(kind: keyof Ranks) {
  if (world.phase !== 'upgrade') return
  if (!dawnOffers().includes(kind)) return
  const cap = kind === 'clinic' || kind === 'rations' ? 2 : 3
  if (world.ranks[kind] >= cap) {
    sfx('error')
    return
  }
  const cost = upgradeCost(kind)
  if (world.scrap < cost) {
    sfx('error')
    popup(0, 1.6, 0.4, `NEED ${cost} SCRAP`, '#ffb4a8')
    emit()
    return
  }
  world.scrap -= cost
  world.ranks[kind] += 1
  if (kind === 'barricade') {
    world.barricadeMax += 20
    world.barricade = Math.min(world.barricadeMax, world.barricade + 30)
  } else if (kind === 'battery') {
    world.power = Math.min(99, world.power + 22)
  } else if (kind === 'clinic') {
    world.morale = Math.min(100, world.morale + 8)
    world.clinicPulse = 1.6
  }
  world.banked += 6 + world.kills
  world.day += 1
  world.phase = 'dusk'
  world.power = Math.min(99, world.power + 10)
  world.scrap = Math.min(99, world.scrap + 6)
  world.morale = Math.min(100, world.morale + 6)
  sfx('upgrade')
  emit()
  save()
}

export function retryNight() {
  if (!nightSnap) {
    playFromTitle()
    return
  }
  world.day = nightSnap.day
  world.power = nightSnap.power
  world.scrap = nightSnap.scrap
  world.morale = Math.max(nightSnap.morale, 48)
  world.core = nightSnap.core
  world.barricade = nightSnap.barricade
  world.barricadeMax = nightSnap.barricadeMax
  world.ranks = { ...nightSnap.ranks }
  world.phase = 'dusk'
  world.enemies = []
  world.failReason = ''
  world.hurt = 0
  sfx('ui')
  emit()
  save()
}

export function backToTitle() {
  world.phase = 'title'
  world.preview = true
  world.enemies = []
  world.firing = false
  world.demo = false
  world.hold = false
  sfx('ui')
  emit()
  save()
}

export function buyPermanent(kind: keyof Ranks) {
  const rank = world.permanent[kind]
  if (rank >= 3) return
  const cost = 10 + rank * 8
  if (world.banked < cost) {
    sfx('error')
    return
  }
  world.banked -= cost
  world.permanent[kind] += 1
  sfx('upgrade')
  emit()
  save()
}

export function toggleMute() {
  world.muted = !world.muted
  emit()
  save()
}

export function interact(target: 'house' | 'bench' | 'barricade') {
  if (target === 'house') beginRescue()
  if (target === 'bench') beginAssign()
  if (target === 'barricade') beginRepair()
}

export function pressInteract() {
  if (world.phase === 'rescue') beginRescue()
  else if (world.phase === 'assign') beginAssign()
  else if (world.phase === 'repair') beginRepair()
  else if (world.phase === 'dusk') beginNight()
  else if (world.phase === 'dawn') openUpgrade()
  else if (world.phase === 'title') playFromTitle()
}

function lampOrigin(x: number): [number, number, number] {
  return x < 0 ? [-2.22, 1.55, 2.02] : [2.3, 1.48, 2.12]
}

export function strike(enemy: Enemy, free = false) {
  if (world.phase !== 'night' || enemy.hp <= 0) return false
  if (!free && world.fireCd > 0) return false
  const cost = 0.62
  if (!free && world.power < 1) {
    sfx('error')
    popup(0.2, 2.1, -1.4, 'LOW POWER', '#ffb4a8')
    return false
  }
  if (!free) world.power = Math.max(0, world.power - cost)
  const rate = Math.max(0.11, 0.18 - world.ranks.capacitor * 0.02)
  if (!free) world.fireCd = rate
  const [x, y, z] = enemyPosition(enemy)
  const [lx, ly, lz] = lampOrigin(x)
  world.beams.push({ x1: lx, y1: ly, z1: lz, x2: x, y2: y + 0.7, z2: z, life: 0.12, max: 0.12 })
  if (world.beams.length > 8) world.beams.shift()
  const damage = 10 + world.ranks.capacitor * 4
  enemy.hp -= damage
  enemy.flash = 0.14
  popup(x, y + 1.35, z, String(damage), '#f4efe4')
  burst(x, y + 0.7, z, '#b7fff4', 6)
  world.punch = Math.min(0.045, world.punch + 0.012)
  sfx('shot')
  if (enemy.hp <= 0) {
    enemy.hp = 0
    world.kills += 1
    world.hitStop = Math.max(world.hitStop, world.reduceMotion ? 0 : 0.055)
    world.shake = Math.min(0.7, world.shake + 0.34)
    world.punch = Math.min(0.06, world.punch + 0.028)
    const scrap = enemy.kind === 'brute' ? 3 : 2
    world.scrap = Math.min(99, world.scrap + scrap)
    burst(x, y + 0.6, z, enemy.kind === 'brute' ? '#ffb15a' : '#ffd58a', enemy.kind === 'brute' ? 16 : 12)
    popup(x, y + 1.7, z, `+${scrap} SCRAP`, '#ffd58a')
    onEventKill(enemy)
    sfx('kill')
  } else {
    world.hitStop = Math.max(world.hitStop, world.reduceMotion ? 0 : 0.028)
    sfx('hit')
  }
  return true
}

export function fireAt(x: number, z: number) {
  world.aim = { x, z }
  if (world.phase !== 'night') return
  let best: Enemy | null = null
  let bestDist = 1.45
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue
    const [ex, , ez] = enemyPosition(enemy)
    const dist = Math.hypot(ex - x, ez - z)
    if (dist < bestDist) {
      best = enemy
      bestDist = dist
    }
  }
  if (!best) {
    let fallback = 99
    for (const enemy of world.enemies) {
      if (enemy.hp <= 0) continue
      const [ex, , ez] = enemyPosition(enemy)
      const dist = Math.hypot(ex - x, ez - z)
      if (dist < fallback) {
        fallback = dist
        best = enemy
      }
    }
    if (!best || fallback > 3.2) return
  }
  strike(best)
}

export function triggerOverdrive() {
  if (world.phase !== 'night') return
  if (world.nightTime < world.overdriveUntil) return
  if (overdriveCooldown() > 0) {
    sfx('error')
    if (world.nightTime < world.overdriveReady) popup(0, 2.2, 1.2, 'WAIT FOR THEM', '#ffd58a')
    emit()
    return
  }
  if (world.power < 6) {
    sfx('error')
    popup(0, 2.2, 1.2, 'NEED 6 POWER', '#ffb4a8')
    emit()
    return
  }
  world.power -= 6
  world.overdriveUntil = world.nightTime + 6 + Math.min(3, world.ranks.capacitor)
  world.shake = Math.min(0.8, world.shake + 0.45)
  world.punch = 0.04
  burst(-2.22, 1.4, 2.02, '#9ffff2', 10)
  burst(2.3, 1.3, 2.12, '#9ffff2', 10)
  if (world.event === 'flicker' && !world.eventDone) finishEvent(true)
  sfx('overload')
  emit()
}

export function overdriveCooldown() {
  if (world.phase !== 'night') return 0
  if (world.nightTime < world.overdriveReady) return Math.ceil(world.overdriveReady - world.nightTime)
  if (world.nightTime < world.overdriveUntil) return 0
  if (world.overdriveUntil <= 0) return 0
  return Math.max(0, Math.ceil(world.overdriveUntil + 11 - world.nightTime))
}

export function triggerRepair() {
  if (world.phase !== 'night') return
  if (world.nightTime < world.repairReady) {
    sfx('error')
    return
  }
  const since = world.repairReady
  if (world.barricade >= world.barricadeMax) {
    sfx('error')
    popup(0, 1.6, 3.3, 'BARRICADE FULL', '#d5efe8')
    emit()
    return
  }
  if (world.nightTime < since) return
  if (world.scrap < 4) {
    sfx('error')
    popup(0, 1.6, 3.3, 'NEED SCRAP', '#ffb4a8')
    emit()
    return
  }
  world.scrap -= 4
  world.barricade = Math.min(world.barricadeMax, world.barricade + 16)
  world.repairReady = world.nightTime + 8
  burst(0, 0.8, 3.35, '#e7c39a', 8)
  popup(0.2, 1.55, 3.35, '+16', '#b6f3c0')
  sfx('repair')
  emit()
}

export function repairCooldown() {
  if (world.phase !== 'night') return 0
  return Math.max(0, Math.ceil(world.repairReady - world.nightTime))
}

function makeEnemy(kind: Kind, lane: 0 | 1, t: number, marked = false): Enemy {
  const hp = maxHp(kind)
  return {
    id: uid++,
    kind,
    lane,
    t,
    hp,
    maxHp: hp,
    flash: 0,
    bite: 0,
    weave: Math.random() * Math.PI * 2,
    marked,
  }
}

function spawnEnemy() {
  const kind = rollKind(world.day, world.spawned)
  const headstart = kind === 'runner' ? 0.34 : kind === 'stalker' && world.day >= 3 ? 0.12 : 0
  world.enemies.push(makeEnemy(kind, (world.spawned % 2) as 0 | 1, headstart))
  world.spawned += 1
}

function onEventKill(enemy: Enemy) {
  if (world.demo || world.eventDone || world.event === 'none') return
  if (world.event === 'curb' && (enemy.kind === 'stalker' || enemy.kind === 'runner')) {
    world.eventProgress += 1
    if (world.eventProgress >= world.eventNeed) finishEvent(true)
  }
  if (world.event === 'brute' && enemy.marked) finishEvent(true)
}

function finishEvent(ok: boolean) {
  if (world.eventDone || world.event === 'none') return
  world.eventDone = true
  if (ok) {
    if (world.event === 'flicker') {
      world.lampSteady = true
      world.lampOut = false
      world.scrap = Math.min(99, world.scrap + 4)
      popup(-2.1, 2.1, 2.0, 'LAMP STEADY', '#b7fff4')
      burst(-2.22, 1.5, 2.02, '#9ffff2', 12)
    } else if (world.event === 'curb') {
      world.scrap = Math.min(99, world.scrap + 6)
      world.lampSteady = true
      popup(2.1, 2.0, 2.1, 'CURB CLEAR', '#ffd58a')
    } else {
      world.barricade = Math.min(world.barricadeMax, world.barricade + 14)
      world.morale = Math.min(100, world.morale + 6)
      popup(0.1, 1.9, 3.2, 'GATE HOLDS', '#b6f3c0')
      burst(0, 1.1, 3.3, '#e7c39a', 12)
    }
    sfx('upgrade')
    return
  }
  if (world.event === 'flicker') {
    world.lampOut = true
    world.enemies.push(makeEnemy('husk', 0, 0.32))
    popup(-2.1, 2.1, 2.0, 'LAMP OUT', '#ffb4a8')
  } else if (world.event === 'curb') {
    world.enemies.push(makeEnemy('runner', 1, 0.48))
    popup(1.4, 1.8, 3.6, 'THEY SLIPPED', '#ffb15a')
  } else {
    world.shake = 0.8
    popup(0.1, 1.9, 3.2, 'GATE HIT', '#ffb4a8')
  }
  sfx('core')
}

function openEvent() {
  if (world.event !== 'none' || world.hold) return
  if (world.day === 1 && world.nightTime >= 7) {
    world.event = 'flicker'
    world.eventUntil = world.nightTime + 7
    world.eventNeed = 1
    popup(-2.2, 2.2, 2, 'LAMP FLICKER', '#ffb4a8')
    sfx('error')
  } else if (world.day === 2 && world.nightTime >= 8) {
    world.event = 'curb'
    world.eventUntil = world.nightTime + 9
    world.eventNeed = 2
    popup(1.6, 2.1, 4.2, 'ON THE CURB', '#ffb15a')
    sfx('error')
  } else if (world.day >= 3 && world.nightTime >= 8 && world.day === 3) {
    world.event = 'brute'
    world.eventUntil = world.nightTime + 14
    world.eventNeed = 1
    world.enemies.push(makeEnemy('brute', 0, 0.16, true))
    popup(0, 2.3, 4.4, 'BRUTE INBOUND', '#ffb15a')
    sfx('error')
  }
}

function tickClinic() {
  if (world.clinicUsed || world.ranks.clinic <= 0 || world.nightTime < 5) return
  if (world.barricade > world.barricadeMax * 0.62) return
  world.clinicUsed = true
  const heal = 10 + world.ranks.clinic * 6
  world.barricade = Math.min(world.barricadeMax, world.barricade + heal)
  world.morale = Math.min(100, world.morale + 4)
  world.clinicPulse = 1.5
  popup(-2.2, 1.6, -0.2, `CLINIC +${heal}`, '#ffb4a8')
  burst(-2.3, 0.9, -0.3, '#ff8d7a', 10)
  sfx('repair')
}

function fail(reason: string) {
  world.phase = 'fail'
  world.failReason = reason
  world.firing = false
  world.enemies = []
  sfx('fail')
  emit()
  save()
}

function winNight() {
  world.cleared = world.day
  world.bestNight = Math.max(world.bestNight, world.day)
  world.phase = 'dawn'
  world.firing = false
  world.enemies = []
  world.tutorialDone = true
  world.banked += 4
  sfx('win')
  emit()
  save()
}

function tickNight(dt: number) {
  if (!world.hold) world.nightTime += dt
  const pressure = 1 + Math.max(0, world.day - 1) * 0.06
  if (world.spawned < world.spawnGoal) {
    world.spawnAcc += dt
    const every = world.day <= 1 ? 1.55 : world.day === 2 ? 1.05 : world.day === 3 ? 0.95 : Math.max(0.8, 1.05 - (world.day - 3) * 0.04)
    if (world.spawnAcc >= every) {
      world.spawnAcc = 0
      spawnEnemy()
    }
  }
  if (!world.eventDone) openEvent()
  tickClinic()
  const overload = overdriveActive()
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue
    enemy.flash = Math.max(0, enemy.flash - dt)
    const lit = inLight(enemy)
    const burn = enemy.kind === 'brute' ? 4.2 : enemy.kind === 'runner' ? 8 : 6.5
    if (overload && lit) {
      enemy.hp -= burn * dt
      if (enemy.hp <= 0) {
        enemy.hp = 0
        world.kills += 1
        const scrap = enemy.kind === 'brute' ? 3 : 2
        world.scrap = Math.min(99, world.scrap + scrap)
        const [x, y, z] = enemyPosition(enemy)
        popup(x, y + 1.6, z, `+${scrap} SCRAP`, '#ffd58a')
        burst(x, y + 0.6, z, '#9ffff2', 8)
        onEventKill(enemy)
      }
    }
    if (enemy.hp <= 0) continue
    const slow = overload && lit ? (enemy.kind === 'runner' ? 0.55 : 0.38) : 1
    const gate = 0.62
    const atGate = enemy.t >= gate && world.barricade > 0
    const slipping = atGate && enemy.kind === 'runner'
    if (!atGate || slipping) {
      const slip = slipping ? 0.42 : 1
      enemy.t = Math.min(1, enemy.t + speedFor(enemy.kind) * pressure * slow * slip * dt)
    }
    if (atGate) {
      enemy.bite -= dt
      if (enemy.bite <= 0) {
        enemy.bite = enemy.kind === 'brute' ? 0.52 : enemy.kind === 'runner' ? 0.42 : enemy.kind === 'stalker' ? 0.58 : 0.72
        const guard = world.day === 1 && world.nightTime < 8 ? 0.45 : 1
        const bite = enemy.kind === 'brute' ? 11 : enemy.kind === 'runner' ? 3 : enemy.kind === 'stalker' ? 4 : 6
        world.barricade = Math.max(0, world.barricade - bite * guard)
        world.shake = Math.min(0.55, world.shake + (enemy.kind === 'brute' ? 0.22 : 0.12))
        if (world.barricade <= 0) {
          world.morale = Math.max(0, world.morale - 8)
          world.shake = 0.7
          sfx('core')
        }
      }
    }
    if (enemy.marked && world.event === 'brute' && !world.eventDone && enemy.t >= 0.62) finishEvent(false)
    if (enemy.t >= 1 && world.barricade <= 0) {
      world.core = Math.max(0, world.core - (enemy.kind === 'brute' ? 16 : enemy.kind === 'runner' ? 8 : 10))
      world.morale = Math.max(0, world.morale - 6)
      world.leaks += 1
      world.hurt = 0.85
      world.shake = 0.85
      enemy.hp = 0
      sfx('core')
    }
  }
  if (world.event !== 'none' && !world.eventDone && world.nightTime >= world.eventUntil) finishEvent(false)
  if (world.barricade <= 0) {
    const pressure = 1 + (world.day - 1) * 0.08
    world.core = Math.max(0, world.core - 8 * pressure * dt)
    world.hurt = Math.max(world.hurt, 0.35)
  }
  if (world.core <= 0) {
    fail(world.barricade <= 0
      ? 'The barricade fell and the horde reached the generator. Repair earlier, or reinforce it at dawn.'
      : 'The generator took too many hits. Fire the relays before they leave the light.')
    return
  }
  if (world.morale <= 0) {
    fail('The block lost heart. Keep the lamps overloaded and the core covered.')
    return
  }
  const living = world.enemies.some(enemy => enemy.hp > 0)
  const eventOk = world.event === 'none' || world.eventDone
  const minHold = world.day <= 1 ? 8 : world.day === 2 ? 16 : 18
  const cleared = eventOk && world.leaks === 0 && world.spawned >= world.spawnGoal && !living && world.nightTime > minHold
  if (!world.hold && eventOk && (world.nightTime >= world.nightDuration || cleared)) winNight()
}

function tickShow(dt: number) {
  if (world.phase === 'rescuing') {
    world.rescueT = Math.min(1, world.rescueT + dt / 1.15)
    if (world.rescueT >= 1) {
      world.rescued = true
      world.phase = 'assign'
      world.morale = Math.min(100, world.morale + 4)
      world.punch = 0.045
      world.shake = 0.28
      burst(-2.7, 0.8, -2.4, '#ffd58a', 14)
      popup(-2.5, 2.1, -2.5, 'LIN IS OUT', '#f4efe4')
      sfx('rescue')
      emit()
    }
  }
  if (world.phase === 'assigning') {
    const prev = world.assignT
    world.assignT = Math.min(1, world.assignT + dt / 1.2)
    if (foot < 4 && world.assignT > [0.2, 0.4, 0.6, 0.8][foot]) {
      foot += 1
      sfx('step')
    }
    if (prev < 1 && world.assignT >= 1) {
      world.assigned = true
      world.phase = 'repair'
      world.scrap = Math.min(99, world.scrap + 6)
      burst(-1.5, 0.9, 0.05, '#7dffe8', 10)
      popup(-1.6, 1.7, 0.1, '+6 SCRAP', '#7dffe8')
      sfx('scrap')
      emit()
    }
  }
  if (world.phase === 'repairing') {
    world.repairT = Math.min(1, world.repairT + dt / 1.35)
    if (foot < 4 && world.repairT > [0.22, 0.4, 0.58, 0.76][foot]) {
      foot += 1
      sfx('step')
    }
    if (world.repairT >= 1 && world.phase === 'repairing') {
      world.phase = 'dusk'
      world.barricade = Math.min(world.barricadeMax, 85)
      world.punch = 0.03
      burst(0.1, 0.7, 3.3, '#e7c39a', 10)
      popup(0.2, 1.6, 3.2, 'BARRICADE UP', '#f4efe4')
      sfx('repair')
      emit()
      save()
    }
  }
}

export function step(dt: number) {
  const visual = dt
  world.shake = Math.max(0, world.shake - visual * 1.8)
  world.punch = Math.max(0, world.punch - visual * 1.4)
  world.hurt = Math.max(0, world.hurt - visual * 1.6)
  world.clinicPulse = Math.max(0, world.clinicPulse - visual)
  world.fireCd = Math.max(0, world.fireCd - visual)
  for (const spark of world.sparks) {
    spark.life -= visual
    spark.x += spark.vx * visual
    spark.y += spark.vy * visual
    spark.z += spark.vz * visual
    spark.vy -= 3 * visual
  }
  world.sparks = world.sparks.filter(spark => spark.life > 0)
  for (const item of world.popups) {
    item.life -= visual
    item.y += visual * 0.35
  }
  world.popups = world.popups.filter(item => item.life > 0)
  for (const beam of world.beams) beam.life -= visual
  world.beams = world.beams.filter(beam => beam.life > 0)

  let sim = dt
  if (world.hitStop > 0) {
    world.hitStop = Math.max(0, world.hitStop - dt)
    sim = 0
  }
  if (sim > 0) {
    tickShow(sim)
    if (world.phase === 'night') {
      if (world.firing) fireAt(world.aim.x, world.aim.z)
      if (world.demo) {
        world.demoAcc += sim
        const living = world.enemies.filter(enemy => enemy.hp > 0)
        if (living.length < 4) {
          const dead = world.enemies.find(enemy => enemy.hp <= 0)
          if (dead) {
            dead.hp = dead.maxHp
            dead.t = 0.48 + Math.random() * 0.2
          }
        }
        if (world.demoAcc > 0.32) {
          world.demoAcc = 0
          const target = world.enemies.find(enemy => enemy.hp > 0 && enemy.hp < enemy.maxHp) ?? world.enemies.find(enemy => enemy.hp > 0)
          if (target) {
            if (target.hp < 12) target.hp = target.maxHp
            strike(target, true)
          }
        }
      }
      const regen = 0.95 + world.ranks.battery * 0.45
      world.power = Math.min(99, world.power + regen * sim)
      tickNight(sim)
    }
  }
  uiAcc += dt
  if (uiAcc > 0.12) {
    uiAcc = 0
    emit()
  }
  saveAcc += dt
  if (saveAcc > 2 && world.phase === 'night' && !world.demo) {
    saveAcc = 0
    save()
  }
}

type SaveRun = {
  phase: Phase
  day: number
  power: number
  scrap: number
  morale: number
  core: number
  barricade: number
  barricadeMax: number
  rescued: boolean
  assigned: boolean
  tutorial: boolean
  nightTime: number
  ranks: Ranks
  cleared: number
  enemies: Enemy[]
  spawned: number
  spawnGoal: number
  kills: number
  leaks: number
  event: NightEvent
  eventUntil: number
  eventDone: boolean
  eventProgress: number
  eventNeed: number
  lampSteady: boolean
  lampOut: boolean
  clinicUsed: boolean
}

export function save() {
  if (world.demo) return
  try {
    const run: SaveRun | null = world.phase === 'title' ? null : {
      phase: world.phase,
      day: world.day,
      power: world.power,
      scrap: world.scrap,
      morale: world.morale,
      core: world.core,
      barricade: world.barricade,
      barricadeMax: world.barricadeMax,
      rescued: world.rescued,
      assigned: world.assigned,
      tutorial: world.tutorial,
      nightTime: world.nightTime,
      ranks: world.ranks,
      cleared: world.cleared,
      enemies: world.enemies,
      spawned: world.spawned,
      spawnGoal: world.spawnGoal,
      kills: world.kills,
      leaks: world.leaks,
      event: world.event,
      eventUntil: world.eventUntil,
      eventDone: world.eventDone,
      eventProgress: world.eventProgress,
      eventNeed: world.eventNeed,
      lampSteady: world.lampSteady,
      lampOut: world.lampOut,
      clinicUsed: world.clinicUsed,
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1,
      muted: world.muted,
      tutorialDone: world.tutorialDone,
      bestNight: world.bestNight,
      banked: world.banked,
      permanent: world.permanent,
      run,
    }))
  } catch { /* private mode */ }
}

export function load() {
  world.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) {
      world.preview = true
      emit()
      return
    }
    const data = JSON.parse(raw) as {
      muted?: boolean
      tutorialDone?: boolean
      bestNight?: number
      banked?: number
      permanent?: Ranks
      run?: SaveRun | null
    }
    world.muted = !!data.muted
    world.tutorialDone = !!data.tutorialDone
    world.bestNight = data.bestNight ?? 0
    world.banked = data.banked ?? 0
    world.permanent = fillRanks(data.permanent)
    if (data.run && data.run.phase !== 'title') {
      blankRun()
      Object.assign(world, data.run)
      world.ranks = fillRanks(data.run.ranks)
      world.enemies = (data.run.enemies ?? []).map(enemy => ({
        ...enemy,
        weave: enemy.weave ?? 0,
        marked: !!enemy.marked,
      }))
      world.event = data.run.event ?? 'none'
      world.eventDone = data.run.eventDone ?? world.event === 'none'
      world.preview = false
    } else {
      world.phase = 'title'
      world.preview = true
    }
  } catch {
    world.preview = true
  }
  emit()
}

export function applyShot(shot: string) {
  world.muted = true
  world.demo = false
  world.hold = false
  world.reduceMotion = false
  blankRun()
  world.tutorialDone = false
  world.bestNight = 0
  world.banked = 0
  world.permanent = emptyRanks()
  applyMetaToFresh()
  if (shot === 'title') {
    world.phase = 'title'
    world.preview = true
  } else if (shot === 'tutorial') {
    world.phase = 'rescue'
    world.tutorial = true
    world.preview = false
  } else if (shot === 'combat') {
    world.phase = 'night'
    world.tutorial = true
    world.rescued = true
    world.assigned = true
    world.barricade = 68
    world.power = 31
    world.scrap = 18
    world.core = 92
    world.morale = 70
    world.nightTime = 9
    world.nightDuration = 28
    world.overdriveUntil = 99
    world.overdriveReady = 0
    world.hold = true
    world.demo = true
    world.spawned = 5
    world.spawnGoal = 6
    const specs: Array<[Kind, 0 | 1, number, number]> = [
      ['husk', 0, 0.58, 14],
      ['husk', 1, 0.5, 26],
      ['husk', 0, 0.66, 20],
      ['stalker', 1, 0.47, 16],
      ['husk', 1, 0.7, 9],
    ]
    world.enemies = specs.map(([kind, lane, t, hp]) => ({
      id: uid++,
      kind,
      lane,
      t,
      hp,
      maxHp: maxHp(kind),
      flash: 0,
      bite: 0.4,
      weave: lane === 0 ? 0.4 : 1.7,
      marked: false,
    }))
    world.event = 'none'
    world.eventDone = true
    popup(-1.1, 1.8, 3.1, '12', '#f4efe4')
    popup(1.2, 1.9, 3.4, '+2 SCRAP', '#ffd58a')
    burst(-1.05, 0.9, 3.5, '#b7fff4', 10)
  } else if (shot === 'night2') {
    world.phase = 'night'
    world.day = 2
    world.tutorial = false
    world.tutorialDone = true
    world.rescued = true
    world.assigned = true
    world.ranks.clinic = 1
    world.barricade = 78
    world.barricadeMax = 120
    world.power = 44
    world.scrap = 16
    world.core = 90
    world.morale = 74
    world.nightTime = 12
    world.nightDuration = 30
    world.overdriveUntil = 0
    world.overdriveReady = 0
    world.hold = true
    world.demo = true
    world.spawned = 6
    world.spawnGoal = 8
    world.event = 'curb'
    world.eventUntil = 20
    world.eventDone = false
    world.eventNeed = 2
    world.eventProgress = 1
    const specs: Array<[Kind, 0 | 1, number, number]> = [
      ['stalker', 0, 0.52, 12],
      ['runner', 1, 0.46, 10],
      ['husk', 0, 0.6, 22],
      ['stalker', 1, 0.38, 16],
    ]
    world.enemies = specs.map(([kind, lane, t, hp]) => ({
      id: uid++, kind, lane, t, hp, maxHp: maxHp(kind), flash: 0, bite: 0.3, weave: lane + 0.6, marked: false,
    }))
    popup(1.3, 1.8, 3.6, '8', '#f4efe4')
    popup(-1.2, 1.7, 3.2, '+2 SCRAP', '#ffd58a')
  } else if (shot === 'night3') {
    world.phase = 'night'
    world.day = 3
    world.tutorialDone = true
    world.rescued = true
    world.assigned = true
    world.ranks.clinic = 1
    world.ranks.rations = 1
    world.ranks.capacitor = 1
    world.barricade = 70
    world.barricadeMax = 120
    world.power = 38
    world.scrap = 20
    world.core = 84
    world.morale = 68
    world.nightTime = 11
    world.nightDuration = 36
    world.overdriveUntil = 99
    world.overdriveReady = 0
    world.hold = true
    world.demo = true
    world.spawned = 5
    world.spawnGoal = 10
    world.event = 'brute'
    world.eventUntil = 24
    world.eventDone = false
    world.eventNeed = 1
    world.eventProgress = 0
    const specs: Array<[Kind, 0 | 1, number, number, boolean]> = [
      ['brute', 0, 0.4, 48, true],
      ['runner', 1, 0.55, 8, false],
      ['stalker', 1, 0.48, 14, false],
      ['husk', 0, 0.62, 18, false],
    ]
    world.enemies = specs.map(([kind, lane, t, hp, marked]) => ({
      id: uid++, kind, lane, t, hp, maxHp: maxHp(kind), flash: kind === 'brute' ? 0.1 : 0, bite: 0.2, weave: 1.1, marked,
    }))
    popup(0.2, 2.1, 3.5, '14', '#f4efe4')
    burst(0.1, 1.1, 3.6, '#ffb15a', 8)
  } else if (shot === 'upgrade') {
    world.phase = 'upgrade'
    world.day = 1
    world.cleared = 1
    world.rescued = true
    world.assigned = true
    world.scrap = 24
    world.power = 36
    world.barricade = 64
    world.core = 88
    world.morale = 76
    world.kills = 6
    world.bestNight = 1
  } else if (shot === 'result') {
    world.phase = 'dawn'
    world.day = 1
    world.cleared = 1
    world.rescued = true
    world.assigned = true
    world.core = 86
    world.barricade = 54
    world.morale = 74
    world.kills = 6
    world.scrap = 24
    world.bestNight = 1
    world.banked = 10
  }
  emit()
}

export function cacheCost(kind: keyof Ranks) {
  return 10 + world.permanent[kind] * 8
}
