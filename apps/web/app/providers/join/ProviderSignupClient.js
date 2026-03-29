'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createProviderBillingCheckout, signupProvider } from '../../../lib/api';
import { setStoredProviderSession } from '../../../lib/provider-session';
import { Toast } from '../../../components/Toast';

const STEP_TITLES = [
  'Basic info',
  'Coverage',
  'Business details',
  'Lead preferences',
  'Plan',
];

const CATEGORY_OPTIONS = [
  { value: 'inspector', label: 'Home Inspector' },
  { value: 'title_company', label: 'Title Company' },
  { value: 'real_estate_attorney', label: 'Real Estate Attorney' },
  { value: 'photographer', label: 'Photographer' },
  { value: 'cleaning_service', label: 'Cleaning Service' },
];

const PLAN_OPTIONS = [
  { value: 'provider_basic', label: 'Free / Basic', detail: 'Get listed and prepare for billing setup.' },
  { value: 'provider_standard', label: 'Standard', detail: 'Priority visibility and stronger marketplace placement.' },
  { value: 'provider_featured', label: 'Featured', detail: 'Sponsored-style exposure once billing is active.' },
];

const INITIAL_FORM = {
  businessName: '',
  categoryKey: 'photographer',
  phone: '',
  email: '',
  city: '',
  state: '',
  primaryZip: '',
  extraZips: '',
  radiusMiles: 25,
  description: '',
  websiteUrl: '',
  yearsInBusiness: '',
  turnaroundLabel: '24-48 hours',
  pricingSummary: '',
  serviceHighlights: '',
  deliveryMode: 'sms_and_email',
  notifyPhone: '',
  notifyEmail: '',
  preferredContactMethod: 'sms',
  smsOptIn: false,
  planCode: '',
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

export function ProviderSignupClient({ billingState = '', providerId = '' }) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [createdProvider, setCreatedProvider] = useState(null);

  useEffect(() => {
    if (billingState === 'success') {
      setToast({
        tone: 'success',
        title: 'Billing completed',
        message: providerId
          ? `Billing completed for provider ${providerId}. Activation is now syncing.`
          : 'Your provider billing setup completed successfully. Activation is now syncing.',
      });
    } else if (billingState === 'cancelled') {
      setToast({
        tone: 'info',
        title: 'Billing cancelled',
        message: 'Your provider profile was saved, but checkout was cancelled before payment completed.',
      });
    }
  }, [billingState, providerId]);

  function updateField(field, value) {
    if (field === 'phone' || field === 'notifyPhone') {
      setForm((current) => ({ ...current, [field]: formatPhoneInput(value) }));
      return;
    }

    setForm((current) => ({ ...current, [field]: value }));
  }

  function validateCurrentStep() {
    if (stepIndex === 0) {
      if (!form.businessName || !form.phone || !form.email) {
        throw new Error('Business name, phone, and email are required.');
      }
      if (countPhoneDigits(form.phone) < 10) {
        throw new Error('Enter a valid business phone number before continuing.');
      }
      if (!isValidEmail(form.email)) {
        throw new Error('Enter a valid email address before continuing.');
      }
    }

    if (stepIndex === 1) {
      if (!form.city || !form.state || !form.primaryZip) {
        throw new Error('City, state, and a primary ZIP are required.');
      }
    }

    if (stepIndex === 3) {
      const wantsSms = ['sms', 'sms_and_email'].includes(form.deliveryMode);
      const wantsEmail = ['email', 'sms_and_email'].includes(form.deliveryMode);
      if (wantsSms && !form.notifyPhone) {
        throw new Error('Add an SMS phone number to receive marketplace leads by text.');
      }
      if (wantsSms && countPhoneDigits(form.notifyPhone) < 10) {
        throw new Error('Enter a valid SMS phone number before continuing.');
      }
      if (wantsEmail && form.notifyEmail && !isValidEmail(form.notifyEmail)) {
        throw new Error('Enter a valid lead email address before continuing.');
      }
      if (wantsSms && !form.smsOptIn) {
        throw new Error('You must explicitly opt in to transactional SMS before continuing.');
      }
    }

    if (stepIndex === 4 && !form.planCode) {
      throw new Error('Select a provider plan before continuing to billing.');
    }
  }

  function handleNext() {
    try {
      validateCurrentStep();
      setToast(null);
      setStepIndex((current) => Math.min(current + 1, STEP_TITLES.length - 1));
    } catch (error) {
      setToast({
        tone: 'error',
        title: 'Missing information',
        message: error.message,
      });
    }
  }

  function handleBack() {
    setToast(null);
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setToast(null);

    try {
      validateCurrentStep();
      const payload = {
        businessName: form.businessName,
        categoryKey: form.categoryKey,
        phone: form.phone,
        email: form.email,
        city: form.city,
        state: form.state,
        zipCodes: [form.primaryZip, ...form.extraZips.split(',').map((value) => value.trim())].filter(Boolean),
        radiusMiles: Number(form.radiusMiles),
        description: form.description,
        websiteUrl: form.websiteUrl,
        yearsInBusiness: form.yearsInBusiness ? Number(form.yearsInBusiness) : undefined,
        turnaroundLabel: form.turnaroundLabel,
        pricingSummary: form.pricingSummary,
        serviceHighlights: form.serviceHighlights
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        deliveryMode: form.deliveryMode,
        notifyPhone: form.notifyPhone,
        notifyEmail: form.notifyEmail || form.email,
        preferredContactMethod: form.preferredContactMethod,
        smsOptIn: form.smsOptIn,
        planCode: form.planCode,
      };

      const result = await signupProvider(payload);
      const provider = result.provider || null;
      const portalAccessToken = result.portalAccessToken || provider?.portalAccessToken || '';
      setCreatedProvider(provider);

      if (provider && portalAccessToken) {
        setStoredProviderSession({
          providerId: provider.id,
          token: portalAccessToken,
        });
      }

      if (provider && portalAccessToken && form.planCode !== 'provider_basic') {
        const origin = window.location.origin;
        const checkout = await createProviderBillingCheckout({
          providerId: provider.id,
          planCode: form.planCode,
          successUrl: `${origin}/providers/portal?billing=success&providerId=${provider.id}&token=${portalAccessToken}`,
          cancelUrl: `${origin}/providers/portal?billing=cancelled&providerId=${provider.id}&token=${portalAccessToken}`,
        });

        if (checkout?.url) {
          window.location.href = checkout.url;
          return;
        }
      }

      if (provider && portalAccessToken) {
        router.push(`/providers/portal?created=1&providerId=${encodeURIComponent(provider.id)}&token=${encodeURIComponent(portalAccessToken)}`);
        return;
      }

      setToast({
        tone: 'success',
        title: 'Provider profile submitted',
        message:
          form.planCode === 'provider_basic'
            ? 'Your business is in the review queue.'
            : 'Your business is in the review and billing-setup queue.',
      });
    } catch (error) {
      setToast({
        tone: 'error',
        title: 'Could not submit provider profile',
        message: error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  if (createdProvider) {
    return (
      <>
        <Toast tone={toast?.tone} title={toast?.title} message={toast?.message} onClose={() => setToast(null)} />
        <section className="content-grid onboarding-shell">
          <div className="content-card">
            <span className="label">Provider onboarding</span>
            <h1>You&apos;re in the queue.</h1>
            <p>
              {createdProvider.businessName} has been submitted to Workside Home Advisor. Your
              profile is now in review, and billing setup is the next step before marketplace
              activation.
            </p>
            <div className="mini-stats">
              <div className="stat-card">
                <strong>Status</strong>
                <span>{createdProvider.status || 'pending_billing'}</span>
              </div>
              <div className="stat-card">
                <strong>Approval</strong>
                <span>{createdProvider.compliance?.approvalStatus || 'review'}</span>
              </div>
              <div className="stat-card">
                <strong>Plan</strong>
                <span>{createdProvider.subscription?.planCode || form.planCode}</span>
              </div>
            </div>
          </div>

          <div className="form-card">
            <span className="label">Next steps</span>
            <h2>What happens next</h2>
            <ul className="plain-list">
              <li>Your profile can now be reviewed by the Workside team.</li>
              <li>Billing setup and activation are the next step before you go live.</li>
              <li>You can contact support if you need faster onboarding help.</li>
            </ul>
            <div className="button-stack">
              <a className="button-primary" href="mailto:support@worksidesoftware.com">
                Contact support
              </a>
              <Link className="button-secondary" href="/">
                Back to homepage
              </Link>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <Toast tone={toast?.tone} title={toast?.title} message={toast?.message} onClose={() => setToast(null)} />
      <section className="content-grid onboarding-shell">
        <div className="content-card">
          <span className="label">Provider onboarding</span>
          <h1>List your business and start receiving seller workflow leads.</h1>
          <p>
            This onboarding is designed to stay fast, mobile-friendly, and low-friction. Finish the
            core profile now, then move into billing and activation next.
          </p>

          <div className="onboarding-progress">
            {STEP_TITLES.map((title, index) => (
              <div
                key={title}
                className={index === stepIndex ? 'onboarding-step active' : index < stepIndex ? 'onboarding-step complete' : 'onboarding-step'}
              >
                <strong>{index + 1}</strong>
                <span>{title}</span>
              </div>
            ))}
          </div>

          <div className="status-copy">
            Current step: <strong>{STEP_TITLES[stepIndex]}</strong>
          </div>
        </div>

        <form className="form-card" onSubmit={handleSubmit}>
          {stepIndex === 0 ? (
            <>
              <label>
                Business name
                <input value={form.businessName} onChange={(event) => updateField('businessName', event.target.value)} />
              </label>
              <label>
                Category
                <select className="select-input" value={form.categoryKey} onChange={(event) => updateField('categoryKey', event.target.value)}>
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Phone
                <input
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                  placeholder="(555) 123-4567"
                  inputMode="tel"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder="name@business.com"
                />
              </label>
            </>
          ) : null}

          {stepIndex === 1 ? (
            <>
              <div className="split-fields">
                <label>
                  City
                  <input value={form.city} onChange={(event) => updateField('city', event.target.value)} />
                </label>
                <label>
                  State
                  <input value={form.state} onChange={(event) => updateField('state', event.target.value)} />
                </label>
              </div>
              <div className="split-fields">
                <label>
                  Primary ZIP
                  <input value={form.primaryZip} onChange={(event) => updateField('primaryZip', event.target.value)} />
                </label>
                <label>
                  Service radius
                  <input
                    type="number"
                    min="5"
                    max="50"
                    value={form.radiusMiles}
                    onChange={(event) => updateField('radiusMiles', event.target.value)}
                  />
                </label>
              </div>
              <label>
                Additional ZIPs
                <input
                  value={form.extraZips}
                  onChange={(event) => updateField('extraZips', event.target.value)}
                  placeholder="93312, 93313"
                />
              </label>
            </>
          ) : null}

          {stepIndex === 2 ? (
            <>
              <label>
                Short description
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) => updateField('description', event.target.value)}
                />
              </label>
              <label>
                Website
                <input value={form.websiteUrl} onChange={(event) => updateField('websiteUrl', event.target.value)} />
              </label>
              <div className="split-fields">
                <label>
                  Years in business
                  <input
                    type="number"
                    min="0"
                    max="80"
                    value={form.yearsInBusiness}
                    onChange={(event) => updateField('yearsInBusiness', event.target.value)}
                  />
                </label>
                <label>
                  Typical turnaround
                  <input value={form.turnaroundLabel} onChange={(event) => updateField('turnaroundLabel', event.target.value)} />
                </label>
              </div>
              <label>
                Pricing summary
                <input
                  value={form.pricingSummary}
                  onChange={(event) => updateField('pricingSummary', event.target.value)}
                  placeholder="Most shoots start at $225"
                />
              </label>
              <label>
                Service highlights
                <input
                  value={form.serviceHighlights}
                  onChange={(event) => updateField('serviceHighlights', event.target.value)}
                  placeholder="Licensed, Weekend availability, Luxury listings"
                />
              </label>
            </>
          ) : null}

          {stepIndex === 3 ? (
            <>
              <label>
                Receive leads via
                <select className="select-input" value={form.deliveryMode} onChange={(event) => updateField('deliveryMode', event.target.value)}>
                  <option value="sms_and_email">SMS and email</option>
                  <option value="sms">SMS only</option>
                  <option value="email">Email only</option>
                </select>
              </label>
              <div className="split-fields">
                <label>
                  SMS phone
                  <input
                    value={form.notifyPhone}
                    onChange={(event) => updateField('notifyPhone', event.target.value)}
                    placeholder="(555) 123-4567"
                    inputMode="tel"
                  />
                </label>
                <label>
                  Lead email
                  <input
                    type="email"
                    value={form.notifyEmail}
                    onChange={(event) => updateField('notifyEmail', event.target.value)}
                    placeholder="leads@business.com"
                  />
                </label>
              </div>
              <label>
                Preferred contact method
                <select className="select-input" value={form.preferredContactMethod} onChange={(event) => updateField('preferredContactMethod', event.target.value)}>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                </select>
              </label>
              <label className="consent-check">
                <input
                  type="checkbox"
                  checked={form.smsOptIn}
                  onChange={(event) => updateField('smsOptIn', event.target.checked)}
                />
                <span>
                  I agree to receive transactional SMS messages from Workside Software regarding
                  provider lead notifications and account-related updates. Message frequency varies.
                  Message and data rates may apply. Reply STOP to opt out or HELP for assistance.
                </span>
              </label>
            </>
          ) : null}

          {stepIndex === 4 ? (
            <>
              <div className="onboarding-plan-grid">
                {PLAN_OPTIONS.map((plan) => (
                  <label
                    key={plan.value}
                    className={form.planCode === plan.value ? 'onboarding-plan active' : 'onboarding-plan'}
                  >
                    <input
                      type="radio"
                      name="planCode"
                      value={plan.value}
                      checked={form.planCode === plan.value}
                      onChange={(event) => updateField('planCode', event.target.value)}
                    />
                    <strong>{plan.label}</strong>
                    <span>{plan.detail}</span>
                  </label>
                ))}
              </div>
              <div className="status-copy">
                Selected plan:{' '}
                <strong>
                  {form.planCode
                    ? PLAN_OPTIONS.find((plan) => plan.value === form.planCode)?.label || form.planCode
                    : 'Choose a plan to continue'}
                </strong>
              </div>
              <div className="legal-notice">
                Billing checkout is the next step after profile submission. For now, your business
                will be created in a pending billing state so the Workside team can finish setup.
              </div>
              <div className="legal-section">
                <p>
                  By submitting this form, you agree to the{' '}
                  <Link href="/terms">Terms of Service</Link>, <Link href="/privacy">Privacy Policy</Link>, and{' '}
                  <Link href="/sms-consent">SMS Consent disclosure</Link>.
                </p>
              </div>
            </>
          ) : null}

          <div className="button-stack">
            {stepIndex > 0 ? (
              <button type="button" className="button-secondary" onClick={handleBack}>
                Back
              </button>
            ) : null}
            {stepIndex < STEP_TITLES.length - 1 ? (
              <button type="button" className="button-primary" onClick={handleNext}>
                Continue
              </button>
            ) : (
              <button type="submit" className={loading ? 'button-primary button-busy' : 'button-primary'} disabled={loading}>
                {loading ? 'Submitting...' : 'Submit and continue to billing'}
              </button>
            )}
          </div>
        </form>
      </section>
    </>
  );
}
