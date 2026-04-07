import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveCheckoutSessionBillingState,
  resolveProviderOperationalStatus,
} from './billing.service.js';

test('resolveCheckoutSessionBillingState marks paid one-time sessions as active', () => {
  const result = resolveCheckoutSessionBillingState(
    {
      status: 'complete',
      payment_status: 'paid',
    },
    { mode: 'payment' },
  );

  assert.deepEqual(result, {
    status: 'paid',
    isActive: true,
  });
});

test('resolveCheckoutSessionBillingState marks expired sessions as expired', () => {
  const result = resolveCheckoutSessionBillingState(
    {
      status: 'expired',
      payment_status: 'unpaid',
    },
    { mode: 'subscription' },
  );

  assert.deepEqual(result, {
    status: 'expired',
    isActive: false,
  });
});

test('resolveCheckoutSessionBillingState distinguishes async payment pending states', () => {
  const result = resolveCheckoutSessionBillingState(
    {
      status: 'complete',
      payment_status: 'unpaid',
    },
    { mode: 'payment' },
  );

  assert.deepEqual(result, {
    status: 'async_payment_pending',
    isActive: false,
  });
});

test('resolveProviderOperationalStatus keeps active paid providers active', () => {
  assert.equal(
    resolveProviderOperationalStatus({
      currentStatus: 'pending_billing',
      subscriptionStatus: 'active',
      isPaidPlan: true,
    }),
    'active',
  );
});

test('resolveProviderOperationalStatus keeps incomplete paid providers in pending billing', () => {
  assert.equal(
    resolveProviderOperationalStatus({
      currentStatus: 'active',
      subscriptionStatus: 'incomplete',
      isPaidPlan: true,
    }),
    'pending_billing',
  );
});

test('resolveProviderOperationalStatus preserves suspended providers', () => {
  assert.equal(
    resolveProviderOperationalStatus({
      currentStatus: 'suspended',
      subscriptionStatus: 'active',
      isPaidPlan: true,
    }),
    'suspended',
  );
});
