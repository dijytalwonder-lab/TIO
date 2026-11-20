// FULL TEST AS AN ANDROID PHONE, in headless Chrome over a pipe (file:// page, no server, no network port).
// The game is a web build, so "Android" here means Android Chrome conditions: a Pixel-class touch screen
// (CDP touch events only, never the mouse), Android user agent, real device pixel ratio, the autoplay rule
// (audio may only start after a tap), tab hide/show, a screen rotation and a cold reload.
//   node android-full.mjs [pixel7|small] [--quick]
// Writes android-<profile>.txt + screenshots to HB_SHOTS (default: the script folder).
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire('C:/Users/divya/AppData/Local/Temp/claude/c1e3b284195b7b06/119f0bcd-5887-418d-9487-d6e07d1696fe/scratchpad/tools/node/node_modules/');
const puppeteer = require('puppeteer-core');
const OUT = process.env.HB_SHOTS || path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\//, ''));
const URL_ = 'file:///C:/Users/divya/OneDrive/Documents/HappyBreaking-play/play.html';
const PROFILES = {
  pixel7: { width: 412, height: 915, dpr: 2.625, ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' },
  small: { width: 360, height: 640, dpr: 2, ua: 'Mozilla/5.0 (Linux; Android 10; SM-A105F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' }
};
const PN = process.argv.find((a) => PROFILES[a]) || 'pixel7';
const P = PROFILES[PN];
const QUICK = process.argv.includes('--quick');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const lines = [];
let fails = 0;
const log = (m) => { console.log(m); lines.push(m); };
const ok = (c, m) => { log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const note = (m) => log('note ' + m);
const findings = [];

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', pipe: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-first-run']   // NOTE: no autoplay flag - audio must unlock from a tap
});
const page = await browser.newPage();
await page.setUserAgent(P.ua);
const portrait = { width: P.width, height: P.height, deviceScaleFactor: P.dpr, isMobile: true, hasTouch: true };
await page.setViewport(portrait);
const cdp = await page.createCDPSession();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));

// ---------------------------------------------------------------- touch + helpers
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y })) });
const tap = async (x, y) => { await touch('touchStart', [[x, y]]); await sleep(60); await touch('touchEnd', []); };
const swipe = async (x1, y1, x2, y2, steps = 10) => {
  await touch('touchStart', [[x1, y1]]);
  for (let i = 1; i <= steps; i++) { await sleep(25); await touch('touchMove', [[x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps]]); }
  await touch('touchEnd', []);
};
const box = async (sel) => { const h = await page.$(sel); return h ? h.boundingBox() : null; };
/** Tap a button until it goes away (a panel that is still animating in can swallow the first touch on slow software GL). */
const tapGone = async (sel) => {
  for (let i = 0; i < 4; i++) {
    if (!(await page.$(sel))) return true;
    await sleep(700);
    try { await tapSel(sel); } catch { return true; }
    await sleep(1500);
  }
  return !(await page.$(sel));
};
const tapSel = async (sel) => { const b = await box(sel); if (!b) throw new Error('nothing to tap: ' + sel); await tap(b.x + b.width / 2, b.y + b.height / 2); };
const shot = (n) => page.screenshot({ path: path.join(OUT, `and-${PN}-${n}.png`) });
const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent || '', sel);
const st = () => page.evaluate(() => {
  const H = window.__HB, S = H.S;
  return { mode: S.mode, story: S.story ? S.story.ch.id + ':' + S.story.i : null, scene: !!H.ui.scene, vn: !!(H.ui.scene && H.ui.scene.vn), hitsLeft: S.hitsLeft, used: S.hitsUsed, count: H.world.count, zoom: +H.camera.zoom.toFixed(2), tl: S.zoom ? S.zoom.tLvl : 0, err: document.getElementById('errlog')?.textContent || '' };
});
const waitMode = async (modes, ms = 120000) => { const t0 = Date.now(); const want = [].concat(modes); while (Date.now() - t0 < ms) { if (want.includes((await st()).mode)) return true; await sleep(200); } return false; };

