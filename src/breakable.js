import * as THREE from 'three';
import { buildHexGeometry, buildCrackGeometry, mulberry32 } from './fracture.js';
import { getMaterial, getCrackMaterial } from './materials.js';

// Critical-zone response: distance from the hidden zone centre (normalised) -> power multiplier.
const CRIT_CURVE = [[0, 3.2], [0.5, 3.2], [1.3, 1.5], [2.3, 0.65], [3.2, 0.35]];
function critCurve(dn) {
  if (dn >= CRIT_CURVE[CRIT_CURVE.length - 1][0]) return CRIT_CURVE[CRIT_CURVE.length - 1][1];
  for (let i = 0; i < CRIT_CURVE.length - 1; i++) {
    const a = CRIT_CURVE[i], b = CRIT_CURVE[i + 1];
    if (dn <= b[0]) return a[1] + (b[1] - a[1]) * ((dn - a[0]) / (b[0] - a[0]));
  }
  return 0.35;
}

export function critLabel(c) {
  if (c >= 2.6) return 'critical';
  if (c >= 1.4) return 'good';
  if (c >= 0.7) return 'ok';
  return 'weak';
}

/** A pre-fractured object standing on the platform. */
export class Breakable {
  constructor(asm, world, opts = {}) {
    this.asm = asm;
    this.world = world;
    this.cells = asm.cells;
    this.zones = asm.zones;
    this.rng = opts.rng || mulberry32(99);
    this.breakScale = (opts.breakScale ?? 1) * (asm.breakScale ?? 1);
    this.yaw = opts.yaw ?? Math.PI / 4;
    this.group = new THREE.Group();
    this.group.rotation.y = this.yaw;
    this.tilt = { x: 0, z: 0, vx: 0, vz: 0 };
    this._q = new THREE.Quaternion();
    this._qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    this._e = new THREE.Euler();
    this.crackW = 0.011 * asm.scale;
    this.attached = this.cells.length;
    for (const c of this.cells) {
      c.state = 0;
      c.dmg = 0;
      c.crackStage = 0;
      const mesh = new THREE.Mesh(buildHexGeometry(c.hex, c.style, c.tint), getMaterial(c.mat));
      mesh.position.copy(c.center);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.cell = c;
      this.group.add(mesh);
      c.mesh = mesh;
    }
  }

  get progress() { return 1 - this.attached / this.cells.length; }

  /** Hidden critical zone factor for a world-space hit point (measured in the camera plane). */
  critFactor(point, camRight, camUp) {
    let best = 0.35, bestDn = 9;
    const wp = new THREE.Vector3();
    for (const z of this.zones) {
      wp.copy(z.at).applyMatrix4(this.group.matrixWorld);
      const dx = (point.x - wp.x) * camRight.x + (point.y - wp.y) * camRight.y + (point.z - wp.z) * camRight.z;
      const dy = (point.x - wp.x) * camUp.x + (point.y - wp.y) * camUp.y + (point.z - wp.z) * camUp.z;
      const dn = Math.hypot(dx / z.rx, dy / z.ry);
      const c = critCurve(dn) * z.w;
      if (c > best) best = c;
      if (dn < bestDn) bestDn = dn;
    }
    return { c: best, dn: bestDn };
  }

  /** Closest attached shard under a ray. */
  pick(raycaster) {
    const hits = raycaster.intersectObjects(this.group.children, false);
    for (const h of hits) {
      const cell = h.object.userData.cell;
      if (cell && cell.state === 0) {
        const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
        return { cell, point: h.point.clone(), normal: n };
      }
    }
    return null;
  }

  /** Forgiving tap: nearest attached shard in screen space. */
  snapPick(camera, ndc, tol) {
    this.group.updateMatrixWorld(true);
    let best = null, bd = tol;
    const wp = new THREE.Vector3(), pr = new THREE.Vector3();
    for (const c of this.cells) {
      if (c.state !== 0) continue;
      wp.copy(c.center).applyMatrix4(this.group.matrixWorld);
      pr.copy(wp).project(camera);
      const d = Math.hypot((pr.x - ndc.x) * camera.aspect, pr.y - ndc.y);
      if (d < bd) { bd = d; best = { cell: c, point: wp.clone() }; }
    }
    if (!best) return null;
    const n = new THREE.Vector3(1, 0.3, 1).normalize();
    return { cell: best.cell, point: best.point, normal: n };
  }

  staticList() {
    this.group.updateMatrixWorld(true);
    const out = [];
    const wp = new THREE.Vector3();
    for (const c of this.cells) {
      if (c.state !== 0) continue;
      wp.copy(c.center).applyMatrix4(this.group.matrixWorld);
      out.push({ x: wp.x, y: wp.y, z: wp.z, r: Math.max(0.1, c.radius * 0.6) });
    }
    return out;
  }

  _supportCheck() {
    const seen = new Set();
    const stack = [];
    for (const c of this.cells) if (c.state === 0 && c.base) { seen.add(c.id); stack.push(c.id); }
    while (stack.length) {
      const id = stack.pop();
      for (const n of this.cells[id].nbs) {
        if (this.cells[n].state === 0 && !seen.has(n)) { seen.add(n); stack.push(n); }
      }
    }
    return this.cells.filter((c) => c.state === 0 && !seen.has(c.id));
  }

