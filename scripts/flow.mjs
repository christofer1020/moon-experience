// node scripts/flow.mjs <outDir> "<steps>" [w] [h] [query]
// steps: comma list: loader | enter | ch:<idx>[:<beat>] | wait:<ms> | eval:<js> | click:<selector> | shot:<name>
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import fs from 'node:fs'
const [, , out, steps, w = '1440', h = '900', query = '?q=low&aa=0&dyn=0&debug=1', mobile = ''] = process.argv
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: !!mobile, hasTouch: !!mobile })
const page = await ctx.newPage()
const logs = []
page.on('console', (m) => { if (m.type() !== 'debug' && !/\[vite\]/.test(m.text())) logs.push(`[${m.type()}] ${m.text().slice(0, 600)}`) })
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.goto('http://127.0.0.1:5173/' + query, { waitUntil: 'load' })
for (const st of steps.split('|')) {
  const [cmd, a, b] = st.split(':')
  if (cmd === 'loader') { await page.waitForTimeout(+a || 2500); await page.screenshot({ path: `${out}/loader.png` }) }
  else if (cmd === 'ready') { await page.waitForSelector('.loader.ready', { timeout: 60000 }).catch(() => logs.push('no ready')) }
  else if (cmd === 'enter') { await page.click('text=Enter silently'); }
  else if (cmd === 'live') { await page.waitForFunction(() => window.__selene && window.__selene.store.getState().phase === 'live', null, { timeout: 90000 }).catch(() => logs.push('no live')) }
  else if (cmd === 'ch') { await page.evaluate(([i, bb]) => window.__selene.scroll.goTo(+i, +(bb || 0), { immediate: true }), [a, b]); }
  else if (cmd === 'settle') { await page.evaluate(([n, d]) => window.__selene.obs.stepOnce(+d || 0.2, +n || 20), [a, b]) }
  else if (cmd === 'wait') { await page.waitForTimeout(+a) }
  else if (cmd === 'shot') { await page.screenshot({ path: `${out}/${a}.png` }) }
  else if (cmd === 'eval') { const r = await page.evaluate(st.slice(5)); console.log('eval ->', JSON.stringify(r)) }
  else if (cmd === 'click') { await page.click(st.slice(6)) }
}
console.log(logs.slice(0, 30).join('\n'))
await browser.close()
