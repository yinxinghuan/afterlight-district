import { useProgress } from '@react-three/drei'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useAfterlight } from './game/useAfterlight'
import { t } from './i18n'
import { AfterlightScene } from './scene/AfterlightScene'
import { BoltIcon, ClockIcon, HelpIcon, LightIcon, MoraleIcon, ScrapIcon, SoundIcon } from './ui/Icons'
import alteruSrc from './img/alteru.svg'

function Resource({ icon, kind, label, value, danger = false }: { icon: React.ReactNode; kind: 'power' | 'scrap' | 'morale'; label: string; value: number; danger?: boolean }) {
  return <div className={`ad-resource ad-resource--${kind}${danger ? ' ad-resource--danger' : ''}`} title={label}>{icon}<span>{Math.round(value)}</span><small>{label}</small></div>
}

function Dialogue({ portrait, name, line, placement = 'bottom', children }: { portrait: 'guard' | 'worker'; name: string; line: string; placement?: 'top' | 'bottom'; children?: React.ReactNode }) {
  const src = portrait === 'guard' ? './portraits/jo-bust.png' : './portraits/lin-bust.png'
  return <section className={`ad-dialogue ad-dialogue--${placement} ad-dialogue--${portrait}`} aria-live="polite">
    <div className="ad-dialogue__portrait"><img src={src} alt={name} draggable={false} /></div>
    <div className="ad-dialogue__copy"><span>{name}</span><p>{line}</p>{children}</div>
  </section>
}

function Objective({ step, text }: { step: string; text: string }) {
  return <aside className="ad-objective" aria-live="polite">
    <span>{t('objectiveLabel')} · {step}</span>
    <b>{text}</b>
  </aside>
}

