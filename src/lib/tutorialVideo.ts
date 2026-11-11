// فيديو شرح (كورس) مولّد داخل المتصفح — مقاس 9:16 للموبايل، أسهم على الشاشة + موسيقى.
// الـtimeline مبني بحيث يتقبل تعليق صوتي لاحقًا بنفس التوقيتات (نفس الـscenes).

export const TUTORIAL_W = 1080;
export const TUTORIAL_H = 1920;
export const TUTORIAL_FPS = 30;
export const TUTORIAL_TRACK = 'uplift';

type Ctx = CanvasRenderingContext2D;

const FONT = 'Cairo, Tahoma, Arial, sans-serif';
const NAVY = '#0a1628';
const CARD = '#0f2136';
const CARD2 = '#162e48';
const ACCENT = '#f97316';
const MUTED = '#94a3b8';
const WHITE = '#ffffff';

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function txt(ctx: Ctx, s: string, x: number, y: number, size: number, color: string, weight: number | string = 700, align: CanvasTextAlign = 'right', rtl = true) {
  ctx.save();
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
  ctx.restore();
}

function drawBg(ctx: Ctx, w: number, h: number, t: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, NAVY);
  g.addColorStop(1, '#070f1c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const gx = w * 0.5 + Math.sin(t * 0.55) * w * 0.28;
  const gy = h * 0.30 + Math.cos(t * 0.45) * h * 0.12;
  const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, w * 0.95);
  rg.addColorStop(0, 'rgba(249,115,22,0.20)');
  rg.addColorStop(0.55, 'rgba(249,115,22,0.05)');
  rg.addColorStop(1, 'rgba(249,115,22,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= w; x += 96) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += 96) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.restore();
}

function drawProgress(ctx: Ctx, w: number, h: number, p: number) {
  const pad = 72, y = h - 54, trackW = w - pad * 2, barH = 10;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  rr(ctx, pad, y, trackW, barH, barH / 2);
  ctx.fill();
  ctx.fillStyle = ACCENT;
  rr(ctx, pad, y, Math.max(barH, trackW * clamp01(p)), barH, barH / 2);
  ctx.fill();
  ctx.restore();
  txt(ctx, 'carmasr-app.vercel.app', w - pad, y - 46, 30, 'rgba(148,163,184,0.55)', 600, 'right', false);
}

function drawPulse(ctx: Ctx, t: { x: number; y: number; w: number; h: number }, tsec: number) {
  const ex = 16;
  ctx.save();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 8;
  ctx.globalAlpha = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(tsec * 5));
  rr(ctx, t.x - ex, t.y - ex, t.w + ex * 2, t.h + ex * 2, 26);
  ctx.stroke();
  const cyc = (tsec % 1.6) / 1.6;
  ctx.globalAlpha = (1 - cyc) * 0.5;
  const g = cyc * 46;
  rr(ctx, t.x - ex - g, t.y - ex - g, t.w + (ex + g) * 2, t.h + (ex + g) * 2, 28 + g);
  ctx.stroke();
  ctx.restore();
}

function arrowV(ctx: Ctx, x: number, yFrom: number, yTo: number, tsec: number) {
  const dir = yTo > yFrom ? 1 : -1;
  const bob = Math.sin(tsec * 3.4) * 14 * dir;
  const y1 = yFrom + bob;
  ctx.save();
  ctx.strokeStyle = WHITE;
  ctx.shadowColor = 'rgba(249,115,22,0.9)';
  ctx.shadowBlur = 26;
  ctx.lineWidth = 20;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, yTo - dir * 34);
  ctx.stroke();
  const hw = 46, hh = 46;
  ctx.beginPath();
  ctx.moveTo(x, yTo);
  ctx.lineTo(x - hw, yTo - dir * hh);
  ctx.lineTo(x + hw, yTo - dir * hh);
  ctx.closePath();
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.restore();
}

type Target = { x: number; y: number; w: number; h: number };
type MockFn = (ctx: Ctx, x: number, y: number, w: number, h: number, t: number) => Target;

function cardHeader(ctx: Ctx, x: number, y: number, label: string) {
  txt(ctx, label, x, y, 40, MUTED, 700, 'right');
}

