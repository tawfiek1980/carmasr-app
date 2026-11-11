import { useRef, useState } from "react";
import { Upload, X, Loader2, Video, CheckCircle, ShieldCheck } from "lucide-react";
import {
  uploadVideo, watermarkVideoToFile, validateVideoFile, getVideoDuration,
  VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, VIDEO_ACCEPT, videoPosterUrl,
} from "../lib/storageService";

const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

interface Props {
  value?: string;
  onChange: (url: string) => void;
  folder?: string;
  phone?: string;
  label?: string;
}

type Phase = "idle" | "marking" | "uploading";

export default function VideoUploader({ value, onChange, folder = "listings", phone, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase]     = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError]     = useState("");
  const [fileName, setFileName] = useState("");

  const busy = phase !== "idle";

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!CLOUD_NAME || !UPLOAD_PRESET) { setError("⚠️ إعدادات Cloudinary ناقصة في .env"); return; }

    setError("");
    const check = validateVideoFile(file);
    if (!check.ok) { setError(check.error); return; }

    const duration = await getVideoDuration(file);
    if (duration > VIDEO_MAX_SECONDS) {
      setError(`مدة الفيديو ${Math.round(duration)} ثانية — الحد الأقصى ${VIDEO_MAX_SECONDS} ثانية`);
      return;
    }

    setFileName(file.name);
    setProgress(0);
    try {
      // 1) ختم الفيديو بشعار كار مصر + رقم/اسم المعلن (معدل الزمن الحقيقي)
      setPhase("marking");
      const marked = await watermarkVideoToFile(file, phone, label, setProgress);
      // 2) رفع الفيديو المختوم
      setPhase("uploading");
      setProgress(0);
      const url = await uploadVideo(marked, folder, setProgress);
      onChange(url);
    } catch (err: any) {
      setError(err?.message || "تعذر تجهيز الفيديو");
    } finally {
      setPhase("idle");
    }
  };

  const remove = () => { onChange(""); setFileName(""); setError(""); };

  return (
    <div>
      {!CLOUD_NAME && (
        <div className="bg-danger/10 text-danger text-xs p-2 rounded-lg mb-3">
          ⚠️ VITE_CLOUDINARY_CLOUD_NAME مش موجود في .env
        </div>
      )}

      {value ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-border bg-black">
          <video
            src={value}
            poster={videoPosterUrl(value)}
            controls
            playsInline
            preload="metadata"
            className="w-full aspect-video bg-black"
          />
          <button type="button" onClick={remove}
            className="absolute top-2 left-2 w-8 h-8 bg-danger rounded-full flex items-center justify-center shadow">
            <X className="w-4 h-4 text-white" />
          </button>
          <span className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 text-white text-[11px] px-2 py-0.5 rounded">
            <CheckCircle className="w-3 h-3 text-green-400" /> تم الرفع مع ختم كار مصر
          </span>
        </div>
      ) : busy ? (
        <div className="w-full aspect-video rounded-xl border-2 border-dashed border-orange bg-orange/5 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-7 h-7 text-orange animate-spin" />
          <span className="text-sm text-orange font-bold">
            {phase === "marking" ? "جاري ختم الفيديو بشعار كار مصر…" : "جاري رفع الفيديو…"} {progress}%
          </span>
          <span className="text-xs text-text-light px-6 text-center">
            {phase === "marking" ? "المعالجة تتم بمعدل الزمن الحقيقي — سيب الصفحة مفتوحة" : "لحظات…"}
          </span>
          <div className="w-2/3 h-1.5 bg-orange/20 rounded-full overflow-hidden">
            <div className="h-full bg-orange transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full aspect-video rounded-xl border-2 border-dashed border-border hover:border-orange bg-bg hover:bg-orange/5 flex flex-col items-center justify-center gap-2 transition-colors">
          <Upload className="w-7 h-7 text-text-light" />
          <span className="text-sm text-text-light font-bold">أضف فيديو للعربية (اختياري)</span>
          <span className="text-xs text-text-light">MP4 / MOV / WEBM • حتى {Math.round(VIDEO_MAX_BYTES / 1024 / 1024)} ميجا • حتى {VIDEO_MAX_SECONDS} ثانية</span>
          <span className="text-[11px] text-orange flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> يُختم تلقائيًا بشعار كار مصر ورقم المعلن
          </span>
        </button>
      )}

      <input ref={inputRef} type="file" accept={VIDEO_ACCEPT} className="hidden"
        onChange={e => { handleFile(e.target.files); e.target.value = ""; }} />

      <div className="flex items-center justify-between text-xs text-text-light mt-2">
        <span className="flex items-center gap-1">
          <Video className="w-3.5 h-3.5" />
          فيديو واحد اختياري • {Math.round(VIDEO_MAX_BYTES / 1024 / 1024)} ميجا / {VIDEO_MAX_SECONDS} ثانية
        </span>
        {fileName && !value && <span className="truncate max-w-[50%]">{fileName}</span>}
      </div>

      {error && <p className="text-danger text-xs mt-2 bg-danger/5 px-3 py-2 rounded-lg">{error}</p>}
    </div>
  );
}
