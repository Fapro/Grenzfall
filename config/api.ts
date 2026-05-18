import { getSession } from '@/config/session';

const EXPLICIT_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();

if (!EXPLICIT_BACKEND_URL) {
  throw new Error('EXPO_PUBLIC_BACKEND_URL is required');
}

export const BACKEND_URL = EXPLICIT_BACKEND_URL;

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const session = getSession();

  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  if (session?.currentTenant?.slug) {
    headers['X-Tenant-Slug'] = session.currentTenant.slug;
  }

  return headers;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${BACKEND_URL}${normalizedPath}`;

  const authHeaders = buildAuthHeaders();
  const mergedHeaders: Record<string, string> = {
    ...authHeaders,
    ...(init.headers as Record<string, string> | undefined),
  };

  return fetch(url, {
    ...init,
    headers: mergedHeaders,
  });
}
