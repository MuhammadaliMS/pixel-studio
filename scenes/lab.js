/* Scene: a little robot cracks a safe under a desk lamp. 256x320, 'teal' (accent = lime gold/lamp/eye).
 * Slots: 0 void .. 7 white, 8-11 accent (dark -> bright).
 */
(function () {
  const B = PX.Buf, TAU = Math.PI * 2, clamp = PX.clamp;
  const noise = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
  // bevelled plate: light top-left, dark bottom-right, speckled with a neighbouring shade
  function plate(b, x, y, w, h, base, hi, lo, sp = 0.08, alt = base - 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) b.px(x + i, y + j, noise(x + i, y + j) < sp ? alt : base);
    b.rect(x, y, w, 1, hi); b.rect(x, y, 1, h, hi); b.rect(x, y + h - 1, w, 1, lo); b.rect(x + w - 1, y, 1, h, lo);
  }
  const rivet = (b, x, y) => { b.rect(x, y, 2, 2, 3); b.px(x, y, 6); b.px(x + 1, y + 1, 1); };
  // a chain of discs along a line: limbs, rods
  function rod(b, x0, y0, x1, y1, r, c, hi) {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) b.circle(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), r, c);
    if (hi !== undefined) for (let i = 0; i <= n; i++) b.px(Math.round(x0 + ((x1 - x0) * i) / n) - 1, Math.round(y0 + ((y1 - y0) * i) / n) - 1, hi);
  }
  function shadow(b, cx, cy, rx, ry, amt) {
    for (let j = -ry; j <= ry; j++) {
      const w = Math.round(rx * Math.sqrt(1 - (j / (ry + 0.5)) ** 2));
      b.dither(cx - w, cy + j, w * 2, 1, 0, amt * (1 - Math.abs(j) / (ry + 1)));
    }
  }
  function gold(b, x, y, w, h) {
    b.rect(x, y + 3, w, h - 3, 10);
    for (let j = 0; j < 3; j++) b.rect(x + 2 - j, y + j, w - 4 + 2 * j, 1, 11);
    b.dither(x, y + 4, w, h - 5, 9, 0.3);
    b.rect(x, y + h - 2, w, 1, 9); b.rect(x, y + h - 1, w, 1, 8); b.rect(x + w - 1, y + 3, 1, h - 3, 9);
    b.rect(x + 1, y + 4, 1, h - 7, 11); b.px(x + (w >> 1) - 1, y + 1, 7); b.rect(x + 5, y + 5, w - 10, 1, 9);
  }
  // the safe door as its own sprite (56x52) so it can be squashed when it swings
  function doorFace(ang) {
    const d = new B(56, 52), cx = 24, cy = 26;
    plate(d, 0, 0, 56, 52, 4, 6, 2, 0.1, 3);
    d.frame(3, 3, 50, 46, 2); d.frame(4, 4, 48, 44, 3);
    for (const [x, y] of [[6, 6], [48, 6], [6, 44], [48, 44]]) rivet(d, x, y);
    d.ball(cx, cy, 17, 17, [1, 2, 3, 4, 5]); d.ball(cx, cy, 14, 14, [2, 3, 4, 5, 6]);
    for (let k = 0; k < 20; k++) {
      const a = ang + (k * TAU) / 20, big = k % 5 === 0;
      for (let r = big ? 7 : 10; r <= 13; r += 0.5) d.px(cx + Math.cos(a) * r, cy + Math.sin(a) * r, big ? 0 : 1);
      if (big) d.px(cx + Math.cos(a) * 5.5, cy + Math.sin(a) * 5.5, 9);
    }
    d.ball(cx, cy, 5, 5, [2, 3, 4, 5, 6]);
    d.ball(Math.round(cx + Math.cos(ang) * 11), Math.round(cy + Math.sin(ang) * 11), 3, 3, [4, 5, 6, 7, 7]);
    d.poly([[20, 2], [29, 2], [24.5, 9]], 10); d.px(22, 3, 11);
    d.cyl(46, 12, 5, 28, [2, 3, 4, 5, 6, 7]); d.ball(48, 12, 4, 3, [2, 3, 4, 5, 6]); d.ball(48, 40, 4, 3, [2, 3, 4, 5]); d.rect(44, 24, 9, 4, 2);
    return d;
  }

  PX.scene({
    name: 'Safe Cracker',
    w: 256,
    h: 320,
    fps: 12,
    duration: 7,
    palette: 'teal',

    setup() {
      const r = PX.rng(21), G = 256;
      const code = [4, 7, 2];
      const spins = [[0.6, 1.6], [1.8, 2.8], [3.0, 3.9]];
      const OPEN = 4.2, TITLE = ['CRACKED!'], T_TITLE = 4.9;
      const sx = 176, sy = 188, sw = 68, sh = 64; // safe body; door inset 6px
      const dust = Array.from({ length: 26 }, () => ({ u: r(), v: r() - 0.5, sp: 0.06 + r() * 0.12, ph: r() * 9 }));
      const coins = Array.from({ length: 22 }, () => ({ a: -Math.PI * (0.1 + 0.8 * r()), s: 50 + r() * 80, c: [10, 11, 7][Math.floor(r() * 3)], ph: r() * 6 }));
      const events = spins.map(([, e]) => ({ t: e, sfx: 'tick' }));
      events.push({ t: OPEN, sfx: 'flip' }, { t: OPEN + 0.1, sfx: 'boom' }, ...PX.titleEvents(TITLE, T_TITLE));

      // ---- static background ----
      const bg = new B(256, 320).clear(0);
      const colsX = [0, 64, 128, 192], rowsY = [[0, 48], [48, 80], [128, 80], [208, 48]];
      for (const x of colsX) for (const [y, h] of rowsY) {
        plate(bg, x + 1, y + 1, 62, h - 2, 1, 3, 0, 0.09, 2);
        bg.dither(x + 2, y + 2, 60, h - 4, 2, 0.08);
        for (const [rx, ry] of [[x + 5, y + 5], [x + 56, y + 5], [x + 5, y + h - 8], [x + 56, y + h - 8]]) rivet(bg, rx, ry);
      }
      plate(bg, 150, 22, 56, 22, 1, 3, 0); // vent
      for (let i = 0; i < 4; i++) { bg.rect(156, 27 + i * 4, 44, 2, 0); bg.rect(156, 29 + i * 4, 44, 1, 2); }
      // pipe with a highlight, collars and brackets
      const prof = [0.08, 0.2, 0.45, 0.8, 1, 0.85, 0.6, 0.45, 0.32, 0.2, 0.12, 0.04];
      for (let j = 0; j < 12; j++) for (let x = 0; x < 256; x++) bg.px(x, 112 + j, B.shadeAt([0, 1, 2, 3, 4, 5, 6], prof[j] * 0.95 + (noise(x, j) - 0.5) * 0.08, x, 112 + j));
      for (let i = 0; i < 9; i++) bg.rect(8 + i * 29 + Math.floor(noise(i, 3) * 12), 115, 8 + Math.floor(noise(i, 9) * 14), 1, 7);
      for (const x of [96, 176]) { plate(bg, x, 109, 8, 18, 3, 5, 1); rivet(bg, x + 3, 112); rivet(bg, x + 3, 120); }
      for (const x of [34, 134, 226]) { plate(bg, x, 104, 14, 28, 3, 5, 1, 0.1, 2); rivet(bg, x + 6, 107); rivet(bg, x + 6, 124); }
      // wall monitor, socket and a sagging cable
      plate(bg, 180, 134, 58, 40, 3, 5, 1); bg.rect(184, 138, 50, 32, 0); bg.frame(183, 137, 52, 34, 1); plate(bg, 205, 174, 8, 6, 2, 4, 0);
      plate(bg, 106, 138, 10, 16, 3, 5, 1); bg.rect(109, 142, 4, 3, 0); bg.rect(109, 147, 4, 3, 0);
      for (let i = 0; i < 24; i++) {
        const u0 = i / 24, u1 = (i + 1) / 24, f = (u) => [116 + 64 * u, 146 + 14 * u + 16 * 4 * u * (1 - u)];
        const [a, b2] = [f(u0), f(u1)];
        bg.line(a[0], a[1] + 1, b2[0], b2[1] + 1, 0); bg.line(a[0], a[1], b2[0], b2[1], 1); bg.line(a[0], a[1] - 1, b2[0], b2[1] - 1, 3);
      }
      // baseboard + textured floor
      plate(bg, 0, G - 8, 256, 8, 2, 4, 0, 0.12, 3);
      for (let y = G; y < 320; y++) for (let x = 0; x < 256; x++) { const n = noise(x * 1.3, y); bg.px(x, y, n < 0.08 ? 1 : n > 0.93 ? 3 : 2); }
      [[G + 18, 22], [G + 40, 26], [G + 66, 0]].forEach(([y, h], k) => {
        bg.rect(0, y, 256, 1, 0); bg.rect(0, y + 1, 256, 1, 3);
        for (let x = (k * 53) % 90; x < 256 && h; x += 90) { bg.rect(x, y - h + 2, 1, h - 2, 0); bg.rect(x + 1, y - h + 2, 1, h - 2, 3); }
      });
      bg.rect(0, G, 256, 1, 4); bg.dither(0, G + 4, 256, 64, 1, 0.3); bg.dither(0, G + 36, 256, 28, 0, 0.3);
      // safe body: bevelled steel, double bevel, rivets, recess, feet
      plate(bg, sx + 4, 252, 12, 4, 2, 4, 0); plate(bg, sx + sw - 16, 252, 12, 4, 2, 4, 0);
      shadow(bg, sx + 34, G + 5, 42, 4, 0.55); shadow(bg, 46, G + 7, 26, 4, 0.5);
      plate(bg, sx, sy, sw, sh, 3, 6, 1, 0.12, 4);
      bg.rect(sx + 1, sy + 1, sw - 2, 1, 5); bg.rect(sx + 1, sy + 1, 1, sh - 2, 5); bg.rect(sx + 1, sy + sh - 2, sw - 2, 1, 2); bg.rect(sx + sw - 2, sy + 1, 1, sh - 2, 2);
      for (const [x, y] of [[2, 2], [sw - 4, 2], [2, sh - 4], [sw - 4, sh - 4]]) rivet(bg, sx + x, sy + y);
      bg.rect(sx + 5, sy + 5, 58, 54, 0); bg.frame(sx + 5, sy + 5, 58, 54, 1);
      return { G, code, spins, OPEN, TITLE, T_TITLE, dust, coins, events, bg, sx, sy, sw, sh };
    },

    draw(b, t, S) {
      const { G, sx, sy } = S, frame = Math.round(t * 12), fx = {};
      const dx = sx + 30, dy = sy + 32; // dial centre (world)
      const opened = t >= S.OPEN, ko = t - S.OPEN;
      const ang = dialAngle(t);
      b.blit(S.bg, 0, 0);

      // wall monitor: scrolling "code", turns gold when cracked
      for (let row = 0; row < 6; row++) {
        const y = 141 + row * 5, line = row + Math.floor(t * 3);
        for (let x = 187, k = 0; x < 228; k++) {
          const w = 3 + Math.floor(noise(line, k) * 12), c = opened ? 10 : k === 0 ? 9 : 5;
          b.rect(x, y, Math.min(w, 229 - x), 2, noise(line, k + 7) < 0.8 ? c : 3);
          x += w + 3;
        }
      }
      b.dither(184, 138, 50, 32, 1, 0.14);
      b.rect(222, 170, 2, 2, frame % 6 < 3 ? 10 : 8); b.rect(226, 170, 2, 2, 5); b.rect(230, 170, 2, 2, frame % 8 < 4 ? 6 : 3);

      // desk lamp: base, spring arm, joints (head comes after the beam)
      const J1 = [60, G - 82], J2 = [86, G - 104], L0 = [46, G - 4];
      b.ball(46, G + 3, 22, 5, [0, 1, 2, 3, 4]); b.ball(46, G, 16, 4, [1, 2, 3, 4, 5]);
      for (let i = 0; i < 20; i++) {
        const u = i / 20, u2 = (i + 1) / 20, nx = 0.17, ny = 0.99, ex = (x, u0, s) => x + (J1[0] - L0[0]) * u0 + nx * s;
        const ya = (u0, s) => L0[1] + (J1[1] - L0[1]) * u0 + s * 0.17 * 0;
        b.line(ex(L0[0], u, -3), ya(u, 0), ex(L0[0], u2, 3), ya(u2, 0), 4);
        b.line(ex(L0[0], u2, -3), ya(u2, 0), ex(L0[0], u, 3), ya(u, 0), 3);
      }
      rod(b, L0[0] - 3, L0[1], J1[0] - 3, J1[1], 0, 5); rod(b, L0[0] + 3, L0[1], J1[0] + 3, J1[1], 0, 2);
      rod(b, J1[0], J1[1], J2[0], J2[1], 1, 3, 5);
      b.ball(L0[0], L0[1], 4, 4, [1, 2, 3, 4, 5]); b.ball(J1[0], J1[1], 4, 4, [1, 2, 3, 5, 6]);

      // ---- safe: interior, glow, door ----
      const ix = sx + 6, iy = sy + 6, base = iy + 46;
      if (opened) {
        const gl = clamp(ko / 0.3), pulse = 0.04 * Math.sin(t * 9);
        for (let k = 0; k < 6; k++) b.ditherCircle(sx + 34, sy + 32, 62 - k * 7, k < 3 ? 8 : 9, (0.07 + pulse * 0.4) * gl);
        for (let j = -6; j <= 6; j++) b.dither(sx - 8 + Math.abs(j) * 3, G + 5 + j, 84 - Math.abs(j) * 6, 1, 9, 0.35 * gl * (1 - Math.abs(j) / 7));
        for (let y = 0; y < 52; y++) for (let x = 0; x < 56; x++) b.px(ix + x, iy + y, noise(ix + x, iy + y) < 0.15 ? 1 : 0);
        b.dither(ix, iy, 56, 10, 0, 0.7);
        b.ditherCircle(ix + 28, iy + 36, 30, 8, 0.45); b.ditherCircle(ix + 28, iy + 36, 21, 9, 0.4); b.ditherCircle(ix + 28, iy + 38, 12, 10, 0.3);
        b.rect(ix, base, 56, 6, 2); b.rect(ix, base, 56, 1, 4); b.dither(ix, base + 1, 56, 5, 1, 0.4);
        for (const [gx, gy] of [[2, 9], [20, 9], [38, 9], [11, 18], [29, 18], [20, 27]]) gold(b, ix + gx, base - gy - 9 + (gy === 9 ? 0 : 0), 17, 9);
        b.ellipse(ix + 8, base + 2, 5, 2, 10); b.ellipse(ix + 47, base + 2, 5, 2, 9); b.px(ix + 6, base + 1, 11); b.px(ix + 45, base + 1, 11);
        [[12, 28], [30, 15], [45, 30], [21, 38], [38, 20]].forEach(([x, y], i) => {
          const ph = (frame + i * 3) % 8, rr = ph < 4 ? [0, 1, 3, 2][ph] : -1;
          if (rr < 0) return;
          b.px(ix + x, iy + y, 7);
          if (rr) { b.rect(ix + x - rr, iy + y, rr, 1, 11); b.rect(ix + x + 1, iy + y, rr, 1, 11); b.rect(ix + x, iy + y - rr, 1, rr, 11); b.rect(ix + x, iy + y + 1, 1, rr, 11); }
        });
      }
      const th = opened ? PX.ease.out(clamp(ko / 0.5)) * 1.4 : 0, sn = Math.sin(th), cs = Math.cos(th);
      const door = doorFace(ang), dw = Math.max(1, Math.round(56 * cs));
      if (!opened) b.blit(door, ix, iy);
      else {
        let hh = 52;
        for (let i = 0; i < dw; i++) {
          const sc = 1 + 0.16 * (i / dw) * sn; hh = Math.round(52 * sc);
          for (let j = 0; j < hh; j++) b.px(ix + i, iy - (hh - 52) / 2 + j, door.get(Math.floor((i / dw) * 56), Math.min(51, Math.floor(j / sc))));
        }
        const e = Math.round(7 * sn), y0 = Math.round(iy - (hh - 52) / 2);
        if (e > 0) { b.rect(ix + dw, y0, e, hh, 3); b.rect(ix + dw, y0, 1, hh, 6); b.rect(ix + dw, y0, e, 1, 7); b.rect(ix + dw + e - 1, y0, 1, hh, 1); b.rect(ix + dw, y0 + hh - 1, e, 1, 1); }
      }
      b.cyl(sx + 2, sy + 14, 7, 12, [1, 2, 3, 4, 5, 6]); b.cyl(sx + 2, sy + 40, 7, 12, [1, 2, 3, 4, 5, 6]);
      b.rect(sx + 2, sy + 14, 7, 1, 7); b.rect(sx + 2, sy + 40, 7, 1, 7);
      if (!opened) b.ditherCircle(dx + 2, dy, 26, 5, 0.07);

      // ---- lamp head, beam, dust ----
      const ha = Math.atan2(dy - J2[1], dx - J2[0]) + 0.04, dr = [Math.cos(ha), Math.sin(ha)], pr = [-dr[1], dr[0]];
      const M = [J2[0] + dr[0] * 34, J2[1] + dr[1] * 34], fl = frame % 9 === 0 ? 0.6 : 1;
      for (let x = Math.round(M[0]); x < dx + 8; x++) {
        const u = (x - M[0]) / (dx - M[0]), yc = M[1] + (dy - M[1]) * u, hw = 14 + 16 * u, a = 1 - 0.25 * u;
        b.dither(x, yc - hw, 1, hw * 2, 4, 0.3 * fl * a); b.dither(x, yc - hw * 0.6, 1, hw * 1.2, 5, 0.28 * fl * a); b.dither(x, yc - hw * 0.3, 1, hw * 0.6, 6, 0.22 * fl * a);
      }
      S.dust.forEach((d, i) => {
        const u = (d.u + t * d.sp) % 1, x = M[0] + (dx - M[0]) * u, y = M[1] + (dy - M[1]) * u + d.v * (30 + 26 * u) + 3 * Math.sin(t * 1.5 + d.ph);
        if ((frame + i) % 5) { b.px(x, y, i % 3 ? 6 : 7); if (i % 4 === 0) b.px(x + 1, y, 5); }
      });
      b.ditherCircle(M[0], M[1], 16, 10, 0.25 * fl); b.ditherCircle(M[0], M[1], 10, 11, 0.35 * fl);
      for (let Y = Math.floor(J2[1]) - 45; Y < J2[1] + 45; Y++) for (let X = Math.floor(J2[0]) - 45; X < J2[0] + 45; X++) {
        const rx = X + 0.5 - J2[0], ry = Y + 0.5 - J2[1], s = rx * dr[0] + ry * dr[1], q = rx * pr[0] + ry * pr[1], hw = 5 + 11 * (s / 34);
        if (s < 0 || s > 34 || Math.abs(q) > hw) continue;
        b.px(X, Y, s > 31 ? 11 : B.shadeAt([8, 9, 10, 11], 0.5 - 0.55 * (q / hw) + (s / 34 - 0.5) * 0.15, X, Y));
      }
      b.ball(Math.round(M[0] - dr[0] * 2), Math.round(M[1] - dr[1] * 2), 5, 5, [10, 11, 11, 7, 7], { gain: 1.4 });
      b.ball(J2[0], J2[1], 4, 4, [1, 2, 3, 5, 6]);

      // ---- the robot, drawn alone then outlined ----
      const turning = S.spins.some(([a, e]) => t >= a && t < e);
      const lift = opened && ko < 0.8 ? Math.abs(Math.sin((ko / 0.4) * Math.PI)) * 22 : 0;
      const bob = turning ? 0 : (Math.floor(t * 2) % 2) * 2, FEET = G + 8, cx = 142, cy = Math.round(FEET - 40 - bob - lift);
      const ox = 60, oy = 70, R = new B(150, 125), RAMP = [3, 4, 5, 6, 7];
      shadow(b, cx, FEET - 1, Math.round(28 - lift * 0.5), 5, 0.75 - lift * 0.015);
      const tuck = lift > 2 ? 4 : 0;
      for (const sg of [-1, 1]) {
        const lx = ox + sg * 11;
        R.cyl(lx - 2, oy + 22, 5, 7, [2, 3, 4, 5, 6]); R.ball(lx, oy + 29 - (tuck >> 1), 3, 3, [1, 2, 3, 4, 5]);
        R.cyl(lx - 2, oy + 30 - (tuck >> 1), 5, 6 - (tuck >> 1), [1, 2, 3, 4, 5]); R.ball(lx + sg, oy + 38 - tuck, 6, 3, [1, 2, 3, 4, 5]);
      }
      // egg body, sphere-lit with a soft rim and a gloss streak
      for (let y = -26; y <= 26; y++) {
        const u = y / 26.5, hw = 22 * Math.sqrt(Math.max(0, 1 - u * u)) * (1 + 0.12 * u), sq = Math.sqrt(Math.max(0, 1 - u * u));
        for (let x = Math.ceil(-hw); x <= hw; x++) {
          const nx = x / (hw + 0.5), nz = Math.sqrt(Math.max(0, 1 - nx * nx)) * sq, v = ((nx * sq) * -0.55 + u * -0.65 + nz * 0.55) * 0.72 + 0.3;
          let c = B.shadeAt(RAMP, v, ox + x, oy + y);
          if (nx > 0.86 && u > -0.5 && u < 0.7 && (x + y) & 1) c = 5;
          R.px(ox + x, oy + y, c);
        }
      }
      for (let a = 200; a <= 240; a += 4) { const rr = a * Math.PI / 180; R.px(ox + Math.cos(rr) * 19, oy - 3 + Math.sin(rr) * 21, a % 8 ? 7 : 6); }
      // belly panel with blinking lights
      plate(R, ox - 10, oy + 8, 20, 14, 1, 0, 5, 0.1, 2);
      [frame % 4 < 2 ? 11 : 9, frame % 6 < 3 ? 6 : 3, (frame + 1) % 4 < 2 ? 10 : 8].forEach((c, i) => R.rect(ox - 7 + i * 5, oy + 11, 4, 3, c));
      for (let i = 0; i < 3; i++) R.rect(ox - 7, oy + 16 + i * 2, 14, 1, 3);
      // glass eye: recessed housing, dark lens, accent iris, specular, blink
      const ex = ox + 5, ey = oy - 8, look = turning ? 3 : 1, blink = [0.6, 1, 0.6][frame % 28] ?? 0;
      R.ball(ex, ey, 12, 12, [1, 2, 3, 4], { lx: 0.55, ly: 0.65 }); R.circle(ex, ey, 9, 0); R.ditherCircle(ex, ey, 9, 1, 0.35);
      R.ball(ex + look, ey + 1, 5, 5, [8, 9, 10, 11]); R.circle(ex + look, ey + 1, 1, 0);
      R.rect(ex - 5, ey - 6, 3, 1, 7); R.px(ex - 6, ey - 5, 7); R.px(ex + 4, ey + 5, 6);
      for (let a = 200; a <= 250; a += 8) R.px(ex + Math.cos((a * Math.PI) / 180) * 7.5, ey + Math.sin((a * Math.PI) / 180) * 7.5, 4);
      if (blink) for (let y = -9; y < -9 + blink * 18; y++) for (let x = -9; x <= 9; x++) if (x * x + y * y <= 81) R.px(ex + x, ey + y, y > -10 + blink * 18 - 2 ? 1 : 4);
      // antenna with a lagging bobble
      const ab = [ox - 3, oy - 27], sway = 5 * Math.sin(TAU * 0.8 * t - 1), tip = [ab[0] + sway, ab[1] - 17 + Math.abs(sway) * 0.2], ct = [ab[0] + sway * 0.1, ab[1] - 12];
      R.rect(ox - 6, oy - 28, 7, 3, 3); R.rect(ox - 6, oy - 28, 7, 1, 5);
      for (let i = 0; i <= 14; i++) {
        const u = i / 14, p = [(1 - u) ** 2 * ab[0] + 2 * u * (1 - u) * ct[0] + u * u * tip[0], (1 - u) ** 2 * ab[1] + 2 * u * (1 - u) * ct[1] + u * u * tip[1]];
        R.rect(p[0], p[1], 2, 2, 5); R.px(p[0], p[1], 7);
      }
      R.ball(Math.round(tip[0]), Math.round(tip[1]), 4, 4, [8, 9, 10, 11], { gain: 1.3 }); R.px(tip[0] - 1, tip[1] - 2, 7);
      // arms: two-bone IK, gripper on the dial knob while it turns
      const celeb = opened ? PX.ease.out(clamp(ko / 0.25)) : 0, reach = turning || (t > 0.35 && !opened) ? PX.ease.out(clamp((t - 0.35) / 0.3)) : 0;
      const mix = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
      const nub = [dx - cx + Math.cos(ang) * 11, dy - cy + Math.sin(ang) * 11];
      const arms = [
        { S: [19, 8], T: mix(mix([31, 26], nub, reach), [38, -34], celeb), L: [27, 27], sg: reach > 0.5 || celeb ? 1 : -1, open: celeb ? 0.9 : reach ? 0.32 : 0.7 },
        { S: [-19, 8], T: mix([-30 + Math.sin(t * 2.6) * 1.5, 18], [-34, -30], celeb), L: [22, 22], sg: celeb > 0.5 ? -1 : 1, open: celeb ? 0.9 : 0.6 },
      ];
      for (const A of arms) {
        const [L1, L2] = A.L, dxx = A.T[0] - A.S[0], dyy = A.T[1] - A.S[1];
        const d = Math.max(Math.abs(L1 - L2) + 1, Math.min(Math.hypot(dxx, dyy), L1 + L2 - 0.5)), bs = Math.atan2(dyy, dxx);
        const ea = bs + A.sg * Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
        const E = [A.S[0] + Math.cos(ea) * L1, A.S[1] + Math.sin(ea) * L1], H = [A.S[0] + Math.cos(bs) * d, A.S[1] + Math.sin(bs) * d], fa = Math.atan2(H[1] - E[1], H[0] - E[0]);
        rod(R, ox + A.S[0], oy + A.S[1], ox + E[0], oy + E[1], 2, 4, 6); rod(R, ox + E[0], oy + E[1], ox + H[0], oy + H[1], 2, 4, 6);
        for (const s of [-1, 1]) rod(R, ox + H[0], oy + H[1], ox + H[0] + Math.cos(fa + s * A.open) * 8, oy + H[1] + Math.sin(fa + s * A.open) * 8, 1, 4, 6);
        R.ball(ox + A.S[0], oy + A.S[1], 4, 4, [1, 2, 3, 4, 5]); R.ball(Math.round(ox + E[0]), Math.round(oy + E[1]), 3, 3, [1, 2, 3, 4, 5]); R.ball(Math.round(ox + H[0]), Math.round(oy + H[1]), 3, 3, [1, 2, 3, 4, 5]);
      }
      b.blit(R.outline(0), cx - ox - 1, cy - oy - 1);
      const glow = (frame % 6 < 3) ? 0.4 : 0.2;
      b.ditherCircle(cx - ox + tip[0], cy - oy + tip[1], 7, 9, glow);

      // coins burst out of the safe
      if (opened && ko < 1.5) S.coins.forEach((c) => {
        const x = sx + 34 + Math.cos(c.a) * c.s * ko, y = sy + 30 + Math.sin(c.a) * c.s * ko + 140 * ko * ko, rx = Math.round(Math.abs(Math.cos(ko * 14 + c.ph)) * 3);
        b.ellipse(Math.round(x), Math.round(y), rx, 3, c.c === 7 ? 11 : 10); b.px(x - rx, y - 1, c.c);
      });

      // ---- HUD + title + fx ----
      const found = S.spins.filter(([, e]) => t >= e).length;
      PX.hud(b, opened ? 'UNLOCKED' : 'CODE', S.code.map((d, i) => (i < found ? d : '?')).join('-'), opened);
      PX.title(b, S.TITLE, t, S.T_TITLE, { x: 16, y: 66 });
      if (opened && ko < 0.3) {
        const rr = PX.rng(frame);
        fx.flash = 0.4 * (1 - ko / 0.3); fx.shakeX = Math.round((rr() - 0.5) * 3);
        b.rowShift(Math.floor(rr() * 320), 6, 12);
      }
      PX.fadeOut(b, t, 7);
      return fx;

      function dialAngle(tt) {
        let a = -Math.PI / 2, prev = a;
        S.spins.forEach(([s, e], i) => {
          const target = -Math.PI / 2 + (S.code[i] / 10) * TAU + (i % 2 ? -2 : 2) * Math.PI;
          if (tt >= e) a = prev = target;
          else if (tt >= s) a = prev + (target - prev) * PX.ease.inOut((tt - s) / (e - s));
        });
        return a;
      }
    },
  });
})();
