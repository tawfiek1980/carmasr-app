import sharp from 'sharp';

const meta = await sharp('public/app-icon-512.png').metadata();
console.log('icon:', meta.width + 'x' + meta.height, '| hasAlpha:', meta.hasAlpha);

const raw = await sharp('public/app-icon-512.png').resize(16, 16).removeAlpha().raw().toBuffer();
console.log('\n16x16 icon ASCII (r>180 && g>180 && b>180 = . | r,g,b < 150 = # | else = o):');
const colors = new Map();
for (let y = 0; y < 16; y++) {
  let row = '';
  for (let x = 0; x < 16; x++) {
    const i = (y * 16 + x) * 3;
    const [r, g, b] = [raw[i], raw[i + 1], raw[i + 2]];
    const key = r + ',' + g + ',' + b;
    colors.set(key, (colors.get(key) || 0) + 1);
    if (r > 200 && g > 200 && b > 200) row += '.';
    else if (r < 160 && g < 160 && b < 160) row += '#';
    else row += 'o';
  }
  console.log('  ' + row);
}
const sorted = [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log('\nTop colors (count: rgb):');
for (const [k, c] of sorted) console.log('  ' + c + ': ' + k);
