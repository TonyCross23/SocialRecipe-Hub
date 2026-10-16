import { useAuthStore } from '../store/auth-store';
import type { AuthResponse } from './types';

const API = '/api/v1';
let refreshing: Promise<boolean> | null = null;

async function rotateToken() {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return false;
  const response = await fetch(`${API}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
  if (!response.ok) { useAuthStore.getState().clear(); return false; }
  const tokens = await response.json() as Pick<AuthResponse, 'accessToken' | 'refreshToken'>;
  useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
  return true;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  if (response.status === 401 && retry && useAuthStore.getState().refreshToken) {
    refreshing ??= rotateToken().finally(() => { refreshing = null; });
    if (await refreshing) return api<T>(path, init, false);
  }
  const body = response.status === 204 ? undefined : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message ?? `Request failed (${response.status})`);
  return body as T;
}

export const apiUrl = API;
