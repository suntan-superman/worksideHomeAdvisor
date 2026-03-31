import { NextResponse } from 'next/server';

import { getAdminApiBaseUrl } from '../../../../../../../lib/api-base-url';
import { getAdminSession } from '../../../../../../../lib/admin-session';

const API_BASE_URL = getAdminApiBaseUrl();

export async function GET(_request, { params }) {
  const session = await getAdminSession();

  if (!session.token) {
    return NextResponse.json({ message: 'Admin authentication is required.' }, { status: 401 });
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/provider-portal/providers/${params.providerId}/verification-documents/${params.documentType}/file`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return NextResponse.json(
        { message: body.message || `Request failed with ${response.status}` },
        { status: response.status },
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        'Content-Disposition':
          response.headers.get('content-disposition') || `inline; filename="${params.documentType}.bin"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error.message || 'Could not load provider verification document.' },
      { status: 500 },
    );
  }
}
