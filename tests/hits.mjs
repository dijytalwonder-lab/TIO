// median fragments after exactly k hits for each object / skill (default variant)
import { OBJECTS } from '../src/objects.js';
import * as sim from './simlib.mjs';
const N = 10;
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log('object'.padEnd(14), '   expert k=1,2,3 |   decent k=1,2,3 |  sloppy k=1,2,3 |  random k=1,2,3');
for (const t of Object.keys(OBJECTS)) {
  const row = [];
  for (const s of ['crit', 'near', 'sloppy', 'rand']) {
    const v = [];
    for (const k of [1, 2, 3]) {
      const a = [];
      for (let seed = 1; seed <= N; seed++) a.push(sim.play(t, {}, s, k, 0, seed).count);
      v.push(med(a));
    }
    row.push(v.join('/').padStart(11));
  }
  console.log(t.padEnd(14), row.join(' | '));
}