/** Everything tappable must be on screen, not sideways-scrolling, and a sane finger size. */
const layout = async (label, mustSee = []) => {
  const out = await page.evaluate((mustSee) => {
    const res = [], vw = innerWidth, vh = innerHeight;
    document.querySelectorAll('button, .btn, .icon-btn, .ch-card, .pc, #mag-track').forEach((e) => {
      if (e.closest('.hidden')) return;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const name = (e.id ? '#' + e.id : '.' + String(e.className).split(' ')[0]) + ' "' + (e.textContent || '').trim().slice(0, 14) + '"';
      if (r.left < -1 || r.right > vw + 1) res.push(`${name} sticks out sideways (${Math.round(r.left)}..${Math.round(r.right)} of ${vw})`);
      if (Math.min(r.width, r.height) < 34) res.push(`${name} is a small touch target (${Math.round(r.width)}x${Math.round(r.height)} css px)`);
    });
    if (document.documentElement.scrollWidth > vw + 1) res.push('page scrolls sideways');
    for (const sel of mustSee) {
      const e = document.querySelector(sel);
      if (!e) { res.push(sel + ' is missing'); continue; }
      const r = e.getBoundingClientRect();
      if (r.bottom > vh + 1 || r.top < -1) res.push(`${sel} is off screen (${Math.round(r.top)}..${Math.round(r.bottom)} of ${vh})`);
    }
    return res;
  }, mustSee);
  out.forEach((m) => findings.push(`${label}: ${m}`));
  ok(out.length === 0, `layout ${label}${out.length ? ': ' + out.join(' | ') : ''}`);
};

const perf = () => page.evaluate(() => {
  const H = window.__HB, r = H.renderer.info;
  return { calls: r.render.calls, tris: r.render.triangles, geos: r.memory.geometries, tex: r.memory.textures, pieces: H.world.pieces.length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1 };
});

async function fresh(clear = true) {
  await page.goto(URL_, { waitUntil: 'load' });
  if (clear) { await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } }); await page.reload({ waitUntil: 'load' }); }
  await sleep(2500);
}

// ---------------------------------------------------------------- level bots (touch only)
const aimPoint = () => page.evaluate(() => {
  const H = window.__HB, S = H.S;
  const left = (S.items || []).filter((i) => i.br.attached > 0).sort((a, b) => b.br.attached - a.br.attached);
  const it = left[0] || { br: S.br, asm: S.asm };
  it.br.group.updateMatrixWorld(true);
  const zone = it.asm.zones[0].at;
  const alive = it.asm.cells.filter((c) => c.state === 0);
  const cell = alive.length ? alive.reduce((p, q) => (p.center.distanceTo(zone) < q.center.distanceTo(zone) ? p : q)) : null;
  const z = (cell ? cell.center : zone).clone().applyMatrix4(it.br.group.matrixWorld).project(H.camera);
  return { x: (z.x * 0.5 + 0.5) * innerWidth, y: (-z.y * 0.5 + 0.5) * innerHeight, room: !!S.items, zoomed: S.zoom && S.zoom.tLvl >= 0.5, vw: innerWidth, vh: innerHeight };
});

