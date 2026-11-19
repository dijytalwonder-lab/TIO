// Renders Take It Out's procedural sounds offline (OfflineAudioContext in headless Chrome, pipe transport),
// reports peak/RMS/clipping and writes WAV files so they can be auditioned.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire('C:/Users/divya/AppData/Local/Temp/claude/c1e3b284195b7b06/119f0bcd-5887-418d-9487-d6e07d1696fe/scratchpad/tools/node/node_modules/');
const puppeteer = require('puppeteer-core');
const URL_ = 'file:///C:/Users/divya/OneDrive/Documents/HappyBreaking-play/play.html';
const OUT = 'C:/Users/divya/OneDrive/Documents/HappyBreaking-play/sounds';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', pipe: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run']
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
await page.goto(URL_, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 2500));

const samples = [
  ['01-hammer-weak-crackle', 1.6],
  ['02-ceramic-crit-shatter', 4.2],
  ['03-glass-crit-shatter', 4.6],
  ['04-wood-smash', 3.4],
  ['05-stone-smash', 3.4],
  ['06-gold-clang', 3.6],
  ['07-settling-tinkles', 4.0],
  ['08-counter-pops', 1.8],
  ['09-level-complete', 2.6]
];

for (const [name, dur] of samples) {
  const res = await page.evaluate(async (name, dur) => {
    const sr = 44100;
    const oc = new OfflineAudioContext(2, Math.floor(sr * dur), sr);
    const fx = new window.__HB.AudioFX();
    fx._init(oc);
    const rain = (mat, n, t0, t1, speed = 7) => { for (let i = 0; i < n; i++) fx.bounce(mat, speed * (0.5 + Math.random() * 0.8), 0.06 + Math.random() * 0.35, (Math.random() - 0.5) * 1.6, t0 + (t1 - t0) * Math.pow(Math.random(), 0.8)); };
    switch (name) {
      case '01-hammer-weak-crackle': fx.hammer(0.7); fx.crackle('ceramic', 0.7); break;
      case '02-ceramic-crit-shatter': fx.whoosh(); fx.hammer(3.2); fx.shatter('ceramic', 45, true); rain('ceramic', 40, 0.45, 2.8); break;
      case '03-glass-crit-shatter': fx.whoosh(); fx.hammer(3.2); fx.shatter('glass', 70, true); rain('glass', 55, 0.45, 3.2); break;
      case '04-wood-smash': fx.whoosh(); fx.hammer(2.4); fx.shatter('wood', 28, false); rain('wood', 22, 0.4, 2.0); break;
      case '05-stone-smash': fx.whoosh(); fx.hammer(2.4); fx.shatter('stone', 30, false); rain('stone', 22, 0.4, 2.0); break;
      case '06-gold-clang': fx.whoosh(); fx.hammer(3.0); fx.shatter('metal', 8, true); rain('metal', 14, 0.4, 2.4); break;
      case '07-settling-tinkles': rain('ceramic', 16, 0, 3.4, 4); rain('glass', 22, 0, 3.4, 4); break;
      case '08-counter-pops': for (let i = 0; i < 15; i++) { oc.__t = i; } break;
      case '09-level-complete': fx.win(); fx.sparkle(); break;
      default: break;
    }
    if (name === '08-counter-pops') {
      // countPop has no 'when': schedule by rendering sequentially on the timeline via a suspend trick
      for (let i = 0; i < 15; i++) { const t = i * 0.075; oc.suspend(Math.max(0.001, t)).then(() => { fx.countPop(i); oc.resume(); }); }
    }
    const buf = await oc.startRendering();
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    let peak = 0, sum = 0, nan = 0, lastLoud = 0;
    for (let i = 0; i < L.length; i++) {
      const a = Math.abs(L[i]), b = Math.abs(R[i]);
      if (!Number.isFinite(a + b)) { nan++; continue; }
      peak = Math.max(peak, a, b); sum += L[i] * L[i] + R[i] * R[i];
      if (a > 0.003 || b > 0.003) lastLoud = i;
    }
    // 16-bit stereo wav
    const n = L.length, ab = new ArrayBuffer(44 + n * 4), dv = new DataView(ab);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) {
      dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
      dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
    }
    let bin = ''; const u8 = new Uint8Array(ab);
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { peak, rmsDb: 20 * Math.log10(Math.sqrt(sum / (2 * n)) + 1e-9), nan, tail: lastLoud / sr, b64: btoa(bin) };
  }, name, dur);
  fs.writeFileSync(path.join(OUT, name + '.wav'), Buffer.from(res.b64, 'base64'));
  console.log(name.padEnd(26), `peak ${res.peak.toFixed(3)}  rms ${res.rmsDb.toFixed(1)} dBFS  audible-until ${res.tail.toFixed(2)}s  nan ${res.nan}  ${res.peak >= 0.999 ? 'CLIPS' : 'ok'}`);
}
console.log('--- console errors ---');
console.log(logs.length ? [...new Set(logs)].join('\n') : '(none)');
await browser.close();
