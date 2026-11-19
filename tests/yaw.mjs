import { LEVELS } from '../src/levels.js';
import { play } from './simlib.mjs';
const ids = process.argv.slice(2).map(Number);
for (const id of ids) {
  const lv = LEVELS[id - 1];
  for (const jit of [0, 0.5]) {
    const res = [];
    for (let seed = 1; seed <= 24; seed++) res.push(play(lv.obj, lv.variant, 'crit', lv.hits, 0, seed, jit).count);
    const pass = res.filter((c) => c >= lv.target).length;
    console.log(`L${id} ${lv.obj} target ${lv.target} yawJitter ${jit}: pass ${pass}/24  counts ${res.sort((a, b) => a - b).slice(0, 8).join(',')}...`);
  }
}
