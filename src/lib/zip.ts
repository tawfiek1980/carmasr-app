/**
 * ZIP بسيط بدون ضغط (Store) — مناسب للصور لأنها مضغوطة أصلًا.
 * بيشتغل في المتصفح بدون أي مكتبات، وبيقبل أسماء ملفات عربية (UTF-8).
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d = new Date()) {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

export type ZipFile = { name: string; data: Uint8Array };

/** يبني ملف ZIP في الذاكرة ويرجّعه كـ Blob جاهز للتنزيل */
export function createZip(files: ZipFile[]): Blob {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime();
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const size = file.data.length;
    const crc = crc32(file.data);

    // Local file header
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);       // version needed
    lv.setUint16(6, 0x0800, true);   // UTF-8 filename
    lv.setUint16(8, 0, true);        // store (no compression)
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);    // compressed size
    lv.setUint32(22, size, true);    // uncompressed size
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);       // extra length
    local.set(name, 30);

    parts.push(local as BlobPart, file.data as BlobPart);

    // Central directory header
    const cent = new Uint8Array(46 + name.length);
    const cv = new DataView(cent.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);       // version made by
    cv.setUint16(6, 20, true);       // version needed
    cv.setUint16(8, 0x0800, true);   // UTF-8 filename
    cv.setUint16(10, 0, true);       // store
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true);       // extra length
    cv.setUint16(32, 0, true);       // comment length
    cv.setUint16(34, 0, true);       // disk number
    cv.setUint16(36, 0, true);       // internal attrs
    cv.setUint32(38, 0, true);       // external attrs
    cv.setUint32(42, offset, true);  // local header offset
    cent.set(name, 46);
    central.push(cent);

    offset += local.length + size;
  }

  const centralSize = central.reduce((sum, c) => sum + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  for (const c of central) parts.push(c as BlobPart);
  parts.push(end as BlobPart);
  return new Blob(parts, { type: 'application/zip' });
}

const ARABIC_LATIN: Record<string, string> = {
  ا: 'a', أ: 'a', إ: 'a', آ: 'a', ٱ: 'a', ب: 'b', ت: 't', ث: 'th', ج: 'g', ح: 'h', خ: 'kh',
  د: 'd', ذ: 'z', ر: 'r', ز: 'z', س: 's', ش: 'sh', ص: 's', ض: 'd', ط: 't', ظ: 'z', ع: 'a',
  غ: 'gh', ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', و: 'w', ي: 'y', ى: 'a',
  ة: 'a', ء: '', ئ: 'y', ؤ: 'w', لا: 'la',
};

/**
 * اسم ملف صديق للسيو: حروف لاتينية + أرقام + شرطات.
 * بيتحوّل العربي لحروف لاتينية تقريبية بدل ما يتحذف الاسم بالكامل.
 */
export function seoSlug(input: string, maxLength = 70): string {
  const text = String(input || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '');
  let latin = '';
  for (const ch of text) {
    latin += ARABIC_LATIN[ch] ?? ch;
  }
  return latin
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}
