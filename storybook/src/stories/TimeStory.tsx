/**
 * Time — Package documentation page (Layout2 zigzag narrative).
 *
 * Showcases: Clock, Stopwatch, Countdown, Ticker widgets + hooks + utilities.
 * Live demos sit on the "code" side of zigzag bands — widgets are visual,
 * so showing them running is better than showing a CodeBlock.
 */

import React, { useState } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import {
  Clock,
  Stopwatch,
  Countdown,
  Ticker,
  useTime,
  useStopwatch,
  useCountdown,
  useInterval,
  useFrameInterval,
  FrameTicker,
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

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#8b5cf6',
  accentDim: 'rgba(139, 92, 246, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  blue: '#60a5fa',
  green: '#4ade80',
  orange: '#fb923c',
  teal: '#2dd4bf',
  red: '#f87171',
  dim: 'rgba(255,255,255,0.12)',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import {
  Clock, Stopwatch, Countdown, Ticker, FrameTicker,
  useTime, useStopwatch, useCountdown,
  useOnTime, useInterval, useFrameInterval,
  formatDuration, relativeTime, parseDuration,
} from '@reactjit/time'`;

const WIDGET_CODE = `<Clock />
<Clock format="datetime" timezone="Asia/Tokyo" />
<Stopwatch autoStart showMs />
<Countdown duration={30_000} autoStart showBar />
<Ticker interval={500} onTick={() => step()} />`;

const STOPWATCH_CODE = `const sw = useStopwatch({ tickRate: 50 })

// sw.elapsed   — ms elapsed
// sw.running   — boolean
// sw.start()  sw.stop()  sw.reset()  sw.restart()

<Text>{formatDuration(sw.elapsed, { ms: true })}</Text>`;

const COUNTDOWN_CODE = `const cd = useCountdown(10_000, {
  tickRate: 50,
  onComplete: () => celebrate(),
})

// cd.remaining  cd.progress (0–1)  cd.complete
<Text>{formatDuration(cd.remaining)}</Text>`;

const SCHEDULING_CODE = `// Fire once after 2 seconds — frame-perfect in Love2D
useOnTime(() => {
  playSound('ding')
}, 2000, [armed])

// Repeat every 500ms — Lua dt accumulation, not JS setInterval
useInterval(() => {
  setTicks(n => n + 1)
}, 500)`;

const FRAME_INTERVAL_CODE = `// Fire every 100 frames (≈1.7s at 60fps)
useFrameInterval(() => {
  stepSimulation()
}, 100)

// Or as a component — invisible, just fires
<FrameTicker frames={60} onTick={updateParticles} />`;

const UTILS_CODE = `formatDuration(3_723_456)           // "1:02:03"
formatDuration(3_723_456, {ms:true}) // "1:02:03.456"
formatDurationLong(3_723_000)        // "1h 2m 3s"
relativeTime(Date.now() - 90_000)    // "2 minutes ago"
parseDuration("1h30m")               // 5400000
isToday(Date.now())                  // true
addDays(Date.now(), -1)              // yesterday's timestamp`;

// ── Helpers ──────────────────────────────────────────────

function Divider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={C.accent} />
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
        {children}
      </Text>
    </Box>
  );
}

// ── Inline demos ─────────────────────────────────────────

function WorldClockDemo() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 10 }}>
      <Clock textStyle={{ fontSize: 22, color: C.blue, fontWeight: 'bold', letterSpacing: 2 }} />
      <Clock format="datetime" textStyle={{ fontSize: 11, color: c.text }} />
      <Box style={{ flexDirection: 'row', gap: 16 }}>
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 8, color: c.muted }}>{'Tokyo'}</Text>
          <Clock timezone="Asia/Tokyo" textStyle={{ fontSize: 12, color: C.teal }} />
        </Box>
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 8, color: c.muted }}>{'New York'}</Text>
          <Clock timezone="America/New_York" textStyle={{ fontSize: 12, color: C.teal }} />
        </Box>
        <Box style={{ gap: 2 }}>
          <Text style={{ fontSize: 8, color: c.muted }}>{'London'}</Text>
          <Clock timezone="Europe/London" textStyle={{ fontSize: 12, color: C.teal }} />
        </Box>
      </Box>
    </Box>
  );
}

