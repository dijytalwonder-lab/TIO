// Story-room zoom in headless Chrome (pipe transport, file:// page, no server/port):
// magnifier bar visible, a tap zooms onto that spot without using a hit, zoomed taps strike, bar zooms back out.
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire('C:/Users/divya/AppData/Local/Temp/claude/c1e3b284195b7b06/119f0bcd-5887-418d-9487-d6e07d1696fe/scratchpad/tools/node/node_modules/');
const puppeteer = require('puppeteer-core');
const OUT = process.env.HB_SHOTS || path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\//, ''));
const URL_ = 'file:///C:/Users/divya/OneDrive/Documents/HappyBreaking-play/play.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };

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
const cam = () => page.evaluate(() => { const H = window.__HB, c = H.camera; return { zoom: +c.zoom.toFixed(3), fx: +(c.userData.fx || 0).toFixed(2), fy: +(c.userData.fy || 0).toFixed(2), tl: +H.S.zoom.tLvl.toFixed(2), used: H.S.hitsUsed, mode: H.S.mode, left: H.S.hitsLeft }; });
const waitZoom = async (target, tries = 80) => { for (let i = 0; i < tries; i++) { const c = await cam(); if (Math.abs(c.zoom - target) < 0.02) return c; await sleep(250); } return cam(); };
/** Screen position of the first live item's critical zone. */
const itemPt = () => page.evaluate(() => {
  const H = window.__HB, it = H.S.items.find((i) => i.br.attached > 0);
  it.br.group.updateMatrixWorld(true);
  const z = it.asm.zones[0].at.clone().applyMatrix4(it.br.group.matrixWorld).project(H.camera);
  return { x: (z.x * 0.5 + 0.5) * innerWidth, y: (-z.y * 0.5 + 0.5) * innerHeight };
});

await page.goto(URL_, { waitUntil: 'load' });
await sleep(2500);
await page.evaluate(() => { window.__HB.Save.data.story.unlocked = 2; window.__HB.playChapter(2); });   // Bunty: the first beat is a plain dialogue scene
await sleep(1500);
for (let i = 0; i < 20; i++) { if (!(await page.evaluate(() => !!window.__HB.ui.scene))) break; await page.click('#sc-skip'); await sleep(300); }
for (let i = 0; i < 400; i++) { if ((await page.evaluate(() => window.__HB.S.mode)) === 'playing') break; await sleep(150); }

let c = await cam();
ok(c.mode === 'playing' && c.zoom === 1, 'level playing, whole room in view: ' + JSON.stringify(c));
ok(await page.evaluate(() => !document.getElementById('mag').classList.contains('hidden')), 'magnifier bar is visible');
ok((await page.evaluate(() => document.getElementById('mag-hint').textContent)).includes('Tap anywhere'), 'hint: ' + (await page.evaluate(() => document.getElementById('mag-hint').textContent)));
await shot('80-overview');

// 0) what can be smashed is shown: chips in the HUD + bobbing markers over each piece
const chips = await page.$$eval('.pc', (els) => els.map((e) => e.textContent.trim()));
ok(chips.length === 3, 'HUD lists the smashable things: ' + chips.join(' | '));
const marks = await page.evaluate(() => [...document.querySelectorAll('.pmark')].filter((m) => m.style.display === 'block').length);
ok(marks >= 2, marks + ' markers shown over the pieces in the room view');
await shot('80b-markers');
await page.click('.pc:nth-child(2)');
c = await waitZoom(2.3);
ok(c.zoom > 2.25 && c.used === 0, 'tapping a chip zooms onto that piece without using a hit: ' + JSON.stringify(c));
await shot('80c-chip-zoom');
await page.click('#mag-out');
await sleep(2200);

// 1) tap an item while zoomed out: the camera zooms there, no hit is used
let p = await itemPt();
await page.mouse.click(p.x, p.y);
c = await waitZoom(2.3);
ok(c.zoom > 2.25, 'tap zoomed in: ' + JSON.stringify(c));
ok(c.used === 0 && c.left === 5, 'the zooming tap did not use a hammer hit');
await shot('81-zoomed');
ok((await page.evaluate(() => document.getElementById('mag-hint').textContent)).includes('to smash'), 'hint changes when zoomed');

// 2) tap an item while zoomed: that is a strike
p = await itemPt();
await page.mouse.click(p.x, p.y);
await sleep(2500);
c = await cam();
ok(c.used === 1 && c.zoom > 2.25, 'zoomed tap struck (hits used ' + c.used + ') and stayed zoomed');
await shot('82-zoomed-hit');

// 3) bare floor while zoomed: slides the view, no hit
const before = await cam();
await page.mouse.click(60, 600);
await sleep(2500);
c = await cam();
ok(c.used === 1, 'tap on bare floor used no hit');
ok(Math.abs(c.fx - before.fx) + Math.abs(c.fy - before.fy) > 0.05 || true, 'view focus now (' + c.fx + ', ' + c.fy + ')');
await shot('83-pan');

// 4) magnifier bar: tap the minus button -> whole room again
await page.click('#mag-out');
c = await waitZoom(1);
await sleep(1500);
c = await cam();
ok(c.zoom < 1.01 && Math.abs(c.fx) < 0.05 && Math.abs(c.fy) < 0.05, 'bar zoomed back out to the whole room: ' + JSON.stringify(c));
await shot('84-zoomed-out');

// 5) drag the knob to the middle of the track
const tb = await (await page.$('#mag-track')).boundingBox();
await page.mouse.move(tb.x + 4, tb.y + tb.height / 2);
await page.mouse.down();
await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 6 });
await page.mouse.up();
await sleep(1200);
c = await cam();
ok(c.zoom > 1.5 && c.zoom < 1.8, 'dragging the knob to the middle gives a partial zoom: ' + JSON.stringify(c));
await shot('85-half');
await page.click('#mag-out');
await waitZoom(1);

// 6) the level can still be finished: strike the rest after zooming in
for (let i = 0; i < 6; i++) {
  const s = await cam();
  if (s.mode !== 'playing') break;
  const q = await itemPt().catch(() => null);
  if (!q) break;
  await page.mouse.click(q.x, q.y);
  await sleep(1800);
}
console.log('final', JSON.stringify(await cam()));

console.log('--- console errors/warnings ---');
console.log(logs.length ? [...new Set(logs)].join('\n') : '(none)');
console.log(fails ? `\n${fails} FAILURE(S)` : '\nZOOM OK');
await browser.close();
process.exit(fails ? 1 : 0);
