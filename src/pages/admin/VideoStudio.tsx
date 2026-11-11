import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Film, Music, Image as ImageIcon, Play, Square, Download, Loader2, Volume2, X, Sparkles, Pause } from 'lucide-react';
import type { Listing } from '../../types';
import { MUSIC_TRACKS, renderTrack, detectBeats, beatCuts, type MusicTrack } from '../../lib/musicLibrary';
import { displayPrice } from '../../lib/utils';
import {
  ARABIC_FONTS, ensureFontsLoaded, drawTextLayers, drawParticles, drawLightLeak,
  drawFlare, drawGlitch, drawFilmBurn, applyGrade, newLayer,
  type TextLayer, type TextBox, type FxConfig, type Grade,
} from '../../lib/videoFx';
import { prepare2_5D, draw2_5D, type DepthLayers } from '../../lib/depth3d';
import { renderMp4Video, supportsMP4, mp4Dims } from '../../lib/videoExport';

type Toast = (m: string, t?: any) => void;

// ── easings ──────────────────────────────────────────────────────────
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBounce = (t: number) => {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

type Motion = { scale: number; dx?: number; dy?: number; rot?: number; blur?: number; vig?: number; grain?: number; sat?: number; con?: number; bar?: boolean };

const PRESETS: { id: string; label: string; emoji: string; group: string; draw: (t: number, h: number) => Motion }[] = [
  { id: 'kenburns',  group: 'زوم',   label: 'تكبير هادي', emoji: '🔍', draw: t => ({ scale: 1.05 + 0.17 * easeInOut(t) }) },
  { id: 'kenburnsOut', group: 'زوم', label: 'تصغير هادي', emoji: '🔭', draw: t => ({ scale: 1.28 - 0.2 * easeInOut(t) }) },
  { id: 'dollyIn',   group: 'زوم',   label: 'دولي داخل',  emoji: '🎥', draw: t => ({ scale: 1 + 0.45 * easeInOut(t), vig: 0.3 }) },
  { id: 'dollyOut',  group: 'زوم',   label: 'دولي خارج',  emoji: '🎞️', draw: t => ({ scale: 1.5 - 0.42 * easeInOut(t), vig: 0.3 }) },
  { id: 'zoomPunch', group: 'زوم',   label: 'بانش',       emoji: '💥', draw: t => ({ scale: 1.05 + 0.5 * (1 - easeOut(Math.min(t * 2.2, 1))) + 0.05 * easeInOut(t), vig: 0.35 }) },
  { id: 'drone',     group: 'درون',  label: 'طيران درون', emoji: '🚁', draw: (t, h) => ({ scale: 1.12 + 0.36 * easeInOut(t), dy: -h * 0.06 * easeInOut(t), rot: 1.4 * Math.sin(t * Math.PI), vig: 0.35 }) },
  { id: 'droneUp',   group: 'درون',  label: 'درون لأعلى', emoji: '🛸', draw: (t, h) => ({ scale: 1.15 + 0.3 * easeInOut(t), dy: h * 0.06 * (1 - easeInOut(t)) - h * 0.06, vig: 0.32 }) },
  { id: 'orbit',     group: 'درون',  label: 'دوران ٣٦٠',  emoji: '🔄', draw: t => ({ scale: 1.2, dx: 44 * Math.sin(t * Math.PI * 2), rot: 1.4 * Math.sin(t * Math.PI * 2), vig: 0.38 }) },
  { id: 'orbitFast', group: 'درون',  label: 'دوران سريع', emoji: '🌀', draw: t => ({ scale: 1.22, dx: 60 * Math.sin(t * Math.PI * 4), rot: 2.2 * Math.sin(t * Math.PI * 4), vig: 0.42 }) },
  { id: 'panRight',  group: 'پان',   label: 'پان يمين',   emoji: '➡️', draw: t => ({ scale: 1.24, dx: -65 + 130 * easeInOut(t) }) },
  { id: 'panLeft',   group: 'پان',   label: 'پان شمال',   emoji: '⬅️', draw: t => ({ scale: 1.24, dx: 65 - 130 * easeInOut(t) }) },
  { id: 'tiltUp',    group: 'پان',   label: 'تِلت فوق',   emoji: '⬆️', draw: (t, h) => ({ scale: 1.22, dy: h * 0.05 - h * 0.1 * easeInOut(t) }) },
  { id: 'tiltDown',  group: 'پان',   label: 'تِلت تحت',   emoji: '⬇️', draw: (t, h) => ({ scale: 1.22, dy: -h * 0.05 + h * 0.1 * easeInOut(t) }) },
  { id: 'parallax',  group: 'پان',   label: 'پارالاكس',   emoji: '🏙️', draw: t => ({ scale: 1.3, dx: 45 * Math.sin(t * Math.PI), rot: -1.5 + 3 * t }) },
  { id: 'swing',     group: 'إبداعي', label: 'سوينج',     emoji: '🎬', draw: t => ({ scale: 1.2, rot: -3 + 6 * easeInOut(t), dx: 28 * Math.sin(t * Math.PI) }) },
  { id: 'handheld',  group: 'إبداعي', label: 'كاميرا يد', emoji: '📹', draw: t => ({ scale: 1.16, dx: 7 * Math.sin(t * 9 * Math.PI), dy: 7 * Math.cos(t * 7 * Math.PI), rot: 0.6 * Math.sin(t * 5 * Math.PI) }) },
  { id: 'bounce',    group: 'إبداعي', label: 'بونس',      emoji: '🏀', draw: t => ({ scale: 1.06 + 0.34 * easeOutBounce(t) }) },
  { id: 'speedramp', group: 'سينما', label: 'سبيد رامب',  emoji: '⚡', draw: t => ({ scale: 1.06 + 0.34 * easeInOut(t), blur: 7 * (1 - easeOut(t)) }) },
  { id: 'focuspull', group: 'سينما', label: 'سحب فوكس',   emoji: '🎯', draw: t => ({ scale: 1.1 + 0.14 * easeInOut(t), blur: 18 * (1 - easeOut(t)) }) },
  { id: 'epic',      group: 'سينما', label: 'مشهد ملحمي', emoji: '🎞️', draw: t => ({ scale: 1.1 + 0.34 * easeInOut(t), rot: -1.6 + 3.2 * easeInOut(t), vig: 0.5, grain: 0.07, sat: 1.15, con: 1.1, bar: true }) },
  { id: 'vortex',    group: 'إبداعي', label: 'دوامة',     emoji: '🌪️', draw: t => ({ scale: 1.15 + 0.25 * easeInOut(t), rot: 360 * easeInOut(t), dx: 30 * Math.sin(t * Math.PI * 3), vig: 0.3 }) },
  { id: 'float',     group: 'پان',     label: 'تعويم',     emoji: '🪶', draw: (t, h) => ({ scale: 1.12, dy: h * 0.04 * Math.sin(t * Math.PI * 2), dx: 20 * Math.sin(t * Math.PI), rot: 1.2 * Math.sin(t * Math.PI) }) },
  { id: 'crash',     group: 'سينما', label: 'كرش زوم',   emoji: '💥', draw: t => ({ scale: 1 + 0.6 * (1 - easeOut(Math.min(t * 1.5, 1))), blur: 12 * (1 - easeOut(t)), vig: 0.4 }) },
  { id: 'glide',     group: 'پان',     label: 'گلاید',     emoji: '🌊', draw: t => ({ scale: 1.18, dx: -40 + 80 * easeInOut(t), dy: -20 + 40 * easeInOut(t) }) },
  { id: 'pulse',     group: 'زوم',     label: 'نبض',       emoji: '💓', draw: t => ({ scale: 1.08 + 0.12 * Math.sin(t * Math.PI * 6), vig: 0.2 }) },
  { id: 'reveal',    group: 'سينما', label: 'كشف',       emoji: '🎭', draw: t => ({ scale: 1.3 - 0.25 * easeInOut(t), blur: 20 * (1 - easeOut(t)), vig: 0.45 }) },
  { id: 'spin',      group: 'إبداعي', label: 'دوران',     emoji: '🔄', draw: t => ({ scale: 1.2, rot: 360 * t, dx: 0, vig: 0.35 }) },
  { id: 'dramatic',  group: 'سينما', label: 'دراماتيكي', emoji: '🎬', draw: t => ({ scale: 1.05 + 0.4 * easeInOut(t), rot: -2 + 4 * easeInOut(t), vig: 0.55, grain: 0.08, sat: 1.2, con: 1.15, bar: true }) },
  { id: 'smooth',    group: 'زوم',     label: 'ناعم',      emoji: '🌊', draw: t => ({ scale: 1.06 + 0.12 * easeInOut(t), blur: 3 * (1 - easeOut(t)), vig: 0.15 }) },
];

const TRANSITIONS = [
  { id: 'fade',     label: 'ديزولف',  emoji: '🌫️' },
  { id: 'slideR',   label: 'انزلاق',  emoji: '👉' },
  { id: 'slideL',   label: 'انزلاق عكسي', emoji: '👈' },
  { id: 'zoomBlur', label: 'زوم بلور', emoji: '💫' },
  { id: 'whip',     label: 'ويب پان', emoji: '🎯' },
  { id: 'maskCircle', label: 'دايرة', emoji: '⭕' },
  { id: 'glitch',   label: 'جليتش',   emoji: '📺' },
  { id: 'none',     label: 'قطع حاد', emoji: '✂️' },
  { id: 'wipe',     label: 'مسح',     emoji: '🧹' },
  { id: 'iris',     label: 'قزحية',   emoji: '👁️' },
  { id: 'push',     label: 'دفع',     emoji: '➡️' },
  { id: 'cube',     label: 'مكعب',    emoji: '🧊' },
  { id: 'flip',     label: 'قلب',     emoji: '🔄' },
];

const EXTERNAL_TRACKS = [
  { label: 'شعبي عراقي (Pixabay)', url: 'https://pixabay.com/music/search/iraqi%20traditional/', emoji: '🪘' },
  { label: 'دربوكة/طبلة (Pixabay)', url: 'https://pixabay.com/music/search/darbuka/', emoji: '🥁' },
  { label: 'عود/ناي (Pixabay)', url: 'https://pixabay.com/music/search/oud%20nay/', emoji: '🎸' },
  { label: 'تحفيزي (Pixabay)', url: 'https://pixabay.com/music/search/motivational%20arabic/', emoji: '🔥' },
  { label: 'هادي (Pixabay)', url: 'https://pixabay.com/music/search/calm%20arabic/', emoji: '☕' },
  { label: 'Chosic (كل الأنواع)', url: 'https://www.chosic.com/ar/free-music/all/', emoji: '🎵' },
  { label: 'Chosic (شعبي)', url: 'https://www.chosic.com/ar/free-music/genre/folk/', emoji: '🪘' },
  { label: 'Chosic (تحفيزي)', url: 'https://www.chosic.com/ar/free-music/mood/energetic/', emoji: '🔥' },
];
const TEXT_STYLES = [
  { id: 'rise',  label: 'طلوع' },
  { id: 'scale', label: 'تكبير' },
  { id: 'slide', label: 'انزلاق' },
  { id: 'none',  label: 'ثابت' },
  { id: 'fade',  label: 'تلاشي' },
  { id: 'bounce', label: 'ارتداد' },
  { id: 'typewriter', label: 'كتابة' },
  { id: 'pop', label: 'POP' },
  { id: 'glow', label: 'توهج' },
  { id: 'shake', label: 'اهتزاز' },
];

type DepthMode = 'off' | 'ai' | 'proc';
type Template = {
  id: string; label: string; emoji: string; desc: string;
  preset: string; trans: string; style: string; dur: number;
  grade: Grade; fx: Partial<FxConfig>; depth: DepthMode;
  music?: string; beatSync?: boolean; aspect?: string;
};

const TEMPLATES: Template[] = [
  { id: 'reels',      label: 'ريلز سينمائي', emoji: '🎞️', desc: 'درون + عمق 2.5D + تسريب ضوء',  preset: 'drone',     trans: 'zoomBlur', style: 'scale', dur: 8,  grade: 'teal', fx: { lightLeak: true }, depth: 'proc', music: 'epic' },
  { id: 'quick',      label: 'عرض سريع',    emoji: '⚡', desc: 'بانش سريع مقطوع على الإيقاع',   preset: 'zoomPunch', trans: 'whip',     style: 'rise',  dur: 6,  grade: 'none', fx: {}, depth: 'off', music: 'hype', beatSync: true },
  { id: 'calm',       label: 'هادي راقي',   emoji: '🎩', desc: 'زوم ناعم وألوان دافئة',          preset: 'kenburns',  trans: 'fade',     style: 'rise',  dur: 12, grade: 'warm', fx: {}, depth: 'off', music: 'calm' },
  { id: 'car',        label: 'سيارة رياضية', emoji: '🏎️', desc: 'سوينج + لمعة عدسة',            preset: 'swing',     trans: 'zoomBlur', style: 'scale', dur: 9,  grade: 'cool', fx: { flare: true }, depth: 'proc', music: 'hype' },
  { id: 'epic',       label: 'ملحمي',        emoji: '🎬', desc: 'مشهد ملحمي + شريط سينما',       preset: 'epic',      trans: 'zoomBlur', style: 'scale', dur: 10, grade: 'teal', fx: { flare: true, filmBurn: true }, depth: 'proc', music: 'epic' },
  { id: 'realestate', label: 'عقار فاخر',   emoji: '🏠', desc: 'پارالاكس + عمق ذكي',            preset: 'parallax',  trans: 'fade',     style: 'rise',  dur: 14, grade: 'warm', fx: {}, depth: 'ai', music: 'calm' },
  { id: 'equipment',  label: 'سيارات وشغل',  emoji: '🚧', desc: 'كاميرا يد + إيقاع دربوكة',      preset: 'handheld',  trans: 'whip',     style: 'rise',  dur: 8,  grade: 'cool', fx: {}, depth: 'off', music: 'drums' },
  { id: 'shop',       label: 'تخفيضات وسوق', emoji: '🛍️', desc: 'نغم مبهج + بَرَد + قطع على الضرب', preset: 'zoomPunch', trans: 'slideR', style: 'scale', dur: 7,  grade: 'warm', fx: { particles: true }, depth: 'off', music: 'uplift', beatSync: true },
  { id: 'food',       label: 'مطاعم وأكل',  emoji: '🍽️', desc: 'دولي هادي وألوان دافئة',        preset: 'dollyIn',   trans: 'fade',     style: 'rise',  dur: 8,  grade: 'warm', fx: {}, depth: 'proc', music: 'maqsoum' },
  { id: 'fashion',    label: 'أزياء وبيوتي', emoji: '✨', desc: 'تصغير أنيق + بَرَد ناعم',      preset: 'kenburnsOut', trans: 'zoomBlur', style: 'scale', dur: 8, grade: 'warm', fx: { particles: true }, depth: 'proc', music: 'calm' },
  { id: 'story',      label: 'ستوري شعبي',  emoji: '🪘', desc: 'دوران + قطع على الضربات',       preset: 'orbit',     trans: 'slideR',   style: 'rise',  dur: 9,  grade: 'teal', fx: {}, depth: 'proc', music: 'maqsoum', beatSync: true },
  { id: 'square',     label: 'مربع سوشيال', emoji: '◼️', desc: 'مقاس مربع + نغم تحفيزي',        preset: 'tiltUp',    trans: 'fade',     style: 'rise',  dur: 10, grade: 'none', fx: {}, depth: 'off', music: 'uplift', aspect: '1:1' },
  { id: 'iraqi-pop',   label: 'شعبي عراقي',   emoji: '🪘', desc: 'دوران + إيقاع دربوكة + نص طلوع', preset: 'orbit',     trans: 'whip',     style: 'rise',  dur: 9,  grade: 'teal', fx: { particles: true }, depth: 'proc', music: 'maqsoum', beatSync: true },
  { id: 'motivate',    label: 'تحفيزي',       emoji: '🔥', desc: 'بانش + توهج + إيقاع سريع',     preset: 'zoomPunch', trans: 'whip',     style: 'pop',   dur: 7,  grade: 'cool', fx: { flare: true, particles: true }, depth: 'off', music: 'hype', beatSync: true },
  { id: 'calm-iraqi',  label: 'هادي عراقي',   emoji: '☕', desc: 'زوم ناعم + نغم هادي + تلاشي',   preset: 'kenburns',  trans: 'fade',     style: 'fade',  dur: 12, grade: 'warm', fx: {}, depth: 'off', music: 'calm' },
  { id: 'luxury-car',  label: 'سيارة فاخرة',  emoji: '👑', desc: 'تصغير أنيق + لمعة + دافئ',     preset: 'kenburnsOut', trans: 'zoomBlur', style: 'scale', dur: 10, grade: 'warm', fx: { flare: true }, depth: 'proc', music: 'calm' },
  { id: 'heavy-eq',    label: 'سيارات',  emoji: '🚧', desc: 'كاميرا يد + إيقاع + بَرَد',     preset: 'handheld',  trans: 'whip',     style: 'rise',  dur: 8,  grade: 'cool', fx: { particles: true }, depth: 'off', music: 'drums', beatSync: true },
  { id: 'real-estate', label: 'عقار فاخر',    emoji: '🏠', desc: 'پارالاكس + عمق ذكي + هادي',     preset: 'parallax',  trans: 'fade',     style: 'rise',  dur: 14, grade: 'warm', fx: {}, depth: 'ai', music: 'calm' },
  { id: 'food',        label: 'مطاعم وأكل',   emoji: '🍽️', desc: 'دولي هادي + ألوان دافئة',      preset: 'dollyIn',   trans: 'fade',     style: 'rise',  dur: 8,  grade: 'warm', fx: {}, depth: 'proc', music: 'maqsoum' },
  { id: 'fashion',     label: 'أزياء وبيوتي', emoji: '✨', desc: 'تصغير أنيق + بَرَد ناعم',      preset: 'kenburnsOut', trans: 'zoomBlur', style: 'scale', dur: 8, grade: 'warm', fx: { particles: true }, depth: 'proc', music: 'calm' },
  { id: 'story-pop',   label: 'ستوري شعبي',   emoji: '🪘', desc: 'دوران + قطع على الضربات',       preset: 'orbitFast', trans: 'slideR',   style: 'rise',  dur: 9,  grade: 'teal', fx: {}, depth: 'proc', music: 'maqsoum', beatSync: true },
  { id: 'square-pop',  label: 'مربع سوشيال',  emoji: '◼️', desc: 'مقاس مربع + نغم تحفيزي',        preset: 'tiltUp',    trans: 'fade',     style: 'pop',   dur: 10, grade: 'none', fx: {}, depth: 'off', music: 'uplift', aspect: '1:1' },
  { id: 'epic-cinema', label: 'ملحمي سينما',  emoji: '🎬', desc: 'مشهد ملحمي + شريط سينما',      preset: 'epic',      trans: 'zoomBlur', style: 'scale', dur: 10, grade: 'teal', fx: { flare: true, filmBurn: true }, depth: 'proc', music: 'epic' },
  { id: 'quick-sale',  label: 'عرض سريع',     emoji: '⚡', desc: 'بانش سريع مقطوع على الإيقاع',  preset: 'zoomPunch', trans: 'whip',     style: 'rise',  dur: 6,  grade: 'none', fx: {}, depth: 'off', music: 'hype', beatSync: true },
  { id: 'calm-lux',    label: 'هادي راقي',    emoji: '🎩', desc: 'زوم ناعم وألوان دافئة',        preset: 'kenburns',  trans: 'fade',     style: 'fade',  dur: 12, grade: 'warm', fx: {}, depth: 'off', music: 'calm' },
  { id: 'drone-view',  label: 'عرض درون',     emoji: '🚁', desc: 'طيران درون + عمق',             preset: 'drone',     trans: 'zoomBlur', style: 'scale', dur: 8,  grade: 'teal', fx: { lightLeak: true }, depth: 'proc', music: 'epic' },
];

const ASPECTS = [
  { id: '9:16', label: 'ريلز / ستوري', w: 720, h: 1280 },
  { id: '1:1',  label: 'مربع',         w: 720, h: 720 },
  { id: '16:9', label: 'أفقي',          w: 1280, h: 720 },
];

let noiseCanvas: HTMLCanvasElement | null = null;
function getNoise() {
  if (noiseCanvas) return noiseCanvas;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const d = x.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 128 + (Math.random() * 90 - 45);
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  noiseCanvas = c;
  return c;
}

const imgCache = new Map<string, HTMLImageElement>();
function loadImage(url: string): Promise<HTMLImageElement> {
  const hit = imgCache.get(url);
  if (hit && hit.complete && hit.naturalWidth) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imgCache.set(url, img); resolve(img); };
    img.onerror = () => reject(new Error('تعذر تحميل الصورة'));
    img.src = url;
  });
}

