import sharp from 'sharp';
import { writeFileSync, readdirSync, existsSync } from 'fs';

const res = 'android/app/src/main/res';
const NAVY = '#0D1B2A';
const ORANGE = '#F4700A';

const fgSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g transform="translate(50 50) scale(0.64) translate(-50 -50)">
    <rect x="22" y="28" width="56" height="18" rx="9" fill="#ffffff"/>
    <rect x="41" y="46" width="18" height="42" rx="9" fill="${ORANGE}"/>
  </g>
</svg>`);

const legacySvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="${NAVY}"/>
  <rect x="22" y="28" width="56" height="18" rx="9" fill="#ffffff"/>
  <rect x="41" y="46" width="18" height="42" rx="9" fill="${ORANGE}"/>
</svg>`);

function taaMark(scale) {
  return `<g transform="translate(50 50) scale(${scale}) translate(-50 -50)">
    <rect x="22" y="28" width="56" height="18" rx="9" fill="#ffffff"/>
    <rect x="41" y="46" width="18" height="42" rx="9" fill="${ORANGE}"/>
  </g>`;
}

const fgSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
const iconSizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

for (const [dpi, size] of Object.entries(fgSizes)) {
  const png = await sharp(fgSvg).resize(size, size).png().toBuffer();
  writeFileSync(`${res}/mipmap-${dpi}/ic_launcher_foreground.png`, png);
  console.log('foreground', dpi, size);
}
for (const [dpi, size] of Object.entries(iconSizes)) {
  const png = await sharp(legacySvg).resize(size, size).png().toBuffer();
  writeFileSync(`${res}/mipmap-${dpi}/ic_launcher.png`, png);
  writeFileSync(`${res}/mipmap-${dpi}/ic_launcher_round.png`, png);
  console.log('launcher', dpi, size);
}

const baseSplash = `${res}/drawable/splash.png`;
const meta = await sharp(baseSplash).metadata();
console.log('splash size', meta.width, 'x', meta.height);

for (const dir of readdirSync(res).filter((d) => d.startsWith('drawable'))) {
  const f = `${res}/${dir}/splash.png`;
  if (!existsSync(f)) continue;
  const m = await sharp(f).metadata();
  const mark = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.width} ${m.height}">
    <rect width="${m.width}" height="${m.height}" fill="${NAVY}"/>
    ${taaMark(0.55)}
  </svg>`);
  const png = await sharp(mark).resize(m.width, m.height).png().toBuffer();
  writeFileSync(f, png);
  console.log('splash', dir, m.width, 'x', m.height);
}
