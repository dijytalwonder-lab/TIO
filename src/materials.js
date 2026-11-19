import * as THREE from 'three';

// Physical + visual + audio properties of every breakable material.
//  hp        - toughness of one cell (damage needed to snap it off)
//  rest/fric - bounce + friction of its fragments
//  split     - landing speed above which a fragment cracks into smaller ones
//  maxLevel  - how many times a fragment may split (0 = never)
//  cut       - colour of freshly broken (inside) faces
export const MAT = {
  ceramic:    { hp: 1.0,  rest: 0.30, fric: 0.55, split: 3.4, maxLevel: 1, snd: 'ceramic', rough: 0.32, metal: 0,    crack: 0x4a3640, cut: 0xf6ecdd },
  terracotta: { hp: 0.9,  rest: 0.26, fric: 0.65, split: 3.6, maxLevel: 1, snd: 'ceramic', rough: 0.82, metal: 0,    crack: 0x4d2417, cut: 0xcf7d52 },
  glass:      { hp: 0.45, rest: 0.22, fric: 0.35, split: 2.6, maxLevel: 2, snd: 'glass',   rough: 0.12, metal: 0,    crack: 0xffffff, cut: 0xe2f8f1, alpha: 0.74 },
  wood:       { hp: 1.1,  rest: 0.28, fric: 0.70, split: 6.5, maxLevel: 1, snd: 'wood',    rough: 0.85, metal: 0,    crack: 0x40281a, cut: 0xf3d79f },
  brick:      { hp: 1.5,  rest: 0.18, fric: 0.80, split: 4.4, maxLevel: 1, snd: 'stone',   rough: 0.92, metal: 0,    crack: 0x4a2a22, cut: 0xe8bfa4 },
  stone:      { hp: 1.9,  rest: 0.18, fric: 0.80, split: 4.2, maxLevel: 1, snd: 'stone',   rough: 0.72, metal: 0,    crack: 0x3c4046, cut: 0xeceae4 },
  metal:      { hp: 2.4,  rest: 0.40, fric: 0.40, split: 99,  maxLevel: 0, snd: 'metal',   rough: 0.32, metal: 0.55, crack: 0x333333, cut: 0xdcdcdc },
  gold:       { hp: 1.7,  rest: 0.42, fric: 0.40, split: 99,  maxLevel: 0, snd: 'metal',   rough: 0.28, metal: 0.6,  crack: 0x6b4a10, cut: 0xffe9a0 },
  soil:       { hp: 0.4,  rest: 0.10, fric: 0.90, split: 2.2, maxLevel: 1, snd: 'soft',    rough: 1,    metal: 0,    crack: 0x2a1a10, cut: 0x8a6a48 },
  plant:      { hp: 0.35, rest: 0.10, fric: 0.90, split: 99,  maxLevel: 0, snd: 'soft',    rough: 0.9,  metal: 0,    crack: 0x1d4a22, cut: 0xb5ea96 }
};

const matCache = new Map();
const crackCache = new Map();

// One shared material per kind - colours live in the vertex colours.
export function getMaterial(key) {
  let m = matCache.get(key);
  if (!m) {
    const d = MAT[key];
    m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: d.rough,
      metalness: d.metal,
      transparent: !!d.alpha,
      opacity: d.alpha || 1
    });
    matCache.set(key, m);
  }
  return m;
}

export function getCrackMaterial(key) {
  let m = crackCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color: MAT[key].crack,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    crackCache.set(key, m);
  }
  return m;
}
