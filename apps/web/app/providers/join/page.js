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

  return (
    <AppFrame>
      <ProviderSignupClient
        billingState={billingState}
        providerId={providerId}
        prefillCategoryKey={prefillCategoryKey}
        prefillPrimaryZip={prefillPrimaryZip}
      />
    </AppFrame>
  );
}
