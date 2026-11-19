import { LEVEL_TIME } from './config.js';

// ---------------------------------------------------------------------------
// STORY MODE - the scenario. Everything the story needs lives in this one file.
//
//   CAST      who can speak. Key = id used in the dialogue lines.
//             { name, icon (emoji), color (CSS), side: 'left' | 'right', look: {...} | img: {...} }
//             look = the drawn cut-out (see portraits.js); img = { neutral: 'url', sad: 'url' } to use your own art.
//
//   CHAPTERS  one chapter = one character's ROOM, played in order.
//             { title, subtitle, icon, room | world, reward, beats: [...] }
//             room: 'living' | 'kitchen' | 'attic' | 'library' | 'playroom' | 'aman' | 'bunty' | 'erika' | 'krick' | 'chinese'
//             (rooms live in levels.js ROOMS + rooms.js), or world: 0-5 for the floating islands.
//             premium: true + sku: 'name'   the chapter must be bought (see STORE below)
//             soon: true                    shows a locked "coming soon" card
//
//   beats     played in order, three kinds:
//     scene(lines, { room | world, obj, variant })
//         dialogue over the 3D room. lines = [{ who, text, face }]; leave out `who` for narration.
//     vn(lines, { bg, stage })
//         a visual-novel scene: painted backdrop + big character cut-outs. Any line can also set
//         bg: 'cafe' | 'college' | 'night' | 'classroom' | 'station' | 'teahouse'   and   stage: ['left', 'right'] (up to 3 characters on screen).
//         face: neutral | happy | sad | cry | angry | shock | smirk | worry | determined
//     level([pieceIds], target, hits, { time, reward, title })
//         a smash level in the chapter's room: the listed furniture pieces become breakable (see SETS in rooms.js
//         for each room's piece ids). Pieces smashed in earlier levels stay gone. Islands can still use
//         level('clay_pot', target, hits, { variant, world }) with one catalogue object in the middle.
//
// When you change the list of chapters, bump STORY_VERSION so old saved progress is reset.
// Check your edits with:  node tests/story-check.mjs
// ---------------------------------------------------------------------------

export const STORY_VERSION = 3;

/** Premium rooms. While `live` is false this build unlocks them for free so they can be tried. */
export const STORE = { live: false };

