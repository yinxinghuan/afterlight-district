import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const storage = new Map()
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
globalThis.window = { matchMedia: () => ({ matches: false }) }
const source = ts.transpileModule(fs.readFileSync(new URL('./world.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText
const g = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('fresh load and saved run both enter title; mute does not overwrite pending save', () => {
  storage.clear()
  g.load()
  assert.equal(g.world.phase, 'title')
  assert.equal(g.world.hasSavedRun, false)
  g.playFromTitle()
  g.beginRescue()
  g.advanceFrame(1.2)
  g.save()
  g.load()
  assert.equal(g.world.phase, 'title')
  assert.equal(g.world.hasSavedRun, true)
  g.toggleMute()
  assert.equal(JSON.parse(storage.get(g.SAVE_KEY)).run.phase, 'assign')
  g.playFromTitle()
  assert.equal(g.world.phase, 'assign')
})

test('repair spends exactly 10 and completes; Skip handles every tutorial phase', () => {
  g.applyShot('tutorial')
  g.pressInteract()
  g.advanceFrame(1.2)
  g.pressInteract()
  g.advanceFrame(1.3)
  assert.equal(g.world.phase, 'repair')
  const scrap = g.world.scrap
  g.pressInteract()
  g.pressInteract()
  assert.equal(g.world.scrap, scrap - 10)
  g.advanceFrame(1.4)
  assert.equal(g.world.phase, 'dusk')
  for (const phase of ['rescue', 'rescuing', 'assign', 'assigning', 'repair', 'repairing']) {
    g.applyShot('tutorial')
    g.world.phase = phase
    g.skipTutorial()
    assert.equal(g.world.phase, 'dusk', phase)
    assert.equal(g.world.barricade, 85)
  }
})

test('60fps, 2fps, 0.2fps, hit-stop and long-stall countdowns retain elapsed time', () => {
  for (const frame of [1 / 60, 0.5, 5]) {
    g.applyShot('tutorial')
    g.skipTutorial()
    g.beginNight()
    g.world.muted = true
    for (let elapsed = 0; elapsed < 5 - 1e-6; elapsed += frame) g.advanceFrame(frame)
    assert.ok(Math.abs(g.world.nightTime - 5) < 1e-6, `${frame}: ${g.world.nightTime}`)
  }
  g.world.hitStop = 0.2
  g.advanceFrame(0.2)
  assert.ok(Math.abs(g.world.nightTime - 5.2) < 1e-6)
  g.advanceFrame(15)
  assert.ok(Math.abs(g.world.nightTime - 20.2) < 1e-6)
})
