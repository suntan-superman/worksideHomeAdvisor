'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@workside/utils';

import { AppFrame } from '../../components/AppFrame';
import { Toast } from '../../components/Toast';
import {
  analyzePricing,
  archiveProperty as archivePropertyRequest,
  createBillingCheckoutSession,
  createProperty,
  getBillingPlans,
  getBillingSummary,
  getDashboard,
  restoreProperty as restorePropertyRequest,
  syncBillingSession,
  listProperties,
} from '../../lib/api';
import { getStoredSession, setStoredSession } from '../../lib/session';

function formatAudienceLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getAllowedBillingAudiences(user) {
  const audiences = [];
  const role = user?.role || 'seller';

  if (role === 'agent') {
    audiences.push('agent');
  } else {
    audiences.push('seller');
  }

  if (user?.isDemoAccount) {
    audiences.push('demo');
  }

  return audiences;
}

function getPreferredPlanOrder(user) {
  if (user?.isDemoAccount) {
    return ['sample_monthly', 'sample_onboarding'];
  }

  if (user?.role === 'agent') {
    return ['agent_starter', 'agent_pro', 'agent_team'];
  }

  return ['seller_pro', 'seller_unlock'];
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(null);
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [billingPlans, setBillingPlans] = useState([]);
  const [selectedPlanKey, setSelectedPlanKey] = useState('sample_monthly');
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState('');
  const [toast, setToast] = useState(null);
  const [billingFlowState, setBillingFlowState] = useState('');
  const [billingSessionId, setBillingSessionId] = useState('');
  const [createForm, setCreateForm] = useState({
    title: '',
    addressLine1: '',
    city: '',
    state: '',
    zip: '',
    propertyType: 'single_family',
    bedrooms: 4,
    bathrooms: 3,
    squareFeet: 2460,
  });

  const configuredPlans = useMemo(() => {
    const allowedAudiences = getAllowedBillingAudiences(session?.user || null);
    return (billingPlans || []).filter(
      (plan) => plan.configured && allowedAudiences.includes(plan.audience),
    );
  }, [billingPlans, session?.user]);

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) || null,
    [properties, selectedPropertyId],
  );
  const activeProperties = useMemo(
    () => properties.filter((property) => property.status !== 'archived'),
    [properties],
  );
  const archivedProperties = useMemo(
    () => properties.filter((property) => property.status === 'archived'),
    [properties],
  );

  const selectedBillingPlan = useMemo(
    () =>
      configuredPlans.find((plan) => plan.planKey === selectedPlanKey) ||
      configuredPlans[0] ||
      null,
    [configuredPlans, selectedPlanKey],
  );

  useEffect(() => {
    const stored = getStoredSession();
    setSession(stored);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setBillingFlowState(params.get('billing') || '');
    setBillingSessionId(params.get('session_id') || '');
  }, []);

  useEffect(() => {
    if (!billingFlowState) {
      return;
    }

    if (billingFlowState === 'success') {
      setToast({
        tone: 'success',
        title: 'Billing completed',
        message: 'Stripe returned successfully. Refresh billing to confirm the latest access state.',
      });
    } else if (billingFlowState === 'cancelled') {
      setToast({
        tone: 'info',
        title: 'Checkout cancelled',
        message: 'No changes were made to the current plan.',
      });
    }
  }, [billingFlowState]);

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    async function loadProperties() {
      setLoading(true);
      setToast(null);

      try {
        const response = await listProperties(session.user.id);
        setProperties(response.properties || []);

        const preferredPropertyId =
          session.lastPropertyId ||
          response.properties?.[0]?.id ||
          '';

        setSelectedPropertyId(preferredPropertyId);
      } catch (requestError) {
        setToast({
          tone: 'error',
          title: 'Could not load properties',
          message: requestError.message,
        });
      } finally {
        setLoading(false);
      }
    }

    loadProperties();
  }, [session]);

  const billingPlansQuery = useQuery({
    queryKey: ['billing-plans'],
    queryFn: async () => {
      const planResponse = await getBillingPlans();
      return planResponse.plans || [];
    },
    staleTime: 60_000,
  });

  const billingSummaryQuery = useQuery({
    queryKey: ['billing-summary', session?.user?.id || ''],
    enabled: Boolean(session?.user?.id),
    queryFn: async () => getBillingSummary(session.user.id),
    staleTime: 5_000,
    refetchInterval: (query) => {
      const accessStatus = query.state.data?.access?.status || '';
      if (billingFlowState === 'success') {
        return 5_000;
      }
      if (['checkout_created', 'open', 'incomplete', 'unpaid'].includes(accessStatus)) {
        return 5_000;
      }
      return 20_000;
    },
  });

  const billingSummary = billingSummaryQuery.data || null;
  const propertyCapacity = billingSummary?.propertyCapacity || null;
  const selectedPropertyArchived = selectedProperty?.status === 'archived';

  useEffect(() => {
    if (billingPlansQuery.isSuccess) {
      const plans = billingPlansQuery.data || [];
      setBillingPlans(plans);
      const allowedAudiences = getAllowedBillingAudiences(session?.user || null);
      const filteredPlans = plans.filter(
        (plan) => plan.configured && allowedAudiences.includes(plan.audience),
      );
      const preferredOrder = getPreferredPlanOrder(session?.user || null);

      const preferredPlan =
        preferredOrder.find((planKey) =>
          filteredPlans.some((plan) => plan.planKey === planKey),
        ) ||
        filteredPlans[0]?.planKey ||
        '';

      if (preferredPlan) {
        setSelectedPlanKey((current) => {
          const currentStillValid = filteredPlans.some((plan) => plan.planKey === current);
          return currentStillValid ? current : preferredPlan;
        });
      } else {
        setSelectedPlanKey('');
      }
    }
  }, [billingPlansQuery.data, billingPlansQuery.isSuccess, session?.user]);

  useEffect(() => {
    if (!billingPlansQuery.error) {
      return;
    }

    setToast({
      tone: 'error',
      title: 'Could not load billing plans',
      message: billingPlansQuery.error.message,
    });
  }, [billingPlansQuery.error]);

  useEffect(() => {
    if (!billingSummaryQuery.error) {
      return;
    }

    setToast({
      tone: 'error',
      title: 'Could not load billing summary',
      message: billingSummaryQuery.error.message,
    });
  }, [billingSummaryQuery.error]);

  useEffect(() => {
    if (
      billingFlowState === 'success' &&
      ['active', 'trialing', 'past_due', 'paid'].includes(billingSummary?.access?.status || '')
    ) {
      setBillingFlowState('');
    }
  }, [billingFlowState, billingSummary?.access?.status]);

  useEffect(() => {
    let cancelled = false;

    async function syncReturnedCheckout() {
      if (!session?.user?.id || billingFlowState !== 'success' || !billingSessionId) {
        return;
      }

      try {
        await syncBillingSession(billingSessionId);
        if (cancelled) {
          return;
        }

        await queryClient.invalidateQueries({ queryKey: ['billing-summary', session.user.id] });
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', '/dashboard?billing=success');
        }
        setBillingSessionId('');
      } catch (requestError) {
        if (!cancelled) {
          setToast({
            tone: 'error',
            title: 'Billing sync is still pending',
            message: requestError.message,
          });
        }
      }
    }

    syncReturnedCheckout();

    return () => {
      cancelled = true;
    };
  }, [billingFlowState, billingSessionId, queryClient, session?.user?.id]);

  useEffect(() => {
    if (!selectedPropertyId) {
      setDashboard(null);
      return;
    }

    async function loadDashboard() {
      setActionState('Loading property dashboard...');
      setToast(null);

      try {
        const response = await getDashboard(selectedPropertyId);
        setDashboard(response);
        setStoredSession({
          ...(getStoredSession() || session || {}),
          lastPropertyId: selectedPropertyId,
        });
      } catch (requestError) {
        setToast({
          tone: 'error',
          title: 'Dashboard unavailable',
          message: requestError.message,
        });
      } finally {
        setActionState('');
      }
    }

    loadDashboard();
  }, [selectedPropertyId]);

  async function handleCreateProperty(event) {
    event.preventDefault();
    if (!session?.user?.id) {
      return;
    }
    setActionState('Creating property workspace...');
    setToast(null);

    try {
      const response = await createProperty(createForm, session.user.id);
      const nextProperties = [response.property, ...properties];
      setProperties(nextProperties);
      setSelectedPropertyId(response.property.id);
      setCreateForm((current) => ({
        ...current,
        title: '',
        addressLine1: '',
      }));
      setToast({
        tone: 'success',
        title: 'Property created',
        message: `${response.property.title} is ready for pricing and photo review.`,
      });
      await queryClient.invalidateQueries({ queryKey: ['billing-summary', session.user.id] });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not create property',
        message: requestError.message,
      });
    } finally {
      setActionState('');
    }
  }

  async function handleArchiveSelectedProperty() {
    if (!selectedPropertyId || !session?.user?.id) {
      return;
    }

    setActionState('Archiving property...');
    setToast(null);

    try {
      const response = await archivePropertyRequest(selectedPropertyId, session.user.id);
      setProperties((current) =>
        current.map((property) =>
          property.id === selectedPropertyId ? response.property : property,
        ),
      );
      setDashboard((current) =>
        current ? { ...current, property: response.property } : current,
      );
      await queryClient.invalidateQueries({ queryKey: ['billing-summary', session.user.id] });
      setToast({
        tone: 'success',
        title: 'Property archived',
        message: 'This workspace is now read-only and no longer counts toward your active-property limit.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not archive property',
        message: requestError.message,
      });
    } finally {
      setActionState('');
    }
  }

  async function handleRestoreSelectedProperty() {
    if (!selectedPropertyId || !session?.user?.id) {
      return;
    }

    setActionState('Restoring property...');
    setToast(null);

    try {
      const response = await restorePropertyRequest(selectedPropertyId, session.user.id);
      setProperties((current) =>
        current.map((property) =>
          property.id === selectedPropertyId ? response.property : property,
        ),
      );
      setDashboard((current) =>
        current ? { ...current, property: response.property } : current,
      );
      await queryClient.invalidateQueries({ queryKey: ['billing-summary', session.user.id] });
      setToast({
        tone: 'success',
        title: 'Property restored',
        message: 'This workspace is active again and can be edited normally.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not restore property',
        message: requestError.message,
      });
    } finally {
      setActionState('');
    }
  }

  async function handleAnalyzePricing() {
    if (!selectedPropertyId) {
      return;
    }

    setActionState('Running RentCast + AI pricing analysis...');
    setToast(null);

    try {
      await analyzePricing(selectedPropertyId);
      const response = await getDashboard(selectedPropertyId);
      setDashboard(response);
      setToast({
        tone: 'success',
        title: 'Pricing refreshed',
        message: 'The latest RentCast and AI pricing snapshot is ready.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Pricing refresh failed',
        message: requestError.message,
      });
    } finally {
      setActionState('');
    }
  }

  async function handleStartCheckout() {
    if (!session?.user?.id || !selectedBillingPlan) {
      return;
    }

    setActionState(`Starting ${selectedBillingPlan.displayName} checkout...`);
    setToast(null);

    try {
      const response = await createBillingCheckoutSession(
        {
          userId: session.user.id,
          planKey: selectedBillingPlan.planKey,
        },
        session.user.id,
      );

      if (!response.url) {
        throw new Error('Stripe did not return a checkout URL.');
      }

      window.location.href = response.url;
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not start checkout',
        message: requestError.message,
      });
      setActionState('');
    }
  }

  return (
    <AppFrame busy={Boolean(actionState)}>
      <Toast
        tone={toast?.tone}
        title={toast?.title}
        message={toast?.message}
        onClose={() => setToast(null)}
      />
      <section className="dashboard-header">
        <div>
          <span className="label">Seller dashboard</span>
          <h1>{dashboard?.property?.title || selectedProperty?.title || 'Your property workspace'}</h1>
          <p>
            Live data now comes from MongoDB, RentCast, and OpenAI. Use this
            page to create properties and run fresh pricing analyses.
          </p>
        </div>
        <div className="score-badge">
          {dashboard?.property?.readinessScore ?? selectedProperty?.readinessScore ?? 0}% ready
        </div>
      </section>

      {!session?.user ? (
        <section className="content-card">
          <h2>Sign in to load your live seller workspace.</h2>
          <p>
            The dashboard needs a verified account first so it can request your
            properties from the API.
          </p>
          <Link href="/auth" className="button-primary inline-button">
            Go to auth
          </Link>
        </section>
      ) : (
        <>
          <section className="dashboard-grid">
            <article className="feature-card">
              <span className="label">Signed in as</span>
              <h3>{session.user.email}</h3>
              <p>Verified seller session stored in this browser.</p>
            </article>

            <article className="feature-card">
              <span className="label">Property selector</span>
              <select
                className="select-input"
                value={selectedPropertyId}
                onChange={(event) => setSelectedPropertyId(event.target.value)}
              >
                <option value="">Choose a property</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.title} · {property.city}, {property.state}
                    {property.status === 'archived' ? ' [Archived]' : ''}
                  </option>
                ))}
              </select>
              <p>
                {loading
                  ? 'Loading properties...'
                  : `${activeProperties.length} active · ${archivedProperties.length} archived workspace(s).`}
              </p>
              {propertyCapacity ? (
                <p>
                  {propertyCapacity.activeLimit === null
                    ? `${propertyCapacity.activeCount} active property workspace(s).`
                    : `${propertyCapacity.activeCount} of ${propertyCapacity.activeLimit} active property slot(s) in use.`}
                </p>
              ) : null}
              {selectedProperty ? (
                <div className="button-stack">
                  <span className="billing-pill">
                    {selectedPropertyArchived ? 'Archived · read-only' : 'Active · editable'}
                  </span>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={
                      selectedPropertyArchived
                        ? handleRestoreSelectedProperty
                        : handleArchiveSelectedProperty
                    }
                    disabled={Boolean(actionState)}
                  >
                    {selectedPropertyArchived ? 'Restore property' : 'Archive property'}
                  </button>
                </div>
              ) : null}
            </article>

            <article className="feature-card">
              <span className="label">Live actions</span>
              <div className="button-stack">
                <button
                  type="button"
                  className={
                    actionState.includes('pricing') ? 'button-primary button-busy' : 'button-primary'
                  }
                  onClick={handleAnalyzePricing}
                  disabled={!selectedPropertyId || selectedPropertyArchived || Boolean(actionState)}
                >
                  {actionState.includes('pricing') ? 'Running analysis...' : 'Run pricing analysis'}
                </button>
                {selectedPropertyId ? (
                  <Link className="button-secondary inline-button" href={`/properties/${selectedPropertyId}`}>
                    Open property workspace
                  </Link>
                ) : null}
              </div>
            </article>
          </section>

          <section className="dashboard-grid">
            <article className="feature-card">
              <span className="label">Billing access</span>
              <h3>
                {billingSummary?.access?.planKey === 'free'
                  ? 'Free access'
                  : billingSummary?.access?.planKey === 'admin_bypass'
                    ? 'Admin access'
                    : billingSummary?.access?.planKey === 'demo_bypass'
                      ? 'Demo access'
                    : billingSummary?.subscription?.planKey || 'No active plan'}
              </h3>
              <p>
                {billingSummary?.access?.status
                  ? `Current status: ${billingSummary.access.status}.`
                  : 'Load a session to see the current billing state.'}
              </p>
              {propertyCapacity ? (
                <p>
                  {propertyCapacity.activeLimit === null
                    ? `Active properties: ${propertyCapacity.activeCount}.`
                    : `${propertyCapacity.remainingActiveSlots} active slot(s) remaining out of ${propertyCapacity.activeLimit}.`}
                </p>
              ) : null}
              <div className="tag-row">
                {(billingSummary?.access?.features || []).slice(0, 4).map((feature) => (
                  <span key={feature}>{feature}</span>
                ))}
              </div>
            </article>

            <article className="feature-card">
              <span className="label">Stripe checkout</span>
              <select
                className="select-input"
                value={selectedBillingPlan?.planKey || ''}
                onChange={(event) => setSelectedPlanKey(event.target.value)}
              >
                <option value="">Choose a plan</option>
                {configuredPlans.map((plan) => (
                  <option key={plan.planKey} value={plan.planKey}>
                    {plan.displayName}
                  </option>
                ))}
              </select>
              <p>
                {selectedBillingPlan?.description ||
                  'Pick a configured plan to launch Stripe Checkout.'}
              </p>
              {selectedBillingPlan ? (
                <div className="billing-plan-meta">
                  <span className="billing-pill">
                    {selectedBillingPlan.mode === 'subscription' ? 'Recurring plan' : 'One-time fee'}
                  </span>
                  <span className="billing-pill">{formatAudienceLabel(selectedBillingPlan.audience)}</span>
                  <span className="billing-pill">{selectedBillingPlan.priceLabel || selectedBillingPlan.planKey}</span>
                </div>
              ) : null}
              <div className="button-stack">
                <button
                  type="button"
                  className="button-primary"
                  onClick={handleStartCheckout}
                  disabled={!session?.user?.id || !selectedBillingPlan || Boolean(actionState)}
                >
                  Start Stripe checkout
                </button>
              </div>
            </article>

            <article className="feature-card">
              <span className="label">Demo billing notes</span>
              <h3>Live-flow testing</h3>
              <p>
                Use the sample onboarding or sample monthly plans for low-cost live demos. Admin
                accounts bypass billing, while demo accounts can complete the full Stripe flow.
              </p>
            </article>
          </section>

          {actionState ? <p className="status-copy">{actionState}</p> : null}

          <section className="content-grid dashboard-content-grid">
            <form className="form-card" onSubmit={handleCreateProperty}>
              <span className="label">Create property</span>
              {propertyCapacity && !propertyCapacity.canCreateActiveProperty ? (
                <div className="signup-decision-card signup-decision-card-warning">
                  <strong>Active-property limit reached</strong>
                  <p>
                    Archive an existing property or upgrade the current plan before creating another active workspace.
                  </p>
                </div>
              ) : null}
              <label>
                Title
                <input
                  type="text"
                  placeholder="1234 Ridgeview Lane"
                  value={createForm.title}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </label>
              <label>
                Address
                <input
                  type="text"
                  placeholder="1234 Ridgeview Lane"
                  value={createForm.addressLine1}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, addressLine1: event.target.value }))
                  }
                />
              </label>
              <label>
                City
                <input
                  type="text"
                  placeholder="Sacramento"
                  value={createForm.city}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, city: event.target.value }))
                  }
                />
              </label>
              <div className="split-fields">
                <label>
                  State
                  <input
                    type="text"
                    placeholder="CA"
                    value={createForm.state}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, state: event.target.value }))
                    }
                  />
                </label>
                <label>
                  ZIP
                  <input
                    type="text"
                    placeholder="95829"
                    value={createForm.zip}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, zip: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="split-fields">
                <label>
                  Beds
                  <input
                    type="number"
                    value={createForm.bedrooms}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        bedrooms: Number(event.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Baths
                  <input
                    type="number"
                    step="0.5"
                    value={createForm.bathrooms}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        bathrooms: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              </div>
              <label>
                Square feet
                <input
                  type="number"
                  value={createForm.squareFeet}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      squareFeet: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <button
                type="submit"
                className="button-primary"
                disabled={Boolean(actionState) || (propertyCapacity ? !propertyCapacity.canCreateActiveProperty : false)}
              >
                Create property
              </button>
            </form>

            <div className="content-card">
              <span className="label">Live dashboard snapshot</span>
              {selectedPropertyArchived ? (
                <div className="signup-decision-card signup-decision-card-warning">
                  <strong>Archived property</strong>
                  <p>
                    This workspace stays viewable, but new pricing runs and edits are blocked until it is restored.
                  </p>
                </div>
              ) : null}
              {dashboard?.pricing ? (
                <>
                  <h2>{dashboard.property.title}</h2>
                  <p>{dashboard.pricingSummary || 'Pricing analysis is available for this property.'}</p>
                  <div className="mini-stats">
                    <div className="stat-card">
                      <strong>Price band</strong>
                      <span>
                        {formatCurrency(dashboard.pricing.low)} to{' '}
                        {formatCurrency(dashboard.pricing.high)}
                      </span>
                    </div>
                    <div className="stat-card">
                      <strong>Confidence</strong>
                      <span>{Math.round((dashboard.pricing.confidence || 0) * 100)}%</span>
                    </div>
                    <div className="stat-card">
                      <strong>Comp count</strong>
                      <span>{dashboard.comps?.length || 0} selected comps</span>
                    </div>
                    <div className="stat-card">
                      <strong>Checklist</strong>
                      <span>
                        {dashboard.checklist?.summary?.progressPercent ?? 0}% ready
                      </span>
                    </div>
                  </div>
                  <p>
                    {dashboard.checklist?.nextTask?.title
                      ? `Next recommended task: ${dashboard.checklist.nextTask.title}`
                      : 'No open checklist tasks right now.'}
                  </p>
                  <ul className="plain-list">
                    {(dashboard.improvements || []).map((item) => (
                      <li key={item.title || item}>{item.title || item}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>
                  Create or select a property, then run pricing analysis to load
                  the live seller dashboard.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </AppFrame>
  );
}
