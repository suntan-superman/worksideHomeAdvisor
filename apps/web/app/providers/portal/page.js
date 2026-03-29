import { AppFrame } from '../../../components/AppFrame';
import { ProviderPortalClient } from './ProviderPortalClient';

export const metadata = {
  title: 'Provider Portal | Workside Home Advisor',
  description: 'Review provider leads, monitor billing state, and update your marketplace profile.',
};

export default function ProviderPortalPage({ searchParams }) {
  const providerId =
    typeof searchParams?.providerId === 'string' ? searchParams.providerId : '';
  const token = typeof searchParams?.token === 'string' ? searchParams.token : '';
  const billingState =
    typeof searchParams?.billing === 'string' ? searchParams.billing : '';
  const created =
    typeof searchParams?.created === 'string' ? searchParams.created : '';

  return (
    <AppFrame>
      <ProviderPortalClient
        providerId={providerId}
        token={token}
        billingState={billingState}
        createdState={created}
      />
    </AppFrame>
  );
}
