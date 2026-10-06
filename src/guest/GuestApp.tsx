import { useProgress } from '@react-three/drei'
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { playSfx, syncPhase, unlockAudio } from './audio'
import GuestScene from './scene'
import {
  applyShot,
  backToTitle,
  beginNight,
  buyPermanent,
  cacheCost,
  chooseUpgrade,
  load,
  onSfx,
  openUpgrade,
  overdriveActive,
  overdriveCooldown,
  playFromTitle,
  pressInteract,
  repairCooldown,
  retryNight,
  SAVE_KEY,
  skipTutorial,
  subscribe,
  toggleMute,
  triggerOverdrive,
  triggerRepair,
  world,
} from './world'

function useWorld() {
  return useSyncExternalStore(subscribe, () => world.rev)
}

function FloatLayer() {
  return (
    <div id="cg-floats" className="cg-floats" aria-hidden="true">
      {Array.from({ length: 16 }, (_, index) => <div key={index} className="cg-float" hidden />)}
    </div>
  )
}

function Hurt() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let frame = 0
    const tick = () => {
      if (ref.current) ref.current.style.opacity = String(world.hurt)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])
  return <div ref={ref} className="cg-hurt" />
}

function MuteButton() {
  useWorld()
  return (
    <button className="cg-icon" aria-label={world.muted ? 'Unmute' : 'Mute'} onClick={() => { unlockAudio(); toggleMute() }}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h3l5-4v12l-5-4H4z" /><path d={world.muted ? 'M16 9l5 6M21 9l-5 6' : 'M16 9c1.4 1 1.4 5 0 6M18.5 7c2.2 1.8 2.2 8.2 0 10'} /></svg>
    </button>
  )
}

function Hud() {
  useWorld()
  const playing = world.phase !== 'title'
  const overCd = overdriveCooldown()
  const repairCd = repairCooldown()
  const overdriveOn = overdriveActive()
  const canOver = world.phase === 'night' && overCd === 0 && !overdriveOn && world.power >= 6
  const canRepair = world.phase === 'night' && repairCd === 0 && world.scrap >= 4 && world.barricade < world.barricadeMax
  const guide = world.tutorial && ['rescue', 'rescuing', 'assign', 'assigning', 'repair', 'repairing'].includes(world.phase)
  const objective = world.phase === 'rescue' || world.phase === 'rescuing'
    ? ['01', 'Rescue Lin from the signal house']
    : world.phase === 'assign' || world.phase === 'assigning'
      ? ['02', 'Send Lin to the lit workbench']
      : world.phase === 'repair' || world.phase === 'repairing'
        ? ['03', 'Spend 10 scrap on the south barricade']
        : world.phase === 'night' && world.day === 1
          ? ['04', 'Click husks. Press 1 when they enter the light.']
          : null
  return (
    <>
      <div className="cg-top">
        {playing && <div className="cg-phase"><i />{world.phase === 'night' ? `Night ${world.day}` : world.phase === 'dusk' ? `Dusk ${world.day}` : world.phase === 'dawn' || world.phase === 'upgrade' ? `Dawn ${world.day}` : `Day ${world.day}`}
          {world.phase === 'night' && <b>{Math.max(0, Math.ceil(world.nightDuration - world.nightTime))}s</b>}
        </div>}
        <div className="cg-top__end">
          {guide && <button className="cg-skip" onClick={skipTutorial}>Skip tutorial</button>}
          <MuteButton />
        </div>
      </div>
      {playing && <div className="cg-resources" aria-label="Resources">
        <span><i className="cg-swatch cg-swatch--power" />{Math.round(world.power)}<small>Power</small></span>
        <span><i className="cg-swatch cg-swatch--scrap" />{Math.round(world.scrap)}<small>Scrap</small></span>
        <span><i className="cg-swatch cg-swatch--morale" />{Math.round(world.morale)}<small>Morale</small></span>
      </div>}
      {objective && <aside className="cg-objective"><em>{objective[0]}</em><b>{objective[1]}</b></aside>}
      {world.phase === 'night' && <div className="cg-bars">
        <label>Barricade<i><b style={{ width: `${world.barricade / world.barricadeMax * 100}%` }} /></i><em>{Math.ceil(world.barricade)}</em></label>
        <label>Core<i><b style={{ width: `${world.core}%` }} /></i><em>{Math.ceil(world.core)}</em></label>
      </div>}
      {world.phase === 'night' && <div className="cg-skills">
        <button className={canOver ? 'is-ready' : ''} disabled={!canOver} onClick={triggerOverdrive}>
          <b>1  Overload</b>
          <small>{overdriveOn ? 'Lights are hot' : overCd > 0 ? `Cooldown ${overCd}s` : world.power < 6 ? 'Need 6 power' : '6 power · 6s slow'}</small>
        </button>
        <button className={canRepair ? 'is-ready' : ''} disabled={!canRepair} onClick={triggerRepair}>
          <b>2  Field repair</b>
          <small>{world.barricade >= world.barricadeMax ? 'Barricade full' : repairCd > 0 ? `Cooldown ${repairCd}s` : world.scrap < 4 ? 'Need 4 scrap' : '4 scrap · +16'}</small>
        </button>
      </div>}
      {world.phase === 'night' && <p className="cg-hint">Click or hold to fire · 1 overload · 2 repair · M mute</p>}
    </>
  )
}

