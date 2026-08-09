import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs/promises'

const root = new URL('./ui/endless/', import.meta.url)
await fs.mkdir(root, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
const findings = []

await page.addInitScript(() => localStorage.setItem('game_locale', 'zh'))
page.on('pageerror', error => findings.push(`pageerror: ${error.message}`))
page.on('requestfailed', request => {
  if (request.url().startsWith('http://127.0.0.1:5173/')) findings.push(`local request failed: ${request.url()} ${request.failure()?.errorText}`)
})

await page.goto('http://127.0.0.1:5173/?render_quality=low&qa_night_seconds=12', { waitUntil: 'networkidle' })
await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
await page.getByRole('button', { name: '跳过引导' }).click()

async function waitEnabled(name, timeout = 20000) {
  const button = page.getByRole('button', { name })
  await button.waitFor({ state: 'visible', timeout })
  await page.waitForFunction(label => [...document.querySelectorAll('button')].some(candidate => candidate.textContent?.includes(label) && !candidate.disabled), name, { timeout })
  return button
}

for (let day = 1; day <= 5; day += 1) {
  await page.waitForSelector(`[data-guide-phase="dusk"][data-day="${day}"][data-guide-beat="1"]`, { timeout: 10000 })
  await page.getByRole('button', { name: '准备守夜' }).click()
  await page.waitForSelector(`[data-guide-phase="defense"][data-day="${day}"]`)
  await (await waitEnabled('路灯过载')).click()
  await (await waitEnabled('现场抢修')).click()
  await page.waitForSelector(`[data-guide-phase="slice-win"][data-day="${day}"][data-guide-beat="2"]`, { timeout: 30000 })

  if (day === 3 || day === 5) {
    await page.screenshot({ path: new URL(`night-${day}-result-platform-layout.png`, root).pathname })
  }

  const nextDay = day + 1
  const nextButton = page.getByRole('button', { name: `进入第 ${nextDay} 天` })
  if (!(await nextButton.isVisible())) findings.push(`night ${day} did not expose day ${nextDay}`)
  await nextButton.click()
  await page.waitForSelector(`[data-guide-phase="day-brief"][data-day="${nextDay}"][data-guide-beat="1"]`, { timeout: 5000 })

  if (day === 3 || day === 5) {
    await page.screenshot({ path: new URL(`day-${nextDay}-upgrade-platform-layout.png`, root).pathname })
  }
  if (day < 5) await page.getByRole('button', { name: /加固路障/ }).click()
}

const metrics = await page.evaluate(() => ({
  phase: document.querySelector('.ad-game')?.getAttribute('data-guide-phase'),
  day: document.querySelector('.ad-game')?.getAttribute('data-day'),
  width: innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  height: innerHeight,
  scrollHeight: document.documentElement.scrollHeight,
}))
if (metrics.phase !== 'day-brief' || metrics.day !== '6') findings.push(`endless loop stopped before day 6: ${JSON.stringify(metrics)}`)
if (metrics.width !== metrics.scrollWidth || metrics.height !== metrics.scrollHeight) findings.push(`viewport overflow: ${JSON.stringify(metrics)}`)

await fs.writeFile(new URL('report.json', root), JSON.stringify({ ok: findings.length === 0, findings, metrics }, null, 2))
await browser.close()
console.log(JSON.stringify({ ok: findings.length === 0, findings, metrics }, null, 2))
if (findings.length) process.exitCode = 1