function coverGeom(img: HTMLImageElement, w: number, h: number) {
  const ir = img.width / img.height, cr = w / h;
  let dw: number, dh: number;
  if (ir > cr) { dh = h; dw = h * ir; } else { dw = w; dh = w / ir; }
  return { dw, dh };
}

function applyImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, s: Motion, extraFilter = '', fit: FitMode = 'cover') {
  if (fit === 'auto') {
    const ar = (img.width / img.height) / (w / h);
    fit = Math.abs(Math.log(ar)) < 0.22 ? 'cover' : 'contain';
  }
  const filtBase = `blur(${(s.blur || 0).toFixed(2)}px) saturate(${s.sat || 1}) contrast(${s.con || 1})`;
  if (fit === 'contain') {
    const g = coverGeom(img, w, h);
    const z = 1.22;
    ctx.save();
    ctx.filter = `${extraFilter} blur(40px) saturate(1.1) brightness(0.5)`.trim();
    ctx.drawImage(img, w / 2 - (g.dw * z) / 2, h / 2 - (g.dh * z) / 2, g.dw * z, g.dh * z);
    ctx.restore();
    const ir = img.width / img.height, cr = w / h;
    let dw: number, dh: number;
    if (ir > cr) { dw = w; dh = w / ir; } else { dh = h; dw = h * ir; }
    const k = 0.92 + Math.max(0, s.scale - 1) * 0.5;
    ctx.save();
    ctx.filter = `${extraFilter} ${filtBase}`.trim();
    ctx.translate(w / 2 + (s.dx || 0), h / 2 + (s.dy || 0));
    ctx.rotate(((s.rot || 0) * Math.PI) / 180);
    ctx.scale(k, k);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.filter = `${extraFilter} ${filtBase}`.trim();
  ctx.translate(w / 2 + (s.dx || 0), h / 2 + (s.dy || 0));
  ctx.rotate(((s.rot || 0) * Math.PI) / 180);
  ctx.scale(s.scale, s.scale);
  const g = coverGeom(img, w, h);
  ctx.drawImage(img, -g.dw / 2, -g.dh / 2, g.dw, g.dh);
  ctx.restore();
}

type FitMode = 'cover' | 'contain' | 'auto';
function m_apply(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, s: Motion, fit: FitMode, extra?: string) {
  applyImage(ctx, img, w, h, s, extra, fit);
}

function drawTransition(ctx: CanvasRenderingContext2D, a: HTMLImageElement, b: HTMLImageElement, q: number, type: string, w: number, h: number, sa: Motion, sb: Motion, fit: FitMode) {
  const A = (extra?: string) => m_apply(ctx, a, w, h, sa, fit, extra);
  const B = (extra?: string) => m_apply(ctx, b, w, h, sb, fit, extra);
  if (type === 'slideR') {
    ctx.save(); ctx.translate(-w * q, 0); A(); ctx.restore();
    ctx.save(); ctx.translate(w * (1 - q), 0); B(); ctx.restore();
  } else if (type === 'slideL') {
    ctx.save(); ctx.translate(w * q, 0); A(); ctx.restore();
    ctx.save(); ctx.translate(-w * (1 - q), 0); B(); ctx.restore();
  } else if (type === 'zoomBlur') {
    ctx.save(); ctx.globalAlpha = 1 - q; ctx.translate(w / 2, h / 2); const za = 1 + 0.4 * q; ctx.scale(za, za); ctx.translate(-w / 2, -h / 2); A(`blur(${(14 * q).toFixed(1)}px)`); ctx.restore();
    ctx.save(); ctx.globalAlpha = q; ctx.translate(w / 2, h / 2); const zb = 1.4 - 0.4 * easeOut(q); ctx.scale(zb, zb); ctx.translate(-w / 2, -h / 2); B(`blur(${(12 * (1 - q)).toFixed(1)}px)`); ctx.restore();
  } else if (type === 'whip') {
    const off = (q < 0.5 ? q : (1 - q)) * w * 1.3;
    ctx.save(); ctx.translate(off, 0); A(`blur(${(Math.abs(q - 0.5) * 26).toFixed(1)}px)`); ctx.restore();
    if (q > 0.5) { ctx.save(); ctx.translate(off, 0); B(`blur(${(Math.abs(q - 0.5) * 26).toFixed(1)}px)`); ctx.restore(); }
  } else if (type === 'maskCircle') {
    A();
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.hypot(w, h) * 0.5 * q, 0, Math.PI * 2);
    ctx.clip();
    B();
    ctx.restore();
  } else if (type === 'glitch') {
    if (q < 0.5) A(); else B();
    for (let i = 0; i < 10; i++) {
      const sy = Math.random() * h;
      const sh = h * 0.02 + Math.random() * h * 0.04;
      const dx = (Math.random() * 2 - 1) * w * 0.05;
      ctx.drawImage(ctx.canvas, 0, sy, w, sh, dx, sy, w, sh);
    }
  } else if (type === 'none') {
    if (q < 0.5) A(); else B();
  } else {
    ctx.save(); ctx.globalAlpha = 1 - q; A(); ctx.restore();
    ctx.save(); ctx.globalAlpha = q; B(); ctx.restore();
  }
}

