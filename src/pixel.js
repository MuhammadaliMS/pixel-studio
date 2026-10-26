/* pixel.js: a tiny, dependency-free pixel-animation engine.
 *
 * The whole trick behind "pixel videos":
 *   1. Draw into a LOW-RES buffer (e.g. 128x160) of PALETTE INDICES, never RGB.
 *   2. Only ever write whole pixels (no anti-aliasing, no canvas paths).
 *   3. Upscale with nearest-neighbour (imageSmoothingEnabled = false).
 *   4. Step time at 12 fps so motion feels hand-animated.
 * Because the buffer stores indices, swapping the palette recolours everything.
 *
 * Everything is a pure function of time t, so any frame can be rendered on
 * demand (seek / export / HyperFrames).
 */
(function () {
  const PX = (window.PX = {});
  const T = 255; // transparent index

  // ---------- palettes ----------
  // slots 0-7: main ramp, darkest -> lightest.  slots 8-11: accent ramp, dark -> bright.
  PX.palettes = {
    violet: ['#0d081a', '#1a1030', '#2e1f52', '#4d3278', '#7a56c2', '#a884f3', '#cbb8fc', '#f4efff', '#4a1f2e', '#a8433f', '#f08a4b', '#ffd59e'],
    teal:   ['#061316', '#0d2629', '#173d40', '#245e5c', '#348a7b', '#5cc39a', '#a6efc0', '#effff2', '#2e4a12', '#6f9e1c', '#b8e04a', '#f0ffb0'],
    ember:  ['#140a06', '#2a140c', '#4a2414', '#7a3a1c', '#b85a26', '#e88a3a', '#f7c66b', '#fff4dc', '#16301c', '#2f6a35', '#5fae4e', '#b8eb8a'],
    gameboy:['#071a07', '#0f380f', '#1f4d1f', '#306230', '#5d8a1f', '#8bac0f', '#9bbc0f', '#c4dc6c', '#0f380f', '#306230', '#8bac0f', '#e0f0a0'],
    mono:   ['#000000', '#0e0e0e', '#2a2a2a', '#4a4a4a', '#7a7a7a', '#a8a8a8', '#d6d6d6', '#ffffff', '#3a0c0c', '#8c1c1c', '#e04a3a', '#ffb0a0'],
  };

  // ---------- deterministic randomness ----------
  PX.rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  PX.ease = {
    out: (x) => 1 - Math.pow(1 - x, 3),
    in: (x) => x * x * x,
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  };
  PX.clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  // 4x4 Bayer matrix: ordered dithering = the retro way to do transparency/gradients
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  // ---------- 3x5 pixel font ----------
  const GLYPHS = {
    A: '.#. #.# ### #.# #.#', B: '##. #.# ##. #.# ##.', C: '.## #.. #.. #.. .##',
    D: '##. #.# #.# #.# ##.', E: '### #.. ##. #.. ###', F: '### #.. ##. #.. #..',
    G: '.## #.. #.# #.# .##', H: '#.# #.# ### #.# #.#', I: '### .#. .#. .#. ###',
    J: '..# ..# ..# #.# .#.', K: '#.# #.# ##. #.# #.#', L: '#.. #.. #.. #.. ###',
    M: '#.# ### ### #.# #.#', N: '##. #.# #.# #.# #.#', O: '.#. #.# #.# #.# .#.',
    P: '##. #.# ##. #.. #..', Q: '.#. #.# #.# ##. .##', R: '##. #.# ##. #.# #.#',
    S: '.## #.. .#. ..# ##.', T: '### .#. .#. .#. .#.', U: '#.# #.# #.# #.# ###',
    V: '#.# #.# #.# #.# .#.', W: '#.# #.# ### ### #.#', X: '#.# #.# .#. #.# #.#',
    Y: '#.# #.# .#. .#. .#.', Z: '### ..# .#. #.. ###',
    0: '### #.# #.# #.# ###', 1: '.#. ##. .#. .#. ###', 2: '##. ..# .#. #.. ###',
    3: '##. ..# .#. ..# ##.', 4: '#.# #.# ### ..# ..#', 5: '### #.. ##. ..# ##.',
    6: '.## #.. ### #.# ###', 7: '### ..# .#. .#. .#.', 8: '### #.# ### #.# ###',
    9: '### #.# ### ..# ##.', '.': '... ... ... ... .#.', '°': '.#. #.# .#. ... ...',
    '-': '... ... ### ... ...', '!': '.#. .#. .#. ... .#.', ':': '... .#. ... .#. ...',
    '%': '#.# ..# .#. #.. #.#', '?': '##. ..# .#. ... .#.', '/': '..# ..# .#. #.. #..', '+': '... .#. ### .#. ...', ',': '... ... ... .#. #..', "'": '.#. .#. ... ... ...', ' ': '... ... ... ... ...',
  };
  const FONT = {};
  for (const k in GLYPHS) FONT[k] = GLYPHS[k].split(' ');
  PX.textWidth = (str, scale = 1) => Math.max(0, str.length * 4 * scale - scale);

  // ---------- the pixel buffer ----------
  class Buf {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.d = new Uint8Array(w * h).fill(T);
    }
    clear(c = T) { this.d.fill(c); return this; }
    px(x, y, c) {
      x = Math.floor(x); y = Math.floor(y);
      if (c === T || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.d[y * this.w + x] = c;
    }
    get(x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return T;
      return this.d[y * this.w + x];
    }
    rect(x, y, w, h, c) {
      x = Math.round(x); y = Math.round(y);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    }
    frame(x, y, w, h, c) {
      this.rect(x, y, w, 1, c); this.rect(x, y + h - 1, w, 1, c);
      this.rect(x, y, 1, h, c); this.rect(x + w - 1, y, 1, h, c);
    }
    // Bresenham line; dash > 0 draws dash-on / dash-off segments
    line(x0, y0, x1, y1, c, dash = 0) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy, n = 0;
      for (;;) {
        if (!dash || n % (dash * 2) < dash) this.px(x0, y0, c);
        n++;
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    circle(cx, cy, r, c) {
      for (let y = -r; y <= r; y++)
        for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.8) this.px(cx + x, cy + y, c);
    }
    // ordered-dither fill: amount 0..1 is the "opacity"
    dither(x, y, w, h, c, amount) {
      const k = amount * 16;
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const X = Math.round(x) + i, Y = Math.round(y) + j;
          if (BAYER[(Y & 3) * 4 + (X & 3)] < k) this.px(X, Y, c);
        }
    }
    ditherCircle(cx, cy, r, c, amount) {
      const k = amount * 16;
      cx = Math.round(cx); cy = Math.round(cy);
      for (let y = -r; y <= r; y++)
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y > r * r) continue;
          const X = cx + x, Y = cy + y;
          if (BAYER[(Y & 3) * 4 + (X & 3)] < k) this.px(X, Y, c);
        }
    }
    blit(src, x, y, flipX = false) {
      x = Math.round(x); y = Math.round(y);
      for (let j = 0; j < src.h; j++)
        for (let i = 0; i < src.w; i++) {
          const c = src.d[j * src.w + (flipX ? src.w - 1 - i : i)];
          if (c !== T) this.px(x + i, y + j, c);
        }
    }
    // nearest-neighbour rotation: pivot (ox,oy) of src lands on (cx,cy)
    blitRot(src, cx, cy, angle, ox = src.w / 2, oy = src.h / 2) {
      const c = Math.cos(angle), s = Math.sin(angle);
      const pts = [[-ox, -oy], [src.w - ox, -oy], [-ox, src.h - oy], [src.w - ox, src.h - oy]];
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [px, py] of pts) {
        const X = cx + px * c - py * s, Y = cy + px * s + py * c;
        x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
      }
      for (let Y = Math.floor(y0); Y <= Math.ceil(y1); Y++)
        for (let X = Math.floor(x0); X <= Math.ceil(x1); X++) {
          const dx = X + 0.5 - cx, dy = Y + 0.5 - cy;
          const sx = Math.floor(dx * c + dy * s + ox), sy = Math.floor(-dx * s + dy * c + oy);
          if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
          const col = src.d[sy * src.w + sx];
          if (col !== T) this.px(X, Y, col);
        }
    }
    ellipse(cx, cy, rx, ry, c) {
      for (let y = -ry; y <= ry; y++)
        for (let x = -rx; x <= rx; x++)
          if ((x * x) / (rx * rx + 0.5) + (y * y) / (ry * ry + 0.5) <= 1) this.px(cx + x, cy + y, c);
    }
    // filled polygon, pts = [[x, y], ...]
    poly(pts, c) {
      const ys = pts.map((p) => p[1]);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
        const xs = [], cy = y + 0.5;
        for (let i = 0; i < pts.length; i++) {
          const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
          if ((y0 <= cy && y1 > cy) || (y1 <= cy && y0 > cy)) xs.push(x0 + ((cy - y0) / (y1 - y0)) * (x1 - x0));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2)
          for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.px(x, y, c);
      }
    }
    // pick a ramp colour for brightness v (0..1), dithering between neighbouring bands
    static shadeAt(ramp, v, x, y) {
      const f = PX.clamp(v) * (ramp.length - 1), i = Math.floor(f);
      if (i >= ramp.length - 1) return ramp[ramp.length - 1];
      return (f - i) * 16 > BAYER[(y & 3) * 4 + (x & 3)] ? ramp[i + 1] : ramp[i];
    }
    // a lit, rounded ellipse (a "ball"): ramp = colour indices dark -> light, light from top-left
    ball(cx, cy, rx, ry, ramp, { lx = -0.55, ly = -0.65, gain = 1 } = {}) {
      cx = Math.round(cx); cy = Math.round(cy);
      for (let y = -ry; y <= ry; y++)
        for (let x = -rx; x <= rx; x++) {
          const nx = x / (rx + 0.5), ny = y / (ry + 0.5), d = nx * nx + ny * ny;
          if (d > 1) continue;
          const nz = Math.sqrt(1 - d), v = (nx * lx + ny * ly + nz * 0.55) * gain * 0.75 + 0.3;
          this.px(cx + x, cy + y, Buf.shadeAt(ramp, v, cx + x, cy + y));
        }
    }
    // a lit cylinder standing upright (columns, trunks, bodies): shading runs across x
    cyl(x, y, w, h, ramp, light = 0.3) {
      x = Math.round(x); y = Math.round(y);
      for (let i = 0; i < w; i++) {
        const u = (i + 0.5) / w * 2 - 1, v = Math.sqrt(Math.max(0, 1 - u * u)) * 0.7 - (u - light) * 0.35 + 0.1;
        for (let j = 0; j < h; j++) this.px(x + i, y + j, Buf.shadeAt(ramp, v, x + i, y + j));
      }
    }
    // a copy with a 1px outline around every opaque pixel: the #1 trick for readable characters
    outline(c) {
      const o = new Buf(this.w + 2, this.h + 2);
      o.blit(this, 1, 1);
      const src = o.d.slice();
      for (let y = 0; y < o.h; y++)
        for (let x = 0; x < o.w; x++) {
          if (src[y * o.w + x] !== T) continue;
          const n = (X, Y) => X >= 0 && Y >= 0 && X < o.w && Y < o.h && src[Y * o.w + X] !== T;
          if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) o.d[y * o.w + x] = c;
        }
      return o;
    }
    // sprite from strings: sprite(['.aa.', 'abba'], { a: 5, b: 7 })
    static sprite(rows, map) {
      const b = new Buf(rows[0].length, rows.length);
      rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch in map) b.px(x, y, map[ch]); }));
      return b;
    }
    text(str, x, y, c, { scale = 1, shadow = null } = {}) {
      str = String(str).toUpperCase();
      if (shadow !== null) this.text(str, x + scale, y + scale, shadow, { scale });
      [...str].forEach((ch, i) => {
        const g = FONT[ch] || FONT['?'];
        for (let j = 0; j < 5; j++)
          for (let k = 0; k < 3; k++)
            if (g[j][k] === '#') this.rect(x + (i * 4 + k) * scale, y + j * scale, scale, scale, c);
      });
    }
    // glitch: slide a band of rows sideways (wraps around)
    rowShift(y0, h, dx) {
      const w = this.w, row = new Uint8Array(w);
      for (let y = Math.max(0, y0); y < Math.min(this.h, y0 + h); y++) {
        const off = y * w;
        for (let x = 0; x < w; x++) row[(((x + dx) % w) + w) % w] = this.d[off + x];
        this.d.set(row, off);
      }
    }
  }
  PX.Buf = Buf;
  PX.T = T;

  // ---------- shared storytelling pieces ----------
  // 1 at 128px wide, 2 at 256px wide: keeps HUD and titles the same size on screen
  const unit = (b) => Math.max(1, Math.round(b.w / 128));
  // HUD readout box; flips to inverted colours when `alert` is true
  PX.hud = (b, label, value, alert = false, x, y) => {
    const u = unit(b);
    x = x ?? 6 * u; y = y ?? 6 * u;
    const w = Math.max(PX.textWidth(label, u), PX.textWidth(value, 2 * u)) + 7 * u, h = 24 * u;
    b.rect(x, y, w, h, alert ? 6 : 0);
    for (let i = 0; i < u; i++) b.frame(x + i, y + i, w - 2 * i, h - 2 * i, alert ? 7 : 5);
    b.text(label, x + 3 * u, y + 3 * u, alert ? 2 : 5, { scale: u });
    b.text(value, x + 3 * u, y + 11 * u, alert ? 2 : 7, { scale: 2 * u });
  };
  // typewriter title, one letter every `rate` seconds from `start`
  PX.title = (b, lines, t, start, { x, y, scale, rate = 0.07, c = 6, shadow = 3 } = {}) => {
    const u = unit(b);
    x = x ?? 8 * u; y = y ?? 38 * u; scale = scale ?? 3 * u;
    let k = Math.floor((t - start) / rate) + 1;
    lines.forEach((line, i) => {
      if (k <= 0) return;
      b.text(line.slice(0, k), x, y + i * scale * 6, c, { scale, shadow });
      k -= line.length;
    });
  };
  PX.titleEvents = (lines, start, rate = 0.07) =>
    [...lines.join('')].map((_, i) => ({ t: start + rate * i, sfx: 'blip' }));
  // dithered fade to black over the last `len` seconds so loops restart cleanly
  PX.fadeOut = (b, t, duration, len = 0.5) => {
    const k = (t - (duration - len)) / len;
    if (k > 0) b.dither(0, 0, b.w, b.h, 0, k);
  };

  // ---------- presenting: indices -> palette colours -> crisp upscale ----------
  class Stage {
    constructor(canvas, w, h, scale) {
      this.w = w; this.h = h; this.scale = scale;
      this.canvas = canvas;
      canvas.width = w * scale;
      canvas.height = h * scale;
      this.ctx = canvas.getContext('2d');
      this.small = document.createElement('canvas');
      this.small.width = w; this.small.height = h;
      this.sctx = this.small.getContext('2d');
      this.img = this.sctx.createImageData(w, h);
      this.u32 = new Uint32Array(this.img.data.buffer);
    }
    setPalette(hexes) {
      this.hex = hexes;
      this.pal = hexes.map((h) => {
        const n = parseInt(h.slice(1), 16);
        return (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255)) >>> 0;
      });
    }
    present(buf, fx = {}) {
      const { u32, pal } = this;
      for (let i = 0; i < buf.d.length; i++) u32[i] = pal[buf.d[i] === T ? 0 : buf.d[i]];
      this.sctx.putImageData(this.img, 0, 0);
      const { ctx, scale: s, canvas } = this;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = this.hex[0];
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(this.small, (fx.shakeX || 0) * s, (fx.shakeY || 0) * s, this.w * s, this.h * s);
      // CRT scanlines: a dark sliver under every logical row
      ctx.fillStyle = `rgba(0,0,0,${fx.scanlines ?? 0.1})`;
      const t = Math.max(1, Math.round(s / 4));
      for (let y = 0; y < this.h; y++) ctx.fillRect(0, y * s + s - t, canvas.width, t);
      if (fx.flash) {
        ctx.fillStyle = `rgba(255,255,255,${fx.flash})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }
  PX.Stage = Stage;

  // ---------- chiptune SFX, synthesised (no audio files) ----------
  const A = {};
  PX.audio = {
    get on() { return !!A.on; },
    enable() {
      if (!A.ctx) {
        A.ctx = new AudioContext();
        A.out = A.ctx.createGain();
        A.out.gain.value = 0.55;
        A.out.connect(A.ctx.destination);
        A.rec = A.ctx.createMediaStreamDestination();
        A.out.connect(A.rec);
      }
      A.ctx.resume();
      A.on = true;
    },
    disable() { A.on = false; },
    stream() { return A.rec && A.rec.stream; },
  };
  function tone(freq, dur, type = 'square', vol = 0.2, slideTo = null, delay = 0) {
    const t0 = A.ctx.currentTime + delay;
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(A.out);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, type = 'lowpass', freq = 800, delay = 0) {
    const t0 = A.ctx.currentTime + delay;
    const len = Math.ceil(A.ctx.sampleRate * dur);
    const b = A.ctx.createBuffer(1, len, A.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = A.ctx.createBufferSource(), f = A.ctx.createBiquadFilter(), g = A.ctx.createGain();
    src.buffer = b; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(A.out);
    src.start(t0);
  }
  // each sound is a list of layers, shared with the headless renderer (tools/render.mjs):
  //   ['tone', freq, dur, wave, vol, slideTo?, delay?]   ['noise', dur, vol, filter, cutoff, delay?]
  PX.SFX = {
    tick: [['tone', 880, 0.05, 'square', 0.12], ['noise', 0.08, 0.15, 'lowpass', 300]],
    blip: [['tone', 1320, 0.04, 'square', 0.07]],
    flip: [['tone', 523, 0.07, 'square', 0.14], ['tone', 784, 0.12, 'square', 0.14, null, 0.07]],
    crack: [['noise', 0.3, 0.5, 'highpass', 1800], ['tone', 220, 0.25, 'sawtooth', 0.12, 60]],
    thud: [['noise', 0.35, 0.45, 'lowpass', 260]],
    boom: [['noise', 1.4, 0.9, 'lowpass', 420], ['tone', 120, 0.8, 'sine', 0.6, 30]],
    rumble: [['noise', 1.2, 0.25, 'lowpass', 140]],
  };
  PX.playSfx = (name) => {
    if (A.on && PX.SFX[name]) for (const [kind, ...a] of PX.SFX[name]) (kind === 'tone' ? tone : noise)(...a);
  };

  // ---------- player: loop, seek, record ----------
  // scene = { name, w, h, fps, duration, palette, setup(), draw(buf, t, state) -> fx, events: [{t, sfx}] }
  PX.player = function (canvas, scene, { scale = 6 } = {}) {
    const stage = new Stage(canvas, scene.w, scene.h, scale);
    const buf = new Buf(scene.w, scene.h);
    const state = scene.setup ? scene.setup() : {};
    const events = (state.events || scene.events || []).slice().sort((a, b) => a.t - b.t);
    stage.setPalette(PX.palettes[scene.palette] || scene.palette);

    let playing = true, t = 0, last = performance.now(), recorder = null;

    function render(time) {
      const tq = Math.floor(time * scene.fps) / scene.fps; // stepped, hand-animated feel
      buf.clear(0);
      const fx = scene.draw(buf, tq, state) || {};
      stage.present(buf, fx);
    }
    function fire(a, b) {
      for (const e of events) if (e.t > a && e.t <= b) PX.playSfx(e.sfx);
    }
    function loop(now) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playing) {
        let nt = t + dt;
        if (nt >= scene.duration) {
          fire(t, scene.duration);
          if (recorder) { recorder.stop(); recorder = null; }
          nt -= scene.duration;
          fire(-1, nt);
        } else fire(t, nt);
        t = nt;
      }
      render(t);
      api.onTime && api.onTime(t);
      requestAnimationFrame(loop);
    }

    const api = {
      stage, state,
      play() { playing = true; last = performance.now(); },
      pause() { playing = false; },
      get playing() { return playing; },
      restart() { t = 0; fire(-1, 0); },
      seek(s) { t = PX.clamp(s, 0, scene.duration - 1e-6); render(t); },
      setPalette(p) { stage.setPalette(PX.palettes[p] || p); },
      // records exactly one loop (video + synthesised sound) to a .webm/.mp4
      record(onDone) {
        const stream = canvas.captureStream(60);
        const audio = PX.audio.stream();
        if (audio) audio.getAudioTracks().forEach((tr) => stream.addTrack(tr));
        const type = ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
        const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 12e6 });
        const chunks = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = () => {
          const blob = new Blob(chunks, { type });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${scene.name.toLowerCase().replace(/\W+/g, '-')}.${type.includes('mp4') ? 'mp4' : 'webm'}`;
          a.click();
          onDone && onDone();
        };
        t = 0; playing = true; last = performance.now();
        fire(-1, 0);
        rec.start();
        recorder = rec;
      },
    };
    window.PX_SEEK = (s) => { playing = false; api.seek(s); }; // for frame-exact export tools
    requestAnimationFrame(loop);
    return api;
  };

  PX.scenes = [];
  PX.scene = (s) => PX.scenes.push(s);
})();
