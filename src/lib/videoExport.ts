// تصدير MP4 1080p عبر WebCodecs (VideoEncoder/AudioEncoder) + mp4-muxer.
// المتصفحات الحديثة (Chrome/Edge) تدعمه؛ لو مش مدعوم نرجع للمسار القديم (WebM عبر MediaRecorder).

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export function evenDim(v: number) {
  return Math.max(2, Math.round(v / 2) * 2);
}

export function mp4Dims(w: number, h: number) {
  const base = 1080;
  if (w <= h) {
    const width = base;
    return { width: evenDim(width), height: evenDim(Math.round((width * h) / w)) };
  }
  const height = base;
  return { width: evenDim(Math.round((height * w) / h)), height: evenDim(height) };
}

export function supportsMP4(): boolean {
  const w = window as any;
  return typeof w.VideoEncoder === 'function' && typeof w.AudioEncoder === 'function' && typeof w.VideoFrame === 'function';
}

export type Mp4Options = {
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  draw: (ctx: CanvasRenderingContext2D, p: number, frame: number) => void;
  audio?: AudioBuffer | null;
  volume: number;
  onProgress?: (p: number) => void;
  shouldCancel?: () => boolean;
};

export async function renderMp4Video(opts: Mp4Options): Promise<Blob> {
  const { width, height, fps, durationSec, draw, audio, volume, onProgress, shouldCancel } = opts;
  const w = window as any;
  if (typeof w.VideoEncoder !== 'function') throw new Error('WebCodecs غير مدعوم في هذا المتصفح');

  const totalFrames = Math.max(1, Math.round(durationSec * fps));
  const hasAudio = !!audio && typeof w.AudioEncoder === 'function';
  const ab = audio || null;

  const target = new ArrayBufferTarget();
  const muxerOptions: any = {
    target,
    video: { codec: 'avc', width, height },
    fastStart: 'in-memory',
  };
  if (hasAudio && ab) {
    muxerOptions.audio = {
      codec: 'aac',
      numberOfChannels: Math.min(2, ab.numberOfChannels),
      sampleRate: ab.sampleRate,
    };
  }
  const muxer = new Muxer(muxerOptions);

  let encErr: any = null;
  const videoEncoder = new w.VideoEncoder({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: any) => { encErr = e; },
  });
  videoEncoder.configure({ codec: 'avc1.640028', width, height, bitrate: 8_000_000, framerate: fps });

  let audioEncoder: any = null;
  let audioDone: Promise<void> = Promise.resolve();
  if (hasAudio && ab) {
    const sr = ab.sampleRate;
    const ch = Math.min(2, ab.numberOfChannels);
    const chans: Float32Array[] = [];
    for (let c = 0; c < ch; c++) chans.push(ab.getChannelData(ab.numberOfChannels > 1 ? c : 0));
    audioEncoder = new w.AudioEncoder({
      output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
      error: (e: any) => { encErr = e; },
    });
    audioEncoder.configure({ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: ch, bitrate: 128000 });
    audioDone = (async () => {
      const block = 1024;
      const totalSamples = Math.round(durationSec * sr);
      const buf = new Float32Array(block * ch);
      for (let off = 0; off < totalSamples; off += block) {
        const cnt = Math.min(block, totalSamples - off);
        for (let i = 0; i < cnt; i++) {
          const si = (off + i) % ab.length;
          for (let c = 0; c < ch; c++) buf[i * ch + c] = chans[c][si] * volume;
        }
        const data = buf.slice(0, cnt * ch);
        const ad = new w.AudioData({ format: 'f32', sampleRate: sr, numberOfFrames: cnt, numberOfChannels: ch, timestamp: (off / sr) * 1e6, data });
        audioEncoder.encode(ad);
        ad.close();
        if ((off / block) % 200 === 0) await new Promise(r => setTimeout(r));
      }
      await audioEncoder.flush();
    })();
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const keyInt = Math.max(1, Math.round(fps * 2));

  for (let i = 0; i < totalFrames; i++) {
    if (shouldCancel && shouldCancel()) {
      try { videoEncoder.close(); } catch { /* */ }
      try { audioEncoder?.close(); } catch { /* */ }
      throw new Error('تم الإلغاء');
    }
    draw(ctx, i / totalFrames, i);
    const frame = new w.VideoFrame(canvas, { timestamp: (i / fps) * 1e6, duration: 1e6 / fps });
    videoEncoder.encode(frame, { keyFrame: i % keyInt === 0 });
    frame.close();
    if (encErr) throw encErr;
    if (onProgress && i % 3 === 0) onProgress(i / totalFrames);
    if (videoEncoder.encodeQueueSize > 6) await new Promise(r => setTimeout(r));
  }
  await videoEncoder.flush();
  await audioDone;
  muxer.finalize();
  return new Blob([target.buffer], { type: 'video/mp4' });
}
