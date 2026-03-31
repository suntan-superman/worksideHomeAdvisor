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
              <span>{formatLabel(provider.verification?.review?.level || 'self_reported')}</span>
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

          <div className="lead-meta-grid">
            <div>
              <strong>Review status</strong>
              <span>{formatLabel(provider.verification?.review?.reviewStatus || 'none')}</span>
            </div>
            <div>
              <strong>Bonding</strong>
              <span>{provider.verification?.bonding?.hasBond ? 'Self-reported bonded' : 'Not reported'}</span>
            </div>
            <div>
              <strong>Insurance doc</strong>
              <span>{provider.verification?.insurance?.certificateDocument ? 'Uploaded' : 'Not uploaded'}</span>
            </div>
            <div>
              <strong>License doc</strong>
              <span>{provider.verification?.license?.document ? 'Uploaded' : 'Not uploaded'}</span>
            </div>
          </div>

          {(provider.verification?.insurance?.carrier ||
            provider.verification?.license?.licenseNumber ||
            provider.verification?.review?.reviewNotes) ? (
            <div className="lead-message-block">
              <strong>Verification notes</strong>
              <p>
                {provider.verification?.insurance?.carrier
                  ? `Insurance carrier: ${provider.verification.insurance.carrier}. `
                  : ''}
                {provider.verification?.license?.licenseNumber
                  ? `License number: ${provider.verification.license.licenseNumber}. `
                  : ''}
                {provider.verification?.review?.reviewNotes || 'No admin review notes yet.'}
              </p>
            </div>
          ) : null}

          {(provider.verification?.insurance?.certificateDocument || provider.verification?.license?.document) ? (
            <div className="lead-action-row">
              {provider.verification?.insurance?.certificateDocument ? (
                <a
                  className="admin-button admin-button-secondary"
                  href={`/api/admin/providers/${provider.id}/verification-documents/insurance_certificate`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View insurance doc
                </a>
              ) : null}
              {provider.verification?.license?.document ? (
                <a
                  className="admin-button admin-button-secondary"
                  href={`/api/admin/providers/${provider.id}/verification-documents/license_document`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View license doc
                </a>
              ) : null}
            </div>
          ) : null}

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
                  reviewedBy: 'admin_console',
                })
              }
            >
              {busyProviderId === provider.id ? 'Saving...' : 'Approve'}
            </button>
            <button
              type="button"
              className="admin-button"
              disabled={busyProviderId === provider.id}
              onClick={() =>
                applyReview(provider.id, {
                  reviewStatus: 'verified',
                  approvalStatus: 'approved',
                  status: 'active',
                  isVerified: true,
                  reviewedBy: 'admin_console',
                })
              }
            >
              Verify documents
            </button>
            <button
              type="button"
              className="admin-button admin-button-secondary"
              disabled={busyProviderId === provider.id}
              onClick={() =>
                applyReview(provider.id, {
                  approvalStatus: 'review',
                  reviewStatus: 'submitted',
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
                  reviewStatus: 'rejected',
                  isVerified: false,
                  reviewedBy: 'admin_console',
                })
              }
            >
              Reject verification
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
