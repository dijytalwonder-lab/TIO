import * as THREE from 'three';
import { PLATFORM_HALF } from './config.js';
import { ROOMS } from './levels.js';
import { mulberry32 } from './fracture.js';
import { Diorama, G, put } from './diorama.js';
import { OBJECTS, sphereBlock } from './objects.js';

// ---------------------------------------------------------------------------
// Story-mode locations: cutaway ROOM dioramas. A floating floor slab with two back
// walls (the camera looks into the corner), furniture along the walls and a rug in the
// middle for the object. Everything is merged into a few vertex-coloured meshes so a
// whole room costs only a handful of draw calls.
//
// Layout rules (the object sits in the middle of the screen):
//  - furniture hugs the back walls; the corner behind the object stays plain
//  - the front half of the floor only gets low items, so nothing hides the object
// ---------------------------------------------------------------------------

const H = PLATFORM_HALF;
const WALL_H = 3.3;
const WALL_T = 0.25;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const baseCache = new Map();
const base = (key, make) => {
  let g = baseCache.get(key);
  if (!g) { g = make(); if (g.index) g = g.toNonIndexed(); baseCache.set(key, g); }
  return g;
};
const shade = (c, k) => { _c.set(c).multiplyScalar(k); return _c.getHex(); };

/** Collects boxes / cylinders / blobs (with a transform stack) into ONE vertex-coloured geometry. */
class Batch {
  constructor() { this.pos = []; this.col = []; this.stack = [new THREE.Matrix4()]; this.gl = null; }
  get cur() { return this.stack[this.stack.length - 1]; }
  push(x = 0, y = 0, z = 0, ry = 0) {
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    this.stack.push(this.cur.clone().multiply(m));
    return this;
  }
  pop() { this.stack.pop(); return this; }
  m() { return this; }            // material switch (only meaningful for PartSink)

