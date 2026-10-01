import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const [, , url, expr] = process.argv
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
page.on('console', (m) => { if (m.type() !== 'debug') console.log(`[${m.type()}]`, m.text().slice(0, 1500)) })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(url)
await page.waitForFunction(() => window.__ready === true, null, { timeout: 45000 }).catch(() => console.log('not ready'))
await page.waitForTimeout(2500)
console.log(JSON.stringify(await page.evaluate(expr), null, 1))
await browser.close()
