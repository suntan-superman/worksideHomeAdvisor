'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeLandingAttribution } from '@workside/utils';

import { AppFrame } from '../../components/AppFrame';
import { PasswordInput } from '../../components/PasswordInput';
import { Toast } from '../../components/Toast';
import {
  login,
  requestOtp,
  signup,
  verifyEmailOtp,
} from '../../lib/api';
import { setStoredSession } from '../../lib/session';

const ROLE_OPTIONS = [
  { value: 'seller', label: 'Seller', description: 'Use the seller workspace and listing prep tools.' },
  { value: 'agent', label: 'Realtor', description: 'Use agent-facing pricing and presentation workflows.' },
  { value: 'provider', label: 'Provider', description: 'Manage provider onboarding, leads, and marketplace profile.' },
];
const AUTH_ATTRIBUTION_DRAFT_KEY = 'worksideAuthAttributionDraft';

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function getRoleDestination(role) {
  if (role === 'provider') {
    return '/providers/portal';
  }

  return '/dashboard';
}

function getRoleStatus(role, mode = 'login') {
  if (mode === 'signup') {
    if (role === 'provider') {
      return 'Create a provider account first, then verify your email before setting up your business profile.';
    }
    if (role === 'agent') {
      return 'Create a realtor account first, then verify your email to open pricing and listing workflows.';
    }
    return 'Create an account first, then verify your email with the OTP we send.';
  }

  if (role === 'provider') {
    return 'Log in with your email and password to open your provider workspace.';
  }
  if (role === 'agent') {
    return 'Log in with your email and password to open your agent workspace.';
  }
  return 'Log in with your email and password to open your seller workspace.';
}

function buildOnboardingSteps(role) {
  if (role === 'provider') {
    return [
      'Create your provider account',
      'Verify your email',
      'Finish marketplace profile and billing',
    ];
  }

  if (role === 'agent') {
    return [
      'Create your agent login',
      'Verify your email',
      'Open the listing workspace and add your first property',
    ];
  }

  return [
    'Create your seller login',
    'Verify your email',
    'Open the guided workspace and create your property',
  ];
}

