import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const startDay = Number(process.env.QA_START_DAY || 2)
await page.addInitScript(() => localStorage.setItem('game_locale', 'zh'))
await page.goto(`http://127.0.0.1:5173/?render_quality=low&qa_start_day=${startDay}`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: '跳过引导' }).click()
await page.waitForSelector('[data-guide-phase="day-brief"][data-guide-beat="1"]')
const upgrade = page.getByRole('button', { name: /加固路障/ })
const before = await page.locator('.ad-game').evaluate(element => ({
  phase: element.getAttribute('data-guide-phase'),
  day: element.getAttribute('data-day'),
  resources: [...element.querySelectorAll('.ad-resource')].map(resource => ({
    text: resource.textContent,
    opacity: getComputedStyle(resource).opacity,
    color: getComputedStyle(resource.querySelector('span')).color,
  })),
}))
await upgrade.click()
await page.waitForTimeout(900)
const after = await page.locator('.ad-game').evaluate(element => ({ phase: element.getAttribute('data-guide-phase'), beat: element.getAttribute('data-guide-beat'), day: element.getAttribute('data-day') }))
console.log(JSON.stringify({ before, after }))
await browser.close()
if (after.phase !== 'dusk' || after.beat !== '1') process.exitCode = 1
