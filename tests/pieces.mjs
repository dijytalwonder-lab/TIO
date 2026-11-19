// Builds every furniture piece of every story room and prints shard counts + fragments from expert play.
//   node tests/pieces.mjs
import { assemble } from '../src/objects.js';
import { pieceInfo, roomPieces } from '../src/rooms.js';
import { CHAPTERS } from '../src/story.js';
import { playRoom } from './roomsim.mjs';

let bad = 0;
const rooms = [...new Set(CHAPTERS.filter((c) => !c.soon).map((c) => c.room))];
for (const room of rooms) {
  console.log(`\n${room}`);
  for (const id of roomPieces(room)) {
    const info = pieceInfo(room, id);
    const t0 = Date.now();
    const asm = assemble(info.type, {}, 5);
    const zs = asm.zones.map((z) => `[${z.at.x.toFixed(2)},${z.at.y.toFixed(2)},${z.at.z.toFixed(2)} r${z.rx.toFixed(2)}x${z.ry.toFixed(2)}]`).join(' ');
    const r = playRoom(room, [id], 'crit', 6, 0, 3);
    console.log(`  ${id.padEnd(10)} ${String(asm.cells.length).padStart(3)} shards, base ${asm.cells.filter((c) => c.base).length}, size ${asm.size.toFixed(2)}, zones ${zs}  expert 6 hits -> ${r.count} fragments (${r.used} used)  ${Date.now() - t0}ms`);
    if (asm.cells.length < 2 || !Number.isFinite(asm.size) || r.count < 3) { bad++; console.log('   ^^^ PROBLEM'); }
  }
}
console.log(bad ? `\n${bad} problem(s)` : '\nPIECES OK');
process.exit(bad ? 1 : 0);