function StopwatchDemo() {
  const c = useThemeColors();
  const sw = useStopwatch({ tickRate: 50 });

  return (
    <Box style={{ gap: 10 }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', color: sw.running ? C.green : c.text, letterSpacing: 2 }}>
        {formatDuration(sw.elapsed, { ms: true })}
      </Text>
      <Text style={{ fontSize: 9, color: c.muted }}>{formatDurationLong(sw.elapsed)}</Text>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        {!sw.running ? (
          <Pressable onPress={sw.start} style={{ backgroundColor: C.green, borderRadius: 5, paddingTop: 5, paddingBottom: 5, paddingLeft: 12, paddingRight: 12 }}>
            <Text style={{ fontSize: 10, color: '#000', fontWeight: 'bold' }}>{'Start'}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={sw.stop} style={{ backgroundColor: C.orange, borderRadius: 5, paddingTop: 5, paddingBottom: 5, paddingLeft: 12, paddingRight: 12 }}>
            <Text style={{ fontSize: 10, color: '#000', fontWeight: 'bold' }}>{'Stop'}</Text>
          </Pressable>
        )}
        <Pressable onPress={sw.reset} style={{ backgroundColor: C.dim, borderRadius: 5, paddingTop: 5, paddingBottom: 5, paddingLeft: 12, paddingRight: 12 }}>
          <Text style={{ fontSize: 10, color: c.text }}>{'Reset'}</Text>
        </Pressable>
      </Box>
    </Box>
  );
}

function CountdownDemo() {
  const c = useThemeColors();
  const cd = useCountdown(15_000, { tickRate: 50 });
  const barColor = cd.complete ? C.green : cd.remaining < 3000 ? C.red : C.blue;

  return (
    <Box style={{ gap: 10 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: barColor, letterSpacing: 2 }}>
        {cd.complete ? 'Done!' : formatDuration(cd.remaining, { ms: true })}
      </Text>
      <Box style={{ width: '100%', height: 4, backgroundColor: C.dim, borderRadius: 2 }}>
        <Box style={{
          width: `${(1 - cd.progress) * 100}%`,
          height: 4,
          backgroundColor: barColor,
          borderRadius: 2,
        }} />
      </Box>
      <Text style={{ fontSize: 9, color: c.muted }}>
        {`${(cd.progress * 100).toFixed(1)}% elapsed`}
      </Text>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        {!cd.running ? (
          <Pressable onPress={cd.start} style={{ backgroundColor: C.green, borderRadius: 5, paddingTop: 5, paddingBottom: 5, paddingLeft: 12, paddingRight: 12 }}>
            <Text style={{ fontSize: 10, color: '#000', fontWeight: 'bold' }}>{'Start'}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={cd.stop} style={{ backgroundColor: C.orange, borderRadius: 5, paddingTop: 5, paddingBottom: 5, paddingLeft: 12, paddingRight: 12 }}>
            <Text style={{ fontSize: 10, color: '#000', fontWeight: 'bold' }}>{'Pause'}</Text>
          </Pressable>
        )}
        <Pressable onPress={cd.restart} style={{ backgroundColor: C.blue, borderRadius: 5, paddingTop: 5, paddingBottom: 5, paddingLeft: 12, paddingRight: 12 }}>
          <Text style={{ fontSize: 10, color: '#000', fontWeight: 'bold' }}>{'Restart'}</Text>
        </Pressable>
      </Box>
    </Box>
  );
}

function TickerDemo() {
  const c = useThemeColors();
  const [ticks, setTicks] = useState(0);

  return (
    <Box style={{ gap: 6 }}>
      <Ticker interval={500} onTick={() => setTicks(n => n + 1)} />
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ticks % 2 === 0 ? C.accent : c.muted }} />
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: C.accent }}>{String(ticks)}</Text>
        <Text style={{ fontSize: 10, color: c.muted }}>{'ticks @ 500ms'}</Text>
      </Box>
    </Box>
  );
}

