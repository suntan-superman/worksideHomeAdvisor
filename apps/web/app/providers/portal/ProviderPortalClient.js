'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  createProviderBillingCheckout,
  createProviderPortalSession,
  respondToProviderPortalLead,
  updateProviderPortalProfile,
} from '../../../lib/api';
import {
  getStoredProviderSession,
  setStoredProviderSession,
} from '../../../lib/provider-session';
import { getStoredSession } from '../../../lib/session';
import { Toast } from '../../../components/Toast';

const INITIAL_PROFILE_FORM = {
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
};

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

export function ProviderPortalClient({
  providerId = '',
  token = '',
  billingState = '',
  createdState = '',
}) {
  const [portalSession, setPortalSession] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [profileForm, setProfileForm] = useState(INITIAL_PROFILE_FORM);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [appSession, setAppSession] = useState(null);

  useEffect(() => {
    setAppSession(getStoredSession());
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

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      setLoading(true);
      setError('');

      const incomingSession =
        providerId && token
          ? { providerId, token }
          : getStoredProviderSession();

      try {
        let result = null;

        if (appSession?.token && ['provider', 'admin', 'super_admin'].includes(appSession.user?.role)) {
          result = await createProviderPortalSession({}, appSession.token);
        } else if (incomingSession?.providerId && incomingSession?.token) {
          result = await createProviderPortalSession(incomingSession);
        } else {
          if (!cancelled) {
            setLoading(false);
            setPortalSession(null);
            setDashboard(null);
          }
          return;
        }

        if (cancelled) {
          return;
        }

        if (result.session?.providerId && result.session?.portalAccessToken) {
          const nextSession = {
            providerId: result.session.providerId,
            token: result.session.portalAccessToken,
          };
          setStoredProviderSession(nextSession);
          setPortalSession(nextSession);
        } else if (incomingSession?.providerId && incomingSession?.token) {
          setStoredProviderSession(incomingSession);
          setPortalSession(incomingSession);
        } else {
          setPortalSession(null);
        }
        setDashboard(result.session?.dashboard || null);
        if (providerId && token && typeof window !== 'undefined') {
          window.history.replaceState({}, '', '/providers/portal');
        }
      } catch (requestError) {
        if (cancelled) {
          return;
        }

        clearStoredProviderSession();
        setPortalSession(null);
        setDashboard(null);
        setError(requestError.message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [providerId, token, appSession?.token, appSession?.user?.role]);

  useEffect(() => {
    const provider = dashboard?.provider;
    if (!provider) {
      return;
    }

    setProfileForm({
      description: provider.description || '',
      websiteUrl: provider.websiteUrl || '',
      turnaroundLabel: provider.turnaroundLabel || '',
      pricingSummary: provider.pricingSummary || '',
      serviceHighlights: (provider.serviceHighlights || []).join(', '),
      city: provider.serviceArea?.city || '',
      state: provider.serviceArea?.state || '',
      zipCodes: (provider.serviceArea?.zipCodes || []).join(', '),
      radiusMiles: provider.serviceArea?.radiusMiles || 25,
      deliveryMode: provider.leadRouting?.deliveryMode || 'sms_and_email',
      notifyPhone: provider.leadRouting?.notifyPhone || '',
      notifyEmail: provider.leadRouting?.notifyEmail || '',
      preferredContactMethod: provider.leadRouting?.preferredContactMethod || 'sms',
    });
  }, [dashboard]);

  const wantsSms = ['sms', 'sms_and_email'].includes(profileForm.deliveryMode);
  const wantsEmail = ['email', 'sms_and_email'].includes(profileForm.deliveryMode);
  const notifyPhoneIsValid = countPhoneDigits(profileForm.notifyPhone) >= 10;
  const notifyEmailIsValid = !profileForm.notifyEmail || isValidEmail(profileForm.notifyEmail);
  const profileFormReady = Boolean(
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
      const result = await updateProviderPortalProfile(
        portalSession.providerId,
        {
          description: profileForm.description,
          websiteUrl: profileForm.websiteUrl,
          turnaroundLabel: profileForm.turnaroundLabel,
          pricingSummary: profileForm.pricingSummary,
          serviceHighlights: profileForm.serviceHighlights
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
          city: profileForm.city,
          state: profileForm.state,
          zipCodes: profileForm.zipCodes
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
          radiusMiles: Number(profileForm.radiusMiles),
          deliveryMode: profileForm.deliveryMode,
          notifyPhone: profileForm.notifyPhone,
          notifyEmail: profileForm.notifyEmail,
          preferredContactMethod: profileForm.preferredContactMethod,
        },
        portalSession.token,
      );

      setDashboard(result.dashboard || null);
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
          <span className="label">Quick actions</span>
          <h2>Marketplace controls</h2>
          <div className="button-stack">
            {billingNeedsAction ? (
              <button type="button" className="button-primary" onClick={handleContinueBilling} disabled={busy}>
                Continue billing setup
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
        <form className="form-card provider-portal-profile" onSubmit={handleSaveProfile}>
          <span className="label">Marketplace profile</span>
          <h2>Keep your listing current</h2>
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
              <input value={profileForm.state} onChange={(event) => updateField('state', event.target.value)} />
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
                max="150"
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
