import mongoose from 'mongoose';
import { normalizeLandingAttribution } from '@workside/utils';

import { PublicFunnelEventModel } from './public.model.js';

function roundToNearestThousand(value) {
  return Math.round(value / 1000) * 1000;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getPropertyTypePricePerSqft(propertyType) {
  switch (propertyType) {
    case 'condo':
      return 252;
    case 'townhome':
      return 266;
    case 'multi_family':
      return 238;
    case 'single_family':
    default:
      return 289;
  }
}

function buildPreviewChecklistItems(payload) {
  const items = [];

  if (payload.squareFeet >= 2200) {
    items.push('Prioritize decluttering and staging the largest living spaces first.');
  } else {
    items.push('Tighten the main living spaces and reduce visual clutter before photos.');
  }

  if (payload.bathrooms >= 3) {
    items.push('Refresh bathroom finishes and lighting so the home feels consistently move-in ready.');
  } else {
    items.push('Improve first-impression rooms with light paint touchups and bright neutral finishes.');
  }

  if (payload.propertyType === 'single_family') {
    items.push('Improve curb appeal before launch so the exterior matches the listing price ambition.');
  }

  return items.slice(0, 3);
}

function buildPreviewProviderCategories(payload) {
  const items = ['photographers'];

  if (payload.propertyType === 'single_family') {
    items.push('cleaners');
  }

  if (payload.squareFeet >= 2000 || payload.bedrooms >= 4) {
    items.push('stagers');
  }

  return items;
}

export function buildSellerPreviewResponse(payload) {
  const basePricePerSqft = getPropertyTypePricePerSqft(payload.propertyType);
  const bedroomLift = payload.bedrooms * 5;
  const bathroomLift = payload.bathrooms * 7;
  const sourceLift = String(payload.source || '').includes('agent') ? 8 : 0;
  const estimatedMidpoint = roundToNearestThousand(
    payload.squareFeet * (basePricePerSqft + bedroomLift + bathroomLift + sourceLift),
  );
  const low = roundToNearestThousand(estimatedMidpoint * 0.95);
  const high = roundToNearestThousand(estimatedMidpoint * 1.05);
  const readinessSeed =
    28 +
    Math.round(payload.bathrooms * 5) +
    Math.round(payload.bedrooms * 3) +
    Math.round(Math.min(payload.squareFeet, 2600) / 180);
  const marketReadyScore = clamp(readinessSeed, 32, 71);

  return {
    estimatedRange: {
      low,
      mid: estimatedMidpoint,
      high,
    },
    marketReadyScore,
    previewChecklistItems: buildPreviewChecklistItems(payload),
    previewProviderCategories: buildPreviewProviderCategories(payload),
    requiresSignupForFullPlan: true,
  };
}

function toObjectIdOrNull(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }

  return new mongoose.Types.ObjectId(value);
}

export async function recordPublicFunnelEvent({
  eventName,
  anonymousId = '',
  userId = '',
  propertyId = '',
  email = '',
  attribution = {},
  previewContext = null,
  payload = null,
  metadata = null,
  sessionStage = '',
}) {
  const normalizedAttribution = normalizeLandingAttribution(attribution);

  if (mongoose.connection.readyState !== 1) {
    return {
      persisted: false,
      attribution: normalizedAttribution,
    };
  }

  const record = await PublicFunnelEventModel.create({
    eventName,
    anonymousId: String(anonymousId || ''),
    userId: toObjectIdOrNull(userId),
    propertyId: toObjectIdOrNull(propertyId),
    email: String(email || '').trim().toLowerCase(),
    attribution: normalizedAttribution,
    previewContext,
    payload,
    metadata,
    sessionStage,
  });

  return {
    persisted: true,
    id: record._id.toString(),
    attribution: normalizedAttribution,
  };
}