function mockOpenStudio(ctx: Ctx, x: number, y: number, w: number, _h: number, _t: number): Target {
  cardHeader(ctx, x + w, y + 6, 'لوحة الأدمن');
  const items = ['لوحة التحكم', 'الإعلانات', 'المعارض', 'استوديو الفيديو'];
  const rowH = 120, gap = 26;
  let cy = y + 64;
  let target: Target = { x, y: cy, w, h: rowH };
  items.forEach((it, i) => {
    const active = i === items.length - 1;
    ctx.fillStyle = active ? ACCENT : CARD2;
    rr(ctx, x, cy, w, rowH, 26);
    ctx.fill();
    if (!active) {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 2;
      rr(ctx, x, cy, w, rowH, 26);
      ctx.stroke();
    }
    ctx.fillStyle = active ? 'rgba(255,255,255,0.95)' : 'rgba(148,163,184,0.55)';
    ctx.beginPath();
    ctx.arc(x + w - 56, cy + rowH / 2, 13, 0, Math.PI * 2);
    ctx.fill();
    txt(ctx, it, x + w - 92, cy + rowH / 2, 40, active ? WHITE : '#cbd5e1', active ? 800 : 600, 'right');
    if (active) target = { x, y: cy, w, h: rowH };
    cy += rowH + gap;
  });
  return target;
}

function mockChooseAd(ctx: Ctx, x: number, y: number, w: number, _h: number, _t: number): Target {
  cardHeader(ctx, x + w, y + 6, 'الإعلان');
  const by = y + 78, bh = 132;
  ctx.fillStyle = ACCENT;
  ctx.shadowColor = 'rgba(249,115,22,0.45)';
  ctx.shadowBlur = 30;
  rr(ctx, x, by, w, bh, 30);
  ctx.fill();
  ctx.shadowBlur = 0;
  txt(ctx, 'شاحنة مرسيدس ٢٠١٩', x + w - 44, by + bh / 2, 44, WHITE, 800, 'right');
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 74, by + bh / 2 - 16);
  ctx.lineTo(x + 52, by + bh / 2);
  ctx.lineTo(x + 74, by + bh / 2 + 16);
  ctx.stroke();
  return { x, y: by, w, h: bh };
}

function mockTemplate(ctx: Ctx, x: number, y: number, w: number, _h: number, _t: number): Target {
  cardHeader(ctx, x + w, y + 6, 'قوالب جاهزة');
  const labels = ['🎞️ ريلز سينمائي', '🏎️ سيارة رياضية', '🎬 ملحمي', '🏠 عقار فاخر'];
  const gap = 26, cw = (w - gap) / 2, ch = 180;
  let target: Target = { x, y: y + 78, w: cw, h: ch };
  let k = 0;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const cx = x + col * (cw + gap);
      const cy = y + 78 + row * (ch + gap);
      const active = k === 0;
      ctx.fillStyle = active ? ACCENT : CARD2;
      rr(ctx, cx, cy, cw, ch, 26);
      ctx.fill();
      if (!active) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 2;
        rr(ctx, cx, cy, cw, ch, 26);
        ctx.stroke();
      }
      txt(ctx, labels[k], cx + cw - 26, cy + ch / 2, 34, active ? WHITE : '#cbd5e1', 700, 'right');
      if (active) target = { x: cx, y: cy, w: cw, h: ch };
      k++;
    }
  }
  return target;
}

function mockMusic(ctx: Ctx, x: number, y: number, w: number, _h: number, _t: number): Target {
  cardHeader(ctx, x + w, y + 6, 'مكتبة الموسيقى');
  const items = ['🪘 شعبي مقسوم', '🎬 ملحمي', '⚡ تحفيزي'];
  const rowH = 120, gap = 26;
  let cy = y + 64;
  let target: Target = { x, y: cy, w, h: rowH };
  items.forEach((it, i) => {
    const active = i === 2;
    ctx.fillStyle = active ? ACCENT : CARD2;
    rr(ctx, x, cy, w, rowH, 26);
    ctx.fill();
    if (!active) {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 2;
      rr(ctx, x, cy, w, rowH, 26);
      ctx.stroke();
    }
    ctx.strokeStyle = active ? WHITE : 'rgba(148,163,184,0.6)';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w - 56, cy + rowH / 2 - 20);
    ctx.lineTo(x + w - 56, cy + rowH / 2 + 20);
    ctx.lineTo(x + w - 20, cy + rowH / 2);
    ctx.closePath();
    ctx.stroke();
    txt(ctx, it, x + w - 92, cy + rowH / 2, 40, active ? WHITE : '#cbd5e1', 700, 'right');
    if (active) target = { x, y: cy, w, h: rowH };
    cy += rowH + gap;
  });
  return target;
}

