'use client';

import { useMemo, useState } from 'react';

function formatLabel(value) {
  return String(value || '—').replace(/_/g, ' ');
}

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

export function ProviderRoster({ providers = [], onUpdated }) {
  const [busyProviderId, setBusyProviderId] = useState('');
  const [error, setError] = useState('');
  const [pendingApprovalProvider, setPendingApprovalProvider] = useState(null);
  const [pendingDeleteProvider, setPendingDeleteProvider] = useState(null);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');

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

  function requestApproval(provider) {
    setPendingApprovalProvider(provider);
    setError('');
  }

  async function confirmApproval() {
    if (!pendingApprovalProvider) {
      return;
    }

    const providerId = pendingApprovalProvider.id;
    setPendingApprovalProvider(null);
    await applyReview(providerId, {
      approvalStatus: 'approved',
      status: 'active',
      reviewedBy: 'admin_console',
    });
  }

  async function confirmDelete() {
    if (!pendingDeleteProvider) {
      return;
    }

    const providerId = pendingDeleteProvider.id;
    setBusyProviderId(providerId);
    setError('');

    try {
      const response = await fetch(`/api/admin/providers/${providerId}`, {
        method: 'DELETE',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || 'Provider removal failed.');
      }
      setPendingDeleteProvider(null);
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

  const categoryOptions = useMemo(
    () =>
      [...new Set(providers.map((provider) => provider.categoryLabel || provider.categoryKey).filter(Boolean))].sort(
        (left, right) => left.localeCompare(right),
      ),
    [providers],
  );

  const statusOptions = useMemo(
    () =>
      [...new Set(providers.map((provider) => `${provider.status || 'unknown'}|${provider.compliance?.approvalStatus || 'draft'}`))],
    [providers],
  );

  const filteredProviders = useMemo(() => {
    const searchValue = normalizeValue(search);
    const locationValue = normalizeValue(locationFilter);

    const nextProviders = providers.filter((provider) => {
      const categoryValue = provider.categoryLabel || provider.categoryKey || '';
      const statusValue = `${provider.status || 'unknown'}|${provider.compliance?.approvalStatus || 'draft'}`;
      const locationLabel = [provider.serviceArea?.city, provider.serviceArea?.state].filter(Boolean).join(', ');
      const searchable = [
        provider.businessName,
        categoryValue,
        provider.email,
        provider.phone,
        locationLabel,
        provider.serviceArea?.zipCodes?.join(', '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (searchValue && !searchable.includes(searchValue)) {
        return false;
      }

      if (statusFilter !== 'all' && statusValue !== statusFilter) {
        return false;
      }

      if (categoryFilter !== 'all' && categoryValue !== categoryFilter) {
        return false;
      }

      if (locationValue && !`${locationLabel} ${provider.serviceArea?.zipCodes?.join(' ') || ''}`.toLowerCase().includes(locationValue)) {
        return false;
      }

      return true;
    });

    nextProviders.sort((left, right) => {
      const leftLocation = [left.serviceArea?.city, left.serviceArea?.state].filter(Boolean).join(', ');
      const rightLocation = [right.serviceArea?.city, right.serviceArea?.state].filter(Boolean).join(', ');
      const leftStatus = `${left.compliance?.approvalStatus || 'draft'} ${left.status || 'unknown'}`;
      const rightStatus = `${right.compliance?.approvalStatus || 'draft'} ${right.status || 'unknown'}`;
      const leftCategory = left.categoryLabel || left.categoryKey || '';
      const rightCategory = right.categoryLabel || right.categoryKey || '';
      const leftReadiness = Number(left.activation?.readyPercent || 0);
      const rightReadiness = Number(right.activation?.readyPercent || 0);

      if (sortBy === 'status') {
        return leftStatus.localeCompare(rightStatus) || left.businessName.localeCompare(right.businessName);
      }

      if (sortBy === 'category') {
        return leftCategory.localeCompare(rightCategory) || left.businessName.localeCompare(right.businessName);
      }

      if (sortBy === 'location') {
        return leftLocation.localeCompare(rightLocation) || left.businessName.localeCompare(right.businessName);
      }

      if (sortBy === 'readiness') {
        return rightReadiness - leftReadiness || left.businessName.localeCompare(right.businessName);
      }

      return left.businessName.localeCompare(right.businessName);
    });

    return nextProviders;
  }, [providers, search, statusFilter, categoryFilter, locationFilter, sortBy]);

  if (!providers.length) {
    return <div className="empty-state">No providers have been created yet.</div>;
  }

  return (
    <>
      <div className="provider-roster-grid">
        {error ? <div className="notice error">{error}</div> : null}
        <div className="provider-roster-toolbar">
          <div className="provider-roster-toolbar-group provider-roster-toolbar-search">
            <label>
              <span>Search</span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email, phone, category"
              />
            </label>
          </div>
          <div className="provider-roster-toolbar-group">
            <label>
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                {statusOptions.map((value) => (
                  <option key={value} value={value}>
                    {value
                      .split('|')
                      .map((part) => formatLabel(part))
                      .join(' · ')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Category</span>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All categories</option>
                {categoryOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Location</span>
              <input
                type="text"
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
                placeholder="City, state, zip"
              />
            </label>
            <label>
              <span>Sort by</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="name">Name</option>
                <option value="status">Status</option>
                <option value="category">Category</option>
                <option value="location">Location</option>
                <option value="readiness">Readiness</option>
              </select>
            </label>
          </div>
        </div>

        <div className="provider-roster-summary muted">
          Showing {filteredProviders.length} of {providers.length} provider record(s).
        </div>

        {!filteredProviders.length ? <div className="empty-state">No providers match the current filters.</div> : null}

        {filteredProviders.map((provider) => {
          const isApproved =
            provider.compliance?.approvalStatus === 'approved' && provider.status === 'active';
          const isBusy = busyProviderId === provider.id;
          const locationLabel =
            [provider.serviceArea?.city, provider.serviceArea?.state].filter(Boolean).join(', ') || 'Coverage not set';
          const activation = provider.activation || { readyPercent: 0, blockers: [], nextStep: null, live: false };

          return (
            <article key={provider.id} className="lead-card">
              <div className="lead-card-header">
                <div>
                  <div className="muted small-label">{provider.categoryLabel || provider.categoryKey}</div>
                  <h2>{provider.businessName}</h2>
                  <p className="muted">
                    {locationLabel}
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
                  <strong>Email</strong>
                  <span>{provider.email || 'Not provided'}</span>
                </div>
                <div>
                  <strong>Phone</strong>
                  <span>{provider.phone || 'Not provided'}</span>
                </div>
                <div>
                  <strong>Website</strong>
                  <span>{provider.websiteUrl || 'Not provided'}</span>
                </div>
                <div>
                  <strong>Coverage zips</strong>
                  <span>{provider.serviceArea?.zipCodes?.length ? provider.serviceArea.zipCodes.join(', ') : 'Not provided'}</span>
                </div>
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

              <div className="lead-message-block">
                <strong>Marketplace readiness</strong>
                <p>
                  {activation.live
                    ? `Live in marketplace · ${activation.readyPercent || 0}% ready across activation checks.`
                    : `${activation.readyPercent || 0}% ready · ${activation.completeCount || 0}/${activation.totalCount || 0} checks complete.`}
                </p>
                {activation.nextStep ? (
                  <p>
                    <strong>Next step:</strong> {activation.nextStep.label}. {activation.nextStep.detail}
                  </p>
                ) : null}
                {activation.blockers?.length ? (
                  <ul className="provider-activation-blockers">
                    {activation.blockers.slice(0, 3).map((blocker) => (
                      <li key={`${provider.id}-${blocker.key}`}>
                        <strong>{blocker.label}:</strong> {blocker.detail}
                      </li>
                    ))}
                  </ul>
                ) : null}
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
                  className={isApproved ? 'admin-button admin-button-success' : 'admin-button'}
                  disabled={isBusy || isApproved}
                  onClick={() => requestApproval(provider)}
                >
                  {isBusy ? 'Saving...' : isApproved ? 'Approved' : 'Approve'}
                </button>
                <button
                  type="button"
                  className="admin-button"
                  disabled={isBusy}
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
                  disabled={isBusy}
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
                  disabled={isBusy}
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
                  disabled={isBusy}
                  onClick={() =>
                    applyReview(provider.id, {
                      status: 'paused',
                      reviewedBy: 'admin_console',
                    })
                  }
                >
                  Pause
                </button>
                <button
                  type="button"
                  className="admin-button admin-button-danger"
                  disabled={isBusy}
                  onClick={() => {
                    setPendingDeleteProvider(provider);
                    setDeleteConfirmationName('');
                    setError('');
                  }}
                >
                  Remove provider
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {pendingApprovalProvider ? (
        <div className="admin-dialog-backdrop" role="presentation" onClick={() => setPendingApprovalProvider(null)}>
          <div
            className="admin-dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-provider-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="small-label">Provider approval</span>
            <h2 id="approve-provider-title">Approve {pendingApprovalProvider.businessName}?</h2>
            <p>
              This will mark the provider as approved and activate them for marketplace visibility in their category.
            </p>
            <div className="admin-dialog-meta">
              <div>
                <strong>Category</strong>
                <span>{pendingApprovalProvider.categoryLabel || pendingApprovalProvider.categoryKey}</span>
              </div>
              <div>
                <strong>Coverage</strong>
                <span>
                  {[pendingApprovalProvider.serviceArea?.city, pendingApprovalProvider.serviceArea?.state]
                    .filter(Boolean)
                    .join(', ') || 'Coverage not set'}
                </span>
              </div>
            </div>
            <div className="admin-dialog-actions">
              <button
                type="button"
                className="admin-button admin-button-secondary"
                onClick={() => setPendingApprovalProvider(null)}
              >
                Cancel
              </button>
              <button type="button" className="admin-button" onClick={confirmApproval}>
                Confirm approval
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDeleteProvider ? (
        <div
          className="admin-dialog-backdrop"
          role="presentation"
          onClick={() => {
            setPendingDeleteProvider(null);
            setDeleteConfirmationName('');
          }}
        >
          <div
            className="admin-dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-provider-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="small-label">Remove provider</span>
            <h2 id="remove-provider-title">Remove {pendingDeleteProvider.businessName}?</h2>
            <p>
              This will remove the provider record from the marketplace roster and clear related provider-specific tracking entries. This action should only be used when the record is a duplicate or should no longer exist.
            </p>
            <label className="admin-dialog-confirmation">
              <span>
                Type <strong>{pendingDeleteProvider.businessName}</strong> exactly to confirm removal.
              </span>
              <input
                type="text"
                value={deleteConfirmationName}
                onChange={(event) => setDeleteConfirmationName(event.target.value)}
                placeholder={pendingDeleteProvider.businessName}
                autoComplete="off"
              />
            </label>
            <div className="admin-dialog-meta">
              <div>
                <strong>Category</strong>
                <span>{pendingDeleteProvider.categoryLabel || pendingDeleteProvider.categoryKey}</span>
              </div>
              <div>
                <strong>Location</strong>
                <span>
                  {[pendingDeleteProvider.serviceArea?.city, pendingDeleteProvider.serviceArea?.state]
                    .filter(Boolean)
                    .join(', ') || 'Coverage not set'}
                </span>
              </div>
            </div>
            <div className="admin-dialog-actions">
              <button
                type="button"
                className="admin-button admin-button-secondary"
                onClick={() => {
                  setPendingDeleteProvider(null);
                  setDeleteConfirmationName('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-button admin-button-danger"
                disabled={deleteConfirmationName !== pendingDeleteProvider.businessName}
                onClick={confirmDelete}
              >
                Confirm removal
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
