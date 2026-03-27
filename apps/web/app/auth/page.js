'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AppFrame } from '../../components/AppFrame';
import { Toast } from '../../components/Toast';
import {
  login,
  requestOtp,
  signup,
  verifyEmailOtp,
} from '../../lib/api';
import { setStoredSession } from '../../lib/session';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState('signup');
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    otpCode: '',
  });
  const [status, setStatus] = useState('Use signup to create an account, then verify the OTP sent to your email.');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  const isVerificationMode = useMemo(() => mode === 'verify', [mode]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
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
        });
        setMode('verify');
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
        setStatus('Login complete.');
        router.push('/dashboard');
      } else {
        const result = await verifyEmailOtp({
          email: form.email,
          otpCode: form.otpCode,
        });
        setStoredSession({
          token: result.token,
          user: result.user,
        });
        setStatus('Email verified. Redirecting to your dashboard.');
        setToast({
          tone: 'success',
          title: 'Email verified',
          message: 'Your seller dashboard is ready.',
        });
        router.push('/dashboard');
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
              className={mode === 'signup' ? 'mode-chip active' : 'mode-chip'}
              onClick={() => setMode('signup')}
            >
              Sign up
            </button>
            <button
              type="button"
              className={mode === 'login' ? 'mode-chip active' : 'mode-chip'}
              onClick={() => setMode('login')}
            >
              Log in
            </button>
            <button
              type="button"
              className={mode === 'verify' ? 'mode-chip active' : 'mode-chip'}
              onClick={() => setMode('verify')}
            >
              Verify OTP
            </button>
          </div>
          <p className="status-copy">{status}</p>
        </div>

        <form className="form-card" onSubmit={handlePrimaryAction}>
          {mode === 'signup' ? (
            <>
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
          </label>

          {!isVerificationMode ? (
            <label>
              Password
              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
              />
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

          <button type="submit" className="button-primary" disabled={loading}>
            {loading ? 'Working...' : mode === 'signup' ? 'Create account' : mode === 'login' ? 'Log in' : 'Verify email'}
          </button>

          {isVerificationMode ? (
            <button
              type="button"
              className="button-secondary"
              onClick={handleResendOtp}
              disabled={loading || !form.email}
            >
              Resend code
            </button>
          ) : null}
        </form>
      </section>
    </AppFrame>
  );
}
