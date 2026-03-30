'use client';

import { useState } from 'react';

function formatLabel(value) {
  return String(value || '—').replace(/_/g, ' ');
}

export function ProviderRoster({ providers = [], onUpdated }) {
  const [busyProviderId, setBusyProviderId] = useState('');
  const [error, setError] = useState('');

  async function applyReview(providerId, payload) {
    setBusyProviderId(providerId);
    setError('');

    try {
      const response = await fetch(`/api/admin/providers/${providerId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || 'Provider update failed.');
      }

      if (onUpdated) {
        await onUpdated();
      } else {
        window.location.reload();
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyProviderId('');
    }
  }

  if (!providers.length) {
    return <div className="empty-state">No providers have been created yet.</div>;
  }

  return (
    <div className="provider-roster-grid">
      {error ? <div className="notice error">{error}</div> : null}
      {providers.map((provider) => (
        <article key={provider.id} className="lead-card">
          <div className="lead-card-header">
            <div>
              <div className="muted small-label">{provider.categoryLabel || provider.categoryKey}</div>
              <h2>{provider.businessName}</h2>
              <p className="muted">
                {[provider.serviceArea?.city, provider.serviceArea?.state].filter(Boolean).join(', ') ||
                  'Coverage not set'}
              </p>
            </div>
            <div className="lead-status-stack">
              <span className="status-badge status-neutral">
                {formatLabel(provider.compliance?.approvalStatus)}
              </span>
              <span className="muted small-label">{formatLabel(provider.status)}</span>
            </div>
          </div>

          <div className="tag-row">
            {(provider.serviceHighlights || []).map((item) => (
              <span key={`${provider.id}-${item}`}>{item}</span>
            ))}
          </div>

          <div className="lead-meta-grid">
            <div>
              <strong>Verification</strong>
              <span>{provider.isVerified ? 'Verified' : 'Not verified'}</span>
            </div>
            <div>
              <strong>License</strong>
              <span>{formatLabel(provider.compliance?.licenseStatus)}</span>
            </div>
            <div>
              <strong>Insurance</strong>
              <span>{formatLabel(provider.compliance?.insuranceStatus)}</span>
            </div>
            <div>
              <strong>Turnaround</strong>
              <span>{provider.turnaroundLabel || 'Not set'}</span>
            </div>
          </div>

          <div className="lead-message-block">
            <strong>Pricing summary</strong>
            <p>{provider.pricingSummary || 'No pricing summary provided yet.'}</p>
          </div>

          <div className="lead-action-row">
            <button
              type="button"
              className="admin-button"
              disabled={busyProviderId === provider.id}
              onClick={() =>
                applyReview(provider.id, {
                  approvalStatus: 'approved',
                  status: 'active',
                  isVerified: true,
                  reviewedBy: 'admin_console',
                })
              }
            >
              {busyProviderId === provider.id ? 'Saving...' : 'Approve'}
            </button>
            <button
              type="button"
              className="admin-button admin-button-secondary"
              disabled={busyProviderId === provider.id}
              onClick={() =>
                applyReview(provider.id, {
                  approvalStatus: 'review',
                  reviewedBy: 'admin_console',
                })
              }
            >
              Send to review
            </button>
            <button
              type="button"
              className="admin-button admin-button-secondary"
              disabled={busyProviderId === provider.id}
              onClick={() =>
                applyReview(provider.id, {
                  status: 'paused',
                  reviewedBy: 'admin_console',
                })
              }
            >
              Pause
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
