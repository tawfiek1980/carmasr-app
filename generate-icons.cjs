const sharp = require('sharp');
const path = require('path');

const src = path.join(__dirname, 'public', 'tareeq-logo.png');
const resDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');

const sizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function generateIcons() {
  for (const [folder, size] of Object.entries(sizes)) {
    const dir = path.join(resDir, folder);

    await sharp(src)
      .resize(size, size, { fit: 'contain', background: '#0D1B2A' })
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));
    console.log(folder + ': ic_launcher.png');

    const roundBuffer = await sharp(src)
      .resize(size, size, { fit: 'contain', background: '#0D1B2A' })
      .png()
      .toBuffer();

    const half = Math.round(size / 2);
    const maskSvg = Buffer.from(
      '<svg width="' + size + '" height="' + size + '"><circle cx="' + half + '" cy="' + half + '" r="' + half + '" fill="black"/></svg>'
    );
    const maskBuf = await sharp(maskSvg).png().toBuffer();
    await sharp(roundBuffer)
      .composite([{ input: maskBuf, blend: 'dest-in' }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));
    console.log(folder + ': ic_launcher_round.png');

    const padding = Math.round(size * 0.25);
    await sharp(src)
      .resize(size, size, { fit: 'contain' })
      .extend({
        top: padding, bottom: padding, left: padding, right: padding,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));
    console.log(folder + ': ic_launcher_foreground.png');
  }
  console.log('All icons generated!');
}

generateIcons().catch(e => console.error(e));
