import * as THREE from 'three';
import { latticeCells, mulberry32 } from './fracture.js';

// ---------------------------------------------------------------------------
// Object catalogue. Every object returns {blocks, zones}.
//  zones: hidden critical impact zones. at = local centre, rx/ry = radii measured in the
//  camera's screen plane (world units), w = peak strength multiplier.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

/** Thick shell revolved around Y from a centre-line profile [[r,y],...] (bottom -> rim). */
function latheBlock(o) {
  const pr = o.profile, np = pr.length, t = o.t ?? 0.1;
  const segN = [];
  for (let s = 0; s < np - 1; s++) {
    const dr = pr[s + 1][0] - pr[s][0], dy = pr[s + 1][1] - pr[s][1];
    const L = Math.hypot(dr, dy) || 1;
    segN.push([dy / L, -dr / L]);
  }
  const outer = [], inner = [];
  for (let k = 0; k < np; k++) {
    const a = segN[Math.max(0, k - 1)], b = segN[Math.min(np - 2, k)];
    let nr = a[0] + b[0], ny = a[1] + b[1];
    const L = Math.hypot(nr, ny) || 1; nr /= L; ny /= L;
    const dot = Math.max(0.55, nr * b[0] + ny * b[1]);
    const h = (t / 2) / dot;
    outer.push([Math.max(0, pr[k][0] + nr * h), pr[k][1] + ny * h]);
    inner.push([Math.max(0, pr[k][0] - nr * h), pr[k][1] - ny * h]);
  }
  let shift = 0;
  if (o.ground) {
    let mn = 1e9;
    outer.concat(inner).forEach((p) => { mn = Math.min(mn, p[1]); });
    shift = -mn;
  }
  const at = o.at || [0, 0, 0], sxz = o.sxz || [1, 1];
  const P = (u, v, w) => {
    const f = v * (np - 1);
    let s = Math.floor(f);
    if (s > np - 2) s = np - 2;
    if (s < 0) s = 0;
    const g = f - s;
    const r = lerp(lerp(inner[s][0], inner[s + 1][0], g), lerp(outer[s][0], outer[s + 1][0], g), w);
    const y = lerp(lerp(inner[s][1], inner[s + 1][1], g), lerp(outer[s][1], outer[s + 1][1], g), w);
    const a = u * TAU;
    return new THREE.Vector3(r * Math.cos(a) * sxz[0] + at[0], y + shift + at[1], r * Math.sin(a) * sxz[1] + at[2]);
  };
  return {
    nu: o.nu, nv: np - 1, nw: o.nw || 1, P, wrapU: true, innerW: true,
    mat: o.mat, color: o.color, inner: o.inner, paint: o.paint, hpScale: o.hpScale, jitter: o.jitter, aoH: o.aoH, maxLevel: o.maxLevel
  };
}

function boxBlock(o) {
  const [sx, sy, sz] = o.size, at = o.at, rot = o.rot || [0, 0, 0];
  const eul = new THREE.Euler(rot[0], rot[1], rot[2]);
  const P = (u, v, w) => new THREE.Vector3((u - 0.5) * sx, (v - 0.5) * sy, (w - 0.5) * sz).applyEuler(eul).add(new THREE.Vector3(at[0], at[1], at[2]));
  return { nu: o.n[0], nv: o.n[1], nw: o.n[2], P, wrapU: false, mat: o.mat, color: o.color, hpScale: o.hpScale, jitter: o.jitter || [0.2, 0.2, 0.2], aoH: o.aoH, maxLevel: o.maxLevel };
}

/** Cube-to-sphere lattice: a solid ball made of n^3 chunky shards. */
function sphereBlock(o) {
  const r = Array.isArray(o.r) ? o.r : [o.r, o.r, o.r], at = o.at;
  const P = (u, v, w) => {
    const x = 2 * u - 1, y = 2 * v - 1, z = 2 * w - 1;
    const x2 = x * x, y2 = y * y, z2 = z * z;
    return new THREE.Vector3(
      x * Math.sqrt(1 - y2 / 2 - z2 / 2 + (y2 * z2) / 3) * r[0] + at[0],
      y * Math.sqrt(1 - z2 / 2 - x2 / 2 + (z2 * x2) / 3) * r[1] + at[1],
      z * Math.sqrt(1 - x2 / 2 - y2 / 2 + (x2 * y2) / 3) * r[2] + at[2]);
  };
  const n = o.n || 2;
  return { nu: n, nv: n, nw: n, P, wrapU: false, mat: o.mat, color: o.color, hpScale: o.hpScale, jitter: [0.1, 0.1, 0.1], aoH: o.aoH, maxLevel: o.maxLevel };
}