type OvLine = { text: string; color: string; size: number; weight: string };
function drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, lines: OvLine[], site: boolean, p: number, style: string) {
  const a = Math.min(p / 0.07, 1) * (p > 0.93 ? Math.max(0, (1 - p) / 0.07) : 1);
  if (a <= 0) return;
  const base = w * 0.05;
  const gh = Math.min(h * 0.55, lines.length * base * 1.4 + h * 0.14);
  const g = ctx.createLinearGradient(0, h - gh, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.86)');
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.fillRect(0, h - gh, w, gh);
  (ctx as any).direction = 'rtl';
  ctx.textAlign = 'center';
  const prog = Math.min(p / 0.32, 1);
  let y = h - h * 0.045;
  for (const ln of lines) {
    const size = Math.round(base * ln.size);
    ctx.font = `${ln.weight} ${size}px Tahoma, Arial, sans-serif`;
    ctx.fillStyle = ln.color;
    let x = w / 2, dy = 0, sc = 1;
    if (style === 'rise') dy = (1 - easeOut(prog)) * size * 1.6;
    else if (style === 'scale') sc = 0.6 + 0.4 * easeOut(prog);
    else if (style === 'slide') x = w / 2 + (1 - easeOut(prog)) * w * 0.45;
    ctx.save();
    ctx.translate(x, y + dy);
    ctx.scale(sc, sc);
    ctx.fillText(ln.text, 0, 0);
    ctx.restore();
    y -= size * 1.35;
  }
  if (site) {
    ctx.direction = 'ltr'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `bold ${Math.round(base * 0.5)}px Arial, sans-serif`;
    ctx.fillText('carmasr-app.vercel.app', w * 0.03, h * 0.065);
  }
  ctx.restore();
}

