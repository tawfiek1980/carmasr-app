import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';

const svg = readFileSync('public/favicon.svg');
const outputs = {
  'public/favicon-512.png': 512,
  'public/favicon-32.png': 32,
  'public/app-icon-512.png': 512,
  'public/store-assets/icon-512x512.png': 512,
};
for (const [file, size] of Object.entries(outputs)) {
  const png = await sharp(svg).resize(size, size).png().toBuffer();
  writeFileSync(file, png);
  console.log('created', file, png.length);
}
