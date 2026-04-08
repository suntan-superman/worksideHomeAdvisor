import { AdminSection } from '../_components/AdminSection';
import { DataTable } from '../_components/DataTable';
import { MetricCard } from '../_components/MetricCard';
import { StatusBadge } from '../_components/StatusBadge';
import { getAdminBilling } from '../../lib/admin-api';
import { formatDateTime } from '../../lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminBillingPage() {
  const payload = await getAdminBilling();
  const plans = payload.plans || [];
  const subscriptions = payload.recentSubscriptions || [];

  return (
    <AdminSection
      eyebrow="Revenue"
      title="Billing"
      description="Configured Stripe plans and the latest subscription state mirrored into MongoDB."
    >
      {payload.error ? <div className="notice error">{payload.error}</div> : null}

      <div className="card-grid compact">
        <MetricCard label="Configured Plans" value={plans.filter((plan) => plan.configured).length} />
        <MetricCard label="Recent Subscriptions" value={subscriptions.length} />
        <MetricCard label="Active Subscriptions" value={payload.activeSubscriptionCount || 0} />
      </div>

      <div className="split-layout">
        <div className="subpanel">
          <h2>Plan Catalog</h2>
          <DataTable
            columns={[
              { key: 'displayName', label: 'Plan' },
              { key: 'audience', label: 'Audience' },
              { key: 'mode', label: 'Mode' },
              {
                key: 'configured',
                label: 'Configured',
                render: (value) =>
                  value ? <StatusBadge tone="success">Ready</StatusBadge> : <StatusBadge tone="neutral">Missing price</StatusBadge>,
              },
            ]}
            rows={plans}
            emptyMessage="No Stripe plan metadata found."
          />
        </div>

        <div className="subpanel">
          <h2>Recent Subscription Sync</h2>
          <DataTable
            columns={[
              { key: 'planKey', label: 'Plan' },
              { key: 'audience', label: 'Audience' },
              {
                key: 'status',
                label: 'Status',
                render: (value, row) => (
                  <StatusBadge tone={row.isActive ? 'success' : 'warn'}>{value || 'unknown'}</StatusBadge>
                ),
              },
              {
                key: 'currentPeriodEnd',
                label: 'Period End',
                render: (value) => formatDateTime(value),
              },
            ]}
            rows={subscriptions}
            emptyMessage="No subscription records have been synced yet."
          />
        </div>
      </div>
    </AdminSection>
  );
}
