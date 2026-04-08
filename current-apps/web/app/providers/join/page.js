import { AppFrame } from '../../../components/AppFrame';
import { ProviderSignupClient } from './ProviderSignupClient';

export const metadata = {
  title: 'List Your Business | Workside Home Advisor',
  description: 'Join the Workside provider marketplace and start receiving seller workflow leads.',
};

export default function ProviderJoinPage({ searchParams }) {
  const billingState =
    typeof searchParams?.billing === 'string' ? searchParams.billing : '';
  const providerId =
    typeof searchParams?.providerId === 'string' ? searchParams.providerId : '';
  const prefillCategoryKey =
    typeof searchParams?.category === 'string' ? searchParams.category : '';
  const prefillPrimaryZip =
    typeof searchParams?.zip === 'string' ? searchParams.zip : '';
  const source =
    typeof searchParams?.src === 'string' ? searchParams.src : '';
  const campaign =
    typeof searchParams?.campaign === 'string' ? searchParams.campaign : '';
  const medium =
    typeof searchParams?.medium === 'string' ? searchParams.medium : '';
  const adset = typeof searchParams?.adset === 'string' ? searchParams.adset : '';
  const ad = typeof searchParams?.ad === 'string' ? searchParams.ad : '';
  const anonymousId =
    typeof searchParams?.anonymousId === 'string' ? searchParams.anonymousId : '';

  return (
    <AppFrame>
      <ProviderSignupClient
        billingState={billingState}
        providerId={providerId}
        prefillCategoryKey={prefillCategoryKey}
        prefillPrimaryZip={prefillPrimaryZip}
        source={source}
        campaign={campaign}
        medium={medium}
        adset={adset}
        ad={ad}
        anonymousId={anonymousId}
      />
    </AppFrame>
  );
}
