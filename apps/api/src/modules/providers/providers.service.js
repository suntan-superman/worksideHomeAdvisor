import crypto from 'node:crypto';
import mongoose from 'mongoose';

import { normalizePhoneNumber, notifyQueuedLeadDispatches } from '../marketplace-sms/marketplace-sms.service.js';
import { ChecklistModel } from '../tasks/checklist.model.js';
import { getPropertyById } from '../properties/property.service.js';
import { UserModel } from '../auth/auth.model.js';
import {
  LeadDispatchModel,
  LeadRequestModel,
  ProviderAnalyticsModel,
  ProviderResponseModel,
  ProviderSmsLogModel,
  SavedProviderModel,
} from './provider-leads.model.js';
import { ProviderCategoryModel, ProviderModel } from './provider.model.js';

export const DEFAULT_PROVIDER_CATEGORIES = [
  { key: 'inspector', label: 'Home Inspectors', description: 'Pre-listing and pre-sale property inspections.', rolloutPhase: 1, sortOrder: 1 },
  { key: 'title_company', label: 'Title Companies', description: 'Title and escrow partners for closing support.', rolloutPhase: 1, sortOrder: 2 },
  { key: 'real_estate_attorney', label: 'Real Estate Attorneys', description: 'Contract and transaction support where legal review is needed.', rolloutPhase: 1, sortOrder: 3 },
  { key: 'photographer', label: 'Photographers', description: 'Listing photo specialists for final marketing capture.', rolloutPhase: 1, sortOrder: 4 },
  { key: 'cleaning_service', label: 'Cleaning Services', description: 'Pre-listing and showing-readiness cleaners.', rolloutPhase: 1, sortOrder: 5 },
  { key: 'termite_inspection', label: 'Termite Inspectors', description: 'Wood destroying organism and termite inspection services.', rolloutPhase: 1, sortOrder: 6 },
  { key: 'notary', label: 'Notaries', description: 'Mobile and in-office notarization support for transaction documents.', rolloutPhase: 1, sortOrder: 7 },
  { key: 'nhd_report', label: 'NHD Report Providers', description: 'Natural hazard disclosure report preparation and delivery.', rolloutPhase: 1, sortOrder: 8 },
];

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function buildCategoryKey(value) {
  return slugify(value).replace(/-/g, '_').slice(0, 80);
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeZipList(value) {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 25)
    : [];
}

function normalizeStringList(value, { limit = 6, maxLength = 60 } = {}) {
  return Array.isArray(value)
    ? value
        .map((entry) => normalizeString(entry).slice(0, maxLength))
        .filter(Boolean)
        .slice(0, limit)
    : [];
}

function hashProviderPortalToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function createProviderPortalToken() {
  return crypto.randomBytes(24).toString('hex');
}

function serializeCategory(document) {
  if (!document) {
    return null;
  }

  return {
    id: document._id?.toString?.() || String(document._id),
    key: document.key,
    label: document.label,
    description: document.description || '',
    rolloutPhase: Number(document.rolloutPhase || 1),
    isActive: Boolean(document.isActive),
    sortOrder: Number(document.sortOrder || 0),
  };
}

function buildResponseSpeedScore(averageResponseMinutes) {
  const minutes = Number(averageResponseMinutes || 120);
  if (minutes <= 15) return 100;
  if (minutes <= 30) return 88;
  if (minutes <= 60) return 74;
  if (minutes <= 180) return 58;
  return 40;
}

function buildAcceptanceScore(analytics) {
  const leadCount = Number(analytics?.leadCount || 0);
  const acceptedCount = Number(analytics?.acceptedCount || 0);
  if (!leadCount) {
    return 60;
  }

  return Math.max(20, Math.min(100, Math.round((acceptedCount / leadCount) * 100)));
}

function buildCoverageScore(provider, property) {
  const propertyZip = normalizeString(property?.zip);
  const propertyCity = normalizeString(property?.city).toLowerCase();
  const propertyState = normalizeString(property?.state).toLowerCase();
  const zipCodes = provider.serviceArea?.zipCodes || [];
  const providerCity = normalizeString(provider.serviceArea?.city).toLowerCase();
  const providerState = normalizeString(provider.serviceArea?.state).toLowerCase();

  if (propertyZip && zipCodes.includes(propertyZip)) return 100;
  if (providerCity && providerState && providerCity === propertyCity && providerState === propertyState) return 80;
  if (providerState && providerState === propertyState) return 55;
  return 20;
}

function buildSubscriptionBoostScore(provider) {
  const planCode = provider.subscription?.planCode || 'provider_basic';
  if (provider.isSponsored || planCode === 'provider_featured') return 100;
  if (planCode === 'provider_standard') return 70;
  return 35;
}

function buildFreshnessScore(provider) {
  const referenceDate = provider.updatedAt || provider.createdAt;
  if (!referenceDate) return 50;

  const ageDays = Math.max(0, (Date.now() - new Date(referenceDate).getTime()) / (24 * 60 * 60 * 1000));
  if (ageDays <= 7) return 100;
  if (ageDays <= 30) return 82;
  if (ageDays <= 90) return 64;
  return 40;
}

function buildProviderRankScore(provider, property, analytics) {
  const qualityScore = Math.max(0, Math.min(100, Number(provider.qualityScore || 60)));
  const responseSpeedScore = buildResponseSpeedScore(provider.averageResponseMinutes);
  const leadAcceptanceScore = buildAcceptanceScore(analytics);
  const distanceScore = buildCoverageScore(provider, property);
  const subscriptionBoostScore = buildSubscriptionBoostScore(provider);
  const freshnessScore = buildFreshnessScore(provider);

  return {
    overallScore: Math.round(
      qualityScore * 0.35 +
        responseSpeedScore * 0.2 +
        leadAcceptanceScore * 0.15 +
        distanceScore * 0.1 +
        subscriptionBoostScore * 0.1 +
        freshnessScore * 0.1,
    ),
    breakdown: {
      qualityScore,
      responseSpeedScore,
      leadAcceptanceScore,
      distanceScore,
      subscriptionBoostScore,
      freshnessScore,
    },
  };
}

function buildRankingBadges(provider, scoreBreakdown, rankIndex) {
  const badges = [];
  if (rankIndex === 0) badges.push('Top Pick');
  if (provider.compliance?.approvalStatus === 'approved') badges.push('Approved');
  if (provider.isVerified) badges.push('Verified');
  if (provider.compliance?.licenseStatus === 'verified') badges.push('Licensed');
  if (provider.compliance?.insuranceStatus === 'verified') badges.push('Insured');
  if (provider.isSponsored) badges.push('Sponsored');
  if (scoreBreakdown.responseSpeedScore >= 74) badges.push('Fast Response');
  if (scoreBreakdown.distanceScore >= 100) badges.push('ZIP Match');
  return badges;
}

