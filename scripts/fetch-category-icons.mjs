import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'category-icons');

const COLOR = '2F2F2F';
const BASE = 'https://api.iconify.design/mdi/';

const icons = {
  'load-category': 'package-variant-closed', // حمولات
  'job-category': 'briefcase',               // وظائف
  'workshop-category': 'wrench',             // ورش وخدمات
  'spareparts-category': 'cog',              // قطع غيار
  'finance-category': 'hand-coin',           // تمويل
};

for (const [name, icon] of Object.entries(icons)) {
  const url = `${BASE}${icon}.svg?color=%23${COLOR}&height=512`;
  const svg = await (await fetch(url)).text();
  const padded = svg.replace(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/, 'viewBox="-1.8 -1.8 27.6 27.6"');
  const out = path.join(outDir, `${name}.png`);
  await sharp(Buffer.from(padded)).resize(512, 512).png().toFile(out);
  console.log('wrote', out);
}
console.log('done');