/**
 * Time — Package documentation page (Layout2 zigzag narrative).
 *
 * Showcases: Clock, Stopwatch, Countdown, Ticker widgets + hooks + utilities.
 * Live demos sit on the "code" side of zigzag bands — widgets are visual,
 * so showing them running is better than showing a CodeBlock.
 */

import React, { useState } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, classifiers as S} from '../../../packages/core/src';
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
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn } from './_shared/StoryScaffold';

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

const STOPWATCH_OPTIONS = { tickRate: 50 };
const COUNTDOWN_OPTIONS = { tickRate: 50 };

// ── Helpers ──────────────────────────────────────────────

function Divider() {
  const c = useThemeColors();
  return <S.StoryDivider />;
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  const c = useThemeColors();
  return (
    <S.RowCenterG6>
      <S.StorySectionIcon src={icon} tintColor={C.accent} />
      <S.StoryLabelText>
        {children}
      </S.StoryLabelText>
    </S.RowCenterG6>
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
          <S.StoryTiny>{'Tokyo'}</S.StoryTiny>
          <Clock timezone="Asia/Tokyo" textStyle={{ fontSize: 12, color: C.teal }} />
        </Box>
        <Box style={{ gap: 2 }}>
          <S.StoryTiny>{'New York'}</S.StoryTiny>
          <Clock timezone="America/New_York" textStyle={{ fontSize: 12, color: C.teal }} />
        </Box>
        <Box style={{ gap: 2 }}>
          <S.StoryTiny>{'London'}</S.StoryTiny>
          <Clock timezone="Europe/London" textStyle={{ fontSize: 12, color: C.teal }} />
        </Box>
      </Box>
    </Box>
  );
}

function StopwatchDemo() {
  const c = useThemeColors();
  const sw = useStopwatch(STOPWATCH_OPTIONS);

  return (
    <Box style={{ gap: 10 }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', color: sw.running ? C.green : c.text, letterSpacing: 2 }}>
        {formatDuration(sw.elapsed, { ms: true })}
      </Text>
      <S.StoryCap>{formatDurationLong(sw.elapsed)}</S.StoryCap>
      <S.RowG6>
        {!sw.running ? (
          <Pressable onPress={sw.start} style={{ backgroundColor: C.green, borderRadius: 5, paddingTop: 5, paddingBottom: 5, paddingLeft: 12, paddingRight: 12 }}>
            <S.StoryBtnText style={{ color: '#000' }}>{'Start'}</S.StoryBtnText>
          </Pressable>
        ) : (
          <Pressable onPress={sw.stop} style={{ backgroundColor: C.orange, borderRadius: 5, paddingTop: 5, paddingBottom: 5, paddingLeft: 12, paddingRight: 12 }}>
            <S.StoryBtnText style={{ color: '#000' }}>{'Stop'}</S.StoryBtnText>
          </Pressable>
        )}
        <Pressable onPress={sw.reset} style={{ backgroundColor: C.dim, borderRadius: 5, paddingTop: 5, paddingBottom: 5, paddingLeft: 12, paddingRight: 12 }}>
          <S.StoryBody>{'Reset'}</S.StoryBody>
        </Pressable>
      </S.RowG6>
    </Box>
  );
}

function CountdownDemo() {
  const c = useThemeColors();
  const cd = useCountdown(15_000, COUNTDOWN_OPTIONS);
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
      <S.StoryCap>
        {`${(cd.progress * 100).toFixed(1)}% elapsed`}
      </S.StoryCap>
      <S.RowG6>
        {!cd.running ? (
          <Pressable onPress={cd.start} style={{ backgroundColor: C.green, borderRadius: 5, paddingTop: 5, paddingBottom: 5, paddingLeft: 12, paddingRight: 12 }}>
            <S.StoryBtnText style={{ color: '#000' }}>{'Start'}</S.StoryBtnText>
          </Pressable>
        ) : (
          <Pressable onPress={cd.stop} style={{ backgroundColor: C.orange, borderRadius: 5, paddingTop: 5, paddingBottom: 5, paddingLeft: 12, paddingRight: 12 }}>
            <S.StoryBtnText style={{ color: '#000' }}>{'Pause'}</S.StoryBtnText>
          </Pressable>
        )}
        <Pressable onPress={cd.restart} style={{ backgroundColor: C.blue, borderRadius: 5, paddingTop: 5, paddingBottom: 5, paddingLeft: 12, paddingRight: 12 }}>
          <S.StoryBtnText style={{ color: '#000' }}>{'Restart'}</S.StoryBtnText>
        </Pressable>
      </S.RowG6>
    </Box>
  );
}

