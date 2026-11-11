import { useEffect } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-lg sm:max-w-xl bg-surface rounded-t-3xl shadow-2xl safe-area-pb"
            initial={{ y: '100%', opacity: 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 1 }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={onDragEnd}
          >
            <div
              className="relative pt-4 pb-3 px-4 border-b border-border cursor-grab active:cursor-grabbing"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1.5 rounded-full bg-border" />
              <button
                onClick={onClose}
                aria-label="إغلاق"
                className="absolute top-3 left-3 p-1.5 rounded-lg hover:bg-bg transition-colors"
              >
                <X className="w-5 h-5 text-text-light" />
              </button>
              {title && <h3 className="text-center text-text font-extrabold text-base mt-1">{title}</h3>}
            </div>
            <div className="p-4 pb-6 max-h-[70vh] overflow-y-auto">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