/** Solid revolved body. prof = [[v,r],...] radius along the height (v 0..1). */
function solidLatheBlock(o) {
  const pf = o.prof, at = o.at;
  const rAt = (v) => {
    for (let i = 0; i < pf.length - 1; i++) {
      if (v <= pf[i + 1][0] || i === pf.length - 2) {
        const g = (v - pf[i][0]) / (pf[i + 1][0] - pf[i][0] || 1);
        return lerp(pf[i][1], pf[i + 1][1], Math.min(1, Math.max(0, g)));
      }
    }
    return pf[0][1];
  };
  const P = (u, v, w) => {
    const a = u * TAU, r = rAt(v) * w;
    return new THREE.Vector3(r * Math.cos(a) + at[0], v * o.h + at[1], r * Math.sin(a) + at[2]);
  };
  return {
    nu: o.nu, nv: o.nv, nw: o.nw || 1, P, wrapU: true, mat: o.mat, color: o.color, paint: o.paint,
    hpScale: o.hpScale, jitter: o.jitter || [0.18, 0.16, 0.12], aoH: o.aoH, maxLevel: o.maxLevel
  };
}

/** Curved bar (handle, spout) following a planar curve in XY. */
function arcBlock(o) {
  const P = (u, v, w) => {
    const c = o.curve(u);
    const c1 = o.curve(Math.max(0, u - 0.01)), c2 = o.curve(Math.min(1, u + 0.01));
    let tx = c2[0] - c1[0], ty = c2[1] - c1[1];
    const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
    return new THREE.Vector3(c[0] - ty * (v - 0.5) * o.sv, c[1] + tx * (v - 0.5) * o.sv, (w - 0.5) * o.sw);
  };
  return { nu: o.n, nv: 1, nw: 1, P, wrapU: false, mat: o.mat, color: o.color, hpScale: o.hpScale, jitter: [0.15, 0, 0], aoH: o.aoH, maxLevel: o.maxLevel };
}

