import crypto from 'node:crypto';

import { BillingSubscriptionModel } from '../billing/billing.model.js';
import { UserModel } from '../auth/auth.model.js';
import { AnalysisLockModel } from './analysis-lock.model.js';
import {
  getPricingPropertyUsage,
  getPricingQueryPolicy,
  incrementPricingPropertyUsage,
} from './pricing-query-policy.service.js';
import { RateLimitEventModel } from './rate-limit.model.js';
import { UsageTrackingModel } from './usage-tracking.model.js';

const PLAN_DEFINITIONS = {
  free: {
    planCode: 'free',
    displayName: 'Seller Free',
    monthlyPropertyLimit: 1,
    pricingCooldownHours: 24,
    flyerCooldownHours: 1,
    features: ['pricing.preview', 'photo.capture.basic'],
  },
  seller_unlock: {
    planCode: 'seller_unlock',
    displayName: 'Seller Unlock',
    monthlyPropertyLimit: 3,
    pricingCooldownHours: 24,
    flyerCooldownHours: 1,
    features: ['pricing.full', 'flyer.generate', 'flyer.export', 'marketing.export', 'reports.client_ready'],
  },
  seller_pro: {
    planCode: 'seller_pro',
    displayName: 'Seller Pro',
    monthlyPropertyLimit: 3,
    pricingCooldownHours: 24,
    flyerCooldownHours: 1,
    features: ['pricing.full', 'flyer.generate', 'flyer.export', 'marketing.export', 'reports.client_ready'],
  },
  agent_starter: {
    planCode: 'agent_starter',
    displayName: 'Agent Starter',
    monthlyPropertyLimit: 10,
    pricingCooldownHours: 24,
    flyerCooldownHours: 1,
    features: [
      'pricing.full',
      'flyer.generate',
      'flyer.export',
      'marketing.export',
      'reports.client_ready',
      'presentation.mode',
    ],
  },
  agent_pro: {
    planCode: 'agent_pro',
    displayName: 'Agent Pro',
    monthlyPropertyLimit: 30,
    pricingCooldownHours: 24,
    flyerCooldownHours: 1,
    features: [
      'pricing.full',
      'flyer.generate',
      'flyer.export',
      'marketing.export',
      'presentation.mode',
      'branding.custom',
      'reports.client_ready',
    ],
  },
  agent_team: {
    planCode: 'agent_team',
    displayName: 'Agent Team',
    monthlyPropertyLimit: 100,
    pricingCooldownHours: 24,
    flyerCooldownHours: 1,
    features: [
      'pricing.full',
      'flyer.generate',
      'flyer.export',
      'marketing.export',
      'presentation.mode',
      'branding.custom',
      'reports.client_ready',
      'team.multi_user',
    ],
  },
  sample_onboarding: {
    planCode: 'sample_onboarding',
    displayName: 'Sample Onboarding',
    monthlyPropertyLimit: 30,
    pricingCooldownHours: 24,
    flyerCooldownHours: 1,
    features: ['pricing.full', 'flyer.generate', 'flyer.export', 'marketing.export', 'reports.client_ready'],
  },
  sample_monthly: {
    planCode: 'sample_monthly',
    displayName: 'Sample Monthly',
    monthlyPropertyLimit: 30,
    pricingCooldownHours: 24,
    flyerCooldownHours: 1,
    features: [
      'pricing.full',
      'flyer.generate',
      'flyer.export',
      'marketing.export',
      'reports.client_ready',
      'presentation.mode',
    ],
  },
  admin_bypass: {
    planCode: 'admin_bypass',
    displayName: 'Admin Bypass',
    monthlyPropertyLimit: Number.POSITIVE_INFINITY,
    pricingCooldownHours: 0,
    flyerCooldownHours: 0,
    features: [
      'pricing.full',
      'flyer.generate',
      'flyer.export',
      'marketing.export',
      'presentation.mode',
      'branding.custom',
      'reports.client_ready',
      'team.multi_user',
    ],
  },
  demo_bypass: {
    planCode: 'demo_bypass',
    displayName: 'Demo Bypass',
    monthlyPropertyLimit: Number.POSITIVE_INFINITY,
    pricingCooldownHours: 0,
    flyerCooldownHours: 0,
    features: [
      'pricing.full',
      'flyer.generate',
      'flyer.export',
      'marketing.export',
      'presentation.mode',
      'branding.custom',
      'reports.client_ready',
      'team.multi_user',
    ],
  },
};

