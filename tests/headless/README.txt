Headless Chrome checks of dist play.html (pipe transport = NO network port; needs the user's OK first).
- puppeteer-core path is hard-coded at the top of each script (old scratchpad install) - re-point if missing.
- Software GL (SwiftShader) runs at only a few fps, so wait for S.mode === 'playing' before clicking.
- boot-and-hit.mjs play   : boot, screenshot menu, play level 1, crit hit screenshots
- full-flow.mjs ui        : levels / hammers / settings / pause / win / fail screens
- full-flow.mjs levels A B: play levels A..B with expert taps at the hidden zone, print results + console errors
Screenshots are written next to the script.
- hb-audio.mjs : renders every sound offline (OfflineAudioContext) -> WAVs in HappyBreaking-play/sounds + peak/RMS/clip report
- hb-zen.mjs   : ASMR mode, slow-mo timeScale samples, rolling counter, cycles all 16 objects
- hb-story.mjs [N]: plays story chapters 1..N (default 4) end to end: VN + dialogue scenes, every room level (expert taps on each live piece), CONTINUE, chapter end, unlock order, premium note, saves, back button, campaign untouched
- hb-zoom.mjs: story-room zoom: magnifier bar, tap zooms (no hit), zoomed taps strike, bare floor pans, bar zooms out, knob drag
- hb-vn.mjs: chapter list + premium section, the visual-novel backstory (screenshots), premium sheet + test unlock, chapter 5 opens
- node tests/story-check.mjs [--quick]: pure-Node validation of src/story.js (speakers, faces, backdrops, rooms, piece ids) + bot pass rates for every story level
- node tests/pieces.mjs: builds every furniture piece of every story room, shard counts + expert fragments
- hb-rooms.mjs: screenshots all 10 rooms (ui hidden), back-wall collision check, island worlds have no walls
Set HB_SHOTS=<folder> to write screenshots somewhere else (the script folder has a space in its path).
