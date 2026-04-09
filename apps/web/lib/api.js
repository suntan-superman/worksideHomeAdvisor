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

export async function downloadFile(downloadUrl, fallbackFileName = 'download.bin') {
  const response = await fetch(downloadUrl, {
    cache: 'no-store',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      formatApiErrorMessage(data.message || data.error || 'Download failed.'),
    );
  }

  const disposition = response.headers.get('content-disposition') || '';
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^"]+)"?/i);
  const fileName = encodedMatch?.[1]
    ? decodeURIComponent(encodedMatch[1])
    : plainMatch?.[1] || fallbackFileName;

  return {
    blob: await response.blob(),
    fileName,
  };
}

export function signup(payload) {
  return request('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getPublicSellerPreview(payload) {
  return request('/api/v1/public/seller-preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function captureFunnelLead(payload) {
  return request('/api/v1/public/funnel-capture', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function continuePublicSignup(payload) {
  return request('/api/v1/public/continue-signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function trackLandingEvent(payload) {
  return request('/api/v1/public/events', {
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

export function requestForgotPasswordOtp(payload) {
  return request('/api/v1/auth/forgot-password/request', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function verifyForgotPasswordOtp(payload) {
  return request('/api/v1/auth/forgot-password/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function resetForgottenPassword(payload) {
  return request('/api/v1/auth/forgot-password/reset', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getCurrentUser(token) {
  return request('/api/v1/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function updateUserProfile(payload, token) {
  return request('/api/v1/auth/profile', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
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

export function setPropertyPricingDecision(propertyId, payload, ownerUserId) {
  return request(`/api/v1/properties/${propertyId}/pricing-decision`, {
    method: 'PATCH',
    headers: {
      'x-user-id': ownerUserId,
    },
    body: JSON.stringify(payload),
  });
}

export function archiveProperty(propertyId, ownerUserId) {
  return request(`/api/v1/properties/${propertyId}/archive`, {
    method: 'PATCH',
    headers: {
      'x-user-id': ownerUserId,
    },
  });
}

export function restoreProperty(propertyId, ownerUserId) {
  return request(`/api/v1/properties/${propertyId}/restore`, {
    method: 'PATCH',
    headers: {
      'x-user-id': ownerUserId,
    },
  });
}

export function deleteProperty(propertyId, ownerUserId) {
  return request(`/api/v1/properties/${propertyId}`, {
    method: 'DELETE',
    headers: {
      'x-user-id': ownerUserId,
    },
  });
}

export function getDashboard(propertyId) {
  return request(`/api/v1/properties/${propertyId}/dashboard`);
}

export function getChecklist(propertyId) {
  return request(`/api/v1/properties/${propertyId}/checklist`);
}

export function getWorkflow(propertyId, role = 'seller') {
  const search = role ? `?role=${encodeURIComponent(role)}` : '';
  return request(`/api/v1/properties/${propertyId}/workflow${search}`);
}

export function listProviders(propertyId, { categoryKey, taskKey, limit, includeExternal } = {}) {
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
  if (includeExternal) {
    search.set('includeExternal', 'true');
  }
  const query = search.toString();
  return request(`/api/v1/properties/${propertyId}/providers${query ? `?${query}` : ''}`);
}

export function getProviderMapImageUrl(propertyId, { categoryKey, taskKey, includeExternal, zoomOffset, limit } = {}) {
  const search = new URLSearchParams();
  if (categoryKey) {
    search.set('category', categoryKey);
  }
  if (taskKey) {
    search.set('taskKey', taskKey);
  }
  if (includeExternal) {
    search.set('includeExternal', 'true');
  }
  if (limit) {
    search.set('limit', String(limit));
  }
  if (Number.isFinite(zoomOffset) && zoomOffset !== 0) {
    search.set('zoomOffset', String(zoomOffset));
  }
  const query = search.toString();
  return `${API_BASE_URL}/api/v1/properties/${propertyId}/provider-map${query ? `?${query}` : ''}`;
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

export function listProviderCategories() {
  return request('/api/v1/provider-categories');
}

export function saveProvider(propertyId, providerId) {
  return request(`/api/v1/properties/${propertyId}/providers/${providerId}/save`, {
    method: 'POST',
  });
}

export function listProviderReferences(propertyId) {
  return request(`/api/v1/properties/${propertyId}/provider-references`);
}

export function createProviderReference(propertyId, payload) {
  return request(`/api/v1/properties/${propertyId}/provider-references`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteProviderReference(referenceId) {
  return request(`/api/v1/provider-references/${referenceId}`, {
    method: 'DELETE',
  });
}

export function getProviderReferenceSheetExportUrl(propertyId) {
  return `${API_BASE_URL}/api/v1/properties/${propertyId}/providers/reference-sheet.pdf`;
}

export function signupProvider(payload, token) {
  return request('/api/v1/provider-portal/signup', {
    method: 'POST',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
    body: JSON.stringify(payload),
  });
}

export function createProviderBillingCheckout(payload) {
  return request('/api/v1/provider-portal/billing/checkout', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function syncProviderBillingSession(sessionId) {
  return request('/api/v1/provider-portal/billing/sync-session', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export function createProviderPortalSession(payload, token) {
  return request('/api/v1/provider-portal/session', {
    method: 'POST',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
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

export function uploadProviderVerificationDocument(providerId, payload, token) {
  return request(`/api/v1/provider-portal/providers/${providerId}/verification-documents`, {
    method: 'POST',
    headers: {
      'x-provider-portal-token': token,
    },
    body: JSON.stringify(payload),
  });
}

export function submitProviderVerification(providerId, token) {
  return request(`/api/v1/provider-portal/providers/${providerId}/verification/submit`, {
    method: 'POST',
    headers: {
      'x-provider-portal-token': token,
    },
  });
}

export async function downloadProviderVerificationDocument(providerId, documentType, token) {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/provider-portal/providers/${providerId}/verification-documents/${documentType}/file`,
    {
      headers: {
        'x-provider-portal-token': token,
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(formatApiErrorMessage(data.message || data.error || 'Request failed.'));
  }

  const disposition = response.headers.get('content-disposition') || '';
  const fileNameMatch = disposition.match(/filename="([^"]+)"/i);

  return {
    blob: await response.blob(),
    fileName: fileNameMatch?.[1] || `${documentType}.bin`,
  };
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

export function savePhoto(propertyId, payload) {
  return request(`/api/v1/properties/${propertyId}/media`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
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

export function listImageEnhancementJobs(assetId, limit = 10) {
  const search = new URLSearchParams();
  if (limit) {
    search.set('limit', String(limit));
  }

  return request(
    `/api/v1/media/assets/${assetId}/vision/jobs${search.toString() ? `?${search.toString()}` : ''}`,
  );
}

export function getImageEnhancementJob(jobId) {
  return request(`/api/v1/vision/jobs/${jobId}`);
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

export function deleteMediaAsset(assetId) {
  return request(`/api/v1/media/assets/${assetId}`, {
    method: 'DELETE',
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

export function syncBillingSession(sessionId) {
  return request('/api/v1/billing/sync-session', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
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

export function getPropertySummaryReport(propertyId) {
  return request(`/api/v1/reports/property-summary/${propertyId}`);
}

export function getPropertySummaryReportExportUrl(propertyId) {
  return `${API_BASE_URL}/api/v1/reports/property-summary/${propertyId}/export.pdf`;
}

export function getMarketingReport(propertyId) {
  return request(`/api/v1/reports/marketing/${propertyId}`);
}

export function getMarketingReportExportUrl(propertyId) {
  return `${API_BASE_URL}/api/v1/reports/marketing/${propertyId}/export.pdf`;
}

export function generateSocialPack(propertyId) {
  return request(`/api/v1/properties/${propertyId}/marketing/social-pack`, {
    method: 'POST',
  });
}

export function getLatestSocialPack(propertyId) {
  return request(`/api/v1/properties/${propertyId}/marketing/social-pack/latest`);
}
