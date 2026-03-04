/**
 * @reactjit/time — Pure utility functions.
 *
 * No hooks, no bridge, no React. All functions operate on numbers (ms since
 * Unix epoch) or Date objects. Safe to call anywhere.
 */

import type { FormatDurationOptions, FormatDateOptions } from './types';

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
  try {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      ...intlOpts,
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
  try {
    // Use Intl to get the local time in the target zone, then compare to UTC
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date(timestamp));
    const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value ?? '0', 10);
    const localDate = new Date(
      get('year'), get('month') - 1, get('day'),
      get('hour'), get('minute'), get('second')
    );
    return Math.round((localDate.getTime() - timestamp) / 60_000);
  } catch {
    return 0;
  }
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
  const re = /(\d+(?:\.\d+)?)\s*(h|hr|hour|m|min|minute|s|sec|second|ms|millisecond)/gi;
  let matched = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    matched = true;
    const val  = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    if (unit.startsWith('h'))                ms += val * 3_600_000;
    else if (unit.startsWith('mi') || unit === 'm') ms += val * 60_000;
    else if (unit === 'ms' || unit.startsWith('mill')) ms += val;
    else /* s */                             ms += val * 1_000;
  }
  if (matched) return Math.round(ms);

  // Bare number → seconds
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 1000);
}
