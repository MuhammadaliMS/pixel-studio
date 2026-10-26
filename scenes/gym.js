/* Scene: five reps on the bench, the last one a grind, then a new PR. Game Boy palette, 256x320.
 * Background lives in 0-4 (dark brick, iron); the lifter owns 3-7 so he is the brightest thing on screen.
 */
(() => {
  const B = PX.Buf, T = PX.T, G = 262, WALL = 232;
  const LX = -0.55, LY = -0.65;
  const SK = [4, 5, 6, 7, 7], RED = [3, 4, 5, 6, 7], FAR = [1, 2, 3, 4, 5], TANK = [1, 2, 3, 4, 4], SHORTS = [1, 2, 3, 4];

  // shaded capsule: a thick limb from (x0,y0) to (x1,y1), radius r0 -> r1, sphere-lit like Buf.ball
  function limb(f, x0, y0, x1, y1, r0, r1, ramp) {
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1, m = Math.max(r0, r1) + 1;
    for (let y = Math.floor(Math.min(y0, y1) - m); y <= Math.ceil(Math.max(y0, y1) + m); y++)
      for (let x = Math.floor(Math.min(x0, x1) - m); x <= Math.ceil(Math.max(x0, x1) + m); x++) {
        const px = x + 0.5, py = y + 0.5, u = PX.clamp(((px - x0) * dx + (py - y0) * dy) / l2);
        const cx = x0 + u * dx, cy = y0 + u * dy, r = r0 + (r1 - r0) * u;
        const nx = (px - cx) / r, ny = (py - cy) / r, d = nx * nx + ny * ny;
        if (d > 1) continue;
        f.px(x, y, B.shadeAt(ramp, (nx * LX + ny * LY + Math.sqrt(1 - d) * 0.55) * 0.75 + 0.3, x, y));
      }
  }
  const ring = (b, cx, cy, r0, r1, c) => {
    for (let y = -r1; y <= r1; y++) for (let x = -r1; x <= r1; x++) {
      const d = x * x + y * y;
      if (d <= r1 * r1 && d >= r0 * r0) b.px(cx + x, cy + y, c);
    }
  };
  const shoe = (f, x, ramp, sole) => {
    f.ball(x + 7, G - 8, 13, 7, ramp);
    f.rect(x - 6, G - 3, 27, 3, sole);
    f.rect(x - 5, G - 4, 25, 1, 7);
    for (let i = 0; i < 3; i++) f.rect(x + 3 + i * 3, G - 13 + i, 2, 1, 7);
  };

  // everything that never moves: wall, window, poster, dumbbells, mat, rack, bench
  function buildBg() {
    const r = PX.rng(11), b = new B(256, 320);
    b.rect(0, 0, 256, WALL, 1);
    for (let row = 0; row * 8 < WALL; row++) {
      const off = row % 2 ? 12 : 0, y = row * 8;
      for (let x = -24 + off; x < 256; x += 24) {
        b.dither(x, y, 23, 7, 2, 0.04 + r() * 0.2);
        b.rect(x, y + 7, 24, 1, 0); b.rect(x + 23, y, 1, 8, 0);
      }
    }
    for (let i = 0; i < 700; i++) { const x = (r() * 256) | 0, y = (r() * WALL) | 0; if (b.get(x, y) === 1) b.px(x, y, 0); }
    for (let k = 0; k < 6; k++) b.dither(0, k * 8, 256, 8, 0, 0.55 - k * 0.09);
    // window + light rays
    b.rect(92, 28, 64, 80, 3); b.frame(92, 28, 64, 80, 4);
    b.rect(97, 33, 54, 70, 4);
    for (let i = 0; i < 70; i++) b.dither(97, 33 + i, 54, 1, 5, 0.7 - i / 100);
    b.rect(122, 33, 4, 70, 2); b.rect(97, 66, 54, 4, 2);
    b.rect(122, 33, 1, 70, 3); b.rect(97, 66, 54, 1, 3);
    for (let i = 0; i < 14; i++) b.px(100 + ((r() * 20) | 0), 36 + ((r() * 24) | 0), 5);
    b.rect(88, 108, 72, 4, 4); b.rect(88, 108, 72, 1, 5); b.rect(90, 112, 68, 2, 0);
    for (let k = 0; k < 3; k++) {
      const x0 = 96 + k * 20;
      for (let y = 114; y < 300; y++) {
        const q = (y - 114) / 186, xl = x0 - (y - 114) * 0.5, w = 13 + (y - 114) * 0.1;
        b.dither(xl, y, w, 1, y < WALL ? 3 : 2, (y < WALL ? 0.5 : 0.35) * (1 - q * 0.8));
      }
    }
    // motivational poster
    b.rect(176, 22, 60, 70, 4); b.rect(178, 24, 56, 66, 3);
    b.dither(178, 24, 56, 66, 2, 0.3);
    b.rect(200, 20, 12, 4, 5);
    b.rect(186, 42, 40, 3, 5); b.rect(188, 34, 4, 19, 5); b.rect(222, 34, 4, 19, 5);
    b.rect(184, 38, 3, 11, 4); b.rect(227, 38, 3, 11, 4);
    b.text('NO PAIN', 183, 62, 6, { scale: 2 });
    b.text('NO GAIN', 183, 75, 5, { scale: 2 });
    // dumbbell rack
    b.cyl(150, 150, 5, 82, [0, 1, 2, 3, 4]); b.cyl(244, 150, 5, 82, [0, 1, 2, 3, 4]);
    for (const sy of [182, 218]) {
      b.rect(150, sy, 99, 4, 3); b.rect(150, sy, 99, 1, 4); b.rect(150, sy + 4, 99, 1, 0);
      for (let i = 0; i < 5; i++) {
        const x = 158 + i * 17, hh = 7 + i;
        b.rect(x + 3, sy - hh - 1, 10, 2, 4); b.rect(x + 3, sy - hh - 1, 10, 1, 5);
        b.ball(x + 2, sy - hh, 2, hh, [0, 1, 2, 3, 4]); b.ball(x + 14, sy - hh, 2, hh, [0, 1, 2, 3, 4]);
      }
    }
    // rubber mat
    b.rect(0, WALL, 256, 88, 1);
    for (let y = WALL; y < 320; y++) b.dither(0, y, 256, 1, 0, ((y - WALL) / 88) * 0.5);
    for (let x = 0; x < 256; x += 32) b.rect(x, WALL, 1, 88, 0);
    for (const y of [WALL + 18, WALL + 40, WALL + 66]) b.rect(0, y, 256, 1, 0);
    for (let i = 0; i < 1500; i++) { const x = (r() * 256) | 0, y = WALL + ((r() * 88) | 0); b.px(x, y, r() < 0.7 ? 2 : 0); }
    for (let i = 0; i < 160; i++) b.px((r() * 256) | 0, WALL + ((r() * 88) | 0), 3);
    b.rect(0, WALL, 256, 1, 3); b.rect(0, WALL - 6, 256, 6, 2); b.rect(0, WALL - 6, 256, 1, 3); b.rect(0, WALL - 1, 256, 1, 0);
    // soft shadow under bench and lifter
    [[104, 0.35], [92, 0.55], [78, 0.75]].forEach(([rx, a], i) => {
      for (let dy = -(9 - i * 2); dy <= 9 - i * 2; dy++) {
        const w = Math.round(rx * Math.sqrt(1 - (dy * dy) / ((9 - i * 2) ** 2 + 1)));
        b.dither(118 - w, G + 2 + dy, w * 2, 1, 0, a);
      }
    });
    // rack: uprights with holes, J-hooks, feet
    for (const x of [28, 112]) {
      b.cyl(x, 74, 10, G - 74, [0, 1, 1, 2, 3]);
      for (let y = 82; y < G - 6; y += 10) { b.rect(x + 4, y, 2, 3, 0); }
      b.rect(x - 2, 70, 14, 4, 4); b.rect(x - 2, 70, 14, 1, 5);
      b.rect(x - 6, G - 4, 22, 4, 3); b.rect(x - 6, G - 4, 22, 1, 4);
    }
    b.rect(38, 170, 12, 5, 4); b.rect(47, 165, 3, 5, 4); b.rect(38, 170, 12, 1, 5);
    b.rect(101, 170, 11, 5, 4); b.rect(101, 165, 3, 5, 4); b.rect(101, 170, 11, 1, 5);
    // bench: padded top with stitching + steel legs
    for (const x of [46, 134]) { b.cyl(x, 232, 9, G - 232, [0, 1, 2, 3, 4, 5]); b.rect(x - 5, G - 4, 19, 4, 3); b.rect(x - 5, G - 4, 19, 1, 5); }
    b.rect(46, 244, 97, 3, 3); b.rect(46, 244, 97, 1, 4);
    b.rect(28, 230, 124, 4, 3); b.rect(28, 230, 124, 1, 4);
    b.rect(28, 218, 124, 12, 3);
    b.dither(28, 218, 124, 12, 2, 0.3);
    for (let i = 0; i < 160; i++) b.px(28 + ((r() * 124) | 0), 220 + ((r() * 8) | 0), r() < 0.5 ? 2 : 4);
    b.rect(30, 218, 120, 1, 5); b.rect(30, 219, 120, 1, 4);
    b.rect(28, 229, 124, 1, 1);
    for (let x = 32; x < 148; x += 4) b.rect(x, 224, 2, 1, 5);
    for (const [x, y] of [[28, 218], [151, 218], [28, 229], [151, 229]]) b.px(x, y, T);
    return b;
  }

  PX.scene({
    name: 'New PR',
    w: 256,
    h: 320,
    fps: 12,
    duration: 7,
    palette: 'gameboy',

    setup() {
      const r = PX.rng(3);
      // each rep: [start, duration]; the last one grinds
      const reps = [[0.4, 0.7], [1.1, 0.7], [1.8, 0.75], [2.55, 0.85], [3.4, 1.4]];
      const PR = 4.8, TITLE = ['NEW PR!'], T_TITLE = 5.1;
      const cols = [7, 11, 10, 6];
      const confetti = Array.from({ length: 70 }, () => ({ x: r() * 256, v: 55 + r() * 80, ph: r() * 6, sp: (r() - 0.5) * 14, c: (r() * 4) | 0 }));
      const cf = cols.map((c, i) => { const s = new B(6, 3); s.rect(0, 0, 6, 2, c); s.rect(0, 2, 6, 1, cols[(i + 1) % 4] === 6 ? 5 : 4); return s; });
      const sweat = Array.from({ length: 9 }, () => ({ ph: r(), vx: -(16 + r() * 40), vy: -(34 + r() * 40), ox: r() * 10 }));
      const events = reps.map(([s, d]) => ({ t: s + d, sfx: 'tick' }));
      events.push({ t: PR, sfx: 'flip' }, { t: PR, sfx: 'boom' }, ...PX.titleEvents(TITLE, T_TITLE));
      return { reps, PR, TITLE, T_TITLE, confetti, cf, sweat, events, bg: buildBg() };
    },

    draw(b, t, S) {
      const frame = Math.round(t * 12), fx = {};
      b.blit(S.bg, 0, 0);

      // bar height: 0 = on chest, 1 = locked out
      let ext = 1, grind = false, reping = false;
      for (const [s, d] of S.reps) {
        if (t < s || t >= s + d) continue;
        const u = (t - s) / d;
        reping = true;
        if (d > 1) { // the grind: slow, stalls in the middle, shakes
          grind = u > 0.25;
          ext = u < 0.25 ? 1 - u / 0.25 : u < 0.8 ? 0.15 + 0.5 * PX.ease.out((u - 0.25) / 0.55) : 0.65 + 0.35 * (u - 0.8) / 0.2;
        } else ext = u < 0.45 ? 1 - u / 0.45 : (u - 0.45) / 0.55;
      }
      const strain = grind ? 1 : t > 2.55 && t < S.PR + 0.5 ? 0.5 : 0;
      const jit = grind ? (frame % 2 ? 1 : -1) : 0;
      const sh = { x: 78, y: 198 };
      const hand = { x: 79 + jit, y: Math.round(187 - ext * 38) + (grind && frame % 3 === 0 ? 1 : 0) };

      // far-side plate on the bar (behind the lifter), then the lifter
      const hx = hand.x, hy = hand.y;
      b.ball(hx, hy, 19, 19, [0, 1, 2, 3, 4]);
      ring(b, hx, hy, 16, 19, 3); ring(b, hx, hy, 18, 19, 4);
      ring(b, hx, hy, 14, 15, 0); ring(b, hx, hy, 9, 10, 1);
      for (let a = 0; a < 16; a++) b.px(hx + Math.cos(a / 16 * 6.283) * 12, hy + Math.sin(a / 16 * 6.283) * 12, 1);
      b.ball(hx, hy, 7, 7, [1, 2, 3, 4, 5]); b.circle(hx, hy, 2, 0);
      b.rect(hx - 14, hy - 13, 4, 1, 7); b.px(hx - 13, hy - 12, 7); b.px(hx - 11, hy - 15, 6); b.px(hx - 15, hy - 11, 6); b.px(hx - 3, hy - 4, 6);

      const f = new B(256, 320), br = frame % 8 < 4 || reping ? 0 : 1, face = strain > 0.7 ? RED : SK;
      // each body part is drawn alone and given a 1px inner contour, so overlaps stay readable
      const part = (oc, fn) => { const p = new B(256, 320); fn(p); f.blit(p.outline(oc), -1, -1); };
      // far leg
      part(0, (p) => { limb(p, 126, 208, 168, 192, 8, 7, FAR); limb(p, 168, 192, 183, 247, 6, 4, FAR); shoe(p, 183, [2, 3, 4, 5], 5); });
      // torso: chest shaded as a cylinder, tank top over it
      part(2, (p) => limb(p, 80, 204, 122, 208, 14 + br, 10, SK));
      part(1, (p) => {
        limb(p, 84, 204, 123, 208, 13.4 + br, 9.8, TANK);
        p.line(88, 198, 120, 202, 5); p.line(90, 210, 120, 213, 2); p.line(86, 194, 100, 191, 4); p.line(108, 196, 108, 214, 2);
      });
      part(1, (p) => limb(p, 116, 208, 130, 209, 10, 9.5, SHORTS));
      // near leg: thigh, shorts leg, knee, calf, shoe
      part(2, (p) => limb(p, 126, 208, 163, 190, 9, 7.5, SK));
      part(0, (p) => { limb(p, 124, 208, 152, 196, 11, 9.6, SHORTS); p.line(126, 200, 151, 188, 6); });
      part(2, (p) => { p.ball(163, 190, 8, 8, SK); limb(p, 163, 190, 175, 247, 7, 4.2, SK); p.ball(167, 207, 5, 9, SK); });
      part(0, (p) => { p.rect(169, 238, 9, 2, 7); shoe(p, 175, [3, 4, 5, 6], 7); });
      // neck, head (face looks up at the bar), hair, ear
      part(2, (p) => limb(p, 54, 208, 74, 205, 6, 6.5, [3, 4, 5, 6, 6]));
      {
        const C = 15, h = new B(32, 32);
        h.ball(C, C, 12, 12, face); h.ball(C + 7, C + 3, 7, 7, face);
        for (let y = -13; y <= 13; y++) for (let x = -13; x <= 13; x++) {
          if (x * x + y * y > 150) continue;
          if (x < -4 || (y < -8 && x < 1)) h.px(C + x, C + y, (x * 7 + y * 3) % 5 === 0 ? 3 : (x + y) % 4 === 0 ? 2 : 1);
        }
        h.ball(C - 3, C + 1, 2, 3, [3, 4, 5, 6]); h.px(C - 3, C + 1, 3);
        h.ball(C + 5, C - 11, 2, 2, face); h.px(C + 5, C - 10, face[1]);
        if (strain > 0.7) { // squint, furrowed brow, gritted teeth, sweat bead
          h.rect(C + 1, C - 9, 5, 1, 0); h.rect(C + 4, C - 8, 2, 1, 0); h.rect(C + 2, C - 5, 3, 1, 0);
          h.rect(C + 9, C - 6, 3, 4, 7); h.rect(C + 9, C - 4, 3, 1, 0); h.px(C + 8, C - 6, 0); h.px(C + 9, C - 2, 0);
          h.px(C - 1, C - 9, 7); h.px(C - 2, C - 5, 7);
        } else {
          h.rect(C + 1, C - 8, 4, 1, 1); h.rect(C + 2, C - 5, 2, 2, 0); h.px(C + 2, C - 5, 7);
          h.rect(C + 9, C - 5, 3, 1, face[1]); h.px(C + 10, C - 4, face[1]);
        }
        f.blit(h.outline(1), 42 - C - 1, 206 - C - 1);
      }
      // arm: two-bone IK shoulder -> elbow -> hand, shaded biceps
      const AL = 25, dx = hand.x - sh.x, dy = hand.y - sh.y, d = Math.min(AL * 2 - 1, Math.hypot(dx, dy));
      const a = Math.acos(d / (2 * AL)), phi = Math.atan2(dy, dx);
      const el = { x: sh.x + AL * Math.cos(phi + a), y: sh.y + AL * Math.sin(phi + a) };
      part(2, (p) => {
        p.ball(sh.x, sh.y, 7, 7, SK);
        limb(p, sh.x, sh.y, el.x, el.y, 5, 4.2, SK);
        const mx = (sh.x + el.x) / 2, my = (sh.y + el.y) / 2, nl = Math.hypot(el.x - sh.x, el.y - sh.y);
        const nx = -(el.y - sh.y) / nl, ny = (el.x - sh.x) / nl, sg = ny < 0 ? 1 : -1;
        p.ball(mx + nx * sg * 2.5, my + ny * sg * 2.5, 5 + (grind ? 1 : 0), 4, SK);
        limb(p, el.x, el.y, hand.x, hand.y, 4.3, 3.5, SK);
        p.ball(el.x, el.y, 4, 4, SK);
      });
      part(2, (p) => {
        p.ball(hand.x, hand.y, 5, 5, SK);
        for (let i = -1; i <= 1; i++) p.px(hand.x + i * 2, hand.y + 1, 2);
        p.rect(hand.x - 1, hand.y - 6, 3, 1, 7);
      });
      b.blit(f.outline(0), -1 + (grind ? jit : 0), -1);

      // effort cues: sweat flying off, strain lines
      if (t > 2.7 && t < S.PR + 1)
        S.sweat.slice(0, grind ? 9 : 4).forEach((s) => {
          const k = (t * 1.5 + s.ph) % 1, x = 36 + s.ox + s.vx * k * 0.9, y = 194 + s.vy * k * 0.9 + 70 * k * k;
          b.px(x, y, 7); b.px(x, y + 1, 7); b.px(x - 1, y + 1, 6); b.px(x + 1, y + 1, 6);
        });
      if (grind) for (let i = 0; i < 4; i++) {
        const ang = 3.5 + i * 0.28 + (frame % 2) * 0.1, r0 = 18, r1 = 22 + (frame % 2) * 3;
        b.line(42 + Math.cos(ang) * r0, 204 + Math.sin(ang) * r0, 42 + Math.cos(ang) * r1, 204 + Math.sin(ang) * r1, 7);
      }

      // HUD + celebration
      const done = S.reps.filter(([s, d]) => t >= s + d).length, pr = t >= S.PR;
      PX.hud(b, pr ? 'PERSONAL' : 'REPS', pr ? 'BEST' : `${done}/5`, pr);
      if (pr) {
        const k = t - S.PR;
        if (k < 0.45) for (let i = 0; i < 14; i++) {
          const ang = i / 14 * 6.283 + 0.2, r0 = 22 + k * 150;
          b.line(hx + Math.cos(ang) * r0, hy + Math.sin(ang) * r0, hx + Math.cos(ang) * (r0 + 16 * (1 - k * 2)), hy + Math.sin(ang) * (r0 + 16 * (1 - k * 2)), i % 2 ? 7 : 11);
        }
        for (const c of S.confetti) {
          const y = -8 + c.v * k * 1.4, x = c.x + Math.sin(k * 5 + c.ph) * 6;
          if (y < 300) b.blitRot(S.cf[c.c], x, y, c.ph + k * c.sp, 3, 1.5);
        }
        if (k < 0.25) { fx.flash = 0.5 - k * 2; fx.shakeY = frame % 2 ? 2 : -2; }
      }
      // title: typewriter, with a custom 5-wide W (the built-in font's W is an M)
      const tb = new B(190, 44), n = Math.floor((t - S.T_TITLE) / 0.07) + 1;
      let tx = 4;
      [...'NEW PR!'].slice(0, Math.max(0, n)).forEach((ch) => {
        if (ch === 'W') ['#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'].forEach((row, j) => [...row].forEach((q, i) => q === '#' && tb.rect(tx + i * 6, 4 + j * 6, 6, 6, 7)));
        else tb.text(ch, tx, 4, 7, { scale: 6 });
        tx += ch === 'W' ? 36 : ch === '!' ? 18 : 24;
      });
      b.blit(tb.outline(3).outline(0), 36, 94);
      PX.fadeOut(b, t, 7);
      return fx;
    },
  });
})();