function mockRender(ctx: Ctx, x: number, y: number, w: number, h: number, _t: number): Target {
  cardHeader(ctx, x + w, y + 6, 'المعاينة');
  const ph = h - 300;
  ctx.fillStyle = '#0b1622';
  rr(ctx, x, y + 72, w, ph, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 2;
  rr(ctx, x, y + 72, w, ph, 28);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 34, y + 72 + ph / 2 - 40);
  ctx.lineTo(w / 2 - 34, y + 72 + ph / 2 + 40);
  ctx.lineTo(w / 2 + 42, y + 72 + ph / 2);
  ctx.closePath();
  ctx.fill();
  const by = y + h - 150, bh = 122;
  ctx.fillStyle = ACCENT;
  ctx.shadowColor = 'rgba(249,115,22,0.5)';
  ctx.shadowBlur = 34;
  rr(ctx, x, by, w, bh, 30);
  ctx.fill();
  ctx.shadowBlur = 0;
  txt(ctx, 'إنشاء MP4 1080p', x + w / 2, by + bh / 2, 46, WHITE, 800, 'center', false);
  return { x, y: by, w, h: bh };
}

function mockDownload(ctx: Ctx, x: number, y: number, w: number, h: number, _t: number): Target {
  cardHeader(ctx, x + w, y + 6, 'تم الإنشاء ✓');
  const by = y + h / 2 - 80, bh = 150;
  ctx.fillStyle = '#10b981';
  ctx.shadowColor = 'rgba(16,185,129,0.5)';
  ctx.shadowBlur = 36;
  rr(ctx, x, by, w, bh, 32);
  ctx.fill();
  ctx.shadowBlur = 0;
  txt(ctx, '⬇ تحميل الفيديو', x + w / 2, by + bh / 2, 48, WHITE, 800, 'center', false);
  return { x, y: by, w, h: bh };
}

type Scene =
  | { kind: 'intro'; dur: number }
  | { kind: 'outro'; dur: number }
  | { kind: 'step'; dur: number; n: string; title: string; body: string; mock: MockFn };

const SCENES: Scene[] = [
  { kind: 'intro', dur: 3.0 },
  { kind: 'step', dur: 3.5, n: '١', title: 'افتح استوديو الفيديو', body: 'من لوحة الأدمن', mock: mockOpenStudio },
  { kind: 'step', dur: 3.5, n: '٢', title: 'اختار الإعلان', body: 'اللي فيه صور', mock: mockChooseAd },
  { kind: 'step', dur: 3.5, n: '٣', title: 'اختار قالب جاهز', body: 'بذوق عالي وبضغطة واحدة', mock: mockTemplate },
  { kind: 'step', dur: 3.5, n: '٤', title: 'اختار موسيقى', body: 'مكتبة بدون حقوق', mock: mockMusic },
  { kind: 'step', dur: 3.5, n: '٥', title: 'اضغط إنشاء MP4', body: 'فيديو 1080p جاهز للنشر', mock: mockRender },
  { kind: 'step', dur: 3.5, n: '٦', title: 'حمّل وانشر', body: 'فيسبوك وواتساب', mock: mockDownload },
  { kind: 'outro', dur: 3.0 },
];

export const TUTORIAL_DURATION = SCENES.reduce((a, s) => a + s.dur, 0);
export const TUTORIAL_STEPS = SCENES.filter(s => s.kind === 'step').map(s => (s as Extract<Scene, { kind: 'step' }>).title);

function drawIntro(ctx: Ctx, w: number, h: number, l: number) {
  const cx = w / 2;
  const pop = easeOut(clamp01(l / 0.4));
  ctx.save();
  ctx.translate(cx, h * 0.40);
  ctx.scale(lerp(0.62, 1, pop), lerp(0.62, 1, pop));
  ctx.globalAlpha = clamp01(l / 0.35);
  const sz = 210;
  ctx.fillStyle = ACCENT;
  ctx.shadowColor = 'rgba(249,115,22,0.6)';
  ctx.shadowBlur = 70;
  rr(ctx, -sz / 2, -sz / 2, sz, sz, 58);
  ctx.fill();
  ctx.shadowBlur = 0;
  txt(ctx, 'ط', 0, 6, 128, WHITE, 900, 'center');
  ctx.restore();

  const a1 = clamp01((l - 0.25) / 0.35);
  ctx.save();
  ctx.globalAlpha = a1;
  ctx.translate(0, (1 - easeOut(a1)) * 60);
  txt(ctx, 'اعمل إعلان فيديو', cx, h * 0.585, 82, WHITE, 800, 'center');
  ctx.restore();

  const a2 = clamp01((l - 0.45) / 0.35);
  ctx.save();
  ctx.globalAlpha = a2;
  ctx.translate(0, (1 - easeOut(a2)) * 50);
  txt(ctx, 'خطوة بخطوة من الموبايل', cx, h * 0.655, 46, MUTED, 600, 'center');
  ctx.restore();
}

