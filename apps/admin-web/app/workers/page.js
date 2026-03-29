import { AdminSection } from '../_components/AdminSection';
import { DataTable } from '../_components/DataTable';
import { MetricCard } from '../_components/MetricCard';
import { StatusBadge } from '../_components/StatusBadge';
import { getAdminMediaVariants, getAdminWorkers } from '../../lib/admin-api';
import { VariantCleanupCard } from './VariantCleanupCard';

export const dynamic = 'force-dynamic';

export default async function AdminWorkersPage() {
  const [payload, mediaPayload] = await Promise.all([
    getAdminWorkers(),
    getAdminMediaVariants(),
  ]);
  const workers = payload.workers || [];
  const mediaSummary = mediaPayload.summary || {};

  return (
    <AdminSection
      eyebrow="Services"
      title="Workers"
      description="Health and capability overview for the asynchronous worker services."
    >
      {payload.error ? <div className="notice error">{payload.error}</div> : null}
      {mediaPayload.error ? <div className="notice error">{mediaPayload.error}</div> : null}

      <div className="card-grid compact">
        <MetricCard label="Total Variants" value={mediaSummary.totalVariants || 0} note={`${mediaSummary.temporaryVariants || 0} temporary`} />
        <MetricCard label="Persistent" value={mediaSummary.selectedPersistent || 0} note="Selected variants kept long-term" />
        <MetricCard label="Cleanup Eligible" value={mediaSummary.cleanupEligible || 0} note={`${mediaSummary.expiringSoon || 0} expiring in 24h`} />
      </div>

      <div className="split-layout">
        <VariantCleanupCard initialSummary={mediaSummary} />
        <div className="subpanel">
          <h2>Lifecycle policy</h2>
          <ul className="bullet-list muted">
            <li>New variants are temporary by default.</li>
            <li>Selecting a variant promotes it to long-term persistence.</li>
            <li>Cleanup removes expired binaries and database rows safely.</li>
            <li>Brochure and report usage still depend on explicit seller selection.</li>
          </ul>
        </div>
      </div>

      <div className="worker-grid">
        {workers.length ? (
          workers.map((worker) => (
            <article key={worker.key} className="worker-card">
              <div className="worker-card-header">
                <div>
                  <div className="small-label">{worker.name}</div>
                  <h2>{worker.url}</h2>
                </div>
                <StatusBadge tone={worker.status === 'online' ? 'success' : 'warn'}>
                  {worker.status}
                </StatusBadge>
              </div>
              <p className="muted">
                {(worker.responsibilities || []).join(' • ')}
              </p>
              <pre className="worker-health-block">
                {JSON.stringify(worker.health || {}, null, 2)}
              </pre>
            </article>
          ))
        ) : (
          <div className="empty-state">No worker definitions are available.</div>
        )}
      </div>

      <DataTable
        columns={[
          { key: 'roomLabel', label: 'Room' },
          { key: 'label', label: 'Variant' },
          { key: 'lifecycleState', label: 'Lifecycle' },
          {
            key: 'expiresAt',
            label: 'Expires',
            render: (_value, row) =>
              row.lifecycleState === 'selected'
                ? 'Persistent'
                : row.expiresAt
                  ? new Date(row.expiresAt).toLocaleString()
                  : 'Pending cleanup window',
          },
          {
            key: 'overallScore',
            label: 'Score',
            render: (value) => (value ? `${value}/100` : '—'),
          },
        ]}
        rows={mediaPayload.recentVariants || []}
        emptyMessage="No media variants are available yet."
      />
    </AdminSection>
  );
}
