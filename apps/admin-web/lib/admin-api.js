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

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    return {
      error: error.message,
    };
  }
}

async function post(path) {
  try {
    const session = await getAdminSession();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      cache: 'no-store',
      headers: session.token
        ? {
            Authorization: `Bearer ${session.token}`,
          }
        : {},
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    return await response.json();
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

export function getAdminUsage() {
  return request('/api/v1/admin/usage');
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
