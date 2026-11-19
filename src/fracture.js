import * as THREE from 'three';
import { MAT } from './materials.js';

// ---------------------------------------------------------------------------
// Pre-fractured shards. Every breakable object is a set of "blocks"; a block is a
// warped 3-D lattice (u,v,w) and every lattice cell is one hexahedral shard.
// Corner index of a cell = a + 2*b + 4*c  (a:u side, b:v side, c:w side).
// Face order: u-, u+, v-, v+, w-, w+.
// ---------------------------------------------------------------------------

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FACES = [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]];
const NB_DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

const _c = new THREE.Color();
const rgb = (hex) => { _c.set(hex); return [_c.r, _c.g, _c.b]; };

export function makeStyle(matKey, color, inner) {
  const m = MAT[matKey];
  const s = rgb(color);
  const i = inner != null ? rgb(inner) : [s[0] * 0.55, s[1] * 0.52, s[2] * 0.58];
  return { s, i, c: rgb(m.cut) };
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Build all shards of one lattice block.
 * spec: {nu,nv,nw,P(u,v,w)->Vector3, wrapU, innerW, mat, color, inner, paint(i,j,k)->hex|null,
 *        hpScale, jitter:[u,v,w], scale, aoH}
 */
export function latticeCells(spec, rng) {
  const { nu, nv, nw, P } = spec;
  const wrap = !!spec.wrapU;
  const J = spec.jitter || [0.24, 0.22, 0.2];
  const nU = wrap ? nu : nu + 1;
  const sc = spec.scale || 1;
  const vtx = [];
  for (let i = 0; i < nU; i++) {
    const colj = [];
    for (let j = 0; j <= nv; j++) {
      const colk = [];
      for (let k = 0; k <= nw; k++) {
        const fu = (wrap || (i > 0 && i < nu)) ? 1 : 0;
        const fv = (j > 0 && j < nv) ? 1 : 0;
        const fw = (k > 0 && k < nw) ? 1 : 0;
        const u = (i + (rng() - 0.5) * J[0] * fu) / nu;
        const v = (j + (rng() - 0.5) * J[1] * fv) / nv;
        const w = (k + (rng() - 0.5) * J[2] * fw) / nw;
        colk.push(P(u, v, w).multiplyScalar(sc));
      }
      colj.push(colk);
    }
    vtx.push(colj);
  }

  const idx = (i, j, k) => (i * nv + j) * nw + k;
  const cells = [];
  const aoH = (spec.aoH || 2.4) * sc;
  const matDef = MAT[spec.mat];
  const styleCache = new Map();

  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      for (let k = 0; k < nw; k++) {
        const abs = [];
        for (let c = 0; c < 2; c++) for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) {
          const ii = wrap ? (i + a) % nu : i + a;
          abs.push(vtx[ii][j + b][k + c]);
        }
        const center = new THREE.Vector3();
        abs.forEach((p) => center.add(p));
        center.multiplyScalar(1 / 8);
        const rel = abs.map((p) => p.clone().sub(center));
        const ao = abs.map((p) => 0.74 + 0.26 * smooth(0, aoH, p.y));
        let radius = 0;
        rel.forEach((p) => { radius = Math.max(radius, p.length()); });
        const bmin = new THREE.Vector3(1e9, 1e9, 1e9), bmax = new THREE.Vector3(-1e9, -1e9, -1e9);
        abs.forEach((p) => { bmin.min(p); bmax.max(p); });

        const kinds = [
          (!wrap && i === 0) ? 's' : 'c',
          (!wrap && i === nu - 1) ? 's' : 'c',
          j === 0 ? 's' : 'c',
          j === nv - 1 ? 's' : 'c',
          k === 0 ? (spec.innerW ? 'i' : 's') : 'c',
          k === nw - 1 ? 's' : 'c'
        ];
        const colorHex = (spec.paint && spec.paint(i, j, k)) || spec.color;
        const sk = colorHex + ':' + (spec.inner ?? -1);
        let style = styleCache.get(sk);
        if (!style) { style = makeStyle(spec.mat, colorHex, spec.inner); styleCache.set(sk, style); }

        const nbs = [];
        for (const d of NB_DIRS) {
          let ni = i + d[0];
          const nj = j + d[1], nk = k + d[2];
          if (wrap) ni = (ni + nu) % nu; else if (ni < 0 || ni >= nu) continue;
          if (nj < 0 || nj >= nv || nk < 0 || nk >= nw) continue;
          const id = idx(ni, nj, nk);
          if (id !== idx(i, j, k) && !nbs.includes(id)) nbs.push(id);
        }

        cells.push({
          local: idx(i, j, k),
          nbs,
          mat: spec.mat,
          style,
          tint: 0.95 + rng() * 0.1,
          hex: { c: rel, ao, kinds },
          center,
          radius,
          bmin, bmax,
          hp: matDef.hp * (spec.hpScale || 1) * (0.88 + rng() * 0.24),
          maxLevel: spec.maxLevel != null ? spec.maxLevel : matDef.maxLevel
        });
      }
    }
  }
  return cells;
}