function buildCoverageLabel(provider, property) {
  const propertyZip = normalizeString(property?.zip);
  const zipCodes = provider.serviceArea?.zipCodes || [];
  if (propertyZip && zipCodes.includes(propertyZip)) return 'Covers this ZIP';
  if (normalizeString(provider.serviceArea?.city).toLowerCase() === normalizeString(property?.city).toLowerCase()) return `Serves ${property.city}`;
  return `${provider.serviceArea?.radiusMiles || 25} mile service radius`;
}

function serializeProvider(document, extras = {}) {
  return {
    id: document._id?.toString?.() || String(document._id),
    userId: document.userId?.toString?.() || String(document.userId || ''),
    businessName: document.businessName,
    slug: document.slug,
    categoryKey: document.categoryKey,
    description: document.description || '',
    phone: document.phone || '',
    email: document.email || '',
    websiteUrl: document.websiteUrl || '',
    status: document.status,
    isVerified: Boolean(document.isVerified),
    isSponsored: Boolean(document.isSponsored),
    qualityScore: Number(document.qualityScore || 0),
    averageResponseMinutes: Number(document.averageResponseMinutes || 0),
    yearsInBusiness: document.yearsInBusiness || null,
    turnaroundLabel: document.turnaroundLabel || '',
    pricingSummary: document.pricingSummary || '',
    serviceHighlights: document.serviceHighlights || [],
    serviceArea: {
      city: document.serviceArea?.city || '',
      state: document.serviceArea?.state || '',
      zipCodes: document.serviceArea?.zipCodes || [],
      radiusMiles: Number(document.serviceArea?.radiusMiles || 25),
    },
    leadRouting: {
      deliveryMode: document.leadRouting?.deliveryMode || 'sms_and_email',
      notifyPhone: document.leadRouting?.notifyPhone || '',
      notifyEmail: document.leadRouting?.notifyEmail || '',
      preferredContactMethod: document.leadRouting?.preferredContactMethod || 'sms',
    },
    subscription: {
      planCode: document.subscription?.planCode || 'provider_basic',
      status: document.subscription?.status || 'inactive',
    },
    compliance: {
      approvalStatus: document.compliance?.approvalStatus || 'draft',
      licenseStatus: document.compliance?.licenseStatus || 'unverified',
      insuranceStatus: document.compliance?.insuranceStatus || 'unverified',
      reviewedAt: document.compliance?.reviewedAt || null,
      reviewedBy: document.compliance?.reviewedBy || '',
    },
    createdAt: document.createdAt || null,
    updatedAt: document.updatedAt || null,
    ...extras,
  };
}

function serializeProviderPortalLead(dispatch, leadRequest) {
  const propertyAddress =
    leadRequest?.propertySnapshot?.address ||
    [leadRequest?.propertySnapshot?.city, leadRequest?.propertySnapshot?.state, leadRequest?.propertySnapshot?.zip]
      .filter(Boolean)
      .join(', ');

  return {
    id: dispatch._id?.toString?.() || String(dispatch._id),
    leadRequestId: dispatch.leadRequestId?.toString?.() || String(dispatch.leadRequestId),
    categoryKey: leadRequest?.categoryKey || '',
    leadStatus: leadRequest?.status || 'open',
    dispatchStatus: dispatch.status,
    responseStatus: dispatch.responseStatus || null,
    message: leadRequest?.message || '',
    source: leadRequest?.source || 'checklist_task',
    propertyAddress,
    propertyCity: leadRequest?.propertySnapshot?.city || '',
    propertyState: leadRequest?.propertySnapshot?.state || '',
    propertyZip: leadRequest?.propertySnapshot?.zip || '',
    sentAt: dispatch.sentAt || null,
    respondedAt: dispatch.respondedAt || null,
    createdAt: dispatch.createdAt || null,
    canRespond: ['queued', 'sent', 'delivered'].includes(dispatch.status),
  };
}

function summarizeProviderPortalDispatches(dispatches = []) {
  const summary = {
    total: dispatches.length,
    awaitingResponse: 0,
    accepted: 0,
    declined: 0,
    failed: 0,
  };

  for (const dispatch of dispatches) {
    if (['queued', 'sent', 'delivered'].includes(dispatch.status)) {
      summary.awaitingResponse += 1;
    }
    if (dispatch.status === 'accepted' || dispatch.responseStatus === 'accepted') {
      summary.accepted += 1;
    }
    if (
      dispatch.status === 'declined' ||
      dispatch.responseStatus === 'declined' ||
      dispatch.responseStatus === 'opted_out'
    ) {
      summary.declined += 1;
    }
    if (dispatch.status === 'failed') {
      summary.failed += 1;
    }
  }

  return summary;
}

async function refreshLeadRequestStatus(leadRequestId) {
  const dispatches = await LeadDispatchModel.find({ leadRequestId }).lean();

  let nextStatus = 'open';
  if (dispatches.some((dispatch) => dispatch.status === 'accepted')) {
    nextStatus = 'matched';
  } else if (dispatches.some((dispatch) => ['queued', 'sent', 'delivered'].includes(dispatch.status))) {
    nextStatus = 'routing';
  } else if (dispatches.some((dispatch) => ['declined', 'failed', 'expired'].includes(dispatch.status))) {
    nextStatus = 'open';
  }

  await LeadRequestModel.findByIdAndUpdate(leadRequestId, {
    $set: {
      status: nextStatus,
      updatedAt: new Date(),
    },
  });
}

async function upsertProviderAnalytics(providerId, mutator) {
  const monthKey = new Date().toISOString().slice(0, 7);
  const record =
    (await ProviderAnalyticsModel.findOne({ providerId, monthKey })) ||
    (await ProviderAnalyticsModel.create({ providerId, monthKey }));

  mutator(record);
  await record.save();
}

async function authenticateProviderPortal(providerId, token) {
  if (!mongoose.Types.ObjectId.isValid(providerId)) {
    throw new Error('Provider session is invalid.');
  }

  const provider = await ProviderModel.findById(providerId);
  if (!provider) {
    throw new Error('Provider session is invalid.');
  }

  if (!provider.portalAccess?.tokenHash) {
    throw new Error('Provider portal access has not been enabled for this account.');
  }

  if (provider.portalAccess.tokenHash !== hashProviderPortalToken(token)) {
    throw new Error('Provider session is invalid.');
  }

  provider.portalAccess.lastUsedAt = new Date();
  await provider.save();

  return provider;
}

async function findProviderForUser(userId, email = '') {
  if (!userId && !email) {
    return null;
  }

  let provider = null;

  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    provider = await ProviderModel.findOne({ userId });
  }

  if (!provider && email) {
    provider = await ProviderModel.findOne({ email: String(email).toLowerCase().trim() });
    if (provider && !provider.userId && userId && mongoose.Types.ObjectId.isValid(userId)) {
      provider.userId = userId;
      await provider.save();
    }
  }

  return provider;
}

