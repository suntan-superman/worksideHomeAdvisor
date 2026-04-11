'use client';

import { useState } from 'react';

function normalizeInitialValue(value, fallback) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(numericValue));
}

export function PricingQueryPolicyCard({ initialPolicy }) {
  const [form, setForm] = useState({
    pricingCooldownHours: normalizeInitialValue(initialPolicy?.pricingCooldownHours, 24),
    maxRunsPerPropertyPerUser: normalizeInitialValue(
      initialPolicy?.maxRunsPerPropertyPerUser,
      5,
    ),
  });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('Saving pricing query criteria...');
    setError('');

    try {
      const response = await fetch('/api/admin/pricing-query-policy', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pricingCooldownHours: form.pricingCooldownHours,
          maxRunsPerPropertyPerUser: form.maxRunsPerPropertyPerUser,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Pricing query criteria could not be saved.');
      }

      const savedPolicy = payload.pricingQueryPolicy || {};
      setForm({
        pricingCooldownHours: normalizeInitialValue(savedPolicy.pricingCooldownHours, 24),
        maxRunsPerPropertyPerUser: normalizeInitialValue(
          savedPolicy.maxRunsPerPropertyPerUser,
          5,
        ),
      });
      setStatus('Pricing query criteria saved.');
    } catch (requestError) {
      setError(requestError.message);
      setStatus('');
    }
  }

  return (
    <form className="subpanel" onSubmit={handleSubmit}>
      <h2>Pricing analysis criteria</h2>
      <p className="muted">
        Control how often a property can trigger a fresh RentCast pricing run. Cached pricing
        still remains available when a fresh query is skipped.
      </p>

      <div className="form-grid">
        <label>
          Cooldown hours per property
          <input
            type="number"
            min="0"
            max="168"
            value={form.pricingCooldownHours}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                pricingCooldownHours: Number(event.target.value),
              }))
            }
          />
        </label>
        <label>
          Max fresh queries per property / user
          <input
            type="number"
            min="0"
            max="100"
            value={form.maxRunsPerPropertyPerUser}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                maxRunsPerPropertyPerUser: Number(event.target.value),
              }))
            }
          />
        </label>
      </div>

      <p className="muted">
        Set either field to <strong>0</strong> to disable that safeguard.
      </p>

      {error ? <div className="notice error">{error}</div> : null}
      {status ? <div className="notice">{status}</div> : null}

      <button type="submit" className="button-primary">
        Save pricing criteria
      </button>
    </form>
  );
}
