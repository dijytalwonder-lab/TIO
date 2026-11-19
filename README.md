# Take It Out

*Passive-aggressive smashing.* A low-poly isometric 3D destruction game for phones and browsers (Three.js + Vite).

Tap to swing the hammer. Every object has a hidden critical zone: hit the middle for a huge blast, hit the edges and it only cracks.

## Modes

- **Play** – 30 levels over 6 floating dioramas (fragment target, hit limit, timer).
- **Story** – one character's room per chapter. Each chapter starts with a visual-novel backstory (painted backdrops and cut-out characters), then you smash the furniture and things in that room. A magnifier bar zooms the camera into any part of the room. One premium room is included as a test unlock.
- **ASMR** – endless relaxing smashing, no timer and no failing.

## Run it

```
npm install
npm run dev       # development server
npm run web       # single-file build -> dist-web/play.html (works from file://)
npx eslint src    # lint
```

## Writing the story

Everything lives in `src/story.js`: the cast, the chapters, the dialogue and the levels. Rooms and their furniture are in `src/rooms.js` (`SETS`), room colours in `src/levels.js` (`ROOMS`), and the drawn characters and backdrops in `src/portraits.js`.

Check edits with `node tests/story-check.mjs` (structure + bot pass rates) and `node tests/pieces.mjs` (every furniture piece breaks).

## Tests

Pure Node (no browser): `node tests/smoke.mjs`, `node tests/story-check.mjs`, `node tests/pieces.mjs`, `node tests/sim.mjs --levels`.
Headless Chrome over a pipe (no network port): see `tests/headless/README.txt`.
