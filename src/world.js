import * as THREE from 'three';
import { MAT, getMaterial } from './materials.js';
import { buildHexGeometry, hexRadius, longestAxis, splitHex } from './fracture.js';
import { GRAVITY, PLATFORM_HALF, MAX_PIECES } from './config.js';

const STEP = 1 / 120;
const CELL = 0.6;
const key3 = (x, y, z) => (x + 512) + (z + 512) * 1024 + (y + 512) * 1048576;

const _r = new THREE.Vector3();
const _ax = new THREE.Vector3();
const _dq = new THREE.Quaternion();

/** Corner list of an axis-aligned box in the shard format (corner = a + 2b + 4c). */
function boxHex(sx, sy, sz) {
  const c = [];
  for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    c.push(new THREE.Vector3((i ? 0.5 : -0.5) * sx, (j ? 0.5 : -0.5) * sy, (k ? 0.5 : -0.5) * sz));
  }
  return { c, ao: [1, 1, 1, 1, 1, 1, 1, 1], kinds: ['s', 's', 's', 's', 's', 's'] };
}

/**
 * Loose fragments: lightweight rigid bodies (vertex-vs-ground impulses, sphere-vs-sphere
 * separation), ground-impact splitting and an event queue that audio/FX read from.
 */
export class World {
  constructor(opts = {}) {
    this.group = new THREE.Group();
    this.pieces = [];
    this.events = [];
    this.count = 0;            // fragments created so far
    this.coinsReleased = 0;
    this.rng = opts.rng || Math.random;
    this.acc = 0;
    this.half = PLATFORM_HALF;
    this.walls = false;        // room dioramas: solid back walls at x = -half and z = -half
    this.nextId = 1;
    this.cap = MAX_PIECES;
    this.statics = [];
    this.sources = null;       // story rooms: every live breakable (their unbroken shards are all obstacles)
    this.staticHash = new Map();
    this.dynHead = new Map();
    this.dynNext = new Int32Array(512);
    this.impacts = [];
    this.bounceBudget = 0;
  }

  setStatics(list) {
    this.statics = list;
    this.staticHash.clear();
    list.forEach((s, i) => {
      const k = key3(Math.floor(s.x / CELL), Math.floor(s.y / CELL), Math.floor(s.z / CELL));
      let arr = this.staticHash.get(k);
      if (!arr) { arr = []; this.staticHash.set(k, arr); }
      arr.push(i);
    });
  }

  refreshStatics() {
    if (this.sources) this.setStatics(this.sources.flatMap((b) => b.staticList()));
  }

  clear() {
    this.pieces.forEach((p) => this._free(p));
    this.pieces = [];
    this.events.length = 0;
    this.count = 0;
    this.coinsReleased = 0;
    this.acc = 0;
    this.statics = [];
    this.staticHash.clear();
  }

  _free(p) {
    p.dead = true;
    this.group.remove(p.mesh);
    p.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }

  _make(hex, style, tint, mat, level, maxLevel, wp, quat, vel, w, existing) {
    let mesh = existing;
    if (!mesh) {
      mesh = new THREE.Mesh(buildHexGeometry(hex, style, tint), getMaterial(mat));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    mesh.position.copy(wp);
    mesh.quaternion.copy(quat);
    this.group.add(mesh);
    const radius = hexRadius(hex);
    const m = MAT[mat];
    const p = {
      id: this.nextId++, mesh, hex, style, tint, mat, level, maxLevel, radius,
      cr: Math.max(0.05, radius * 0.5),
      pos: mesh.position, quat: mesh.quaternion, vel, w,
      asleep: false, sleepT: 0, age: 0, cool: 0.2,
      rest: m.rest, fric: m.fric, invI: 1 / (0.25 * radius * radius + 1e-4),
      dead: false, coin: false
    };
    mesh.userData.piece = p;
    this.pieces.push(p);
    return p;
  }

  /** Detach an object cell: its mesh becomes a free fragment. Caller updated root matrices. */
  spawnFromCell(cell, root, vel, w) {
    const mesh = cell.mesh;
    const wp = new THREE.Vector3(), wq = new THREE.Quaternion();
    mesh.getWorldPosition(wp);
    mesh.getWorldQuaternion(wq);
    root.remove(mesh);
    const p = this._make(cell.hex, cell.style, cell.tint, cell.mat, 0, cell.maxLevel, wp, wq, vel, w, mesh);
    this.count += 1;
    return p;
  }

  spawnCoins(n, origin) {
    const hex = boxHex(0.2, 0.2, 0.05);
    const style = { s: [1, 0.7, 0.12], i: [0.8, 0.5, 0.08], c: [1, 0.85, 0.4] };
    const q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const p = this._make(hex, style, 1, 'gold', 0, 0, origin.clone(), q.clone().setFromEuler(new THREE.Euler(this.rng() * 3, this.rng() * 3, 0)),
        new THREE.Vector3(Math.cos(a) * (1.5 + this.rng() * 2.5), 4 + this.rng() * 3, Math.sin(a) * (1.5 + this.rng() * 2.5)),
        new THREE.Vector3((this.rng() - 0.5) * 12, (this.rng() - 0.5) * 12, (this.rng() - 0.5) * 12));
      p.coin = true;
      this.coinsReleased += 1;
    }
  }