/** Play the running level with taps until it is won or lost. Returns 'won' | 'lost' | 'timeout'. */
async function playLevel(tag) {
  if (!(await waitMode(['playing', 'won', 'lost'], 180000))) return 'timeout';
  let strikes = 0;
  for (let step = 0; step < 36; step++) {
    const s = await st();
    if (s.mode !== 'playing') break;
    const p = await aimPoint();
    const onScreen = p.x > 24 && p.x < p.vw - 24 && p.y > 150 && p.y < p.vh * 0.7;
    if (DEBUG) note(`bot step ${step}: ${JSON.stringify({ x: Math.round(p.x), y: Math.round(p.y), zoomed: p.zoomed, onScreen, mode: s.mode, hitsLeft: s.hitsLeft, zoom: s.zoom, t: Date.now() % 100000 })}`);
    if (p.room && p.zoomed && !onScreen) { await tapSel('#mag-out'); await sleep(1700); continue; }
    await tap(p.x, p.y);
    if (p.room && !p.zoomed) { await sleep(1900); continue; }              // that tap zoomed in; the next one strikes
    for (let w = 0; w < 50; w++) { await sleep(150); if (await page.evaluate(() => window.__HB.S.pending === 0)) break; }
    await sleep(1100);
    if (tag && strikes++ === 0) await shot(tag + '-hit');
  }
  for (let i = 0; i < 600; i++) {          // software GL is slow: the result panel can take a while
    const s = await st();
    if (s.mode === 'won' && (await page.$('#r-next'))) return 'won';
    if (s.mode === 'lost' && (await page.$('#r-retry'))) {
      note('level lost: ' + JSON.stringify(await page.evaluate(() => ({ why: window.__HB.S.failReason, count: window.__HB.world.count, target: window.__HB.S.level.target, hitsLeft: window.__HB.S.hitsLeft, time: +window.__HB.S.time.toFixed(1), items: (window.__HB.S.items || []).map((i) => i.info.id + ':' + i.br.attached) }))));
      return 'lost';
    }
    await sleep(250);
  }
  note('level timeout: ' + JSON.stringify(await st()));
  return 'timeout';
}

/** Tap through a dialogue / visual-novel scene to its end. */
async function runScene(tag) {
  let taps = 0;
  for (let i = 0; i < 80; i++) {
    const s = await st();
    if (!s.scene) break;
    if (tag && taps === 2) await shot(tag);
    await sleep(120);
    await tapSel('#sc-box'); taps++;
    await sleep(120);
  }
  return taps;
}

async function playChapter(id, tag) {
  const info = { scenes: 0, levels: 0, retries: 0 };
  for (let step = 0; step < 70; step++) {
    const s = await st();
    if (s.mode === 'chapterEnd') return info;
    if (s.mode === 'scene') { await runScene(info.scenes === 0 ? `${tag}-scene${s.vn ? '-vn' : ''}` : ''); info.scenes++; }
    else if (s.mode === 'intro' || s.mode === 'playing') {
      const r = await playLevel(info.levels === 0 ? tag + '-L1' : '');
      if (r === 'won') { info.levels++; await tapGone('#r-next'); await sleep(500); }
      else if (r === 'lost') { info.retries++; await tapGone('#r-retry'); await sleep(600); }
      else return info;
    } else await sleep(300);
  }
  return info;
}

const ONLY = process.env.ONLY;                    // e.g. ONLY=6 runs just phase 6 (after a fresh start)
const DEBUG = !!process.env.DEBUG_BOT;
let startedFresh = false;
async function phase(name, fn) {
  if (ONLY && !name.startsWith(ONLY)) return;
  if (ONLY && !startedFresh) { startedFresh = true; await fresh(); }
  log(`\n=== ${name}`);
  const t0 = Date.now();
  try { await fn(); } catch (e) { ok(false, `${name} crashed: ${e.message.split('\n')[0]}`); }
  log(`    (${Math.round((Date.now() - t0) / 1000)} s)`);
}

log(`Android full test · profile ${PN} ${P.width}x${P.height} @${P.dpr}x · ${QUICK ? 'quick' : 'full'}`);

