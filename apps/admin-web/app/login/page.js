'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState('/');
  const [email, setEmail] = useState('admin@workside.software');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('Sign in with an admin account from the main Workside auth system.');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setNextPath(params.get('next') || '/');
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || `Login failed with ${response.status}`);
      }

      if (payload.requiresOtpVerification) {
        throw new Error('This account still needs email verification. Verify it in the main app first.');
      }

      if (!payload.user || !['admin', 'super_admin'].includes(payload.user.role)) {
        throw new Error('That account is valid, but it does not have admin access.');
      }

      const sessionResponse = await fetch('/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: payload.token }),
      });

      if (!sessionResponse.ok) {
        throw new Error('Could not save the admin session.');
      }

      setStatus(`Signed in as ${payload.user.email}. Redirecting...`);
      router.replace(nextPath);
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel auth-panel">
      <div className="auth-shell">
        <div className="pill">Admin Access</div>
        <h1>Workside Admin Login</h1>
        <p className="muted">
          Use the same email and password as the regular app, but the account must have
          an admin role.
        </p>
        <p className="muted auth-helper">
          Local note: `admin-web` prefers `ADMIN_API_URL` or `NEXT_PUBLIC_ADMIN_API_URL`
          before falling back to the shared API env.
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button type="submit" className="admin-button" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="muted">{status}</p>
        {error ? <div className="notice error">{error}</div> : null}
      </div>
    </section>
  );
}
