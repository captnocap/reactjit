/**
 * @reactjit/time — Pure utility functions.
 *
 * No hooks, no bridge, no React. All functions operate on numbers (ms since
 * Unix epoch) or Date objects. Safe to call anywhere.
 */

import type { FormatDurationOptions, FormatDateOptions } from './types';

// ── Intl timezone feature detection ───────────────────────────────────────────
//
// QuickJS (and some embedded runtimes) silently ignore the timeZone option in
// Intl.DateTimeFormat. Detect this at module load by comparing UTC vs Tokyo
// (always +9, no DST). If they produce the same formatted hour, Intl TZ is
// broken and we fall back to manual offset math.

const INTL_TZ_WORKS = (() => {
  try {
    const d = new Date(Date.UTC(2000, 0, 1, 12, 0, 0)); // noon UTC
    const utc   = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', hour: 'numeric', hour12: false }).format(d);
    const tokyo = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', hour12: false }).format(d);
    return utc !== tokyo; // UTC=12, Tokyo=21 — must differ
  } catch {
    return false;
  }
})();

// Standard UTC offsets in minutes for common IANA zones.
// Does NOT account for DST — but it's far better than showing local time for
// every timezone. Covers the zones most likely to appear in Clock widgets.
const FALLBACK_TZ_OFFSETS: Record<string, number> = {
  'UTC': 0, 'GMT': 0, 'Etc/UTC': 0, 'Etc/GMT': 0,
  'Pacific/Honolulu': -600,
  'America/Anchorage': -540,
  'America/Los_Angeles': -480, 'US/Pacific': -480,
  'America/Denver': -420, 'US/Mountain': -420,
  'America/Chicago': -360, 'US/Central': -360,
  'America/New_York': -300, 'US/Eastern': -300,
  'America/Halifax': -240,
  'America/Sao_Paulo': -180,
  'Atlantic/South_Georgia': -120,
  'Atlantic/Azores': -60,
  'Europe/London': 0, 'Europe/Dublin': 0,
  'Europe/Paris': 60, 'Europe/Berlin': 60, 'Europe/Rome': 60,
  'Europe/Madrid': 60, 'Europe/Amsterdam': 60, 'Europe/Brussels': 60,
  'Europe/Zurich': 60, 'Europe/Vienna': 60, 'Europe/Warsaw': 60,
  'Europe/Stockholm': 60, 'Europe/Oslo': 60, 'Europe/Copenhagen': 60,
  'Europe/Helsinki': 120, 'Europe/Athens': 120, 'Europe/Bucharest': 120,
  'Europe/Istanbul': 180, 'Europe/Moscow': 180, 'Europe/Minsk': 180,
  'Asia/Dubai': 240,
  'Asia/Karachi': 300,
  'Asia/Kolkata': 330, 'Asia/Calcutta': 330,
  'Asia/Kathmandu': 345,
  'Asia/Dhaka': 360,
  'Asia/Bangkok': 420, 'Asia/Jakarta': 420, 'Asia/Ho_Chi_Minh': 420,
  'Asia/Singapore': 480, 'Asia/Shanghai': 480, 'Asia/Hong_Kong': 480,
  'Asia/Taipei': 480, 'Asia/Kuala_Lumpur': 480,
  'Asia/Tokyo': 540, 'Asia/Seoul': 540,
  'Australia/Brisbane': 600,
  'Australia/Sydney': 660, 'Australia/Melbourne': 660,
  'Pacific/Auckland': 720, 'Pacific/Fiji': 720,
  'Pacific/Tongatapu': 780,
  'Pacific/Kiritimati': 840,
};

/** Get the UTC offset in minutes for a timezone, using the fallback table. */
function fallbackTzOffset(timezone: string): number | null {
  return FALLBACK_TZ_OFFSETS[timezone] ?? null;
}

/**
 * Format a timestamp in a specific timezone using manual UTC offset math.
 * Used when Intl timezone support is broken.
 */
