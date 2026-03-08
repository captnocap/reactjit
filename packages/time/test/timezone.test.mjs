import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatDateOnly,
  formatTimeOfDay,
  tzConvert,
  tzOffsetMinutes,
} from '../src/utils.ts';

describe('time timezone offset semantics', () => {
  it('returns UTC offsets in minutes with correct sign and DST behavior', () => {
    const jan = Date.UTC(2026, 0, 15, 12, 0, 0);
    const jul = Date.UTC(2026, 6, 15, 12, 0, 0);

    assert.equal(tzOffsetMinutes('UTC', jan), 0);
    assert.equal(tzOffsetMinutes('Asia/Tokyo', jan), 540);
    assert.equal(tzOffsetMinutes('America/New_York', jan), -300);
    assert.equal(tzOffsetMinutes('America/New_York', jul), -240);
  });

  it('converts absolute timestamps into target-zone wall-clock timestamps', () => {
    const jan = Date.UTC(2026, 0, 15, 12, 0, 0);

    assert.equal(
      new Date(tzConvert(jan, 'America/New_York')).toISOString(),
      '2026-01-15T07:00:00.000Z',
    );
    assert.equal(
      new Date(tzConvert(jan, 'Asia/Tokyo')).toISOString(),
      '2026-01-15T21:00:00.000Z',
    );
  });
});

describe('time timezone formatting semantics', () => {
  it('formats time-only output without injecting a date', () => {
    const jan = Date.UTC(2026, 0, 15, 12, 0, 0);
    const output = formatTimeOfDay(jan, { timezone: 'UTC', locale: 'en-US' });

    assert.match(output, /^\d{2}:\d{2}:\d{2}$/);
  });

  it('formats date-only output without injecting a time', () => {
    const jan = Date.UTC(2026, 0, 15, 12, 0, 0);
    const output = formatDateOnly(jan, { timezone: 'UTC', locale: 'en-US' });

    assert.ok(output.includes('2026'));
    assert.ok(!output.includes(':'));
  });
});
