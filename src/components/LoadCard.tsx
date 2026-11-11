import { MapPin, ArrowLeftRight, Package, Weight, Calendar, MessageCircle, RotateCcw, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Load } from '../types';
import { getWhatsAppLink, formatDateDMY, displayPrice, listingWhatsApp } from "../lib/utils";
import { trackEvent } from '../lib/analytics';
import ProtectedPhoneButton from './ProtectedPhoneButton';

interface LoadCardProps {
  load: Load;
}

export default function LoadCard({ load }: LoadCardProps) {
  const navigate = useNavigate();
  // رقم الواتساب بتاع صاحب الحمولة
  const waPhone = listingWhatsApp({
    whatsappPhone: load.whatsappPhone,
    contactPhone: load.contactPhone,
    userPhone: load.userPhone,
  });

  const openDetail = () => navigate(`/load/${load.id}`);

  return (
    <div
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetail();
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={`تفاصيل حمولة من ${load.origin} إلى ${load.destination}`}
      className="bg-white rounded-2xl p-4 shadow-sm border border-border hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-3">
        {String(load.id).startsWith('sample-') && (
          <span className="bg-gray-700/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            تجريبي (عرض)
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-bold text-navy">
          <MapPin className="w-4 h-4 text-orange" />
          <span>{load.origin}{load.returnOrigin ? ` (حالي: ${load.returnOrigin})` : ''}</span>
        </div>
        <ArrowLeftRight className="w-4 h-4 text-text-light" />
        <div className="flex items-center gap-2 text-sm font-bold text-navy">
          <span>{load.destination}{load.returnDestination ? ` (رجعة: ${load.returnDestination})` : ''}</span>
          <MapPin className="w-4 h-4 text-orange" />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-bg rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 text-text-light text-xs mb-1">
            <Package className="w-3.5 h-3.5" />
            <span>نوع الحمول</span>
          </div>
          <p className="font-bold text-sm text-text">{load.cargoType}</p>
        </div>
        <div className="bg-bg rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 text-text-light text-xs mb-1">
            <Weight className="w-3.5 h-3.5" />
            <span>الوزن</span>
          </div>
          <p className="font-bold text-sm text-text">{load.weight}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {load.loadType === 'period' && (
          <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
            <Clock className="w-3 h-3" /> تعاقد {load.periodDays ? `${load.periodDays} يوم` : ''}
          </span>
        )}
        {load.isReturnLoad && (
          <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
            <RotateCcw className="w-3 h-3" /> رجعة
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-text-light text-xs">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDateDMY(load.date)}</span>
        </div>
        <p className="text-xl font-extrabold text-orange">{displayPrice(load.price, load.priceType)}</p>
      </div>
      
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <span className="text-xs text-text-light line-clamp-1 max-w-[50%]">{load.userName}</span>
        <ProtectedPhoneButton phone={waPhone}>
          <a
            href={getWhatsAppLink(waPhone, `السلام عليكم، أهتم بحمولة من ${load.origin} إلى ${load.destination}`)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              trackEvent('load_contact', { load_id: load.id });
            }}
            className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors btn-press"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>تواصل</span>
          </a>
        </ProtectedPhoneButton>
      </div>
    </div>
  );
}
