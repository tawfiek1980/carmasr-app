import { Database } from 'lucide-react';
import PageLayout, { PolicySection } from '../../components/PageLayout';
export default function DataProtectionPolicy() {
  return (
    <PageLayout title="سياسة حماية البيانات" description="التزامنا الكامل بحماية بياناتك الشخصية وفق أعلى المعايير الدولية." breadcrumbs={[{ name: 'حماية البيانات' }]} icon={<Database className="w-6 h-6" />} lastUpdated="1 يناير 2025">
      <PolicySection title="١. الأساس القانوني لمعالجة البيانات">
        <p>نعالج بياناتك استناداً إلى أسس قانونية محددة:</p>
        <p>• <strong className="text-text">تنفيذ العقد:</strong> لتقديم خدمات المنصة التي طلبتها.</p>
        <p>• <strong className="text-text">الالتزام القانوني:</strong> للامتثال للقوانين المصرية والتشريعات الدولية ذات الصلة.</p>
        <p>• <strong className="text-text">المصلحة المشروعة:</strong> لتحسين الخدمة ومنع الاحتيال وضمان الأمان.</p>
        <p>• <strong className="text-text">الموافقة الصريحة:</strong> للتسويق المباشر واستخدام بيانات الموقع.</p>
      </PolicySection>
      <PolicySection title="٢. مبادئ حماية البيانات التي نتبعها">
        <p>• <strong className="text-text">الحد الأدنى من البيانات:</strong> نجمع فقط ما هو ضروري لتقديم الخدمة.</p>
        <p>• <strong className="text-text">دقة البيانات:</strong> نسعى لتحديث بياناتك باستمرار وتصحيح الأخطاء.</p>
        <p>• <strong className="text-text">الاحتفاظ المحدود:</strong> لا نحتفظ بالبيانات لفترة أطول من الحاجة.</p>
        <p>• <strong className="text-text">السلامة التقنية:</strong> نطبق تشفيراً قوياً ووصولاً مقيَّداً للبيانات.</p>
        <p>• <strong className="text-text">الشفافية:</strong> نخطرك دائماً بكيفية استخدام بياناتك.</p>
      </PolicySection>
      <PolicySection title="٣. إجراءات الاستجابة للاختراقات">
        <p>في حال وقوع أي اختراق أمني يمس بياناتك:</p>
        <p>• نُخطرك خلال 72 ساعة من اكتشاف الاختراق.</p>
        <p>• نوفر تفاصيل واضحة عن طبيعة الاختراق وما قد تأثر من بياناتك.</p>
        <p>• نتخذ إجراءات فورية للتخفيف من الضرر وإغلاق الثغرة.</p>
        <p>• نُبلّغ الجهات التنظيمية وفق المتطلبات القانونية.</p>
      </PolicySection>
      <PolicySection title="٤. مسؤول حماية البيانات">
        <p>عيّنت كار مصر مسؤولاً لحماية البيانات (DPO) يمكنك التواصل معه مباشرة:</p>
        <p>• البريد: tawfiek.fayez@gmail.com</p>
        <p>• الهاتف: 0100 123 4568</p>
        <p>هذا المسؤول متاح للرد على جميع استفساراتك المتعلقة بمعالجة بياناتك خلال 5 أيام عمل.</p>
      </PolicySection>
    </PageLayout>
  );
}
