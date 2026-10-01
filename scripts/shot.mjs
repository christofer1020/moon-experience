// Usage: node scripts/shot.mjs "<url>" out.png [waitMs] [w] [h] [mobile]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const [, , url, out, wait = '6000', w = '1440', h = '900', mobile = ''] = process.argv
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] })
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: !!mobile, hasTouch: !!mobile })
const page = await ctx.newPage()
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.goto(url, { waitUntil: 'load' })
try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 45000 }) } catch (e) { logs.push('timeout waiting __ready') }
await page.waitForTimeout(+wait)
await page.screenshot({ path: out })
console.log(logs.slice(0, 40).join('\n'))
await browser.close()
