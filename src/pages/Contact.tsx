import { useEffect, useState } from 'react';
import { Phone, Mail, MapPin, Clock, MessageCircle, Facebook, Twitter, Instagram, Linkedin, Youtube, Send, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { getPhoneLink, getWhatsAppLink } from '../lib/utils';
import { isWhatsAppDisabled, setWhatsAppDisabled } from '../components/WhatsAppFloat';
import type { ContactNumber, SocialLink } from '../types';

const iconMap: Record<string, React.ElementType> = {
  Facebook, Twitter, Instagram, Linkedin, Youtube,
};

// بيانات ثابتة ريثما نربطها بـ Firestore
const defaultContactNumbers: ContactNumber[] = [
  { id: '1', title: 'الدعم الفني', phone: '01018870145', whatsapp: '201018870145', active: true } as any,
  { id: '2', title: 'المبيعات',    phone: '01277177710', whatsapp: '201277177710', active: true } as any,
];

const defaultSocialLinks: SocialLink[] = [
  { id: '1', name: 'Facebook',  url: 'https://www.facebook.com/TareeqEG', icon: 'Facebook',  active: true } as any,
  { id: '2', name: 'Instagram', url: 'https://instagram.com/tareeq', icon: 'Instagram', active: true } as any,
];

export default function Contact() {
  const [socialLinks]    = useState<SocialLink[]>(defaultSocialLinks);
  const [contactNumbers] = useState<ContactNumber[]>(defaultContactNumbers);
  const [loading]        = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData]   = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [waHidden, setWaHidden]   = useState(() => isWhatsAppDisabled());

  const handleRestoreWhatsApp = () => {
    setWhatsAppDisabled(false);
    window.dispatchEvent(new Event('tareeq:enable-whatsapp'));
    setWaHidden(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  const renderSocialIcon = (iconName?: string) => {
    const Icon = iconMap[iconName || ''] || MessageCircle;
    return <Icon className="w-5 h-5" />;
  };

  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-3">تواصل معنا</h1>
          <p className="text-gray-300 text-sm sm:text-base max-w-2xl mx-auto">
            فريق كار مصر متواجد لمساعدتك. للاستفسار أو الدعم، يرجى التواصل عبر أقرب قناة من القنوات التالية.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact Numbers */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-extrabold text-navy mb-4 flex items-center gap-2">
              <Phone className="w-6 h-6 text-orange" />
              أرقام التواصل
            </h2>
            
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl h-32 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {contactNumbers.map((contact, index) => (
                  <motion.div
                    key={contact.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white rounded-2xl p-5 shadow-sm border border-border hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-text">{contact.title}</h3>
                        {contact.department && (
                          <span className="text-xs text-orange font-semibold bg-orange/10 px-2 py-0.5 rounded-lg">
                            {contact.department}
                          </span>
                        )}
                      </div>
                      <div className="w-10 h-10 bg-navy/10 rounded-xl flex items-center justify-center">
                        <Phone className="w-5 h-5 text-navy" />
                      </div>
                    </div>
                    {contact.description && (
                      <p className="text-xs text-text-light mb-3">{contact.description}</p>
                    )}
                    <div className="flex gap-2">
                      <a
                        href={getPhoneLink(contact.phone)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-orange hover:bg-orange-dark text-white text-sm font-bold py-2 rounded-xl transition-colors"
                      >
                        <Phone className="w-4 h-4" />
                        {contact.phone}
                      </a>
                      <a
                        href={getWhatsAppLink(contact.phone, `السلام عليكم، أحتاج المساعدة في ${contact.title}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-10 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {waHidden && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text">أنت أخفيت زر واتساب العائم</p>
                    <p className="text-xs text-text-light">لا مشكلة — يمكنك التواصل من الأرقام أعلاه في أي وقت.</p>
                  </div>
                </div>
                <button
                  onClick={handleRestoreWhatsApp}
                  type="button"
                  className="shrink-0 bg-green-500 hover:bg-green-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
                >
                  إظهار الزر
                </button>
              </div>
            )}

            {/* Social Links */}
            <div className="mt-8">
              <h2 className="text-xl font-extrabold text-navy mb-4 flex items-center gap-2">
                <MessageCircle className="w-6 h-6 text-orange" />
                تابعنا على منصات التواصل
              </h2>
              <div className="flex flex-wrap gap-3">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <div key={i} className="w-24 h-12 bg-white rounded-xl animate-pulse" />
                  ))
                ) : (
                  socialLinks.map((link, index) => (
                    <motion.a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl shadow-sm border border-border hover:shadow-md transition-all"
                      style={{ color: link.color || '#0D1B2A' }}
                    >
                      {renderSocialIcon(link.icon)}
                      <span className="font-bold text-sm">{link.name}</span>
                    </motion.a>
                  ))
                )}
              </div>
            </div>

            {/* Contact Form */}
            <div className="mt-8 bg-white rounded-2xl p-5 sm:p-6 shadow-sm">
              <h2 className="text-xl font-extrabold text-navy mb-4 flex items-center gap-2">
                <Send className="w-6 h-6 text-orange" />
                أرسل رسالة
              </h2>
              
              {submitted ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-green-800 mb-1">تم إرسال رسالتك بنجاح</h3>
                  <p className="text-sm text-green-700">سنقوم بالرد عليك في أقرب وقت</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-text mb-1.5">الاسم</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full h-11 px-4 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-text mb-1.5">البريد الإلكتروني</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full h-11 px-4 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-text mb-1.5">رقم الهاتف</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full h-11 px-4 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-text mb-1.5">الموضوع</label>
                    <input
                      type="text"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full h-11 px-4 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-text mb-1.5">الرسالة</label>
                    <textarea
                      required
                      rows={4}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full p-4 bg-bg rounded-xl border border-border focus:border-orange focus:outline-none resize-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="w-full h-12 bg-orange hover:bg-orange-dark text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Send className="w-5 h-5" />
                      إرسال الرسالة
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-navy mb-4">معلومات الشركة</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-orange/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-orange" />
                  </div>
                  <div>
                    <p className="font-bold text-text text-sm">العنوان</p>
                    <p className="text-text-light text-xs">القاهرة، جمهورية مصر العربية</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-orange/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-orange" />
                  </div>
                  <div>
                    <p className="font-bold text-text text-sm">البريد الإلكتروني</p>
                    <p className="text-text-light text-xs">tawfiek.fayez@gmail.com</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-orange/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-orange" />
                  </div>
                  <div>
                    <p className="font-bold text-text text-sm">ساعات العمل</p>
                    <p className="text-text-light text-xs">من الأحد إلى الخميس من 9 ص إلى 6 م</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-orange to-orange-dark rounded-2xl p-5 text-white">
              <h3 className="font-bold text-lg mb-2">هل تحتاج مساعدة فورية؟</h3>
              <p className="text-white/90 text-sm mb-4">فريق الدعم الفني متواجد لمساعدتك عبر الهاتف أو الواتساب</p>
              <a
                href={getWhatsAppLink('01018870145', 'السلام عليكم، أحتاج مساعدة')}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-white text-orange px-4 py-2.5 rounded-xl font-bold"
              >
                <MessageCircle className="w-5 h-5" />
                التواصل عبر الواتساب
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
