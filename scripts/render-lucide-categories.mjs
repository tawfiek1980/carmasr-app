import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Package, Briefcase, Wrench, Cog, Landmark } from 'lucide-react';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'category-icons');

const COLOR = '#2F2F2F';

const icons = {
  'load-category': Package,
  'job-category': Briefcase,
  'workshop-category': Wrench,
  'spareparts-category': Cog,
  'finance-category': Landmark,
};

for (const [name, Icon] of Object.entries(icons)) {
  const svg = renderToStaticMarkup(
    React.createElement(Icon, { size: 480, strokeWidth: 1.5, color: COLOR })
  );
  const outer = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${svg}</svg>`;
  const out = path.join(outDir, `${name}.png`);
  await sharp(Buffer.from(outer)).resize(512, 512).png().toFile(out);
  console.log('wrote', out);
}
console.log('done');