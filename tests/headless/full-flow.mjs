import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire('C:/Users/divya/AppData/Local/Temp/claude/c1e3b284195b7b06/119f0bcd-5887-418d-9487-d6e07d1696fe/scratchpad/tools/node/node_modules/');
const puppeteer = require('puppeteer-core');
const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const URL_ = 'file:///C:/Users/divya/OneDrive/Documents/HappyBreaking-play/play.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mode = process.argv[2] || 'ui';
const from = +(process.argv[3] || 1), to = +(process.argv[4] || 30);

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', pipe: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--no-first-run']
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') });
const st = () => page.evaluate(() => { const H = window.__HB, S = H.S; return { mode: S.mode, count: H.world.count, target: S.level && S.level.target, hitsLeft: S.hitsLeft, crits: S.crits, pieces: H.world.pieces.length, err: document.getElementById('errlog')?.textContent || '' }; });
const zonePt = (h) => page.evaluate((h) => {
  const H = window.__HB, S = H.S; S.br.group.updateMatrixWorld(true);
  const zs = S.asm.zones; const z = zs[h % zs.length].at.clone().applyMatrix4(S.br.group.matrixWorld).project(H.camera);
  return { x: (z.x * 0.5 + 0.5) * innerWidth, y: (-z.y * 0.5 + 0.5) * innerHeight };
}, h);

await page.goto(URL_, { waitUntil: 'load' });
await sleep(2500);
await page.evaluate(() => { const H = window.__HB; H.Save.data.unlocked = 30; H.Save.data.coins = 2000; H.Save.save(); });

if (mode === 'ui') {
  await page.click('#btn-levels'); await sleep(600); await shot('10-levels');
  await page.click('#lv-back'); await sleep(300);
  await page.click('#btn-hammers'); await sleep(600); await shot('11-hammers');
  await page.click('#shop-back'); await sleep(300);
  await page.click('#btn-settings'); await sleep(500); await shot('12-settings');
  await page.click('#set-close'); await sleep(300);
  await page.click('#btn-daily'); await sleep(500);
  console.log('daily toast:', await page.evaluate(() => document.getElementById('toast').textContent));
  // play level 12 (piggy) - pause overlay
  await page.evaluate(() => window.__HB.startLevel(12)); await sleep(2800);
  await page.click('#btn-pause'); await sleep(400); await shot('13-pause');
  await page.click('#p-resume'); await sleep(300);
  console.log('after resume', JSON.stringify(await st()));
  // weak hit at the edge of the object, then crit
  const e = await page.evaluate(() => { const H = window.__HB; const S = H.S; S.br.group.updateMatrixWorld(true); const c = S.asm.cells[5].center.clone().applyMatrix4(S.br.group.matrixWorld).project(H.camera); return { x: (c.x * 0.5 + 0.5) * innerWidth + 55, y: (-c.y * 0.5 + 0.5) * innerHeight - 60 }; });
  await page.mouse.click(e.x, e.y); await sleep(500); await shot('14-weak');
  const p = await zonePt(0); await page.mouse.click(p.x, p.y); await sleep(900); await shot('15-piggy-crit');
  const p2 = await zonePt(0); await page.mouse.click(p2.x, p2.y); await sleep(3500);
  console.log('piggy state', JSON.stringify(await st()));
  await sleep(1500); await shot('16-result');
  console.log('result overlay text:', await page.evaluate(() => document.getElementById('overlay').innerText.replace(/\s+/g, ' ').slice(0, 160)));
  // fail flow: level 30, no taps
  await page.evaluate(() => { document.getElementById('overlay').classList.add('hidden'); window.__HB.startLevel(30); });
  await sleep(2800);
  const f = await zonePt(0); await page.mouse.click(f.x + 120, f.y + 250); // miss
  await sleep(16500); await sleep(4200);
  console.log('fail state', JSON.stringify(await st()));
  await shot('17-fail');
  console.log('fail overlay:', await page.evaluate(() => document.getElementById('overlay').innerText.replace(/\s+/g, ' ').slice(0, 200)));
} else {
  const shots = new Set([7, 11, 14, 18, 21, 23, 27, 30]);
  for (let id = from; id <= to; id++) {
    await page.evaluate((id) => window.__HB.startLevel(id), id);
    for (let w = 0; w < 120; w++) { if ((await st()).mode === 'playing') break; await sleep(500); }
    await sleep(300);
    let n = 0;
    while (true) {
      const s = await st();
      if (s.mode !== 'playing' || s.hitsLeft <= 0) break;
      const p = await zonePt(n); await page.mouse.click(p.x, p.y); n++;
      await sleep(850);
      if (n === 1 && shots.has(id)) await shot(`20-level${id}-hit1`);
    }
    await sleep(3200);
    const s = await st();
    if (shots.has(id)) await shot(`21-level${id}-end`);
    console.log('   hist', JSON.stringify(await page.evaluate(() => { const r = window.__HB.S.hist; window.__HB.S.hist = []; return r; })));
    console.log(`L${id}`.padEnd(4), JSON.stringify({ mode: s.mode, count: s.count, target: s.target, hitsUsed: n, crits: s.crits, pieces: s.pieces, err: s.err }));
    await page.evaluate(() => { document.getElementById('overlay').classList.add('hidden'); document.getElementById('overlay').innerHTML = ''; });
  }
}
console.log('--- console errors/warnings ---');
console.log(logs.length ? [...new Set(logs)].join('\n') : '(none)');
await browser.close();
