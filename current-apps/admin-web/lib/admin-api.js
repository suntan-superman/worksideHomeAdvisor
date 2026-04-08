import { getAdminSession } from './admin-session';
import { getAdminApiBaseUrl } from './api-base-url';

const API_BASE_URL = getAdminApiBaseUrl();

async function request(path) {
  try {
    const session = await getAdminSession();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: 'no-store',
      headers: session.token
        ? {
            Authorization: `Bearer ${session.token}`,
          }
        : {},
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || `Request failed with ${response.status}`);
    }

    return payload;
  } catch (error) {
    return {
      error: error.message,
    };
  }
}

async function post(path, body) {
  try {
    const session = await getAdminSession();
    const headers = {
      ...(session.token
        ? {
            Authorization: `Bearer ${session.token}`,
          }
        : {}),
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      cache: 'no-store',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || `Request failed with ${response.status}`);
    }

    return payload;
  } catch (error) {
    return {
      error: error.message,
    };
  }
}

export function getAdminOverview() {
  return request('/api/v1/admin/overview');
}

export function getAdminUsers() {
  return request('/api/v1/admin/users');
}

export function getAdminProperties() {
  return request('/api/v1/admin/properties');
}

export function getAdminBilling() {
  return request('/api/v1/admin/billing');
}

export function getAdminFunnel() {
  return request('/api/v1/admin/funnel');
}

export function getAdminUsage() {
  return request('/api/v1/admin/usage');
}

export function getAdminProviders() {
  return request('/api/v1/admin/providers');
}

export function getAdminProviderCategories() {
  return request('/api/v1/admin/provider-categories');
}

export function getAdminProviderLeads() {
  return request('/api/v1/admin/provider-leads');
}

export function createAdminProvider(payload) {
  return post('/api/v1/admin/providers', payload);
}

export function getAdminWorkers() {
  return request('/api/v1/admin/workers');
}

export function getAdminMediaVariants() {
  return request('/api/v1/admin/media/variants');
}

export function runAdminVariantCleanup() {
  return post('/api/v1/admin/media/cleanup-variants');
}
