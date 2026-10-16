# Flappy Head

A self-contained, retro pixel-art take on Flappy Bird, built with plain
HTML, CSS and an HTML5 `<canvas>`. No build step, no dependencies, no
framework — open the page and play.

## Play it now

**<https://flappyhead.vercel.app>**

## Get the code

The game is completely static — no build step, no dependencies, no framework.
Grab the folder and open the page.

**Option A — clone**

```bash
git clone https://github.com/jtrootiffy/flappyHead.git
cd flappyHead
```

**Option B — download the ZIP**

1. Open <https://github.com/jtrootiffy/flappyHead>.
2. Choose **Code → Download ZIP**.
3. Unzip it anywhere you like.

**Then run it** — double-click `index.html`. Everything (scripts, styles, art)
is local, so it runs straight from `file://` with no server.

Prefer a local server? From the unzipped folder:

```bash
npx serve .
# or
python -m http.server 8000
```

Then browse to the printed URL.

### Controls

| Action | Input |
| --- | --- |
| Flap / start / retry | `Space`, `ArrowUp`, click, or tap |
| Choose your flyer | Click a portrait, `←` / `→` (or `A`/`D`), or number keys `1`–`4` |
| Mute / unmute | Speaker button (top-right) |
| CRT effect on / off | Monitor button (top-right) |

There is a single input path for every device. The state machine decides
what a press means, so a tap can never double-fire and a panicked click
during the death animation cannot restart the run early. Picking a flyer
never starts the run — only a flap input does.

### Pick your flyer

Every run is preceded by a short "choose your flyer" screen: the four PNG
heads in `heads/` are shown as tappable portraits, the selection
is highlighted and previewed live (the head bobs on the spot), and it is
remembered between sessions. Pick with a click/tap, `←`/`→`, or the number
keys `1`–`4`; press `Space`/tap the field to launch.

---

## Features

- **Choose your flyer** — pick one of four head PNGs on the pre-run screen;
  each is auto-fit into the flyer slot (whole image, aspect ratio kept) and
  rotates with the bird's tilt. It is drawn on a separate device-resolution
  layer, so the photo-ish head stays **smooth and sharp** instead of being
  pixelated up with the play field. The choice is remembered.
- **Pixel-art presentation** — limited palette, hand-baked bitmap sprites
  and a 5×7 pixel bitmap font for the in-canvas score.
- **Parallax world** — sky, clouds, far/near hills, city, bushes and the
  scrolling ground each move at their own rate.
- **CRT dressing** — scanlines, vignette and a subtle flicker, all toggleable.
- **Frame-rate independent physics** — a fixed 120 Hz timestep accumulator
  means the game feels identical at 60 Hz, 120 Hz or under load.
- **Real difficulty curve** — pipes get faster, gaps get tighter and spacing
  shrinks as the score climbs, up to a tuned ceiling.
- **Juice** — flap/impact particles, a score flash, screen shake on death and
  a tumbling death animation before the game-over card.
- **Persistence** — best score, mute state and CRT state survive reloads
  (`localStorage`, namespaced under `flappy-head:`).
- **3 screens** — animated start screen, a "choose your flyer" briefing, and
  a game-over card with score, best and a `NEW BEST!` callout.
- **Accessible & responsive** — keyboard focus rings, a polite live region
  that announces state changes, `prefers-reduced-motion` support, and a
  layout that keeps the play field whole on phones without page scrolling.

---

## Project layout

```
flappyHead/
├── index.html          # markup: play-field canvas + high-res flyer layer,
│                       #         HUD, the three screens
├── favicon.svg         # "JTL" app icon (white pixel letters, transparent bg)
├── .gitignore          # ignores local deploy config + OS clutter
├── css/
│   └── style.css       # layout, pixel UI, flyer picker, CRT overlay, responsive
├── heads/              # the selectable flyers (your PNGs)
│   ├── Angel.png
│   ├── Joven.png
│   ├── Raven.png
│   └── Troy.png
└── js/
    ├── core.js         # namespace, tuning constants, palette, storage, math
    ├── audio.js        # WebAudio blips (flap/score/hit/die/select), mute + unlock
    ├── sprites.js      # baked bird/pipe bitmaps + the 5x7 pixel font
    ├── heads.js        # flyer list, one-time downscale, selection + persistence
    ├── background.js   # baked parallax tiles (clouds/hills/city/ground)
    ├── entities.js     # bird/pipe factories, particles, AABB hitboxes
    ├── game.js         # the simulation: state machine, physics, collision
    ├── renderer.js     # the draw pipeline (world -> flyer -> particles -> UI)
    ├── input.js        # keyboard/pointer/touch, all routed to Game.primaryInput
    ├── ui.js           # DOM screens, buttons, toggles, live region, --u sizing
    └── main.js         # bootstrap + the requestAnimationFrame loop
```

