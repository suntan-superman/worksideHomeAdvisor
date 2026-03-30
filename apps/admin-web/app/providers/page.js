import { AdminSection } from '../_components/AdminSection';
import { getAdminProviderLeads, getAdminProviders } from '../../lib/admin-api';
import { ProvidersTabbedWorkspace } from './ProvidersTabbedWorkspace';

export const dynamic = 'force-dynamic';

export default async function AdminProvidersPage() {
  const [providerPayload, leadPayload] = await Promise.all([
    getAdminProviders(),
    getAdminProviderLeads(),
  ]);

  const initialSnapshot = {
    providers: providerPayload.providers || [],
    leadSummary: providerPayload.leadSummary || {},
    leadOpsSummary: leadPayload.summary || {},
    leads: leadPayload.items || [],
    providerError: providerPayload.error || '',
    leadError: leadPayload.error || '',
  };

  return (
    <AdminSection
      eyebrow="Marketplace"
      title="Providers"
      description="Seed and monitor the provider marketplace foundation from one place."
    >
      <ProvidersTabbedWorkspace initialSnapshot={initialSnapshot} />
    </AdminSection>
  );
}
