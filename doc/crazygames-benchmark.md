# CrazyGames benchmark — Afterlight District guest

Reviewed before the guest build. Sources are the public CrazyGames game pages (descriptions, feature lists, controls, orientation, ratings) plus this repo’s playable loop. No portal submission was made.

## What we ship today

Afterlight District is a portrait phone slice: rescue Lin, drag her to the workbench, repair the south barricade, then survive an endless night with two buttons (lamp overload, field repair). The 3D block, teal power, and warm windows are already a real art direction. The host build is AlterU-specific (Chinese/English i18n, watermark, `alteru-storage-scope.js`, portrait stage).

That loop matches the design docs. It does not yet match a desktop portal’s first three minutes.

## Reference titles

### 1. Tower vs Goblins (24 HIT, rating 9.4)

Landscape, desktop-only. [crazygames.com/game/tower-vs-goblins](https://www.crazygames.com/game/tower-vs-goblins)

- Art is cute, high-contrast, and animated. Waves read as a spectacle, not as dots on a road.
- The player aims and shoots the whole time. Upgrades (arrows, crit, fire rate, fortress) land immediately after a wave.
- First minutes: one clear job (don’t let them touch the tower), an early kill, then a choice that changes the next wave.
- Audio and UI are part of the pitch (“catchy”, sound is assumed, not a footnote).

### 2. Nightfall: Survival Siege (rating 8.5)

Landscape day/night siege. [crazygames.com/game/nightfall-survival-siege-gxt](https://www.crazygames.com/game/nightfall-survival-siege-gxt)

- The clock is the tutorial. Day is for gathering and building; night is when the plan is tested.
- Light is a mechanic, not a tint. A campfire before dark is the difference between seeing the fight and losing it.
- Keyboard and mouse are both first-class (WASD, aim, interact, build list).
- The first session already has a reason to stay: airdrops, a vendor, and money dropped by kills.

### 3. Iron Bastion: Tower Defense (AzusDex, rating 8.3)

Desktop HTML5, industrial city vs zombies. [crazygames.com/game/iron-bastion-tower-defense](https://www.crazygames.com/game/iron-bastion-tower-defense)

- One readable fantasy: towers on a city, zombies on a path, upgrades between waves.
- Depth is a short roster done properly (4 towers, distinct zombies, 20 levels), not a menu of locked systems.
- Mouse-first, but the screen is a desktop layout, not a phone column in a black frame.

### 4. Age of Steam Tower Defence (Macuseri686, rating 8.1)

[crazygames.com/game/age-of-steam-tower-defence](https://www.crazygames.com/game/age-of-steam-tower-defence)

- The page calls out a clean HUD: funds, HQ health, one build sidebar, one button to start the next wave.
- Combat feedback is described as readable. Audio is thematic and has separate music and SFX sliders.
- Pressure ramps by wave composition (infantry, riders, tanks, blimps), so minute three is a new problem, not a new game.

### 5. Outpost: Zombie Apocalypse (AGAVA, rating 8.3)

Landscape day-prep / night-horde. [crazygames.com/game/outpost-zombie-apocalypse](https://www.crazygames.com/game/outpost-zombie-apocalypse)

- Daytime is safe on purpose so the player can fortify, place lights, and lay traps before the horde.
- Each night is harder, and the unlock (weapons, structures) is the reason to survive this one.
- Direct control (move, interact) keeps the player inside the scene instead of watching a timer.

## Ranked gaps

1. **The frame.** The host is a portrait stage (`width: min(100%, 86dvh)`). On a 16:9 CrazyGames iframe that reads as a phone game letterboxed in a desktop page. The references fill the landscape and put the fight in the middle of it.
2. **The first minute is waiting.** Rescue, assign, and repair are gated behind dialogue beats before the only button appears. Portal games put a hand on the mouse in the first few seconds and pay it off with a visible change (door, worker, scrap number, lamp).
3. **Night is mostly a spectator sport.** Sentries shoot by themselves. The player has two cooldown buttons. Tower vs Goblins and Nightfall make the player the weapon: aim, hit, number, kill, then spend the reward.
4. **Juice is specified, not dense.** The host has a small shake, a `+14` repair pop, and short tones. The references stack hit sparks, damage numbers, screen punch, and a musical bed so every click feels like contact.
5. **No real music.** Tones in `src/audio/sound.ts` are UI beeps. Toy Rampage (the submission that passed) was called out for actual music plus a full tutorial and a save. Empty nights with no score read as unfinished.
6. **Progression is one binary card, with no memory.** Barricade vs battery is a real choice, but there is no best-night, no banked reward, and no visible “this unlocks next” on the first dawn. Players who clear night 1 are not shown why night 2 is different.
7. **Host chrome.** Watermark, AlterU storage shell, and Chinese copy are correct for the phone host and wrong on CrazyGames. English, no social UI, guest save key.

## What the guest build will do

Stay off the host bundle. A `build:guest` target renders the same low-poly district in a camera that fills 16:9, with English UI and no watermark.

- **Act fast.** Title → click the signal house → walk Lin to the bench (scrap pops) → repair the barricade → stand watch. Skip is on the title and during those steps.
- **Night you play.** Click or hold to fire the relay lamps. Bolts, damage numbers, sparks, a short hit-stop, and camera shake on kills and on core hits. `1` overloads the light, `2` patches the barricade. Keyboard and mouse both work.
- **First three minutes.** Night 1 is a short, winnable husk wave and ends in a dawn card, then a paid upgrade (reinforce or battery). A third card, sentry capacitor, stays locked until night 2 is cleared, and night 2 introduces cable stalkers. That is the “come back” hook. No late-game dump.
- **Memory.** `localStorage` key `cg_afterlight_guest_v1` keeps the run, best night, mute, tutorial flag, and a small supply cache bought with scrap banked at dawn.
- **Audio.** Two CC0 beds (day: EmptyCity by yd, night: Dark City by cinameng) plus an original synth layer for UI, shots, hits, skills, dawn, and failure. Credits live in `src/guest/audio/LICENSE.txt`.

## Polish round

The first guest still read as a lit block on an empty lawn, and the first session was one upgrade. The frame now continues into neighbouring blocks, a windowed skyline, and fog at the edges. Nights 1–3 each add a threat and a call:

- Night 1: husks only, short. The west lamp flickers; overload steadies it. Dawn unlocks gate plates, a clinic cot, or a ration crate.
- Night 2: stalkers weave and runners slip the gate. A curb call asks for two of those kills. Dawn opens relay coils.
- Night 3: a marked brute charges the center. The clinic, if taken, patches a hurt gate once. The ration crate, if taken, pays scrap at dusk.