const bez = (p0, p1, p2) => (t) => [
  (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
  (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
];
const mirrorX = (f) => (t) => { const p = f(t); return [-p[0], p[1]]; };

// ---------------------------------------------------------------------------

export { boxBlock, sphereBlock, solidLatheBlock };

export const OBJECTS = {
  clay_pot: {
    name: 'Clay Pot', icon: '🏺',
    build(v) {
      return {
        blocks: [latheBlock({
          profile: [[0, 0], [0.45, 0], [0.78, 0.03], [0.95, 0.22], [1.05, 0.62], [1.0, 1.0], [0.88, 1.35], [0.84, 1.6], [0.95, 1.72]],
          t: 0.15, nu: 9, mat: 'terracotta', color: v.col ?? 0xe58a60, inner: 0x9a4a2f, ground: true, aoH: 1.8,
          paint: (i, j) => (j === 5 ? 0xc96a45 : (j === 4 && i % 2 === 0 ? 0xf6cf7a : null))
        })],
        zones: [{ at: [0, 0.65, 0], rx: 0.62, ry: 0.5, w: 1 }]
      };
    }
  },

  flower_pot: {
    name: 'Flower Pot', icon: '🪴',
    breakScale: 0.85,
    build(v) {
      return {
        blocks: [
          latheBlock({
            profile: [[0, 0], [0.4, 0], [0.62, 0.03], [0.8, 0.5], [0.82, 0.85], [0.98, 0.93], [0.98, 1.15]],
            t: 0.13, nu: 9, mat: 'terracotta', color: v.col ?? 0xee9a72, inner: 0x9a4a2f, ground: true, aoH: 1.6,
            paint: (i, j) => (j === 5 ? 0xf8b690 : null)
          }),
          solidLatheBlock({ prof: [[0, 0.74], [1, 0.74]], h: 0.12, at: [0, 0.95, 0], nu: 8, nv: 1, nw: 2, mat: 'soil', color: 0x7e563a }),
          boxBlock({ size: [0.09, 1.0, 0.09], at: [0, 1.55, 0], n: [1, 3, 1], mat: 'plant', color: 0x62bb5c }),
          boxBlock({ size: [0.42, 0.05, 0.2], at: [0.24, 1.4, 0], rot: [0, 0, 0.5], n: [1, 1, 1], mat: 'plant', color: 0x7fd36d }),
          boxBlock({ size: [0.42, 0.05, 0.2], at: [-0.24, 1.68, 0], rot: [0, 0, -0.5], n: [1, 1, 1], mat: 'plant', color: 0x7fd36d }),
          sphereBlock({ r: 0.2, at: [0, 2.2, 0], n: 2, mat: 'plant', color: 0xffd45e }),
          ...[0, 1, 2, 3, 4, 5].map((k) => {
            const a = (k / 6) * TAU;
            return boxBlock({ size: [0.34, 0.2, 0.07], at: [Math.cos(a) * 0.36, 2.2 + Math.sin(a) * 0.36, 0], rot: [0, 0, a], n: [1, 1, 1], mat: 'plant', color: v.col2 ?? 0xff8fb8 });
          })
        ],
        zones: [{ at: [0, 0.5, 0], rx: 0.55, ry: 0.42, w: 1 }]
      };
    }
  },

  mug: {
    name: 'Ceramic Mug', icon: '☕',
    build(v) {
      const col = v.col ?? 0xfaf6ef, band = v.col2 ?? 0x5fa8f0;
      return {
        blocks: [
          latheBlock({
            profile: [[0, 0], [0.42, 0], [0.74, 0.03], [0.82, 0.5], [0.84, 1.0], [0.86, 1.5]],
            t: 0.13, nu: 10, mat: 'ceramic', color: col, inner: 0xd8cfc0, ground: true, aoH: 1.5,
            paint: (i, j) => (j === 3 ? band : null)
          }),
          arcBlock({ curve: (t) => { const a = -1.9 + 3.8 * t; return [0.84 + 0.4 * Math.cos(a), 0.78 + 0.4 * Math.sin(a)]; }, sv: 0.17, sw: 0.15, n: 5, mat: 'ceramic', color: col })
        ],
        zones: [{ at: [0, 0.7, 0], rx: 0.6, ry: 0.45, w: 1 }]
      };
    }
  },

  plates: {
    name: 'Plate Stack', icon: '🍽️',
    breakScale: 0.5,
    build(v) {
      const mk = (y, c) => latheBlock({
        profile: [[0, 0.04], [0.55, 0.04], [0.95, 0.2], [1.25, 0.4]], t: 0.08, nu: 9, at: [0, y, 0],
        mat: 'ceramic', color: c, inner: 0xe6dfd0, aoH: 0.9, paint: (i, j) => (j === 2 ? (v.col2 ?? 0x6fb4f2) : null)
      });
      return {
        blocks: [mk(0, v.col ?? 0xfffaf0), mk(0.12, 0xfff3e0), mk(0.24, v.col ?? 0xfffaf0)],
        zones: [{ at: [0, 0.35, 0], rx: 0.85, ry: 0.5, w: 1 }]
      };
    }
  },

  ceramic_vase: {
    name: 'Ceramic Vase', icon: '🏺',
    build(v) {
      const col = v.col ?? 0xf6f2ea, band = v.col2 ?? 0x4a86d9;
      return {
        blocks: [latheBlock({
          profile: [[0, 0], [0.5, 0], [0.8, 0.03], [0.98, 0.4], [1.1, 0.9], [1.0, 1.4], [0.64, 1.88], [0.44, 2.18], [0.47, 2.38], [0.6, 2.5]],
          t: 0.13, nu: 10, mat: 'ceramic', color: col, inner: 0xc9c2b4, ground: true, aoH: 2.2,
          paint: (i, j) => ((j === 2 || j === 6) ? band : (j === 4 && i % 2 === 0 ? band : null))
        })],
        zones: [{ at: [0, 0.95, 0], rx: 0.66, ry: 0.5, w: 1 }]
      };
    }
  },

  teapot: {
    name: 'Teapot', icon: '🫖',
    breakScale: 0.92,
    build(v) {
      const col = v.col ?? 0xf7a8c4, acc = v.col2 ?? 0xffe08a;
      return {
        blocks: [
          latheBlock({
            profile: [[0, 0], [0.5, 0], [0.88, 0.05], [1.08, 0.42], [1.08, 0.85], [0.82, 1.2], [0.56, 1.32]],
            t: 0.12, nu: 10, mat: 'ceramic', color: col, inner: 0xcf8aa5, ground: true, aoH: 1.6,
            paint: (i, j) => (j === 1 ? acc : null)
          }),
          latheBlock({ profile: [[0.6, 1.3], [0.42, 1.46], [0.18, 1.57], [0, 1.6]], t: 0.1, nu: 10, mat: 'ceramic', color: acc, inner: 0xcfae5a }),
          sphereBlock({ r: 0.14, at: [0, 1.7, 0], n: 1, mat: 'ceramic', color: col }),
          arcBlock({ curve: bez([0.95, 0.45], [1.6, 0.55], [1.78, 1.3]), sv: 0.2, sw: 0.17, n: 4, mat: 'ceramic', color: col }),
          arcBlock({ curve: bez([-0.95, 1.0], [-1.95, 1.05], [-1.0, 0.3]), sv: 0.2, sw: 0.17, n: 5, mat: 'ceramic', color: col })
        ],
        zones: [{ at: [0, 0.7, 0], rx: 0.7, ry: 0.5, w: 1 }]
      };
    }
  },

  big_vase: {
    name: 'Thick Vase', icon: '🏺',
    build(v) {
      const col = v.col ?? 0x4a7fd0, band = v.col2 ?? 0xf6f2ea;
      return {
        blocks: [latheBlock({
          profile: [[0, 0], [0.6, 0], [0.95, 0.03], [1.2, 0.45], [1.3, 1.0], [1.15, 1.7], [0.75, 2.15], [0.6, 2.4], [0.72, 2.55], [0.9, 2.62]],
          t: 0.22, nu: 9, mat: 'ceramic', color: col, inner: 0x2f5694, ground: true, aoH: 2.4, hpScale: 1.5,
          paint: (i, j) => ((j === 4 || j === 1) ? band : null)
        })],
        zones: [{ at: [0, 1.0, 0], rx: 0.72, ry: 0.52, w: 1 }]
      };
    }
  },

  glass_bottle: {
    name: 'Glass Bottle', icon: '🍾',
    breakScale: 0.72,
    build(v) {
      return {
        blocks: [latheBlock({
          profile: [[0, 0], [0.35, 0], [0.62, 0.05], [0.72, 0.22], [0.72, 0.95], [0.62, 1.3], [0.3, 1.7], [0.24, 2.0], [0.25, 2.45], [0.33, 2.55], [0.3, 2.65]],
          t: 0.07, nu: 9, mat: 'glass', color: v.col ?? 0x58c98a, inner: 0x3da36d, ground: true, aoH: 2.6
        })],
        zones: [{ at: [0, 1.4, 0], rx: 0.42, ry: 0.42, w: 1 }]
      };
    }
  },

  wooden_crate: {
    name: 'Wooden Crate', icon: '📦',
    build(v) {
      const a = v.col ?? 0xe6ac63, b = 0xd99a4e;
      const blocks = [];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        blocks.push(boxBlock({ size: [0.2, 1.6, 0.2], at: [sx * 0.8, 0.8, sz * 0.8], n: [1, 3, 1], mat: 'wood', color: 0xc98640 }));
      }
      [0.3, 0.8, 1.3].forEach((y, r) => {
        for (const s of [-1, 1]) {
          blocks.push(boxBlock({ size: [1.5, 0.4, 0.1], at: [0, y, s * 0.8], n: [3, 1, 1], mat: 'wood', color: r % 2 ? a : b }));
          blocks.push(boxBlock({ size: [0.1, 0.4, 1.5], at: [s * 0.8, y, 0], n: [1, 1, 3], mat: 'wood', color: r % 2 ? b : a }));
        }
      });
      [-0.52, 0, 0.52].forEach((z, r) => blocks.push(boxBlock({ size: [1.7, 0.1, 0.5], at: [0, 1.65, z], n: [3, 1, 1], mat: 'wood', color: r % 2 ? b : a })));
      return { blocks, zones: [{ at: [0, 0.85, 0], rx: 0.75, ry: 0.7, w: 1 }] };
    }
  },

  barrel: {
    name: 'Oak Barrel', icon: '🛢️',
    build(v) {
      const hoop = (y, r) => latheBlock({ profile: [[r, y - 0.07], [r, y + 0.07]], t: 0.06, nu: 10, mat: 'metal', color: 0x8d97ab, inner: 0x5f6778 });
      return {
        blocks: [
          latheBlock({
            profile: [[0, 0], [0.5, 0], [0.82, 0.01], [0.94, 0.4], [1.0, 0.85], [0.94, 1.3], [0.82, 1.7]],
            t: 0.12, nu: 10, mat: 'wood', color: v.col ?? 0xe0a35e, inner: 0x9a6a38, ground: true, aoH: 1.7,
            paint: (i) => (i % 2 ? 0xd79953 : null)
          }),
          hoop(0.4, 0.99), hoop(1.3, 0.99)
        ],
        zones: [{ at: [0, 0.85, 0], rx: 0.7, ry: 0.55, w: 1 }]
      };
    }
  },

  brick_wall: {
    name: 'Brick Wall', icon: '🧱',
    build(v) {
      const blocks = [];
      const cols = [0xea927a, 0xe08569, 0xf19e84, 0xd97b60];
      let ci = 0;
      for (let r = 0; r < 5; r++) {
        const y = 0.22 + r * 0.44;
        const xs = r % 2 === 0 ? [-0.94, 0, 0.94] : [-0.47, 0.47];
        xs.forEach((x) => blocks.push(boxBlock({ size: [0.9, 0.42, 0.55], at: [x, y, 0], n: [2, 1, 2], mat: 'brick', color: v.col ?? cols[(ci++) % 4], jitter: [0.25, 0, 0.2] })));
        if (r % 2) [-1.41, 1.41].forEach((x) => blocks.push(boxBlock({ size: [0.45, 0.42, 0.55], at: [x, y, 0], n: [1, 1, 2], mat: 'brick', color: cols[(ci++) % 4], jitter: [0, 0, 0.2] })));
      }
      return { blocks, zones: [{ at: [0, 1.1, 0], rx: 0.95, ry: 0.7, w: 1 }] };
    }
  },

  piggy_bank: {
    name: 'Piggy Bank', icon: '🐷',
    coins: 9,
    build(v) {
      const col = v.col ?? 0xf6a5c0, dark = 0xee86a8;
      const blocks = [
        latheBlock({
          profile: [[0, 0], [0.46, 0.12], [0.8, 0.46], [0.92, 0.92], [0.8, 1.38], [0.46, 1.72], [0, 1.84]],
          t: 0.13, nu: 10, mat: 'ceramic', color: col, inner: 0xcf7a98, at: [0, 0.36, 0], sxz: [1.25, 1], aoH: 2.2
        }),
        boxBlock({ size: [0.34, 0.34, 0.42], at: [1.3, 1.1, 0], n: [1, 1, 1], mat: 'ceramic', color: dark }),
        boxBlock({ size: [0.26, 0.32, 0.08], at: [0.55, 2.05, 0.4], rot: [0.3, 0, -0.2], n: [1, 1, 1], mat: 'ceramic', color: dark }),
        boxBlock({ size: [0.26, 0.32, 0.08], at: [0.55, 2.05, -0.4], rot: [-0.3, 0, -0.2], n: [1, 1, 1], mat: 'ceramic', color: dark }),
        boxBlock({ size: [0.08, 0.3, 0.08], at: [-1.2, 1.4, 0], rot: [0, 0, 0.6], n: [1, 1, 1], mat: 'ceramic', color: dark })
      ];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        blocks.push(boxBlock({ size: [0.3, 0.5, 0.3], at: [sx * 0.62, 0.25, sz * 0.4], n: [1, 1, 1], mat: 'ceramic', color: dark }));
      }
      return { blocks, zones: [{ at: [0, 1.15, 0], rx: 0.85, ry: 0.6, w: 1 }] };
    }
  },

  gnome: {
    name: 'Garden Gnome', icon: '🍄',
    breakScale: 0.62,
    build(v) {
      return {
        blocks: [
          solidLatheBlock({ prof: [[0, 0.62], [0.5, 0.55], [1, 0.44]], h: 1.1, at: [0, 0, 0], nu: 8, nv: 3, nw: 2, mat: 'ceramic', color: v.col ?? 0x5b8def, paint: (i, j) => (j === 1 ? 0xf2c14e : null) }),
          sphereBlock({ r: 0.34, at: [0, 1.4, 0], n: 2, mat: 'ceramic', color: 0xf6cfae }),
          sphereBlock({ r: 0.11, at: [0, 1.35, 0.34], n: 1, mat: 'ceramic', color: 0xf0a090 }),
          sphereBlock({ r: [0.3, 0.34, 0.2], at: [0, 1.12, 0.2], n: 2, mat: 'ceramic', color: 0xffffff }),
          solidLatheBlock({ prof: [[0, 0.42], [1, 0.02]], h: 1.0, at: [0, 1.62, 0], nu: 8, nv: 3, nw: 1, mat: 'ceramic', color: v.col2 ?? 0xe5484d })
        ],
        zones: [
          { at: [0, 0.55, 0], rx: 0.58, ry: 0.5, w: 1 },
          { at: [0, 2.3, 0], rx: 0.3, ry: 0.36, w: 0.85 }
        ]
      };
    }
  },

  stone_statue: {
    name: 'Stone Guardian', icon: '🗿',
    build(v) {
      const marble = v.col ?? 0xe9e6f0;
      return {
        blocks: [
          boxBlock({ size: [1.7, 0.5, 1.7], at: [0, 0.25, 0], n: [3, 1, 3], mat: 'stone', color: 0xcfcad6, jitter: [0.25, 0, 0.25] }),
          solidLatheBlock({ prof: [[0, 0.68], [0.4, 0.5], [0.75, 0.62], [1, 0.4]], h: 1.3, at: [0, 0.5, 0], nu: 8, nv: 4, nw: 2, mat: 'stone', color: marble }),
          solidLatheBlock({ prof: [[0, 0.17], [1, 0.17]], h: 0.26, at: [0, 1.78, 0], nu: 6, nv: 1, nw: 1, mat: 'stone', color: marble, hpScale: 0.6 }),
          sphereBlock({ r: 0.38, at: [0, 2.3, 0], n: 2, mat: 'stone', color: marble }),
          solidLatheBlock({ prof: [[0, 0.34], [1, 0.1]], h: 0.3, at: [0, 2.55, 0], nu: 6, nv: 1, nw: 1, mat: 'stone', color: v.col2 ?? 0xf4cf6a }),
          boxBlock({ size: [0.2, 0.9, 0.2], at: [0.66, 1.4, 0], n: [1, 3, 1], mat: 'stone', color: marble }),
          boxBlock({ size: [0.2, 0.9, 0.2], at: [-0.66, 1.4, 0], n: [1, 3, 1], mat: 'stone', color: marble })
        ],
        zones: [
          { at: [0, 1.92, 0], rx: 0.36, ry: 0.3, w: 1 },
          { at: [0, 1.0, 0], rx: 0.62, ry: 0.45, w: 0.9 },
          { at: [0, 0.52, 0], rx: 0.85, ry: 0.2, w: 0.75 }
        ]
      };
    }
  },

  urn: {
    name: 'Ornate Urn', icon: '⚱️',
    build(v) {
      const col = v.col ?? 0xf2e6cf, gold = 0xd4a64a, blue = v.col2 ?? 0x5b8ec9;
      const h1 = bez([0.9, 1.45], [1.75, 1.55], [0.55, 2.1]);
      return {
        blocks: [
          latheBlock({
            profile: [[0, 0], [0.5, 0], [0.72, 0.06], [0.58, 0.28], [0.46, 0.5], [0.86, 1.0], [1.04, 1.4], [0.84, 1.85], [0.5, 2.08], [0.52, 2.22], [0.76, 2.34]],
            t: 0.2, nu: 9, mat: 'ceramic', color: col, inner: 0xc9b99a, ground: true, aoH: 2.4, hpScale: 1.25,
            paint: (i, j) => (j === 5 ? gold : (j === 3 ? blue : null))
          }),
          arcBlock({ curve: h1, sv: 0.2, sw: 0.17, n: 5, mat: 'ceramic', color: gold, hpScale: 1.25 }),
          arcBlock({ curve: mirrorX(h1), sv: 0.2, sw: 0.17, n: 5, mat: 'ceramic', color: gold, hpScale: 1.25 })
        ],
        zones: [
          { at: [0, 1.15, 0], rx: 0.7, ry: 0.5, w: 1 },
          { at: [0, 0.4, 0], rx: 0.5, ry: 0.25, w: 0.7 }
        ]
      };
    }
  },

  trophy: {
    name: 'Golden Trophy', icon: '🏆',
    breakScale: 1.25,
    build(v) {
      const h1 = bez([0.9, 1.5], [1.6, 1.7], [1.0, 2.1]);
      return {
        blocks: [
          latheBlock({
            profile: [[0, 0], [0.65, 0], [0.74, 0.1], [0.5, 0.22], [0.2, 0.38], [0.16, 0.78], [0.42, 1.0], [0.78, 1.3], [0.98, 1.8], [1.02, 2.15]],
            t: 0.14, nu: 9, mat: 'gold', color: v.col ?? 0xffd45e, inner: 0xd9a92c, ground: true, aoH: 2.2
          }),
          arcBlock({ curve: h1, sv: 0.16, sw: 0.14, n: 4, mat: 'gold', color: 0xffd45e }),
          arcBlock({ curve: mirrorX(h1), sv: 0.16, sw: 0.14, n: 4, mat: 'gold', color: 0xffd45e })
        ],
        zones: [
          { at: [0, 1.55, 0], rx: 0.7, ry: 0.5, w: 1 },
          { at: [0, 0.55, 0], rx: 0.3, ry: 0.3, w: 0.8 }
        ]
      };
    }
  }
};

