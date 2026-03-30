'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export function AdminIdleLogoutManager() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname || pathname === '/login') {
      return undefined;
    }

    let timeoutId = null;

    async function handleIdleTimeout() {
      try {
        await fetch('/api/session', {
          method: 'DELETE',
        });
      } catch {
        // Best effort only. We still force a fresh login.
      }

      router.replace('/login?timedOut=1');
      router.refresh();
    }

    function resetTimer() {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(handleIdleTimeout, ADMIN_IDLE_TIMEOUT_MS);
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'focus'];
    events.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer);
    });

    resetTimer();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      events.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
    };
  }, [pathname, router]);

  return null;
}
