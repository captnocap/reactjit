import { requestAsync } from '@reactjit/runtime/hooks/http';

export type BrowserFetchState = {
  ok: boolean;
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  error: string | null;
};

export type BrowserPageState = BrowserFetchState & {
  loading: boolean;
};

export function normalizeBrowserUrl(input: string): string {
  const next = String(input || '').trim();
  if (!next) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(next)) return next;
  return `https://${next}`;
}

export function httpGet(url: string): Promise<BrowserFetchState> {
  const target = normalizeBrowserUrl(url);
  if (!target) {
    return Promise.resolve({
      ok: false,
      url: '',
      finalUrl: '',
      status: 0,
      contentType: '',
      body: '',
      error: 'Enter a URL to fetch.',
    });
  }
  return requestAsync({ method: 'GET', url: target, timeoutMs: 20000 })
    .then((res) => ({
      ok: res.status >= 200 && res.status < 300,
      url: target,
      finalUrl: target,
      status: res.status,
      contentType: String(res.headers?.['content-type'] || ''),
      body: String(res.body || ''),
      error: res.error ? String(res.error) : null,
    }))
    .catch((error: any) => ({
      ok: false,
      url: target,
      finalUrl: target,
      status: 0,
      contentType: '',
      body: '',
      error: error?.message || String(error),
    }));
}

export function isHttpFetchAvailable(): boolean {
  const host: any = globalThis as any;
  return typeof host.__http_request_async === 'function' || typeof host.__http_request_sync === 'function';
}

export function titleFromResponse(url: string, body: string): string {
  const titleMatch = String(body || '').match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) return titleMatch[1].trim().slice(0, 60);
  try {
    const parsed = new URL(normalizeBrowserUrl(url));
    return parsed.hostname || 'Browser';
  } catch {
    return normalizeBrowserUrl(url).slice(0, 60) || 'Browser';
  }
}
