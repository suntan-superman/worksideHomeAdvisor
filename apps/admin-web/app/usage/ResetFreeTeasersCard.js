'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const DEFAULT_FORM = {
  userEmail: '',
  userId: '',
  scope: 'current_cycle',
  resetFlyer: true,
  resetReport: true,
};

export function ResetFreeTeasersCard() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    setResult(null);

    const trimmedEmail = form.userEmail.trim();
    const trimmedUserId = form.userId.trim();

    if (!trimmedEmail && !trimmedUserId) {
      setError('Provide a user email or user ID.');
      return;
    }

    if (!form.resetFlyer && !form.resetReport) {
      setError('Select at least one counter to reset.');
      return;
    }

    const payload = {
      scope: form.scope,
      resetFlyer: Boolean(form.resetFlyer),
      resetReport: Boolean(form.resetReport),
      ...(trimmedEmail ? { userEmail: trimmedEmail } : {}),
      ...(!trimmedEmail && trimmedUserId ? { userId: trimmedUserId } : {}),
    };

    setStatus('Resetting free teaser counters...');

    try {
      const response = await fetch('/api/admin/usage/reset-free-teasers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.message || 'Free teaser reset failed.');
      }

      setResult(body);
      setStatus('Free teaser counters reset.');
      startTransition(() => {
        router.refresh();
      });
    } catch (requestError) {
      setError(requestError.message);
      setStatus('');
    }
  }

  return (
    <form className="subpanel" onSubmit={handleSubmit}>
      <h2>Reset free teaser counters</h2>
      <p className="muted">
        Reset one or both teaser counters for a seller. Use this to unblock testing for free-plan
        brochure/report limits.
      </p>

      <div className="form-grid">
        <label>
          User email
          <input
            type="email"
            placeholder="seller@example.com"
            value={form.userEmail}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                userEmail: event.target.value,
              }))
            }
          />
        </label>
        <label>
          User ID (optional)
          <input
            type="text"
            placeholder="Mongo user id"
            value={form.userId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                userId: event.target.value,
              }))
            }
          />
        </label>
      </div>

      <div className="form-grid">
        <label>
          Scope
          <select
            value={form.scope}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                scope: event.target.value,
              }))
            }
          >
            <option value="current_cycle">Current billing cycle only</option>
            <option value="all_cycles">All billing cycles for user</option>
          </select>
        </label>
        <div className="check-row">
          <label>
            <input
              type="checkbox"
              checked={form.resetFlyer}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  resetFlyer: event.target.checked,
                }))
              }
            />
            Reset brochure teaser
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.resetReport}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  resetReport: event.target.checked,
                }))
              }
            />
            Reset report teaser
          </label>
        </div>
      </div>

      {error ? <div className="notice error">{error}</div> : null}
      {status ? <div className="notice">{status}</div> : null}

      {result ? (
        <div className="mini-admin-stats">
          <div>
            <strong>{result.modifiedRecords || 0}</strong>
            <span>records modified</span>
          </div>
          <div>
            <strong>{result.matchedRecords || 0}</strong>
            <span>records matched</span>
          </div>
          <div>
            <strong>{result.targetUser?.email || 'unknown'}</strong>
            <span>target user</span>
          </div>
          <div>
            <strong>{result.billingCycleKey || 'all cycles'}</strong>
            <span>scope key</span>
          </div>
        </div>
      ) : null}

      <button type="submit" className="admin-button" disabled={isPending}>
        {isPending ? 'Resetting...' : 'Reset selected teaser counters'}
      </button>
    </form>
  );
}
