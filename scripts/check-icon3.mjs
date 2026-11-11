import sharp from 'sharp';

const raw = await sharp('public/app-icon-512.png').removeAlpha().raw().toBuffer();
const W = 512;

// خريطة ألوان متكررة على كامل الصورة (عينة كل 4 بكسل)
const colorCount = new Map();
let nonWhite = 0;
for (let y = 0; y < W; y += 2) {
  for (let x = 0; x < W; x += 2) {
    const i = (y * W + x) * 3;
    const [r, g, b] = [raw[i], raw[i + 1], raw[i + 2]];
    if (r > 235 && g > 235 && b > 235) continue;
    nonWhite++;
    const key = r + ',' + g + ',' + b;
    colorCount.set(key, (colorCount.get(key) || 0) + 1);
  }
}
console.log('non-white sampled pixels:', nonWhite);
const sorted = [...colorCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log('top non-white colors (count: rgb):');
for (const [k, c] of sorted) console.log('  ' + c + ': ' + k);

// ما هو أغمق لون موجود؟
let darkest = [255, 255, 255];
for (const [k] of sorted) {
  const [r, g, b] = k.split(',').map(Number);
  if (r + g + b < darkest[0] + darkest[1] + darkest[2]) darkest = [r, g, b];
}
console.log('darkest non-white color:', darkest.join(','));

// ASCII لوسط الصورة فقط (منطقة الرسم): 32x24 عبر المنطقة x=128..384, y=96..384
const X0 = 128, Y0 = 96, CW = 256, CH = 288;
console.log('\ncenter ASCII (32x18):  .=white  .=light  #=dark  *=mid');
for (let y = 0; y < 18; y++) {
  let row = '';
  for (let x = 0; x < 32; x++) {
    const px = Math.floor(X0 + (x + 0.5) * CW / 32);
    const py = Math.floor(Y0 + (y + 0.5) * CH / 18);
    const i = (py * W + px) * 3;
    const [r, g, b] = [raw[i], raw[i + 1], raw[i + 2]];
    const lum = (r + g + b) / 3;
    if (lum > 240) row += '.';
    else if (lum > 200) row += 'o';
    else if (lum > 140) row += '*';
    else row += '#';
  }
  console.log('  ' + row);
}
