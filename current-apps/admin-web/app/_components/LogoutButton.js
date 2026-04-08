'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch('/api/session', {
        method: 'DELETE',
      });
      router.replace('/login');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className="sidebar-logout" onClick={handleLogout} disabled={loading}>
      {loading ? 'Signing out...' : 'Sign out'}
    </button>
  );
}
