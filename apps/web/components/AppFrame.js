'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { BRANDING } from '@workside/branding';
import { clearStoredSession, getStoredSession } from '../lib/session';

export function AppFrame({ children }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    setSession(getStoredSession());
  }, []);

  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">{BRANDING.poweredBy}</div>
          <Link href="/" className="brandmark">
            {BRANDING.productName}
          </Link>
        </div>

        <nav className="topnav">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/auth">Auth</Link>
          <Link href={session?.lastPropertyId ? `/properties/${session.lastPropertyId}` : '/dashboard'}>
            Property
          </Link>
          {session?.user?.email ? (
            <button
              type="button"
              className="nav-button"
              onClick={() => {
                clearStoredSession();
                setSession(null);
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
