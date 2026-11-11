import sharp from 'sharp';

const meta = await sharp('public/og-download.png').metadata();
console.log('size:', meta.width + 'x' + meta.height);

const raw = await sharp('public/og-download.png').removeAlpha().raw().toBuffer();
const W = meta.width;
const getPx = (x, y) => {
  const i = (y * W + x) * 3;
  return [raw[i], raw[i + 1], raw[i + 2]];
};

const points = [
  [600, 315], [60, 60], [1140, 60], [600, 40], [600, 590], [150, 200], [1050, 200], [600, 100],
];
for (const [x, y] of points) {
  const p = getPx(x, y);
  const isGreen = p[0] === 1 && p[1] === 135 && p[2] === 95;
  console.log(`(${x},${y}): rgb(${p.join(',')}) ${isGreen ? '<- GREEN BG' : ''}`);
}

// صورة مصغرة 24x12 بالنمط
console.log('\n24x12 ASCII (G=green bg, .=white/light, #=dark/color):');
for (let y = 0; y < 12; y++) {
  let row = '';
  for (let x = 0; x < 24; x++) {
    const p = getPx(Math.floor(x * W / 24), Math.floor(y * 630 / 12));
    if (p[0] === 1 && p[1] === 135 && p[2] === 95) row += 'G';
    else if (p[0] > 200 && p[1] > 200 && p[2] > 200) row += '.';
    else row += '#';
  }
  console.log('  ' + row);
}
