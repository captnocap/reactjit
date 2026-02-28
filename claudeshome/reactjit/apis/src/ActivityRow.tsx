import React from 'react';
import { Box, Text } from '@reactjit/core';
import type { Style, Color } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';

export interface ActivityRowProps {
  /** Color of the left dot indicator */
  dot?: Color;
  /** Main event label */
  label: string;
  /** Relative or absolute time string, e.g. "2h ago" */
  time?: string;
  /** Secondary detail text */
  detail?: string;
  style?: Style;
}

/**
 * Single activity / timeline row with a colored dot, label, time, and optional
 * detail. Compose into a list for GitHub events, Trakt history, Todoist tasks,
 * YNAB transactions — anything feed-shaped.
 *
 * ```tsx
 * events.map(e => (
 *   <ActivityRow key={e.id} dot="#6366f1" label={e.label} time={e.timeAgo} detail={e.repo} />
 * ))
 * ```
 */
export function ActivityRow({
  dot = '#6366f1',
  label,
  time,
  detail,
  style,
}: ActivityRowProps) {
  const c = useThemeColors();
  const dotColor = dot as string;

  return (
    <Box style={{ flexDirection: 'row', alignItems: 'stretch', gap: 10, width: '100%', ...style }}>
      {/* Dot + vertical connector track */}
      <Box style={{ alignItems: 'center', paddingTop: 4, flexShrink: 0 }}>
        <Box style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: dotColor,
        }} />
      </Box>

      {/* Content */}
      <Box style={{ flexGrow: 1, gap: 2 }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Text style={{ color: c.text, fontSize: 12 }}>{label}</Text>
          {time && (
            <Text style={{ color: c.muted, fontSize: 10 }}>{time}</Text>
          )}
        </Box>
        {detail && (
          <Text style={{ color: c.muted, fontSize: 11 }}>{detail}</Text>
        )}
      </Box>
    </Box>
  );
}
