'use client';

const SESSION_KEY = 'worksideHomeSellerSession';
const SESSION_LAST_ACTIVITY_KEY = 'worksideHomeSellerSessionLastActivityAt';

export function getStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredSession(session) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  if (session) {
    touchStoredSessionActivity();
  }
}

export function clearStoredSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
}

export function getStoredSessionLastActivityAt() {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem(SESSION_LAST_ACTIVITY_KEY);
  const parsedValue = Number(rawValue || 0);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

export function touchStoredSessionActivity(timestamp = Date.now()) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(timestamp));
}
