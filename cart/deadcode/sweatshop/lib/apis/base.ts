import { isRateLimited, recordRequest, rateLimitRemaining } from './rateLimit';

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface FetchOptions {
  method?: HTTPMethod;
  headers?: Record<string, string>;
  body?: string;
  query?: Record<string, string | number | boolean | undefined>;
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  skipRateLimit?: boolean;
}

export interface FetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  status: number | null;
  rateLimited: boolean;
}

export interface MutationResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  mutate: (body?: string, opts?: Partial<FetchOptions>) => Promise<T | null>;
  status: number | null;
}

async function fetchWithTimeout(url: string, opts: { method?: string; headers?: Record<string, string>; body?: string }, timeout: number): Promise<any> {
  const p = fetch(url, opts);
  if (timeout <= 0) return p;
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeout)),
  ]);
}

export async function rateLimitedFetch(url: string, options: FetchOptions = {}): Promise<any> {
  if (!options.skipRateLimit && isRateLimited(url)) {
    throw new Error(`Rate limited for ${url} (${rateLimitRemaining(url)} remaining in window)`);
  }
  const retries = options.retries ?? 2;
  const retryDelay = options.retryDelay ?? 1000;
  const timeout = options.timeout ?? 30000;

  let fullUrl = url;
  if (options.query) {
    const params = Object.entries(options.query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (params) fullUrl += (url.includes('?') ? '&' : '?') + params;
  }

  const fetchOpts: any = { method: options.method || 'GET' };
  if (options.headers) fetchOpts.headers = options.headers;
  if (options.body != null) fetchOpts.body = options.body;

  let lastErr: Error | null = null;
  for (let i = 0; i <= retries; i++) {
    try {
      if (!options.skipRateLimit) recordRequest(url);
      const res = await fetchWithTimeout(fullUrl, fetchOpts, timeout);
      if (res.status === 429) throw new Error('429 Too Many Requests');
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) return res.json();
      return res.text();
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (i < retries) await new Promise(r => setTimeout(r, retryDelay * (i + 1)));
    }
  }
  throw lastErr || new Error('unknown fetch error');
}

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function qs(params: Record<string, string | number | boolean | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

export function useAPI<T = any>(url: string | null, options: FetchOptions = {}): FetchResult<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [status, setStatus] = React.useState<number | null>(null);
  const [rateLimited, setRateLimited] = React.useState(false);
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    if (!url) { setData(null); setLoading(false); setError(null); setRateLimited(false); return; }
    setLoading(true); setError(null); setRateLimited(false);
    let cancelled = false;
    rateLimitedFetch(url, options)
      .then((res: any) => {
        if (cancelled) return;
        setData(res); setStatus(200);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e);
        if (e.message && e.message.includes('Rate limited')) setRateLimited(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url, nonce, JSON.stringify(options.headers), options.body]);

  const refetch = React.useCallback(() => setNonce(n => n + 1), []);
  return { data, loading, error, refetch, status, rateLimited };
}

export function useAPIMutation<T = any>(url: string, options: FetchOptions = {}): MutationResult<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [status, setStatus] = React.useState<number | null>(null);

  const mutate = React.useCallback(async (body?: string, extra?: Partial<FetchOptions>): Promise<T | null> => {
    setLoading(true); setError(null); setStatus(null);
    try {
      const merged: FetchOptions = { ...options, body: body ?? options.body, ...extra };
      const res = await rateLimitedFetch(url, merged);
      setData(res); setStatus(200); return res;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err); throw err;
    } finally { setLoading(false); }
  }, [url]);

  return { data, loading, error, mutate, status };
}
