import { BRANDING } from '@workside/branding';

import { AdminSection } from './_components/AdminSection';
import { MetricCard } from './_components/MetricCard';
import { StatusBadge } from './_components/StatusBadge';
import {
  getAdminBilling,
  getAdminFunnel,
  getAdminMediaVariants,
  getAdminOverview,
  getAdminWorkers,
} from '../lib/admin-api';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const [overview, billing, funnel, workersPayload, mediaPayload] = await Promise.all([
    getAdminOverview(),
    getAdminBilling(),
    getAdminFunnel(),
    getAdminWorkers(),
    getAdminMediaVariants(),
  ]);

  const metrics = overview.metrics || {};
  const workers = workersPayload.workers || [];
  const onlineWorkers = workers.filter((worker) => worker.status === 'online').length;
  const mediaSummary = mediaPayload.summary || {};
  const funnelSummary = funnel.summary || {};
  const roleBreakdown = funnel.roleBreakdown || [];
  const platformBreakdown = funnel.platformBreakdown || [];
  const stageBreakdown = funnel.stageBreakdown || [];
  const conversionSummary = funnel.conversionSummary || {};
  const topCampaigns = funnel.topCampaigns || [];
  const recentFunnelEvents = funnel.recentEvents || [];

  return (
    <AdminSection
      eyebrow="Internal Console"
      title={`${BRANDING.companyName} Admin`}
      description="Operational command surface for seller accounts, pricing activity, billing state, safeguard pressure, and worker health."
      actions={<StatusBadge tone="success">{overview.dataSource || 'unknown data source'}</StatusBadge>}
    >
      {overview.error ? <div className="notice error">{overview.error}</div> : null}

      <div className="card-grid">
        <MetricCard label="Total Users" value={metrics.totalUsers || 0} note={`${metrics.verifiedUsers || 0} verified`} />
        <MetricCard label="Properties" value={metrics.totalProperties || 0} note={`${metrics.mediaAssets || 0} media assets`} />
        <MetricCard label="Pricing Analyses" value={metrics.pricingAnalyses || 0} note={`${metrics.flyersGenerated || 0} flyers`} />
        <MetricCard label="Active Subscriptions" value={metrics.activeSubscriptions || 0} note={`${billing.plans?.filter((plan) => plan.configured).length || 0} configured plans`} />
        <MetricCard label="Usage Records" value={metrics.usageRecords || 0} note={`${metrics.recentRateLimitEvents || 0} recent rate-limit events`} />
        <MetricCard label="Funnel Events" value={funnelSummary.totalEvents || 0} note={`${funnelSummary.capturedEmails || 0} captured emails`} />
        <MetricCard label="Signup Starts" value={funnelSummary.signupStarts || 0} note={`${funnelSummary.signupCompleted || 0} completed`} />
        <MetricCard label="Email → Signup" value={`${conversionSummary.emailToSignupRate || 0}%`} note={`${conversionSummary.signupToPropertyRate || 0}% signup → property`} />
        <MetricCard label="Workers Online" value={`${onlineWorkers}/${workers.length || 0}`} note="Health probes from the admin API" />
        <MetricCard label="Vision Variants" value={mediaSummary.totalVariants || 0} note={`${mediaSummary.selectedPersistent || 0} persistent • ${mediaSummary.cleanupEligible || 0} cleanup eligible`} />
      </div>

      <div className="split-layout">
        <div className="subpanel">
          <h2>What this console now covers</h2>
          <ul className="bullet-list muted">
            <li>Live admin overview aggregated from MongoDB.</li>
            <li>Users and property inventory inspection.</li>
            <li>Billing plan catalog and recent subscription sync.</li>
            <li>Usage safeguards and worker health visibility.</li>
            <li>Vision variant lifecycle monitoring and cleanup controls.</li>
          </ul>
        </div>

        <div className="subpanel">
          <h2>Worker Snapshot</h2>
          <div className="stack-list">
            {workers.map((worker) => (
              <div key={worker.key} className="stack-row">
                <strong>{worker.name}</strong>
                <StatusBadge tone={worker.status === 'online' ? 'success' : 'warn'}>
                  {worker.status}
                </StatusBadge>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="split-layout">
        <div className="subpanel">
          <h2>Role Conversion</h2>
          <div className="stack-list">
            {roleBreakdown.length ? (
              roleBreakdown.map((entry) => (
                <div key={entry.role} className="stack-row">
                  <div>
                    <strong>{entry.role}</strong>
                    <div className="muted">
                      {entry.signupStarts} starts · {entry.signupCompleted} completions
                    </div>
                  </div>
                  <div className="muted">{entry.properties} properties</div>
                </div>
              ))
            ) : (
              <p className="muted">No role attribution captured yet.</p>
            )}
          </div>
        </div>

        <div className="subpanel">
          <h2>Platform Mix</h2>
          <div className="stack-list">
            {platformBreakdown.length ? (
              platformBreakdown.map((entry) => (
                <div key={entry.platform} className="stack-row">
                  <div>
                    <strong>{entry.platform}</strong>
                    <div className="muted">
                      {entry.signupStarts} starts · {entry.signupCompleted} signups
                    </div>
                  </div>
                  <div className="muted">{entry.properties} properties</div>
                </div>
              ))
            ) : (
              <p className="muted">No platform split yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="split-layout">
        <div className="subpanel">
          <h2>Top Campaigns</h2>
          <div className="stack-list">
            {topCampaigns.length ? (
              topCampaigns.map((campaign) => (
                <div key={`${campaign.platform}-${campaign.campaign}-${campaign.source}`} className="stack-row">
                  <div>
                    <strong>{campaign.campaign}</strong>
                    <div className="muted">
                      {campaign.platform} · {campaign.source} / {campaign.medium}
                    </div>
                  </div>
                  <div className="muted">
                    {campaign.events} evt · {campaign.signupStarts} starts · {campaign.signupCompleted} signup · {campaign.properties} properties
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">No funnel events captured yet.</p>
            )}
          </div>
        </div>

        <div className="subpanel">
          <h2>Recent Funnel Events</h2>
          <div className="stack-list">
            {recentFunnelEvents.length ? (
              recentFunnelEvents.map((event) => (
                <div key={event.id} className="stack-row">
                  <div>
                    <strong>{event.eventName}</strong>
                    <div className="muted">
                      {event.attribution?.campaign || 'general'} · {event.attribution?.source || 'direct'}
                    </div>
                  </div>
                  <div className="muted">
                    {event.email || event.anonymousId || 'anonymous'}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">No recent funnel activity.</p>
            )}
          </div>
        </div>
      </div>

      <div className="split-layout">
        <div className="subpanel">
          <h2>Stage Breakdown</h2>
          <div className="stack-list">
            {stageBreakdown.length ? (
              stageBreakdown.map((entry) => (
                <div key={entry.eventName} className="stack-row">
                  <strong>{entry.eventName}</strong>
                  <div className="muted">{entry.count}</div>
                </div>
              ))
            ) : (
              <p className="muted">No funnel stage counts yet.</p>
            )}
          </div>
        </div>

        <div className="subpanel">
          <h2>Conversion Summary</h2>
          <div className="stack-list">
            <div className="stack-row">
              <strong>Email captured → signup completed</strong>
              <div className="muted">{conversionSummary.emailToSignupRate || 0}%</div>
            </div>
            <div className="stack-row">
              <strong>Signup completed → property created</strong>
              <div className="muted">{conversionSummary.signupToPropertyRate || 0}%</div>
            </div>
            <div className="stack-row">
              <strong>Email captured → property created</strong>
              <div className="muted">{conversionSummary.emailToPropertyRate || 0}%</div>
            </div>
          </div>
        </div>
      </div>
    </AdminSection>
  );
}
