/**
 * @reactjit/time — Drop-in widgets.
 *
 * Self-contained components — bring their own hooks and controls.
 * One import, one line, done.
 *
 *   <Clock />
 *   <Clock timezone="America/New_York" format="time" />
 *   <Stopwatch autoStart />
 *   <Countdown duration={30_000} autoStart onComplete={save} />
 *   <Ticker interval={1000} onTick={step} />
 */

import React from 'react';
import { Box, Text, Pressable } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';
import { useTime, useStopwatch, useCountdown, useInterval, useFrameInterval } from './hooks';
import {
  formatDuration,
  formatDate,
  formatTimeOfDay,
  formatDateOnly,
} from './utils';
import type { Style } from '@reactjit/core';

// ── Clock ─────────────────────────────────────────────────────────────────────

export interface ClockProps {
  /** What to display. Default: 'time'. */
  format?: 'time' | 'date' | 'datetime';
  /** IANA timezone (e.g. 'America/New_York'). Default: local. */
  timezone?: string;
  /** Update rate in ms. Default: 1000. */
  rateMs?: number;
  style?: Style;
  textStyle?: Style;
}

/**
 * Live clock. Drops in anywhere — no state, no setup.
 *
 * @example
 * <Clock />
 * <Clock format="datetime" timezone="Asia/Tokyo" />
 */
export function Clock({ format = 'time', timezone, rateMs = 1000, style, textStyle }: ClockProps) {
  const c   = useThemeColors();
  const now = useTime(rateMs);
  const tzOpts = timezone ? { timezone } : undefined;

  let display: string;
  if (format === 'date')     display = formatDateOnly(now, tzOpts);
  else if (format === 'datetime') display = formatDate(now, tzOpts);
  else                       display = formatTimeOfDay(now, tzOpts);

  return (
    <Box style={style}>
      <Text style={{ fontSize: 16, color: c.text, fontVariant: 'tabular-nums', ...textStyle }}>
        {display}
      </Text>
    </Box>
  );
}

// ── Stopwatch ─────────────────────────────────────────────────────────────────

export interface StopwatchProps {
  /** Start immediately on mount. Default: false. */
  autoStart?: boolean;
  /** Show start/stop/reset buttons. Default: true. */
  controls?: boolean;
  /** Show milliseconds. Default: false. */
  showMs?: boolean;
  /** Fires every tickRate ms with current elapsed (ms). */
  onTick?: (elapsed: number) => void;
  style?: Style;
  textStyle?: Style;
}

/**
 * Self-contained stopwatch with optional controls.
 *
 * @example
 * <Stopwatch autoStart />
 * <Stopwatch showMs onTick={ms => save(ms)} />
 * <Stopwatch controls={false} />   // display only
 */
export function Stopwatch({ autoStart = false, controls = true, showMs = false, onTick, style, textStyle }: StopwatchProps) {
  const c  = useThemeColors();
  const sw = useStopwatch({ autoStart, tickRate: showMs ? 50 : 100 });

  // forward ticks to caller
  const prevElapsed = React.useRef(sw.elapsed);
  if (sw.running && sw.elapsed !== prevElapsed.current) {
    prevElapsed.current = sw.elapsed;
    onTick?.(sw.elapsed);
  }

  return (
    <Box style={{ gap: 8, alignItems: 'flex-start', ...style }}>
      <Text style={{
        fontSize: 24,
        color: sw.running ? c.primary : c.text,
        fontVariant: 'tabular-nums',
        ...textStyle,
      }}>
        {formatDuration(sw.elapsed, { ms: showMs })}
      </Text>
      {controls && (
        <Box style={{ flexDirection: 'row', gap: 6 }}>
          {!sw.running
            ? <Btn label="Start"   onPress={sw.start}   color={c.primary} />
            : <Btn label="Stop"    onPress={sw.stop}    color="#f87171" />}
          <Btn label="Reset"   onPress={sw.reset}   color={c.border} />
        </Box>
      )}
    </Box>
  );
}

