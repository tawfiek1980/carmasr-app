/**
 * أدوات كشف وإصلاح تلف الترميز (mojibake).
 *
 * المشكلة: ملف UTF-8 بيتقرا بترميز Windows-1252/Latin-1 وبعدين يتحفظ تاني،
 * فالنص العربي بيتحول لحروف لاتينية مشوّهة. الدالة بتعكس العملية:
 * بترجّع الحروف لبايتاتها الأصلية وتفكّها UTF-8 من جديد.
 */

/** بايتات 0x80–0x9F كما يفسرها Windows-1252 */
export const CP1252 = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85],
  [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a],
  [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92],
  [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c],
  [0x017e, 0x9e], [0x0178, 0x9f],
]);

export function isMojibakeChar(ch) {
  const c = ch.codePointAt(0);
  return (c >= 0x80 && c <= 0xbf) || (c >= 0xc2 && c <= 0xf4) || CP1252.has(c);
}

function isLeadByte(ch) {
  const c = ch.codePointAt(0);
  return c >= 0xc2 && c <= 0xf4;
}

/** يحاول إصلاح مقطع مشوّه واحد (سلسلة متصلة من حروف mojibake) */
export function repairRun(run) {
  if (![...run].some(isLeadByte)) return null;
  const bytes = [];
  for (const ch of run) {
    const c = ch.codePointAt(0);
    if (c < 0x100) bytes.push(c);
    else if (CP1252.has(c)) bytes.push(CP1252.get(c));
    else return null;
  }
  try {
    const out = Buffer.from(bytes).toString('utf8');
    if (!out || out === run) return null;
    if (out.includes('\uFFFD') || [...out].some(isMojibakeChar)) return null;
    return out;
  } catch {
    return null;
  }
}

/** يصلّح كل مقاطع التلف داخل نص واحد — بيرجّع { text, changed } */
export function repairText(input) {
  const line = String(input ?? '');
  let out = '';
  let i = 0;
  let changed = false;
  while (i < line.length) {
    if (isMojibakeChar(line[i])) {
      let j = i;
      while (j < line.length && isMojibakeChar(line[j])) j += 1;
      const run = line.slice(i, j);
      const fixed = run.length >= 2 ? repairRun(run) : null;
      if (fixed) {
        out += fixed;
        changed = true;
      } else {
        out += run;
      }
      i = j;
    } else {
      out += line[i];
      i += 1;
    }
  }
  return { text: out, changed };
}

/** نمط يدل على وجود تلف: حرف lead byte متبوع بحرف في نطاق الامتداد */
export const MOJIBAKE_PATTERN =
  /[\u00c2-\u00f4][\u0080-\u00bf\u2018-\u201d\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2020-\u2026\u2030\u2039\u203a\u20ac\u2122]/;
