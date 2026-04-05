import { AppFrame } from '../../components/AppFrame';
import { SellerLandingClient } from '../../components/landing/SellerLandingClient';

export const metadata = {
  title: 'Sell Your Home | Workside Home Advisor',
  description: 'Start a guided selling plan with pricing guidance, prep recommendations, providers, and marketing outputs.',
};

export default function SellerLandingPage({ searchParams }) {
  const source =
    typeof searchParams?.src === 'string' ? searchParams.src : 'direct-sell';
  const campaign =
    typeof searchParams?.campaign === 'string' ? searchParams.campaign : '';
  const medium =
    typeof searchParams?.medium === 'string' ? searchParams.medium : '';
  const adset =
    typeof searchParams?.adset === 'string' ? searchParams.adset : '';
  const ad = typeof searchParams?.ad === 'string' ? searchParams.ad : '';

  return (
    <AppFrame>
      <SellerLandingClient
        source={source}
        campaign={campaign}
        medium={medium}
        adset={adset}
        ad={ad}
      />
    </AppFrame>
  );
}