// ================================================================ 1. boot + menu
await phase('1. boot, first tap, menu layout', async () => {
  await fresh();
  const ua = await page.evaluate(() => ({ ua: navigator.userAgent, touch: navigator.maxTouchPoints, dpr: devicePixelRatio, w: innerWidth, h: innerHeight, fine: matchMedia('(pointer: coarse)').matches }));
  ok(/Android/.test(ua.ua) && ua.touch > 0 && ua.fine, `Android Chrome emulation active: ${ua.w}x${ua.h} @${ua.dpr}x, coarse pointer, ${ua.touch} touch points`);
  ok(!(await st()).err, 'no on-screen error box after boot');
  const cv = await page.evaluate(() => { const c = document.getElementById('gl'); return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight }; });
  ok(cv.cw === P.width && cv.ch === P.height, `canvas fills the screen (${cv.cw}x${cv.ch}, backing ${cv.w}x${cv.h})`);
  note(`backing store ${cv.w}x${cv.h} px (${(cv.w * cv.h / 1e6).toFixed(1)} MP)`);
  const viewportMeta = await page.evaluate(() => document.querySelector('meta[name=viewport]')?.content || '');
  ok(/user-scalable=no/.test(viewportMeta) && /viewport-fit=cover/.test(viewportMeta), 'viewport meta blocks pinch/double-tap zoom and covers the notch');
  ok(await page.evaluate(() => getComputedStyle(document.body).touchAction === 'none'), 'body has touch-action: none (no browser scrolling or pull-to-refresh)');
  const before = await page.evaluate(() => (window.__HB.audio.ctx ? window.__HB.audio.ctx.state : 'none'));
  await layout('menu', ['#btn-play', '#btn-story', '#btn-levels', '#btn-hammers', '#btn-asmr', '#btn-daily']);
  await shot('menu');
  await tapSel('#btn-settings');
  await sleep(500);
  const after = await page.evaluate(() => (window.__HB.audio.ctx ? window.__HB.audio.ctx.state : 'none'));
  ok(after === 'running', `audio unlocks after the first tap (before: ${before}, after: ${after})`);
  await shot('settings');
  await layout('settings');
  const sw = await page.evaluate(() => [...document.querySelectorAll('#overlay .tog, #overlay [data-k], #overlay button')].map((b) => b.textContent.trim().slice(0, 12)));
  note('settings buttons: ' + sw.join(' | '));
  await page.evaluate(() => { const b = [...document.querySelectorAll('#overlay button')].pop(); b && b.click(); });
  await sleep(300);
});

// ================================================================ 2. menu screens by touch
await phase('2. levels, hammers, daily gift by touch', async () => {
  await tapSel('#btn-levels'); await sleep(700);
  await layout('levels');
  await shot('levels');
  const top0 = await page.evaluate(() => document.getElementById('lv-list')?.scrollTop ?? document.querySelector('#levels .scroll')?.scrollTop ?? -1);
  await swipe(P.width / 2, P.height * 0.75, P.width / 2, P.height * 0.25);
  await sleep(600);
  const top1 = await page.evaluate(() => document.querySelector('#levels .scroll')?.scrollTop ?? -1);
  ok(top1 > top0, `level list scrolls with a finger swipe (${top0} -> ${top1})`);
  await tapSel('#lv-back'); await sleep(400);
  await tapSel('#btn-hammers'); await sleep(700);
  await layout('hammers');
  await shot('hammers');
  await tapSel('#shop-back'); await sleep(400);
  const coins0 = await page.evaluate(() => window.__HB.Save.data.coins);
  await tapSel('#btn-daily'); await sleep(900);
  const coins1 = await page.evaluate(() => window.__HB.Save.data.coins);
  ok(coins1 > coins0, `daily gift pays out (${coins0} -> ${coins1})`);
});

// ================================================================ 3. campaign level by touch
await phase('3. campaign level 1 by touch', async () => {
  await tapSel('#btn-play');
  ok(await waitMode(['intro', 'playing'], 60000), 'PLAY starts level 1');
  await sleep(800);
  await layout('hud', ['#btn-pause', '#h-hits']);
  await shot('level1');
  const r = await playLevel('level1');
  ok(r === 'won', `level 1 won with taps (${r})`);
  await shot('level1-result');
  await layout('result', ['#r-next']);
  const p1 = await perf();
  note(`level 1 end: ${p1.calls} draw calls, ${p1.tris} triangles, ${p1.pieces} live fragments, heap ${p1.heap} MB`);
  await tapGone('#r-next');
  ok(await waitMode(['intro', 'playing'], 60000), 'NEXT starts level 2');
  await sleep(1000);
  await tapSel('#btn-pause'); await sleep(600);
  ok((await st()).mode === 'paused', 'pause button pauses');
  await shot('pause');
  await layout('pause');
  await page.evaluate(() => document.querySelector('#overlay #p-resume, #overlay .btn-play')?.click());
  await sleep(600);
  ok((await st()).mode !== 'paused', 'resume works');
  await page.evaluate(() => window.__HB.ui.closeOverlay && 0);
});

