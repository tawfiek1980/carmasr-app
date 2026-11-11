/**
 * storageService.ts
 * رفع الصور على Cloudinary — مجاني بدون بطاقة + водmark تلقائي
 */

const CLOUD_NAME   = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export type UploadProgress = (progress: number) => void;

// ── حدود فيديو الإعلان ─────────────────────────────────────────────
// الفيديو يُعاد ترميزه (ختم) قبل الرفع، فالخرج ثابت الحجم تقريبًا (~2.8 ميجا/ث)؛
// لذلك حد الملف الأصلي واسع لتوفير تعب الضغط على المعلن.
export const VIDEO_MAX_BYTES   = 150 * 1024 * 1024; // 150 ميجا (الأصل)
export const VIDEO_MAX_SECONDS = 90;                // 90 ثانية
export const VIDEO_ACCEPT      = "video/mp4,video/quicktime,video/webm";
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const VIDEO_EXT   = /\.(mp4|mov|webm)$/i;

/** التحقق من أن الملف فيديو مسموح بصيغة/حجم/مدة صحيحة */
export function validateVideoFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!VIDEO_TYPES.includes(file.type) && !VIDEO_EXT.test(file.name))
    return { ok: false, error: "الصيغة غير مدعومة — المسموح MP4 أو MOV أو WEBM" };
  if (file.size > VIDEO_MAX_BYTES)
    return { ok: false, error: `حجم الفيديو ${(file.size / 1024 / 1024).toFixed(0)} ميجا — الحد الأقصى ${Math.round(VIDEO_MAX_BYTES / 1024 / 1024)} ميجا` };
  return { ok: true };
}

/** قراءة مدة الفيديو بالثواني (best-effort) */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    const done = (d: number) => { URL.revokeObjectURL(url); resolve(Number.isFinite(d) && d > 0 ? d : 0); };
    v.onloadedmetadata = () => done(v.duration);
    v.onerror = () => done(0);
    v.src = url;
  });
}

/** صورة غلاف (poster) لفيديو Cloudinary — الإطار الأول كـ JPG */
export function videoPosterUrl(url: string): string {
  if (!url) return "";
  return url
    .replace("/video/upload/", "/video/upload/so_0/")
    .replace(/\.(mp4|mov|webm|m4v|avi)$/i, ".jpg");
}

