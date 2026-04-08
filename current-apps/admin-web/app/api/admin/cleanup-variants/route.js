import { NextResponse } from 'next/server';

import { getAdminApiBaseUrl } from '../../../../lib/api-base-url';
import { getAdminSession } from '../../../../lib/admin-session';

const API_BASE_URL = getAdminApiBaseUrl();

export async function POST() {
  const session = await getAdminSession();

  if (!session.token) {
    return NextResponse.json({ message: 'Admin authentication is required.' }, { status: 401 });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/media/cleanup-variants`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { message: payload.message || `Request failed with ${response.status}` },
        { status: response.status },
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ message: error.message || 'Cleanup request failed.' }, { status: 500 });
  }
}
