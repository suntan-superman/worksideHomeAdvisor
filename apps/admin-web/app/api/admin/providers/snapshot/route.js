import { NextResponse } from 'next/server';

import { getAdminApiBaseUrl } from '../../../../../lib/api-base-url';
import { getAdminSession } from '../../../../../lib/admin-session';

const API_BASE_URL = getAdminApiBaseUrl();

async function requestAdmin(path, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || `Request failed with ${response.status}`);
  }

  return body;
}

export async function GET() {
  const session = await getAdminSession();

  if (!session.token) {
    return NextResponse.json({ message: 'Admin authentication is required.' }, { status: 401 });
  }

  try {
    const [providerPayload, leadPayload] = await Promise.all([
      requestAdmin('/api/v1/admin/providers', session.token),
      requestAdmin('/api/v1/admin/provider-leads', session.token),
    ]);

    return NextResponse.json({
      providers: providerPayload.providers || [],
      leadSummary: providerPayload.leadSummary || {},
      leadOpsSummary: leadPayload.summary || {},
      leads: leadPayload.items || [],
      providerError: '',
      leadError: '',
    });
  } catch (error) {
    return NextResponse.json(
      {
        providers: [],
        leadSummary: {},
        leadOpsSummary: {},
        leads: [],
        providerError: error.message || 'Could not load provider snapshot.',
        leadError: '',
      },
      { status: 500 },
    );
  }
}
