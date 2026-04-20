'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BRANDING } from '@workside/branding';

import { OnboardingGuide } from '../../../components/OnboardingGuide';
import { PasswordInput } from '../../../components/PasswordInput';
import {
  createProviderBillingCheckout,
  getBillingPlans,
  listProviderCategories,
  signupProvider,
} from '../../../lib/api';
import {
  clearStoredProviderOnboardingState,
  getStoredProviderOnboardingState,
  setStoredProviderOnboardingState,
} from '../../../lib/onboarding-state';
import { setStoredProviderSession } from '../../../lib/provider-session';
import { getStoredSession } from '../../../lib/session';
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
  { value: 'termite_inspection', label: 'Termite Inspection' },
  { value: 'notary', label: 'Notary' },
  { value: 'nhd_report', label: 'NHD Report' },
];

const PLAN_OPTIONS = [
  { value: 'provider_basic', label: 'Free / Basic', detail: 'Get listed and prepare for billing setup.' },
  { value: 'provider_standard', label: 'Standard', detail: 'Priority visibility and stronger marketplace placement.' },
  { value: 'provider_featured', label: 'Featured', detail: 'Sponsored-style exposure once billing is active.' },
];

const US_STATE_OPTIONS = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

const LARGE_RADIUS_WARNING_MILES = 150;
const MAX_PROVIDER_RADIUS_MILES = 1000;

const INITIAL_FORM = {
  firstName: '',
  lastName: '',
  businessName: '',
  categoryKey: 'photographer',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
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
  hasInsurance: false,
  insuranceCarrier: '',
  insurancePolicyNumber: '',
  insuranceExpirationDate: '',
  hasLicense: false,
  licenseNumber: '',
  licenseState: '',
  hasBond: false,
  deliveryMode: 'sms_and_email',
  notifyPhone: '',
  notifyEmail: '',
  preferredContactMethod: 'sms',
  smsOptIn: false,
  planCode: '',
};

function createInitialForm(sessionUser = null) {
  return {
    ...INITIAL_FORM,
    firstName: sessionUser?.firstName || '',
    lastName: sessionUser?.lastName || '',
    email: sessionUser?.email || '',
    notifyEmail: sessionUser?.email || '',
  };
}

function loadProviderSignupDraft() {
  const parsedDraft = getStoredProviderOnboardingState();
  if (!parsedDraft || typeof parsedDraft !== 'object') {
    return null;
  }

  const draftForm =
    parsedDraft.form && typeof parsedDraft.form === 'object'
      ? { ...INITIAL_FORM, ...parsedDraft.form }
      : null;

  return {
    stepIndex: Number.isInteger(parsedDraft.stepIndex) ? parsedDraft.stepIndex : 0,
    form: draftForm,
    createdProvider: parsedDraft.createdProvider || null,
    pendingVerificationEmail: parsedDraft.pendingVerificationEmail || '',
  };
}

