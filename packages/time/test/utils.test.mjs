import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addDays,
  addHours,
  addMinutes,
  addMs,
  addSeconds,
  addWeeks,
  diffDays,
  diffHours,
  diffMinutes,
  diffMs,
  diffSeconds,
  endOfDay,
  formatDuration,
  formatDurationLong,
  fromUnixMs,
  fromUnixSec,
  isFuture,
  isPast,
  isSameDay,
  isToday,
  isTomorrow,
  isYesterday,
  parseDuration,
  parseDate,
  relativeTime,
  secToMs,
  msToSec,
  startOfDay,
  startOfHour,
  startOfMinute,
  toUnixMs,
  toUnixSec,
} from '../src/utils.ts';

describe('time conversion semantics', () => {
  it('round-trips unix seconds, milliseconds, and Date values', () => {
    const sec = 1_704_067_200;
    const ms = 1_704_067_200_123;

    assert.equal(secToMs(sec), sec * 1000);
    assert.equal(msToSec(ms), ms / 1000);
    assert.equal(fromUnixSec(sec).getTime(), sec * 1000);
    assert.equal(fromUnixMs(ms).getTime(), ms);
    assert.equal(toUnixSec(new Date(sec * 1000)), sec);
    assert.equal(toUnixMs(new Date(ms)), ms);
  });
});

describe('time arithmetic semantics', () => {
  it('adds and diffs time units in milliseconds', () => {
    const base = Date.UTC(2026, 0, 15, 12, 0, 0);

    assert.equal(addMs(base, 250), base + 250);
    assert.equal(addSeconds(base, 3), base + 3_000);
    assert.equal(addMinutes(base, 2), base + 120_000);
    assert.equal(addHours(base, 4), base + 14_400_000);
    assert.equal(addDays(base, 5), base + 432_000_000);
    assert.equal(addWeeks(base, 2), base + 1_209_600_000);

    assert.equal(diffMs(base, base + 250), 250);
    assert.equal(diffSeconds(base, base + 3_000), 3);
    assert.equal(diffMinutes(base, base + 120_000), 2);
    assert.equal(diffHours(base, base + 14_400_000), 4);
    assert.equal(diffDays(base, base + 432_000_000), 5);
  });
});

describe('time boundary helper semantics', () => {
  it('clips timestamps to local day, hour, and minute boundaries', () => {
    const input = new Date(2026, 0, 15, 18, 47, 52, 321).getTime();

    const dayStart = new Date(startOfDay(input));
    const dayEnd = new Date(endOfDay(input));
    const hourStart = new Date(startOfHour(input));
    const minuteStart = new Date(startOfMinute(input));

    assert.equal(dayStart.getFullYear(), 2026);
    assert.equal(dayStart.getMonth(), 0);
    assert.equal(dayStart.getDate(), 15);
    assert.equal(dayStart.getHours(), 0);
    assert.equal(dayStart.getMinutes(), 0);
    assert.equal(dayStart.getSeconds(), 0);
    assert.equal(dayStart.getMilliseconds(), 0);

    assert.equal(dayEnd.getFullYear(), 2026);
    assert.equal(dayEnd.getMonth(), 0);
    assert.equal(dayEnd.getDate(), 15);
    assert.equal(dayEnd.getHours(), 23);
    assert.equal(dayEnd.getMinutes(), 59);
    assert.equal(dayEnd.getSeconds(), 59);
    assert.equal(dayEnd.getMilliseconds(), 999);

    assert.equal(hourStart.getHours(), 18);
    assert.equal(hourStart.getMinutes(), 0);
    assert.equal(hourStart.getSeconds(), 0);
    assert.equal(hourStart.getMilliseconds(), 0);

    assert.equal(minuteStart.getHours(), 18);
    assert.equal(minuteStart.getMinutes(), 47);
    assert.equal(minuteStart.getSeconds(), 0);
    assert.equal(minuteStart.getMilliseconds(), 0);
  });
});

describe('time duration formatting semantics', () => {
  it('formats stopwatch-style durations with and without milliseconds', () => {
    assert.equal(formatDuration(63_000), '01:03');
    assert.equal(formatDuration(3_723_456, { forceHours: true }), '01:02:03');
    assert.equal(formatDuration(3_723_456, { forceHours: true, ms: true }), '01:02:03.456');
  });

  it('formats long durations into human-readable unit strings', () => {
    assert.equal(formatDurationLong(3_723_000), '1h 2m 3s');
    assert.equal(formatDurationLong(65_000), '1m 5s');
    assert.equal(formatDurationLong(800), '800ms');
  });
});

describe('time duration parsing semantics', () => {
  it('parses colon-delimited and bare-second durations', () => {
    assert.equal(parseDuration('1:30'), 90_000);
    assert.equal(parseDuration('1:30:00'), 5_400_000);
    assert.equal(parseDuration('90'), 90_000);
  });

  it('parses labeled compound durations', () => {
    assert.equal(parseDuration('1h30m'), 5_400_000);
    assert.equal(parseDuration('2m 5s'), 125_000);
    assert.equal(parseDuration('1.5s'), 1_500);
  });

  it('treats millisecond units as milliseconds rather than minutes', () => {
    assert.equal(parseDuration('500ms'), 500);
    assert.equal(parseDuration('1s250ms'), 1_250);
  });

  it('supports long unit names and returns 0 for invalid input', () => {
    assert.equal(parseDuration('1 hour 2 minute 3 second 4 millisecond'), 3_723_004);
    assert.equal(parseDuration('not a duration'), 0);
  });
});

describe('time predicate and parsing semantics', () => {
  it('classifies today, yesterday, tomorrow, past, and future relative to Date.now()', () => {
    const realNow = Date.now;
    const fixedNow = new Date(2026, 0, 15, 15, 30, 0, 0).getTime();

    Date.now = () => fixedNow;

    try {
      const today = new Date(2026, 0, 15, 8, 0, 0, 0).getTime();
      const yesterday = new Date(2026, 0, 14, 23, 59, 59, 999).getTime();
      const tomorrow = new Date(2026, 0, 16, 0, 0, 0, 0).getTime();

      assert.equal(isToday(today), true);
      assert.equal(isYesterday(yesterday), true);
      assert.equal(isTomorrow(tomorrow), true);
      assert.equal(isSameDay(today, fixedNow), true);
      assert.equal(isSameDay(yesterday, fixedNow), false);
      assert.equal(isPast(fixedNow - 1), true);
      assert.equal(isFuture(fixedNow + 1), true);
    } finally {
      Date.now = realNow;
    }
  });

  it('parses valid date strings and preserves invalid ones as NaN', () => {
    const iso = '2026-01-15T12:34:56.789Z';

    assert.equal(parseDate(iso), Date.parse(iso));
    assert.equal(Number.isNaN(parseDate('not a real date')), true);
  });
});

describe('relative time semantics', () => {
  it('uses stable human phrasing around seconds, minutes, and future timestamps', () => {
    const from = Date.UTC(2026, 2, 7, 12, 0, 0);

    assert.equal(relativeTime(from - 5_000, from), '5 seconds ago');
    assert.equal(relativeTime(from - 90_000, from), '2 minutes ago');
    assert.equal(relativeTime(from + 60_000, from), 'in 1 minute');
    assert.equal(relativeTime(from + 500, from), 'just now');
  });
});
