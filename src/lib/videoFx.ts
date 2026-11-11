// وحدة مؤثرات السينما + محرّر النصوص العربية لاستوديو الفيديو.

export const ARABIC_FONTS: { id: string; label: string; weight: number }[] = [
  { id: 'Cairo', label: 'كايرو', weight: 800 },
  { id: 'Tajawal', label: 'تجوال', weight: 800 },
  { id: 'Almarai', label: 'المراعي', weight: 800 },
  { id: 'Changa', label: 'شنغا', weight: 700 },
  { id: 'El Messiri', label: 'المسيري', weight: 700 },
  { id: 'Reem Kufi', label: 'ريم كوفي', weight: 700 },
  { id: 'Lalezar', label: 'لاله زار', weight: 400 },
  { id: 'Rakkas', label: 'رقّاص', weight: 400 },
  { id: 'Aref Ruqaa', label: 'عارف رقعة', weight: 700 },
  { id: 'Amiri', label: 'أميري', weight: 700 },
  { id: 'Lemonada', label: 'ليمونادة', weight: 700 },
  { id: 'Marhey', label: 'مرح', weight: 700 },
  { id: 'Kufam', label: 'كوفام', weight: 700 },
  { id: 'Noto Kufi Arabic', label: 'نوتو كوفي', weight: 900 },
];

const stack = (id: string) => (id === 'Aref Ruqaa' || id === 'Amiri' ? `"${id}", serif` : `"${id}", "Cairo", sans-serif`);

export async function ensureFontsLoaded(families: string[]) {
  try {
    const fonts: any = (document as any).fonts;
    if (!fonts) return;
    await Promise.all(families.map(f => fonts.load(`800 72px "${f}"`).catch(() => null)));
    await fonts.ready;
  } catch { /* */ }
}

export type TextLayer = {
  id: string;
  text: string;
  font: string;
  weight: number;
  scale: number;
  color: string;
  stroke: boolean;
  strokeColor: string;
  shadow: boolean;
  shape: 'none' | 'pill' | 'ribbon' | 'badge' | 'bar';
  shapeColor: string;
  x: number;      // 0..1 موضع أفقي حر
  y: number;      // 0..1 موضع رأسي حر
  start: number;  // ثانية بداية الظهور
  end: number;    // ثانية نهاية الظهور
  anim: 'fade' | 'rise' | 'scale' | 'type' | 'word' | 'slideR';
};

export type TextBox = { id: string; cx: number; cy: number; hw: number; hh: number };

export type FxConfig = {
  particles: boolean;
  lightLeak: boolean;
  flare: boolean;
  glitch: boolean;
  filmBurn: boolean;
};

export type Grade = 'none' | 'warm' | 'cool' | 'teal' | 'vintage' | 'noir';

