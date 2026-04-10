const KEY = 'anthropic_key';

export function getApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY);
}

export function setApiKey(key: string): void {
  localStorage.setItem(KEY, key);
}

export function clearApiKey(): void {
  localStorage.removeItem(KEY);
}

/** Drop-in fetch wrapper that injects x-anthropic-key if one is stored. */
export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const key = getApiKey();
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(key ? { 'x-anthropic-key': key } : {}),
    },
  });
}
