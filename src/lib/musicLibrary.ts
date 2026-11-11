// مكتبة موسيقى مولّدة داخل المتصفح (Web Audio) — بدون حقوق، خفيفة، وتشتغل أوفلاين.
// محرّك محسّن: دربوكة/طبلة + ريفِرب + باص دافئ + عود/ناي/قانون + ماستر ستيريو.

type Emit = {
  wave: OscillatorType | 'noise';
  freq?: number;
  pitchTo?: number;
  t: number;
  dur: number;
  gain: number;
  atk?: number;
  hold?: number;
  lp?: number;
  lpTo?: number;
  hp?: number;
  bp?: number;
  q?: number;
  pan?: number;
  send?: number;
  detune?: number;
  vib?: number;
  vibDepth?: number;
  vibDelay?: number;
};

function makeNoise(ctx: BaseAudioContext, dur = 1) {
  const b = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function impulseResponse(ctx: BaseAudioContext, seconds = 2.2, decay = 3) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}
function softClip(ctx: BaseAudioContext) {
  const ws = ctx.createWaveShaper();
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(1.5 * x); }
  ws.curve = curve;
  ws.oversample = '2x';
  return ws;
}
function panned(ctx: BaseAudioContext, pan: number) {
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  if ((p as StereoPannerNode).pan) (p as StereoPannerNode).pan.value = pan;
  return p as AudioNode;
}
function emit(ctx: BaseAudioContext, master: AudioNode, verb: AudioNode, noise: AudioBuffer, o: Emit) {
  const p = panned(ctx, o.pan || 0);
  const g = ctx.createGain();
  g.connect(p); p.connect(master);
  if (o.send) { const s = ctx.createGain(); s.gain.value = o.send; p.connect(s); s.connect(verb); }
  let src: AudioScheduledSourceNode;
  if (o.wave === 'noise') {
    const b = ctx.createBufferSource(); b.buffer = noise; b.loop = true; src = b;
  } else {
    const osc = ctx.createOscillator();
    osc.type = o.wave;
    osc.frequency.setValueAtTime(Math.max(1, o.freq || 440), o.t);
    if (o.pitchTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.pitchTo), o.t + Math.min(o.dur * 0.7, 0.14));
    if (o.detune) osc.detune.value = o.detune;
    if (o.vib) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = o.vib;
      const lg = ctx.createGain();
      lg.gain.value = o.vibDepth || 5;
      lfo.connect(lg); lg.connect(osc.detune);
      lfo.start(o.t + (o.vibDelay || 0)); lfo.stop(o.t + o.dur + 0.1);
    }
    src = osc;
  }
  let node: AudioNode = src;
  if (o.bp || o.hp || o.lp) {
    const f = ctx.createBiquadFilter();
    if (o.bp) { f.type = 'bandpass'; f.frequency.value = o.bp; }
    else if (o.hp) { f.type = 'highpass'; f.frequency.value = o.hp; }
    else {
      f.type = 'lowpass'; f.frequency.setValueAtTime(o.lp || 2000, o.t);
      if (o.lpTo) f.frequency.exponentialRampToValueAtTime(Math.max(150, o.lpTo), o.t + o.dur * 0.85);
    }
    if (o.q) f.Q.value = o.q;
    node.connect(f); node = f;
  }
  node.connect(g);
  const atk = o.atk ?? 0.004;
  const rampEnd = Math.max(o.t + o.dur, o.t + atk + 0.012);
  g.gain.setValueAtTime(0.0001, o.t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), o.t + atk);
  if (o.hold) g.gain.setValueAtTime(Math.max(0.0002, o.gain), Math.min(o.t + atk + o.hold, rampEnd - 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, rampEnd);
  src.start(o.t); src.stop(rampEnd + 0.1);
}

const NT = (root: number, semi: number) => root * Math.pow(2, semi / 12);
function rng(seed: number) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

