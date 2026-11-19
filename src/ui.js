import { WORLDS, LEVELS, HAMMERS, TIPS, placeAccent } from './levels.js';
import { OBJECTS } from './objects.js';
import { Save } from './save.js';
import { CHAPTERS, CAST, STORY_NOTE, STORE, nextChapter } from './story.js';
import { portraitSVG, avatarSVG, backdropSVG } from './portraits.js';

// ---------------------------------------------------------------------------
// DOM user interface: menu, level select, hammer shop, settings, HUD, intro,
// pause and result overlays.
// ---------------------------------------------------------------------------

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export const ICON = {
  coin: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#ffb400"/><circle cx="16" cy="15" r="13" fill="#ffd54a"/><circle cx="16" cy="15" r="9" fill="none" stroke="#f2a100" stroke-width="2.5"/><path d="M16 9.5v11M13 12.5h5a2 2 0 010 3h-4a2 2 0 000 3h5" fill="none" stroke="#f2a100" stroke-width="2.2" stroke-linecap="round"/></svg>',
  gear: '<svg viewBox="0 0 32 32"><path fill="currentColor" d="M14 3h4l.7 3.3 2.2.9 2.8-1.9 2.8 2.8-1.9 2.8.9 2.2L29 14v4l-3.3.7-.9 2.2 1.9 2.8-2.8 2.8-2.8-1.9-2.2.9L18 29h-4l-.7-3.3-2.2-.9-2.8 1.9-2.8-2.8 1.9-2.8-.9-2.2L3 18v-4l3.3-.7.9-2.2-1.9-2.8 2.8-2.8 2.8 1.9 2.2-.9z"/><circle cx="16" cy="16" r="4.5" fill="#fff"/></svg>',
  pause: '<svg viewBox="0 0 32 32"><rect x="8" y="6" width="6" height="20" rx="2.5" fill="currentColor"/><rect x="18" y="6" width="6" height="20" rx="2.5" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 32 32"><path d="M9 5.5v21a1.5 1.5 0 002.3 1.3l17-10.5a1.5 1.5 0 000-2.6l-17-10.5A1.5 1.5 0 009 5.5z" fill="currentColor"/></svg>',
  back: '<svg viewBox="0 0 32 32"><path d="M20 5l-11 11 11 11" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  zoom: '<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" stroke-width="2.8"/><path d="M15 15l6 6" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>',
  zoomIn: '<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M15 15l6 6" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><path d="M7 10h6M10 7v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  zoomOut: '<svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M15 15l6 6" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><path d="M7 10h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  home: '<svg viewBox="0 0 32 32"><path d="M16 4L3 16h4v11h7v-7h4v7h7V16h4z" fill="currentColor"/></svg>',
  retry: '<svg viewBox="0 0 32 32"><path d="M26 16a10 10 0 11-3.2-7.3" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><path d="M27 4v8h-8z" fill="currentColor"/></svg>',
  next: '<svg viewBox="0 0 32 32"><path d="M8 5l12 11L8 27M18 5l12 11-12 11" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" transform="scale(.85) translate(3 3)"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="12" rx="3" fill="#8f8ac4"/><path d="M7.5 10V7.5a4.5 4.5 0 019 0V10" fill="none" stroke="#8f8ac4" stroke-width="3"/></svg>',
  asmr: '<svg viewBox="0 0 32 32"><path d="M5 19v-3a11 11 0 0122 0v3" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><rect x="3" y="17" width="6" height="10" rx="3" fill="currentColor"/><rect x="23" y="17" width="6" height="10" rx="3" fill="currentColor"/><path d="M16 10l1.2 2.6 2.8.3-2.1 1.9.6 2.8L16 16.2l-2.5 1.4.6-2.8-2.1-1.9 2.8-.3z" fill="#fff"/></svg>',
  book: '<svg viewBox="0 0 32 32"><path d="M16 8c-3-2.5-7-3-11-2.5v18c4-.5 8 0 11 2.5 3-2.5 7-3 11-2.5v-18c-4-.5-8 0-11 2.5z" fill="#fff"/><path d="M16 8v18" stroke="#8b5cf6" stroke-width="2.2"/><path d="M8 11.5c2-.2 4 0 6 .8M8 15.5c2-.2 4 0 6 .8M18 12.3c2-.8 4-1 6-.8M18 16.3c2-.8 4-1 6-.8" fill="none" stroke="#c7b2f7" stroke-width="1.6" stroke-linecap="round"/></svg>',
  gift: '<svg viewBox="0 0 32 32"><rect x="4" y="12" width="24" height="16" rx="3" fill="#fff"/><rect x="2" y="8" width="28" height="7" rx="2.5" fill="#fff"/><rect x="14" y="8" width="4" height="20" fill="#ff5f9a"/><path d="M16 8c-3-6-9-4-7 0zM16 8c3-6 9-4 7 0z" fill="none" stroke="#fff" stroke-width="3"/></svg>',
  sfx: '<svg viewBox="0 0 32 32"><path d="M5 12h5l7-6v20l-7-6H5z" fill="currentColor"/><path d="M21 11a7 7 0 010 10M24 7a12 12 0 010 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  music: '<svg viewBox="0 0 32 32"><path d="M12 24V7l14-3v17" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="9" cy="24" r="4" fill="currentColor"/><circle cx="23" cy="21" r="4" fill="currentColor"/></svg>',
  vibe: '<svg viewBox="0 0 32 32"><rect x="10" y="4" width="12" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><path d="M4 11v10M28 11v10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  gfx: '<svg viewBox="0 0 32 32"><path d="M16 3l11 6v14l-11 6L5 23V9z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M5 9l11 6 11-6M16 15v14" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>',
  star(on = true) {
    return `<svg viewBox="0 0 32 32"><path d="M16 2.5l4.1 8.6 9.4 1.2-6.9 6.5 1.8 9.3L16 23.4l-8.4 4.7 1.8-9.3L2.5 12.3l9.4-1.2z" fill="${on ? '#ffc93c' : '#d9d5f0'}" stroke="${on ? '#e69a00' : '#b9b4de'}" stroke-width="2" stroke-linejoin="round"/>${on ? '<path d="M11 12l5-4.5" stroke="#fff3b0" stroke-width="2.2" stroke-linecap="round" fill="none"/>' : ''}</svg>`;
  },
  hammer(skin, extra = '') {
    return `<svg viewBox="0 0 48 48" ${extra}><g transform="rotate(35 24 24)"><rect x="21" y="16" width="6" height="30" rx="3" fill="${hex(skin.handle)}"/><rect x="8" y="5" width="32" height="18" rx="5" fill="${hex(skin.head)}"/><rect x="8" y="5" width="6" height="18" rx="3" fill="${hex(skin.band)}"/><rect x="34" y="5" width="6" height="18" rx="3" fill="${hex(skin.band)}"/><rect x="12" y="7" width="22" height="4" rx="2" fill="#fff" opacity=".35"/></g></svg>`;
  }
};