async function buildProviderPortalDashboard(providerDocument) {
  const providerId = providerDocument._id;
  const [dispatches, analytics] = await Promise.all([
    LeadDispatchModel.find({ providerId }).sort({ createdAt: -1 }).limit(30).lean(),
    ProviderAnalyticsModel.findOne({
      providerId,
      monthKey: new Date().toISOString().slice(0, 7),
    }).lean(),
  ]);

  const leadRequestIds = [...new Set(dispatches.map((dispatch) => dispatch.leadRequestId?.toString?.() || String(dispatch.leadRequestId)))];
  const leadRequests = leadRequestIds.length
    ? await LeadRequestModel.find({ _id: { $in: leadRequestIds } }).lean()
    : [];
  const leadRequestById = new Map(
    leadRequests.map((leadRequest) => [leadRequest._id?.toString?.() || String(leadRequest._id), leadRequest]),
  );

  return {
    provider: serializeProvider(providerDocument.toObject ? providerDocument.toObject() : providerDocument, {
      portalAccess: {
        issuedAt: providerDocument.portalAccess?.issuedAt || null,
        lastUsedAt: providerDocument.portalAccess?.lastUsedAt || null,
      },
      subscription: {
        planCode: providerDocument.subscription?.planCode || 'provider_basic',
        status: providerDocument.subscription?.status || 'inactive',
        currentPeriodStart: providerDocument.subscription?.currentPeriodStart || null,
        currentPeriodEnd: providerDocument.subscription?.currentPeriodEnd || null,
        cancelAtPeriodEnd: Boolean(providerDocument.subscription?.cancelAtPeriodEnd),
      },
      analytics: analytics
        ? {
            monthKey: analytics.monthKey,
            leadCount: Number(analytics.leadCount || 0),
            acceptedCount: Number(analytics.acceptedCount || 0),
            declinedCount: Number(analytics.declinedCount || 0),
            avgResponseMinutes: Number(analytics.avgResponseMinutes || 0),
          }
        : null,
    }),
    summary: summarizeProviderPortalDispatches(dispatches),
    leads: dispatches.map((dispatch) =>
      serializeProviderPortalLead(
        dispatch,
        leadRequestById.get(dispatch.leadRequestId?.toString?.() || String(dispatch.leadRequestId)),
      ),
    ),
  };
}

function serializeLeadDispatch(document, provider = null) {
  return {
    id: document._id?.toString?.() || String(document._id),
    providerId: document.providerId?.toString?.() || String(document.providerId),
    providerName: provider?.businessName || 'Unknown provider',
    providerStatus: provider?.status || '',
    providerPhone: provider?.leadRouting?.notifyPhone || provider?.phone || '',
    providerEmail: provider?.leadRouting?.notifyEmail || provider?.email || '',
    deliveryMode: provider?.leadRouting?.deliveryMode || 'sms_and_email',
    optedOut: Boolean(provider?.leadRouting?.smsOptOut),
    status: document.status,
    responseStatus: document.responseStatus || null,
    sentAt: document.sentAt || null,
    smsSentAt: document.smsSentAt || null,
    smsMessageSid: document.smsMessageSid || '',
    smsError: document.smsError || '',
    respondedAt: document.respondedAt || null,
    deliveryChannels: document.deliveryChannels || [],
    leadFeeCents: Number(document.leadFeeCents || 0),
  };
}

function serializeProviderResponse(document, provider = null) {
  return {
    id: document._id?.toString?.() || String(document._id),
    providerId: document.providerId?.toString?.() || String(document.providerId),
    providerName: provider?.businessName || 'Unknown provider',
    responseStatus: document.responseStatus,
    note: document.note || '',
    rawBody: document.rawBody || '',
    createdAt: document.createdAt || null,
  };
}

function serializeProviderSmsLog(document, provider = null) {
  return {
    id: document._id?.toString?.() || String(document._id),
    providerId: document.providerId?.toString?.() || String(document.providerId),
    providerName: provider?.businessName || 'Unknown provider',
    direction: document.direction,
    messageType: document.messageType || 'lead',
    fromPhone: document.fromPhone || '',
    toPhone: document.toPhone || '',
    body: document.body || '',
    twilioMessageSid: document.twilioMessageSid || '',
    deliveryStatus: document.deliveryStatus || '',
    parseStatus: document.parseStatus || '',
    createdAt: document.createdAt || null,
  };
}

function summarizeLeadDispatches(dispatches = []) {
  const summary = {
    contacted: 0,
    queued: 0,
    sent: 0,
    delivered: 0,
    accepted: 0,
    declined: 0,
    failed: 0,
    help: 0,
    customReplies: 0,
    optedOut: 0,
  };

  for (const dispatch of dispatches) {
    summary.contacted += 1;
    if (dispatch.status === 'queued') summary.queued += 1;
    if (dispatch.status === 'sent') summary.sent += 1;
    if (dispatch.status === 'delivered') summary.delivered += 1;
    if (dispatch.status === 'accepted' || dispatch.responseStatus === 'accepted') summary.accepted += 1;
    if (dispatch.status === 'declined' || dispatch.responseStatus === 'declined') summary.declined += 1;
    if (dispatch.status === 'failed') summary.failed += 1;
    if (dispatch.responseStatus === 'help') summary.help += 1;
    if (dispatch.responseStatus === 'custom_reply') summary.customReplies += 1;
    if (dispatch.responseStatus === 'opted_out') summary.optedOut += 1;
  }

  return summary;
}

function serializeLeadRequest(document, dispatches = []) {
  return {
    id: document._id?.toString?.() || String(document._id),
    propertyId: document.propertyId?.toString?.() || String(document.propertyId),
    userId: document.userId?.toString?.() || String(document.userId),
    requestedByRole: document.requestedByRole || 'seller',
    categoryKey: document.categoryKey,
    source: document.source || 'checklist_task',
    sourceRefId: document.sourceRefId || '',
    status: document.status,
    maxProviders: Number(document.maxProviders || 3),
    message: document.message || '',
    propertySnapshot: {
      address: document.propertySnapshot?.address || '',
      city: document.propertySnapshot?.city || '',
      state: document.propertySnapshot?.state || '',
      zip: document.propertySnapshot?.zip || '',
    },
    dispatches,
    createdAt: document.createdAt || null,
    updatedAt: document.updatedAt || null,
  };
}

export async function ensureProviderCategories() {
  if (mongoose.connection.readyState !== 1) {
    return DEFAULT_PROVIDER_CATEGORIES.map((category, index) => ({
      id: `default-category-${index + 1}`,
      ...category,
      isActive: true,
    }));
  }

  await Promise.all(
    DEFAULT_PROVIDER_CATEGORIES.map((category) =>
      ProviderCategoryModel.updateOne(
        { key: category.key },
        {
          $setOnInsert: {
            key: category.key,
            label: category.label,
            description: category.description,
            rolloutPhase: category.rolloutPhase,
            sortOrder: category.sortOrder,
            isActive: true,
          },
        },
        { upsert: true },
      ),
    ),
  );

  const categories = await ProviderCategoryModel.find({ isActive: true }).sort({ sortOrder: 1, label: 1 }).lean();
  return categories.map(serializeCategory);
}

