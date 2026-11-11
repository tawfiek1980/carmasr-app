import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { trackAdClick } from '../lib/adAnalytics';
import { listingUrl } from '../lib/utils';

export default function AdRedirect() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) {
      navigate('/', { replace: true });
      return;
    }
    const utmSource = searchParams.get('utm_source') || '';
    const utmMedium = searchParams.get('utm_medium') || '';
    const utmCampaign = searchParams.get('utm_campaign') || '';
    trackAdClick(id, utmSource || 'direct', utmMedium || 'ad-link', utmCampaign).catch(() => {});
    let qs = '';
    const params = new URLSearchParams();
    if (utmSource) params.set('utm_source', utmSource);
    if (utmMedium) params.set('utm_medium', utmMedium);
    if (utmCampaign) params.set('utm_campaign', utmCampaign);
    const pStr = params.toString();
    if (pStr) qs = `?${pStr}`;
    navigate(`${listingUrl(id)}${qs}`, { replace: true });
  }, [id, navigate, searchParams]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-orange/20 flex items-center justify-center mx-auto mb-3 animate-pulse">
          <span className="text-orange font-bold text-xl">ط</span>
        </div>
        <p className="text-text-light text-sm">جاري التوجيه...</p>
      </div>
    </div>
  );
}
