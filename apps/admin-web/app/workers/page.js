import { AdminSection } from '../_components/AdminSection';
import { StatusBadge } from '../_components/StatusBadge';
import { getAdminWorkers } from '../../lib/admin-api';

export const dynamic = 'force-dynamic';

export default async function AdminWorkersPage() {
  const payload = await getAdminWorkers();
  const workers = payload.workers || [];

  return (
    <AdminSection
      eyebrow="Services"
      title="Workers"
      description="Health and capability overview for the asynchronous worker services."
    >
      {payload.error ? <div className="notice error">{payload.error}</div> : null}

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
    </AdminSection>
  );
}
