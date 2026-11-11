/**
 * imageUtils.ts
 * تحسين صور Cloudinary تلقائياً لكل الشاشات + водmark
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

type ImageSize = 'thumb' | 'small' | 'medium' | 'large' | 'original';

const PAD_BG = 'b_rgb:f3f4f6';

const sizes: Record<ImageSize, string> = {
  thumb:    `w_150,h_150,c_pad,${PAD_BG},q_auto,f_auto`,
  small:    `w_400,h_300,c_pad,${PAD_BG},q_auto,f_auto`,
  medium:   `w_800,h_600,c_pad,${PAD_BG},q_auto,f_auto`,
  large:    `w_1200,h_900,c_pad,${PAD_BG},q_auto,f_auto`,
  original: 'q_auto,f_auto',
};

/**
 * تحويل رابط Cloudinary لحجم مناسب
 */
export function optimizeImage(url: string, size: ImageSize = 'medium'): string {
  if (!url) return '';
  if (!url.includes('cloudinary.com')) return url;
  // روابط الفيديو/الغلاف (video/upload) تُترك كما هي — تحويلات الصور تفسدها
  if (url.includes('/video/upload/')) return url;

  const transformation = sizes[size];
  
  if (url.includes('/upload/')) {
    const parts = url.split('/upload/');
    if (parts.length === 2) {
      return `${parts[0]}/upload/${transformation}/${parts[1]}`;
    }
  }
  
  return url;
}

/**
 * حماية الصور من الـ Screenshot
 * الشعار الرسمي + رقم المعلن يتثبتا على الصورة من الكود وقت الرفع (Canvas) ومدمجان في الملف نفسه.
 * هذه الدالة تُبقي url كما هو — رقم الهاتف يظهر عبر زر الاتصال تحت البطاقة، لا فوق الصورة.
 */
export function watermarkImage(url: string, _phone?: string): string {
  // لو الصورة عليها طبقة l_text قديمة من إصدارات سابقة، ننظفها حتى لا تتكدس فوق الشعار المدمج
  if (url && url.includes('cloudinary.com') && url.includes('/upload/')) {
    return url;
  }
  return url;
}

/**
 * مكوّن صورة responsive بـ srcSet
 */
export function getImageSrcSet(url: string): string {
  if (!url || !url.includes('cloudinary.com')) return '';
  if (url.includes('/video/upload/')) return '';
  
  const parts = url.split('/upload/');
  if (parts.length !== 2) return '';
  
  return [
    `${parts[0]}/upload/w_400,q_auto,f_auto/${parts[1]} 400w`,
    `${parts[0]}/upload/w_800,q_auto,f_auto/${parts[1]} 800w`,
    `${parts[0]}/upload/w_1200,q_auto,f_auto/${parts[1]} 1200w`,
  ].join(', ');
}

/**
 * placeholder صغير أثناء التحميل (blur)
 */
export function getBlurPlaceholder(url: string): string {
  if (!url || !url.includes('cloudinary.com')) return '';
  if (url.includes('/video/upload/')) return '';
  const parts = url.split('/upload/');
  if (parts.length !== 2) return '';
  return `${parts[0]}/upload/w_20,q_10,f_auto,e_blur:200/${parts[1]}`;
}
