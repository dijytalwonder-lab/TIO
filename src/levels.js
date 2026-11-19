import { LEVEL_TIME } from './config.js';

// Six miniature diorama worlds, five levels each.
export const WORLDS = [
  {
    name: 'Sunny Meadow', decor: 'meadow',
    sky: ['#8fdcff', '#d3f4ff', '#fff7dc'],
    top: 0x93de7c, side: 0x9b7a58, rock: 0xbba98f, pad: 0xdcf3c6, pad2: 0xbfe5a6, cloud: 0xffffff, accent: '#7fd86a'
  },
  {
    name: 'Terracotta Village', decor: 'village',
    sky: ['#ffb98f', '#ffdcb8', '#fff2da'],
    top: 0xe9cc84, side: 0xbb7b4e, rock: 0xcfa27c, pad: 0xf7e6c6, pad2: 0xe8cfa5, cloud: 0xfff4ea, accent: '#ffb35c'
  },
  {
    name: 'Candy Seaside', decor: 'beach',
    sky: ['#6fd3ff', '#aeeaff', '#fff3d3'],
    top: 0xf5e1ae, side: 0xdcb87f, rock: 0xe9c99c, pad: 0xfff2d2, pad2: 0xf0d9a6, cloud: 0xffffff, accent: '#5fc8f2'
  },
  {
    name: 'Frosty Peaks', decor: 'frost',
    sky: ['#aecbff', '#dbe9ff', '#f8fbff'],
    top: 0xf4faff, side: 0x9bb8d8, rock: 0xb8cfe6, pad: 0xe3f2ff, pad2: 0xc9e3fb, cloud: 0xffffff, accent: '#8cc4ff'
  },
  {
    name: 'Sakura Garden', decor: 'sakura',
    sky: ['#ffb4d6', '#ffd9ea', '#fff0f6'],
    top: 0xc3e9a4, side: 0xa57f6d, rock: 0xc9b2a8, pad: 0xffe4ec, pad2: 0xf9c9d8, cloud: 0xfff5f8, accent: '#ff8fbd'
  },
  {
    name: 'Sunset Ruins', decor: 'ruins',
    sky: ['#b99aff', '#ffb9a2', '#ffe6b5'],
    top: 0xcbd99b, side: 0x8d7ba6, rock: 0xb2a6c6, pad: 0xece0c8, pad2: 0xd9cbab, cloud: 0xffeedd, accent: '#b48cff'
  }
];

const L = (obj, target, hits, variant = {}) => ({ obj, target, hits, variant, time: LEVEL_TIME });

// target = fragments to create, hits = maximum hammer strikes
export const LEVELS = [
  // --- Sunny Meadow: easy ceramic pots with obvious impact areas
  L('clay_pot', 25, 5),
  L('flower_pot', 30, 5),
  L('mug', 22, 5),
  L('plates', 38, 5),
  L('ceramic_vase', 50, 5),
  // --- Terracotta Village: thicker pieces, bottles and wood
  L('teapot', 55, 4),
  L('glass_bottle', 60, 4, { hpMul: 1.8 }),
  L('wooden_crate', 52, 3),
  L('big_vase', 55, 4),
  L('barrel', 55, 3),
  // --- Candy Seaside
  L('glass_bottle', 70, 3, { col: 0x5cb8f0, hpMul: 2.0 }),
  L('piggy_bank', 70, 3, { hpMul: 1.8 }),
  L('clay_pot', 70, 3, { scale: 1.15, hpMul: 1.8, col: 0xf0a07a }),
  L('brick_wall', 55, 3),
  L('plates', 55, 3, { col: 0xfff0f6, col2: 0xff8fb8, hpMul: 1.25 }),
  // --- Frosty Peaks
  L('flower_pot', 70, 3, { hpMul: 1.4, col: 0x9fc7ee, col2: 0xffffff }),
  L('wooden_crate', 60, 3, { scale: 1.2, hpMul: 1.15 }),
  L('gnome', 80, 3),
  L('big_vase', 85, 3, { col: 0xe86fa0, col2: 0xfff0f6 }),
  L('brick_wall', 60, 3, { scale: 1.1, hpMul: 1.4 }),
  // --- Sakura Garden
  L('urn', 90, 3),
  L('piggy_bank', 75, 3, { hpMul: 2.2, col: 0xffd36b }),
  L('stone_statue', 90, 3, { scale: 0.85, hpMul: 1.25 }),
  L('teapot', 70, 3, { hpMul: 1.15, col: 0x8fe3c0, col2: 0xfff0b0 }),
  L('barrel', 65, 3, { scale: 1.1, hpMul: 1.5 }),
  // --- Sunset Ruins: statues, multiple weak points, tougher materials
  L('gnome', 80, 3, { hpMul: 1.4, scale: 1.1, col: 0xb07cf0, col2: 0xffa24a }),
  L('trophy', 70, 4),
  L('stone_statue', 110, 3, { hpMul: 1.3 }),
  L('urn', 110, 3, { scale: 1.15, hpMul: 1.5, col: 0xdbe7ff, col2: 0xff9a6b }),
  L('stone_statue', 105, 3, { scale: 1.2, hpMul: 1.15, col: 0xd8d2ea, col2: 0xff9a6b })
];

