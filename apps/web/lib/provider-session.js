'use client';

const PROVIDER_SESSION_KEY = 'worksideProviderPortalSession';

export function getStoredProviderSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PROVIDER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredProviderSession(session) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PROVIDER_SESSION_KEY, JSON.stringify(session));
}

export function clearStoredProviderSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(PROVIDER_SESSION_KEY);
}
