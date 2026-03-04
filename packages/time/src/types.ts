// ── Stopwatch ─────────────────────────────────────────────────────────────────

export interface StopwatchOptions {
  /** How often Lua pushes elapsed updates to React (ms). Default: 100. */
  tickRate?: number;
  /** Start running immediately on mount. Default: false. */
  autoStart?: boolean;
}

export interface StopwatchResult {
  /** Elapsed time in milliseconds. */
  elapsed: number;
  /** Whether the stopwatch is currently running. */
  running: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
  /** Stop + reset in one call. */
  restart: () => void;
}

// ── Countdown ─────────────────────────────────────────────────────────────────

export interface CountdownOptions {
  /** How often Lua pushes remaining updates to React (ms). Default: 100. */
  tickRate?: number;
  /** Start running immediately on mount. Default: false. */
  autoStart?: boolean;
  /** Called when countdown reaches zero. Fires once per countdown run. */
  onComplete?: () => void;
}

export interface CountdownResult {
  /** Remaining time in milliseconds. */
  remaining: number;
  /** Whether the countdown is running. */
  running: boolean;
  /** Whether the countdown has completed (remaining === 0). */
  complete: boolean;
  /** 0–1 progress fraction (elapsed / duration). */
  progress: number;
  start: () => void;
  stop: () => void;
  reset: () => void;
  /** Stop + reset + start in one call. */
  restart: () => void;
}

// ── Precision scheduler ───────────────────────────────────────────────────────

export interface OnTimeOptions {
  /** If true, the callback fires immediately when delayMs is 0 or negative. Default: true. */
  immediate?: boolean;
}

// ── Lua wall clock ────────────────────────────────────────────────────────────

export interface LuaTimeState {
  /** Unix epoch milliseconds (integer-second precision from Lua os.time). */
  epoch: number;
  /** Monotonic seconds since Love2D started (float, sub-ms precision). */
  mono: number;
  /** ISO local time string from Lua. */
  localStr: string;
  /** ISO UTC time string from Lua. */
  utcStr: string;
}

// ── Duration formatting ───────────────────────────────────────────────────────

export interface FormatDurationOptions {
  /** Show milliseconds. Default: false. */
  ms?: boolean;
  /** Show hours even when zero. Default: false. */
  forceHours?: boolean;
  /** Separator between segments. Default: ':'. */
  sep?: string;
}

export interface FormatDateOptions {
  /** IANA timezone name (e.g. 'America/New_York'). Default: local time. */
  timezone?: string;
  /** BCP 47 locale (e.g. 'en-US'). Default: system locale. */
  locale?: string;
  /** Intl.DateTimeFormat options to pass through. */
  intl?: Intl.DateTimeFormatOptions;
}
