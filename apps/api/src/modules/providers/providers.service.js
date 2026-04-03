import crypto from 'node:crypto';
import mongoose from 'mongoose';

import { normalizePhoneNumber, notifyQueuedLeadDispatches } from '../marketplace-sms/marketplace-sms.service.js';
import { env } from '../../config/env.js';
import { sendAdminProviderProfileChangeAlert } from '../../services/emailService.js';
import { readStoredAsset, saveProviderDocumentBuffer } from '../../services/storageService.js';
import { logError } from '../../lib/logger.js';
import { ChecklistModel } from '../tasks/checklist.model.js';
import { getPropertyById } from '../properties/property.service.js';
import { UserModel } from '../auth/auth.model.js';
import {
  LeadDispatchModel,
  LeadRequestModel,
  ProviderAnalyticsModel,
  ProviderReferenceModel,
  ProviderResponseModel,
  ProviderSmsLogModel,
  SavedProviderModel,
} from './provider-leads.model.js';
import { ProviderCategoryModel, ProviderModel } from './provider.model.js';

export const DEFAULT_PROVIDER_CATEGORIES = [
  {
    key: 'inspector',
    label: 'Home Inspectors',
    description: 'Pre-listing and pre-sale property inspections.',
    rolloutPhase: 1,
    sortOrder: 1,
    verificationRequirements: { licenseRecommended: true, insuranceRecommended: true, bondRecommended: false },
  },
  {
    key: 'title_company',
    label: 'Title Companies',
    description: 'Title and escrow partners for closing support.',
    rolloutPhase: 1,
    sortOrder: 2,
    verificationRequirements: { licenseRecommended: false, insuranceRecommended: true, bondRecommended: false },
  },
  {
    key: 'real_estate_attorney',
    label: 'Real Estate Attorneys',
    description: 'Contract and transaction support where legal review is needed.',
    rolloutPhase: 1,
    sortOrder: 3,
    verificationRequirements: { licenseRecommended: true, insuranceRecommended: true, bondRecommended: false },
  },
  {
    key: 'photographer',
    label: 'Photographers',
    description: 'Listing photo specialists for final marketing capture.',
    rolloutPhase: 1,
    sortOrder: 4,
    verificationRequirements: { licenseRecommended: false, insuranceRecommended: true, bondRecommended: false },
  },
  {
    key: 'cleaning_service',
    label: 'Cleaning Services',
    description: 'Pre-listing and showing-readiness cleaners.',
    rolloutPhase: 1,
    sortOrder: 5,
    verificationRequirements: { licenseRecommended: false, insuranceRecommended: true, bondRecommended: true },
  },
  {
    key: 'termite_inspection',
    label: 'Termite Inspectors',
    description: 'Wood destroying organism and termite inspection services.',
    rolloutPhase: 1,
    sortOrder: 6,
    verificationRequirements: { licenseRecommended: true, insuranceRecommended: true, bondRecommended: false },
  },
  {
    key: 'notary',
    label: 'Notaries',
    description: 'Mobile and in-office notarization support for transaction documents.',
    rolloutPhase: 1,
    sortOrder: 7,
    verificationRequirements: { licenseRecommended: true, insuranceRecommended: true, bondRecommended: true },
  },
  {
    key: 'nhd_report',
    label: 'NHD Report Providers',
    description: 'Natural hazard disclosure report preparation and delivery.',
    rolloutPhase: 1,
    sortOrder: 8,
    verificationRequirements: { licenseRecommended: false, insuranceRecommended: true, bondRecommended: false },
  },
];

const PROVIDER_VERIFICATION_DISCLAIMER =
  'Provider credentials are self-reported or verified where indicated. Workside does not guarantee accuracy.';

const VERIFIED_DOCUMENT_TYPES = {
  insurance_certificate: 'insurance',
  license_document: 'license',
};

const GOOGLE_PLACES_QUERY_BY_CATEGORY = {
  inspector: 'home inspector',
  title_company: 'title company',
  real_estate_attorney: 'real estate attorney',
  photographer: 'real estate photographer',
  cleaning_service: 'house cleaning service',
  termite_inspection: 'termite inspection',
  notary: 'mobile notary',
  nhd_report: 'natural hazard disclosure report provider',
};

const GOOGLE_PLACES_QUERY_VARIANTS_BY_CATEGORY = {
  inspector: ['home inspector', 'property inspector', 'home inspection service'],
  title_company: ['title company', 'escrow company'],
  real_estate_attorney: ['real estate attorney', 'real estate lawyer', 'property lawyer'],
  photographer: ['photographer', 'photography service', 'real estate photographer'],
  cleaning_service: ['cleaning service', 'house cleaning service', 'house cleaner'],
  termite_inspection: ['termite inspection', 'pest inspection', 'termite inspector'],
  notary: ['notary public', 'mobile notary', 'notary service'],
  nhd_report: ['natural hazard disclosure report', 'hazard disclosure provider', 'property disclosure service'],
  staging_company: ['home staging company', 'home stager', 'staging service'],
};

const ZIP_COORDINATE_CACHE = new Map();

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

