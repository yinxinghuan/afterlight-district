import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs/promises'

const root = new URL('./ui/', import.meta.url)
await fs.mkdir(root, { recursive: true })
const browser = await chromium.launch({ headless: true })
const findings = []
const forcedLocale = process.env.QA_LOCALE
const forcedQuality = process.env.QA_RENDER_QUALITY
const guideTimeScale = Math.max(1, Number(process.env.QA_GUIDE_TIME_SCALE || 1))
const gameUrl = forcedQuality ? `http://127.0.0.1:5173/?render_quality=${forcedQuality}` : 'http://127.0.0.1:5173/'

function isManagedShellTelemetryError(text, url = '') {
  return text.includes('aigram.aiwaves.tech/note/aigram/ai/game/track/report') || url.includes('aigram.aiwaves.tech/note/aigram/ai/game/track/report')
}

async function primaryFlow(width, height, label, full = true) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  if (forcedLocale === 'zh' || forcedLocale === 'en') await page.addInitScript(locale => localStorage.setItem('game_locale', locale), forcedLocale)
  if (guideTimeScale > 1) await page.addInitScript(scale => {
    const nativeSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = (handler, delay, ...args) => nativeSetTimeout(handler, typeof delay === 'number' ? delay * scale : delay, ...args)
  }, guideTimeScale)
  page.on('console', msg => {
    if (msg.type() === 'error' && !isManagedShellTelemetryError(msg.text(), msg.location().url)) findings.push(`${label}: console ${msg.text()}`)
  })
  page.on('pageerror', error => findings.push(`${label}: pageerror ${error.message}`))
  await page.goto(gameUrl, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
  await page.waitForSelector('.ad-intro')
  await page.screenshot({ path: new URL(`${label}-platform-layout-intro.png`, root).pathname })
  await page.getByRole('button', { name: /接通余光|Restore the light/ }).click()
  await page.waitForSelector('[data-guide-phase="rescue-guide"][data-guide-beat="0"]')
  await page.screenshot({ path: new URL(`${label}-platform-layout-rescue-scene.png`, root).pathname })
  await page.waitForSelector('[data-guide-phase="rescue-guide"][data-guide-beat="1"]')
  await page.screenshot({ path: new URL(`${label}-platform-layout-rescue-context.png`, root).pathname })
  await page.getByRole('button', { name: /查看信号屋|Show me the signal house/ }).click()
  await page.waitForSelector('[data-guide-phase="rescue-guide"][data-guide-beat="2"]')
  await page.screenshot({ path: new URL(`${label}-platform-layout-rescue-objective.png`, root).pathname })
  await page.waitForSelector('[data-guide-phase="rescue-guide"][data-guide-beat="3"]')
  await page.screenshot({ path: new URL(`${label}-platform-layout-rescue-guide.png`, root).pathname })
  await page.getByRole('button', { name: /开始搜救|Start rescue/ }).click()
  await page.waitForTimeout(700)
  await page.screenshot({ path: new URL(`${label}-platform-layout-rescuing.png`, root).pathname })
  await page.waitForTimeout(1400)
  await page.screenshot({ path: new URL(`${label}-platform-layout-rescuing-emergence.png`, root).pathname })
  await page.waitForSelector('[data-guide-phase="assign-guide"][data-guide-beat="0"]', { timeout: 7000 })
  await page.screenshot({ path: new URL(`${label}-platform-layout-assign-scene.png`, root).pathname })
  await page.waitForSelector('[data-guide-phase="assign-guide"][data-guide-beat="1"]')
  await page.screenshot({ path: new URL(`${label}-platform-layout-assign-context.png`, root).pathname })
  await page.getByRole('button', { name: /查看工作台|Show me the workbench/ }).click()
  await page.waitForSelector('[data-guide-phase="assign-guide"][data-guide-beat="2"]')
  await page.screenshot({ path: new URL(`${label}-platform-layout-assign-objective.png`, root).pathname })
  await page.waitForSelector('[data-guide-phase="assign-guide"][data-guide-beat="3"]')
  await page.waitForSelector('.ad-resident')
  await page.screenshot({ path: new URL(`${label}-platform-layout-assign-guide.png`, root).pathname })
  const card = await page.locator('.ad-resident').boundingBox()
  const zone = await page.locator('.ad-dropzone').boundingBox()
  if (!card || !zone) throw new Error(`${label}: drag geometry missing`)
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2)
  await page.mouse.down()
  await page.mouse.move(zone.x + zone.width / 2, zone.y + zone.height / 2, { steps: 12 })
  const assignmentStarted = Date.now()
  await page.mouse.up()
  await page.waitForSelector('[data-guide-phase="assigning"]')
  if (await page.locator('.ad-proof').count()) findings.push(`${label}: production proof appeared before the worker started walking`)
  await page.screenshot({ path: new URL(`${label}-platform-layout-assigning.png`, root).pathname })
  await page.waitForSelector('.ad-proof')
  const assignmentDuration = Date.now() - assignmentStarted
  if (assignmentDuration < 2600) findings.push(`${label}: assignment performance duration ${assignmentDuration}ms shorter than 2600ms`)
  await page.screenshot({ path: new URL(`${label}-platform-layout-production-reward.png`, root).pathname })
  await page.waitForSelector('[data-guide-phase="production-proof"][data-guide-beat="1"]')
  await page.screenshot({ path: new URL(`${label}-platform-layout-production-proof.png`, root).pathname })
  if (full) {
    await page.getByRole('button', { name: /修复第一道防线|Repair the first defense/ }).click()
    await page.waitForSelector('[data-guide-phase="repair-guide"][data-guide-beat="0"]')
    await page.screenshot({ path: new URL(`${label}-platform-layout-repair-scene.png`, root).pathname })
    await page.waitForSelector('[data-guide-phase="repair-guide"][data-guide-beat="1"]')
    await page.screenshot({ path: new URL(`${label}-platform-layout-repair-context.png`, root).pathname })
    await page.getByRole('button', { name: /查看南路路障|Show me the south barricade/ }).click()
    await page.waitForSelector('[data-guide-phase="repair-guide"][data-guide-beat="2"]')
    await page.screenshot({ path: new URL(`${label}-platform-layout-repair-objective.png`, root).pathname })
    await page.waitForSelector('[data-guide-phase="repair-guide"][data-guide-beat="3"]')
    await page.screenshot({ path: new URL(`${label}-platform-layout-repair-guide.png`, root).pathname })
    await page.getByRole('button', { name: /修复路障|Repair barricade/ }).click()
    await page.waitForSelector('[data-guide-phase="dusk"][data-guide-beat="0"]')
    await page.screenshot({ path: new URL(`${label}-platform-layout-dusk-scene.png`, root).pathname })
    await page.waitForSelector('[data-guide-phase="dusk"][data-guide-beat="1"]')
    await page.screenshot({ path: new URL(`${label}-platform-layout-dusk.png`, root).pathname })
    await page.getByRole('button', { name: /准备守夜|Stand watch/ }).click()
    await page.waitForTimeout(6200)
    await page.screenshot({ path: new URL(`${label}-platform-layout-defense-ready.png`, root).pathname })
    await page.getByRole('button', { name: /路灯过载|Overload lights/ }).click()
    await page.waitForTimeout(650)
    await page.screenshot({ path: new URL(`${label}-platform-layout-overdrive.png`, root).pathname })
    await page.waitForSelector('.ad-result', { timeout: 40000 })
    const resultKind = await page.locator('.ad-result--win').count() ? 'slice-win' : 'slice-fail'
    await page.screenshot({ path: new URL(`${label}-platform-layout-${resultKind}-outcome.png`, root).pathname })
    await page.waitForSelector(`[data-guide-phase="${resultKind}"][data-guide-beat="1"]`)
    await page.screenshot({ path: new URL(`${label}-platform-layout-${resultKind}-stats.png`, root).pathname })
    await page.waitForSelector(`[data-guide-phase="${resultKind}"][data-guide-beat="2"]`)
    await page.screenshot({ path: new URL(`${label}-platform-layout-${resultKind}.png`, root).pathname })
  }
  const metrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: innerHeight, scrollHeight: document.documentElement.scrollHeight }))
  if (metrics.scrollWidth !== metrics.width) findings.push(`${label}: horizontal overflow ${JSON.stringify(metrics)}`)
  await page.close()
}

const quick = process.env.QA_QUICK === '1'
const fullNarrow = process.env.QA_FULL_NARROW === '1'
const skipWide = process.env.QA_SKIP_WIDE === '1'
const skipNarrow = process.env.QA_SKIP_NARROW === '1'
if (!skipWide) await primaryFlow(390, 844, '390x844', !quick)
if (!skipNarrow) await primaryFlow(320, 568, '320x568', fullNarrow)

const external = await browser.newPage({ viewport: { width: 390, height: 844 } })
await external.goto(gameUrl, { waitUntil: 'networkidle' })
await external.waitForSelector('.ad-intro')
await external.screenshot({ path: new URL('390x844-external-guest-intro.png', root).pathname })
await external.close()

await fs.writeFile(new URL('capture-findings.json', root), JSON.stringify({ findings }, null, 2))
await browser.close()
console.log(JSON.stringify({ ok: findings.length === 0, findings }, null, 2))