function persistAuthAttributionDraft(attribution) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!attribution) {
    window.sessionStorage.removeItem(AUTH_ATTRIBUTION_DRAFT_KEY);
    return;
  }

  window.sessionStorage.setItem(
    AUTH_ATTRIBUTION_DRAFT_KEY,
    JSON.stringify({
      attribution,
      capturedAt: new Date().toISOString(),
    }),
  );
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    otpCode: '',
    role: 'seller',
  });
  const [status, setStatus] = useState(getRoleStatus('seller', 'login'));
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showVerificationOption, setShowVerificationOption] = useState(false);
  const [attribution, setAttribution] = useState(null);

  const isVerificationMode = mode === 'verify';
  const emailIsValid = isValidEmail(form.email);
  const passwordLongEnough = form.password.length >= 8;
  const formIsReady =
    mode === 'signup'
      ? Boolean(
          form.firstName.trim() &&
            form.lastName.trim() &&
            emailIsValid &&
            passwordLongEnough,
        )
      : mode === 'login'
        ? Boolean(emailIsValid && form.password)
        : Boolean(emailIsValid && form.otpCode.trim().length >= 4);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const timedOut = params.get('timedOut') === '1';
    const requestedMode = params.get('mode');
    const requestedEmail = String(params.get('email') || '').trim();
    const requestedRole = String(params.get('role') || '').trim();
    const requestedFirstName = String(params.get('firstName') || '').trim();
    const requestedPassword = String(params.get('prefillPassword') || '').trim();
    const requestedSource = String(params.get('src') || '').trim();
    const requestedMedium = String(params.get('medium') || '').trim();
    const requestedCampaign = String(params.get('campaign') || '').trim();
    const requestedAdset = String(params.get('adset') || '').trim();
    const requestedAd = String(params.get('ad') || '').trim();
    const requestedAnonymousId = String(params.get('anonymousId') || '').trim();
    const roleIsSupported = ROLE_OPTIONS.some((option) => option.value === requestedRole);
    const nextRole = roleIsSupported ? requestedRole : form.role;

    setAttribution(
      normalizeLandingAttribution({
        source: requestedSource,
        medium: requestedMedium,
        campaign: requestedCampaign,
        adset: requestedAdset,
        ad: requestedAd,
        anonymousId: requestedAnonymousId,
        roleIntent: nextRole,
        route: '/auth',
        landingPath: '/auth',
        referrer: document.referrer,
      }),
    );

    if (requestedEmail) {
      setForm((current) => ({
        ...current,
        email: requestedEmail,
        password: requestedPassword || '',
        firstName: requestedFirstName || current.firstName,
        otpCode: '',
        role: nextRole,
      }));
    }

    if (requestedMode === 'verify' && requestedEmail) {
      setMode('verify');
      setShowVerificationOption(true);
      setStatus(`Enter the OTP sent to ${requestedEmail} to finish verification.`);
      return;
    }

    if (requestedMode === 'signup') {
      setMode('signup');
      setShowVerificationOption(false);
      setStatus(getRoleStatus(roleIsSupported ? requestedRole : form.role, 'signup'));
    } else if (roleIsSupported) {
      setStatus(getRoleStatus(requestedRole, mode));
    }

    if (!timedOut) {
      return;
    }

    setMode('login');
    setShowVerificationOption(false);
    setStatus('You were signed out after 30 minutes of inactivity. Sign in again to continue.');
    setToast({
      tone: 'info',
      title: 'Session timed out',
      message: 'For security, your Workside session was closed after inactivity.',
    });
  }, []);

  useEffect(() => {
    if (!attribution) {
      return;
    }

    if (
      !attribution.source &&
      !attribution.campaign &&
      !attribution.medium &&
      !attribution.adset &&
      !attribution.ad
    ) {
      return;
    }

    persistAuthAttributionDraft(attribution);
  }, [attribution]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function switchToLogin() {
    setMode('login');
    setStatus(getRoleStatus(form.role, 'login'));
  }

  function switchToSignup() {
    setMode('signup');
    setStatus(getRoleStatus(form.role, 'signup'));
  }

  async function handlePrimaryAction(event) {
    event.preventDefault();
    setLoading(true);
    setToast(null);

    try {
      if (mode === 'signup') {
        await signup({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          role: form.role,
          attribution: attribution
            ? {
                ...attribution,
                anonymousId: attribution.anonymousId || '',
              }
            : undefined,
        });
        persistAuthAttributionDraft(
          attribution
            ? {
                ...attribution,
                roleIntent: form.role,
              }
            : null,
        );
        setMode('verify');
        setShowVerificationOption(true);
        setStatus('Account created. Enter the OTP from your email to finish verification.');
        setToast({
          tone: 'success',
          title: 'Account created',
          message: 'Check your inbox for the verification code.',
        });
      } else if (mode === 'login') {
        const result = await login({
          email: form.email,
          password: form.password,
        });

        if (result.requiresOtpVerification) {
          setMode('verify');
          setShowVerificationOption(true);
          setStatus('Your email still needs verification. Enter the OTP we just sent.');
          setToast({
            tone: 'info',
            title: 'Verification needed',
            message: 'We sent a fresh verification code to your email.',
          });
          return;
        }

        setStoredSession({
          token: result.token,
          user: result.user,
        });
        persistAuthAttributionDraft(
          attribution
            ? {
                ...attribution,
                roleIntent: result.user?.role || form.role,
              }
            : null,
        );
        setStatus('Login complete.');
        router.push(getRoleDestination(result.user?.role));
      } else {
        const result = await verifyEmailOtp({
          email: form.email,
          otpCode: form.otpCode,
        });
        setStoredSession({
          token: result.token,
          user: result.user,
        });
        persistAuthAttributionDraft(
          attribution
            ? {
                ...attribution,
                roleIntent: result.user?.role || form.role,
              }
            : null,
        );
        setStatus('Email verified. Redirecting to your dashboard.');
        setShowVerificationOption(false);
        setToast({
          tone: 'success',
          title: 'Email verified',
          message:
            result.user?.role === 'provider'
              ? 'Your provider workspace is ready.'
              : result.user?.role === 'agent'
                ? 'Your agent workspace is ready.'
                : 'Your seller dashboard is ready.',
        });
        router.push(getRoleDestination(result.user?.role));
      }
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: mode === 'signup' ? 'Could not create account' : mode === 'login' ? 'Login failed' : 'Verification failed',
        message: requestError.message,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setLoading(true);
    setToast(null);

    try {
      await requestOtp({ email: form.email });
      setStatus('A fresh verification code was sent.');
      setToast({
        tone: 'success',
        title: 'Code resent',
        message: 'A fresh verification code is on its way.',
      });
    } catch (requestError) {
      setToast({
        tone: 'error',
        title: 'Could not resend code',
        message: requestError.message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppFrame>
      <Toast
        tone={toast?.tone}
        title={toast?.title}
        message={toast?.message}
        onClose={() => setToast(null)}
      />
      <section className="content-grid">
        <div className="content-card">
          <span className="label">Auth foundation</span>
          <h1>Email, password, then OTP verification.</h1>
          <p>
            The API scaffold already includes signup, login, resend-OTP, and
            verify-email endpoints. The UI here is the first shell for wiring
            the live forms next.
          </p>
          <div className="mode-switch">
            <button
              type="button"
              className={mode === 'login' ? 'mode-chip active' : 'mode-chip'}
              onClick={switchToLogin}
            >
              Log in
            </button>
            <button
              type="button"
              className={mode === 'signup' ? 'mode-chip active' : 'mode-chip'}
              onClick={switchToSignup}
            >
              Sign up
            </button>
            {showVerificationOption ? (
              <button
                type="button"
                className={mode === 'verify' ? 'mode-chip active' : 'mode-chip'}
                onClick={() => {
                  setMode('verify');
                  setStatus('Enter the OTP from your email to complete verification.');
                }}
              >
                Verify OTP
              </button>
            ) : null}
          </div>
          <p className="status-copy">{status}</p>
          <div className="content-subsection">
            <span className="label">Guided onboarding</span>
            <div className="plain-list">
              {buildOnboardingSteps(form.role).map((step) => (
                <p key={step}>{step}</p>
              ))}
            </div>
            {attribution?.campaign ? (
              <p className="status-copy">
                Campaign: <strong>{attribution.campaign}</strong>
                {attribution.platform ? ` · ${attribution.platform}` : ''}
              </p>
            ) : null}
          </div>
        </div>

        <form className="form-card" onSubmit={handlePrimaryAction}>
          {mode === 'signup' ? (
            <>
              <label>
                Account type
                <select
                  className="select-input"
                  value={form.role}
                  onChange={(event) => {
                    updateField('role', event.target.value);
                    setStatus(getRoleStatus(event.target.value, 'signup'));
                  }}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="status-copy">
                {
                  ROLE_OPTIONS.find((option) => option.value === form.role)?.description
                }
              </div>
              <label>
                First name
                <input
                  type="text"
                  placeholder="Jamie"
                  value={form.firstName}
                  onChange={(event) => updateField('firstName', event.target.value)}
                />
              </label>
              <label>
                Last name
                <input
                  type="text"
                  placeholder="Seller"
                  value={form.lastName}
                  onChange={(event) => updateField('lastName', event.target.value)}
                />
              </label>
            </>
          ) : null}

          <label>
            Email
            <input
              type="email"
              placeholder="seller@example.com"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
            />
            {form.email && !emailIsValid ? (
              <span className="field-hint field-error">Enter a valid email address.</span>
            ) : null}
          </label>

          {!isVerificationMode ? (
            <label>
              Password
              <PasswordInput
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                placeholder="Minimum 8 characters"
              />
              {mode === 'signup' && form.password && !passwordLongEnough ? (
                <span className="field-hint field-error">Use at least 8 characters.</span>
              ) : null}
            </label>
          ) : null}

          {isVerificationMode ? (
            <label>
              Verification code
              <input
                type="text"
                placeholder="6-digit OTP"
                value={form.otpCode}
                onChange={(event) => updateField('otpCode', event.target.value)}
              />
            </label>
          ) : null}

          <button type="submit" className="button-primary" disabled={loading || !formIsReady}>
            {loading ? 'Working...' : mode === 'signup' ? 'Create account' : mode === 'login' ? 'Log in' : 'Verify email'}
          </button>

          {isVerificationMode ? (
            <button
              type="button"
              className="button-secondary"
              onClick={handleResendOtp}
              disabled={loading || !emailIsValid}
            >
              Resend code
            </button>
          ) : null}
        </form>
      </section>
    </AppFrame>
  );
}
