import { useRef, useState } from "react";
import { Upload, X, Loader2, ImageIcon, Star, MoveLeft, MoveRight } from "lucide-react";
import { compressAndWatermark, compressImage, uploadFileToCloudinary } from "../lib/storageService";

const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

interface Props {
  images: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  folder?: string;
  watermarkLabel?: string;
  watermarkPhone?: string;
}

export default function ImageUploader({ images, onChange, max = 10, folder = "listings", watermarkLabel, watermarkPhone }: Props) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<Record<string, number>>({});
  const [error, setError]         = useState("");

  // ── رفع ملفات (_parallel) ──────────────────────────────────────────
  const handleFiles = async (files: FileList | null) => {
    if (!files || !CLOUD_NAME || !UPLOAD_PRESET) {
      setError("⚠️ إعدادات Cloudinary ناقصة في .env");
      return;
    }
    const remaining = max - images.length;
    const picked    = Array.from(files).slice(0, remaining);
    if (!picked.length) return;
    setError("");

    const valid = picked.filter(f => {
      if (!f.type.startsWith("image/")) { setError(`${f.name} ليس صورة`); return false; }
      if (f.size > 10 * 1024 * 1024)   { setError(`${f.name} أكبر من 10MB`); return false; }
      return true;
    });

    const tasks = valid.map((file, i) => {
      const key = `${Date.now()}_${i}`;
      const compressed = (folder === "listings" || watermarkLabel || watermarkPhone)
        ? compressAndWatermark(file, 1200, watermarkPhone, watermarkLabel)
        : compressImage(file, 1200);
      return compressed.then(c =>
        uploadFileToCloudinary(c, folder, pct =>
          setUploading(p => ({ ...p, [key]: pct }))
        ).finally(() => setUploading(p => { const n = { ...p }; delete n[key]; return n; }))
      );
    });

    const results = await Promise.allSettled(tasks);
    const newUrls = results.filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled").map(r => r.value);
    const failed  = results.filter(r => r.status === "rejected");
    if (failed.length) setError(`فشل رفع ${failed.length} من ${valid.length} صور`);
    if (newUrls.length) onChange([...images, ...newUrls]);
  };

  // ── إزالة صورة ────────────────────────────────────────────────────
  const remove = (url: string) => onChange(images.filter(u => u !== url));

  // ── تحريك الصورة يمين/يسار ────────────────────────────────────────
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...images];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  // ── جعل صورة رئيسية ──────────────────────────────────────────────
  const makePrimary = (idx: number) => {
    if (idx === 0) return;
    const next = [...images];
    const [img] = next.splice(idx, 1);
    next.unshift(img);
    onChange(next);
  };

  const isUploading = Object.keys(uploading).length > 0;

  return (
    <div>
      {!CLOUD_NAME && (
        <div className="bg-danger/10 text-danger text-xs p-2 rounded-lg mb-3">
          ⚠️ VITE_CLOUDINARY_CLOUD_NAME مش موجود في .env
        </div>
      )}

      {/* Grid الصور */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
        {images.map((url, i) => (
          <div key={url} className="relative aspect-square rounded-xl overflow-hidden border-2 border-border group">
            <img src={url} alt={`صورة ${i+1}`} className="w-full h-full object-cover" />

            {/* Overlay عند Hover */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
              {/* حذف */}
              <button type="button" onClick={() => remove(url)}
                className="w-7 h-7 bg-danger rounded-full flex items-center justify-center shadow">
                <X className="w-3.5 h-3.5 text-white" />
              </button>
              {/* تعيين رئيسية */}
              {i !== 0 && (
                <button type="button" onClick={() => makePrimary(i)}
                  title="جعلها الصورة الرئيسية"
                  className="w-7 h-7 bg-orange rounded-full flex items-center justify-center shadow">
                  <Star className="w-3.5 h-3.5 text-white" />
                </button>
              )}
              {/* تحريك */}
              <div className="flex gap-1">
                {i > 0 && (
                  <button type="button" onClick={() => move(i, -1)}
                    className="w-6 h-6 bg-white/80 rounded-full flex items-center justify-center">
                    <MoveRight className="w-3 h-3 text-navy" />
                  </button>
                )}
                {i < images.length - 1 && (
                  <button type="button" onClick={() => move(i, 1)}
                    className="w-6 h-6 bg-white/80 rounded-full flex items-center justify-center">
                    <MoveLeft className="w-3 h-3 text-navy" />
                  </button>
                )}
              </div>
            </div>

            {/* شارة الصورة الرئيسية */}
            {i === 0 && (
              <span className="absolute bottom-1.5 right-1.5 bg-orange text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                رئيسية
              </span>
            )}
            {/* رقم الصورة */}
            <span className="absolute top-1.5 left-1.5 bg-black/40 text-white text-[10px] px-1.5 py-0.5 rounded">
              {i + 1}
            </span>
          </div>
        ))}

        {/* Placeholders أثناء الرفع */}
        {Object.entries(uploading).map(([key, pct]) => (
          <div key={key} className="aspect-square rounded-xl border-2 border-dashed border-orange bg-orange/5 flex flex-col items-center justify-center gap-1">
            <Loader2 className="w-6 h-6 text-orange animate-spin" />
            <span className="text-xs text-orange font-bold">{pct}%</span>
          </div>
        ))}

        {/* زرار إضافة */}
        {images.length + Object.keys(uploading).length < max && (
          <button type="button" onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-orange bg-bg hover:bg-orange/5 flex flex-col items-center justify-center gap-1.5 transition-colors">
            <Upload className="w-6 h-6 text-text-light" />
            <span className="text-xs text-text-light">إضافة</span>
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => handleFiles(e.target.files)} />

      <div className="flex items-center justify-between text-xs text-text-light">
        <span className="flex items-center gap-1">
          <ImageIcon className="w-3.5 h-3.5" />
          {images.length}/{max} صورة
        </span>
        <span>مرّر على الصورة للتعديل أو الحذف</span>
      </div>

      {error && <p className="text-danger text-xs mt-2 bg-danger/5 px-3 py-2 rounded-lg">{error}</p>}
    </div>
  );
}
