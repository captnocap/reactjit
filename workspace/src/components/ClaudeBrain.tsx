/**
 * ClaudeBrain — animated brain visualization that reflects Vesper's mood.
 *
 * Sunburst hue, saturation, and lightness all shift smoothly based on
 * claude.status. Colors lerp via a 30fps interval so transitions feel alive
 * rather than instant.
 *
 * Mood palette:
 *   idle               → deep blue      (0.62 hue)
 *   thinking           → amber/orange   (0.09 hue)
 *   running            → phosphor green (0.35 hue)
 *   waiting_permission → alert red      (0.01 hue)
 *   stopped            → slate blue     (0.64 hue, dimmed)
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useLuaInterval } from '@reactjit/core';
import { Box, Pressable, Sunburst, Constellation, Scanlines } from '@reactjit/core';
import type { Style } from '@reactjit/core';

// ── Activity level per status ────────────────────────────────────────

const MODE_ACTIVITY: Record<string, number> = {
  idle:               0.15,
  splash:             0.10,
  thinking:           0.60,
  streaming:          0.90,
  running:            0.80,
  permission:         0.40,
  waiting_permission: 0.40,
  active:             1.0,
};

// ── Mood palette ─────────────────────────────────────────────────────

interface MoodColor { hue: number; sat: number; light: number }

const MOOD: Record<string, MoodColor> = {
  idle:               { hue: 0.62, sat: 0.55, light: 0.55 },
  splash:             { hue: 0.62, sat: 0.50, light: 0.52 },
  thinking:           { hue: 0.09, sat: 0.78, light: 0.62 },
  running:            { hue: 0.35, sat: 0.72, light: 0.60 },
  streaming:          { hue: 0.32, sat: 0.76, light: 0.65 },
  waiting_permission: { hue: 0.01, sat: 0.88, light: 0.58 },
  permission:         { hue: 0.01, sat: 0.88, light: 0.58 },
  stopped:            { hue: 0.64, sat: 0.38, light: 0.42 },
  active:             { hue: 0.46, sat: 0.82, light: 0.70 }, // clicked
};

const DEFAULT_MOOD: MoodColor = MOOD.idle;

// ── Hue lerp (shortest arc, wraps 0-1) ──────────────────────────────

function lerpHue(a: number, b: number, t: number): number {
  let d = b - a;
  if (d >  0.5) d -= 1.0;
  if (d < -0.5) d += 1.0;
  return (a + d * t + 1.0) % 1.0;
}

function lerpLinear(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── Smooth color state hook ──────────────────────────────────────────

function useSmoothMood(status: string, clicked: boolean): MoodColor {
  const targetKey  = clicked ? 'active' : status;
  const target     = MOOD[targetKey] ?? DEFAULT_MOOD;

  const hueRef   = useRef(target.hue);
  const satRef   = useRef(target.sat);
  const lightRef = useRef(target.light);

  const [color, setColor] = useState<MoodColor>({ ...target });

  // Update target on status/clicked change — lerp effect does the rest
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = MOOD[clicked ? 'active' : status] ?? DEFAULT_MOOD;
  }, [status, clicked]);

  // 30fps lerp toward target
  useLuaInterval(33, () => {
    const t = targetRef.current;
    const SPEED = 0.07;

    const newHue   = lerpHue(hueRef.current, t.hue, SPEED);
    const newSat   = lerpLinear(satRef.current, t.sat, SPEED);
    const newLight = lerpLinear(lightRef.current, t.light, SPEED);

    hueRef.current   = newHue;
    satRef.current   = newSat;
    lightRef.current = newLight;

    setColor({ hue: newHue, sat: newSat, light: newLight });
  });

  return color;
}

// ── Component ────────────────────────────────────────────────────────

function clamp(x: number, lo: number, hi: number) {
  return x < lo ? lo : x > hi ? hi : x;
}

interface Props {
  status?: string;
  style?: Style;
}

export function ClaudeBrain({ status = 'idle', style }: Props) {
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);

  const base     = MODE_ACTIVITY[status] ?? 0.15;
  const hover    = hovered ? 0.3 : 0;
  const activity = clamp(clicked ? 1.0 : base + hover, 0, 1);
  const modeKey  = clicked ? 'active' : status;

  const color = useSmoothMood(status, clicked);

  const handleHoverIn  = useCallback(() => setHovered(true), []);
  const handleHoverOut = useCallback(() => { setHovered(false); setClicked(false); }, []);
  const handlePress    = useCallback(() => setClicked(c => !c), []);

  return (
    <Pressable
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      onPress={handlePress}
      style={{ aspectRatio: 1, ...style }}
    >
      <Box style={{ flexGrow: 1, backgroundColor: '#020209', borderRadius: 8, overflow: 'hidden' }}>
        <Constellation background speed={0.15 + activity * 0.3} decay={0.02} amplitude={activity * 0.6} />
        <Sunburst
          activity={activity}
          mode={modeKey}
          hue={color.hue}
          saturation={color.sat}
          lightness={color.light}
          transparent
          style={{ flexGrow: 1 }}
        />
        <Scanlines mask intensity={0.08 + activity * 0.07} spacing={3} />
      </Box>
    </Pressable>
  );
}