const LOGO1 = 'TAKE\u00a0IT'.split('').map((c, i) => `<span class="ch c${i % 5}">${c}</span>`).join('');
const LOGO2 = 'OUT'.split('').map((c, i) => `<span class="ch c${(i + 2) % 5}">${c}</span>`).join('');

const TEMPLATE = `
<section id="menu" class="screen">
  <div class="topbar">
    <div class="pill">${ICON.coin}<span id="m-coins">0</span></div>
    <button class="icon-btn" id="btn-settings" aria-label="Settings">${ICON.gear}</button>
  </div>
  <div class="logo"><span class="l1">${LOGO1}</span><span class="l2">${LOGO2}</span><div class="tag">PASSIVE-AGGRESSIVE SMASHING</div></div>
  <div class="spacer"></div>
  <div class="menu-btns">
    <button class="btn btn-play" id="btn-play"><span>${ICON.play}PLAY</span><small id="play-sub">Level 1</small></button>
    <button class="btn btn-story" id="btn-story"><span>${ICON.book}STORY</span><small id="story-sub">Chapter 1</small></button>
    <div class="row">
      <button class="btn" id="btn-levels">LEVELS</button>
      <button class="btn btn-green" id="btn-hammers">HAMMERS</button>
    </div>
    <div class="row">
      <button class="btn btn-teal" id="btn-asmr">${ICON.asmr}ASMR</button>
      <button class="btn btn-gift" id="btn-daily">${ICON.gift}<span id="daily-txt">GIFT</span><i class="dot" id="daily-dot"></i></button>
    </div>
  </div>
</section>

<section id="levels" class="screen solid hidden">
  <div class="topbar"><button class="icon-btn" id="lv-back" aria-label="Back">${ICON.back}</button><div class="title">LEVELS</div><div class="pill">${ICON.coin}<span class="coin-n">0</span></div></div>
  <div class="scroll" id="lv-list"></div>
</section>

<section id="story" class="screen solid hidden">
  <div class="topbar"><button class="icon-btn" id="story-back" aria-label="Back">${ICON.back}</button><div class="title">STORY</div><div class="pill">${ICON.coin}<span class="coin-n">0</span></div></div>
  <div class="scroll" id="story-list"></div>
</section>

<section id="shop" class="screen solid hidden">
  <div class="topbar"><button class="icon-btn" id="shop-back" aria-label="Back">${ICON.back}</button><div class="title">HAMMERS</div><div class="pill">${ICON.coin}<span class="coin-n">0</span></div></div>
  <div class="scroll" id="shop-list"></div>
</section>

<section id="hud" class="hidden">
  <div class="hud-top">
    <button class="icon-btn" id="btn-pause" aria-label="Pause">${ICON.pause}</button>
    <div class="chip"><div class="oi" id="h-icon">🏺</div><div class="ot"><b id="h-name">Ceramic Vase</b><small id="h-level">Level 1</small></div></div>
    <div class="timer" id="h-timer"><svg viewBox="0 0 58 58"><circle class="bg" cx="29" cy="29" r="22"/><circle class="fg" id="h-ring" cx="29" cy="29" r="22" stroke-dasharray="138.2" stroke-dashoffset="0"/></svg><b id="h-time">15</b></div>
  </div>
  <div class="bar-wrap">
    <div class="bar-top"><span>FRAGMENTS</span><b><em id="h-count" style="font-style:normal">0</em> <i>/ <span id="h-target">35</span></i></b></div>
    <div class="bar" id="h-bar"><div class="fill" id="h-fill"></div><div class="mk" id="h-mk"></div><div class="mk star" id="h-s2">${ICON.star(true)}</div><div class="mk star" id="h-s3">${ICON.star(true)}</div></div>
  </div>
  <div class="pieces hidden" id="h-pieces"></div>
  <div class="hud-bottom"><div class="hits"><span>HITS</span><div id="h-hits" style="display:flex;gap:6px"></div></div></div>
</section>

<div id="pmarks"></div>
<div id="mag" class="hidden">
  <button class="mag-b" id="mag-out" aria-label="Zoom out">${ICON.zoomOut}</button>
  <div class="mag-track" id="mag-track"><i class="mag-fill" id="mag-fill"></i><b class="mag-knob" id="mag-knob">${ICON.zoom}</b></div>
  <button class="mag-b" id="mag-in" aria-label="Zoom in">${ICON.zoomIn}</button>
</div>
<div id="mag-hint" class="hidden"></div>

<section id="zen" class="hidden">
  <div class="hud-top">
    <button class="icon-btn" id="zen-home" aria-label="Home">${ICON.home}</button>
    <div class="chip"><div class="oi" id="z-icon">🏺</div><div class="ot"><b id="z-name">Ceramic Vase</b><small id="z-sub">ASMR · 0 fragments</small></div></div>
  </div>
  <div class="hud-bottom" style="flex-direction:column;align-items:center;gap:12px;margin-top:auto">
    <div id="zen-hint">Tap the object · aim for the middle for a perfect crunch</div>
    <div class="zen-btns"><button class="btn btn-sm" id="zen-again">${ICON.retry}AGAIN</button><button class="btn btn-sm btn-green" id="zen-next">NEXT ${ICON.next}</button></div>
  </div>
</section>

<section id="vn" class="hidden"><div class="vn-bg" id="vn-bg"></div><div class="vn-stage" id="vn-stage"></div></section>

<section id="scene" class="hidden">
  <div class="hud-top">
    <button class="icon-btn" id="sc-home" aria-label="Back to chapters">${ICON.back}</button>
    <div class="chip"><div class="oi">${ICON.book}</div><div class="ot"><b id="sc-title">Chapter 1</b><small id="sc-step">1/5</small></div></div>
    <button class="btn btn-sm btn-gray" id="sc-skip">SKIP</button>
  </div>
  <div id="sc-box" class="sc-box">
    <div class="sc-who" id="sc-who"><span class="sc-ico" id="sc-ico">🧙</span><b id="sc-name">Guide</b></div>
    <p id="sc-text"></p>
    <i class="sc-next" id="sc-next">▼</i>
  </div>
</section>

<div id="intro" class="hidden"></div>
<div id="popups"></div>
<div id="flash"></div>
<div id="toast"></div>
<div id="overlay" class="hidden"></div>
`;