function formatProviderStatusLabel(status) {
  return String(status || 'unavailable')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function arraysEqual(left = [], right = []) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function buildProviderProfileChangeSummary(before, after) {
  const changes = [];

  if (before.categoryKey !== after.categoryKey) changes.push(`Category changed from ${before.categoryKey || 'unset'} to ${after.categoryKey || 'unset'}`);
  if (before.description !== after.description) changes.push('Short description updated');
  if (before.websiteUrl !== after.websiteUrl) changes.push('Website updated');
  if (before.turnaroundLabel !== after.turnaroundLabel) changes.push('Turnaround updated');
  if (before.pricingSummary !== after.pricingSummary) changes.push('Pricing summary updated');
  if (!arraysEqual(before.serviceHighlights, after.serviceHighlights)) changes.push('Service highlights updated');
  if (before.city !== after.city || before.state !== after.state) changes.push(`Service city/state updated to ${[after.city, after.state].filter(Boolean).join(', ') || 'not set'}`);
  if (!arraysEqual(before.zipCodes, after.zipCodes)) changes.push('ZIP coverage updated');
  if (before.radiusMiles !== after.radiusMiles) changes.push(`Service radius updated to ${after.radiusMiles} miles`);
  if (before.notifyPhone !== after.notifyPhone) changes.push('Lead SMS phone updated');
  if (before.notifyEmail !== after.notifyEmail) changes.push('Lead email updated');
  if (before.deliveryMode !== after.deliveryMode) changes.push(`Delivery mode changed to ${after.deliveryMode}`);
  if (before.preferredContactMethod !== after.preferredContactMethod) changes.push(`Preferred contact method changed to ${after.preferredContactMethod}`);
  if (before.hasInsurance !== after.hasInsurance) changes.push(after.hasInsurance ? 'Insurance marked as provided' : 'Insurance removed');
  if (before.insuranceCarrier !== after.insuranceCarrier) changes.push('Insurance carrier updated');
  if (before.insurancePolicyNumber !== after.insurancePolicyNumber) changes.push('Insurance policy number updated');
  if (before.insuranceExpirationDate !== after.insuranceExpirationDate) changes.push('Insurance expiration updated');
  if (before.hasLicense !== after.hasLicense) changes.push(after.hasLicense ? 'License marked as provided' : 'License removed');
  if (before.licenseNumber !== after.licenseNumber) changes.push('License number updated');
  if (before.licenseState !== after.licenseState) changes.push(`License state changed to ${after.licenseState || 'unset'}`);
  if (before.hasBond !== after.hasBond) changes.push(after.hasBond ? 'Bonding marked as provided' : 'Bonding removed');

  return changes;
}

function normalizeZip(value) {
  return normalizeString(value).replace(/\D/g, '').slice(0, 5);
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function calculateDistanceMiles(pointA, pointB) {
  if (!pointA || !pointB) {
    return null;
  }

  const earthRadiusMiles = 3958.8;
  const deltaLat = toRadians(pointB.lat - pointA.lat);
  const deltaLng = toRadians(pointB.lng - pointA.lng);
  const lat1 = toRadians(pointA.lat);
  const lat2 = toRadians(pointB.lat);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return earthRadiusMiles * (2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

async function getZipCoordinates(zipCode) {
  const normalizedZip = normalizeZip(zipCode);
  if (!normalizedZip || !env.GOOGLE_MAPS_API_KEY) {
    return null;
  }

  if (ZIP_COORDINATE_CACHE.has(normalizedZip)) {
    return ZIP_COORDINATE_CACHE.get(normalizedZip);
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('components', `postal_code:${normalizedZip}|country:US`);
    url.searchParams.set('key', env.GOOGLE_MAPS_API_KEY);

    const response = await fetch(url);
    if (!response.ok) {
      ZIP_COORDINATE_CACHE.set(normalizedZip, null);
      return null;
    }

    const payload = await response.json();
    const location = payload?.results?.[0]?.geometry?.location;
    const point =
      typeof location?.lat === 'number' && typeof location?.lng === 'number'
        ? { lat: location.lat, lng: location.lng }
        : null;

    ZIP_COORDINATE_CACHE.set(normalizedZip, point);
    return point;
  } catch {
    ZIP_COORDINATE_CACHE.set(normalizedZip, null);
    return null;
  }
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

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', '1'].includes(normalized)) return true;
    if (['false', 'no', '0'].includes(normalized)) return false;
  }

  return Boolean(value);
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hashProviderPortalToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function createProviderPortalToken() {
  return crypto.randomBytes(24).toString('hex');
}

function buildVerificationRequirements(categoryDocument = null) {
  return {
    licenseRecommended: Boolean(categoryDocument?.verificationRequirements?.licenseRecommended),
    insuranceRecommended: Boolean(categoryDocument?.verificationRequirements?.insuranceRecommended),
    bondRecommended: Boolean(categoryDocument?.verificationRequirements?.bondRecommended),
  };
}

function getVerificationDocumentDownloadUrl(providerId, documentType) {
  return `${env.PUBLIC_API_URL}/api/v1/provider-portal/providers/${providerId}/verification-documents/${documentType}/file`;
}

function serializeVerificationDocument(document, providerId, documentType) {
  if (!document?.storageKey) {
    return null;
  }

  return {
    storageProvider: document.storageProvider || 'local',
    storageKey: document.storageKey,
    fileName: document.fileName || '',
    mimeType: document.mimeType || 'application/octet-stream',
    byteSize: Number(document.byteSize || 0),
    uploadedAt: document.uploadedAt || null,
    documentType,
    downloadUrl: getVerificationDocumentDownloadUrl(providerId, documentType),
  };
}

function buildVerificationLevel(verification = {}, isVerified = false) {
  if (isVerified || verification?.review?.reviewStatus === 'verified') {
    return 'verified';
  }

  const hasDetails = Boolean(
    (verification.insurance?.hasInsurance &&
      (verification.insurance?.carrier ||
        verification.insurance?.policyNumber ||
        verification.insurance?.expirationDate)) ||
      (verification.license?.hasLicense &&
        (verification.license?.licenseNumber || verification.license?.state)) ||
      verification.insurance?.certificateDocument?.storageKey ||
      verification.license?.document?.storageKey,
  );

  return hasDetails ? 'details_provided' : 'self_reported';
}

function buildVerificationBadges(provider) {
  const badges = [];
  if (provider.verification?.review?.level === 'verified' || provider.isVerified) {
    badges.push('Verified Credentials');
  }
  if (provider.verification?.insurance?.hasInsurance) {
    badges.push(
      provider.compliance?.insuranceStatus === 'verified' ? 'Insurance Verified' : 'Self-Reported Insurance',
    );
  }
  if (provider.verification?.license?.hasLicense) {
    badges.push(
      provider.compliance?.licenseStatus === 'verified' ? 'License Verified' : 'Self-Reported License',
    );
  }
  if (provider.verification?.bonding?.hasBond) {
    badges.push('Self-Reported Bonded');
  }
  return badges;
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
    verificationRequirements: buildVerificationRequirements(document),
  };
}

function buildVerificationProfile(providerDocument, categoryDocument = null) {
  const providerId = providerDocument._id?.toString?.() || String(providerDocument._id || '');
  const level = buildVerificationLevel(providerDocument.verification, providerDocument.isVerified);
  const reviewStatus =
    providerDocument.verification?.review?.reviewStatus ||
    (level === 'verified' ? 'verified' : 'none');

  return {
    insurance: {
      hasInsurance: Boolean(providerDocument.verification?.insurance?.hasInsurance),
      carrier: providerDocument.verification?.insurance?.carrier || '',
      policyNumber: providerDocument.verification?.insurance?.policyNumber || '',
      expirationDate: providerDocument.verification?.insurance?.expirationDate || null,
      certificateDocument: serializeVerificationDocument(
        providerDocument.verification?.insurance?.certificateDocument,
        providerId,
        'insurance_certificate',
      ),
    },
    license: {
      hasLicense: Boolean(providerDocument.verification?.license?.hasLicense),
      licenseNumber: providerDocument.verification?.license?.licenseNumber || '',
      state: providerDocument.verification?.license?.state || '',
      document: serializeVerificationDocument(
        providerDocument.verification?.license?.document,
        providerId,
        'license_document',
      ),
    },
    bonding: {
      hasBond: Boolean(providerDocument.verification?.bonding?.hasBond),
    },
    review: {
      level,
      reviewStatus,
      submittedAt: providerDocument.verification?.review?.submittedAt || null,
      verifiedAt: providerDocument.verification?.review?.verifiedAt || null,
      reviewedAt: providerDocument.verification?.review?.reviewedAt || null,
      reviewedBy: providerDocument.verification?.review?.reviewedBy || '',
      reviewNotes: providerDocument.verification?.review?.reviewNotes || '',
    },
    requirements: buildVerificationRequirements(categoryDocument),
    disclaimer: PROVIDER_VERIFICATION_DISCLAIMER,
    badges: buildVerificationBadges(providerDocument),
  };
}

function getProviderVerificationDocument(providerDocument, documentType) {
  if (documentType === 'insurance_certificate') {
    return providerDocument.verification?.insurance?.certificateDocument || null;
  }

  if (documentType === 'license_document') {
    return providerDocument.verification?.license?.document || null;
  }

  return null;
}

function applyProviderVerification(providerDocument, payload = {}) {
  providerDocument.verification = providerDocument.verification || {};
  providerDocument.verification.insurance = providerDocument.verification.insurance || {};
  providerDocument.verification.license = providerDocument.verification.license || {};
  providerDocument.verification.bonding = providerDocument.verification.bonding || {};
  providerDocument.verification.review = providerDocument.verification.review || {};

  if (payload.hasInsurance !== undefined) {
    providerDocument.verification.insurance.hasInsurance = normalizeBoolean(payload.hasInsurance);
  }
  if (payload.insuranceCarrier !== undefined) {
    providerDocument.verification.insurance.carrier = normalizeString(payload.insuranceCarrier).slice(0, 120);
  }
  if (payload.insurancePolicyNumber !== undefined) {
    providerDocument.verification.insurance.policyNumber = normalizeString(payload.insurancePolicyNumber).slice(0, 80);
  }
  if (payload.insuranceExpirationDate !== undefined) {
    providerDocument.verification.insurance.expirationDate = normalizeDate(payload.insuranceExpirationDate);
  }
  if (payload.hasLicense !== undefined) {
    providerDocument.verification.license.hasLicense = normalizeBoolean(payload.hasLicense);
  }
  if (payload.licenseNumber !== undefined) {
    providerDocument.verification.license.licenseNumber = normalizeString(payload.licenseNumber).slice(0, 80);
  }
  if (payload.licenseState !== undefined) {
    providerDocument.verification.license.state = normalizeString(payload.licenseState).toUpperCase().slice(0, 8);
  }
  if (payload.hasBond !== undefined) {
    providerDocument.verification.bonding.hasBond = normalizeBoolean(payload.hasBond);
  }

  const nextLevel = buildVerificationLevel(providerDocument.verification, providerDocument.isVerified);
  providerDocument.verification.review.level = nextLevel;

  if (providerDocument.isVerified) {
    providerDocument.verification.review.reviewStatus = 'verified';
    providerDocument.verification.review.verifiedAt =
      providerDocument.verification.review.verifiedAt || new Date();
  } else if (
    providerDocument.verification.insurance?.certificateDocument?.storageKey ||
    providerDocument.verification.license?.document?.storageKey
  ) {
    providerDocument.verification.review.reviewStatus =
      providerDocument.verification.review.reviewStatus === 'rejected'
        ? 'rejected'
        : 'submitted';
    providerDocument.verification.review.submittedAt =
      providerDocument.verification.review.submittedAt || new Date();
  } else if (providerDocument.verification.review.reviewStatus !== 'rejected') {
    providerDocument.verification.review.reviewStatus = 'none';
  }
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

function buildCoverageScore(provider, property, coverageContext = null) {
  if (coverageContext?.score) {
    return coverageContext.score;
  }

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

function buildProviderRankScore(provider, property, analytics, coverageContext = null) {
  const qualityScore = Math.max(0, Math.min(100, Number(provider.qualityScore || 60)));
  const responseSpeedScore = buildResponseSpeedScore(provider.averageResponseMinutes);
  const leadAcceptanceScore = buildAcceptanceScore(analytics);
  const distanceScore = buildCoverageScore(provider, property, coverageContext);
  const subscriptionBoostScore = buildSubscriptionBoostScore(provider);
  const freshnessScore = buildFreshnessScore(provider);
  const verificationLevel = buildVerificationLevel(provider.verification, provider.isVerified);
  const verificationScore =
    verificationLevel === 'verified' || provider.isVerified
      ? 100
      : verificationLevel === 'details_provided'
        ? 72
        : 45;
  const profileCompletenessScore =
    Math.min(
      100,
      [
        provider.description,
        provider.pricingSummary,
        provider.turnaroundLabel,
        provider.websiteUrl,
        ...(provider.serviceHighlights || []),
      ].filter(Boolean).length * 20,
    ) || 40;

  return {
    overallScore: Math.round(
      qualityScore * 0.3 +
        responseSpeedScore * 0.18 +
        leadAcceptanceScore * 0.15 +
        distanceScore * 0.1 +
        subscriptionBoostScore * 0.1 +
        freshnessScore * 0.07 +
        verificationScore * 0.07 +
        profileCompletenessScore * 0.03,
    ),
    breakdown: {
      qualityScore,
      responseSpeedScore,
      leadAcceptanceScore,
      distanceScore,
      subscriptionBoostScore,
      freshnessScore,
      verificationScore,
      profileCompletenessScore,
    },
  };
}

function buildRankingBadges(provider, scoreBreakdown, rankIndex, coverageContext = null) {
  const badges = [];
  const verificationLevel = buildVerificationLevel(provider.verification, provider.isVerified);
  if (rankIndex === 0) badges.push('Top Pick');
  if (provider.compliance?.approvalStatus === 'approved') badges.push('Approved');
  if (verificationLevel === 'verified' || provider.isVerified) badges.push('Verified');
  if (provider.compliance?.licenseStatus === 'verified') badges.push('Licensed');
  if (provider.compliance?.insuranceStatus === 'verified') badges.push('Insured');
  if (provider.isSponsored) badges.push('Sponsored');
  if (scoreBreakdown.responseSpeedScore >= 74) badges.push('Fast Response');
  if (coverageContext?.type === 'zip_match' || scoreBreakdown.distanceScore >= 100) badges.push('ZIP Match');
  if (coverageContext?.type === 'radius_match') badges.push('Within Service Radius');
  if (scoreBreakdown.verificationScore >= 72) badges.push('Trust Details Added');
  return badges;
}

function buildCoverageLabel(provider, property, coverageContext = null) {
  if (coverageContext?.label) {
    return coverageContext.label;
  }

  const propertyZip = normalizeString(property?.zip);
  const zipCodes = provider.serviceArea?.zipCodes || [];
  if (propertyZip && zipCodes.includes(propertyZip)) return 'Covers this ZIP';
  if (normalizeString(provider.serviceArea?.city).toLowerCase() === normalizeString(property?.city).toLowerCase()) return `Serves ${property.city}`;
  return `${provider.serviceArea?.radiusMiles || 25} mile service radius`;
}

function buildGoogleProviderQuery(categoryKey, property) {
  const serviceQuery = GOOGLE_PLACES_QUERY_BY_CATEGORY[categoryKey] || categoryKey.replace(/_/g, ' ');
  const locationQuery = [
    property?.addressLine1,
    property?.city,
    property?.state,
    property?.zip,
  ]
    .filter(Boolean)
    .join(', ');

  return [serviceQuery, 'near', locationQuery].filter(Boolean).join(' ');
}

function buildPropertyLocationQuery(property = {}) {
  return [property?.addressLine1, property?.city, property?.state, property?.zip]
    .filter(Boolean)
    .join(', ');
}

async function getPropertyCoordinates(property = {}) {
  const fullAddress = buildPropertyLocationQuery(property);
  if (!env.GOOGLE_MAPS_API_KEY || !fullAddress) {
    return getZipCoordinates(property?.zip);
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', fullAddress);
    url.searchParams.set('key', env.GOOGLE_MAPS_API_KEY);

    const response = await fetch(url);
    if (!response.ok) {
      return getZipCoordinates(property?.zip);
    }

    const payload = await response.json();
    const location = payload?.results?.[0]?.geometry?.location;
    if (typeof location?.lat === 'number' && typeof location?.lng === 'number') {
      return { lat: location.lat, lng: location.lng };
    }
  } catch {
    return getZipCoordinates(property?.zip);
  }

  return getZipCoordinates(property?.zip);
}

async function requestGoogleFallbackPlaces(textQuery, { limit = 5, locationBias = null } = {}) {
  const body = {
    textQuery,
    maxResultCount: Math.max(1, Math.min(Number(limit || 5), 5)),
    languageCode: 'en',
    regionCode: 'US',
  };

  if (locationBias?.lat && locationBias?.lng) {
    body.locationBias = {
      circle: {
        center: {
          latitude: locationBias.lat,
          longitude: locationBias.lng,
        },
        radius: 120000,
      },
    };
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.primaryTypeDisplayName',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      items: [],
      diagnostic:
        payload?.error?.message ||
        `Places API searchText request failed with status ${response.status}.`,
    };
  }

  if (payload?.error?.message) {
    return {
      items: [],
      diagnostic: payload.error.message,
    };
  }

  return {
    items: Array.isArray(payload.places) ? payload.places : [],
    diagnostic: '',
  };
}

async function requestGoogleLegacyTextSearch(textQuery, { limit = 5, locationBias = null } = {}) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', textQuery);
  url.searchParams.set('key', env.GOOGLE_MAPS_API_KEY);

  if (locationBias?.lat && locationBias?.lng) {
    url.searchParams.set('location', `${locationBias.lat},${locationBias.lng}`);
    url.searchParams.set('radius', '120000');
  }

  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      items: [],
      diagnostic:
        payload?.error_message ||
        `Places legacy text search request failed with status ${response.status}.`,
    };
  }

  if (payload?.status && payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') {
    return {
      items: [],
      diagnostic: payload.error_message || `Places legacy text search returned ${payload.status}.`,
    };
  }

  return {
    items: Array.isArray(payload.results) ? payload.results : [],
    diagnostic: '',
  };
}

function buildExternalProviderFallbackItem(place = {}, categoryKey = '', property = {}) {
  const displayName =
    place.displayName?.text ||
    place.name ||
    'Google result';
  const address = place.formattedAddress || '';
  const primaryType = place.primaryTypeDisplayName?.text || 'Google Maps result';

  return {
    id: `google-${place.id || slugify(`${displayName}-${address}`)}`,
    userId: '',
    businessName: displayName,
    slug: slugify(displayName),
    categoryKey,
    description: address || `${primaryType} near ${property.city || property.state || 'the property'}.`,
    phone: place.nationalPhoneNumber || '',
    email: '',
    websiteUrl: place.websiteUri || '',
    mapsUrl: place.googleMapsUri || '',
    status: 'external',
    isVerified: false,
    isSponsored: false,
    qualityScore: 0,
    averageResponseMinutes: 0,
    yearsInBusiness: null,
    turnaroundLabel: '',
    pricingSummary: '',
    serviceHighlights: primaryType ? [primaryType] : [],
    serviceArea: {
      city: property.city || '',
      state: property.state || '',
      zipCodes: property.zip ? [property.zip] : [],
      radiusMiles: 0,
    },
    leadRouting: {
      deliveryMode: 'email',
      notifyPhone: '',
      notifyEmail: '',
      preferredContactMethod: 'email',
    },
    subscription: {
      planCode: 'external_fallback',
      status: 'external',
    },
    compliance: {
      approvalStatus: 'draft',
      licenseStatus: 'unverified',
      insuranceStatus: 'unverified',
      reviewedAt: null,
      reviewedBy: '',
    },
    verification: {
      review: {
        level: 'self_reported',
      },
      disclaimer: PROVIDER_VERIFICATION_DISCLAIMER,
    },
    coverageLabel: 'Google Maps result',
    rankingBadges: ['Google result'],
    rating: Number(place.rating || 0),
    reviewCount: Number(place.userRatingCount || 0),
    externalSource: 'google_places',
    isExternalFallback: true,
    createdAt: null,
    updatedAt: null,
  };
}

function buildLegacyGoogleProviderFallbackItem(place = {}, categoryKey = '', property = {}) {
  const displayName = place.name || 'Google result';
  const address = place.formatted_address || '';

  return {
    id: `google-${place.place_id || slugify(`${displayName}-${address}`)}`,
    sourceRefId: place.place_id || '',
    userId: '',
    businessName: displayName,
    slug: slugify(displayName),
    categoryKey,
    description: address || `Google Maps result near ${property.city || property.state || 'the property'}.`,
    phone: '',
    email: '',
    websiteUrl: '',
    mapsUrl:
      place.place_id
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayName)}&query_place_id=${encodeURIComponent(place.place_id)}`
        : address
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([displayName, address].filter(Boolean).join(', '))}`
          : '',
    status: 'external',
    isVerified: false,
    isSponsored: false,
    qualityScore: 0,
    averageResponseMinutes: 0,
    yearsInBusiness: null,
    turnaroundLabel: '',
    pricingSummary: '',
    serviceHighlights: ['Google Maps result'],
    serviceArea: {
      city: property.city || '',
      state: property.state || '',
      zipCodes: property.zip ? [property.zip] : [],
      radiusMiles: 0,
    },
    leadRouting: {
      deliveryMode: 'email',
      notifyPhone: '',
      notifyEmail: '',
      preferredContactMethod: 'email',
    },
    subscription: {
      planCode: 'external_fallback',
      status: 'external',
    },
    compliance: {
      approvalStatus: 'draft',
      licenseStatus: 'unverified',
      insuranceStatus: 'unverified',
      reviewedAt: null,
      reviewedBy: '',
    },
    verification: {
      review: {
        level: 'self_reported',
      },
      disclaimer: PROVIDER_VERIFICATION_DISCLAIMER,
    },
    coverageLabel: 'Google Maps result',
    rankingBadges: ['Google result'],
    rating: Number(place.rating || 0),
    reviewCount: Number(place.user_ratings_total || 0),
    externalSource: 'google_places_legacy',
    isExternalFallback: true,
    createdAt: null,
    updatedAt: null,
  };
}

