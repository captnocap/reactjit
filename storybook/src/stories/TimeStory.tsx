/**
 * Time Story — @reactjit/time package demo.
 *
 * Showcases: Clock, Stopwatch, Countdown, Ticker widgets + hooks + utilities.
 */

import React, { useState } from 'react';
import { Box, Text, Pressable } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';
import {
  Clock,
  Stopwatch,
  Countdown,
  Ticker,
  useTime,
  useLuaTime,
  useStopwatch,
  useCountdown,
  useOnTime,
  useInterval,
  formatDuration,
  formatDurationLong,
  formatDate,
  formatTimeOfDay,
  relativeTime,
  parseDuration,
  nowMs,
  addDays,
  isToday,
  isYesterday,
  isTomorrow,
} from '../../../packages/time/src';

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  blue:   '#60a5fa',
  green:  '#4ade80',
  orange: '#fb923c',
  purple: '#a78bfa',
  red:    '#f87171',
  teal:   '#2dd4bf',
  dim:    'rgba(255,255,255,0.12)',
};

// ── Demo: Wall clock ──────────────────────────────────────────────────────────

function ClockDemo() {
  const c   = useThemeColors();
  const now = useTime(1000);

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 11, color: c.muted }}>
        {'useTime(1000) — updates every second via JS setInterval'}
      </Text>
      <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 16, gap: 6 }}>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: C.blue, letterSpacing: 2 }}>
          {formatTimeOfDay(now)}
        </Text>
        <Text style={{ fontSize: 13, color: c.text }}>
          {formatDate(now, { intl: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' } })}
        </Text>
        <Text style={{ fontSize: 11, color: c.muted }}>
          {`Unix ms: ${now}`}
        </Text>
      </Box>
    </Box>
  );
}

// ── Demo: Lua wall clock ──────────────────────────────────────────────────────

function LuaClockDemo() {
  const c = useThemeColors();
  const t = useLuaTime(500);

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 11, color: c.muted }}>
        {'useLuaTime() — polls love.timer.getTime() + os.time() via RPC'}
      </Text>
      <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 16, gap: 6 }}>
        {t ? (
          <>
            <Box style={{ flexDirection: 'row', gap: 24 }}>
              <Box style={{ gap: 2 }}>
                <Text style={{ fontSize: 10, color: c.muted }}>{'LOCAL'}</Text>
                <Text style={{ fontSize: 14, color: C.teal }}>{t.localStr}</Text>
              </Box>
              <Box style={{ gap: 2 }}>
                <Text style={{ fontSize: 10, color: c.muted }}>{'UTC'}</Text>
                <Text style={{ fontSize: 14, color: C.teal }}>{t.utcStr}</Text>
              </Box>
            </Box>
            <Text style={{ fontSize: 11, color: c.muted }}>
              {`Monotonic: ${t.mono.toFixed(3)}s  |  Epoch: ${t.epoch}ms`}
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: 13, color: c.muted }}>{'Connecting to Lua...'}</Text>
        )}
      </Box>
    </Box>
  );
}

// ── Demo: Stopwatch ───────────────────────────────────────────────────────────

