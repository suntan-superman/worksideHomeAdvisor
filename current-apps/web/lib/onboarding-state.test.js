import test from 'node:test';
import assert from 'node:assert/strict';

import {
  readOnboardingStateFromStorage,
  sanitizeOnboardingState,
  writeOnboardingStateToStorage,
} from './onboarding-state.js';

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test('sanitizeOnboardingState drops stale saved state', () => {
  const staleState = sanitizeOnboardingState(
    {
      mode: 'verify',
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    },
    { maxAgeMs: 1000 * 60 * 60 * 24 },
  );

  assert.equal(staleState, null);
});

test('write and read onboarding state roundtrip preserves progress snapshot', () => {
  const storage = createStorage();
  writeOnboardingStateToStorage(storage, 'auth', {
    mode: 'verify',
    form: {
      email: 'seller@example.com',
      role: 'seller',
    },
    showVerificationOption: true,
    status: 'Enter the OTP sent to your inbox.',
  });

  const restored = readOnboardingStateFromStorage(storage, 'auth');
  assert.equal(restored.mode, 'verify');
  assert.equal(restored.form.email, 'seller@example.com');
  assert.equal(restored.showVerificationOption, true);
  assert.equal(restored.status, 'Enter the OTP sent to your inbox.');
  assert.ok(restored.updatedAt);
});