  canSplit(p) {
    return p.level < p.maxLevel && p.radius > 0.075 && !p.coin;
  }

  /** Cut a fragment in two. Returns the two children. */
  split(p, power = 1, kick = null) {
    const ax = longestAxis(p.hex, this.rng);
    const t = 0.38 + this.rng() * 0.24;
    const parts = splitHex(p.hex, ax, t);
    const kids = [];
    for (const K of parts) {
      const off = K.offset.clone().applyQuaternion(p.quat);
      const wp = p.pos.clone().add(off);
      const sep = off.lengthSq() > 1e-8 ? off.clone().normalize() : new THREE.Vector3(this.rng() - 0.5, 0.2, this.rng() - 0.5).normalize();
      const v = p.vel.clone().multiplyScalar(0.7).addScaledVector(sep, 1.1 + this.rng() * 1.2 + power * 0.6);
      v.y += 0.5 + this.rng() * 1.1 * power;
      if (kick) v.addScaledVector(kick, 1.5 * power);
      const w = p.w.clone().multiplyScalar(0.7).add(new THREE.Vector3(this.rng() - 0.5, this.rng() - 0.5, this.rng() - 0.5).multiplyScalar(7));
      const kid = this._make(K.hex, p.style, p.tint, p.mat, p.level + 1, p.maxLevel, wp, p.quat, v, w);
      kid.cool = 0.45;
      kids.push(kid);
    }
    this._free(p);
    this.count += 1;
    this.events.push({ t: 'split', mat: p.mat, size: p.radius, pos: p.pos.clone(), power });
    return kids;
  }

  /** Hammer blow on a loose fragment. Returns number of new fragments. */
  smash(p, point, power) {
    const before = this.count;
    const away = p.pos.clone().sub(point);
    away.y = Math.max(away.y, 0.1);
    away.normalize();
    if (this.canSplit(p) && this.pieces.length < this.cap + 40) {
      let kids = this.split(p, 1.4 + power * 0.4, away);
      if (power > 1.2) {
        const next = [];
        kids.forEach((k) => { if (this.canSplit(k) && this.rng() < 0.65) next.push(...this.split(k, 1, away)); else next.push(k); });
        kids = next;
      }
      kids.forEach((k) => { k.cool = 0.5; });
    } else {
      p.asleep = false; p.sleepT = 0;
      p.vel.addScaledVector(away, 4.5 + power).add(new THREE.Vector3(0, 3, 0));
      p.w.set((this.rng() - 0.5) * 14, (this.rng() - 0.5) * 14, (this.rng() - 0.5) * 14);
      this.events.push({ t: 'kick', mat: p.mat, pos: p.pos.clone() });
    }
    return this.count - before;
  }

  allAsleep() {
    for (const p of this.pieces) if (!p.asleep && p.pos.y > -2) return false;
    return true;
  }

  pickPiece(raycaster) {
    const hits = raycaster.intersectObjects(this.group.children, false);
    for (const h of hits) {
      const p = h.object.userData.piece;
      if (p && !p.dead && !p.coin) {
        const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        return { piece: p, point: h.point.clone(), normal: n };
      }
    }
    return null;
  }

  update(dt) {
    this.acc += Math.min(dt, 0.05);
    let steps = 0;
    while (this.acc >= STEP && steps < 6) { this._step(STEP); this.acc -= STEP; steps++; }
    if (steps === 6) this.acc = 0;
    this.bounceBudget = 12;
    this._processImpacts();
    if (this.pieces.some((p) => p.dead)) this.pieces = this.pieces.filter((p) => !p.dead);
  }

