import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatDuration,
  formatDurationLong,
  parseDuration,
  relativeTime,
} from '../src/utils.ts';

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
