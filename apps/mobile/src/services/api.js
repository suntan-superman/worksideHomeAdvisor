const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  'https://workside-api-166927680198.us-central1.run.app';

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

export function getChecklist(propertyId) {
  return request(`/api/v1/properties/${propertyId}/checklist`);
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
  return request(`/api/v1/media/assets/${assetId}/variants`);
}

export function createImageEnhancementJob(assetId, payload) {
  return request(`/api/v1/media/assets/${assetId}/enhance`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function selectMediaVariant(assetId, variantId) {
  return request(`/api/v1/media/assets/${assetId}/variants/${variantId}/select`, {
    method: 'PATCH',
  });
}

export function savePhoto(propertyId, payload) {
  return request(`/api/v1/properties/${propertyId}/media`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateMediaAsset(assetId, payload) {
  return request(`/api/v1/media/assets/${assetId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export { API_URL };
