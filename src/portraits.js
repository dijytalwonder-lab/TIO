// ---------------------------------------------------------------------------
// Cut-out characters and visual-novel backdrops, drawn as SVG strings (no image files).
//
//   portraitSVG(look, face)  standing cut-out (head, neck, shoulders) for visual-novel scenes
//   avatarSVG(look, face)    the same character cropped to the head (dialogue box badge)
//   backdropSVG(key)         painted backdrop for visual-novel scenes
//
// `look` describes one character, see CAST in story.js. All fields are optional:
//   skin, hair, eye, outfit, outfit2, brow   CSS hex colours ('#rrggbb')
//   hairStyle  short | spiky | buzz | long | bob | bun | ponytail | curly | bald
//   top        tee | shirt | hoodie | kurta | blouse | jacket | police
//   hat        cap | police
//   glasses, lashes, blush, stubble, beard, moustache, scar, earrings, shadow (colour), bulk (1 = normal)
//
// Real artwork can replace these: give a CAST entry `img: { neutral: 'url', sad: 'url' }`
// (a transparent PNG cut-out per face) and the game uses the picture instead.
// ---------------------------------------------------------------------------

const INK = '#3a2748';

function rgb(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function shade(c, k) {
  let [r, g, b] = rgb(c);
  if (k <= 1) { r *= k; g *= k; b *= k; } else { const t = k - 1; r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; }
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}
const st = (w = 3.5) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

/** Face presets. eyes: open | down | wide | narrow | half | arc | closed. tilt > 0 raises the inner end of the brows. */
export const FACES = {
  neutral: { eyes: 'open', tilt: 0, lift: 0, mouth: 'smile' },
  happy: { eyes: 'arc', tilt: 0, lift: -5, mouth: 'grin', blush: true },
  sad: { eyes: 'down', tilt: 11, lift: 0, mouth: 'frown' },
  cry: { eyes: 'closed', tilt: 12, lift: 0, mouth: 'wail', tears: true },
  angry: { eyes: 'narrow', tilt: -13, lift: 8, mouth: 'gritted' },
  shock: { eyes: 'wide', tilt: 6, lift: -12, mouth: 'o' },
  smirk: { eyes: 'half', tilt: -5, lift: 0, mouth: 'smirk' },
  worry: { eyes: 'open', tilt: 10, lift: -2, mouth: 'worry', sweat: true },
  determined: { eyes: 'narrow', tilt: -8, lift: 3, mouth: 'flat' }
};
export const FACE_NAMES = Object.keys(FACES);

const DEFAULT = { skin: '#f0c7a3', hair: '#2b2230', eye: '#3a2a2a', outfit: '#6c8cff', top: 'tee', hairStyle: 'short', bulk: 1 };

// ---- head parts ---------------------------------------------------------------
const EX = [122, 178], EY = 148;

function eyes(s, f) {
  let out = '';
  EX.forEach((x, k) => {
    const side = k ? 1 : -1;
    if (f.eyes === 'arc') out += `<path d="M${x - 13} ${EY + 4} Q${x} ${EY - 14} ${x + 13} ${EY + 4}" fill="none" ${st(5)}/>`;
    else if (f.eyes === 'closed') out += `<path d="M${x - 13} ${EY - 2} Q${x} ${EY + 11} ${x + 13} ${EY - 2}" fill="none" ${st(5)}/>`;
    else {
      const wide = f.eyes === 'wide', nar = f.eyes === 'narrow', half = f.eyes === 'half';
      const rx = wide ? 14 : 12, ry = wide ? 16 : nar ? 8.5 : half ? 11 : 13;
      const ir = wide ? 6 : nar ? 6 : 8, dy = f.eyes === 'down' ? 3.5 : half ? 2 : 0;
      out += `<ellipse cx="${x}" cy="${EY}" rx="${rx}" ry="${ry}" fill="#fff" ${st(3)}/>`;
      out += `<circle cx="${x}" cy="${EY + dy}" r="${Math.min(ir, ry - 1)}" fill="${s.eye}"/>`;
      out += `<circle cx="${x + 3}" cy="${EY - 3 + dy}" r="2.6" fill="#fff"/>`;
      if (half) out += `<path d="M${x - rx - 1} ${EY + 1} L${x + rx + 1} ${EY + 1} L${x + rx + 1} ${EY - ry - 4} L${x - rx - 1} ${EY - ry - 4} Z" fill="${s.skin}"/><path d="M${x - rx} ${EY + 1} L${x + rx} ${EY + 1}" ${st(4)}/>`;
    }
    if (s.shadow) out += `<ellipse cx="${x}" cy="${EY - 16}" rx="14" ry="6" fill="${s.shadow}" opacity="0.6"/>`;
    if (s.lashes) out += `<path d="M${x + side * 11} ${EY - 4} l${side * 8} -6 M${x + side * 12} ${EY + 2} l${side * 9} -2" fill="none" ${st(3.5)}/>`;
  });
  return out;
}

function brows(s, f) {
  const c = s.brow || shade(s.hair === 'none' ? '#3a2a2a' : s.hair, 0.7), y = 121 + (f.lift || 0), t = f.tilt || 0;
  const yi = y - t, yo = y + t * 0.35;
  return `<path d="M100 ${yo} Q121 ${(yo + yi) / 2 - 7} 142 ${yi}" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>`
    + `<path d="M200 ${yo} Q179 ${(yo + yi) / 2 - 7} 158 ${yi}" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>`;
}

function mouth(f) {
  switch (f.mouth) {
    case 'grin': return `<path d="M124 178 Q150 216 176 178 Z" fill="#7a1f3a" ${st(3.5)}/><path d="M131 181 Q150 189 169 181" fill="none" stroke="#fff" stroke-width="7"/>`;
    case 'frown': return `<path d="M132 195 Q150 180 168 195" fill="none" ${st(4)}/>`;
    case 'o': return `<ellipse cx="150" cy="190" rx="10" ry="13" fill="#7a1f3a" ${st(3.5)}/>`;
    case 'smirk': return `<path d="M134 189 Q152 193 171 177" fill="none" ${st(4.5)}/>`;
    case 'flat': return `<path d="M136 189 L164 189" fill="none" ${st(4.5)}/>`;
    case 'wail': return `<path d="M126 199 Q150 166 174 199 Q150 188 126 199 Z" fill="#7a1f3a" ${st(3.5)}/>`;
    case 'gritted': return `<rect x="128" y="178" width="44" height="19" rx="6" fill="#fff" ${st(3.5)}/><path d="M128 187.500 H172 M139 178 V197 M150 178 V197 M161 178 V197" stroke="${INK}" stroke-width="2"/>`;
    case 'worry': return `<path d="M132 192 Q141 185 150 191 Q159 197 168 190" fill="none" ${st(4)}/>`;
    default: return `<path d="M132 183 Q150 197 168 183" fill="none" ${st(4.5)}/>`;
  }
}

function face(s, f) {
  const sk = s.skin, sk2 = shade(sk, 0.86);
  let o = `<circle cx="88" cy="143" r="12" fill="${sk}" ${st(3)}/><circle cx="212" cy="143" r="12" fill="${sk}" ${st(3)}/>`;
  o += `<path d="M88 128 C86 78 120 52 150 52 C180 52 214 78 212 128 C212 176 184 214 150 214 C116 214 88 176 88 128 Z" fill="${sk}" ${st(4.5)}/>`;
  o += `<path d="M96 160 C104 196 128 210 150 210" fill="none" stroke="${sk2}" stroke-width="9" stroke-linecap="round" opacity="0.5"/>`;
  if (f.blush || s.blush) o += `<circle cx="102" cy="172" r="12" fill="#ff7fa0" opacity="0.42"/><circle cx="198" cy="172" r="12" fill="#ff7fa0" opacity="0.42"/>`;
  o += `<path d="M148 164 Q155 173 146 176" fill="none" stroke="${shade(sk, 0.66)}" stroke-width="3.5" stroke-linecap="round"/>`;
  o += eyes(s, f) + brows(s, f);
  if (s.beard) o += `<path d="M91 150 C96 204 128 216 150 216 C172 216 204 204 209 150 C196 178 176 186 150 184 C124 186 104 178 91 150 Z" fill="${s.beard === true ? shade(s.hair, 0.9) : s.beard}" ${st(3)}/>`;
  else if (s.stubble) o += `<path d="M92 152 C98 200 128 214 150 214 C172 214 202 200 208 152 C196 182 176 192 150 192 C124 192 104 182 92 152 Z" fill="${INK}" opacity="0.2"/>`;
  o += mouth(f);
  if (s.moustache) o += `<path d="M122 176 Q136 166 150 174 Q164 166 178 176 Q164 184 150 179 Q136 184 122 176 Z" fill="${shade(s.hair, 0.85)}" ${st(2.5)}/>`;
  if (f.tears) o += `<path d="M108 168 Q101 186 110 194 Q119 186 113 168 Z" fill="#7cc8ff" ${st(2.5)}/><path d="M192 168 Q199 186 190 194 Q181 186 187 168 Z" fill="#7cc8ff" ${st(2.5)}/>`;
  if (f.sweat) o += `<path d="M206 92 Q197 108 206 114 Q215 108 206 92 Z" fill="#a8dcff" ${st(2.5)}/>`;
  if (s.scar) o += `<path d="M178 132 L196 176" fill="none" stroke="#b04a4a" stroke-width="5" stroke-linecap="round"/><path d="M174 150 l12 -4 M180 164 l12 -4" stroke="#b04a4a" stroke-width="3"/>`;
  if (s.glasses) {
    const gc = typeof s.glasses === 'string' ? s.glasses : INK;
    o += `<rect x="98" y="130" width="46" height="36" rx="14" fill="#cfeaff" fill-opacity="0.28" stroke="${gc}" stroke-width="4.5"/><rect x="156" y="130" width="46" height="36" rx="14" fill="#cfeaff" fill-opacity="0.28" stroke="${gc}" stroke-width="4.5"/><path d="M144 144 Q150 140 156 144" fill="none" stroke="${gc}" stroke-width="4"/>`;
  }
  if (s.earrings) o += `<circle cx="86" cy="162" r="6" fill="#ffc93c" ${st(2.5)}/><circle cx="214" cy="162" r="6" fill="#ffc93c" ${st(2.5)}/>`;
  return o;
}

// ---- hair ---------------------------------------------------------------------
function hairBack(s) {
  const c = s.hair, o = `fill="${c}" ${st(4)}`;
  switch (s.hairStyle) {
    case 'long': return `<path d="M80 124 C64 36 236 36 220 124 L240 332 C200 350 100 350 60 332 Z" ${o}/>`;
    case 'bob': return `<path d="M78 122 C66 38 234 38 222 122 L228 232 C200 246 100 246 72 232 Z" ${o}/>`;
    case 'ponytail': return `<path d="M200 74 C256 78 276 150 252 232 C242 196 232 160 214 122 Z" ${o}/>`;
    case 'curly': {
      let t = '';
      for (let i = 0; i < 11; i++) { const a = Math.PI * (1.02 + i * 0.096); t += `<circle cx="${150 + Math.cos(a) * 80}" cy="${128 + Math.sin(a) * 84}" r="${27 + (i % 3) * 3}" ${o}/>`; }
      for (const sx of [-1, 1]) for (let j = 0; j < 3; j++) t += `<circle cx="${150 + sx * (86 + (j % 2) * 8)}" cy="${150 + j * 34}" r="${24 - j * 2}" ${o}/>`;
      return t;
    }
    default: return '';
  }
}

function hairFront(s) {
  const c = s.hair, hi = shade(c, 1.45), o = `fill="${c}" ${st(4)}`;
  const shine = (d) => `<path d="${d}" fill="none" stroke="${hi}" stroke-width="6" stroke-linecap="round" opacity="0.45"/>`;
  switch (s.hairStyle) {
    case 'bald': return '';
    case 'buzz': return `<path d="M88 124 C84 72 120 52 150 52 C182 52 216 72 212 124 C206 98 190 86 150 86 C112 86 94 98 88 124 Z" fill="${shade(c, 1.1)}" ${st(3.5)}/>`;
    case 'spiky': return `<path d="M86 132 C76 82 98 58 122 52 L124 22 L144 48 L158 16 L172 48 L198 28 L194 62 C214 80 216 108 214 132 C206 112 196 100 180 96 C152 110 120 104 100 110 C92 114 88 122 86 132 Z" ${o}/>` + shine('M118 62 C134 56 156 56 172 62');
    case 'long': case 'bob': case 'ponytail': {
      let t = `<path d="M84 132 C76 62 120 38 152 40 C198 42 224 78 216 132 C208 102 188 82 154 88 C122 92 98 104 84 132 Z" ${o}/>`;
      t += `<path d="M154 88 C134 94 110 112 100 150 C96 120 110 96 154 88 Z" fill="${shade(c, 0.9)}" opacity="0.5"/>` + shine('M112 56 C134 46 168 46 190 58');
      if (s.hairStyle === 'long') t += `<path d="M90 140 C68 214 62 290 78 344 C98 334 110 304 114 252 C116 210 106 172 90 140 Z" ${o}/><path d="M210 140 C232 214 238 290 222 344 C202 334 190 304 186 252 C184 210 194 172 210 140 Z" ${o}/>`;
      return t;
    }
    case 'bun': return `<circle cx="150" cy="36" r="29" ${o}/><circle cx="150" cy="36" r="13" fill="${shade(c, 1.2)}" opacity="0.5"/><path d="M84 132 C76 66 118 42 152 44 C198 46 224 80 216 132 C208 104 188 86 154 92 C122 96 98 108 84 132 Z" ${o}/>` + shine('M114 58 C136 50 166 50 188 60');
    case 'curly': {
      let t = '';
      for (let i = 0; i < 6; i++) t += `<circle cx="${104 + i * 18.4}" cy="${88 + (i % 2) * 6 - Math.abs(i - 2.5) * 3}" r="${21 + (i % 2) * 3}" ${o}/>`;
      return t + shine('M118 56 C138 48 162 48 182 58');
    }
    default: return `<path d="M86 132 C80 68 118 42 152 44 C196 46 220 80 214 132 C208 112 198 98 180 92 C152 108 118 102 100 108 C92 114 88 122 86 132 Z" ${o}/>` + shine('M116 60 C136 52 164 52 184 62');
  }
}

function hat(s) {
  if (s.hat === 'cap') {
    const c = s.capColor || s.outfit2 || '#e2562f';
    return `<path d="M82 108 C82 50 218 50 218 108 Z" fill="${c}" ${st(4)}/><path d="M150 52 L150 108" stroke="${shade(c, 0.8)}" stroke-width="3"/><circle cx="150" cy="54" r="5" fill="${shade(c, 0.8)}"/>`
      + `<path d="M70 110 C110 130 190 130 230 110 C222 98 200 104 150 106 C110 104 84 98 70 110 Z" fill="${shade(c, 0.85)}" ${st(4)}/>`;
  }
  if (s.hat === 'police') {
    return `<path d="M86 104 C86 52 214 52 214 104 Z" fill="#2c3550" ${st(4)}/><rect x="84" y="90" width="132" height="16" rx="4" fill="#1d2338" ${st(3.5)}/>`
      + `<path d="M94 108 C120 128 180 128 206 108 Z" fill="#161a2b" ${st(3.5)}/>`
      + `<circle cx="150" cy="76" r="11" fill="#f2c14b" ${st(3)}/><path d="M150 69 l3 6 l6 1 l-5 4 l1 6 l-5 -3 l-5 3 l1 -6 l-5 -4 l6 -1 Z" fill="#c9962a"/>`;
  }
  return '';
}

// ---- body ---------------------------------------------------------------------
function body(s) {
  const c = s.outfit, c2 = s.outfit2 || shade(c, 1.4), d = shade(c, 0.8), sk2 = shade(s.skin, 0.88);
  let pre = '', det = '';
  switch (s.top) {
    case 'shirt':
      det = `<path d="M126 248 L150 294 L110 274 Z" fill="#fff" ${st(3.5)}/><path d="M174 248 L150 294 L190 274 Z" fill="#fff" ${st(3.5)}/>`
        + `<path d="M143 290 L157 290 L164 346 L150 372 L136 346 Z" fill="${c2}" ${st(3.5)}/><path d="M150 296 L150 440" stroke="${d}" stroke-width="3" opacity="0.5"/>`;
      break;
    case 'hoodie':
      pre = `<path d="M82 276 C74 214 226 214 218 276 Z" fill="${d}" ${st(4)}/>`;
      det = `<path d="M122 248 Q150 284 178 248 Z" fill="${sk2}" ${st(3.5)}/><path d="M136 266 L132 322 M164 266 L168 322" stroke="${c2}" stroke-width="4" stroke-linecap="round"/><circle cx="132" cy="326" r="5" fill="${c2}"/><circle cx="168" cy="326" r="5" fill="${c2}"/>`
        + `<path d="M92 412 L208 412 L222 440 L78 440 Z" fill="${d}" ${st(3.5)}/>`;
      break;
    case 'kurta':
      det = `<path d="M124 246 L124 266 Q150 282 176 266 L176 246 Z" fill="${c2}" ${st(3.5)}/><path d="M150 274 L150 440" stroke="${c2}" stroke-width="6"/>`
        + [296, 330, 364, 398].map((y) => `<circle cx="150" cy="${y}" r="5" fill="#ffc93c" ${st(2)}/>`).join('')
        + `<path d="M30 410 Q150 380 270 410" fill="none" stroke="${c2}" stroke-width="5" opacity="0.6"/>`;
      break;
    case 'blouse':
      det = `<path d="M124 248 L150 310 L176 248 Z" fill="${sk2}" ${st(3.5)}/><path d="M124 248 L150 310 L176 248" fill="none" stroke="${c2}" stroke-width="8" stroke-linejoin="round"/>`
        + `<path d="M138 296 Q150 322 162 296" fill="none" stroke="#ffc93c" stroke-width="3" stroke-dasharray="3 5" stroke-linecap="round"/>`;
      break;
    case 'jacket':
      det = `<path d="M118 248 L150 344 L182 248 Z" fill="${c2}" ${st(3.5)}/><path d="M118 248 L94 304 L150 392 L150 344 Z" fill="${d}" ${st(3.5)}/><path d="M182 248 L206 304 L150 392 L150 344 Z" fill="${d}" ${st(3.5)}/>`
        + `<path d="M150 392 L150 440" stroke="${INK}" stroke-width="3.5"/><path d="M128 248 Q150 272 172 248 Z" fill="${sk2}" ${st(3)}/>`;
      break;
    case 'police':
      det = `<path d="M126 248 L150 292 L108 272 Z" fill="${d}" ${st(3.5)}/><path d="M174 248 L150 292 L192 272 Z" fill="${d}" ${st(3.5)}/>`
        + `<path d="M144 288 L156 288 L162 340 L150 358 L138 340 Z" fill="#1d2338" ${st(3)}/>`
        + `<path d="M48 308 L106 282 L114 302 L56 330 Z" fill="#2b2f4a" ${st(3)}/><path d="M64 312 l30 -13 M68 322 l30 -13" stroke="#f2c14b" stroke-width="4"/>`
        + `<path d="M252 308 L194 282 L186 302 L244 330 Z" fill="#2b2f4a" ${st(3)}/><path d="M236 312 l-30 -13 M232 322 l-30 -13" stroke="#f2c14b" stroke-width="4"/>`
        + `<path d="M196 350 h22 v22 l-11 8 l-11 -8 Z" fill="#f2c14b" ${st(3)}/><rect x="84" y="352" width="46" height="24" rx="4" fill="${d}" ${st(3)}/><path d="M150 292 L150 440" stroke="${d}" stroke-width="3" opacity="0.5"/>`;
      break;
    default:
      det = `<path d="M123 248 Q150 284 177 248 Z" fill="${sk2}" ${st(3.5)}/><circle cx="150" cy="362" r="22" fill="${c2}" opacity="0.9"/><path d="M44 340 Q62 372 56 412 M256 340 Q238 372 244 412" fill="none" stroke="${d}" stroke-width="4"/>`;
  }
  const shape = `<path d="M16 440 L24 338 C32 284 84 262 126 248 L174 248 C216 262 268 284 276 338 L284 440 Z" fill="${c}" ${st(4.5)}/>`;
  const b = s.bulk || 1;
  return `<path d="M126 190 L126 256 Q150 276 174 256 L174 190 Z" fill="${sk2}" ${st(3.5)}/>`
    + `<g transform="translate(150 440) scale(${b} 1) translate(-150 -440)">${pre}${shape}${det}</g>`;
}

function build(look, faceName) {
  const s = { ...DEFAULT, ...(look || {}) };
  const f = FACES[faceName] || FACES.neutral;
  return hairBack(s) + body(s) + face(s, f) + (s.hat ? '' : hairFront(s)) + (s.hat ? hairFront({ ...s, hairStyle: s.hairStyle === 'long' || s.hairStyle === 'bob' ? s.hairStyle : 'buzz' }) : '') + hat(s);
}

/** Standing cut-out for visual-novel scenes. */
export function portraitSVG(look, faceName = 'neutral') {
  return `<svg class="cut-svg" viewBox="0 0 300 440" xmlns="http://www.w3.org/2000/svg" overflow="visible">${build(look, faceName)}</svg>`;
}

/** Head-and-shoulders crop for the dialogue badge. */
export function avatarSVG(look, faceName = 'neutral') {
  return `<svg class="av-svg" viewBox="52 22 196 196" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${build(look, faceName)}</svg>`;
}

// ---- visual-novel backdrops ---------------------------------------------------
const rect = (x, y, w, h, f, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${extra}/>`;
const circ = (x, y, r, f, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${extra}/>`;
const grad = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

const BACKDROPS = {
  // sunny cafe with a big window
  cafe() {
    let s = `<defs>${grad('cf-w', '#ffe2c4', '#f6b088')}${grad('cf-s', '#9fdcff', '#fff0c9')}${grad('cf-f', '#c58a5c', '#9a6440')}</defs>`;
    s += rect(0, 0, 400, 800, 'url(#cf-w)');
    s += rect(34, 110, 332, 330, 'url(#cf-s)') + circ(300, 190, 38, '#fff6c2', 'opacity="0.9"');
    s += `<path d="M34 440 V330 h40 v-60 h46 v90 h40 v-120 h56 v150 h50 v-70 h56 V440 Z" fill="#8db8d8"/>` + circ(110, 380, 26, '#6bbd7a') + rect(106, 380, 8, 60, '#7a5a3c') + circ(318, 392, 30, '#5fae72') + rect(314, 392, 8, 50, '#7a5a3c');
    s += `<rect x="34" y="110" width="332" height="330" fill="none" stroke="#8a5a3c" stroke-width="14"/><path d="M200 110 V440 M34 275 H366" stroke="#8a5a3c" stroke-width="10"/>`;
    s += rect(0, 470, 400, 330, 'url(#cf-f)');
    for (let i = 0; i < 9; i++) s += `<path d="M${i * 50 - 30} 470 L${i * 70 - 120} 800" stroke="#7d4f31" stroke-width="3" opacity="0.5"/>`;
    s += rect(0, 440, 400, 54, '#8a5a3c') + rect(0, 434, 400, 14, '#b88256');
    s += rect(40, 400, 60, 38, '#ece6dc') + rect(48, 388, 44, 14, '#cfc6b8') + rect(250, 408, 18, 30, '#fff') + rect(278, 408, 18, 30, '#ffd9a0') + rect(306, 404, 18, 34, '#fff');
    for (const x of [90, 200, 310]) s += `<path d="M${x} 0 V70" stroke="#6b4a3a" stroke-width="3"/><path d="M${x - 30} 100 C${x - 30} 66 ${x + 30} 66 ${x + 30} 100 Z" fill="#ff9f5a"/>` + circ(x, 104, 34, '#ffd27a', 'opacity="0.35"');
    s += circ(60, 700, 70, '#8a5a3c') + rect(54, 700, 12, 100, '#6b4a3a') + circ(350, 690, 66, '#8a5a3c') + rect(344, 690, 12, 110, '#6b4a3a');
    return s;
  },
  // college courtyard in daylight
  college() {
    let s = `<defs>${grad('co-s', '#7fd0ff', '#e8f7ff')}</defs>`;
    s += rect(0, 0, 400, 800, 'url(#co-s)') + circ(330, 110, 44, '#fff3b0');
    for (const [x, y, w] of [[50, 120, 90], [200, 180, 110], [300, 70, 70]]) s += `<ellipse cx="${x}" cy="${y}" rx="${w / 2}" ry="${w / 5}" fill="#fff" opacity="0.9"/>`;
    s += `<path d="M-10 250 L200 190 L410 250 Z" fill="#a14a3f"/>` + rect(-10, 250, 420, 330, '#e0a083');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) s += rect(18 + c * 66, 276 + r * 90, 38, 54, '#fff6c8', 'stroke="#8a5a4a" stroke-width="5"');
    s += rect(150, 440, 100, 140, '#7a4a3a') + `<path d="M150 440 Q200 392 250 440 Z" fill="#5d372b"/>` + rect(196, 470, 8, 110, '#e8c8a0');
    s += rect(0, 570, 400, 230, '#7ed67a') + `<path d="M150 580 L250 580 L330 800 L70 800 Z" fill="#d9d2c4"/>`;
    for (const [x, y, r] of [[40, 520, 54], [370, 510, 58], [92, 560, 40]]) s += rect(x - 8, y, 16, 80, '#7a5a3c') + circ(x, y - 10, r, '#4fb06a') + circ(x - 18, y - 24, r * 0.55, '#69c880', 'opacity="0.7"');
    s += rect(120, 380, 160, 34, '#ff7aa8', 'rx="8"') + circ(138, 397, 5, '#fff') + circ(162, 397, 5, '#fff') + circ(186, 397, 5, '#fff');
    return s;
  },
  // quiet street at night, a lamp post and a big moon
  night() {
    let s = `<defs>${grad('ni-s', '#1b1a48', '#5b3a86')}<radialGradient id="ni-l"><stop offset="0" stop-color="#ffe9a0" stop-opacity="0.8"/><stop offset="1" stop-color="#ffe9a0" stop-opacity="0"/></radialGradient></defs>`;
    s += rect(0, 0, 400, 800, 'url(#ni-s)') + circ(300, 150, 60, '#fff3c4') + circ(282, 134, 10, '#eadba0') + circ(322, 170, 7, '#eadba0') + circ(310, 126, 5, '#eadba0');
    for (let i = 0; i < 40; i++) s += circ((i * 97) % 400, (i * 53) % 330, 1 + (i % 3) * 0.7, '#fff', `opacity="${0.4 + (i % 4) * 0.15}"`);
    s += `<path d="M0 520 V300 h60 v-60 h70 v90 h50 v-130 h80 v110 h60 v-70 h80 V520 Z" fill="#15133a"/>`;
    for (let i = 0; i < 26; i++) s += rect(12 + (i % 8) * 48, 270 + Math.floor(i / 8) * 70 + (i % 3) * 6, 18, 26, i % 4 === 0 ? '#ffd774' : '#2a2863');
    s += rect(0, 520, 400, 280, '#2b2a55') + rect(0, 520, 400, 40, '#3d3b72') + `<path d="M180 800 L220 560 L240 560 L330 800 Z" fill="#1f1e44" opacity="0.7"/>`;
    s += circ(110, 330, 150, 'url(#ni-l)') + rect(104, 300, 12, 270, '#0f0e2a') + `<path d="M84 304 Q110 270 136 304 Z" fill="#0f0e2a"/>` + circ(110, 308, 12, '#ffe9a0');
    s += `<ellipse cx="260" cy="690" rx="90" ry="14" fill="#8f86d8" opacity="0.25"/>`;
    return s;
  },
  // classroom with a blackboard and rows of desks
  classroom() {
    let s = `<defs>${grad('cl-w', '#fdf1d6', '#f1d6a6')}${grad('cl-f', '#c99a68', '#9c6f46')}</defs>`;
    s += rect(0, 0, 400, 800, 'url(#cl-w)');
    s += rect(30, 130, 340, 200, '#2f6b55') + '<rect x="30" y="130" width="340" height="200" fill="none" stroke="#8a5a3c" stroke-width="12"/>' + rect(30, 322, 340, 14, '#8a5a3c');
    s += '<path d="M62 176 H200 M62 212 H262 M62 248 H170 M230 262 H320" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.85"/>';
    s += '<path d="M310 170 l8 18 l20 2 l-15 13 l5 19 l-18 -10 l-18 10 l5 -19 l-15 -13 l20 -2 Z" fill="#ffe066" opacity="0.9"/>';
    s += circ(330, 70, 34, '#fff') + '<circle cx="330" cy="70" r="34" fill="none" stroke="#8a5a3c" stroke-width="7"/><path d="M330 70 V48 M330 70 L346 80" stroke="#3a2748" stroke-width="4" stroke-linecap="round"/>';
    s += rect(56, 360, 72, 92, '#ffd27a', 'stroke="#c98a2e" stroke-width="5"') + circ(92, 400, 18, '#ff7aa8') + rect(70, 428, 44, 8, '#fff');
    s += rect(0, 520, 400, 280, 'url(#cl-f)');
    for (let i = 0; i < 9; i++) s += `<path d="M${i * 50 - 40} 520 L${i * 80 - 150} 800" stroke="#8c6240" stroke-width="3" opacity="0.5"/>`;
    s += rect(0, 470, 150, 22, '#8a5a3c') + rect(8, 492, 10, 60, '#6b4a3a') + rect(124, 492, 10, 60, '#6b4a3a') + rect(20, 446, 50, 24, '#ff7a6b') + rect(30, 430, 40, 16, '#7cc4ff');
    for (const x of [-30, 135, 300]) s += rect(x, 620, 160, 26, '#d9a56a', 'stroke="#a8743c" stroke-width="3"') + rect(x + 12, 646, 136, 70, '#b98456') + rect(x + 28, 560, 90, 50, '#c28b55') + rect(x + 36, 716, 10, 60, '#6b4a3a') + rect(x + 114, 716, 10, 60, '#6b4a3a');
    return s;
  },
  // police station: evidence board, filing cabinets, a desk and a blinds window
  station() {
    let s = `<defs>${grad('st-w', '#d3e3f2', '#a7c0da')}${grad('st-b', '#fff6c8', '#ffd878')}</defs>`;
    s += rect(0, 0, 400, 800, 'url(#st-w)');
    s += rect(236, 96, 128, 170, '#dff3ff', 'stroke="#7a8ca4" stroke-width="8"');
    for (let i = 0; i < 8; i++) s += rect(236, 104 + i * 20, 128, 9, '#b9cde2');
    s += rect(24, 110, 190, 140, '#b98a58', 'stroke="#5a3d28" stroke-width="9"');
    for (const [x, y] of [[44, 128], [98, 142], [150, 126], [60, 190], [128, 188], [172, 190]]) s += rect(x, y, 36, 46, '#f4efe4', 'stroke="#7d8796" stroke-width="2"') + rect(x + 6, y + 6, 24, 24, '#8b95a4');
    s += '<path d="M62 150 L116 164 L168 146 L78 212 L146 210 L190 212" stroke="#d32f2f" stroke-width="3" fill="none" opacity="0.9"/>';
    s += '<path d="M200 28 l44 14 v34 c0 26 -18 40 -44 50 c-26 -10 -44 -24 -44 -50 v-34 Z" fill="#2c3550" stroke="#f2c14b" stroke-width="5"/><path d="M200 50 l7 14 l15 2 l-11 10 l3 15 l-14 -8 l-14 8 l3 -15 l-11 -10 l15 -2 Z" fill="#f2c14b"/>';
    s += rect(300, 330, 84, 200, '#8b97a6', 'stroke="#5a6676" stroke-width="5"');
    for (let i = 0; i < 4; i++) s += rect(308, 342 + i * 48, 68, 38, '#a5b0be') + rect(334, 356 + i * 48, 16, 6, '#445');
    s += rect(0, 540, 400, 260, '#7b5a45');
    for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) s += rect(i * 55 - 8, 640 + j * 40, 53, 38, (i + j) % 2 ? '#5d6a7a' : '#6b7889');
    s += rect(0, 520, 400, 36, '#6b4a3a') + rect(0, 556, 400, 90, '#54392c') + rect(40, 490, 62, 30, '#fff', 'stroke="#cfc6b8" stroke-width="3"') + rect(260, 500, 40, 20, '#ff6b6b');
    s += '<path d="M200 0 V50" stroke="#445" stroke-width="3"/>' + circ(200, 4, 4, '#445');
    return s;
  },
  // the Jade Dragon Teahouse: red walls, a gold moon window, lanterns, shelves of porcelain
  teahouse() {
    let s = `<defs>${grad('th-w', '#d84538', '#9c2a22')}${grad('th-f', '#7a4a33', '#4f2e20')}</defs>`;
    s += rect(0, 0, 400, 800, 'url(#th-w)');
    s += rect(0, 0, 400, 26, '#f2c14b');
    for (let i = 0; i < 14; i++) s += rect(8 + i * 28, 7, 14, 12, '#8a2420');
    s += circ(200, 210, 112, '#f2c14b') + circ(200, 210, 98, '#ffe3a0');
    s += '<path d="M200 112 V308 M102 210 H298 M130 140 L270 280 M270 140 L130 280" stroke="#f2c14b" stroke-width="7"/>';
    for (const x of [48, 352]) s += `<path d="M${x} 26 V92" stroke="#f2c14b" stroke-width="3"/>` + `<ellipse cx="${x}" cy="130" rx="34" ry="40" fill="#ff3b30"/>` + rect(x - 14, 86, 28, 12, '#f2c14b') + rect(x - 14, 166, 28, 12, '#f2c14b') + `<path d="M${x} 178 V220" stroke="#f2c14b" stroke-width="4"/>` + circ(x, 226, 7, '#f2c14b');
    s += rect(0, 470, 400, 16, '#6b1a17') + rect(0, 380, 400, 12, '#6b1a17');
    for (let i = 0; i < 9; i++) {
      const x = 22 + i * 44;
      s += `<ellipse cx="${x}" cy="462" rx="17" ry="9" fill="${i % 3 === 0 ? '#3d6fc9' : '#f6f2ea'}"/>`;
      s += `<ellipse cx="${x + 10}" cy="372" rx="15" ry="${i % 2 ? 14 : 10}" fill="${i % 3 === 1 ? '#3d6fc9' : '#f6f2ea'}"/>`;
    }
    s += rect(0, 560, 400, 240, 'url(#th-f)');
    for (let i = 0; i < 9; i++) s += `<path d="M${i * 50 - 30} 560 L${i * 80 - 140} 800" stroke="#3b2216" stroke-width="3" opacity="0.5"/>`;
    s += rect(24, 660, 170, 26, '#8a2420', 'stroke="#f2c14b" stroke-width="4"') + rect(40, 686, 12, 60, '#6b1a17') + rect(166, 686, 12, 60, '#6b1a17') + circ(94, 646, 22, '#f6f2ea') + rect(112, 640, 30, 8, '#f6f2ea');
    return s;
  }
};

export const BACKDROP_KEYS = Object.keys(BACKDROPS);

export function backdropSVG(key) {
  const fn = BACKDROPS[key] || BACKDROPS.college;
  return `<svg class="bd-svg" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${fn()}</svg>`;
}
