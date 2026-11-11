import { Truck, Award, Users, TrendingUp, MapPin, Star, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const stats = [
  { label: 'إعلان نشط', value: '+50,000', icon: Truck },
  { label: 'مستخدم مسجل', value: '+100,000', icon: Users },
  { label: 'محافظة مغطاة', value: '27', icon: MapPin },
  { label: 'معاملة ناجحة', value: '+200,000', icon: TrendingUp },
];

const values = [
  { title: 'الثقة', desc: 'نبني علاقات قائمة على الشفافية الكاملة بين البائعين والمشترين.' },
  { title: 'الأمان', desc: 'نحمي بيانات ومعاملات مستخدمينا بأعلى معايير الأمان.' },
  { title: 'الابتكار', desc: 'نُطوّر تقنياتنا باستمرار لتلبية احتياجات سوق النقل المتنامي.' },
  { title: 'الشمولية', desc: 'نخدم الأفراد والشركات الصغيرة والكبيرة على حد سواء.' },
];

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-bg pb-20 sm:pb-8">
      {/* Hero */}
      <div className="bg-navy text-white py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link to="/" className="hover:text-orange transition-colors">الرئيسية</Link>
            <ChevronLeft className="w-4 h-4 rtl-flip" />
            <span className="text-gray-300">من نحن</span>
          </nav>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-orange flex items-center justify-center">
              <Truck className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold">من نحن</h1>
              <p className="text-orange font-semibold">About CarMasr</p>
            </div>
          </div>
          <p className="text-gray-300 text-lg leading-relaxed max-w-3xl">
            كار مصر هي المنصة الرقمية الرائدة في مصر لسوق مركبات النقل الثقيل والسيارات. نربط أصحاب السيارات والسيارات بالمشترين والمستأجرين في بيئة آمنة وموثوقة.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-surface rounded-2xl border border-border p-5 text-center">
              <stat.icon className="w-7 h-7 text-orange mx-auto mb-2" />
              <div className="text-2xl font-bold text-navy">{stat.value}</div>
              <div className="text-text-light text-sm">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Story */}
        <div className="bg-surface rounded-2xl border border-border p-8 mb-8">
          <h2 className="text-xl font-bold text-text mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-orange rounded-full inline-block" />
            قصتنا
          </h2>
          <div className="text-text-light text-sm leading-loose space-y-4">
            <p>
              وُلدت فكرة كار مصر من معاناة حقيقية يعانيها يومياً أصحاب سيارات النقل في مصر: صعوبة إيجاد مشترين موثوقين، وشُح المعلومات عن أسعار السوق، وانعدام منصة متخصصة تجمع كل ما يحتاجه قطاع النقل الثقيل في مكان واحد.
            </p>
            <p>
              في عام 2023، أطلقنا كار مصر بهدف واضح: تحويل هذا القطاع الحيوي إلى قطاع رقمي شفاف يستفيد منه الجميع — من سائق الشاحنة المستقل وصولاً إلى شركات النقل الكبرى. اليوم، أصبحنا المرجع الأول للبيع والشراء والتأجير في هذا المجال بمصر.
            </p>
            <p>
              كار مصر ليست مجرد موقع إعلانات — نحن نوفر منظومة متكاملة تشمل طلبات الحمولة والوظائف وخدمات التمويل وقطع الغيار والطوارئ، مما يجعلنا الوجهة الشاملة لكل من يعمل في قطاع النقل والسيارات الثقيلة.
            </p>
          </div>
        </div>

        {/* Values */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-text mb-6 flex items-center gap-2">
            <span className="w-1 h-5 bg-orange rounded-full inline-block" />
            قيمنا الجوهرية
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {values.map((v) => (
              <div key={v.title} className="bg-surface rounded-2xl border border-border p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-5 h-5 text-orange" />
                  <h3 className="font-bold text-text">{v.title}</h3>
                </div>
                <p className="text-text-light text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="bg-navy rounded-2xl p-8 text-center text-white">
          <Award className="w-12 h-12 text-orange mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">انضم إلى مجتمع كار مصر اليوم</h2>
          <p className="text-gray-300 mb-6">أكثر من 100,000 محترف في مجال النقل يثقون بكار مصر</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link to="/register" className="bg-orange hover:bg-orange-dark text-white px-8 py-3 rounded-xl font-bold transition-colors">
              سجّل مجاناً
            </Link>
            <Link to="/contact" className="border border-white/30 hover:border-orange text-white px-8 py-3 rounded-xl font-bold transition-colors">
              تواصل معنا
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
