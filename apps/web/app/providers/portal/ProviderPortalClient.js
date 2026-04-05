'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createProviderBillingCheckout,
  createProviderPortalSession,
  downloadProviderVerificationDocument,
  listProviderCategories,
  respondToProviderPortalLead,
  submitProviderVerification,
  syncProviderBillingSession,
  uploadProviderVerificationDocument,
  updateProviderPortalProfile,
} from '../../../lib/api';
import {
  clearStoredProviderSession,
  getStoredProviderSession,
  setStoredProviderSession,
} from '../../../lib/provider-session';
import { getStoredSession } from '../../../lib/session';
import { Toast } from '../../../components/Toast';

const INITIAL_PROFILE_FORM = {
  categoryKey: '',
  description: '',
  websiteUrl: '',
  turnaroundLabel: '',
  pricingSummary: '',
  serviceHighlights: '',
  city: '',
  state: '',
  zipCodes: '',
  radiusMiles: 25,
  deliveryMode: 'sms_and_email',
  notifyPhone: '',
  notifyEmail: '',
  preferredContactMethod: 'sms',
  hasInsurance: false,
  insuranceCarrier: '',
  insurancePolicyNumber: '',
  insuranceExpirationDate: '',
  hasLicense: false,
  licenseNumber: '',
  licenseState: '',
  hasBond: false,
};

const US_STATE_OPTIONS = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT',
  'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

function normalizeOptionalStateCode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return US_STATE_OPTIONS.includes(normalized) ? normalized : '';
}

function formatPhoneInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 10);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function countPhoneDigits(value) {
  return String(value || '').replace(/\D/g, '').length;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function formatCategoryLabel(value) {
  return String(value || 'provider lead')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatPlanLabel(value) {
  return String(value || 'provider_basic')
    .replace(/^provider_/, '')
    .replace(/_/g, ' ');
}

function formatVerificationLabel(value) {
  return String(value || 'none')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatActivationStatusLabel(value) {
  return String(value || 'attention')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value) {
  if (!value) {
    return 'Not yet';
  }

  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return 'Not yet';
  }
}

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return window.btoa(binary);
}

export function ProviderPortalClient({
  providerId = '',
  token = '',
  billingState = '',
  sessionId = '',
  createdState = '',
}) {
  const queryClient = useQueryClient();
  const [portalSession, setPortalSession] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [profileForm, setProfileForm] = useState(INITIAL_PROFILE_FORM);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [appSession, setAppSession] = useState(null);
  const [appSessionReady, setAppSessionReady] = useState(false);
  const [uploadingDocumentType, setUploadingDocumentType] = useState('');
  const profileFormRef = useRef(null);
  const portalSessionQueryKey = [
    'provider-portal-session',
    providerId,
    token,
    appSession?.token || '',
    appSession?.user?.role || '',
    billingState,
    sessionId,
  ];
  const providerCategoriesQuery = useQuery({
    queryKey: ['provider-categories'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const payload = await listProviderCategories();
      return payload.categories || [];
    },
  });

  useEffect(() => {
    setAppSession(getStoredSession());
    setAppSessionReady(true);
  }, []);

  useEffect(() => {
    if (billingState === 'success') {
      setToast({
        tone: 'success',
        title: 'Billing completed',
        message: 'Your provider billing setup completed successfully. Marketplace activation is syncing now.',
      });
    } else if (billingState === 'cancelled') {
      setToast({
        tone: 'info',
        title: 'Billing cancelled',
        message: 'Your provider profile was saved, but checkout was cancelled before payment completed.',
      });
    } else if (createdState) {
      setToast({
        tone: 'success',
        title: 'Provider portal ready',
        message: 'Your provider profile was created and this portal is now connected to your account.',
      });
    }
  }, [billingState, createdState]);

  const portalSessionQuery = useQuery({
    queryKey: portalSessionQueryKey,
    enabled: appSessionReady,
    staleTime: 3_000,
    refetchInterval: (query) => {
      const subscriptionStatus = query.state.data?.dashboard?.provider?.subscription?.status || '';
      if (['checkout_created', 'open', 'incomplete', 'unpaid'].includes(subscriptionStatus)) {
        return 5_000;
      }
      if (billingState === 'success') {
        return 10_000;
      }
      return 20_000;
    },
    queryFn: async () => {
      const incomingSession =
        providerId && token
          ? { providerId, token }
          : getStoredProviderSession();

      if (billingState === 'success' && sessionId) {
        await syncProviderBillingSession(sessionId);
      }

      let result = null;
      if (incomingSession?.providerId && incomingSession?.token) {
        result = await createProviderPortalSession(incomingSession);
      } else if (appSession?.token && ['provider', 'admin', 'super_admin'].includes(appSession.user?.role)) {
        result = await createProviderPortalSession({}, appSession.token);
      } else {
        return {
          dashboard: null,
          portalSession: null,
        };
      }

      if (result.session?.providerId && result.session?.portalAccessToken) {
        const nextSession = {
          providerId: result.session.providerId,
          token: result.session.portalAccessToken,
        };
        return {
          dashboard: result.session?.dashboard || null,
          portalSession: nextSession,
        };
      }

      if (incomingSession?.providerId && incomingSession?.token) {
        return {
          dashboard: result.session?.dashboard || null,
          portalSession: incomingSession,
        };
      }

      return {
        dashboard: result.session?.dashboard || null,
        portalSession: null,
      };
    },
  });

  useEffect(() => {
    const nextDashboard = portalSessionQuery.data?.dashboard || null;
    const nextPortalSession = portalSessionQuery.data?.portalSession || null;

    if (nextPortalSession?.providerId && nextPortalSession?.token) {
      setStoredProviderSession(nextPortalSession);
      setPortalSession(nextPortalSession);
    } else if (portalSessionQuery.isSuccess) {
      setPortalSession(null);
    }

    if (portalSessionQuery.isSuccess) {
      setDashboard(nextDashboard);
      setError('');
      if ((providerId || token || billingState || sessionId || createdState) && typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/providers/portal');
      }
    }
  }, [
    billingState,
    createdState,
    portalSessionQuery.data,
    portalSessionQuery.isSuccess,
    providerId,
    sessionId,
    token,
  ]);

  useEffect(() => {
    if (!portalSessionQuery.error) {
      return;
    }

    clearStoredProviderSession();
    setPortalSession(null);
    setDashboard(null);
    setError(portalSessionQuery.error.message);
  }, [portalSessionQuery.error]);

  useEffect(() => {
    const provider = dashboard?.provider;
    if (!provider) {
      return;
    }

    setProfileForm({
      categoryKey: provider.categoryKey || '',
      description: provider.description || '',
      websiteUrl: provider.websiteUrl || '',
      turnaroundLabel: provider.turnaroundLabel || '',
      pricingSummary: provider.pricingSummary || '',
      serviceHighlights: (provider.serviceHighlights || []).join(', '),
      city: provider.serviceArea?.city || '',
      state: normalizeOptionalStateCode(provider.serviceArea?.state),
      zipCodes: (provider.serviceArea?.zipCodes || []).join(', '),
      radiusMiles: provider.serviceArea?.radiusMiles || 25,
      deliveryMode: provider.leadRouting?.deliveryMode || 'sms_and_email',
      notifyPhone: provider.leadRouting?.notifyPhone || '',
      notifyEmail: provider.leadRouting?.notifyEmail || '',
      preferredContactMethod: provider.leadRouting?.preferredContactMethod || 'sms',
      hasInsurance: Boolean(provider.verification?.insurance?.hasInsurance),
      insuranceCarrier: provider.verification?.insurance?.carrier || '',
      insurancePolicyNumber: provider.verification?.insurance?.policyNumber || '',
      insuranceExpirationDate: provider.verification?.insurance?.expirationDate
        ? new Date(provider.verification.insurance.expirationDate).toISOString().slice(0, 10)
        : '',
      hasLicense: Boolean(provider.verification?.license?.hasLicense),
      licenseNumber: provider.verification?.license?.licenseNumber || '',
      licenseState: normalizeOptionalStateCode(provider.verification?.license?.state),
      hasBond: Boolean(provider.verification?.bonding?.hasBond),
    });
  }, [dashboard]);

  const wantsSms = ['sms', 'sms_and_email'].includes(profileForm.deliveryMode);
  const wantsEmail = ['email', 'sms_and_email'].includes(profileForm.deliveryMode);
  const notifyPhoneIsValid = countPhoneDigits(profileForm.notifyPhone) >= 10;
  const notifyEmailIsValid = !profileForm.notifyEmail || isValidEmail(profileForm.notifyEmail);
  const categoryOptions = providerCategoriesQuery.data || [];
  const categoryExists = categoryOptions.some((category) => category.key === profileForm.categoryKey);
  const normalizedCategoryOptions = categoryExists
    ? categoryOptions
    : [
        ...(profileForm.categoryKey
          ? [{
              key: profileForm.categoryKey,
              label: dashboard?.provider?.categoryLabel || formatCategoryLabel(profileForm.categoryKey),
            }]
          : []),
        ...categoryOptions,
      ];
  const loading = !appSessionReady || portalSessionQuery.isLoading;
  const profileFormReady = Boolean(
    profileForm.categoryKey &&
    (!wantsSms || (profileForm.notifyPhone && notifyPhoneIsValid)) &&
      (!wantsEmail || !profileForm.notifyEmail || notifyEmailIsValid),
  );

  function updateField(field, value) {
    if (field === 'notifyPhone') {
      setProfileForm((current) => ({
        ...current,
        [field]: formatPhoneInput(value),
      }));
      return;
    }

    setProfileForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSaveProfile(event) {
    event.preventDefault();
    if (!portalSession?.providerId || !portalSession?.token) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const normalizedState = normalizeOptionalStateCode(profileForm.state);
      const normalizedLicenseState = profileForm.hasLicense
        ? normalizeOptionalStateCode(profileForm.licenseState)
        : '';
      const result = await updateProviderPortalProfile(
        portalSession.providerId,
        {
          categoryKey: profileForm.categoryKey,
          description: profileForm.description,
          websiteUrl: profileForm.websiteUrl.trim(),
          turnaroundLabel: profileForm.turnaroundLabel,
          pricingSummary: profileForm.pricingSummary,
          serviceHighlights: profileForm.serviceHighlights
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
          city: profileForm.city,
          state: normalizedState || undefined,
          zipCodes: profileForm.zipCodes
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
          radiusMiles: Number(profileForm.radiusMiles),
          deliveryMode: profileForm.deliveryMode,
          notifyPhone: profileForm.notifyPhone,
          notifyEmail: profileForm.notifyEmail.trim(),
          preferredContactMethod: profileForm.preferredContactMethod,
          hasInsurance: profileForm.hasInsurance,
          insuranceCarrier: profileForm.insuranceCarrier,
          insurancePolicyNumber: profileForm.insurancePolicyNumber,
          insuranceExpirationDate: profileForm.insuranceExpirationDate || undefined,
          hasLicense: profileForm.hasLicense,
          licenseNumber: profileForm.licenseNumber,
          licenseState: normalizedLicenseState || undefined,
          hasBond: profileForm.hasBond,
        },
        portalSession.token,
      );

      setDashboard(result.dashboard || null);
      queryClient.setQueryData(portalSessionQueryKey, (current) => ({
        ...(current || {}),
        dashboard: result.dashboard || null,
        portalSession,
      }));
      setToast({
        tone: 'success',
        title: 'Profile updated',
        message: 'Your provider marketplace profile has been saved.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not save provider profile',
        message: requestError.message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleLeadResponse(dispatchId, responseStatus) {
    if (!portalSession?.providerId || !portalSession?.token) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const result = await respondToProviderPortalLead(
        portalSession.providerId,
        dispatchId,
        {
          providerId: portalSession.providerId,
          responseStatus,
          note: `Responded from portal as ${responseStatus}.`,
        },
        portalSession.token,
      );

      setDashboard(result.dashboard || null);
      queryClient.setQueryData(portalSessionQueryKey, (current) => ({
        ...(current || {}),
        dashboard: result.dashboard || null,
        portalSession,
      }));
      setToast({
        tone: 'success',
        title: responseStatus === 'accepted' ? 'Lead accepted' : 'Lead declined',
        message:
          responseStatus === 'accepted'
            ? 'This seller request is now marked as accepted.'
            : 'This seller request is now marked as declined.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not update provider lead',
        message: requestError.message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadVerificationDocument(documentType, file) {
    if (!portalSession?.providerId || !portalSession?.token || !file) {
      return;
    }

    setUploadingDocumentType(documentType);
    setError('');

    try {
      const fileBase64 = await fileToBase64(file);
      const result = await uploadProviderVerificationDocument(
        portalSession.providerId,
        {
          documentType,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileBase64,
        },
        portalSession.token,
      );

      setDashboard(result.dashboard || null);
      queryClient.setQueryData(portalSessionQueryKey, (current) => ({
        ...(current || {}),
        dashboard: result.dashboard || null,
        portalSession,
      }));
      setToast({
        tone: 'success',
        title: 'Verification document uploaded',
        message: 'Your verification file has been saved and is ready for review.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not upload verification document',
        message: requestError.message,
      });
    } finally {
      setUploadingDocumentType('');
    }
  }

  async function handleDownloadVerificationDocument(documentType) {
    if (!portalSession?.providerId || !portalSession?.token) {
      return;
    }

    try {
      const file = await downloadProviderVerificationDocument(
        portalSession.providerId,
        documentType,
        portalSession.token,
      );
      const objectUrl = window.URL.createObjectURL(file.blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = file.fileName;
      anchor.rel = 'noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not download verification document',
        message: requestError.message,
      });
    }
  }

  async function handleSubmitVerification() {
    if (!portalSession?.providerId || !portalSession?.token) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const result = await submitProviderVerification(portalSession.providerId, portalSession.token);
      setDashboard(result.dashboard || null);
      queryClient.setQueryData(portalSessionQueryKey, (current) => ({
        ...(current || {}),
        dashboard: result.dashboard || null,
        portalSession,
      }));
      setToast({
        tone: 'success',
        title: 'Verification submitted',
        message: 'Your verification details are now marked for admin review.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not submit verification',
        message: requestError.message,
      });
    } finally {
      setBusy(false);
    }
  }

  function handleActivationAction(item) {
    if (!item?.actionKey) {
      return;
    }

    if (item.actionKey === 'billing') {
      handleContinueBilling();
      return;
    }

    if (item.actionKey === 'verification') {
      handleSubmitVerification();
      return;
    }

    if (item.actionKey === 'profile') {
      profileFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (item.actionKey === 'support' && typeof window !== 'undefined') {
      window.location.href = 'mailto:support@worksidesoftware.com';
    }
  }

  async function handleContinueBilling() {
    const provider = dashboard?.provider;
    if (!provider) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const origin = window.location.origin;
      const checkout = await createProviderBillingCheckout({
        providerId: provider.id,
        planCode: provider.subscription?.planCode || 'provider_standard',
        successUrl: `${origin}/providers/portal?billing=success`,
        cancelUrl: `${origin}/providers/portal?billing=cancelled`,
      });

      if (checkout?.url) {
        window.location.href = checkout.url;
        return;
      }

      throw new Error('Stripe did not return a checkout URL.');
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not start provider billing',
        message: requestError.message,
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <>
        <Toast tone={toast?.tone} title={toast?.title} message={toast?.message} onClose={() => setToast(null)} />
        <section className="content-grid onboarding-shell">
          <div className="content-card">
            <span className="label">Provider portal</span>
            <h1>Loading your provider workspace</h1>
            <p>We are connecting your marketplace profile, recent leads, and billing state.</p>
          </div>
        </section>
      </>
    );
  }

  if (!dashboard?.provider) {
    return (
      <>
        <Toast tone={toast?.tone} title={toast?.title} message={toast?.message} onClose={() => setToast(null)} />
        <section className="content-grid onboarding-shell">
          <div className="content-card">
            <span className="label">Provider portal</span>
            <h1>Provider access required</h1>
            <p>
              Sign in with a provider account, or use a provider-specific access link from onboarding.
            </p>
            {error ? <div className="error-copy">{error}</div> : null}
            <div className="button-stack">
              <Link href="/providers/join" className="button-primary">
                Open provider onboarding
              </Link>
              <a className="button-secondary" href="mailto:support@worksidesoftware.com">
                Contact support
              </a>
            </div>
          </div>
        </section>
      </>
    );
  }

  const provider = dashboard.provider;
  const summary = dashboard.summary || {};
  const leads = dashboard.leads || [];
  const verification = provider.verification || {};
  const activation = provider.activation || { items: [], blockers: [], nextStep: null, readyPercent: 0 };
  const billingNeedsAction =
    provider.subscription?.planCode &&
    provider.subscription?.planCode !== 'provider_basic' &&
    !['active', 'trialing', 'past_due', 'paid'].includes(provider.subscription?.status || '');

  return (
    <>
      <Toast tone={toast?.tone} title={toast?.title} message={toast?.message} onClose={() => setToast(null)} />
      <section className="content-grid provider-portal-shell">
        <div className="content-card provider-portal-hero">
          <span className="label">Provider portal</span>
          <h1>{provider.businessName}</h1>
          <p>
            Review seller workflow leads, keep your marketplace profile current, and track where
            billing and approval stand.
          </p>

          <div className="mini-stats">
            <div className="stat-card">
              <strong>Plan</strong>
              <span>{formatPlanLabel(provider.subscription?.planCode || 'provider_basic')}</span>
            </div>
            <div className="stat-card">
              <strong>Subscription</strong>
              <span>{provider.subscription?.status || 'inactive'}</span>
            </div>
            <div className="stat-card">
              <strong>Approval</strong>
              <span>{provider.compliance?.approvalStatus || 'draft'}</span>
            </div>
            <div className="stat-card">
              <strong>Status</strong>
              <span>{provider.status || 'pending'}</span>
            </div>
            <div className="stat-card">
              <strong>Verification</strong>
              <span>{formatVerificationLabel(verification.review?.level || 'self_reported')}</span>
            </div>
          </div>

          <div className="provider-portal-meta">
            <span>Billing period ends: {formatDate(provider.subscription?.currentPeriodEnd)}</span>
            <span>Last portal use: {formatDate(provider.portalAccess?.lastUsedAt)}</span>
            <span>
              Service area: {[provider.serviceArea?.city, provider.serviceArea?.state].filter(Boolean).join(', ') || 'Not set'}
            </span>
          </div>
        </div>

        <div className="form-card provider-portal-sidecard">
          <span className="label">Activation</span>
          <h2>Marketplace readiness</h2>
          <div className="provider-activation-summary">
            <strong>{activation.readyPercent || 0}% ready</strong>
            <span>
              {activation.live
                ? 'This provider is live for marketplace matching.'
                : `${activation.completeCount || 0}/${activation.totalCount || 0} activation checks complete.`}
            </span>
          </div>
          {activation.nextStep ? (
            <div className="provider-activation-next">
              <strong>Next step: {activation.nextStep.label}</strong>
              <p>{activation.nextStep.detail}</p>
              {activation.nextStep.actionKey ? (
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy}
                  onClick={() => handleActivationAction(activation.nextStep)}
                >
                  {activation.nextStep.actionLabel || 'Open next step'}
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="provider-activation-list">
            {(activation.items || []).map((item) => (
              <article key={item.key} className="provider-activation-item">
                <div className="provider-activation-item-header">
                  <strong>{item.label}</strong>
                  <span className={`checklist-chip checklist-chip-${item.status === 'complete' ? 'low' : item.status === 'in_progress' ? 'medium' : 'high'}`}>
                    {formatActivationStatusLabel(item.status)}
                  </span>
                </div>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
          <span className="label">Quick actions</span>
          <h2>Marketplace controls</h2>
          <div className="button-stack">
            {billingNeedsAction ? (
              <button type="button" className="button-primary" onClick={handleContinueBilling} disabled={busy}>
                Continue billing setup
              </button>
            ) : null}
            {verification.review?.level !== 'verified' ? (
              <button type="button" className="button-secondary" onClick={handleSubmitVerification} disabled={busy}>
                Submit verification for review
              </button>
            ) : null}
            <Link href="/providers/join" className="button-secondary">
              Review onboarding
            </Link>
            <a href="mailto:support@worksidesoftware.com" className="button-primary">
              Contact support
            </a>
          </div>
          {error ? <div className="error-copy">{error}</div> : null}
        </div>
      </section>

      <section className="dashboard-grid provider-portal-stats">
        <article className="stat-card">
          <strong>Awaiting response</strong>
          <span>{summary.awaitingResponse || 0}</span>
        </article>
        <article className="stat-card">
          <strong>Accepted</strong>
          <span>{summary.accepted || 0}</span>
        </article>
        <article className="stat-card">
          <strong>Declined</strong>
          <span>{summary.declined || 0}</span>
        </article>
        <article className="stat-card">
          <strong>Total lead dispatches</strong>
          <span>{summary.total || 0}</span>
        </article>
      </section>

      <section className="content-grid provider-portal-shell">
        <form ref={profileFormRef} className="form-card provider-portal-profile" onSubmit={handleSaveProfile}>
          <span className="label">Marketplace profile</span>
          <h2>Keep your listing current</h2>
          <label>
            Business type
            <select
              className="select-input"
              value={profileForm.categoryKey}
              onChange={(event) => updateField('categoryKey', event.target.value)}
            >
              <option value="">Select a business type</option>
              {normalizedCategoryOptions.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Short description
            <textarea
              rows={4}
              value={profileForm.description}
              onChange={(event) => updateField('description', event.target.value)}
            />
          </label>
          <label>
            Website
            <input
              value={profileForm.websiteUrl}
              onChange={(event) => updateField('websiteUrl', event.target.value)}
            />
          </label>
          <div className="split-fields">
            <label>
              Turnaround
              <input
                value={profileForm.turnaroundLabel}
                onChange={(event) => updateField('turnaroundLabel', event.target.value)}
              />
            </label>
            <label>
              Pricing summary
              <input
                value={profileForm.pricingSummary}
                onChange={(event) => updateField('pricingSummary', event.target.value)}
              />
            </label>
          </div>
          <label>
            Service highlights
            <input
              value={profileForm.serviceHighlights}
              onChange={(event) => updateField('serviceHighlights', event.target.value)}
              placeholder="Licensed, Fast turnaround, Weekend coverage"
            />
          </label>
          <div className="split-fields">
            <label>
              City
              <input value={profileForm.city} onChange={(event) => updateField('city', event.target.value)} />
            </label>
            <label>
              State
              <select
                className="select-input"
                value={profileForm.state}
                onChange={(event) => updateField('state', event.target.value)}
              >
                <option value="">Select a state</option>
                {US_STATE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="split-fields">
            <label>
              ZIP coverage
              <input
                value={profileForm.zipCodes}
                onChange={(event) => updateField('zipCodes', event.target.value)}
                placeholder="93312, 93313"
              />
            </label>
            <label>
              Radius miles
              <input
                type="number"
                min="5"
                max="1000"
                value={profileForm.radiusMiles}
                onChange={(event) => updateField('radiusMiles', event.target.value)}
              />
            </label>
          </div>
          <label>
            Delivery mode
            <select
              className="select-input"
              value={profileForm.deliveryMode}
              onChange={(event) => updateField('deliveryMode', event.target.value)}
            >
              <option value="sms_and_email">SMS and email</option>
              <option value="sms">SMS only</option>
              <option value="email">Email only</option>
            </select>
          </label>
          <div className="split-fields">
            <label>
              SMS phone
              <input
                value={profileForm.notifyPhone}
                onChange={(event) => updateField('notifyPhone', event.target.value)}
              />
              {profileForm.notifyPhone && !notifyPhoneIsValid ? (
                <span className="field-hint field-error">Enter a full 10-digit SMS number.</span>
              ) : null}
            </label>
            <label>
              Lead email
              <input
                type="email"
                value={profileForm.notifyEmail}
                onChange={(event) => updateField('notifyEmail', event.target.value)}
              />
              {profileForm.notifyEmail && !notifyEmailIsValid ? (
                <span className="field-hint field-error">Enter a valid lead email address.</span>
              ) : null}
            </label>
          </div>
          <label>
            Preferred contact method
            <select
              className="select-input"
              value={profileForm.preferredContactMethod}
              onChange={(event) => updateField('preferredContactMethod', event.target.value)}
            >
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </select>
          </label>
          <div className="verification-panel">
            <div className="verification-panel-header">
              <div>
                <span className="label">Verification</span>
                <h3>Trust profile</h3>
              </div>
              <span className="checklist-chip checklist-chip-medium">
                {formatVerificationLabel(verification.review?.reviewStatus || 'none')}
              </span>
            </div>
            <p className="workspace-control-note">
              {verification.disclaimer ||
                'Provider credentials are self-reported or verified where indicated. Workside does not guarantee accuracy.'}
            </p>
            {verification.review?.reviewNotes ? (
              <div className="legal-notice">
                Admin review note: {verification.review.reviewNotes}
              </div>
            ) : null}
            <div className="verification-check-grid">
              <label className="consent-check compact-check">
                <input
                  type="checkbox"
                  checked={profileForm.hasInsurance}
                  onChange={(event) => updateField('hasInsurance', event.target.checked)}
                />
                <span>Insured</span>
              </label>
              <label className="consent-check compact-check">
                <input
                  type="checkbox"
                  checked={profileForm.hasLicense}
                  onChange={(event) => updateField('hasLicense', event.target.checked)}
                />
                <span>Licensed</span>
              </label>
              <label className="consent-check compact-check">
                <input
                  type="checkbox"
                  checked={profileForm.hasBond}
                  onChange={(event) => updateField('hasBond', event.target.checked)}
                />
                <span>Bonded</span>
              </label>
            </div>
            {profileForm.hasInsurance ? (
              <>
                <div className="split-fields">
                  <label>
                    Insurance carrier
                    <input
                      value={profileForm.insuranceCarrier}
                      onChange={(event) => updateField('insuranceCarrier', event.target.value)}
                    />
                  </label>
                  <label>
                    Policy number
                    <input
                      value={profileForm.insurancePolicyNumber}
                      onChange={(event) => updateField('insurancePolicyNumber', event.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Insurance expiration
                  <input
                    type="date"
                    value={profileForm.insuranceExpirationDate}
                    onChange={(event) => updateField('insuranceExpirationDate', event.target.value)}
                  />
                </label>
              </>
            ) : null}
            {profileForm.hasLicense ? (
              <div className="split-fields">
                <label>
                  License number
                  <input
                    value={profileForm.licenseNumber}
                    onChange={(event) => updateField('licenseNumber', event.target.value)}
                  />
                </label>
                <label>
                  License state
                  <select
                    className="select-input"
                    value={profileForm.licenseState}
                    onChange={(event) => updateField('licenseState', event.target.value)}
                  >
                    <option value="">Select a state</option>
                    {US_STATE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            <div className="provider-doc-grid">
              <div className="provider-doc-card">
                <strong>Insurance certificate</strong>
                <span>
                  {verification.insurance?.certificateDocument?.fileName || 'No insurance document uploaded yet'}
                </span>
                {verification.insurance?.certificateDocument?.uploadedAt ? (
                  <span>Uploaded {formatDate(verification.insurance.certificateDocument.uploadedAt)}</span>
                ) : null}
                <div className="provider-doc-actions">
                  <label className="button-secondary provider-upload-button">
                    {uploadingDocumentType === 'insurance_certificate' ? 'Uploading...' : 'Upload file'}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      hidden
                      disabled={uploadingDocumentType === 'insurance_certificate'}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          handleUploadVerificationDocument('insurance_certificate', file);
                        }
                        event.target.value = '';
                      }}
                    />
                  </label>
                  {verification.insurance?.certificateDocument ? (
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => handleDownloadVerificationDocument('insurance_certificate')}
                    >
                      View file
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="provider-doc-card">
                <strong>License document</strong>
                <span>{verification.license?.document?.fileName || 'No license document uploaded yet'}</span>
                {verification.license?.document?.uploadedAt ? (
                  <span>Uploaded {formatDate(verification.license.document.uploadedAt)}</span>
                ) : null}
                <div className="provider-doc-actions">
                  <label className="button-secondary provider-upload-button">
                    {uploadingDocumentType === 'license_document' ? 'Uploading...' : 'Upload file'}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      hidden
                      disabled={uploadingDocumentType === 'license_document'}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          handleUploadVerificationDocument('license_document', file);
                        }
                        event.target.value = '';
                      }}
                    />
                  </label>
                  {verification.license?.document ? (
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => handleDownloadVerificationDocument('license_document')}
                    >
                      View file
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <div className="button-stack">
            <button
              type="submit"
              className={busy ? 'button-primary button-busy' : 'button-primary'}
              disabled={busy || !profileFormReady}
            >
              {busy ? 'Saving...' : 'Save provider profile'}
            </button>
          </div>
        </form>

        <div className="content-card provider-portal-leads">
          <span className="label">Lead queue</span>
          <h2>Recent seller requests</h2>
          {leads.length ? (
            <div className="provider-lead-list">
              {leads.map((lead) => (
                <article key={lead.id} className="provider-card">
                  <div className="provider-card-header">
                    <div>
                      <strong>{formatCategoryLabel(lead.categoryKey)}</strong>
                      <span>{lead.propertyAddress || 'Property location pending'}</span>
                    </div>
                    <span className="checklist-chip">{lead.dispatchStatus}</span>
                  </div>
                  <p>{lead.message || 'No seller message was added for this request.'}</p>
                  <div className="provider-quality-row">
                    <span>Lead status: {lead.leadStatus}</span>
                    <span>Sent: {formatDate(lead.sentAt || lead.createdAt)}</span>
                    <span>Response: {lead.responseStatus || 'awaiting response'}</span>
                  </div>
                  <div className="provider-card-actions">
                    {lead.canRespond ? (
                      <>
                        <button
                          type="button"
                          className="button-primary"
                          disabled={busy}
                          onClick={() => handleLeadResponse(lead.id, 'accepted')}
                        >
                          Accept lead
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          disabled={busy}
                          onClick={() => handleLeadResponse(lead.id, 'declined')}
                        >
                          Decline
                        </button>
                      </>
                    ) : (
                      <span className="provider-portal-response-note">
                        This lead already has a final response.
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="status-copy">
              No provider leads have been routed to this account yet. Once seller requests are
              matched, they will show up here.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
