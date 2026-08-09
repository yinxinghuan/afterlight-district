import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import fs from 'node:fs/promises'

const output = new URL('../public/portraits/', import.meta.url)
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })

for (const who of ['jo', 'lin']) {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 })
  await page.goto(`http://127.0.0.1:5173/_qa/portrait-render.html?who=${who}`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__PORTRAIT_READY__ === true)
  await page.locator('canvas').screenshot({ path: new URL(`${who}-bust.png`, output).pathname, omitBackground: true })
  await page.close()
}

await browser.close()
