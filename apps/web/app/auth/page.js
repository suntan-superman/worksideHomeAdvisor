'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AppFrame } from '../../components/AppFrame';
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
  const [error, setError] = useState('');
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
    setError('');

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
      } else if (mode === 'login') {
        const result = await login({
          email: form.email,
          password: form.password,
        });

        if (result.requiresOtpVerification) {
          setMode('verify');
          setStatus('Your email still needs verification. Enter the OTP we just sent.');
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
        router.push('/dashboard');
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setLoading(true);
    setError('');

    try {
      await requestOtp({ email: form.email });
      setStatus('A fresh verification code was sent.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppFrame>
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
          {error ? <p className="error-copy">{error}</p> : null}
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
