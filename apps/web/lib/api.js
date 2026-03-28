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

export function listMediaAssets(propertyId) {
  return request(`/api/v1/properties/${propertyId}/media`);
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

export function generateFlyer(propertyId, flyerType = 'sale') {
  return request(`/api/v1/properties/${propertyId}/flyer/generate`, {
    method: 'POST',
    body: JSON.stringify({ flyerType }),
  });
}

export function getLatestFlyer(propertyId) {
  return request(`/api/v1/properties/${propertyId}/flyer/latest`);
}

export function getFlyerExportUrl(propertyId, flyerType = 'sale') {
  const search = new URLSearchParams({ flyerType });
  return `${API_BASE_URL}/api/v1/properties/${propertyId}/flyer/export.pdf?${search.toString()}`;
}
