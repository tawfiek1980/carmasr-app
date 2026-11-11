interface Props {
  brand: string;
  className?: string;
}

const BRAND_DOMAINS: Record<string, string> = {
  'مرسيدس': 'mercedes-benz.com',
  'Mercedes': 'mercedes-benz.com',
  'فولفو': 'volvo.com',
  'Volvo': 'volvo.com',
  'MAN': 'man.eu',
  'Caterpillar': 'caterpillar.com',
  'Komatsu': 'komatsu.com',
  'Carrier': 'carrier.com',
  'Bridgestone': 'bridgestone.com',
  'تويوتا': 'toyota.com',
  'Toyota': 'toyota.com',
  'شيفروليه': 'chevrolet.com',
  'Chevrolet': 'chevrolet.com',
  'نيسان': 'nissan.com',
  'Nissan': 'nissan.com',
  'هيونداي': 'hyundai.com',
  'Hyundai': 'hyundai.com',
  'ميتسوبيشي': 'mitsubishi.com',
  'Mitsubishi': 'mitsubishi.com',
  'فورد': 'ford.com',
  'Ford': 'ford.com',
  'رينو': 'renault.com',
  'Renault': 'renault.com',
  'سكانيا': 'scania.com',
  'Scania': 'scania.com',
  'داف': 'daf.com',
  'DAF': 'daf.com',
  'ايفكو': 'iveco.com',
  'Iveco': 'iveco.com',
  'هينو': 'hino.com',
  'Hino': 'hino.com',
  'Suzuki': 'suzuki.com',
  'سوزوكى': 'suzuki.com',
};

const BRAND_COLORS: Record<string, string> = {
  'مرسيدس': '#009FDA',
  'Mercedes': '#009FDA',
  'فولفو': '#003057',
  'Volvo': '#003057',
  'MAN': '#C41230',
  'Caterpillar': '#FFCD00',
  'Komatsu': '#0033A0',
  'شيفروليه': '#C8102E',
  'Chevrolet': '#C8102E',
  'هيونداي': '#002C5F',
  'Hyundai': '#002C5F',
  'فورد': '#003478',
  'Ford': '#003478',
  'Scania': '#041E42',
  'سكانيا': '#041E42',
  'تويوتا': '#E60012',
  'Toyota': '#E60012',
};

export default function BrandLogo({ brand, className = 'w-5 h-5' }: Props) {
  if (!brand) return null;

  const domain = BRAND_DOMAINS[brand];
  const bgColor = BRAND_COLORS[brand] || '#6B7280';
  const initial = brand.charAt(0);

  if (domain) {
    return (
      <img
        src={`https://logo.clearbit.com/${domain}?size=40`}
        alt={brand}
        className={`${className} rounded-full object-contain bg-white`}
        onError={e => {
          const t = e.target as HTMLImageElement;
          t.style.display = 'none';
          t.nextElementSibling?.classList.remove('hidden');
        }}
      />
    );
  }

  return (
    <span
      className={`${className} rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0`}
      style={{ backgroundColor: bgColor }}
    >
      {initial}
    </span>
  );
}