// ── آلات الإيقاع ─────────────────────────────────────────────────────
function kick(ctx: BaseAudioContext, m: AudioNode, v: AudioNode, n: AudioBuffer, t: number, g = 0.95) {
  emit(ctx, m, v, n, { wave: 'sine', freq: 150, pitchTo: 46, t, dur: 0.34, gain: g, atk: 0.001, lp: 250 });
  emit(ctx, m, v, n, { wave: 'noise', t, dur: 0.018, gain: 0.22, atk: 0.001, hp: 1400 });
}
function dum(ctx: BaseAudioContext, m: AudioNode, v: AudioNode, n: AudioBuffer, t: number, g = 0.9) {
  emit(ctx, m, v, n, { wave: 'sine', freq: 185, pitchTo: 88, t, dur: 0.22, gain: g, atk: 0.001, lp: 320, send: 0.05 });
}
function tek(ctx: BaseAudioContext, m: AudioNode, v: AudioNode, n: AudioBuffer, t: number, g = 0.5) {
  emit(ctx, m, v, n, { wave: 'noise', t, dur: 0.05, gain: g, atk: 0.001, bp: 2700, q: 1.6, send: 0.06 });
  emit(ctx, m, v, n, { wave: 'sine', freq: 760, t, dur: 0.03, gain: 0.12, atk: 0.001 });
}
function riq(ctx: BaseAudioContext, m: AudioNode, v: AudioNode, n: AudioBuffer, t: number, g = 0.14) {
  emit(ctx, m, v, n, { wave: 'noise', t, dur: 0.05, gain: g, atk: 0.001, hp: 5200, send: 0.1 });
  emit(ctx, m, v, n, { wave: 'sine', freq: 5200, t, dur: 0.04, gain: 0.045, atk: 0.001 });
}
function hat(ctx: BaseAudioContext, m: AudioNode, v: AudioNode, n: AudioBuffer, t: number, g = 0.11, open = false) {
  emit(ctx, m, v, n, { wave: 'noise', t, dur: open ? 0.15 : 0.03, gain: g, atk: 0.001, hp: 9000 });
}
function clap(ctx: BaseAudioContext, m: AudioNode, v: AudioNode, n: AudioBuffer, t: number, g = 0.3) {
  emit(ctx, m, v, n, { wave: 'noise', t, dur: 0.1, gain: g, atk: 0.001, bp: 1650, q: 0.9, send: 0.15 });
  emit(ctx, m, v, n, { wave: 'noise', t: t + 0.011, dur: 0.09, gain: g * 0.7, atk: 0.001, bp: 1650, q: 0.9 });
}
function snare(ctx: BaseAudioContext, m: AudioNode, v: AudioNode, n: AudioBuffer, t: number, g = 0.42) {
  emit(ctx, m, v, n, { wave: 'noise', t, dur: 0.2, gain: g, atk: 0.001, hp: 1300, send: 0.2 });
  emit(ctx, m, v, n, { wave: 'triangle', freq: 195, t, dur: 0.1, gain: g * 0.35, atk: 0.001 });
}