function Title() {
  useWorld()
  if (world.phase !== 'title') return null
  const showCache = world.bestNight > 0
  return (
    <section className="cg-title">
      <div className="cg-title__copy">
        <p className="cg-kicker">Endless nights · one generator</p>
        <h1>Afterlight<br />District</h1>
        <p className="cg-lede">Keep the last block lit. Rescue a neighbor, arm the street, and hold the dark.</p>
        <button className="cg-primary" onClick={() => { unlockAudio(); playFromTitle() }}>Restore the light</button>
        {!world.tutorialDone && <button className="cg-ghost" onClick={() => { unlockAudio(); skipTutorial() }}>Skip tutorial</button>}
        {world.bestNight > 0 && <p className="cg-meta">Best night {world.bestNight} · Cache {world.banked} scrap</p>}
        <p className="cg-keys">Mouse fires the relays · 1 overload · 2 repair · E interact</p>
      </div>
      {showCache && <div className="cg-cache">
        <b>Supply cache</b>
        {(['barricade', 'battery', 'capacitor'] as const).map(kind => {
          const rank = world.permanent[kind]
          const cost = cacheCost(kind)
          const label = kind === 'barricade' ? 'Stouter barricade' : kind === 'battery' ? 'Reserve cells' : 'Faster relays'
          return <button key={kind} disabled={rank >= 3 || world.banked < cost} onClick={() => buyPermanent(kind)}>
            <span>{label}</span><small>{rank >= 3 ? 'Maxed' : `${cost} cache · rank ${rank}/3`}</small>
          </button>
        })}
      </div>}
    </section>
  )
}

function Dusk() {
  useWorld()
  if (world.phase !== 'dusk') return null
  const first = world.day === 1
  return (
    <section className="cg-card cg-card--dusk">
      <img src="./portraits/jo-bust.png" alt="" />
      <div>
        <span>Warden Jo</span>
        <h2>{first ? 'Night 1 is a short one' : `Night ${world.day}`}</h2>
        <p>{first
          ? 'Husks take the two roads. Click them to fire the lamps. Press 1 when a pack stands in the light.'
          : world.day === 2
            ? 'Cable stalkers run the curb. Drop the low fast ones before the husks pile up.'
            : 'The horde is thicker. Spend scrap on the barricade before the core starts taking hits.'}</p>
        <button className="cg-primary" onClick={beginNight}>Stand watch</button>
      </div>
    </section>
  )
}

