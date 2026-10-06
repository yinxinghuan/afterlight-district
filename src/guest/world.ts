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

export type Kind = 'husk' | 'stalker' | 'brute'

export type Enemy = {
  id: number
  kind: Kind
  lane: 0 | 1
  t: number
  hp: number
  maxHp: number
  flash: number
  bite: number
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

export type Ranks = { barricade: number; battery: number; capacitor: number }

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
  ranks: { barricade: 0, battery: 0, capacitor: 0 } as Ranks,
  permanent: { barricade: 0, battery: 0, capacitor: 0 } as Ranks,
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
  if (enemy.t <= gate) {
    const u = enemy.t / gate
    return [pts[0][0] + (pts[1][0] - pts[0][0]) * u, 0.22, pts[0][1] + (pts[1][1] - pts[0][1]) * u]
  }
  const u = (enemy.t - gate) / (1 - gate)
  return [pts[1][0] + (pts[2][0] - pts[1][0]) * u, 0.22, pts[1][1] + (pts[2][1] - pts[1][1]) * u]
}

function inLight(enemy: Enemy) {
  return enemy.t > 0.4 && enemy.t < 0.76
}

function nightLength(day: number) {
  return Math.min(48, 24 + day * 4)
}

function spawnGoal(day: number) {
  return Math.min(12, 6 + (day - 1) * 2)
}

function rollKind(day: number, index: number): Kind {
  if (day >= 4 && index % 5 === 4) return 'brute'
  if (day >= 2 && index % 3 === 2) return 'stalker'
  return 'husk'
}

function maxHp(kind: Kind) {
  if (kind === 'brute') return 64
  if (kind === 'stalker') return 20
  return 34
}

function speedFor(kind: Kind) {
  if (kind === 'brute') return 0.07
  if (kind === 'stalker') return 0.21
  return 0.125
}

export function overdriveActive() {
  return world.phase === 'night' && world.nightTime < world.overdriveUntil && world.nightTime > 0
}

function applyMetaToFresh() {
  world.barricadeMax = 100 + world.permanent.barricade * 18
  world.barricade = Math.min(world.barricadeMax, 60 + world.permanent.barricade * 14)
  world.power = Math.min(99, 40 + world.permanent.battery * 8)
  world.ranks = { barricade: 0, battery: 0, capacitor: world.permanent.capacitor }
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
  world.overdriveReady = world.day === 1 ? 4.5 : 1.2
  world.repairReady = 1.4
  world.enemies = []
  world.fireCd = 0
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

export function chooseUpgrade(kind: 'barricade' | 'battery' | 'capacitor') {
  if (world.phase !== 'upgrade') return
  if (kind === 'capacitor' && world.cleared < 2) {
    sfx('error')
    return
  }
  if (world.scrap < 8) {
    sfx('error')
    popup(0, 1.6, 0.4, 'NEED 8 SCRAP', '#ffb4a8')
    emit()
    return
  }
  world.scrap -= 8
  if (kind === 'barricade') {
    world.ranks.barricade += 1
    world.barricadeMax += 20
    world.barricade = Math.min(world.barricadeMax, world.barricade + 30)
  } else if (kind === 'battery') {
    world.ranks.battery += 1
    world.power = Math.min(99, world.power + 22)
  } else {
    world.ranks.capacitor += 1
  }
  world.banked += 6 + world.kills
  world.day += 1
  world.phase = 'dusk'
  world.power = Math.min(99, world.power + 10)
  world.scrap = Math.min(99, world.scrap + 8)
  world.morale = Math.min(100, world.morale + 8)
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
    world.scrap = Math.min(99, world.scrap + 2)
    world.hitStop = Math.max(world.hitStop, world.reduceMotion ? 0 : 0.055)
    world.shake = Math.min(0.7, world.shake + 0.34)
    world.punch = Math.min(0.06, world.punch + 0.028)
    burst(x, y + 0.6, z, '#ffd58a', 12)
    popup(x, y + 1.7, z, '+2 SCRAP', '#ffd58a')
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
  world.overdriveUntil = world.nightTime + 6
  world.shake = Math.min(0.8, world.shake + 0.45)
  world.punch = 0.04
  burst(-2.22, 1.4, 2.02, '#9ffff2', 10)
  burst(2.3, 1.3, 2.12, '#9ffff2', 10)
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

function spawnEnemy() {
  const kind = rollKind(world.day, world.spawned)
  const enemy: Enemy = {
    id: uid++,
    kind,
    lane: (world.spawned % 2) as 0 | 1,
    t: 0,
    hp: maxHp(kind),
    maxHp: maxHp(kind),
    flash: 0,
    bite: 0,
  }
  world.spawned += 1
  world.enemies.push(enemy)
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
  const pressure = 1 + (world.day - 1) * 0.08
  if (world.spawned < world.spawnGoal) {
    world.spawnAcc += dt
    const every = Math.max(0.8, 1.75 - (world.day - 1) * 0.14)
    if (world.spawnAcc >= every) {
      world.spawnAcc = 0
      spawnEnemy()
    }
  }
  const overload = overdriveActive()
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0) continue
    enemy.flash = Math.max(0, enemy.flash - dt)
    const lit = inLight(enemy)
    if (overload && lit) enemy.hp -= 6.5 * dt
    const slow = overload && lit ? 0.38 : 1
    const gate = 0.62
    const holding = enemy.t >= gate && world.barricade > 0
    if (!holding) enemy.t = Math.min(1, enemy.t + speedFor(enemy.kind) * pressure * slow * dt)
    if (holding) {
      enemy.bite -= dt
      if (enemy.bite <= 0) {
        enemy.bite = enemy.kind === 'brute' ? 0.55 : 0.7
        const guard = world.day === 1 && world.nightTime < 8 ? 0.45 : 1
        const dmg = (enemy.kind === 'brute' ? 10 : enemy.kind === 'stalker' ? 4 : 6) * guard
        world.barricade = Math.max(0, world.barricade - dmg)
        world.shake = Math.min(0.55, world.shake + 0.12)
        if (world.barricade <= 0) {
          world.morale = Math.max(0, world.morale - 8)
          world.shake = 0.7
          sfx('core')
        }
      }
    }
    if (enemy.t >= 1 && world.barricade <= 0) {
      world.core = Math.max(0, world.core - (enemy.kind === 'brute' ? 16 : 10))
      world.morale = Math.max(0, world.morale - 6)
      world.leaks += 1
      world.hurt = 0.85
      world.shake = 0.85
      enemy.hp = 0
      sfx('core')
    }
  }
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
  const cleared = world.leaks === 0 && world.spawned >= world.spawnGoal && !living && world.nightTime > 6
  if (!world.hold && (world.nightTime >= world.nightDuration || cleared)) winNight()
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
    world.permanent = data.permanent ?? { barricade: 0, battery: 0, capacitor: 0 }
    if (data.run && data.run.phase !== 'title') {
      blankRun()
      Object.assign(world, data.run)
      world.enemies = data.run.enemies ?? []
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
  world.permanent = { barricade: 0, battery: 0, capacitor: 0 }
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
    }))
    popup(-1.1, 1.8, 3.1, '12', '#f4efe4')
    popup(1.2, 1.9, 3.4, '+2 SCRAP', '#ffd58a')
    burst(-1.05, 0.9, 3.5, '#b7fff4', 10)
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