// ================================================================ 4. ASMR
await phase('4. ASMR mode by touch', async () => {
  await page.evaluate(() => { const H = window.__HB; H.ui.closeOverlay(); H.ui.hideHud(); H.ui.hideIntro(); H.S.mode = 'menu'; H.ui.show('menu'); });
  await sleep(600);
  await tapSel('#btn-asmr');
  ok(await waitMode(['zen'], 60000), 'ASMR opens');
  await sleep(2500);
  await layout('asmr', ['#zen-next']);
  await shot('asmr');
  for (let k = 0; k < 4 && (await st()).count < 4; k++) {            // an ASMR tap may be a weak edge hit: allow a few
    const p = await aimPoint();
    await tap(p.x, p.y);
    await sleep(3500);
  }
  ok((await st()).count > 3, `taps smash the object (${(await st()).count} fragments)`);
  await tapSel('#zen-next'); await sleep(2500);
  await tapSel('#zen-again'); await sleep(2500);
  await shot('asmr2');
  await tapSel('#zen-home'); await sleep(800);
  ok((await st()).mode === 'menu', 'home returns to the menu');
});

// ================================================================ 5. story chapter 1 (VN + room levels + zoom bar)
await phase('5. story chapter 1: visual novel, room levels, zoom bar, by touch', async () => {
  await tapSel('#btn-story'); await sleep(700);
  await layout('story list');
  await shot('story-list');
  await page.evaluate(() => { document.querySelector('#story-list').scrollTop = 0; });
  await tapSel('.ch-card .card-btn');
  ok(await waitMode(['scene'], 60000), 'chapter 1 opens');
  const s0 = await st();
  ok(s0.vn, 'it opens with the visual-novel backstory');
  await sleep(2500);
  await layout('vn', ['#sc-box']);
  await shot('vn');
  const taps = await runScene('vn-late');
  ok(taps >= 8, `backstory + room scene tapped through (${taps} taps)`);
  ok(await waitMode(['intro', 'playing'], 90000), 'first room level starts');
  await sleep(1500);
  await layout('room level', ['#mag-track', '#h-hits']);
  const mag = await box('#mag');
  const room = await box('#hud');
  ok(!!mag && mag.y > P.height * 0.6, `magnifier bar sits under the room (y ${Math.round(mag ? mag.y : -1)} of ${P.height})`);
  await shot('room-overview');
  if (!(await waitMode(['playing'], 90000))) throw new Error('level never reached playing');
  const p = await aimPoint();
  await tap(p.x, p.y);                                                       // zoom in by touching the room
  await sleep(2600);
  let s = await st();
  ok(s.zoom > 2.2 && s.used === 0, `touching the room zooms in without using a hit (zoom ${s.zoom}, hits used ${s.used})`);
  await shot('room-zoomed');
  await tapSel('.pc:nth-child(1)'); await sleep(2200);                        // chip = zoom onto that thing
  const p2 = await aimPoint();
  await tap(p2.x, p2.y);
  for (let w = 0; w < 50; w++) { await sleep(150); if (await page.evaluate(() => window.__HB.S.pending === 0)) break; }
  await sleep(1500);
  s = await st();
  ok(s.used >= 1, `a zoomed tap strikes (hits used ${s.used}, ${s.count} fragments)`);
  await shot('room-smash');
  const peak = await perf();
  note(`room level: ${peak.calls} draw calls, ${peak.tris} triangles, ${peak.pieces} live fragments, heap ${peak.heap} MB`);
  // drag the bar knob with a finger to the middle, then out
  const tb = await box('#mag-track');
  await swipe(tb.x + 2, tb.y + tb.height / 2, tb.x + tb.width / 2, tb.y + tb.height / 2, 8);
  await sleep(1400);
  s = await st();
  ok(s.zoom > 1.4 && s.zoom < 1.9, `dragging the bar knob with a finger gives a partial zoom (${s.zoom})`);
  await tapSel('#mag-out');
  for (let i = 0; i < 40 && (await st()).zoom >= 1.05; i++) await sleep(250);          // the camera glide takes a few frames on software GL
  ok((await st()).zoom < 1.05, 'the minus button returns to the whole room');
  if (QUICK) return;
  const r = await playLevel('');
  ok(r === 'won', `chapter 1 level 1 won (${r})`);
  await tapGone('#r-next');
  const info = await playChapter(1, 'ch1');
  ok((await st()).mode === 'chapterEnd', `chapter 1 reaches the end (scenes ${info.scenes}, levels ${info.levels}, retries ${info.retries})`);
  await shot('chapter-end');
  await layout('chapter end', ['#c-menu']);
  const save = await page.evaluate(() => window.__HB.Save.data.story);
  ok(save.done[1] && save.unlocked === 2, 'chapter 1 saved as done, chapter 2 unlocked');
  await tapSel('#c-menu'); await sleep(700);
});