function TickerDemo() {
  const c = useThemeColors();
  const [ticks, setTicks] = useState(0);

  return (
    <Box style={{ gap: 6 }}>
      <Ticker interval={500} onTick={() => setTicks(n => n + 1)} />
      <S.RowCenterG8>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ticks % 2 === 0 ? C.accent : c.muted }} />
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: C.accent }}>{String(ticks)}</Text>
        <S.StoryMuted>{'ticks @ 500ms'}</S.StoryMuted>
      </S.RowCenterG8>
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
      <S.RowCenterG12>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: C.accent }}>{String(count)}</Text>
        <S.StoryMuted>{'ticks'}</S.StoryMuted>
      </S.RowCenterG12>
      <S.RowG6>
        {[250, 500, 1000, 2000].map(ms => (
          <Pressable
            key={ms}
            onPress={() => setRate(ms)}
            style={{ backgroundColor: rate === ms ? C.accent : C.dim, borderRadius: 5, paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8 }}
          >
            <Text style={{ fontSize: 9, color: rate === ms ? '#000' : c.text }}>{`${ms}ms`}</Text>
          </Pressable>
        ))}
      </S.RowG6>
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
      <S.RowCenterG12>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: C.teal }}>{String(frameCount)}</Text>
        <S.StoryMuted>{'fires'}</S.StoryMuted>
      </S.RowCenterG12>
      <S.RowG6>
        {[1, 10, 60, 120].map(n => (
          <Pressable
            key={n}
            onPress={() => { setEvery(n); setFrameCount(0); }}
            style={{ backgroundColor: every === n ? C.teal : C.dim, borderRadius: 5, paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8 }}
          >
            <Text style={{ fontSize: 9, color: every === n ? '#000' : c.text }}>{`${n}f`}</Text>
          </Pressable>
        ))}
      </S.RowG6>
      <S.StoryTiny>{`every ${every} frame${every > 1 ? 's' : ''} \u2248 ${(every / 60).toFixed(1)}s at 60fps`}</S.StoryTiny>
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
          <S.StoryCap style={{ flexShrink: 1 }}>{expr}</S.StoryCap>
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
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="clock" tintColor={C.accent} />
        <S.StoryTitle>
          {'Time'}
        </S.StoryTitle>
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
        <S.StoryMuted>
          {'Clocks, stopwatches, countdowns, scheduling, and date utilities'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        <PageColumn>
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
          <S.StoryHeadline>
            {'Frame-accurate time for everything.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'Drop-in widgets for clocks and timers. Hooks that run in Lua\u2019s update loop for precision scheduling. Pure utilities for formatting, parsing, and date math \u2014 no bridge required.'}
          </S.StoryMuted>
        </Box>

        <Divider />

        {/* ── Band: text | code — Install ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <S.StoryBody>
              {'Everything in one import \u2014 widgets, hooks, and pure utilities. Pick what you need.'}
            </S.StoryBody>
          </S.HalfCenter>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
        </S.RowCenter>

        <Divider />

        {/* ── Band: demo | text — Widgets (zigzag) ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <S.HalfCenter>
            <S.StoryWell>
              <WorldClockDemo />
              <S.HorzDivider />
              <TickerDemo />
            </S.StoryWell>
          </S.HalfCenter>
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="clock">{'WIDGETS'}</SectionLabel>
            <S.StoryBody>
              {'One-liner components \u2014 no hooks, no wiring. Clock shows local or any IANA timezone. Stopwatch and Countdown have built-in controls. Ticker is invisible \u2014 just fires callbacks.'}
            </S.StoryBody>
            <Box style={{ paddingTop: 4 }}>
              <CodeBlock language="tsx" fontSize={8} code={WIDGET_CODE} />
            </Box>
          </S.HalfCenter>
        </S.RowCenter>

        <Divider />

        {/* ── Band: text | demo — Stopwatch ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="timer">{'STOPWATCH'}</SectionLabel>
            <S.StoryBody>
              {'Lua-driven elapsed timer with start, stop, reset, and restart. Accumulates dt in the Love2D update loop \u2014 immune to JS garbage collection pauses.'}
            </S.StoryBody>
            <Box style={{ paddingTop: 4 }}>
              <CodeBlock language="tsx" fontSize={8} code={STOPWATCH_CODE} />
            </Box>
          </S.HalfCenter>
          <S.HalfCenter>
            <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 14 }}>
              <StopwatchDemo />
            </Box>
          </S.HalfCenter>
        </S.RowCenter>

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
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'All timing hooks (useStopwatch, useCountdown, useOnTime, useInterval, useFrameInterval) run in Lua\u2019s update loop. Time-based hooks fire in the exact frame that crosses the threshold. useFrameInterval counts frames directly \u2014 no JS event-loop jitter either way.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── Band: demo | text — Countdown (zigzag) ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <S.HalfCenter>
            <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 14 }}>
              <CountdownDemo />
            </Box>
          </S.HalfCenter>
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="hourglass">{'COUNTDOWN'}</SectionLabel>
            <S.StoryBody>
              {'Count down from a duration in milliseconds. Tracks remaining time, progress (0\u20131), and fires onComplete when it hits zero. Progress bar turns red below 3 seconds.'}
            </S.StoryBody>
            <Box style={{ paddingTop: 4 }}>
              <CodeBlock language="tsx" fontSize={8} code={COUNTDOWN_CODE} />
            </Box>
          </S.HalfCenter>
        </S.RowCenter>

        <Divider />

        {/* ── Band: text | demo — Scheduling ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="zap">{'SCHEDULING'}</SectionLabel>
            <S.StoryBody>
              {'useOnTime fires once after a delay. useInterval repeats. Both run frame-perfect in Lua \u2014 not the JS event loop. Use for audio cues, game events, or data polling.'}
            </S.StoryBody>
            <Box style={{ paddingTop: 4 }}>
              <CodeBlock language="tsx" fontSize={8} code={SCHEDULING_CODE} />
            </Box>
          </S.HalfCenter>
          <S.HalfCenter>
            <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 14, gap: 12 }}>
              <S.StoryCap>{'useInterval \u2014 pick a rate:'}</S.StoryCap>
              <IntervalDemo />
            </Box>
          </S.HalfCenter>
        </S.RowCenter>

        <Divider />

        {/* ── Band: demo | text — Frame Interval (zigzag) ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <S.HalfCenter>
            <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 14, gap: 12 }}>
              <S.StoryCap>{'useFrameInterval \u2014 pick a cadence:'}</S.StoryCap>
              <FrameIntervalDemo />
            </Box>
          </S.HalfCenter>
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="film">{'FRAME INTERVAL'}</SectionLabel>
            <S.StoryBody>
              {'Count rendered frames instead of wall-clock time. useFrameInterval fires every N Love2D frames \u2014 stays locked to the render loop even when the framerate drops. Use for animation steps, physics ticks, or any logic that should be frame-synced.'}
            </S.StoryBody>
            <Box style={{ paddingTop: 4 }}>
              <CodeBlock language="tsx" fontSize={8} code={FRAME_INTERVAL_CODE} />
            </Box>
          </S.HalfCenter>
        </S.RowCenter>

        <Divider />

        {/* ── Band: demo | text — Utilities (zigzag) ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 24, gap: 24 }}>
          <S.HalfCenter>
            <Box style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 12 }}>
              <UtilsDemo />
            </Box>
          </S.HalfCenter>
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="code">{'UTILITIES'}</SectionLabel>
            <S.StoryBody>
              {'Pure functions \u2014 no hooks, no bridge. Format durations, parse time strings, do date arithmetic, check day boundaries. Works anywhere.'}
            </S.StoryBody>
            <Box style={{ paddingTop: 4 }}>
              <CodeBlock language="tsx" fontSize={8} code={UTILS_CODE} />
            </Box>
          </S.HalfCenter>
        </S.RowCenter>

        </PageColumn>
      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="clock" />
        <S.StoryBreadcrumbActive>{'Time'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
