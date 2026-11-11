import { MapPin, Briefcase, Clock, Banknote, MessageCircle } from 'lucide-react';
import type { Job } from '../types';
import { getWhatsAppLink } from '../lib/utils';
import { trackEvent } from '../lib/analytics';
import ProtectedPhoneButton from './ProtectedPhoneButton';

interface JobCardProps {
  job: Job;
}

export default function JobCard({ job }: JobCardProps) {
  const typeLabels: Record<string, string> = {
    driver: 'سائق', mechanic: 'ميكانيكي', technician: 'فني',
    logistics: 'لوجستي', warehouse: 'مستودع', sales: 'مبيعات',
    'heavy-equip': 'سيارات', electrician: 'كهربائي',
    welder: 'لحام', craftsman: 'صنايعي', tinsmith: 'سمكري',
    carpenter: 'نجار', other: 'أخرى',
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-border hover:shadow-md transition-shadow">
      {String(job.id).startsWith('sample-') && (
        <span className="inline-block bg-gray-700/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mb-2">
          تجريبي (عرض)
        </span>
      )}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-bold text-text text-base line-clamp-1">{job.title}</h3>
          <p className="text-sm text-orange font-semibold mt-0.5">{job.company}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {job.jobPostType === 'available' && (
            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-lg">متاح</span>
          )}
          {job.jobPostType === 'hire' && (
            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-lg">مطلوب</span>
          )}
          <span className="bg-orange/10 text-orange text-[10px] font-bold px-2 py-1 rounded-lg">
            {typeLabels[job.type] || job.type}
          </span>
        </div>
      </div>
      
      <p className="text-sm text-text-light line-clamp-2 mb-3">{job.description}</p>
      
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-text-light">
          <MapPin className="w-3.5 h-3.5 text-orange" />
          <span className="line-clamp-1">{job.location}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-text-light">
          <Clock className="w-3.5 h-3.5 text-orange" />
          <span>{job.experience}</span>
        </div>
        {job.salary && (
          <div className="flex items-center gap-1.5 text-xs text-text-light col-span-2">
            <Banknote className="w-3.5 h-3.5 text-orange" />
            <span className="font-semibold text-text">{job.salary}</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-xs text-text-light">
          <Briefcase className="w-3.5 h-3.5" />
          <span>تم النشر: {new Date(job.createdAt).toLocaleDateString('ar-EG')}</span>
        </div>
        <ProtectedPhoneButton phone={job.contactPhone || job.userPhone}>
          <a
            href={getWhatsAppLink(job.contactPhone || job.userPhone || '01277177710', `السلام عليكم، أهتم بوظيفة ${job.title} في ${job.company}`)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent('job_apply', { job_id: job.id, job_type: job.jobPostType })}
            className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors btn-press"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>{job.jobPostType === 'hire' ? 'تقدّم' : 'تواصل'}</span>
          </a>
        </ProtectedPhoneButton>
      </div>
    </div>
  );
}
