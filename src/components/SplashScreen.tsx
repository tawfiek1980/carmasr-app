import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ORANGE = '#FF8C2F';
const DURATION = 3000;

interface SplashScreenProps {
  onFinish?: () => void;
}

// العربية cutout بخلفية شفافة (1920×1280)
const TRUCK_SRC = '/tareeq-truck.png';

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onFinish?.();
    }, DURATION);
    return () => clearTimeout(t);
  }, [onFinish]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: '#000000' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          exit={{ opacity: 0, transition: { duration: 0.4, delay: 0.15 } }}
          role="status"
          aria-label="جاري تحميل كار مصر"
        >
          {/* ── اللوجو في النص: يكبر سنة ونبضة نور لما العربية توصل ── */}
          <motion.div
            className="absolute flex flex-col items-center"
            style={{ top: '19%' }}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1, 1.05, 1] }}
            transition={{ duration: 1.5, times: [0, 0.42, 0.62, 1], delay: 1.75, ease: 'easeInOut' }}
          >
            <motion.span
              className="text-4xl sm:text-5xl font-black leading-none tracking-[0.12em] text-white"
              initial={{ textShadow: '0 0 0 rgba(255,140,47,0)' }}
              animate={{ textShadow: ['0 0 0 rgba(255,140,47,0)', '0 0 26px rgba(255,140,47,0.95)', '0 0 12px rgba(255,140,47,0.45)'] }}
              transition={{ duration: 1.5, times: [0, 0.35, 1], delay: 1.75, ease: 'easeOut' }}
            >
              CarMasr
            </motion.span>
            <motion.span
              className="mt-1.5 text-2xl sm:text-3xl font-black leading-none tracking-tight"
              style={{ color: ORANGE }}
              initial={{ opacity: 0.55 }}
              animate={{ opacity: [0.55, 1, 0.8] }}
              transition={{ duration: 1.5, delay: 1.75 }}
            >
              كار مصر
            </motion.span>
            <motion.span
              className="mt-3 text-[13px] sm:text-sm font-semibold leading-none text-white/70"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.85, ease: 'easeOut' }}
            >
              سوق السيارات في مصر
            </motion.span>
          </motion.div>

          {/* نبضة نور عند وصول العربية */}
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              top: '22%',
              width: 360,
              height: 360,
              marginLeft: -180,
              marginTop: -60,
              background: 'radial-gradient(circle, rgba(255,140,47,0.5) 0%, rgba(255,140,47,0) 68%)',
            }}
            initial={{ opacity: 0, scale: 0.55 }}
            animate={{ opacity: [0, 0.95, 0], scale: [0.55, 1.15] }}
            transition={{ duration: 1.4, delay: 1.78, ease: 'easeOut' }}
          />

          {/* ── خط الطريق المتقطع الأبيض: يترسم من الشمال لليمين لوحده ── */}
          <div className="absolute left-0 right-0" style={{ top: '62%' }}>
            <svg viewBox="0 0 1000 24" preserveAspectRatio="none" className="w-full h-6">
              <motion.line
                x1="0"
                y1="12"
                x2="1000"
                y2="12"
                stroke="#FFFFFF"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="30 22"
                initial={{ strokeDashoffset: 1000 }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 1.6, delay: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
              />
            </svg>
          </div>

          {/* ── العربية (رسم برتقالي #FF8C2F بنسبة 1694×897): تدخل من برة الشاشة شمال وتسوق على الخط ── */}
          <motion.img
            src={TRUCK_SRC}
            alt="CarMasr"
            className="absolute object-contain"
            style={{ bottom: '39.5%', width: 'min(54vw, 360px)' }}
            initial={{ x: '-118vw', opacity: 0 }}
            animate={{ x: '0vw', opacity: 1 }}
            transition={{ duration: 1.7, delay: 0.45, ease: [0.32, 0.72, 0.35, 1] }}
          />
          {/* ظل خفيف تحت العجلات يثبّت العربية على الخط */}
          <motion.div
            className="absolute rounded-[50%]"
            style={{
              bottom: '38.6%',
              width: 'min(46vw, 300px)',
              height: 6,
              background: 'radial-gradient(ellipse at center, rgba(255,140,47,0.28) 0%, rgba(255,140,47,0) 72%)',
            }}
            initial={{ opacity: 0, scaleX: 0.6 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.6, delay: 1.75 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}