function StopwatchDemo() {
  const c  = useThemeColors();
  const sw = useStopwatch({ tickRate: 50 });

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 11, color: c.muted }}>
        {'useStopwatch() — Lua dt accumulation, 50ms update rate'}
      </Text>
      <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 36, fontWeight: 'bold', color: sw.running ? C.green : c.text, letterSpacing: 2 }}>
          {formatDuration(sw.elapsed, { ms: true })}
        </Text>
        <Text style={{ fontSize: 11, color: c.muted }}>
          {formatDurationLong(sw.elapsed)}
        </Text>
        <Box style={{ flexDirection: 'row', gap: 8 }}>
          {!sw.running ? (
            <Pressable onPress={sw.start} style={{ backgroundColor: C.green, borderRadius: 6, paddingTop: 6, paddingBottom: 6, paddingLeft: 14, paddingRight: 14 }}>
              <Text style={{ fontSize: 12, color: '#000', fontWeight: 'bold' }}>{'Start'}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={sw.stop} style={{ backgroundColor: C.orange, borderRadius: 6, paddingTop: 6, paddingBottom: 6, paddingLeft: 14, paddingRight: 14 }}>
              <Text style={{ fontSize: 12, color: '#000', fontWeight: 'bold' }}>{'Stop'}</Text>
            </Pressable>
          )}
          <Pressable onPress={sw.reset} style={{ backgroundColor: C.dim, borderRadius: 6, paddingTop: 6, paddingBottom: 6, paddingLeft: 14, paddingRight: 14 }}>
            <Text style={{ fontSize: 12, color: c.text }}>{'Reset'}</Text>
          </Pressable>
          <Pressable onPress={sw.restart} style={{ backgroundColor: C.blue, borderRadius: 6, paddingTop: 6, paddingBottom: 6, paddingLeft: 14, paddingRight: 14 }}>
            <Text style={{ fontSize: 12, color: '#000', fontWeight: 'bold' }}>{'Restart'}</Text>
          </Pressable>
        </Box>
      </Box>
    </Box>
  );
}

// ── Demo: Countdown ───────────────────────────────────────────────────────────

function CountdownDemo() {
  const c        = useThemeColors();
  const duration = 10_000;
  const cd       = useCountdown(duration, { tickRate: 50, onComplete: () => {} });

  const barColor = cd.complete
    ? C.green
    : cd.remaining < 3000 ? C.red : C.blue;

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 11, color: c.muted }}>
        {'useCountdown(10_000) — Lua countdown, fires onComplete at zero'}
      </Text>
      <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: barColor, letterSpacing: 2 }}>
          {cd.complete ? 'Done!' : formatDuration(cd.remaining, { ms: true })}
        </Text>

        {/* Progress bar */}
        <Box style={{ width: '100%', height: 6, backgroundColor: C.dim, borderRadius: 3 }}>
          <Box style={{
            width: `${(1 - cd.progress) * 100}%`,
            height: 6,
            backgroundColor: barColor,
            borderRadius: 3,
          }} />
        </Box>

        <Text style={{ fontSize: 11, color: c.muted }}>
          {`${(cd.progress * 100).toFixed(1)}% elapsed`}
        </Text>

        <Box style={{ flexDirection: 'row', gap: 8 }}>
          {!cd.running ? (
            <Pressable onPress={cd.start} style={{ backgroundColor: C.green, borderRadius: 6, paddingTop: 6, paddingBottom: 6, paddingLeft: 14, paddingRight: 14 }}>
              <Text style={{ fontSize: 12, color: '#000', fontWeight: 'bold' }}>{'Start'}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={cd.stop} style={{ backgroundColor: C.orange, borderRadius: 6, paddingTop: 6, paddingBottom: 6, paddingLeft: 14, paddingRight: 14 }}>
              <Text style={{ fontSize: 12, color: '#000', fontWeight: 'bold' }}>{'Pause'}</Text>
            </Pressable>
          )}
          <Pressable onPress={cd.restart} style={{ backgroundColor: C.blue, borderRadius: 6, paddingTop: 6, paddingBottom: 6, paddingLeft: 14, paddingRight: 14 }}>
            <Text style={{ fontSize: 12, color: '#000', fontWeight: 'bold' }}>{'Restart'}</Text>
          </Pressable>
        </Box>
      </Box>
    </Box>
  );
}

// ── Demo: useOnTime precision scheduler ───────────────────────────────────────

