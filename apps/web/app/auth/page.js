'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  formatPhoneForDisplay,
  normalizeLandingAttribution,
} from '@workside/utils';

import { AppFrame } from '../../components/AppFrame';
import { OnboardingGuide } from '../../components/OnboardingGuide';
import { PasswordInput } from '../../components/PasswordInput';
import { Toast } from '../../components/Toast';
import {
  clearStoredAuthOnboardingState,
  getStoredAuthOnboardingState,
  setStoredAuthOnboardingState,
} from '../../lib/onboarding-state';
import {
  login,
  requestForgotPasswordOtp,
  requestOtp,
  resetForgottenPassword,
  signup,
  verifyEmailOtp,
  verifyForgotPasswordOtp,
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
  if (mode === 'forgot_request') {
    return 'Enter your account email and we will send a short-lived reset code.';
  }
  if (mode === 'forgot_verify') {
    return 'Enter the reset code from your email so Workside can unlock the new-password step.';
  }
  if (mode === 'forgot_reset') {
    return 'Choose a new password, confirm it, and we will sign you back in.';
  }
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

function buildAuthGuideSteps({ role, mode, email }) {
  const roleLabel = ROLE_OPTIONS.find((option) => option.value === role)?.label || 'Seller';
  const emailReady = isValidEmail(email);
  const isVerificationMode = mode === 'verify';
  const isSignupMode = mode === 'signup';

  return [
    {
      id: 'choose-role',
      title: 'Choose your account path',
      detail: `Use the ${roleLabel.toLowerCase()} path so Workside sends you to the right workspace after login.`,
      helper: 'If you are signing up, choose the role first so the guided workflow and destination are correct.',
      status: 'complete',
    },
    {
      id: 'credentials',
      title: isSignupMode ? 'Create your login' : 'Enter your credentials',
      detail: isSignupMode
        ? 'Add the basics for your account so Workside can create the login and send verification.'
        : 'Use your verified email and password to continue into the workspace.',
      helper: isSignupMode
        ? 'Seller and realtor accounts go to the dashboard. Providers continue into the provider workspace.'
        : 'If the account still needs verification, Workside will move you into the OTP step automatically.',
      status: isVerificationMode ? 'complete' : 'active',
    },
    {
      id: 'verify-email',
      title: 'Verify your email',
      detail: emailReady
        ? `Enter the OTP sent to ${email} so we can unlock the workspace.`
        : 'Use the OTP from your inbox to verify the email and finish setup.',
      helper: 'You can resend the code at any time if the inbox message is delayed.',
      status: isVerificationMode ? 'active' : isSignupMode ? 'upcoming' : 'upcoming',
    },
    {
      id: 'enter-workspace',
      title: role === 'provider' ? 'Open your provider workspace' : 'Open your guided workspace',
      detail:
        role === 'provider'
          ? 'Finish marketplace profile, verification, and billing setup once the account is live.'
          : 'Create the property and let the guided workflow carry pricing, prep, photos, providers, and materials.',
      helper:
        role === 'provider'
          ? 'This is where marketplace profile, verification, and lead routing all come together.'
          : 'This is where the real pricing, checklist, provider, and marketing workflow begins.',
      status: 'upcoming',
    },
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
    confirmPassword: '',
    firstName: '',
    lastName: '',
    mobilePhone: '',
    smsOptIn: false,
    otpCode: '',
    resetToken: '',
    role: 'seller',
  });
  const [status, setStatus] = useState(getRoleStatus('seller', 'login'));
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showVerificationOption, setShowVerificationOption] = useState(false);
  const [attribution, setAttribution] = useState(null);
  const [authStateHydrated, setAuthStateHydrated] = useState(false);
  const [restoredAuthProgress, setRestoredAuthProgress] = useState(false);

  const isEmailVerificationMode = mode === 'verify';
  const isForgotRequestMode = mode === 'forgot_request';
  const isForgotVerifyMode = mode === 'forgot_verify';
  const isForgotResetMode = mode === 'forgot_reset';
  const isVerificationMode = isEmailVerificationMode || isForgotVerifyMode;
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
        : isForgotRequestMode
          ? Boolean(emailIsValid)
          : isForgotVerifyMode
            ? Boolean(emailIsValid && form.otpCode.trim().length >= 4)
            : isForgotResetMode
              ? Boolean(form.resetToken && passwordLongEnough && form.password === form.confirmPassword)
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
    const nextRole = roleIsSupported ? requestedRole : 'seller';
    const hasExplicitQueryContext = Boolean(
      timedOut ||
        requestedMode ||
        requestedEmail ||
        requestedRole ||
        requestedFirstName ||
        requestedPassword ||
        requestedSource ||
        requestedMedium ||
        requestedCampaign ||
        requestedAdset ||
        requestedAd ||
        requestedAnonymousId,
    );

    if (!hasExplicitQueryContext) {
      const restoredState = getStoredAuthOnboardingState();
      if (restoredState) {
        const restoredMode = ['login', 'signup', 'verify', 'forgot_request', 'forgot_verify', 'forgot_reset'].includes(restoredState.mode)
          ? restoredState.mode
          : 'login';
        const restoredForm = restoredState.form && typeof restoredState.form === 'object' ? restoredState.form : {};
        const restoredRole = ROLE_OPTIONS.some((option) => option.value === restoredForm.role)
          ? restoredForm.role
          : 'seller';

        setForm((current) => ({
          ...current,
          ...restoredForm,
          role: restoredRole,
        }));
        setMode(restoredMode);
        setShowVerificationOption(Boolean(restoredState.showVerificationOption) || restoredMode === 'verify');
        setStatus(restoredState.status || getRoleStatus(restoredRole, restoredMode));
        setAttribution(restoredState.attribution || null);
        setRestoredAuthProgress(true);
        setAuthStateHydrated(true);
        return;
      }
    }

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
      setAuthStateHydrated(true);
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
      setAuthStateHydrated(true);
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
    setAuthStateHydrated(true);
  }, []);

  useEffect(() => {
    if (!authStateHydrated) {
      return;
    }

    setStoredAuthOnboardingState({
      mode,
      form,
      status,
      showVerificationOption,
      attribution,
    });
  }, [attribution, authStateHydrated, form, mode, showVerificationOption, status]);

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

  function switchToForgotPassword() {
    setMode('forgot_request');
    setShowVerificationOption(false);
    setStatus(getRoleStatus(form.role, 'forgot_request'));
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
          mobilePhone: form.mobilePhone,
          smsOptIn: form.smsOptIn,
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
        clearStoredAuthOnboardingState();
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
      } else if (mode === 'verify') {
        const result = await verifyEmailOtp({
          email: form.email,
          otpCode: form.otpCode,
        });
        setStoredSession({
          token: result.token,
          user: result.user,
        });
        clearStoredAuthOnboardingState();
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
      } else if (mode === 'forgot_request') {
        await requestForgotPasswordOtp({
          email: form.email,
        });
        setMode('forgot_verify');
        setStatus('Check your inbox and enter the password reset code.');
        setToast({
          tone: 'success',
          title: 'Reset code sent',
          message: 'If that account exists, a password reset code is on the way.',
        });
      } else if (mode === 'forgot_verify') {
        const result = await verifyForgotPasswordOtp({
          email: form.email,
          otpCode: form.otpCode,
        });
        updateField('resetToken', result.resetToken);
        updateField('otpCode', '');
        updateField('password', '');
        updateField('confirmPassword', '');
        setMode('forgot_reset');
        setStatus('Set a new password for this account.');
        setToast({
          tone: 'success',
          title: 'Code verified',
          message: 'You can set a new password now.',
        });
      } else if (mode === 'forgot_reset') {
        const result = await resetForgottenPassword({
          resetToken: form.resetToken,
          newPassword: form.password,
          confirmPassword: form.confirmPassword,
        });
        setStoredSession({
          token: result.token,
          user: result.user,
        });
        clearStoredAuthOnboardingState();
        setStatus('Password updated. Redirecting to your workspace.');
        setToast({
          tone: 'success',
          title: 'Password updated',
          message: 'You are signed back in with the new password.',
        });
        router.push(getRoleDestination(result.user?.role));
      }
    } catch (requestError) {
      setToast({
        tone: 'error',
        title:
          mode === 'signup'
            ? 'Could not create account'
            : mode === 'login'
              ? 'Login failed'
              : mode === 'forgot_request'
                ? 'Could not send reset code'
                : mode === 'forgot_verify'
                  ? 'Reset code failed'
                  : mode === 'forgot_reset'
                    ? 'Could not reset password'
                    : 'Verification failed',
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
          <OnboardingGuide
            eyebrow="Auth foundation"
            title="Email, password, then OTP verification."
            intro="Move through account setup in a predictable order, then continue directly into the workspace for your role."
            steps={buildAuthGuideSteps({
              role: form.role,
              mode,
              email: form.email,
            })}
            currentStepId={mode === 'verify' ? 'verify-email' : 'credentials'}
            footer={
              attribution?.campaign
                ? `Campaign context is already attached, so this account will carry the ad attribution into signup and the first workspace steps.`
                : 'Once the account is live, Workside carries you straight into the next guided workspace instead of leaving you at a dead-end auth screen.'
            }
          />
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
            {(isForgotRequestMode || isForgotVerifyMode || isForgotResetMode) ? (
              <button
                type="button"
                className={
                  isForgotRequestMode || isForgotVerifyMode || isForgotResetMode
                    ? 'mode-chip active'
                    : 'mode-chip'
                }
                onClick={switchToForgotPassword}
              >
                Reset password
              </button>
            ) : null}
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
          {restoredAuthProgress ? (
            <p className="status-copy">
              Your previous auth progress was restored in this browser so you can continue where you left off.
            </p>
          ) : null}
          <p className="status-copy">{status}</p>
          {attribution?.campaign ? (
            <p className="status-copy">
              Campaign: <strong>{attribution.campaign}</strong>
              {attribution.platform ? ` · ${attribution.platform}` : ''}
            </p>
          ) : null}
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
              <label>
                Mobile number
                <input
                  type="tel"
                  placeholder="(661) 555-1212"
                  value={form.mobilePhone}
                  onChange={(event) => updateField('mobilePhone', formatPhoneForDisplay(event.target.value))}
                />
              </label>
              <label className="workspace-checkbox-field">
                <input
                  type="checkbox"
                  checked={form.smsOptIn}
                  onChange={(event) => updateField('smsOptIn', event.target.checked)}
                />
                <span>
                  I agree to receive transactional SMS messages from Workside Home Advisor regarding account activity, provider responses, and listing workflow updates. Message frequency varies. Reply STOP to opt out.
                </span>
              </label>
            </>
          ) : null}

          {!isForgotResetMode ? (
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
          ) : null}

          {!isVerificationMode && !isForgotRequestMode ? (
            <label>
              {isForgotResetMode ? 'New password' : 'Password'}
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

          {isForgotResetMode ? (
            <label>
              Confirm password
              <PasswordInput
                value={form.confirmPassword}
                onChange={(event) => updateField('confirmPassword', event.target.value)}
                placeholder="Re-enter new password"
              />
              {form.confirmPassword && form.password !== form.confirmPassword ? (
                <span className="field-hint field-error">Passwords must match.</span>
              ) : null}
            </label>
          ) : null}

          {isVerificationMode ? (
            <label>
              {isForgotVerifyMode ? 'Password reset code' : 'Verification code'}
              <input
                type="text"
                placeholder="6-digit OTP"
                value={form.otpCode}
                onChange={(event) => updateField('otpCode', event.target.value)}
              />
            </label>
          ) : null}

          <button type="submit" className="button-primary" disabled={loading || !formIsReady}>
            {loading
              ? 'Working...'
              : mode === 'signup'
                ? 'Create account'
                : mode === 'login'
                  ? 'Log in'
                  : mode === 'forgot_request'
                    ? 'Send reset code'
                    : mode === 'forgot_verify'
                      ? 'Verify reset code'
                      : mode === 'forgot_reset'
                        ? 'Set new password'
                        : 'Verify email'}
          </button>

          {isVerificationMode ? (
            <button
              type="button"
              className="button-secondary"
              onClick={isForgotVerifyMode ? () => requestForgotPasswordOtp({ email: form.email }) : handleResendOtp}
              disabled={loading || !emailIsValid}
            >
              Resend code
            </button>
          ) : null}

          {mode === 'login' ? (
            <button
              type="button"
              className="button-secondary"
              onClick={switchToForgotPassword}
              disabled={loading}
            >
              Forgot password?
            </button>
          ) : null}

          {(isForgotRequestMode || isForgotVerifyMode || isForgotResetMode) ? (
            <button
              type="button"
              className="button-secondary"
              onClick={switchToLogin}
              disabled={loading}
            >
              Back to login
            </button>
          ) : null}
        </form>
      </section>
    </AppFrame>
  );
}
