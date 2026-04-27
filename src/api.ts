const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '';

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, '');
export const HAS_EXPLICIT_API_BASE_URL = API_BASE_URL.length > 0;

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function normalizePath(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return path.startsWith('/') ? path : `/${path}`;
}

export function apiUrl(path: string) {
  const normalizedPath = normalizePath(path);
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

export async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return null;
  }

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init);
  const data = await parseJsonSafely<T & { error?: string; message?: string }>(response);

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && ('error' in data || 'message' in data)
        ? ((data as { error?: string; message?: string }).error ||
            (data as { error?: string; message?: string }).message)
        : null) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return (data ?? ({} as T)) as T;
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong.') {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
