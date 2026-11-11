/**
 * OptimizedImage.tsx
 * صورة محسّنة تلقائياً لكل الشاشات
 */
import { useState } from 'react';
import { optimizeImage, getImageSrcSet, getBlurPlaceholder } from '../lib/imageUtils';
import { Truck } from 'lucide-react';

interface Props {
  src: string;
  alt: string;
  size?: 'thumb' | 'small' | 'medium' | 'large' | 'original';
  className?: string;
  fallback?: React.ReactNode;
  objectFit?: 'cover' | 'contain' | 'fill';
}

export default function OptimizedImage({
  src, alt, size = 'medium', className = '', fallback, objectFit = 'cover'
}: Props) {
  const [loaded, setLoaded]   = useState(false);
  const [error, setError]     = useState(false);
  const [blurLoad, setBlurLoad] = useState(true);

  const optimized   = optimizeImage(src, size);
  const srcSet      = getImageSrcSet(src);
  const placeholder = getBlurPlaceholder(src);

  if (error) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        {fallback || <Truck className="w-8 h-8 text-gray-300" />}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Blur placeholder */}
      {blurLoad && placeholder && (
        <img
          src={placeholder}
          alt=""
          className="absolute inset-0 w-full h-full blur-sm scale-110"
          style={{ objectFit }}
        />
      )}

      {/* الصورة الأصلية */}
      <img
        src={optimized}
        srcSet={srcSet || undefined}
        sizes={srcSet ? "(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px" : undefined}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => { setLoaded(true); setBlurLoad(false); }}
        onError={() => setError(true)}
        className={`w-full h-full transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ objectFit }}
      />
    </div>
  );
}
