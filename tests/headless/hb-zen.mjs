import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire('C:/Users/divya/AppData/Local/Temp/claude/c1e3b284195b7b06/119f0bcd-5887-418d-9487-d6e07d1696fe/scratchpad/tools/node/node_modules/');
const puppeteer = require('puppeteer-core');
const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const URL_ = 'file:///C:/Users/divya/OneDrive/Documents/HappyBreaking-play/play.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', pipe: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--no-first-run']
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') });
const st = () => page.evaluate(() => { const H = window.__HB, S = H.S; return { mode: S.mode, count: H.world.count, shown: S.shown, ts: +S.timeScale.toFixed(2), landed: S.landed, attached: S.br && S.br.attached, pieces: H.world.pieces.length, err: document.getElementById('errlog')?.textContent || '' }; });
const zonePt = () => page.evaluate(() => {
  const H = window.__HB, S = H.S; S.br.group.updateMatrixWorld(true);
  const z = S.asm.zones[0].at.clone().applyMatrix4(S.br.group.matrixWorld).project(H.camera);
  return { x: (z.x * 0.5 + 0.5) * innerWidth, y: (-z.y * 0.5 + 0.5) * innerHeight };
});
const waitLanded = async () => { for (let i = 0; i < 80; i++) { const s = await st(); if (s.landed) return; await sleep(250); } };

await page.goto(URL_, { waitUntil: 'load' });
await sleep(2500);
await shot('30-menu');
await page.click('#btn-asmr');
await waitLanded();
await sleep(500);
console.log('zen start', JSON.stringify(await st()));
await shot('31-zen-start');

// perfect hit, sample time scale during slow-mo
let p = await zonePt();
await page.mouse.click(p.x, p.y);
const ts = [];
for (let i = 0; i < 10; i++) { await sleep(120); const s = await st(); ts.push([s.ts, s.count, s.shown]); if (i === 3) await shot('32-zen-slowmo'); }
console.log('timeScale/count/shown samples', JSON.stringify(ts));
await sleep(2500);
await shot('33-zen-after');
console.log('after crit', JSON.stringify(await st()));

// cycle through every object with NEXT and hit each once
const names = [];
for (let i = 0; i < 17; i++) {
  await page.click('#zen-next');
  await waitLanded();
  await sleep(300);
  const nm = await page.evaluate(() => document.getElementById('z-name').textContent);
  names.push(nm);
  const q = await zonePt();
  await page.mouse.click(q.x, q.y);
  await sleep(700);
  if (i === 5) await shot('34-zen-obj6');
  if (i === 10) await shot('35-zen-obj11');
}
console.log('objects:', names.join(' | '));
console.log('after cycle', JSON.stringify(await st()));
await page.click('#zen-again'); await sleep(1500);
await page.click('#zen-home'); await sleep(800);
console.log('home', JSON.stringify(await st()));
console.log('--- console errors/warnings ---');
console.log(logs.length ? [...new Set(logs)].join('\n') : '(none)');
await browser.close();
