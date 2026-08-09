let ctx: AudioContext | null = null

function getContext() {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function tone(freq: number, duration = 0.1, volume = 0.18, nextFreq?: number) {
  try {
    const audio = getContext()
    const now = audio.currentTime
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, now)
    if (nextFreq) osc.frequency.exponentialRampToValueAtTime(nextFreq, now + duration)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(gain).connect(audio.destination)
    osc.start(now); osc.stop(now + duration + 0.02)
  } catch { /* audio is optional */ }
}

export function chord(notes: number[]) {
  notes.forEach((note, index) => window.setTimeout(() => tone(note, 0.28, 0.12), index * 100))
}
