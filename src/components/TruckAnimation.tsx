import { useId } from 'react';
import { motion } from 'framer-motion';

interface TruckAnimationProps {
  variant?: 'drive' | 'sleep';
  tone?: 'onDark' | 'onLight';
  className?: string;
  loop?: boolean;
}

type Palette = (typeof PALETTE)[keyof typeof PALETTE];

const PALETTE = {
  onDark: {
    body: '#FFFFFF',
    bodyShade: '#C4D2E0',
    bodyTop: '#E8EEF5',
    frame: '#7E8FA3',
    glass: '#14304C',
    glassTop: '#1E4269',
    eye: '#EAF2FA',
    tire: '#0A121D',
    rim: '#26384F',
    road: 'rgba(255,255,255,0.22)',
    shadow: '#050B14',
  },
  onLight: {
    body: '#16283C',
    bodyShade: '#0B1724',
    bodyTop: '#22394F',
    frame: '#0A1420',
    glass: '#A9C1D8',
    glassTop: '#C8DAEB',
    eye: '#0B1724',
    tire: '#141D28',
    rim: '#33455C',
    road: '#D5DBE3',
    shadow: '#101828',
  },
} as const;

const ORANGE = '#F4700A';
const GROUND = 122; // محور العجلة
const ROAD_Y = GROUND + 21; // 143 = نقطة التلامس مع الأرض بالظبط
const WHEELS = [112, 158, 298];

function Wheel({ cx, p, spin, loop }: { cx: number; p: Palette; spin: boolean; loop: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={GROUND} r="21" fill={p.tire} />
      <circle cx={cx} cy={GROUND} r="21" fill="none" stroke={p.rim} strokeWidth="1.5" opacity="0.45" />
      <circle cx={cx} cy={GROUND} r="12" fill={p.rim} />
      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        animate={spin ? { rotate: 360 } : { rotate: 0 }}
        transition={spin ? { duration: 0.85, repeat: loop ? Infinity : 6, ease: 'linear' } : { duration: 0 }}
      >
        {[0, 60, 120, 180, 240, 300].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <line
              key={angle}
              x1={cx + Math.cos(rad) * 5}
              y1={GROUND + Math.sin(rad) * 5}
              x2={cx + Math.cos(rad) * 10.5}
              y2={GROUND + Math.sin(rad) * 10.5}
              stroke={p.tire}
              strokeWidth="2.4"
              strokeLinecap="round"
              opacity="0.7"
            />
          );
        })}
      </motion.g>
      <circle cx={cx} cy={GROUND} r="4" fill={ORANGE} />
    </g>
  );
}