async function searchGoogleFallbackProviders(property, { categoryKey = '', limit = 5 } = {}) {
  if (!env.GOOGLE_MAPS_API_KEY || !property || !categoryKey) {
    return { items: [], diagnostic: '' };
  }

  const queryVariants =
    GOOGLE_PLACES_QUERY_VARIANTS_BY_CATEGORY[categoryKey] ||
    [GOOGLE_PLACES_QUERY_BY_CATEGORY[categoryKey] || categoryKey.replace(/_/g, ' ')];
  const serviceQuery = queryVariants[0];
  const cityStateZip = [property?.city, property?.state, property?.zip].filter(Boolean).join(', ');
  const fullAddress = buildPropertyLocationQuery(property);
  const fallbackQueries = queryVariants
    .flatMap((queryTerm) => [
      queryTerm,
      cityStateZip ? `${queryTerm} near ${cityStateZip}` : '',
      property?.city && property?.state ? `${queryTerm} in ${property.city}, ${property.state}` : '',
      fullAddress ? `${queryTerm} near ${fullAddress}` : '',
    ])
    .map((query) => normalizeString(query))
    .filter(Boolean)
    .filter((query, index, allQueries) => allQueries.indexOf(query) === index);

  if (!fallbackQueries.length) {
    return { items: [], diagnostic: '' };
  }

  try {
    const propertyCoordinates = await getPropertyCoordinates(property);
    let latestDiagnostic = '';

    for (const textQuery of fallbackQueries) {
      const { items: places, diagnostic } = await requestGoogleFallbackPlaces(textQuery, {
        limit,
        locationBias: propertyCoordinates,
      });
      if (diagnostic) {
        latestDiagnostic = latestDiagnostic || diagnostic;
      }

      if (places.length) {
        return {
          items: places
            .slice(0, Math.max(1, Math.min(Number(limit || 5), 5)))
            .map((place) => buildExternalProviderFallbackItem(place, categoryKey, property)),
          diagnostic: '',
        };
      }
    }

    for (const textQuery of fallbackQueries) {
      const { items: places, diagnostic } = await requestGoogleLegacyTextSearch(textQuery, {
        limit,
        locationBias: propertyCoordinates,
      });
      if (diagnostic) {
        latestDiagnostic = latestDiagnostic || diagnostic;
      }

      if (places.length) {
        return {
          items: places
            .slice(0, Math.max(1, Math.min(Number(limit || 5), 5)))
            .map((place) => buildLegacyGoogleProviderFallbackItem(place, categoryKey, property)),
          diagnostic: '',
        };
      }
    }

    return { items: [], diagnostic: latestDiagnostic };
  } catch (error) {
    logError('provider.google_fallback_search_failed', error, {
      categoryKey,
      propertyId: property?._id?.toString?.() || String(property?._id || ''),
    });
    return {
      items: [],
      diagnostic: 'Google fallback search could not be completed at this time.',
    };
  }
}