function drawFrame(
  ctx: CanvasRenderingContext2D, imgs: HTMLImageElement[], preset: (typeof PRESETS)[number],
  trans: string, style: string, p: number, w: number, h: number, lines: OvLine[], site: boolean, fit: FitMode,
  layers: TextLayer[], fx: FxConfig, grade: Grade, dur: number, cuts: number[] | null,
  boxes: TextBox[] | undefined, depthArr: (DepthLayers | undefined)[] | undefined, depthStrength: number,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const n = imgs.length;
  const fadeFrac = trans === 'none' ? 0 : 0.22;
  let idx: number, local: number;
  if (cuts && cuts.length === n - 1) {
    let i = 0; while (i < cuts.length && p >= cuts[i]) i++;
    idx = Math.min(i, n - 1);
    const s0 = idx === 0 ? 0 : cuts[idx - 1];
    const e0 = idx === n - 1 ? 1 : cuts[idx];
    local = (p - s0) / Math.max(1e-4, e0 - s0);
  } else {
    const seg = 1 / n;
    idx = Math.min(Math.floor(p / seg), n - 1);
    local = n === 1 ? p : (p - idx * seg) / seg;
  }
  local = Math.min(1, Math.max(0, local));
  const ml = fadeFrac > 0 ? Math.min(local / (1 - fadeFrac), 1) : local;
  const inTrans = n > 1 && fadeFrac > 0 && local > 1 - fadeFrac && idx < n - 1;
  if (inTrans) {
    const q = (local - (1 - fadeFrac)) / fadeFrac;
    drawTransition(ctx, imgs[idx], imgs[idx + 1], q, trans, w, h, preset.draw(1, h), preset.draw(0, h), fit);
  } else if (depthArr && depthArr[idx]) {
    draw2_5D(ctx, depthArr[idx]!, w, h, p, depthStrength);
  } else {
    applyImage(ctx, imgs[idx], w, h, preset.draw(ml, h), '', fit);
  }
  const s = preset.draw(inTrans ? 0.5 : ml, h);
  if (s.vig) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${s.vig})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  if (s.grain) {
    const nc = getNoise();
    ctx.save();
    ctx.globalAlpha = s.grain;
    ctx.globalCompositeOperation = 'overlay';
    const ox = (Math.random() * 128) | 0, oy = (Math.random() * 128) | 0;
    for (let x = -ox; x < w; x += 128) for (let y = -oy; y < h; y += 128) ctx.drawImage(nc, x, y);
    ctx.restore();
  }
  if (s.bar) {
    const bh = h * 0.06;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, bh);
    ctx.fillRect(0, h - bh, w, bh);
  }
  applyGrade(ctx, w, h, grade);
  if (fx.particles) drawParticles(ctx, w, h, p);
  if (fx.lightLeak) drawLightLeak(ctx, w, h, p);
  if (fx.flare) drawFlare(ctx, w, h, p);
  if (fx.glitch) drawGlitch(ctx, w, h, p, 0.5);
  if (fx.filmBurn) drawFilmBurn(ctx, w, h, p);
  drawOverlay(ctx, w, h, lines, site, p, style);
  drawTextLayers(ctx, w, h, layers, p, dur, boxes);
}

const MIMES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
function pickMime() { return MIMES.find(m => (window as any).MediaRecorder?.isTypeSupported?.(m)) || ''; }

