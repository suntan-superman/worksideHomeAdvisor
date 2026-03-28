const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
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

export function getDashboard(propertyId) {
  return request(`/api/v1/properties/${propertyId}/dashboard`);
}

export function analyzePricing(propertyId) {
  return request(`/api/v1/properties/${propertyId}/pricing/analyze`, {
    method: 'POST',
  });
}

export function analyzePhoto(propertyId, payload) {
  return request(`/api/v1/properties/${propertyId}/media/analyze-photo`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function savePhoto(propertyId, payload) {
  return request(`/api/v1/properties/${propertyId}/media`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listMediaAssets(propertyId) {
  return request(`/api/v1/properties/${propertyId}/media`);
}