function IntervalDemo() {
  const c = useThemeColors();
  const [count, setCount] = useState(0);
  const [rate, setRate] = useState(1000);

  useInterval(() => setCount(n => n + 1), rate);

  return (
    <Box style={{ gap: 8 }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: C.accent }}>{String(count)}</Text>
        <Text style={{ fontSize: 10, color: c.muted }}>{'ticks'}</Text>
      </Box>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        {[250, 500, 1000, 2000].map(ms => (
          <Pressable
            key={ms}
            onPress={() => setRate(ms)}
            style={{ backgroundColor: rate === ms ? C.accent : C.dim, borderRadius: 5, paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8 }}
          >
            <Text style={{ fontSize: 9, color: rate === ms ? '#000' : c.text }}>{`${ms}ms`}</Text>
          </Pressable>
        ))}
      </Box>
    </Box>
  );
}

function FrameIntervalDemo() {
  const c = useThemeColors();
  const [frameCount, setFrameCount] = useState(0);
  const [every, setEvery] = useState(60);

  useFrameInterval(() => setFrameCount(n => n + 1), every);

  return (
    <Box style={{ gap: 8 }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: C.teal }}>{String(frameCount)}</Text>
        <Text style={{ fontSize: 10, color: c.muted }}>{'fires'}</Text>
      </Box>
      <Box style={{ flexDirection: 'row', gap: 6 }}>
        {[1, 10, 60, 120].map(n => (
          <Pressable
            key={n}
            onPress={() => { setEvery(n); setFrameCount(0); }}
            style={{ backgroundColor: every === n ? C.teal : C.dim, borderRadius: 5, paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8 }}
          >
            <Text style={{ fontSize: 9, color: every === n ? '#000' : c.text }}>{`${n}f`}</Text>
          </Pressable>
        ))}
      </Box>
      <Text style={{ fontSize: 8, color: c.muted }}>{`every ${every} frame${every > 1 ? 's' : ''} \u2248 ${(every / 60).toFixed(1)}s at 60fps`}</Text>
    </Box>
  );
}