export const newLayer = (text = ''): TextLayer => ({
  id: Math.random().toString(36).slice(2, 9),
  text,
  font: 'Cairo',
  weight: 800,
  scale: 1,
  color: '#ffffff',
  stroke: false,
  strokeColor: '#0d1b2a',
  shadow: true,
  shape: 'none',
  shapeColor: '#f97316',
  x: 0.5,
  y: 0.8,
  start: 0,
  end: 9999,
  anim: 'rise',
});

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function drawTextLayers(ctx: CanvasRenderingContext2D, w: number, h: number, layers: TextLayer[], p: number, dur = 1, boxes?: TextBox[]) {
  const base = w * 0.05;
  const tSec = p * dur;
  for (const L of layers) {
    if (!L.text || !L.text.trim()) continue;
    if (tSec < L.start || tSec > L.end) continue;
    const size = Math.round(base * L.scale);
    ctx.save();
    ctx.font = `${L.weight} ${size}px ${stack(L.font)}`;
    (ctx as any).direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lp = Math.min(Math.max((tSec - L.start) / 0.4, 0), 1);
    const prog = Math.min(lp / 0.5, 1);
    let alpha = 1, dy = 0, sc = 1, x = L.x * w;
    if (L.anim === 'fade') alpha = lp;
    else if (L.anim === 'rise') dy = (1 - easeOut(prog)) * size * 1.9;
    else if (L.anim === 'scale') sc = 0.55 + 0.45 * easeOut(prog);
    else if (L.anim === 'slideR') { alpha = lp; x = L.x * w + (1 - easeOut(prog)) * w * 0.5; }
    let text = L.text;
    if (L.anim === 'type') text = L.text.slice(0, Math.floor(L.text.length * prog));
    else if (L.anim === 'word') { const ws = L.text.split(' '); text = ws.slice(0, Math.ceil(ws.length * prog)).join(' '); }
    const tw = ctx.measureText(text).width;
    const padX = size * 0.55;
    const y = L.y * h;
    if (boxes) boxes.push({ id: L.id, cx: x, cy: y, hw: Math.max(tw / 2 + padX, size * 1.1), hh: Math.max(size * 0.95, size * 1.1) });
    ctx.globalAlpha = alpha;
    ctx.translate(x, y + dy);
    ctx.scale(sc, sc);
    if (L.shape !== 'none') {
      ctx.save();
      ctx.fillStyle = L.shapeColor;
      if (L.shape === 'pill') { roundRect(ctx, -tw / 2 - padX, -size * 0.85, tw + padX * 2, size * 1.7, size * 0.85); ctx.fill(); }
      else if (L.shape === 'ribbon') {
        const hw = tw / 2 + padX, cut = size * 0.45, hh = size * 0.8;
        ctx.beginPath();
        ctx.moveTo(-hw, -hh); ctx.lineTo(hw + cut, -hh); ctx.lineTo(hw, 0);
        ctx.lineTo(hw + cut, hh); ctx.lineTo(-hw, hh); ctx.lineTo(-hw - cut, 0);
        ctx.closePath(); ctx.fill();
      } else if (L.shape === 'badge') {
        ctx.beginPath(); ctx.arc(0, 0, Math.max(tw / 2 + padX, size * 1.05), 0, Math.PI * 2); ctx.fill();
      } else if (L.shape === 'bar') {
        ctx.globalAlpha = alpha * 0.72;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(-w / 2, -size * 0.95, w, size * 1.9);
        ctx.fillStyle = L.shapeColor;
        ctx.fillRect(-w / 2, -size * 0.95, size * 0.28, size * 1.9);
      }
      ctx.restore();
    }
    if (L.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = size * 0.28; ctx.shadowOffsetY = size * 0.07; }
    if (L.stroke) { ctx.lineWidth = Math.max(2, size * 0.07); ctx.strokeStyle = L.strokeColor; ctx.lineJoin = 'round'; ctx.strokeText(text, 0, 0); }
    ctx.fillStyle = L.color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
}

export function applyGrade(ctx: CanvasRenderingContext2D, w: number, h: number, grade: Grade) {
  if (grade === 'none') return;
  ctx.save();
  if (grade === 'warm') { ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = 'rgba(255,170,80,0.16)'; ctx.fillRect(0, 0, w, h); }
  else if (grade === 'cool') { ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = 'rgba(90,150,255,0.16)'; ctx.fillRect(0, 0, w, h); }
  else if (grade === 'vintage') {
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(210,175,120,0.35)'; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = 'rgba(40,30,20,0.18)'; ctx.fillRect(0, 0, w, h);
  } else if (grade === 'teal') {
    ctx.globalCompositeOperation = 'overlay';
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,120,140,0.22)'); g.addColorStop(1, 'rgba(255,140,60,0.22)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  } else if (grade === 'noir') {
    ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = 'rgba(20,20,30,0.22)'; ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

export function drawParticles(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, count = 28) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < count; i++) {
    const g = (i * 0.6180339887) % 1;
    const x = g * w + Math.sin((p * 2 + i) * 1.3) * w * 0.03;
    const y = ((g * 2.7 + i * 0.137) % 1) * h - p * h * 0.18;
    const r = (4 + ((i * 37) % 23)) * Math.min(w, h) / 720;
    const a = 0.12 + 0.25 * Math.abs(Math.sin(p * 3 + i));
    const rad = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    rad.addColorStop(0, `rgba(255,240,200,${a})`);
    rad.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = rad;
    ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawLightLeak(ctx: CanvasRenderingContext2D, w: number, h: number, p: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const cx = w * (0.15 + 0.7 * p);
  const cy = h * 0.18;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.72);
g.addColorStop(0, 'rgba(255,190,120,0.7)');
  g.addColorStop(0.42, 'rgba(255,90,60,0.28)');
  g.addColorStop(1, 'rgba(255,90,60,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function drawFlare(ctx: CanvasRenderingContext2D, w: number, h: number, p: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const x = w * (0.25 + 0.5 * Math.abs(Math.sin(p * 1.6)));
  const y = h * 0.25;
  const rad = ctx.createRadialGradient(x, y, 0, x, y, Math.min(w, h) * 0.5);
  rad.addColorStop(0, 'rgba(255,250,230,0.55)');
  rad.addColorStop(0.25, 'rgba(255,210,150,0.18)');
  rad.addColorStop(1, 'rgba(255,210,150,0)');
  ctx.fillStyle = rad; ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgba(255,240,210,0.5)';
  ctx.fillRect(0, y - 2, w, 4);
  ctx.restore();
}

export function drawFilmBurn(ctx: CanvasRenderingContext2D, w: number, h: number, p: number) {
  const edge = Math.max(0, 1 - Math.min(p, 1 - p) * 6);
  if (edge <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createLinearGradient(0, h * (1 - edge * 0.6), 0, h);
  g.addColorStop(0, 'rgba(255,120,40,0)');
  g.addColorStop(1, `rgba(255,120,40,${0.5 * edge})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function drawGlitch(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, amt = 0.6) {
  const slices = 9;
  for (let i = 0; i < slices; i++) {
    if (Math.random() > 0.5 * amt) continue;
    const sy = Math.random() * h;
    const sh = h * 0.015 + Math.random() * h * 0.035;
    const dx = (Math.random() * 2 - 1) * w * 0.035 * amt;
    ctx.drawImage(ctx.canvas, 0, sy, w, sh, dx, sy, w, sh);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.22;
  ctx.drawImage(ctx.canvas, -4 * amt, 0);
  ctx.restore();
  void p;
}
