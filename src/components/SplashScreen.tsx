import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ORANGE = '#FF8C2F';
const DURATION = 2600;

interface SplashScreenProps {
  onFinish?: () => void;
}

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
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: 'radial-gradient(ellipse at center, #122B4F 0%, #0B1E3A 60%, #050D1A 100%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          role="status"
          aria-label="CarMasr"
        >
          {/* Glow */}
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 320, height: 320,
              background: 'radial-gradient(circle, rgba(255,140,47,0.35) 0%, rgba(255,140,47,0) 70%)',
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, 0.6], scale: [0.6, 1.1, 1] }}
            transition={{ duration: 1.6, ease: 'easeOut' }}
          />

          {/* Logo */}
          <motion.img
            src="/app-icon-512.png"
            alt="CarMasr"
            className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl shadow-2xl logo-gloss"
            initial={{ scale: 0.6, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
          />

          {/* Brand name */}
          <motion.h1
            className="mt-6 text-4xl sm:text-5xl font-black leading-none tracking-[0.12em] text-white"
            style={{ textShadow: '0 0 24px rgba(255,140,47,0.6)' }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35, ease: 'easeOut' }}
          >
            CarMasr
          </motion.h1>

          <motion.p
            className="mt-2 text-lg sm:text-xl font-bold"
            style={{ color: ORANGE }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.55 }}
          >
            كار مصر
          </motion.p>

          <motion.p
            className="mt-3 text-[13px] sm:text-sm font-semibold text-white/70"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7, ease: 'easeOut' }}
          >
            سوق السيارات الملاكي في مصر
          </motion.p>

          {/* Progress bar */}
          <motion.div
            className="absolute bottom-16 left-1/2 -translate-x-1/2 w-40 h-1 rounded-full bg-white/10 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            <motion.div
              className="h-full bg-orange rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 1.2, delay: 0.9, ease: 'easeInOut' }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