function OnTimeDemo() {
  const c               = useThemeColors();
  const [log, setLog]   = useState<string[]>([]);
  const [armed, setArmed] = useState(false);
  const [delay, setDelay] = useState(2000);

  const addLog = (msg: string) =>
    setLog(prev => [`${formatTimeOfDay(Date.now())} ${msg}`, ...prev.slice(0, 7)]);

  useOnTime(() => {
    if (!armed) return;
    setArmed(false);
    addLog(`Fired! (scheduled ${delay}ms ago via Lua timer)`);
  }, armed ? delay : 0, [armed, delay]);

  const schedule = (ms: number) => {
    setDelay(ms);
    setArmed(true);
    addLog(`Scheduled in ${ms}ms...`);
  };

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 11, color: c.muted }}>
        {'useOnTime(fn, delayMs) — fires in exact Love2D frame, not JS event loop'}
      </Text>
      <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 16, gap: 10 }}>
        <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[500, 1000, 2000, 5000].map(ms => (
            <Pressable
              key={ms}
              onPress={() => schedule(ms)}
              style={{ backgroundColor: armed && delay === ms ? C.purple : C.dim, borderRadius: 6, paddingTop: 6, paddingBottom: 6, paddingLeft: 12, paddingRight: 12 }}
            >
              <Text style={{ fontSize: 12, color: c.text }}>{`+${ms}ms`}</Text>
            </Pressable>
          ))}
        </Box>
        {log.length > 0 ? (
          <Box style={{ gap: 3 }}>
            {log.map((entry, i) => (
              <Text key={i} style={{ fontSize: 11, color: i === 0 ? C.green : c.muted }}>
                {entry}
              </Text>
            ))}
          </Box>
        ) : (
          <Text style={{ fontSize: 11, color: c.muted }}>{'Click a button to schedule a callback.'}</Text>
        )}
      </Box>
    </Box>
  );
}

// ── Demo: useInterval ─────────────────────────────────────────────────────────