function UtilsDemo() {
  const c = useThemeColors();
  const now = nowMs();

  const samples: [string, string][] = [
    ['relativeTime(now - 90s)', relativeTime(now - 90_000)],
    ['formatDuration(3_723_456)', formatDuration(3_723_456)],
    ['formatDurationLong(3_723_000)', formatDurationLong(3_723_000)],
    ['parseDuration("1h30m")', String(parseDuration('1h30m'))],
    ['isToday(now)', String(isToday(now))],
    ['isYesterday(now - 1d)', String(isYesterday(addDays(now, -1)))],
    ['isTomorrow(now + 1d)', String(isTomorrow(addDays(now, +1)))],
    ['formatDate(now)', formatDate(now)],
  ];

  return (
    <Box style={{ gap: 3 }}>
      {samples.map(([expr, result]) => (
        <Box key={expr} style={{ flexDirection: 'row', gap: 10, paddingTop: 2, paddingBottom: 2 }}>
          <Text style={{ fontSize: 9, color: c.muted, flexShrink: 1 }}>{expr}</Text>
          <Text style={{ fontSize: 9, color: C.teal, fontWeight: 'bold' }}>{result}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── TimeStory ────────────────────────────────────────────

export function TimeStory() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="clock" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Time'}
        </Text>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/time'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Clocks, stopwatches, countdowns, scheduling, and date utilities'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <Box style={{
          borderLeftWidth: 3,
          borderColor: C.accent,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 24,
          paddingBottom: 24,
          gap: 8,
        }}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'Frame-accurate time for everything.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'Drop-in widgets for clocks and timers. Hooks that run in Lua\u2019s update loop for precision scheduling. Pure utilities for formatting, parsing, and date math \u2014 no bridge required.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band: text | code — Install ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Everything in one import \u2014 widgets, hooks, and pure utilities. Pick what you need.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
        </Box>

        <Divider />

        {/* ── Band: demo | text — Widgets (zigzag) ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <Box style={{ flexBasis: 0, flexGrow: 1, justifyContent: 'center' }}>
            <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 14, gap: 10 }}>
              <WorldClockDemo />
              <Box style={{ height: 1, backgroundColor: c.border }} />
              <TickerDemo />
            </Box>
          </Box>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="clock">{'WIDGETS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'One-liner components \u2014 no hooks, no wiring. Clock shows local or any IANA timezone. Stopwatch and Countdown have built-in controls. Ticker is invisible \u2014 just fires callbacks.'}
            </Text>
            <Box style={{ paddingTop: 4 }}>
              <CodeBlock language="tsx" fontSize={8} code={WIDGET_CODE} />
            </Box>
          </Box>
        </Box>

        <Divider />

        {/* ── Band: text | demo — Stopwatch ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="timer">{'STOPWATCH'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Lua-driven elapsed timer with start, stop, reset, and restart. Accumulates dt in the Love2D update loop \u2014 immune to JS garbage collection pauses.'}
            </Text>
            <Box style={{ paddingTop: 4 }}>
              <CodeBlock language="tsx" fontSize={8} code={STOPWATCH_CODE} />
            </Box>
          </Box>
          <Box style={{ flexBasis: 0, flexGrow: 1, justifyContent: 'center' }}>
            <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 14 }}>
              <StopwatchDemo />
            </Box>
          </Box>
        </Box>

        <Divider />

        {/* ── Callout band ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'All timing hooks (useStopwatch, useCountdown, useOnTime, useInterval, useFrameInterval) run in Lua\u2019s update loop. Time-based hooks fire in the exact frame that crosses the threshold. useFrameInterval counts frames directly \u2014 no JS event-loop jitter either way.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band: demo | text — Countdown (zigzag) ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <Box style={{ flexBasis: 0, flexGrow: 1, justifyContent: 'center' }}>
            <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 14 }}>
              <CountdownDemo />
            </Box>
          </Box>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="hourglass">{'COUNTDOWN'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Count down from a duration in milliseconds. Tracks remaining time, progress (0\u20131), and fires onComplete when it hits zero. Progress bar turns red below 3 seconds.'}
            </Text>
            <Box style={{ paddingTop: 4 }}>
              <CodeBlock language="tsx" fontSize={8} code={COUNTDOWN_CODE} />
            </Box>
          </Box>
        </Box>

        <Divider />

        {/* ── Band: text | demo — Scheduling ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="zap">{'SCHEDULING'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'useOnTime fires once after a delay. useInterval repeats. Both run frame-perfect in Lua \u2014 not the JS event loop. Use for audio cues, game events, or data polling.'}
            </Text>
            <Box style={{ paddingTop: 4 }}>
              <CodeBlock language="tsx" fontSize={8} code={SCHEDULING_CODE} />
            </Box>
          </Box>
          <Box style={{ flexBasis: 0, flexGrow: 1, justifyContent: 'center' }}>
            <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 14, gap: 12 }}>
              <Text style={{ color: c.muted, fontSize: 9 }}>{'useInterval \u2014 pick a rate:'}</Text>
              <IntervalDemo />
            </Box>
          </Box>
        </Box>

        <Divider />

        {/* ── Band: demo | text — Frame Interval (zigzag) ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <Box style={{ flexBasis: 0, flexGrow: 1, justifyContent: 'center' }}>
            <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 14, gap: 12 }}>
              <Text style={{ color: c.muted, fontSize: 9 }}>{'useFrameInterval \u2014 pick a cadence:'}</Text>
              <FrameIntervalDemo />
            </Box>
          </Box>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="film">{'FRAME INTERVAL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Count rendered frames instead of wall-clock time. useFrameInterval fires every N Love2D frames \u2014 stays locked to the render loop even when the framerate drops. Use for animation steps, physics ticks, or any logic that should be frame-synced.'}
            </Text>
            <Box style={{ paddingTop: 4 }}>
              <CodeBlock language="tsx" fontSize={8} code={FRAME_INTERVAL_CODE} />
            </Box>
          </Box>
        </Box>

        <Divider />

        {/* ── Band: demo | text — Utilities (zigzag) ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 24,
          gap: 24,
          alignItems: 'center',
        }}>
          <Box style={{ flexBasis: 0, flexGrow: 1, justifyContent: 'center' }}>
            <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12 }}>
              <UtilsDemo />
            </Box>
          </Box>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="code">{'UTILITIES'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Pure functions \u2014 no hooks, no bridge. Format durations, parse time strings, do date arithmetic, check day boundaries. Works anywhere.'}
            </Text>
            <Box style={{ paddingTop: 4 }}>
              <CodeBlock language="tsx" fontSize={8} code={UTILS_CODE} />
            </Box>
          </Box>
        </Box>

      </ScrollView>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Packages'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="clock" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Time'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
