export const API_URL = process.env.NEXT_PUBLIC_API_URL
  ?? (process.env.NODE_ENV === 'production' ? '/api/v1' : 'http://localhost:4000/api/v1');

export type Principal = { sub: string; username: string; displayName: string; organizationId: string; roleCodes: string[]; permissions: string[]; dataScopes: string[]; mustChangePassword: boolean; phone?: string; email?: string };

export function withQuery(path: string, params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== '' && value !== null && value !== undefined) search.set(key, String(value));
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = typeof window === 'undefined' ? null : sessionStorage.getItem('ffai_access_token');
  const response = await fetch(`${API_URL}${path}`, {
    ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  if (response.status === 401 && path !== '/auth/refresh') {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (refreshed.ok) {
      const result = await refreshed.json() as { accessToken: string };
      sessionStorage.setItem('ffai_access_token', result.accessToken);
      return api<T>(path, init);
    }
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string | string[] };
    throw new Error(Array.isArray(body.message) ? body.message.join('；') : body.message ?? `请求失败 (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function downloadApi(path: string): Promise<{ blob: Blob; fileName: string }> {
  const token = typeof window === 'undefined' ? null : sessionStorage.getItem('ffai_access_token');
  const response = await fetch(`${API_URL}${path}`, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (response.status === 401) {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (refreshed.ok) {
      const result = await refreshed.json() as { accessToken: string };
      sessionStorage.setItem('ffai_access_token', result.accessToken);
      return downloadApi(path);
    }
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string | string[] };
    throw new Error(Array.isArray(body.message) ? body.message.join('；') : body.message ?? `下载失败 (${response.status})`);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  return { blob: await response.blob(), fileName: encoded ? decodeURIComponent(encoded) : '商业单据' };
}
