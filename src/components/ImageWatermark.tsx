import { Phone } from 'lucide-react';

interface Props {
  phone?: string | null;
}

export default function ImageWatermark({ phone }: Props) {
  const clean = (phone || '').replace(/[^\d+]/g, '');
  return (
    <>
      <div className="absolute top-0 right-0 left-0 h-7 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-[5] flex items-start justify-end px-2 pt-1">
        <span className="text-[10px] font-bold text-white/95 leading-none drop-shadow">كار مصر CarMasr</span>
      </div>
      <div className="absolute bottom-0 right-0 left-0 h-9 bg-gradient-to-t from-black/65 to-transparent pointer-events-none z-[5] flex items-end justify-start pb-2 pl-2">
        <span className="flex items-center gap-1 bg-orange text-white text-[11px] font-extrabold px-2.5 py-1 rounded-lg leading-none shadow" dir="ltr">
          <Phone className="w-3 h-3" />
          {clean || 'كار مصر CarMasr'}
        </span>
      </div>
    </>
  );
}