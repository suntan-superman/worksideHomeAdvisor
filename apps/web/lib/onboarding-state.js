const AUTH_ONBOARDING_STATE_KEY = 'worksideAuthOnboardingState';
const PROVIDER_ONBOARDING_STATE_KEY = 'worksideProviderOnboardingState';
const DEFAULT_MAX_AGE_MS = 1000 * 60 * 60 * 24;

function isBrowser() {
  return typeof window !== 'undefined';
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function sanitizeOnboardingState(payload, options = {}) {
  if (!isPlainObject(payload)) {
    return null;
  }

  const maxAgeMs =
    Number.isFinite(options.maxAgeMs) && options.maxAgeMs > 0
      ? Number(options.maxAgeMs)
      : DEFAULT_MAX_AGE_MS;

  const updatedAtValue = payload.updatedAt || payload.savedAt || '';
  const updatedAtTime = updatedAtValue ? new Date(updatedAtValue).getTime() : Number.NaN;
  if (Number.isFinite(updatedAtTime) && Date.now() - updatedAtTime > maxAgeMs) {
    return null;
  }

  return {
    ...payload,
    updatedAt: Number.isFinite(updatedAtTime) ? new Date(updatedAtTime).toISOString() : new Date().toISOString(),
  };
}

export function readOnboardingStateFromStorage(storage, storageKey, options = {}) {
  if (!storage || !storageKey) {
    return null;
  }

  try {
    const rawValue = storage.getItem(storageKey);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    const sanitized = sanitizeOnboardingState(parsed, options);
    if (!sanitized) {
      storage.removeItem(storageKey);
      return null;
    }

    return sanitized;
  } catch {
    return null;
  }
}

export function writeOnboardingStateToStorage(storage, storageKey, payload) {
  if (!storage || !storageKey) {
    return null;
  }

  const nextState = sanitizeOnboardingState({
    ...payload,
    updatedAt: new Date().toISOString(),
  });
  if (!nextState) {
    return null;
  }

  storage.setItem(storageKey, JSON.stringify(nextState));
  return nextState;
}

export function clearOnboardingStateFromStorage(storage, storageKey) {
  if (!storage || !storageKey) {
    return;
  }

  storage.removeItem(storageKey);
}

export function getStoredAuthOnboardingState(options = {}) {
  if (!isBrowser()) {
    return null;
  }

  return readOnboardingStateFromStorage(window.sessionStorage, AUTH_ONBOARDING_STATE_KEY, options);
}

export function setStoredAuthOnboardingState(payload) {
  if (!isBrowser()) {
    return null;
  }

  return writeOnboardingStateToStorage(window.sessionStorage, AUTH_ONBOARDING_STATE_KEY, payload);
}

export function clearStoredAuthOnboardingState() {
  if (!isBrowser()) {
    return;
  }

  clearOnboardingStateFromStorage(window.sessionStorage, AUTH_ONBOARDING_STATE_KEY);
}

export function getStoredProviderOnboardingState(options = {}) {
  if (!isBrowser()) {
    return null;
  }

  return readOnboardingStateFromStorage(window.localStorage, PROVIDER_ONBOARDING_STATE_KEY, options);
}

export function setStoredProviderOnboardingState(payload) {
  if (!isBrowser()) {
    return null;
  }

  return writeOnboardingStateToStorage(window.localStorage, PROVIDER_ONBOARDING_STATE_KEY, payload);
}

export function clearStoredProviderOnboardingState() {
  if (!isBrowser()) {
    return;
  }

  clearOnboardingStateFromStorage(window.localStorage, PROVIDER_ONBOARDING_STATE_KEY);
}

export {
  AUTH_ONBOARDING_STATE_KEY,
  PROVIDER_ONBOARDING_STATE_KEY,
};
