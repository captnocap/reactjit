const MAX_PER_DOMAIN = 30;
const WINDOW_MS = 1000;

interface DomainWindow { timestamps: number[] }
const windows: Record<string, DomainWindow> = {};

function getDomain(url: string): string {
  try {
    const m = url.match(/^https?:\/\/([^\/]+)/);
    return m ? m[1] : url;
  } catch { return url; }
}

export function isRateLimited(url: string): boolean {
  const d = getDomain(url);
  const now = Date.now();
  const w = windows[d] || { timestamps: [] };
  w.timestamps = w.timestamps.filter(t => now - t < WINDOW_MS);
  return w.timestamps.length >= MAX_PER_DOMAIN;
}

export function recordRequest(url: string): void {
  const d = getDomain(url);
  const now = Date.now();
  if (!windows[d]) windows[d] = { timestamps: [] };
  windows[d].timestamps.push(now);
}

export function rateLimitRemaining(url: string): number {
  const d = getDomain(url);
  const now = Date.now();
  const w = windows[d];
  if (!w) return MAX_PER_DOMAIN;
  const count = w.timestamps.filter(t => now - t < WINDOW_MS).length;
  return Math.max(0, MAX_PER_DOMAIN - count);
}

export function resetRateLimit(url: string): void {
  delete windows[getDomain(url)];
}