function clearProviderSignupDraft() {
  clearStoredProviderOnboardingState();
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

function isValidUsState(value) {
  return US_STATE_OPTIONS.some((option) => option.value === String(value || '').trim().toUpperCase());
}

function formatActivationStatusLabel(value) {
  return String(value || 'attention')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function sortCategoryOptions(options = []) {
  return [...options].sort((left, right) =>
    String(left?.label || '').localeCompare(String(right?.label || '')),
  );
}

function getExistingEmailConflictMessage(message) {
  const normalizedMessage = String(message || '').toLowerCase();

  if (
    normalizedMessage.includes('account with that email already exists') ||
    normalizedMessage.includes('provider profile already exists for that email address')
  ) {
    return String(message || '').trim();
  }

  return '';
}

function buildProviderAuthHref({ mode = 'login', email = '' } = {}) {
  const search = new URLSearchParams({ role: 'provider' });

  if (mode && mode !== 'login') {
    search.set('mode', mode);
  }

  if (isValidEmail(email)) {
    search.set('email', email.trim());
  }

  return `/auth?${search.toString()}`;
}

function resolveProviderAccountEmail({
  formEmail = '',
  pendingVerificationEmail = '',
  createdProviderEmail = '',
  appSessionEmail = '',
} = {}) {
  if (isValidEmail(formEmail)) {
    return formEmail.trim();
  }

  if (isValidEmail(pendingVerificationEmail)) {
    return pendingVerificationEmail.trim();
  }

  if (isValidEmail(createdProviderEmail)) {
    return createdProviderEmail.trim();
  }

  if (isValidEmail(appSessionEmail)) {
    return appSessionEmail.trim();
  }

  return '';
}

function buildProviderGuideSteps(stepIndex, signedInProvider = false) {
  const stepDescriptions = [
    {
      title: 'Basic info',
      detail: signedInProvider
        ? 'Confirm the business basics for the provider profile you are already signed into.'
        : 'Create the provider account and define the business identity that sellers will see first.',
      helper: signedInProvider
        ? 'Because you are already signed in, Workside will skip account creation and move straight into provider setup.'
        : 'Business name, category, email, and password set the foundation for the marketplace profile.',
    },
    {
      title: 'Coverage',
      detail: 'Define where this provider actually works so matching and map coverage stay realistic.',
      helper: 'ZIP coverage and radius drive marketplace matching, provider map placement, and seller-facing discovery.',
    },
    {
      title: 'Business details',
      detail: 'Add the service story, trust profile, and differentiators that make the provider credible.',
      helper: 'This is where sellers learn what the provider does, how fast they work, and what trust signals already exist.',
    },
    {
      title: 'Lead preferences',
      detail: 'Choose how lead notifications arrive so routing does not break once sellers start requesting help.',
      helper: 'This step controls who gets the lead, where it goes, and whether SMS consent exists.',
    },
    {
      title: 'Plan',
      detail: 'Pick the marketplace plan, then continue into billing or verification handoff.',
      helper: 'This final step decides whether the profile stays basic or moves into the paid placement path.',
    },
  ];

  return stepDescriptions.map((step, index) => ({
    id: `provider-onboarding-${index}`,
    title: step.title,
    detail: step.detail,
    helper: step.helper,
    status: index < stepIndex ? 'complete' : index === stepIndex ? 'active' : 'upcoming',
  }));
}

export function ProviderSignupClient({
  billingState = '',
  providerId = '',
  prefillCategoryKey = '',
  prefillPrimaryZip = '',
  source = '',
  campaign = '',
  medium = '',
  adset = '',
  ad = '',
  anonymousId = '',
}) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(createInitialForm());
  const [loading, setLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [createdProvider, setCreatedProvider] = useState(null);
  const [appSession, setAppSession] = useState(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [providerPlans, setProviderPlans] = useState([]);
  const [providerCategories, setProviderCategories] = useState(CATEGORY_OPTIONS);
  const [existingEmailConflict, setExistingEmailConflict] = useState('');
  const syncedNotifyEmailRef = useRef('');

  useEffect(() => {
    setAppSession(getStoredSession());
  }, []);

  useEffect(() => {
    const draft = loadProviderSignupDraft();
    if (!draft) {
      return;
    }

    if (draft.form) {
      setForm((current) => ({ ...current, ...draft.form }));
    }
    setStepIndex(Math.max(0, Math.min(draft.stepIndex || 0, STEP_TITLES.length - 1)));
    if (draft.createdProvider) {
      setCreatedProvider(draft.createdProvider);
      setPendingVerificationEmail(draft.pendingVerificationEmail || draft.createdProvider.email || '');
    }
  }, []);

  useEffect(() => {
    const sessionUser = appSession?.user;

    if (!sessionUser) {
      return;
    }

    setForm((current) => ({
      ...current,
      firstName: current.firstName || sessionUser.firstName || '',
      lastName: current.lastName || sessionUser.lastName || '',
      email: current.email || sessionUser.email || '',
      notifyEmail: current.notifyEmail || sessionUser.email || '',
    }));
    syncedNotifyEmailRef.current = sessionUser.email || syncedNotifyEmailRef.current;
  }, [appSession]);

  useEffect(() => {
    if (!isValidEmail(form.email)) {
      return;
    }

    setForm((current) => {
      const shouldSyncNotifyEmail =
        !current.notifyEmail || current.notifyEmail === syncedNotifyEmailRef.current;

      if (!shouldSyncNotifyEmail) {
        return current;
      }

      syncedNotifyEmailRef.current = current.email;

      return {
        ...current,
        notifyEmail: current.email,
      };
    });
  }, [form.email, form.notifyEmail]);

  useEffect(() => {
    setStoredProviderOnboardingState({
      stepIndex,
      form,
      createdProvider,
      pendingVerificationEmail,
    });
  }, [createdProvider, form, pendingVerificationEmail, stepIndex]);

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

  useEffect(() => {
    let cancelled = false;

    async function loadProviderPlans() {
      setPlansLoading(true);

      try {
        const payload = await getBillingPlans();
        if (cancelled) {
          return;
        }

        setProviderPlans(
          (payload.plans || []).filter((plan) =>
            ['provider_basic', 'provider_standard', 'provider_featured'].includes(plan.planKey),
          ),
        );
      } catch {
        if (!cancelled) {
          setProviderPlans([]);
        }
      } finally {
        if (!cancelled) {
          setPlansLoading(false);
        }
      }
    }

    loadProviderPlans();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProviderCategories() {
      try {
        const payload = await listProviderCategories();
        if (cancelled) {
          return;
        }

        const categories = (payload.categories || [])
          .filter((category) => category.isActive !== false)
          .map((category) => ({
            value: category.key,
            label: category.label,
          }));

        if (categories.length) {
          setProviderCategories(sortCategoryOptions(categories));
        }
      } catch {
        if (!cancelled) {
          setProviderCategories(sortCategoryOptions(CATEGORY_OPTIONS));
        }
      }
    }

    loadProviderCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!providerCategories.length) {
      return;
    }

    if (providerCategories.some((category) => category.value === form.categoryKey)) {
      return;
    }

    setForm((current) => ({
      ...current,
      categoryKey: providerCategories[0]?.value || current.categoryKey,
    }));
  }, [form.categoryKey, providerCategories]);

  useEffect(() => {
    if (!prefillCategoryKey && !prefillPrimaryZip) {
      return;
    }

    setForm((current) => ({
      ...current,
      categoryKey:
        prefillCategoryKey && current.categoryKey === INITIAL_FORM.categoryKey
          ? prefillCategoryKey
          : current.categoryKey,
      primaryZip: current.primaryZip || prefillPrimaryZip || current.primaryZip,
    }));
  }, [prefillCategoryKey, prefillPrimaryZip]);

  const signedInProvider = ['provider', 'admin', 'super_admin'].includes(appSession?.user?.role || '');
  const businessEmailIsValid = isValidEmail(form.email);
  const leadEmailIsValid = !form.notifyEmail || isValidEmail(form.notifyEmail);
  const businessPhoneIsValid = countPhoneDigits(form.phone) >= 10;
  const notifyPhoneIsValid = countPhoneDigits(form.notifyPhone) >= 10;
  const passwordLongEnough = form.password.length >= 8;
  const passwordsMatch = Boolean(form.password && form.password === form.confirmPassword);
  const stateCodeIsValid = isValidUsState(form.state);
  const radiusMilesNumber = Number(form.radiusMiles);
  const radiusMilesValid =
    Number.isFinite(radiusMilesNumber) &&
    radiusMilesNumber >= 5 &&
    radiusMilesNumber <= MAX_PROVIDER_RADIUS_MILES;
  const radiusLooksLarge = radiusMilesValid && radiusMilesNumber > LARGE_RADIUS_WARNING_MILES;
  const providerPlanDetails = Object.fromEntries(
    providerPlans.map((plan) => [plan.planKey, plan]),
  );
  const providerAccountEmail = resolveProviderAccountEmail({
    formEmail: form.email,
    pendingVerificationEmail,
    createdProviderEmail: createdProvider?.email || '',
    appSessionEmail: appSession?.user?.email || '',
  });

  function updateField(field, value) {
    if (existingEmailConflict && ['email', 'firstName', 'lastName', 'businessName'].includes(field)) {
      setExistingEmailConflict('');
    }

    if (field === 'phone' || field === 'notifyPhone') {
      setForm((current) => ({ ...current, [field]: formatPhoneInput(value) }));
      return;
    }

    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleReturnToStepOne() {
    setExistingEmailConflict('');
    setToast({
      tone: 'info',
      title: 'Update the email to continue',
      message: 'Step 1 is ready so you can correct the email address or sign in with the existing provider account instead.',
    });
    setStepIndex(0);
  }

  function handleCancelSignup() {
    const sessionUser = appSession?.user || null;
    const resetForm = createInitialForm(sessionUser);
    clearProviderSignupDraft();
    syncedNotifyEmailRef.current = resetForm.notifyEmail || '';
    setExistingEmailConflict('');
    setForm(resetForm);
    setStepIndex(0);
    setToast({
      tone: 'info',
      title: 'Signup cancelled',
      message: 'The provider signup was cleared. You can start again whenever you are ready.',
    });
  }

  function isCurrentStepReady() {
    if (stepIndex === 0) {
      return Boolean(
        form.businessName.trim() &&
          businessPhoneIsValid &&
          businessEmailIsValid &&
          (signedInProvider ||
            (form.firstName.trim() &&
              form.lastName.trim() &&
              passwordLongEnough &&
              passwordsMatch)),
      );
    }

    if (stepIndex === 1) {
      return Boolean(form.city.trim() && stateCodeIsValid && form.primaryZip.trim() && radiusMilesValid);
    }

    if (stepIndex === 2) {
      return true;
    }

    if (stepIndex === 3) {
      const wantsSms = ['sms', 'sms_and_email'].includes(form.deliveryMode);
      const wantsEmail = ['email', 'sms_and_email'].includes(form.deliveryMode);

      return Boolean(
        (!wantsSms || (form.notifyPhone && notifyPhoneIsValid && form.smsOptIn)) &&
          (!wantsEmail || !form.notifyEmail || leadEmailIsValid),
      );
    }

    if (stepIndex === 4) {
      return Boolean(form.planCode);
    }

    return true;
  }

  function validateCurrentStep() {
    if (stepIndex === 0) {
      const signedInProvider = ['provider', 'admin', 'super_admin'].includes(appSession?.user?.role || '');
      if (!form.businessName || !form.phone || !form.email) {
        throw new Error('Business name, phone, and email are required.');
      }
      if (!signedInProvider && (!form.firstName || !form.lastName || !form.password)) {
        throw new Error('First name, last name, and a password are required to create a provider account.');
      }
      if (countPhoneDigits(form.phone) < 10) {
        throw new Error('Enter a valid business phone number before continuing.');
      }
      if (!isValidEmail(form.email)) {
        throw new Error('Enter a valid email address before continuing.');
      }
      if (!signedInProvider && form.password.length < 8) {
        throw new Error('Choose a password with at least 8 characters.');
      }
      if (!signedInProvider && form.password !== form.confirmPassword) {
        throw new Error('Password confirmation does not match.');
      }
    }

    if (stepIndex === 1) {
      if (!form.city || !form.state || !form.primaryZip) {
        throw new Error('City, state, and a primary ZIP are required.');
      }
      if (!stateCodeIsValid) {
        throw new Error('Choose a valid U.S. state before continuing.');
      }
      if (!radiusMilesValid) {
        throw new Error(`Enter a service radius between 5 and ${MAX_PROVIDER_RADIUS_MILES} miles.`);
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
      setExistingEmailConflict('');
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
    setExistingEmailConflict('');
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setToast(null);
    setExistingEmailConflict('');

    try {
      validateCurrentStep();
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        businessName: form.businessName,
        categoryKey: form.categoryKey,
        phone: form.phone,
        email: form.email,
        password: form.password,
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
        hasInsurance: form.hasInsurance,
        insuranceCarrier: form.insuranceCarrier,
        insurancePolicyNumber: form.insurancePolicyNumber,
        insuranceExpirationDate: form.insuranceExpirationDate,
        hasLicense: form.hasLicense,
        licenseNumber: form.licenseNumber,
        licenseState: form.licenseState,
        hasBond: form.hasBond,
        deliveryMode: form.deliveryMode,
        notifyPhone: form.notifyPhone,
        notifyEmail: form.notifyEmail || form.email,
        preferredContactMethod: form.preferredContactMethod,
        smsOptIn: form.smsOptIn,
        planCode: form.planCode,
        attribution:
          source || campaign || medium || adset || ad || anonymousId
            ? {
                source,
                campaign,
                medium,
                adset,
                ad,
                anonymousId,
                roleIntent: 'provider',
                route: '/providers/join',
                landingPath: '/providers/join',
                referrer: typeof document === 'undefined' ? '' : document.referrer,
              }
            : undefined,
      };

      const result = await signupProvider(payload, appSession?.token);
      const provider = result.provider || null;
      const portalAccessToken = result.portalAccessToken || provider?.portalAccessToken || '';
      const requiresOtpVerification = Boolean(result.requiresOtpVerification);
      clearProviderSignupDraft();
      setCreatedProvider(provider);
      setPendingVerificationEmail(result.email || provider?.email || '');

      if (requiresOtpVerification) {
        setToast({
          tone: 'success',
          title: 'Verify your email to continue',
          message: 'We sent a verification code to your email. Once verified, log in as a provider to continue with billing.',
        });
        return;
      }

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
      const conflictMessage = getExistingEmailConflictMessage(error.message);
      if (conflictMessage) {
        setExistingEmailConflict(conflictMessage);
        setToast({
          tone: 'error',
          title: 'That provider email is already in use',
          message: 'Choose whether you want to go back to step 1 and correct it, or cancel this signup attempt.',
        });
        return;
      }

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
            <h1>{pendingVerificationEmail ? 'Verify your provider account first.' : 'You&apos;re in the queue.'}</h1>
            <p>
              {pendingVerificationEmail
                ? `${createdProvider.businessName} has been saved. We sent a verification code to ${pendingVerificationEmail}. Verify that email, then log in as a provider to continue billing and activation.`
                : `${createdProvider.businessName} has been submitted to Workside Home Advisor. Your profile is now in review, and billing setup is the next step before marketplace activation.`}
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
            {createdProvider.activation ? (
              <div className="provider-activation-list">
                {pendingVerificationEmail ? (
                  <article className="provider-activation-item">
                    <div className="provider-activation-item-header">
                      <strong>Email verification</strong>
                      <span className="checklist-chip checklist-chip-high">Action needed</span>
                    </div>
                    <p>
                      Verify {pendingVerificationEmail} first. Billing and marketplace activation stay on hold
                      until the provider email is confirmed.
                    </p>
                  </article>
                ) : null}
                {createdProvider.activation.items?.map((item) => (
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
            ) : null}
            <ul className="plain-list">
              {pendingVerificationEmail ? (
                <>
                  <li>Open the verification email and enter the OTP on the login screen.</li>
                  <li>Log back in with your provider account to open the provider portal.</li>
                  <li>Finish billing setup only after the email is verified.</li>
                </>
              ) : (
                <>
                  <li>Your profile can now be reviewed by the Workside team.</li>
                  <li>Billing setup and activation are the next step before you go live.</li>
                  <li>You can contact support if you need faster onboarding help.</li>
                </>
              )}
            </ul>
            <div className="button-stack">
              {pendingVerificationEmail ? (
                <>
                  <Link
                    className="button-primary"
                    href={buildProviderAuthHref({ mode: 'verify', email: pendingVerificationEmail })}
                  >
                    Verify provider account
                  </Link>
                  <Link
                    className="button-secondary"
                    href={buildProviderAuthHref({ mode: 'forgot_request', email: pendingVerificationEmail })}
                  >
                    Reset password
                  </Link>
                </>
              ) : (
                <a className="button-primary" href={`mailto:${BRANDING.supportEmail}`}>
                  Contact support
                </a>
              )}
              <Link
                className="button-secondary"
                href={buildProviderAuthHref({ mode: 'login', email: providerAccountEmail })}
              >
                Provider login
              </Link>
              <Link className="button-secondary" href="/">
                Back to homepage
              </Link>
            </div>
          </div>
        </section>
      </>
    );
  }

  if (
    appSession?.user?.email &&
    !['provider', 'admin', 'super_admin'].includes(appSession.user.role)
  ) {
    return (
      <>
        <Toast tone={toast?.tone} title={toast?.title} message={toast?.message} onClose={() => setToast(null)} />
        <section className="content-grid onboarding-shell">
          <div className="content-card">
            <span className="label">Provider onboarding</span>
            <h1>Provider accounts are separate from seller and agent accounts.</h1>
            <p>
              You are currently signed in as <strong>{appSession.user.email}</strong> with the role{' '}
              <strong>{appSession.user.role}</strong>. To create or manage a provider business, use
              a provider account instead.
            </p>
            <div className="button-stack">
              <Link
                className="button-primary"
                href={buildProviderAuthHref({ mode: 'login', email: appSession?.user?.email || '' })}
              >
                Open provider login
              </Link>
              <Link
                className="button-secondary"
                href={buildProviderAuthHref({ mode: 'forgot_request', email: appSession?.user?.email || '' })}
              >
                Reset provider password
              </Link>
              <Link className="button-secondary" href="/dashboard">
                Return to workspace
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
          <OnboardingGuide
            eyebrow="Provider onboarding"
            title="List your business and start receiving seller workflow leads."
            intro="This flow stays fast and practical: set the core profile first, then move into verification, billing, and activation without guessing what comes next."
            steps={buildProviderGuideSteps(stepIndex, signedInProvider)}
            currentStepId={`provider-onboarding-${stepIndex}`}
            footer={
              stepIndex === STEP_TITLES.length - 1
                ? 'Once the profile is submitted, Workside moves the provider into the billing and activation path instead of leaving setup unfinished.'
                : 'Each step here feeds the matching logic, trust profile, billing readiness, and provider portal experience that follow.'
            }
          />

          <div className="status-copy">
            Current step: <strong>{STEP_TITLES[stepIndex]}</strong>
          </div>
        </div>

        <form className="form-card" onSubmit={handleSubmit}>
          {existingEmailConflict ? (
            <div className="signup-decision-card signup-decision-card-warning">
              <strong>Email already in use</strong>
              <p>{existingEmailConflict}</p>
              <p>
                You can return to step 1 to use a different email address, or cancel this signup
                attempt and start over later.
              </p>
              <div className="button-stack">
                <Link
                  type="button"
                  className="button-primary"
                  href={buildProviderAuthHref({ mode: 'login', email: providerAccountEmail })}
                >
                  Log in as provider
                </Link>
                <Link
                  type="button"
                  className="button-secondary"
                  href={buildProviderAuthHref({ mode: 'forgot_request', email: providerAccountEmail })}
                >
                  Reset password
                </Link>
                <button type="button" className="button-secondary" onClick={handleReturnToStepOne}>
                  Back to step 1
                </button>
                <button type="button" className="button-secondary" onClick={handleCancelSignup}>
                  Cancel signup
                </button>
              </div>
            </div>
          ) : null}

          {stepIndex === 0 ? (
            <>
              {!signedInProvider ? (
                <div className="signup-decision-card">
                  <strong>Already have a provider account?</strong>
                  <p>
                    Use the existing provider login if your business is already in Workside, or reset
                    the password before continuing billing and activation.
                  </p>
                  <div className="button-stack">
                    <Link
                      className="button-secondary"
                      href={buildProviderAuthHref({ mode: 'login', email: providerAccountEmail })}
                    >
                      Provider login
                    </Link>
                    <Link
                      className="button-secondary"
                      href={buildProviderAuthHref({ mode: 'forgot_request', email: providerAccountEmail })}
                    >
                      Reset provider password
                    </Link>
                    <Link
                      className="button-secondary"
                      href={buildProviderAuthHref({ mode: 'verify', email: providerAccountEmail })}
                    >
                      Verify existing account
                    </Link>
                  </div>
                </div>
              ) : null}
              {!signedInProvider ? (
                <div className="split-fields">
                  <label>
                    First name
                    <input
                      value={form.firstName}
                      onChange={(event) => updateField('firstName', event.target.value)}
                      autoComplete="given-name"
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      value={form.lastName}
                      onChange={(event) => updateField('lastName', event.target.value)}
                      autoComplete="family-name"
                    />
                  </label>
                </div>
              ) : null}
              <label>
                Business name
                <input value={form.businessName} onChange={(event) => updateField('businessName', event.target.value)} />
              </label>
              <label>
                Category
                <select className="select-input" value={form.categoryKey} onChange={(event) => updateField('categoryKey', event.target.value)}>
                  {providerCategories.map((option) => (
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
                  autoComplete="tel-national"
                />
                {form.phone && !businessPhoneIsValid ? (
                  <span className="field-hint field-error">Enter a full 10-digit phone number.</span>
                ) : null}
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder="name@business.com"
                  autoComplete="email"
                />
                {form.email && !businessEmailIsValid ? (
                  <span className="field-hint field-error">Enter a valid business email address.</span>
                ) : null}
              </label>
              {!signedInProvider ? (
                <div className="split-fields">
                  <label>
                    Password
                    <PasswordInput
                      value={form.password}
                      onChange={(event) => updateField('password', event.target.value)}
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                    />
                    {form.password && !passwordLongEnough ? (
                      <span className="field-hint field-error">Use at least 8 characters.</span>
                    ) : null}
                  </label>
                  <label>
                    Confirm password
                    <PasswordInput
                      value={form.confirmPassword}
                      onChange={(event) => updateField('confirmPassword', event.target.value)}
                      placeholder="Repeat password"
                      autoComplete="new-password"
                    />
                    {form.confirmPassword && !passwordsMatch ? (
                      <span className="field-hint field-error">Passwords must match before continuing.</span>
                    ) : null}
                  </label>
                </div>
              ) : null}
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
                  <select
                    className="select-input"
                    value={form.state}
                    onChange={(event) => updateField('state', event.target.value)}
                  >
                    <option value="">Select a state</option>
                    {US_STATE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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
                    max={MAX_PROVIDER_RADIUS_MILES}
                    value={form.radiusMiles}
                    onChange={(event) => updateField('radiusMiles', event.target.value)}
                  />
                  {form.radiusMiles && !radiusMilesValid ? (
                    <span className="field-hint field-error">
                      Enter a service radius between 5 and {MAX_PROVIDER_RADIUS_MILES} miles.
                    </span>
                  ) : null}
                  {radiusLooksLarge ? (
                    <span className="field-hint field-warning">
                      {radiusMilesNumber} miles is larger than most local providers use, but it is allowed
                      if you cover a wide regional or nationwide area.
                    </span>
                  ) : null}
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
              <div className="verification-check-grid">
                <label className="consent-check compact-check">
                  <input
                    type="checkbox"
                    checked={form.hasInsurance}
                    onChange={(event) => updateField('hasInsurance', event.target.checked)}
                  />
                  <span>Insured</span>
                </label>
                <label className="consent-check compact-check">
                  <input
                    type="checkbox"
                    checked={form.hasLicense}
                    onChange={(event) => updateField('hasLicense', event.target.checked)}
                  />
                  <span>Licensed</span>
                </label>
                <label className="consent-check compact-check">
                  <input
                    type="checkbox"
                    checked={form.hasBond}
                    onChange={(event) => updateField('hasBond', event.target.checked)}
                  />
                  <span>Bonded</span>
                </label>
              </div>
              {form.hasInsurance ? (
                <div className="split-fields">
                  <label>
                    Insurance carrier
                    <input
                      value={form.insuranceCarrier}
                      onChange={(event) => updateField('insuranceCarrier', event.target.value)}
                      placeholder="State Farm, Next Insurance"
                    />
                  </label>
                  <label>
                    Policy number
                    <input
                      value={form.insurancePolicyNumber}
                      onChange={(event) => updateField('insurancePolicyNumber', event.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                </div>
              ) : null}
              {form.hasInsurance ? (
                <label>
                  Insurance expiration
                  <input
                    type="date"
                    value={form.insuranceExpirationDate}
                    onChange={(event) => updateField('insuranceExpirationDate', event.target.value)}
                  />
                </label>
              ) : null}
              {form.hasLicense ? (
                <div className="split-fields">
                  <label>
                    License number
                    <input
                      value={form.licenseNumber}
                      onChange={(event) => updateField('licenseNumber', event.target.value)}
                    />
                  </label>
                  <label>
                    License state
                    <select
                      className="select-input"
                      value={form.licenseState}
                      onChange={(event) => updateField('licenseState', event.target.value)}
                    >
                      <option value="">Select a state</option>
                      {US_STATE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              <div className="legal-notice">
                Tell sellers what you can stand behind today. You can upload insurance and license documents
                in the provider portal after signup to upgrade your trust profile and submit for review.
              </div>
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
              <div className="split-fields split-fields-lead-routing">
                <label>
                  SMS phone
                  <input
                    value={form.notifyPhone}
                    onChange={(event) => updateField('notifyPhone', event.target.value)}
                    placeholder="(555) 123-4567"
                    inputMode="tel"
                  />
                  {form.notifyPhone && !notifyPhoneIsValid ? (
                    <span className="field-hint field-error">Enter a full 10-digit SMS number.</span>
                  ) : null}
                </label>
                <label>
                  Lead email
                  <input
                    type="email"
                    value={form.notifyEmail}
                    onChange={(event) => updateField('notifyEmail', event.target.value)}
                    placeholder="leads@business.com"
                  />
                  {form.notifyEmail && !leadEmailIsValid ? (
                    <span className="field-hint field-error">Enter a valid lead email address.</span>
                  ) : null}
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
                  I agree to receive transactional SMS messages from Workside Home Advisor regarding
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
                    <em className="onboarding-plan-price">
                      {providerPlanDetails[plan.value]?.priceLabel ||
                        (plan.value === 'provider_basic'
                          ? 'Free'
                          : plansLoading
                            ? 'Loading price...'
                            : 'Configured at checkout')}
                    </em>
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
                {!['provider', 'admin', 'super_admin'].includes(appSession?.user?.role || '')
                  ? 'Your provider account must verify its email before billing setup can continue.'
                  : 'Billing checkout is the next step after profile submission. For now, your business will be created in a pending billing state so the Workside team can finish setup.'}
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
              <button type="button" className="button-primary" onClick={handleNext} disabled={!isCurrentStepReady()}>
                Continue
              </button>
            ) : (
              <button
                type="submit"
                className={loading ? 'button-primary button-busy' : 'button-primary'}
                disabled={loading || !isCurrentStepReady()}
              >
                {loading
                  ? 'Submitting...'
                  : !signedInProvider
                    ? 'Create account and send verification code'
                    : 'Submit and continue to billing'}
              </button>
            )}
          </div>
        </form>
      </section>
    </>
  );
}