export async function listProviderCategories() {
  return ensureProviderCategories();
}

export async function listAdminProviderCategories() {
  await ensureProviderCategories();

  if (mongoose.connection.readyState !== 1) {
    return {
      dataSource: 'demo',
      categories: DEFAULT_PROVIDER_CATEGORIES.map((category, index) => ({
        id: `default-category-${index + 1}`,
        ...category,
        isActive: true,
      })),
    };
  }

  const categories = await ProviderCategoryModel.find({})
    .sort({ sortOrder: 1, label: 1 })
    .lean();

  return {
    dataSource: 'mongodb',
    categories: categories.map(serializeCategory),
  };
}

export async function createAdminProviderCategory(payload = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to create provider categories.');
  }

  await ensureProviderCategories();

  const label = normalizeString(payload.label).slice(0, 80);
  if (!label) {
    throw new Error('Category label is required.');
  }

  const key = buildCategoryKey(payload.key || label);
  if (!key) {
    throw new Error('Category key is required.');
  }

  const existingCategory = await ProviderCategoryModel.findOne({ key }).lean();
  if (existingCategory) {
    throw new Error('A provider category with that key already exists.');
  }

  const category = await ProviderCategoryModel.create({
    key,
    label,
    description: normalizeString(payload.description).slice(0, 240),
    rolloutPhase: Math.max(1, Math.min(10, Number(payload.rolloutPhase || 1))),
    sortOrder: Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 999,
    isActive: payload.isActive !== false,
  });

  return { category: serializeCategory(category.toObject()) };
}

export async function updateAdminProviderCategory(categoryKey, payload = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to update provider categories.');
  }

  await ensureProviderCategories();

  const key = normalizeString(categoryKey);
  const category = await ProviderCategoryModel.findOne({ key });
  if (!category) {
    throw new Error('Provider category not found.');
  }

  if (payload.label !== undefined) {
    const label = normalizeString(payload.label).slice(0, 80);
    if (!label) {
      throw new Error('Category label is required.');
    }
    category.label = label;
  }

  if (payload.description !== undefined) {
    category.description = normalizeString(payload.description).slice(0, 240);
  }

  if (payload.sortOrder !== undefined) {
    category.sortOrder = Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : category.sortOrder;
  }

  if (payload.rolloutPhase !== undefined) {
    category.rolloutPhase = Math.max(1, Math.min(10, Number(payload.rolloutPhase || 1)));
  }

  if (payload.isActive !== undefined) {
    category.isActive = Boolean(payload.isActive);
  }

  await category.save();

  return { category: serializeCategory(category.toObject()) };
}

async function resolveRequestedCategory(propertyId, { categoryKey = '', taskKey = '' } = {}) {
  if (categoryKey) {
    return normalizeString(categoryKey);
  }

  if (!taskKey || mongoose.connection.readyState !== 1) {
    return '';
  }

  const checklist = await ChecklistModel.findOne({ propertyId }).lean();
  const task = (checklist?.items || []).find(
    (item) => item.systemKey === taskKey || item._id?.toString?.() === taskKey || item.id === taskKey,
  );

  return normalizeString(task?.providerCategoryKey);
}

async function getProviderAnalyticsMap(providerIds = []) {
  if (!providerIds.length || mongoose.connection.readyState !== 1) {
    return new Map();
  }

  const monthKey = new Date().toISOString().slice(0, 7);
  const analytics = await ProviderAnalyticsModel.find({
    providerId: { $in: providerIds },
    monthKey,
  }).lean();

  return new Map(
    analytics.map((entry) => [entry.providerId?.toString?.() || String(entry.providerId), entry]),
  );
}

function filterProvidersForProperty(providers, property) {
  return providers.filter((provider) => {
    const propertyState = normalizeString(property.state).toLowerCase();
    const propertyCity = normalizeString(property.city).toLowerCase();
    const propertyZip = normalizeString(property.zip);
    const providerState = normalizeString(provider.serviceArea?.state).toLowerCase();
    const providerCity = normalizeString(provider.serviceArea?.city).toLowerCase();
    const providerZips = provider.serviceArea?.zipCodes || [];

    if (propertyZip && providerZips.includes(propertyZip)) return true;
    if (providerState && providerState === propertyState && providerCity && providerCity === propertyCity) return true;
  if (providerState && providerState === propertyState && Number(provider.serviceArea?.radiusMiles || 0) >= 25) return true;
  return false;
  });
}

export async function listProvidersForProperty(propertyId, { categoryKey = '', limit = 3, taskKey = '' } = {}) {
  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  const categories = await listProviderCategories();
  const resolvedCategoryKey = await resolveRequestedCategory(propertyId, { categoryKey, taskKey });

  if (mongoose.connection.readyState !== 1) {
    return {
      categories,
      categoryKey: resolvedCategoryKey || '',
      items: [],
      source: { internalProviders: 0, googleFallbackEnabled: false },
    };
  }

  const query = { status: 'active' };
  if (resolvedCategoryKey) {
    query.categoryKey = resolvedCategoryKey;
  }

  const providers = filterProvidersForProperty(
    await ProviderModel.find(query).sort({ isSponsored: -1, qualityScore: -1, updatedAt: -1 }).lean(),
    property,
  );
  const analyticsByProviderId = await getProviderAnalyticsMap(providers.map((provider) => provider._id));
  const savedProviderIds = new Set(
    (
      await SavedProviderModel.find({
        propertyId,
        userId: property.ownerUserId,
      }).lean()
    ).map((entry) => entry.providerId?.toString?.() || String(entry.providerId)),
  );

  const rankedProviders = providers
    .map((provider) => {
      const providerId = provider._id?.toString?.() || String(provider._id);
      return {
        provider,
        analytics: analyticsByProviderId.get(providerId) || null,
        rank: buildProviderRankScore(provider, property, analyticsByProviderId.get(providerId) || null),
      };
    })
    .sort((left, right) => {
      if (right.rank.overallScore !== left.rank.overallScore) {
        return right.rank.overallScore - left.rank.overallScore;
      }
      return new Date(right.provider.updatedAt || 0).getTime() - new Date(left.provider.updatedAt || 0).getTime();
    })
    .slice(0, Math.max(1, Number(limit || 3)));

  return {
    categories,
    categoryKey: resolvedCategoryKey || '',
    items: rankedProviders.map(({ provider, analytics, rank }, index) =>
      serializeProvider(provider, {
        saved: savedProviderIds.has(provider._id?.toString?.() || String(provider._id)),
        city: provider.serviceArea?.city || '',
        state: provider.serviceArea?.state || '',
        coverageLabel: buildCoverageLabel(provider, property),
        rankingBadges: buildRankingBadges(provider, rank.breakdown, index),
        ranking: rank,
        analytics: analytics
          ? {
              monthKey: analytics.monthKey,
              leadCount: Number(analytics.leadCount || 0),
              acceptedCount: Number(analytics.acceptedCount || 0),
            }
          : null,
      }),
    ),
    source: { internalProviders: providers.length, googleFallbackEnabled: false },
  };
}

