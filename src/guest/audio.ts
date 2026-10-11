import darkUrl from './audio/dark-city.ogg'
import dayUrl from './audio/empty-city.ogg'

export type SfxName =
  | 'start'
  | 'ui'
  | 'rescue'
  | 'assign'
  | 'scrap'
  | 'repair'
  | 'step'
  | 'shot'
  | 'hit'
  | 'kill'
  | 'overload'
  | 'core'
  | 'win'
  | 'fail'
  | 'error'
  | 'upgrade'

let ctx: AudioContext | null = null
let unlocked = false
let dayAudio: HTMLAudioElement | null = null
let nightAudio: HTMLAudioElement | null = null
let dayVol = 0
let nightVol = 0
let shotAt = 0

function context() {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function bed(url: string) {
  const audio = new Audio(url)
  audio.loop = true
  audio.preload = 'auto'
  audio.volume = 0
  return audio
}

export function unlockAudio() {
  unlocked = true
  if (!dayAudio) dayAudio = bed(dayUrl)
  if (!nightAudio) nightAudio = bed(darkUrl)
  const audio = context()
  void audio.resume()
  void dayAudio.play().catch(() => undefined)
  void nightAudio.play().catch(() => undefined)
}

function tone(freq: number, duration: number, volume: number, type: OscillatorType = 'triangle', slide?: number) {
  try {
    const audio = context()
    const now = audio.currentTime
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), now + duration)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(gain).connect(audio.destination)
    osc.start(now)
    osc.stop(now + duration + 0.02)
  } catch { /* optional */ }
}

function noise(duration: number, volume: number, freq: number) {
  try {
    const audio = context()
    const frames = Math.max(1, Math.floor(audio.sampleRate * duration))
    const buffer = audio.createBuffer(1, frames, audio.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
    const source = audio.createBufferSource()
    source.buffer = buffer
    const filter = audio.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = freq
    filter.Q.value = 0.7
    const gain = audio.createGain()
    gain.gain.value = volume
    source.connect(filter).connect(gain).connect(audio.destination)
    source.start()
  } catch { /* optional */ }
}

export function playSfx(name: SfxName) {
  if (!unlocked) return
  if (name === 'shot') {
    const now = performance.now()
    if (now - shotAt < 70) return
    shotAt = now
    noise(0.05, 0.12, 1400)
    tone(620, 0.045, 0.06, 'square', 280)
    return
  }
  if (name === 'hit') {
    tone(210, 0.06, 0.08, 'sawtooth', 90)
    return
  }
  if (name === 'kill') {
    tone(520, 0.08, 0.1, 'triangle', 780)
    noise(0.09, 0.08, 900)
    return
  }
  if (name === 'step') {
    noise(0.04, 0.05, 180)
    return
  }
  if (name === 'ui' || name === 'start') {
    tone(name === 'start' ? 196 : 660, name === 'start' ? 0.18 : 0.05, 0.08, 'triangle', name === 'start' ? 392 : undefined)
    return
  }
  if (name === 'rescue') {
    ;[392, 523, 659].forEach((freq, index) => window.setTimeout(() => tone(freq, 0.16, 0.1), index * 90))
    return
  }
  if (name === 'assign') {
    tone(440, 0.12, 0.09, 'triangle', 660)
    return
  }
  if (name === 'scrap') {
    tone(740, 0.07, 0.07, 'square')
    return
  }
  if (name === 'repair') {
    noise(0.12, 0.16, 240)
    tone(180, 0.1, 0.08, 'triangle', 90)
    return
  }
  if (name === 'overload') {
    noise(0.28, 0.14, 500)
    tone(140, 0.32, 0.1, 'sawtooth', 420)
    return
  }
  if (name === 'core') {
    tone(90, 0.22, 0.16, 'sine', 42)
    noise(0.18, 0.12, 120)
    return
  }
  if (name === 'win') {
    ;[523, 659, 784, 1046].forEach((freq, index) => window.setTimeout(() => tone(freq, 0.28, 0.08), index * 80))
    return
  }
  if (name === 'fail') {
    tone(392, 0.22, 0.1, 'triangle', 196)
    window.setTimeout(() => tone(196, 0.4, 0.1, 'sine', 90), 180)
    return
  }
  if (name === 'upgrade') {
    tone(523, 0.1, 0.08, 'triangle', 784)
    return
  }
  if (name === 'error') tone(140, 0.12, 0.08, 'square')
}

const NIGHT = new Set(['night'])

export function syncPhase(phase: string, muted: boolean) {
  if (!unlocked || !dayAudio || !nightAudio) return
  const nightOn = NIGHT.has(phase)
  const dayTarget = muted ? 0 : nightOn ? 0 : phase === 'title' ? 0.34 : 0.3
  const nightTarget = muted ? 0 : nightOn ? 0.36 : 0
  dayVol += (dayTarget - dayVol) * 0.04
  nightVol += (nightTarget - nightVol) * 0.05
  dayAudio.volume = Math.max(0, Math.min(1, dayVol))
  nightAudio.volume = Math.max(0, Math.min(1, nightVol))
}
