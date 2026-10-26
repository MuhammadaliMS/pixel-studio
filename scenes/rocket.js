/* Scene: countdown, ignition, liftoff. Black and white with a red accent. 256 x 320.
 * Palette slots: 0-7 black to white, 8-11 accent (dark red to pale red).
 */
PX.scene({
  name: 'Liftoff',
  w: 256,
  h: 320,
  fps: 12,
  duration: 7,
  palette: 'mono',

  setup() {
    const r = PX.rng(5);
    const GROUND = 270, CX = 134, NOZ = 248, TX = 60;
    const counts = [0.5, 1.4, 2.3];          // 3, 2, 1
    const IGNITE = 2.5, LIFT = 3.3, TITLE = ['TO THE', 'MOON'], T_TITLE = 5.0;
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const tex = (b, x, y, w, h, base, lo, hi, pl, ph) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = r(); b.px(x + i, y + j, v < pl ? lo : v > 1 - ph ? hi : base); }
    };

    // ---------- static backdrop ----------
    const bg = new PX.Buf(256, 320);
    for (let y = 0; y < GROUND; y++) {
      bg.rect(0, y, 256, 1, 0);
      bg.dither(0, y, 256, 1, 1, PX.clamp((y - 30) / 240) ** 1.1);
      bg.dither(0, y, 256, 1, 2, PX.clamp((y - 140) / 130) ** 1.4 * 0.9);
      bg.dither(0, y, 256, 1, 3, PX.clamp((y - 236) / 34) * 0.5);
    }
    // crescent moon: ball() shaded, bitten by a second disc, with craters and earthshine
    const MX = 208, MY = 54, mb = new PX.Buf(64, 64);
    bg.ditherCircle(MX, MY, 42, 2, 0.16); bg.ditherCircle(MX, MY, 32, 3, 0.2);
    mb.ball(32, 32, 22, 22, [1, 2, 3, 4, 5, 6, 7], { lx: -0.85, ly: -0.25, gain: 1.15 });
    for (const [dx, dy, cr] of [[-12, -5, 4], [-15, 8, 3], [-6, 13, 5], [-9, -14, 2]])
      for (let y = -cr - 1; y <= cr + 1; y++) for (let x = -cr - 1; x <= cr + 1; x++) {
        const d = x * x + y * y, X = 32 + dx + x, Y = 32 + dy + y, c = mb.get(X, Y);
        if (c === 255) continue;
        if (d <= cr * cr) mb.px(X, Y, Math.max(1, c - 1));
        else if (d <= (cr + 1) ** 2 && x + y < 0) mb.px(X, Y, Math.min(7, c + 1));
      }
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      if (mb.get(x, y) === 255) continue;
      if ((x - 42) ** 2 + (y - 26) ** 2 < 19 * 19) mb.d[y * 64 + x] = ((x + y) & 3) === 0 ? 2 : 255; // earthshine in the bite
    }
    bg.blit(mb, MX - 32, MY - 32);
    // hills and a distant skyline silhouette
    const hill = (col, base, amp, f1, f2, ph) => {
      for (let x = 0; x < 256; x++) {
        const h = Math.round(base + amp * Math.sin(x * f1 + ph) + amp * 0.5 * Math.sin(x * f2 + ph * 2));
        bg.rect(x, GROUND - h, 1, h, col);
      }
    };
    hill(1, 24, 9, 0.022, 0.07, 1); hill(0, 12, 6, 0.035, 0.11, 3);
    for (let x = 172; x < 252;) {
      const w = 6 + Math.floor(r() * 7), h = 14 + Math.floor(r() * 22);
      bg.rect(x, GROUND - h, w, h, 0);
      for (let wy = GROUND - h + 3; wy < GROUND - 3; wy += 4) for (let wx = x + 1; wx < x + w - 1; wx += 3) if (r() < 0.14) bg.px(wx, wy, 4);
      if (r() < 0.4) bg.rect(x + (w >> 1), GROUND - h - 4, 1, 4, 0);
      x += w + 1;
    }
    // ground: dark concrete with speckle and a darkening gradient
    tex(bg, 0, GROUND, 256, 50, 2, 1, 3, 0.16, 0.1);
    for (let y = GROUND + 2; y < 320; y++) bg.dither(0, y, 256, 1, 1, ((y - GROUND) / 50) * 0.7);
    bg.rect(0, GROUND, 256, 1, 4);
    for (let i = 0; i < 40; i++) { const x = Math.floor(r() * 256), y = GROUND + 6 + Math.floor(r() * 40); bg.line(x, y, x + 2 + Math.floor(r() * 5), y + (r() < 0.5 ? 0 : 1), 1); }
    // launch tower: lattice truss, X bracing, platform, crown, mast
    const TOP = 120, BOT = 268;
    bg.rect(TX + 4, TOP, 14, BOT - TOP, 0); bg.dither(TX + 4, TOP, 14, BOT - TOP, 1, 0.55);
    for (let y = TOP; y < BOT - 10; y += 14) {
      bg.line(TX + 4, y + 2, TX + 17, y + 14, 3); bg.line(TX + 17, y + 2, TX + 4, y + 14, 3);
      bg.line(TX + 4, y + 3, TX + 17, y + 15, 2); bg.line(TX + 17, y + 3, TX + 4, y + 15, 2);
      bg.rect(TX + 4, y, 14, 2, 4); bg.rect(TX + 4, y + 2, 14, 1, 2);
    }
    bg.cyl(TX, TOP, 4, BOT - TOP, [2, 3, 4, 5, 6]); bg.cyl(TX + 18, TOP, 4, BOT - TOP, [1, 2, 3, 4, 5]);
    bg.rect(TX - 6, 198, 34, 4, 4); bg.rect(TX - 6, 198, 34, 1, 6); bg.rect(TX - 6, 202, 34, 1, 1);
    for (let x = TX - 6; x < TX + 28; x += 6) bg.rect(x, 190, 1, 8, 3);
    bg.rect(TX - 6, 190, 34, 1, 4);
    bg.rect(TX - 2, TOP - 4, 26, 4, 5); bg.rect(TX - 2, TOP - 4, 26, 1, 7); bg.rect(TX + 10, TOP - 16, 2, 12, 4);
    bg.rect(TX - 4, BOT - 2, 30, 4, 3); bg.rect(TX - 4, BOT - 2, 30, 1, 5);
    // launch pad slab: textured concrete, deck, flame trench, hold-down mount
    tex(bg, CX - 58, 267, 116, 12, 3, 2, 4, 0.2, 0.15);
    for (let x = CX - 58 + 28; x < CX + 58; x += 29) bg.rect(x, 267, 1, 12, 2);
    bg.rect(CX - 58, 278, 116, 1, 1);
    tex(bg, CX - 58, 262, 116, 5, 5, 4, 6, 0.2, 0.2); bg.rect(CX - 58, 262, 116, 1, 7);
    bg.ellipse(CX, 264, 18, 2, 0); bg.rect(CX - 17, 267, 34, 12, 0);
    for (let x = CX - 15; x < CX + 16; x += 4) bg.rect(x, 267, 1, 12, 1);
    bg.rect(CX - 24, 252, 6, 10, 3); bg.rect(CX + 18, 252, 6, 10, 2); bg.rect(CX - 24, 252, 1, 10, 5);
    bg.rect(CX - 26, 249, 52, 4, 4); bg.rect(CX - 26, 249, 52, 1, 7); bg.rect(CX - 26, 252, 52, 1, 1);
    for (let x = CX - 24; x < CX + 24; x += 6) bg.px(x, 250, 2);

    // ---------- stars ----------
    const stars = [];
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(r() * 256), y = Math.floor(r() * 215), p = r();
      if ((x - MX) ** 2 + (y - MY) ** 2 < 34 * 34) continue;
      stars.push({ x, y, p, k: p < 0.72 ? 0 : p < 0.94 ? 1 : 2 });
    }

    // ---------- rocket: 40x90, ogive nose, panels, rivets, porthole, red fins, bell ----------
    const rk = new PX.Buf(40, 90), C = 20, RAMP = [3, 4, 5, 6, 7], ACC = [8, 9, 10, 11];
    const hwAt = (y) => (y < 3 ? 0 : y < 30 ? Math.round(11 * (1 - Math.pow(1 - (y - 3) / 27, 1.7))) : 11);
    const shade = (u, y, x, ramp, add = 0.12) => PX.Buf.shadeAt(ramp, Math.sqrt(Math.max(0, 1 - u * u)) * 0.72 - (u - 0.3) * 0.35 + add, x, y);
    const fin = (pts, left) => {
      const m = new PX.Buf(40, 90); m.poly(pts, 1);
      for (let y = 0; y < 90; y++) for (let x = 0; x < 40; x++) {
        if (m.get(x, y) === 255) continue;
        const edge = m.get(x + (left ? -1 : 1), y) === 255;
        rk.px(x, y, edge ? (left ? 11 : 8) : PX.Buf.shadeAt(ACC, (left ? 0.62 : 0.28) - (y - 54) / 110 + (r() < 0.12 ? 0.06 : 0), x, y));
      }
    };
    fin([[9, 54], [1, 72], [1, 85], [9, 78]], true); fin([[31, 54], [39, 72], [39, 85], [31, 78]], false);
    rk.line(9, 66, 2, 80, 8); rk.line(31, 66, 38, 80, 8);
    for (let y = 2; y < 78; y++) {
      const hw = hwAt(y);
      for (let x = C - hw; x < C + hw; x++) {
        const u = (x + 0.5 - C) / hw, red = y < 10 || (y >= 32 && y < 36);
        rk.px(x, y, shade(u, y, x, red ? ACC : RAMP));
      }
    }
    for (const sy of [30, 56, 70]) for (let x = C - 11; x < C + 11; x++) { rk.px(x, sy, 2); rk.px(x, sy + 1, x < C ? 6 : 4); }
    rk.rect(C - 11, 31, 22, 1, 1); rk.rect(C - 11, 36, 22, 1, 1);
    for (let y = 56; y < 70; y++) { rk.px(C + 4, y, 3); rk.px(C + 5, y, 6); }
    for (let x = C - 9; x <= C + 9; x += 3) { rk.px(x, 58, x < C ? 7 : 5); rk.px(x, 72, x < C ? 7 : 5); rk.px(x, 28 + (Math.abs(x - C) > 6 ? 3 : 0), 0); }
    rk.ball(C, 45, 7, 7, [1, 2, 3, 4, 5, 6]); rk.circle(C, 45, 5, 1);
    rk.ball(C, 45, 5, 5, [0, 1, 2, 3, 4], { lx: -0.6, ly: -0.7, gain: 1.1 });
    rk.px(C - 3, 42, 7); rk.px(C - 2, 41, 7); rk.px(C - 1, 41, 6); rk.px(C - 3, 43, 6); rk.px(C + 2, 48, 3);
    for (const [dx, dy] of [[0, -7], [7, 0], [0, 7], [-7, 0]]) rk.px(C + dx, 45 + dy, 7);
    for (let y = 77; y < 87; y++) {
      const hw = 6 + Math.round((y - 77) * 0.35);
      for (let x = C - hw; x < C + hw; x++) rk.px(x, y, y === 86 ? 1 : shade((x + 0.5 - C) / hw, y, x, [0, 1, 2, 3, 4], 0.05));
    }
    rk.rect(C - 7, 77, 14, 1, 4); rk.rect(C - 8, 83, 16, 1, 1);
    const rocket = rk.outline(0);              // 42 x 92, nozzle exit at y=87, centre x=21

    // ---------- smoke puff sprites: clusters of ball()-shaded lumps, lit top-left ----------
    const SZ = [5, 8, 11, 15, 19, 24, 30];
    const mkPuff = (R, seed) => {
      const q = PX.rng(seed), s = new PX.Buf(R * 3 + 6, R * 2 + 8), n = 5, bl = [];
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1);
        bl.push([(f - 0.5) * R * 1.3 + (q() - 0.5) * R * 0.3, (q() - 0.5) * R * 0.3 - Math.sin(f * Math.PI) * R * 0.28, R * (0.42 + 0.26 * q())]);
      }
      bl.sort((a, b) => b[1] - a[1]);
      for (const [x, y, rad] of bl) s.ball(s.w / 2 + x, s.h / 2 + y, Math.max(2, Math.round(rad)), Math.max(2, Math.round(rad * 0.88)), [1, 2, 3, 4, 5, 6], { gain: 1.25 });
      return s;
    };
    const puffSpr = [0, 1, 2].map((v) => SZ.map((R, i) => mkPuff(R, 100 + v * 31 + i)));
    const riseAt = (t) => { const k = Math.max(0, t - LIFT); return 20 * k + 110 * k * k; };
    const puffs = [];
    for (let s = IGNITE; s < LIFT + 1.8; s += s < LIFT + 0.3 ? 0.05 : 0.04) {
      const ground = s < LIFT + 0.3;
      puffs.push({ t: s, ground, dir: r() < 0.5 ? -1 : 1, sp: 50 + r() * 80, v: Math.floor(r() * 3), jx: (r() - 0.5) * 36,
        lift: 4 + r() * 22, sz: ground ? 3 + Math.floor(r() * 4) : 2 + Math.floor(r() * 3), ny: NOZ - riseAt(s) });
    }

    const events = counts.map((c) => ({ t: c, sfx: 'tick' }));
    events.push({ t: IGNITE, sfx: 'rumble' }, { t: LIFT, sfx: 'boom' }, { t: LIFT, sfx: 'flip' }, ...PX.titleEvents(TITLE, T_TITLE));
    return { GROUND, CX, NOZ, TX, counts, IGNITE, LIFT, TITLE, T_TITLE, stars, puffs, puffSpr, rocket, bg, BAYER, riseAt, events };
  },

  draw(b, t, S) {
    const { CX, NOZ, TX, LIFT, IGNITE, GROUND } = S;
    const frame = Math.round(t * 12), fx = {};
    const tau = Math.max(0, t - LIFT), rise = S.riseAt(t);
    const rr = PX.rng(frame * 131 + 7);
    const nozY = NOZ - rise;
    b.d.set(S.bg.d);

    // twinkling stars: three sizes
    for (const s of S.stars) {
      const hi = (frame + Math.floor(s.p * 9)) % 9 < 2;
      if (s.k === 0) b.px(s.x, s.y, hi ? 5 : s.y > 150 ? 3 : 4);
      else if (s.k === 1) b.rect(s.x, s.y, 2, 2, hi ? 7 : 5);
      else { b.px(s.x, s.y, 7); const c = hi ? 6 : 4; b.px(s.x - 1, s.y, c); b.px(s.x + 1, s.y, c); b.px(s.x, s.y - 1, c); b.px(s.x, s.y + 1, c); if (hi) { b.px(s.x - 2, s.y, 3); b.px(s.x + 2, s.y, 3); } }
    }

    // blend a sprite with an ordered-dither mask (fading smoke)
    const put = (spr, cx, cy, amt) => {
      const x0 = Math.round(cx - spr.w / 2), y0 = Math.round(cy - spr.h / 2), k = amt * 16;
      for (let j = 0; j < spr.h; j++) for (let i = 0; i < spr.w; i++) {
        const c = spr.d[j * spr.w + i];
        if (c !== 255 && S.BAYER[((y0 + j) & 3) * 4 + ((x0 + i) & 3)] < k) b.px(x0 + i, y0 + j, c);
      }
    };
    const glowE = (cx, cy, rx, ry, c, amt) => {
      for (let dy = -ry; dy <= ry; dy++) b.dither(cx - Math.round(rx * Math.sqrt(1 - (dy / ry) ** 2)), cy + dy, 2 * Math.round(rx * Math.sqrt(1 - (dy / ry) ** 2)), 1, c, amt);
    };
    const smoke = (ground) => {
      for (const p of S.puffs) {
        if (p.ground !== ground) continue;
        const age = t - p.t, LIFE = ground ? 3.2 : 2.6;
        if (age < 0 || age > LIFE) continue;
        const e = PX.ease.out(Math.min(1, age / 1.4)), k = age / LIFE;
        const si = Math.round(p.sz * (0.2 + 0.8 * e));
        const x = ground ? CX + p.jx + p.dir * p.sp * e : CX + p.jx * 0.3 + p.dir * p.sp * e * 0.3;
        const y = ground ? GROUND - 4 - e * p.lift - age * 3 : p.ny + 4 - e * 4;
        put(S.puffSpr[p.v][si], x, y, k < 0.45 ? 1 : 1 - (k - 0.45) / 0.55);
      }
    };

    // swing arm (retracts upward before ignition) + blinking red light on the tower
    const armA = PX.clamp((t - IGNITE + 0.6) / 0.5) * 1.1, px = TX + 24, py = 190, L = 38;
    const ca = Math.cos(armA), sa = Math.sin(armA);
    const ex = px + L * ca, ey = py - L * sa;
    const nx = 4 * sa, ny = 4 * ca;            // half-thickness of the arm, perpendicular to it
    b.line(px - nx, py - ny, ex - nx, ey - ny, 5); b.line(px + nx, py + ny, ex + nx, ey + ny, 3);
    for (let i = 0; i < 6; i++) {
      const f0 = i / 6, f1 = (i + 1) / 6, d = i % 2 ? -1 : 1;
      b.line(px + L * ca * f0 + d * nx, py - L * sa * f0 + d * ny, px + L * ca * f1 - d * nx, py - L * sa * f1 - d * ny, 4);
    }
    b.line(ex - 3 * ca - 3 * sa, ey + 3 * sa - 3 * ca, ex - 3 * ca + 3 * sa, ey + 3 * sa + 3 * ca, 6);
    b.rect(Math.round(ex) - 2, Math.round(ey) - 6, 4, 12, armA < 0.01 ? 6 : 0);
    b.circle(px, py, 3, 7); b.px(px, py, 1);
    const lightOn = t < IGNITE ? frame % 6 < 3 : frame % 2 < 1;
    if (lightOn) b.ditherCircle(TX + 11, 106, 8, 9, 0.45);
    b.circle(TX + 11, 106, 2, lightOn ? 10 : 8); if (lightOn) b.px(TX + 10, 106 - 1, 11);

    // glow around the nozzle, trench heat, trail column
    if (t >= IGNITE) {
      const g = PX.clamp((t - IGNITE) / 0.5);
      b.ditherCircle(CX, nozY + 6, 34, 3, 0.2 * g); b.ditherCircle(CX, nozY + 8, 22, 4, 0.28 * g); b.ditherCircle(CX, nozY + 10, 12, 5, 0.35 * g);
      glowE(CX, 276, 52, 8, 4, 0.3 * g); glowE(CX, 276, 34, 5, 5, 0.35 * g);
    }
    smoke(false); smoke(true);

    // flame: seeded flicker, layered red edge / grey / white core, shock diamonds after liftoff
    if (t >= IGNITE) {
      const len = tau > 0 ? Math.min(120, 64 + tau * 50) + (frame % 2) * 6 : 14 + 22 * PX.clamp((t - IGNITE) / 0.8) + (frame % 2) * 4;
      for (let j = 0; j < len; j++) {
        const y = nozY + j;
        if (y >= 282) break;
        const s = j / len, w0 = 9.5 * Math.pow(1 - s, 0.5) * (1 + 0.28 * Math.sin(Math.PI * Math.min(1, s * 2.5))) * (1 + 0.1 * Math.sin(j * 0.5 + frame * 1.7));
        const jit = rr() < 0.3 ? 1 : 0, hw = Math.max(1, Math.round(w0) - jit);
        b.rect(CX - hw, y, hw * 2, 1, j < len * 0.55 ? 10 : 9);
        if (hw > 2) b.rect(CX - hw + 2, y, hw * 2 - 4, 1, 5);
        if (hw > 2 && s < 0.75) b.rect(CX - Math.round(hw * 0.42), y, Math.round(hw * 0.42) * 2, 1, tau > 0 ? 6 : 7);
      }
      if (tau > 0) for (let k = 0; k < 3; k++) { const jj = 12 + 17 * k + (frame % 2) * 2; if (jj < len * 0.85 && nozY + jj < 282) b.ellipse(CX, nozY + jj, 5 - k, 3, 7); }
      for (let i = 0; i < 5; i++) b.px(CX + Math.round((rr() - 0.5) * 22), nozY + 8 + Math.floor(rr() * (len + 6)), rr() < 0.5 ? 6 : 10);
    }
    const shake = t >= IGNITE && t < LIFT + 0.4 ? (frame % 2 ? 1 : -1) : 0;
    b.blit(S.rocket, CX - 21 + shake, nozY - 87);

    // HUD + title
    const n = S.counts.filter((c) => t >= c).length;
    PX.hud(b, t >= LIFT ? 'LIFTOFF' : 'T-MINUS', t >= LIFT ? 'GO!' : n ? String(4 - n) : '-', t >= LIFT);
    PX.title(b, S.TITLE, t, S.T_TITLE, { x: 100, y: 100, c: 7, shadow: 0 });

    if (t >= IGNITE && t < LIFT + 0.6) {
      const q = PX.rng(frame * 7);
      fx.shakeX = Math.round((q() - 0.5) * (t >= LIFT ? 6 : 3));
      fx.shakeY = Math.round((q() - 0.5) * (t >= LIFT ? 6 : 2));
    }
    if (t >= LIFT && t < LIFT + 0.2) fx.flash = 0.45 - (t - LIFT) * 2;
    PX.fadeOut(b, t, 7);
    return fx;
  },
});
