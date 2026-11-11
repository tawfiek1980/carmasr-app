// عمق 2.5D (پاراللاكس): يقسّم الصورة لشرائح عمق ويتحرّك كل عمق بسرعة مختلفة.
// المسار الذكي: onnxruntime-web (من CDN) + موديل Depth-Anything-V2-Small (fp16) من Hugging Face.
// عند فشل أي خطوة → نرجع لعمق إجرائي (من الإضاءة + توسيط) لضمان عمل المؤثر دائمًا.

export const BANDS = 6;

export type DepthGrid = { data: Float32Array; w: number; h: number };

export type DepthLayers = {
  bands: HTMLCanvasElement[];
  far: HTMLCanvasElement;
  count: number;
};

function coverTransform(iw: number, ih: number, w: number, h: number, overscan = 1.08) {
  const scale = Math.max(w / iw, h / ih) * overscan;
  const dw = iw * scale, dh = ih * scale;
  return { dw, dh, dx: (w - dw) / 2, dy: (h - dh) / 2 };
}

export function makeGridCanvas(gw: number, gh: number) {
  const c = document.createElement('canvas');
  c.width = gw; c.height = gh;
  return c;
}

function gridPixels(img: CanvasImageSource, gw: number, gh: number): Uint8ClampedArray {
  const c = makeGridCanvas(gw, gh);
  const x = c.getContext('2d')!;
  x.drawImage(img, 0, 0, gw, gh);
  return x.getImageData(0, 0, gw, gh).data;
}

export function proceduralDepth(img: CanvasImageSource, gw = 48, gh = 48): DepthGrid {
  const d = gridPixels(img, gw, gh);
  const out = new Float32Array(gw * gh);
  const cx = (gw - 1) / 2, cy = (gh - 1) / 2;
  const maxR = Math.hypot(cx, cy);
  let lo = Infinity, hi = -Infinity;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x;
    const p = i * 4;
    const lum = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) / 255;
    const r = Math.hypot(x - cx, y - cy) / maxR;
    const v = 0.6 * (1 - r) + 0.4 * lum;
    out[i] = v;
    if (v < lo) lo = v; if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / span;
  return { data: out, w: gw, h: gh };
}

let ortPromise: Promise<any> | null = null;
function loadOrt(): Promise<any> {
  if (ortPromise) return ortPromise;
  ortPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.ort) { resolve(w.ort); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort.min.js';
    s.onload = () => {
      const o = (window as any).ort;
      if (o) { try { o.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/'; } catch { /* */ } resolve(o); }
      else reject(new Error('ort missing'));
    };
    s.onerror = () => reject(new Error('ort load failed'));
    document.head.appendChild(s);
  });
  return ortPromise;
}

const MODEL_URL = 'https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model_fp16.onnx';
let sessionPromise: Promise<any> | null = null;
async function loadSession(): Promise<any> {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const ort = await loadOrt();
    let buf: ArrayBuffer | null = null;
    try {
      if ('caches' in window) {
        const cache = await caches.open('tareeq-depth-v1');
        const hit = await cache.match(MODEL_URL);
        if (hit) buf = await hit.arrayBuffer();
        else {
          const res = await fetch(MODEL_URL);
          buf = await res.arrayBuffer();
          cache.put(MODEL_URL, new Response(buf.slice(0))).catch(() => {});
        }
      } else {
        buf = await (await fetch(MODEL_URL)).arrayBuffer();
      }
    } catch { buf = await (await fetch(MODEL_URL)).arrayBuffer(); }
    return await ort.InferenceSession.create(buf, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  })();
  return sessionPromise;
}

