'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { BRANDING } from '@workside/branding';
import { clearStoredSession, getStoredSession } from '../lib/session';

function getDisplayName(user) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || 'Signed-in user';
}

export function AppFrame({ children, busy = false }) {
  const router = useRouter();
  const [session, setSession] = useState(null);

  useEffect(() => {
    setSession(getStoredSession());
  }, []);

  return (
    <div className={busy ? 'page-shell page-shell-busy' : 'page-shell'}>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="eyebrow">{BRANDING.poweredBy}</div>
          <Link href="/" className="brandmark">
            {BRANDING.productName}
          </Link>
        </div>

        <nav className="topnav">
          {session?.user?.email ? (
            <div className="session-pill">
              <strong>{getDisplayName(session.user)}</strong>
              <span>{session.user.email}</span>
            </div>
          ) : null}
          {session?.user?.email ? (
            <>
              <Link href="/dashboard">Dashboard</Link>
              <Link href={session?.lastPropertyId ? `/properties/${session.lastPropertyId}` : '/dashboard'}>
                Last property
              </Link>
            </>
          ) : null}
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          {session?.user?.email ? (
            <button
              type="button"
              className="nav-button"
              onClick={() => {
                clearStoredSession();
                setSession(null);
                router.push('/');
              }}
            >
              Sign out
            </button>
          ) : (
            <Link href="/auth" className="nav-button nav-link-button">
              Log in
            </Link>
          )}
        </nav>
      </header>

      <main>{children}</main>
      <footer className="site-footer">
        <span>Copyright 2026 Workside Software LLC.</span>
        <Link href="/terms">Terms of Service</Link>
        <Link href="/privacy">Privacy Notice</Link>
        <Link href="/sms-consent">SMS Consent</Link>
        <a href="mailto:support@worksidesoftware.com">support@worksidesoftware.com</a>
        <a href="mailto:sales@worksidesoftware.com">sales@worksidesoftware.com</a>
        <a href="mailto:feedback@worksidesoftware.com">feedback@worksidesoftware.com</a>
      </footer>
    </div>
  );
}
