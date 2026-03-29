'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function VariantCleanupCard({ initialSummary }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleRunCleanup() {
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/admin/cleanup-variants', {
        method: 'POST',
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || `Cleanup failed with ${response.status}`);
      }

      setResult(payload);
      startTransition(() => {
        router.refresh();
      });
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <article className="subpanel variant-cleanup-card">
      <div className="stack-row">
        <div>
          <div className="small-label">Variant lifecycle</div>
          <h2>Cleanup temporary variants</h2>
        </div>
        <button
          type="button"
          className="admin-button"
          onClick={handleRunCleanup}
          disabled={isPending}
        >
          {isPending ? 'Running cleanup...' : 'Run cleanup now'}
        </button>
      </div>
      <p className="muted">
        Temporary variants auto-expire after {initialSummary?.ttlHours || 72} hours. Only selected variants persist long-term.
      </p>
      <div className="mini-admin-stats">
        <div>
          <strong>{initialSummary?.cleanupEligible || 0}</strong>
          <span>eligible now</span>
        </div>
        <div>
          <strong>{initialSummary?.expiringSoon || 0}</strong>
          <span>expiring in 24h</span>
        </div>
      </div>
      {result ? (
        <div className="notice">
          Deleted {result.deleted || 0} variants from {result.scanned || 0} scanned. Failed: {result.failed || 0}.
        </div>
      ) : null}
      {error ? <div className="notice error">{error}</div> : null}
    </article>
  );
}
