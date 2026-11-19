// Headless check of Take It Out (play.html). Chrome is driven over a pipe (no network port).
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire('C:/Users/divya/AppData/Local/Temp/claude/c1e3b284195b7b06/119f0bcd-5887-418d-9487-d6e07d1696fe/scratchpad/tools/node/node_modules/');
const puppeteer = require('puppeteer-core');

const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const URL_ = 'file:///C:/Users/divya/OneDrive/Documents/HappyBreaking-play/play.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const steps = process.argv.slice(2);

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  pipe: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--no-first-run', '--window-size=390,844']
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
page.on('requestfailed', (r) => logs.push('[requestfailed] ' + r.url()));

const shot = async (name) => { const p = path.join(OUT, name + '.png'); await page.screenshot({ path: p }); console.log('shot', p); };
const state = () => page.evaluate(() => {
  const H = window.__HB; if (!H) return { stage: window.__stage, err: document.getElementById('errlog')?.textContent };
  const S = H.S;
  return { stage: window.__stage, mode: S.mode, count: H.world.count, pieces: H.world.pieces.length, hitsLeft: S.hitsLeft, time: +S.time.toFixed(1), attached: S.br && S.br.attached, landed: S.landed, err: document.getElementById('errlog')?.textContent };
});

await page.goto(URL_, { waitUntil: 'load' });
await sleep(3500);
console.log('boot', JSON.stringify(await state()));
await shot('01-menu');

if (steps.includes('play')) {
  await page.evaluate(() => window.__HB.startLevel(1));
  await sleep(900);
  await shot('02-intro');
  await sleep(1800);
  console.log('after intro', JSON.stringify(await state()));
  // aim at the hidden crit zone centre of the object
  const pt = await page.evaluate(() => {
    const H = window.__HB, S = H.S;
    S.br.group.updateMatrixWorld(true);
    const z = S.asm.zones[0].at.clone();
    z.applyMatrix4(S.br.group.matrixWorld).project(H.camera);
    return { x: (z.x * 0.5 + 0.5) * innerWidth, y: (-z.y * 0.5 + 0.5) * innerHeight };
  });
  console.log('crit point', pt);
  await page.mouse.click(pt.x, pt.y);
  await sleep(140);
  await shot('03-impact');
  await sleep(500);
  await shot('04-scatter');
  await sleep(2200);
  await shot('05-settled');
  console.log('after hit', JSON.stringify(await state()));
}
console.log('--- console / errors ---');
console.log(logs.length ? logs.join('\n') : '(none)');
await browser.close();
