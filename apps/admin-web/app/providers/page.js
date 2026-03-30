import { AdminSection } from '../_components/AdminSection';
import { getAdminProviderLeads, getAdminProviders } from '../../lib/admin-api';
import { ProvidersTabbedWorkspace } from './ProvidersTabbedWorkspace';

export const dynamic = 'force-dynamic';

export default async function AdminProvidersPage() {
  const [providerPayload, leadPayload] = await Promise.all([
    getAdminProviders(),
    getAdminProviderLeads(),
  ]);

  const providers = providerPayload.providers || [];
  const leadSummary = providerPayload.leadSummary || {};
  const leadOpsSummary = leadPayload.summary || {};

  return (
    <AdminSection
      eyebrow="Marketplace"
      title="Providers"
      description="Seed and monitor the provider marketplace foundation from one place."
    >
      <ProvidersTabbedWorkspace
        providers={providers}
        leadSummary={leadSummary}
        leadOpsSummary={leadOpsSummary}
        leads={leadPayload.items || []}
        providerError={providerPayload.error || ''}
        leadError={leadPayload.error || ''}
      />
    </AdminSection>
  );
}