export async function saveProviderForProperty(propertyId, providerId) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to save providers.');
  }

  const [property, provider] = await Promise.all([getPropertyById(propertyId), ProviderModel.findById(providerId).lean()]);
  if (!property) throw new Error('Property not found.');
  if (!provider) throw new Error('Provider not found.');

  await SavedProviderModel.findOneAndUpdate(
    { propertyId, userId: property.ownerUserId, providerId },
    { $setOnInsert: { categoryKey: provider.categoryKey } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return { saved: true, providerId };
}

export async function createProviderLeadRequest(propertyId, payload = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to create provider leads.');
  }

  const property = await getPropertyById(propertyId);
  if (!property) throw new Error('Property not found.');

  const resolvedCategoryKey = await resolveRequestedCategory(propertyId, {
    categoryKey: payload.categoryKey,
    taskKey: payload.sourceRefId,
  });
  if (!resolvedCategoryKey) throw new Error('Provider category is required.');

  const providerResults = await listProvidersForProperty(propertyId, {
    categoryKey: resolvedCategoryKey,
    limit: payload.maxProviders || 3,
  });

  const leadRequest = await LeadRequestModel.create({
    propertyId,
    userId: property.ownerUserId,
    requestedByRole: payload.requestedByRole || 'seller',
    categoryKey: resolvedCategoryKey,
    source: payload.source || 'checklist_task',
    sourceRefId: payload.sourceRefId || '',
    propertySnapshot: {
      address: [property.addressLine1, property.city, property.state, property.zip].filter(Boolean).join(', '),
      city: property.city,
      state: property.state,
      zip: property.zip,
    },
    status: providerResults.items.length ? 'routing' : 'open',
    maxProviders: payload.maxProviders || 3,
    message: normalizeString(payload.message).slice(0, 280),
  });

  if (providerResults.items.length) {
    await LeadDispatchModel.insertMany(
      providerResults.items.map((provider) => ({
        leadRequestId: leadRequest._id,
        providerId: provider.id,
        status: 'queued',
        deliveryChannels: ['dashboard'],
        leadFeeCents: 0,
      })),
    );

    await notifyQueuedLeadDispatches(leadRequest._id);
  }

  return {
    leadRequestId: leadRequest._id?.toString?.() || String(leadRequest._id),
    status: providerResults.items.length ? 'routing' : 'open',
    providersContacted: providerResults.items.length,
    providersPrepared: providerResults.items.length,
    categoryKey: resolvedCategoryKey,
  };
}

export async function listProviderLeadsForProperty(propertyId) {
  const property = await getPropertyById(propertyId);
  if (!property) throw new Error('Property not found.');

  if (mongoose.connection.readyState !== 1) {
    return { items: [] };
  }

  const leadRequests = await LeadRequestModel.find({ propertyId }).sort({ createdAt: -1 }).limit(20).lean();
  const leadRequestIds = leadRequests.map((entry) => entry._id);
  const dispatches = leadRequestIds.length
    ? await LeadDispatchModel.find({ leadRequestId: { $in: leadRequestIds } }).lean()
    : [];
  const providerIds = [...new Set(dispatches.map((entry) => entry.providerId?.toString?.() || String(entry.providerId)))];
  const providers = providerIds.length ? await ProviderModel.find({ _id: { $in: providerIds } }).lean() : [];
  const providerById = new Map(providers.map((provider) => [provider._id?.toString?.() || String(provider._id), provider]));
  const dispatchesByLeadId = new Map();

  for (const dispatch of dispatches) {
    const leadId = dispatch.leadRequestId?.toString?.() || String(dispatch.leadRequestId);
    if (!dispatchesByLeadId.has(leadId)) dispatchesByLeadId.set(leadId, []);
    const providerId = dispatch.providerId?.toString?.() || String(dispatch.providerId);
    dispatchesByLeadId.get(leadId).push({
      id: dispatch._id?.toString?.() || String(dispatch._id),
      providerId,
      businessName: providerById.get(providerId)?.businessName || 'Provider',
      status: dispatch.status,
      deliveryChannels: dispatch.deliveryChannels || [],
      responseStatus: dispatch.responseStatus || null,
      sentAt: dispatch.sentAt || null,
      respondedAt: dispatch.respondedAt || null,
    });
  }

  return {
    items: leadRequests.map((leadRequest) =>
      serializeLeadRequest(
        leadRequest,
        dispatchesByLeadId.get(leadRequest._id?.toString?.() || String(leadRequest._id)) || [],
      ),
    ),
  };
}

