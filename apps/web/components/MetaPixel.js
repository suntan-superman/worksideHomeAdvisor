'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function MetaPixelRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousPathRef = useRef('');

  useEffect(() => {
    const nextPath = `${pathname || ''}?${searchParams?.toString() || ''}`;
    if (!previousPathRef.current) {
      previousPathRef.current = nextPath;
      return;
    }
    if (previousPathRef.current === nextPath) return;

    previousPathRef.current = nextPath;
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'PageView');
    }
  }, [pathname, searchParams]);

  return null;
}