// ── آلات لحنية ───────────────────────────────────────────────────────
function bass(ctx: BaseAudioContext, m: AudioNode, v: AudioNode, n: AudioBuffer, t: number, freq: number, dur: number, g = 0.4) {
  emit(ctx, m, v, n, { wave: 'sawtooth', freq, t, dur, gain: g, atk: 0.012, lp: 460, lpTo: 320, send: 0.04 });
  emit(ctx, m, v, n, { wave: 'sine', freq: freq / 2, t, dur, gain: g * 0.5, atk: 0.012, lp: 220 });
}
function pluck(ctx: BaseAudioContext, m: AudioNode, v: AudioNode, n: AudioBuffer, t: number, freq: number, dur: number, g = 0.3) {
  emit(ctx, m, v, n, { wave: 'triangle', freq, t, dur, gain: g, atk: 0.004, lp: 2900, lpTo: 950, q: 1.2, send: 0.28 });
  emit(ctx, m, v, n, { wave: 'sawtooth', freq, t, dur: dur * 0.6, gain: g * 0.25, atk: 0.004, lp: 1900, detune: 6, send: 0.2 });
}
function ney(ctx: BaseAudioContext, m: AudioNode, v: AudioNode, n: AudioBuffer, t: number, freq: number, dur: number, g = 0.26) {
  emit(ctx, m, v, n, { wave: 'sine', freq, t, dur, gain: g, atk: 0.09, vib: 5.4, vibDepth: 7, vibDelay: 0.12, send: 0.42 });
  emit(ctx, m, v, n, { wave: 'noise', t, dur: dur * 0.7, gain: g * 0.12, atk: 0.05, bp: 1400, q: 1.2, send: 0.3 });
}
function qanun(ctx: BaseAudioContext, m: AudioNode, v: AudioNode, n: AudioBuffer, t: number, freq: number, dur: number, g = 0.26) {
  emit(ctx, m, v, n, { wave: 'triangle', freq, t, dur, gain: g, atk: 0.003, lp: 4200, lpTo: 1600, send: 0.32 });
  emit(ctx, m, v, n, { wave: 'square', freq: freq * 2, t, dur: dur * 0.35, gain: g * 0.12, atk: 0.003, lp: 5000, send: 0.25 });
}
function pad(ctx: BaseAudioContext, m: AudioNode, v: AudioNode, n: AudioBuffer, t: number, freq: number, dur: number, g = 0.12) {
  for (const d of [-9, 0, 9]) emit(ctx, m, v, n, { wave: 'sawtooth', freq, t, dur, gain: g, atk: 0.7, detune: d, lp: 750, q: 0.7, send: 0.5 });
}
function riser(ctx: BaseAudioContext, m: AudioNode, v: AudioNode, n: AudioBuffer, t: number, dur: number) {
  emit(ctx, m, v, n, { wave: 'noise', t, dur, gain: 0.2, atk: dur * 0.85, bp: 2600, q: 1.1, send: 0.3 });
}

