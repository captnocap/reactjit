/**
 * Sliding-window rate limiter for API requests.
 *
 * Keyed by domain — all hooks hitting the same host share one budget.
 * Requests that exceed the limit queue and drain at the allowed rate.
 */

// ── Types ────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window. */
  maxCalls: number;
  /** Window size in seconds. */
  perSeconds: number;
}

// ── State ────────────────────────────────────────────────

/** Timestamps of recent requests, keyed by domain. */
const windows: Map<string, number[]> = new Map();

/** Queued requests waiting for a slot, keyed by domain. */
const queues: Map<string, Array<() => void>> = new Map();

// ── Internals ────────────────────────────────────────────

function getDomain(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function prune(timestamps: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs;
  // Timestamps are in chronological order — find first valid index
  let i = 0;
  while (i < timestamps.length && timestamps[i] < cutoff) i++;
  return i > 0 ? timestamps.slice(i) : timestamps;
}

function drainQueue(domain: string, config: RateLimitConfig): void {
  const queue = queues.get(domain);
  if (!queue || queue.length === 0) return;

  const windowMs = config.perSeconds * 1000;
  let timestamps = windows.get(domain) || [];
  timestamps = prune(timestamps, windowMs);
  windows.set(domain, timestamps);

  if (timestamps.length < config.maxCalls) {
    const resolve = queue.shift()!;
    if (queue.length === 0) queues.delete(domain);
    timestamps.push(Date.now());
    resolve();
  }

  // Schedule next drain if there are still queued requests
  if (queue && queue.length > 0) {
    const oldest = timestamps[0];
    const delay = oldest + windowMs - Date.now() + 1;
    setTimeout(() => drainQueue(domain, config), Math.max(delay, 10));
  }
}

// ── Public API ───────────────────────────────────────────

/**
 * Rate-limited wrapper around fetch().
 *
 * If the sliding window for this URL's domain has capacity, fires immediately.
 * Otherwise queues the request and resolves when a slot opens.
 */
export function rateLimitedFetch(
  url: string,
  init: RequestInit | undefined,
  config: RateLimitConfig,
): Promise<Response> {
  const domain = getDomain(url);
  const windowMs = config.perSeconds * 1000;

  let timestamps = windows.get(domain) || [];
  timestamps = prune(timestamps, windowMs);
  windows.set(domain, timestamps);

  if (timestamps.length < config.maxCalls) {
    // Under budget — fire immediately
    timestamps.push(Date.now());
    return fetch(url, init);
  }

  // Over budget — queue and wait for a slot
  return new Promise<void>((resolve) => {
    let queue = queues.get(domain);
    if (!queue) {
      queue = [];
      queues.set(domain, queue);
    }
    queue.push(resolve);

    // Schedule drain when the oldest request expires from the window
    const oldest = timestamps[0];
    const delay = oldest + windowMs - Date.now() + 1;
    setTimeout(() => drainQueue(domain, config), Math.max(delay, 10));
  }).then(() => fetch(url, init));
}
