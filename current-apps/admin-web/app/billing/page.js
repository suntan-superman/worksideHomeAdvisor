import { AdminSection } from '../_components/AdminSection';
import { DataTable } from '../_components/DataTable';
import { MetricCard } from '../_components/MetricCard';
import { StatusBadge } from '../_components/StatusBadge';
import { getAdminBilling } from '../../lib/admin-api';
import { formatDateTime } from '../../lib/format';

export const dynamic = 'force-dynamic';

function formatPlanLabel(value) {
  return String(value || 'provider_basic')
    .replace(/^provider_/, '')
    .replace(/_/g, ' ');
}

function formatStripeId(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '—';
  }

  if (normalized.length <= 18) {
    return normalized;
  }

  return `${normalized.slice(0, 8)}...${normalized.slice(-6)}`;
}

export default async function AdminBillingPage() {
  const payload = await getAdminBilling();
  const plans = payload.plans || [];
  const subscriptions = payload.recentSubscriptions || [];
  const providerSummary = payload.providerSummary || {};
  const recentProviderBilling = payload.recentProviderBilling || [];
  const webhookSummary = payload.webhookSummary || {};
  const recentWebhookEvents = payload.recentWebhookEvents || [];

  return (
    <AdminSection
      eyebrow="Revenue"
      title="Billing"
      description="Configured Stripe plans, provider billing health, and the latest webhook outcomes mirrored into MongoDB."
    >
      {payload.error ? <div className="notice error">{payload.error}</div> : null}

      <div className="card-grid compact">
        <MetricCard label="Configured Plans" value={plans.filter((plan) => plan.configured).length} />
        <MetricCard label="Recent Subscriptions" value={subscriptions.length} />
        <MetricCard label="Active Subscriptions" value={payload.activeSubscriptionCount || 0} />
        <MetricCard label="Paid Providers" value={providerSummary.paidPlans || 0} note={`${providerSummary.activePaid || 0} active`} />
        <MetricCard label="Provider Billing Follow-up" value={providerSummary.needsAction || 0} note={`${providerSummary.needsSync || 0} waiting on sync`} />
        <MetricCard label="Webhook Failures" value={webhookSummary.failedEvents || 0} note={`${webhookSummary.last24hFailedEvents || 0} in last 24h`} />
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

      <div className="split-layout">
        <div className="subpanel">
          <h2>Provider Billing Health</h2>
          <div className="stack-list">
            <div className="stack-row">
              <strong>Total providers</strong>
              <div className="muted">{providerSummary.totalProviders || 0}</div>
            </div>
            <div className="stack-row">
              <strong>Paid plans selected</strong>
              <div className="muted">{providerSummary.paidPlans || 0}</div>
            </div>
            <div className="stack-row">
              <strong>Active paid billing</strong>
              <div className="muted">{providerSummary.activePaid || 0}</div>
            </div>
            <div className="stack-row">
              <strong>Needs billing follow-up</strong>
              <div className="muted">{providerSummary.needsAction || 0}</div>
            </div>
            <div className="stack-row">
              <strong>Pending sync</strong>
              <div className="muted">{providerSummary.needsSync || 0}</div>
            </div>
            <div className="stack-row">
              <strong>Pending billing status</strong>
              <div className="muted">{providerSummary.pendingBilling || 0}</div>
            </div>
          </div>
        </div>

        <div className="subpanel">
          <h2>Webhook Health</h2>
          <div className="stack-list">
            <div className="stack-row">
              <strong>Total webhook events</strong>
              <div className="muted">{webhookSummary.totalEvents || 0}</div>
            </div>
            <div className="stack-row">
              <strong>Last 24 hours</strong>
              <div className="muted">{webhookSummary.last24hEvents || 0}</div>
            </div>
            <div className="stack-row">
              <strong>Failed events</strong>
              <div className="muted">{webhookSummary.failedEvents || 0}</div>
            </div>
            <div className="stack-row">
              <strong>Failed in last 24 hours</strong>
              <div className="muted">{webhookSummary.last24hFailedEvents || 0}</div>
            </div>
            <div className="stack-row">
              <strong>Provider-related events</strong>
              <div className="muted">{webhookSummary.providerEvents || 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="split-layout">
        <div className="subpanel">
          <h2>Recent Provider Billing</h2>
          <DataTable
            columns={[
              { key: 'businessName', label: 'Provider' },
              {
                key: 'planCode',
                label: 'Plan',
                render: (value) => formatPlanLabel(value),
              },
              {
                key: 'billingStatus',
                label: 'Billing Status',
                render: (value) => (
                  <StatusBadge tone={['active', 'trialing', 'past_due', 'paid'].includes(value) ? 'success' : 'warn'}>
                    {value || 'inactive'}
                  </StatusBadge>
                ),
              },
              {
                key: 'currentPeriodEnd',
                label: 'Period End',
                render: (value) => formatDateTime(value),
              },
              {
                key: 'stripeCheckoutSessionId',
                label: 'Checkout',
                render: (value) => formatStripeId(value),
              },
            ]}
            rows={recentProviderBilling}
            emptyMessage="No provider billing records require attention yet."
          />
        </div>

        <div className="subpanel">
          <h2>Recent Webhook Events</h2>
          <DataTable
            columns={[
              { key: 'type', label: 'Event Type' },
              {
                key: 'processingStatus',
                label: 'Outcome',
                render: (value) => (
                  <StatusBadge tone={value === 'processed' ? 'success' : 'warn'}>{value || 'unknown'}</StatusBadge>
                ),
              },
              {
                key: 'stripeCreatedAt',
                label: 'Stripe Time',
                render: (value) => formatDateTime(value),
              },
              {
                key: 'stripeSubscriptionId',
                label: 'Subscription',
                render: (value) => formatStripeId(value),
              },
              {
                key: 'errorMessage',
                label: 'Details',
                render: (value, row) => value || row.planKey || row.eventObjectType || 'Processed',
              },
            ]}
            rows={recentWebhookEvents}
            emptyMessage="No webhook events have been logged yet."
          />
        </div>
      </div>
    </AdminSection>
  );
}