export default function TruckAnimation({
  variant = 'drive',
  tone = 'onDark',
  className = '',
  loop = true,
}: TruckAnimationProps) {
  const uid = useId().replace(/:/g, '');
  const p = PALETTE[tone];
  const isSleep = variant === 'sleep';

  const bodyGrad = `b-${uid}`;
  const roadGrad = `r-${uid}`;
  const shadowGrad = `s-${uid}`;
  const beamGrad = `m-${uid}`;

  return (
    <svg viewBox="0 0 400 152" className={className} fill="none" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={bodyGrad} x1="200" y1="40" x2="200" y2="118" gradientUnits="userSpaceOnUse">
          <stop stopColor={p.bodyTop} />
          <stop offset="1" stopColor={p.bodyShade} />
        </linearGradient>
        <linearGradient id={roadGrad} x1="0" y1="0" x2="400" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor={p.road} stopOpacity="0" />
          <stop offset="0.15" stopColor={p.road} />
          <stop offset="0.85" stopColor={p.road} />
          <stop offset="1" stopColor={p.road} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={shadowGrad} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={p.shadow} stopOpacity="0.5" />
          <stop offset="0.7" stopColor={p.shadow} stopOpacity="0.22" />
          <stop offset="1" stopColor={p.shadow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={beamGrad} x1="350" y1="0" x2="398" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE0A8" stopOpacity="0.4" />
          <stop offset="1" stopColor="#FFE0A8" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* خطوط السرعة خلف الشاحنة */}
      {!isSleep && (
        <motion.g initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.5 }}>
          {[74, 88, 100].map((y, i) => (
            <motion.path
              key={y}
              d={`M${6 - i * 3} ${y} H${46 - i * 8}`}
              stroke={p.body}
              strokeWidth={3 - i * 0.6}
              strokeLinecap="round"
              opacity={0.3 - i * 0.08}
              animate={loop ? { x: [0, 10, 0] } : {}}
              transition={{ duration: 1.1, repeat: loop ? Infinity : 0, ease: 'easeInOut', delay: i * 0.12 }}
            />
          ))}
        </motion.g>
      )}

      {/* الطريق — على نقطة تلامس الإطارات بالظبط */}
      <motion.path
        d={`M4 ${ROAD_Y} H396`}
        stroke={`url(#${roadGrad})`}
        strokeWidth="4"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeInOut' }}
      />
      <motion.path
        d={`M4 ${ROAD_Y} H396`}
        stroke={ORANGE}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="26 22"
        initial={{ opacity: 0 }}
        animate={{ opacity: isSleep ? 0.5 : 0.85 }}
        transition={{ duration: 0.4, delay: 1 }}
      />

      <motion.g
        initial={{ x: -80, opacity: 0 }}
        animate={{ x: 0, opacity: 1, y: isSleep ? [0, -1.5, 0] : 0 }}
        transition={{
          x: { duration: 1.3, delay: 0.3, ease: [0.22, 0.61, 0.36, 1] },
          opacity: { duration: 0.4, delay: 0.3 },
          y: { duration: 3.2, repeat: loop ? Infinity : 0, ease: 'easeInOut' },
        }}
      >
        {/* ظل ناعم تحت الشاحنة */}
        <ellipse cx="200" cy={ROAD_Y - 1} rx="152" ry="7" fill={`url(#${shadowGrad})`} />

        {/* شريط الهيكل — يربط الشراح بالكابينة ويفصلهم بخط واضح */}
        <rect x="56" y="109" width="292" height="9" rx="4.5" fill={p.frame} />

        {/* سقف الشراح */}
        <rect x="52" y="40" width="192" height="17" rx="8.5" fill={p.bodyTop} />

        {/* جسم الشراح */}
        <rect x="52" y="48" width="192" height="70" rx="9" fill={`url(#${bodyGrad})`} />
        <rect x="52" y="102" width="192" height="16" rx="8" fill={p.shadow} opacity="0.22" />
        {[118, 182].map((x) => (
          <path key={x} d={`M${x} 56 v46`} stroke={p.shadow} strokeWidth="1.5" opacity="0.22" />
        ))}
        <rect x="52" y="90" width="192" height="9" fill={ORANGE} />
        <path d="M70 66 l9 -6 v12 z" fill={ORANGE} opacity="0.95" />
        <path d="M80 60 h34" stroke={p.body} strokeWidth="3" strokeLinecap="round" opacity="0.5" />

        {/* كوولنر ووقود بين المحورين الخلفيين */}
        <rect x="136" y="98" width="22" height="14" rx="4" fill={p.frame} />

        {/* الكابينة */}
        <path d="M252 118 V70 q0-13 13-15 l28-5 q14-2 20 10 l22 30 q11 13 11 28 z" fill={`url(#${bodyGrad})`} />
        {/* الزجاج — لون صلب مش gradient عشان يفضل مضمون في كل المتصفحات */}
        <path d="M264 60 h22 q7 0 10 6 l14 22 h-46 z" fill={p.glass} />
        <path d="M264 60 h22 q7 0 10 6 l2 3 h-34 z" fill={p.glassTop} />
        <path d="M270 64 l10 22" stroke={p.body} strokeWidth="2" opacity="0.25" strokeLinecap="round" />
        {/* خط الباب + المقبض */}
        <path d="M256 94 h56" stroke={p.shadow} strokeWidth="1.5" opacity="0.3" />
        <rect x="266" y="100" width="13" height="3.5" rx="1.75" fill={p.shadow} opacity="0.5" />
        {/* المراية */}
        <path d="M336 72 l8 -7" stroke={p.body} strokeWidth="3" strokeLinecap="round" />
        <rect x="340" y="56" width="9" height="14" rx="3" fill={p.bodyShade} />
        {/* الشبك */}
        <rect x="336" y="86" width="12" height="18" rx="4" fill={p.shadow} opacity="0.5" />
        {/* الصادم */}
        <rect x="332" y="112" width="18" height="8" rx="4" fill={p.bodyShade} />
        {/* المصباح الأمامي + توهج */}
        <motion.rect
          x="334"
          y="102"
          width="12"
          height="9"
          rx="3"
          fill="#FFE0A8"
          animate={isSleep ? { opacity: 0.2 } : { opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.8, repeat: loop ? Infinity : 3, ease: 'easeInOut' }}
        />
        {!isSleep && (
          <>
            <path d="M350 106 L398 92 L398 122 Z" fill={`url(#${beamGrad})`} />
            <motion.circle
              cx="340"
              cy="106"
              r="16"
              fill="#FFE0A8"
              animate={{ opacity: [0.18, 0.05, 0.18] }}
              transition={{ duration: 1.8, repeat: loop ? Infinity : 3, ease: 'easeInOut' }}
            />
          </>
        )}

        {/* أقواس العجلات */}
        {WHEELS.map((cx) => (
          <path
            key={`arch-${cx}`}
            d={`M${cx - 26} ${GROUND} a26 26 0 0 1 52 0`}
            fill="none"
            stroke={p.frame}
            strokeWidth="5"
            strokeLinecap="round"
          />
        ))}

        {WHEELS.map((cx) => (
          <Wheel key={cx} cx={cx} p={p} spin={!isSleep} loop={loop} />
        ))}

        {/* عينان مغمضتان — لون متباين مع الزجاج */}
        {isSleep && (
          <g stroke={p.eye} strokeWidth="2.6" strokeLinecap="round" fill="none">
            <path d="M271 72 q6 6 12 0" />
            <path d="M289 72 q6 6 12 0" />
            <path d="M280 82 q5 3 10 0" strokeWidth="2.2" opacity="0.75" />
          </g>
        )}

        {/* فقاعات النوم */}
        {isSleep &&
          [
            { x: 306, y: 40, size: 15, delay: 0 },
            { x: 328, y: 22, size: 11, delay: 0.45 },
            { x: 346, y: 8, size: 8, delay: 0.9 },
          ].map((z, i) => (
            <motion.text
              key={i}
              x={z.x}
              y={z.y}
              fontSize={z.size}
              fontWeight="700"
              fill={ORANGE}
              initial={{ opacity: 0, y: 6, scale: 0.7 }}
              animate={{ opacity: [0, 1, 1, 0], y: [6, 0, -10, -18], scale: [0.7, 1, 1, 0.85] }}
              transition={{ duration: 2.8, delay: z.delay, repeat: loop ? Infinity : 1, ease: 'easeOut' }}
              style={{ transformOrigin: `${z.x}px ${z.y}px` }}
            >
              z
            </motion.text>
          ))}
      </motion.g>
    </svg>
  );
}
