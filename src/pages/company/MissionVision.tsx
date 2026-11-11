import { Target, Eye, Zap, Globe, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MissionVision() {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      <div className="bg-navy text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link to="/" className="hover:text-orange">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">رسالتنا ورؤيتنا</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">رسالتنا ورؤيتنا</h1>
          <p className="text-gray-300">ما نؤمن به وإلى أين نتجه</p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <div className="bg-surface rounded-2xl border border-border p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange/10 flex items-center justify-center">
              <Target className="w-6 h-6 text-orange" />
            </div>
            <h2 className="text-xl font-bold text-text">رسالتنا</h2>
          </div>
          <p className="text-text-light leading-loose text-sm">
            تمكين كل فرد ومؤسسة في قطاع السيارات الملاكي بمصر من خلال توفير سوق رقمي شفاف وموثوق وسهل الاستخدام، يجعل عمليات البيع والشراء والإيجار والنقل أسرع وأكثر أماناً وأوفر تكلفة للجميع.
          </p>
        </div>
        <div className="bg-surface rounded-2xl border border-border p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange/10 flex items-center justify-center">
              <Eye className="w-6 h-6 text-orange" />
            </div>
            <h2 className="text-xl font-bold text-text">رؤيتنا</h2>
          </div>
          <p className="text-text-light leading-loose text-sm">
            أن تكون كار مصر بحلول 2030 المنصة الرقمية الرائدة لقطاع السيارات الملاكي في منطقة الشرق الأوسط وشمال أفريقيا، مشكّلةً نظاماً بيئياً رقمياً متكاملاً يخدم كل حلقة في سلسلة الإمداد واللوجستيات.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-surface rounded-2xl border border-border p-6">
            <Zap className="w-8 h-8 text-orange mb-3" />
            <h3 className="font-bold text-text mb-2">التحول الرقمي</h3>
            <p className="text-text-light text-sm leading-relaxed">نقود مسيرة التحول الرقمي لقطاع السيارات الملاكي في مصر، مُحوِّلين سوقاً تقليدياً إلى منظومة رقمية فاعلة ومتكاملة.</p>
          </div>
          <div className="bg-surface rounded-2xl border border-border p-6">
            <Globe className="w-8 h-8 text-orange mb-3" />
            <h3 className="font-bold text-text mb-2">التوسع الإقليمي</h3>
            <p className="text-text-light text-sm leading-relaxed">بعد إرساء وجودنا في مصر، نتطلع إلى التوسع في دول المنطقة تدريجياً وفق خطة محكمة ومدروسة.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