LEVELS.forEach((l, i) => { l.id = i + 1; l.world = Math.floor(i / 5); });

export const TIPS = [
  'Strike the heart of the object for the biggest blast.',
  'Cracks add up - hit the same spot twice to break through.',
  'Edges only chip. Aim for the middle of the body.',
  'Bottles shatter into many tiny pieces.',
  'Broken parts also crack when they hit the floor.',
  'Tap loose chunks to smash them even smaller.',
  'Heavy objects can have more than one weak point.',
  'Perfect hits make a bright flash - learn where they are!'
];

export const HAMMERS = [
  { id: 'wood', name: 'Candy Mallet', price: 0, head: 0xff6b7a, band: 0xffd36b, handle: 0xd9a066, emissive: 0x000000 },
  { id: 'steel', name: 'Steel Smasher', price: 150, head: 0xa9b6d0, band: 0xe9eefb, handle: 0x6c7a99, emissive: 0x000000 },
  { id: 'gold', name: 'Golden Gavel', price: 400, head: 0xffc93c, band: 0xfff0a8, handle: 0xb87a3c, emissive: 0x4d3300 },
  { id: 'ice', name: 'Frost Hammer', price: 700, head: 0x7fd8ff, band: 0xffffff, handle: 0x6aa6d8, emissive: 0x0a3550 },
  { id: 'rainbow', name: 'Rainbow Bonk', price: 1000, head: 0xc77dff, band: 0x6bffd2, handle: 0xff8fb8, emissive: 0x3a1055 }
];