  _rv() { return (this.rng() - 0.5) * 2; }

  /**
   * One hammer blow. point/normal in world space. Returns a result for FX / audio / scoring.
   */
  hit(point, normal, camRight, camUp, power = 1) {
    const G = this.group;
    G.updateMatrixWorld(true);
    const zc = this.critFactor(point, camRight, camUp);
    const P = zc.c * power;
    const R = this.asm.size * this.breakScale * (4.6 + 0.35 * P);
    const broken = [];
    const wp = new THREE.Vector3();
    for (const c of this.cells) {
      if (c.state !== 0) continue;
      wp.copy(c.center).applyMatrix4(G.matrixWorld);
      const d = wp.distanceTo(point);
      if (d >= R) continue;
      const fall = Math.pow(1 - d / R, 1.4);
      c.dmg += P * fall * (0.92 + this.rng() * 0.16);
      if (c.dmg >= c.hp) broken.push({ cell: c, fall, wp: wp.clone() });
    }
    for (const b of broken) b.cell.state = 1;
    const lost = this._supportCheck();
    lost.forEach((c) => { c.state = 1; });

    const nrm = normal.clone().normalize();
    // direct breaks: burst away from the impact, biased towards the viewer
    for (const b of broken) {
      const away = b.wp.clone().sub(point);
      if (away.lengthSq() < 1e-6) away.copy(nrm);
      away.normalize();
      const k = 0.45 + 0.9 * b.fall;
      const sp = (1.5 + 1.15 * P) * k;
      const vel = away.multiplyScalar(sp)
        .addScaledVector(nrm, (1.1 + 0.6 * P) * k)
        .add(new THREE.Vector3(this._rv() * 0.8, 1.2 + 0.45 * P + this._rv() * 0.4, this._rv() * 0.8));
      const w = new THREE.Vector3(this._rv(), this._rv(), this._rv()).multiplyScalar(5 + 3 * P);
      this.world.spawnFromCell(b.cell, G, vel, w);
    }
    // structural collapse: shards that lost their support simply fall
    const axis = new THREE.Vector3(G.position.x, 0, G.position.z);
    for (const c of lost) {
      wp.copy(c.center).applyMatrix4(G.matrixWorld);
      const out = wp.clone().sub(axis); out.y = 0;
      if (out.lengthSq() < 1e-6) out.set(this._rv(), 0, this._rv());
      out.normalize();
      const vel = out.multiplyScalar(0.5 + this.rng() * 0.9).add(new THREE.Vector3(this._rv() * 0.4, 0.3 + this.rng() * 0.6, this._rv() * 0.4));
      const w = new THREE.Vector3(this._rv(), this._rv(), this._rv()).multiplyScalar(3.5);
      this.world.spawnFromCell(c, G, vel, w);
    }
    this.attached -= broken.length + lost.length;

    // cracks on whatever got damaged but survived
    for (const c of this.cells) if (c.state === 0 && c.dmg > 0) this._updateCrack(c);
    if (this.world.sources) this.world.refreshStatics(); else this.world.setStatics(this.staticList());

    // object reaction: lean away from the blow
    const dirX = -nrm.x, dirZ = -nrm.z;
    const L = Math.hypot(dirX, dirZ);
    if (L > 0.2) {
      const k = Math.min(2.2, 0.55 + P * 0.5) * 0.9;
      this.tilt.vx += (dirZ / L) * k;
      this.tilt.vz += (-dirX / L) * k;
    }

    return {
      c: zc.c, dn: zc.dn, label: critLabel(zc.c), P,
      direct: broken.length, collapsed: lost.length, total: broken.length + lost.length,
      mat: this.cells[0].mat
    };
  }

  _updateCrack(c) {
    const ratio = c.dmg / c.hp;
    const stage = ratio >= 0.5 ? 2 : ratio >= 0.14 ? 1 : 0;
    if (stage <= c.crackStage) return;
    c.crackStage = stage;
    if (!c.crack) {
      const cr = buildCrackGeometry(c.hex, this.rng, this.crackW);
      if (cr.countAll === 0) { c.crackStage = 9; return; }
      c.crackGeo = cr;
      c.crack = new THREE.Mesh(cr.geo, getCrackMaterial(c.mat));
      c.crack.renderOrder = 2;
      c.mesh.add(c.crack);
    }
    if (c.crackGeo) c.crack.geometry.setDrawRange(0, stage === 1 ? c.crackGeo.countA : c.crackGeo.countAll);
  }

  update(dt) {
    const t = this.tilt;
    const K = 150, D = 11;
    t.vx += (-K * t.x - D * t.vx) * dt;
    t.vz += (-K * t.z - D * t.vz) * dt;
    t.x += t.vx * dt;
    t.z += t.vz * dt;
    const lim = 0.16;
    t.x = Math.max(-lim, Math.min(lim, t.x * 1));
    t.z = Math.max(-lim, Math.min(lim, t.z * 1));
    this._e.set(t.x, 0, t.z);
    this._q.setFromEuler(this._e);
    this.group.quaternion.copy(this._q).multiply(this._qy);
  }

  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}
