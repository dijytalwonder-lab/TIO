// Story-mode rooms in headless Chrome (pipe transport, file:// page, no server/port): screenshot every room,
// check the back walls stop flying fragments, and check the console stays clean.
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

await page.goto(URL_, { waitUntil: 'load' });
await sleep(2000);
await page.click('#btn-asmr');
await sleep(2500);
await page.evaluate(() => { document.getElementById('ui').style.display = 'none'; });

const rooms = ['living', 'kitchen', 'attic', 'library', 'playroom', 'aman', 'bunty', 'erika', 'krick', 'chinese'];
for (const key of rooms) {
  await page.evaluate((k) => window.__HB.setWorld(k), key);
  await sleep(1800);
  await page.screenshot({ path: path.join(OUT, 'room-' + key + '.png') });
  const info = await page.evaluate(() => ({ walls: window.__HB.world.walls, err: document.getElementById('errlog')?.textContent || '' }));
  ok(info.walls === true && !info.err, `${key}: room loaded (walls ${info.walls}) ${info.err}`);
}

// back-wall test in the library: a critical hit sends shards in every direction
await page.evaluate(() => window.__HB.setWorld('library'));
await sleep(500);
const zone = await page.evaluate(() => {
  const H = window.__HB, S = H.S; S.br.group.updateMatrixWorld(true);
  const z = S.asm.zones[0].at.clone().applyMatrix4(S.br.group.matrixWorld).project(H.camera);
  return { x: (z.x * 0.5 + 0.5) * innerWidth, y: (-z.y * 0.5 + 0.5) * innerHeight };
});
await page.mouse.click(zone.x, zone.y);
let worst = 0, n = 0;
for (let i = 0; i < 16; i++) {
  await sleep(250);
  const r = await page.evaluate(() => { let m = 0, c = 0; for (const p of window.__HB.world.pieces) { if (p.dead || p.pos.y < -0.4) continue; c++; m = Math.max(m, -2.7 - p.pos.x, -2.7 - p.pos.z); } return { m, c }; });
  worst = Math.max(worst, r.m); n = Math.max(n, r.c);
}
await page.screenshot({ path: path.join(OUT, 'room-library-smashed.png') });
console.log('pieces seen:', n, ' furthest past a back wall:', worst.toFixed(3));
ok(n > 10, 'the hit produced fragments');
ok(worst < 0.05, 'no fragment passes through the back walls');

// switching back to an island removes the walls
await page.evaluate(() => window.__HB.setWorld(2));
await sleep(300);
ok(await page.evaluate(() => window.__HB.world.walls === false), 'island worlds have no walls');

console.log('--- console errors/warnings ---');
console.log(logs.length ? [...new Set(logs)].join('\n') : '(none)');
console.log(fails ? `\n${fails} FAILURE(S)` : '\nROOMS OK');
await browser.close();