export const CAST = {
  hero: {
    name: 'You', icon: '😎', color: '#ff9f1c', side: 'right',
    look: { skin: '#e8b890', hair: '#2a1f24', hairStyle: 'short', outfit: '#ff9f1c', outfit2: '#fff2d0', top: 'hoodie' }
  },
  rashmika: {
    name: 'Rashmika', icon: '👩', color: '#ff5f9a', side: 'left',
    look: { skin: '#e9b48f', hair: '#1f1620', hairStyle: 'long', outfit: '#ff7aa8', outfit2: '#ffe0ec', top: 'kurta', lashes: true, blush: true, earrings: true, eye: '#3b2230' }
  },
  aman: {
    name: 'Aman', icon: '😏', color: '#e0446a', side: 'right',
    look: { skin: '#e3ae84', hair: '#2a1c1f', hairStyle: 'spiky', outfit: '#2f2f3f', outfit2: '#e0446a', top: 'jacket', stubble: true, earrings: true }
  },
  meera: {
    name: 'Meera', icon: '👧', color: '#9b7bff', side: 'right',
    look: { skin: '#f0c7a3', hair: '#7b3f2a', hairStyle: 'bob', outfit: '#9b7bff', outfit2: '#ffe08a', top: 'blouse', lashes: true, earrings: true, shadow: '#c9a8ff' }
  },
  bunty: {
    name: 'Bunty', icon: '😠', color: '#e2562f', side: 'right',
    look: { skin: '#d9a47c', hair: '#1f1a1a', hairStyle: 'buzz', hat: 'cap', capColor: '#e2562f', outfit: '#2f7d5a', outfit2: '#ffffff', top: 'tee', bulk: 1.12 }
  },
  ali: {
    name: 'Ali', icon: '🤓', color: '#3b8fe0', side: 'left',
    look: { skin: '#e5b48c', hair: '#2b2230', hairStyle: 'short', glasses: true, outfit: '#4fa3ff', outfit2: '#ffc93c', top: 'shirt' }
  },
  erika: {
    name: 'Erika', icon: '💅', color: '#c158e0', side: 'right',
    look: { skin: '#f3cfb0', hair: '#3b1f55', hairStyle: 'long', outfit: '#c158e0', outfit2: '#9be84a', top: 'blouse', lashes: true, earrings: true, shadow: '#9be84a' }
  },
  somalin: {
    name: 'Somalin', icon: '🌼', color: '#e0a000', side: 'left',
    look: { skin: '#d9a47c', hair: '#3a2a22', hairStyle: 'curly', outfit: '#ffc93c', outfit2: '#fff4c0', top: 'hoodie', blush: true }
  },
  rane: {
    name: 'Inspector Rane', icon: '👮', color: '#3b4a8f', side: 'left',
    look: { skin: '#e5b48c', hair: '#1f1a22', hairStyle: 'long', hat: 'police', outfit: '#b8a56a', outfit2: '#1d2338', top: 'police', lashes: true }
  },
  pawar: {
    name: 'Constable Pawar', icon: '💂', color: '#3b4a8f', side: 'right',
    look: { skin: '#d6a07a', hair: '#1a1a1a', hairStyle: 'short', hat: 'police', moustache: true, outfit: '#b8a56a', outfit2: '#1d2338', top: 'police', bulk: 1.08 }
  },
  lin: {
    name: 'Madam Lin', icon: '🏮', color: '#d4382e', side: 'left',
    look: { skin: '#f2cfae', hair: '#cfd2da', hairStyle: 'bun', outfit: '#c8362f', outfit2: '#f2c14b', top: 'kurta', blush: true, earrings: true, glasses: '#8a6a3c' }
  },
  krick: {
    name: 'Krick', icon: '😈', color: '#5b5f6e', side: 'right',
    look: { skin: '#e8bf9d', hair: '#1a1a1a', hairStyle: 'buzz', outfit: '#2c2f3a', outfit2: '#6a6f7a', top: 'jacket', stubble: true, scar: true, bulk: 1.05 }
  },
  teacher: {
    name: 'Teacher', icon: '👩‍🏫', color: '#6b8f4e', side: 'right',
    look: { skin: '#e9bf9a', hair: '#8a8f98', hairStyle: 'bun', glasses: '#6b4a3a', outfit: '#6b8f4e', outfit2: '#fff0c8', top: 'blouse', lashes: true }
  }
};

/** Shown at the top of the story screen (leave '' for none). */
export const STORY_NOTE = '';

const scene = (lines, opts = {}) => ({ type: 'scene', lines, ...opts });
const vn = (lines, opts = {}) => ({ type: 'vn', lines, ...opts });
const level = (live, target, hits, opts = {}) => ({ type: 'level', live: Array.isArray(live) ? live : null, obj: Array.isArray(live) ? undefined : live, target, hits, ...opts });

