import { useState } from 'react';
import { Loader2, Target, AlertTriangle, CheckCircle, User, Tag, X } from 'lucide-react';

interface TriageResult {
  category: string;
  priority: string;
  suggestedReply: string;
  needsHuman: boolean;
  keywords: string[];
}

interface Props {
  getApiUrl: () => string;
}

const PRIORITY_COLORS: Record<string, string> = {
  'عالية': 'bg-red-100 text-red-700 border-red-200',
  'متوسطة': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'منخفضة': 'bg-green-100 text-green-700 border-green-200',
};

const CATEGORY_ICONS: Record<string, string> = {
  'حساب': '👤',
  'إعلانات': '📋',
  'سيارات': '🚛',
  'تمويل': '💰',
  'معارض': '🏪',
  'دفع': '💳',
  'أمان': '🔒',
  'تقني': '⚙️',
  'أخرى': '📝',
};

export default function TriageTab({ getApiUrl }: Props) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState('');

  const handleClassify = async () => {
    if (!subject.trim() || !message.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`${getApiUrl()}/ai/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'triage', subject, message, category }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult(data);
      } else {
        setError(data.message || 'فشل التصنيف');
      }
    } catch {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">تصنيف تذاكر الدعم</h2>
        <p className="text-sm text-gray-500">استخدم الذكاء الاصطناعي لتصنيف تذاكر الدعم تلقائياً واقتراح ردود مناسبة</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-bold text-gray-700">أدخل تفاصيل التذكرة</h3>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">الموضوع</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange"
            placeholder="مثال: مشكلة في تسجيل الدخول"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">التصنيف (اختياري)</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange bg-white"
          >
            <option value="">اتركه فارغاً للتصنيف التلقائي</option>
            <option>حساب</option>
            <option>إعلانات</option>
            <option>سيارات</option>
            <option>تمويل</option>
            <option>معارض</option>
            <option>دفع</option>
            <option>أمان</option>
            <option>تقني</option>
            <option>أخرى</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">رسالة التذكرة</label>
          <textarea
            rows={4}
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange resize-none"
            placeholder="اكتب تفاصيل المشكلة أو الاستفسار..."
          />
        </div>

        <button
          onClick={handleClassify}
          disabled={loading || !subject.trim() || !message.trim()}
          className="flex items-center gap-2 bg-orange hover:bg-orange-dark text-white px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 transition-colors"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري التصنيف...</> : <><Target className="w-4 h-4" /> صنّف التذكرة</>}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4 text-orange" />
                <span className="text-sm font-semibold text-gray-500">التصنيف</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {CATEGORY_ICONS[result.category] || '📝'} {result.category}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-orange" />
                <span className="text-sm font-semibold text-gray-500">الأولوية</span>
              </div>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold border ${PRIORITY_COLORS[result.priority] || 'bg-gray-100 text-gray-700'}`}>
                {result.priority}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-orange" />
                <span className="text-sm font-semibold text-gray-500">يحتاج تدخل بشري</span>
              </div>
              <p className="text-lg font-bold">
                {result.needsHuman
                  ? <span className="text-red-600">نعم <X className="w-4 h-4 inline" /></span>
                  : <span className="text-green-600">لا <CheckCircle className="w-4 h-4 inline" /></span>}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h4 className="font-bold text-gray-700 mb-2">الرد المقترح</h4>
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm text-green-800">
              {result.suggestedReply}
            </div>
          </div>

          {result.keywords.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h4 className="font-bold text-gray-700 mb-2">الكلمات المفتاحية</h4>
              <div className="flex flex-wrap gap-2">
                {result.keywords.map((kw, i) => (
                  <span key={i} className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
