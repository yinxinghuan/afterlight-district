import { useCallback, useEffect, useRef, useState } from 'react'
import { chord, tone } from '../audio/sound'
import type { GameSnapshot, Phase } from './types'

const INITIAL: GameSnapshot = {
  phase: 'intro',
  resources: { power: 40, food: 30, scrap: 25, morale: 60 },
  rescued: false,
  assigned: false,
  barricadeHp: 60,
  coreHp: 100,
  rescueProgress: 0,
  assignmentProgress: 0,
  defenseElapsed: 0,
  defenseDuration: 38,
  overdriveUntil: 0,
  overdriveUsed: false,
}

export function useAfterlight() {
  const [game, setGame] = useState<GameSnapshot>(INITIAL)
  const [muted, setMuted] = useState(() => localStorage.getItem('afterlight_muted') === '1')
  const phaseRef = useRef<Phase>('intro')
  const rafRef = useRef(0)
  const assignmentRafRef = useRef(0)
  const assignmentTimersRef = useRef<number[]>([])
  const lastRef = useRef(0)

  const play = useCallback((freq: number, duration?: number, volume?: number, next?: number) => {
    if (!muted) tone(freq, duration, volume, next)
  }, [muted])

  const setPhase = useCallback((phase: Phase) => {
    phaseRef.current = phase
    setGame(current => ({ ...current, phase }))
  }, [])

  const start = useCallback(() => {
    play(110, 0.28, 0.18, 220)
    setPhase('rescue-guide')
  }, [play, setPhase])

  const skipTutorial = useCallback(() => {
    setGame({ ...INITIAL, phase: 'dusk', rescued: true, assigned: true, assignmentProgress: 1, barricadeHp: 85, resources: { ...INITIAL.resources, scrap: 18 } })
    phaseRef.current = 'dusk'
  }, [])

  const rescue = useCallback(() => {
    if (phaseRef.current !== 'rescue-guide') return
    play(260, 0.08, 0.18)
    phaseRef.current = 'rescuing'
    setGame(current => ({ ...current, phase: 'rescuing', rescueProgress: 0 }))
    const started = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 3200)
      setGame(current => ({ ...current, rescueProgress: progress }))
      if (progress < 1) requestAnimationFrame(tick)
      else {
        if (!muted) { tone(392, 0.2, 0.12); window.setTimeout(() => tone(523, 0.2, 0.12), 90); window.setTimeout(() => tone(659, 0.26, 0.14), 180) }
        phaseRef.current = 'assign-guide'
        setGame(current => ({ ...current, phase: 'assign-guide', rescued: true, resources: { ...current.resources, power: current.resources.power - 4 } }))
      }
    }
    requestAnimationFrame(tick)
  }, [muted, play])

  const assignWorker = useCallback(() => {
    if (phaseRef.current !== 'assign-guide') return false
    play(440, 0.16, 0.16, 660)
    assignmentTimersRef.current.forEach(window.clearTimeout)
    assignmentTimersRef.current = []
    cancelAnimationFrame(assignmentRafRef.current)
    phaseRef.current = 'assigning'
    setGame(current => ({ ...current, phase: 'assigning', assigned: false, assignmentProgress: 0 }))

    let elapsed = 0
    let previous = performance.now()
    let footstepIndex = 0
    const footsteps = [0.18, 0.34, 0.50, 0.66, 0.82]
    const tick = (now: number) => {
      if (phaseRef.current !== 'assigning') return
      const delta = Math.min(100, Math.max(0, now - previous))
      previous = now
      elapsed += delta
      const progress = Math.min(1, elapsed / 2800)
      setGame(current => ({ ...current, assignmentProgress: progress }))
      if (footstepIndex < footsteps.length && progress >= footsteps[footstepIndex]) {
        play(footstepIndex % 2 === 0 ? 145 : 166, 0.045, 0.035)
        footstepIndex += 1
      }
      if (progress < 1) {
        assignmentRafRef.current = requestAnimationFrame(tick)
        return
      }
      phaseRef.current = 'production-proof'
      setGame(current => ({ ...current, phase: 'production-proof', assigned: true, assignmentProgress: 1 }))
      play(520, 0.12, 0.13, 700)
      assignmentTimersRef.current.push(window.setTimeout(() => {
        setGame(current => ({ ...current, resources: { ...current.resources, scrap: current.resources.scrap + 3 } }))
        play(620, 0.09, 0.11)
      }, 700))
    }
    assignmentRafRef.current = requestAnimationFrame(tick)
    return true
  }, [play])

  const continueToRepair = useCallback(() => setPhase('repair-guide'), [setPhase])

  const repairBarricade = useCallback(() => {
    if (phaseRef.current !== 'repair-guide') return
    play(280, 0.16, 0.18, 420)
    phaseRef.current = 'dusk'
    setGame(current => ({
      ...current,
      phase: 'dusk',
      barricadeHp: 85,
      resources: { ...current.resources, scrap: Math.max(0, current.resources.scrap - 10) },
    }))
  }, [play])

  const beginDefense = useCallback(() => {
    play(110, 0.45, 0.18, 80)
    phaseRef.current = 'defense'
    lastRef.current = performance.now()
    setGame(current => ({ ...current, phase: 'defense', defenseElapsed: 0 }))
  }, [play])

  const triggerOverdrive = useCallback(() => {
    if (phaseRef.current !== 'defense') return false
    let allowed = false
    setGame(current => {
      if (current.overdriveUsed || current.defenseElapsed < 5) return current
      allowed = true
      return { ...current, overdriveUsed: true, overdriveUntil: current.defenseElapsed + 8, resources: { ...current.resources, power: Math.max(0, current.resources.power - 8) } }
    })
    if (allowed) play(620, 0.38, 0.18, 210)
    else play(180, 0.08, 0.10)
    return allowed
  }, [play])

  useEffect(() => {
    if (game.phase !== 'defense') return
    const frame = (now: number) => {
      // Keep the defense clock close to wall time on low-FPS mobile/WebGL devices.
      // The cap still prevents a large damage jump after returning from background.
      const dt = Math.min(0.25, (now - lastRef.current) / 1000)
      lastRef.current = now
      setGame(current => {
        if (current.phase !== 'defense') return current
        const elapsed = Math.min(current.defenseDuration, current.defenseElapsed + dt)
        const inGrace = elapsed < 8
        const overloaded = current.overdriveUntil > elapsed
        const pressure = elapsed > 5 ? (inGrace ? 0.75 : 2.35) * (overloaded ? 0.38 : 1) : 0
        const barricadeHp = Math.max(0, current.barricadeHp - pressure * dt)
        const coreDamage = barricadeHp <= 0 ? 7.5 * dt : 0
        const coreHp = Math.max(0, current.coreHp - coreDamage)
        if (coreHp <= 0) {
          phaseRef.current = 'slice-fail'
          if (!muted) tone(90, 0.7, 0.22, 45)
          return { ...current, phase: 'slice-fail', defenseElapsed: elapsed, barricadeHp, coreHp }
        }
        if (elapsed >= current.defenseDuration) {
          phaseRef.current = 'slice-win'
          if (!muted) chord([392, 523, 659, 784])
          localStorage.setItem('afterlight_tutorial_complete', '1')
          return { ...current, phase: 'slice-win', defenseElapsed: elapsed, barricadeHp, coreHp, resources: { ...current.resources, morale: Math.min(100, current.resources.morale + 8) } }
        }
        return { ...current, defenseElapsed: elapsed, barricadeHp, coreHp }
      })
      if (phaseRef.current === 'defense') rafRef.current = requestAnimationFrame(frame)
    }
    lastRef.current = performance.now()
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [game.phase, muted])

  const restart = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    cancelAnimationFrame(assignmentRafRef.current)
    assignmentTimersRef.current.forEach(window.clearTimeout)
    assignmentTimersRef.current = []
    phaseRef.current = 'intro'
    setGame(INITIAL)
  }, [])

  useEffect(() => () => {
    cancelAnimationFrame(assignmentRafRef.current)
    assignmentTimersRef.current.forEach(window.clearTimeout)
  }, [])

  const replayHint = useCallback(() => {
    play(360, 0.09, 0.11)
    const current = phaseRef.current
    if (current === 'production-proof') setPhase('assign-guide')
    else setGame(value => ({ ...value }))
  }, [play, setPhase])

  const toggleMuted = useCallback(() => {
    setMuted(current => {
      const next = !current
      localStorage.setItem('afterlight_muted', next ? '1' : '0')
      if (!next) tone(440, 0.08, 0.10)
      return next
    })
  }, [])

  return { game, muted, start, skipTutorial, rescue, assignWorker, continueToRepair, repairBarricade, beginDefense, triggerOverdrive, restart, replayHint, toggleMuted }
}