export class UI {
  constructor(root, h) {
    this.h = h;
    root.innerHTML = TEMPLATE;
    const $ = (s) => root.querySelector(s);
    this.$ = $;
    this.root = root;
    this.last = {};
    $('#btn-play').onclick = () => { h.sfx('click'); h.onPlay(); };
    $('#btn-levels').onclick = () => { h.sfx('click'); this.show('levels'); };
    $('#btn-hammers').onclick = () => { h.sfx('click'); this.show('shop'); };
    $('#btn-settings').onclick = () => { h.sfx('click'); this.settings(); };
    $('#btn-daily').onclick = () => h.onDaily();
    $('#btn-asmr').onclick = () => { h.sfx('click'); h.onAsmr(); };
    $('#zen-home').onclick = () => { h.sfx('click'); h.onMenu(); };
    $('#zen-again').onclick = () => { h.sfx('click'); h.onZenAgain(); };
    $('#zen-next').onclick = () => { h.sfx('click'); h.onZenNext(); };
    $('#btn-story').onclick = () => { h.sfx('click'); this.show('story'); };
    $('#story-back').onclick = () => { h.sfx('click'); this.show('menu'); };
    $('#scene').addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) this.sceneAdvance(); });
    $('#sc-skip').onclick = () => { h.sfx('click'); this.sceneEnd(); };
    $('#sc-home').onclick = () => { h.sfx('click'); h.onMenu(); };
    window.addEventListener('keydown', (e) => { if (this.scene && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); this.sceneAdvance(); } });
    $('#lv-back').onclick = () => { h.sfx('click'); this.show('menu'); };
    $('#shop-back').onclick = () => { h.sfx('click'); this.show('menu'); };
    $('#btn-pause').onclick = () => { h.sfx('click'); h.onPause(); };
    // magnifier bar (story rooms): drag the knob / tap the track to zoom, the buttons jump to full zoom or the whole room
    const track = $('#mag-track');
    const fromEvent = (e) => { const r = track.getBoundingClientRect(); h.onMag(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), true); };
    track.addEventListener('pointerdown', (e) => { e.preventDefault(); this._magDrag = true; try { track.setPointerCapture(e.pointerId); } catch { /* ignore */ } fromEvent(e); });
    track.addEventListener('pointermove', (e) => { if (this._magDrag) fromEvent(e); });
    for (const ev of ['pointerup', 'pointercancel']) track.addEventListener(ev, () => { this._magDrag = false; });
    $('#mag-in').onclick = () => { h.sfx('click'); h.onMag(1, false); };
    $('#mag-out').onclick = () => { h.sfx('click'); h.onMag(0, false); };
    this.show('menu');
  }

  show(name) {
    for (const id of ['menu', 'levels', 'shop', 'story']) this.$('#' + id).classList.toggle('hidden', id !== name);
    if (name === 'menu') this.refreshMenu();
    if (name === 'levels') this.refreshLevels();
    if (name === 'shop') this.refreshShop();
    if (name === 'story') this.refreshStory();
    this.name = name;
  }

  hideScreens() { this.show(null); }

  refreshCoins() {
    this.root.querySelectorAll('#m-coins, .coin-n').forEach((e) => { e.textContent = Save.data.coins; });
  }

  refreshMenu() {
    this.refreshCoins();
    const next = Math.min(LEVELS.length, Save.data.unlocked);
    this.$('#play-sub').textContent = 'Level ' + next;
    const nc = nextChapter(Save.data.story);
    this.$('#story-sub').textContent = nc ? (Save.data.story.beat[nc.id] ? 'Continue · Chapter ' : 'Chapter ') + nc.id : 'Replay chapters';
    const avail = Save.dailyAvailable();
    this.$('#daily-dot').style.display = avail ? '' : 'none';
    this.$('#daily-txt').textContent = avail ? 'GIFT' : 'CLAIMED';
    this.$('#btn-daily').style.opacity = avail ? 1 : 0.7;
  }

  refreshLevels() {
    this.refreshCoins();
    const list = this.$('#lv-list');
    const unlocked = Save.data.unlocked;
    const cur = Math.min(LEVELS.length, unlocked);
    list.innerHTML = '';
    WORLDS.forEach((w, wi) => {
      const lvls = LEVELS.filter((l) => l.world === wi);
      const got = lvls.reduce((a, l) => a + Save.stars(l.id), 0);
      const box = document.createElement('div');
      box.className = 'world';
      box.style.setProperty('--ac', w.accent);
      box.innerHTML = `<div class="w-head"><span><i></i>${wi + 1}. ${w.name}</span><em>★ ${got}/${lvls.length * 3}</em></div><div class="w-grid"></div>`;
      const grid = box.querySelector('.w-grid');
      lvls.forEach((l) => {
        const locked = l.id > unlocked;
        const st = Save.stars(l.id);
        const b = document.createElement('button');
        b.className = 'lv' + (locked ? ' locked' : '') + (l.id === cur ? ' cur' : '');
        b.innerHTML = `<span class="n">${l.id}</span><span class="ico">${OBJECTS[l.obj].icon}</span><span class="st">${[1, 2, 3].map((i) => (i <= st ? '★' : '<span class="off">★</span>')).join('')}</span>${locked ? `<span class="lock">${ICON.lock}</span>` : ''}`;
        b.onclick = () => {
          if (locked) { this.h.sfx('fail'); this.toast('Clear level ' + (l.id - 1) + ' first!'); return; }
          this.h.sfx('click');
          this.h.onLevel(l.id);
        };
        grid.appendChild(b);
      });
      list.appendChild(box);
    });
    const c = list.querySelector('.cur');
    if (c) setTimeout(() => c.scrollIntoView({ block: 'center' }), 30);
  }

  refreshStory() {
    this.refreshCoins();
    const list = this.$('#story-list');
    const st = Save.data.story;
    list.innerHTML = '';
    if (STORY_NOTE) {
      const n = document.createElement('div');
      n.className = 'story-note';
      n.textContent = STORY_NOTE;
      list.appendChild(n);
    }
    const cur = nextChapter(st);
    let section = null;
    CHAPTERS.forEach((ch) => {
      if (!!ch.premium !== section) {
        section = !!ch.premium;
        const h = document.createElement('div');
        h.className = 'ch-sect' + (section ? ' prem' : '');
        h.textContent = section ? '✨ PREMIUM ROOMS' : 'STORY ROOMS';
        list.appendChild(h);
      }
      const done = !!st.done[ch.id];
      const buy = !ch.soon && !!ch.premium && !Save.owns(ch.sku);
      const locked = !ch.soon && !ch.premium && ch.id > st.unlocked;
      const total = ch.beats.length || 1;
      const at = done ? total : Math.min(total, st.beat[ch.id] || 0);
      const card = document.createElement('div');
      card.className = 'ch-card' + (ch.soon ? ' soon' : '') + (locked ? ' locked' : '') + (buy ? ' premium' : '') + (done ? ' done' : '') + (cur && cur.id === ch.id ? ' cur' : '');
      card.style.setProperty('--ac', placeAccent(ch.room ?? ch.world ?? 0));
      let right = '';
      if (ch.soon) right = '<span class="ch-tag">SOON</span>';
      else if (buy) right = `<span class="ch-tag prem">${ICON.lock}PREMIUM</span>`;
      else if (locked) right = `<span class="ch-lock">${ICON.lock}</span>`;
      else right = `<button class="btn btn-sm ${done ? 'btn-gray' : 'btn-green'} card-btn">${done ? 'REPLAY' : at > 0 ? 'CONTINUE' : 'PLAY'}</button>`;
      card.innerHTML = `<div class="ch-ico">${ch.icon || '📖'}</div>
        <div class="info"><span class="ch-no">${ch.premium ? 'PREMIUM ROOM' : 'CHAPTER ' + ch.id}</span>${ch.title}<small>${ch.subtitle || ''}</small>
        ${ch.soon || buy ? '' : `<div class="ch-prog"><i style="width:${Math.round(100 * at / total)}%"></i></div>`}</div>${right}`;
      card.onclick = () => {
        if (ch.soon) { this.h.sfx('click'); this.toast(ch.premium ? 'This premium room is coming soon!' : 'More story is coming soon!'); return; }
        if (buy) { this.h.sfx('click'); this.premiumSheet(ch); return; }
        if (locked) { this.h.sfx('fail'); this.toast('Finish chapter ' + (ch.id - 1) + ' first!'); return; }
        this.h.sfx('click');
        this.h.onChapter(ch.id);
      };
      list.appendChild(card);
    });
  }

  /** The "buy this premium room" sheet. The purchase itself is handled by the game (onBuy). */
  premiumSheet(ch) {
    const ov = this.$('#overlay');
    ov.classList.remove('hidden');
    const smashes = ch.beats.filter((b) => b.type === 'level').length;
    ov.innerHTML = `<div class="overlay"><div class="panel prem-panel">
      <div class="prem-ico">${ch.icon || '✨'}</div>
      <h2 class="win">${ch.title}</h2>
      <div class="reason">${ch.subtitle || ''}</div>
      <ul class="prem-list"><li>A whole extra themed room</li><li>${smashes} smash levels with a story</li><li>${ch.reward} bonus coins</li></ul>
      <div class="btns">
        <button class="btn btn-play" id="p-buy" style="animation:none;font-size:26px"><span>${STORE.live ? 'UNLOCK' : 'UNLOCK (TEST)'}</span></button>
        <button class="btn btn-sm btn-gray" id="p-no">NOT NOW</button>
      </div>
      ${STORE.live ? '' : '<div class="reason" style="font-size:12px;margin-top:2px">Test build: nothing is charged. Connect a store before release.</div>'}
    </div></div>`;
    ov.querySelector('#p-no').onclick = () => { this.h.sfx('click'); this.closeOverlay(); };
    ov.querySelector('#p-buy').onclick = async () => {
      this.h.sfx('click');
      const ok = await this.h.onBuyRoom(ch);
      this.closeOverlay();
      if (ok) { this.h.sfx('coin'); this.toast(ch.title + ' unlocked!'); this.refreshStory(); } else this.toast('The purchase did not go through.');
    };
  }

  // --- story dialogue + visual-novel scenes ------------------------------------------
  showScene(beat, meta) {
    this.$('#scene').classList.remove('hidden');
    this.$('#sc-title').textContent = meta.title;
    this.$('#sc-step').textContent = meta.step;
    const vn = beat.type === 'vn';
    this.scene = { beat, vn, i: -1, typing: false, chars: [], pos: 0, stage: [], faces: {}, bg: null };
    this.$('#scene').classList.toggle('is-vn', vn);
    this.$('#vn').classList.toggle('hidden', !vn);
    if (vn) {
      this.$('#vn-stage').innerHTML = '';
      this.$('#vn-bg').innerHTML = '';
      this._vnStage(beat.stage || []);
      this._vnBg(beat.bg || 'college');
    }
    this.sceneAdvance();
  }

  hideScene() {
    clearInterval(this._typeT);
    this.scene = null;
    this.$('#scene').classList.add('hidden');
    this.$('#scene').classList.remove('is-vn');
    this.$('#vn').classList.add('hidden');
  }

  _vnBg(key) {
    const sc = this.scene;
    if (!sc || sc.bg === key) return;
    sc.bg = key;
    const el = this.$('#vn-bg');
    el.innerHTML = backdropSVG(key);
    el.classList.remove('bd-in'); void el.offsetWidth; el.classList.add('bd-in');
  }

  /** The picture for a character: their own cut-out image if CAST gives one, else the drawn cut-out. */
  _castArt(id, face) {
    const c = CAST[id] || {};
    if (c.img) {
      const url = typeof c.img === 'string' ? c.img : (c.img[face] || c.img.neutral || Object.values(c.img)[0]);
      return `<img class="cut-img" alt="" src="${url}">`;
    }
    return portraitSVG(c.look, face);
  }

  /** Put up to three characters on stage (left / right, or left / middle / right). */
  _vnStage(ids) {
    const sc = this.scene;
    sc.stage = ids.slice(0, 3);
    const st = this.$('#vn-stage');
    st.innerHTML = '';
    st.dataset.n = sc.stage.length;
    sc.stage.forEach((id, k) => {
      const d = document.createElement('div');
      d.className = 'cut';
      d.dataset.id = id; d.dataset.i = k;
      const face = sc.faces[id] || 'neutral';
      d.dataset.face = face;
      d.innerHTML = this._castArt(id, face);
      st.appendChild(d);
    });
  }

  /** Highlight the speaker (and update their face); everyone else steps back. */
  _vnFocus(who, face) {
    this.$('#vn-stage').querySelectorAll('.cut').forEach((d) => {
      const on = d.dataset.id === who;
      d.classList.toggle('on', on);
      d.classList.toggle('off', !on);
      if (on && d.dataset.face !== face) { d.dataset.face = face; d.innerHTML = this._castArt(who, face); }
    });
  }

  /** Scene finished or skipped: close it and tell the game. */
  sceneEnd() {
    if (!this.scene) return;
    this.hideScene();
    this.h.onSceneDone();
  }

  /** Tap: finish the line that is typing, otherwise show the next line (or end the scene). */
  sceneAdvance() {
    const sc = this.scene;
    if (!sc) return;
    if (sc.typing) { this._finishType(); return; }
    sc.i++;
    const line = sc.beat.lines[sc.i];
    if (!line) { this.sceneEnd(); return; }
    if (sc.vn) {
      if (line.bg) this._vnBg(line.bg);
      if (line.stage) this._vnStage(line.stage);
      else if (line.who && !sc.stage.includes(line.who)) this._vnStage([...sc.stage, line.who].slice(-3));
    }
    const face = line.face || (line.who && sc.faces[line.who]) || 'neutral';
    if (line.who) sc.faces[line.who] = face;
    const c = line.who ? (CAST[line.who] || { name: line.who, icon: '💬', color: '#7c6cf2' }) : null;
    const box = this.$('#sc-box');
    box.classList.toggle('narr', !c);
    box.classList.toggle('right', !!c && c.side === 'right');
    this.$('#sc-who').style.display = c ? '' : 'none';
    if (c) {
      this.$('#sc-name').textContent = c.name;
      const ico = this.$('#sc-ico');
      if (c.look) ico.innerHTML = avatarSVG(c.look, face); else ico.textContent = c.icon;
      box.style.setProperty('--cc', c.color);
    }
    if (sc.vn) this._vnFocus(line.who || null, face);
    box.classList.remove('sc-in'); void box.offsetWidth; box.classList.add('sc-in');
    sc.chars = Array.from(line.text);
    sc.pos = 0; sc.typing = true;
    this.$('#sc-text').textContent = '';
    this.$('#sc-next').style.visibility = 'hidden';
    clearInterval(this._typeT);
    this._typeT = setInterval(() => {
      sc.pos = Math.min(sc.chars.length, sc.pos + 1);
      this.$('#sc-text').textContent = sc.chars.slice(0, sc.pos).join('');
      if (c && sc.pos % 2 === 0) this.h.sfx('blip', sc.pos);
      if (sc.pos >= sc.chars.length) this._finishType();
    }, 26);
  }

  _finishType() {
    const sc = this.scene;
    clearInterval(this._typeT);
    if (!sc) return;
    sc.typing = false;
    this.$('#sc-text').textContent = sc.chars.join('');
    this.$('#sc-next').style.visibility = 'visible';
  }

  refreshShop() {
    this.refreshCoins();
    const list = this.$('#shop-list');
    list.innerHTML = '';
    HAMMERS.forEach((hm) => {
      const owned = Save.data.owned.includes(hm.id);
      const sel = Save.data.hammer === hm.id;
      const card = document.createElement('div');
      card.className = 'shop-card' + (sel ? ' sel' : '');
      const label = sel ? 'EQUIPPED' : owned ? 'EQUIP' : `<span class="price">${ICON.coin}${hm.price}</span>`;
      card.innerHTML = `<div class="pic">${ICON.hammer(hm)}</div><div class="info">${hm.name}<small>${owned ? 'Owned' : 'Cosmetic hammer'}</small></div><button class="btn btn-sm ${sel ? 'btn-gray' : owned ? 'btn-green' : ''} card-btn">${label}</button>`;
      card.querySelector('button').onclick = () => {
        if (sel) return;
        if (owned) { this.h.sfx('click'); this.h.onEquip(hm.id); } else this.h.onBuy(hm.id);
        this.refreshShop();
      };
      list.appendChild(card);
    });
  }

  // --- settings ---------------------------------------------------------------
  settings() {
    const s = Save.data.settings;
    const ov = this.$('#overlay');
    ov.classList.remove('hidden');
    const q = s.quality;
    ov.innerHTML = `<div class="overlay"><div class="panel">
      <h2>SETTINGS</h2>
      <div class="set-row"><span class="lab">${ICON.sfx}Sound FX</span><button class="toggle ${s.sfx ? 'on' : ''}" data-k="sfx"></button></div>
      <div class="set-row"><span class="lab">${ICON.music}Music</span><button class="toggle ${s.music ? 'on' : ''}" data-k="music"></button></div>
      <div class="set-row"><span class="lab">${ICON.vibe}Vibration</span><button class="toggle ${s.vibe ? 'on' : ''}" data-k="vibe"></button></div>
      <div class="set-row"><span class="lab">${ICON.gfx}Graphics</span><div class="seg" id="seg-q">${['auto', 'high', 'low'].map((k) => `<button data-q="${k}" class="${q === k ? 'on' : ''}">${k.toUpperCase()}</button>`).join('')}</div></div>
      <div class="btns" style="margin-top:14px">
        <button class="btn btn-red btn-sm" id="set-reset">RESET PROGRESS</button>
        <button class="btn btn-green" id="set-close">DONE</button>
      </div></div></div>`;
    ov.querySelectorAll('.toggle').forEach((t) => {
      t.onclick = () => {
        const k = t.dataset.k;
        const v = !Save.data.settings[k];
        t.classList.toggle('on', v);
        this.h.onSetting(k, v);
        this.h.sfx('click');
      };
    });
    ov.querySelectorAll('#seg-q button').forEach((b) => {
      b.onclick = () => {
        ov.querySelectorAll('#seg-q button').forEach((x) => x.classList.toggle('on', x === b));
        this.h.onSetting('quality', b.dataset.q);
        this.h.sfx('click');
      };
    });
    let armed = false;
    const rb = ov.querySelector('#set-reset');
    rb.onclick = () => {
      if (!armed) { armed = true; rb.textContent = 'TAP AGAIN TO ERASE'; return; }
      this.h.onReset();
      this.closeOverlay();
      this.show('menu');
      this.toast('Progress erased');
    };
    ov.querySelector('#set-close').onclick = () => { this.h.sfx('click'); this.closeOverlay(); };
  }

  closeOverlay() {
    const ov = this.$('#overlay');
    ov.classList.add('hidden');
    ov.innerHTML = '';
  }

  // --- HUD ---------------------------------------------------------------------
  showHud(level, objDef) {
    this.$('#hud').classList.remove('hidden');
    this.$('#h-icon').textContent = objDef.icon;
    this.$('#h-name').textContent = objDef.name;
    this.$('#h-level').textContent = level.hudLabel || `Level ${level.id} · ${WORLDS[level.world].name}`;
    this.$('#h-target').textContent = level.target;
    const max = level.target * 1.4;
    this.hudMax = max;
    this.$('#h-mk').style.left = (100 * level.target / max) + '%';
    this.$('#h-s2').style.left = (100 * level.target * 1.15 / max) + '%';
    this.$('#h-s3').style.left = '100%';
    this.$('#h-s2').classList.remove('on');
    this.$('#h-s3').classList.remove('on');
    this.$('#h-bar').classList.remove('done');
    const hits = this.$('#h-hits');
    hits.innerHTML = '';
    this.hitIcons = [];
    for (let i = 0; i < level.hits; i++) {
      const d = document.createElement('div');
      d.innerHTML = ICON.hammer(HAMMERS.find((x) => x.id === Save.data.hammer) || HAMMERS[0]);
      hits.appendChild(d.firstChild);
      this.hitIcons.push(hits.lastChild);
    }
    this.last = {};
    this.level = level;
    this._pieces(objDef.list);
  }

  /** Story rooms: one chip per smashable thing (tap = zoom to it) and a bobbing marker over it in the room. */
  _pieces(list) {
    const row = this.$('#h-pieces'), marks = this.$('#pmarks');
    row.innerHTML = ''; marks.innerHTML = '';
    this.marks = [];
    row.classList.toggle('hidden', !list);
    if (!list) return;
    list.forEach((p, i) => {
      const b = document.createElement('button');
      b.className = 'pc';
      b.innerHTML = `<span>${p.icon}</span>${p.name}`;
      b.onclick = () => { this.h.sfx('click'); this.h.onPiece(i); };
      row.appendChild(b);
      const m = document.createElement('div');
      m.className = 'pmark';
      m.innerHTML = '<i>🔨</i>';
      marks.appendChild(m);
      this.marks.push({ chip: b, el: m, on: false, done: false });
    });
  }

  pieceDone(i) {
    const m = this.marks && this.marks[i];
    if (!m || m.done) return;
    m.done = true;
    m.chip.classList.add('done');
    m.el.style.display = 'none';
  }

  /** x, y in px (null = off screen) */
  placeMark(i, x, y) {
    const m = this.marks && this.marks[i];
    if (!m || m.done) return;
    if (x == null) { if (m.on) { m.el.style.display = 'none'; m.on = false; } return; }
    if (!m.on) { m.el.style.display = 'block'; m.on = true; }
    m.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  hideMarks() { if (this.marks) this.marks.forEach((m) => { m.el.style.display = 'none'; m.on = false; }); }

  hideHud() { this.$('#hud').classList.add('hidden'); this.showMag(false); this.hideMarks(); }

  /** Magnifier bar + hint (story-room levels only). */
  showMag(on) {
    this.$('#mag').classList.toggle('hidden', !on);
    this.$('#mag-hint').classList.toggle('hidden', !on);
    if (on) this.magLevel(0, true);
  }

  magLevel(l, force) {
    if (!force && this._magL === l) return;
    this._magL = l;
    this.$('#mag-knob').style.left = (l * 100) + '%';
    this.$('#mag-fill').style.width = (l * 100) + '%';
    this.$('#mag-hint').innerHTML = l < 0.5 ? `${ICON.zoom}<span>Tap anywhere in the room to zoom in</span>` : `${ICON.zoom}<span>Tap to smash · tap floor to move the view</span>`;
  }

  // --- ASMR / zen mode -----------------------------------------------------------
  showZen(objDef) {
    this.$('#zen').classList.remove('hidden');
    this.zenInfo(objDef);
  }
  hideZen() { this.$('#zen').classList.add('hidden'); }
  zenInfo(objDef) {
    this.$('#z-icon').textContent = objDef.icon;
    this.$('#z-name').textContent = objDef.name;
    this.zenLast = {};
  }
  zen(o) {
    const L = this.zenLast || (this.zenLast = {});
    if (L.count !== o.count) { L.count = o.count; this.$('#z-sub').textContent = 'ASMR · ' + o.count + ' fragments'; }
    if (L.calm !== o.calm) {
      L.calm = o.calm;
      this.$('#zen-next').classList.toggle('pulse', o.calm);
      this.$('#zen-hint').textContent = o.calm ? 'All done - tap the pieces to crush them smaller, or hit NEXT' : 'Tap the object · aim for the middle for a perfect crunch';
    }
  }

  hud(o) {
    const L = this.last;
    if (L.count !== o.count) {
      L.count = o.count;
      this.$('#h-count').textContent = o.count;
      const nowT = performance.now();
      if (nowT - (this.lastBump || 0) > 90) {
        this.lastBump = nowT;
        const cEl = this.$('#h-count');
        cEl.classList.remove('bump'); void cEl.offsetWidth; cEl.classList.add('bump');
      }
      const k = Math.min(1, o.count / this.hudMax);
      this.$('#h-fill').style.width = (k * 100) + '%';
      this.$('#h-bar').classList.toggle('done', o.count >= this.level.target);
      const s2 = o.count >= this.level.target * 1.15, s3 = o.count >= this.level.target * 1.4;
      this.$('#h-s2').classList.toggle('on', s2);
      this.$('#h-s3').classList.toggle('on', s3);
    }
    if (L.hits !== o.hits) {
      L.hits = o.hits;
      this.hitIcons.forEach((e, i) => e.classList.toggle('used', i >= o.hits));
    }
    const t = Math.max(0, Math.ceil(o.time - 1e-6));
    if (L.time !== t) {
      L.time = t;
      this.$('#h-time').textContent = t;
      this.$('#h-timer').classList.toggle('danger', t <= 5 && t > 0);
    }
    const off = 138.2 * (1 - Math.max(0, o.time) / this.level.time);
    this.$('#h-ring').style.strokeDashoffset = off.toFixed(1);
  }

  // --- intro / popups ------------------------------------------------------------
  showIntro(level, objDef, tip) {
    const el = this.$('#intro');
    el.classList.remove('hidden', 'out');
    el.innerHTML = `<div class="intro-card"><div class="lvl">${level.label || 'LEVEL ' + level.id}</div><div class="obj">${objDef.icon} ${objDef.name}</div>
      ${objDef.list ? `<div class="plist">${objDef.list.map((p) => `<span>${p.icon} ${p.name}</span>`).join('')}</div>` : ''}
      <div class="goal">Create <b>${level.target}</b> fragments</div>
      <div class="goal">in <b>${level.hits}</b> hammer hits</div>
      <div class="goal">within <b>${level.time}</b> seconds</div></div>
      <div class="tap-hint">TAP TO SMASH!</div>`;
    // restart the entry animation
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  }

  hideIntro() {
    const el = this.$('#intro');
    if (el.classList.contains('hidden')) return;
    el.classList.add('out');
    setTimeout(() => el.classList.add('hidden'), 300);
  }

  popup(text, x, y, cls = '') {
    const d = document.createElement('div');
    d.className = 'pop ' + cls;
    d.textContent = text;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    this.$('#popups').appendChild(d);
    setTimeout(() => d.remove(), 1250);
  }

  flash() {
    const f = this.$('#flash');
    f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  }

  banner(text, sub = '', cls = '') {
    this.$('#banner')?.remove();
    const b = document.createElement('div');
    b.id = 'banner';
    b.className = cls;
    b.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
    this.root.appendChild(b);
    setTimeout(() => b.remove(), 1600);
  }

  toast(text) {
    const t = this.$('#toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // --- pause / results -------------------------------------------------------------
  showPause() {
    const ov = this.$('#overlay');
    ov.classList.remove('hidden');
    ov.innerHTML = `<div class="overlay"><div class="panel"><h2>PAUSED</h2><div class="btns">
      <button class="btn btn-green" id="p-resume">${ICON.play}RESUME</button>
      <div class="row"><button class="btn btn-sm" id="p-restart">${ICON.retry}RESTART</button><button class="btn btn-sm btn-gray" id="p-menu">${ICON.home}MENU</button></div>
    </div></div></div>`;
    ov.querySelector('#p-resume').onclick = () => { this.h.sfx('click'); this.closeOverlay(); this.h.onResume(); };
    ov.querySelector('#p-restart').onclick = () => { this.h.sfx('click'); this.closeOverlay(); this.h.onRestart(); };
    ov.querySelector('#p-menu').onclick = () => { this.h.sfx('click'); this.closeOverlay(); this.h.onMenu(); };
  }

  showResult(win, info) {
    const ov = this.$('#overlay');
    ov.classList.remove('hidden');
    if (win) {
      const last = !info.level.story && info.level.id >= LEVELS.length;
      ov.innerHTML = `<div class="overlay"><div class="panel">
        <h2 class="win">LEVEL COMPLETED!</h2>
        <div class="stars">${[1, 2, 3].map((i) => ICON.star(i <= info.stars)).join('')}</div>
        <div class="stats"><div class="stat"><b>${info.count}</b>fragments</div><div class="stat"><b>${info.hitsUsed}/${info.level.hits}</b>hits used</div><div class="stat"><b>${info.crits}</b>critical</div></div>
        <div class="earn">${ICON.coin}+${info.coins}</div>
        <div class="btns">
          ${last ? '<div class="reason">You cleared every diorama! Replay levels to earn 3 stars.</div>' : `<button class="btn btn-play" id="r-next" style="animation:none;font-size:28px"><span>${info.level.story ? 'CONTINUE' : 'NEXT'} ${ICON.next}</span></button>`}
          <div class="row"><button class="btn btn-sm" id="r-retry">${ICON.retry}REPLAY</button><button class="btn btn-sm btn-gray" id="r-menu">${ICON.home}${info.level.story ? 'STORY' : 'MENU'}</button></div>
        </div></div></div>`;
      const sv = ov.querySelectorAll('.stars svg');
      for (let i = 0; i < info.stars; i++) {
        setTimeout(() => { sv[i].classList.add('in'); this.h.sfx('star', i); }, 350 + i * 330);
      }
      for (let i = info.stars; i < 3; i++) sv[i].classList.add('in');
      const nx = ov.querySelector('#r-next');
      if (nx) nx.onclick = () => { this.h.sfx('click'); this.closeOverlay(); this.h.onNext(); };
    } else {
      ov.innerHTML = `<div class="overlay"><div class="panel">
        <h2 class="lose">LEVEL FAILED</h2>
        <div class="reason">${info.reason}<br>You made <b>${info.count}</b> of <b>${info.level.target}</b> fragments.</div>
        <div class="reason" style="margin-top:-6px;font-size:15px">💡 ${info.tip}</div>
        <div class="btns"><button class="btn btn-play" id="r-retry" style="animation:none;font-size:28px"><span>${ICON.retry}TRY AGAIN</span></button>
        <button class="btn btn-sm btn-gray" id="r-menu">${ICON.home}MENU</button></div></div></div>`;
    }
    ov.querySelector('#r-retry').onclick = () => { this.h.sfx('click'); this.closeOverlay(); this.h.onRestart(); };
    ov.querySelector('#r-menu').onclick = () => { this.h.sfx('click'); this.closeOverlay(); this.h.onMenu(); };
  }

  showChapterEnd(ch, info) {
    const ov = this.$('#overlay');
    ov.classList.remove('hidden');
    ov.innerHTML = `<div class="overlay"><div class="panel">
      <h2 class="win">CHAPTER ${ch.id} COMPLETE!</h2>
      <div class="reason">${ch.icon || '📖'} ${ch.title}</div>
      <div class="earn">${ICON.coin}+${info.coins}</div>
      <div class="btns">
        ${info.next ? `<button class="btn btn-play" id="c-next" style="animation:none;font-size:26px"><span>CHAPTER ${info.next.id} ${ICON.next}</span></button>` : `<div class="reason">${info.note || 'More chapters are coming soon!'}</div>`}
        <div class="row"><button class="btn btn-sm" id="c-again">${ICON.retry}REPLAY</button><button class="btn btn-sm btn-gray" id="c-menu">${ICON.book}CHAPTERS</button></div>
      </div></div></div>`;
    const nx = ov.querySelector('#c-next');
    if (nx) nx.onclick = () => { this.h.sfx('click'); this.closeOverlay(); this.h.onChapter(info.next.id); };
    ov.querySelector('#c-again').onclick = () => { this.h.sfx('click'); this.closeOverlay(); this.h.onChapter(ch.id); };
    ov.querySelector('#c-menu').onclick = () => { this.h.sfx('click'); this.closeOverlay(); this.h.onMenu(); };
  }

  randomTip() { return TIPS[Math.floor(Math.random() * TIPS.length)]; }
}
