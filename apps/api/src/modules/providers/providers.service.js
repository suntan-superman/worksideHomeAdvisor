import mongoose from 'mongoose';

import { ChecklistModel } from '../tasks/checklist.model.js';
import { getPropertyById } from '../properties/property.service.js';
import {
  LeadDispatchModel,
  LeadRequestModel,
  ProviderAnalyticsModel,
  SavedProviderModel,
} from './provider-leads.model.js';
import { ProviderCategoryModel, ProviderModel } from './provider.model.js';

export const DEFAULT_PROVIDER_CATEGORIES = [
  { key: 'inspector', label: 'Home Inspectors', description: 'Pre-listing and pre-sale property inspections.', rolloutPhase: 1, sortOrder: 1 },
  { key: 'title_company', label: 'Title Companies', description: 'Title and escrow partners for closing support.', rolloutPhase: 1, sortOrder: 2 },
  { key: 'real_estate_attorney', label: 'Real Estate Attorneys', description: 'Contract and transaction support where legal review is needed.', rolloutPhase: 1, sortOrder: 3 },
  { key: 'photographer', label: 'Photographers', description: 'Listing photo specialists for final marketing capture.', rolloutPhase: 1, sortOrder: 4 },
  { key: 'cleaning_service', label: 'Cleaning Services', description: 'Pre-listing and showing-readiness cleaners.', rolloutPhase: 1, sortOrder: 5 },
];

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeZipList(value) {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 25)
    : [];
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
  if (provider.isVerified) badges.push('Verified');
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
    createdAt: document.createdAt || null,
    updatedAt: document.updatedAt || null,
    ...extras,
  };
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
          $setOnInsert: category,
          $set: {
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

export async function createProviderProfile(payload = {}, { createdFrom = 'admin', status = 'active' } = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to create providers.');
  }

  await ensureProviderCategories();
  const categoryKey = normalizeString(payload.categoryKey);
  const category = await ProviderCategoryModel.findOne({ key: categoryKey, isActive: true }).lean();
  if (!category) throw new Error('Provider category not found.');

  const businessName = normalizeString(payload.businessName).slice(0, 140);
  if (!businessName) throw new Error('Business name is required.');

  const slug = await generateUniqueProviderSlug(businessName);
  const document = await ProviderModel.create({
    businessName,
    slug,
    categoryKey,
    description: normalizeString(payload.description).slice(0, 600),
    phone: normalizeString(payload.phone).slice(0, 40),
    email: normalizeString(payload.email).slice(0, 120),
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
    serviceArea: {
      city: normalizeString(payload.city || payload.serviceArea?.city).slice(0, 80),
      state: normalizeString(payload.state || payload.serviceArea?.state).slice(0, 40),
      zipCodes: normalizeZipList(payload.zipCodes || payload.serviceArea?.zipCodes),
      radiusMiles: Math.max(5, Math.min(150, Number(payload.radiusMiles || payload.serviceArea?.radiusMiles || 25))),
    },
    leadRouting: {
      deliveryMode: payload.deliveryMode || payload.leadRouting?.deliveryMode || 'sms_and_email',
      notifyPhone: normalizeString(payload.notifyPhone || payload.leadRouting?.notifyPhone || payload.phone).slice(0, 40),
      notifyEmail: normalizeString(payload.notifyEmail || payload.leadRouting?.notifyEmail || payload.email).slice(0, 120),
      preferredContactMethod: payload.preferredContactMethod || payload.leadRouting?.preferredContactMethod || 'sms',
    },
    subscription: {
      planCode: payload.planCode || payload.subscription?.planCode || 'provider_basic',
      status: payload.subscriptionStatus || payload.subscription?.status || (status === 'active' ? 'active' : 'pending'),
      stripeCustomerId: '',
      stripeSubscriptionId: '',
      stripePriceId: '',
    },
    onboardingSource: createdFrom,
    internalNotes: normalizeString(payload.internalNotes).slice(0, 600),
  });

  return serializeProvider(document.toObject(), { categoryLabel: category.label });
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
    ProviderCategoryModel.find({ isActive: true }).lean(),
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
    return { dataSource: 'demo', items: [] };
  }

  const leads = await LeadRequestModel.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  const leadIds = leads.map((lead) => lead._id);
  const dispatches = leadIds.length ? await LeadDispatchModel.find({ leadRequestId: { $in: leadIds } }).lean() : [];
  const dispatchCountByLeadId = new Map();

  for (const dispatch of dispatches) {
    const leadId = dispatch.leadRequestId?.toString?.() || String(dispatch.leadRequestId);
    const current = dispatchCountByLeadId.get(leadId) || { contacted: 0, accepted: 0, declined: 0 };
    current.contacted += 1;
    if (dispatch.status === 'accepted' || dispatch.responseStatus === 'accepted') current.accepted += 1;
    if (dispatch.status === 'declined' || dispatch.responseStatus === 'declined') current.declined += 1;
    dispatchCountByLeadId.set(leadId, current);
  }

  return {
    dataSource: 'mongodb',
    items: leads.map((lead) => {
      const counts = dispatchCountByLeadId.get(lead._id?.toString?.() || String(lead._id)) || { contacted: 0, accepted: 0, declined: 0 };
      return {
        id: lead._id?.toString?.() || String(lead._id),
        propertyId: lead.propertyId?.toString?.() || String(lead.propertyId),
        categoryKey: lead.categoryKey,
        status: lead.status,
        source: lead.source || 'checklist_task',
        propertyCity: lead.propertySnapshot?.city || '',
        contacted: counts.contacted,
        accepted: counts.accepted,
        declined: counts.declined,
        createdAt: lead.createdAt || null,
      };
    }),
  };
}