async function generateUniqueProviderSlug(baseName) {
  const baseSlug = slugify(baseName) || 'provider';
  let slug = baseSlug;
  let counter = 1;
  while (await ProviderModel.exists({ slug })) {
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
  return slug;
}

export async function createProviderProfile(
  payload = {},
  { createdFrom = 'admin', status = 'active', userId = '', userEmail = '', userRole = '' } = {},
) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to create providers.');
  }

  await ensureProviderCategories();
  const categoryKey = normalizeString(payload.categoryKey);
  const category = await ProviderCategoryModel.findOne({ key: categoryKey, isActive: true }).lean();
  if (!category) throw new Error('Provider category not found.');

  const businessName = normalizeString(payload.businessName).slice(0, 140);
  if (!businessName) throw new Error('Business name is required.');

  if (userId && userRole && !['provider', 'admin', 'super_admin'].includes(userRole)) {
    throw new Error('Only provider or admin accounts can create provider profiles while signed in.');
  }

  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    const existingProviderForUser = await ProviderModel.findOne({ userId }).lean();
    if (existingProviderForUser) {
      throw new Error('A provider profile already exists for this account.');
    }
  }

  const normalizedEmail = normalizeString(payload.email).toLowerCase();
  if (normalizedEmail) {
    const existingProviderForEmail = await ProviderModel.findOne({ email: normalizedEmail }).lean();
    if (existingProviderForEmail && String(existingProviderForEmail.userId || '') !== String(userId || '')) {
      throw new Error('A provider profile already exists for that email address.');
    }
  }

  const slug = await generateUniqueProviderSlug(businessName);
  const notifyPhone = normalizeString(payload.notifyPhone || payload.leadRouting?.notifyPhone || payload.phone).slice(0, 40);
  const notifyPhoneNormalized = normalizePhoneNumber(notifyPhone);
  const activatedAt = status === 'active' ? new Date() : null;
  const portalAccessToken = createdFrom === 'provider_portal' ? createProviderPortalToken() : '';
  const smsOptIn =
    payload.smsOptIn === true ||
    Boolean(payload.smsConsentAt) ||
    (createdFrom !== 'provider_portal' && Boolean(notifyPhoneNormalized));
  const approvalStatus =
    payload.approvalStatus ||
    payload.compliance?.approvalStatus ||
    (createdFrom === 'provider_portal' ? 'review' : 'approved');
  const document = await ProviderModel.create({
    userId: userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null,
    businessName,
    slug,
    categoryKey,
    description: normalizeString(payload.description).slice(0, 600),
    phone: normalizeString(payload.phone).slice(0, 40),
    email: normalizedEmail.slice(0, 120),
    websiteUrl: normalizeString(payload.websiteUrl).slice(0, 180),
    status,
    isVerified: Boolean(payload.isVerified),
    isSponsored: Boolean(payload.isSponsored),
    qualityScore: Math.max(0, Math.min(100, Number(payload.qualityScore || 70))),
    averageResponseMinutes: Math.max(5, Math.min(7 * 24 * 60, Number(payload.averageResponseMinutes || 120))),
    yearsInBusiness:
      payload.yearsInBusiness === null || payload.yearsInBusiness === undefined
        ? null
        : Math.max(0, Math.min(80, Number(payload.yearsInBusiness || 0))),
    turnaroundLabel: normalizeString(payload.turnaroundLabel).slice(0, 80),
    pricingSummary: normalizeString(payload.pricingSummary).slice(0, 140),
    serviceHighlights: normalizeStringList(payload.serviceHighlights),
    serviceArea: {
      city: normalizeString(payload.city || payload.serviceArea?.city).slice(0, 80),
      state: normalizeString(payload.state || payload.serviceArea?.state).slice(0, 40),
      zipCodes: normalizeZipList(payload.zipCodes || payload.serviceArea?.zipCodes),
      radiusMiles: Math.max(5, Math.min(1000, Number(payload.radiusMiles || payload.serviceArea?.radiusMiles || 25))),
    },
    leadRouting: {
      deliveryMode: payload.deliveryMode || payload.leadRouting?.deliveryMode || 'sms_and_email',
      notifyPhone,
      notifyPhoneNormalized,
      notifyEmail: normalizeString(payload.notifyEmail || payload.leadRouting?.notifyEmail || payload.email).slice(0, 120),
      preferredContactMethod: payload.preferredContactMethod || payload.leadRouting?.preferredContactMethod || 'sms',
      smsOptOut: Boolean(payload.smsOptOut),
      smsConsentAt: payload.smsConsentAt || (smsOptIn ? new Date() : null),
    },
    subscription: {
      planCode: payload.planCode || payload.subscription?.planCode || 'provider_basic',
      status: payload.subscriptionStatus || payload.subscription?.status || (status === 'active' ? 'active' : 'pending'),
      stripeCustomerId: '',
      stripeSubscriptionId: '',
      stripePriceId: '',
    },
    compliance: {
      approvalStatus,
      licenseStatus: payload.licenseStatus || payload.compliance?.licenseStatus || 'unverified',
      insuranceStatus: payload.insuranceStatus || payload.compliance?.insuranceStatus || 'unverified',
      reviewedAt: approvalStatus === 'approved' ? new Date() : null,
      reviewedBy: normalizeString(payload.reviewedBy || '').slice(0, 80),
    },
    portalAccess:
      createdFrom === 'provider_portal'
        ? {
            tokenHash: hashProviderPortalToken(portalAccessToken),
            issuedAt: new Date(),
            lastUsedAt: null,
          }
        : undefined,
    onboardingSource: createdFrom,
    outreachSource: normalizeString(payload.outreachSource).slice(0, 80) || 'manual',
    invitedAt: payload.invitedAt || null,
    activatedAt,
    firstLeadSentAt: null,
    internalNotes: normalizeString(payload.internalNotes).slice(0, 600),
  });

  return serializeProvider(document.toObject(), {
    categoryLabel: category.label,
    ...(portalAccessToken ? { portalAccessToken } : {}),
  });
}

export async function createProviderPortalSession({ providerId, token }) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required for provider portal access.');
  }

  const provider = await authenticateProviderPortal(providerId, token);
  const dashboard = await buildProviderPortalDashboard(provider);

  return {
    providerId: provider._id?.toString?.() || String(provider._id),
    dashboard,
  };
}

export async function createProviderPortalSessionForUser(userId) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required for provider portal access.');
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Provider account is invalid.');
  }

  const user = await UserModel.findById(userId).lean();
  if (!user) {
    throw new Error('Provider account not found.');
  }

  if (!['provider', 'admin', 'super_admin'].includes(user.role)) {
    throw new Error('Only provider accounts can access the provider portal.');
  }

  const provider = await findProviderForUser(user._id, user.email);
  if (!provider) {
    throw new Error('No provider profile is linked to this account yet.');
  }

  const portalAccessToken = createProviderPortalToken();
  provider.portalAccess.tokenHash = hashProviderPortalToken(portalAccessToken);
  provider.portalAccess.issuedAt = provider.portalAccess.issuedAt || new Date();
  provider.portalAccess.lastUsedAt = new Date();
  await provider.save();

  const dashboard = await buildProviderPortalDashboard(provider);
  return {
    providerId: provider._id?.toString?.() || String(provider._id),
    dashboard,
    portalAccessToken,
  };
}

export async function updateProviderPortalProfile(providerId, token, payload = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required for provider portal access.');
  }

  const provider = await authenticateProviderPortal(providerId, token);

  if (payload.description !== undefined) {
    provider.description = normalizeString(payload.description).slice(0, 600);
  }
  if (payload.websiteUrl !== undefined) {
    provider.websiteUrl = normalizeString(payload.websiteUrl).slice(0, 180);
  }
  if (payload.turnaroundLabel !== undefined) {
    provider.turnaroundLabel = normalizeString(payload.turnaroundLabel).slice(0, 80);
  }
  if (payload.pricingSummary !== undefined) {
    provider.pricingSummary = normalizeString(payload.pricingSummary).slice(0, 140);
  }
  if (payload.serviceHighlights !== undefined) {
    provider.serviceHighlights = normalizeStringList(payload.serviceHighlights);
  }
  if (payload.city !== undefined) {
    provider.serviceArea.city = normalizeString(payload.city).slice(0, 80);
  }
  if (payload.state !== undefined) {
    provider.serviceArea.state = normalizeString(payload.state).slice(0, 40);
  }
  if (payload.zipCodes !== undefined) {
    provider.serviceArea.zipCodes = normalizeZipList(payload.zipCodes);
  }
  if (payload.radiusMiles !== undefined) {
    provider.serviceArea.radiusMiles = Math.max(5, Math.min(1000, Number(payload.radiusMiles || 25)));
  }
  if (payload.notifyPhone !== undefined) {
    const notifyPhone = normalizeString(payload.notifyPhone).slice(0, 40);
    provider.leadRouting.notifyPhone = notifyPhone;
    provider.leadRouting.notifyPhoneNormalized = normalizePhoneNumber(notifyPhone);
  }
  if (payload.notifyEmail !== undefined) {
    provider.leadRouting.notifyEmail = normalizeString(payload.notifyEmail).slice(0, 120);
  }
  if (payload.deliveryMode !== undefined) {
    provider.leadRouting.deliveryMode = payload.deliveryMode;
  }
  if (payload.preferredContactMethod !== undefined) {
    provider.leadRouting.preferredContactMethod = payload.preferredContactMethod;
  }

  await provider.save();
  const dashboard = await buildProviderPortalDashboard(provider);
  return { dashboard };
}