export default function App() {
  const { game, muted, start, skipTutorial, rescue, assignWorker, continueToRepair, repairBarricade, beginDefense, triggerOverdrive, restart, replayHint, toggleMuted } = useAfterlight()
  const { active, progress } = useProgress()
  const [drag, setDrag] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const [dropError, setDropError] = useState(false)
  const [guideSequence, setGuideSequence] = useState<{ phase: string; beat: number }>({ phase: 'intro', beat: 0 })
  const [guideReplay, setGuideReplay] = useState(0)
  const revealTimers = useRef<number[]>([])
  const cardRef = useRef<HTMLButtonElement>(null)
  const phaseProgress = game.phase === 'rescuing' ? game.rescueProgress : game.phase === 'defense' ? game.defenseElapsed / game.defenseDuration : 0
  const night = ['dusk', 'defense', 'slice-win', 'slice-fail'].includes(game.phase)
  const guideBeat = guideSequence.phase === game.phase ? guideSequence.beat : 0
  const showPower = game.phase !== 'intro'
  const showScrap = ['repair-guide', 'dusk', 'defense'].includes(game.phase) || (game.phase === 'production-proof' && guideBeat >= 1)
  const showMorale = game.phase === 'defense'
  const resourceCount = Number(showPower) + Number(showScrap) + Number(showMorale)

  useEffect(() => {
    revealTimers.current.forEach(window.clearTimeout)
    revealTimers.current = []
    setGuideSequence({ phase: game.phase, beat: 0 })
    const phase = game.phase
    const reveal = (beat: number, delay: number) => revealTimers.current.push(window.setTimeout(() => setGuideSequence({ phase, beat }), delay))
    if (['rescue-guide', 'assign-guide', 'repair-guide', 'dusk'].includes(phase)) reveal(1, 650)
    if (phase === 'production-proof') reveal(1, 850)
    if (phase === 'slice-win' || phase === 'slice-fail') {
      reveal(1, 650)
      reveal(2, 1250)
    }
    return () => {
      revealTimers.current.forEach(window.clearTimeout)
      revealTimers.current = []
    }
  }, [game.phase, guideReplay])

  const advanceGuide = () => {
    revealTimers.current.forEach(window.clearTimeout)
    const phase = game.phase
    setGuideSequence({ phase, beat: 2 })
    revealTimers.current = [window.setTimeout(() => setGuideSequence({ phase, beat: 3 }), 900)]
  }

  const replayCurrentGuide = () => {
    replayHint()
    setGuideReplay(current => current + 1)
  }

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (game.phase !== 'assign-guide') return
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDropError(false)
    setDrag({ x: event.clientX, y: event.clientY, ox: event.clientX - rect.left, oy: event.clientY - rect.top })
  }
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag) return
    setDrag(current => current ? { ...current, x: event.clientX, y: event.clientY } : null)
  }
  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag) return
    const zone = document.querySelector<HTMLElement>('[data-dropzone="workbench"]')
    const rect = zone?.getBoundingClientRect()
    const success = !!rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
    setDrag(null)
    if (success) assignWorker()
    else {
      setDropError(true)
      window.setTimeout(() => setDropError(false), 1800)
    }
  }

  return (
    <main className={`ad-shell${night ? ' ad-shell--night' : ''}`}>
      <div className="ad-game" data-guide-phase={game.phase} data-guide-beat={guideBeat} data-assignment-progress={game.assignmentProgress.toFixed(3)}>
        <div className="ad-scene" aria-label={t('sceneLabel')}><AfterlightScene game={game} guideBeat={guideBeat} /></div>
        <div className="ad-vignette" />

        {game.phase !== 'intro' && <header className="ad-hud">
          <div className="ad-hud__top">
            <div className="ad-phase"><span className="ad-phase__dot" /><b>{game.phase === 'defense' ? t('defense') : game.phase === 'dusk' ? t('dusk') : t('day')}</b>{game.phase === 'defense' && <><ClockIcon /><span>{Math.ceil(game.defenseDuration - game.defenseElapsed)}s</span></>}</div>
            <div className="ad-hud__actions">
              <button aria-label={t('help')} title={t('help')} onClick={replayCurrentGuide}><HelpIcon /></button>
              <button aria-label={muted ? t('soundOff') : t('soundOn')} title={muted ? t('soundOff') : t('soundOn')} onClick={toggleMuted}><SoundIcon muted={muted} /></button>
            </div>
          </div>
          {(game.phase !== 'rescue-guide' || guideBeat >= 2) && <div className="ad-resources" data-count={resourceCount} aria-label={t('resourcesLabel')}>
            {showPower && <Resource icon={<BoltIcon />} kind="power" label={t('power')} value={game.resources.power} />}
            {showScrap && <Resource icon={<ScrapIcon />} kind="scrap" label={t('scrap')} value={game.resources.scrap} />}
            {showMorale && <Resource icon={<MoraleIcon />} kind="morale" label={t('morale')} value={game.resources.morale} danger={game.resources.morale < 30} />}
          </div>}
          {game.phase === 'defense' && <div className="ad-progress" aria-label={`${Math.round(phaseProgress * 100)}%`}><i style={{ transform: `scaleX(${phaseProgress})` }} /></div>}
        </header>}

        {game.phase === 'rescue-guide' && guideBeat >= 2 && <Objective step="01" text={t('objectiveRescue')} />}
        {game.phase === 'assign-guide' && guideBeat >= 2 && <Objective step="02" text={t('objectiveAssign')} />}
        {game.phase === 'repair-guide' && guideBeat >= 2 && <Objective step="03" text={t('objectiveRepair')} />}

        {game.phase === 'intro' && <section className="ad-intro">
          <div className="ad-intro__signal"><i /><i /><i /></div>
          <p>{t('subtitle')}</p><h1>{t('title')}</h1>
          <div className="ad-intro__rule"><span /><b>{t('introRule')}</b><span /></div>
          <button className="ad-primary" onPointerDown={start}><BoltIcon />{t('start')}</button>
          <button className="ad-text-button" onClick={skipTutorial}>{t('skip')}</button>
        </section>}

        {game.phase === 'rescue-guide' && <>
          {guideBeat === 1 && <Dialogue portrait="guard" name={t('mentorName')} line={t('mentorRescueLine')}>
            <button className="ad-dialogue__action" onPointerDown={advanceGuide}>{t('inspectHouse')}</button>
          </Dialogue>}
          {guideBeat >= 3 && <button className="ad-world-action ad-world-action--house ad-reveal-action" onPointerDown={rescue}><span className="ad-target-ring" /><b>{t('rescue')}</b></button>}
        </>}

        {game.phase === 'rescuing' && <div className="ad-status-card"><span>{t('rescuing')}</span><b>{Math.round(game.rescueProgress * 100)}%</b></div>}

        {game.phase === 'assign-guide' && <>
          {guideBeat === 1 && <Dialogue portrait="worker" name={t('workerName')} line={t('workerAssignLine')} placement="top">
            <button className="ad-dialogue__action" onPointerDown={advanceGuide}>{t('inspectWorkbench')}</button>
          </Dialogue>}
          {guideBeat >= 2 && <button data-dropzone="workbench" className="ad-dropzone" onClick={assignWorker}><span>{t('efficiency')}</span><i /></button>}
          {guideBeat >= 3 && <div className={`ad-roster ad-reveal-action${dropError ? ' ad-roster--error' : ''}`}>
            <button
              ref={cardRef}
              className={`ad-resident${drag ? ' ad-resident--dragging' : ''}`}
              onPointerDown={beginDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              style={drag ? { position: 'fixed', left: drag.x - drag.ox, top: drag.y - drag.oy } : undefined}
            >
              <span className="ad-resident__avatar"><img src="./portraits/lin-bust.png" alt="" draggable={false} /></span>
              <span><b>{t('worker')}</b><small>{t('workerSkill')}</small></span>
              <ScrapIcon />
            </button>
            <p>{dropError ? t('wrongDrop') : t('dragHint')}</p>
          </div>}
        </>}

        {game.phase === 'production-proof' && <section className="ad-proof">
          {guideBeat === 0 && <span className="ad-proof__tag"><i />+3 {t('scrap')}</span>}
          {guideBeat >= 1 && <Dialogue portrait="worker" name={t('workerName')} line={t('workerProofLine')}>
            <button className="ad-dialogue__action" onPointerDown={continueToRepair}>{t('continueRepair')}</button>
          </Dialogue>}
        </section>}

        {game.phase === 'repair-guide' && <>
          {guideBeat === 1 && <Dialogue portrait="guard" name={t('mentorName')} line={t('mentorRepairLine')}>
            <button className="ad-dialogue__action" onPointerDown={advanceGuide}>{t('inspectBarricade')}</button>
          </Dialogue>}
          {guideBeat >= 3 && <button className="ad-world-action ad-world-action--barrier ad-reveal-action" onPointerDown={repairBarricade}><span className="ad-target-ring ad-target-ring--danger" /><b>{t('repair')} · 10</b><ScrapIcon /></button>}
        </>}

        {game.phase === 'dusk' && guideBeat >= 1 && <Dialogue portrait="guard" name={t('mentorName')} line={t('mentorDuskLine')}>
          <button className="ad-dialogue__action" onPointerDown={beginDefense}><LightIcon />{t('ready')}</button>
        </Dialogue>}

        {game.phase === 'defense' && <>
          <div className="ad-defense-bars">
            <label><span>{t('barricade')}</span><i><b style={{ width: `${game.barricadeHp}%` }} /></i><em>{Math.ceil(game.barricadeHp)}</em></label>
            <label><span>{t('core')}</span><i><b style={{ width: `${game.coreHp}%` }} /></i><em>{Math.ceil(game.coreHp)}</em></label>
          </div>
          {game.defenseElapsed >= 5 && <button className={`ad-skill${!game.overdriveUsed ? ' ad-skill--ready' : ''}`} onPointerDown={triggerOverdrive} disabled={game.overdriveUsed}>
            <LightIcon /><span><b>{t('overdrive')}</b><small>{game.overdriveUsed ? t('overdriveUsed') : game.defenseElapsed < 5 ? t('overdriveReady') : t('overdriveCost')}</small></span>
          </button>}
          {game.defenseElapsed >= 4.5 && game.defenseElapsed < 11 && <div className={`ad-comms ad-comms--${game.overdriveUsed ? 'worker' : 'guard'}`}>
            <img src={game.overdriveUsed ? './portraits/lin-bust.png' : './portraits/jo-bust.png'} alt="" draggable={false} />
            <p><b>{game.overdriveUsed ? t('workerName') : t('mentorName')}</b>{game.overdriveUsed ? t('workerOverdriveLine') : t('mentorOverdriveLine')}</p>
          </div>}
        </>}

        {(game.phase === 'slice-win' || game.phase === 'slice-fail') && <section className={`ad-result ad-result--${game.phase === 'slice-win' ? 'win' : 'fail'}`}>
          <div className="ad-result__mark">{game.phase === 'slice-win' ? <><i /><i /><i /></> : <><i /><i /></>}</div>
          <span>{game.phase === 'slice-win' ? t('dawnOne') : t('signalLost')}</span>
          <h2>{game.phase === 'slice-win' ? t('winTitle') : t('failTitle')}</h2>
          <p>{game.phase === 'slice-win' ? t('winBody') : t('failBody')}</p>
          {guideBeat >= 1 && <div className="ad-result__stats ad-reveal-step"><b>{Math.ceil(game.coreHp)}</b><small>{t('core')}</small><b>{Math.ceil(game.barricadeHp)}</b><small>{t('barricade')}</small><b>{Math.round(game.resources.morale)}</b><small>{t('morale')}</small></div>}
          {guideBeat >= 2 && <button className="ad-primary ad-reveal-step" onPointerDown={restart}>{game.phase === 'slice-win' ? t('replay') : t('retry')}</button>}
        </section>}

        {active && progress < 100 && <div className="ad-loading"><span>{t('loading')}</span><i><b style={{ width: `${progress}%` }} /></i></div>}
        <img className="ad-watermark" src={alteruSrc} alt="" aria-hidden="true" draggable={false} />
      </div>
    </main>
  )
}
