import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'category-icons');

const C = [47, 47, 47]; // نفس تون الجرار تقريباً

const main = `rgb(${C[0]},${C[1]},${C[2]})`;
const shade = (a) => `rgba(${C[0]},${C[1]},${C[2]},${a})`; // ظلال زجاج/تفاصيل زي الجرار

function svg(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${inner}
</svg>`;
}

// "الرسمة الغامقة الواحدة على شفاف" — نفس لغة أيكونة الجرار
const icons = {
  'load-category': `
  <rect x="88" y="174" width="240" height="138" rx="14" fill="${main}"/>
  <rect x="152" y="176" width="14" height="134" rx="7" fill="${shade(0.38)}"/>
  <rect x="224" y="176" width="14" height="134" rx="7" fill="${shade(0.38)}"/>
  <rect x="340" y="208" width="76" height="96" rx="14" fill="${main}"/>
  <rect x="356" y="222" width="44" height="36" rx="9" fill="${shade(0.35)}"/>
  <rect x="88" y="314" width="328" height="16" rx="8" fill="${main}"/>
  <circle cx="172" cy="350" r="36" fill="${main}"/>
  <circle cx="172" cy="350" r="15" fill="${shade(0.4)}"/>
  <circle cx="376" cy="350" r="36" fill="${main}"/>
  <circle cx="376" cy="350" r="15" fill="${shade(0.4)}"/>`,
  'job-category': `
  <path d="M214 206 v-20 a42 42 0 0 1 84 0 v20" stroke="${main}" stroke-width="26" fill="none" stroke-linecap="round"/>
  <rect x="116" y="198" width="280" height="162" rx="24" fill="${main}"/>
  <rect x="234" y="198" width="44" height="162" fill="${shade(0.35)}"/>
  <rect x="242" y="250" width="28" height="30" rx="7" fill="${shade(0.5)}"/>`,
  'workshop-category': `
  <line x1="322" y1="120" x2="178" y2="296" stroke="${main}" stroke-width="42" stroke-linecap="round"/>
  <circle cx="356" cy="90" r="58" fill="${main}"/>
  <circle cx="356" cy="90" r="30" fill="${shade(0.35)}"/>
  <circle cx="152" cy="318" r="52" fill="${main}"/>
  <circle cx="152" cy="318" r="26" fill="${shade(0.35)}"/>`,
  'spareparts-category': `
  ${[0, 45, 90, 135, 180, 225, 270, 315]
    .map((a) => `<rect x="231" y="36" width="50" height="112" fill="${main}" transform="rotate(${a} 256 256)"/>`)
    .join('\n  ')}
  <circle cx="256" cy="256" r="150" fill="${main}"/>
  <circle cx="256" cy="256" r="64" fill="${shade(0.35)}"/>
  <circle cx="256" cy="256" r="30" fill="${main}"/>`,
  'finance-category': `
  <polygon points="126,246 256,118 386,246 386,262 126,262" fill="${main}"/>
  <rect x="142" y="258" width="228" height="76" rx="10" fill="${main}"/>
  <rect x="162" y="268" width="30" height="60" rx="5" fill="${shade(0.35)}"/>
  <rect x="320" y="268" width="30" height="60" rx="5" fill="${shade(0.35)}"/>
  <rect x="238" y="286" width="36" height="48" rx="6" fill="${shade(0.35)}"/>
  <rect x="114" y="336" width="284" height="28" rx="9" fill="${main}"/>`,
};

for (const [name, shapes] of Object.entries(icons)) {
  const out = path.join(outDir, `${name}.png`);
  await sharp(Buffer.from(svg(shapes))).resize(512, 512).png().toFile(out);
  console.log('wrote', out);
}
console.log('done');