export async function respondToProviderPortalLead(dispatchId, { providerId, token, responseStatus, note = '' }) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required for provider portal access.');
  }

  if (!['accepted', 'declined'].includes(responseStatus)) {
    throw new Error('Provider response must be accepted or declined.');
  }

  const provider = await authenticateProviderPortal(providerId, token);
  const dispatch = await LeadDispatchModel.findById(dispatchId);
  if (!dispatch || String(dispatch.providerId) !== String(provider._id)) {
    throw new Error('Provider lead not found.');
  }

  if (!['queued', 'sent', 'delivered'].includes(dispatch.status)) {
    throw new Error('This provider lead can no longer be responded to.');
  }

  const now = new Date();
  dispatch.status = responseStatus === 'accepted' ? 'accepted' : 'declined';
  dispatch.responseStatus = responseStatus;
  dispatch.respondedAt = now;
  await dispatch.save();

  await ProviderResponseModel.create({
    leadRequestId: dispatch.leadRequestId,
    providerId: provider._id,
    responseStatus,
    note: normalizeString(note).slice(0, 280) || `Responded from provider portal: ${responseStatus}`,
    rawBody: '',
  });

  await upsertProviderAnalytics(provider._id, (record) => {
    if (responseStatus === 'accepted') {
      record.acceptedCount += 1;
      if (dispatch.sentAt || dispatch.smsSentAt) {
        const startAt = dispatch.smsSentAt || dispatch.sentAt;
        const responseMinutes = Math.max(1, Math.round((now.getTime() - new Date(startAt).getTime()) / 60000));
        const priorAccepted = Math.max(0, record.acceptedCount - 1);
        record.avgResponseMinutes = priorAccepted
          ? Math.round(((record.avgResponseMinutes * priorAccepted) + responseMinutes) / record.acceptedCount)
          : responseMinutes;
      }
    } else {
      record.declinedCount += 1;
    }
  });

  await refreshLeadRequestStatus(dispatch.leadRequestId);
  const dashboard = await buildProviderPortalDashboard(provider);
  return { dashboard };
}

export async function updateAdminProviderReview(providerId, payload = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to update providers.');
  }

  const provider = await ProviderModel.findById(providerId);
  if (!provider) {
    throw new Error('Provider not found.');
  }

  if (payload.approvalStatus) {
    provider.compliance.approvalStatus = payload.approvalStatus;
    provider.compliance.reviewedAt = new Date();
    provider.compliance.reviewedBy = normalizeString(payload.reviewedBy || 'admin_console').slice(0, 80);
  }

  if (payload.licenseStatus) {
    provider.compliance.licenseStatus = payload.licenseStatus;
  }

  if (payload.insuranceStatus) {
    provider.compliance.insuranceStatus = payload.insuranceStatus;
  }

  if (payload.status) {
    provider.status = payload.status;
    if (payload.status === 'active' && !provider.activatedAt) {
      provider.activatedAt = new Date();
    }
  }

  if (payload.isVerified !== undefined) {
    provider.isVerified = Boolean(payload.isVerified);
  }

  if (payload.turnaroundLabel !== undefined) {
    provider.turnaroundLabel = normalizeString(payload.turnaroundLabel).slice(0, 80);
  }

  if (payload.pricingSummary !== undefined) {
    provider.pricingSummary = normalizeString(payload.pricingSummary).slice(0, 140);
  }

  if (payload.serviceHighlights !== undefined) {
    provider.serviceHighlights = normalizeStringList(payload.serviceHighlights);
  }

  await provider.save();
  return { provider: serializeProvider(provider.toObject()) };
}

export async function listAdminProviders({ limit = 50 } = {}) {
  await ensureProviderCategories();

  if (mongoose.connection.readyState !== 1) {
    return {
      dataSource: 'demo',
      providers: [],
      leadSummary: { open: 0, routing: 0, matched: 0 },
    };
  }

  const [providers, open, routing, matched] = await Promise.all([
    ProviderModel.find({}).sort({ updatedAt: -1 }).limit(limit).lean(),
    LeadRequestModel.countDocuments({ status: 'open' }),
    LeadRequestModel.countDocuments({ status: 'routing' }),
    LeadRequestModel.countDocuments({ status: 'matched' }),
  ]);

  const providerIds = providers.map((provider) => provider._id);
  const [dispatchCounts, categories] = await Promise.all([
    providerIds.length
      ? LeadDispatchModel.aggregate([
          { $match: { providerId: { $in: providerIds } } },
          { $group: { _id: '$providerId', leadCount: { $sum: 1 } } },
        ])
      : [],
    ProviderCategoryModel.find({}).lean(),
  ]);

  const dispatchCountByProviderId = new Map(dispatchCounts.map((entry) => [entry._id?.toString?.() || String(entry._id), Number(entry.leadCount || 0)]));
  const categoryByKey = new Map(categories.map((category) => [category.key, category]));

  return {
    dataSource: 'mongodb',
    leadSummary: { open, routing, matched },
    providers: providers.map((provider) =>
      serializeProvider(provider, {
        categoryLabel: categoryByKey.get(provider.categoryKey)?.label || provider.categoryKey,
        leadCount: dispatchCountByProviderId.get(provider._id?.toString?.() || String(provider._id)) || 0,
      }),
    ),
  };
}

