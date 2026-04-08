const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  'https://workside-api-166927680198.us-central1.run.app';

function formatApiErrorMessage(message, status) {
  const raw = typeof message === 'string' ? message.trim() : '';

  if (!raw) {
    return status >= 500
      ? 'The Workside service is temporarily unavailable. Please try again in a moment.'
      : 'Something went wrong. Please try again.';
  }

  if (status === 404) {
    return "We couldn't find an account for that email. Please check the address and try again.";
  }

  if (/route\s+(get|post|patch|put|delete)/i.test(raw) || /cannot\s+(get|post|patch|put|delete)/i.test(raw)) {
    return 'This feature is temporarily unavailable. Please try again in a moment.';
  }

  return raw;
}

async function request(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error('Unable to reach the Workside service right now. Please try again in a moment.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      formatApiErrorMessage(data.message || data.error || 'Request failed.', response.status),
    );
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

export function deleteAccount(token) {
  return request('/api/v1/auth/account', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
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

export function getWorkflow(propertyId, role = 'seller') {
  const search = role ? `?role=${encodeURIComponent(role)}` : '';
  return request(`/api/v1/properties/${propertyId}/workflow${search}`);
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

export function deleteMediaAsset(assetId) {
  return request(`/api/v1/media/assets/${assetId}`, {
    method: 'DELETE',
  });
}

export { API_URL };