export const CHAPTERS = [
  // ------------------------------------------------------------------ 1
  {
    title: "Cheater Aman's Room",
    subtitle: 'He cheated on Rashmika with her best friend',
    icon: '💔',
    room: 'aman',
    reward: 100,
    beats: [
      vn([
        { text: 'Three months ago…' },
        { who: 'rashmika', face: 'happy', text: 'Meera, I think Aman is really the one. He texts me good morning every single day!' },
        { who: 'meera', face: 'smirk', text: 'Wow. He sounds perfect. You are so lucky, Rashmika.' },
        { who: 'rashmika', face: 'happy', text: 'I know! And you are my best friend, so you are the first to hear it.' },
        { bg: 'college', stage: ['rashmika', 'aman'], who: 'aman', face: 'happy', text: 'Rashmika, I would never hurt you. You are the only one for me.' },
        { who: 'rashmika', face: 'happy', text: 'Promise?' },
        { who: 'aman', face: 'smirk', text: 'Promise.' },
        { bg: 'night', stage: ['rashmika', 'aman', 'meera'], who: 'rashmika', face: 'shock', text: 'Aman?! Meera?! You two… together?' },
        { who: 'aman', face: 'worry', text: 'It is not what it looks like!' },
        { who: 'meera', face: 'worry', text: 'Rashmika, wait. I can explain…' },
        { who: 'rashmika', face: 'cry', text: 'My boyfriend and my best friend. Both of you, behind my back.' },
        { text: 'Rashmika cried alone that night. Today, she is done crying.' }
      ], { bg: 'cafe', stage: ['rashmika', 'meera'] }),
      scene([
        { text: "Aman's room. Every sweet lie he ever told was typed right here." },
        { who: 'rashmika', face: 'angry', text: 'He thought nobody would ever see this place. Well… I brought a hammer.' },
        { who: 'hero', face: 'determined', text: 'Then let us break everything in here, one thing at a time.' },
        { who: 'rashmika', face: 'determined', text: 'Start with his desk. And the cologne he wore on every date. With both of us.' }
      ]),
      level(['desk', 'table'], 34, 5, { title: 'His desk and cologne' }),
      scene([
        { who: 'rashmika', face: 'sad', text: 'He played me songs on that guitar. I wonder who else he played.' },
        { who: 'hero', face: 'smirk', text: 'And that mirror. He spent more time with it than with you.' }
      ]),
      level(['guitar', 'mirror', 'shoes'], 30, 5, { title: 'His charm props' }),
      scene([
        { who: 'rashmika', face: 'angry', text: 'Now the neon heart above his bed. It never meant a thing.' },
        { who: 'hero', face: 'determined', text: 'Then let us finish the room. Cheating is not a sport.' }
      ]),
      level(['bed', 'heart'], 38, 5, { title: "The heartbreaker's bed" }),
      scene([
        { who: 'rashmika', face: 'happy', text: 'Done. Honestly… I feel lighter already.' },
        { who: 'hero', face: 'happy', text: 'You deserve someone who stays loyal.' },
        { who: 'rashmika', face: 'happy', text: 'And friends who do too. Thank you.' },
        { text: 'A broken heart heals. A broken room stays broken.' }
      ])
    ]
  },

  // ------------------------------------------------------------------ 2
  {
    title: "Bully Bunty's Room",
    subtitle: 'He stole Ali\'s notebook as a "prank"',
    icon: '🥊',
    room: 'bunty',
    reward: 100,
    beats: [
      vn([
        { text: 'Last Friday, in class…' },
        { who: 'ali', face: 'happy', text: 'Done! My science notebook is finished. Full marks tomorrow, I hope.' },
        { who: 'bunty', face: 'smirk', text: 'Nice notebook, Ali. It would be a shame if it went missing.' },
        { who: 'ali', face: 'worry', text: 'Bunty, give it back. It is due today!' },
        { who: 'bunty', face: 'smirk', text: 'Relax, it is just a prank. Ha ha ha!' },
        { stage: ['ali', 'teacher'], who: 'teacher', face: 'angry', text: 'Ali! Where is your notebook? No notebook, no excuses. Detention.' },
        { who: 'ali', face: 'cry', text: 'But Bunty took it! It was just a prank!' },
        { who: 'teacher', face: 'angry', text: 'I do not see Bunty. I see you, without your homework.' },
        { stage: ['ali', 'bunty'], who: 'bunty', face: 'smirk', text: 'Ha! Told you it was funny.' },
        { text: 'Bunty laughed the loudest. Ali got the punishment.' }
      ], { bg: 'classroom', stage: ['ali', 'bunty'] }),
      scene([
        { text: "Bunty's room. This is where Ali's notebook ended up." },
        { who: 'hero', face: 'worry', text: 'A prank is only funny if everybody laughs. Who laughed when you got punished?' },
        { who: 'ali', face: 'angry', text: 'Nobody. Let us show Bunty how it feels when your things get wrecked.' }
      ]),
      level(['bag', 'skate', 'weights'], 52, 5, { title: 'His gym stuff' }),
      scene([
        { who: 'ali', face: 'determined', text: 'That punching bag was his favourite way to scare kids.' },
        { who: 'hero', face: 'smirk', text: 'Now the desk with all his shiny trophies. And a pile of other kids\' notebooks.' }
      ]),
      level(['desk', 'notes'], 40, 6, { title: 'Trophies and stolen notebooks' }),
      scene([
        { who: 'ali', face: 'angry', text: 'Last, his bed and his "KEEP OUT" sign. Nobody wanted to come in anyway.' },
        { who: 'hero', face: 'determined', text: 'Then there is nothing left to keep out.' }
      ]),
      level(['bed', 'sign'], 42, 5, { title: 'The bed and the sign' }),
      scene([
        { who: 'ali', face: 'shock', text: 'My notebook! It was under the bed the whole time.' },
        { who: 'hero', face: 'happy', text: 'Take it to school and clear your name.' },
        { who: 'ali', face: 'happy', text: 'Thank you! And Bunty… maybe next time think before you "prank".' }
      ])
    ]
  },

  // ------------------------------------------------------------------ 3
  {
    title: "Evil Erika's Room",
    subtitle: 'She spills every secret you trust her with',
    icon: '🫖',
    room: 'erika',
    reward: 100,
    beats: [
      vn([
        { text: 'A month ago, behind the school…' },
        { who: 'somalin', face: 'sad', text: 'Erika, can I tell you something? I have not told anyone.' },
        { who: 'erika', face: 'happy', text: 'Of course! You can trust me. I never tell anybody anything.' },
        { who: 'somalin', face: 'worry', text: 'I failed my exam. I cried all night, and my parents do not know yet.' },
        { who: 'erika', face: 'smirk', text: 'Your secret is safe with me.' },
        { bg: 'cafe', stage: ['erika'], who: 'erika', face: 'smirk', text: 'You will never guess what Somalin told me. Failed the exam, cried all night!' },
        { text: 'By lunch, the whole school knew.' },
        { bg: 'college', stage: ['somalin', 'erika'], who: 'somalin', face: 'cry', text: 'Erika… how could you? I trusted you.' },
        { who: 'erika', face: 'smirk', text: 'Oops. It was just too juicy to keep.' },
        { text: 'Erika never keeps a secret. She spreads them.' }
      ], { bg: 'college', stage: ['somalin', 'erika'] }),
      scene([
        { text: "Erika's room. Pink, glittery, and full of other people's secrets." },
        { who: 'hero', face: 'worry', text: 'That is not gossip. That is betrayal.' },
        { who: 'somalin', face: 'angry', text: 'She loves spilling secrets. Today we spill her tea.' }
      ]),
      level(['tea', 'bean'], 27, 4, { title: 'Spill the tea' }),
      scene([
        { who: 'somalin', face: 'determined', text: 'Every secret ends up in that giant phone. And on those gossip bubbles.' }
      ]),
      level(['phone', 'bubblesA', 'bubblesB'], 56, 5, { title: 'The gossip wall' }),
      scene([
        { who: 'hero', face: 'smirk', text: 'Last: the vanity where she plans it all, and her bed.' },
        { who: 'somalin', face: 'smirk', text: 'Make it loud. She will hear it from across the school.' }
      ]),
      level(['vanity', 'bed'], 95, 7, { title: 'The glam corner' }),
      scene([
        { who: 'somalin', face: 'happy', text: 'That felt good. Next time, I will tell my secrets only to people who keep them.' },
        { who: 'hero', face: 'happy', text: 'And maybe Erika will learn to keep her mouth shut.' }
      ])
    ]
  },

  // ------------------------------------------------------------------ 4
  {
    title: "Criminal Krick's Hideout",
    subtitle: 'A repeat offender, cleared out with the police',
    icon: '🚔',
    room: 'krick',
    reward: 150,
    beats: [
      vn([
        { text: 'The police station. The file on Krick Sebastian is as thick as a brick.' },
        { who: 'rane', face: 'angry', text: 'Krick Sebastian. Arrested again and again, always for hurting women and children.' },
        { who: 'pawar', face: 'worry', text: 'And every time, he walks free after a few weeks. Families are scared to even go out.' },
        { who: 'rane', face: 'determined', text: 'Not this time. We have the warrant for his hideout, and we have him.' },
        { bg: 'night', stage: ['rane', 'krick', 'pawar'], who: 'krick', face: 'smirk', text: 'Officers. Back again? I will be out by Monday, like always.' },
        { who: 'rane', face: 'angry', text: 'Not after tonight, Krick. Cuffs on.' },
        { who: 'krick', face: 'angry', text: 'You cannot touch my place!' },
        { who: 'pawar', face: 'determined', text: 'The warrant says we can. Take him in.' },
        { text: 'Krick was led away. His hideout was left behind, sealed by the police.' }
      ], { bg: 'station', stage: ['rane', 'pawar'] }),
      scene([
        { text: "Krick Sebastian's hideout. He is in custody, and the warrant is signed." },
        { who: 'hero', face: 'determined', text: 'How can I help?' },
        { who: 'rane', face: 'determined', text: 'Take a hammer and clear this whole hideout out.' },
        { who: 'pawar', face: 'smirk', text: 'Break everything. We will handle the rest.' }
      ]),
      level(['crates', 'duffel'], 22, 4, { title: 'The stash' }),
      scene([
        { who: 'pawar', face: 'happy', text: 'Good swing! Now the safe and the mattress. He hid more than money in this room.' }
      ]),
      level(['safe', 'mattress'], 27, 4, { title: 'The safe and the mattress' }),
      scene([
        { who: 'rane', face: 'determined', text: 'Last: his desk and the board where he planned it all. Leave nothing standing.' }
      ]),
      level(['desk', 'board'], 80, 5, { title: 'The command desk' }),
      scene([
        { who: 'rane', face: 'happy', text: 'Hideout cleared. Thank you for your help.' },
        { who: 'pawar', face: 'happy', text: 'Krick is going back where he belongs.' },
        { text: 'Justice served.' }
      ])
    ]
  },

  // ------------------------------------------------------------------ 5 (premium)
  {
    title: 'The Jade Dragon Teahouse',
    subtitle: 'A whole room of porcelain. Smash it all.',
    icon: '🏮',
    room: 'chinese',
    reward: 200,
    premium: true,
    sku: 'room_chinese',
    beats: [
      vn([
        { text: 'For forty years, the Jade Dragon Teahouse served the whole street.' },
        { who: 'lin', face: 'happy', text: 'Every plate, every bowl, every teapot here has poured a thousand cups.' },
        { who: 'lin', face: 'sad', text: 'But the shelves are crowded now, and the old porcelain is chipped and tired.' },
        { stage: ['lin', 'hero'], who: 'hero', face: 'worry', text: 'So what will you do with it all?' },
        { who: 'lin', face: 'smirk', text: 'Tomorrow my new tea set arrives. There is only one thing to do with the old one.' },
        { who: 'hero', face: 'shock', text: '…Smash it?' },
        { who: 'lin', face: 'happy', text: 'Smash it all! Make room for new beginnings.' }
      ], { bg: 'teahouse', stage: ['lin'] }),
      scene([
        { text: 'The Jade Dragon Teahouse. A cabinet full of porcelain bowls, plates, teapots and chopsticks.' },
        { who: 'lin', face: 'happy', text: 'Welcome, welcome! Everything in this room is yours to smash today.' },
        { who: 'hero', face: 'determined', text: 'Then let us make room.' }
      ]),
      level(['table', 'cushions'], 44, 4, { title: 'Dim sum table' }),
      scene([
        { who: 'lin', face: 'happy', text: 'Wonderful! Now the lantern, the scroll, the window and the bamboo.' }
      ]),
      level(['lantern', 'scroll', 'window', 'bamboo'], 105, 5, { title: 'The decorations' }),
      scene([
        { who: 'lin', face: 'smirk', text: 'And last, my cabinet. Forty years of porcelain. Do not hold back!' }
      ]),
      level(['cabinet'], 120, 6, { title: 'The porcelain cabinet' }),
      scene([
        { who: 'lin', face: 'happy', text: 'Not a single bowl left! Come back for tea any time.' },
        { who: 'hero', face: 'happy', text: 'Thank you, Madam Lin. That was the most fun I have had all year.' }
      ])
    ]
  },

  // ------------------------------------------------------------------ later (premium)
  { title: "Moody's Room", subtitle: 'Premium room · coming soon', icon: '🌧️', room: 'attic', soon: true, premium: true, sku: 'room_moody', beats: [] },
  { title: "Rakul's Room", subtitle: 'Premium room · coming soon', icon: '💄', room: 'playroom', soon: true, premium: true, sku: 'room_rakul', beats: [] },
  { title: "Ronal Cramp's Room", subtitle: 'Premium room · coming soon', icon: '🏛️', room: 'library', soon: true, premium: true, sku: 'room_ronal', beats: [] }
];

