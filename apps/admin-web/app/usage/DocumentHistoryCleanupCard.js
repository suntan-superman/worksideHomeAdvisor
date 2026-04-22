'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const DEFAULT_FORM = {
  olderThanDays: 45,
  keepLatest: 1,
  target: 'both',
  dryRun: true,
};

export function DocumentHistoryCleanupCard() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    setResult(null);

    setStatus(form.dryRun ? 'Running cleanup preview...' : 'Cleaning old document history...');
    try {
      const response = await fetch('/api/admin/documents/cleanup-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          olderThanDays: Number(form.olderThanDays) || 45,
          keepLatest: Number(form.keepLatest) || 1,
          target: form.target || 'both',
          dryRun: Boolean(form.dryRun),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || 'Document cleanup request failed.');
      }

      setResult(body);
      setStatus(body.dryRun ? 'Preview complete. No rows deleted.' : 'Cleanup complete.');
      startTransition(() => {
        router.refresh();
      });
    } catch (requestError) {
      setError(requestError.message);
      setStatus('');
    }
  }

  const totals = result?.totals || {};

  return (
    <form className="subpanel" onSubmit={handleSubmit}>
      <h2>Document history cleanup</h2>
      <p className="muted">
        Remove old flyer/report versions while preserving the latest versions per property.
        Start with preview mode, then run the actual cleanup.
      </p>

      <div className="form-grid">
        <label>
          Target
          <select
            value={form.target}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                target: event.target.value,
              }))
            }
          >
            <option value="both">Flyers + reports</option>
            <option value="flyer">Flyers only</option>
            <option value="report">Reports only</option>
          </select>
        </label>
        <label>
          Keep latest per property
          <input
            type="number"
            min={1}
            max={10}
            value={form.keepLatest}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                keepLatest: event.target.value,
              }))
            }
          />
        </label>
      </div>

      <div className="form-grid">
        <label>
          Delete versions older than (days)
          <input
            type="number"
            min={1}
            max={3650}
            value={form.olderThanDays}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                olderThanDays: event.target.value,
              }))
            }
          />
        </label>
        <label className="check-row" style={{ justifyContent: 'flex-end' }}>
          <input
            type="checkbox"
            checked={form.dryRun}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                dryRun: event.target.checked,
              }))
            }
          />
          Preview only (dry run)
        </label>
      </div>

      {error ? <div className="notice error">{error}</div> : null}
      {status ? <div className="notice">{status}</div> : null}

      {result ? (
        <div className="mini-admin-stats">
          <div>
            <strong>{totals.scanned || 0}</strong>
            <span>scanned</span>
          </div>
          <div>
            <strong>{totals.eligible || 0}</strong>
            <span>eligible</span>
          </div>
          <div>
            <strong>{totals.deleted || 0}</strong>
            <span>deleted</span>
          </div>
          <div>
            <strong>{result.cutoffDate ? result.cutoffDate.slice(0, 10) : 'n/a'}</strong>
            <span>cutoff date</span>
          </div>
        </div>
      ) : null}

      <button type="submit" className="admin-button" disabled={isPending}>
        {isPending
          ? form.dryRun
            ? 'Previewing...'
            : 'Cleaning...'
          : form.dryRun
            ? 'Preview cleanup'
            : 'Run cleanup'}
      </button>
    </form>
  );
}