function IntervalDemo() {
  const c     = useThemeColors();
  const [ticks, setTicks] = useState(0);
  const [rate,  setRate]  = useState(1000);

  useInterval(() => setTicks(n => n + 1), rate);

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 11, color: c.muted }}>
        {'useInterval(fn, ms) — Lua-driven repeating callback'}
      </Text>
      <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 16, gap: 10 }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: C.purple }}>{String(ticks)}</Text>
          <Text style={{ fontSize: 12, color: c.muted }}>{'ticks'}</Text>
        </Box>
        <Box style={{ flexDirection: 'row', gap: 8 }}>
          {[250, 500, 1000, 2000].map(ms => (
            <Pressable
              key={ms}
              onPress={() => setRate(ms)}
              style={{ backgroundColor: rate === ms ? C.purple : C.dim, borderRadius: 6, paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10 }}
            >
              <Text style={{ fontSize: 11, color: rate === ms ? '#000' : c.text }}>{`${ms}ms`}</Text>
            </Pressable>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

// ── Demo: Utilities ───────────────────────────────────────────────────────────

function UtilsDemo() {
  const c   = useThemeColors();
  const now = nowMs();

  const samples: [string, string][] = [
    ['relativeTime(now - 5_000)',     relativeTime(now - 5_000)],
    ['relativeTime(now - 90_000)',    relativeTime(now - 90_000)],
    ['relativeTime(now + 300_000)',   relativeTime(now + 300_000)],
    ['relativeTime(now - 3_600_000)', relativeTime(now - 3_600_000)],
    ['formatDuration(3_723_456)',     formatDuration(3_723_456)],
    ['formatDuration(3_723_456, {ms:true})', formatDuration(3_723_456, { ms: true })],
    ['formatDurationLong(3_723_000)', formatDurationLong(3_723_000)],
    ['parseDuration("1h30m")',        String(parseDuration('1h30m'))],
    ['parseDuration("1:30:00")',      String(parseDuration('1:30:00'))],
    ['isToday(now)',                  String(isToday(now))],
    ['isYesterday(addDays(now,-1))',  String(isYesterday(addDays(now, -1)))],
    ['isTomorrow(addDays(now,+1))',   String(isTomorrow(addDays(now, +1)))],
    ['formatDate(now)',               formatDate(now)],
    ['formatDate(now, {timezone: "Asia/Tokyo"})',
      formatDate(now, { timezone: 'Asia/Tokyo' })],
  ];

  return (
    <Box style={{ gap: 8 }}>
      <Text style={{ fontSize: 11, color: c.muted }}>
        {'Pure utility functions — no hooks, no bridge, just Date math'}
      </Text>
      <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 4 }}>
        {samples.map(([expr, result]) => (
          <Box key={expr} style={{ flexDirection: 'row', gap: 12, paddingTop: 3, paddingBottom: 3 }}>
            <Text style={{ fontSize: 10, color: c.muted, flexShrink: 1 }}>{expr}</Text>
            <Text style={{ fontSize: 10, color: C.teal }}>{result}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Widget demos ──────────────────────────────────────────────────────────────

function WidgetsDemo() {
  const c = useThemeColors();
  const [tickCount, setTickCount] = useState(0);

  return (
    <Box style={{ gap: 16 }}>
      <Text style={{ fontSize: 11, color: c.muted }}>
        {'Drop-in widgets — no hooks, no wiring. One import, one line.'}
      </Text>

      {/* Clock variants */}
      <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 14, gap: 10 }}>
        <Label c={c}>{'<Clock />'}</Label>
        <Clock textStyle={{ fontSize: 22, color: C.blue }} />

        <Label c={c}>{'<Clock format="datetime" />'}</Label>
        <Clock format="datetime" textStyle={{ fontSize: 13, color: c.text }} />

        <Label c={c}>{'<Clock timezone="Asia/Tokyo" /> + <Clock timezone="America/New_York" />'}</Label>
        <Box style={{ flexDirection: 'row', gap: 24 }}>
          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 9, color: c.muted }}>{'Tokyo'}</Text>
            <Clock timezone="Asia/Tokyo" textStyle={{ fontSize: 14, color: C.teal }} />
          </Box>
          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 9, color: c.muted }}>{'New York'}</Text>
            <Clock timezone="America/New_York" textStyle={{ fontSize: 14, color: C.teal }} />
          </Box>
          <Box style={{ gap: 2 }}>
            <Text style={{ fontSize: 9, color: c.muted }}>{'London'}</Text>
            <Clock timezone="Europe/London" textStyle={{ fontSize: 14, color: C.teal }} />
          </Box>
        </Box>
      </Box>

      {/* Stopwatch */}
      <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 14, gap: 6 }}>
        <Label c={c}>{'<Stopwatch autoStart showMs />'}</Label>
        <Stopwatch autoStart showMs textStyle={{ fontSize: 22, color: C.green }} />
      </Box>

      {/* Countdown */}
      <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 14, gap: 6 }}>
        <Label c={c}>{'<Countdown duration={20_000} autoStart showBar />'}</Label>
        <Countdown duration={20_000} autoStart showBar textStyle={{ fontSize: 22, color: C.orange }} />
      </Box>

      {/* Ticker */}
      <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 14, gap: 6 }}>
        <Label c={c}>{'<Ticker interval={500} onTick={step} />  — invisible, just ticks'}</Label>
        <Ticker interval={500} onTick={() => setTickCount(n => n + 1)} />
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tickCount % 2 === 0 ? C.purple : c.muted }} />
          <Text style={{ fontSize: 12, color: c.text }}>{`${tickCount} ticks`}</Text>
        </Box>
      </Box>
    </Box>
  );
}

function Label({ c, children }: { c: any; children: string }) {
  return <Text style={{ fontSize: 10, color: c.muted }}>{children}</Text>;
}

// ── Story root ────────────────────────────────────────────────────────────────

export function TimeStory() {
  return (
    <StoryPage
      title="Time"
      subtitle="Stopwatches, countdowns, precision scheduling, date utilities, and timezone conversions — all frame-accurate."
      packageName="@reactjit/time"
    >
      <StorySection title="Widgets">
        <WidgetsDemo />
      </StorySection>

      <StorySection title="Wall Clock — hook">
        <ClockDemo />
      </StorySection>

      <StorySection title="Lua Wall Clock">
        <LuaClockDemo />
      </StorySection>

      <StorySection title="Stopwatch — hook">
        <StopwatchDemo />
      </StorySection>

      <StorySection title="Countdown — hook">
        <CountdownDemo />
      </StorySection>

      <StorySection title="useOnTime — precision scheduler">
        <OnTimeDemo />
      </StorySection>

      <StorySection title="useInterval — repeating callback">
        <IntervalDemo />
      </StorySection>

      <StorySection title="Utility Functions">
        <UtilsDemo />
      </StorySection>
    </StoryPage>
  );
}
