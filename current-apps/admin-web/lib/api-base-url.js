export function getAdminApiBaseUrl() {
  return (
    process.env.ADMIN_API_URL ||
    process.env.NEXT_PUBLIC_ADMIN_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.PUBLIC_API_URL ||
    'http://localhost:4000'
  );
}