export async function getAdminFunnelSnapshot() {
  if (mongoose.connection.readyState !== 1) {
    return {
      dataSource: 'demo',
      summary: {
        totalEvents: 0,
        capturedEmails: 0,
        signupStarts: 0,
        signupCompleted: 0,
        propertiesCreated: 0,
      },
      roleBreakdown: [],
      platformBreakdown: [],
      stageBreakdown: [],
      conversionSummary: {
        emailToSignupRate: 0,
        signupToPropertyRate: 0,
        emailToPropertyRate: 0,
      },
      topCampaigns: [],
      recentEvents: [],
    };
  }

  const [
    totalEvents,
    capturedEmails,
    signupStarts,
    signupCompleted,
    propertiesCreated,
    roleBreakdown,
    platformBreakdown,
    stageBreakdown,
    topCampaigns,
    recentEvents,
  ] = await Promise.all([
    PublicFunnelEventModel.countDocuments({}),
    PublicFunnelEventModel.countDocuments({ eventName: 'seller_email_submitted' }),
    PublicFunnelEventModel.countDocuments({
      eventName: 'continue_signup',
    }),
    PublicFunnelEventModel.countDocuments({
      eventName: 'signup_completed',
    }),
    PublicFunnelEventModel.countDocuments({ eventName: 'property_created' }),
    PublicFunnelEventModel.aggregate([
      {
        $group: {
          _id: '$attribution.roleIntent',
          events: { $sum: 1 },
          emails: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'seller_email_submitted'] }, 1, 0],
            },
          },
          signupStarts: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'continue_signup'] }, 1, 0],
            },
          },
          signupCompleted: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'signup_completed'] }, 1, 0],
            },
          },
          properties: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'property_created'] }, 1, 0],
            },
          },
        },
      },
      { $sort: { events: -1 } },
    ]),
    PublicFunnelEventModel.aggregate([
      {
        $group: {
          _id: '$attribution.platform',
          events: { $sum: 1 },
          signupStarts: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'continue_signup'] }, 1, 0],
            },
          },
          signupCompleted: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'signup_completed'] }, 1, 0],
            },
          },
          properties: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'property_created'] }, 1, 0],
            },
          },
        },
      },
      { $sort: { events: -1 } },
    ]),
    PublicFunnelEventModel.aggregate([
      {
        $group: {
          _id: '$eventName',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
    PublicFunnelEventModel.aggregate([
      {
        $group: {
          _id: {
            campaign: '$attribution.campaign',
            source: '$attribution.source',
            medium: '$attribution.medium',
            platform: '$attribution.platform',
          },
          events: { $sum: 1 },
          emails: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'seller_email_submitted'] }, 1, 0],
            },
          },
          signupStarts: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'continue_signup'] }, 1, 0],
            },
          },
          signupCompleted: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'signup_completed'] }, 1, 0],
            },
          },
          properties: {
            $sum: {
              $cond: [{ $eq: ['$eventName', 'property_created'] }, 1, 0],
            },
          },
        },
      },
      { $sort: { signupCompleted: -1, signupStarts: -1, events: -1 } },
      { $limit: 12 },
    ]),
    PublicFunnelEventModel.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  const safeRate = (numerator, denominator) =>
    denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;

  return {
    dataSource: 'mongodb',
    summary: {
      totalEvents,
      capturedEmails,
      signupStarts,
      signupCompleted,
      propertiesCreated,
    },
    roleBreakdown: roleBreakdown.map((item) => ({
      role: item._id || 'unknown',
      events: item.events,
      emails: item.emails,
      signupStarts: item.signupStarts,
      signupCompleted: item.signupCompleted,
      properties: item.properties,
    })),
    platformBreakdown: platformBreakdown.map((item) => ({
      platform: item._id || 'direct',
      events: item.events,
      signupStarts: item.signupStarts,
      signupCompleted: item.signupCompleted,
      properties: item.properties,
    })),
    stageBreakdown: stageBreakdown.map((item) => ({
      eventName: item._id || 'unknown',
      count: item.count,
    })),
    conversionSummary: {
      emailToSignupRate: safeRate(signupCompleted, capturedEmails),
      signupToPropertyRate: safeRate(propertiesCreated, signupCompleted),
      emailToPropertyRate: safeRate(propertiesCreated, capturedEmails),
    },
    topCampaigns: topCampaigns.map((item) => ({
      campaign: item._id.campaign || 'general',
      source: item._id.source || 'direct',
      medium: item._id.medium || 'organic',
      platform: item._id.platform || 'direct',
      events: item.events,
      emails: item.emails,
      signupStarts: item.signupStarts,
      signupCompleted: item.signupCompleted,
      properties: item.properties,
    })),
    recentEvents: recentEvents.map((item) => ({
      id: item._id?.toString?.() || String(item._id),
      eventName: item.eventName,
      anonymousId: item.anonymousId || '',
      email: item.email || '',
      attribution: item.attribution || {},
      sessionStage: item.sessionStage || '',
      createdAt: item.createdAt || null,
    })),
  };
}
