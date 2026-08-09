import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs/promises'

const root = new URL('./ui/three-night/', import.meta.url)
await fs.mkdir(root, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
const findings = []

await page.addInitScript(() => localStorage.setItem('game_locale', 'zh'))
page.on('pageerror', error => findings.push(`pageerror: ${error.message}`))
page.on('console', message => {
  if (message.type() !== 'error') return
  const text = message.text()
  const url = message.location().url
  if (text === 'Failed to load resource: net::ERR_FAILED') return
  if (!text.includes('aigram.aiwaves.tech/note/aigram/ai/game/track/report') && !url.includes('aigram.aiwaves.tech/note/aigram/ai/game/track/report')) findings.push(`console: ${text}`)
})
page.on('requestfailed', request => {
  const url = request.url()
  if (url.startsWith('http://127.0.0.1:5173/')) findings.push(`local request failed: ${url} ${request.failure()?.errorText}`)
})

await page.goto('http://127.0.0.1:5173/?render_quality=low&qa_night_seconds=12&qa_night_1=24', { waitUntil: 'networkidle' })
await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
await page.getByRole('button', { name: '跳过引导' }).click()

async function waitEnabled(name, timeout = 20000) {
  const button = page.getByRole('button', { name })
  await button.waitFor({ state: 'visible', timeout })
  await page.waitForFunction(label => {
    const candidates = [...document.querySelectorAll('button')]
    return candidates.some(candidate => candidate.textContent?.includes(label) && !(candidate).disabled)
  }, name, { timeout })
  return button
}

for (let day = 1; day <= 3; day += 1) {
  await page.waitForSelector(`[data-guide-phase="dusk"][data-day="${day}"][data-guide-beat="1"]`, { timeout: 12000 })
  await page.screenshot({ path: new URL(`day-${day}-dusk-platform-layout.png`, root).pathname })
  await page.getByRole('button', { name: '准备守夜' }).click()
  await page.waitForSelector(`[data-guide-phase="defense"][data-day="${day}"]`)

  const overdrive = await waitEnabled('路灯过载')
  await overdrive.click()
  const repair = await waitEnabled('现场抢修')
  await repair.click()
  await page.screenshot({ path: new URL(`night-${day}-active-tools-platform-layout.png`, root).pathname })

  if (day === 1) {
    const secondOverdrive = await waitEnabled('路灯过载')
    await secondOverdrive.evaluate(button => button.click())
    await page.screenshot({ path: new URL('night-1-second-overdrive-platform-layout.png', root).pathname })
  }

  await page.waitForSelector(`[data-guide-phase="slice-win"][data-day="${day}"]`, { timeout: 30000 })
  await page.waitForSelector(`[data-guide-phase="slice-win"][data-day="${day}"][data-guide-beat="2"]`, { timeout: 5000 })
  await page.screenshot({ path: new URL(`night-${day}-result-platform-layout.png`, root).pathname })

  if (day < 3) {
    await page.getByRole('button', { name: `进入第 ${day + 1} 天` }).click()
    await page.waitForSelector(`[data-guide-phase="day-brief"][data-day="${day + 1}"][data-guide-beat="1"]`, { timeout: 5000 })
    await page.screenshot({ path: new URL(`day-${day + 1}-upgrade-platform-layout.png`, root).pathname })
    const upgrade = page.getByRole('button', { name: day === 1 ? /加固路障/ : /扩充电池/ })
    await upgrade.click()
  }
}

const finalTitle = await page.getByRole('heading').textContent()
if (!finalTitle?.includes('三夜')) findings.push(`final title did not confirm three nights: ${finalTitle}`)
const metrics = await page.evaluate(() => ({
  phase: document.querySelector('.ad-game')?.getAttribute('data-guide-phase'),
  day: document.querySelector('.ad-game')?.getAttribute('data-day'),
  width: innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  height: innerHeight,
  scrollHeight: document.documentElement.scrollHeight,
}))
if (metrics.phase !== 'slice-win' || metrics.day !== '3') findings.push(`three-night progression incomplete: ${JSON.stringify(metrics)}`)
if (metrics.width !== metrics.scrollWidth) findings.push(`horizontal overflow: ${JSON.stringify(metrics)}`)

await fs.writeFile(new URL('report.json', root), JSON.stringify({ ok: findings.length === 0, findings, metrics }, null, 2))
await browser.close()
console.log(JSON.stringify({ ok: findings.length === 0, findings, metrics }, null, 2))
if (findings.length) process.exitCode = 1
