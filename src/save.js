import { SAVE_KEY } from './config.js';
import { STORY_VERSION } from './story.js';

const DEFAULT = () => ({
  v: 1,
  coins: 0,
  unlocked: 1,            // highest unlocked level id
  stars: {},              // level id -> 1..3
  hammer: 'wood',
  owned: ['wood'],
  settings: { sfx: true, music: true, vibe: true, quality: 'auto' },
  daily: { last: '', streak: 0 },
  stats: { smashed: 0, crits: 0, cleared: 0 },
  story: { v: STORY_VERSION, unlocked: 1, beat: {}, done: {}, stars: {}, owned: {} }   // chapter id -> next beat / finished; 'ch:beat' -> stars; owned = bought premium rooms (sku -> true)
});

/** Progress + settings in localStorage (falls back to memory when storage is blocked). */
export const Save = {
  data: DEFAULT(),

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const base = DEFAULT();
        this.data = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) }, daily: { ...base.daily, ...(d.daily || {}) }, stats: { ...base.stats, ...(d.stats || {}) }, story: { ...base.story, ...(d.story || {}) } };
      }
    } catch { this.data = DEFAULT(); }
    const st = this.data.story;
    if (st.v !== STORY_VERSION) {            // the scenario changed: story progress restarts, purchases stay
      this.data.story = { ...DEFAULT().story, owned: st.owned || {} };
    }
    if (!st.owned) st.owned = {};
    return this.data;
  },

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch { /* storage blocked */ }
  },

  reset() { this.data = DEFAULT(); this.save(); },

  addCoins(n) { this.data.coins += n; this.save(); },

  stars(id) { return this.data.stars[id] || 0; },

  totalStars() { return Object.values(this.data.stars).reduce((a, b) => a + b, 0); },

  /** Record a cleared level. Returns {coins, first, newStars}. */
  complete(level, stars, baseCoins, extraCoins) {
    const d = this.data;
    const prev = d.stars[level.id] || 0;
    const first = prev === 0;
    let coins = first ? baseCoins : Math.floor(baseCoins * 0.3);
    if (stars > prev) coins += (stars - prev) * 10;
    coins += extraCoins;
    if (stars > prev) d.stars[level.id] = stars;
    d.unlocked = Math.max(d.unlocked, level.id + 1);
    d.coins += coins;
    d.stats.cleared += first ? 1 : 0;
    this.save();
    return { coins, first, newStars: Math.max(0, stars - prev) };
  },

  // --- story mode ------------------------------------------------------------------
  /** Beat to resume a chapter at (0 once it is finished, so it replays from the start). */
  storyBeat(chId) { const s = this.data.story; return s.done[chId] ? 0 : (s.beat[chId] || 0); },

  /** Remember that beats before `next` are finished (never moves backwards). */
  storySet(chId, next) {
    const s = this.data.story;
    s.beat[chId] = Math.max(s.beat[chId] || 0, next);
    this.save();
  },

  /** Record a cleared story level. Returns {coins, first, newStars}. */
  storyLevelDone(level, stars, baseCoins, extraCoins) {
    const s = this.data.story, key = level.story.key;
    const prev = s.stars[key] || 0;
    const first = prev === 0;
    let coins = first ? baseCoins : Math.floor(baseCoins * 0.3);
    if (stars > prev) coins += (stars - prev) * 10;
    coins += extraCoins;
    if (stars > prev) s.stars[key] = stars;
    this.data.coins += coins;
    this.save();
    return { coins, first, newStars: Math.max(0, stars - prev) };
  },

  /** Finish a chapter: unlock the next one and pay the chapter reward. Returns {coins, first}. */
  storyComplete(ch) {
    const s = this.data.story;
    const first = !s.done[ch.id];
    const coins = first ? (ch.reward || 0) : Math.floor((ch.reward || 0) * 0.2);
    s.done[ch.id] = true;
    s.beat[ch.id] = Math.max(s.beat[ch.id] || 0, ch.beats.length);
    s.unlocked = Math.max(s.unlocked, ch.id + 1);
    this.data.coins += coins;
    this.save();
    return { coins, first };
  },

  /** Premium rooms: has this sku been bought (or unlocked in a test build)? */
  owns(sku) { return !!this.data.story.owned[sku]; },
  grant(sku) { this.data.story.owned[sku] = true; this.save(); },

  dailyAvailable() { return this.data.daily.last !== todayKey(); },

  claimDaily() {
    if (!this.dailyAvailable()) return 0;
    const d = this.data.daily;
    const yesterday = new Date(Date.now() - 86400000);
    const streak = d.last === dayKey(yesterday) ? d.streak + 1 : 1;
    const coins = 50 + Math.min(streak - 1, 6) * 25;
    d.last = todayKey(); d.streak = streak;
    this.data.coins += coins;
    this.save();
    return coins;
  }
};

function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function todayKey() { return dayKey(new Date()); }
