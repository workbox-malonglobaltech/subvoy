import { supabase } from './supabase';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

/** Key under which the active workspace id is persisted (set by WorkspaceContext). */
export const ACTIVE_WORKSPACE_KEY = 'subvoy.activeWorkspaceId';

/** Abort a request that takes longer than this (prevents hung UI). */
const TIMEOUT_MS = 20_000;

/** Error carrying the HTTP status so callers can branch (e.g. on 402/404). */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Global 401 handler — registered by AuthProvider so a mid-session expiry sends
// the user to login instead of spraying confusing errors.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

function activeWorkspaceId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

/**
 * Auth + workspace headers for raw fetches that bypass apiFetch (e.g. multipart
 * file uploads, where we must let the browser set the multipart boundary).
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const wsId = activeWorkspaceId();
  return {
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...(wsId ? { 'X-Workspace-Id': wsId } : {}),
  };
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const wsId = activeWorkspaceId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Attach the Supabase access token (cached read, no network) so the API can
  // authenticate the request.
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(wsId ? { 'X-Workspace-Id': wsId } : {}),
        ...options.headers,
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, 'Request timed out. Please check your connection and try again.');
    }
    throw new ApiError(0, 'Network error. Please check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }

  // Session expired mid-flight (ignore the initial /auth/me probe for guests).
  if (res.status === 401 && path !== '/auth/me') onUnauthorized?.();

  // Tolerate non-JSON responses (proxy 502/504 HTML, empty bodies) without crashing.
  let json: ApiResponse<T>;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(
      res.status,
      res.status >= 500
        ? 'The server had a problem. Please try again shortly.'
        : 'Unexpected response from the server.'
    );
  }

  if (!json.success) {
    throw new ApiError(res.status, json.error ?? 'An unexpected error occurred');
  }
  return json.data;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
