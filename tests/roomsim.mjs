// Pure-Node simulation of story-room levels (several furniture pieces live at once). No browser, no ports.
//   import { playRoom } from './roomsim.mjs'
import * as THREE from 'three';
import { assemble } from '../src/objects.js';
import { World } from '../src/world.js';
import { Breakable } from '../src/breakable.js';
import { makeCamera, camAxes } from '../src/view.js';
import { mulberry32 } from '../src/fracture.js';
import { pieceInfo } from '../src/rooms.js';

const cam = makeCamera();
const { right, up } = camAxes(cam);
const ray = new THREE.Raycaster();
const project = (p) => p.clone().project(cam);

/**
 * strategy: 'crit' (aims at each piece's hidden zone), 'sloppy' (misses by a lot), 'rand' (random taps on the pieces).
 * Hits go to the piece with the most shards left. Returns { count, used, cells }.
 */
export function playRoom(room, live, strategy, hits, target, seed) {
  const rng = mulberry32(seed * 31 + 5);
  const world = new World({ rng });
  world.walls = true;
  const items = live.map((id, k) => {
    const info = pieceInfo(room, id);
    const asm = assemble(info.type, {}, seed + k * 7);
    const br = new Breakable(asm, world, { rng: mulberry32(seed + k + 1), yaw: info.yaw });
    br.group.position.set(info.x, 0, info.z);
    br.update(0.016);
    br.group.updateMatrixWorld(true);
    return { id, asm, br };
  });
  world.sources = items.map((i) => i.br);
  world.refreshStatics();
  const cells = items.reduce((a, i) => a + i.asm.cells.length, 0);
  const noise = strategy === 'sloppy' ? [0.2, 0.12] : [0, 0];
  let used = 0;
  for (let h = 0; h < hits; h++) {
    const alive = items.filter((i) => i.br.attached > 0);
    if (!alive.length) break;
    const it = alive.reduce((a, b) => (a.br.attached >= b.br.attached ? a : b));
    it.br.group.updateMatrixWorld(true);
    const zone = it.asm.zones[h % it.asm.zones.length];
    let ndc;
    if (strategy === 'rand') {
      const c = it.asm.cells.filter((x) => x.state === 0);
      const p = project(c[Math.floor(rng() * c.length)].center.clone().applyMatrix4(it.br.group.matrixWorld));
      ndc = new THREE.Vector2(p.x + (rng() - 0.5) * 0.12, p.y + (rng() - 0.5) * 0.1);
    } else {
      const p = project(zone.at.clone().applyMatrix4(it.br.group.matrixWorld));
      ndc = new THREE.Vector2(p.x + (rng() - 0.5) * 2 * noise[0], p.y + (rng() - 0.5) * 2 * noise[1]);
    }
    ray.setFromCamera(ndc, cam);
    let pick = it.br.pick(ray);
    if (!pick) {
      const c = it.asm.cells.filter((x) => x.state === 0);
      if (!c.length) continue;
      const near = c.reduce((a, b) => (a.center.distanceTo(zone.at) < b.center.distanceTo(zone.at) ? a : b));
      const p = project(near.center.clone().applyMatrix4(it.br.group.matrixWorld));
      ray.setFromCamera(new THREE.Vector2(p.x, p.y), cam);
      pick = it.br.pick(ray) || it.br.snapPick(cam, new THREE.Vector2(p.x, p.y), 0.3);
    }
    if (!pick) break;
    used++;
    it.br.hit(pick.point, pick.normal, right, up, 1);
    for (let f = 0; f < 150; f++) { items.forEach((i) => i.br.update(1 / 60)); world.update(1 / 60); world.events.length = 0; }
    if (target && world.count >= target) break;
  }
  return { count: world.count, used, cells };
}
