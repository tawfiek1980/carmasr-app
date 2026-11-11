#!/usr/bin/env node
/**
 * فحص تلف الترميز (mojibake) في ملفات المشروع.
 *
 * سبب المشكلة: قراءة ملف UTF-8 بترميز Windows-1252/Latin-1 ثم إعادة كتابته،
 * فالنص العربي بيتحول لحروف لاتينية مشوّهة. السكربت بيكشف النمط ده ويمنع رجوعه.
 *
 * الاستخدام:
 *   node scripts/check-mojibake.mjs        (يفشل لو فيه تلف)
 *   node scripts/check-mojibake.mjs --fix  (يصلّح تلقائيًا)
 */
import fs from 'node:fs';
import path from 'node:path';
import { repairText, MOJIBAKE_PATTERN } from './lib/mojibake.mjs';

const ROOT = path.resolve(process.cwd());
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.vercel', 'android', 'ios',
  'functions', 'coverage', '.expo', 'videos', 'scripts/mockup',
]);
const EXTS = ['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx', '.json', '.html', '.md', '.txt', '.css'];

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const rel = path.relative(ROOT, path.join(dir, entry.name)).split(path.sep).join('/');
      if (!SKIP_DIRS.has(entry.name) && !SKIP_DIRS.has(rel)) walk(path.join(dir, entry.name), out);
    } else if (EXTS.includes(path.extname(entry.name).toLowerCase())) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const fix = process.argv.includes('--fix');
const problems = [];
let fixedFiles = 0;
let fixedLines = 0;

for (const file of walk(ROOT, [])) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const bad = [];
  let touched = false;
  const next = lines.map((ln, idx) => {
    if (!MOJIBAKE_PATTERN.test(ln)) return ln;
    bad.push({ n: idx + 1, text: ln.trim().slice(0, 120) });
    if (!fix) return ln;
    const r = repairText(ln);
    if (r.changed && !MOJIBAKE_PATTERN.test(r.text) && !r.text.includes('\uFFFD')) {
      touched = true;
      return r.text;
    }
    return ln;
  });

  if (!bad.length) continue;

  if (fix && touched) {
    fs.writeFileSync(file, next.join(eol), 'utf8');
    fixedFiles += 1;
    fixedLines += bad.length;
    console.log(`✅ تم إصلاح ${bad.length} سطر: ${path.relative(ROOT, file)}`);
  } else {
    problems.push({ file, lines: bad.map((b) => `${b.n}: ${b.text}`) });
  }
}

if (fix && fixedFiles) console.log(`\nتم إصلاح ${fixedLines} سطر في ${fixedFiles} ملف.`);

if (problems.length) {
  console.error('\n❌ وجدت تلف ترميز (mojibake):\n');
  for (const p of problems) {
    console.error(`  ${path.relative(ROOT, p.file)}`);
    for (const l of p.lines.slice(0, 8)) console.error(`    ${l}`);
    if (p.lines.length > 8) console.error(`    ... و${p.lines.length - 8} سطر آخر`);
  }
  console.error('\nشغّل: node scripts/check-mojibake.mjs --fix');
  process.exit(1);
}

console.log('✅ لا يوجد تلف ترميز — كل النصوص سليمة.');
