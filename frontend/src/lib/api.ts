const BASE_URL = import.meta.env.VITE_API_URL ?? '';

/** Key under which the active workspace id is persisted (set by WorkspaceContext). */
export const ACTIVE_WORKSPACE_KEY = 'subvoy.activeWorkspaceId';

function activeWorkspaceId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
  } catch {
    return null;
  }
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const wsId = activeWorkspaceId();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      // Tells the backend which workspace to scope this request to. When absent,
      // the backend defaults to the user's Personal workspace.
      ...(wsId ? { 'X-Workspace-Id': wsId } : {}),
      ...options.headers,
    },
  });

  const json: ApiResponse<T> = await res.json();

  if (!json.success) {
    throw new Error(json.error ?? 'An unexpected error occurred');
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