// ================================================================ 6. the other chapters (one level each) + premium
await phase('6. chapters 2-4 first level, premium sheet, premium room', async () => {
  if (QUICK) return;
  for (const id of [2, 3, 4]) {
    await page.evaluate(() => { const H = window.__HB; H.ui.closeOverlay(); H.ui.hideHud(); H.ui.hideScene(); H.ui.show('story'); });
    await sleep(600);
    await page.evaluate((i) => { window.__HB.Save.data.story.unlocked = Math.max(window.__HB.Save.data.story.unlocked, i); window.__HB.ui.show('story'); }, id);
    await sleep(500);
    await page.evaluate((i) => document.querySelectorAll('.ch-card')[i - 1].querySelector('.card-btn').scrollIntoView(), id);
    const b = await page.evaluate((i) => { const r = document.querySelectorAll('.ch-card')[i - 1].querySelector('.card-btn').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, id);
    await tap(b.x, b.y);
    ok(await waitMode(['scene'], 60000), `chapter ${id} opens`);
    const s0 = await st();
    ok(s0.vn, `chapter ${id} starts with the visual-novel backstory`);
    await sleep(2200);
    await shot(`ch${id}-vn`);
    // skip the story and play only the first room level
    for (let i = 0; i < 12; i++) { if (!(await st()).scene) break; await tapSel('#sc-skip'); await sleep(300); }
    const r = await playLevel(`ch${id}`);
    ok(r === 'won', `chapter ${id} first level won (${r})`);
    await page.evaluate(() => { const H = window.__HB; H.ui.closeOverlay(); H.ui.hideHud(); H.S.mode = 'menu'; H.S.story = null; });
  }
  // premium
  await page.evaluate(() => { const H = window.__HB; H.ui.closeOverlay(); H.ui.show('story'); });
  await sleep(600);
  await page.evaluate(() => { document.querySelector('#story-list').scrollTop = 9999; });
  await sleep(300);
  const pb = await page.evaluate(() => { const r = document.querySelector('.ch-card.premium').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await tap(pb.x, pb.y); await sleep(800);
  await layout('premium sheet', ['#p-buy', '#p-no']);
  await shot('premium');
  await tapSel('#p-buy'); await sleep(1200);
  ok(await page.evaluate(() => window.__HB.Save.owns('room_chinese')), 'premium room unlocks from the sheet');
  // jump straight to the porcelain cabinet level (the heaviest scene)
  await page.evaluate(() => { const H = window.__HB; H.ui.closeOverlay(); H.Save.storySet(5, 6); H.playChapter(5); });
  ok(await waitMode(['intro', 'playing'], 90000), 'premium cabinet level starts');
  await sleep(1500);
  await shot('cabinet-start');
  const c0 = await perf();
  note(`cabinet level start: ${c0.calls} draw calls, ${c0.tris} triangles, ${c0.geos} geometries`);
  await waitMode(['playing'], 90000);
  const q = await aimPoint();
  await tap(q.x, q.y); await sleep(2500);
  const q2 = await aimPoint();
  await tap(q2.x, q2.y);
  for (let w = 0; w < 60; w++) { await sleep(150); if (await page.evaluate(() => window.__HB.S.pending === 0)) break; }
  await sleep(1500);
  const c1 = await perf();
  note(`cabinet mid-smash: ${c1.calls} draw calls, ${c1.tris} triangles, ${c1.pieces} live fragments (cap 230), heap ${c1.heap} MB`);
  await shot('cabinet-smash');
  ok(c1.pieces <= 230, 'live fragments stay under the 230 cap');
});

// ================================================================ 7. phone life cycle
await phase('7. hide/show tab, rotation, cold reload', async () => {
  await page.evaluate(() => { const H = window.__HB; H.ui.closeOverlay(); H.ui.hideHud(); H.ui.hideScene(); H.S.mode = 'menu'; H.S.story = null; H.ui.show('menu'); });
  await sleep(500);
  await tapSel('#btn-play');
  await waitMode(['intro', 'playing'], 60000);
  await waitMode(['playing'], 60000);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(600);
  ok((await st()).mode === 'paused', 'sending the app to the background pauses the level');
  const music = await page.evaluate(() => { const a = window.__HB.audio; return a.ctx ? a.ctx.state : 'none'; });
  note('audio context while hidden: ' + music);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(500);
  await shot('resumed');
  // rotate to landscape and back
  await page.setViewport({ width: P.height, height: P.width, deviceScaleFactor: P.dpr, isMobile: true, hasTouch: true, isLandscape: true });
  await sleep(1500);
  const land = await page.evaluate(() => { const c = document.getElementById('gl'); return { w: c.clientWidth, h: c.clientHeight, iw: innerWidth, ih: innerHeight }; });
  ok(land.w === land.iw && land.h === land.ih, `rotating to landscape resizes the canvas (${land.w}x${land.h})`);
  await shot('landscape');
  await layout('landscape hud', ['#btn-pause']);
  await page.setViewport(portrait);
  await sleep(1500);
  const back = await page.evaluate(() => { const c = document.getElementById('gl'); return { w: c.clientWidth, h: c.clientHeight, iw: innerWidth, ih: innerHeight }; });
  ok(back.w === back.iw && back.h === back.ih, `and back to portrait (${back.w}x${back.h})`);
  // cold reload keeps progress
  const before = await page.evaluate(() => { const d = window.__HB.Save.data; return { coins: d.coins, unlocked: d.unlocked, done: JSON.stringify(d.story.done), owned: JSON.stringify(d.story.owned) }; });
  await page.reload({ waitUntil: 'load' });
  await sleep(3000);
  const after = await page.evaluate(() => { const d = window.__HB.Save.data; return { coins: d.coins, unlocked: d.unlocked, done: JSON.stringify(d.story.done), owned: JSON.stringify(d.story.owned) }; });
  ok(JSON.stringify(before) === JSON.stringify(after), `progress survives a cold reload (${after.coins} coins, level ${after.unlocked}, chapters ${after.done}, rooms ${after.owned})`);
  ok(!(await st()).err, 'no on-screen error box after the reload');
});

// ================================================================ 8. memory
await phase('8. memory and GPU resources after the whole session', async () => {
  const m = await perf();
  note(`final: heap ${m.heap} MB, ${m.geos} geometries, ${m.tex} textures, ${m.calls} draw calls`);
  ok(m.heap < 300, `JS heap stays reasonable (${m.heap} MB)`);
  ok(m.tex < 40, `texture count stays small (${m.tex})`);
});

log('\n--- console errors/warnings ---');
log(logs.length ? [...new Set(logs)].join('\n') : '(none)');
ok(logs.length === 0, 'no console errors or warnings during the whole session');
if (findings.length) { log('\n--- layout findings ---'); [...new Set(findings)].forEach((f) => log(' * ' + f)); }
log(fails ? `\n${fails} FAILURE(S)` : '\nANDROID FULL TEST OK');
fs.writeFileSync(path.join(OUT, `android-${PN}.txt`), lines.join('\n'));
await browser.close();
process.exit(fails ? 1 : 0);
