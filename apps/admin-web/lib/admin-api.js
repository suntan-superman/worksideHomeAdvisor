const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.PUBLIC_API_URL ||
  'http://localhost:4000';

async function request(path) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: 'no-store',
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
