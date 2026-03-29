import { BRANDING } from '@workside/branding';

import { AdminSection } from './_components/AdminSection';
import { MetricCard } from './_components/MetricCard';
import { StatusBadge } from './_components/StatusBadge';
import {
  getAdminBilling,
  getAdminMediaVariants,
  getAdminOverview,
  getAdminWorkers,
} from '../lib/admin-api';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const [overview, billing, workersPayload, mediaPayload] = await Promise.all([
    getAdminOverview(),
    getAdminBilling(),
    getAdminWorkers(),
    getAdminMediaVariants(),
  ]);

  const metrics = overview.metrics || {};
  const workers = workersPayload.workers || [];
  const onlineWorkers = workers.filter((worker) => worker.status === 'online').length;
  const mediaSummary = mediaPayload.summary || {};

  return (
    <AdminSection
      eyebrow="Internal Console"
      title={`${BRANDING.companyName} Admin`}
      description="Operational command surface for seller accounts, pricing activity, billing state, safeguard pressure, and worker health."
      actions={<StatusBadge tone="success">{overview.dataSource || 'unknown data source'}</StatusBadge>}
    >
      {overview.error ? <div className="notice error">{overview.error}</div> : null}

      <div className="card-grid">
        <MetricCard label="Total Users" value={metrics.totalUsers || 0} note={`${metrics.verifiedUsers || 0} verified`} />
        <MetricCard label="Properties" value={metrics.totalProperties || 0} note={`${metrics.mediaAssets || 0} media assets`} />
        <MetricCard label="Pricing Analyses" value={metrics.pricingAnalyses || 0} note={`${metrics.flyersGenerated || 0} flyers`} />
        <MetricCard label="Active Subscriptions" value={metrics.activeSubscriptions || 0} note={`${billing.plans?.filter((plan) => plan.configured).length || 0} configured plans`} />
        <MetricCard label="Usage Records" value={metrics.usageRecords || 0} note={`${metrics.recentRateLimitEvents || 0} recent rate-limit events`} />
        <MetricCard label="Workers Online" value={`${onlineWorkers}/${workers.length || 0}`} note="Health probes from the admin API" />
        <MetricCard label="Vision Variants" value={mediaSummary.totalVariants || 0} note={`${mediaSummary.selectedPersistent || 0} persistent • ${mediaSummary.cleanupEligible || 0} cleanup eligible`} />
      </div>

      <div className="split-layout">
        <div className="subpanel">
          <h2>What this console now covers</h2>
          <ul className="bullet-list muted">
            <li>Live admin overview aggregated from MongoDB.</li>
            <li>Users and property inventory inspection.</li>
            <li>Billing plan catalog and recent subscription sync.</li>
            <li>Usage safeguards and worker health visibility.</li>
            <li>Vision variant lifecycle monitoring and cleanup controls.</li>
          </ul>
        </div>

        <div className="subpanel">
          <h2>Worker Snapshot</h2>
          <div className="stack-list">
            {workers.map((worker) => (
              <div key={worker.key} className="stack-row">
                <strong>{worker.name}</strong>
                <StatusBadge tone={worker.status === 'online' ? 'success' : 'warn'}>
                  {worker.status}
                </StatusBadge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminSection>
  );
}
