import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { buildSatoriImage } from '../api/og-image.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const svg = await buildSatoriImage({
  title: 'أكبر سوق إلكتروني للنقل الثقيل في مصر',
  subtitle: 'شاحنات · معدات ثقيلة · حمولات · وظائف · تمويل · طوارئ',
  brand: 'كار مصر CarMasr',
  type: 'ad',
});

const png = await sharp(Buffer.from(svg)).resize(1200, 630).png().toBuffer();
const outPng = path.join(root, 'public', 'og-image.png');
writeFileSync(outPng, png);
console.log('Generated', outPng, png.length, 'bytes');
