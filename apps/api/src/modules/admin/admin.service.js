import mongoose from 'mongoose';

import { listBillingPlans } from '../billing/billing.service.js';
import { BillingSubscriptionModel } from '../billing/billing.model.js';
import { UserModel } from '../auth/auth.model.js';
import { FlyerModel } from '../documents/flyer.model.js';
import { MediaAssetModel } from '../media/media.model.js';
import { MediaVariantModel } from '../media/media-variant.model.js';
import {
  buildExpiredVariantQuery,
  cleanupExpiredMediaVariants,
  getTemporaryVariantTtlMs,
} from '../media/variant-lifecycle.service.js';
import {
  createProviderProfile,
  createAdminProviderCategory,
  closeAdminProviderLead,
  listAdminProviderCategories,
  listAdminProviderLeads,
  listAdminProviders,
  resendAdminProviderLead,
  deleteAdminProvider,
  updateAdminProviderCategory,
  updateAdminProviderReview,
} from '../providers/providers.service.js';
import { PricingAnalysisModel } from '../pricing/pricing.model.js';
import { PropertyModel } from '../properties/property.model.js';
import { AnalysisLockModel } from '../usage/analysis-lock.model.js';
import { RateLimitEventModel } from '../usage/rate-limit.model.js';
import { UsageTrackingModel } from '../usage/usage-tracking.model.js';

const DEFAULT_WORKER_ENDPOINTS = [
  {
    key: 'document',
    name: 'Document Worker',
    url: process.env.DOCUMENT_WORKER_URL || 'http://localhost:4101',
    responsibilities: ['flyer jobs', 'report rendering', 'pdf exports'],
  },
  {
    key: 'media',
    name: 'Media Worker',
    url: process.env.MEDIA_WORKER_URL || 'http://localhost:4102',
    responsibilities: ['photo processing', 'thumbnails', 'room/media intelligence'],
  },
  {
    key: 'market-data',
    name: 'Market Data Worker',
    url: process.env.MARKET_DATA_WORKER_URL || 'http://localhost:4103',
    responsibilities: ['comp normalization', 'scoring support', 'provider caching'],
  },
  {
    key: 'notification',
    name: 'Notification Worker',
    url: process.env.NOTIFICATION_WORKER_URL || 'http://localhost:4104',
    responsibilities: ['otp delivery', 'email jobs', 'reminders'],
  },
];

function serializeUser(user, extras = {}) {
  return {
    id: user._id?.toString?.() || String(user._id),
    email: user.email,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    role: user.role,
    isDemoAccount: Boolean(user.isDemoAccount),
    isBillingBypass: Boolean(user.isBillingBypass),
    emailVerifiedAt: user.emailVerifiedAt || null,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
    ...extras,
  };
}

function serializeProperty(property, extras = {}) {
  return {
    id: property._id?.toString?.() || String(property._id),
    ownerUserId: property.ownerUserId?.toString?.() || String(property.ownerUserId),
    title: property.title,
    addressLine1: property.addressLine1,
    city: property.city,
    state: property.state,
    zip: property.zip,
    propertyType: property.propertyType,
    bedrooms: property.bedrooms || 0,
    bathrooms: property.bathrooms || 0,
    squareFeet: property.squareFeet || 0,
    readinessScore: property.readinessScore || 0,
    updatedAt: property.updatedAt || null,
    createdAt: property.createdAt || null,
    ...extras,
  };
}

function buildDemoOverview() {
  return {
    dataSource: 'demo',
    generatedAt: new Date().toISOString(),
    metrics: {
      totalUsers: 3,
      verifiedUsers: 2,
      adminUsers: 1,
      totalProperties: 1,
      pricingAnalyses: 1,
      mediaAssets: 0,
      flyersGenerated: 0,
      activeSubscriptions: 0,
      openAnalysisLocks: 0,
      usageRecords: 0,
    },
  };
}

async function probeWorker(worker) {
  try {
    const response = await fetch(`${worker.url}/health`, {
      signal: AbortSignal.timeout(1200),
    });

    if (!response.ok) {
      throw new Error(`Health check failed with ${response.status}`);
    }

    const payload = await response.json().catch(() => ({}));
    return {
      ...worker,
      status: 'online',
      health: payload,
    };
  } catch (error) {
    return {
      ...worker,
      status: 'offline',
      health: {
        ok: false,
        message: error.message,
      },
    };
  }
}

