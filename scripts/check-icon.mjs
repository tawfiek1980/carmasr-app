import sharp from 'sharp';

const img = sharp('public/app-icon-512.png');
const meta = await img.metadata();
console.log('=== app-icon-512.png ===');
console.log('size:', meta.width + 'x' + meta.height, '| hasAlpha:', meta.hasAlpha, '| format:', meta.format);

const r = await sharp('public/app-icon-512.png').resize(4, 4).removeAlpha().raw().toBuffer();
const px = [];
for (let y = 0; y < 4; y++) {
  const row = [];
  for (let x = 0; x < 4; x++) {
    const i = (y * 4 + x) * 3;
    row.push(r[i] + ',' + r[i + 1] + ',' + r[i + 2]);
  }
  px.push(row.join('  |  '));
}
console.log('4x4 grid (R,G,B) -> whiteish=أبيض, dark=ملوّن/لون داكن:');
px.forEach(l => console.log('  ' + l));

const alpha = await sharp('public/app-icon-512.png').resize(8, 8).ensureAlpha().raw().toBuffer();
let transparent = 0;
for (let i = 3; i < alpha.length; i += 4) if (alpha[i] < 250) transparent++;
console.log('transparent-ish pixels (of 64):', transparent);
