// Validates src/story.js (the scenario) and checks that every story level is beatable.
//   node tests/story-check.mjs            structure check + bot pass rates for each level beat
//   node tests/story-check.mjs --quick    structure check only
// No ports, no browser: pure Node.
import { CHAPTERS, CAST, storyLevel, sceneObject } from '../src/story.js';
import { FACE_NAMES, BACKDROP_KEYS } from '../src/portraits.js';
import { roomPieces } from '../src/rooms.js';
import { OBJECTS } from '../src/objects.js';
import { WORLDS, ROOMS, placeExists } from '../src/levels.js';

let fails = 0;
const bad = (m) => { fails++; console.log('PROBLEM', m); };
const quick = process.argv.includes('--quick');

if (!CHAPTERS.length) bad('no chapters');
CHAPTERS.forEach((ch, ci) => {
  const at = `chapter ${ch.id} "${ch.title}"`;
  if (ch.id !== ci + 1) bad(`${at}: id should be ${ci + 1}`);
  if (!ch.title) bad(`${at}: missing title`);
  const badPlace = (o) => (o.room != null && !ROOMS[o.room]) || (o.world != null && !WORLDS[o.world]) || (o.room == null && o.world == null ? false : !placeExists(o.room ?? o.world));
  if (badPlace(ch)) bad(`${at}: unknown room/world (rooms: ${Object.keys(ROOMS).join(', ')}; worlds 0-${WORLDS.length - 1})`);
  if (ch.premium && !ch.sku) bad(`${at}: premium chapters need a sku`);
  if (!ch.soon && !ch.beats.length) bad(`${at}: no beats (add soon: true to show it as coming soon)`);
  ch.beats.forEach((b, i) => {
    const w = `${at} beat ${i + 1}`;
    if (badPlace(b)) bad(`${w}: unknown room/world (rooms: ${Object.keys(ROOMS).join(', ')}; worlds 0-${WORLDS.length - 1})`);
    if (b.type === 'scene' || b.type === 'vn') {
      if (!b.lines || !b.lines.length) bad(`${w}: scene has no lines`);
      (b.lines || []).forEach((l, k) => {
        if (!l.text || !String(l.text).trim()) bad(`${w} line ${k + 1}: empty text`);
        if (l.who && !CAST[l.who]) bad(`${w} line ${k + 1}: speaker "${l.who}" is not in CAST`);
        if (l.face && !FACE_NAMES.includes(l.face)) bad(`${w} line ${k + 1}: unknown face "${l.face}" (${FACE_NAMES.join(', ')})`);
        if (l.bg && !BACKDROP_KEYS.includes(l.bg)) bad(`${w} line ${k + 1}: unknown backdrop "${l.bg}" (${BACKDROP_KEYS.join(', ')})`);
        (l.stage || []).forEach((id) => { if (!CAST[id]) bad(`${w} line ${k + 1}: stage character "${id}" is not in CAST`); });
      });
      if (b.bg && !BACKDROP_KEYS.includes(b.bg)) bad(`${w}: unknown backdrop "${b.bg}" (${BACKDROP_KEYS.join(', ')})`);
      (b.stage || []).forEach((id) => { if (!CAST[id]) bad(`${w}: stage character "${id}" is not in CAST`); });
      if (b.stage && b.stage.length > 3) bad(`${w}: at most 3 characters fit on stage`);
      if (b.obj && !OBJECTS[b.obj]) bad(`${w}: unknown object "${b.obj}"`);
      const so = sceneObject(ch, i);
      if (so && !OBJECTS[so]) bad(`${w}: backdrop object not found`);
    } else if (b.type === 'level') {
      if (b.live) {
        const have = roomPieces(b.room ?? ch.room);
        if (!b.live.length) bad(`${w}: level has no live pieces`);
        b.live.forEach((id) => { if (!have.includes(id)) bad(`${w}: unknown piece "${id}" in room ${b.room ?? ch.room} (valid: ${have.join(', ')})`); });
      } else if (!OBJECTS[b.obj]) bad(`${w}: unknown object "${b.obj}" (valid: ${Object.keys(OBJECTS).join(', ')})`);
      if (!(b.target > 0)) bad(`${w}: target must be > 0`);
      if (!(b.hits > 0)) bad(`${w}: hits must be > 0`);
    } else bad(`${w}: unknown beat type "${b.type}"`);
  });
});
Object.entries(CAST).forEach(([id, c]) => { if (!c.name || !c.icon) bad(`CAST.${id}: needs name and icon`); });
CHAPTERS.forEach((ch) => ch.beats.forEach((b) => (b.type === 'vn' ? b.lines.length : 0)));

const nLevels = CHAPTERS.reduce((a, c) => a + c.beats.filter((b) => b.type === 'level').length, 0);
const nScenes = CHAPTERS.reduce((a, c) => a + c.beats.filter((b) => b.type === 'scene' || b.type === 'vn').length, 0);
console.log(`${CHAPTERS.length} chapters, ${nScenes} scenes, ${nLevels} story levels, ${Object.keys(CAST).length} characters`);

if (!quick && !fails) {
  const { play } = await import('./simlib.mjs');
  const { playRoom } = await import('./roomsim.mjs');
  console.log('\nbot pass rates per story level (expert = aims at the hidden zone, sloppy = misses by a lot):');
  for (const ch of CHAPTERS) {
    ch.beats.forEach((b, i) => {
      if (b.type !== 'level') return;
      const lv = storyLevel(ch, i);
      if (lv.live) {
        const room = lv.place, N = 10;
        const rate = (st) => { let pass = 0; for (let k = 1; k <= N; k++) if (playRoom(room, lv.live, st, lv.hits, lv.target, k * 7 + i).count >= lv.target) pass++; return Math.round((100 * pass) / N); };
        const full = playRoom(room, lv.live, 'crit', 14, 0, 3);
        const e = rate('crit'), sl = rate('sloppy'), r = rate('rand');
        console.log(`  ch${ch.id} beat ${i + 1} [${lv.live.join(',')}]`.padEnd(46) + ` target ${String(lv.target).padStart(3)} / ${lv.hits} hits  (all pieces give ~${full.count} fragments, ${full.cells} shards)   expert ${e}%  sloppy ${sl}%  random ${r}%${e < 90 ? '   <-- too hard for experts?' : ''}${r > 60 ? '   <-- too easy?' : ''}`);
        return;
      }
      const rate = (strategy) => {
        let pass = 0;
        const N = 12;
        for (let s = 1; s <= N; s++) { const r = play(lv.obj, lv.variant, strategy, lv.hits, lv.target, s * 7 + i, 0.5); if (r.count >= lv.target) pass++; }
        return Math.round((100 * pass) / N);
      };
      const e = rate('crit'), sl = rate('sloppy'), r = rate('rand');
      console.log(`  ch${ch.id} beat ${i + 1} ${lv.obj.padEnd(14)} target ${String(lv.target).padStart(3)} / ${lv.hits} hits   expert ${e}%  sloppy ${sl}%  random ${r}%${e < 90 ? '   <-- too hard for experts?' : ''}${r > 60 ? '   <-- too easy?' : ''}`);
    });
  }
}
console.log(fails ? `\n${fails} problem(s)` : '\nSTORY OK');
process.exit(fails ? 1 : 0);
