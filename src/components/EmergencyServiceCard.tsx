import { createElement } from 'react';
import { Phone, Clock, MessageCircle } from 'lucide-react';
import { getIcon } from '../lib/dynamicIcons';
import type { EmergencyService } from '../types';
import { getPhoneLink, getWhatsAppLink } from '../lib/utils';

interface EmergencyServiceCardProps {
  service: EmergencyService;
}

export default function EmergencyServiceCard({ service }: EmergencyServiceCardProps) {

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-border hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
          {createElement(getIcon(service.icon), { className: "w-6 h-6 text-red-500" })}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-text text-base">{service.name}</h3>
          <p className="text-xs text-text-light mt-0.5 line-clamp-2">{service.description}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 text-xs text-text-light mb-3">
        <Clock className="w-3.5 h-3.5 text-orange" />
        <span>وقت الوصول المتوقع: {service.responseTime}</span>
      </div>
      
      <div className="flex gap-2">
        <a
          href={getPhoneLink(service.phone)}
          className="flex-1 flex items-center justify-center gap-1.5 bg-navy hover:bg-navy-light text-white text-sm font-bold py-2.5 rounded-xl transition-colors btn-press"
        >
          <Phone className="w-4 h-4" />
          <span>اتصل الآن</span>
        </a>
        <a
          href={getWhatsAppLink(service.phone, `السلام عليكم، أحتاج خدمة ${service.name} عبر تطبيق كار مصر`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-11 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors btn-press"
        >
          <MessageCircle className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
