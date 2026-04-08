import { AdminSection } from '../_components/AdminSection';
import { DataTable } from '../_components/DataTable';
import { MetricCard } from '../_components/MetricCard';
import { getAdminUsage } from '../../lib/admin-api';
import { formatDateTime } from '../../lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminUsagePage() {
  const payload = await getAdminUsage();
  const summary = payload.summary || {};
  const rows = payload.topUsage || [];

  return (
    <AdminSection
      eyebrow="Safeguards"
      title="Usage"
      description="Track quota pressure, caching behavior, and the current safeguard footprint."
    >
      {payload.error ? <div className="notice error">{payload.error}</div> : null}

      <div className="card-grid compact">
        <MetricCard label="Usage Records" value={summary.usageRecordCount || 0} />
        <MetricCard label="Open Locks" value={summary.openLocks || 0} />
        <MetricCard label="Last 24h Rate Limits" value={summary.last24hRateLimitEvents || 0} />
      </div>

      <DataTable
        columns={[
          { key: 'planCode', label: 'Plan' },
          { key: 'uniquePropertiesAnalyzed', label: 'Properties' },
          { key: 'pricingRunsTotal', label: 'Pricing Runs' },
          { key: 'pricingCacheHits', label: 'Pricing Cache Hits' },
          { key: 'flyersGenerated', label: 'Flyers' },
          { key: 'deniedRequests', label: 'Denied' },
          {
            key: 'updatedAt',
            label: 'Updated',
            render: (value) => formatDateTime(value),
          },
        ]}
        rows={rows}
        emptyMessage="No usage records are available yet."
      />
    </AdminSection>
  );
}