// يحاول جلب ملف الصوت مباشرة، ولو اتمنع بسبب CORS يمرّ عبر بروكسي الموقع (نفس الأصل) — حد ~4 م.ب.
async function fetchAudioBuffer(url: string): Promise<ArrayBuffer> {
  try {
    const res = await fetch(url);
    if (res.ok) return await res.arrayBuffer();
  } catch { /* CORS أو شبكة — نكمل للبروكسي */ }
  const res = await fetch(`/api/og-image?audio=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(res.status === 413 ? 'TOO_BIG' : 'PROXY');
  return await res.arrayBuffer();
}

function clip(s: string, n: number) { s = (s || '').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function priceLine(l: Listing) {
  if (l.listingType === 'rent') {
    if (Number(l.dailyPrice) > 0) return `${Number(l.dailyPrice).toLocaleString('en-US')} جنيه / يوم`;
    if (Number(l.monthlyPrice) > 0) return `${Number(l.monthlyPrice).toLocaleString('en-US')} جنيه / شهر`;
    if (Number(l.weeklyPrice) > 0) return `${Number(l.weeklyPrice).toLocaleString('en-US')} جنيه / أسبوع`;
  }
  return displayPrice(l.price, l.priceType);
}

export default function VideoStudio({ listings, toast }: { listings: Listing[]; toast: Toast }) {
  const withImages = useMemo(() => (listings || []).filter(l => (l.images || []).length > 0), [listings]);
  const [selectedId, setSelectedId] = useState('');
  const [presetId, setPresetId] = useState('kenburns');
  const [transId, setTransId] = useState('fade');
  const [styleId, setStyleId] = useState('rise');
  const [aspectId, setAspectId] = useState('9:16');
  const [fitId, setFitId] = useState<FitMode>('auto');
  const [duration, setDuration] = useState(8);
  const durationRef = useRef(8);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [ov, setOv] = useState({ title: true, price: true, gov: true, advertiser: true, phone: true, site: true });
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioName, setAudioName] = useState('');
  const [musicTrackId, setMusicTrackId] = useState('');
  const [musicLoading, setMusicLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewP, setPreviewP] = useState(0.35);
  const [volume, setVolume] = useState(0.7);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState('');
  const [previewTick, setPreviewTick] = useState(0);
  const [showAllMoves, setShowAllMoves] = useState(false);
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [fx, setFx] = useState<FxConfig>({ particles: false, lightLeak: false, flare: false, glitch: false, filmBurn: false });
  const [grade, setGrade] = useState<Grade>('none');
  const [beatSync, setBeatSync] = useState(false);
  const [beats, setBeats] = useState<number[] | null>(null);
  const [depthMode, setDepthMode] = useState<'off' | 'ai' | 'proc'>('off');
  const [depthPrepared, setDepthPrepared] = useState(0);
  const [depthLoading, setDepthLoading] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState('');
  const [mp4Busy, setMp4Busy] = useState(false);
  const [mp3Url, setMp3Url] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const cancelRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const previewSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const boxesRef = useRef<TextBox[]>([]);
  const depthMapRef = useRef<Map<string, DepthLayers>>(new Map());
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);

  const selected = useMemo(() => withImages.find(l => l.id === selectedId) || withImages[0], [withImages, selectedId]);
  const preset = useMemo(() => PRESETS.find(p => p.id === presetId) || PRESETS[0], [presetId]);
  const aspect = useMemo(() => ASPECTS.find(a => a.id === aspectId) || ASPECTS[0], [aspectId]);
  const chosenImages = useMemo(
    () => (selected?.images || []).filter(u => picked[`${selected?.id}::${u}`] !== false),
    [selected, picked],
  );

  useEffect(() => { if (!selectedId && withImages.length) setSelectedId(withImages[0].id); }, [withImages, selectedId]);

  const overlayLines = useMemo<OvLine[]>(() => {
    if (!selected) return [];
    const lines: OvLine[] = [];
    if (ov.title) lines.push({ text: clip(selected.title, 26), color: '#ffffff', size: 1.0, weight: 'bold' });
    if (ov.price) lines.push({ text: clip(priceLine(selected), 24), color: '#fbbf24', size: 1.15, weight: 'bold' });
    if (ov.gov && selected.governorate) lines.push({ text: clip('📍 ' + selected.governorate, 30), color: 'rgba(255,255,255,0.9)', size: 0.6, weight: 'normal' });
    const adv = selected.advertiserName || selected.userName;
    if (ov.advertiser && adv) lines.push({ text: clip('👤 ' + adv, 30), color: 'rgba(255,255,255,0.95)', size: 0.7, weight: 'bold' });
    const phone = selected.contactPhone || selected.whatsappPhone || selected.userPhone;
    if (ov.phone && phone) lines.push({ text: clip('📞 ' + phone, 26), color: '#7dd3fc', size: 0.78, weight: 'bold' });
    return lines;
  }, [selected, ov]);

  useEffect(() => {
    if (!beatSync || !audioBuffer) { setBeats(null); return; }
    const b = detectBeats(audioBuffer);
    setBeats(b);
    if (b.length < Math.max(1, chosenImages.length - 1)) toast('مفيش ضربات كافية لمزامنة كل الصور — هيتوزّعوا بالتساوي', 'info');
  }, [beatSync, audioBuffer, chosenImages.length, toast]);

  const cuts = useMemo(
    () => (beatSync && beats ? beatCuts(beats, duration, chosenImages.length) : null),
    [beatSync, beats, duration, chosenImages.length],
  );

  useEffect(() => {
    if (depthMode === 'off') return;
    let cancelled = false;
    (async () => {
      setDepthLoading(true);
      for (const u of chosenImages.slice(0, 10)) {
        if (cancelled) return;
        if (depthMapRef.current.has(u)) continue;
        try {
          const img = await loadImage(u);
          const ly = await prepare2_5D(img, aspect.w, aspect.h, depthMode === 'ai' ? 'ai' : 'proc');
          if (cancelled) return;
          depthMapRef.current.set(u, ly);
          setDepthPrepared(n => n + 1);
        } catch {
          if (depthMode === 'ai') {
            try {
              const img = await loadImage(u);
              const ly = await prepare2_5D(img, aspect.w, aspect.h, 'proc');
              if (cancelled) return;
              depthMapRef.current.set(u, ly);
              setDepthPrepared(n => n + 1);
              toast('تعذر موديل الذكاء — تم استخدام العمق الإجرائي', 'info');
            } catch { /* */ }
          } else {
            toast('تعذر تجهيز العمق لصورة', 'error');
          }
        }
      }
      if (!cancelled) { setDepthLoading(false); setPreviewTick(t => t + 1); }
    })();
    return () => { cancelled = true; };
  }, [depthMode, chosenImages, aspect, toast]);

  const depthArr = useMemo<(DepthLayers | undefined)[] | undefined>(() => {
    if (depthMode === 'off') return undefined;
    // eslint-disable-next-line react-hooks/refs
    return chosenImages.slice(0, 10).map(u => depthMapRef.current.get(u));
  }, [chosenImages, depthMode, depthPrepared]);

  const drawPreview = useCallback(async () => {
    if (!canvasRef.current || !selected || !chosenImages.length) return;
    try {
      const imgs = await Promise.all(chosenImages.slice(0, 10).map(loadImage));
      await ensureFontsLoaded(['Cairo', ...layers.map(l => l.font)]);
      const canvas = canvasRef.current;
      canvas.width = aspect.w;
      canvas.height = aspect.h;
      const ctx = canvas.getContext('2d')!;
      boxesRef.current = [];
      drawFrame(ctx, imgs, preset, transId, styleId, previewP, aspect.w, aspect.h, overlayLines, ov.site, fitId, layers, fx, grade, durationRef.current, cuts, boxesRef.current, depthArr, 1);
      const sel = boxesRef.current.find(b => b.id === selectedLayerId);
      if (sel) {
        ctx.save();
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = Math.max(2, aspect.w * 0.004);
        ctx.setLineDash([aspect.w * 0.02, aspect.w * 0.012]);
        ctx.strokeRect(sel.cx - sel.hw, sel.cy - sel.hh, sel.hw * 2, sel.hh * 2);
        ctx.restore();
      }
    } catch { /* ignore */ }
  }, [selected, chosenImages, preset, aspect, transId, styleId, overlayLines, ov.site, fitId, layers, fx, grade, duration, cuts, previewP, depthArr, selectedLayerId]);

  // معاينة يدوية (لا تلقائية) — لتجنب تهنيج الصفحة
  // useEffect(() => { drawPreview(); }, [drawPreview, previewTick]);

  const canvasPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * aspect.w, y: ((e.clientY - r.top) / r.height) * aspect.h };
  };
  const onCanvasDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const { x, y } = canvasPoint(e);
    const boxes = boxesRef.current;
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i];
      if (Math.abs(x - b.cx) <= b.hw && Math.abs(y - b.cy) <= b.hh) {
        setSelectedLayerId(b.id);
        dragRef.current = { id: b.id, ox: x - b.cx, oy: y - b.cy };
        (e.target as Element).setPointerCapture?.(e.pointerId);
        return;
      }
    }
    setSelectedLayerId('');
  };
  const onCanvasMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current; if (!d) return;
    const { x, y } = canvasPoint(e);
    const nx = Math.min(1, Math.max(0, (x - d.ox) / aspect.w));
    const ny = Math.min(1, Math.max(0, (y - d.oy) / aspect.h));
    setLayers(ls => ls.map(l => l.id === d.id ? { ...l, x: nx, y: ny } : l));
  };
  const onCanvasUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) { dragRef.current = null; try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch { /* */ } }
  };

  useEffect(() => () => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    try { previewSrcRef.current?.stop(); } catch { /* */ }
    audioCtxRef.current?.close().catch(() => {});
  }, []);

  const onMusic = async (file: File | null) => {
    if (!file) { setAudioBuffer(null); setAudioName(''); setMusicTrackId(''); return; }
    try {
      const ctx = audioCtxRef.current || new AudioContext();
      audioCtxRef.current = ctx;
      const buf = await ctx.decodeAudioData(await file.arrayBuffer());
      setAudioBuffer(buf);
      setAudioName(file.name);
      setMusicTrackId('');
    } catch { toast('تعذر قراءة ملف الصوت', 'error'); }
  };

  const onMusicUrl = async (url: string) => {
    const u = url.trim();
    if (!u) return;
    setMusicLoading(true);
    try {
      const ctx = audioCtxRef.current || new AudioContext();
      audioCtxRef.current = ctx;
      const data = await fetchAudioBuffer(u);
      const buf = await ctx.decodeAudioData(data);
      setAudioBuffer(buf);
      setAudioName(u.split('/').pop()?.split('?')[0] || 'مقطع خارجي');
      setMusicTrackId('');
      toast('تم تحميل المقطع ✓', 'success');
    } catch (e: any) {
      if (e?.message === 'TOO_BIG') toast('الملف أكبر من 4 م.ب — نزّله وارفعه من جهازك', 'error');
      else toast('تعذر جلب الرابط — نزّل الملف وارفعه من جهازك', 'error');
    } finally { setMusicLoading(false); }
  };

  const stopPreview = () => {
    try { previewSrcRef.current?.stop(); } catch { /* */ }
    previewSrcRef.current = null;
    setPreviewing(false);
  };

  const chooseTrack = async (t: MusicTrack) => {
    stopPreview();
    setMusicLoading(true);
    try {
      const buf = await renderTrack(t.id, 20);
      setAudioBuffer(buf);
      setAudioName(`${t.emoji} ${t.label}`);
      setMusicTrackId(t.id);
    } catch { toast('تعذر توليد المقطع الموسيقي', 'error'); }
    finally { setMusicLoading(false); }
  };

  const clearMusic = () => { stopPreview(); setAudioBuffer(null); setAudioName(''); setMusicTrackId(''); };

  const togglePreview = async () => {
    if (previewing) { stopPreview(); return; }
    if (!audioBuffer) return;
    const actx = audioCtxRef.current || new AudioContext();
    audioCtxRef.current = actx;
    await actx.resume().catch(() => {});
    const src = actx.createBufferSource();
    src.buffer = audioBuffer;
    src.loop = true;
    const g = actx.createGain();
    g.gain.value = volume;
    src.connect(g); g.connect(actx.destination);
    src.start();
    previewSrcRef.current = src;
    setPreviewing(true);
  };

  const applyTemplate = (t: Template) => {
    if (mergeMode) {
      // دمج: حافظ على الحركة والانتقال واللون، ادمج المؤثرات، طبّق نمط النص
      setFx(prev => ({ ...prev, ...t.fx }));
      setStyleId(t.style);
      setBeatSync(prev => prev || !!t.beatSync);
      if (t.aspect && !aspectId) setAspectId(t.aspect);
      toast(`تم دمج قالب «${t.label}»`, 'success');
    } else {
      setPresetId(t.preset); setTransId(t.trans); setStyleId(t.style); setDuration(t.dur); durationRef.current = t.dur;
      setGrade(t.grade);
      setFx({ particles: false, lightLeak: true, flare: false, glitch: false, filmBurn: false, ...t.fx });
      setDepthMode(t.depth);
      setBeatSync(!!t.beatSync);
      if (t.aspect) setAspectId(t.aspect);
      setOv({ title: true, price: true, gov: true, advertiser: true, phone: true, site: true });
      toast(`تم تطبيق قالب «${t.label}»`, 'success');
    }
  };

  const stopAll = () => {
    cancelRef.current = true;
    try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop(); } catch { /* */ }
    try { srcRef.current?.stop(); } catch { /* */ }
    srcRef.current = null;
  };

  const render = async () => {
    if (!selected || !chosenImages.length) { toast('اختار إعلان فيه صور', 'error'); return; }
    if (resultUrlRef.current) { URL.revokeObjectURL(resultUrlRef.current); resultUrlRef.current = null; setResultUrl(null); }
    setRendering(true);
    setProgress(0);
    cancelRef.current = false;
    stopPreview();
    // eslint-disable-next-line react-hooks/purity
    const t0 = performance.now();
    try {
      const imgs = await Promise.all(chosenImages.slice(0, 10).map(loadImage));
      await ensureFontsLoaded(['Cairo', ...layers.map(l => l.font)]);
      const canvas = canvasRef.current!;
      canvas.width = aspect.w;
      canvas.height = aspect.h;
      const ctx = canvas.getContext('2d')!;
      const stream = (canvas as any).captureStream(30) as MediaStream;
      const tracks: MediaStreamTrack[] = [...stream.getVideoTracks()];
      const mixed = new MediaStream(tracks);
      const mime = pickMime();
      const rec = new MediaRecorder(mixed, { mimeType: mime || undefined, videoBitsPerSecond: 6_000_000 });
      recRef.current = rec;
      const chunks: BlobPart[] = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      const recDone = new Promise<void>(res => { rec.onstop = () => res(); });
      rec.start(100);

      await new Promise<void>(resolve => {
        const start = performance.now();
        const frame = () => {
          const p = Math.min((performance.now() - start) / 1000 / durationRef.current, 1);
          drawFrame(ctx, imgs, preset, transId, styleId, p, aspect.w, aspect.h, overlayLines, ov.site, fitId, layers, fx, grade, durationRef.current, cuts, undefined, depthMode === 'off' ? undefined : chosenImages.slice(0, 10).map(u => depthMapRef.current.get(u)), 1);
          setProgress(p);
          if (cancelRef.current) { resolve(); return; }
          if (p < 1) requestAnimationFrame(frame); else resolve();
        };
        requestAnimationFrame(frame);
      });

      try { if (rec.state !== 'inactive') rec.stop(); } catch { /* */ }
      try { srcRef.current?.stop(); } catch { /* */ }
      srcRef.current = null;
      await recDone;

      if (cancelRef.current) { toast('تم إلغاء الإنشاء', 'error'); return; }
      const blob = new Blob(chunks, { type: (mime || 'video/webm').split(';')[0] });
      if (!blob.size) { toast('فشل الإنشاء — جرّب تاني', 'error'); return; }
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;
      setResultUrl(url);
      const base = (selected.title || 'ad').replace(/[\\/:*?"<>|]/g, '').slice(0, 40).trim() || 'ad';
      setResultName(`${base}-${preset.id}.webm`);
      // eslint-disable-next-line react-hooks/purity
      const elapsedSec = ((performance.now() - t0) / 1000) | 0;
      toast(`تم إنشاء الفيديو ✓ (${(blob.size / 1048576).toFixed(1)} م.ب في ${elapsedSec}ث)`, 'success');
    } catch (err: any) {
      toast('تعذر إنشاء الفيديو: ' + (err?.message || 'خطأ'), 'error');
    } finally {
      setRendering(false);
      recRef.current = null;
    }
  };

  const exportMp4 = async () => {
    if (!selected || !chosenImages.length) return;
    if (!supportsMP4()) { toast('متصفحك مش بيدعم MP4 — استخدم زر الإنشاء (WebM)', 'error'); return; }
    setMp4Busy(true);
    setProgress(0);
    cancelRef.current = false;
    stopPreview();
    // eslint-disable-next-line react-hooks/purity
    const t0 = performance.now();
    try {
      const imgs = await Promise.all(chosenImages.slice(0, 10).map(loadImage));
      await ensureFontsLoaded(['Cairo', ...layers.map(l => l.font)]);
      const dims = mp4Dims(aspect.w, aspect.h);
      const blob = await renderMp4Video({
        width: dims.width, height: dims.height, fps: 30, durationSec: durationRef.current,
        audio: null, volume,
        shouldCancel: () => cancelRef.current,
        onProgress: setProgress,
        draw: (ctx, p) => {
          const dArr = depthMode === 'off' ? undefined : chosenImages.slice(0, 10).map(u => depthMapRef.current.get(u));
          drawFrame(ctx, imgs, preset, transId, styleId, p, dims.width, dims.height, overlayLines, ov.site, fitId, layers, fx, grade, durationRef.current, cuts, undefined, dArr, 1);
        },
      });
      if (cancelRef.current) { toast('تم الإلغاء', 'error'); return; }
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;
      setResultUrl(url);
      const base = (selected.title || 'ad').replace(/[\\/:*?"<>|]/g, '').slice(0, 40).trim() || 'ad';
      setResultName(`${base}-${preset.id}.mp4`);
      // eslint-disable-next-line react-hooks/purity
      const elapsedSec = ((performance.now() - t0) / 1000) | 0;
      toast(`تم إنشاء MP4 (${(blob.size / 1048576).toFixed(1)} م.ب في ${elapsedSec}ث)`, 'success');
    } catch (err: any) {
      if (!cancelRef.current) toast('تعذر إنشاء MP4: ' + (err?.message || 'خطأ'), 'error');
    } finally {
      setMp4Busy(false);
    }
  };

  const groups = useMemo(() => [...new Set(PRESETS.map(p => p.group))], []);
  const visiblePresets = showAllMoves ? PRESETS : PRESETS.filter(p => ['زوم', 'درون', 'سينما'].includes(p.group));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <Film className="w-6 h-6 text-orange-500" />
        <h2 className="text-xl font-bold text-gray-900">استوديو الفيديو</h2>
        <span className="text-xs text-gray-400">حوّل صور الإعلان لفيديو بحركة كاميرا وانتقالات سينمائية</span>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-5">
        {/* ── المعاينة ── */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] dark:bg-[#101d2e] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">المعاينة</span>
            {rendering && (
              <span className="text-xs font-bold text-orange-500 flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري الإنشاء {Math.round(progress * 100)}%
              </span>
            )}
          </div>
          <div className="flex items-center justify-center bg-black rounded-xl overflow-hidden" style={{ minHeight: 320 }}>
            <canvas ref={canvasRef} onPointerDown={onCanvasDown} onPointerMove={onCanvasMove} onPointerUp={onCanvasUp} onPointerLeave={onCanvasUp}
              className={`max-h-[62vh] max-w-full cursor-move ${selectedLayerId ? 'touch-none' : 'touch-pan-y'}`} style={{ aspectRatio: `${aspect.w} / ${aspect.h}`, overscrollBehavior: 'contain' }} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-10 shrink-0">{Math.round(previewP * duration)}ث</span>
            <input type="range" min={0} max={1} step={0.005} value={previewP} onChange={e => setPreviewP(Number(e.target.value))} className="w-full accent-orange-500" />
            <span className="text-[10px] text-gray-400 w-10 text-end shrink-0">{duration}ث</span>
          </div>
          <p className="text-[10px] text-gray-400">من الموبايل: اختار النص من قائمة «نصوص مخصصة» تحت، وحّركه بشبكة الموضع أو سلايدرات أفقي/رأسي (على الكمبيوتر تقدر تسحبه مباشرة على المعاينة). وبالسكروبر تشوف لحظة ظهوره.</p>
          {(rendering || mp4Busy) && (
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-[#1b2a3d] overflow-hidden">
              <div className="h-full bg-orange-500 transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {!rendering && !mp4Busy ? (
              <>
                <button onClick={render} disabled={!selected || !chosenImages.length}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-extrabold px-5 py-2.5 rounded-xl transition-colors">
                  <Play className="w-4 h-4" /> إنشاء (WebM)
                </button>
                <button onClick={exportMp4} disabled={!selected || !chosenImages.length}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-extrabold px-5 py-2.5 rounded-xl transition-colors">
                  <Download className="w-4 h-4" /> MP4 1080p
                </button>
              </>
            ) : (
              <button onClick={stopAll}
                className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-extrabold px-5 py-2.5 rounded-xl transition-colors">
                <Square className="w-4 h-4" /> إيقاف
              </button>
            )}
            <button onClick={() => drawPreview()} disabled={rendering || mp4Busy}
              className="text-sm font-bold text-gray-500 hover:text-orange-500 px-3 py-2.5 disabled:opacity-40 transition-colors">
              تحديث المعاينة
            </button>
            {resultUrl && (
              <a href={resultUrl} download={resultName}
                className="ms-auto flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-extrabold px-5 py-2.5 rounded-xl transition-colors">
                <Download className="w-4 h-4" /> تحميل الفيديو
              </a>
            )}
          </div>
          {resultUrl && <video src={resultUrl} controls className="w-full rounded-xl max-h-[40vh] bg-black" />}
        </div>

        {/* ── الإعدادات ── */}
        <div className="space-y-4">
          {/* الإعلان */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] dark:bg-[#101d2e] p-4 space-y-3">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-200 block">الإعلان ({withImages.length})</label>
            <select value={selected?.id || ''} onChange={e => { setSelectedId(e.target.value); setPicked({}); }}
              className="w-full text-sm rounded-xl border border-[#e2e8f0] dark:border-[#26374d] bg-white dark:bg-[#0b1622] px-3 py-2 outline-none focus:border-orange-400">
              {withImages.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
            {selected && (
              <div className="flex gap-2 flex-wrap">
                {selected.images.map((u, i) => {
                  const key = `${selected.id}::${u}`;
                  const on = picked[key] !== false;
                  return (
                    <button key={i} type="button" onClick={() => setPicked(p => ({ ...p, [key]: !on }))}
                      className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 ${on ? 'border-orange-500' : 'border-transparent opacity-40'}`}
                      title={on ? 'إخفاء من الفيديو' : 'إضافة للفيديو'}>
                      <img src={u} alt="" className="w-full h-full object-cover" />
                      {!on && <span className="absolute inset-0 flex items-center justify-center bg-black/40"><X className="w-4 h-4 text-white" /></span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* قوالب */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] dark:bg-[#101d2e] p-4 space-y-2">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-orange-500" /> قوالب جاهزة <span className="text-[10px] font-normal text-gray-400">— تطبّق الحركة واللون والموسيقى مرة واحدة</span></label>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={mergeMode} onChange={e => setMergeMode(e.target.checked)} className="accent-orange-500 w-4 h-4" />
              وضع الدمج — تطبيق قالب على الإعدادات الحالية (merge fx + text)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map(t => (
                <button key={t.id} type="button" onClick={() => applyTemplate(t)}
                  className="text-start rounded-xl p-2.5 border border-[#e2e8f0] dark:border-[#26374d] hover:border-orange-400 hover:bg-orange-50/60 dark:hover:bg-orange-900/20 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg leading-none">{t.emoji}</span>
                    <span className="text-[11px] font-extrabold text-gray-700 dark:text-gray-200">{t.label}</span>
                  </div>
                  <p className="text-[9px] text-gray-400 mt-1 leading-snug">{t.desc}</p>
                </button>
              ))}
            </div>
      {/* مدة الفيديو — بارز */}
      <div className="mt-3 pt-3 border-t border-[#e2e8f0] dark:border-[#26374d]">
        <div className="flex items-center justify-between text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
          <span>⏱ مدة الفيديو</span><span className="text-orange-500 text-sm">{duration} ثانية</span>
        </div>
        <input type="range" min={3} max={30} value={duration} onChange={e => { const v = Number(e.target.value); setDuration(v); durationRef.current = v; }} className="w-full accent-orange-500" />
        <div className="flex justify-between text-[9px] text-gray-400 mt-1">
          <span>3ث</span><span>15ث</span><span>30ث</span>
        </div>
      </div>
          </div>

          {/* حركة الكاميرا */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] dark:bg-[#101d2e] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-200">حركة الكاميرا ({PRESETS.length})</label>
              <button onClick={() => setShowAllMoves(v => !v)} className="text-[11px] font-bold text-orange-500 hover:underline">
                {showAllMoves ? 'عرض أقل' : `كل الحركات (${groups.length} مجموعات)`}
              </button>
            </div>
            {groups.filter(g => showAllMoves || ['زوم', 'درون', 'سينما'].includes(g)).map(g => (
              <div key={g}>
                <p className="text-[10px] font-bold text-gray-400 mb-1">{g}</p>
                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.filter(p => p.group === g).map(p => (
                    <button key={p.id} type="button" onClick={() => setPresetId(p.id)}
                      className={`text-[11px] font-bold rounded-xl py-2 px-1 border transition-colors ${presetId === p.id ? 'bg-orange-500 text-white border-orange-500' : 'border-[#e2e8f0] dark:border-[#26374d] text-gray-600 dark:text-gray-300 hover:border-orange-300'}`}>
                      <span className="block text-base leading-none mb-1">{p.emoji}</span>{p.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[10px] text-gray-400 pt-1">المختار: <b className="text-orange-500">{visiblePresets.find(p => p.id === presetId)?.label || preset.label}</b></p>
          </div>

          {/* الانتقالات + النص */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] dark:bg-[#101d2e] p-4 space-y-3">
            <div>
              <label className="text-sm font-bold text-gray-700 dark:text-gray-200 block mb-1.5">الانتقال بين الصور</label>
              <div className="grid grid-cols-3 gap-2">
                {TRANSITIONS.map(t => (
                  <button key={t.id} type="button" onClick={() => setTransId(t.id)}
                    className={`text-[11px] font-bold rounded-xl py-2 px-1 border transition-colors ${transId === t.id ? 'bg-orange-500 text-white border-orange-500' : 'border-[#e2e8f0] dark:border-[#26374d] text-gray-600 dark:text-gray-300 hover:border-orange-300'}`}>
                    <span className="block text-base leading-none mb-1">{t.emoji}</span>{t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 dark:text-gray-200 block mb-1.5">حركة النص</label>
              <div className="grid grid-cols-4 gap-2">
                {TEXT_STYLES.map(t => (
                  <button key={t.id} type="button" onClick={() => setStyleId(t.id)}
                    className={`text-[11px] font-bold rounded-xl py-2 border transition-colors ${styleId === t.id ? 'bg-orange-500 text-white border-orange-500' : 'border-[#e2e8f0] dark:border-[#26374d] text-gray-600 dark:text-gray-300 hover:border-orange-300'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* القياس والمدة */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] dark:bg-[#101d2e] p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {ASPECTS.map(a => (
                <button key={a.id} type="button" onClick={() => setAspectId(a.id)}
                  className={`text-[11px] font-bold rounded-xl py-2 border transition-colors ${aspectId === a.id ? 'bg-orange-500 text-white border-orange-500' : 'border-[#e2e8f0] dark:border-[#26374d] text-gray-600 dark:text-gray-300 hover:border-orange-300'}`}>
                  {a.label}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-300 block mb-1.5">ملء الإطار (تلقائي مع القياس)</label>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setFitId('auto')}
                  className={`text-[11px] font-bold rounded-xl py-2 border transition-colors ${fitId === 'auto' ? 'bg-orange-500 text-white border-orange-500' : 'border-[#e2e8f0] dark:border-[#26374d] text-gray-600 dark:text-gray-300 hover:border-orange-300'}`}>
                  تلقائي
                </button>
                <button type="button" onClick={() => setFitId('cover')}
                  className={`text-[11px] font-bold rounded-xl py-2 border transition-colors ${fitId === 'cover' ? 'bg-orange-500 text-white border-orange-500' : 'border-[#e2e8f0] dark:border-[#26374d] text-gray-600 dark:text-gray-300 hover:border-orange-300'}`}>
                  تغطية الإطار
                </button>
                <button type="button" onClick={() => setFitId('contain')}
                  className={`text-[11px] font-bold rounded-xl py-2 border transition-colors ${fitId === 'contain' ? 'bg-orange-500 text-white border-orange-500' : 'border-[#e2e8f0] dark:border-[#26374d] text-gray-600 dark:text-gray-300 hover:border-orange-300'}`}>
                  الصورة كاملة
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{fitId === 'auto' ? 'يختار لكل صورة: تغطية لو قريبة من مقاس الفيديو، وكاملة بخلفية ضبابية لو مختلفة.' : fitId === 'cover' ? 'الصورة تملأ الإطار بالكامل (بدون حواف سوداء).' : 'الصورة كاملة بخلفية ضبابية — مفيدة لو الصورة مش بنفس المقاس.'}</p>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                <span>المدة</span><span className="text-orange-500">{duration} ثانية</span>
              </div>
              <input type="range" min={3} max={30} value={duration} onChange={e => { const v = Number(e.target.value); setDuration(v); durationRef.current = v; }} className="w-full accent-orange-500" />
            </div>
          </div>

          {/* محتوى النص */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] dark:bg-[#101d2e] p-4 space-y-2">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-200 block">بيانات تظهر على الفيديو</label>
            <div className="grid grid-cols-2 gap-2">
              {([['title', 'العنوان'], ['price', 'السعر'], ['gov', 'المحافظة'], ['advertiser', 'اسم المعلن'], ['phone', 'رقم المعلن'], ['site', 'رابط الموقع']] as const).map(([k, lbl]) => (
                <label key={k} className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={(ov as any)[k]} onChange={e => setOv(o => ({ ...o, [k]: e.target.checked }))} className="accent-orange-500 w-4 h-4" />
                  {lbl}
                </label>
              ))}
            </div>
          </div>

          {/* مؤثرات السينما */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] dark:bg-[#101d2e] p-4 space-y-3">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-orange-500" /> مؤثرات السينما
            </label>
            <div>
              <p className="text-[11px] font-bold text-gray-500 mb-1.5">تصحيح الألوان (LUT)</p>
              <div className="grid grid-cols-3 gap-2">
                {([['none', 'طبيعي'], ['warm', 'دافئ'], ['cool', 'بارد'], ['teal', 'سينمائي'], ['vintage', 'قديم'], ['noir', 'أبيض وأسود']] as const).map(([id, lbl]) => (
                  <button key={id} type="button" onClick={() => setGrade(id as Grade)}
                    className={`text-[11px] font-bold rounded-xl py-2 border transition-colors ${grade === id ? 'bg-orange-500 text-white border-orange-500' : 'border-[#e2e8f0] dark:border-[#26374d] text-gray-600 dark:text-gray-300 hover:border-orange-300'}`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-500 mb-1.5">مؤثرات بصرية</p>
              <div className="grid grid-cols-2 gap-2">
                {([['lightLeak', 'تسريب ضوء'], ['particles', 'بَرَد / بوکه'], ['flare', 'لمعة عدسة'], ['filmBurn', 'حرق فيلم'], ['glitch', 'جليتش']] as const).map(([k, lbl]) => (
                  <label key={k} className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={(fx as any)[k]} onChange={e => setFx(f => ({ ...f, [k]: e.target.checked }))} className="accent-orange-500 w-4 h-4" />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-500 mb-1.5">عمق 2.5D (پاراللاكس)</p>
              <div className="grid grid-cols-3 gap-2">
                {([['off', 'إيقاف'], ['proc', 'سريع'], ['ai', 'ذكاء اصطناعي']] as const).map(([id, lbl]) => (
                  <button key={id} type="button" onClick={() => setDepthMode(id)}
                    className={`text-[11px] font-bold rounded-xl py-2 border transition-colors ${depthMode === id ? 'bg-orange-500 text-white border-orange-500' : 'border-[#e2e8f0] dark:border-[#26374d] text-gray-600 dark:text-gray-300 hover:border-orange-300'}`}>
                    {lbl}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {depthLoading ? `جاري تجهيز العمق… (${depthPrepared})` : depthMode === 'ai' ? 'يحمّل موديل عمق (~50م.ب) أول مرة ثم يعمل أوفلاين — أدق وأبطأ.' : depthMode === 'proc' ? 'عمق سريع بدون تحميل — پاراللاكس خفيف.' : 'يقسّم الصورة لطبقات وتحس إنها مجسّمة بتحرّك كل عمق بسرعة مختلفة.'}
              </p>
            </div>
          </div>

          {/* نصوص مخصصة بخطوط عربية */}
          <div className="bg-white rounded-2xl border border-[#e2e8f0] dark:border-[#26374d] dark:bg-[#101d2e] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-200">نصوص مخصصة (خطوط عربية)</label>
              <button type="button" onClick={() => setLayers(ls => [...ls, newLayer('نص جديد')])}
                className="text-[11px] font-bold bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg">+ أضف نص</button>
            </div>
            {!layers.length && <p className="text-[10px] text-gray-400 leading-relaxed">أضف عنوان أو عرض أو شعار بخط عربي احترافي مع شكل وخلفية وحركة.</p>}
            {layers.map(L => (
              <div key={L.id} onClick={() => setSelectedLayerId(L.id)}
                className={`border rounded-xl p-3 space-y-2 cursor-pointer transition-colors ${selectedLayerId === L.id ? 'border-orange-400 dark:border-orange-500 bg-orange-50/40 dark:bg-orange-900/10' : 'border-[#e2e8f0] dark:border-[#26374d]'}`}>
                <div className="flex items-center gap-2">
                  <input value={L.text} onChange={e => setLayers(ls => ls.map(x => x.id === L.id ? { ...x, text: e.target.value } : x))}
                    placeholder="اكتب النص هنا" className="flex-1 text-xs font-bold rounded-lg border border-[#e2e8f0] dark:border-[#26374d] dark:bg-[#0b1622] px-2 py-1.5" />
                  <button onClick={e => { e.stopPropagation(); setLayers(ls => ls.filter(x => x.id !== L.id)); }} className="text-red-400 hover:text-red-600" title="حذف"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select value={L.font} onChange={e => setLayers(ls => ls.map(x => x.id === L.id ? { ...x, font: e.target.value } : x))}
                    className="text-[11px] font-bold rounded-lg border border-[#e2e8f0] dark:border-[#26374d] dark:bg-[#0b1622] px-2 py-1.5">
                    {ARABIC_FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                  <select value={L.anim} onChange={e => setLayers(ls => ls.map(x => x.id === L.id ? { ...x, anim: e.target.value as TextLayer['anim'] } : x))}
                    className="text-[11px] font-bold rounded-lg border border-[#e2e8f0] dark:border-[#26374d] dark:bg-[#0b1622] px-2 py-1.5">
                    {([['rise', 'ظهور من تحت'], ['fade', 'تلاشي'], ['scale', 'تكبير'], ['type', 'آلة كتابة'], ['word', 'كلمة كلمة'], ['slideR', 'انزلاق']] as const).map(([id, lbl]) => <option key={id} value={id}>{lbl}</option>)}
                  </select>
                  <select value={L.shape} onChange={e => setLayers(ls => ls.map(x => x.id === L.id ? { ...x, shape: e.target.value as TextLayer['shape'] } : x))}
                    className="text-[11px] font-bold rounded-lg border border-[#e2e8f0] dark:border-[#26374d] dark:bg-[#0b1622] px-2 py-1.5">
                    {([['none', 'بدون شكل'], ['pill', 'كبسولة'], ['ribbon', 'شريط'], ['badge', 'دائرة'], ['bar', 'شريط سفلي']] as const).map(([id, lbl]) => <option key={id} value={id}>{lbl}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-1 text-[11px] font-bold text-gray-600 dark:text-gray-300">ظهور من
                    <input type="range" min={0} max={duration} step={0.5} value={Math.min(L.start, duration)} onChange={e => setLayers(ls => ls.map(x => x.id === L.id ? { ...x, start: Math.min(Number(e.target.value), x.end - 0.5) } : x))} className="accent-orange-500 w-16" />
                    <span className="text-orange-500">{Math.round(Math.min(L.start, duration))}ث</span>
                  </label>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-gray-600 dark:text-gray-300">لحد
                    <input type="range" min={0} max={duration} step={0.5} value={Math.min(L.end, duration)} onChange={e => setLayers(ls => ls.map(x => x.id === L.id ? { ...x, end: Math.max(Number(e.target.value), x.start + 0.5) } : x))} className="accent-orange-500 w-16" />
                    <span className="text-orange-500">{Math.round(Math.min(L.end, duration))}ث</span>
                  </label>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-1 text-[11px] font-bold text-gray-600 dark:text-gray-300">الحجم
                    <input type="range" min={0.5} max={2} step={0.05} value={L.scale} onChange={e => setLayers(ls => ls.map(x => x.id === L.id ? { ...x, scale: Number(e.target.value) } : x))} className="accent-orange-500 w-20" />
                  </label>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-gray-600 dark:text-gray-300">اللون
                    <input type="color" value={L.color} onChange={e => setLayers(ls => ls.map(x => x.id === L.id ? { ...x, color: e.target.value } : x))} className="w-6 h-6 rounded" />
                  </label>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-gray-600 dark:text-gray-300">لون الشكل
                    <input type="color" value={L.shapeColor} onChange={e => setLayers(ls => ls.map(x => x.id === L.id ? { ...x, shapeColor: e.target.value } : x))} className="w-6 h-6 rounded" />
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={L.stroke} onChange={e => setLayers(ls => ls.map(x => x.id === L.id ? { ...x, stroke: e.target.checked } : x))} className="accent-orange-500 w-4 h-4" /> حدود
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 dark:text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={L.shadow} onChange={e => setLayers(ls => ls.map(x => x.id === L.id ? { ...x, shadow: e.target.checked } : x))} className="accent-orange-500 w-4 h-4" /> ظل
                  </label>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[10px] font-bold text-gray-500">مكان سريع</span>
                  <div className="grid grid-cols-3 gap-0.5">
                    {[[0.2, 0.18], [0.5, 0.18], [0.8, 0.18], [0.2, 0.5], [0.5, 0.5], [0.8, 0.5], [0.2, 0.82], [0.5, 0.82], [0.8, 0.82]].map(([px, py], i) => (
                      <button key={i} type="button" onClick={e => { e.stopPropagation(); setLayers(ls => ls.map(x => x.id === L.id ? { ...x, x: px, y: py } : x)); }}
                        className={`w-6 h-6 rounded border ${Math.abs(L.x - px) < 0.02 && Math.abs(L.y - py) < 0.02 ? 'bg-orange-500 border-orange-500' : 'border-[#cbd5e1] dark:border-[#33475f] hover:border-orange-300'}`} />
                    ))}
                  </div>
                  <label className="flex items-center gap-1 text-[10px] font-bold text-gray-500">أفقي
                    <input type="range" min={0} max={1} step={0.01} value={L.x} onChange={e => setLayers(ls => ls.map(x => x.id === L.id ? { ...x, x: Number(e.target.value) } : x))} className="accent-orange-500 w-16" />
                  </label>
                  <label className="flex items-center gap-1 text-[10px] font-bold text-gray-500">رأسي
                    <input type="range" min={0} max={1} step={0.01} value={L.y} onChange={e => setLayers(ls => ls.map(x => x.id === L.id ? { ...x, y: Number(e.target.value) } : x))} className="accent-orange-500 w-16" />
                  </label>
                </div>
                <p className="text-[9px] text-gray-400">اسحب النص على المعاينة لتحريكه بحرية في أي مكان.</p>
              </div>
            ))}
          </div>


          {!withImages.length && (
            <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> مفيش إعلانات فيها صور متاحة.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