export async function getAdminOverview() {
  if (mongoose.connection.readyState !== 1) {
    return buildDemoOverview();
  }

  const [
    totalUsers,
    verifiedUsers,
    adminUsers,
    totalProperties,
    pricingAnalyses,
    mediaAssets,
    flyersGenerated,
    activeSubscriptions,
    openAnalysisLocks,
    usageRecords,
    recentRateLimitEvents,
  ] = await Promise.all([
    UserModel.countDocuments({}),
    UserModel.countDocuments({ emailVerifiedAt: { $ne: null } }),
    UserModel.countDocuments({ role: { $in: ['admin', 'super_admin'] } }),
    PropertyModel.countDocuments({}),
    PricingAnalysisModel.countDocuments({}),
    MediaAssetModel.countDocuments({}),
    FlyerModel.countDocuments({}),
    BillingSubscriptionModel.countDocuments({ isActive: true }),
    AnalysisLockModel.countDocuments({}),
    UsageTrackingModel.countDocuments({}),
    RateLimitEventModel.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }),
  ]);

  return {
    dataSource: 'mongodb',
    generatedAt: new Date().toISOString(),
    metrics: {
      totalUsers,
      verifiedUsers,
      adminUsers,
      totalProperties,
      pricingAnalyses,
      mediaAssets,
      flyersGenerated,
      activeSubscriptions,
      openAnalysisLocks,
      usageRecords,
      recentRateLimitEvents,
    },
  };
}

export async function listAdminUsers({ limit = 50 } = {}) {
  if (mongoose.connection.readyState !== 1) {
    return {
      dataSource: 'demo',
      users: [
        {
          id: 'demo-admin',
          email: 'admin@workside.software',
          role: 'admin',
          propertyCount: 0,
          activePlanKey: 'admin_bypass',
        },
      ],
    };
  }

  const users = await UserModel.find({})
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  const enrichedUsers = await Promise.all(
    users.map(async (user) => {
      const [propertyCount, activeSubscription] = await Promise.all([
        PropertyModel.countDocuments({ ownerUserId: user._id }),
        BillingSubscriptionModel.findOne({ userId: user._id, isActive: true })
          .sort({ updatedAt: -1 })
          .lean(),
      ]);

      return serializeUser(user, {
        propertyCount,
        activePlanKey:
          activeSubscription?.planKey ||
          (user.isBillingBypass ? 'admin_bypass' : user.isDemoAccount ? 'demo_bypass' : 'free'),
        subscriptionStatus: activeSubscription?.status || null,
      });
    }),
  );

  return {
    dataSource: 'mongodb',
    users: enrichedUsers,
  };
}

export async function listAdminProperties({ limit = 50 } = {}) {
  if (mongoose.connection.readyState !== 1) {
    return {
      dataSource: 'demo',
      properties: [],
    };
  }

  const properties = await PropertyModel.find({})
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  const enrichedProperties = await Promise.all(
    properties.map(async (property) => {
      const [owner, mediaCount, flyerCount, latestPricing] = await Promise.all([
        UserModel.findById(property.ownerUserId).lean(),
        MediaAssetModel.countDocuments({ propertyId: property._id }),
        FlyerModel.countDocuments({ propertyId: property._id }),
        PricingAnalysisModel.findOne({ propertyId: property._id }).sort({ createdAt: -1 }).lean(),
      ]);

      return serializeProperty(property, {
        ownerEmail: owner?.email || '',
        mediaCount,
        flyerCount,
        latestPricingMid: latestPricing?.recommendedListMid || null,
        latestPricingConfidence: latestPricing?.confidenceScore || null,
      });
    }),
  );

  return {
    dataSource: 'mongodb',
    properties: enrichedProperties,
  };
}

export async function getAdminBillingSnapshot() {
  const plans = await listBillingPlans();

  if (mongoose.connection.readyState !== 1) {
    return {
      dataSource: 'demo',
      plans,
      recentSubscriptions: [],
      activeSubscriptionCount: 0,
    };
  }

  const recentSubscriptions = await BillingSubscriptionModel.find({})
    .sort({ updatedAt: -1 })
    .limit(25)
    .lean();

  const activeSubscriptionCount = await BillingSubscriptionModel.countDocuments({ isActive: true });

  return {
    dataSource: 'mongodb',
    plans,
    activeSubscriptionCount,
    recentSubscriptions: recentSubscriptions.map((subscription) => ({
      id: subscription._id?.toString?.() || String(subscription._id),
      userId: subscription.userId?.toString?.() || String(subscription.userId),
      planKey: subscription.planKey,
      audience: subscription.audience,
      mode: subscription.mode,
      status: subscription.status,
      isActive: Boolean(subscription.isActive),
      currentPeriodEnd: subscription.currentPeriodEnd || null,
      updatedAt: subscription.updatedAt || null,
    })),
  };
}

export async function getAdminUsageSnapshot() {
  if (mongoose.connection.readyState !== 1) {
    return {
      dataSource: 'demo',
      summary: {
        openLocks: 0,
        last24hRateLimitEvents: 0,
        usageRecordCount: 0,
      },
      topUsage: [],
    };
  }

  const [usageRecords, openLocks, last24hRateLimitEvents] = await Promise.all([
    UsageTrackingModel.find({})
      .sort({ updatedAt: -1 })
      .limit(25)
      .lean(),
    AnalysisLockModel.countDocuments({}),
    RateLimitEventModel.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }),
  ]);

  return {
    dataSource: 'mongodb',
    summary: {
      openLocks,
      last24hRateLimitEvents,
      usageRecordCount: await UsageTrackingModel.countDocuments({}),
    },
    topUsage: usageRecords.map((record) => ({
      id: record._id?.toString?.() || String(record._id),
      userId: record.userId?.toString?.() || String(record.userId),
      billingCycleKey: record.billingCycleKey,
      planCode: record.planCode,
      uniquePropertiesAnalyzed: record.analyzedPropertyIds?.length || 0,
      pricingRunsTotal: record.pricingRunsTotal || 0,
      pricingCacheHits: record.pricingCacheHits || 0,
      photoAnalysisRuns: record.photoAnalysisRuns || 0,
      flyersGenerated: record.flyersGenerated || 0,
      flyerCacheHits: record.flyerCacheHits || 0,
      deniedRequests: record.deniedRequests || 0,
      updatedAt: record.updatedAt || null,
    })),
  };
}