CHAPTERS.forEach((c, i) => { c.id = i + 1; });

/** Where a beat happens: a room name or a world index. Beat setting wins over the chapter's. */
export function placeOf(ch, b) {
  if (b && (b.room != null || b.world != null)) return b.room ?? b.world;
  return ch.room ?? ch.world ?? 0;
}

/** Index of beat `i` among the level beats of a chapter: [position, total] (1-based). */
function levelOrdinal(ch, i) {
  let n = 0, total = 0;
  ch.beats.forEach((b, k) => { if (b.type === 'level') { total++; if (k <= i) n++; } });
  return [n, total];
}

/** Turn a level beat into the level object the game engine plays. */
export function storyLevel(ch, i) {
  const b = ch.beats[i];
  const [n, total] = levelOrdinal(ch, i);
  return {
    id: 0,
    story: { ch: ch.id, i, key: ch.id + ':' + i },
    live: b.live, obj: b.obj, target: b.target, hits: b.hits,
    variant: b.variant || {},
    time: b.time || LEVEL_TIME,
    place: placeOf(ch, b),
    world: typeof placeOf(ch, b) === 'number' ? placeOf(ch, b) : 0,
    reward: b.reward ?? 20 + (ch.id - 1) * 5,
    label: b.title ? b.title.toUpperCase() : `CHAPTER ${ch.id} · SMASH ${n}/${total}`,
    hudLabel: b.title ? `Ch.${ch.id} · ${b.title}` : `Chapter ${ch.id} · Smash ${n}/${total}`
  };
}

