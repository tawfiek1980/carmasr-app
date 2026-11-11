#!/usr/bin/env node
/**
 * فحص تابات لوحة التحكم: كل تاب معرّف في القائمة لازم يكون له `case` في دالة رسم المحتوى.
 *
 * السبب: في كوميت قديم اتشال تاب من الـ switch بالغلط، فبقيت 3 تابات
 * (sendad / savedtitles / merchants) بتظهر في الشريط الجانبي لكن محتواها فاضي.
 */
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve(process.cwd(), 'src/pages/admin/AdminDashboard.tsx');

if (!fs.existsSync(FILE)) {
  console.error(`❌ مش لاقي الملف: ${FILE}`);
  process.exit(1);
}

const src = fs.readFileSync(FILE, 'utf8');

// 1) معرفات التابات من القائمة: { id:'dashboard', label:'...' }
const listed = [...src.matchAll(/\{\s*id:\s*'([a-z0-9-]+)'\s*,\s*label:/g)].map((m) => m[1]);

// 2) معرفات الـ union type: type Tab = 'a'|'b'|...
const unionMatch = src.match(/type\s+Tab\s*=\s*([^;]+);/);
const union = unionMatch ? [...unionMatch[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]) : [];

// 3) الحالات الموجودة في الـ switch
const cases = new Set([...src.matchAll(/case\s+'([a-z0-9-]+)'\s*:/g)].map((m) => m[1]));

const allTabs = [...new Set([...listed, ...union])];
const missing = allTabs.filter((id) => !cases.has(id));
const extraCases = [...cases].filter((id) => !allTabs.includes(id));

console.log(`التابات: ${allTabs.length} | الحالات (case): ${cases.size}`);

if (missing.length) {
  console.error('\n❌ تابات في القائمة بدون `case` (هتظهر فاضية):');
  for (const id of missing) console.error(`   - ${id}`);
  process.exit(1);
}

if (extraCases.length) {
  console.log(`\nℹ️ حالات مش مربوطة بتاب في القائمة: ${extraCases.join(', ')}`);
}

console.log('✅ كل تاب له حالة رسم — مفيش تاب فاضي.');