const NEXT_PLAN_MAP = {
  free: 'seller_pro',
  seller_unlock: 'seller_pro',
  seller_pro: 'agent_starter',
  agent_starter: 'agent_pro',
  agent_pro: 'agent_team',
};

const ANALYSIS_RATE_LIMITS = {
  minute: { max: 5, windowMs: 60 * 1000 },
  hour: { max: 20, windowMs: 60 * 60 * 1000 },
  day: { max: 100, windowMs: 24 * 60 * 60 * 1000 },
};

const AUTH_RATE_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 };

function startOfMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function toDate(value) {
  return value ? new Date(value) : null;
}

function buildCycleKey(start, end) {
  return `${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}`;
}

function getPlanDefinition(planCode) {
  return PLAN_DEFINITIONS[planCode] || PLAN_DEFINITIONS.free;
}

function getNextPlan(planCode) {
  return NEXT_PLAN_MAP[planCode] || null;
}

function withinCooldown(resultTimestamp, cooldownHours) {
  if (!resultTimestamp || !cooldownHours) {
    return false;
  }

  const ageMs = Date.now() - new Date(resultTimestamp).getTime();
  return ageMs < cooldownHours * 60 * 60 * 1000;
}

function hashInput(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function resolveUserPlanContext(userId) {
  const user = await UserModel.findById(userId).lean();
  if (!user) {
    throw new Error('User not found.');
  }

  if (user.isBillingBypass || user.role === 'admin' || user.role === 'super_admin') {
    const now = new Date();
    return {
      user,
      planCode: 'admin_bypass',
      plan: getPlanDefinition('admin_bypass'),
      billingCycleStart: now,
      billingCycleEnd: now,
      billingCycleKey: 'admin_bypass',
    };
  }

  if (user.isDemoAccount) {
    const now = new Date();
    return {
      user,
      planCode: 'demo_bypass',
      plan: getPlanDefinition('demo_bypass'),
      billingCycleStart: now,
      billingCycleEnd: now,
      billingCycleKey: 'demo_bypass',
    };
  }

  const subscription = await BillingSubscriptionModel.findOne({
    userId,
    isActive: true,
  })
    .sort({ updatedAt: -1 })
    .lean();

  const planCode = subscription?.planKey || 'free';
  const billingCycleStart = toDate(subscription?.currentPeriodStart) || startOfMonth();
  const billingCycleEnd = toDate(subscription?.currentPeriodEnd) || endOfMonth();

  return {
    user,
    subscription,
    planCode,
    plan: getPlanDefinition(planCode),
    billingCycleStart,
    billingCycleEnd,
    billingCycleKey: buildCycleKey(billingCycleStart, billingCycleEnd),
  };
}

async function getOrCreateUsageRecord({ userId, billingCycleKey, planCode }) {
  return UsageTrackingModel.findOneAndUpdate(
    { userId, billingCycleKey },
    {
      $setOnInsert: {
        userId,
        billingCycleKey,
        planCode,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );
}

async function countRecentEvents(userId, scope, windowMs) {
  return RateLimitEventModel.countDocuments({
    userId: String(userId),
    scope,
    createdAt: { $gte: new Date(Date.now() - windowMs) },
  });
}

export async function enforceScopedRateLimit(identifier, scope, { max, windowMs }) {
  const eventCount = await countRecentEvents(identifier, scope, windowMs);
  if (eventCount >= max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  await RateLimitEventModel.create({
    userId: String(identifier),
    scope,
  });

  return { allowed: true };
}

export async function enforceAuthAction(identifier) {
  return enforceScopedRateLimit(identifier, 'auth', AUTH_RATE_LIMIT);
}

function buildUpgradeDecision(context, reason, analysisType) {
  const suggestedPlan = context.user?.isDemoAccount
    ? analysisType === 'flyer'
      ? 'sample_onboarding'
      : 'sample_monthly'
    : getNextPlan(context.planCode);

  return {
    action: 'DENY_UPGRADE_REQUIRED',
    currentPlan: context.planCode,
    suggestedPlan,
    reason,
    upgradeRequired: true,
    checkoutPath: suggestedPlan
      ? `/dashboard?upgrade=${encodeURIComponent(suggestedPlan)}`
      : null,
  };
}

function buildPricingPolicyMetadata(pricingQueryPolicy, pricingPropertyUsage) {
  const pricingCooldownHours = Math.max(
    0,
    Number(pricingQueryPolicy?.pricingCooldownHours || 0),
  );
  const maxRunsPerPropertyPerUser = Math.max(
    0,
    Number(pricingQueryPolicy?.maxRunsPerPropertyPerUser || 0),
  );
  const runsUsedForProperty = Math.max(
    0,
    Number(pricingPropertyUsage?.freshRunsTotal || 0),
  );
  const runsRemainingForProperty =
    maxRunsPerPropertyPerUser > 0
      ? Math.max(0, maxRunsPerPropertyPerUser - runsUsedForProperty)
      : null;

  return {
    pricingCooldownHours,
    maxRunsPerPropertyPerUser,
    runsUsedForProperty,
    runsRemainingForProperty,
    lastFreshRunAt: pricingPropertyUsage?.lastFreshRunAt || null,
  };
}

export async function enforceAnalysisRequest({
  userId,
  propertyId,
  analysisType,
  featureKey,
  latestResult,
  resultTimestamp,
  cooldownHours,
  inputSignature,
}) {
  const context = await resolveUserPlanContext(userId);
  const usage = await getOrCreateUsageRecord({
    userId,
    billingCycleKey: context.billingCycleKey,
    planCode: context.planCode,
  });

  if (!context.plan.features.includes(featureKey)) {
    await UsageTrackingModel.updateOne(
      { _id: usage._id },
      { $inc: { deniedRequests: 1 }, $set: { updatedAt: new Date() } },
    );
    return buildUpgradeDecision(context, 'FEATURE_NOT_INCLUDED', analysisType);
  }

  for (const [bucket, config] of Object.entries(ANALYSIS_RATE_LIMITS)) {
    const count = await countRecentEvents(userId, `analysis:${analysisType}`, config.windowMs);
    if (count >= config.max) {
      return {
        action: 'DENY_RATE_LIMIT',
        retryAfterSeconds: bucket === 'minute' ? 60 : bucket === 'hour' ? 3600 : 86400,
      };
    }
  }

  if (
    Number.isFinite(context.plan.monthlyPropertyLimit) &&
    !usage.analyzedPropertyIds.includes(String(propertyId)) &&
    usage.analyzedPropertyIds.length >= context.plan.monthlyPropertyLimit
  ) {
    await UsageTrackingModel.updateOne(
      { _id: usage._id },
      { $inc: { deniedRequests: 1 }, $set: { updatedAt: new Date() } },
    );
    return buildUpgradeDecision(context, 'MONTHLY_LIMIT_REACHED', analysisType);
  }

  let pricingPolicy = null;
  if (analysisType === 'pricing') {
    const [pricingQueryPolicy, pricingPropertyUsage] = await Promise.all([
      getPricingQueryPolicy(),
      getPricingPropertyUsage({ userId, propertyId }),
    ]);

    pricingPolicy = buildPricingPolicyMetadata(
      pricingQueryPolicy,
      pricingPropertyUsage,
    );
    cooldownHours = pricingPolicy.pricingCooldownHours;

    if (latestResult && withinCooldown(resultTimestamp, cooldownHours)) {
      return {
        action: 'RETURN_CACHED_RESULT',
        cacheReason: 'COOLDOWN_ACTIVE',
        cachedResult: latestResult,
        cachedAt: resultTimestamp,
        context,
        policy: pricingPolicy,
      };
    }

    const hasPropertyLimit =
      pricingPolicy.maxRunsPerPropertyPerUser > 0;
    const limitReached =
      hasPropertyLimit &&
      pricingPolicy.runsUsedForProperty >= pricingPolicy.maxRunsPerPropertyPerUser;

    if (limitReached) {
      if (latestResult) {
        return {
          action: 'RETURN_CACHED_RESULT',
          cacheReason: 'PROPERTY_QUERY_LIMIT_REACHED',
          cachedResult: latestResult,
          cachedAt: resultTimestamp,
          context,
          policy: pricingPolicy,
        };
      }

      return {
        action: 'DENY_PROPERTY_QUERY_LIMIT',
        retryAfterSeconds: 24 * 60 * 60,
        context,
        policy: pricingPolicy,
      };
    }
  }

  if (latestResult && withinCooldown(resultTimestamp, cooldownHours)) {
    return {
      action: 'RETURN_CACHED_RESULT',
      cacheReason: 'COOLDOWN_ACTIVE',
      cachedResult: latestResult,
      cachedAt: resultTimestamp,
      context,
      policy: pricingPolicy,
    };
  }

  const inputHash = hashInput(inputSignature);

  try {
    await AnalysisLockModel.create({
      propertyId: String(propertyId),
      userId: String(userId),
      analysisType,
      inputHash,
    });
  } catch {
    if (latestResult) {
      return {
        action: 'RETURN_CACHED_RESULT',
        cacheReason: 'DUPLICATE_JOB',
        cachedResult: latestResult,
        cachedAt: resultTimestamp,
        context,
      };
    }

    return {
      action: 'DENY_RATE_LIMIT',
      retryAfterSeconds: 30,
    };
  }

  return {
    action: 'ALLOW_FRESH_RUN',
    context,
    usageId: usage._id.toString(),
    inputHash,
    policy: pricingPolicy,
  };
}

export async function finalizeFreshAnalysisRun({
  userId,
  propertyId,
  analysisType,
  usageContext,
  inputHash,
}) {
  const usage = await getOrCreateUsageRecord({
    userId,
    billingCycleKey: usageContext.billingCycleKey,
    planCode: usageContext.planCode,
  });

  const update = {
    $set: {
      updatedAt: new Date(),
    },
    $addToSet: {
      analyzedPropertyIds: String(propertyId),
    },
    $inc: {},
  };

  if (analysisType === 'pricing') {
    update.$inc.pricingRunsTotal = 1;
  } else if (analysisType === 'flyer') {
    update.$inc.flyersGenerated = 1;
  } else if (analysisType === 'report') {
    update.$inc.documentGenerations = 1;
  }

  await UsageTrackingModel.updateOne({ _id: usage._id }, update);
  await RateLimitEventModel.create({
    userId: String(userId),
    scope: `analysis:${analysisType}`,
  });
  await AnalysisLockModel.deleteOne({
    propertyId: String(propertyId),
    userId: String(userId),
    analysisType,
    inputHash,
  });

  let pricingPropertyUsage = null;
  if (analysisType === 'pricing') {
    pricingPropertyUsage = await incrementPricingPropertyUsage({
      userId,
      propertyId,
    });
  }

  return {
    pricingPropertyUsage,
  };
}

export async function finalizeCachedAnalysisReturn({
  userId,
  propertyId,
  analysisType,
  usageContext,
}) {
  const usage = await getOrCreateUsageRecord({
    userId,
    billingCycleKey: usageContext.billingCycleKey,
    planCode: usageContext.planCode,
  });

  const update = {
    $set: {
      updatedAt: new Date(),
    },
  };

  if (analysisType === 'pricing') {
    update.$inc = { pricingCacheHits: 1 };
  } else if (analysisType === 'flyer') {
    update.$inc = { flyerCacheHits: 1 };
  }

  await UsageTrackingModel.updateOne({ _id: usage._id }, update);
}

export async function releaseAnalysisLock({ userId, propertyId, analysisType, inputHash }) {
  await AnalysisLockModel.deleteOne({
    propertyId: String(propertyId),
    userId: String(userId),
    analysisType,
    inputHash,
  });
}
