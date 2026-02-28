/**
 * StepSequencer — Lua-owned interactive step sequencer grid.
 *
 * All drawing, hit testing, and drag-to-paint handled in lua/step_sequencer.lua.
 * React is a declarative wrapper that passes props and receives boundary events
 * (onStepToggle).
 */

import React from 'react';
import type { Style, Color } from '@reactjit/core';
import { useScaledStyle, useScale } from '@reactjit/core';

export interface StepSequencerProps {
  steps?: number;
  tracks?: number;
  pattern: boolean[][];
  currentStep?: number;
  onStepToggle?: (track: number, step: number, active: boolean) => void;
  trackLabels?: string[];
  trackColors?: Color[];
  stepSize?: number;
  style?: Style;
}

export function StepSequencer({
  steps = 16,
  tracks = 1,
  pattern,
  currentStep,
  onStepToggle,
  trackLabels,
  trackColors,
  stepSize = 24,
  style,
}: StepSequencerProps) {
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);

  const scaledStep = Math.round(stepSize * scale);
  const gap = Math.round(2 * scale);
  const labelWidth = Math.round(40 * scale);

  // Compute total dimensions for layout
  const totalW = labelWidth + gap + steps * (scaledStep + gap) - gap;
  const totalH = tracks * (scaledStep + gap) - gap;

  // ── Native mode: Lua-owned host element ──────────────────
  // All drawing, hit testing, and drag-to-paint handled in lua/step_sequencer.lua.
  // React only receives onStepToggle via buffered events.
  return React.createElement('StepSequencer', {
    steps,
    tracks,
    pattern: JSON.stringify(pattern),
    currentStep,
    trackLabels: trackLabels ? JSON.stringify(trackLabels) : undefined,
    trackColors: trackColors ? JSON.stringify(trackColors) : undefined,
    stepSize: scaledStep,
    labelWidth,
    gap,
    onStepToggle: onStepToggle
      ? (e: any) => {
          const v = e.value ?? e;
          onStepToggle(v.track, v.step, v.active);
        }
      : undefined,
    style: {
      width: totalW,
      height: totalH,
      ...scaledStyle,
    },
  });
}