// ── مقاييس شرقية ─────────────────────────────────────────────────────
const HIJAZ = [0, 1, 4, 5, 7, 8, 10];
const NAHAWAND = [0, 2, 3, 5, 7, 8, 10];
const PENTA = [0, 3, 5, 7, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

type Inst = 'pluck' | 'ney' | 'qanun';
function playInst(ctx: BaseAudioContext, m: AudioNode, v: AudioNode, n: AudioBuffer, inst: Inst, t: number, freq: number, dur: number, g: number) {
  if (inst === 'ney') ney(ctx, m, v, n, t, freq, dur, g);
  else if (inst === 'qanun') qanun(ctx, m, v, n, t, freq, dur, g);
  else pluck(ctx, m, v, n, t, freq, dur, g);
}
type MelOpts = { start: number; end: number; beat: number; root: number; scale: number[]; seed: number; gain: number; inst: Inst; restProb?: number; octUp?: number; swing?: number };
function melodyLine(ctx: BaseAudioContext, m: AudioNode, v: AudioNode, n: AudioBuffer, o: MelOpts) {
  const r = rng(o.seed);
  const step = o.beat / 2;
  const swing = o.swing ?? 0.16;
  let deg = Math.floor(o.scale.length / 2);
  let t = o.start;
  while (t < o.end - o.beat * 0.3) {
    if (r() < (o.restProb ?? 0.3)) { t += step; continue; }
    if (r() < 0.42) deg += r() < 0.5 ? -1 : 1;
    deg = Math.max(0, Math.min(o.scale.length - 1, deg));
    const oct = r() < (o.octUp ?? 0.18) ? 1 : 0;
    const freq = NT(o.root, o.scale[deg] + 12 * oct);
    const long = r();
    const dur = step * (long < 0.22 ? 3 : long < 0.5 ? 2 : 1) * 0.96;
    const g = o.gain * (0.72 + r() * 0.28);
    const on = t + (Math.round((t - o.start) / step) % 2 === 1 ? swing * step : 0);
    playInst(ctx, m, v, n, o.inst, on, freq, dur, g);
    t += step * (r() < 0.55 ? 1 : 2);
  }
}

function drum8(ctx: BaseAudioContext, m: AudioNode, v: AudioNode, n: AudioBuffer, sec: number, beat: number, pat: number[], opts: { riq?: boolean; hats?: boolean; swing?: number } = {}) {
  const step = beat / 2;
  const swing = opts.swing ?? 0.12;
  let i = 0;
  for (let t = 0; t < sec - beat * 0.25; t += step, i++) {
    const at = t + (i % 2 === 1 ? swing * step : 0);
    const val = pat[i % pat.length];
    if (val === 1) dum(ctx, m, v, n, at, 0.92);
    else if (val === 2) tek(ctx, m, v, n, at, 0.46);
    if (opts.hats) hat(ctx, m, v, n, at, i % 2 ? 0.08 : 0.12);
    if (opts.riq) riq(ctx, m, v, n, at, i % 2 ? 0.1 : 0.14);
  }
}

const MAQSOUM = [1, 0, 2, 2, 0, 1, 0, 2];
const BALADI = [1, 1, 0, 2, 0, 1, 0, 0];

type Builder = (c: OfflineAudioContext, m: AudioNode, v: AudioNode, n: AudioBuffer, sec: number, beat: number) => void;

async function render(bpm: number, seconds: number, build: Builder, sr = 44100): Promise<AudioBuffer> {
  const len = Math.max(6, Math.min(40, seconds));
  const c = new OfflineAudioContext(2, Math.ceil(len * sr), sr);
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -12; comp.knee.value = 24; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.22;
  const clip = softClip(c);
  const master = c.createGain();
  master.gain.value = 0.72;
  master.connect(comp); comp.connect(clip); clip.connect(c.destination);
  const conv = c.createConvolver();
  conv.buffer = impulseResponse(c, 2.2, 3);
  const verb = c.createGain();
  verb.gain.value = 0.55;
  conv.connect(verb); verb.connect(comp);
  const n = makeNoise(c, 1);
  const beat = 60 / bpm;
  build(c, master, conv, n, len, beat);
  return c.startRendering();
}

export type MusicTrack = { id: string; label: string; emoji: string; group: string; bpm: number; desc: string; build: Builder };

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'maqsoum', label: 'شعبي مقسوم', emoji: '🪘', group: 'شعبي', bpm: 100, desc: 'إيقاع مقسوم + عود حجاز + ناي',
    build: (c, m, v, n, sec, beat) => {
      drum8(c, m, v, n, sec, beat, MAQSOUM, { riq: true });
      for (let b = beat; b < sec - beat; b += beat * 2) bass(c, m, v, n, b, NT(146.83, 0), beat * 1.3, 0.42);
      melodyLine(c, m, v, n, { start: beat * 2, end: sec, beat, root: 293.66, scale: HIJAZ, seed: 7, gain: 0.3, inst: 'pluck' });
      melodyLine(c, m, v, n, { start: beat * 4, end: sec, beat, root: 293.66, scale: HIJAZ, seed: 77, gain: 0.18, inst: 'ney', restProb: 0.62 });
    },
  },
  {
    id: 'baladi', label: 'شعبي بلدي', emoji: '🎺', group: 'شعبي', bpm: 92, desc: 'بلدي + ناي حزين',
    build: (c, m, v, n, sec, beat) => {
      drum8(c, m, v, n, sec, beat, BALADI, { riq: true, swing: 0.14 });
      for (let b = beat; b < sec - beat; b += beat * 2) bass(c, m, v, n, b, NT(130.81, 0), beat * 1.5, 0.4);
      pad(c, m, v, n, beat * 2, NT(130.81, 0), beat * 4, 0.07);
      pad(c, m, v, n, beat * 6, NT(130.81, 5), beat * 4, 0.06);
      melodyLine(c, m, v, n, { start: beat * 2, end: sec, beat: beat * 1.4, root: 261.63, scale: NAHAWAND, seed: 21, gain: 0.26, inst: 'ney', restProb: 0.4 });
    },
  },
  {
    id: 'malfuf', label: 'شعبي سريع', emoji: '⚡', group: 'شعبي', bpm: 134, desc: 'سريع حماسي + قانون',
    build: (c, m, v, n, sec, beat) => {
      drum8(c, m, v, n, sec, beat, MAQSOUM, { hats: true, swing: 0.06 });
      let i = 0;
      for (let t = 0; t < sec - beat * 0.2; t += beat / 2, i++) if (i % 4 === 0) clap(c, m, v, n, t, 0.24);
      const step = beat / 2;
      let k = 0;
      for (let b = beat * 0.5; b < sec - beat; b += step, k++) bass(c, m, v, n, b, NT(146.83, k % 2 ? 3 : 0), step * 0.85, 0.4);
      melodyLine(c, m, v, n, { start: beat * 2, end: sec, beat: beat * 0.85, root: 587.33, scale: HIJAZ, seed: 33, gain: 0.22, inst: 'qanun', restProb: 0.36 });
    },
  },
  {
    id: 'hype', label: 'حماسي', emoji: '🔥', group: 'حماسي', bpm: 120, desc: 'أربع ضربات + تصفيق + پاد',
    build: (c, m, v, n, sec, beat) => {
      let bar = 0;
      for (let t = 0; t < sec - beat * 0.3; t += beat, bar++) {
        kick(c, m, v, n, t, 0.95);
        if (bar % 2 === 1) clap(c, m, v, n, t, 0.32);
        hat(c, m, v, n, t + beat * 0.5, 0.13, bar % 4 === 3);
        hat(c, m, v, n, t + beat * 0.25, 0.06);
      }
      const prog = [0, 0, 3, 5];
      let j = 0;
      for (let t = 0; t < sec - beat; t += beat * 4, j++) pad(c, m, v, n, t, NT(110, prog[j % 4]), beat * 4, 0.1);
      let k = 0;
      for (let b = 0; b < sec - beat; b += beat, k++) bass(c, m, v, n, b, NT(110, k % 4 < 2 ? 0 : 3), beat * 0.8, 0.44);
      riser(c, m, v, n, Math.max(0, sec - 2), 2);
    },
  },
  {
    id: 'epic', label: 'ملحمي', emoji: '🎬', group: 'ملحمي', bpm: 88, desc: 'پاد + ناي بطولي',
    build: (c, m, v, n, sec, beat) => {
      const prog = [0, 3, 5, 3];
      let i = 0;
      for (let t = 0; t < sec; t += beat * 4, i++) {
        const root = NT(146.83, prog[i % 4]);
        pad(c, m, v, n, t, root, beat * 4, 0.13);
        pad(c, m, v, n, t, root * 1.5, beat * 4, 0.09);
        kick(c, m, v, n, t, 0.7);
        kick(c, m, v, n, t + beat * 2, 0.6);
        if (i % 2 === 1) snare(c, m, v, n, t + beat * 2, 0.3);
      }
      melodyLine(c, m, v, n, { start: beat * 2, end: sec, beat: beat * 1.6, root: 293.66, scale: [0, 2, 3, 7, 8], seed: 55, gain: 0.24, inst: 'ney', restProb: 0.45 });
    },
  },
  {
    id: 'calm', label: 'هادي', emoji: '🎩', group: 'ملحمي', bpm: 72, desc: 'أمبيانت ناعم + قانون',
    build: (c, m, v, n, sec, beat) => {
      const prog = [0, 5, 7, 3];
      let i = 0;
      for (let t = 0; t < sec; t += beat * 4, i++) {
        const root = NT(174.61, prog[i % 4]);
        pad(c, m, v, n, t, root, beat * 4, 0.12);
        pad(c, m, v, n, t, root * 2, beat * 4, 0.06);
      }
      melodyLine(c, m, v, n, { start: beat, end: sec, beat: beat * 2, root: 349.23, scale: PENTA, seed: 77, gain: 0.2, inst: 'qanun', restProb: 0.5, swing: 0.1 });
    },
  },
  {
    id: 'drums', label: 'طبلة فقط', emoji: '🥁', group: 'إيقاع', bpm: 104, desc: 'دربوكة بدون لحن',
    build: (c, m, v, n, sec, beat) => drum8(c, m, v, n, sec, beat, MAQSOUM, { riq: true, hats: false, swing: 0.14 }),
  },
  {
    id: 'oud', label: 'عود فقط', emoji: '🎻', group: 'إيقاع', bpm: 100, desc: 'ارتجال عود حجاز',
    build: (c, m, v, n, sec, beat) => {
      melodyLine(c, m, v, n, { start: 0, end: sec, beat, root: 293.66, scale: HIJAZ, seed: 99, gain: 0.32, inst: 'pluck', restProb: 0.22, swing: 0.2 });
    },
  },
  {
    id: 'uplift', label: 'تحفيزي', emoji: '🌅', group: 'حماسي', bpm: 110, desc: 'ماچور مبهج',
    build: (c, m, v, n, sec, beat) => {
      let bar = 0;
      for (let t = 0; t < sec - beat * 0.3; t += beat, bar++) {
        kick(c, m, v, n, t, 0.85);
        if (bar % 4 === 2) clap(c, m, v, n, t, 0.28);
        hat(c, m, v, n, t + beat * 0.5, 0.12);
      }
      const prog = [0, 5, 7, 9];
      let j = 0;
      for (let t = 0; t < sec; t += beat * 4, j++) pad(c, m, v, n, t, NT(130.81, prog[j % 4]), beat * 4, 0.11);
      melodyLine(c, m, v, n, { start: beat * 2, end: sec, beat, root: 523.25, scale: MAJOR, seed: 12, gain: 0.22, inst: 'pluck', restProb: 0.4 });
    },
  },
  {
    id: 'trailer', label: 'تريلر', emoji: '🎥', group: 'ملحمي', bpm: 96, desc: 'تريلر سينمائي متصاعد',
    build: (c, m, v, n, sec, beat) => {
      const prog = [0, 3, 5, 3];
      let i = 0;
      for (let t = 0; t < sec; t += beat * 4, i++) {
        const root = NT(98, prog[i % 4]);
        pad(c, m, v, n, t, root, beat * 4, 0.14);
        pad(c, m, v, n, t, root * 2, beat * 4, 0.05);
      }
      for (let t = 0; t < sec - beat; t += beat * 2) {
        emit(c, m, v, n, { wave: 'sawtooth', freq: NT(98, 0) / 2, t, dur: beat * 1.4, gain: 0.3, atk: 0.01, lp: 520, send: 0.3 });
      }
      let i2 = 0;
      for (let t = 0; t < sec - beat * 0.3; t += beat, i2++) {
        kick(c, m, v, n, t, i2 % 4 === 0 ? 0.95 : 0.7);
        if (i2 % 4 === 2) snare(c, m, v, n, t, 0.32);
      }
      const rollStart = Math.max(0, sec - beat * 4);
      for (let t = rollStart; t < sec - beat * 0.2; t += beat / 4) snare(c, m, v, n, t, 0.14 + 0.24 * ((t - rollStart) / (beat * 4)));
      riser(c, m, v, n, Math.max(0, sec - beat * 3), beat * 3);
      melodyLine(c, m, v, n, { start: beat * 4, end: sec, beat: beat * 1.5, root: 196, scale: [0, 3, 5, 7, 10], seed: 44, gain: 0.2, inst: 'qanun', restProb: 0.5, octUp: 0.3 });
    },
  },
  {
    id: 'celebrate', label: 'احتفالي', emoji: '🎉', group: 'حماسي', bpm: 124, desc: 'احتفال مبهج بالتصفيق',
    build: (c, m, v, n, sec, beat) => {
      drum8(c, m, v, n, sec, beat, MAQSOUM, { riq: true, hats: true, swing: 0.05 });
      let bar = 0;
      for (let t = 0; t < sec - beat * 0.3; t += beat, bar++) {
        kick(c, m, v, n, t, 0.9);
        if (bar % 4 === 3) clap(c, m, v, n, t, 0.3);
      }
      const prog = [0, 4, 5, 7];
      let j = 0;
      for (let t = 0; t < sec; t += beat * 4, j++) pad(c, m, v, n, t, NT(130.81, prog[j % 4]), beat * 4, 0.1);
      melodyLine(c, m, v, n, { start: beat, end: sec, beat: beat * 0.5, root: 523.25, scale: MAJOR, seed: 88, gain: 0.2, inst: 'pluck', restProb: 0.42, octUp: 0.25 });
    },
  },
  {
    id: 'chill', label: 'استرخاء', emoji: '🌙', group: 'ملحمي', bpm: 76, desc: 'هادئ ناعم للاستعراض',
    build: (c, m, v, n, sec, beat) => {
      const prog = [0, 5, 3, 7];
      let i = 0;
      for (let t = 0; t < sec; t += beat * 4, i++) {
        const root = NT(174.61, prog[i % 4]);
        pad(c, m, v, n, t, root, beat * 4, 0.11);
        pad(c, m, v, n, t, root * 1.5, beat * 4, 0.07);
      }
      melodyLine(c, m, v, n, { start: beat * 2, end: sec, beat: beat * 1.5, root: 349.23, scale: PENTA, seed: 12, gain: 0.18, inst: 'qanun', restProb: 0.55, swing: 0.08 });
      melodyLine(c, m, v, n, { start: beat * 4, end: sec, beat: beat * 2, root: 261.63, scale: PENTA, seed: 34, gain: 0.12, inst: 'ney', restProb: 0.6 });
    },
  },
];

