#!/usr/bin/env node
/* Headless renderer: no browser needed.
 *
 *   node tools/render.mjs scenes/pisa.js 1.0 2.75 4.5      -> out/pisa-1.00.png ...
 *   node tools/render.mjs scenes/pisa.js --mp4 out/pisa.mp4  -> whole loop as MP4 with sound (needs ffmpeg)
 *
 * Options: --scale 4  --palette ember  --out out  --fps 30 (video frame rate)  --silent
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? def : args.splice(i, 2)[1];
};
const silent = args.includes('--silent') && args.splice(args.indexOf('--silent'), 1);
const mp4 = opt('mp4', null), outDir = opt('out', path.join(root, 'out'));
const paletteName = opt('palette', null), fps = +opt('fps', 30), scaleArg = opt('scale', null);
const sceneFile = args.shift();
const times = args.map(Number);
if (!sceneFile || (!mp4 && !times.length)) {
  console.error('usage: node tools/render.mjs <scene.js> <t...> | --mp4 out.mp4  [--scale n] [--palette name]');
  process.exit(1);
}

// load the engine + scene into a sandbox that looks enough like a browser
const ctx = { window: {}, Math, Uint8Array, Uint32Array, Float32Array, Array, Object, String, Number, console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'src/pixel.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.resolve(sceneFile), 'utf8'), ctx);
const { PX } = ctx;
const scene = PX.scenes.at(-1);
const scale = +(scaleArg ?? Math.round(1024 / scene.w));
const pal = (PX.palettes[paletteName || scene.palette] || scene.palette).map((h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
});
const state = scene.setup ? scene.setup() : {};
const buf = new PX.Buf(scene.w, scene.h);
const W = scene.w * scale, H = scene.h * scale;

// same look as Stage.present: palette lookup, shake, scanlines, flash
function frameRGB(t) {
  const tq = Math.floor(t * scene.fps) / scene.fps;
  buf.clear(0);
  const fx = scene.draw(buf, tq, state) || {};
  const out = Buffer.alloc(W * H * 3);
  const sx = (fx.shakeX || 0) * scale, sy = (fx.shakeY || 0) * scale;
  const line = Math.max(1, Math.round(scale / 4)), dark = 1 - (fx.scanlines ?? 0.1), flash = fx.flash || 0;
  for (let Y = 0; Y < H; Y++) {
    const shade = Y % scale >= scale - line ? dark : 1;
    for (let X = 0; X < W; X++) {
      const bx = Math.floor((X - sx) / scale), by = Math.floor((Y - sy) / scale);
      let c = bx < 0 || by < 0 || bx >= scene.w || by >= scene.h ? 0 : buf.d[by * scene.w + bx];
      const rgb = pal[c === PX.T ? 0 : c];
      const o = (Y * W + X) * 3;
      for (let k = 0; k < 3; k++) out[o + k] = Math.min(255, rgb[k] * shade * (1 - flash) + 255 * flash);
    }
  }
  return out;
}

function png(rgb) {
  const crcT = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) rgb.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// offline chiptune synth: plays the same PX.SFX layers the browser does, sample by sample
function soundtrack(events, duration, rate = 48000) {
  const out = new Float32Array(Math.ceil(duration * rate));
  const rnd = PX.rng(99);
  const add = (start, dur, vol, sample) => { // exponential fade vol -> 0.001, like WebAudio's ramp
    const i0 = Math.round(start * rate), n = Math.round(dur * rate), k = Math.log(0.001 / vol) / n;
    for (let i = 0; i < n && i0 + i < out.length; i++) out[i0 + i] += sample(i / rate) * vol * Math.exp(k * i);
  };
  for (const e of events)
    for (const [kind, ...a] of PX.SFX[e.sfx] || []) {
      if (kind === 'tone') {
        const [f0, dur, wave, vol, f1, delay = 0] = a;
        let ph = 0;
        add(e.t + delay, dur, vol, (t) => {
          ph += (f1 ? f0 * Math.pow(f1 / f0, t / dur) : f0) / rate;
          const p = ph % 1;
          return wave === 'square' ? (p < 0.5 ? 1 : -1) : wave === 'sawtooth' ? 2 * p - 1 : Math.sin(2 * Math.PI * p);
        });
      } else {
        const [dur, vol, type, fc, delay = 0] = a;
        const w = (2 * Math.PI * fc) / rate, al = Math.sin(w) / 2, c = Math.cos(w), lp = type === 'lowpass';
        const b0 = lp ? (1 - c) / 2 : (1 + c) / 2, b1 = lp ? 1 - c : -(1 + c), a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
        let x1 = 0, x2 = 0, y1 = 0, y2 = 0; // RBJ biquad, Q = 1 like WebAudio's default
        add(e.t + delay, dur, vol, () => {
          const x = rnd() * 2 - 1, y = (b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2) / a0;
          x2 = x1; x1 = x; y2 = y1; y1 = y;
          return y;
        });
      }
    }
  const wav = Buffer.alloc(44 + out.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + out.length * 2, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(out.length * 2, 40);
  out.forEach((v, i) => wav.writeInt16LE(Math.round(Math.tanh(v * 0.55) * 32767), 44 + i * 2));
  return wav;
}

const name = path.basename(sceneFile, '.js');
if (mp4) {
  fs.mkdirSync(path.dirname(path.resolve(mp4)), { recursive: true });
  const audio = [];
  if (!silent) {
    const wavPath = path.join(os.tmpdir(), `pixel-${process.pid}.wav`);
    fs.writeFileSync(wavPath, soundtrack(state.events || scene.events || [], scene.duration));
    audio.push('-i', wavPath, '-c:a', 'aac', '-b:a', '192k', '-shortest');
  }
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-',
    ...audio, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', path.resolve(mp4)], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(scene.duration * fps);
  for (let i = 0; i < n; i++) if (!ff.stdin.write(frameRGB(i / fps))) await new Promise((r) => ff.stdin.once('drain', r));
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log(`wrote ${mp4} (${n} frames, ${W}x${H})`);
} else {
  fs.mkdirSync(outDir, { recursive: true });
  for (const t of times) {
    const f = path.join(outDir, `${name}-${t.toFixed(2)}.png`);
    fs.writeFileSync(f, png(frameRGB(t)));
    console.log(f);
  }
}
