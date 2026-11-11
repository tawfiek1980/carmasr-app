import { Trash2 } from 'lucide-react';
import PageLayout, { PolicySection } from '../../components/PageLayout';
import { Link } from 'react-router-dom';
export default function AccountDeletionPolicy() {
  return (
    <PageLayout title="سياسة حذف الحساب" description="كل ما تحتاج معرفته حول حذف حسابك وبياناتك على منصة كار مصر." breadcrumbs={[{ name: 'حذف الحساب' }]} icon={<Trash2 className="w-6 h-6" />} lastUpdated="1 يناير 2025">
      <PolicySection title="١. حقك في حذف الحساب">
        <p>يحق لك حذف حسابك في أي وقت دون الحاجة لتقديم أي تبرير. هذا حق أصيل مكفول بموجب سياسة الخصوصية ومتطلبات Google Play وApp Store.</p>
      </PolicySection>
      <PolicySection title="٢. خطوات حذف الحساب">
        <p>يمكنك حذف حسابك عبر:</p>
        <p>• الطريقة الأولى: إعدادات الحساب ← الأمان والخصوصية ← حذف الحساب.</p>
        <p>• الطريقة الثانية: إرسال طلب عبر البريد tawfiek.fayez@gmail.com من العنوان المسجَّل.</p>
        <p>• الطريقة الثالثة: زيارة <Link to="/delete-account" className="text-orange hover:underline">صفحة حذف البيانات</Link> واتباع التعليمات.</p>
        <p>سيُطلب منك تأكيد هويتك وتأكيد الإجراء قبل الحذف النهائي.</p>
      </PolicySection>
      <PolicySection title="٣. ما يحدث عند حذف الحسابk">
        <p>• تُحذف جميع إعلاناتك النشطة فوراً.</p>
        <p>• تُحذف رسائلك وتفضيلاتك وبيانات الاستخدام خلال 30 يوماً.</p>
        <p>• تُحذف بيانات حسابك الأساسية (الاسم، البريد، الهاتف) خلال 30 يوماً.</p>
        <p>• تُحذف النسخ الاحتياطية خلال 90 يوماً من الطلب.</p>
      </PolicySection>
      <PolicySection title="٤. البيانات المُحتفَظ بها بعد الحذف">
        <p>وفقاً للالتزامات القانونية المصرية، نحتفظ بعد الحذف بـ:</p>
        <p>• سجلات المعاملات المالية لمدة 5 سنوات (متطلب ضريبي وقانوني).</p>
        <p>• سجلات البلاغات والمخالفات المسبقة إذا كانت ذات صلة بإجراءات قانونية جارية.</p>
        <p>• البيانات المجهولة الهوية ضمن إحصائيات مجمَّعة (لا تُحدِّدك شخصياً).</p>
      </PolicySection>
      <PolicySection title="٥. إمكانية استعادة الحساب">
        <p>يمكنك إلغاء طلب الحذف خلال 14 يوماً من تقديم الطلب. بعد انتهاء هذه المدة، يصبح الحذف نهائياً ولا يمكن الرجوع عنه.</p>
      </PolicySection>
    </PageLayout>
  );
}
