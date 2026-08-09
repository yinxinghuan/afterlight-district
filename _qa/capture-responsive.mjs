import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs/promises'

const root = new URL('./ui/responsive/', import.meta.url)
await fs.mkdir(root, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 1 })
const findings = []

await page.addInitScript(() => localStorage.setItem('game_locale', 'zh'))
page.on('pageerror', error => findings.push(`pageerror: ${error.message}`))
page.on('requestfailed', request => {
  if (request.url().startsWith('http://127.0.0.1:5173/')) findings.push(`local request failed: ${request.url()} ${request.failure()?.errorText}`)
})

await page.goto('http://127.0.0.1:5173/?render_quality=low&qa_start_day=2&qa_night_seconds=12', { waitUntil: 'networkidle' })
await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
await page.getByRole('button', { name: '跳过引导' }).click()
await page.waitForSelector('[data-guide-phase="day-brief"][data-day="2"][data-guide-beat="1"]')
await page.screenshot({ path: new URL('320x568-day-2-upgrade-platform-layout.png', root).pathname })

await page.getByRole('button', { name: /加固路障/ }).click()
await page.waitForSelector('[data-guide-phase="dusk"][data-guide-beat="1"]')
await page.screenshot({ path: new URL('320x568-day-2-dusk-platform-layout.png', root).pathname })
await page.getByRole('button', { name: '准备守夜' }).click()
await page.waitForSelector('[data-guide-phase="defense"]')
await page.screenshot({ path: new URL('320x568-day-2-defense-platform-layout.png', root).pathname })

const metrics = await page.evaluate(() => ({
  width: innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
  height: innerHeight,
  scrollHeight: document.documentElement.scrollHeight,
  actionButtons: document.querySelectorAll('.ad-defense-actions .ad-skill').length,
}))
if (metrics.width !== metrics.scrollWidth || metrics.height !== metrics.scrollHeight) findings.push(`viewport overflow: ${JSON.stringify(metrics)}`)
if (metrics.actionButtons !== 2) findings.push(`expected 2 defense controls, found ${metrics.actionButtons}`)

await fs.writeFile(new URL('report.json', root), JSON.stringify({ ok: findings.length === 0, findings, metrics }, null, 2))
await browser.close()
console.log(JSON.stringify({ ok: findings.length === 0, findings, metrics }, null, 2))
if (findings.length) process.exitCode = 1