  add(g, color, x, y, z, sx, sy, sz, rot) {
    if (rot) _e.set(rot[0], rot[1], rot[2]); else _e.set(0, 0, 0);
    _q.setFromEuler(_e);
    _p.set(x, y, z); _s.set(sx, sy, sz);
    _m.compose(_p, _q, _s).premultiply(this.cur);
    _c.set(color);
    const r = _c.r, gr = _c.g, bl = _c.b;
    const a = g.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) {
      _p.set(a[i], a[i + 1], a[i + 2]).applyMatrix4(_m);
      this.pos.push(_p.x, _p.y, _p.z);
      this.col.push(r, gr, bl);
    }
  }
  box(x, y, z, sx, sy, sz, color, rot) { this.add(base('b', () => new THREE.BoxGeometry(1, 1, 1)), color, x, y, z, sx, sy, sz, rot); }
  cyl(x, y, z, rt, rb, h, seg, color, rot) { this.add(base(`c${rt}|${rb}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, 1, seg)), color, x, y, z, 1, h, 1, rot); }
  ball(x, y, z, r, color, sc = [1, 1, 1], det = 0) { this.add(base('i' + det, () => new THREE.IcosahedronGeometry(1, det)), color, x, y, z, r * sc[0], r * sc[1], r * sc[2]); }

  mesh(material, shadow = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.castShadow = shadow; m.receiveShadow = true;
    return m;
  }
}

const litMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });

// ---- furniture (local frame: +z points into the room, y up, origin on the floor at the wall) ----
const F = {
  sofa(b, w, body, cush) {
    const dark = shade(body, 0.84);
    for (const sx of [-1, 1]) for (const sz of [0.15, 0.72]) b.box(sx * (w / 2 - 0.1), 0.06, sz, 0.1, 0.12, 0.1, 0x6b4a3a);
    b.box(0, 0.32, 0.45, w, 0.3, 0.8, body);
    b.box(0, 0.78, 0.12, w, 0.65, 0.22, body);
    for (const s of [-1, 1]) b.box(s * (w / 2 - 0.11), 0.6, 0.45, 0.22, 0.55, 0.8, dark);
    const cw = (w - 0.44) / 2;
    for (const s of [-1, 1]) {
      b.box(s * cw / 2 + s * 0.005, 0.55, 0.52, cw - 0.03, 0.2, 0.6, cush);
      b.box(s * cw / 2, 0.84, 0.31, cw - 0.03, 0.44, 0.16, cush, [-0.18, 0, 0]);
    }
  },
  shelf(b, rng, w, h, frame, cols, gaps = 0.1) {
    const d = 0.42, n = Math.max(2, Math.round(h / 0.55)), gap = (h - 0.06) / n;
    b.box(0, h / 2, 0.03, w, h, 0.06, shade(frame, 0.75));
    for (const s of [-1, 1]) b.box(s * (w / 2 - 0.03), h / 2, d / 2, 0.06, h, d, frame);
    for (let i = 0; i <= n; i++) b.box(0, 0.03 + i * gap, d / 2, w, 0.06, d, frame);
    for (let i = 0; i < n; i++) {
      const y0 = 0.06 + i * gap;
      let x = -w / 2 + 0.1;
      while (x < w / 2 - 0.14) {
        if (rng() < gaps) { x += 0.1 + rng() * 0.22; continue; }
        const bw = 0.06 + rng() * 0.07, bh = gap * (0.5 + rng() * 0.38);
        b.box(x + bw / 2, y0 + bh / 2, 0.22, bw, bh, 0.27, cols[(rng() * cols.length) | 0], rng() < 0.07 ? [0, 0, 0.22] : null);
        x += bw + 0.006;
      }
    }
  },
  lamp(b, shadeCol) {
    b.cyl(0, 0.03, 0, 0.22, 0.25, 0.06, 8, 0x5d5870);
    b.cyl(0, 1.0, 0, 0.025, 0.025, 2.0, 6, 0x5d5870);
    b.gl.cyl(0, 1.95, 0, 0.2, 0.33, 0.42, 8, shadeCol);
  },
  plant(b, s, pot, leaf) {
    b.cyl(0, 0.2 * s, 0, 0.21 * s, 0.15 * s, 0.4 * s, 8, pot);
    b.cyl(0, 0.41 * s, 0, 0.19 * s, 0.19 * s, 0.03 * s, 8, 0x6b4a3a);
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      b.ball(Math.cos(a) * 0.13 * s, (0.62 + (i % 3) * 0.16) * s, Math.sin(a) * 0.13 * s, 0.17 * s, shade(leaf, 0.9 + (i % 3) * 0.08), [0.55, 1.5, 0.55]);
    }
  },
  win(b, w, h, y, frame, curtain, glass) {
    b.gl.box(0, y, 0.03, w - 0.1, h - 0.1, 0.02, glass);
    b.box(0, y + h / 2, 0.05, w + 0.12, 0.1, 0.1, frame);
    b.box(0, y - h / 2, 0.07, w + 0.24, 0.08, 0.15, frame);
    for (const s of [-1, 1]) b.box(s * w / 2, y, 0.05, 0.1, h, 0.1, frame);
    b.box(0, y, 0.05, 0.05, h, 0.07, frame);
    b.box(0, y, 0.05, w, 0.05, 0.07, frame);
    if (curtain) for (const s of [-1, 1]) {
      b.box(s * (w / 2 + 0.14), y + 0.1, 0.13, 0.3, h + 0.4, 0.1, curtain);
      b.box(s * (w / 2 + 0.14), y + h / 2 + 0.3, 0.14, 0.34, 0.06, 0.12, shade(curtain, 0.8));
    }
  },
  roundWin(b, r, y, frame, glass) {
    b.cyl(0, y, 0.05, r + 0.09, r + 0.09, 0.1, 12, frame, [Math.PI / 2, 0, 0]);
    b.gl.cyl(0, y, 0.11, r, r, 0.02, 12, glass, [Math.PI / 2, 0, 0]);
    b.box(0, y, 0.12, 0.05, r * 2, 0.03, frame);
    b.box(0, y, 0.12, r * 2, 0.05, 0.03, frame);
  },
  pic(b, w, h, y, col, art, dot) {
    b.box(0, y, 0.03, w, h, 0.05, col);
    b.box(0, y, 0.06, w - 0.12, h - 0.12, 0.02, art);
    b.cyl(0, y - 0.04, 0.075, Math.min(w, h) * 0.22, Math.min(w, h) * 0.22, 0.01, 10, dot, [Math.PI / 2, 0, 0]);
  },
  counter(b, w, cab, top, door) {
    b.box(0, 0.45, 0.35, w, 0.9, 0.7, cab);
    const n = Math.max(2, Math.round(w / 0.6));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * w / n;
      b.box(x, 0.45, 0.705, w / n - 0.06, 0.74, 0.02, door);
      b.box(x, 0.66, 0.725, 0.14, 0.03, 0.03, 0xffffff);
    }
    b.box(0, 0.93, 0.37, w + 0.06, 0.07, 0.78, top);
  },
  upper(b, w, cab, door) {
    b.box(0, 2.2, 0.2, w, 0.78, 0.4, cab);
    const n = Math.max(2, Math.round(w / 0.55));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * w / n;
      b.box(x, 2.2, 0.405, w / n - 0.05, 0.68, 0.02, door);
      b.box(x, 1.98, 0.425, 0.12, 0.03, 0.03, 0xffffff);
    }
  },
  fridge(b, col) {
    b.box(0, 1.1, 0.4, 0.95, 2.2, 0.8, col);
    b.box(0, 1.5, 0.805, 0.93, 0.025, 0.01, shade(col, 0.78));
    b.box(-0.36, 1.25, 0.83, 0.05, 0.4, 0.05, 0x9aa6b5);
    b.box(-0.36, 1.85, 0.83, 0.05, 0.4, 0.05, 0x9aa6b5);
  },
  trunk(b, w, col, strap) {
    b.box(0, 0.25, 0.3, w, 0.5, 0.55, col);
    b.cyl(0, 0.52, 0.3, 0.275, 0.275, w, 8, col, [0, 0, Math.PI / 2]);
    for (const s of [-1, 0, 1]) b.box(s * w * 0.32, 0.4, 0.3, 0.07, 0.62, 0.6, strap);
    b.box(0, 0.5, 0.6, 0.1, 0.12, 0.04, 0xf0c24b);
  },
  crate(b, s, col) {
    b.box(0, s / 2, 0, s, s, s, col);
    for (const f of [-0.28, 0, 0.28]) b.box(0, s / 2 + f * s, s / 2 + 0.004, s * 1.0, s * 0.11, 0.01, shade(col, 0.78));
    b.box(0, s / 2, s / 2 + 0.006, s * 0.1, s * 1.0, 0.01, shade(col, 0.82));
  },
  wardrobe(b, col) {
    b.box(0, 1.12, 0.36, 1.3, 2.24, 0.72, col);
    b.box(0, 2.26, 0.38, 1.4, 0.1, 0.8, shade(col, 0.85));
    for (const s of [-1, 1]) {
      b.box(s * 0.325, 1.1, 0.735, 0.6, 1.9, 0.02, shade(col, 1.08));
      b.ball(s * 0.07, 1.1, 0.77, 0.035, 0xf0c24b);
    }
  },
  globe(b) {
    b.cyl(0, 0.02, 0, 0.2, 0.22, 0.04, 8, 0x6b4a3a);
    b.cyl(0, 0.35, 0, 0.025, 0.025, 0.65, 6, 0x6b4a3a);
    b.ball(0, 0.85, 0, 0.3, 0x6bb8f0, [1, 1, 1], 1);
    b.ball(0.12, 0.92, 0.18, 0.13, 0x7fd86a, [1, 0.8, 0.5]);
    b.ball(-0.15, 0.75, 0.15, 0.1, 0x7fd86a, [1, 1, 0.5]);
  },
  bunting(b, cols, w) {
    b.box(0, 2.78, 0.04, w, 0.02, 0.02, 0x8a6a5a);
    const n = Math.round(w / 0.3);
    for (let i = 0; i < n; i++) b.cyl(-w / 2 + (i + 0.5) * w / n, 2.64 - Math.sin((i / (n - 1)) * Math.PI) * 0.04, 0.05, 0.14, 0.14, 0.015, 3, cols[i % cols.length], [Math.PI / 2, 0, 0]);
  },
  cubby(b, w, cols) {
    const rows = 2, n = 3, cw = w / n, rh = 0.55;
    b.box(0, 0.03, 0.2, w, 0.06, 0.4, 0xf2e2c4);
    for (let r = 0; r <= rows; r++) b.box(0, r * rh + 0.03, 0.2, w, 0.05, 0.4, 0xf2e2c4);
    for (let c = 0; c <= n; c++) b.box(-w / 2 + c * cw, rows * rh / 2 + 0.03, 0.2, 0.05, rows * rh + 0.05, 0.4, 0xf2e2c4);
    for (let r = 0; r < rows; r++) for (let c = 0; c < n; c++) {
      const x = -w / 2 + (c + 0.5) * cw, y = r * rh + 0.31;
      b.box(x, y - 0.05, 0.22, cw - 0.2, 0.36, 0.3, cols[(r * n + c) % cols.length]);
      b.box(x, y + 0.14, 0.36, cw - 0.2, 0.05, 0.04, shade(cols[(r * n + c) % cols.length], 0.85));
    }
  },
  teddy(b, col) {
    b.ball(0, 0.2, 0, 0.2, col, [1, 1.05, 0.95], 1);
    b.ball(0, 0.5, 0.02, 0.15, col, [1, 1, 1], 1);
    for (const s of [-1, 1]) {
      b.ball(s * 0.12, 0.62, 0, 0.06, col);
      b.ball(s * 0.22, 0.25, 0.08, 0.07, col, [1, 1.3, 1]);
      b.ball(s * 0.12, 0.04, 0.12, 0.08, col, [1, 0.8, 1.3]);
    }
    b.ball(0, 0.47, 0.15, 0.06, shade(col, 1.25));
    b.ball(0, 0.5, 0.19, 0.025, 0x4a3a4a);
  },
  blocks(b, cols, n, s) {
    for (let i = 0; i < n; i++) b.box(((i * 37) % 5 - 2) * 0.01, s / 2 + i * s, 0, s, s, s, cols[i % cols.length], [0, i * 0.35, 0]);
  },

  // ---- character-room furniture ----
  bed(b, w, frame, sheet, blanket, pillow) {
    const dk = shade(frame, 0.82);
    b.box(0, 0.2, 0.5, w, 0.3, 1.0, frame);
    b.box(-w / 2 + 0.04, 0.72, 0.5, 0.08, 0.95, 1.04, dk);
    b.box(w / 2 - 0.03, 0.4, 0.5, 0.06, 0.55, 1.04, dk);
    b.m('plant');
    b.box(0, 0.45, 0.5, w - 0.16, 0.2, 0.92, sheet);
    b.box(0.22, 0.58, 0.52, w - 0.95, 0.1, 0.95, blanket);
    b.box(0.22, 0.44, 0.995, w - 0.95, 0.3, 0.05, blanket);
    b.box(w * 0.26, 0.66, 0.62, 0.5, 0.08, 0.5, shade(blanket, 0.88), [0, 0.4, 0]);
    for (const z of [0.28, 0.72]) b.box(-w / 2 + 0.4, 0.62, z, 0.42, 0.14, 0.34, pillow, [0, (z - 0.5) * 0.5, 0]);
    b.m('wood');
  },
  desk(b, w, top, leg) {
    b.box(0, 0.78, 0.32, w, 0.06, 0.62, top);
    for (const s of [-1, 1]) b.box(s * (w / 2 - 0.05), 0.38, 0.32, 0.07, 0.76, 0.56, leg);
    b.box(0, 0.5, 0.05, w - 0.14, 0.5, 0.04, shade(leg, 0.8));
  },
  monitor(b, body, glow, w = 0.5, h = 0.34) {
    b.box(0, 0.04, 0, 0.18, 0.04, 0.12, body);
    b.box(0, 0.13, 0, 0.04, 0.16, 0.04, body);
    b.box(0, 0.22 + h / 2, 0, w, h, 0.05, body);
    b.gl.box(0, 0.22 + h / 2, 0.03, w - 0.06, h - 0.06, 0.02, glow);
  },
  heart(b, y, col, s = 1) {
    b.gl.ball(-0.15 * s, y + 0.1 * s, 0.05, 0.19 * s, col, [1, 1, 0.4], 1);
    b.gl.ball(0.15 * s, y + 0.1 * s, 0.05, 0.19 * s, col, [1, 1, 0.4], 1);
    b.gl.box(0, y - 0.1 * s, 0.05, 0.3 * s, 0.3 * s, 0.07, col, [0, 0, Math.PI / 4]);
  },
  guitar(b, col) {
    b.ball(0, 0.38, 0.22, 0.3, col, [1, 1.05, 0.34], 1);
    b.ball(0, 0.74, 0.22, 0.22, col, [1, 1, 0.34], 1);
    b.cyl(0, 0.52, 0.33, 0.09, 0.09, 0.03, 10, 0x2d2020, [Math.PI / 2, 0, 0]);
    b.box(0, 1.28, 0.22, 0.09, 1.1, 0.05, 0x5b3a29);
    b.box(0, 1.9, 0.22, 0.14, 0.2, 0.05, 0x3a2418);
  },
  mirror(b, w, h, frame, glass, y0 = 0.08) {
    b.box(0, y0 + h / 2, 0.04, w + 0.14, h + 0.14, 0.06, frame);
    b.gl.box(0, y0 + h / 2, 0.08, w, h, 0.02, glass);
  },
  sneaker(b, col) {
    b.box(0, 0.03, 0, 0.36, 0.06, 0.15, 0xffffff);
    b.box(-0.03, 0.1, 0, 0.28, 0.12, 0.13, col);
    b.box(0.12, 0.08, 0, 0.12, 0.07, 0.12, shade(col, 1.15));
    b.box(-0.16, 0.16, 0, 0.06, 0.1, 0.12, shade(col, 0.8));
  },
  noEntry(b, y) {
    b.cyl(0, y, 0.04, 0.2, 0.2, 0.03, 14, 0xe53935, [Math.PI / 2, 0, 0]);
    b.box(0, y, 0.065, 0.26, 0.07, 0.02, 0xffffff);
  },
  bag(b, col) {
    b.box(0, 2.7, 0.3, 0.05, 0.05, 0.6, 0x3a3a44);
    b.cyl(0, 2.45, 0.58, 0.012, 0.012, 0.5, 4, 0x8a8a96);
    b.cyl(0, 1.7, 0.58, 0.24, 0.24, 0.95, 10, col);
    b.cyl(0, 2.2, 0.58, 0.2, 0.24, 0.06, 10, shade(col, 0.8));
    b.cyl(0, 1.7, 0.58, 0.246, 0.246, 0.12, 10, 0xffffff);
  },
  skate(b, col) {
    b.box(0, 0.5, 0.2, 0.2, 0.95, 0.03, col, [-0.12, 0, 0]);
    for (const s of [-1, 1]) for (const y of [0.1, 0.78]) b.cyl(s * 0.07, y, 0.19 + (y > 0.5 ? -0.09 : 0.0), 0.05, 0.05, 0.04, 8, 0xffe08a, [0, 0, Math.PI / 2]);
  },
  dumbbell(b) {
    b.cyl(0, 0.09, 0, 0.02, 0.02, 0.42, 6, 0x8a8a96, [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) b.cyl(s * 0.2, 0.09, 0, 0.09, 0.09, 0.07, 8, 0x30323c, [0, 0, Math.PI / 2]);
  },
  notebook(b, col) {
    b.box(0, 0.02, 0, 0.3, 0.04, 0.21, col);
    b.box(0.005, 0.045, 0, 0.27, 0.012, 0.18, 0xffffff);
    b.box(-0.12, 0.05, 0, 0.02, 0.012, 0.19, shade(col, 0.8));
  },
  miniTrophy(b) {
    b.box(0, 0.03, 0, 0.14, 0.06, 0.14, 0x6a4b2a);
    b.cyl(0, 0.17, 0, 0.1, 0.05, 0.2, 8, 0xf2c14b);
    for (const s of [-1, 1]) b.ball(s * 0.11, 0.2, 0, 0.04, 0xf2c14b);
  },
  vanity(b, w) {
    const mh = 1.25, my = 1.6, mw = w * 0.7;
    b.box(0, 0.74, 0.3, w, 0.06, 0.56, 0xffffff);
    for (const s of [-1, 1]) b.box(s * (w / 2 - 0.06), 0.36, 0.3, 0.1, 0.72, 0.5, 0xf6dff2);
    b.box(0, 0.62, 0.12, w - 0.2, 0.2, 0.2, 0xf6dff2);
    b.box(0, my, 0.04, mw + 0.2, mh + 0.2, 0.06, 0xf2b8e6);
    b.gl.box(0, my, 0.08, mw, mh, 0.02, 0xe3f4ff);
    for (let i = 0; i < 6; i++) {
      const y = my - mh / 2 + (i + 0.5) * (mh / 6);
      b.gl.ball(-mw / 2 - 0.1, y, 0.1, 0.045, 0xfff3b0);
      b.gl.ball(mw / 2 + 0.1, y, 0.1, 0.045, 0xfff3b0);
    }
    for (let i = 0; i < 7; i++) b.gl.ball(-mw / 2 + (i + 0.5) * (mw / 7), my + mh / 2 + 0.1, 0.1, 0.045, 0xfff3b0);
    b.cyl(-0.4, 0.86, 0.3, 0.025, 0.025, 0.16, 6, 0xff4f86);
    b.cyl(-0.3, 0.84, 0.3, 0.05, 0.05, 0.12, 8, 0xc158e0);
    b.cyl(0.35, 0.82, 0.3, 0.1, 0.1, 0.05, 10, 0xffc0e8);
    b.cyl(0.1, 0.87, 0.28, 0.04, 0.05, 0.18, 8, 0x9be84a);
  },
  stool(b, col) {
    b.cyl(0, 0.38, 0, 0.26, 0.26, 0.1, 10, col);
    for (const s of [-1, 1]) for (const t of [-1, 1]) b.cyl(s * 0.14, 0.17, t * 0.14, 0.025, 0.025, 0.34, 5, 0xffffff);
  },
  bubble(b, w, h, y, col = 0xffffff) {
    b.ball(0, y, 0.04, 1, col, [w / 2, h / 2, 0.025], 1);
    b.box(-w * 0.25, y - h * 0.5, 0.04, 0.12, 0.12, 0.025, col, [0, 0, 0.8]);
    for (const s of [-1, 0, 1]) b.ball(s * w * 0.2, y, 0.075, 0.035, 0xc158e0);
  },
  bigPhone(b, w, h, y) {
    b.box(0, y, 0.05, w, h, 0.08, 0x2b2d42);
    b.gl.box(0, y, 0.1, w - 0.1, h - 0.14, 0.02, 0xe9fbd6);
    b.gl.box(-w * 0.12, y + h * 0.28, 0.115, w * 0.5, 0.1, 0.01, 0xa7e86b);
    b.gl.box(w * 0.1, y + h * 0.08, 0.115, w * 0.55, 0.1, 0.01, 0xffffff);
    b.gl.box(-w * 0.1, y - h * 0.12, 0.115, w * 0.6, 0.1, 0.01, 0xa7e86b);
    b.gl.box(w * 0.08, y - h * 0.32, 0.115, w * 0.45, 0.1, 0.01, 0xffffff);
  },
  teaTable(b) {
    b.cyl(0, 0.34, 0, 0.42, 0.42, 0.05, 12, 0xffffff);
    b.cyl(0, 0.16, 0, 0.05, 0.08, 0.32, 6, 0xf2b8e6);
    for (const [x, z, c] of [[-0.15, 0.1, 0xffc0e8], [0.18, -0.05, 0xc9a8ff], [0.0, -0.22, 0xa7e86b]]) b.cyl(x, 0.42, z, 0.07, 0.05, 0.1, 8, c);
  },
  beanbag(b, col) { b.m('plant'); b.ball(0, 0.28, 0, 0.5, col, [1, 0.62, 1], 1); },
  bottle(b, body, cap = 0x3a2a50) {
    b.cyl(0, 0.17, 0, 0.08, 0.09, 0.34, 8, body);
    b.cyl(0, 0.4, 0, 0.03, 0.05, 0.12, 6, body);
    b.cyl(0, 0.48, 0, 0.045, 0.045, 0.05, 6, cap);
  },
  pinboard(b, w, h, y, rng) {
    b.box(0, y, 0.03, w + 0.14, h + 0.14, 0.05, 0x3a3f4a);
    b.box(0, y, 0.06, w, h, 0.03, 0xb98a58);
    const pics = [];
    for (let i = 0; i < 6; i++) {
      const px = -w / 2 + 0.25 + (i % 3) * (w - 0.5) / 2 + (rng() - 0.5) * 0.1, py = y + (i < 3 ? 0.22 : -0.22) + (rng() - 0.5) * 0.08;
      pics.push([px, py]);
      b.box(px, py, 0.09, 0.28, 0.34, 0.015, 0xf4efe4, [0, 0, (rng() - 0.5) * 0.25]);
      b.box(px, py + 0.02, 0.1, 0.2, 0.2, 0.012, i === 2 ? 0xd96a6a : 0x7d8796);
    }
    for (let i = 0; i < pics.length - 1; i++) {
      const [x1, y1] = pics[i], [x2, y2] = pics[(i * 2 + 1) % pics.length];
      const L = Math.hypot(x2 - x1, y2 - y1);
      if (L < 0.05) continue;
      b.box((x1 + x2) / 2, (y1 + y2) / 2, 0.115, L, 0.012, 0.008, 0xd32f2f, [0, 0, Math.atan2(y2 - y1, x2 - x1)]);
    }
    for (const [px, py] of pics) b.ball(px, py + 0.15, 0.115, 0.022, 0xd32f2f);
  },
  safe(b) {
    b.box(0, 0.36, 0.3, 0.7, 0.72, 0.58, 0x3c4250);
    b.box(0, 0.36, 0.595, 0.58, 0.6, 0.02, 0x4b5262);
    b.cyl(0, 0.4, 0.62, 0.1, 0.1, 0.03, 12, 0xe0b04a, [Math.PI / 2, 0, 0]);
    b.box(0.2, 0.36, 0.62, 0.05, 0.22, 0.04, 0xcfd3dc);
  },
  duffel(b, col) {
    b.cyl(0, 0.22, 0, 0.22, 0.22, 0.8, 10, col, [0, 0, Math.PI / 2]);
    b.box(0, 0.45, 0, 0.5, 0.04, 0.05, shade(col, 0.7));
  },
  lantern(b, y, col = 0xff3b30) {
    b.box(0, y + 0.56, 0.25, 0.04, 0.04, 0.5, 0xf2c14b);
    b.cyl(0, y + 0.4, 0.5, 0.008, 0.008, 0.3, 4, 0xf2c14b);
    b.gl.ball(0, y, 0.5, 0.28, col, [1, 0.85, 1], 1);
    b.cyl(0, y + 0.24, 0.5, 0.1, 0.12, 0.06, 8, 0xf2c14b);
    b.cyl(0, y - 0.24, 0.5, 0.12, 0.1, 0.06, 8, 0xf2c14b);
    b.cyl(0, y - 0.42, 0.5, 0.012, 0.012, 0.3, 4, 0xf2c14b);
    b.ball(0, y - 0.6, 0.5, 0.05, 0xf2c14b);
  },
  scroll(b, w, h, y) {
    b.box(0, y, 0.04, w, h, 0.02, 0xfaf0d6);
    for (const s of [-1, 1]) b.cyl(0, y + s * (h / 2 + 0.03), 0.05, 0.035, 0.035, w + 0.14, 8, 0x8a2420, [0, 0, Math.PI / 2]);
    for (let i = 0; i < 9; i++) b.box(Math.sin(i * 1.3) * 0.09, y - h / 2 + (i + 0.5) * h / 9, 0.06, 0.15, 0.12, 0.012, i % 2 ? 0xd8392b : 0xf2c14b, [0, 0, Math.sin(i) * 0.4]);
  },
  china(b, rng, w, h, frame) {
    const d = 0.46, n = 4, gap = (h - 0.08) / n;
    const W = 0xf6f2ea, BL = 0x3d6fc9, R = 0xd8392b, G = 0x4fb58a, GOLD = 0xf2c14b;
    b.box(0, h / 2, 0.03, w, h, 0.06, shade(frame, 0.7));
    for (const s of [-1, 1]) b.box(s * (w / 2 - 0.04), h / 2, d / 2, 0.08, h, d, frame);
    for (let i = 0; i <= n; i++) b.box(0, 0.04 + i * gap, d / 2, w, 0.07, d, i === n ? GOLD : frame);
    b.box(0, h + 0.1, 0.24, w + 0.24, 0.1, d + 0.1, GOLD);
    for (let r = 0; r < n; r++) {
      const y0 = 0.075 + r * gap;
      let x = -w / 2 + 0.16;
      while (x < w / 2 - 0.36) {
        const kind = (rng() * 5) | 0, c = [W, BL, R, W, G][(rng() * 5) | 0];
        if (kind === 0) {                                         // plates standing on edge
          const rr = 0.19 + rng() * 0.05;
          b.cyl(x + rr, y0 + rr + 0.01, 0.2, rr, rr, 0.04, 14, W, [Math.PI / 2, 0, 0]);
          b.cyl(x + rr, y0 + rr + 0.01, 0.225, rr * 0.7, rr * 0.7, 0.012, 14, BL, [Math.PI / 2, 0, 0]);
          x += 2 * rr + 0.07;
        } else if (kind === 1) {                                  // stacked bowls
          for (let k = 0; k < 3; k++) b.ball(x + 0.17, y0 + 0.1 + k * 0.1, 0.24, 0.17 - k * 0.012, k % 2 ? c : W, [1, 0.62, 1], 1);
          x += 0.4;
        } else if (kind === 2) {                                  // teapot
          b.ball(x + 0.15, y0 + 0.14, 0.24, 0.15, c, [1, 0.85, 1], 1);
          b.ball(x + 0.15, y0 + 0.3, 0.24, 0.06, shade(c, 0.85));
          b.box(x + 0.32, y0 + 0.18, 0.24, 0.12, 0.04, 0.04, c, [0, 0, 0.6]);
          b.box(x - 0.01, y0 + 0.17, 0.24, 0.04, 0.12, 0.04, c);
          x += 0.46;
        } else if (kind === 3) {                                  // tall vase
          b.cyl(x + 0.1, y0 + 0.16, 0.24, 0.1, 0.07, 0.32, 8, c);
          b.cyl(x + 0.1, y0 + 0.36, 0.24, 0.045, 0.06, 0.12, 8, c);
          b.cyl(x + 0.1, y0 + 0.19, 0.24, 0.102, 0.102, 0.04, 8, GOLD);
          x += 0.3;
        } else {                                                  // chopstick jar + chopsticks
          b.cyl(x + 0.08, y0 + 0.1, 0.24, 0.075, 0.07, 0.2, 8, BL);
          for (let k = 0; k < 5; k++) b.box(x + 0.08 + (k - 2) * 0.018, y0 + 0.3, 0.24 + (k % 2) * 0.012, 0.012, 0.28, 0.012, k % 2 ? 0x6b3a22 : 0x2d2020, [0, 0, (k - 2) * 0.08]);
          x += 0.26;
        }
      }
    }
  },
  roundTable(b) {
    b.cyl(0, 0.46, 0, 0.5, 0.5, 0.06, 14, 0x8a2420);
    b.cyl(0, 0.22, 0, 0.07, 0.12, 0.44, 8, 0x6b1a17);
    for (let k = 0; k < 3; k++) b.cyl(0.04, 0.55 + k * 0.1, 0, 0.22, 0.22, 0.09, 12, k % 2 ? 0xd9b27c : 0xc99a68);
    b.cyl(0.04, 0.78, 0, 0.1, 0.22, 0.04, 12, 0xb98a58);
    for (const [x, z, c] of [[-0.3, 0.12, 0xf6f2ea], [0.26, 0.2, 0x3d6fc9]]) b.cyl(x, 0.54, z, 0.07, 0.05, 0.08, 8, c);
  },
  bamboo(b) {
    b.cyl(0, 0.2, 0, 0.22, 0.17, 0.4, 8, 0xb06a3c);
    for (const [x, z, h] of [[-0.06, 0, 2.0], [0.07, 0.04, 1.7], [0.0, -0.06, 1.4]]) {
      for (let k = 0; k < Math.round(h / 0.35); k++) b.cyl(x, 0.45 + k * 0.35 + 0.17, z, 0.04, 0.04, 0.33, 6, 0x6bbf5a);
      for (let k = 0; k < 3; k++) b.ball(x + (k - 1) * 0.1, 0.45 + h - k * 0.1, z, 0.12, 0x4fa04a, [0.4, 1.2, 0.4]);
    }
  },
  cushion(b, col) {
    b.cyl(0, 0.1, 0, 0.3, 0.3, 0.16, 10, col);
    b.cyl(0, 0.19, 0, 0.12, 0.12, 0.02, 10, 0xf2c14b);
  }
};

// ---- the room shell: floor slab, planks / tiles, rug, back walls, trims ----
function shell(b, T, rng) {
  // floor slab
  b.box(-WALL_T / 2, -0.17, -WALL_T / 2, 2 * H + WALL_T, 0.3, 2 * H + WALL_T, T.slab);
  b.box(-WALL_T / 2, -0.04, -WALL_T / 2, 2 * H + WALL_T, 0.04, 2 * H + WALL_T, shade(T.floorA, 0.7));
  if (T.floorStyle === 'checker') {
    const n = 6, t = (2 * H) / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) b.box(-H + (i + 0.5) * t, -0.01, -H + (j + 0.5) * t, t - 0.02, 0.02, t - 0.02, (i + j) % 2 ? T.floorA : T.floorB);
  } else {
    const n = 9, t = (2 * H) / n;
    for (let i = 0; i < n; i++) {
      const cut = -1.3 + rng() * 2.6;
      const c1 = (i % 2 ? T.floorA : T.floorB), c2 = shade(i % 2 ? T.floorB : T.floorA, 0.96 + rng() * 0.08);
      b.box(-H + (i + 0.5) * t, -0.01, (-H + cut) / 2, t - 0.025, 0.02, cut + H - 0.02, c1);
      b.box(-H + (i + 0.5) * t, -0.01, (cut + H) / 2, t - 0.025, 0.02, H - cut - 0.02, c2);
    }
  }
  // rug (the clean pad for the object)
  b.cyl(0, -0.002, 0, 1.75, 1.75, 0.02, 28, T.pad2);
  b.cyl(0, 0.0, 0, 1.62, 1.62, 0.02, 28, T.pad);
  b.cyl(0, 0.002, 0, 1.0, 1.0, 0.02, 28, shade(T.pad, 0.96));

  // back walls
  b.box(-WALL_T / 2, WALL_H / 2, -H - WALL_T / 2, 2 * H + WALL_T, WALL_H, WALL_T, T.wall);
  b.box(-H - WALL_T / 2, WALL_H / 2, 0, WALL_T, WALL_H, 2 * H, T.wall);
  // wainscot + rail + baseboard on both walls
  b.box(0, 0.5, -H + 0.02, 2 * H, 1.0, 0.04, T.wain);
  b.box(-H + 0.02, 0.5, 0, 0.04, 1.0, 2 * H, T.wain);
  b.box(0, 1.02, -H + 0.04, 2 * H, 0.06, 0.08, T.trim);
  b.box(-H + 0.04, 1.02, 0, 0.08, 0.06, 2 * H, T.trim);
  b.box(0, 0.06, -H + 0.05, 2 * H, 0.12, 0.1, T.trim);
  b.box(-H + 0.05, 0.06, 0, 0.1, 0.12, 2 * H, T.trim);
  // wall caps (the cut edges)
  b.box(-WALL_T / 2, WALL_H + 0.03, -H - WALL_T / 2, 2 * H + WALL_T + 0.06, 0.07, WALL_T + 0.06, T.trim);
  b.box(-H - WALL_T / 2, WALL_H + 0.03, 0, WALL_T + 0.06, 0.07, 2 * H, T.trim);
}

const A = (b, x, fn) => { b.push(x, 0, -H, 0); fn(); b.pop(); };                 // on the wall at z = -H (right side of the screen)
const Bw = (b, z, fn) => { b.push(-H, 0, z, Math.PI / 2); fn(); b.pop(); };      // on the wall at x = -H (left side of the screen); local +x = world -z

const BOOKS = [0xff8a8a, 0xffc857, 0x7fd8a6, 0x7cc4ff, 0xb59cff, 0xff9ed2, 0xf2a25c, 0x6fd6c6];

// ---- the rooms (the first five are generic; the rest belong to story characters) ----
const BUILD = {
  living(b, T, rng) {
    A(b, 0.95, () => {
      F.sofa(b, 2.0, 0xff9a8a, 0xffe08a);
      F.win(b, 1.5, 1.05, 1.95, 0xfff5ea, 0xff9ec7, 0xc9ecff);
    });
    A(b, -1.35, () => F.pic(b, 0.55, 0.7, 2.15, 0xb97d55, 0xfff1de, 0xff9a8a));
    Bw(b, 0.6, () => F.shelf(b, rng, 1.5, 2.1, 0xc98a5a, BOOKS));
    Bw(b, -0.45, () => F.plant(b, 1.35, 0xff9a8a, 0x5fd68a));
    b.push(-H + 0.5, 0, 1.85, 0.5); F.lamp(b, 0xffe9a8); b.pop();
    // low pouf on the left rim
    b.cyl(-1.9, 0.18, -0.2, 0.3, 0.3, 0.36, 10, 0xffe08a);
    b.cyl(-1.9, 0.38, -0.2, 0.26, 0.28, 0.04, 10, 0xffc84a);
  },
  kitchen(b) {
    A(b, 0.7, () => {
      F.counter(b, 2.6, 0xfff7e8, 0xffd88f, 0x8fe0cc);
      b.box(-0.55, 0.972, 0.37, 0.7, 0.014, 0.5, 0x9db4c6);
      b.cyl(-0.55, 1.14, 0.12, 0.022, 0.022, 0.34, 6, 0x9aa6b5);
      b.box(-0.55, 1.3, 0.2, 0.03, 0.03, 0.2, 0x9aa6b5);
      for (const s of [0.7, 1.15]) b.cyl(s, 1.0, 0.37, 0.16, 0.16, 0.03, 10, 0x4a4558);
      b.ball(0.2, 1.06, 0.45, 0.09, 0xff6b6b); b.ball(0.35, 1.05, 0.38, 0.08, 0xffc84a);
      F.upper(b, 1.5, 0xfff7e8, 0x8fe0cc);
      b.box(-1.0, 1.7, 0.03, 0.9, 0.02, 0.02, 0x9aa6b5);
      for (let i = 0; i < 3; i++) { b.cyl(-1.2 + i * 0.25, 1.55, 0.1, 0.1, 0.12, 0.16, 8, [0xff9a8a, 0x7cc4ff, 0xffc84a][i]); }
    });
    Bw(b, -0.55, () => F.fridge(b, 0xeafff7));
    Bw(b, 0.95, () => F.win(b, 1.1, 1.1, 1.75, 0xffffff, 0xffd88f, 0xc9ecff));
    b.cyl(-1.95, 0.22, 0.6, 0.3, 0.28, 0.44, 10, 0xffc84a);          // basket / stool on the left rim
  },
  attic(b, T) {
    // beams + corner post
    b.box(-H + 0.12, WALL_H / 2, -H + 0.12, 0.24, WALL_H, 0.24, T.trim);
    b.box(0, 2.7, -H + 0.1, 2 * H, 0.2, 0.2, T.trim);
    b.box(-H + 0.1, 2.7, 0, 0.2, 0.2, 2 * H, T.trim);
    b.box(0, 1.3, -H + 0.08, 2 * H, 0.12, 0.12, shade(T.trim, 1.1));
    for (let i = 0; i < 9; i++) { const x = -H + 0.55 + i * 0.58; b.box(x, 1.9, -H + 0.03, 0.02, 1.7, 0.02, shade(T.wall, 0.82)); b.box(-H + 0.03, 1.9, x, 0.02, 1.7, 0.02, shade(T.wall, 0.82)); }
    A(b, 0.4, () => { F.trunk(b, 1.2, 0xa8754a, 0x6b4a3a); });
    A(b, 1.7, () => { F.crate(b, 0.62, 0xc99a68); b.push(0, 0.62, 0, 0.5); F.crate(b, 0.42, 0xb98a58); b.pop(); });
    Bw(b, -0.9, () => F.wardrobe(b, 0xb7834f));
    Bw(b, 1.1, () => F.roundWin(b, 0.5, 1.9, 0x8a5d3b, 0xffe9b8));
    A(b, -1.2, () => { b.gl.ball(0, 2.15, 0.12, 0.1, 0xfff0b0); b.box(0, 2.3, 0.08, 0.02, 0.2, 0.02, 0x5d5870); });
    b.push(-1.85, 0, 1.2, 0.4); F.crate(b, 0.45, 0xd9aa72); b.pop();
    b.cyl(-1.75, 0.04, 0.5, 0.35, 0.35, 0.05, 12, 0xff9a8a);         // old rolled cloth on the floor
  },
  library(b, T, rng) {
    A(b, 0.4, () => F.shelf(b, rng, 2.6, 2.9, 0x9a6b48, BOOKS, 0.06));
    Bw(b, 0.4, () => F.shelf(b, rng, 2.6, 2.9, 0x9a6b48, BOOKS, 0.06));
    b.push(1.75, 0, -0.55, 0); F.globe(b); b.pop();
    b.push(-1.9, 0, 1.0, 0); b.cyl(0, 0.17, 0, 0.3, 0.3, 0.34, 10, 0x7d5fd1); b.cyl(0, 0.36, 0, 0.26, 0.26, 0.04, 10, 0xa88cf0); b.pop();
    A(b, -1.05, () => F.lamp(b, 0xffe2a0));
    for (let i = 0; i < 4; i++) b.box(-1.8 + i * 0.01, 0.06 + i * 0.12, 1.75, 0.42 - i * 0.03, 0.11, 0.3, BOOKS[(i * 2 + 1) % BOOKS.length], [0, 0.3 + i * 0.4, 0]);
  },
  playroom(b, T) {
    const cols = [0xff8a8a, 0xffc857, 0x7fd8a6, 0x7cc4ff, 0xb59cff, 0xff9ed2];
    // polka dots on the walls
    for (let i = 0; i < 10; i++) {
      const u = -2.1 + (i % 5) * 1.05 + (i > 4 ? 0.5 : 0), y = 1.75 + (i > 4 ? 0.55 : 0.0) + (i % 2) * 0.25;
      b.cyl(u, y, -H + 0.03, 0.1, 0.1, 0.012, 10, shade(T.wain, 1.0), [Math.PI / 2, 0, 0]);
      b.cyl(-H + 0.03, y, u, 0.1, 0.1, 0.012, 10, shade(T.wain, 1.0), [0, 0, Math.PI / 2]);
    }
    A(b, 0.55, () => { F.cubby(b, 2.4, cols); F.bunting(b, cols, 2.4); });
    Bw(b, 0.6, () => { F.bunting(b, cols.slice().reverse(), 2.2); F.pic(b, 0.7, 0.55, 2.0, 0xffffff, 0xaee3ff, 0xffb02e); });
    Bw(b, 0.9, () => { b.box(0, 0.25, 0.32, 1.1, 0.5, 0.55, 0x7cc4ff); b.box(0, 0.54, 0.32, 1.16, 0.08, 0.6, 0xffffff); });
    b.push(-1.7, 0, 1.3, 0.8); F.teddy(b, 0xc99a68); b.pop();
    b.push(1.9, 0, -1.3, 0); F.blocks(b, cols, 4, 0.27); b.pop();
    b.box(-0.2, 0.06, 2.05, 0.28, 0.12, 0.28, 0xffc857, [0, 0.4, 0]);
    b.box(0.25, 0.06, 2.2, 0.28, 0.12, 0.28, 0xff8a8a, [0, -0.3, 0]);
  }
};

// ---------------------------------------------------------------------------
// STORY ROOMS are SETS: a static `decor` layer (shell extras, signs, hanging bits) plus named furniture PIECES.
// A piece is drawn by the same helper code in two ways:
//   - as part of the static room mesh (the normal look of the room), or
//   - as a real breakable (PartSink -> fracture lattice) when a story level makes it "live".
// A level lists its live pieces; pieces smashed earlier in the chapter are simply left out of the room.
// wall: 'A' (back wall on the screen's right, at = x) | 'B' (left wall, at = z) | 'W' (free standing, at = [x, z, yaw]).
// Piece geometry is drawn in the piece's own frame: origin on the floor, +z into the room, y up.
// ---------------------------------------------------------------------------
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const _pq = new THREE.Quaternion(), _pe = new THREE.Euler(), _pp = new THREE.Vector3(), _ps = new THREE.Vector3(1, 1, 1);

/** Same drawing API as Batch, but collects fracture blocks (one per box / cylinder / ball). */
class PartSink {
  constructor(o = {}) {
    this.stack = [new THREE.Matrix4()];
    this.parts = [];
    this.mat = 'wood';
    this.cs = o.cs || 0.38;
    this.hp = o.hp || 0.85;
    this.cap = o.cap || 70;
    const me = this;
    const glow = (kind) => (...a) => { const m = me.mat; me.mat = 'glass'; me[kind](...a); me.mat = m; };
    this.gl = { box: glow('box'), cyl: glow('cyl'), ball: glow('ball') };
  }
  get cur() { return this.stack[this.stack.length - 1]; }
  push(x = 0, y = 0, z = 0, ry = 0) {
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    this.stack.push(this.cur.clone().multiply(m));
    return this;
  }
  pop() { this.stack.pop(); return this; }
  m(mat) { this.mat = mat; return this; }
  _mat(x, y, z, rot) {
    _pe.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
    _pq.setFromEuler(_pe);
    _pp.set(x, y, z);
    return new THREE.Matrix4().compose(_pp, _pq, _ps).premultiply(this.cur);
  }
  _add(M, vol, spec) { this.parts.push({ vol, spec: { jitter: [0.16, 0.16, 0.16], hpScale: this.hp, maxLevel: 1, aoH: 2.4, ...spec, mat: this.mat } }); }
  box(x, y, z, sx, sy, sz, color, rot) {
    const M = this._mat(x, y, z, rot);
    const n = [sx, sy, sz].map((d) => (d < 0.15 ? 1 : Math.min(4, Math.max(1, Math.round(d / this.cs)))));
    this._add(M, sx * sy * sz, { nu: n[0], nv: n[1], nw: n[2], wrapU: false, color, P: (u, v, w) => new THREE.Vector3((u - 0.5) * sx, (v - 0.5) * sy, (w - 0.5) * sz).applyMatrix4(M) });
  }
  cyl(x, y, z, rt, rb, h, seg, color, rot) {
    const M = this._mat(x, y, z, rot);
    this._add(M, Math.PI * Math.max(rt, rb) ** 2 * h, {
      nu: Math.max(4, Math.min(6, Math.round(seg / 2.2))), nv: h > 1.0 ? 2 : 1, nw: 1, wrapU: true, color,
      P: (u, v, w) => { const a = u * Math.PI * 2, r = (rb + (rt - rb) * v) * w; return new THREE.Vector3(r * Math.cos(a), (v - 0.5) * h, r * Math.sin(a)).applyMatrix4(M); }
    });
  }
  ball(x, y, z, r, color, sc = [1, 1, 1]) {
    const M = this._mat(x, y, z, null);
    const rr = [r * sc[0], r * sc[1], r * sc[2]], n = r > 0.28 ? 2 : 1;
    const P0 = sphereBlock({ r: rr, at: [0, 0, 0], n, mat: this.mat, color }).P;
    this._add(M, (4 / 3) * Math.PI * rr[0] * rr[1] * rr[2], { nu: n, nv: n, nw: n, wrapU: false, color, jitter: [0.1, 0.1, 0.1], P: (u, v, w) => P0(u, v, w).applyMatrix4(M) });
  }
  /** Fracture blocks + critical zones (one per ~2 units of length). */
  result() {
    let parts = this.parts;
    if (parts.length > this.cap) parts = parts.slice().sort((a, b) => b.vol - a.vol).slice(0, this.cap);
    const min = new THREE.Vector3(1e9, 1e9, 1e9), max = new THREE.Vector3(-1e9, -1e9, -1e9);
    for (const p of parts) for (const u of [0, 1]) for (const v of [0, 1]) for (const w of [0, 1]) { const q = p.spec.P(u, v, w); min.min(q); max.max(q); }
    const c = min.clone().add(max).multiplyScalar(0.5), sp = max.clone().sub(min);
    const long = sp.x >= sp.z ? 'x' : 'z', span = Math.max(sp.x, sp.z), nz = span > 2.0 ? 2 : 1;
    const zones = [];
    for (let k = 0; k < nz; k++) {
      const off = nz === 1 ? 0 : (k ? 1 : -1) * span * 0.22;
      zones.push({ at: [c.x + (long === 'x' ? off : 0), c.y * 0.9, c.z + (long === 'z' ? off : 0)], rx: clampN(0.28 * span, 0.3, 0.7), ry: clampN(0.3 * sp.y, 0.28, 0.7), w: 1 });
    }
    return { blocks: parts.map((p) => p.spec), zones };
  }
}

const SETS = {
  // Aman (the cheater): moody purple bachelor pad.
  aman: {
    decor(b, T, rng) {
      A(b, 0.35, () => {
        b.push(-0.7, 0, 0, 0); F.pic(b, 0.36, 0.46, 2.05, 0x2a2350, 0xf4d9c8, 0xff4f86); b.pop();
        b.push(1.2, 0, 0, 0); F.pic(b, 0.36, 0.46, 1.95, 0x2a2350, 0xd9e6f4, 0x7fd8ff); b.pop();
      });
      for (let i = 0; i < 10; i++) { const a = rng() * Math.PI * 2, r = 1.25 + rng() * 0.7; b.cyl(Math.cos(a) * r, 0.014, Math.sin(a) * r, 0.07, 0.07, 0.012, 6, 0xe0446a); }
    },
    pieces: {
      bed: { wall: 'A', at: 0.35, name: 'Bed', icon: '🛏️', build: (s) => F.bed(s, 2.3, 0x3a2a50, 0xfbe0e8, 0xd8315b, 0xfff0f4) },
      heart: { wall: 'A', at: 0.35, name: 'Neon heart', icon: '💗', build: (s) => F.heart(s, 2.25, 0xff4f86, 1.25) },
      table: { wall: 'A', at: -1.25, name: 'Bedside table', icon: '🪔', build: (s) => { s.box(0, 0.28, 0.25, 0.42, 0.56, 0.42, 0x3a2a50); s.cyl(0, 0.63, 0.25, 0.03, 0.03, 0.14, 6, 0x6a5a80); s.gl.cyl(0, 0.8, 0.25, 0.1, 0.16, 0.2, 8, 0xff9ec0); } },
      guitar: { wall: 'B', at: -0.8, name: 'Guitar', icon: '🎸', build: (s) => F.guitar(s, 0xd98a3c) },
      mirror: { wall: 'B', at: 0.3, name: 'Mirror', icon: '🪞', build: (s) => F.mirror(s, 0.55, 1.65, 0x2a2350, 0xcfe8ff) },
      desk: {
        wall: 'B', at: 1.1, name: 'Desk and cologne', icon: '🧴',
        build: (s) => {
          F.desk(s, 1.0, 0xe6d4c0, 0x3a2a50);
          s.push(0.18, 0.81, 0.3, 0); F.monitor(s, 0x2a2a3a, 0x7fd8ff, 0.4, 0.26); s.pop();
          s.box(-0.3, 0.815, 0.3, 0.1, 0.02, 0.18, 0x20202e, [0, 0.4, 0]); s.gl.box(-0.3, 0.826, 0.3, 0.085, 0.004, 0.15, 0xff9ec0, [0, 0.4, 0]);
          s.box(-0.17, 0.815, 0.47, 0.1, 0.02, 0.18, 0x20202e, [0, -0.3, 0]); s.gl.box(-0.17, 0.826, 0.47, 0.085, 0.004, 0.15, 0x9ec8ff, [0, -0.3, 0]);
          s.push(0.38, 0.81, 0.5, 0); s.m('glass'); F.bottle(s, 0x58c98a); s.pop();
        }
      },
      shoes: { wall: 'W', at: [-1.45, 1.6, 0.4], name: 'Sneakers', icon: '👟', build: (s) => { s.push(-0.15, 0, -0.1, 0.5); F.sneaker(s, 0xff4f86); s.pop(); s.push(0.15, 0, 0.15, -0.4); F.sneaker(s, 0xff4f86); s.pop(); } }
    }
  },

  // Bunty (the bully): mustard room, messy bed, gym stuff, stolen notebooks.
  bunty: {
    decor() {},
    pieces: {
      bed: { wall: 'A', at: 0.55, name: 'Messy bed', icon: '🛏️', build: (s) => F.bed(s, 2.1, 0x4a4f5c, 0x8fc9a8, 0x2f7d5a, 0xdfe6df) },
      sign: { wall: 'A', at: 0.55, name: 'Keep Out sign', icon: '🚫', build: (s) => { s.push(0.1, 0, 0, 0); F.noEntry(s, 2.1); s.pop(); s.push(1.15, 0, 0, 0); F.pic(s, 0.4, 0.5, 1.95, 0x203f33, 0xf5e3b0, 0xe2562f); s.pop(); } },
      desk: {
        wall: 'A', at: -1.2, name: 'Desk and trophies', icon: '🏆',
        build: (s) => {
          F.desk(s, 0.8, 0xc99a68, 0x4a4f5c);
          for (let i = 0; i < 4; i++) s.box(0.05, 0.84 + i * 0.04, 0.3, 0.3, 0.04, 0.21, [0xff8a8a, 0x7cc4ff, 0xffc857, 0x7fd8a6][i], [0, 0.3 + i * 0.35, 0]);
          s.box(0, 1.72, 0.12, 0.8, 0.05, 0.24, 0x203f33);
          for (const x of [-0.22, 0, 0.22]) { s.push(x, 1.75, 0.12, 0); F.miniTrophy(s); s.pop(); }
        }
      },
      skate: { wall: 'B', at: -0.85, name: 'Skateboard', icon: '🛹', build: (s) => F.skate(s, 0xe2562f) },
      bag: { wall: 'B', at: 0.75, name: 'Punching bag', icon: '🥊', build: (s) => F.bag(s, 0xc9302c) },
      weights: {
        wall: 'W', at: [-1.7, 1.4, 0.5], name: 'Weights and ball', icon: '🏋️',
        build: (s) => { F.dumbbell(s); s.push(0.2, 0, 0.3, -0.7); F.dumbbell(s); s.pop(); s.ball(-0.3, 0.2, -1.1, 0.2, 0xe9c9a0, [1, 0.8, 0.8]); }
      },
      notes: {
        wall: 'W', at: [-0.9, 1.95, 0], name: 'Stolen notebooks', icon: '📓',
        build: (s) => { [[-0.3, 0, 0.3, 0xff8a8a], [0.1, 0.15, -0.5, 0x7cc4ff], [0.35, -0.25, 1.1, 0xffc857], [2.2, -0.1, 0.6, 0x7fd8a6]].forEach(([x, z, r, c]) => { s.push(x, 0, z, r); F.notebook(s, c); s.pop(); }); }
      }
    }
  },

  // Erika (the gossip): pink glam room.
  erika: {
    decor() {},
    pieces: {
      vanity: { wall: 'A', at: 0.45, name: 'Glam vanity', icon: '💄', cap: 90, build: (s) => { F.vanity(s, 1.5); s.push(0.45, 0, 0.95, 0); F.stool(s, 0xff9ed2); s.pop(); } },
      bubblesA: { wall: 'A', at: -0.9, name: 'Gossip bubbles', icon: '💬', build: (s) => { F.bubble(s, 0.8, 0.5, 2.45); s.push(0.35, 0, 0, 0); F.bubble(s, 0.55, 0.36, 1.7, 0xdff6b8); s.pop(); } },
      bed: { wall: 'B', at: 0.3, name: 'Pink bed', icon: '🛏️', build: (s) => F.bed(s, 2.2, 0xf2b8e6, 0xffffff, 0xe58bd6, 0xffc0e8) },
      phone: { wall: 'B', at: 0.3, name: 'Giant phone', icon: '📱', build: (s) => F.bigPhone(s, 0.7, 1.15, 2.2) },
      bubblesB: { wall: 'B', at: -0.9, name: 'Speech bubble', icon: '🗯️', build: (s) => F.bubble(s, 0.6, 0.4, 2.2) },
      tea: { wall: 'W', at: [-1.75, 1.4, 0], name: 'Tea table', icon: '🫖', build: (s) => { s.m('ceramic'); F.teaTable(s); } },
      bean: { wall: 'W', at: [1.85, 1.55, 0.4], name: 'Beanbag', icon: '🛋️', build: (s) => F.beanbag(s, 0xff9ed2) }
    }
  },

  // Krick (the criminal): gloomy hideout.
  krick: {
    decor(b) {
      A(b, -0.95, () => {
        b.box(0, 3.15, 0.2, 0.05, 0.05, 0.4, 0x2b2f38);
        b.cyl(0, 2.95, 0.4, 0.01, 0.01, 0.4, 4, 0x2b2f38);
        b.gl.ball(0, 2.7, 0.4, 0.1, 0xffe9a0, [1, 1.2, 1], 1);
      });
      Bw(b, 0.95, () => {
        F.win(b, 0.95, 1.0, 1.9, 0x4b5262, null, 0xb9dcff);
        for (let i = -2; i <= 2; i++) b.box(i * 0.19, 1.9, 0.1, 0.03, 1.0, 0.03, 0x2b2f38);
      });
      Bw(b, 0.4, () => {
        const ang = 0.3;
        b.box(0, 1.55, 0.075, 2.7, 0.15, 0.012, 0xffd23f, [0, 0, ang]);
        for (let i = 0; i < 12; i++) { const u = -1.2 + i * 0.22; b.box(Math.cos(ang) * u, 1.55 + Math.sin(ang) * u, 0.084, 0.09, 0.15, 0.006, 0x1d1d22, [0, 0, ang + 0.6]); }
      });
    },
    pieces: {
      board: { wall: 'A', at: 0.3, name: 'Evidence board', icon: '📌', build: (s, rng) => F.pinboard(s, 2.0, 1.1, 1.95, rng || mulberry32(11)) },
      desk: {
        wall: 'A', at: 0.3, name: 'Desk and monitors', icon: '🖥️',
        build: (s) => { F.desk(s, 2.0, 0x8f98a6, 0x6e7684); s.push(-0.45, 0.81, 0.32, 0); F.monitor(s, 0x20242c, 0x6dffa0, 0.46, 0.32); s.pop(); s.push(0.4, 0.81, 0.32, 0); F.monitor(s, 0x20242c, 0x7fe6ff, 0.46, 0.32); s.pop(); }
      },
      crates: { wall: 'A', at: 1.45, name: 'Stash crates', icon: '📦', build: (s) => { F.crate(s, 0.62, 0xc4a070); s.push(0, 0.62, 0, 0.4); F.crate(s, 0.42, 0xb08f60); s.pop(); } },
      mattress: {
        wall: 'B', at: -0.1, name: 'Mattress', icon: '🛌',
        build: (s) => { s.m('plant'); s.box(0, 0.15, 0.55, 1.8, 0.22, 1.0, 0xa7adb8); s.box(0.25, 0.28, 0.55, 1.2, 0.08, 1.0, 0x5d6b5a); s.box(-0.7, 0.34, 0.55, 0.4, 0.12, 0.5, 0xdfe3e8); }
      },
      safe: { wall: 'W', at: [-1.8, 1.3, 0.5], name: 'Safe', icon: '🔒', build: (s) => { s.m('metal'); F.safe(s); } },
      duffel: { wall: 'W', at: [1.7, 1.75, 0.5], name: 'Duffel bag', icon: '👜', build: (s) => { s.m('plant'); F.duffel(s, 0x7a2a2a); } }
    }
  },

  // The Jade Dragon Teahouse (premium): red-and-gold, a cabinet full of porcelain.
  chinese: {
    decor(b) {
      for (let i = 0; i < 18; i++) {
        const u = -H + 0.15 + i * 0.3, c = i % 2 ? 0xf2c14b : 0x8a2420;
        b.box(u, 3.05, -H + 0.05, 0.2, 0.12, 0.05, c);
        b.box(-H + 0.05, 3.05, u, 0.05, 0.12, 0.2, c);
      }
    },
    pieces: {
      cabinet: { wall: 'A', at: 0.15, name: 'Porcelain cabinet', icon: '🏺', cap: 44, cs: 1.0, hp: 0.6, build: (s, rng) => { s.m('ceramic'); F.china(s, rng || mulberry32(23), 2.8, 2.55, 0x7a1f1b); } },
      window: { wall: 'B', at: 0.3, name: 'Moon window', icon: '🌕', build: (s) => F.roundWin(s, 0.65, 1.75, 0xf2c14b, 0xffe3a0) },
      scroll: { wall: 'B', at: -0.9, name: 'Dragon scroll', icon: '📜', build: (s) => F.scroll(s, 0.46, 1.5, 1.65) },
      lantern: { wall: 'B', at: 0.95, name: 'Red lantern', icon: '🏮', build: (s) => F.lantern(s, 2.8) },
      bamboo: { wall: 'B', at: 1.4, name: 'Bamboo', icon: '🎋', cap: 34, build: (s) => { s.m('plant'); F.bamboo(s); } },
      table: { wall: 'W', at: [-1.75, 1.2, 0], name: 'Dim sum table', icon: '🥟', build: (s) => F.roundTable(s) },
      cushions: { wall: 'W', at: [1.45, 1.9, 0], name: 'Floor cushions', icon: '🔴', build: (s) => { s.m('plant'); s.push(0.3, 0, -0.15, 0); F.cushion(s, 0xd8392b); s.pop(); s.push(-0.25, 0, 0.2, 0); F.cushion(s, 0xc9302c); s.pop(); } }
    }
  }
};

/** Draw one piece into the static room mesh (or any sink) at its place. */
function placePiece(b, p, fn) {
  if (p.wall === 'A') A(b, p.at, fn);
  else if (p.wall === 'B') Bw(b, p.at, fn);
  else { b.push(p.at[0], 0, p.at[1], p.at[2] || 0); fn(); b.pop(); }
}

// register every piece as a breakable object type ('pc:<room>:<id>')
for (const [rk, set] of Object.entries(SETS)) {
  for (const [id, p] of Object.entries(set.pieces)) {
    OBJECTS[`pc:${rk}:${id}`] = {
      name: p.name, icon: p.icon, breakScale: p.breakScale || 1,
      build() { const s = new PartSink(p); p.build(s, mulberry32(hashStr(rk + id))); return s.result(); }
    };
  }
}

/** Where a piece stands: world position + yaw, and the object type that breaks it. */
export function pieceInfo(room, id) {
  const p = SETS[room] && SETS[room].pieces[id];
  if (!p) return null;
  const base = { id, room, type: `pc:${room}:${id}`, name: p.name, icon: p.icon };
  if (p.wall === 'A') return { ...base, x: p.at, z: -H, yaw: 0 };
  if (p.wall === 'B') return { ...base, x: -H, z: p.at, yaw: Math.PI / 2 };
  return { ...base, x: p.at[0], z: p.at[1], yaw: p.at[2] || 0 };
}
export const roomPieces = (room) => Object.keys((SETS[room] && SETS[room].pieces) || {});
export const hasSet = (room) => typeof room === 'string' && !!SETS[room];

const hashStr = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) + 3; };

/** A cutaway room on a floating slab. Same interface as Diorama (group, update, dispose, theme). */
export class RoomDiorama {
  constructor(key, hide = null) {
    const T = ROOMS[key];
    this.key = key;
    this.theme = T;
    this.group = new THREE.Group();
    this.motes = [];
    this.owned = [];
    const rng = mulberry32(hashStr(key));

    const b = new Batch();
    const gl = new Batch();
    gl.stack = b.stack;           // one transform stack for both
    b.gl = gl;
    shell(b, T, rng);
    const set = SETS[key];
    if (set) {
      set.decor(b, T, rng);
      for (const [id, p] of Object.entries(set.pieces)) if (!hide || !hide.has(id)) placePiece(b, p, () => p.build(b, mulberry32(hashStr(key + id))));
    } else BUILD[key](b, T, rng);
    const lit = b.mesh(litMat), glow = gl.pos.length ? gl.mesh(glowMat, false) : null;
    this.group.add(lit);
    this.owned.push(lit.geometry);
    if (glow) { this.group.add(glow); this.owned.push(glow.geometry); }

    // underside of the floating slab
    put(this.group, G.cone(H * 1.3, 2.4, 4), T.slab, -WALL_T / 2, -1.55, -WALL_T / 2, { rot: [Math.PI, Math.PI / 4, 0], shadow: false });
    for (let i = 0; i < 5; i++) {
      const a = rng() * Math.PI * 2, r = 0.8 + rng() * 1.5;
      put(this.group, G.dode(0.3 + rng() * 0.25), shade(T.slab, 0.9), Math.cos(a) * r, -0.8 - rng() * 1.2, Math.sin(a) * r, { shadow: false, rot: [rng() * 3, rng() * 3, 0] });
    }

    // drifting dust motes in the sunbeam air
    const moteMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(G.octa(0.045 + rng() * 0.03), moteMat);
      const o = { m, x: -2.4 + rng() * 5, y: 0.5 + rng() * 3.2, z: -2.4 + rng() * 5, sp: 0.04 + rng() * 0.08, ph: rng() * 6 };
      m.position.set(o.x, o.y, o.z);
      this.group.add(m);
      this.motes.push(o);
    }
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    for (const o of this.motes) {
      o.y += o.sp * dt;
      if (o.y > 3.9) o.y = 0.5;
      o.m.position.set(o.x + Math.sin(this.t * 0.5 + o.ph) * 0.15, o.y, o.z + Math.cos(this.t * 0.4 + o.ph) * 0.15);
      o.m.rotation.y += dt;
    }
  }

  dispose() {
    if (this.group.parent) this.group.parent.remove(this.group);
    this.owned.forEach((g) => g.dispose());
  }
}

/** key: world index (0-5, floating island) or room name (see ROOMS in levels.js). */
export function makeDiorama(key, hide = null) { return typeof key === 'string' ? new RoomDiorama(key, hide) : new Diorama(key); }
