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

  return (
    <AppFrame>
      <ProviderSignupClient billingState={billingState} providerId={providerId} />
    </AppFrame>
  );
}
