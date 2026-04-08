import { NextResponse } from 'next/server';

import { getAdminApiBaseUrl } from '../../../../lib/api-base-url';
import { getAdminSession } from '../../../../lib/admin-session';

const API_BASE_URL = getAdminApiBaseUrl();

export async function GET() {
  const session = await getAdminSession();

  if (!session.token) {
    return NextResponse.json({ message: 'Admin authentication is required.' }, { status: 401 });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/provider-categories`, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });

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
      { message: error.message || 'Provider categories could not be loaded.' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const session = await getAdminSession();

  if (!session.token) {
    return NextResponse.json({ message: 'Admin authentication is required.' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const response = await fetch(`${API_BASE_URL}/api/v1/admin/provider-categories`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

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
      { message: error.message || 'Provider category creation failed.' },
      { status: 500 },
    );
  }
}
