// Headless balance + sanity simulation (pure Node, no GPU, no network port).
//   node tests/sim.mjs            -> per-object fragment table (5 hits, 4 strategies)
//   node tests/sim.mjs --levels   -> pass rates of all levels for expert / decent / random players
import { OBJECTS } from '../src/objects.js';
import { LEVELS } from '../src/levels.js';
import { play } from './simlib.mjs';

const args = process.argv.slice(2);
if (args.includes('--levels')) {
  const N = 14;
  console.log('lvl obj'.padEnd(18), 'tgt', 'hits', '| pass%: expert decent sloppy random');
  LEVELS.forEach((lv) => {
    const out = {};
    for (const s of ['crit', 'near', 'sloppy', 'rand']) {
      let pass = 0, sum = 0;
      for (let seed = 1; seed <= N; seed++) {
        const r = play(lv.obj, lv.variant, s, lv.hits, lv.target, seed);
        sum += r.count;
        if (r.count >= lv.target) pass++;
      }
      out[s] = [Math.round((100 * pass) / N), Math.round(sum / N)];
    }
    console.log(`${String(lv.id).padStart(2)} ${lv.obj}`.padEnd(18), String(lv.target).padStart(3), String(lv.hits).padStart(4), '|', `${out.crit[0]}`.padStart(11), `${out.near[0]}`.padStart(6), `${out.sloppy[0]}`.padStart(7), `${out.rand[0]}`.padStart(7));
  });
} else {
  const only = args.find((a) => !a.startsWith('--'));
  const types = only ? [only] : Object.keys(OBJECTS);
  console.log('type'.padEnd(14), 'cells', 'orph', ' size', '   h', '|', 'crit x5', 'near x5', 'rand x5', 'edge x5', '| first crit (direct+collapse=>frags)');
  for (const t of types) {
    const row = {};
    let a, first = [];
    for (const s of ['crit', 'near', 'rand', 'edge']) {
      let sum = 0;
      for (let seed = 1; seed <= 3; seed++) {
        const r = play(t, {}, s, 5, 0, seed);
        sum += r.count; a = r.asm;
        if (s === 'crit') first.push(`${r.log[0].direct}+${r.log[0].collapsed}=>${r.log[0].total}`);
        if (r.nan) console.log('NaN pieces!', t, s);
      }
      row[s] = Math.round(sum / 3);
    }
    console.log(t.padEnd(14), String(a.cells.length).padStart(5), String(a.orphans).padStart(4), a.size.toFixed(2).padStart(5), a.height.toFixed(1).padStart(4), '|',
      String(row.crit).padStart(7), String(row.near).padStart(7), String(row.rand).padStart(7), String(row.edge).padStart(7), '|', first.join('  '));
  }
}