export async function listAdminProviderLeads({ limit = 50 } = {}) {
  if (mongoose.connection.readyState !== 1) {
    return { dataSource: 'demo', items: [], summary: {} };
  }

  const leads = await LeadRequestModel.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  const leadIds = leads.map((lead) => lead._id);
  const [dispatches, responses, smsLogs] = leadIds.length
    ? await Promise.all([
        LeadDispatchModel.find({ leadRequestId: { $in: leadIds } }).sort({ createdAt: -1 }).lean(),
        ProviderResponseModel.find({ leadRequestId: { $in: leadIds } }).sort({ createdAt: -1 }).lean(),
        ProviderSmsLogModel.find({ leadRequestId: { $in: leadIds } }).sort({ createdAt: -1 }).lean(),
      ])
    : [[], [], []];

  const providerIds = [
    ...new Set(
      [...dispatches, ...responses, ...smsLogs]
        .map((record) => record.providerId?.toString?.() || String(record.providerId || ''))
        .filter(Boolean),
    ),
  ];

  const providers = providerIds.length
    ? await ProviderModel.find({ _id: { $in: providerIds } }).lean()
    : [];
  const providerById = new Map(
    providers.map((provider) => [provider._id?.toString?.() || String(provider._id), provider]),
  );

  const dispatchesByLeadId = new Map();
  const responsesByLeadId = new Map();
  const smsLogsByLeadId = new Map();

  for (const dispatch of dispatches) {
    const leadId = dispatch.leadRequestId?.toString?.() || String(dispatch.leadRequestId);
    const current = dispatchesByLeadId.get(leadId) || [];
    current.push(dispatch);
    dispatchesByLeadId.set(leadId, current);
  }

  for (const response of responses) {
    const leadId = response.leadRequestId?.toString?.() || String(response.leadRequestId);
    const current = responsesByLeadId.get(leadId) || [];
    current.push(response);
    responsesByLeadId.set(leadId, current);
  }

  for (const log of smsLogs) {
    const leadId = log.leadRequestId?.toString?.() || String(log.leadRequestId);
    const current = smsLogsByLeadId.get(leadId) || [];
    current.push(log);
    smsLogsByLeadId.set(leadId, current);
  }

  const overallSummary = {
    open: 0,
    routing: 0,
    matched: 0,
    completed: 0,
    cancelled: 0,
    expired: 0,
    awaitingResponse: 0,
    failedDispatches: 0,
  };

  return {
    dataSource: 'mongodb',
    items: leads.map((lead) => {
      const leadId = lead._id?.toString?.() || String(lead._id);
      const leadDispatches = dispatchesByLeadId.get(leadId) || [];
      const leadResponses = responsesByLeadId.get(leadId) || [];
      const leadSmsLogs = smsLogsByLeadId.get(leadId) || [];
      const counts = summarizeLeadDispatches(leadDispatches);
      const propertyAddress = [
        lead.propertySnapshot?.address,
        [lead.propertySnapshot?.city, lead.propertySnapshot?.state, lead.propertySnapshot?.zip]
          .filter(Boolean)
          .join(', '),
      ]
        .filter(Boolean)
        .join(' • ');

      overallSummary[lead.status] = Number(overallSummary[lead.status] || 0) + 1;
      if (counts.accepted === 0 && (counts.sent > 0 || counts.delivered > 0)) {
        overallSummary.awaitingResponse += 1;
      }
      if (counts.failed > 0) {
        overallSummary.failedDispatches += 1;
      }

      return {
        id: leadId,
        propertyId: lead.propertyId?.toString?.() || String(lead.propertyId),
        userId: lead.userId?.toString?.() || String(lead.userId),
        categoryKey: lead.categoryKey,
        status: lead.status,
        source: lead.source || 'checklist_task',
        sourceRefId: lead.sourceRefId || '',
        requestedByRole: lead.requestedByRole || 'seller',
        maxProviders: Number(lead.maxProviders || 0),
        message: lead.message || '',
        propertyAddress,
        propertyCity: lead.propertySnapshot?.city || '',
        propertyState: lead.propertySnapshot?.state || '',
        propertyZip: lead.propertySnapshot?.zip || '',
        contacted: counts.contacted,
        accepted: counts.accepted,
        declined: counts.declined,
        queued: counts.queued,
        sent: counts.sent,
        delivered: counts.delivered,
        failed: counts.failed,
        help: counts.help,
        customReplies: counts.customReplies,
        optedOut: counts.optedOut,
        dispatches: leadDispatches.map((dispatch) =>
          serializeLeadDispatch(
            dispatch,
            providerById.get(dispatch.providerId?.toString?.() || String(dispatch.providerId)),
          ),
        ),
        responses: leadResponses
          .slice(0, 8)
          .map((response) =>
            serializeProviderResponse(
              response,
              providerById.get(response.providerId?.toString?.() || String(response.providerId)),
            ),
          ),
        smsLogs: leadSmsLogs
          .slice(0, 10)
          .map((log) =>
            serializeProviderSmsLog(
              log,
              providerById.get(log.providerId?.toString?.() || String(log.providerId)),
            ),
          ),
        createdAt: lead.createdAt || null,
        updatedAt: lead.updatedAt || null,
      };
    }),
    summary: overallSummary,
  };
}

export async function resendAdminProviderLead(leadRequestId) {
  if (mongoose.connection.readyState !== 1) {
    return { dataSource: 'demo', resentCount: 0, failedCount: 0, skippedCount: 0 };
  }

  const lead = await LeadRequestModel.findById(leadRequestId);
  if (!lead) {
    throw new Error('Provider lead not found.');
  }

  const dispatches = await LeadDispatchModel.find({ leadRequestId: lead._id });
  if (!dispatches.length) {
    throw new Error('No provider dispatches exist for this lead.');
  }

  let requeuedCount = 0;
  for (const dispatch of dispatches) {
    if (['accepted', 'declined'].includes(dispatch.status)) {
      continue;
    }

    dispatch.status = 'queued';
    dispatch.sentAt = null;
    dispatch.smsSentAt = null;
    dispatch.smsMessageSid = '';
    dispatch.smsError = '';
    dispatch.respondedAt = null;
    if (!['accepted', 'declined', 'opted_out'].includes(dispatch.responseStatus || '')) {
      dispatch.responseStatus = null;
    }
    await dispatch.save();
    requeuedCount += 1;
  }

  if (!requeuedCount) {
    throw new Error('No eligible dispatches were available to resend.');
  }

  lead.status = 'routing';
  await lead.save();

  const result = await notifyQueuedLeadDispatches(lead._id);

  return {
    dataSource: 'mongodb',
    leadRequestId: lead._id?.toString?.() || String(lead._id),
    requeuedCount,
    ...result,
  };
}

export async function closeAdminProviderLead(leadRequestId, resolution = 'completed') {
  if (mongoose.connection.readyState !== 1) {
    return { dataSource: 'demo', leadRequestId, status: resolution };
  }

  if (!['completed', 'cancelled'].includes(resolution)) {
    throw new Error('Resolution must be completed or cancelled.');
  }

  const lead = await LeadRequestModel.findById(leadRequestId);
  if (!lead) {
    throw new Error('Provider lead not found.');
  }

  lead.status = resolution;
  await lead.save();

  return {
    dataSource: 'mongodb',
    leadRequestId: lead._id?.toString?.() || String(lead._id),
    status: lead.status,
  };
}