function serializeProvider(document, extras = {}) {
  const { categoryDocument, ...restExtras } = extras;
  const category = categoryDocument || null;
  const verification = buildVerificationProfile(document, category);

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
    verification,
    createdAt: document.createdAt || null,
    updatedAt: document.updatedAt || null,
    ...restExtras,
  };
}

function serializeProviderReference(document) {
  if (!document) {
    return null;
  }

  return {
    id: document._id?.toString?.() || String(document._id),
    propertyId: document.propertyId?.toString?.() || String(document.propertyId || ''),
    userId: document.userId?.toString?.() || String(document.userId || ''),
    providerId: document.providerId?.toString?.() || String(document.providerId || ''),
    source: document.source || 'internal',
    sourceRefId: document.sourceRefId || '',
    categoryKey: document.categoryKey || '',
    categoryLabel: document.categoryLabel || '',
    businessName: document.businessName || '',
    description: document.description || '',
    coverageLabel: document.coverageLabel || '',
    city: document.city || '',
    state: document.state || '',
    email: document.email || '',
    phone: document.phone || '',
    websiteUrl: document.websiteUrl || '',
    mapsUrl: document.mapsUrl || '',
    rating: Number(document.rating || 0),
    reviewCount: Number(document.reviewCount || 0),
    notes: document.notes || '',
    createdAt: document.createdAt || null,
    updatedAt: document.updatedAt || null,
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
    const linkedProviders = await ProviderModel.find({ userId }).sort({ updatedAt: -1, createdAt: -1 });
    if (linkedProviders.length > 1) {
      throw new Error('Multiple provider profiles are linked to this account. Contact support so the correct profile can be linked.');
    }
    provider = linkedProviders[0] || null;
  }

  if (!provider && email) {
    const emailProviders = await ProviderModel.find({ email: String(email).toLowerCase().trim() }).sort({
      updatedAt: -1,
      createdAt: -1,
    });
    if (emailProviders.length > 1) {
      throw new Error('Multiple provider profiles share this email address. Contact support so the correct profile can be linked.');
    }
    provider = emailProviders[0] || null;
    if (provider && !provider.userId && userId && mongoose.Types.ObjectId.isValid(userId)) {
      provider.userId = userId;
      await provider.save();
    }
  }

  return provider;
}

