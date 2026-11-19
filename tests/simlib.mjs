import * as THREE from 'three';
import { assemble, OBJECTS } from '../src/objects.js';
import { World } from '../src/world.js';
import { Breakable } from '../src/breakable.js';
import { makeCamera, camAxes } from '../src/view.js';
import { mulberry32 } from '../src/fracture.js';

const cam = makeCamera();
const { right, up } = camAxes(cam);
const ray = new THREE.Raycaster();
const project = (p) => p.clone().project(cam);

export function play(type, variant, strategy, hits, target, seed, yawJit = 0) {
  const rng = mulberry32(seed * 31 + 5);
  const world = new World({ rng });
  const asm = assemble(type, variant, seed);
  const br = new Breakable(asm, world, { rng, yaw: Math.PI / 4 + (rng() - 0.5) * yawJit });
  br.update(0.016);
  br.group.updateMatrixWorld(true);
  world.setStatics(br.staticList());
  const log = [];
  let minX = 9, maxX = -9, minY = 9, maxY = -9;
  asm.cells.forEach((c) => {
    const p = project(c.center.clone().applyMatrix4(br.group.matrixWorld));
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });
  const noise = strategy === 'near' ? [0.12, 0.07] : strategy === 'sloppy' ? [0.26, 0.14] : [0, 0];
  let used = 0;
  for (let h = 0; h < hits; h++) {
    br.group.updateMatrixWorld(true);
    const zone = asm.zones[h % asm.zones.length];
    const zw = zone.at.clone().applyMatrix4(br.group.matrixWorld);
    let ndc;
    if (strategy === 'crit' || strategy === 'near' || strategy === 'sloppy') {
      const p = project(zw);
      ndc = new THREE.Vector2(p.x + (rng() - 0.5) * 2 * noise[0], p.y + (rng() - 0.5) * 2 * noise[1]);
    } else if (strategy === 'edge') {
      const side = rng() < 0.5 ? -1 : 1;
      ndc = new THREE.Vector2(side > 0 ? maxX - 0.02 : minX + 0.02, minY + (maxY - minY) * (0.2 + rng() * 0.6));
    } else {
      ndc = new THREE.Vector2(minX + (maxX - minX) * rng(), minY + (maxY - minY) * rng());
    }
    ray.setFromCamera(ndc, cam);
    let pick = br.pick(ray);
    if (!pick) {
      // aim at something that still exists
      const alive = asm.cells.filter((c) => c.state === 0);
      if (!alive.length) break;
      let c;
      if (strategy === 'rand' || strategy === 'edge') c = alive[Math.floor(rng() * alive.length)];
      else { c = alive.reduce((a, b) => (a.center.distanceTo(zone.at) < b.center.distanceTo(zone.at) ? a : b)); }
      const p = project(c.center.clone().applyMatrix4(br.group.matrixWorld));
      ray.setFromCamera(new THREE.Vector2(p.x, p.y), cam);
      pick = br.pick(ray) || br.snapPick(cam, new THREE.Vector2(p.x, p.y), 0.3);
    }
    if (!pick) break;
    used++;
    const res = br.hit(pick.point, pick.normal, right, up, 1);
    for (let f = 0; f < 150; f++) { br.update(1 / 60); world.update(1 / 60); world.events.length = 0; }
    log.push({ h, c: +res.c.toFixed(2), label: res.label, direct: res.direct, collapsed: res.collapsed, total: world.count });
    if (target && world.count >= target) break;
  }
  const off = world.pieces.filter((p) => p.pos.y < -1).length;
  const nan = world.pieces.filter((p) => !Number.isFinite(p.pos.x + p.pos.y + p.pos.z)).length;
  return { count: world.count, used, log, asm, off, nan, live: world.pieces.length };
}

