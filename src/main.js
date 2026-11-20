import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './style.css';
import * as THREE from 'three';
import { LEVEL_TIME, CAM } from './config.js';
import { LEVELS, WORLDS, HAMMERS, skyOf } from './levels.js';
import { CHAPTERS, STORE, storyLevel, sceneObject, placeOf, brokenBefore } from './story.js';
import { assemble } from './objects.js';
import { World } from './world.js';
import { Breakable } from './breakable.js';
import { makeDiorama, pieceInfo, hasSet } from './rooms.js';
import { initNative } from './native.js';
import { Effects } from './effects.js';
import { Hammer } from './hammer.js';
import { AudioFX } from './audio.js';
import { Save } from './save.js';
import { UI } from './ui.js';
import { makeCamera, fitCamera, camAxes, setView } from './view.js';
import { MAT } from './materials.js';
import { mulberry32 } from './fracture.js';

window.__stage = 'main';
Save.load();

// ---------------------------------------------------------------- renderer + scene
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = makeCamera();

// soft pastel lighting: big hemisphere fill + one warm shadow-casting sun
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8c8ff, 1.75));
const sun = new THREE.DirectionalLight(0xfff1dc, 1.9);
sun.position.set(-2.1, 9, 6.3);
sun.target.position.set(0, 0.5, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
// extra soft light from the left, only used in room dioramas (keeps the shaded back wall pastel instead of grey)
const fill = new THREE.DirectionalLight(0xfff2e6, 0);
fill.position.set(8, 3, 1);
scene.add(fill);

const world = new World({ rng: Math.random });
scene.add(world.group);
const effects = new Effects(scene, camera);
const hammer = new Hammer(scene);
hammer.setSkin(Save.data.hammer);
const audio = new AudioFX();
audio.sfxOn = Save.data.settings.sfx;
audio.musicOn = Save.data.settings.music;

let diorama = null;
let dioramaSig = '';
/** key = world index (floating island) or room name (story room). hide = furniture pieces taken out of the static room. */
function setWorld(key, hide = null) {
  const sig = key + (hide && hide.size ? '|' + [...hide].sort().join(',') : '');
  if (sig === dioramaSig) return;
  dioramaSig = sig;
  if (diorama) diorama.dispose();
  diorama = makeDiorama(key, hide);
  world.walls = typeof key === 'string';
  fill.intensity = world.walls ? 1.0 : 0;
  scene.add(diorama.group);
  const s = skyOf(key);
  document.getElementById('bg').style.background = `linear-gradient(${s[0]}, ${s[1]} 55%, ${s[2]})`;
}

// ---------------------------------------------------------------- quality
let qualityMode = Save.data.settings.quality;
let lowApplied = false;
function applyQuality() {
  const dpr = window.devicePixelRatio || 1;
  const low = qualityMode === 'low' || (qualityMode === 'auto' && lowApplied);
  renderer.setPixelRatio(low ? 1 : Math.min(dpr, 2));
  sun.castShadow = !low;
  resize();
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  fitCamera(camera, w / h);
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- state
const S = {
  mode: 'menu',          // menu | intro | playing | settling | won | lost | paused | zen | scene | chapterEnd
  story: null,           // { ch, i } while a story chapter is being played
  prevMode: 'menu',
  level: null, br: null, asm: null, items: null, palette: [0xffffff],   // items = live furniture pieces of a story-room level
  hitsLeft: 0, hitsUsed: 0, pending: 0, time: LEVEL_TIME, crits: 0,
  t: 0, introT: 0, settleT: 0, endT: 0, resultShown: false, failReason: '',
  dropT: 0, landed: false, landT: 0,
  slow: { t: 0, dur: 0, scale: 1 }, timeScale: 1,
  shown: 0, shownF: 0, combo: 0, lastPop: 0, idleCount: 0, calmT: 0, zenIdx: -1,
  coinsDone: false,
  demoT: 0, demoIdx: 0, demoUsed: false, demoWorld: 0, lastTick: -1
};

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const DEMO = ['ceramic_vase', 'teapot', 'clay_pot', 'piggy_bank', 'glass_bottle', 'flower_pot', 'gnome', 'urn', 'mug', 'barrel', 'stone_statue', 'plates'];

const ZEN = ['ceramic_vase', 'glass_bottle', 'piggy_bank', 'teapot', 'wooden_crate', 'plates', 'gnome', 'flower_pot', 'urn', 'barrel', 'brick_wall', 'mug', 'clay_pot', 'big_vase', 'trophy', 'stone_statue'];
const SHINY = new Set(['glass', 'metal', 'ceramic']);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const vibrate = (p) => { if (Save.data.settings.vibe && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) { try { navigator.vibrate(p); } catch { /* unsupported */ } } };

// ---------------------------------------------------------------- UI
const ui = new UI(document.getElementById('ui'), {
  sfx: (n, a) => { if (n === 'blip') audio.blip(a || 0); else if (n === 'click') audio.click(); else if (n === 'fail') audio.fail(); else if (n === 'star') audio.star(a || 0); else if (n === 'coin') audio.coin(); },
  onPlay: () => startLevel(Math.min(LEVELS.length, Save.data.unlocked)),
  onLevel: (id) => startLevel(id),
  onPause: () => pause(),
  onResume: () => resume(),
  onRestart: () => beginLevel(S.level),
  onNext: () => (S.story ? storyAdvance() : startLevel(Math.min(LEVELS.length, S.level.id + 1))),
  onMenu: () => (S.story ? toMenu('story') : toMenu()),
  onChapter: (id) => playChapter(id),
  onBuyRoom: (ch) => buyPremium(ch),
  onMag: (l, instant) => setZoomLevel(l, instant),
  onPiece: (i) => focusPiece(i),
  onSceneDone: () => storyAdvance(),
  onAsmr: () => startZen(),
  onZenNext: () => zenNext(),
  onZenAgain: () => zenAgain(),
  onSetting: (k, v) => {
    Save.data.settings[k] = v; Save.save();
    if (k === 'sfx') audio.setSfx(v);
    if (k === 'music') audio.setMusic(v);
    if (k === 'quality') { qualityMode = v; lowApplied = false; applyQuality(); }
  },
  onBuy: (id) => {
    const hm = HAMMERS.find((x) => x.id === id);
    if (Save.data.coins < hm.price) { audio.fail(); ui.toast('Not enough coins yet!'); return; }
    Save.data.coins -= hm.price; Save.data.owned.push(id); Save.data.hammer = id; Save.save();
    hammer.setSkin(id); audio.coin(); ui.toast(hm.name + ' unlocked!'); ui.refreshShop();
  },
  onEquip: (id) => { Save.data.hammer = id; Save.save(); hammer.setSkin(id); ui.refreshShop(); },
  onDaily: () => {
    audio.unlock();
    const c = Save.claimDaily();
    if (c) { audio.coin(); ui.toast(`+${c} coins! Come back tomorrow`); ui.refreshMenu(); effects.confetti(60); } else { audio.click(); ui.toast('Already claimed - see you tomorrow!'); }
  },
  onReset: () => {
    Save.reset();
    audio.setSfx(true); audio.setMusic(true);
    hammer.setSkin('wood');
    qualityMode = 'auto'; lowApplied = false; applyQuality();
  }
});

// ---------------------------------------------------------------- object lifecycle
function paletteOf(asm) {
  const seen = new Set(), out = [];
  const c = new THREE.Color();
  for (const cell of asm.cells) {
    const k = cell.style.s.join(',');
    if (seen.has(k)) continue;
    seen.add(k);
    c.setRGB(cell.style.s[0], cell.style.s[1], cell.style.s[2]);
    out.push(c.getHex());
    if (out.length >= 4) break;
  }
  c.setRGB(asm.cells[0].style.c[0], asm.cells[0].style.c[1], asm.cells[0].style.c[2]);
  out.push(c.getHex());
  return out;
}

/** Remove whatever breakable(s) stand in the room. */
function clearField() {
  if (S.items) S.items.forEach((it) => it.br.dispose());
  S.items = null; world.sources = null;
  if (S.br) { S.br.dispose(); S.br = null; }
  world.clear(); effects.clear(); hammer.hideAll();
}

/** Story-room level: the listed furniture pieces become real breakables standing where they were. */
function spawnPieces(room, ids) {
  clearField();
  const seed = (Math.random() * 99999) | 0;
  S.items = [];
  ids.forEach((id, k) => {
    const info = pieceInfo(room, id);
    const asm = assemble(info.type, {}, seed + k * 7);
    const br = new Breakable(asm, world, { rng: mulberry32(seed + k + 1), yaw: info.yaw });
    br.group.position.set(info.x, 0, info.z);
    br.group.visible = true;
    br.update(0.016);
    scene.add(br.group);
    S.items.push({ id, br, asm, info });
  });
  const first = S.items[0];
  S.br = first.br; S.asm = first.asm;
  const pal = new Set();
  S.items.forEach((it) => paletteOf(it.asm).forEach((c) => pal.add(c)));
  S.palette = [...pal].slice(0, 8);
  S.dropT = 0; S.landed = true; S.landT = 9; S.coinsDone = false;
  S.shown = 0; S.shownF = 0; S.combo = 0; S.idleCount = 0; S.calmT = 0; S.slow.dur = 0; S.timeScale = 1;
  world.sources = S.items.map((it) => it.br);
  world.refreshStatics();
  const n = S.items.length;
  return { icon: first.info.icon, name: n === 1 ? first.info.name : n + ' things to smash', list: S.items.map((it) => ({ icon: it.info.icon, name: it.info.name })) };
}

const allBroken = () => (S.items ? S.items.every((it) => it.br.attached === 0) : !S.br || S.br.attached === 0);

function spawnObject(type, variant) {
  clearField();
  const seed = (Math.random() * 99999) | 0;
  const asm = assemble(type, variant, seed);
  const br = new Breakable(asm, world, { rng: mulberry32(seed + 1), yaw: Math.PI / 4 + (Math.random() - 0.5) * 0.5 });
  br.group.position.y = 6.5;
  br.group.visible = true;
  scene.add(br.group);
  S.br = br; S.asm = asm; S.palette = paletteOf(asm);
  S.dropT = 0; S.landed = false; S.landT = 0; S.coinsDone = false;
  S.shown = 0; S.shownF = 0; S.combo = 0; S.idleCount = 0; S.calmT = 0; S.slow.dur = 0; S.timeScale = 1;
  return asm;
}

function landed() {
  S.landed = true; S.landT = 0;
  S.br.group.position.y = 0;
  const p = new THREE.Vector3(0, 0.05, 0);
  effects.dust(p, 8, 0xffffff, 1.0, 1.6);
  effects.ring(p, 3.2, 0xffffff, 0.5, true);
  effects.shake(0.05);
  audio.pop();
  world.setStatics(S.br.staticList());
}

// ---------------------------------------------------------------- zoom (story rooms)
// In a story room the whole room is shown first. Tapping a spot zooms the camera onto it (magnifier bar on the right
// zooms back out); zoomed in, taps hit things, and a tap on bare floor just slides the zoomed view there.
const ZMAX = 2.3;
S.zoom = { lvl: 0, tLvl: 0, fx: 0, fy: 0, tfx: 0, tfy: 0, applied: '' };
const zoomOf = (l) => 1 + l * (ZMAX - 1);
function focusOn(point) {
  const ax = camAxes(camera), d = point.clone().sub(new THREE.Vector3(...CAM.target));
  // centre the touched spot exactly (no edge clamp: a piece near the top of the room must not stay hidden under the HUD)
  S.zoom.tfx = d.dot(ax.right); S.zoom.tfy = d.dot(ax.up);
  S.zoom.tLvl = 1;
}
function setZoomLevel(l, instant) {
  const z = S.zoom;
  z.tLvl = clamp(l, 0, 1);
  if (z.tLvl < 0.02) { z.tLvl = 0; z.tfx = 0; z.tfy = 0; }
  if (instant) { z.lvl = z.tLvl; if (z.tLvl === 0) { z.fx = 0; z.fy = 0; } }
}
function zoomOut() { setZoomLevel(0, false); }
function resetZoom() {
  Object.assign(S.zoom, { lvl: 0, tLvl: 0, fx: 0, fy: 0, tfx: 0, tfy: 0 });
  stepZoom(0);
}
function stepZoom(dt) {
  const z = S.zoom, k = dt > 0 ? 1 - Math.exp(-dt * 9) : 1;
  z.lvl += (z.tLvl - z.lvl) * k; z.fx += (z.tfx - z.fx) * k; z.fy += (z.tfy - z.fy) * k;
  if (Math.abs(z.tLvl - z.lvl) < 0.002) z.lvl = z.tLvl;
  if (Math.abs(z.tfx - z.fx) < 0.003) z.fx = z.tfx;
  if (Math.abs(z.tfy - z.fy) < 0.003) z.fy = z.tfy;
  const zoom = zoomOf(z.lvl), fx = z.fx * z.lvl, fy = z.fy * z.lvl;       // the shift grows with the zoom, so zooming out glides back to the whole room
  const sig = zoom.toFixed(4) + '|' + fx.toFixed(4) + '|' + fy.toFixed(4);
  if (sig !== z.applied) { z.applied = sig; setView(camera, fx, fy, zoom); }
  hammer.sizeK = 1 / Math.sqrt(zoom);
  if (S.items) ui.magLevel(Math.round(z.lvl * 50) / 50);
}

/** Chip tapped in the HUD: zoom onto that piece. */
function focusPiece(i) {
  const it = S.items && S.items[i];
  if (!it || it.br.attached <= 0 || S.mode !== 'playing') return;
  it.br.group.updateMatrixWorld(true);
  focusOn(it.asm.zones[0].at.clone().applyMatrix4(it.br.group.matrixWorld));
}

const _mk = new THREE.Vector3();
/** Keep the 'smash me' markers above every piece that is still standing; tick off the ones that are gone. */
function updateMarks() {
  if (!S.items) return;
  const show = S.mode === 'intro' || S.mode === 'playing' || S.mode === 'settling';
  S.items.forEach((it, i) => {
    if (it.br.attached === 0) { ui.pieceDone(i); return; }
    if (!show) { ui.placeMark(i, null); return; }
    it.br.group.updateMatrixWorld(true);
    const z = it.asm.zones[0].at;
    _mk.set(z.x, it.asm.height + 0.18, z.z).applyMatrix4(it.br.group.matrixWorld).project(camera);
    const inView = _mk.x > -0.92 && _mk.x < 0.8 && _mk.y > -0.7 && _mk.y < 0.72;
    if (inView) ui.placeMark(i, (_mk.x * 0.5 + 0.5) * window.innerWidth, (-_mk.y * 0.5 + 0.5) * window.innerHeight);
    else ui.placeMark(i, null);
  });
}

/** World point of the room under a screen position (walls, floor, furniture, live pieces). */
function roomPointAt(nx, ny) {
  ndc.set(nx, ny);
  ray.setFromCamera(ndc, camera);
  const objs = [diorama.group, ...(S.items || []).map((it) => it.br.group)];
  const hit = ray.intersectObjects(objs, true)[0];
  return hit ? hit.point.clone() : null;
}

/** A tap in a story-room level: zoom in first, then strike; bare floor while zoomed in pans the view. */
function roomTap(nx, ny) {
  if (!hammer.free) return;
  if (S.zoom.tLvl < 0.5) {
    const p = roomPointAt(nx, ny);
    if (p) focusOn(p);
    return;
  }
  if (!fireAt(nx, ny, true)) {
    const p = roomPointAt(nx, ny);
    if (p) focusOn(p);
  }
}

// ---------------------------------------------------------------- level flow
function startLevel(id) {
  const lv = LEVELS[id - 1];
  if (!lv) return;
  S.story = null;
  beginLevel(lv);
}

/** Play any level object (a main-game level or a story level). */
function beginLevel(lv) {
  audio.unlock();
  S.level = lv;
  ui.hideScreens(); ui.closeOverlay(); ui.hideScene();
  resetZoom();
  let asm;
  if (lv.live && hasSet(lv.place)) {
    const hide = new Set([...(S.story ? S.story.broken : []), ...lv.live]);
    setWorld(lv.place, hide);
    asm = spawnPieces(lv.place, lv.live);
  } else {
    setWorld(lv.place ?? lv.world);
    asm = spawnObject(lv.obj, lv.variant);
  }
  S.hitsLeft = lv.hits; S.hitsUsed = 0; S.pending = 0; S.time = lv.time; S.crits = 0;
  S.mode = 'intro'; S.introT = 0; S.resultShown = false; S.lastTick = -1;
  ui.hideZen();
  ui.showHud(lv, asm);
  ui.showMag(!!S.items);
  ui.hud({ count: 0, hits: lv.hits, time: lv.time });
  ui.showIntro(lv, asm, ui.randomTip());
  audio.startMusic('game');
}

function beginPlay() {
  if (S.mode !== 'intro') return;
  S.mode = 'playing';
  ui.hideIntro();
  ui.banner('SMASH!');
  audio.pop();
}

function enterSettling(reason) {
  if (S.mode !== 'playing') return;
  S.mode = 'settling'; S.settleT = 0;
  S.failReason = reason === 'time' ? "Time's up!" : reason === 'hits' ? 'Out of hammer hits!' : 'Nothing left to smash!';
}

function winLevel() {
  if (S.mode === 'won') return;
  S.mode = 'won'; S.endT = 0;
  if (S.level.story) { Save.storySet(S.level.story.ch, S.level.story.i + 1); if (S.story && S.level.live) S.level.live.forEach((id) => S.story.broken.add(id)); }
  else { Save.data.unlocked = Math.max(Save.data.unlocked, S.level.id + 1); Save.save(); }
  zoomOut();
  audio.win(); vibrate([60, 40, 60, 40, 120]);
  ui.banner('LEVEL COMPLETED!', 'Fragments: ' + world.count);
  effects.confetti(120);
  ui.flash();
}

function showWinResult() {
  S.resultShown = true;
  const lv = S.level, count = world.count, ratio = count / lv.target;
  const stars = ratio >= 1.4 ? 3 : ratio >= 1.15 ? 2 : 1;
  const extra = S.crits * 2 + world.coinsReleased;
  const r = lv.story ? Save.storyLevelDone(lv, stars, lv.reward, extra) : Save.complete(lv, stars, 20 + (lv.id - 1) * 3 + lv.world * 5, extra);
  ui.hideHud();
  ui.showResult(true, { level: lv, stars, count, hitsUsed: S.hitsUsed, crits: S.crits, coins: r.coins });
  audio.coin();
}

function loseLevel() {
  S.mode = 'lost'; S.resultShown = true;
  zoomOut();
  audio.fail(); vibrate(120);
  ui.hideHud();
  ui.showResult(false, { level: S.level, count: world.count, reason: S.failReason, tip: ui.randomTip() });
}

function pause() {
  if (!['intro', 'playing', 'settling'].includes(S.mode)) return;
  S.prevMode = S.mode; S.mode = 'paused';
  ui.showPause();
}
function resume() {
  if (S.mode !== 'paused') return;
  S.mode = S.prevMode;
}

function toMenu(screen = 'menu') {
  hammer.hideAll();
  ui.hideHud(); ui.hideZen(); ui.hideIntro(); ui.hideScene(); ui.closeOverlay();
  resetZoom();
  S.mode = 'menu'; S.level = null; S.story = null;
  ui.show(screen);
  audio.startMusic('menu');
  nextDemo();
}

// ---------------------------------------------------------------- story mode
// A chapter is a list of beats (see story.js): dialogue scenes and smash levels, played in order.
function playChapter(id) {
  const ch = CHAPTERS.find((c) => c.id === id);
  if (!ch || ch.soon || !ch.beats.length) return;
  if (ch.premium && !Save.owns(ch.sku)) return;       // premium rooms must be unlocked first
  const at = Save.storyBeat(id);
  S.story = { ch, i: at, broken: brokenBefore(ch, at) };
  runBeat();
}

function runBeat() {
  const st = S.story;
  if (!st) return;
  const beat = st.ch.beats[st.i];
  if (!beat) finishChapter();
  else if (beat.type === 'scene' || beat.type === 'vn') startScene(beat);
  else beginLevel(storyLevel(st.ch, st.i));
}

/** Called when a scene ends (or is skipped) and when the player continues after a story level. */
function storyAdvance() {
  const st = S.story;
  if (!st) return;
  st.i++;
  Save.storySet(st.ch.id, st.i);
  runBeat();
}

function startScene(beat) {
  audio.unlock();
  const st = S.story;
  ui.hideScreens(); ui.closeOverlay(); ui.hideHud(); ui.hideIntro(); ui.hideZen();
  hammer.hideAll();
  resetZoom();
  S.level = null;
  S.mode = 'scene';
  const place = placeOf(st.ch, beat);
  if (hasSet(place)) {
    setWorld(place, st.broken);
    clearField();                  // dialogue scenes show the room itself, no object in the middle
    S.landed = false;
  } else {
    setWorld(place);
    spawnObject(sceneObject(st.ch, st.i), beat.variant || {});
  }
  audio.startMusic('menu');
  ui.showScene(beat, { title: 'Chapter ' + st.ch.id, step: st.ch.title + ' · ' + (st.i + 1) + '/' + st.ch.beats.length });
}

/**
 * Buy a premium room. A real store plugs in by defining window.HBStore.purchase(sku) -> Promise<boolean>.
 * Until STORE.live is switched on, this test build unlocks the room for free so it can be tried.
 */
async function buyPremium(ch) {
  let ok = false;
  try {
    if (window.HBStore && typeof window.HBStore.purchase === 'function') ok = !!(await window.HBStore.purchase(ch.sku));
    else ok = !STORE.live;
  } catch { ok = false; }
  if (ok) Save.grant(ch.sku);
  return ok;
}

function finishChapter() {
  const st = S.story, ch = st.ch;
  const r = Save.storyComplete(ch);
  const idx = CHAPTERS.indexOf(ch);
  const nx = CHAPTERS[idx + 1];
  ui.hideHud(); ui.hideScene(); ui.hideIntro(); ui.closeOverlay();
  S.mode = 'chapterEnd'; S.level = null;
  audio.win(); vibrate([60, 40, 60, 40, 120]);
  effects.confetti(120);
  ui.flash();
  const open = nx && !nx.soon && nx.beats.length && (!nx.premium || Save.owns(nx.sku));
  const note = nx && nx.premium && !nx.soon && !open ? `Premium room next: ${nx.title}. Find it in the chapter list.` : '';
  ui.showChapterEnd(ch, { coins: r.coins, next: open ? nx : null, note });
}

const musicFor = (mode) => (mode === 'menu' || mode === 'scene' || mode === 'chapterEnd' ? 'menu' : mode === 'zen' ? 'zen' : 'game');

// ---------------------------------------------------------------- ASMR (zen) mode
// Endless relaxing smashing: no timer, no hit limit, no failing. Just crunch and tinkle.
function startZen() {
  audio.unlock();
  ui.hideScreens(); ui.closeOverlay(); ui.hideHud(); ui.hideIntro(); ui.hideScene();
  hammer.hideAll();
  resetZoom();
  S.mode = 'zen'; S.level = null; S.story = null; S.zenIdx = -1;
  audio.startMusic('zen');
  zenNext();
  ui.showZen(S.asm);
}
function zenNext() {
  S.zenIdx = (S.zenIdx + 1) % ZEN.length;
  setWorld(S.zenIdx % WORLDS.length);
  spawnObject(ZEN[S.zenIdx], {});
  ui.zenInfo(S.asm);
}
function zenAgain() {
  spawnObject(ZEN[S.zenIdx], {});
  ui.zenInfo(S.asm);
}

/** Eased slow-motion (fragments hang in the air, highs duck and bloom back). */
function startSlow(dur, scale) {
  S.slow.t = 0; S.slow.dur = dur; S.slow.scale = scale;
  audio.slowMo(dur);
}

/** Rolling fragment counter: numbers climb quickly with soft rising bubble-pops. */
function tickCount(dt) {
  const target = world.count;
  if (S.shown < target) {
    S.idleCount = 0;
    S.shownF = Math.max(S.shownF, S.shown) + Math.max(dt * 30, (target - S.shownF) * Math.min(1, dt * 7));
    const next = Math.min(target, Math.floor(S.shownF));
    if (next > S.shown) {
      S.shown = next;
      const now = performance.now();
      if (now - S.lastPop > 36) { audio.countPop(S.combo++); S.lastPop = now; }
    }
  } else {
    if (S.shown > target) { S.shown = target; S.shownF = target; }
    S.idleCount += dt;
    if (S.idleCount > 0.7) S.combo = 0;
  }
}

// ---------------------------------------------------------------- menu attract mode
function nextDemo() {
  S.demoIdx = (S.demoIdx + 1) % DEMO.length;
  if (S.demoIdx % 3 === 0) S.demoWorld = (S.demoWorld + 1) % WORLDS.length;
  setWorld(S.demoWorld);
  spawnObject(DEMO[S.demoIdx], {});
  S.demoT = 0; S.demoUsed = false;
}

function demoHit() {
  if (!S.br || S.br.attached === 0) return;
  S.br.group.updateMatrixWorld(true);
  const zone = S.asm.zones[0];
  const zw = zone.at.clone().applyMatrix4(S.br.group.matrixWorld).project(camera);
  fireAt(zw.x, zw.y, false);
}

// ---------------------------------------------------------------- hitting
function pickTarget(n) {
  ray.setFromCamera(n, camera);
  const list = S.items || [{ br: S.br, asm: S.asm }];
  const org = ray.ray.origin;
  let a = null;
  for (const it of list) {
    if (it.br.attached <= 0) continue;
    it.br.group.updateMatrixWorld(true);
    const h = it.br.pick(ray);
    if (h && (!a || h.point.distanceToSquared(org) < a.point.distanceToSquared(org))) { a = h; a.item = it; }
  }
  const b = world.pickPiece(ray);
  let best = null;
  // the object wins over fragments still flying through the air; only a RESTING chunk that is
  // nearer to the camera takes the tap (so fast taps never get 'stolen' by flying debris)
  if (a && b) best = (b.piece.asleep && b.point.distanceToSquared(ray.ray.origin) < a.point.distanceToSquared(ray.ray.origin)) ? b : a;
  else best = a || b;
  if (!best) {
    let bd = 9;
    for (const it of list) {
      if (it.br.attached <= 0) continue;
      const h = it.br.snapPick(camera, n, 0.1);
      if (!h) continue;
      const pr = h.point.clone().project(camera), d = Math.hypot((pr.x - n.x) * camera.aspect, pr.y - n.y);
      if (d < bd) { bd = d; best = h; best.item = it; }
    }
  }
  return best;
}

/** Fire the hammer at normalised screen position (nx, ny). counted = uses a hit of the level. */
function fireAt(nx, ny, counted) {
  if (!S.br) return false;
  if (!hammer.free) return false;
  ndc.set(nx, ny);
  const target = pickTarget(ndc);
  if (!target) return false;
  if (counted) { S.hitsLeft--; S.hitsUsed++; S.pending++; ui.hud({ count: S.shown, hits: S.hitsLeft, time: S.time }); }
  const axes = camAxes(camera);
  const toward = camera.getWorldDirection(new THREE.Vector3()).negate();
  audio.whoosh();
  hammer.swing(target.point, target.normal, axes.right, axes.up, toward, () => impact(target, counted));
  return true;
}

function impact(target, counted) {
  if (counted) S.pending = Math.max(0, S.pending - 1);
  if (!S.br) return;
  const axes = camAxes(camera);
  let res;
  if (target.piece) {
    if (target.piece.dead) res = { c: 0.5, P: 0.8, label: 'weak', total: 0, mat: 'ceramic' };
    else {
      const mat = target.piece.mat;
      const n = world.smash(target.piece, target.point, 1);
      res = { c: 1.5, P: 1.6, label: 'smash', total: n, mat };
    }
  } else {
    if (target.item && target.item.br !== S.br) { S.br = target.item.br; S.asm = target.item.asm; }
    res = S.br.hit(target.point, target.normal, axes.right, axes.up, 1);
  }
  const crit = res.label === 'critical';
  if (counted && crit) S.crits++;
  if (S.hist && S.hist.length > 60) S.hist.shift();
  (S.hist = S.hist || []).push({ label: res.label, c: +res.c.toFixed(2), total: res.total, piece: !!target.piece, counted, x: +target.point.x.toFixed(2), y: +target.point.y.toFixed(2), z: +target.point.z.toFixed(2) });
  const snd = MAT[res.mat].snd;

  const p = target.point.clone().project(camera);
  const pan = clamp(p.x * 0.9, -0.9, 0.9);
  effects.impact(target.point, target.normal, res.P, crit, S.palette);
  effects.shake(crit ? 0.2 : 0.035 + res.P * 0.03);
  audio.hammer(res.P, pan);
  if (res.total > 0) audio.shatter(snd, res.total, crit, pan); else audio.crackle(snd, res.P, pan);
  const quiet = S.mode === 'menu' && ui.name !== 'menu';   // demo smash behind the level list / shop
  if (crit) { startSlow(S.mode === 'zen' ? 0.8 : 0.62, 0.22); if (!quiet) ui.flash(); vibrate([35, 25, 70]); }
  else { if (res.total >= 25) startSlow(0.38, 0.4); vibrate(res.total > 0 ? 25 : 12); }

  // popups at the impact point
  const x = (p.x * 0.5 + 0.5) * window.innerWidth, y = (-p.y * 0.5 + 0.5) * window.innerHeight;
  const txt = { critical: ['CRITICAL!', 'crit'], good: ['GOOD HIT!', 'good'], ok: ['OK', ''], weak: ['WEAK', 'weak'], smash: ['SMASH!', 'good'] }[res.label];
  if (txt && !quiet) ui.popup(txt[0], x, y - 20, txt[1]);
  if (res.total > 0 && !quiet) ui.popup('+' + res.total, x + (Math.random() - 0.5) * 70, y + 26, 'num');

  // piggy bank coins
  if (S.asm.coins && !S.coinsDone && S.br.progress > 0.12) {
    S.coinsDone = true;
    const c = new THREE.Vector3(0, 1.2, 0).applyMatrix4(S.br.group.matrixWorld);
    world.spawnCoins(S.asm.coins, c);
    audio.coin();
  }
}

function onPointerDown(e) {
  audio.unlock();
  if (S.mode === 'intro' && S.landed && S.introT > 0.6) beginPlay();
  const r = canvas.getBoundingClientRect();
  const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -((e.clientY - r.top) / r.height) * 2 + 1;
  if (S.mode === 'playing') {
    if (S.hitsLeft <= 0) return;
    if (S.items) roomTap(nx, ny); else fireAt(nx, ny, true);
  } else if ((S.mode === 'menu' || S.mode === 'zen') && S.landed) {
    if (fireAt(nx, ny, false)) S.demoUsed = true;
  }
}
canvas.addEventListener('pointerdown', onPointerDown);
// Android (and every mobile browser) only lets audio start from a tap: unlock on the very first tap anywhere,
// buttons included, so the menu music and the button clicks work from the first touch.
window.addEventListener('pointerdown', () => { if (!audio.ctx || audio.ctx.state !== 'running') audio.unlock(); }, true);

/** Android back button: step back one level of the UI; returns 'exit' when there is nothing left to close. */
function goBack() {
  const overlayOpen = !document.getElementById('overlay').classList.contains('hidden');
  if (S.mode === 'paused') { ui.closeOverlay(); resume(); return 'handled'; }
  if (S.mode === 'playing' || S.mode === 'intro' || S.mode === 'settling') { pause(); return 'handled'; }
  if (S.mode === 'won' || S.mode === 'lost' || S.mode === 'chapterEnd') { const to = S.story ? 'story' : 'menu'; ui.closeOverlay(); toMenu(to); return 'handled'; }
  if (S.mode === 'scene') { toMenu('story'); return 'handled'; }
  if (S.mode === 'zen') { toMenu(); return 'handled'; }
  if (overlayOpen) { ui.closeOverlay(); return 'handled'; }
  if (ui.name && ui.name !== 'menu') { ui.show('menu'); return 'handled'; }
  return 'exit';
}
initNative(goBack);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (S.mode === 'paused') ui.closeOverlay(), resume(); else pause(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); audio.stopMusic(); } else if (audio.ctx) audio.startMusic(musicFor(S.mode)); });

