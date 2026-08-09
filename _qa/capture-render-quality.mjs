import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs/promises'

const output = new URL('./ui/render-quality/', import.meta.url)
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const findings = []
const metrics = []
const requestedTier = process.env.QA_RENDER_QUALITY
const tiers = requestedTier ? [requestedTier] : ['low', 'balanced', 'high']
const requestedWidth = Number(process.env.QA_RENDER_WIDTH || 0)
const deviceScaleFactor = Number(process.env.QA_DEVICE_SCALE_FACTOR || 1)
const viewports = requestedWidth === 320 ? [{ width: 320, height: 568 }] : requestedWidth === 390 ? [{ width: 390, height: 844 }] : [{ width: 390, height: 844 }, { width: 320, height: 568 }]

for (const { width, height } of viewports) {
  for (const tier of tiers) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor })
    await page.addInitScript(() => localStorage.setItem('game_locale', 'zh'))
    page.on('pageerror', error => findings.push(`${width}x${height}-${tier}: ${error.message}`))
    await page.goto(`http://127.0.0.1:5173/?render_quality=${tier}`, { waitUntil: 'networkidle' })
    await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
    await page.getByRole('button', { name: /接通余光|Restore the light/ }).click()
    await page.waitForTimeout(900)
    const canvas = await page.locator('canvas').evaluate(element => ({
      cssWidth: element.clientWidth,
      cssHeight: element.clientHeight,
      bufferWidth: element.width,
      bufferHeight: element.height,
      tier: document.documentElement.dataset.renderQuality,
    }))
    metrics.push({ viewport: `${width}x${height}`, requested: tier, ...canvas })
    if (canvas.tier !== tier) findings.push(`${width}x${height}-${tier}: resolved as ${canvas.tier}`)
    await page.screenshot({ path: new URL(`${width}x${height}-${tier}-rescue.png`, output).pathname })
    await page.close()
  }
}

await browser.close()
const metricsName = `metrics-${requestedWidth || 'all'}-${requestedTier || 'all'}-dpr${deviceScaleFactor}.json`
await fs.writeFile(new URL(metricsName, output), JSON.stringify({ metrics, findings }, null, 2))
console.log(JSON.stringify({ ok: findings.length === 0, metrics, findings }, null, 2))
