'use client';

import { useState } from 'react';

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function formatResolutionLabel(status) {
  if (!status) return '—';
  return status.replace(/_/g, ' ');
}

export function ProviderLeadOperations({ leads = [], onUpdated }) {
  const [busyLeadId, setBusyLeadId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function postAction(path, body, successMessage) {
    setError('');
    setNotice('');

    const response = await fetch(path, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || 'Request failed.');
    }

    setNotice(successMessage);
    if (onUpdated) {
      await onUpdated();
    } else {
      window.location.reload();
    }
  }

  async function handleResend(leadId) {
    setBusyLeadId(leadId);
    try {
      await postAction(
        `/api/admin/provider-leads/${leadId}/resend`,
        undefined,
        'Lead outreach resent. Refreshing snapshot...',
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyLeadId('');
    }
  }

  async function handleClose(leadId, resolution) {
    setBusyLeadId(`${leadId}:${resolution}`);
    try {
      await postAction(
        `/api/admin/provider-leads/${leadId}/close`,
        { resolution },
        `Lead marked ${resolution}. Refreshing snapshot...`,
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyLeadId('');
    }
  }

  if (!leads.length) {
    return <div className="empty-state">No provider leads have been created yet.</div>;
  }

  return (
    <div className="lead-operations-grid">
      {error ? <div className="notice error">{error}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}

      {leads.map((lead) => (
        <article key={lead.id} className="lead-card">
          <div className="lead-card-header">
            <div>
              <div className="muted small-label">Lead request</div>
              <h2>{lead.categoryKey.replace(/_/g, ' ')}</h2>
              <p className="muted">
                {lead.propertyAddress || 'Property snapshot unavailable'}
              </p>
            </div>
            <div className="lead-status-stack">
              <span className="status-badge status-neutral">{formatResolutionLabel(lead.status)}</span>
              <span className="muted small-label">{formatDateTime(lead.createdAt)}</span>
            </div>
          </div>

          <div className="mini-admin-stats lead-mini-stats">
            <div>
              <strong>{lead.contacted}</strong>
              <span>Contacted</span>
            </div>
            <div>
              <strong>{lead.accepted}</strong>
              <span>Accepted</span>
            </div>
            <div>
              <strong>{lead.declined}</strong>
              <span>Declined</span>
            </div>
            <div>
              <strong>{lead.failed}</strong>
              <span>Failed</span>
            </div>
          </div>

          <div className="lead-meta-grid">
            <div>
              <strong>Source</strong>
              <span>{lead.source}</span>
            </div>
            <div>
              <strong>Requested by</strong>
              <span>{lead.requestedByRole}</span>
            </div>
            <div>
              <strong>Max providers</strong>
              <span>{lead.maxProviders || '—'}</span>
            </div>
            <div>
              <strong>Last updated</strong>
              <span>{formatDateTime(lead.updatedAt)}</span>
            </div>
          </div>

          {lead.message ? (
            <div className="lead-message-block">
              <strong>Lead message</strong>
              <p>{lead.message}</p>
            </div>
          ) : null}

          <div className="lead-action-row">
            <button
              type="button"
              className="admin-button"
              disabled={Boolean(busyLeadId)}
              onClick={() => handleResend(lead.id)}
            >
              {busyLeadId === lead.id ? 'Resending...' : 'Resend outreach'}
            </button>
            <button
              type="button"
              className="admin-button admin-button-secondary"
              disabled={Boolean(busyLeadId)}
              onClick={() => handleClose(lead.id, 'completed')}
            >
              {busyLeadId === `${lead.id}:completed` ? 'Closing...' : 'Mark completed'}
            </button>
            <button
              type="button"
              className="admin-button admin-button-secondary"
              disabled={Boolean(busyLeadId)}
              onClick={() => handleClose(lead.id, 'cancelled')}
            >
              {busyLeadId === `${lead.id}:cancelled` ? 'Closing...' : 'Cancel lead'}
            </button>
          </div>

          <div className="lead-detail-columns">
            <section className="lead-detail-panel">
              <h3>Dispatches</h3>
              {lead.dispatches?.length ? (
                <div className="stack-list">
                  {lead.dispatches.map((dispatch) => (
                    <div key={dispatch.id} className="detail-row-card">
                      <div className="stack-row">
                        <strong>{dispatch.providerName}</strong>
                        <span className="status-badge status-neutral">
                          {formatResolutionLabel(dispatch.status)}
                        </span>
                      </div>
                      <div className="detail-row-meta">
                        <span>{dispatch.deliveryMode}</span>
                        <span>{dispatch.responseStatus ? formatResolutionLabel(dispatch.responseStatus) : 'No reply yet'}</span>
                        <span>{dispatch.smsError || formatDateTime(dispatch.smsSentAt || dispatch.sentAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-inline">No dispatches yet.</div>
              )}
            </section>

            <section className="lead-detail-panel">
              <h3>Responses</h3>
              {lead.responses?.length ? (
                <div className="stack-list">
                  {lead.responses.map((response) => (
                    <div key={response.id} className="detail-row-card">
                      <div className="stack-row">
                        <strong>{response.providerName}</strong>
                        <span className="status-badge status-neutral">
                          {formatResolutionLabel(response.responseStatus)}
                        </span>
                      </div>
                      <div className="detail-row-meta">
                        <span>{response.note || 'No note'}</span>
                        <span>{formatDateTime(response.createdAt)}</span>
                      </div>
                      {response.rawBody ? <p className="detail-row-body">{response.rawBody}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-inline">No provider responses yet.</div>
              )}
            </section>
          </div>

          <section className="lead-detail-panel">
            <h3>Recent SMS Activity</h3>
            {lead.smsLogs?.length ? (
              <div className="stack-list">
                {lead.smsLogs.map((log) => (
                  <div key={log.id} className="detail-row-card">
                    <div className="stack-row">
                      <strong>{log.providerName}</strong>
                      <span className="status-badge status-neutral">
                        {`${log.direction} · ${formatResolutionLabel(log.messageType)}`}
                      </span>
                    </div>
                    <div className="detail-row-meta">
                      <span>{log.deliveryStatus || log.parseStatus || 'logged'}</span>
                      <span>{formatDateTime(log.createdAt)}</span>
                    </div>
                    <p className="detail-row-body">{log.body || 'No body captured.'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-inline">No SMS activity logged for this lead yet.</div>
            )}
          </section>
        </article>
      ))}
    </div>
  );
}
