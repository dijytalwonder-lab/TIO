// Plays the story chapters end to end in headless Chrome (pipe transport, file:// page, no server/port):
// dialogue + visual-novel scenes, every smash level (hits aimed at the hidden zone), CONTINUE, chapter end,
// unlock order, premium note, save state, back button, and the normal game still working.
//   node hb-story.mjs            plays chapters 1-4 (the free ones)
//   node hb-story.mjs 1          plays chapter 1 only
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire('C:/Users/divya/AppData/Local/Temp/claude/c1e3b284195b7b06/119f0bcd-5887-418d-9487-d6e07d1696fe/scratchpad/tools/node/node_modules/');
const puppeteer = require('puppeteer-core');
const OUT = process.env.HB_SHOTS || path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\//, ''));
const URL_ = 'file:///C:/Users/divya/OneDrive/Documents/HappyBreaking-play/play.html';
const LAST = Number(process.argv[2] || 4);
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
const st = () => page.evaluate(() => {
  const H = window.__HB, S = H.S;
  return { mode: S.mode, story: S.story ? S.story.ch.id + ':' + S.story.i : null, level: S.level ? (S.level.story ? S.level.story.key : S.level.id) : null, scene: !!H.ui.scene, vn: !!(H.ui.scene && H.ui.scene.vn), count: H.world.count, err: document.getElementById('errlog')?.textContent || '' };
});
const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent || '', sel);
const clickSel = async (sel) => { const b = await (await page.$(sel)).boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
const zonePt = () => page.evaluate(() => {
  const H = window.__HB, S = H.S;
  const left = (S.items || []).filter((i) => i.br.attached > 0).sort((a, b) => b.br.attached - a.br.attached);
  const it = left[0] || { br: S.br, asm: S.asm };
  it.br.group.updateMatrixWorld(true);
  // aim at the zone, or at the nearest shard still standing once the zone itself is gone
  const zone = it.asm.zones[0].at;
  const alive = it.asm.cells.filter((c) => c.state === 0);
  const cell = alive.length ? alive.reduce((p, q) => (p.center.distanceTo(zone) < q.center.distanceTo(zone) ? p : q)) : null;
  const z = (cell ? cell.center : zone).clone().applyMatrix4(it.br.group.matrixWorld).project(H.camera);
  return { x: (z.x * 0.5 + 0.5) * innerWidth, y: (-z.y * 0.5 + 0.5) * innerHeight };
});

/** Tap a dialogue scene to its end. `useSkip` jumps out with SKIP instead. */
async function runScene(useSkip) {
  let taps = 0;
  for (let i = 0; i < 60; i++) {
    const s = await st();
    if (!s.scene) break;
    if (useSkip) { await clickSel('#sc-skip'); await sleep(200); taps++; continue; }
    await sleep(80);
    await clickSel('#sc-box'); taps++;
    await sleep(100);
  }
  return taps;
}

/** Smash the level at the hidden zone until it is won (or fails). Returns 'won' | 'lost'. */
async function playLevel(label) {
  // the intro card needs ~2.4 s of game time, which can be 15+ s of wall time on software GL
  for (let i = 0; i < 600; i++) { const s = await st(); if (s.mode === 'playing') break; await sleep(150); }
  if (label) await shot(label + '-start');
  let strikes = 0;
  for (let step = 0; step < 30; step++) {
    const s = await st();
    if (s.mode !== 'playing') break;
    const p = await zonePt();
    const zoomed = await page.evaluate(() => window.__HB.S.zoom.tLvl >= 0.5);
    const onScreen = p.x > 24 && p.x < 366 && p.y > 150 && p.y < 650;   // clear of the HUD and the magnifier bar
    if (zoomed && !onScreen) { await clickSel('#mag-out'); await sleep(1600); continue; }
    await page.mouse.click(p.x, p.y);
    if (!zoomed) { await sleep(1800); continue; }                         // that tap only zoomed in; the next one strikes
    // software GL is slow: wait until the hammer blow has actually landed before aiming the next one
    for (let w = 0; w < 40; w++) { await sleep(150); if (await page.evaluate(() => window.__HB.S.pending === 0)) break; }
    await sleep(1200);
    if (label && strikes++ === 0) await shot(label + '-hit1');
  }
  for (let i = 0; i < 160; i++) {
    const s = await st();
    if (s.mode === 'won' && (await page.$('#r-next'))) return 'won';
    if (s.mode === 'lost' && (await page.$('#r-retry'))) return 'lost';
    await sleep(250);
  }
  return 'timeout';
}

/** Play chapter `id` from the chapter list until the chapter-end panel shows. */
async function playChapter(id, label) {
  const info = { scenes: 0, levels: 0, retries: 0 };
  let lastKey = '';
  for (let step = 0; step < 60; step++) {
    const s = await st();
    if (s.mode === 'chapterEnd') return info;
    const key = s.mode + ':' + s.story + ':' + s.level;
    if (s.mode === 'scene') {
      if (key !== lastKey) { await sleep(900); if (id === 1 && info.scenes < 2) await shot(`${label}-scene-${info.scenes}`); }
      lastKey = key;
      await runScene(info.scenes === 0 && id === 2);          // chapter 2's first scene is skipped on purpose (SKIP path)
      info.scenes++;
    } else if (s.mode === 'intro' || s.mode === 'playing') {
      const r = await playLevel(id <= 5 ? `${label}-L${info.levels + 1}` : '');
      if (r === 'won') { info.levels++; await shot(`${label}-won-${info.levels}`); await clickSel('#r-next'); await sleep(500); }
      else if (r === 'lost') { info.retries++; if (info.retries <= 3) console.log('   lost:', JSON.stringify(await page.evaluate(() => ({ why: window.__HB.S.failReason, count: window.__HB.world.count, target: window.__HB.S.level.target, hitsLeft: window.__HB.S.hitsLeft, time: +window.__HB.S.time.toFixed(1), items: window.__HB.S.items.map((i) => i.info.id + ':' + i.br.attached) })))); await clickSel('#r-retry'); await sleep(600); }
      else { console.log('level timeout', JSON.stringify(await st())); fails++; return info; }
    } else await sleep(300);
  }
  return info;
}

await page.goto(URL_, { waitUntil: 'load' });
await sleep(2500);
ok((await text('#story-sub')).includes('Chapter 1'), 'menu button shows "' + (await text('#story-sub')) + '"');

const START = Number(process.env.START || 1);
if (START > 1) await page.evaluate((n) => { window.__HB.Save.data.story.unlocked = n; if (n >= 5) window.__HB.Save.grant('room_chinese'); }, START);   // jump in at a later chapter
for (let id = START; id <= LAST; id++) {
  await page.evaluate(() => window.__HB.ui.show('story'));
  await sleep(500);
  const label = '7' + id;
  const ch = await page.evaluate((i) => { const c = window.__HB.S; return i; }, id);
  const cards = await page.$$eval('.ch-card', (els) => els.map((e) => e.className));
  ok(!cards[id - 1].includes('locked'), `chapter ${id} is unlocked before playing it`);
  // press this chapter's own card button (the list also holds section headings, so index the cards)
  await page.evaluate((i) => document.querySelectorAll('.ch-card')[i - 1].querySelector('.card-btn').click(), id);
  await sleep(800);
  const s0 = await st();
  ok(s0.story && s0.story.startsWith(id + ':'), `chapter ${id} card starts chapter ${id}: ${JSON.stringify(s0)}`);
  const info = await playChapter(id, label);
  const s1 = await st();
  ok(s1.mode === 'chapterEnd', `chapter ${id} reached the end panel (scenes ${info.scenes}, levels ${info.levels}, retries ${info.retries})`);
  await sleep(500);
  await shot(`${label}-chapter-end`);
  const panel = (await text('.panel')).replace(/\s+/g, ' ').trim();
  console.log('   panel:', panel);
  const sv = await page.evaluate(() => JSON.parse(JSON.stringify(window.__HB.Save.data.story)));
  ok(sv.done[id] === true && sv.unlocked >= id + 1, `chapter ${id} saved as done, unlocked = ${sv.unlocked}`);
  if (id === 4) ok(panel.includes('Premium room next'), 'chapter 4 end points at the premium room instead of starting it');
  if (id === 1) ok(await page.evaluate(() => window.__HB.Save.data.unlocked === 1 && Object.keys(window.__HB.Save.data.stars).length === 0), 'main campaign progress untouched');
  await clickSel('#c-menu');
  await sleep(500);
}

// ---- back button inside a scene, replay, normal game
await page.evaluate(() => window.__HB.ui.show('story'));
await sleep(400);
const cards2 = await page.$$eval('.ch-card', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
ok(cards2[START - 1].includes('REPLAY'), 'finished chapter shows REPLAY');
await page.evaluate((i) => { document.querySelectorAll('.ch-card')[i - 1].querySelector('.card-btn').click(); }, START);
await sleep(1200);
await clickSel('#sc-home');
await sleep(600);
const sb = await st();
ok(sb.mode === 'menu' && sb.story === null, 'back button leaves a scene for the chapter list ' + JSON.stringify(sb));
ok(await page.evaluate(() => !document.getElementById('story').classList.contains('hidden')), 'chapter list is visible');
await page.click('#story-back');
await sleep(400);
await page.click('#btn-play');
await sleep(2000);
const sn = await st();
ok(sn.story === null && sn.level === 1, 'PLAY still starts campaign level 1 ' + JSON.stringify(sn));
console.log('final error text:', sn.err || '(none)');
console.log('--- console errors/warnings ---');
console.log(logs.length ? [...new Set(logs)].join('\n') : '(none)');
console.log(fails ? `\n${fails} FAILURE(S)` : '\nSTORY FLOW OK');
await browser.close();
process.exit(fails ? 1 : 0);