  _processImpacts() {
    const imp = this.impacts;
    for (let i = 0; i < imp.length; i++) {
      const { p, speed } = imp[i];
      if (p.dead) continue;
      if (this.bounceBudget > 0 && speed > 1.3) {
        this.bounceBudget--;
        this.events.push({ t: 'bounce', mat: p.mat, speed, size: p.radius, pos: p.pos.clone() });
      }
      if (this.canSplit(p) && p.cool <= 0 && p.age > 0.05 && this.pieces.length < this.cap) {
        const m = MAT[p.mat];
        const pr = Math.min(1, Math.max(0, (speed - m.split) / 4));
        if (this.rng() < pr * (p.level === 0 ? 1 : 0.75)) this.split(p, 0.6);
      }
    }
    imp.length = 0;
  }

  _step(h) {
    const ps = this.pieces;
    const n = ps.length;
    if (this.dynNext.length < n) this.dynNext = new Int32Array(n * 2);
    this.dynHead.clear();
    const next = this.dynNext;
    const half = this.half;

    // integrate
    for (let i = 0; i < n; i++) {
      const p = ps[i];
      if (p.dead) continue;
      if (!p.asleep) {
        p.age += h; p.cool -= h;
        p.vel.y -= GRAVITY * h;
        p.vel.multiplyScalar(1 - 0.06 * h);
        p.pos.addScaledVector(p.vel, h);
        const wl = p.w.length();
        if (wl > 1e-5) {
          _ax.copy(p.w).multiplyScalar(1 / wl);
          _dq.setFromAxisAngle(_ax, wl * h);
          p.quat.premultiply(_dq).normalize();
        }
        p.w.multiplyScalar(1 - 0.3 * h);
        if (p.pos.y < -18) { this._free(p); continue; }
        this._ground(p, half);
        if (this.walls) this._walls(p, half);
      }
      const k = key3(Math.floor(p.pos.x / CELL), Math.floor(p.pos.y / CELL), Math.floor(p.pos.z / CELL));
      const hd = this.dynHead.get(k);
      next[i] = hd === undefined ? -1 : hd;
      this.dynHead.set(k, i);
    }

    // collisions: obstacles (remaining object shards) and other fragments
    for (let i = 0; i < n; i++) {
      const A = ps[i];
      if (A.dead || A.asleep) continue;
      const ix = Math.floor(A.pos.x / CELL), iy = Math.floor(A.pos.y / CELL), iz = Math.floor(A.pos.z / CELL);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const k = key3(ix + dx, iy + dy, iz + dz);
        const sl = this.statics.length ? this.staticHash.get(k) : undefined;
        if (sl) for (let s = 0; s < sl.length; s++) this._vsStatic(A, this.statics[sl[s]]);
        let j = this.dynHead.get(k);
        while (j !== undefined && j !== -1) {
          const B = ps[j];
          if (j !== i && !B.dead && (B.asleep || j > i)) this._vsPiece(A, B);
          j = next[j];
        }
      }
      // sleeping
      if (A.vel.lengthSq() < 0.08 && A.w.lengthSq() < 0.5) {
        A.sleepT += h;
        if (A.sleepT > 0.35) { A.asleep = true; A.vel.set(0, 0, 0); A.w.set(0, 0, 0); }
      } else A.sleepT = 0;
      if (A.age > 7 && A.pos.y < 0.8) { A.asleep = true; A.vel.set(0, 0, 0); A.w.set(0, 0, 0); }
    }
  }

  /** Back walls of a room diorama: fragments bounce off them instead of flying through. */
  _walls(p, half) {
    if (p.pos.y < -0.4) return;
    const lim = -half + p.radius * 0.8;
    if (p.pos.x < lim && p.pos.z > -half - 0.5) {
      p.pos.x = lim;
      if (p.vel.x < 0) { if (-p.vel.x > 2.5) this.impacts.push({ p, speed: -p.vel.x * 0.8 }); p.vel.x *= -0.32; p.w.multiplyScalar(0.9); }
    }
    if (p.pos.z < lim && p.pos.x > -half - 0.5) {
      p.pos.z = lim;
      if (p.vel.z < 0) { if (-p.vel.z > 2.5) this.impacts.push({ p, speed: -p.vel.z * 0.8 }); p.vel.z *= -0.32; p.w.multiplyScalar(0.9); }
    }
  }

  _ground(p, half) {
    if (Math.abs(p.pos.x) > half || Math.abs(p.pos.z) > half) return;
    if (p.pos.y > p.radius + 0.02 || p.pos.y < -0.8) return;
    let deepest = 0, maxVn = 0;
    const verts = p.hex.c;
    for (let i = 0; i < 8; i++) {
      _r.copy(verts[i]).applyQuaternion(p.quat);
      const wy = p.pos.y + _r.y;
      if (wy >= 0) continue;
      if (-wy > deepest) deepest = -wy;
      const vx = p.vel.x + (p.w.y * _r.z - p.w.z * _r.y);
      const vy = p.vel.y + (p.w.z * _r.x - p.w.x * _r.z);
      const vz = p.vel.z + (p.w.x * _r.y - p.w.y * _r.x);
      if (vy >= 0) continue;
      if (-vy > maxVn) maxVn = -vy;
      const e = -vy > 1.5 ? p.rest : 0;
      const denom = 1 + (_r.x * _r.x + _r.z * _r.z) * p.invI;
      const jn = (-(1 + e) * vy) / denom;
      p.vel.y += jn;
      p.w.x += p.invI * (-_r.z * jn);
      p.w.z += p.invI * (_r.x * jn);
      const sp = Math.hypot(vx, vz);
      if (sp > 1e-4) {
        const tx = vx / sp, tz = vz / sp;
        const cx = _r.y * tz, cy = _r.z * tx - _r.x * tz, cz = -_r.y * tx;
        const denomT = 1 + (cx * cx + cy * cy + cz * cz) * p.invI;
        let jt = sp / denomT;
        const maxF = p.fric * jn;
        if (jt > maxF) jt = maxF;
        p.vel.x -= tx * jt; p.vel.z -= tz * jt;
        p.w.x -= p.invI * cx * jt; p.w.y -= p.invI * cy * jt; p.w.z -= p.invI * cz * jt;
      }
    }
    if (deepest > 0) {
      if (deepest > 0.004) p.pos.y += (deepest - 0.004) * 0.85;
      p.w.multiplyScalar(0.985);
      if (maxVn > 1) this.impacts.push({ p, speed: maxVn });
    }
  }

  _vsStatic(A, s) {
    const dx = A.pos.x - s.x, dy = A.pos.y - s.y, dz = A.pos.z - s.z;
    const min = A.cr + s.r;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= min * min || d2 < 1e-10) return;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d, pen = min - d;
    A.pos.x += nx * pen * 0.6; A.pos.y += ny * pen * 0.6; A.pos.z += nz * pen * 0.6;
    const vn = A.vel.x * nx + A.vel.y * ny + A.vel.z * nz;
    if (vn < 0) {
      A.vel.x -= nx * vn * 1.3; A.vel.y -= ny * vn * 1.3; A.vel.z -= nz * vn * 1.3;
      A.vel.multiplyScalar(0.97);
    }
  }

  _vsPiece(A, B) {
    const dx = A.pos.x - B.pos.x, dy = A.pos.y - B.pos.y, dz = A.pos.z - B.pos.z;
    const min = A.cr + B.cr;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= min * min || d2 < 1e-10) return;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d, pen = min - d;
    if (B.asleep) {
      A.pos.x += nx * pen * 0.5; A.pos.y += ny * pen * 0.5; A.pos.z += nz * pen * 0.5;
      const vn = A.vel.x * nx + A.vel.y * ny + A.vel.z * nz;
      if (vn < 0) { A.vel.x -= nx * vn * 1.15; A.vel.y -= ny * vn * 1.15; A.vel.z -= nz * vn * 1.15; A.vel.x *= 0.98; A.vel.z *= 0.98; }
    } else {
      const f = pen * 0.25;
      A.pos.x += nx * f; A.pos.y += ny * f; A.pos.z += nz * f;
      B.pos.x -= nx * f; B.pos.y -= ny * f; B.pos.z -= nz * f;
      const vn = (A.vel.x - B.vel.x) * nx + (A.vel.y - B.vel.y) * ny + (A.vel.z - B.vel.z) * nz;
      if (vn < 0) {
        const j = -1.15 * vn * 0.5;
        A.vel.x += nx * j; A.vel.y += ny * j; A.vel.z += nz * j;
        B.vel.x -= nx * j; B.vel.y -= ny * j; B.vel.z -= nz * j;
      }
    }
  }
}
