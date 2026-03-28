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

export { API_URL };
