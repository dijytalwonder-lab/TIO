import * as THREE from 'three';
import { PLATFORM_HALF, CAM } from './config.js';
import { WORLDS } from './levels.js';
import { mulberry32 } from './fracture.js';

// ---------------------------------------------------------------------------
// Low-poly isometric dioramas: a small floating platform with themed scenery,
// distant floating islets and drifting clouds. Everything is flat-shaded.
// ---------------------------------------------------------------------------

const matCache = new Map();
function flat(color, opts = {}) {
  const k = color + '|' + (opts.emissive || 0) + '|' + (opts.rough ?? 0.92);
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: opts.rough ?? 0.92, metalness: 0, emissive: opts.emissive || 0x000000, emissiveIntensity: opts.ei ?? 1 });
    matCache.set(k, m);
  }
  return m;
}

const geoCache = new Map();
function geo(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
const G = {
  box: (x, y, z) => geo(`b${x},${y},${z}`, () => new THREE.BoxGeometry(x, y, z)),
  cyl: (t, b, h, s) => geo(`c${t},${b},${h},${s}`, () => new THREE.CylinderGeometry(t, b, h, s)),
  cone: (r, h, s) => geo(`n${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s)),
  ico: (r, d = 0) => geo(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d)),
  dode: (r) => geo(`d${r}`, () => new THREE.DodecahedronGeometry(r, 0)),
  octa: (r) => geo(`o${r}`, () => new THREE.OctahedronGeometry(r, 0)),
  sph: (r) => geo(`s${r}`, () => new THREE.SphereGeometry(r, 7, 5)),
  dome: (r) => geo(`m${r}`, () => new THREE.SphereGeometry(r, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2))
};

function put(parent, g, color, x, y, z, o = {}) {
  const m = new THREE.Mesh(g, flat(color, o));
  m.position.set(x, y, z);
  if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
  if (o.scale) m.scale.set(o.scale[0], o.scale[1], o.scale[2]);
  m.castShadow = o.shadow !== false;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// --- scenery pieces (all sit on y = 0) --------------------------------------
const D = {
  tree(p, x, z, s, leaf = 0x6fcf6a, trunk = 0xa8764a) {
    const g = new THREE.Group(); g.position.set(x, 0, z); p.add(g);
    put(g, G.cyl(0.07 * s, 0.1 * s, 0.55 * s, 5), trunk, 0, 0.275 * s, 0);
    put(g, G.ico(0.42 * s), leaf, 0, 0.85 * s, 0);
    put(g, G.ico(0.3 * s), leaf, 0.05 * s, 1.22 * s, 0.03 * s);
  },
  pine(p, x, z, s, col = 0x3f9f6a, snow = false) {
    const g = new THREE.Group(); g.position.set(x, 0, z); p.add(g);
    put(g, G.cyl(0.06 * s, 0.08 * s, 0.3 * s, 5), 0x8a6240, 0, 0.15 * s, 0);
    put(g, G.cone(0.42 * s, 0.6 * s, 6), col, 0, 0.55 * s, 0);
    put(g, G.cone(0.32 * s, 0.5 * s, 6), col, 0, 0.95 * s, 0);
    put(g, G.cone(0.2 * s, 0.42 * s, 6), snow ? 0xffffff : col, 0, 1.3 * s, 0);
    if (snow) put(g, G.cone(0.2 * s, 0.22 * s, 6), 0xffffff, 0, 0.78 * s, 0, { scale: [1.5, 1, 1.5] });
  },
  cherry(p, x, z, s) {
    const g = new THREE.Group(); g.position.set(x, 0, z); p.add(g);
    put(g, G.cyl(0.08 * s, 0.12 * s, 0.7 * s, 5), 0x9a6a58, 0, 0.35 * s, 0, { rot: [0, 0, 0.08] });
    put(g, G.ico(0.46 * s), 0xffb6d0, 0, 0.95 * s, 0);
    put(g, G.ico(0.34 * s), 0xff9ec4, 0.3 * s, 0.75 * s, 0.1 * s);
    put(g, G.ico(0.32 * s), 0xffc8dc, -0.28 * s, 0.8 * s, -0.08 * s);
  },
  palm(p, x, z, s) {
    const g = new THREE.Group(); g.position.set(x, 0, z); p.add(g);
    put(g, G.cyl(0.07 * s, 0.1 * s, 0.5 * s, 5), 0xb98a5a, 0, 0.25 * s, 0, { rot: [0, 0, 0.1] });
    put(g, G.cyl(0.06 * s, 0.07 * s, 0.5 * s, 5), 0xb98a5a, 0.1 * s, 0.72 * s, 0, { rot: [0, 0, 0.2] });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      put(g, G.box(0.6 * s, 0.04 * s, 0.17 * s), i % 2 ? 0x57c26f : 0x6fd37f, 0.17 * s + Math.cos(a) * 0.3 * s, 1.0 * s, Math.sin(a) * 0.3 * s, { rot: [0, -a, -0.45] });
    }
    put(g, G.sph(0.07 * s), 0x8a5a30, 0.2 * s, 0.93 * s, 0.05 * s);
  },
  bush(p, x, z, s, col = 0x58c164) {
    put(p, G.ico(0.3 * s), col, x, 0.2 * s, z, { scale: [1.1, 0.8, 1] });
  },
  rock(p, x, z, s, col = 0xb9aa96) {
    put(p, G.dode(0.25 * s), col, x, 0.14 * s, z, { scale: [1.2, 0.7, 1], rot: [0.3, x * 3, 0.2] });
  },
  flower(p, x, z, s, c = 0xff8fb8) {
    put(p, G.cyl(0.012 * s, 0.012 * s, 0.2 * s, 4), 0x5fb85a, x, 0.1 * s, z, { shadow: false });
    put(p, G.octa(0.065 * s), c, x, 0.22 * s, z, { shadow: false });
  },
  mushroom(p, x, z, s) {
    put(p, G.cyl(0.05 * s, 0.07 * s, 0.18 * s, 5), 0xfff3e0, x, 0.09 * s, z);
    put(p, G.dome(0.17 * s), 0xff6b6b, x, 0.17 * s, z);
  },
  house(p, x, z, s, wall, roof, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; p.add(g);
    put(g, G.box(0.9 * s, 0.6 * s, 0.78 * s), wall, 0, 0.3 * s, 0);
    put(g, G.cone(0.78 * s, 0.5 * s, 4), roof, 0, 0.85 * s, 0, { rot: [0, Math.PI / 4, 0] });
    put(g, G.box(0.17 * s, 0.3 * s, 0.05 * s), 0x8a5a3a, 0, 0.15 * s, 0.4 * s);
    put(g, G.box(0.16 * s, 0.16 * s, 0.05 * s), 0xbfe6ff, 0.27 * s, 0.38 * s, 0.4 * s);
    put(g, G.box(0.14 * s, 0.3 * s, 0.14 * s), 0xb0623f, -0.25 * s, 1.0 * s, -0.1 * s);
  },
  hay(p, x, z, s) {
    put(p, G.cyl(0.26 * s, 0.26 * s, 0.42 * s, 8), 0xf0cf6a, x, 0.26 * s, z, { rot: [0, 0, Math.PI / 2] });
  },
  fence(p, x, z, len, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; p.add(g);
    const n = Math.max(2, Math.round(len / 0.35));
    for (let i = 0; i < n; i++) put(g, G.box(0.06, 0.3, 0.06), 0xe9d3b0, (i / (n - 1) - 0.5) * len, 0.15, 0);
    put(g, G.box(len, 0.05, 0.04), 0xf5e4c6, 0, 0.12, 0);
    put(g, G.box(len, 0.05, 0.04), 0xf5e4c6, 0, 0.24, 0);
  },
  windmill(p, x, z, s, upd) {
    const g = new THREE.Group(); g.position.set(x, 0, z); p.add(g);
    put(g, G.cyl(0.22 * s, 0.38 * s, 1.0 * s, 6), 0xfff0dc, 0, 0.5 * s, 0);
    put(g, G.cone(0.34 * s, 0.4 * s, 6), 0xe5604f, 0, 1.2 * s, 0);
    const blades = new THREE.Group(); blades.position.set(0, 1.0 * s, 0.3 * s); g.add(blades);
    for (let i = 0; i < 4; i++) {
      const b = put(blades, G.box(0.1 * s, 0.7 * s, 0.03 * s), 0xffffff, 0, 0, 0);
      b.position.set(0, 0, 0); b.geometry = G.box(0.1 * s, 0.7 * s, 0.03 * s);
      const arm = new THREE.Group(); arm.rotation.z = (i * Math.PI) / 2; blades.add(arm); arm.add(b); b.position.y = 0.38 * s;
    }
    upd.push((dt) => { blades.rotation.z += dt * 0.6; });
  },
  umbrella(p, x, z, s) {
    put(p, G.cyl(0.02 * s, 0.02 * s, 1.0 * s, 4), 0xffffff, x, 0.5 * s, z);
    put(p, G.cone(0.6 * s, 0.28 * s, 8), 0xff7a8a, x, 1.05 * s, z);
    put(p, G.box(0.5 * s, 0.03 * s, 0.8 * s), 0x6fd3ff, x + 0.5 * s, 0.02, z + 0.2 * s, { rot: [0, 0.4, 0] });
  },
  shell(p, x, z, s) { put(p, G.octa(0.1 * s), 0xffc0d6, x, 0.07 * s, z, { scale: [1, 0.6, 1] }); },
  castle(p, x, z, s) {
    put(p, G.cyl(0.3 * s, 0.34 * s, 0.22 * s, 8), 0xf1d9a0, x, 0.11 * s, z);
    put(p, G.cyl(0.17 * s, 0.2 * s, 0.3 * s, 8), 0xf1d9a0, x, 0.37 * s, z);
    put(p, G.cone(0.2 * s, 0.22 * s, 8), 0xff7a8a, x, 0.63 * s, z);
  },
  snowman(p, x, z, s) {
    put(p, G.sph(0.24 * s), 0xffffff, x, 0.22 * s, z);
    put(p, G.sph(0.17 * s), 0xffffff, x, 0.55 * s, z);
    put(p, G.sph(0.12 * s), 0xffffff, x, 0.8 * s, z);
    put(p, G.cone(0.03 * s, 0.14 * s, 4), 0xff9a4a, x + 0.01, 0.8 * s, z + 0.13 * s, { rot: [Math.PI / 2, 0, 0] });
    put(p, G.cyl(0.1 * s, 0.1 * s, 0.1 * s, 6), 0x5a64b0, x, 0.93 * s, z);
  },
  crystal(p, x, z, s, c = 0x9fe8ff) {
    [[0, 0, 1, 0], [0.18, 0.06, 0.7, 0.3], [-0.16, 0.1, 0.55, -0.35]].forEach((k) => {
      put(p, G.cone(0.13 * s, 0.7 * s * k[2], 5), c, x + k[0] * s, 0.35 * s * k[2], z + k[1] * s, { rot: [0, 0, k[3]], emissive: c, ei: 0.25 });
    });
  },
  pillar(p, x, z, s, broken = false, col = 0xe6dcc6) {
    const g = new THREE.Group(); g.position.set(x, 0, z); p.add(g);
    const h = broken ? 0.55 : 1.0;
    put(g, G.box(0.5 * s, 0.12 * s, 0.5 * s), col, 0, 0.06 * s, 0);
    put(g, G.cyl(0.18 * s, 0.21 * s, h * s, 6), col, 0, (0.12 + h / 2) * s, 0);
    if (!broken) put(g, G.box(0.5 * s, 0.12 * s, 0.5 * s), col, 0, (0.18 + h) * s, 0);
    else { put(g, G.cyl(0.15 * s, 0.18 * s, 0.22 * s, 6), col, 0.45 * s, 0.11 * s, 0.15 * s, { rot: [0, 0, 1.4] }); }
  },
  lantern(p, x, z, s) {
    put(p, G.box(0.3 * s, 0.1 * s, 0.3 * s), 0xcfc7c0, x, 0.05 * s, z);
    put(p, G.cyl(0.07 * s, 0.08 * s, 0.35 * s, 6), 0xcfc7c0, x, 0.27 * s, z);
    put(p, G.box(0.26 * s, 0.24 * s, 0.26 * s), 0xfff0b0, x, 0.55 * s, z, { emissive: 0xffd36b, ei: 0.5 });
    put(p, G.cone(0.26 * s, 0.2 * s, 4), 0xa8a29e, x, 0.77 * s, z, { rot: [0, Math.PI / 4, 0] });
  },
  pond(p, x, z, s) {
    put(p, G.cyl(0.5 * s, 0.5 * s, 0.05, 10), 0x7fd3ff, x, 0.025, z, { rough: 0.2, emissive: 0x3aa6e8, ei: 0.15, shadow: false });
    put(p, G.cyl(0.58 * s, 0.58 * s, 0.04, 10), 0xcdbfae, x, 0.01, z, { shadow: false });
  },
  petals(p, rng, n) {
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, r = 1.2 + rng() * 1.4;
      put(p, G.octa(0.035), 0xffc0d8, Math.cos(a) * r, 0.03, Math.sin(a) * r, { shadow: false, scale: [1, 0.3, 1] });
    }
  }
};

// Tall scenery goes to the LEFT/RIGHT rims (screen x of a point is 0.707*(x - z)) so the
// vertical column above the hero object stays clear; only low items sit in front/behind it.
const DECOR = {
  meadow(p, rng) {
    D.tree(p, -2.45, 0.2, 1.3, 0x68cd68); D.tree(p, -2.5, -1.0, 0.9, 0x86dc7a);
    D.tree(p, 0.3, -2.45, 1.0, 0x5cc46a); D.tree(p, 1.6, -2.35, 0.85, 0x7bd673);
    D.bush(p, -2.4, 1.2, 1.0); D.bush(p, -0.9, -2.45, 0.7, 0x6fd37a); D.rock(p, 2.4, 0.4, 0.9); D.rock(p, -2.3, 2.0, 0.6);
    for (let i = 0; i < 9; i++) D.flower(p, -1.6 + rng() * 1.1, 2.0 + rng() * 0.55, 1, [0xff8fb8, 0xffd45e, 0xffffff, 0xb08cff][i % 4]);
    D.mushroom(p, 2.1, 1.6, 1); D.mushroom(p, 2.4, 1.3, 0.7);
  },
  village(p, rng, upd) {
    D.house(p, -2.3, 0.3, 1.05, 0xffe6c7, 0xe56b4f, 0.5); D.house(p, 0.5, -2.3, 0.85, 0xffd9b0, 0xd9534f, -0.4);
    D.windmill(p, 2.3, -0.9, 0.9, upd);
    D.hay(p, 2.3, 1.2, 1); D.hay(p, 2.0, 2.0, 0.8);
    D.fence(p, -2.45, 1.4, 1.2, Math.PI / 2); D.fence(p, -0.9, -2.5, 1.2, 0);
    D.tree(p, -2.2, 2.1, 0.8, 0xe8a24a); D.bush(p, 2.5, 0.2, 0.8, 0xd9b04a);
    for (let i = 0; i < 6; i++) D.flower(p, -1.2 + rng() * 1.0, 2.2 + rng() * 0.4, 1, [0xff7a8a, 0xffd45e][i % 2]);
  },
  beach(p, rng) {
    D.palm(p, -2.45, 0.1, 1.3); D.palm(p, 1.0, -2.4, 1.05);
    D.umbrella(p, -2.35, 1.4, 0.9); D.rock(p, 2.4, 0.9, 0.8, 0xdcc9ad); D.rock(p, -0.8, -2.45, 0.6, 0xdcc9ad);
    D.castle(p, -1.0, 2.2, 1.0);
    for (let i = 0; i < 6; i++) D.shell(p, -0.2 + rng() * 1.8, 2.1 + rng() * 0.5, 1);
    D.bush(p, 2.2, -1.3, 0.8, 0x6fd3a0);
  },
  frost(p, rng) {
    D.pine(p, -2.45, 0.1, 1.3, 0x3f9f8a, true); D.pine(p, -2.4, -1.2, 0.9, 0x4aa896, true); D.pine(p, 0.4, -2.45, 1.1, 0x3f9f8a, true);
    D.snowman(p, 2.4, 0.5, 1.1); D.crystal(p, -2.3, 1.5, 1.1); D.crystal(p, 1.5, -2.4, 0.7, 0xc7b6ff);
    D.rock(p, 2.4, 1.5, 0.8, 0xd5e4f2); D.rock(p, -1.4, 2.3, 0.6, 0xd5e4f2); D.bush(p, -0.9, -2.45, 0.8, 0xeaf6ff);
  },
  sakura(p, rng) {
    D.cherry(p, -2.45, 0.1, 1.3); D.cherry(p, 0.5, -2.4, 1.0);
    D.lantern(p, -2.35, 1.5, 1.0); D.lantern(p, 2.45, 1.0, 0.8);
    D.pond(p, 2.0, -0.6, 0.8); D.rock(p, -0.9, -2.45, 0.7, 0xc9bfb8); D.bush(p, 1.7, -2.4, 0.7, 0x8fd6a0);
    for (let i = 0; i < 6; i++) D.flower(p, -1.2 + rng() * 1.0, 2.2 + rng() * 0.4, 1, [0xffffff, 0xff9ec4][i % 2]);
    D.petals(p, rng, 14);
  },
  ruins(p, rng) {
    D.pillar(p, -2.45, 0.1, 1.15); D.pillar(p, 0.5, -2.4, 1.0, true); D.pillar(p, -2.3, 1.5, 0.8, true);
    D.pillar(p, 2.45, -0.8, 0.85, false, 0xd9cdb4);
    D.rock(p, 2.4, 1.2, 0.8, 0xbfb2cf); D.rock(p, -0.9, -2.45, 0.6, 0xbfb2cf); D.crystal(p, 2.4, 2.0, 0.9, 0xd8b6ff);
    D.bush(p, -1.6, 2.35, 0.8, 0x93c97a);
    for (let i = 0; i < 5; i++) D.flower(p, -0.8 + rng() * 1.0, 2.25 + rng() * 0.35, 1, [0xffd45e, 0xffa0c8][i % 2]);
  }
};

// camera-plane placement for background elements
const _d = new THREE.Vector3(Math.sin(CAM.azimuth) * Math.cos(CAM.elevation), Math.sin(CAM.elevation), Math.cos(CAM.azimuth) * Math.cos(CAM.elevation));
const _right = new THREE.Vector3(0, 1, 0).cross(_d).normalize();
const _up = _d.clone().cross(_right).normalize();
function screenPos(sx, sy, depth) {
  return new THREE.Vector3(...CAM.target).addScaledVector(_right, sx).addScaledVector(_up, sy).addScaledVector(_d, -depth);
}

function islet(theme, rng, s, withTree) {
  const g = new THREE.Group();
  put(g, G.cyl(0.9 * s, 0.9 * s, 0.22 * s, 6), theme.top, 0, 0, 0, { shadow: false });
  put(g, G.cone(0.9 * s, 1.3 * s, 6), theme.side, 0, -0.76 * s, 0, { rot: [Math.PI, 0, 0], shadow: false });
  if (withTree) {
    if (theme.decor === 'frost') D.pine(g, 0.1 * s, 0, 0.9 * s, 0x3f9f8a, true);
    else if (theme.decor === 'sakura') D.cherry(g, 0.1 * s, 0, 0.9 * s);
    else if (theme.decor === 'ruins') D.pillar(g, 0.1 * s, 0, 0.6 * s, true);
    else if (theme.decor === 'beach') D.palm(g, 0.1 * s, 0, 0.8 * s);
    else if (theme.decor === 'village') D.house(g, 0, 0, 0.6 * s, 0xffe6c7, 0xe56b4f, rng());
    else D.tree(g, 0.1 * s, 0, 0.9 * s, 0x72d36e);
    g.children.forEach((c) => c.traverse((o) => { o.castShadow = false; }));
  }
  g.rotation.y = rng() * 6;
  return g;
}

function cloud(color, rng) {
  const g = new THREE.Group();
  const n = 3 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(G.ico(0.5 + rng() * 0.35, 1), flat(color, { emissive: color, ei: 0.55, rough: 1 }));
    m.position.set((i - n / 2) * 0.62, rng() * 0.2, rng() * 0.3);
    m.scale.set(1, 0.7, 0.9);
    g.add(m);
  }
  return g;
}

export class Diorama {
  constructor(worldIdx, rng = mulberry32(worldIdx * 977 + 3)) {
    const theme = WORLDS[worldIdx];
    this.theme = theme;
    this.group = new THREE.Group();
    this.updaters = [];
    this.clouds = [];
    this.floaters = [];
    const H = PLATFORM_HALF;
    const g = this.group;

    // floating platform: grass slab + earth + craggy underside
    put(g, G.box(2 * H, 0.12, 2 * H), theme.top, 0, -0.06, 0, { shadow: false });
    put(g, G.box(2 * H, 0.34, 2 * H), theme.side, 0, -0.29, 0, { shadow: false });
    put(g, G.cone(H * 1.34, 2.5, 4), theme.side, 0, -1.7, 0, { rot: [Math.PI, Math.PI / 4, 0], shadow: false });
    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2, r = 0.9 + rng() * 1.6;
      put(g, G.dode(0.35 + rng() * 0.3), theme.rock, Math.cos(a) * r, -0.7 - rng() * 1.4, Math.sin(a) * r, { shadow: false, rot: [rng() * 3, rng() * 3, 0] });
    }
    // grass trim on the front edges
    put(g, G.box(2 * H + 0.04, 0.1, 0.1), theme.top, 0, -0.1, H, { shadow: false });
    put(g, G.box(0.1, 0.1, 2 * H + 0.04), theme.top, H, -0.1, 0, { shadow: false });
    // clean stone pad in the middle (top just above y = 0)
    put(g, G.cyl(2.05, 2.15, 0.05, 12), theme.pad2, 0, -0.023, 0, { shadow: false });
    put(g, G.cyl(1.85, 1.85, 0.06, 12), theme.pad, 0, -0.025, 0, { shadow: false });

    const deco = new THREE.Group();
    g.add(deco);
    DECOR[theme.decor](deco, rng, this.updaters);

    // distant islets + clouds (positioned in camera space so the composition is stable)
    const sky = new THREE.Group();
    g.add(sky);
    const spots = [[-2.4, 5.0, 8, 0.75], [2.7, 3.7, 10, 0.6], [-2.6, -5.0, 6, 0.7], [2.3, -5.6, 9, 0.85], [0.5, 6.4, 12, 0.55], [-2.2, 2.4, 14, 0.4]];
    spots.forEach((s, i) => {
      const it = islet(theme, rng, s[3], i % 5 !== 4);
      it.position.copy(screenPos(s[0], s[1], s[2]));
      sky.add(it);
      this.floaters.push({ obj: it, y: it.position.clone(), ph: rng() * 6, amp: 0.1 + rng() * 0.08 });
    });
    for (let i = 0; i < 7; i++) {
      const c = cloud(theme.cloud, rng);
      const sx = -4 + rng() * 8, sy = -6.5 + rng() * 13.5;
      c.position.copy(screenPos(sx, sy, 16 + rng() * 6));
      c.scale.setScalar(0.8 + rng() * 0.9);
      sky.add(c);
      this.clouds.push({ obj: c, base: c.position.clone(), sx, speed: 0.12 + rng() * 0.18, sy });
    }
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    this.updaters.forEach((u) => u(dt));
    for (const f of this.floaters) f.obj.position.y = f.y.y + Math.sin(this.t * 0.7 + f.ph) * f.amp;
    for (const c of this.clouds) {
      c.sx += c.speed * dt;
      if (c.sx > 5) c.sx = -5;
      const p = screenPos(c.sx, c.sy, 16);
      c.obj.position.set(p.x, p.y, p.z);
    }
  }

  dispose() {
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}

// shared building blocks for the room dioramas (rooms.js)
export { flat, G, put, screenPos };
