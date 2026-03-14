import React from 'react';
import { Box, Text } from '@reactjit/core';
import type { Style } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';

export interface HueLightBadgeProps {
  name: string;
  on: boolean;
  /** Hex color of the light, e.g. from hueXYToHex() */
  color?: string;
  /** 0–1 brightness */
  brightness?: number;
  style?: Style;
}

/**
 * Philips Hue (or any smart light) state badge. The dot is the actual
 * light color — this is a design choice, not a theme token.
 *
 * ```tsx
 * lights.map(l => (
 *   <HueLightBadge key={l.id} name={l.name} on={l.state.on} color={hueXYToHex(l.state.xy, l.state.bri)} brightness={l.state.bri / 254} />
 * ))
 * ```
 */
export function HueLightBadge({
  name,
  on,
  color = '#fbbf24',
  brightness,
  style,
}: HueLightBadgeProps) {
  const c = useThemeColors();
  const displayColor = on ? color : '#4b5563';
  const glowOpacity = on ? '40' : '00';

  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, ...style }}>
      {/* Light orb */}
      <Box style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
        {/* Glow ring */}
        <Box style={{
          position: 'absolute',
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: displayColor + glowOpacity,
        }} />
        {/* Dot */}
        <Box style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: displayColor,
        }} />
      </Box>

      {/* Label + brightness */}
      <Box style={{ flexGrow: 1 }}>
        <Text style={{ color: on ? c.text : c.muted, fontSize: 12 }}>{name}</Text>
        {brightness !== undefined && on && (
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            {/* Mini brightness bar — 10 segments */}
            {Array.from({ length: 10 }, (_, i) => (
              <Box
                key={i}
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: i < Math.round(brightness * 10)
                    ? displayColor
                    : c.surface,
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* On/off status */}
      <Text style={{ color: on ? displayColor : c.muted, fontSize: 10, fontWeight: 'bold' }}>
        {on ? 'ON' : 'OFF'}
      </Text>
    </Box>
  );
}
