// @reactjit/time — Timers, stopwatches, countdowns, precision scheduling,
// date formatting, timezone utilities, and Unix timestamp helpers.
//
// Lua-side: time:now, time:stopwatch:*, time:countdown:* RPCs in lua/init.lua
// React-side: hooks for all time constructs + pure utility functions

export type {
  StopwatchOptions,
  StopwatchResult,
  CountdownOptions,
  CountdownResult,
  OnTimeOptions,
  LuaTimeState,
  FormatDurationOptions,
  FormatDateOptions,
} from './types';

export type { ClockProps, StopwatchProps, CountdownProps, TickerProps, FrameTickerProps } from './widgets';
export { Clock, Stopwatch, Countdown, Ticker, FrameTicker } from './widgets';

export {
  // Wall clock
  useTime,
  useLuaTime,
  // Stopwatch & countdown
  useStopwatch,
  useCountdown,
  // Precision scheduling
  useOnTime,
  useInterval,
  useFrameInterval,
} from './hooks';

export {
  // Unix timestamps
  nowMs,
  nowSec,
  secToMs,
  msToSec,
  fromUnixSec,
  fromUnixMs,
  toUnixSec,
  toUnixMs,
  // Date arithmetic
  addMs,
  addSeconds,
  addMinutes,
  addHours,
  addDays,
  addWeeks,
  diffMs,
  diffSeconds,
  diffMinutes,
  diffHours,
  diffDays,
  // Day boundaries
  startOfDay,
  endOfDay,
  startOfHour,
  startOfMinute,
  // Predicates
  isToday,
  isYesterday,
  isTomorrow,
  isSameDay,
  isPast,
  isFuture,
  // Formatting
  formatDuration,
  formatDurationLong,
  formatDate,
  formatTimeOfDay,
  formatDateOnly,
  // Relative time
  relativeTime,
  // Timezone
  tzOffsetMinutes,
  tzConvert,
  listTimezones,
  // Parsing
  parseDate,
  parseDuration,
} from './utils';
