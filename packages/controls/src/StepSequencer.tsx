import React from 'react';
import type { Style, Color } from '@ilovereact/core';
import { Box, Text, Pressable } from '@ilovereact/core';
import { useRendererMode } from '@ilovereact/core';
import { useScaledStyle, useScale } from '@ilovereact/core';

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

const DEFAULT_COLORS: string[] = [
  '#6366f1', '#22c55e', '#f59e0b', '#ec4899',
  '#06b6d4', '#ef4444', '#8b5cf6', '#14b8a6',
];

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
  const mode = useRendererMode();
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);

  const scaledStep = Math.round(stepSize * scale);
  const gap = Math.round(2 * scale);
  const labelWidth = Math.round(40 * scale);

  // Common rendering — same structure for both modes since we use framework primitives
  return (
    <Box
      style={{
        gap: gap,
        ...scaledStyle,
      }}
    >
      {Array.from({ length: tracks }, (_, track) => {
        const trackColor = ((trackColors?.[track] ?? DEFAULT_COLORS[track % DEFAULT_COLORS.length]) as string);
        const trackLabel = trackLabels?.[track] ?? `T${track + 1}`;

        return (
          <Box
            key={track}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: gap,
            }}
          >
            <Box style={{ width: labelWidth }}>
              <Text
                style={{
                  color: trackColor,
                  fontSize: Math.round(9 * scale),
                  fontWeight: '700',
                }}
              >
                {trackLabel}
              </Text>
            </Box>
            {Array.from({ length: steps }, (_, step) => {
              const isActive = pattern?.[track]?.[step] ?? false;
              const isCurrent = currentStep === step;
              const isBeat = step % 4 === 0;

              return (
                <Pressable
                  key={step}
                  onPress={() => onStepToggle?.(track, step, !isActive)}
                  style={({ hovered }) => ({
                    width: scaledStep,
                    height: scaledStep,
                    borderRadius: Math.round(3 * scale),
                    backgroundColor: isActive
                      ? isCurrent ? '#fbbf24' : trackColor
                      : isCurrent
                        ? '#fbbf2440'
                        : hovered ? '#2a2a2a' : '#1e2030',
                    borderWidth: 1,
                    borderColor: isCurrent
                      ? '#fbbf24'
                      : isBeat ? '#2e3348' : 'transparent',
                    alignItems: 'center' as const,
                    justifyContent: 'center' as const,
                  })}
                >
                  {isBeat && !isActive ? (
                    <Box
                      style={{
                        width: Math.round(3 * scale),
                        height: Math.round(3 * scale),
                        borderRadius: Math.round(2 * scale),
                        backgroundColor: '#2e3348',
                      }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}
