import { AdminSection } from '../_components/AdminSection';
import {
  getAdminProviderCategories,
  getAdminProviderLeads,
  getAdminProviders,
} from '../../lib/admin-api';
import { ProvidersTabbedWorkspace } from './ProvidersTabbedWorkspace';

export const dynamic = 'force-dynamic';

export default async function AdminProvidersPage() {
  const [providerPayload, leadPayload, categoryPayload] = await Promise.all([
    getAdminProviders(),
    getAdminProviderLeads(),
    getAdminProviderCategories(),
  ]);

  const initialSnapshot = {
    providers: providerPayload.providers || [],
    categories: categoryPayload.categories || [],
    leadSummary: providerPayload.leadSummary || {},
    leadOpsSummary: leadPayload.summary || {},
    leads: leadPayload.items || [],
    providerError: providerPayload.error || '',
    leadError: leadPayload.error || '',
    categoryError: categoryPayload.error || '',
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