### Adding or swapping a flyer

Drop a new PNG (ideally square-ish, transparent background) into `heads/` and
add one line to the `HEADS` array in `js/heads.js`:

```js
const HEADS = [
  { id: "angel", name: "ANGEL", src: "heads/Angel.png" },
  // ...
];
```

Order matters (the array index is what gets stored), and the `name` is what
the picker and screen reader announce.

Scripts are plain `<script>` tags in dependency order (no modules), so the
game also runs straight from the filesystem.

### How it fits together

```
     input.js ──┐                      main.js  (rAF loop)
                ├─► Game.primaryInput ─► Game.update(dt) ──► Renderer.draw
     ui.js ─────┘         ▲                    │                  ▲
                          │                    ▼                  │
                    state machine        entities/particles   sprites/background/
                    (menu→ready→          + collision         heads (baked at boot)
                     playing→dying→over)  (AABB vs flyer)
```

- **State machine** — `menu → ready → playing → dying → over → ready …`.
  `ready` doubles as the "choose your flyer" screen and re-runs before every
  attempt. `dying` deliberately ignores input so the death animation always
  plays out.
- **Fixed timestep** — `STEP = 1/120`; the loop accumulates real time and
  runs whole steps, capping at `MAX_STEPS` to avoid a spiral of death. A
  long stall is clamped to 250 ms.
- **Deterministic art** — background tiles use a seeded PRNG, so the world
  looks identical on every load.

---

## Tuning

All gameplay numbers live in one place: `RF.CONFIG` in `js/core.js`.
Speeds are in *logical pixels per second*, independent of device size.

```js
GRAVITY: 1500, FLAP_V: -430, MAX_FALL: 620,   // flyer feel
BIRD_W: 26, BIRD_H: 26,                       // flyer slot (head is fit into it)
HIT_INSET_X: 6, HIT_INSET_Y: 6,               // forgiving 14x14 hitbox
PIPE_W: 52, GAP_START: 152, GAP_MIN: 118,     // pipe geometry
SPEED_START: 108, SPEED_MAX: 190,             // difficulty curve
STEP: 1 / 120, MAX_STEPS: 6                   // simulation
```

The logical resolution is **288×512** (`PLAY_H` 416 + 96px ground). The world
is drawn at that resolution and CSS scales it with
`image-rendering: pixelated`, so the bitmap art stays crisp and chunky.

The **chosen head is different**: it is a photo-like PNG, so pixelated
upscaling would destroy it. Instead each PNG is pre-rendered once at
`HEAD_RES` (256px), and every frame it is redrawn — same position, tilt and
screen shake — onto a second canvas (`#flyer`) whose backing store matches the
display's real pixel size (`CSS size × devicePixelRatio`, capped at 3). The
render loop still only blits four tiny bitmaps at boot; per frame it is one
scaled, rotated `drawImage`.

---

## Verification

The game was checked end-to-end in a headless browser:

- boot → menu renders; `Space` → ready → playing; autopilot scores
- all four head PNGs load; each renders non-empty pixels in the flyer slot
- the chosen head is drawn on the `#flyer` layer at device resolution and
  stays aligned with the bird (centre offset ≈ the artwork's own asymmetry);
  the layer resizes with the viewport and re-renders after a resize
- the head is anti-aliased, not pixelated — the drawn region shows ~200
  distinct alpha values and 600+ distinct colours
- the picker shows 4 portraits, highlights the selection, and the chosen head
  is what actually flies (verified by sampling the canvas)
- clicking a portrait changes the selection **without** starting the run;
  `←`/`→` cycle (with wrap) and `1`–`4` pick directly
- the choice persists across reloads (`flappy-head:head`)
- ground/pipe collision → `dying` → `over`; best persisted to `localStorage`
- `TRY AGAIN` → ready; a single keypress does not double-act
- mute + CRT toggles persist across reloads
- background scrolls during live play (parallax offsets scale correctly)
- layouts fit at 320×568, 375×667 and 414×736 with no overflow and
  `body { overflow: hidden }`
- works from both `http://` and `file://`
- **0 console errors, 0 failed requests**

For debugging or automation, `window.__flappy = { game, renderer, RF }` is
exposed by `js/main.js`.

---

## Art assets

The world (sky, clouds, hills, pipes, ground, pixel font) is generated in code
at boot — there are no sprite image files. The **only** bitmaps are the
selectable flyers in `heads/`.

---

## License

MIT — do whatever you like.
