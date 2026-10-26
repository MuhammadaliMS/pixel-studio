/* Scene: the Leaning Tower of Pisa tilts... and collapses.
 * Palette slots: 0 sky, 1 deep shadow, 2 shadow, 3 dark stone, 4 stone, 5 light stone, 6 highlight, 7 white,
 * 8-11 accent (moon, plumb line, bell).
 */
PX.scene({
  name: 'Tower of Pisa',
  w: 256,
  h: 320,
  fps: 12,
  duration: 7,
  palette: 'violet',

  setup() {
    const { Buf, rng } = PX;
    const W = 256, GROUND = 276, BASE_X = 84;
    const r = rng(7);
    const STONE = [2, 3, 4, 5, 6];

    // --- each storey is its own sprite: a shaded cylinder wrapped in arches ---
    function storey(w, h, kind) {
      const s = new Buf(w, h);
      const top = kind === 'belfry' ? 6 : 0;
      if (kind === 'belfry') for (let x = 1; x < w - 2; x += 6) { s.rect(x, 0, 4, 6, 5); s.rect(x, 0, 1, 6, 6); s.rect(x + 3, 0, 1, 6, 3); }
      s.cyl(2, top + 4, w - 4, h - top - 4, STONE, 0.1);
      // mortar courses, dithered one shade darker
      for (let y = top + 8; y < h; y += 5)
        for (let x = 2; x < w - 2; x++) if ((x + y) % 3 === 0) s.px(x, y, Math.max(2, s.get(x, y) - 1));
      // cornice: lit lip, shadowed underside, dentils
      s.rect(0, top, w, 2, 6);
      s.rect(0, top, Math.round(w * 0.3), 1, 7);
      s.rect(0, top + 2, w, 1, 4);
      s.rect(1, top + 3, w - 2, 1, 2);
      for (let x = 2; x < w - 2; x += 3) s.px(x, top + 3, 4);
      s.rect(2, h - 2, w - 4, 2, 3);
      s.rect(2, h - 2, Math.round(w * 0.3), 1, 4);

      // arches spaced around the cylinder: narrower near the edges (foreshortening)
      const n = kind === 'base' ? 6 : kind === 'belfry' ? 5 : 7;
      const y0 = top + 7, ah = h - y0 - 4;
      for (let k = 0; k < n; k++) {
        const th = -1.2 + (2.4 * (k + 0.5)) / n;
        const xc = w / 2 + (w / 2 - 5) * Math.sin(th), ow = Math.max(2, Math.round((kind === 'belfry' ? 6 : 5) * Math.cos(th)));
        const x0 = Math.round(xc - ow / 2);
        const inside = kind === 'base' ? 3 : 1;
        for (let x = 0; x < ow; x++) {
          const u = (x + 0.5) / ow * 2 - 1, cap = Math.round((1 - Math.sqrt(1 - u * u)) * (ow / 2));
          for (let y = y0 + cap; y < y0 + ah; y++) s.px(x0 + x, y, inside);
          s.px(x0 + x, y0 + cap - 1, 6); // lit archivolt
        }
        if (kind !== 'base') {
          s.rect(x0 + ow - 1, y0 + 2, 1, ah - 2, th > 0 ? 2 : 3); // inner jamb
          s.rect(x0, y0 + ah - 4, ow, 1, 4);                       // balustrade rail
          for (let x = 0; x < ow; x += 2) s.px(x0 + x, y0 + ah - 3, 3);
        }
        s.rect(x0 - 1, y0 + 1, 1, 1, 7); // column capital glint
        if (kind === 'belfry' && k === 2) { s.ball(x0 + ow / 2, y0 + 6, 2, 3, [8, 9, 10, 11]); s.px(x0 + ow / 2, y0 + 10, 9); }
      }
      if (kind === 'base') {
        const cx = Math.floor(w / 2);
        s.rect(cx - 5, h - 18, 10, 16, 6);
        s.rect(cx - 4, h - 17, 8, 15, 0);
        s.rect(cx - 3, h - 19, 6, 1, 6);
        s.rect(cx - 4, h - 16, 1, 14, 2);
      }
      return s.outline(1);
    }
    const storeys = [storey(64, 36, 'base')];
    for (let i = 0; i < 6; i++) storeys.push(storey(60, 22, 'arcade'));
    storeys.push(storey(44, 28, 'belfry'));

    // break a storey into two jagged halves (more debris, better collapse)
    function split(sp) {
      const L = new Buf(sp.w, sp.h), R = new Buf(sp.w, sp.h);
      for (let y = 0; y < sp.h; y++) {
        const cut = Math.round(sp.w / 2 + (r() - 0.5) * 6);
        for (let x = 0; x < sp.w; x++) (x < cut ? L : R).px(x, y, sp.get(x, y));
      }
      return [L, R];
    }

    // the stump left standing: a jagged copy of storey 1
    const stump = new Buf(storeys[1].w, storeys[1].h);
    stump.d.set(storeys[1].d);
    for (let x = 0; x < stump.w; x++) {
      const k = Math.floor(r() * 8) + (x > 36 ? 5 : 0);
      for (let y = 0; y < k; y++) stump.px(x, y, PX.T);
      if (k < stump.h) stump.px(x, k, 2);
    }

    // centre of storey i when the whole tower leans by angle a
    const offs = [];
    let cum = 0;
    for (const s of storeys) { offs.push(cum + s.h / 2 - 1); cum += s.h - 2; }
    const place = (i, a) => ({ x: BASE_X + offs[i] * Math.sin(a), y: GROUND + 1 - offs[i] * Math.cos(a) });

    // --- timeline ---
    const steps = [0.8, 1.3, 1.8, 2.3];            // counter ticks 5.41 .. 5.44
    const TC = 2.6;                                // collapse
    const lean = (t) => {
      let n = 0;
      for (const s of steps) if (t >= s) n++;
      return ((8 + n * 0.7) * Math.PI) / 180;      // exaggerated visual lean
    };
    const thetaC = lean(TC);

    // --- collapse: rigid hinge for a moment, then every half-storey becomes a falling body ---
    const hy0 = offs[1] + storeys[1].h / 2;
    const P = {
      x: BASE_X + 30 * Math.cos(thetaC) + hy0 * Math.sin(thetaC),
      y: GROUND + 1 + 30 * Math.sin(thetaC) - hy0 * Math.cos(thetaC),
    };
    const TA = 0.3, ALPHA = 6;
    const pieces = [];
    for (let i = 2; i < storeys.length; i++) {
      const [L, R] = split(storeys[i]);
      pieces.push({ sp: L, i, lx: 0 }, { sp: R, i, lx: 0 });
    }
    const placePiece = (p, a) => place(p.i, a); // halves share the storey centre; the sprite holds the offset
    const hinge = (p, tau) => {
      const d = 0.5 * ALPHA * tau * tau, c0 = placePiece(p, thetaC);
      const rx = c0.x - P.x, ry = c0.y - P.y, c = Math.cos(d), s = Math.sin(d);
      return { x: P.x + rx * c - ry * s, y: P.y + rx * s + ry * c, a: thetaC + d, rx: rx * c - ry * s, ry: rx * s + ry * c };
    };

    const DT = 1 / 240, N = Math.ceil(4.6 / DT), G = 600;
    const heap = new Float32Array(W);              // the stump the pieces can land on
    for (let x = BASE_X - 34; x <= BASE_X + 34; x++) heap[x] = storeys[0].h + 14;
    const omega = ALPHA * TA;
    const bodies = pieces.map((p, k) => {
      const h0 = hinge(p, TA), side = k % 2 ? 1 : -1;
      return {
        ...p, x: h0.x, y: h0.y, a: h0.a,
        vx: -omega * h0.ry * 0.55 + side * (10 + r() * 30), vy: omega * h0.rx * 0.55 - r() * 30,
        w: (r() - 0.3) * 4 + side, landed: false, sleep: false, target: 0,
        track: new Float32Array(N * 3),
      };
    });
    const stones = [], puffs = [{ x: P.x, y: P.y, t: TC, r: 20 }], events = [];
    const spawnStones = (x, y, t, n, up) => {
      for (let k = 0; k < n; k++)
        stones.push({ x, y, vx: (r() - 0.5) * 180, vy: -up * (0.4 + r()), t0: t, c: r() < 0.5 ? 4 : 5, s: 1 + Math.floor(r() * 3), track: [] });
    };
    spawnStones(P.x, P.y, TC, 22, 140);

    const t0 = TC + TA;
    for (let n = 0; n < N; n++) {
      const t = t0 + n * DT;
      for (const b of bodies) {
        const s = b.sp;
        if (!b.sleep) {
          const ca = Math.abs(Math.cos(b.a)), sa = Math.abs(Math.sin(b.a));
          const hx = (s.w / 2) * ca + (s.h / 2) * sa, hy = (s.w / 2) * sa + (s.h / 2) * ca;
          b.vy += G * DT;
          b.x += b.vx * DT; b.y += b.vy * DT;
          if (!b.landed) b.a += b.w * DT;
          if (b.x < hx + 2 || b.x > W - hx - 2) { b.vx *= -0.4; b.x = PX.clamp(b.x, hx + 2, W - hx - 2); }
          let top = 0;
          for (let x = Math.max(0, Math.floor(b.x - hx)); x <= Math.min(W - 1, Math.ceil(b.x + hx)); x++) top = Math.max(top, heap[x]);
          const floor = GROUND + 4 - top - (b.i % 3) * 4;
          if (b.y + hy >= floor) {
            b.y = floor - hy;
            if (!b.landed) {
              b.landed = true;
              b.target = Math.round(b.a / Math.PI) * Math.PI + (r() - 0.5) * 0.35;
              events.push({ t, sfx: events.some((e) => e.sfx === 'boom') ? 'thud' : 'boom' });
              puffs.push({ x: b.x, y: floor, t, r: 22 + r() * 12 });
              spawnStones(b.x, floor - 4, t, 6, 180);
            }
            b.vy = b.vy > 120 ? -b.vy * 0.15 : 0;
            b.vx *= 0.96;
          }
          if (b.landed) b.a += (b.target - b.a) * 0.06;
          if (b.landed && Math.abs(b.vx) < 4 && b.vy === 0 && Math.abs(b.target - b.a) < 0.01) b.sleep = true;
        }
        b.track.set([b.x, b.y, b.a], n * 3);
      }
      for (const st of stones) {
        if (t < st.t0) continue;
        st.vy += G * DT; st.x += st.vx * DT; st.y += st.vy * DT;
        if (st.y >= GROUND - st.s) { st.y = GROUND - st.s; st.vy = Math.abs(st.vy) > 80 ? -st.vy * 0.35 : 0; st.vx *= 0.8; }
        if (n % 4 === 0) st.track.push(st.x, st.y);
      }
    }
    const firstImpact = events.length ? Math.min(...events.map((e) => e.t)) : TC + 0.8;

    for (const s of steps) events.push({ t: s, sfx: 'tick' });
    events.push({ t: TC, sfx: 'flip' }, { t: TC, sfx: 'crack' }, { t: firstImpact + 0.05, sfx: 'rumble' });
    const TITLE = ['TOWER', 'OF', 'PISA'], T_TITLE = firstImpact + 0.55;
    events.push(...PX.titleEvents(TITLE, T_TITLE));

    // backdrop: stars, the cathedral and baptistery in silhouette, a lawn
    const sky = Array.from({ length: 60 }, () => ({ x: Math.floor(r() * W), y: Math.floor(r() * 200), p: r(), big: r() < 0.15 }));
    const city = new Buf(W, 80);
    city.rect(150, 40, 96, 40, 2);                 // cathedral nave
    city.poly([[146, 41], [198, 22], [250, 41]], 2);
    city.ellipse(198, 26, 14, 12, 2); city.rect(196, 8, 4, 8, 2);
    city.ellipse(16, 46, 24, 20, 2); city.rect(-8, 46, 48, 34, 2); city.rect(14, 22, 4, 6, 2); // baptistery
    for (let x = 156; x < 244; x += 8) city.rect(x, 52, 3, 6, 1);
    for (let x = 0; x < 34; x += 7) city.rect(x, 56, 2, 5, 1);
    const lawn = new Buf(W, 44);
    for (let y = 0; y < 44; y++) for (let x = 0; x < W; x++) lawn.px(x, y, PX.Buf.shadeAt([1, 2, 3], 0.9 - y / 50 + (r() - 0.5) * 0.25, x, y));
    lawn.rect(0, 0, W, 1, 4);
    for (let x = 0; x < W; x += 3) if (r() < 0.5) lawn.px(x, 1, 4);

    return { storeys, stump, place, lean, steps, TC, TA, t0, DT, N, bodies, hinge, stones, puffs, events, firstImpact, TITLE, T_TITLE, sky, city, lawn, GROUND, BASE_X, P };
  },

  draw(b, t, S) {
    const { GROUND, TC } = S;
    const frame = Math.round(t * 12);
    const fx = {};

    // sky: dithered bands toward the horizon, stars, a warm moon
    b.clear(0);
    for (let y = 90; y < GROUND; y++) {
      b.dither(0, y, 256, 1, 1, (y - 90) / 110);
      if (y > 200) b.dither(0, y, 256, 1, 2, ((y - 200) / 76) * 0.6);
    }
    for (const s of S.sky) {
      const on = (frame + Math.floor(s.p * 10)) % 10;
      b.px(s.x, s.y, on < 2 ? 6 : 3);
      if (s.big && on < 2) { b.px(s.x - 1, s.y, 4); b.px(s.x + 1, s.y, 4); b.px(s.x, s.y - 1, 4); b.px(s.x, s.y + 1, 4); }
    }
    b.ditherCircle(206, 70, 26, 2, 0.4);
    b.ball(206, 70, 16, 16, [8, 9, 10, 11]);
    b.circle(201, 66, 2, 10); b.circle(211, 76, 3, 10);
    b.blit(S.city, 0, GROUND - 79);

    // --- tower ---
    if (t < TC) {
      const a = S.lean(t);
      const shudder = S.steps.some((s) => t >= s && t - s < 0.25) ? (frame % 2 ? 1 : -1) : 0;
      // long dithered shadow on the lawn
      b.dither(S.BASE_X + 20, GROUND + 2, 120, 6, 0, 0.5);
      S.storeys.forEach((s, i) => {
        const c = S.place(i, a);
        b.blitRot(s, c.x + shudder, c.y, a);
      });
      // plumb line from the top of the tower straight down
      const topI = S.storeys.length - 1, c = S.place(topI, a), hw = S.storeys[topI].w / 2, hh = S.storeys[topI].h / 2;
      const lx = Math.round(c.x - hw * Math.cos(a) + hh * Math.sin(a));
      const ly = Math.round(c.y - hw * Math.sin(a) - hh * Math.cos(a));
      b.line(lx, ly, lx, GROUND - 4, 10, 3);
      b.ball(lx, GROUND - 3, 2, 3, [9, 10, 11]);
    } else {
      const a0 = S.lean(TC);
      b.blitRot(S.storeys[0], S.place(0, a0).x, S.place(0, a0).y, a0);
      b.blitRot(S.stump, S.place(1, a0).x, S.place(1, a0).y, a0);
      for (const body of S.bodies) {
        if (t < S.t0) {
          const h = S.hinge(body, t - TC);
          b.blitRot(body.sp, h.x, h.y, h.a);
        } else {
          const n = Math.min(S.N - 1, Math.floor((t - S.t0) / S.DT)) * 3;
          b.blitRot(body.sp, body.track[n], body.track[n + 1], body.track[n + 2]);
        }
      }
    }

    // debris: chunky stones with a lit corner
    for (const st of S.stones) {
      if (t < st.t0) continue;
      const n = Math.min(st.track.length / 2 - 1, Math.floor((t - st.t0) / (S.DT * 4))) * 2;
      if (n < 0) continue;
      const x = Math.round(st.track[n]), y = Math.round(st.track[n + 1]);
      b.rect(x - 1, y - 1, st.s + 2, st.s + 2, 1);
      b.rect(x, y, st.s, st.s, st.c);
      b.px(x, y, 6);
    }

    // lawn in front
    b.blit(S.lawn, 0, GROUND);

    // dust: lit, puffy balls while dense, then thinning dithered clouds
    for (const p of S.puffs) {
      const age = t - p.t;
      if (age < 0 || age > 1.9) continue;
      const k = age / 1.9, e = PX.ease.out(Math.min(1, age / 0.6));
      for (let j = 0; j < 5; j++) {
        const ox = (j - 2) * p.r * 0.5 * e, oy = -p.r * 0.35 * e - (j % 2) * 6 - age * 12;
        const rad = Math.round(p.r * (0.35 + 0.35 * e) * (j % 2 ? 0.8 : 1));
        if (k < 0.35) b.ball(p.x + ox, p.y + oy, rad, rad, [3, 4, 5, 6]);
        else b.ditherCircle(p.x + ox, p.y + oy, rad, j % 2 ? 4 : 5, 0.9 * (1 - k));
      }
    }

    // --- HUD + title ---
    const collapsed = t >= TC;
    const steps = S.steps.filter((s) => t >= s).length;
    PX.hud(b, collapsed ? 'COLLAPSE' : 'CALCULATION', `5.4${steps}°`, collapsed);
    PX.title(b, S.TITLE, t, S.T_TITLE, { y: 76 });

    // --- impact FX ---
    const since = t - S.firstImpact;
    if (since >= 0 && since < 0.4) {
      const r = PX.rng(frame * 31 + 5);
      fx.shakeX = Math.round((r() - 0.5) * 8 * (1 - since / 0.4));
      fx.shakeY = Math.round((r() - 0.5) * 6 * (1 - since / 0.4));
      fx.flash = Math.max(0, 0.55 - since * 2.2);
      for (let i = 0; i < 4; i++) b.rowShift(Math.floor(r() * 320), 2 + Math.floor(r() * 8), Math.round((r() - 0.5) * 32));
      const gy = Math.floor(r() * 240) + 40;
      b.line(0, gy, 255, gy, 7, 4);
    }
    if (t >= TC && t < TC + 0.12) fx.flash = 0.25;

    PX.fadeOut(b, t, 7);
    return fx;
  },
});
