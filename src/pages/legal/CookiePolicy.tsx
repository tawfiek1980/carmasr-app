import { Cookie } from 'lucide-react';
import PageLayout, { PolicySection } from '../../components/PageLayout';

export default function CookiePolicy() {
  return (
    <PageLayout
      title="سياسة ملفات تعريف الارتباط"
      description="تشرح هذه السياسة كيفية استخدام كار مصر لملفات تعريف الارتباط (Cookies) وتقنيات التتبع المماثلة."
      breadcrumbs={[{ name: 'سياسة الكوكيز' }]}
      icon={<Cookie className="w-6 h-6" />}
      lastUpdated="1 يناير 2025"
    >
      <PolicySection title="١. ما هي ملفات تعريف الارتباط؟">
        <p>ملفات تعريف الارتباط (Cookies) هي ملفات نصية صغيرة تُخزَّن على جهازك عند زيارتك لموقعنا أو استخدامك لتطبيقنا. تُستخدم هذه الملفات لتذكر تفضيلاتك وتحسين تجربتك وضمان أمان جلستك.</p>
      </PolicySection>
      <PolicySection title="٢. أنواع الكوكيز التي نستخدمها">
        <p><strong className="text-text">أ. الكوكيز الضرورية:</strong> لا غنى عنها لتشغيل المنصة، مثل الحفاظ على جلسة تسجيل الدخول وحماية النماذج من CSRF. لا يمكن تعطيلها.</p>
        <p><strong className="text-text">ب. كوكيز الأداء والتحليل:</strong> تساعدنا في فهم كيفية تفاعل المستخدمين مع المنصة (مثل Google Analytics). البيانات مجمَّعة ومجهولة الهوية.</p>
        <p><strong className="text-text">ج. كوكيز الوظائف:</strong> تحفظ تفضيلاتك مثل اللغة والمنطقة الجغرافية ونتائج البحث الأخيرة.</p>
        <p><strong className="text-text">د. كوكيز الإعلانات:</strong> نستخدمها لتقديم محتوى ذي صلة واحتسام فعالية الحملات الترويجية. هذه الكوكيز اختيارية.</p>
      </PolicySection>
      <PolicySection title="٣. كوكيز الجهات الخارجية">
        <p>تُستخدم خدمات خارجية قد تضع كوكيز خاصة بها:</p>
        <p>• <strong className="text-text">Google Firebase / Analytics:</strong> لقياس الأداء والمصادقة.</p>
        <p>• <strong className="text-text">Facebook SDK:</strong> لتسهيل تسجيل الدخول عبر فيسبوك.</p>
        <p>كل جهة خارجية لها سياسة خصوصية مستقلة نحثك على مراجعتها.</p>
      </PolicySection>
      <PolicySection title="٤. التحكم في الكوكيز">
        <p>يمكنك إدارة إعدادات الكوكيز عبر:</p>
        <p>• إعدادات المتصفح (Firefox، Chrome، Safari، Edge) للحذف أو الحظر.</p>
        <p>• أدوات رفض الإعلانات مثل Google Ads Settings أو Facebook Ad Preferences.</p>
        <p>• إعدادات التطبيق في قسم "الخصوصية والأمان".</p>
        <p>تنبيه: تعطيل الكوكيز الضرورية قد يُعطّل بعض وظائف المنصة الأساسية.</p>
      </PolicySection>
      <PolicySection title="٥. مدة الاحتفاظ بالكوكيز">
        <p>• الكوكيز المؤقتة (Session Cookies): تُحذف تلقائياً عند إغلاق المتصفح.</p>
        <p>• الكوكيز الدائمة (Persistent Cookies): تنتهي صلاحيتها بين 30 يوماً و12 شهراً حسب نوعها.</p>
      </PolicySection>
    </PageLayout>
  );
}
