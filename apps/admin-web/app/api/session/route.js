import { NextResponse } from 'next/server';

import { ADMIN_SESSION_COOKIE } from '../../../lib/admin-session';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const token = String(payload.token || '').trim();

  if (!token) {
    return NextResponse.json({ message: 'Session token is required.' }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, COOKIE_OPTIONS);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
  return response;
}
