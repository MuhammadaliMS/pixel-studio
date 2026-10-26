/* Scene: a mushroom hops through the forest to open a parcel. Warm fantasy. 256x320.
 * Palette slots: 0 night, 1 deep bark, 2 bark, 3 earth, 4 cap shadow, 5 cap, 6 glow, 7 cream, 8-11 fern/moss.
 */
PX.scene({
  name: 'Mushroom Post',
  w: 256,
  h: 320,
  fps: 12,
  duration: 7,
  palette: 'ember',

  setup() {
    const B = PX.Buf, r = PX.rng(11);
    const W = 256, H = 320, HORIZON = 250, GROUND = 274;
    const hops = [0.4, 1.0, 1.6, 2.2], HOP = 0.45;
    const xs = [26, 52, 78, 104, 130];
    const OPEN = 3.2, JOY = 3.9, TITLE = ['SPORE', 'POST'], T_TITLE = 4.5;
    const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
    const tweak = (bf, x, y, d) => { const c = bf.get(x, y); if (c !== PX.T) bf.px(x, y, Math.max(0, Math.min(7, c + d))); };

    // ---------- helpers that paint into a Buf ----------
    function fern(bf, x, y, ang, len, droop) {
      let px = x, py = y;
      for (let i = 0; i <= len; i++) {
        const t = i / len, h = ang + droop * t * t;
        px += Math.cos(h); py += Math.sin(h);
        bf.px(px, py, 9);
        if (i % 2 === 0 && i > 2) {
          const L = (1 - t) * len * 0.3 + 2;
          for (const s of [-1, 1]) {
            const hh = h + s * 1.05, ex = px + Math.cos(hh) * L, ey = py + Math.sin(hh) * L;
            bf.line(px, py, ex, ey, ey > py ? 8 : 9);
            bf.px(ex, ey, t < 0.75 ? 10 : 9);
          }
        }
      }
      bf.px(px, py, 11);
    }
    function fernCluster(bf, x, y, n, len) {
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (k / (n - 1) - 0.5) * 2.3;
        fern(bf, x, y, a, len * (0.75 + 0.25 * Math.cos(a + Math.PI / 2)), (a + Math.PI / 2) * 1.3);
      }
    }
    function moss(bf, cx, cy, rx, ry) {
      for (let y = -ry; y <= ry; y++)
        for (let x = -rx; x <= rx; x++) {
          if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1 || r() > 0.8) continue;
          bf.px(cx + x, cy + y, y < -ry * 0.3 && r() < 0.5 ? 10 : r() < 0.6 ? 9 : 8);
        }
    }
    function trunk(bf, x, w, bot, ramp, streaks) {
      bf.cyl(x, 0, w, bot, ramp);
      for (let k = 0; k < streaks; k++) {
        const px = x + ri(1, w - 2), py = ri(0, bot), len = ri(3, 11), d = r() < 0.7 ? -1 : 1;
        for (let j = 0; j < len; j++) tweak(bf, px, py + j, d);
      }
    }
    function bgShroom(bf, x, y, s, spot) {
      bf.cyl(x - Math.round(2 * s), y - 6 * s, 4 * s, 6 * s, [2, 3, 4, 5]);
      bf.ball(x, y - 6 * s, 5 * s, 3 * s + 1, [1, 2, 3, 4]);
      bf.rect(x - 5 * s, y - 6 * s + 2, 10 * s + 1, 3, 0);
      bf.rect(x - 2 * s, y - 6 * s + 2, 4 * s, 3, 3);
      for (const [dx, dy] of [[-2, -2], [2, -1]]) bf.rect(x + dx * s, y - 6 * s + dy * s, s + 1, s, spot);
    }

    // ---------- static backdrop ----------
    const bg = new B(W, H).clear(0);
    for (let y = 0; y < HORIZON; y += 4) bg.dither(0, y, W, 4, 1, 0.1 + 0.45 * (y / HORIZON));
    [[10, 16], [48, 12], [100, 18], [152, 14], [198, 16], [238, 14]].forEach(([x, w]) => trunk(bg, x, w, HORIZON, [0, 1, 1, 2], 14));
    for (let y = 110; y < HORIZON; y += 3) bg.dither(0, y, W, 3, 2, 0.5 * (y - 110) / (HORIZON - 110)); // fog
    [[-6, 34], [86, 22], [226, 36]].forEach(([x, w]) => {
      trunk(bg, x, w, HORIZON + 6, [1, 1, 2, 3], w * 3);
      for (let i = 0; i < 4; i++) bg.rect(x - 6 + i, HORIZON + 6 - i * 2, 6, 2, 2); // root flares
      bg.poly([[x - 7, HORIZON + 8], [x + 2, HORIZON - 14], [x + 6, HORIZON + 8]], 2);
      bg.poly([[x + w + 7, HORIZON + 8], [x + w - 2, HORIZON - 14], [x + w - 6, HORIZON + 8]], 1);
    });
    for (let y = 150; y < HORIZON; y += 3) bg.dither(0, y, W, 3, 2, 0.28 * (y - 150) / 100); // fog over the mid trunks
    [[40, 12], [120, 14], [190, 10]].forEach(([x0, w]) => {                                     // light shafts
      for (let y = 0; y < HORIZON; y++) bg.dither(x0 + y * 0.4, y, w + y * 0.1, 1, 3, 0.03 + 0.15 * (1 - y / HORIZON));
    });
    // ground
    for (let y = HORIZON; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = (y - HORIZON) / (H - HORIZON);
        let c = r() < 0.62 - 0.5 * t ? 3 : 2;
        if (r() < 0.025) c = 4;
        else if (r() < 0.025 * t) c = 1;
        bg.px(x, y, c);
      }
    bg.rect(0, HORIZON, W, 1, 4);
    bg.dither(0, HORIZON + 1, W, 3, 4, 0.4);
    bg.dither(0, HORIZON - 3, W, 3, 3, 0.4);
    for (let i = 0; i < 40; i++) { const x = ri(0, W), y = ri(HORIZON + 6, H - 4), l = ri(2, 4); bg.rect(x, y, l, 1, 4); }
    for (let i = 0; i < 14; i++) {
      const x = ri(4, W - 4), y = ri(HORIZON + 14, H - 12), s = ri(2, 4);
      bg.ball(x, y, s + 1, s - 1, [1, 2, 3, 4]); bg.rect(x - s, y + s, s * 2 + 1, 1, 1);
    }
    [[20, HORIZON + 8, 14, 4], [96, HORIZON + 6, 12, 3], [244, HORIZON + 8, 12, 4], [70, 304, 18, 5], [176, 310, 16, 4]].forEach((m) => moss(bg, ...m));
    // small background mushrooms + mid ferns
    bgShroom(bg, 20, HORIZON + 10, 1, 5); bgShroom(bg, 28, HORIZON + 12, 1, 5);
    bgShroom(bg, 108, HORIZON + 6, 1, 5); bgShroom(bg, 236, HORIZON + 8, 2, 5); bgShroom(bg, 224, HORIZON + 10, 1, 5);
    fernCluster(bg, 62, HORIZON + 4, 5, 20); fernCluster(bg, 234, HORIZON + 6, 5, 22); fernCluster(bg, 150, HORIZON + 2, 4, 14);
    for (let x = 0; x < W; x += 2) if (r() < 0.55) { const h = ri(3, 7); bg.rect(x, HORIZON - h + 1, 1, h, r() < 0.4 ? 10 : 9); }
    // stump with rings and bark sides
    const SX = 164, ST = GROUND - 30;
    bg.dither(SX - 6, GROUND - 1, 60, 3, 0, 0.6); bg.dither(SX + 2, GROUND + 2, 44, 2, 0, 0.35);
    bg.cyl(SX, ST, 48, 30, [1, 2, 3, 4]);
    for (let k = 0; k < 90; k++) { const px = SX + ri(1, 46), py = ST + ri(4, 28), len = ri(3, 9), d = r() < 0.7 ? -1 : 1; for (let j = 0; j < len; j++) tweak(bg, px, py + j, d); }
    bg.poly([[SX - 8, GROUND + 3], [SX + 2, GROUND - 14], [SX + 7, GROUND + 3]], 2);
    bg.poly([[SX + 56, GROUND + 3], [SX + 46, GROUND - 14], [SX + 41, GROUND + 3]], 1);
    bg.ellipse(SX + 24, ST, 24, 6, 3);
    [[22, 5], [18, 4], [14, 5], [10, 4], [6, 5], [3, 6]].forEach(([k, c]) => bg.ellipse(SX + 24, ST, k, Math.max(1, Math.round(k * 0.25)), c));
    bg.dither(SX + 8, ST - 3, 20, 3, 6, 0.3);
    moss(bg, SX + 4, GROUND - 3, 8, 3);

    // foreground fern frame + blades (drawn over everything except the HUD)
    const fg = new B(W, H);
    fernCluster(fg, 10, H + 2, 7, 52); fernCluster(fg, 40, H + 2, 5, 32);
    fernCluster(fg, 248, H + 2, 7, 54); fernCluster(fg, 218, H + 2, 5, 30);
    for (let x = 0; x < W; x += 3) if (r() < 0.6) { const h = ri(6, 16); fg.rect(x, H - h, 1, h, 8); fg.px(x, H - h, 9); }

    // ---------- the parcel (body + lid, each outlined) ----------
    const body = new B(34, 30);
    body.rect(2, 10, 24, 14, 5); body.dither(2, 10, 24, 14, 4, 0.3); body.rect(2, 22, 24, 2, 4); body.rect(2, 10, 24, 1, 6);
    body.poly([[26, 10], [31, 4], [31, 18], [26, 24]], 4); body.dither(26, 8, 6, 14, 3, 0.35);
    body.poly([[2, 10], [7, 4], [31, 4], [26, 10]], 1);
    body.rect(12, 10, 4, 14, 7); body.rect(15, 10, 1, 14, 6);
    const lid = new B(38, 24);
    lid.rect(0, 14, 28, 6, 6); lid.dither(0, 14, 28, 6, 5, 0.2); lid.rect(0, 19, 28, 1, 5);
    lid.poly([[28, 14], [33, 8], [33, 14], [28, 20]], 5);
    lid.poly([[0, 14], [5, 8], [33, 8], [28, 14]], 7); lid.dither(5, 8, 28, 6, 6, 0.35);
    lid.rect(12, 14, 4, 6, 7); lid.poly([[12, 14], [17, 8], [21, 8], [16, 14]], 6); lid.rect(12, 14, 1, 5, 6);
    lid.ball(11, 6, 5, 3, [5, 6, 7]); lid.ball(25, 6, 5, 3, [5, 6, 7]); lid.rect(15, 4, 6, 5, 7); lid.rect(15, 8, 6, 1, 5); lid.px(11, 5, 7);
    const bodyO = body.outline(0), lidO = lid.outline(0);
    const BX = 172, BY = ST + 2 - 24; // body top-left in screen space (local y 24 sits on the stump)

    const flies = Array.from({ length: 18 }, () => ({ x: r() * W, y: r() * HORIZON, sp: 10 + r() * 16, ph: r() * 6.3, p: r() }));
    const sparks = Array.from({ length: 22 }, () => ({ a: -Math.PI * (0.1 + 0.8 * r()), s: 60 + r() * 110, c: r() < 0.5 ? 6 : 7, big: r() < 0.35 }));

    // ---------- the mushroom, drawn pose by pose into its own buffer ----------
    function shroom(sq, blink, happy, arms) {
      const bw = 84, bh = 88, cx = 42, base = bh - 8;
      const g = new B(bw, bh);
      const sh = Math.round(24 * sq), sw = 2 * Math.round(11 / Math.sqrt(sq)), rx = Math.round(28 / Math.sqrt(sq)), ry = Math.round(21 * sq);
      const stemTop = base - 3 - sh, cutY = stemTop + 4, capCy = cutY - Math.round(ry * 0.3);
      g.ball(cx - 7, base - 3, 5, 3, [2, 3, 4, 5]); g.ball(cx + 7, base - 3, 5, 3, [2, 3, 4, 5]); // feet
      g.cyl(cx - sw / 2, stemTop, sw, sh, [4, 5, 6, 7], 0.2);
      g.rect(cx - sw / 2, base - 4, sw, 1, 4);
      // cap: sphere-lit dome, flat underside, cream spots
      const cap = new B(bw, bh);
      cap.ball(cx, capCy, rx, ry, [2, 3, 4, 5, 6], { gain: 1.0 });
      for (let y = cutY + 1; y < bh; y++) for (let x = 0; x < bw; x++) cap.d[y * bw + x] = PX.T;
      [[-0.52, -0.5, 5], [0.12, -0.78, 4], [0.58, -0.38, 5], [-0.12, -0.22, 3], [0.9, -0.08, 2], [-0.88, -0.1, 2]].forEach(([nx, ny, s]) => {
        const sx = Math.round(cx + nx * rx), sy = Math.round(capCy + ny * ry), sry = Math.max(1, Math.round(s * 0.72));
        cap.ellipse(sx + 1, sy + 1, s, sry, 6); cap.ellipse(sx, sy, s, sry, 7); cap.px(sx - s + 1, sy - 1, 7);
      });
      g.blit(cap, 0, 0);
      g.rect(cx - Math.round(rx * 0.9), cutY + 1, Math.round(rx * 1.8) + 1, 1, 2);
      g.rect(cx - Math.round(rx * 0.75), cutY + 2, Math.round(rx * 1.5) + 1, 1, 3);
      g.dither(cx - Math.round(rx * 0.75), cutY + 3, Math.round(rx * 1.5), 1, 3, 0.4);
      // arms
      const ay = stemTop + 17 - Math.round(arms * 11), ax = sw / 2 + 2 + Math.round(arms * 2);
      g.ball(cx - ax, ay, 3, 2, [4, 5, 6]); g.ball(cx + ax, ay, 3, 2, [3, 4, 5]);
      // face on the stem
      const ey = stemTop + 9, ex = [cx - 6, cx + 3];
      ex.forEach((x) => {
        if (happy) { g.px(x, ey + 2, 0); g.px(x + 1, ey + 1, 0); g.px(x + 2, ey + 2, 0); g.px(x + 1, ey, 0); }
        else if (blink) g.rect(x, ey + 2, 3, 1, 0);
        else { g.rect(x, ey, 3, 4, 0); g.px(x, ey, 7); g.px(x + 1, ey + 3, 2); }
      });
      g.ellipse(cx - 9, ey + 6, 2, 1, 4); g.ellipse(cx + 9, ey + 6, 2, 1, 4);
      g.dither(cx - 11, ey + 5, 5, 3, 5, 0.5); g.dither(cx + 7, ey + 5, 5, 3, 5, 0.5);
      if (happy) { g.rect(cx - 2, ey + 6, 5, 1, 1); g.rect(cx - 1, ey + 7, 3, 1, 1); g.px(cx, ey + 7, 4); }
      else { g.px(cx - 2, ey + 6, 1); g.rect(cx - 1, ey + 7, 3, 1, 1); g.px(cx + 2, ey + 6, 1); }
      return { buf: g.outline(0), cx, base };
    }
    const poses = {};
    const pose = (sq, blink, happy, arms) => {
      const k = [Math.round(sq * 50), blink ? 1 : 0, happy ? 1 : 0, Math.round(arms * 4)].join();
      return poses[k] || (poses[k] = shroom(Math.round(sq * 50) / 50, blink, happy, Math.round(arms * 4) / 4));
    };

    const events = hops.map((h) => ({ t: h + HOP, sfx: 'tick' }));
    events.push({ t: OPEN, sfx: 'flip' }, { t: OPEN + 0.05, sfx: 'thud' }, { t: JOY + 0.5, sfx: 'tick' });
    events.push(...PX.titleEvents(TITLE, T_TITLE));
    return { GROUND, hops, HOP, xs, OPEN, JOY, TITLE, T_TITLE, flies, sparks, bg, fg, bodyO, lidO, BX, BY, ST, pose, events };
  },

  draw(b, t, S) {
    const { GROUND } = S;
    const frame = Math.round(t * 12);
    b.d.set(S.bg.d);

    // --- parcel on the stump: glow, body, lid ---
    const bx = S.BX, by = S.BY + 10, cxp = bx + 14;
    if (t >= S.OPEN) {
      const u = t - S.OPEN, pulse = 0.35 + 0.15 * Math.sin(t * 9);
      b.ditherCircle(cxp, by - 4, 30, 5, pulse * 0.6);
      b.ditherCircle(cxp, by - 4, 18, 6, pulse);
      for (let dy = 0; dy < 90; dy++)
        for (const [k, a] of [[1, 0.1], [0.65, 0.16], [0.35, 0.22]]) {
          const w = (14 + dy / 3) * k;
          b.dither(cxp - w / 2, by - 6 - dy, w, 1, 6, a * (1 - dy / 90) * Math.min(1, u * 4));
        }
    }
    b.blit(S.bodyO, bx - 1, S.BY - 1);
    if (t >= S.OPEN) {
      b.poly([[bx + 2, by], [bx + 7, by - 6], [bx + 31, by - 6], [bx + 26, by]], 6);
      b.dither(bx + 2, by - 6, 29, 6, 7, 0.55);
    }
    if (t < S.OPEN) {
      const wobble = t > S.OPEN - 0.5 && frame % 2 ? -2 : 0;
      b.blit(S.lidO, bx - 3, by - 20 + wobble);
    } else {
      const u = t - S.OPEN;
      b.blitRot(S.lidO, bx + 14 + 44 * u, by - 10 - 120 * u + 220 * u * u, 5 * u);
      if (u < 1.4)
        for (const s of S.sparks) {
          const d = s.s * u, x = bx + 14 + Math.cos(s.a) * d, y = by - 8 + Math.sin(s.a) * d + 60 * u * u;
          const rr = s.big ? (frame % 2 ? 3 : 2) : 1;
          b.px(x, y, 7);
          for (let i = 1; i <= rr; i++) { b.px(x - i, y, s.c); b.px(x + i, y, s.c); b.px(x, y - i, s.c); b.px(x, y + i, s.c); }
        }
    }

    // --- the mushroom: hop, squash and stretch ---
    let x = S.xs[0], lift = 0, sq = 1 + 0.04 * Math.sin(t * 6), arms = 0;
    S.hops.forEach((h, i) => {
      if (t >= h + S.HOP) x = S.xs[i + 1];
      else if (t >= h) {
        const u = (t - h) / S.HOP;
        x = S.xs[i] + (S.xs[i + 1] - S.xs[i]) * u;
        lift = Math.sin(Math.PI * u) * 28;
        sq = u < 0.2 ? 1.18 : 1.08;
        arms = 0.5;
      }
      if (t >= h + S.HOP && t < h + S.HOP + 0.15) sq = 0.74;
    });
    if (t >= S.JOY && t < S.JOY + 0.5) { lift = Math.sin(Math.PI * ((t - S.JOY) / 0.5)) * 44; sq = 1.2; arms = 1; }
    if (t >= S.JOY + 0.5 && t < S.JOY + 0.65) { sq = 0.7; arms = 0.5; }
    if (t > S.JOY + 0.65) arms = 0.25;
    // dithered soft shadow, shrinking with height
    const srx = Math.round(24 * (1 - lift / 90)), sry = 5;
    for (const [k, a] of [[1, 0.45], [0.7, 0.8]])
      for (let j = -sry; j <= sry; j++) {
        const w = Math.round(srx * k * Math.sqrt(Math.max(0, 1 - (j * j) / (sry * sry + 1))));
        if (Math.abs(j) <= sry * k) b.dither(Math.round(x) - w, GROUND + 1 + j, w * 2 + 1, 1, 0, a);
      }
    const p = S.pose(sq, frame % 26 === 0, t > S.OPEN, arms);
    b.blit(p.buf, Math.round(x) - p.cx - 1, Math.round(GROUND - lift) - p.base - 1);

    // fireflies: drift upward, blink, dithered glow
    for (const f of S.flies) {
      const y = ((f.y - t * f.sp) % 255 + 255) % 255;
      const fx = f.x + Math.sin(t * 2 + f.ph) * 8;
      if ((frame + Math.floor(f.p * 12)) % 7 < 5) {
        b.ditherCircle(fx, y, 3, 5, 0.35); b.ditherCircle(fx, y, 2, 6, 0.55);
        b.px(fx, y, 7); if (f.p > 0.5) b.px(fx + 1, y, 6);
      }
    }
    b.blit(S.fg, 0, 0);

    // --- HUD + title ---
    const hopsDone = S.hops.filter((h) => t >= h + S.HOP).length;
    PX.hud(b, t >= S.OPEN ? 'DELIVERED' : 'HOPS', t >= S.OPEN ? 'YAY!' : `${hopsDone}/4`, t >= S.OPEN);
    PX.title(b, S.TITLE, t, S.T_TITLE, { y: 90 });

    PX.fadeOut(b, t, 7);
    return { flash: t >= S.OPEN && t < S.OPEN + 0.1 ? 0.3 : 0 };
  },
});
