import { formatApiErrorMessage } from './errors';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function getApiBaseUrl() {
  return API_BASE_URL;
}

async function request(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      formatApiErrorMessage(data.message || data.error || 'Request failed.'),
    );
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

export function signup(payload) {
  return request('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function login(payload) {
  return request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function verifyEmailOtp(payload) {
  return request('/api/v1/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function requestOtp(payload) {
  return request('/api/v1/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listProperties(ownerUserId) {
  const search = ownerUserId ? `?ownerUserId=${encodeURIComponent(ownerUserId)}` : '';
  return request(`/api/v1/properties${search}`);
}

export function createProperty(payload, ownerUserId) {
  return request('/api/v1/properties', {
    method: 'POST',
    headers: {
      'x-user-id': ownerUserId,
    },
    body: JSON.stringify(payload),
  });
}

export function getProperty(propertyId) {
  return request(`/api/v1/properties/${propertyId}`);
}

export function getDashboard(propertyId) {
  return request(`/api/v1/properties/${propertyId}/dashboard`);
}

export function getChecklist(propertyId) {
  return request(`/api/v1/properties/${propertyId}/checklist`);
}

export function listProviders(propertyId, { categoryKey, taskKey, limit } = {}) {
  const search = new URLSearchParams();
  if (categoryKey) {
    search.set('category', categoryKey);
  }
  if (taskKey) {
    search.set('taskKey', taskKey);
  }
  if (limit) {
    search.set('limit', String(limit));
  }
  const query = search.toString();
  return request(`/api/v1/properties/${propertyId}/providers${query ? `?${query}` : ''}`);
}

export function createProviderLead(propertyId, payload) {
  return request(`/api/v1/properties/${propertyId}/provider-leads`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listProviderLeads(propertyId) {
  return request(`/api/v1/properties/${propertyId}/provider-leads`);
}

export function saveProvider(propertyId, providerId) {
  return request(`/api/v1/properties/${propertyId}/providers/${providerId}/save`, {
    method: 'POST',
  });
}

export function signupProvider(payload) {
  return request('/api/v1/provider-portal/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createProviderBillingCheckout(payload) {
  return request('/api/v1/provider-portal/billing/checkout', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createProviderPortalSession(payload) {
  return request('/api/v1/provider-portal/session', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateProviderPortalProfile(providerId, payload, token) {
  return request(`/api/v1/provider-portal/providers/${providerId}/profile`, {
    method: 'PATCH',
    headers: {
      'x-provider-portal-token': token,
    },
    body: JSON.stringify(payload),
  });
}

export function respondToProviderPortalLead(providerId, dispatchId, payload, token) {
  return request(`/api/v1/provider-portal/dispatches/${providerId}/${dispatchId}/respond`, {
    method: 'PATCH',
    headers: {
      'x-provider-portal-token': token,
    },
    body: JSON.stringify(payload),
  });
}

export function createChecklistItem(propertyId, payload) {
  return request(`/api/v1/properties/${propertyId}/checklist/items`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateChecklistItem(itemId, payload) {
  return request(`/api/v1/checklist-items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function listMediaAssets(propertyId) {
  return request(`/api/v1/properties/${propertyId}/media`);
}

export function listMediaVariants(assetId) {
  return request(`/api/v1/media/assets/${assetId}/vision/variants`);
}

export function createImageEnhancementJob(assetId, payload) {
  return request(`/api/v1/media/assets/${assetId}/vision/enhance`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listVisionPresets() {
  return request('/api/v1/vision/presets');
}

export function selectMediaVariant(assetId, variantId) {
  return request(`/api/v1/media/assets/${assetId}/variants/${variantId}/select`, {
    method: 'PATCH',
  });
}

export function setMediaVariantUsage(assetId, variantId, field, value) {
  const endpoint =
    field === 'brochure'
      ? 'use-in-brochure'
      : 'use-in-report';

  return request(`/api/v1/media/assets/${assetId}/variants/${variantId}/${endpoint}`, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  });
}

export function updateMediaAsset(assetId, payload) {
  return request(`/api/v1/media/assets/${assetId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function analyzePricing(propertyId) {
  return request(`/api/v1/properties/${propertyId}/pricing/analyze`, {
    method: 'POST',
  });
}

export function getLatestPricing(propertyId) {
  return request(`/api/v1/properties/${propertyId}/pricing/latest`);
}

export function getBillingPlans() {
  return request('/api/v1/billing/plans');
}

export function getBillingSummary(userId) {
  return request(`/api/v1/billing/summary/${userId}`);
}

export function createBillingCheckoutSession(payload, userId) {
  return request('/api/v1/billing/checkout-session', {
    method: 'POST',
    headers: {
      'x-user-id': userId,
    },
    body: JSON.stringify(payload),
  });
}

export function generateFlyer(propertyId, flyerType = 'sale', customizations = {}) {
  return request(`/api/v1/properties/${propertyId}/flyer/generate`, {
    method: 'POST',
    body: JSON.stringify({ flyerType, customizations }),
  });
}

export function getLatestFlyer(propertyId) {
  return request(`/api/v1/properties/${propertyId}/flyer/latest`);
}

export function getFlyerExportUrl(propertyId, flyerType = 'sale') {
  const search = new URLSearchParams({ flyerType });
  return `${API_BASE_URL}/api/v1/properties/${propertyId}/flyer/export.pdf?${search.toString()}`;
}

export function generateReport(propertyId, customizations = {}) {
  return request(`/api/v1/properties/${propertyId}/report/generate`, {
    method: 'POST',
    body: JSON.stringify({ customizations }),
  });
}

export function getLatestReport(propertyId) {
  return request(`/api/v1/properties/${propertyId}/report/latest`);
}

export function getReportExportUrl(propertyId) {
  return `${API_BASE_URL}/api/v1/properties/${propertyId}/report/export.pdf`;
}
