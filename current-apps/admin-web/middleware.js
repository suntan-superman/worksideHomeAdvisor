import { NextResponse } from 'next/server';

const ADMIN_SESSION_COOKIE = 'worksideAdminSession';

export function middleware(request) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icon')
  ) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (hasSession) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  if (pathname && pathname !== '/') {
    loginUrl.searchParams.set('next', `${pathname}${search || ''}`);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!.*\\..*).*)'],
};
