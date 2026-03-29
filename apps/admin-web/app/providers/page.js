import { AdminSection } from '../_components/AdminSection';
import { DataTable } from '../_components/DataTable';
import { MetricCard } from '../_components/MetricCard';
import { getAdminProviderLeads, getAdminProviders } from '../../lib/admin-api';
import { CreateProviderCard } from './CreateProviderCard';

export const dynamic = 'force-dynamic';

export default async function AdminProvidersPage() {
  const [providerPayload, leadPayload] = await Promise.all([
    getAdminProviders(),
    getAdminProviderLeads(),
  ]);

  const providers = providerPayload.providers || [];
  const leadSummary = providerPayload.leadSummary || {};

  return (
    <AdminSection
      eyebrow="Marketplace"
      title="Providers"
      description="Seed and monitor the provider marketplace foundation from one place."
    >
      {providerPayload.error ? <div className="notice error">{providerPayload.error}</div> : null}
      {leadPayload.error ? <div className="notice error">{leadPayload.error}</div> : null}

      <div className="card-grid compact">
        <MetricCard label="Providers" value={providers.length} note="Current marketplace records" />
        <MetricCard label="Open Leads" value={leadSummary.open || 0} note="No providers contacted yet" />
        <MetricCard label="Routing" value={leadSummary.routing || 0} note="Queued for provider outreach" />
        <MetricCard label="Matched" value={leadSummary.matched || 0} note="At least one provider engaged" />
      </div>

      <div className="split-layout">
        <CreateProviderCard />
        <div className="subpanel">
          <h2>Foundation scope</h2>
          <ul className="bullet-list muted">
            <li>Seller checklist tasks can now resolve provider recommendations by category.</li>
            <li>Lead requests are persisted and visible here for operational review.</li>
            <li>Provider onboarding, Stripe billing, and Twilio routing are still the next layer.</li>
          </ul>
        </div>
      </div>

      <DataTable
        columns={[
          { key: 'businessName', label: 'Business' },
          { key: 'categoryLabel', label: 'Category' },
          {
            key: 'status',
            label: 'Status',
            render: (value, row) =>
              `${value}${row.isVerified ? ' · verified' : ''}${row.isSponsored ? ' · sponsored' : ''}`,
          },
          {
            key: 'serviceArea',
            label: 'Coverage',
            render: (_value, row) =>
              [row.serviceArea?.city, row.serviceArea?.state].filter(Boolean).join(', ') ||
              'Coverage not set',
          },
          { key: 'leadCount', label: 'Lead Count' },
          {
            key: 'subscription',
            label: 'Plan',
            render: (_value, row) => row.subscription?.planCode || 'provider_basic',
          },
        ]}
        rows={providers}
        emptyMessage="No providers have been created yet."
      />

      <DataTable
        columns={[
          { key: 'categoryKey', label: 'Category' },
          { key: 'status', label: 'Lead Status' },
          { key: 'propertyCity', label: 'City' },
          { key: 'contacted', label: 'Contacted' },
          { key: 'accepted', label: 'Accepted' },
          { key: 'declined', label: 'Declined' },
        ]}
        rows={leadPayload.items || []}
        emptyMessage="No provider leads have been created yet."
      />
    </AdminSection>
  );
}