// ── Countdown ─────────────────────────────────────────────────────────────────

export interface CountdownProps {
  /** Duration in milliseconds. */
  duration: number;
  /** Start immediately on mount. Default: false. */
  autoStart?: boolean;
  /** Show start/stop/restart buttons. Default: true. */
  controls?: boolean;
  /** Show a progress bar. Default: true. */
  showBar?: boolean;
  /** Show milliseconds. Default: false. */
  showMs?: boolean;
  /** Fires when the countdown reaches zero. */
  onComplete?: () => void;
  style?: Style;
  textStyle?: Style;
}

/**
 * Self-contained countdown with progress bar and controls.
 *
 * @example
 * <Countdown duration={30_000} autoStart onComplete={() => setDone(true)} />
 * <Countdown duration={5_000} showMs controls={false} />
 */
export function Countdown({ duration, autoStart = false, controls = true, showBar = true, showMs = false, onComplete, style, textStyle }: CountdownProps) {
  const c  = useThemeColors();
  const cd = useCountdown(duration, { autoStart, tickRate: showMs ? 50 : 100, onComplete });

  const barColor = cd.complete
    ? c.primary
    : cd.remaining < duration * 0.2 ? '#f87171' : c.primary;

  return (
    <Box style={{ gap: 8, alignItems: 'flex-start', ...style }}>
      <Text style={{
        fontSize: 24,
        color: cd.complete ? c.primary : c.text,
        fontVariant: 'tabular-nums',
        ...textStyle,
      }}>
        {cd.complete ? 'Done' : formatDuration(cd.remaining, { ms: showMs })}
      </Text>
      {showBar && (
        <Box style={{ width: '100%', height: 4, backgroundColor: c.border, borderRadius: 2 }}>
          <Box style={{
            width: `${(1 - cd.progress) * 100}%`,
            height: 4,
            backgroundColor: barColor,
            borderRadius: 2,
          }} />
        </Box>
      )}
      {controls && (
        <Box style={{ flexDirection: 'row', gap: 6 }}>
          {!cd.running
            ? <Btn label={cd.complete ? 'Restart' : 'Start'} onPress={cd.complete ? cd.restart : cd.start} color={c.primary} />
            : <Btn label="Pause" onPress={cd.stop} color="#f87171" />}
          <Btn label="Reset" onPress={cd.reset} color={c.border} />
        </Box>
      )}
    </Box>
  );
}

// ── Ticker ────────────────────────────────────────────────────────────────────

export interface TickerProps {
  /** Interval in milliseconds. */
  interval: number;
  /** Fires every interval — use this for side effects, not display. */
  onTick: () => void;
}

/**
 * Invisible Lua-driven tick machine. Renders nothing.
 * The right tool when you need a repeating side effect without a visible widget.
 *
 * @example
 * <Ticker interval={5000} onTick={refreshData} />
 * <Ticker interval={1000 / 60} onTick={step} />   // 60fps game tick
 */
export function Ticker({ interval, onTick }: TickerProps) {
  useInterval(onTick, interval);
  return null;
}

// ── FrameTicker ────────────────────────────────────────────────────────

export interface FrameTickerProps {
  /** Fire every N frames. Default: 1 (every frame). */
  frames: number;
  /** Fires every N frames — use this for frame-synced side effects. */
  onTick: () => void;
}

/**
 * Invisible frame-driven tick machine. Like Ticker but counts frames
 * instead of wall-clock time. Renders nothing.
 *
 * @example
 * <FrameTicker frames={100} onTick={stepSimulation} />
 * <FrameTicker frames={1} onTick={updateParticles} />
 */
export function FrameTicker({ frames, onTick }: FrameTickerProps) {
  useFrameInterval(onTick, frames);
  return null;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function Btn({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: color,
        borderRadius: 5,
        paddingTop: 4,
        paddingBottom: 4,
        paddingLeft: 10,
        paddingRight: 10,
      }}
    >
      <Text style={{ fontSize: 11, color: c.text }}>{label}</Text>
    </Pressable>
  );
}
