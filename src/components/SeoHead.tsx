import { Helmet } from 'react-helmet-async';

interface Props {
  title: string;
  description?: string;
  ogImage?: string;
  ogType?: string;
  canonical?: string;
  jsonLd?: Record<string, unknown>;
}

const SITE = 'https://carmasr-app.vercel.app';
const DEFAULT_DESC = 'أكبر سوق إلكتروني للنقل الثقيل في مصر. شاحنات، معدات ثقيلة، حمولات، وظائف، تمويل، وخدمات طوارئ.';
const DEFAULT_IMAGE = `${SITE}/og-image.png`;

export default function SeoHead({
  title,
  description = DEFAULT_DESC,
  ogImage = DEFAULT_IMAGE,
  ogType = 'website',
  canonical,
  jsonLd,
}: Props) {
  const fullTitle = title.includes('كار مصر') ? title : `${title} | كار مصر CarMasr`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonical || SITE} />
      <meta property="og:locale" content="ar_EG" />
      <meta property="og:site_name" content="كار مصر CarMasr" />
      <link rel="canonical" href={canonical || SITE} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