/** رفع فيديو على Cloudinary (resource type = video) */
export function uploadVideo(file: File, folder: string, onProgress?: UploadProgress): Promise<string> {
  const formData = new FormData();
  formData.append("file",          file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder",        `tareeq/${folder}`);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload  = () => xhr.status === 200
      ? resolve(JSON.parse(xhr.responseText).secure_url)
      : reject(new Error("فشل رفع الفيديو - " + xhr.status));
    xhr.onerror = () => reject(new Error("خطأ في الاتصال أثناء رفع الفيديو"));
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`);
    xhr.send(formData);
  });
}

const VIDEO_REC_MIMES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

function pickVideoMime(): string {
  const MR = (window as any).MediaRecorder;
  return VIDEO_REC_MIMES.find(m => MR?.isTypeSupported?.(m)) || "";
}

const evenDim = (v: number) => Math.max(2, Math.round(v / 2) * 2);

/**
 * ختم الفيديو تلقائيًا (شعار كار مصر + رقم/اسم المعلن) بإعادة الرسم على canvas
 * وتسجيله عبر MediaRecorder — يعيد File جاهز للرفع (MP4 لو المتصفح يدعمه وإلا WebM).
 * ملاحظة: المعالجة تجري بمعدل الزمن الحقيقي (فيديو 60ث ≈ 60ث معالجة).
 */
export async function watermarkVideoToFile(
  file: File,
  phone: string | undefined,
  label: string | undefined,
  onProgress?: UploadProgress,
): Promise<File> {
  const MR = (window as any).MediaRecorder;
  if (!MR) throw new Error("المتصفح لا يدعم معالجة الفيديو");

  const srcUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = srcUrl;
  video.playsInline = true;
  video.preload = "auto";
  video.volume = 1;
  (video as any).crossOrigin = "anonymous";

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("تعذر قراءة الفيديو"));
    });
  } catch (e) {
    URL.revokeObjectURL(srcUrl);
    throw e;
  }

  const dur = Number.isFinite(video.duration) ? video.duration : 0;
  const vw = video.videoWidth || 720;
  const vh = video.videoHeight || 1280;
  const ratio = Math.min(1, 1280 / Math.max(vw, vh));
  const width = evenDim(Math.round(vw * ratio));
  const height = evenDim(Math.round(vh * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const videoStream = (canvas as any).captureStream(30) as MediaStream;
  const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

  let actx: AudioContext | null = null;
  let srcNode: MediaElementAudioSourceNode | null = null;
  let hasAudio = false;
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AC) {
      actx = new AC();
      await actx!.resume().catch(() => {});
      srcNode = actx!.createMediaElementSource(video);
      const dest = actx!.createMediaStreamDestination();
      srcNode.connect(dest); // نوصّله بالمسجّل فقط، مش بالمكبّر → صامت للسامع أثناء المعالجة
      const at = dest.stream.getAudioTracks();
      if (at.length) { tracks.push(...at); hasAudio = true; }
    }
  } catch { /* نتجاهل الصوت عند تعذّره */ }
  // مهم: كتم عنصر الفيديو بيلغي صوت MediaElementSource — نسكت بالمكبّر فقط (الوصلة فوق)
  // لو تعذّر تجهيز المسار الصوتي لأي سبب، نحكّم الكاتم عشان ميطلعش صوت أثناء المعالجة.
  video.muted = !hasAudio;

  const mixed = new MediaStream(tracks);
  const mime = pickVideoMime();
  const rec = new MR(mixed, {
    mimeType: mime || undefined,
    videoBitsPerSecond: 2_800_000,
    audioBitsPerSecond: 128_000,
  });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size) chunks.push(e.data); };
  const recDone = new Promise<void>(res => { rec.onstop = () => res(); });
  rec.start(200);

  try { await video.play(); } catch {
    await new Promise(r => setTimeout(r, 150));
    try { await video.play(); } catch { /* نكمل — مهلة الأمان تحت هتخلص */ }
  }

  await new Promise<void>(resolve => {
    let lastT = -1, stall = 0;
    const draw = () => {
      try {
        ctx.drawImage(video, 0, 0, width, height);
        paintWatermarkOverlay(ctx, width, height, phone, label);
      } catch { /* إطار غير جاهز — نتجاهله */ }
      if (dur) onProgress?.(Math.min(99, Math.round((video.currentTime / dur) * 100)));
      if (video.ended || (dur && video.currentTime >= dur - 0.05)) { resolve(); return; }
      // مهلة أمان: لو التشغيل واقف (الوقت مش بيتقدّم) ننهي بدل ما نعلّق الصفحة
      if (video.currentTime === lastT) { if (++stall > 600) { resolve(); return; } }
      else { stall = 0; lastT = video.currentTime; }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  });

  try { if (rec.state !== "inactive") rec.stop(); } catch { /* */ }
  await recDone;
  try { srcNode?.disconnect(); } catch { /* */ }
  try { await actx?.close(); } catch { /* */ }
  video.pause();
  URL.revokeObjectURL(srcUrl);
  onProgress?.(100);

  const type = (mime || "video/webm").split(";")[0];
  const ext = type === "video/mp4" ? "mp4" : "webm";
  const blob = new Blob(chunks, { type });
  if (!blob.size) throw new Error("فشل تجهيز الفيديو");
  const outName = (file.name || "video").replace(/\.[^.]+$/, "") + `-tareeq.${ext}`;
  return new File([blob], outName, { type });
}

/**
 * رفع صورة واحدة على Cloudinary
 */
export async function uploadImage(
  file: File,
  folder: "listings" | "profiles" | "documents",
  _userId: string,
  onProgress?: UploadProgress
): Promise<string> {
  const formData = new FormData();
  formData.append("file",           file);
  formData.append("upload_preset",  UPLOAD_PRESET);
  formData.append("folder",         `tareeq/${folder}`);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress?.(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const res = JSON.parse(xhr.responseText);
        resolve(res.secure_url);
      } else {
        reject(new Error("فشل رفع الصورة"));
      }
    };

    xhr.onerror = () => reject(new Error("خطأ في الاتصال"));

    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);
    xhr.send(formData);
  });
}

/**
 * رفع عدة صور
 */
export async function uploadImages(
  files: File[],
  folder: "listings" | "profiles" | "documents",
  userId: string,
  onProgress?: (index: number, progress: number) => void
): Promise<string[]> {
  return Promise.all(
    files.map((file, i) =>
      uploadImage(file, folder, userId, p => onProgress?.(i, p))
    )
  );
}

const WATERMARK_ORANGE = "#f97316";
const WATERMARK_DARK   = "10, 22, 40";

/**
 * رسم الختم على canvas: شريط علوي ثابت (شعار كار مصر عربي + إنجليزي)،
 * وشريط سفلي: اسم المعرض (يمين) + رقم المعرض (يسار) عند تمرير label،
 * أو رقم المعلن / اسم المنصة عند عدم تمريره.
 */
function renderWatermark(img: HTMLImageElement, maxSizePx: number, phone?: string, label?: string): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  let { width, height } = img;
  if (width > maxSizePx || height > maxSizePx) {
    if (width > height) {
      height = (height / width) * maxSizePx;
      width  = maxSizePx;
    } else {
      width  = (width / height) * maxSizePx;
      height = maxSizePx;
    }
  }
  canvas.width  = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);

  paintWatermarkOverlay(ctx, width, height, phone, label);
  return canvas;
}

/**
 * رسم الختم (شعار كار مصر + رقم/اسم المعلن) على canvas بأبعاد محددة.
 * مستقلة عن الصورة — تُستخدم للصور والفيديو.
 */
export function paintWatermarkOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, phone?: string, label?: string) {
  const scale     = width / 800;
  const padR      = Math.round(20 * scale);
  const mainSize  = Math.round(20 * scale);
  const smallSize = Math.round(12 * scale);
  const barH      = Math.round(40 * scale);
  const phoneText = phone ? phone.replace(/[^\d+]/g, "") : "";

  // ── شريط علوي: شعار كار مصر (عربي يمين + إنجليزي يسار) ──
  ctx.save();
  ctx.fillStyle = `rgba(${WATERMARK_DARK}, 0.85)`;
  ctx.fillRect(0, 0, width, barH);
  ctx.fillStyle = WATERMARK_ORANGE;
  ctx.fillRect(0, barH - Math.round(3 * scale), width, Math.round(3 * scale));
  ctx.font = `900 ${smallSize}px Cairo, Arial, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "right";
  ctx.fillText("كار مصر", width - padR, barH / 2);
  ctx.textAlign = "left";
  ctx.fillText("CarMasr-EG", padR, barH / 2);
  ctx.restore();

  if (label) {
    // ── شريط سفلي: اسم المعرض (يمين) + رقم المعرض (يسار) ──
    const barH2 = Math.round(58 * scale);
    const barY  = height - barH2;
    ctx.save();
    const grad = ctx.createLinearGradient(0, barY, 0, height);
    grad.addColorStop(0, `rgba(${WATERMARK_DARK}, 0.35)`);
    grad.addColorStop(0.18, `rgba(${WATERMARK_DARK}, 0.92)`);
    grad.addColorStop(1, `rgba(${WATERMARK_DARK}, 0.98)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, barY, width, barH2);
    ctx.fillStyle = WATERMARK_ORANGE;
    ctx.fillRect(0, barY, width, Math.round(3 * scale));

    // اسم المعرض — تصغير تلقائي ليتسع داخل الشريط
    const maxNameW   = width - padR * 2;
    const minNameSize = Math.round(12 * scale);
    let nameSize = Math.round(24 * scale);
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    do {
      ctx.font = `900 ${nameSize}px Cairo, Arial, sans-serif`;
      if (ctx.measureText(label).width <= maxNameW || nameSize <= minNameSize) break;
      nameSize -= 1;
    } while (nameSize > minNameSize);
    ctx.fillText(label, width - padR, barY + barH2 * 0.36);

    // رقم المعرض
    if (phoneText) {
      ctx.font = `700 ${smallSize}px Cairo, Arial, sans-serif`;
      ctx.fillStyle = "#fdba74";
      ctx.textAlign = "left";
      ctx.fillText(phoneText, padR, barY + barH2 * 0.74);
    }
    ctx.restore();
  } else {
    // ── شريط سفلي: رقم المعلن (أو اسم المنصة لو الصورة بدون رقم) ──
    const barY = height - barH;
    ctx.save();
    const grad = ctx.createLinearGradient(0, barY, 0, height);
    grad.addColorStop(0, `rgba(${WATERMARK_DARK}, 0.35)`);
    grad.addColorStop(0.2, `rgba(${WATERMARK_DARK}, 0.92)`);
    grad.addColorStop(1, `rgba(${WATERMARK_DARK}, 0.98)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, barY, width, barH);
    ctx.fillStyle = WATERMARK_ORANGE;
    ctx.fillRect(0, barY, width, Math.round(3 * scale));
    ctx.font = `900 ${mainSize}px Cairo, Arial, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(phoneText || "كار مصر", width - padR, barY + barH / 2);
    ctx.restore();
  }
}

function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File | null> {
  return new Promise(resolve => {
    canvas.toBlob(
      blob => resolve(blob ? new File([blob], name, { type: "image/jpeg", lastModified: Date.now() }) : null),
      "image/jpeg",
      0.85
    );
  });
}

/**
 * ضغط الصورة + إضافة водmark
 * @param phone رقم المعرض/المعلن
 * @param label اسم المعرض (لو موجود يستبدل الشريط السفلي باسم المعرض + الرقم)
 */
export function compressAndWatermark(file: File, maxSizePx = 1200, phone?: string, label?: string): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    const fallback = () => { URL.revokeObjectURL(url); resolve(file); };

    img.onerror = fallback;
    img.onload = async () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = renderWatermark(img, maxSizePx, phone, label);
        if (!canvas) { fallback(); return; }
        const out = await canvasToFile(canvas, file.name);
        resolve(out || file);
      } catch {
        fallback();
      }
    };
    img.src = url;
  });
}

/**
 * ضغط الصورة بدون водmark (للصور الشخصية/الملفات)
 */
export function compressImage(file: File, maxSizePx = 1200): Promise<File> {
  return compressAndWatermark(file, maxSizePx);
}

/** رفع ملف جاهز (مضغوط/مختوم) على Cloudinary */
export function uploadFileToCloudinary(file: File, folder: string, onProgress?: UploadProgress): Promise<string> {
  const formData = new FormData();
  formData.append("file",          file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder",        `tareeq/${folder}`);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = e => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload  = () => xhr.status === 200
      ? resolve(JSON.parse(xhr.responseText).secure_url)
      : reject(new Error("فشل رفع الصورة - " + xhr.status));
    xhr.onerror = () => reject(new Error("خطأ في الاتصال"));
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);
    xhr.send(formData);
  });
}

/** تحميل صورة من رابط خارجي مع دعم CORS (لإعادة الختم) */
function loadDirect(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("فشل تحميل الصورة"));
    img.src = url;
  });
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(objUrl); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error("فشل تحميل الصورة")); };
    img.src = objUrl;
  });
}

/**
 * تحميل صورة لإعادة الختم. نمرّ عبر بروكسي نفس-الأصل (/api/img-proxy) لتجنّب
 * تلوث الـ canvas أو حجب CORS من مضيفات قديمة، مع رجوع مباشر عند تعذّر البروكسي.
 */
async function loadRemoteImage(url: string): Promise<HTMLImageElement> {
  if (!url) throw new Error("رابط الصورة غير صالح");
  try {
    const res = await fetch(`/api/og-image?proxy=${encodeURIComponent(url)}`, { mode: "cors" });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.type.startsWith("image/") && blob.size > 0) return await blobToImage(blob);
    }
  } catch { /* fall back to direct load */ }
  return loadDirect(url);
}

/**
 * إعادة ختم صورة قديمة بنفس الطريقة: تحمّل الصورة ثم ترسم عليها الختم الكامل
 * (شعار كار مصر عربي/إنجليزي + اسم ورقم المعرض) وترجّع File جاهز للرفع.
 * الشريط العلوي يُعاد رسمه فوق نفسه (مطابق تماماً) فتبقى الصورة نظيفة.
 */
export async function restampImageUrl(url: string, label: string, phone?: string, maxSizePx = 1200): Promise<File> {
  const img = await loadRemoteImage(url);
  const canvas = renderWatermark(img, maxSizePx, phone, label);
  if (!canvas) throw new Error("فشل تجهيز الصورة");
  const base = (url.split("/").pop() || "product").replace(/\.[^.]+$/, "");
  const out = await canvasToFile(canvas, `${base}.jpg`);
  if (!out) throw new Error("فشل توليد الصورة");
  return out;
}

/**
 * حذف صورة — Cloudinary unsigned preset مش بيسمح بالحذف من الـ client
 * بنتركها فاضية
 */
export async function deleteImage(_url: string): Promise<void> {
  // يحتاج server-side للحذف — مش ضروري دلوقتي
}