async function buildProviderPortalDashboard(providerDocument) {
  const providerId = providerDocument._id;
  const [dispatches, analytics, category] = await Promise.all([
    LeadDispatchModel.find({ providerId }).sort({ createdAt: -1 }).limit(30).lean(),
    ProviderAnalyticsModel.findOne({
      providerId,
      monthKey: new Date().toISOString().slice(0, 7),
    }).lean(),
    ProviderCategoryModel.findOne({ key: providerDocument.categoryKey }).lean(),
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
      categoryLabel: category?.label || providerDocument.categoryKey,
      categoryDocument: category || null,
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
            verificationRequirements: buildVerificationRequirements(category),
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
    verificationRequirements: buildVerificationRequirements(payload),
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
  if (payload.verificationRequirements) {
    category.verificationRequirements = {
      ...buildVerificationRequirements(category),
      ...buildVerificationRequirements(payload.verificationRequirements),
    };
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

async function buildProviderCoverageContext(provider, property) {
  const propertyState = normalizeString(property?.state).toLowerCase();
  const propertyCity = normalizeString(property?.city).toLowerCase();
  const propertyZip = normalizeZip(property?.zip);
  const providerState = normalizeString(provider.serviceArea?.state).toLowerCase();
  const providerCity = normalizeString(provider.serviceArea?.city).toLowerCase();
  const providerZips = (provider.serviceArea?.zipCodes || []).map(normalizeZip).filter(Boolean);
  const radiusMiles = Math.max(0, Number(provider.serviceArea?.radiusMiles || 25));

  if (propertyZip && providerZips.includes(propertyZip)) {
    return {
      matches: true,
      type: 'zip_match',
      score: 100,
      label: 'Covers this ZIP',
      distanceMiles: 0,
    };
  }

  if (propertyZip && providerZips.length && radiusMiles > 0) {
    const propertyCoordinates = await getZipCoordinates(propertyZip);
    if (propertyCoordinates) {
      const providerCoordinateEntries = await Promise.all(
        providerZips.map(async (zipCode) => ({
          zipCode,
          point: await getZipCoordinates(zipCode),
        })),
      );

      const distanceEntries = providerCoordinateEntries
        .map((entry) => ({
          zipCode: entry.zipCode,
          distanceMiles: entry.point ? calculateDistanceMiles(propertyCoordinates, entry.point) : null,
        }))
        .filter((entry) => typeof entry.distanceMiles === 'number' && Number.isFinite(entry.distanceMiles));

      if (distanceEntries.length) {
        const closest = distanceEntries.sort((left, right) => left.distanceMiles - right.distanceMiles)[0];
        if (closest.distanceMiles <= radiusMiles) {
          const coverageRatio = radiusMiles ? closest.distanceMiles / radiusMiles : 0;
          return {
            matches: true,
            type: 'radius_match',
            score: Math.max(65, Math.round(95 - coverageRatio * 25)),
            label: `Covers property from ZIP ${closest.zipCode} (${closest.distanceMiles.toFixed(1)} mi away)`,
            distanceMiles: closest.distanceMiles,
            sourceZip: closest.zipCode,
          };
        }
      }
    }
  }

  if (providerCity && providerState && providerCity === propertyCity && providerState === propertyState) {
    return {
      matches: true,
      type: 'city_match',
      score: 80,
      label: `Serves ${property.city}`,
      distanceMiles: null,
    };
  }

  if (providerState && providerState === propertyState && radiusMiles >= 25) {
    return {
      matches: true,
      type: 'state_radius_match',
      score: 55,
      label: `${radiusMiles} mile service radius`,
      distanceMiles: null,
    };
  }

  return {
    matches: false,
    type: 'none',
    score: 20,
    label: `${radiusMiles} mile service radius`,
    distanceMiles: null,
  };
}

export async function listProvidersForProperty(
  propertyId,
  { categoryKey = '', limit = 3, taskKey = '', includeExternal = false } = {},
) {
  const property = await getPropertyById(propertyId);
  if (!property) {
    throw new Error('Property not found.');
  }

  const categories = await listProviderCategories();
  const categoryByKey = new Map(categories.map((category) => [category.key, category]));
  const resolvedCategoryKey = await resolveRequestedCategory(propertyId, { categoryKey, taskKey });

  if (mongoose.connection.readyState !== 1) {
    return {
      categories,
      categoryKey: resolvedCategoryKey || '',
      items: [],
      source: { internalProviders: 0, googleFallbackEnabled: false },
    };
  }

  const query = {};
  if (resolvedCategoryKey) {
    query.categoryKey = resolvedCategoryKey;
  }

  const providerDocuments = await ProviderModel.find(query)
    .sort({ isSponsored: -1, qualityScore: -1, updatedAt: -1 })
    .lean();
  const providerCoverageEntries = await Promise.all(
    providerDocuments.map(async (provider) => ({
      provider,
      coverage: await buildProviderCoverageContext(provider, property),
    })),
  );
  const matchedProviders = providerCoverageEntries.filter((entry) => entry.coverage.matches);
  const providers = matchedProviders.filter((entry) => entry.provider.status === 'active');
  const unavailableProviders = matchedProviders.filter((entry) => entry.provider.status !== 'active');
  const unavailableStatusCounts = unavailableProviders.reduce((summary, provider) => {
    const key = normalizeString(provider.provider.status) || 'unavailable';
    summary[key] = Number(summary[key] || 0) + 1;
    return summary;
  }, {});

  const analyticsByProviderId = await getProviderAnalyticsMap(providers.map(({ provider }) => provider._id));
  const savedProviderIds = new Set(
    (
      await SavedProviderModel.find({
        propertyId,
        userId: property.ownerUserId,
      }).lean()
    ).map((entry) => entry.providerId?.toString?.() || String(entry.providerId)),
  );

  const rankedProviders = providers
    .map(({ provider, coverage }) => {
      const providerId = provider._id?.toString?.() || String(provider._id);
      return {
        provider,
        coverage,
        analytics: analyticsByProviderId.get(providerId) || null,
        rank: buildProviderRankScore(
          provider,
          property,
          analyticsByProviderId.get(providerId) || null,
          coverage,
        ),
      };
    })
    .sort((left, right) => {
      if (right.rank.overallScore !== left.rank.overallScore) {
        return right.rank.overallScore - left.rank.overallScore;
      }
      return new Date(right.provider.updatedAt || 0).getTime() - new Date(left.provider.updatedAt || 0).getTime();
    })
    .slice(0, Math.max(1, Number(limit || 3)));

  const googleFallbackResult = !rankedProviders.length || includeExternal
    ? await searchGoogleFallbackProviders(property, {
        categoryKey: resolvedCategoryKey,
        limit: Math.max(1, Math.min(Number(limit || 5), 5)),
      })
    : { items: [], diagnostic: '' };
  const externalItems = googleFallbackResult.items || [];

  return {
    categories,
    categoryKey: resolvedCategoryKey || '',
    items: rankedProviders.map(({ provider, analytics, rank, coverage }, index) =>
      serializeProvider(provider, {
        saved: savedProviderIds.has(provider._id?.toString?.() || String(provider._id)),
        categoryDocument: categoryByKey.get(provider.categoryKey) || null,
        city: provider.serviceArea?.city || '',
        state: provider.serviceArea?.state || '',
        coverageLabel: buildCoverageLabel(provider, property, coverage),
        rankingBadges: buildRankingBadges(provider, rank.breakdown, index, coverage),
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
    unavailableItems: unavailableProviders.map(({ provider, coverage }) =>
      serializeProvider(provider, {
        saved: savedProviderIds.has(provider._id?.toString?.() || String(provider._id)),
        categoryDocument: categoryByKey.get(provider.categoryKey) || null,
        city: provider.serviceArea?.city || '',
        state: provider.serviceArea?.state || '',
        coverageLabel: buildCoverageLabel(provider, property, coverage),
        rankingBadges: [
          formatProviderStatusLabel(provider.status),
          ...(provider.serviceHighlights || []).slice(0, 2),
        ],
      }),
    ),
    externalItems,
    source: {
      internalProviders: providers.length,
      totalCategoryProviders: matchedProviders.length,
      unavailableProviders: unavailableProviders.length,
      unavailableStatusCounts,
      externalProviders: externalItems.length,
      googleFallbackEnabled: Boolean(env.GOOGLE_MAPS_API_KEY),
      googleFallbackDiagnostic: googleFallbackResult.diagnostic || '',
      categoryLabel: categoryByKey.get(resolvedCategoryKey || '')?.label || '',
    },
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

export async function createProviderReferenceForProperty(propertyId, payload = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to save provider references.');
  }

  const property = await getPropertyById(propertyId);
  if (!property) throw new Error('Property not found.');

  const source = payload.source === 'google_maps' ? 'google_maps' : 'internal';
  let sourceRefId = normalizeString(payload.sourceRefId);
  let providerId = null;
  let referencePayload = {
    categoryKey: normalizeString(payload.categoryKey),
    categoryLabel: normalizeString(payload.categoryLabel),
    businessName: normalizeString(payload.businessName),
    description: normalizeString(payload.description).slice(0, 400),
    coverageLabel: normalizeString(payload.coverageLabel).slice(0, 120),
    city: normalizeString(payload.city).slice(0, 80),
    state: normalizeString(payload.state).slice(0, 40),
    email: normalizeString(payload.email).slice(0, 120),
    phone: normalizeString(payload.phone).slice(0, 40),
    websiteUrl: normalizeString(payload.websiteUrl).slice(0, 220),
    mapsUrl: normalizeString(payload.mapsUrl).slice(0, 220),
    rating: Number(payload.rating || 0),
    reviewCount: Number(payload.reviewCount || 0),
    notes: normalizeString(payload.notes).slice(0, 240),
  };

  if (source === 'internal') {
    providerId = payload.providerId;
    const provider = await ProviderModel.findById(providerId).lean();
    if (!provider) {
      throw new Error('Provider not found.');
    }
    sourceRefId = provider._id?.toString?.() || String(provider._id);
    referencePayload = {
      categoryKey: provider.categoryKey || '',
      categoryLabel: payload.categoryLabel || '',
      businessName: provider.businessName || '',
      description: provider.description || '',
      coverageLabel: payload.coverageLabel || '',
      city: provider.serviceArea?.city || '',
      state: provider.serviceArea?.state || '',
      email: provider.email || '',
      phone: provider.phone || '',
      websiteUrl: provider.websiteUrl || '',
      mapsUrl: '',
      rating: 0,
      reviewCount: 0,
      notes: normalizeString(payload.notes).slice(0, 240),
    };
  }

  if (!sourceRefId || !referencePayload.businessName) {
    throw new Error('Provider reference is missing required details.');
  }

  const existingReference = await ProviderReferenceModel.findOne({
    propertyId,
    userId: property.ownerUserId,
    source,
    sourceRefId,
  }).lean();

  if (!existingReference) {
    const existingCount = await ProviderReferenceModel.countDocuments({
      propertyId,
      userId: property.ownerUserId,
    });
    if (existingCount >= 5) {
      throw new Error('You can save up to 5 provider references per property.');
    }
  }

  const reference = await ProviderReferenceModel.findOneAndUpdate(
    {
      propertyId,
      userId: property.ownerUserId,
      source,
      sourceRefId,
    },
    {
      $set: {
        providerId,
        ...referencePayload,
      },
      $setOnInsert: {
        propertyId,
        userId: property.ownerUserId,
        source,
        sourceRefId,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  ).lean();

  return {
    reference: serializeProviderReference(reference),
  };
}

export async function listProviderReferencesForProperty(propertyId) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to list provider references.');
  }

  const property = await getPropertyById(propertyId);
  if (!property) throw new Error('Property not found.');

  const references = await ProviderReferenceModel.find({
    propertyId,
    userId: property.ownerUserId,
  })
    .sort({ createdAt: 1, businessName: 1 })
    .lean();

  return {
    items: references.map((reference) => serializeProviderReference(reference)),
  };
}

export async function deleteProviderReference(referenceId) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to remove provider references.');
  }

  const reference = await ProviderReferenceModel.findById(referenceId);
  if (!reference) {
    throw new Error('Provider reference not found.');
  }

  await reference.deleteOne();

  return {
    deleted: true,
    referenceId,
  };
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

    await notifyQueuedLeadDispatches(leadRequest._id, console, {
      deliveryMode: payload.deliveryMode || 'email',
    });
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
      emailSentAt: dispatch.emailSentAt || null,
      emailError: dispatch.emailError || '',
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
  const document = new ProviderModel({
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
    verification: {},
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

  applyProviderVerification(document, payload);

  if (document.isVerified || payload.reviewStatus === 'verified') {
    document.verification.review.reviewStatus = 'verified';
    document.verification.review.verifiedAt = new Date();
    document.compliance.licenseStatus = document.verification.license?.hasLicense
      ? 'verified'
      : document.compliance.licenseStatus;
    document.compliance.insuranceStatus = document.verification.insurance?.hasInsurance
      ? 'verified'
      : document.compliance.insuranceStatus;
  }

  await document.save();

  return serializeProvider(document.toObject(), {
    categoryLabel: category.label,
    categoryDocument: category,
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
  const wasApproved = provider.compliance?.approvalStatus === 'approved';
  const beforeSnapshot = {
    categoryKey: normalizeString(provider.categoryKey),
    description: normalizeString(provider.description),
    websiteUrl: normalizeString(provider.websiteUrl),
    turnaroundLabel: normalizeString(provider.turnaroundLabel),
    pricingSummary: normalizeString(provider.pricingSummary),
    serviceHighlights: (provider.serviceHighlights || []).map(normalizeString),
    city: normalizeString(provider.serviceArea?.city),
    state: normalizeString(provider.serviceArea?.state),
    zipCodes: (provider.serviceArea?.zipCodes || []).map(normalizeString),
    radiusMiles: Number(provider.serviceArea?.radiusMiles || 25),
    notifyPhone: normalizeString(provider.leadRouting?.notifyPhone),
    notifyEmail: normalizeString(provider.leadRouting?.notifyEmail),
    deliveryMode: normalizeString(provider.leadRouting?.deliveryMode),
    preferredContactMethod: normalizeString(provider.leadRouting?.preferredContactMethod),
    hasInsurance: Boolean(provider.verification?.insurance?.hasInsurance),
    insuranceCarrier: normalizeString(provider.verification?.insurance?.carrier),
    insurancePolicyNumber: normalizeString(provider.verification?.insurance?.policyNumber),
    insuranceExpirationDate: provider.verification?.insurance?.expirationDate
      ? new Date(provider.verification.insurance.expirationDate).toISOString().slice(0, 10)
      : '',
    hasLicense: Boolean(provider.verification?.license?.hasLicense),
    licenseNumber: normalizeString(provider.verification?.license?.licenseNumber),
    licenseState: normalizeString(provider.verification?.license?.state),
    hasBond: Boolean(provider.verification?.bonding?.hasBond),
  };
  if (payload.categoryKey !== undefined) {
    const categoryKey = normalizeString(payload.categoryKey);
    const category = await ProviderCategoryModel.findOne({ key: categoryKey, isActive: true }).lean();
    if (!category) {
      throw new Error('Select a valid active provider category.');
    }
    provider.categoryKey = category.key;
  }
  const touchedVerificationField = [
    'hasInsurance',
    'insuranceCarrier',
    'insurancePolicyNumber',
    'insuranceExpirationDate',
    'hasLicense',
    'licenseNumber',
    'licenseState',
    'hasBond',
  ].some((field) => payload[field] !== undefined);

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
  if (touchedVerificationField && provider.verification?.review?.reviewStatus === 'verified') {
    provider.isVerified = false;
    provider.verification.review.reviewStatus = 'submitted';
    provider.verification.review.verifiedAt = null;
    if (provider.verification.license?.hasLicense) {
      provider.compliance.licenseStatus = 'unverified';
    }
    if (provider.verification.insurance?.hasInsurance) {
      provider.compliance.insuranceStatus = 'unverified';
    }
  }

  if (touchedVerificationField) {
    applyProviderVerification(provider, payload);
  }

  await provider.save();
  const category = await ProviderCategoryModel.findOne({ key: provider.categoryKey }).lean();
  const afterSnapshot = {
    categoryKey: normalizeString(provider.categoryKey),
    description: normalizeString(provider.description),
    websiteUrl: normalizeString(provider.websiteUrl),
    turnaroundLabel: normalizeString(provider.turnaroundLabel),
    pricingSummary: normalizeString(provider.pricingSummary),
    serviceHighlights: (provider.serviceHighlights || []).map(normalizeString),
    city: normalizeString(provider.serviceArea?.city),
    state: normalizeString(provider.serviceArea?.state),
    zipCodes: (provider.serviceArea?.zipCodes || []).map(normalizeString),
    radiusMiles: Number(provider.serviceArea?.radiusMiles || 25),
    notifyPhone: normalizeString(provider.leadRouting?.notifyPhone),
    notifyEmail: normalizeString(provider.leadRouting?.notifyEmail),
    deliveryMode: normalizeString(provider.leadRouting?.deliveryMode),
    preferredContactMethod: normalizeString(provider.leadRouting?.preferredContactMethod),
    hasInsurance: Boolean(provider.verification?.insurance?.hasInsurance),
    insuranceCarrier: normalizeString(provider.verification?.insurance?.carrier),
    insurancePolicyNumber: normalizeString(provider.verification?.insurance?.policyNumber),
    insuranceExpirationDate: provider.verification?.insurance?.expirationDate
      ? new Date(provider.verification.insurance.expirationDate).toISOString().slice(0, 10)
      : '',
    hasLicense: Boolean(provider.verification?.license?.hasLicense),
    licenseNumber: normalizeString(provider.verification?.license?.licenseNumber),
    licenseState: normalizeString(provider.verification?.license?.state),
    hasBond: Boolean(provider.verification?.bonding?.hasBond),
  };
  const changeItems = buildProviderProfileChangeSummary(beforeSnapshot, afterSnapshot);

  if (wasApproved && changeItems.length) {
    const coverageLabel = [
      provider.serviceArea?.city,
      provider.serviceArea?.state,
      provider.serviceArea?.zipCodes?.length
        ? `ZIPs: ${(provider.serviceArea.zipCodes || []).join(', ')}`
        : '',
      provider.serviceArea?.radiusMiles ? `${provider.serviceArea.radiusMiles} mile radius` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    sendAdminProviderProfileChangeAlert({
      businessName: provider.businessName,
      providerEmail: provider.email,
      categoryLabel: category?.label || provider.categoryKey,
      coverageLabel,
      changeItems,
    }).catch((error) => {
      logError('Approved provider profile change alert failed', {
        providerId: provider._id?.toString?.() || String(provider._id),
        message: error.message,
      });
    });
  }

  const dashboard = await buildProviderPortalDashboard(provider);
  return { dashboard };
}

export async function uploadProviderVerificationDocument(providerId, token, payload = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required for provider verification uploads.');
  }

  const provider = await authenticateProviderPortal(providerId, token);
  const documentType = VERIFIED_DOCUMENT_TYPES[payload.documentType] ? payload.documentType : '';
  if (!documentType) {
    throw new Error('Unsupported provider verification document type.');
  }

  const buffer = Buffer.from(String(payload.fileBase64 || ''), 'base64');
  if (!buffer.byteLength) {
    throw new Error('Verification document upload was empty.');
  }

  const savedDocument = await saveProviderDocumentBuffer({
    providerId: provider._id?.toString?.() || String(provider._id),
    documentType,
    mimeType: payload.mimeType,
    buffer,
  });

  const nextDocument = {
    ...savedDocument,
    fileName: normalizeString(payload.fileName).slice(0, 180),
    mimeType: payload.mimeType,
    uploadedAt: new Date(),
  };

  if (documentType === 'insurance_certificate') {
    provider.verification.insurance.certificateDocument = nextDocument;
    provider.verification.insurance.hasInsurance = true;
  }

  if (documentType === 'license_document') {
    provider.verification.license.document = nextDocument;
    provider.verification.license.hasLicense = true;
  }

  provider.isVerified = false;
  provider.verification.review.reviewStatus = 'submitted';
  provider.verification.review.submittedAt = new Date();
  provider.verification.review.reviewNotes = '';
  provider.verification.review.verifiedAt = null;
  applyProviderVerification(provider, {});

  if (provider.verification.license?.hasLicense) {
    provider.compliance.licenseStatus = 'unverified';
  }
  if (provider.verification.insurance?.hasInsurance) {
    provider.compliance.insuranceStatus = 'unverified';
  }

  await provider.save();
  const dashboard = await buildProviderPortalDashboard(provider);
  return { dashboard };
}

export async function submitProviderVerification(providerId, token) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required for provider verification submission.');
  }

  const provider = await authenticateProviderPortal(providerId, token);
  const hasDetails =
    provider.verification?.insurance?.carrier ||
    provider.verification?.insurance?.policyNumber ||
    provider.verification?.insurance?.expirationDate ||
    provider.verification?.license?.licenseNumber ||
    provider.verification?.license?.state ||
    provider.verification?.insurance?.certificateDocument?.storageKey ||
    provider.verification?.license?.document?.storageKey;

  if (!hasDetails) {
    throw new Error('Add verification details or upload at least one document before submitting for review.');
  }

  provider.verification.review.reviewStatus = 'submitted';
  provider.verification.review.submittedAt = new Date();
  provider.verification.review.reviewNotes = '';
  provider.isVerified = false;
  applyProviderVerification(provider, {});

  await provider.save();
  const dashboard = await buildProviderPortalDashboard(provider);
  return { dashboard };
}

export async function getProviderVerificationDocumentFile(
  providerId,
  { token = '', session = null, documentType = '' } = {},
) {
  if (!VERIFIED_DOCUMENT_TYPES[documentType]) {
    throw new Error('Unsupported provider verification document type.');
  }

  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required for provider verification documents.');
  }

  const provider = await ProviderModel.findById(providerId);
  if (!provider) {
    throw new Error('Provider not found.');
  }

  const isAdminSession = ['admin', 'super_admin'].includes(session?.role || '');
  const isProviderSession =
    session?.sub &&
    String(provider.userId || '') === String(session.sub) &&
    ['provider', 'admin', 'super_admin'].includes(session.role || '');

  if (!isAdminSession && !isProviderSession) {
    await authenticateProviderPortal(providerId, token);
  }

  const document = getProviderVerificationDocument(provider, documentType);
  if (!document?.storageKey) {
    throw new Error('Verification document not found.');
  }

  const stored = await readStoredAsset({
    storageProvider: document.storageProvider,
    storageKey: document.storageKey,
  });

  return {
    buffer: stored.buffer,
    mimeType: document.mimeType || 'application/octet-stream',
    fileName: document.fileName || `${documentType}.bin`,
  };
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

  provider.verification = provider.verification || {};
  provider.verification.review = provider.verification.review || {};
  provider.verification.insurance = provider.verification.insurance || {};
  provider.verification.license = provider.verification.license || {};

  if (payload.approvalStatus) {
    provider.compliance.approvalStatus = payload.approvalStatus;
    provider.compliance.reviewedAt = new Date();
    provider.compliance.reviewedBy = normalizeString(payload.reviewedBy || 'admin_console').slice(0, 80);
  }

  if (payload.reviewNotes !== undefined) {
    provider.verification.review.reviewNotes = normalizeString(payload.reviewNotes).slice(0, 600);
  }

  if (payload.reviewStatus) {
    provider.verification.review.reviewStatus = payload.reviewStatus;
    provider.verification.review.reviewedAt = new Date();
    provider.verification.review.reviewedBy = normalizeString(payload.reviewedBy || 'admin_console').slice(0, 80);

    if (payload.reviewStatus === 'submitted') {
      provider.verification.review.submittedAt = provider.verification.review.submittedAt || new Date();
      provider.isVerified = false;
    }

    if (payload.reviewStatus === 'verified') {
      provider.verification.review.verifiedAt = new Date();
      provider.verification.review.level = 'verified';
      provider.isVerified = true;
      if (provider.verification.insurance?.hasInsurance) {
        provider.compliance.insuranceStatus = 'verified';
      }
      if (provider.verification.license?.hasLicense) {
        provider.compliance.licenseStatus = 'verified';
      }
    }

    if (payload.reviewStatus === 'rejected') {
      provider.isVerified = false;
      provider.verification.review.verifiedAt = null;
      if (provider.verification.insurance?.hasInsurance) {
        provider.compliance.insuranceStatus = 'unverified';
      }
      if (provider.verification.license?.hasLicense) {
        provider.compliance.licenseStatus = 'unverified';
      }
    }
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
    if (provider.isVerified) {
      provider.verification.review.reviewStatus = 'verified';
      provider.verification.review.level = 'verified';
      provider.verification.review.verifiedAt = provider.verification.review.verifiedAt || new Date();
    }
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
  const category = await ProviderCategoryModel.findOne({ key: provider.categoryKey }).lean();
  return {
    provider: serializeProvider(provider.toObject(), {
      categoryLabel: category?.label || provider.categoryKey,
      categoryDocument: category || null,
    }),
  };
}

export async function deleteAdminProvider(providerId) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection is required to remove providers.');
  }

  const provider = await ProviderModel.findById(providerId);
  if (!provider) {
    throw new Error('Provider not found.');
  }

  await Promise.all([
    SavedProviderModel.deleteMany({ providerId }),
    ProviderReferenceModel.deleteMany({ providerId }),
    LeadDispatchModel.deleteMany({ providerId }),
    ProviderAnalyticsModel.deleteMany({ providerId }),
    ProviderResponseModel.deleteMany({ providerId }),
    ProviderSmsLogModel.deleteMany({ providerId }),
  ]);

  await provider.deleteOne();

  return {
    deleted: true,
    providerId,
  };
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
        categoryDocument: categoryByKey.get(provider.categoryKey) || null,
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
