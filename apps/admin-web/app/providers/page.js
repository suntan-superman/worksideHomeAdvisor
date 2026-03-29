import { AdminSection } from '../_components/AdminSection';
import { DataTable } from '../_components/DataTable';
import { MetricCard } from '../_components/MetricCard';
import { getAdminProviderLeads, getAdminProviders } from '../../lib/admin-api';
import { CreateProviderCard } from './CreateProviderCard';
import { ProviderLeadOperations } from './ProviderLeadOperations';
import { ProviderRoster } from './ProviderRoster';

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
      {providerPayload.error ? <div className="notice error">{providerPayload.error}</div> : null}
      {leadPayload.error ? <div className="notice error">{leadPayload.error}</div> : null}

      <div className="card-grid compact">
        <MetricCard label="Providers" value={providers.length} note="Current marketplace records" />
        <MetricCard label="Open Leads" value={leadSummary.open || 0} note="No providers contacted yet" />
        <MetricCard label="Routing" value={leadSummary.routing || 0} note="Queued for provider outreach" />
        <MetricCard label="Matched" value={leadSummary.matched || 0} note="At least one provider engaged" />
      </div>

      <div className="card-grid compact">
        <MetricCard label="Awaiting Response" value={leadOpsSummary.awaitingResponse || 0} note="Sent but not yet accepted" />
        <MetricCard label="Failed Dispatches" value={leadOpsSummary.failedDispatches || 0} note="Need manual resend or review" />
        <MetricCard label="Closed Leads" value={(leadOpsSummary.completed || 0) + (leadOpsSummary.cancelled || 0)} note="Completed or cancelled manually" />
      </div>

      <div className="split-layout">
        <CreateProviderCard />
        <div className="subpanel">
          <h2>Operations focus</h2>
          <ul className="bullet-list muted">
            <li>Review routing state, provider responses, and SMS activity per lead.</li>
            <li>Resend outreach for leads that stalled or had failed dispatches.</li>
            <li>Close a lead once the provider engagement is complete or no longer needed.</li>
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
              `${value} · ${row.compliance?.approvalStatus || 'draft'}${row.isVerified ? ' · verified' : ''}${row.isSponsored ? ' · sponsored' : ''}`,
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
            key: 'trust',
            label: 'Trust',
            render: (_value, row) =>
              `${row.compliance?.licenseStatus || 'unverified'} · ${row.compliance?.insuranceStatus || 'unverified'}`,
          },
          {
            key: 'subscription',
            label: 'Plan',
            render: (_value, row) => row.subscription?.planCode || 'provider_basic',
          },
        ]}
        rows={providers}
        emptyMessage="No providers have been created yet."
      />

      <ProviderRoster providers={providers} />

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

      <ProviderLeadOperations leads={leadPayload.items || []} />
    </AdminSection>
  );
}
