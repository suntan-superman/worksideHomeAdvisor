import { NextResponse } from 'next/server';

import { getAdminApiBaseUrl } from '../../../../../../lib/api-base-url';
import { getAdminSession } from '../../../../../../lib/admin-session';

const API_BASE_URL = getAdminApiBaseUrl();

export async function POST(_request, { params }) {
  const session = await getAdminSession();

  if (!session.token) {
    return NextResponse.json({ message: 'Admin authentication is required.' }, { status: 401 });
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/admin/provider-leads/${params.leadRequestId}/resend`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        cache: 'no-store',
      },
    );

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { message: body.message || `Request failed with ${response.status}` },
        { status: response.status },
      );
    }

    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json(
      { message: error.message || 'Lead resend failed.' },
      { status: 500 },
    );
  }
}