function formatWithManualTz(
  timestamp: number,
  timezone: string,
  intlOpts: Intl.DateTimeFormatOptions,
  locale?: string,
): string {
  const offsetMin = fallbackTzOffset(timezone);
  if (offsetMin === null) {
    // Unknown timezone — best effort, just format local
    return new Date(timestamp).toLocaleString();
  }

  // Shift the timestamp by the offset, then format as UTC so the shifted
  // hours/minutes read correctly as the target zone's wall clock.
  const shifted = timestamp + offsetMin * 60_000;
  const d = new Date(shifted);

  // Try Intl with timeZone:'UTC' to format the shifted time
  try {
    const opts: Intl.DateTimeFormatOptions = { ...intlOpts, timeZone: 'UTC' };
    return new Intl.DateTimeFormat(locale, opts).format(d);
  } catch {
    // Absolute last resort: manual HH:MM:SS from UTC methods
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
}

// ── Unix timestamps ────────────────────────────────────────────────────────────

/** Current Unix timestamp in milliseconds. */
export function nowMs(): number {
  return Date.now();
}

/** Current Unix timestamp in seconds (float). */
export function nowSec(): number {
  return Date.now() / 1000;
}

/** Convert Unix seconds to milliseconds. */
export function secToMs(sec: number): number {
  return sec * 1000;
}

/** Convert Unix milliseconds to seconds. */
export function msToSec(ms: number): number {
  return ms / 1000;
}

/** Build a Date from Unix seconds. */
export function fromUnixSec(sec: number): Date {
  return new Date(sec * 1000);
}

/** Build a Date from Unix milliseconds. */
export function fromUnixMs(ms: number): Date {
  return new Date(ms);
}

/** Unix seconds from a Date. */
export function toUnixSec(date: Date): number {
  return date.getTime() / 1000;
}

/** Unix milliseconds from a Date. */
export function toUnixMs(date: Date): number {
  return date.getTime();
}

// ── Date arithmetic ────────────────────────────────────────────────────────────

export function addMs(timestamp: number, ms: number): number      { return timestamp + ms; }
export function addSeconds(timestamp: number, s: number): number  { return timestamp + s * 1000; }
export function addMinutes(timestamp: number, m: number): number  { return timestamp + m * 60_000; }
export function addHours(timestamp: number, h: number): number    { return timestamp + h * 3_600_000; }
export function addDays(timestamp: number, d: number): number     { return timestamp + d * 86_400_000; }
export function addWeeks(timestamp: number, w: number): number    { return timestamp + w * 604_800_000; }

export function diffMs(a: number, b: number): number      { return Math.abs(a - b); }
export function diffSeconds(a: number, b: number): number { return Math.abs(a - b) / 1000; }
export function diffMinutes(a: number, b: number): number { return Math.abs(a - b) / 60_000; }
export function diffHours(a: number, b: number): number   { return Math.abs(a - b) / 3_600_000; }
export function diffDays(a: number, b: number): number    { return Math.abs(a - b) / 86_400_000; }

// ── Day boundaries ─────────────────────────────────────────────────────────────

export function startOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function startOfHour(timestamp: number): number {
  const d = new Date(timestamp);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

export function startOfMinute(timestamp: number): number {
  const d = new Date(timestamp);
  d.setSeconds(0, 0);
  return d.getTime();
}

// ── Predicates ────────────────────────────────────────────────────────────────

export function isToday(timestamp: number): boolean {
  return startOfDay(timestamp) === startOfDay(Date.now());
}

export function isYesterday(timestamp: number): boolean {
  return startOfDay(timestamp) === startOfDay(Date.now() - 86_400_000);
}

export function isTomorrow(timestamp: number): boolean {
  return startOfDay(timestamp) === startOfDay(Date.now() + 86_400_000);
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function isPast(timestamp: number): boolean {
  return timestamp < Date.now();
}

export function isFuture(timestamp: number): boolean {
  return timestamp > Date.now();
}

// ── Formatting ────────────────────────────────────────────────────────────────

/**
 * Format elapsed milliseconds as a stopwatch/timer string.
 *
 * @example
 * formatDuration(3723_456)         // "1:02:03"
 * formatDuration(3723_456, { ms: true })  // "1:02:03.456"
 * formatDuration(63_000, { forceHours: false })  // "1:03"
 */
export function formatDuration(ms: number, opts: FormatDurationOptions = {}): string {
  const { ms: showMs = false, forceHours = false, sep = ':' } = opts;
  const totalSec = Math.floor(Math.abs(ms) / 1000);
  const hours    = Math.floor(totalSec / 3600);
  const minutes  = Math.floor((totalSec % 3600) / 60);
  const seconds  = totalSec % 60;
  const millis   = Math.floor(Math.abs(ms) % 1000);

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const msPart = showMs ? `.${String(millis).padStart(3, '0')}` : '';

  if (hours > 0 || forceHours) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}${sep}${mm}${sep}${ss}${msPart}`;
  }
  return `${mm}${sep}${ss}${msPart}`;
}

/**
 * Format a duration in a human-readable long form.
 *
 * @example
 * formatDurationLong(3723_000)  // "1h 2m 3s"
 * formatDurationLong(65_000)    // "1m 5s"
 * formatDurationLong(800)       // "800ms"
 */
export function formatDurationLong(ms: number): string {
  const totalSec = Math.floor(Math.abs(ms) / 1000);
  if (totalSec === 0) return `${Math.floor(Math.abs(ms))}ms`;
  const hours   = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts: string[] = [];
  if (hours   > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

/**
 * Format a Unix timestamp as a date/time string.
 *
 * Falls back to `Date.toLocaleString()` when Intl is unavailable.
 */
export function formatDate(timestamp: number, opts: FormatDateOptions = {}): string {
  const { timezone, locale, intl: intlOpts } = opts;
  // When caller provides explicit intl opts, use them as-is (no base merge).
  // This lets formatTimeOfDay pass only time fields without date contamination.
  const baseOpts: Intl.DateTimeFormatOptions = intlOpts
    ? { ...intlOpts }
    : {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      };

  // If a timezone is requested but Intl doesn't support it, use manual offset
  if (timezone && !INTL_TZ_WORKS) {
    return formatWithManualTz(timestamp, timezone, baseOpts, locale);
  }

  try {
    const options: Intl.DateTimeFormatOptions = {
      ...baseOpts,
      ...(timezone ? { timeZone: timezone } : {}),
    };
    return new Intl.DateTimeFormat(locale, options).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

/**
 * Format a Unix timestamp as a time-only string (HH:MM:SS).
 */
export function formatTimeOfDay(timestamp: number, opts: FormatDateOptions = {}): string {
  return formatDate(timestamp, {
    ...opts,
    intl: { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, ...opts.intl },
  });
}

/**
 * Format a Unix timestamp as a date-only string.
 */
export function formatDateOnly(timestamp: number, opts: FormatDateOptions = {}): string {
  return formatDate(timestamp, {
    ...opts,
    intl: { year: 'numeric', month: 'short', day: 'numeric', ...opts.intl },
  });
}

// ── Relative time ─────────────────────────────────────────────────────────────

/**
 * Returns a human-readable relative time string.
 *
 * @example
 * relativeTime(Date.now() - 5_000)     // "5 seconds ago"
 * relativeTime(Date.now() + 60_000)    // "in 1 minute"
 * relativeTime(Date.now() - 90_000)    // "2 minutes ago"
 */
export function relativeTime(timestamp: number, from = Date.now()): string {
  const deltaMs  = timestamp - from;
  const absMs    = Math.abs(deltaMs);
  const past     = deltaMs < 0;

  const label = (n: number, unit: string) =>
    past ? `${n} ${unit}${n !== 1 ? 's' : ''} ago` : `in ${n} ${unit}${n !== 1 ? 's' : ''}`;

  if (absMs < 1_000)         return 'just now';
  if (absMs < 60_000)        return label(Math.round(absMs / 1_000), 'second');
  if (absMs < 3_600_000)     return label(Math.round(absMs / 60_000), 'minute');
  if (absMs < 86_400_000)    return label(Math.round(absMs / 3_600_000), 'hour');
  if (absMs < 604_800_000)   return label(Math.round(absMs / 86_400_000), 'day');
  if (absMs < 2_592_000_000) return label(Math.round(absMs / 604_800_000), 'week');
  return label(Math.round(absMs / 2_592_000_000), 'month');
}

// ── Timezone ──────────────────────────────────────────────────────────────────

/**
 * Get the UTC offset in minutes for a given timezone at a given timestamp.
 * Returns 0 on error (Intl not available or unknown timezone).
 *
 * @example
 * tzOffsetMinutes('America/New_York')  // -300 (EST) or -240 (EDT)
 */
export function tzOffsetMinutes(timezone: string, timestamp = Date.now()): number {
  // If Intl timezone support works, use the precise Intl path (handles DST)
  if (INTL_TZ_WORKS) {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      });
      const parts = fmt.formatToParts(new Date(timestamp));
      const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value ?? '0', 10);
      const wallUtc = Date.UTC(
        get('year'), get('month') - 1, get('day'),
        get('hour'), get('minute'), get('second')
      );
      return Math.round((wallUtc - timestamp) / 60_000);
    } catch {
      return fallbackTzOffset(timezone) ?? 0;
    }
  }
  // Fallback: use static offset table (no DST, but correct for most zones)
  return fallbackTzOffset(timezone) ?? 0;
}

/**
 * Convert a Unix timestamp from one timezone to another.
 * Returns the same Unix timestamp (time is absolute) but formatted in the
 * target timezone. For display purposes, use `formatDate` with `timezone`.
 *
 * This function returns the "wall clock" timestamp — a Unix ms value that,
 * when interpreted as UTC, reads the same hours:minutes as the timestamp
 * in the target timezone. Useful for computing "what time is it there."
 */
export function tzConvert(timestamp: number, toTimezone: string): number {
  const offset = tzOffsetMinutes(toTimezone, timestamp);
  return timestamp + offset * 60_000;
}

/**
 * List all available IANA timezone names (Intl must be available).
 * Returns an empty array in environments without Intl support.
 */
export function listTimezones(): string[] {
  try {
    return (Intl as any).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    return [];
  }
}

// ── Parsing ───────────────────────────────────────────────────────────────────

/**
 * Parse a date string into a Unix timestamp (ms).
 * Accepts ISO 8601, RFC 2822, and any format `Date` understands.
 * Returns NaN on failure.
 */
export function parseDate(str: string): number {
  const ms = Date.parse(str);
  return isNaN(ms) ? NaN : ms;
}

/**
 * Parse a duration string into milliseconds.
 * Supports: "1h", "30m", "5s", "500ms", "1h30m", "1:30:00", "90"
 *
 * @example
 * parseDuration('1h30m')   // 5_400_000
 * parseDuration('90')      // 90_000 (bare number = seconds)
 * parseDuration('1:30:00') // 5_400_000
 */
export function parseDuration(str: string): number {
  if (!str) return 0;
  const s = str.trim();

  // HH:MM:SS or MM:SS
  if (/^\d+:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(':').map(Number);
    if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    return (parts[0] * 60 + parts[1]) * 1000;
  }

  // Labelled segments: 1h30m20s500ms
  let ms = 0;
  const re = /(\d+(?:\.\d+)?)\s*(ms|millisecond|h|hr|hour|min|minute|m|sec|second|s)/gi;
  let matched = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    matched = true;
    const val  = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    if (unit.startsWith('h'))                ms += val * 3_600_000;
    else if (unit === 'ms' || unit.startsWith('mill')) ms += val;
    else if (unit.startsWith('mi') || unit === 'm') ms += val * 60_000;
    else /* s */                             ms += val * 1_000;
  }
  if (matched) return Math.round(ms);

  // Bare number → seconds
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 1000);
}