// ---------------------------------------------------------------- events from the physics world
function processEvents() {
  const ev = world.events;
  if (!ev.length) return;
  const col = S.palette[(Math.random() * S.palette.length) | 0];
  for (const e of ev) {
    const snd = MAT[e.mat] ? MAT[e.mat].snd : 'ceramic';
    const pan = clamp(e.pos.clone().project(camera).x * 0.9, -0.9, 0.9);
    if (e.t === 'bounce') {
      audio.bounce(snd, e.speed, e.size, pan);
      if (e.speed > 2.4) effects.landing(e.pos, e.speed, col);
      if (e.speed > 3 && SHINY.has(snd) && Math.random() < (snd === 'ceramic' ? 0.35 : 0.85)) effects.glint(e.pos, 0xffffff);
    } else if (e.t === 'split') {
      audio.split(snd, e.size, pan);
      effects.landing(e.pos, 5, col);
    } else if (e.t === 'kick') audio.bounce(snd, 6, 0.2, pan);
  }
  ev.length = 0;
}

// ---------------------------------------------------------------- main loop
const perf = { acc: 0, n: 0, done: false };
let last = performance.now();

function update(raw) {
  const dt = Math.min(raw, 0.05);
  S.t += dt;
  if (S.mode === 'paused') return;

  if (S.slow.dur > 0) {
    S.slow.t += dt;
    const k = S.slow.t / S.slow.dur;
    if (k >= 1) { S.slow.dur = 0; S.timeScale = 1; }
    else {
      const r = k < 0.1 ? k / 0.1 : k > 0.55 ? (1 - k) / 0.45 : 1;
      S.timeScale = 1 - (1 - S.slow.scale) * (r * r * (3 - 2 * r));
    }
  } else S.timeScale = 1;
  const sdt = dt * S.timeScale;

  if (diorama) diorama.update(dt);

  // object drop-in
  if (S.br && !S.landed) {
    S.dropT += dt;
    const k = Math.min(1, S.dropT / 0.55);
    S.br.group.position.y = 6.5 * (1 - k * k);
    if (k >= 1) landed();
  } else if (S.br && S.landed && !S.items) {
    S.landT += dt;
    const sq = S.landT < 0.3 ? Math.sin((S.landT / 0.3) * Math.PI) * 0.1 : 0;
    S.br.group.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
  }

  stepZoom(dt);
  updateMarks();
  if (S.items) S.items.forEach((it) => it.br.update(sdt)); else if (S.br) S.br.update(sdt);
  hammer.update(dt);
  world.update(sdt);
  effects.update(sdt);
  effects.applyShake(dt);
  processEvents();
  tickCount(dt);

  switch (S.mode) {
    case 'menu':
      S.demoT += dt;
      if (!S.demoUsed && S.landed && S.demoT > 1.9) { S.demoUsed = true; demoHit(); }
      if (S.demoT > (S.demoUsed ? 6.2 : 14)) nextDemo();
      break;
    case 'zen': {
      const calm = S.br && S.br.attached === 0 && world.allAsleep();
      S.calmT = calm ? S.calmT + dt : 0;
      ui.zen({ count: S.shown, calm: S.calmT > 1.4 });
      break;
    }
    case 'intro':
      S.introT += dt;
      if (S.landed && S.introT > 2.4) beginPlay();
      break;
    case 'playing': {
      S.time -= dt;
      const sec = Math.ceil(S.time);
      if (S.time <= 5 && sec !== S.lastTick && sec > 0) { S.lastTick = sec; audio.tick(true); }
      if (S.time <= 0) { S.time = 0; enterSettling('time'); }
      else if (S.hitsLeft <= 0 && S.pending === 0) enterSettling('hits');
      else if (allBroken() && S.pending === 0 && !world.pieces.some((p) => !p.coin && world.canSplit(p))) enterSettling('nothing');
      break;
    }
    case 'settling':
      S.settleT += dt;
      if (S.pending === 0 && ((world.allAsleep() && S.settleT > 0.8) || S.settleT > 2.8)) loseLevel();
      break;
    case 'won':
      S.endT += dt;
      if (S.endT > 1.7 && !S.resultShown) showWinResult();
      break;
    default: break;
  }
  if ((S.mode === 'playing' || S.mode === 'settling') && world.count >= S.level.target) winLevel();
  if (S.level && (S.mode === 'playing' || S.mode === 'intro' || S.mode === 'settling')) ui.hud({ count: S.shown, hits: S.hitsLeft, time: S.time });
  if (S.mode === 'won' && !S.resultShown) ui.hud({ count: S.shown, hits: S.hitsLeft, time: S.time });
}

function frame(now) {
  const raw = (now - last) / 1000;
  last = now;
  update(raw);
  renderer.render(scene, camera);

  // auto quality: drop to the light profile if the first seconds of play are slow
  if (qualityMode === 'auto' && !perf.done && S.mode === 'playing') {
    perf.acc += raw; perf.n++;
    if (perf.n >= 150) {
      perf.done = true;
      if (perf.acc / perf.n > 0.03) { lowApplied = true; applyQuality(); ui.toast('Performance mode on'); }
    }
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- boot
applyQuality();
if (qualityMode === 'low') applyQuality();
window.__HB = { S, world, ui, startLevel, camera, scene, Save, effects, audio, AudioFX, startZen, playChapter, setWorld, buyPremium, renderer };
nextDemo();
audio.musicMode = 'menu';
window.__stage = 'ready';
requestAnimationFrame((t) => { last = t; frame(t); });