function drawOutro(ctx: Ctx, w: number, h: number, l: number) {
  const cx = w / 2;
  const a = easeOut(clamp01(l / 0.5));
  ctx.save();
  ctx.translate(0, (1 - a) * 70);
  ctx.globalAlpha = clamp01(l / 0.4);
  ctx.fillStyle = 'rgba(249,115,22,0.14)';
  const rg = ctx.createRadialGradient(cx, h * 0.45, 0, cx, h * 0.45, w * 0.7);
  rg.addColorStop(0, 'rgba(249,115,22,0.35)');
  rg.addColorStop(1, 'rgba(249,115,22,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
  txt(ctx, 'جاهز؟ ابدأ الآن', cx, h * 0.44, 88, WHITE, 900, 'center');
  txt(ctx, 'استوديو الفيديو — كار مصر', cx, h * 0.515, 46, MUTED, 600, 'center');
  ctx.restore();

  const b = easeOut(clamp01((l - 0.25) / 0.5));
  const bw = lerp(0, 720, b), bh = 150;
  ctx.save();
  ctx.globalAlpha = clamp01((l - 0.25) / 0.3);
  ctx.fillStyle = ACCENT;
  ctx.shadowColor = 'rgba(249,115,22,0.5)';
  ctx.shadowBlur = 44;
  rr(ctx, cx - bw / 2, h * 0.60, bw, bh, 34);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (b > 0.5) txt(ctx, '🎬  اعمل فيديو دلوقتي', cx, h * 0.60 + bh / 2, 46, WHITE, 800, 'center');
  ctx.restore();
}

function drawStep(ctx: Ctx, w: number, h: number, scene: Extract<Scene, { kind: 'step' }>, local: number, tsec: number) {
  const pad = 72;
  const a = clamp01(local / 0.3);
  const slide = (1 - easeOut(a)) * 50;

  const badgeX = w - pad - 52, badgeY = 292, r = 52;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(0, slide);
  ctx.fillStyle = ACCENT;
  ctx.shadowColor = 'rgba(249,115,22,0.5)';
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  txt(ctx, scene.n, badgeX, badgeY + 4, 56, WHITE, 900, 'center');
  txt(ctx, scene.title, w - pad - r * 2 - 30, badgeY - 6, 62, WHITE, 800, 'right');
  txt(ctx, scene.body, w - pad - r * 2 - 30, badgeY + 66, 40, MUTED, 600, 'right');
  ctx.restore();

  const ca = clamp01((local - 0.06) / 0.4);
  const cardX = pad;
  const cardY = lerp(620, 470, easeOut(ca));
  const cardW = w - pad * 2;
  const cardH = 1180;

  ctx.save();
  ctx.globalAlpha = clamp01((local - 0.05) / 0.3);
  ctx.fillStyle = CARD;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 26;
  rr(ctx, cardX, cardY, cardW, cardH, 48);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 3;
  rr(ctx, cardX, cardY, cardW, cardH, 48);
  ctx.stroke();
  // window dots
  const dotColors = ['#ff5f57', '#febc2e', '#28c840'];
  dotColors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(cardX + 44 + i * 40, cardY + 52, 11, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  const ix = cardX + 52, iy = cardY + 118, iw = cardW - 104, ih = cardH - 172;
  const target = scene.mock(ctx, ix, iy, iw, ih, tsec);

  drawPulse(ctx, target, tsec);

  const cardBottom = cardY + cardH;
  const below = target.y + target.h + 300 < cardBottom;
  if (below) {
    arrowV(ctx, target.x + target.w / 2, Math.min(cardBottom - 30, target.y + target.h + 300), target.y + target.h + 24, tsec);
  } else {
    arrowV(ctx, target.x + target.w / 2, Math.max(cardY + 30, target.y - 300), target.y - 24, tsec);
  }

  txt(ctx, `الخطوة ${scene.n} من ٦`, w / 2, cardBottom + 78, 36, MUTED, 600, 'center');
}

export function drawTutorial(ctx: Ctx, w: number, h: number, p: number) {
  const total = TUTORIAL_DURATION;
  const time = clamp01(p) * total;
  ctx.clearRect(0, 0, w, h);

  let acc = 0;
  let scene = SCENES[0];
  let local = 0;
  for (let i = 0; i < SCENES.length; i++) {
    if (time < acc + SCENES[i].dur) {
      scene = SCENES[i];
      local = (time - acc) / SCENES[i].dur;
      break;
    }
    acc += SCENES[i].dur;
    scene = SCENES[i];
    local = 1;
  }

  drawBg(ctx, w, h, time);

  if (scene.kind === 'intro') drawIntro(ctx, w, h, local);
  else if (scene.kind === 'outro') drawOutro(ctx, w, h, local);
  else drawStep(ctx, w, h, scene as Extract<Scene, { kind: 'step' }>, local, time);

  drawProgress(ctx, w, h, p);
}
