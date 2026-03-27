'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { BRANDING } from '@workside/branding';
import { clearStoredSession, getStoredSession } from '../lib/session';

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
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/auth">Auth</Link>
          <Link href={session?.lastPropertyId ? `/properties/${session.lastPropertyId}` : '/dashboard'}>
            Last property
          </Link>
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
          ) : null}
        </nav>
      </header>

      <main>{children}</main>
    </div>
  );
}
