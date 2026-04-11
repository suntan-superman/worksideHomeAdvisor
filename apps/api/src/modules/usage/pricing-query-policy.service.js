import mongoose from 'mongoose';

import {
  PricingPropertyUsageModel,
  PricingQueryPolicyModel,
  PRICING_QUERY_POLICY_SINGLETON_KEY,
} from './pricing-query-policy.model.js';

export const DEFAULT_PRICING_QUERY_POLICY = Object.freeze({
  pricingCooldownHours: 24,
  maxRunsPerPropertyPerUser: 5,
});

export const pricingQueryPolicyDependencies = {
  PricingQueryPolicyModel,
  PricingPropertyUsageModel,
};

function normalizeNonNegativeInteger(value, fallback) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(numericValue));
}

function buildDefaultPolicy() {
  return {
    ...DEFAULT_PRICING_QUERY_POLICY,
    updatedAt: null,
  };
}

function serializePricingQueryPolicy(document) {
  if (!document) {
    return buildDefaultPolicy();
  }

  return {
    pricingCooldownHours: normalizeNonNegativeInteger(
      document.pricingCooldownHours,
      DEFAULT_PRICING_QUERY_POLICY.pricingCooldownHours,
    ),
    maxRunsPerPropertyPerUser: normalizeNonNegativeInteger(
      document.maxRunsPerPropertyPerUser,
      DEFAULT_PRICING_QUERY_POLICY.maxRunsPerPropertyPerUser,
    ),
    updatedAt: document.updatedAt || null,
  };
}

function buildEmptyPropertyUsage(userId = '', propertyId = '') {
  return {
    userId: String(userId || ''),
    propertyId: String(propertyId || ''),
    analysisType: 'pricing',
    freshRunsTotal: 0,
    lastFreshRunAt: null,
    updatedAt: null,
  };
}

function serializePricingPropertyUsage(document, { userId = '', propertyId = '' } = {}) {
  if (!document) {
    return buildEmptyPropertyUsage(userId, propertyId);
  }

  return {
    userId: String(document.userId || userId || ''),
    propertyId: String(document.propertyId || propertyId || ''),
    analysisType: String(document.analysisType || 'pricing'),
    freshRunsTotal: normalizeNonNegativeInteger(document.freshRunsTotal, 0),
    lastFreshRunAt: document.lastFreshRunAt || null,
    updatedAt: document.updatedAt || null,
  };
}

export async function getPricingQueryPolicy() {
  if (mongoose.connection.readyState !== 1) {
    return buildDefaultPolicy();
  }

  const document = await pricingQueryPolicyDependencies.PricingQueryPolicyModel.findOne({
    singletonKey: PRICING_QUERY_POLICY_SINGLETON_KEY,
  }).lean();

  return serializePricingQueryPolicy(document);
}

export async function updatePricingQueryPolicy(payload = {}) {
  const normalizedPayload = {
    pricingCooldownHours: normalizeNonNegativeInteger(
      payload.pricingCooldownHours,
      DEFAULT_PRICING_QUERY_POLICY.pricingCooldownHours,
    ),
    maxRunsPerPropertyPerUser: normalizeNonNegativeInteger(
      payload.maxRunsPerPropertyPerUser,
      DEFAULT_PRICING_QUERY_POLICY.maxRunsPerPropertyPerUser,
    ),
  };

  if (mongoose.connection.readyState !== 1) {
    return {
      ...normalizedPayload,
      updatedAt: new Date().toISOString(),
    };
  }

  const document = await pricingQueryPolicyDependencies.PricingQueryPolicyModel.findOneAndUpdate(
    { singletonKey: PRICING_QUERY_POLICY_SINGLETON_KEY },
    {
      $set: normalizedPayload,
      $setOnInsert: {
        singletonKey: PRICING_QUERY_POLICY_SINGLETON_KEY,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  ).lean();

  return serializePricingQueryPolicy(document);
}

export async function getPricingPropertyUsage({ userId, propertyId }) {
  if (!userId || !propertyId || mongoose.connection.readyState !== 1) {
    return buildEmptyPropertyUsage(userId, propertyId);
  }

  const document = await pricingQueryPolicyDependencies.PricingPropertyUsageModel.findOne({
    userId: String(userId),
    propertyId: String(propertyId),
    analysisType: 'pricing',
  }).lean();

  return serializePricingPropertyUsage(document, { userId, propertyId });
}

export async function incrementPricingPropertyUsage({ userId, propertyId }) {
  const now = new Date();

  if (!userId || !propertyId || mongoose.connection.readyState !== 1) {
    return {
      ...buildEmptyPropertyUsage(userId, propertyId),
      freshRunsTotal: 1,
      lastFreshRunAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  const document = await pricingQueryPolicyDependencies.PricingPropertyUsageModel.findOneAndUpdate(
    {
      userId: String(userId),
      propertyId: String(propertyId),
      analysisType: 'pricing',
    },
    {
      $inc: {
        freshRunsTotal: 1,
      },
      $set: {
        lastFreshRunAt: now,
      },
      $setOnInsert: {
        userId: String(userId),
        propertyId: String(propertyId),
        analysisType: 'pricing',
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  ).lean();

  return serializePricingPropertyUsage(document, { userId, propertyId });
}