// ---------------------------------------------------------------------------

/**
 * Build all shards of an object, link them into a support graph and flag the base.
 * Returns {cells, zones, size, height, orphans, coins, name, icon}.
 */
export function assemble(type, variant = {}, seed = 7) {
  const def = OBJECTS[type];
  if (!def) throw new Error('Unknown object type ' + type);
  const v = { scale: 1, hpMul: 1, ...variant };
  const rng = mulberry32(seed * 7919 + 13);
  const built = def.build(v);
  const cells = [];
  built.blocks.forEach((spec, bi) => {
    spec.scale = v.scale;
    spec.hpScale = (spec.hpScale || 1) * v.hpMul;
    const cs = latticeCells(spec, rng);
    const off = cells.length;
    cs.forEach((c) => {
      c.id = cells.length;
      c.block = bi;
      c.nbs = c.nbs.map((n) => n + off);
      cells.push(c);
    });
  });

  // cross-block adjacency by overlapping bounding boxes
  const eps = 0.06 * v.scale;
  for (let a = 0; a < cells.length; a++) {
    for (let b = a + 1; b < cells.length; b++) {
      const A = cells[a], B = cells[b];
      if (A.block === B.block) continue;
      if (A.bmin.x - eps > B.bmax.x || B.bmin.x - eps > A.bmax.x) continue;
      if (A.bmin.y - eps > B.bmax.y || B.bmin.y - eps > A.bmax.y) continue;
      if (A.bmin.z - eps > B.bmax.z || B.bmin.z - eps > A.bmax.z) continue;
      A.nbs.push(b); B.nbs.push(a);
    }
  }

  const baseTol = 0.13 * v.scale;
  cells.forEach((c) => { c.base = c.bmin.y < baseTol; });

  // anything not reachable from the base would instantly fall - pin it instead
  const seen = new Set();
  const queue = [];
  cells.forEach((c) => { if (c.base) { seen.add(c.id); queue.push(c.id); } });
  while (queue.length) {
    const id = queue.pop();
    for (const n of cells[id].nbs) if (!seen.has(n)) { seen.add(n); queue.push(n); }
  }
  let orphans = 0;
  cells.forEach((c) => { if (!seen.has(c.id)) { c.base = true; orphans++; } });

  let size = 0, height = 0;
  cells.forEach((c) => { size += c.radius; height = Math.max(height, c.bmax.y); });
  size /= cells.length;

  const zones = built.zones.map((z) => ({
    at: new THREE.Vector3(z.at[0], z.at[1], z.at[2]).multiplyScalar(v.scale),
    rx: z.rx * v.scale, ry: z.ry * v.scale, w: z.w ?? 1
  }));

  return { type, name: def.name, icon: def.icon, coins: def.coins || 0, breakScale: def.breakScale || 1, cells, zones, size, height, orphans, scale: v.scale };
}
