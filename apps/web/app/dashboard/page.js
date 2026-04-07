'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCurrency, formatPhoneForDisplay } from '@workside/utils';

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
  getWorkflow,
  listProviders,
  restoreProperty as restorePropertyRequest,
  syncBillingSession,
  listProperties,
  updateUserProfile,
} from '../../lib/api';
import { getStoredSession, setStoredSession } from '../../lib/session';

const SELLER_LANDING_DRAFT_KEY = 'worksideSellerLandingDraft';
const AUTH_ATTRIBUTION_DRAFT_KEY = 'worksideAuthAttributionDraft';

function formatAudienceLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function loadSellerLandingDraft() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawDraft = window.sessionStorage.getItem(SELLER_LANDING_DRAFT_KEY);
    if (!rawDraft) {
      return null;
    }

    const parsedDraft = JSON.parse(rawDraft);
    return parsedDraft && typeof parsedDraft === 'object' ? parsedDraft : null;
  } catch {
    return null;
  }
}

function loadAuthAttributionDraft() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawDraft = window.sessionStorage.getItem(AUTH_ATTRIBUTION_DRAFT_KEY);
    if (!rawDraft) {
      return null;
    }

    const parsedDraft = JSON.parse(rawDraft);
    return parsedDraft?.attribution && typeof parsedDraft.attribution === 'object'
      ? parsedDraft.attribution
      : null;
  } catch {
    return null;
  }
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

function getWorkflowStepHref(step, propertyId) {
  if (step?.actionHref) {
    return step.actionHref;
  }

  if (propertyId) {
    return `/properties/${propertyId}`;
  }

  return '/dashboard';
}

function getDashboardCtaLabel(step) {
  switch (step?.key) {
    case 'property_details':
      return 'Confirm property details';
    case 'pricing_review':
      return 'Review pricing strategy';
    case 'capture_photos':
      return 'Capture listing photos';
    case 'review_photos':
      return 'Review best images';
    case 'enhance_photos':
      return 'Polish image quality';
    case 'prep_checklist':
      return 'Work the prep checklist';
    case 'providers':
      return 'Line up local help';
    case 'report':
      return 'Build seller report';
    case 'brochure':
      return 'Create marketing materials';
    case 'final_review':
      return 'Run final review';
    default:
      return step?.ctaLabel || 'Open next step';
  }
}

