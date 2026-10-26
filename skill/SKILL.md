---
name: pixel-studio
description: Make retro pixel-art animation videos (collapsing landmarks, little characters, sci-fi labs, explainers) as code with the free Pixel Studio engine. Use when the user wants a "pixel video", "pixel animation", "8-bit / 16-bit scene", or a reel in that style.
---

# Pixel Studio

Every scene is one JS file in `scenes/` that calls `PX.scene({...})`, plus a `<script>` tag for it in `studio.html` and `index.html` (the gallery). The engine is `src/pixel.js` and has no dependencies. Open `index.html` through any static server (for example `python3 -m http.server`).

## The rules that make it look like real pixel art

1. **Resolution.** Use 256×320 (4:5 card, the default) or 180×320 (9:16 reel). Use 128×160 for a chunkier, more retro look. The HUD and titles scale automatically.
2. **Palette indices only.** Never draw with hex colours. Slots 0–7 are the main ramp (0 darkest, 7 white) and slots 8–11 are an accent ramp (dark to bright). Shade light-to-dark across a form. Save the accent for the hero or the key prop. This is what makes palette swaps work.
3. **Whole pixels only.** Use `b.px`, `b.rect`, `b.line`, `b.circle`, `b.blit` and `b.blitRot` (nearest-neighbour). Never use canvas paths, gradients or `ctx.rotate`. They anti-alias and break the look.
4. **Transparency means dithering.** For smoke, glow, fades and shadows, use `b.dither` or `b.ditherCircle` with an amount from 0 to 1. Never use alpha.
5. **Step time at 12 fps** (`fps: 12`). Camera shake and flash are done in `fx` and are fine.
6. **Determinism.** `draw(b, t, state)` must be a pure function of `t`. Use `PX.rng(seed)` for randomness and never `Math.random()`. Precompute physics in `setup()` into arrays indexed by time (see `scenes/pisa.js`).
7. **Fidelity comes from five tools:**
   - `b.ball(cx, cy, rx, ry, ramp)` for rounded, lit forms (heads, bodies, smoke).
   - `b.cyl(x, y, w, h, ramp)` for columns, limbs and trunks.
   - `b.poly(points, c)` and `b.ellipse` for shapes.
   - `sprite.outline(0)` for a 1px dark outline, so characters pop. Draw the character into its own `new PX.Buf(w, h)`, outline it, then `blit` or `blitRot` it.
   - Seeded noise one shade apart, so big areas are never flat.
   Give eyes a 1px white highlight. Make the hero the highest-contrast thing on screen.
8. **Sound on every event.** List them in `events: [{ t, sfx }]`, or return them from `setup()`. The built-in sounds are tick, blip, flip, crack, thud, boom and rumble. They are synthesised, so no audio files are needed.

## Scene skeleton

```js
PX.scene({
  name: 'My Scene', w: 256, h: 320, fps: 12, duration: 6, palette: 'teal',
  setup() { return { events: [{ t: 1, sfx: 'tick' }] }; },
  draw(b, t, S) {
    b.clear(0);
    b.rect(0, 276, 256, 44, 2);                       // ground
    b.ball(128, 240, 20, 24, [2, 3, 4, 5, 6]);        // a lit body
    PX.title(b, ['HELLO'], t, 1);                     // typewriter title
    return { flash: 0, shakeX: 0, shakeY: 0 };         // optional post FX
  },
});
```

## Story beats that go viral

Use this order: a HUD with a ticking number (tension), an escalating small change, a sudden break (flip the HUD colours, flash, shake, glitch rows with `b.rowShift`), debris and dust, then a title typed in letter by letter. Keep it to 6–8 seconds and make it loop cleanly by ending with a dithered fade to 0.

## Workflow

1. Write the scene file and add its `<script>` tag.
2. Check key moments headlessly with `node tools/render.mjs scenes/x.js 0.5 2.5 4 --scale 2 --out /tmp/x`, then look at the PNGs and fix whatever reads badly. In the browser, `studio.html?t=2.5&palette=ember` freezes on a moment.
3. Export a frame-exact silent MP4 with `node tools/render.mjs scenes/x.js --mp4 out/x.mp4` (needs ffmpeg). For a version with sound, use the **Record video** button in the studio (WebM).
