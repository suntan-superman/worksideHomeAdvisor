import { cookies } from 'next/headers';

export const ADMIN_SESSION_COOKIE = 'worksideAdminSession';

export async function getAdminSession() {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value || '';

  return {
    token,
    isAuthenticated: Boolean(token),
  };
}