function formatWorkflowUxStatus(status) {
  return String(status || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function parseTurnaroundHours(label) {
  if (!label) {
    return Number.POSITIVE_INFINITY;
  }

  const normalized = String(label).toLowerCase();
  if (normalized.includes('same day')) {
    return 8;
  }

  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function buildProviderHighlights(providers = []) {
  if (!providers.length) {
    return [];
  }

  const recommended = providers[0];
  const fastest = [...providers].sort(
    (left, right) => parseTurnaroundHours(left.turnaroundLabel) - parseTurnaroundHours(right.turnaroundLabel),
  )[0];
  const bestRated = [...providers].sort(
    (left, right) => (right.rating || 0) - (left.rating || 0),
  )[0];

  const distinct = [];
  const seen = new Set();

  [
    {
      key: 'recommended',
      eyebrow: 'Top recommended',
      provider: recommended,
      helper: 'Best overall internal match based on coverage, readiness, and marketplace ranking.',
    },
    {
      key: 'fastest',
      eyebrow: 'Fastest response',
      provider: fastest,
      helper: 'Useful when you need help moving prep or photo work forward quickly.',
    },
    {
      key: 'best-rated',
      eyebrow: 'Best rated',
      provider: bestRated,
      helper: 'Strong social proof based on the available review signal.',
    },
  ].forEach((entry) => {
    if (!entry.provider?.id || seen.has(entry.provider.id)) {
      return;
    }
    seen.add(entry.provider.id);
    distinct.push(entry);
  });

  return distinct;
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
  const [showCompletedWorkflowSteps, setShowCompletedWorkflowSteps] = useState(false);
  const [focusedWorkflowStepKey, setFocusedWorkflowStepKey] = useState('');
  const [accountForm, setAccountForm] = useState({
    firstName: '',
    lastName: '',
    mobilePhone: '',
    smsOptIn: false,
  });
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
  const viewerRole = session?.user?.role === 'agent' ? 'agent' : 'seller';

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
  const workflowQuery = useQuery({
    queryKey: ['dashboard-workflow', selectedPropertyId, viewerRole],
    enabled: Boolean(selectedPropertyId),
    queryFn: async () => {
      const response = await getWorkflow(selectedPropertyId, viewerRole);
      return response.workflow;
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
  const workflow = workflowQuery.data || null;
  const providerSupportTask = useMemo(
    () =>
      (dashboard?.tasks || []).find(
        (item) => item.providerCategoryKey && item.status !== 'done',
      ) ||
      (dashboard?.tasks || []).find((item) => item.providerCategoryKey) ||
      null,
    [dashboard?.tasks],
  );

  const providerHighlightsQuery = useQuery({
    queryKey: [
      'dashboard-provider-highlights',
      selectedPropertyId,
      providerSupportTask?.providerCategoryKey || '',
      providerSupportTask?.systemKey || providerSupportTask?.id || '',
    ],
    enabled: Boolean(selectedPropertyId && providerSupportTask?.providerCategoryKey),
    queryFn: async () =>
      listProviders(selectedPropertyId, {
        taskKey: providerSupportTask?.systemKey || providerSupportTask?.id,
        limit: 6,
      }),
    staleTime: 20_000,
  });

  const providerHighlightCards = useMemo(
    () => buildProviderHighlights(providerHighlightsQuery.data?.providers?.items || []),
    [providerHighlightsQuery.data?.providers?.items],
  );
  const workflowVisibleSteps = useMemo(
    () =>
      (workflow?.steps || []).filter(
        (step) => showCompletedWorkflowSteps || step.uxStatus !== 'completed',
      ),
    [showCompletedWorkflowSteps, workflow?.steps],
  );
  const selectedWorkflowStep = useMemo(
    () =>
      (workflow?.steps || []).find((step) => step.key === focusedWorkflowStepKey) ||
      workflow?.nextAction ||
      workflow?.steps?.[0] ||
      null,
    [focusedWorkflowStepKey, workflow?.nextAction, workflow?.steps],
  );

  useEffect(() => {
    if (!workflow?.steps?.length) {
      setFocusedWorkflowStepKey('');
      return;
    }

    setFocusedWorkflowStepKey((current) => {
      const currentStillExists = workflow.steps.some((step) => step.key === current);
      if (currentStillExists) {
        return current;
      }
      return workflow.nextAction?.key || workflow.steps[0]?.key || '';
    });
  }, [workflow?.nextAction?.key, workflow?.steps]);

  useEffect(() => {
    const stored = getStoredSession();
    setSession(stored);
  }, []);

  useEffect(() => {
    setAccountForm({
      firstName: session?.user?.firstName || '',
      lastName: session?.user?.lastName || '',
      mobilePhone: formatPhoneForDisplay(session?.user?.mobilePhone || ''),
      smsOptIn: Boolean(session?.user?.smsOptIn),
    });
  }, [session?.user?.firstName, session?.user?.lastName, session?.user?.mobilePhone, session?.user?.smsOptIn]);

  useEffect(() => {
    const landingDraft = loadSellerLandingDraft();
    if (!landingDraft) {
      return;
    }

    setCreateForm((current) => ({
      ...current,
      title: current.title || landingDraft.title || '',
      addressLine1: current.addressLine1 || landingDraft.addressLine1 || '',
      city: current.city || landingDraft.city || '',
      state: current.state || landingDraft.state || '',
      zip: current.zip || landingDraft.zip || '',
      propertyType: landingDraft.propertyType || current.propertyType,
      bedrooms: landingDraft.bedrooms || current.bedrooms,
      bathrooms: landingDraft.bathrooms || current.bathrooms,
      squareFeet: landingDraft.squareFeet || current.squareFeet,
    }));

    setToast((current) =>
      current || {
        tone: 'info',
        title: 'Preview carried over',
        message: 'Your landing-page property details are ready in the create-property form below.',
      },
    );
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
    if (!providerHighlightsQuery.error) {
      return;
    }

    setToast({
      tone: 'error',
      title: 'Could not load provider highlights',
      message: providerHighlightsQuery.error.message,
    });
  }, [providerHighlightsQuery.error]);

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
      const landingDraft = loadSellerLandingDraft();
      const authAttributionDraft = loadAuthAttributionDraft();
      const response = await createProperty(
        {
          ...createForm,
          attribution: landingDraft?.attribution || authAttributionDraft || undefined,
        },
        session.user.id,
      );
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(SELLER_LANDING_DRAFT_KEY);
        window.sessionStorage.removeItem(AUTH_ATTRIBUTION_DRAFT_KEY);
      }
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
      await queryClient.invalidateQueries({ queryKey: ['dashboard-workflow'] });
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

  async function handleSaveAccountProfile(event) {
    event.preventDefault();
    if (!session?.token) {
      return;
    }

    setActionState('Saving account profile...');
    setToast(null);

    try {
      const response = await updateUserProfile({
        firstName: accountForm.firstName,
        lastName: accountForm.lastName,
        mobilePhone: accountForm.mobilePhone,
        smsOptIn: accountForm.smsOptIn,
      }, session.token);
      const nextSession = {
        ...session,
        user: {
          ...session.user,
          ...response.user,
        },
      };
      setSession(nextSession);
      setStoredSession(nextSession);
      setToast({
        tone: 'success',
        title: 'Profile updated',
        message: 'Your seller contact settings were saved.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not save profile',
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
      await queryClient.invalidateQueries({ queryKey: ['dashboard-workflow', selectedPropertyId, viewerRole] });
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
      await queryClient.invalidateQueries({ queryKey: ['dashboard-workflow', selectedPropertyId, viewerRole] });
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
      await queryClient.invalidateQueries({ queryKey: ['dashboard-workflow', selectedPropertyId, viewerRole] });
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
          <span className="label">{viewerRole === 'agent' ? 'Realtor dashboard' : 'Seller dashboard'}</span>
          <h1>{dashboard?.property?.title || selectedProperty?.title || 'Your property workspace'}</h1>
          <p>
            Use this page to manage properties, understand progress, and follow the next guided step toward market-ready materials.
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
                  {actionState.includes('pricing') ? 'Refreshing pricing...' : 'Refresh pricing strategy'}
                </button>
                {selectedPropertyId ? (
                  <Link className="button-secondary inline-button" href={`/properties/${selectedPropertyId}`}>
                    Continue guided workspace
                  </Link>
                ) : null}
              </div>
            </article>
          </section>

          <section className="dashboard-grid dashboard-account-grid">
            <form className="feature-card dashboard-contact-card" onSubmit={handleSaveAccountProfile}>
              <div className="dashboard-contact-card-header">
                <div>
                  <span className="label">Seller contact</span>
                  <h3>Mobile updates</h3>
                </div>
                <span className={`dashboard-contact-status-pill${accountForm.smsOptIn ? ' enabled' : ''}`}>
                  {accountForm.smsOptIn ? 'SMS enabled' : 'Email only'}
                </span>
              </div>
              <p className="dashboard-contact-card-copy">
                Keep your contact details current so Workside can send listing, provider, and account updates to the right place.
              </p>

              <div className="dashboard-contact-grid">
                <label className="dashboard-contact-field">
                  <span>First name</span>
                  <input
                    type="text"
                    value={accountForm.firstName}
                    onChange={(event) => setAccountForm((current) => ({ ...current, firstName: event.target.value }))}
                  />
                </label>
                <label className="dashboard-contact-field">
                  <span>Last name</span>
                  <input
                    type="text"
                    value={accountForm.lastName}
                    onChange={(event) => setAccountForm((current) => ({ ...current, lastName: event.target.value }))}
                  />
                </label>
                <label className="dashboard-contact-field dashboard-contact-field-full">
                  <span>Mobile number</span>
                  <input
                    type="tel"
                    placeholder="(661) 555-1212"
                    value={accountForm.mobilePhone}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        mobilePhone: formatPhoneForDisplay(event.target.value),
                      }))
                    }
                  />
                </label>
              </div>

              <label className="dashboard-checkbox-field dashboard-contact-consent">
                <input
                  type="checkbox"
                  checked={accountForm.smsOptIn}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      smsOptIn: event.target.checked,
                    }))
                  }
                />
                <span>
                  I agree to receive transactional SMS messages about account activity, provider responses, and listing workflow updates.
                </span>
              </label>

              <p className="dashboard-contact-footnote">
                Transactional alerts are only sent when you opt in. Message frequency varies by activity.
              </p>

              <div className="button-stack">
                <button type="submit" className="button-primary" disabled={!session?.token || Boolean(actionState)}>
                  Save contact settings
                </button>
              </div>
            </form>

            <div className="dashboard-account-side-column">
              <article className="feature-card dashboard-summary-card dashboard-billing-card">
                <div className="dashboard-card-header">
                  <div>
                    <span className="label">Billing access</span>
                    <h3>
                      {billingSummary?.access?.planKey === 'free'
                        ? 'Free access'
                        : billingSummary?.access?.planKey === 'admin_bypass'
                          ? 'Admin access'
                          : billingSummary?.access?.planKey === 'demo_bypass'
                            ? 'Demo access'
                            : formatAudienceLabel(billingSummary?.subscription?.planKey || 'No active plan')}
                    </h3>
                  </div>
                  <span className={`dashboard-card-pill${billingSummary?.access?.status ? ' active' : ''}`}>
                    {billingSummary?.access?.status
                      ? formatAudienceLabel(billingSummary.access.status)
                      : 'Status pending'}
                  </span>
                </div>
                <p>
                  {billingSummary?.access?.status
                    ? 'Current account access, active workspace capacity, and feature unlocks.'
                    : 'Load a session to see the current billing state and feature access.'}
                </p>
                {propertyCapacity ? (
                  <div className="dashboard-account-mini-grid">
                    <div className="dashboard-account-mini-stat">
                      <strong>Active properties</strong>
                      <span>{propertyCapacity.activeCount}</span>
                    </div>
                    <div className="dashboard-account-mini-stat">
                      <strong>Remaining capacity</strong>
                      <span>
                        {propertyCapacity.activeLimit === null
                          ? 'Unlimited'
                          : `${propertyCapacity.remainingActiveSlots} of ${propertyCapacity.activeLimit}`}
                      </span>
                    </div>
                  </div>
                ) : null}
                <div className="tag-row dashboard-feature-tags">
                  {(billingSummary?.access?.features || []).slice(0, 4).map((feature) => (
                    <span key={feature}>{feature}</span>
                  ))}
                </div>
              </article>

              <article className="feature-card dashboard-summary-card dashboard-checkout-card">
                <div className="dashboard-card-header">
                  <div>
                    <span className="label">Stripe checkout</span>
                    <h3>Unlock the next plan</h3>
                  </div>
                  <span className="dashboard-card-pill subtle">
                    {selectedBillingPlan ? formatAudienceLabel(selectedBillingPlan.audience) : 'Choose a plan'}
                  </span>
                </div>
                <p>
                  {selectedBillingPlan?.description ||
                    'Pick a configured plan to launch Stripe Checkout.'}
                </p>
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
                {selectedBillingPlan ? (
                  <div className="billing-plan-meta dashboard-billing-plan-meta">
                    <span className="billing-pill">
                      {selectedBillingPlan.mode === 'subscription' ? 'Recurring plan' : 'One-time fee'}
                    </span>
                    <span className="billing-pill">{formatAudienceLabel(selectedBillingPlan.audience)}</span>
                    <span className="billing-pill">{selectedBillingPlan.priceLabel || selectedBillingPlan.planKey}</span>
                  </div>
                ) : null}
                <div className="button-stack dashboard-card-actions">
                  <button
                    type="button"
                    className="button-primary"
                    onClick={handleStartCheckout}
                    disabled={!session?.user?.id || !selectedBillingPlan || Boolean(actionState)}
                  >
                    Unlock plan in Stripe
                  </button>
                </div>
              </article>

              <article className="feature-card dashboard-summary-card dashboard-demo-card">
                <div className="dashboard-card-header">
                  <div>
                    <span className="label">Demo billing notes</span>
                    <h3>Live-flow testing</h3>
                  </div>
                  <span className="dashboard-card-pill subtle">Demo safe</span>
                </div>
                <p>
                  Use the sample onboarding or sample monthly plans for low-cost live demos. Admin accounts bypass billing, while demo accounts can complete the full Stripe flow.
                </p>
                <div className="tag-row dashboard-feature-tags">
                  <span>Sample onboarding</span>
                  <span>Sample monthly</span>
                  <span>Admin bypass</span>
                </div>
              </article>
            </div>
          </section>

          {selectedPropertyId && workflow ? (
            <section className="dashboard-guide-shell">
              <aside className="content-card dashboard-workflow-rail">
                <div className="dashboard-workflow-rail-header">
                  <span className="label">Workflow navigator</span>
                  <h3>
                    {workflow.statusSummary?.completed || 0}/{workflow.steps?.length || 0} steps complete
                  </h3>
                  <p>
                    {workflow.currentPhaseLabel || 'Workflow'} · {viewerRole === 'agent' ? 'Realtor guide' : 'Seller guide'}
                  </p>
                </div>

                <div className="dashboard-readiness-pill dashboard-readiness-pill-compact">
                  <strong>{workflow.marketReadyScore ?? dashboard?.property?.readinessScore ?? 0}/100 ready</strong>
                  <span>{workflow.readinessSummary?.label || 'Readiness'}</span>
                </div>

                <div className="dashboard-step-counts">
                  <span>{workflow.statusSummary?.recommended || 0} recommended</span>
                  <span>{workflow.statusSummary?.inProgress || 0} in progress</span>
                  <span>{workflow.statusSummary?.blocked || 0} blocked</span>
                </div>

                <div className="dashboard-step-list">
                  {workflowVisibleSteps.map((step) => (
                    <button
                      key={step.key}
                      type="button"
                      className={`dashboard-step-button dashboard-step-button-${step.uxStatus}${selectedWorkflowStep?.key === step.key ? ' active' : ''}`}
                      onClick={() => setFocusedWorkflowStepKey(step.key)}
                    >
                      <span className="dashboard-step-index">{step.sequenceIndex}</span>
                      <span className="dashboard-step-copy">
                        <strong>{step.title}</strong>
                        <span>{formatWorkflowUxStatus(step.uxStatus)}</span>
                      </span>
                    </button>
                  ))}
                </div>

                {(workflow.statusSummary?.completed || 0) > 0 ? (
                  <button
                    type="button"
                    className="button-secondary inline-button dashboard-completed-toggle"
                    onClick={() => setShowCompletedWorkflowSteps((current) => !current)}
                  >
                    {showCompletedWorkflowSteps
                      ? `Hide completed (${workflow.statusSummary.completed})`
                      : `Show completed (${workflow.statusSummary.completed})`}
                  </button>
                ) : null}
              </aside>

              <div className="dashboard-guide-main">
                <article className="content-card dashboard-next-action-card">
                  <div className="dashboard-next-action-copy">
                    <span className="label">Next action engine</span>
                    <h2>{selectedWorkflowStep?.title || 'Choose a property to begin'}</h2>
                    <p>
                      {selectedWorkflowStep?.description ||
                        'Create or select a property to begin the guided workflow.'}
                    </p>
                    {selectedWorkflowStep?.helperText ? (
                      <p className="dashboard-next-action-helper">{selectedWorkflowStep.helperText}</p>
                    ) : null}
                    {selectedWorkflowStep?.lockedReason ? (
                      <p className="dashboard-next-action-helper">{selectedWorkflowStep.lockedReason}</p>
                    ) : null}
                    <div className="tag-row">
                      <span>{formatWorkflowUxStatus(selectedWorkflowStep?.uxStatus || 'ready')}</span>
                      <span>{selectedWorkflowStep?.phaseLabel || workflow.currentPhaseLabel}</span>
                    </div>
                  </div>
                  <div className="dashboard-next-action-actions">
                    <Link
                      className="button-primary inline-button"
                      href={getWorkflowStepHref(selectedWorkflowStep, selectedPropertyId)}
                    >
                      {getDashboardCtaLabel(selectedWorkflowStep)}
                    </Link>
                    <Link
                      className="button-secondary inline-button"
                      href={`/properties/${selectedPropertyId}`}
                    >
                      Open property workspace
                    </Link>
                  </div>
                </article>

                <section className="dashboard-guide-grid">
                  <article className="feature-card dashboard-readiness-card">
                    <span className="label">Readiness score</span>
                    <h3>{workflow.marketReadyScore ?? dashboard?.property?.readinessScore ?? 0}/100</h3>
                    <p>{workflow.readinessSummary?.message || 'Complete the guided steps to improve market readiness.'}</p>
                    <div className="mini-stats">
                      <div className="stat-card">
                        <strong>Completion</strong>
                        <span>{workflow.completionPercent ?? 0}% complete</span>
                      </div>
                      <div className="stat-card">
                        <strong>Current phase</strong>
                        <span>{workflow.currentPhaseLabel || 'Workflow'}</span>
                      </div>
                    </div>
                  </article>

                  <article className="feature-card dashboard-provider-card">
                    <span className="label">Provider ranking</span>
                    <h3>{providerSupportTask?.providerCategoryLabel || 'Provider guidance'}</h3>
                    <p>
                      {providerSupportTask?.providerPrompt ||
                        'When a checklist step calls for outside help, we will surface the strongest local options here.'}
                    </p>
                    {providerHighlightsQuery.isLoading ? (
                      <p>Loading ranked provider options...</p>
                    ) : providerHighlightCards.length ? (
                      <div className="dashboard-provider-highlight-list">
                        {providerHighlightCards.map((entry) => (
                          <div key={entry.key} className="dashboard-provider-highlight">
                            <span className="label">{entry.eyebrow}</span>
                            <strong>{entry.provider.businessName}</strong>
                            <span>
                              {entry.provider.coverageLabel ||
                                [entry.provider.city, entry.provider.state].filter(Boolean).join(', ')}
                            </span>
                            <span>{entry.provider.turnaroundLabel || 'Turnaround not listed'}</span>
                            <span>
                              {entry.provider.rating
                                ? `${entry.provider.rating.toFixed(1)} stars${entry.provider.reviewCount ? ` · ${entry.provider.reviewCount} reviews` : ''}`
                                : 'Rating not listed'}
                            </span>
                            <p>{entry.helper}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>
                        {providerSupportTask?.providerCategoryLabel
                          ? 'No live internal providers are ranked for this step yet. The property workspace can still broaden the search with Google fallback.'
                          : 'No provider-ranked tasks are active right now.'}
                      </p>
                    )}
                  </article>

                  <article className="feature-card dashboard-phase-card">
                    <span className="label">Phase progress</span>
                    <div className="workflow-phase-list">
                      {(workflow?.phases || []).map((phase) => (
                        <div key={phase.key} className={`workflow-phase-item workflow-phase-item-${phase.status}`}>
                          <strong>{phase.label}</strong>
                          <span>{phase.completedSteps}/{phase.totalSteps} complete</span>
                        </div>
                      ))}
                    </div>
                  </article>
                </section>
              </div>
            </section>
          ) : null}

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
                Start this property
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
