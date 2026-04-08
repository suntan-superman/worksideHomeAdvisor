import { NextResponse } from 'next/server';

import { getAdminApiBaseUrl } from '../../../../lib/api-base-url';

const API_BASE_URL = getAdminApiBaseUrl();

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || `Login failed with ${response.status}` },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error.message ||
          'Could not reach the backend API. Check ADMIN_API_URL or NEXT_PUBLIC_ADMIN_API_URL.',
      },
      { status: 500 },
    );
  }
}