const cache = new Map<string, AudioBuffer>();
export async function renderTrack(id: string, seconds = 20, sr = 44100): Promise<AudioBuffer> {
  const key = `${id}:${seconds}:${sr}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const tr = MUSIC_TRACKS.find(t => t.id === id);
  if (!tr) throw new Error('track not found');
  const buf = await render(tr.bpm, seconds, tr.build, sr);
  cache.set(key, buf);
  return buf;
}

// كشف الضربات (onsets) من الصوت لحساب مزامنة الإيقاع مع القطعات والانتقالات.
export function detectBeats(buffer: AudioBuffer, opts?: { minGap?: number; sensitivity?: number }): number[] {
  const sr = buffer.sampleRate;
  const frame = 1024, hop = 512;
  const mono = (offset: number) => {
    const d = buffer.getChannelData(offset);
    return d;
  };
  const nCh = Math.min(2, buffer.numberOfChannels);
  const nFrames = Math.max(1, Math.floor((buffer.length - frame) / hop));
  const energy = new Float32Array(nFrames);
  for (let c = 0; c < nCh; c++) {
    const d = mono(c);
    for (let i = 0; i < nFrames; i++) {
      let e = 0; const off = i * hop;
      for (let j = 0; j < frame; j++) { const v = d[off + j]; e += v * v; }
      energy[i] += Math.sqrt(e / frame) / nCh;
    }
  }
  const novelty = new Float32Array(nFrames);
  for (let i = 1; i < nFrames; i++) novelty[i] = Math.max(0, energy[i] - energy[i - 1]);
  const sm = new Float32Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    let s = 0, c = 0;
    for (let k = -2; k <= 2; k++) { const idx = i + k; if (idx >= 0 && idx < nFrames) { s += novelty[idx]; c++; } }
    sm[i] = s / c;
  }
  const minGap = opts?.minGap ?? 0.22;
  const sens = opts?.sensitivity ?? 1.4;
  const win = Math.round(1.0 * sr / hop);
  const times: number[] = [];
  let lastT = -Infinity;
  for (let i = win; i < nFrames - win; i++) {
    let sum = 0;
    for (let k = i - win; k <= i + win; k++) sum += sm[k];
    const thr = (sum / (2 * win + 1)) * sens + 1e-4;
    if (sm[i] >= sm[i - 1] && sm[i] >= sm[i + 1] && sm[i] > thr && (i * hop) / sr - lastT >= minGap) {
      const t = (i * hop) / sr;
      times.push(t);
      lastT = t;
    }
  }
  return times;
}

// يبني نقاط قطع (كسور من المدة الكلية) متزامنة مع الضربات لعدد صور معيّن.
export function beatCuts(beats: number[], duration: number, imageCount: number): number[] | null {
  if (imageCount < 2) return null;
  const need = imageCount - 1;
  const inRange = beats.filter(t => t > duration * 0.08 && t < duration * 0.97);
  if (inRange.length < need) return null;
  const cuts: number[] = [];
  for (let i = 0; i < need; i++) {
    const idx = Math.round((i + 1) * (inRange.length - 1) / need);
    cuts.push(Math.min(0.98, Math.max(0.02, inRange[idx] / duration)));
  }
  cuts.sort((a, b) => a - b);
  return cuts;
}

