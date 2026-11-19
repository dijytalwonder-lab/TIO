// Node smoke test of the render-side modules (no GPU, no DOM, no network port).
import * as THREE from 'three';
const ctx2d = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };
const mem = {};
globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };

const { Diorama } = await import('../src/diorama.js');
const { Effects } = await import('../src/effects.js');
const { Hammer } = await import('../src/hammer.js');
const { Save } = await import('../src/save.js');
const { makeCamera, camAxes } = await import('../src/view.js');
const { LEVELS, WORLDS, ROOMS } = await import('../src/levels.js');
const { RoomDiorama } = await import('../src/rooms.js');
const { assemble, OBJECTS } = await import('../src/objects.js');

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };

const scene = new THREE.Scene();
const cam = makeCamera();

// 0. all story rooms
for (const key of Object.keys(ROOMS)) {
  const d = new RoomDiorama(key);
  scene.add(d.group);
  for (let k = 0; k < 20; k++) d.update(0.016);
  let meshes = 0, verts = 0, bad = 0;
  d.group.traverse((o) => { if (o.isMesh) { meshes++; const p = o.geometry.attributes.position; verts += p.count; for (let j = 0; j < p.count * 3; j += 53) if (!Number.isFinite(p.array[j])) bad++; } });
  ok(meshes >= 2 && meshes < 40 && bad === 0 && verts > 1000, `room ${key} meshes=${meshes} verts=${verts} bad=${bad}`);
  console.log(`room ${key}: ${meshes} meshes, ${verts} vertices`);
  d.dispose();
}

// 1. all six dioramas
for (let i = 0; i < WORLDS.length; i++) {
  const d = new Diorama(i);
  scene.add(d.group);
  for (let k = 0; k < 20; k++) d.update(0.016);
  let meshes = 0, bad = 0;
  d.group.traverse((o) => { if (o.isMesh) { meshes++; const p = o.geometry.attributes.position; for (let j = 0; j < p.count * 3; j += 97) if (!Number.isFinite(p.array[j])) bad++; } });
  ok(meshes > 40 && bad === 0, `diorama ${i} meshes=${meshes} bad=${bad}`);
  console.log(`diorama ${i} ${WORLDS[i].name}: ${meshes} meshes`);
  d.dispose();
}

// 2. effects
const fx = new Effects(scene, cam);
const n = new THREE.Vector3(0.6, 0.3, 0.7).normalize();
fx.impact(new THREE.Vector3(0, 1, 0), n, 3.2, true, [0xff0000, 0x00ff00]);
fx.impact(new THREE.Vector3(0, 1, 0), n, 0.7, false, [0xff0000]);
fx.landing(new THREE.Vector3(1, 0.1, 1), 8, 0xffffff);
fx.confetti(120);
fx.shake(0.2);
for (let k = 0; k < 90; k++) { fx.update(1 / 60); fx.applyShake(1 / 60); }
ok(Number.isFinite(cam.position.x), 'camera position finite after shake');
ok(fx.shakeAmt === 0 || fx.shakeAmt < 0.01, 'shake decays');
fx.clear();

// 3. hammer
const hm = new Hammer(scene);
const { right, up } = camAxes(cam);
const toward = cam.getWorldDirection(new THREE.Vector3()).negate();
let hit = 0;
ok(hm.swing(new THREE.Vector3(0, 1, 0), n, right, up, toward, () => hit++), 'swing starts');
ok(hm.swing(new THREE.Vector3(0.5, 1, 0), n, right, up, toward, () => hit++), 'second unit swings');
ok(!hm.free, 'both busy');
for (let k = 0; k < 60; k++) hm.update(1 / 60);
ok(hit === 2, 'impact callbacks fired: ' + hit);
ok(hm.free, 'hammers free again');
for (const id of ['wood', 'steel', 'gold', 'ice', 'rainbow']) hm.setSkin(id);

// 4. save
Save.load();
ok(Save.data.unlocked === 1, 'fresh save');
const r = Save.complete(LEVELS[0], 3, 20, 4);
ok(r.coins === 20 + 30 + 4 && r.first, 'first clear coins ' + r.coins);
const r2 = Save.complete(LEVELS[0], 3, 20, 0);
ok(r2.coins === 6, 'replay coins ' + r2.coins);
ok(Save.data.unlocked === 2, 'next level unlocked');
ok(Save.claimDaily() >= 50 && Save.claimDaily() === 0, 'daily once');
Save.load();
ok(Save.data.stars[1] === 3, 'persisted');

// 5. every level builds, is connected and has sane numbers
for (const lv of LEVELS) {
  const a = assemble(lv.obj, lv.variant, 11);
  ok(a.orphans === 0, `level ${lv.id} orphans ${a.orphans}`);
  ok(a.cells.length > 10 && a.zones.length >= 1, `level ${lv.id} cells`);
  ok(lv.target < a.cells.length * 2.2, `level ${lv.id} target ${lv.target} reachable vs ${a.cells.length} cells`);
}
console.log('object types:', Object.keys(OBJECTS).length, ' levels:', LEVELS.length);
console.log(fails ? `${fails} FAILURES` : 'SMOKE OK');
process.exit(fails ? 1 : 0);
