'use client';

import { useMemo, useState } from 'react';

import { ClientDataTable } from './ClientDataTable';
import { ClientMetricCard } from './ClientMetricCard';
import { CreateProviderCard } from './CreateProviderCard';
import { ProviderLeadOperations } from './ProviderLeadOperations';
import { ProviderRoster } from './ProviderRoster';

const TAB_OPTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'create', label: 'Create' },
  { id: 'roster', label: 'Roster' },
  { id: 'lead-queue', label: 'Lead Queue' },
  { id: 'lead-ops', label: 'Lead Ops' },
];

function formatCategoryLabel(value) {
  return String(value || '—').replace(/_/g, ' ');
}

export function ProvidersTabbedWorkspace({
  providers = [],
  leadSummary = {},
  leadOpsSummary = {},
  leads = [],
  providerError = '',
  leadError = '',
}) {
  const [activeTab, setActiveTab] = useState('overview');

  const rosterPreview = useMemo(() => providers.slice(0, 6), [providers]);
  const leadPreview = useMemo(() => leads.slice(0, 6), [leads]);

  return (
    <div className="providers-workspace">
      {providerError ? <div className="notice error">{providerError}</div> : null}
      {leadError ? <div className="notice error">{leadError}</div> : null}

      <div className="card-grid compact">
        <ClientMetricCard label="Providers" value={providers.length} note="Current marketplace records" />
        <ClientMetricCard label="Open Leads" value={leadSummary.open || 0} note="No providers contacted yet" />
        <ClientMetricCard label="Routing" value={leadSummary.routing || 0} note="Queued for provider outreach" />
        <ClientMetricCard label="Matched" value={leadSummary.matched || 0} note="At least one provider engaged" />
      </div>

      <div className="card-grid compact">
        <ClientMetricCard label="Awaiting Response" value={leadOpsSummary.awaitingResponse || 0} note="Sent but not yet accepted" />
        <ClientMetricCard label="Failed Dispatches" value={leadOpsSummary.failedDispatches || 0} note="Need manual resend or review" />
        <ClientMetricCard label="Closed Leads" value={(leadOpsSummary.completed || 0) + (leadOpsSummary.cancelled || 0)} note="Completed or cancelled manually" />
      </div>

      <div className="provider-tabs-shell">
        <div className="provider-tabs" role="tablist" aria-label="Provider admin sections">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className={activeTab === tab.id ? 'provider-tab active' : 'provider-tab'}
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.id === 'roster' ? <strong>{providers.length}</strong> : null}
              {tab.id === 'lead-queue' || tab.id === 'lead-ops' ? <strong>{leads.length}</strong> : null}
            </button>
          ))}
        </div>

        <div className="provider-tab-panel">
          {activeTab === 'overview' ? (
            <div className="provider-tab-stack">
              <div className="split-layout">
                <div className="subpanel">
                  <h2>Operations focus</h2>
                  <ul className="bullet-list muted">
                    <li>Review routing state, provider responses, and SMS activity per lead.</li>
                    <li>Resend outreach for leads that stalled or had failed dispatches.</li>
                    <li>Close a lead once the provider engagement is complete or no longer needed.</li>
                  </ul>
                </div>
                <div className="subpanel">
                  <h2>What to watch</h2>
                  <ul className="bullet-list muted">
                    <li>Approve strong providers quickly so seller recommendations stay trustworthy.</li>
                    <li>Keep an eye on failed dispatches before SMS volume increases.</li>
                    <li>Use the lead-ops tab for deep review instead of scanning this whole page.</li>
                  </ul>
                </div>
              </div>

              <div className="provider-tab-preview-grid">
                <div className="subpanel">
                  <div className="stack-row">
                    <h2>Provider snapshot</h2>
                    <button type="button" className="admin-button admin-button-secondary" onClick={() => setActiveTab('roster')}>
                      Open roster
                    </button>
                  </div>
                  <ClientDataTable
                    columns={[
                      { key: 'businessName', label: 'Business' },
                      { key: 'categoryLabel', label: 'Category' },
                      {
                        key: 'status',
                        label: 'Status',
                        render: (value, row) =>
                          `${value} · ${row.compliance?.approvalStatus || 'draft'}${row.isVerified ? ' · verified' : ''}`,
                      },
                      {
                        key: 'serviceArea',
                        label: 'Coverage',
                        render: (_value, row) =>
                          [row.serviceArea?.city, row.serviceArea?.state].filter(Boolean).join(', ') ||
                          'Coverage not set',
                      },
                    ]}
                    rows={rosterPreview}
                    emptyMessage="No providers have been created yet."
                  />
                </div>

                <div className="subpanel">
                  <div className="stack-row">
                    <h2>Lead queue snapshot</h2>
                    <button type="button" className="admin-button admin-button-secondary" onClick={() => setActiveTab('lead-queue')}>
                      Open queue
                    </button>
                  </div>
                  <ClientDataTable
                    columns={[
                      { key: 'categoryKey', label: 'Category', render: (value) => formatCategoryLabel(value) },
                      { key: 'status', label: 'Lead Status' },
                      { key: 'propertyCity', label: 'City' },
                      { key: 'contacted', label: 'Contacted' },
                      { key: 'accepted', label: 'Accepted' },
                    ]}
                    rows={leadPreview}
                    emptyMessage="No provider leads have been created yet."
                  />
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'create' ? (
            <div className="split-layout">
              <CreateProviderCard />
              <div className="subpanel">
                <h2>Seeding guidance</h2>
                <ul className="bullet-list muted">
                  <li>Use manual creation for high-priority local vendors before self-serve signup scales up.</li>
                  <li>Set trust and approval fields carefully so sellers see realistic marketplace quality.</li>
                  <li>Prefer accurate coverage, turnaround, and pricing notes over placeholder marketing copy.</li>
                </ul>
              </div>
            </div>
          ) : null}

          {activeTab === 'roster' ? <ProviderRoster providers={providers} /> : null}

          {activeTab === 'lead-queue' ? (
            <ClientDataTable
              columns={[
                { key: 'categoryKey', label: 'Category', render: (value) => formatCategoryLabel(value) },
                { key: 'status', label: 'Lead Status' },
                { key: 'propertyCity', label: 'City' },
                { key: 'contacted', label: 'Contacted' },
                { key: 'accepted', label: 'Accepted' },
                { key: 'declined', label: 'Declined' },
              ]}
              rows={leads}
              emptyMessage="No provider leads have been created yet."
            />
          ) : null}

          {activeTab === 'lead-ops' ? <ProviderLeadOperations leads={leads} /> : null}
        </div>
      </div>
    </div>
  );
}