const _p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const _n = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _cen = new THREE.Vector3();

/** Flat-shaded, vertex-coloured, non-indexed geometry for one shard. */
export function buildHexGeometry(hex, style, tint = 1) {
  const pos = [], nor = [], col = [];
  for (let f = 0; f < 6; f++) {
    const q = FACES[f];
    const kind = hex.kinds[f];
    const base = kind === 's' ? style.s : kind === 'i' ? style.i : style.c;
    const tt = kind === 'c' ? 1 : tint;
    const tris = [[0, 1, 2], [0, 2, 3]];
    for (const t of tris) {
      let a = q[t[0]], b = q[t[1]], c = q[t[2]];
      _a.subVectors(hex.c[b], hex.c[a]);
      _b.subVectors(hex.c[c], hex.c[a]);
      _n.crossVectors(_a, _b);
      const len = _n.length();
      if (len < 1e-9) continue;
      _cen.copy(hex.c[a]).add(hex.c[b]).add(hex.c[c]).multiplyScalar(1 / 3);
      if (_n.dot(_cen) < 0) { const tmp = b; b = c; c = tmp; _n.negate(); }
      _n.multiplyScalar(1 / len);
      for (const ci of [a, b, c]) {
        const p = hex.c[ci];
        pos.push(p.x, p.y, p.z);
        nor.push(_n.x, _n.y, _n.z);
        const ao = kind === 'c' ? 1 : hex.ao[ci];
        col.push(Math.min(1, base[0] * ao * tt), Math.min(1, base[1] * ao * tt), Math.min(1, base[2] * ao * tt));
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

export function hexRadius(hex) {
  let r = 0;
  for (const p of hex.c) r = Math.max(r, p.length());
  return r;
}

/** Axis of the longest dimension (random pick among near-equal ones). */
export function longestAxis(hex, rng) {
  const len = [0, 0, 0];
  const steps = [1, 2, 4];
  for (let ax = 0; ax < 3; ax++) {
    let sum = 0, n = 0;
    for (let idx = 0; idx < 8; idx++) {
      if (idx & steps[ax]) continue;
      sum += hex.c[idx].distanceTo(hex.c[idx + steps[ax]]);
      n++;
    }
    len[ax] = sum / n;
  }
  const mx = Math.max(len[0], len[1], len[2]);
  const cand = [];
  for (let ax = 0; ax < 3; ax++) if (len[ax] >= mx * 0.78) cand.push(ax);
  return cand[Math.floor(rng() * cand.length)];
}

/** Cut a shard in two along axis `ax` at parameter t. Returns [{hex, offset}, {hex, offset}]. */
export function splitHex(hex, ax, t) {
  const step = [1, 2, 4][ax];
  const mid = [], midAo = [];
  for (let idx = 0; idx < 8; idx++) {
    if (idx & step) continue;
    mid[idx] = new THREE.Vector3().lerpVectors(hex.c[idx], hex.c[idx + step], t);
    midAo[idx] = hex.ao[idx] + (hex.ao[idx + step] - hex.ao[idx]) * t;
  }
  const mk = (high) => {
    const c = [], ao = [];
    for (let idx = 0; idx < 8; idx++) {
      const hi = (idx & step) !== 0;
      if (!high) {
        if (!hi) { c.push(hex.c[idx].clone()); ao.push(hex.ao[idx]); }
        else { c.push(mid[idx - step].clone()); ao.push(midAo[idx - step]); }
      } else if (!hi) { c.push(mid[idx].clone()); ao.push(midAo[idx]); }
      else { c.push(hex.c[idx].clone()); ao.push(hex.ao[idx]); }
    }
    const cen = new THREE.Vector3();
    c.forEach((v) => cen.add(v));
    cen.multiplyScalar(1 / 8);
    c.forEach((v) => v.sub(cen));
    const kinds = hex.kinds.slice();
    kinds[high ? ax * 2 : ax * 2 + 1] = 'c';
    return { hex: { c, ao, kinds }, offset: cen };
  };
  return [mk(false), mk(true)];
}

/**
 * Crack ribbons laid on the largest outer face(s) of a shard. Cracks run between
 * edge midpoints (shared with the neighbour shard) so neighbouring cracks connect.
 * Returns {geo, countA, countAll}: draw range 0..countA = light cracks, ..countAll = heavy.
 */
export function buildCrackGeometry(hex, rng, width) {
  const faces = [];
  let best = 0;
  for (let f = 0; f < 6; f++) {
    if (hex.kinds[f] !== 's') continue;
    const q = FACES[f].map((ci) => hex.c[ci]);
    _a.subVectors(q[1], q[0]); _b.subVectors(q[3], q[0]);
    const n = new THREE.Vector3().crossVectors(_a, _b);
    let area = n.length();
    _a.subVectors(q[1], q[2]); _b.subVectors(q[3], q[2]);
    area += new THREE.Vector3().crossVectors(_a, _b).length();
    if (area < 1e-6) continue;
    const fc = q[0].clone().add(q[1]).add(q[2]).add(q[3]).multiplyScalar(0.25);
    n.normalize();
    if (n.dot(fc) < 0) n.negate();
    faces.push({ q, n, area, fc });
    best = Math.max(best, area);
  }
  const A = [], B = [];
  const ribbon = (out, pts, n) => {
    for (let s = 0; s < pts.length - 1; s++) {
      const p0 = pts[s], p1 = pts[s + 1];
      const d = new THREE.Vector3().subVectors(p1, p0);
      if (d.lengthSq() < 1e-8) continue;
      d.normalize();
      const side = new THREE.Vector3().crossVectors(n, d).normalize().multiplyScalar(width * (s === 0 ? 0.7 : 1));
      const lift = n.clone().multiplyScalar(width * 0.35);
      const a = p0.clone().add(lift).add(side), b = p0.clone().add(lift).sub(side);
      const c = p1.clone().add(lift).add(side), e = p1.clone().add(lift).sub(side);
      out.push(a, b, c, b, e, c);
    }
  };
  for (const F of faces) {
    if (F.area < best * 0.7) continue;
    const mids = [0, 1, 2, 3].map((e) => F.q[e].clone().add(F.q[(e + 1) % 4]).multiplyScalar(0.5));
    const jit = (v) => v.clone().add(new THREE.Vector3((rng() - 0.5), (rng() - 0.5), (rng() - 0.5)).multiplyScalar(width * 6));
    const centre = F.fc;
    ribbon(A, [mids[0], jit(centre), mids[2]], F.n);
    ribbon(B, [mids[1], jit(centre), mids[3]], F.n);
  }
  const all = A.concat(B);
  const arr = new Float32Array(all.length * 3);
  all.forEach((v, i) => { arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  return { geo, countA: A.length, countAll: all.length };
}
