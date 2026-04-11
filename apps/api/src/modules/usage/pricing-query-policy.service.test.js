import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import {
  DEFAULT_PRICING_QUERY_POLICY,
  getPricingPropertyUsage,
  getPricingQueryPolicy,
  incrementPricingPropertyUsage,
  pricingQueryPolicyDependencies,
  updatePricingQueryPolicy,
} from './pricing-query-policy.service.js';

function setReadyState(value) {
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    value,
  });
}

function createLeanQuery(result) {
  return {
    lean: async () => result,
  };
}

test('getPricingQueryPolicy returns defaults when MongoDB is disconnected', async (t) => {
  const originalReadyState = mongoose.connection.readyState;
  setReadyState(0);
  t.after(() => setReadyState(originalReadyState));

  const policy = await getPricingQueryPolicy();

  assert.deepEqual(policy, {
    ...DEFAULT_PRICING_QUERY_POLICY,
    updatedAt: null,
  });
});

test('updatePricingQueryPolicy persists normalized values', async (t) => {
  const originalReadyState = mongoose.connection.readyState;
  setReadyState(1);
  t.after(() => setReadyState(originalReadyState));

  let receivedFilter = null;
  let receivedUpdate = null;
  t.mock.method(
    pricingQueryPolicyDependencies.PricingQueryPolicyModel,
    'findOneAndUpdate',
    (filter, update) => {
      receivedFilter = filter;
      receivedUpdate = update;
      return createLeanQuery({
        singletonKey: 'pricing-analysis-criteria',
        pricingCooldownHours: 36,
        maxRunsPerPropertyPerUser: 10,
        updatedAt: '2026-04-10T12:00:00.000Z',
      });
    },
  );

  const savedPolicy = await updatePricingQueryPolicy({
    pricingCooldownHours: 36.9,
    maxRunsPerPropertyPerUser: 10,
  });

  assert.deepEqual(receivedFilter, {
    singletonKey: 'pricing-analysis-criteria',
  });
  assert.deepEqual(receivedUpdate, {
    $set: {
      pricingCooldownHours: 36,
      maxRunsPerPropertyPerUser: 10,
    },
    $setOnInsert: {
      singletonKey: 'pricing-analysis-criteria',
    },
  });
  assert.deepEqual(savedPolicy, {
    pricingCooldownHours: 36,
    maxRunsPerPropertyPerUser: 10,
    updatedAt: '2026-04-10T12:00:00.000Z',
  });
});

test('getPricingPropertyUsage returns zero usage when no record exists', async (t) => {
  const originalReadyState = mongoose.connection.readyState;
  setReadyState(1);
  t.after(() => setReadyState(originalReadyState));

  t.mock.method(pricingQueryPolicyDependencies.PricingPropertyUsageModel, 'findOne', () =>
    createLeanQuery(null),
  );

  const usage = await getPricingPropertyUsage({
    userId: 'user-1',
    propertyId: 'property-1',
  });

  assert.deepEqual(usage, {
    userId: 'user-1',
    propertyId: 'property-1',
    analysisType: 'pricing',
    freshRunsTotal: 0,
    lastFreshRunAt: null,
    updatedAt: null,
  });
});

test('incrementPricingPropertyUsage increments fresh run counts for a property', async (t) => {
  const originalReadyState = mongoose.connection.readyState;
  setReadyState(1);
  t.after(() => setReadyState(originalReadyState));

  let receivedFilter = null;
  let receivedUpdate = null;
  t.mock.method(
    pricingQueryPolicyDependencies.PricingPropertyUsageModel,
    'findOneAndUpdate',
    (filter, update) => {
      receivedFilter = filter;
      receivedUpdate = update;
      return createLeanQuery({
        userId: 'user-2',
        propertyId: 'property-2',
        analysisType: 'pricing',
        freshRunsTotal: 4,
        lastFreshRunAt: '2026-04-10T15:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      });
    },
  );

  const usage = await incrementPricingPropertyUsage({
    userId: 'user-2',
    propertyId: 'property-2',
  });

  assert.deepEqual(receivedFilter, {
    userId: 'user-2',
    propertyId: 'property-2',
    analysisType: 'pricing',
  });
  assert.equal(receivedUpdate.$inc.freshRunsTotal, 1);
  assert.equal(receivedUpdate.$setOnInsert.userId, 'user-2');
  assert.equal(receivedUpdate.$setOnInsert.propertyId, 'property-2');
  assert.deepEqual(usage, {
    userId: 'user-2',
    propertyId: 'property-2',
    analysisType: 'pricing',
    freshRunsTotal: 4,
    lastFreshRunAt: '2026-04-10T15:30:00.000Z',
    updatedAt: '2026-04-10T15:30:00.000Z',
  });
});
