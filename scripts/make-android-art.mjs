// Draws the Android app icon + splash screens (SVG -> PNG through headless Chrome over a pipe, no network port)
// and writes them into android/app/src/main/res. Re-run after changing the art:  node scripts/make-android-art.mjs
// NOTE: puppeteer-core is not a project dependency; point PUP at any node_modules that has it.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const PUP = process.env.PUP || 'C:/Users/divya/AppData/Local/Temp/claude/c1e3b284195b7b06/119f0bcd-5887-418d-9487-d6e07d1696fe/scratchpad/tools/node/node_modules/';
const puppeteer = createRequire(PUP)('puppeteer-core');
const RES = path.resolve('android/app/src/main/res');
const INK = '#3a2748';

/** The picture: a cracked pink teapot bursting into shards under a golden hammer (432 x 432 design space). */
const ART = `
  <g stroke="${INK}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round">
    <path d="M296 238 C334 232 346 206 352 186" fill="none" stroke="${INK}" stroke-width="38"/>
    <path d="M296 238 C334 232 346 206 352 186" fill="none" stroke="#ff8fb8" stroke-width="22"/>
    <path d="M140 214 C98 212 92 290 142 288" fill="none" stroke="${INK}" stroke-width="34"/>
    <path d="M140 214 C98 212 92 290 142 288" fill="none" stroke="#ff8fb8" stroke-width="18"/>
    <ellipse cx="216" cy="254" rx="92" ry="74" fill="#ff8fb8"/>
    <ellipse cx="216" cy="190" rx="44" ry="16" fill="#ffb8d6"/>
    <circle cx="216" cy="170" r="13" fill="#ffc93c"/>
    <path d="M168 232 C176 214 196 208 214 210" fill="none" stroke="#fff" stroke-width="9" opacity="0.7"/>
  </g>
  <path d="M214 192 L202 222 L230 240 L206 272 L226 306" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M214 192 L202 222 L230 240 L206 272 L226 306" fill="none" stroke="#fff6c8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  <g stroke="${INK}" stroke-width="6" stroke-linejoin="round">
    <path d="M300 150 l30 -14 l-6 34 Z" fill="#ffc93c"/>
    <path d="M96 160 l34 -6 l-14 30 Z" fill="#ff8fb8"/>
    <path d="M326 292 l34 6 l-26 22 Z" fill="#ff8fb8"/>
    <path d="M92 312 l30 -10 l4 32 Z" fill="#ffc93c"/>
    <path d="M250 108 l20 -8 l-2 24 Z" fill="#ffb8d6"/>
  </g>
  <g transform="rotate(-38 150 112)" stroke="${INK}" stroke-width="8" stroke-linejoin="round">
    <rect x="138" y="70" width="26" height="190" rx="12" fill="#d99a4e"/>
    <rect x="88" y="40" width="124" height="70" rx="20" fill="#ffc93c"/>
    <rect x="96" y="52" width="20" height="46" rx="8" fill="#fff0a8" stroke="none"/>
    <rect x="174" y="40" width="22" height="70" rx="6" fill="#e0a21c" stroke="none"/>
  </g>
  <g fill="#fff" stroke="${INK}" stroke-width="5" stroke-linejoin="round">
    <path d="M196 206 l8 -26 l8 26 l26 8 l-26 8 l-8 26 l-8 -26 l-26 -8 Z" fill="#fff6a8"/>
  </g>
  <g fill="#fff" opacity="0.95">
    <circle cx="86" cy="250" r="7"/><circle cx="352" cy="110" r="6"/><circle cx="380" cy="248" r="5"/><circle cx="140" cy="360" r="5"/>
  </g>`;

const BG = '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd86b"/><stop offset="0.5" stop-color="#ff8fb8"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>';
const page$ = (inner, w, h) => `<!doctype html><html><body style="margin:0;background:transparent">${inner}</body></html>`.replace('{W}', w).replace('{H}', h);
const svgDoc = (w, h, body, vb = '0 0 432 432') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}">${body}</svg>`;

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', pipe: true, args: ['--no-first-run'] });
const page = await browser.newPage();
async function render(html, w, h, file, transparent = true) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.setContent(html);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
}

const dens = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };
for (const [d, [legacy, fg]] of Object.entries(dens)) {
  const dir = path.join(RES, `mipmap-${d}`);
  // adaptive foreground: the art inside the 66% safe zone of a 108dp canvas
  await render(page$(svgDoc(fg, fg, `<g transform="translate(216 216) scale(0.62) translate(-216 -216)">${ART}</g>`), fg, fg), fg, fg, path.join(dir, 'ic_launcher_foreground.png'));
  // legacy square + round launcher icons: gradient tile with the art filled in
  const tile = (round) => svgDoc(legacy, legacy, `${BG}<clipPath id="c">${round ? '<circle cx="216" cy="216" r="216"/>' : '<rect width="432" height="432" rx="96"/>'}</clipPath><g clip-path="url(#c)"><rect width="432" height="432" fill="url(#bg)"/><g transform="translate(216 224) scale(0.9) translate(-216 -216)">${ART}</g></g>`);
  await render(page$(tile(false), legacy, legacy), legacy, legacy, path.join(dir, 'ic_launcher.png'));
  await render(page$(tile(true), legacy, legacy), legacy, legacy, path.join(dir, 'ic_launcher_round.png'));
}
// adaptive background colour
fs.writeFileSync(path.join(RES, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#8B5CF6</color>\n</resources>\n');

// splash screens (every size the Capacitor template ships)
const pngSize = (f) => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const splashFiles = fs.readdirSync(RES).filter((d) => d.startsWith('drawable')).map((d) => path.join(RES, d, 'splash.png')).filter((f) => fs.existsSync(f));
for (const f of splashFiles) {
  const [w, h] = pngSize(f);
  const s = Math.min(w, h) * 0.5;
  const body = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfeaff"/><stop offset="0.6" stop-color="#dff4ff"/><stop offset="1" stop-color="#fff4d6"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#sky)"/>
    <svg x="${(w - s) / 2}" y="${h / 2 - s * 0.72}" width="${s}" height="${s}" viewBox="0 0 432 432">${ART}</svg>
    <text x="${w / 2}" y="${h / 2 + s * 0.52}" text-anchor="middle" font-family="'Arial Rounded MT Bold','Trebuchet MS','Segoe UI',sans-serif" font-weight="900" font-size="${s * 0.2}" fill="#8b5cf6" stroke="#fff" stroke-width="${s * 0.03}" paint-order="stroke" letter-spacing="${s * 0.01}">TAKE IT OUT</text>
    <text x="${w / 2}" y="${h / 2 + s * 0.52 + s * 0.12}" text-anchor="middle" font-family="'Trebuchet MS','Segoe UI',sans-serif" font-weight="700" font-size="${s * 0.065}" fill="#3b356b" letter-spacing="${s * 0.01}">PASSIVE-AGGRESSIVE SMASHING</text>`;
  await render(page$(svgDoc(w, h, body, `0 0 ${w} ${h}`), w, h), w, h, f, false);
}
await browser.close();
console.log('icons + splash written:', splashFiles.length, 'splash files');