// Cutaway room dioramas for story mode (built in rooms.js). Colours are 0xRRGGBB; sky = page gradient.
export const ROOMS = {
  living: {
    name: 'Cozy Living Room', sky: ['#ffd2bb', '#ffe6d2', '#fff6e8'], accent: '#ff9a8a',
    wall: 0xffe7d6, wain: 0xf6bfae, trim: 0xfff5ea, floorA: 0xe3b07a, floorB: 0xd99f66, floorStyle: 'planks', slab: 0xb97d55, pad: 0xfff1de, pad2: 0xff9a8a
  },
  kitchen: {
    name: 'Sunny Kitchen', sky: ['#bfeee0', '#dcf7ee', '#fffbe8'], accent: '#3cc4a8',
    wall: 0xd3f4e6, wain: 0xfafdfc, trim: 0xffffff, floorA: 0xfff3c4, floorB: 0xffd88f, floorStyle: 'checker', slab: 0xd9a561, pad: 0xe9fbf5, pad2: 0x6fd6bd
  },
  attic: {
    name: 'Dusty Attic', sky: ['#f0c39a', '#f8dcbb', '#fff1dc'], accent: '#c98a52',
    wall: 0xdcb88e, wain: 0xc99f72, trim: 0x8a5d3b, floorA: 0xc59560, floorB: 0xb78450, floorStyle: 'planks', slab: 0x8f6240, pad: 0xf5e6c8, pad2: 0xb66a50
  },
  library: {
    name: 'Quiet Library', sky: ['#cbbaf5', '#e2d8fb', '#f8f1ff'], accent: '#8b6cf0',
    wall: 0xe2d9fa, wain: 0xb7a6ec, trim: 0xf6f0ff, floorA: 0xb88862, floorB: 0xa87a56, floorStyle: 'planks', slab: 0x8a6a9a, pad: 0xf5e9ff, pad2: 0x7d5fd1
  },
  playroom: {
    name: 'Happy Playroom', sky: ['#aee3ff', '#d9f2ff', '#fff7dd'], accent: '#ffb02e',
    wall: 0xfff0a6, wain: 0xffd35e, trim: 0xffffff, floorA: 0x9fdcff, floorB: 0xffc6dd, floorStyle: 'checker', slab: 0x7fb8e8, pad: 0xfffbee, pad2: 0xffb02e
  },
  // ---- story rooms (one per character) ----
  aman: {
    name: "Aman's Room", sky: ['#5b3a7a', '#b3578f', '#f7b3c4'], accent: '#e0446a',
    wall: 0x6a5aa4, wain: 0x45397a, trim: 0x2f2757, floorA: 0x84627f, floorB: 0x765676, floorStyle: 'planks', slab: 0x3a2f5c, pad: 0xe9d6ee, pad2: 0xa8567f
  },
  bunty: {
    name: "Bunty's Room", sky: ['#ffd27a', '#ffe8b4', '#fff7de'], accent: '#e2562f',
    wall: 0xf5bd62, wain: 0x2f7d5a, trim: 0x203f33, floorA: 0xa0958c, floorB: 0x91867e, floorStyle: 'planks', slab: 0x625850, pad: 0xd9d0bf, pad2: 0x7f6a4f
  },
  erika: {
    name: "Erika's Room", sky: ['#f4bff0', '#fadcf6', '#fff1fb'], accent: '#c158e0',
    wall: 0xf6cef2, wain: 0xd99be8, trim: 0xffffff, floorA: 0xfbe5f5, floorB: 0xf1d3ec, floorStyle: 'checker', slab: 0xa66fc9, pad: 0xfbe6f5, pad2: 0xd98be0
  },
  krick: {
    name: "Krick's Hideout", sky: ['#56657a', '#8696ab', '#d4dce6'], accent: '#e0a82e',
    wall: 0x727c89, wain: 0x4f5764, trim: 0x343944, floorA: 0x757a84, floorB: 0x666b75, floorStyle: 'checker', slab: 0x3d424d, pad: 0xb9b3a6, pad2: 0x7a7466
  },
  chinese: {
    name: 'Jade Dragon Teahouse', sky: ['#ffc490', '#ffdfb8', '#fff4de'], accent: '#d4382e',
    wall: 0xc9372f, wain: 0x8a2420, trim: 0xf2c14b, floorA: 0x6c4531, floorB: 0x5d3a29, floorStyle: 'planks', slab: 0x7b2d25, pad: 0xf2e2bd, pad2: 0xb8892b
  }
};

// A "place" is a world index (floating island, 0-5) or a room name (a key of ROOMS).
export const skyOf = (key) => (typeof key === 'string' ? ROOMS[key].sky : WORLDS[key].sky);
export const placeName = (key) => (typeof key === 'string' ? ROOMS[key].name : WORLDS[key].name);
export const placeAccent = (key) => (typeof key === 'string' ? ROOMS[key].accent : WORLDS[key].accent);
export const placeExists = (key) => (typeof key === 'string' ? !!ROOMS[key] : !!WORLDS[key]);
