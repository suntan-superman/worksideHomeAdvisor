'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@workside/utils';

import { AppFrame } from '../../components/AppFrame';
import { Toast } from '../../components/Toast';
import {
  analyzePricing,
  createBillingCheckoutSession,
  createProperty,
  getBillingPlans,
  getBillingSummary,
  getDashboard,
  listProperties,
} from '../../lib/api';
import { getStoredSession, setStoredSession } from '../../lib/session';

export default function DashboardPage() {
  const [session, setSession] = useState(null);
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [billingPlans, setBillingPlans] = useState([]);
  const [billingSummary, setBillingSummary] = useState(null);
  const [selectedPlanKey, setSelectedPlanKey] = useState('sample_monthly');
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState('');
  const [toast, setToast] = useState(null);
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

  const configuredPlans = useMemo(
    () => (billingPlans || []).filter((plan) => plan.configured),
    [billingPlans],
  );

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) || null,
    [properties, selectedPropertyId],
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

    const billingStatus = new URLSearchParams(window.location.search).get('billing');
    if (!billingStatus) {
      return;
    }

    if (billingStatus === 'success') {
      setToast({
        tone: 'success',
        title: 'Billing completed',
        message: 'Stripe returned successfully. Refresh billing to confirm the latest access state.',
      });
    } else if (billingStatus === 'cancelled') {
      setToast({
        tone: 'info',
        title: 'Checkout cancelled',
        message: 'No changes were made to the current plan.',
      });
    }
  }, []);

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

  useEffect(() => {
    async function loadBillingState() {
      try {
        const planResponse = await getBillingPlans();
        const plans = planResponse.plans || [];
        setBillingPlans(plans);

        const preferredPlan =
          plans.find((plan) => plan.planKey === 'sample_monthly' && plan.configured)?.planKey ||
          plans.find((plan) => plan.planKey === 'sample_onboarding' && plan.configured)?.planKey ||
          plans.find((plan) => plan.configured)?.planKey ||
          '';

        if (preferredPlan) {
          setSelectedPlanKey(preferredPlan);
        }
      } catch (requestError) {
        setToast({
          tone: 'error',
          title: 'Could not load billing plans',
          message: requestError.message,
        });
      }
    }

    loadBillingState();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setBillingSummary(null);
      return;
    }

    async function loadBillingSummary() {
      try {
        const response = await getBillingSummary(session.user.id);
        setBillingSummary(response);
      } catch (requestError) {
        setToast({
          tone: 'error',
          title: 'Could not load billing summary',
          message: requestError.message,
        });
      }
    }

    loadBillingSummary();
  }, [session]);

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
                  </option>
                ))}
              </select>
              <p>{loading ? 'Loading properties...' : `${properties.length} property workspace(s) found.`}</p>
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
                  disabled={!selectedPropertyId || Boolean(actionState)}
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
                    : billingSummary?.subscription?.planKey || 'No active plan'}
              </h3>
              <p>
                {billingSummary?.access?.status
                  ? `Current status: ${billingSummary.access.status}.`
                  : 'Load a session to see the current billing state.'}
              </p>
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
                  <span className="billing-pill">{selectedBillingPlan.mode}</span>
                  <span className="billing-pill">{selectedBillingPlan.audience}</span>
                  <span className="billing-pill">{selectedBillingPlan.planKey}</span>
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
              <button type="submit" className="button-primary" disabled={Boolean(actionState)}>
                Create property
              </button>
            </form>

            <div className="content-card">
              <span className="label">Live dashboard snapshot</span>
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