export async function aiDepth(img: HTMLImageElement): Promise<DepthGrid> {
  const ort = await loadOrt();
  const session = await loadSession();
  const S = 392; // مضاعف 14
  const c = makeGridCanvas(S, S);
  const x = c.getContext('2d')!;
  x.drawImage(img, 0, 0, S, S);
  const px = x.getImageData(0, 0, S, S).data;
  const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
  const area = S * S;
  const input = new Float32Array(3 * area);
  for (let i = 0; i < area; i++) {
    const p = i * 4;
    input[i] = (px[p] / 255 - mean[0]) / std[0];
    input[area + i] = (px[p + 1] / 255 - mean[1]) / std[1];
    input[2 * area + i] = (px[p + 2] / 255 - mean[2]) / std[2];
  }
  const inputName = session.inputNames[0];
  const tensor = new ort.Tensor('float32', input, [1, 3, S, S]);
  const out = await session.run({ [inputName]: tensor });
  const key = session.outputNames[0];
  const t = out[key];
  const dims: number[] = t.dims as any;
  const oh = dims[dims.length - 2] || S;
  const ow = dims[dims.length - 1] || S;
  const src = t.data as Float32Array;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < ow * oh; i++) { const v = src[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = hi - lo || 1;
  const data = new Float32Array(ow * oh);
  for (let i = 0; i < data.length; i++) data[i] = (src[i] - lo) / span;
  return { data, w: ow, h: oh };
}

function sampleDepth(g: DepthGrid, x: number, y: number, gw: number, gh: number) {
  const gx = Math.min(g.w - 1, Math.floor((x / gw) * g.w));
  const gy = Math.min(g.h - 1, Math.floor((y / gh) * g.h));
  return g.data[gy * g.w + gx];
}

export async function prepare2_5D(img: HTMLImageElement, w: number, h: number, mode: 'ai' | 'proc'): Promise<DepthLayers> {
  let grid: DepthGrid;
  if (mode === 'ai') grid = await aiDepth(img);
  else grid = proceduralDepth(img);

  const gw = 64, gh = 64;
  const bands: HTMLCanvasElement[] = [];
  for (let b = 0; b < BANDS; b++) {
    const mask = makeGridCanvas(gw, gh);
    const mctx = mask.getContext('2d')!;
    const id = mctx.createImageData(gw, gh);
    const d = id.data;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      const v = sampleDepth(grid, x, y, gw, gh);
      const inBand = v >= b / BANDS && (b === BANDS - 1 ? v <= 1 : v < (b + 1) / BANDS);
      const p = i * 4;
      if (inBand) { d[p] = 255; d[p + 1] = 255; d[p + 2] = 255; d[p + 3] = 255; }
    }
    mctx.putImageData(id, 0, 0);

    const band = document.createElement('canvas');
    band.width = w; band.height = h;
    const bc = band.getContext('2d')!;
    const t = coverTransform(img.width, img.height, w, h);
    bc.drawImage(img, t.dx, t.dy, t.dw, t.dh);
    bc.globalCompositeOperation = 'destination-in';
    bc.imageSmoothingEnabled = true; bc.imageSmoothingQuality = 'high';
    bc.drawImage(mask, 0, 0, w, h);
    bc.globalCompositeOperation = 'source-over';
    bands.push(band);
  }

  const far = document.createElement('canvas');
  far.width = w; far.height = h;
  const fc = far.getContext('2d')!;
  const t = coverTransform(img.width, img.height, w, h, 1.16);
  try { (fc as any).filter = 'blur(14px)'; } catch { /* */ }
  fc.drawImage(img, t.dx, t.dy, t.dw, t.dh);
  try { (fc as any).filter = 'none'; } catch { /* */ }
  return { bands, far, count: BANDS };
}

export function draw2_5D(ctx: CanvasRenderingContext2D, layers: DepthLayers, w: number, h: number, p: number, strength = 1) {
  const mx = Math.sin(p * Math.PI * 2) * 0.035 * w * strength;
  const my = Math.cos(p * Math.PI) * 0.022 * h * strength;
  const zoom = 1.04 + 0.03 * Math.sin(p * Math.PI) * strength;
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2 + mx * 0.35, h / 2 + my * 0.35);
  ctx.scale(zoom, zoom);
  ctx.drawImage(layers.far, -w / 2, -h / 2, w, h);
  ctx.restore();
  for (let b = 0; b < layers.count; b++) {
    const f = (b + 1) / layers.count;
    ctx.save();
    ctx.translate(w / 2 + mx * f, h / 2 + my * f);
    ctx.scale(zoom, zoom);
    ctx.drawImage(layers.bands[b], -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  ctx.restore();
}
