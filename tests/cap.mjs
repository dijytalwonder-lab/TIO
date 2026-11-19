// capacity table: fragments after ALL allowed hits (no early stop) per skill level; prints percentiles
import { LEVELS } from '../src/levels.js';
import * as sim from './simlib.mjs';
const N = 16;
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
console.log('lvl obj'.padEnd(18), 'tgt hits |  expert p25/med | decent p25/med/p75 | sloppy p25/med/p75 | random p25/med/p75');
LEVELS.forEach((lv) => {
  const r = {};
  for (const s of ['crit', 'near', 'sloppy', 'rand']) {
    r[s] = [];
    for (let seed = 1; seed <= N; seed++) r[s].push(sim.play(lv.obj, lv.variant, s, lv.hits, 0, seed).count);
  }
  console.log(`${String(lv.id).padStart(2)} ${lv.obj}`.padEnd(18), String(lv.target).padStart(3), String(lv.hits).padStart(4), ' |', `${q(r.crit, .25)}/${q(r.crit, .5)}`.padStart(9), ' |', `${q(r.near, .25)}/${q(r.near, .5)}/${q(r.near, .75)}`.padStart(13), ' |', `${q(r.sloppy, .25)}/${q(r.sloppy, .5)}/${q(r.sloppy, .75)}`.padStart(13), ' |', `${q(r.rand, .25)}/${q(r.rand, .5)}/${q(r.rand, .75)}`.padStart(13));
});
