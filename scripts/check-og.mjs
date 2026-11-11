import sharp from 'sharp';

const r = await sharp('public/og-download.png').resize(12, 6).removeAlpha().raw().toBuffer();
console.log('og-download.png 12x6 grid (R,G,B):');
for (let y = 0; y < 6; y++) {
  const row = [];
  for (let x = 0; x < 12; x++) {
    const i = (y * 12 + x) * 3;
    row.push(r[i] === 1 && r[i + 1] === 135 && r[i + 2] === 95 ? 'G' : r[i] > 200 ? '.' : '#');
  }
  console.log('  ' + row.join(''));
}
// G = أخضر الخلفية، . = أبيض/فاتح، # = داكن
