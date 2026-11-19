// Scenario check in headless Chrome (pipe transport, file:// page, no server/port):
// chapter list with the premium section, the visual-novel backstory, the character rooms and the premium unlock flow.
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
const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent || '', sel);
const clickSel = async (sel) => { const b = await (await page.$(sel)).boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
const st = () => page.evaluate(() => { const H = window.__HB, S = H.S; return { mode: S.mode, story: S.story ? S.story.ch.id + ':' + S.story.i : null, scene: !!H.ui.scene, vn: !!(H.ui.scene && H.ui.scene.vn), err: document.getElementById('errlog')?.textContent || '' }; });
const tap = async () => { await clickSel('#sc-box'); await sleep(140); };
/** Show line n of the running scene (tapping through), return nothing. */
const advanceTo = async (n) => { for (let i = 0; i < n; i++) { await sleep(60); await tap(); await sleep(60); await tap(); } };
const lineNow = () => page.evaluate(() => window.__HB.ui.scene ? window.__HB.ui.scene.i : -1);
const waitLine = async (n) => { for (let i = 0; i < 60; i++) { if ((await lineNow()) >= n) return; await sleep(100); await tap(); } };
const waitTyped = async () => { for (let i = 0; i < 80; i++) { if (!(await page.evaluate(() => window.__HB.ui.scene?.typing))) return; await sleep(60); } };

await page.goto(URL_, { waitUntil: 'load' });
await sleep(2500);
await clickSel('#btn-story');
await sleep(600);
await shot('50-chapters-top');
const cards = await page.$$eval('.ch-card', (els) => els.map((e) => ({ t: e.textContent.replace(/\s+/g, ' ').trim().slice(0, 60), cls: e.className })));
ok(cards.length === 8, '8 chapter cards: ' + cards.length);
ok(cards[0].t.includes("Cheater Aman's Room"), 'chapter 1 = ' + cards[0].t);
ok(cards[1].cls.includes('locked'), 'chapter 2 starts locked');
ok(cards[4].cls.includes('premium'), 'chapter 5 is premium: ' + cards[4].t);
ok(cards.slice(5).every((c) => c.cls.includes('soon')), 'the later premium rooms are "coming soon"');
const sects = await page.$$eval('.ch-sect', (els) => els.map((e) => e.textContent));
ok(sects.length === 2, 'sections: ' + sects.join(' | '));
await page.evaluate(() => { document.getElementById('story-list').scrollTop = 9999; });
await sleep(300);
await shot('51-chapters-bottom');

// ---- chapter 1: the visual-novel backstory ----
await page.evaluate(() => { document.getElementById('story-list').scrollTop = 0; });
await sleep(300);
await clickSel('.ch-card .card-btn');
await sleep(1500);
let s = await st();
ok(s.mode === 'scene' && s.vn, 'chapter 1 opens with a visual-novel scene: ' + JSON.stringify(s));
ok(await page.evaluate(() => !document.getElementById('vn').classList.contains('hidden')), 'VN layer visible');
await waitTyped();
await sleep(500);
await shot('52-vn-narration');
await waitLine(1); await waitTyped(); await sleep(700);
await shot('53-vn-cafe-rashmika');
ok((await page.$$('.cut')).length === 2, 'two cut-outs on stage in the cafe');
await waitLine(4); await waitTyped(); await sleep(700);
await shot('54-vn-college-aman');
ok(await page.evaluate(() => document.querySelector('#vn-stage').dataset.n === '2' && !!document.querySelector('.cut[data-id="aman"]')), 'Aman is on stage in the college scene');
await waitLine(7); await waitTyped(); await sleep(700);
await shot('55-vn-night-shock');
ok(await page.evaluate(() => document.querySelector('#vn-stage').dataset.n === '3'), 'three characters on stage at night');
await waitLine(10); await waitTyped(); await sleep(700);
await shot('56-vn-cry');
// finish the VN scene
for (let i = 0; i < 6; i++) { s = await st(); if (!s.vn) break; await tap(); await sleep(150); }
await sleep(1200);
s = await st();
ok(s.mode === 'scene' && !s.vn, 'VN ended, now a room scene: ' + JSON.stringify(s));
ok(await page.evaluate(() => document.getElementById('vn').classList.contains('hidden')), 'VN layer hidden again');
ok(await page.evaluate(() => window.__HB.world.walls === true), 'Aman room is up (walls on)');
await waitTyped(); await sleep(1800);
await shot('57-room-scene-aman');
await waitLine(2); await waitTyped(); await sleep(400);
await shot('58-room-scene-aman-hero');
for (let i = 0; i < 6; i++) { s = await st(); if (!s.scene) break; await tap(); await sleep(150); }
await sleep(2500);
s = await st();
ok(s.mode === 'intro' || s.mode === 'playing', 'first story level started: ' + JSON.stringify(s));
await shot('59-level-aman-intro');
ok((await text('#h-label, .hud-top .ot b')).length > 0, 'HUD label: ' + (await text('#h-label, .hud-top .ot b')));

// ---- premium room: gate + unlock flow ----
await page.evaluate(() => window.__HB.ui.hideHud(), null);
await page.evaluate(() => { const H = window.__HB; H.ui.hideIntro(); H.ui.hideHud(); H.S.mode = 'menu'; H.ui.show('story'); });
await sleep(600);
await page.evaluate(() => { document.getElementById('story-list').scrollTop = 9999; });
await sleep(200);
const prem = await page.$('.ch-card.premium');
const pb = await prem.boundingBox();
await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
await sleep(700);
await shot('60-premium-sheet');
ok((await text('#p-buy')).includes('UNLOCK'), 'premium sheet: ' + (await text('#p-buy')));
await page.evaluate(() => { window.__before = window.__HB.Save.owns('room_chinese'); });
ok(await page.evaluate(() => window.__before === false), 'not owned before the unlock');
await clickSel('#p-no'); await sleep(300);
ok(await page.evaluate(() => window.__HB.S.mode === 'menu'), 'NOT NOW closes the sheet without starting the chapter');
await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2); await sleep(500);
await clickSel('#p-buy'); await sleep(900);
ok(await page.evaluate(() => window.__HB.Save.owns('room_chinese')), 'test unlock grants the room');
await shot('61-premium-unlocked');
ok((await page.$$('.ch-card.premium')).length === 0, 'the card is no longer marked premium');
await page.evaluate(() => { window.__HB.playChapter(5); });
await sleep(2500);
s = await st();
ok(s.mode === 'scene' && s.story === '5:0', 'chapter 5 plays after the unlock: ' + JSON.stringify(s));
await waitTyped(); await sleep(1800);
await shot('62-chinese-scene');
await waitLine(1); await waitTyped(); await sleep(500);
await shot('63-chinese-lin');

console.log('--- console errors/warnings ---');
console.log(logs.length ? [...new Set(logs)].join('\n') : '(none)');
console.log(fails ? `\n${fails} FAILURE(S)` : '\nVN + PREMIUM OK');
await browser.close();
process.exit(fails ? 1 : 0);