function Dawn() {
  useWorld()
  if (world.phase !== 'dawn') return null
  return (
    <section className="cg-card cg-card--dawn">
      <p className="cg-kicker">Dawn {String(world.day).padStart(2, '0')}</p>
      <h2>Night {world.day} held</h2>
      <p>The block is still lit. Scrap from the kills is yours, and the next night will not be this gentle.</p>
      <div className="cg-stats">
        <span><b>{Math.ceil(world.core)}</b><small>Core</small></span>
        <span><b>{Math.ceil(world.barricade)}</b><small>Barricade</small></span>
        <span><b>{Math.round(world.morale)}</b><small>Morale</small></span>
        <span><b>{world.kills}</b><small>Kills</small></span>
      </div>
      <p className="cg-meta">Best night {world.bestNight} · cache {world.banked}</p>
      <button className="cg-primary" onClick={openUpgrade}>Choose an upgrade</button>
    </section>
  )
}

function Upgrade() {
  useWorld()
  if (world.phase !== 'upgrade') return null
  const locked = world.cleared < 2
  const poor = world.scrap < 8
  return (
    <section className="cg-upgrade">
      <header>
        <p className="cg-kicker">One choice before dusk</p>
        <h2>Spend the scrap</h2>
        <p>You have {Math.round(world.scrap)} scrap. The locked relay opens after night 2.</p>
      </header>
      <div className="cg-upgrade__grid">
        <button disabled={poor} onClick={() => chooseUpgrade('barricade')}>
          <b>Reinforce barricade</b>
          <small>8 scrap · cap +20 and heal 30</small>
        </button>
        <button disabled={poor} onClick={() => chooseUpgrade('battery')}>
          <b>Expand battery</b>
          <small>8 scrap · +22 power, faster regen</small>
        </button>
        <button disabled={locked || poor} onClick={() => chooseUpgrade('capacitor')}>
          <b>Sentry capacitor</b>
          <small>{locked ? 'Clears after night 2' : '8 scrap · harder, faster shots'}</small>
        </button>
      </div>
    </section>
  )
}

function Fail() {
  useWorld()
  if (world.phase !== 'fail') return null
  return (
    <section className="cg-card cg-card--fail">
      <p className="cg-kicker">Signal lost</p>
      <h2>The generator went dark</h2>
      <p>{world.failReason}</p>
      <div className="cg-stats">
        <span><b>{world.day}</b><small>Night</small></span>
        <span><b>{world.kills}</b><small>Kills</small></span>
        <span><b>{world.bestNight}</b><small>Best</small></span>
      </div>
      <div className="cg-row">
        <button className="cg-primary" onClick={retryNight}>Retry this night</button>
        <button className="cg-ghost" onClick={backToTitle}>Title</button>
      </div>
    </section>
  )
}

function Loading() {
  const { active, progress } = useProgress()
  if (!active || progress >= 100) return null
  return <div className="cg-loading"><span>Bringing the block online</span><i><b style={{ width: `${progress}%` }} /></i></div>
}

export default function GuestApp() {
  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shot = params.get('shot')
    if (shot) applyShot(shot)
    else if (params.get('fresh') === '1') {
      localStorage.removeItem(SAVE_KEY)
      load()
    } else load()
    document.documentElement.dataset.cgReady = world.phase
  }, [])

  useEffect(() => onSfx(playSfx), [])

  useEffect(() => {
    let frame = 0
    const loop = () => {
      syncPhase(world.phase, world.muted)
      document.body.dataset.phase = world.phase
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat && event.code !== 'Space') return
      if (event.code === 'KeyM') { unlockAudio(); toggleMute(); return }
      if (event.code === 'Digit1') { triggerOverdrive(); return }
      if (event.code === 'Digit2') { triggerRepair(); return }
      if (event.code === 'Escape') { skipTutorial(); return }
      if (event.code === 'KeyE' || event.code === 'Enter') { unlockAudio(); pressInteract(); return }
      if (event.code === 'Space') {
        unlockAudio()
        if (world.phase === 'night') world.firing = true
        else pressInteract()
      }
    }
    const onUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') world.firing = false
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onUp)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  return (
    <main className="cg-root">
      <div className="cg-stage"><GuestScene /></div>
      <FloatLayer />
      <Hurt />
      <Hud />
      <Title />
      <Dusk />
      <Dawn />
      <Upgrade />
      <Fail />
      <Loading />
    </main>
  )
}