/**
 * Object shown behind a dialogue scene on an island (rooms show their furniture instead, so they return null):
 * its own, else the next level's, else the previous one's.
 */
export function sceneObject(ch, i) {
  const b = ch.beats[i];
  if (b.obj) return b.obj;
  if (typeof placeOf(ch, b) === 'string') return null;
  for (let k = i + 1; k < ch.beats.length; k++) if (ch.beats[k].type === 'level' && ch.beats[k].obj) return ch.beats[k].obj;
  for (let k = i - 1; k >= 0; k--) if (ch.beats[k].type === 'level' && ch.beats[k].obj) return ch.beats[k].obj;
  return 'ceramic_vase';
}

/** Furniture pieces smashed by the level beats before beat `i` (they stay gone for the rest of the chapter). */
export function brokenBefore(ch, i) {
  const out = new Set();
  for (let k = 0; k < i && k < ch.beats.length; k++) if (ch.beats[k].type === 'level' && ch.beats[k].live) ch.beats[k].live.forEach((id) => out.add(id));
  return out;
}

/** The chapter to offer on the menu button: first unfinished free chapter that is unlocked (or null when all done). */
export function nextChapter(story) {
  return CHAPTERS.find((c) => !c.soon && !c.premium && !story.done[c.id] && c.id <= story.unlocked) || null;
}