export async function getAdminMediaVariantSnapshot() {
  if (mongoose.connection.readyState !== 1) {
    return {
      dataSource: 'demo',
      summary: {
        totalVariants: 0,
        selectedPersistent: 0,
        temporaryVariants: 0,
        expiringSoon: 0,
        cleanupEligible: 0,
        ttlHours: Math.round(getTemporaryVariantTtlMs() / (60 * 60 * 1000)),
      },
      recentVariants: [],
    };
  }

  const now = new Date();
  const expiringSoonCutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const [
    totalVariants,
    selectedPersistent,
    temporaryVariants,
    expiringSoon,
    cleanupEligible,
    recentVariants,
  ] = await Promise.all([
    MediaVariantModel.countDocuments({}),
    MediaVariantModel.countDocuments({ isSelected: true }),
    MediaVariantModel.countDocuments({ isSelected: false }),
    MediaVariantModel.countDocuments({
      isSelected: false,
      expiresAt: { $ne: null, $lte: expiringSoonCutoff, $gt: now },
    }),
    MediaVariantModel.countDocuments(buildExpiredVariantQuery(now)),
    MediaVariantModel.find({})
      .sort({ createdAt: -1 })
      .limit(12)
      .lean(),
  ]);

  const mediaIds = [
    ...new Set(recentVariants.map((variant) => variant.mediaId?.toString?.() || String(variant.mediaId))),
  ];
  const mediaAssets = mediaIds.length
    ? await MediaAssetModel.find({ _id: { $in: mediaIds } }).lean()
    : [];
  const mediaById = new Map(
    mediaAssets.map((asset) => [asset._id?.toString?.() || String(asset._id), asset]),
  );

  return {
    dataSource: 'mongodb',
    summary: {
      totalVariants,
      selectedPersistent,
      temporaryVariants,
      expiringSoon,
      cleanupEligible,
      ttlHours: Math.round(getTemporaryVariantTtlMs() / (60 * 60 * 1000)),
    },
    recentVariants: recentVariants.map((variant) => {
      const mediaId = variant.mediaId?.toString?.() || String(variant.mediaId);
      const mediaAsset = mediaById.get(mediaId);

      return {
        id: variant._id?.toString?.() || String(variant._id),
        mediaId,
        propertyId: variant.propertyId?.toString?.() || String(variant.propertyId),
        roomLabel: mediaAsset?.roomLabel || 'Unknown room',
        label: variant.label,
        variantType: variant.variantType,
        variantCategory: variant.variantCategory || 'enhancement',
        isSelected: Boolean(variant.isSelected),
        lifecycleState: variant.lifecycleState || (variant.isSelected ? 'selected' : 'temporary'),
        expiresAt: variant.expiresAt || null,
        selectedAt: variant.selectedAt || null,
        createdAt: variant.createdAt || null,
        overallScore: Number(variant.metadata?.review?.overallScore || 0),
      };
    }),
  };
}

export async function getAdminWorkerSnapshot() {
  const workers = await Promise.all(DEFAULT_WORKER_ENDPOINTS.map((worker) => probeWorker(worker)));

  return {
    generatedAt: new Date().toISOString(),
    workers,
  };
}

export async function runAdminMediaVariantCleanup() {
  return cleanupExpiredMediaVariants();
}

export async function getAdminProviderSnapshot({ limit = 50 } = {}) {
  return listAdminProviders({ limit });
}

export async function getAdminProviderCategorySnapshot() {
  return listAdminProviderCategories();
}

export async function createAdminProvider(payload) {
  const provider = await createProviderProfile(payload, {
    createdFrom: 'admin_console',
    status: 'active',
  });

  return { provider };
}

export async function createAdminProviderCategoryAction(payload) {
  return createAdminProviderCategory(payload);
}

export async function updateAdminProviderCategoryAction(categoryKey, payload) {
  return updateAdminProviderCategory(categoryKey, payload);
}

export async function getAdminProviderLeadSnapshot({ limit = 50 } = {}) {
  return listAdminProviderLeads({ limit });
}

export async function resendAdminProviderLeadAction(leadRequestId) {
  return resendAdminProviderLead(leadRequestId);
}

export async function closeAdminProviderLeadAction(leadRequestId, resolution) {
  return closeAdminProviderLead(leadRequestId, resolution);
}

export async function updateAdminProviderReviewAction(providerId, payload) {
  return updateAdminProviderReview(providerId, payload);
}

export async function deleteAdminProviderAction(providerId) {
  return deleteAdminProvider(providerId);
}
