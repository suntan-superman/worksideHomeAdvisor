import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProviderActivationChecklist } from './providers.service.js';

function createVerificationProfile(overrides = {}) {
  return {
    requirements: {
      insurance: true,
      license: true,
      bonding: false,
    },
    insurance: {},
    license: {},
    bonding: {},
    review: {},
    ...overrides,
  };
}

test('buildProviderActivationChecklist treats provider_basic as billing-ready', () => {
  const checklist = buildProviderActivationChecklist(
    {
      categoryKey: 'photographer',
      description: 'Local real estate photographer.',
      email: 'provider@example.com',
      status: 'paused',
      serviceArea: {
        city: 'Bakersfield',
        state: 'CA',
        zipCodes: ['93312'],
        radiusMiles: 30,
      },
      leadRouting: {
        deliveryMode: 'email',
        notifyEmail: 'provider@example.com',
      },
      subscription: {
        planCode: 'provider_basic',
        status: 'inactive',
      },
      compliance: {
        approvalStatus: 'review',
      },
    },
    createVerificationProfile(),
  );

  const billingItem = checklist.items.find((item) => item.key === 'billing');
  assert.equal(billingItem.status, 'complete');
  assert.equal(checklist.blockers.some((item) => item.key === 'billing'), false);
});

test('buildProviderActivationChecklist flags paid plans and rejected verification as blockers', () => {
  const checklist = buildProviderActivationChecklist(
    {
      categoryKey: 'photographer',
      description: 'Local real estate photographer.',
      email: 'provider@example.com',
      status: 'paused',
      serviceArea: {
        city: 'Bakersfield',
        state: 'CA',
        zipCodes: ['93312'],
        radiusMiles: 30,
      },
      leadRouting: {
        deliveryMode: 'sms_and_email',
        notifyPhone: '(661) 555-0100',
        notifyEmail: 'provider@example.com',
      },
      subscription: {
        planCode: 'provider_standard',
        status: 'inactive',
      },
      compliance: {
        approvalStatus: 'review',
      },
    },
    createVerificationProfile({
      review: {
        reviewStatus: 'rejected',
      },
    }),
  );

  const blockerKeys = checklist.blockers.map((item) => item.key);
  assert.ok(blockerKeys.includes('billing'));
  assert.ok(blockerKeys.includes('verification'));
  assert.equal(checklist.live, false);
  assert.ok(checklist.readyPercent < 100);
});
