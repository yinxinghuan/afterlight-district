import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'

const out = new URL('./ui/assignment-motion/', import.meta.url)
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const findings = []
const evidence = []

function isManagedShellTelemetryError(text, url = '') {
  return text.includes('aigram.aiwaves.tech/note/aigram/ai/game/track/report') || url.includes('aigram.aiwaves.tech/note/aigram/ai/game/track/report')
}

async function reachAssignment(page, label, freezeAt = null) {
  page.on('console', message => {
    if (message.type() === 'error' && !isManagedShellTelemetryError(message.text(), message.location().url)) findings.push(`${label}: console ${message.text()}`)
  })
  page.on('pageerror', error => findings.push(`${label}: pageerror ${error.message}`))
  await page.addInitScript(() => {
    localStorage.setItem('game_locale', 'en')
    const nativeSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = (handler, delay, ...args) => nativeSetTimeout(handler, typeof delay === 'number' ? delay * 1.5 : delay, ...args)
  })
  await page.goto('http://127.0.0.1:5173/?render_quality=balanced', { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
  await page.getByRole('button', { name: 'Restore the light' }).click()
  await page.waitForSelector('[data-guide-phase="rescue-guide"][data-guide-beat="1"]')
  await page.getByRole('button', { name: 'Show me the signal house' }).click()
  await page.waitForSelector('[data-guide-phase="rescue-guide"][data-guide-beat="3"]')
  await page.getByRole('button', { name: 'Start rescue' }).click()
  await page.waitForSelector('[data-guide-phase="assign-guide"][data-guide-beat="1"]', { timeout: 9000 })
  await page.getByRole('button', { name: 'Show me the workbench' }).click()
  await page.waitForSelector('[data-guide-phase="assign-guide"][data-guide-beat="3"]')
  if (typeof freezeAt === 'number') await page.evaluate(target => {
    window.__afterlightQaAssignmentFrozen = false
    const game = document.querySelector('.ad-game')
    if (!game) return
    const observer = new MutationObserver(() => {
      const phase = game.getAttribute('data-guide-phase')
      const progress = Number(game.getAttribute('data-assignment-progress') || 0)
      if (phase !== 'assigning' || progress < target || window.__afterlightQaAssignmentFrozen) return
      window.__afterlightQaAssignmentFrozen = true
      window.requestAnimationFrame = () => 0
      observer.disconnect()
    })
    observer.observe(game, { attributes: true, attributeFilter: ['data-guide-phase', 'data-assignment-progress'] })
  }, freezeAt)
  const started = Date.now()
  await page.locator('[data-dropzone="workbench"]').click()
  await page.waitForSelector('[data-guide-phase="assigning"]')
  if (await page.locator('.ad-proof').count()) findings.push(`${label}: production proof visible at assignment start`)
  if (await page.locator('.ad-status-card').count()) findings.push(`${label}: text status card obscures the walking performance`)
  return started
}

async function capture({ width, height, label, progress, reducedMotion = false, working = false }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' })
  const started = await reachAssignment(page, label, working ? null : progress)
  let measuredDuration = null
  if (working) {
    await page.waitForSelector('[data-guide-phase="production-proof"]', { timeout: 15000 })
    measuredDuration = Date.now() - started
    if (measuredDuration < 2600) findings.push(`${label}: assignment duration ${measuredDuration}ms shorter than 2600ms`)
  } else {
    await page.waitForFunction(() => window.__afterlightQaAssignmentFrozen === true, null, { timeout: 7000 })
    if (await page.locator('.ad-proof').count()) findings.push(`${label}: reward appeared before arrival at progress ${progress}`)
  }
  const currentProgress = Number(await page.locator('.ad-game').getAttribute('data-assignment-progress'))
  const path = new URL(`${label}.png`, out).pathname
  await page.screenshot({ path })
  const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  if (metrics.width !== metrics.scrollWidth) findings.push(`${label}: horizontal overflow ${JSON.stringify(metrics)}`)
  evidence.push({ label, path, requestedProgress: working ? 1 : progress, capturedProgress: currentProgress, measuredDuration, reducedMotion, working })
  await page.close()
}

await capture({ width: 390, height: 844, label: '390x844-platform-layout-assigning-turn', progress: 0.05 })
await capture({ width: 390, height: 844, label: '390x844-platform-layout-assigning-path-entry', progress: 0.30 })
await capture({ width: 390, height: 844, label: '390x844-platform-layout-assigning-midpoint', progress: 0.58 })
await capture({ width: 390, height: 844, label: '390x844-platform-layout-assigning-approach', progress: 0.86 })
await capture({ width: 390, height: 844, label: '390x844-platform-layout-assignment-working', working: true })
await capture({ width: 320, height: 568, label: '320x568-platform-layout-assigning-midpoint', progress: 0.58 })
await capture({ width: 320, height: 568, label: '320x568-platform-layout-assignment-working', working: true })
await capture({ width: 390, height: 844, label: '390x844-platform-layout-assigning-midpoint-reduced', progress: 0.58, reducedMotion: true })

const hashes = await Promise.all(evidence.map(async item => crypto.createHash('sha256').update(await fs.readFile(item.path)).digest('hex')))
if (new Set(hashes.slice(0, 4)).size !== 4) findings.push('390x844 motion frames are not visually distinct')

await fs.writeFile(new URL('report.json', out), JSON.stringify({ ok: findings.length === 0, findings, evidence }, null, 2))
await browser.close()
console.log(JSON.stringify({ ok: findings.length === 0, findings, evidence }, null, 2))
if (findings.length) process.exitCode = 1
