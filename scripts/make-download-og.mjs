import satori from 'satori';
import sharp from 'sharp';
import { CAIRO_B64 } from '../shared/font-cairo-b64.js';
import { readFileSync, writeFileSync } from 'fs';

const W = 1200, H = 630;
const fontData = Buffer.from(CAIRO_B64, 'base64');
const iconPng = readFileSync('public/app-icon-512.png');

const jsx = {
  type: 'div',
  props: {
    style: {
      width: W + 'px', height: H + 'px',
      background: '#ffffff',
      display: 'flex', flexDirection: 'row',
      fontFamily: 'Cairo', direction: 'rtl', overflow: 'hidden',
      alignItems: 'center',
    },
    children: [
      // الشريط الجانبي الكحلي
      { type: 'div', props: { style: { width: 26, height: '100%', background: '#1a2332' } } },

      // الأيقونة كبيرة في المنتصف
      { type: 'img', props: { src: 'data:image/png;base64,' + iconPng.toString('base64'), width: 400, height: 400, style: { marginRight: 80, boxShadow: '0 20px 50px rgba(26,35,50,0.15)', borderRadius: 60 } } },

      // النصوص بجوار الأيقونة
      {
        type: 'div',
        props: {
          style: { display: 'flex', flexDirection: 'column', gap: 18 },
          children: [
            { type: 'div', props: { style: { color: '#1a2332', fontSize: 30, fontWeight: 800, opacity: 0.65 }, children: 'تطبيق' } },
            { type: 'div', props: { style: { color: '#1a2332', fontSize: 92, fontWeight: 800, lineHeight: 1.1 }, children: 'كار مصر CarMasr' } },
            { type: 'div', props: { style: { color: '#1a2332', fontSize: 36, fontWeight: 600, opacity: 0.55 }, children: 'أول سوق إلكتروني للنقل الثقيل في مصر 🇪🇬' } },
          ],
        },
      },
    ],
  },
};

const svg = await satori(jsx, { width: W, height: H, fonts: [{ name: 'Cairo', data: fontData, weight: 800, style: 'normal' }] });
const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync('public/og-download.png', png);
console.log('og-download.png recreated:', png.length, 'bytes');
