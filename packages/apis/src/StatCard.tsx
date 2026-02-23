import React from 'react';
import { Box, Text } from '@reactjit/core';
import type { Style, Color } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';

export interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  /** Positive = up trend, negative = down trend */
  trend?: number;
  accent?: Color;
  style?: Style;
}

/**
 * Generic metric display — one big number with a label and optional trend.
 * Headless container (takes any `style`). Use for YNAB balances, GitHub stats,
 * Steam playtime, anything that's "a number that matters."
 *
 * ```tsx
 * <StatCard label="Stars" value="12.4k" trend={5.2} accent="#f59e0b" />
 * <StatCard label="Balance" value={ynabAmount(account.balance)} sublabel="checking" />
 * ```
 */
export function StatCard({
  label,
  value,
  sublabel,
  trend,
  accent = '#6366f1',
  style,
}: StatCardProps) {
  const c = useThemeColors();
  const accentStr = accent as string;
  const hasTrend = trend !== undefined;
  const trendUp = hasTrend && trend! >= 0;
  const trendColor = trendUp ? '#22c55e' : '#ef4444';

  return (
    <Box style={{ gap: 4, ...style }}>
      <Text style={{ color: c.muted, fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
      <Box style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <Text style={{ color: c.text, fontSize: 28, fontWeight: 'bold', lineHeight: 32 }}>
          {String(value)}
        </Text>
        {hasTrend && (
          <Box style={{ marginBottom: 4 }}>
            {/* Trend arrow — up triangle or down triangle */}
            <Box style={{
              width: 0,
              height: 0,
              borderLeftWidth: 4,
              borderRightWidth: 4,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              ...(trendUp
                ? { borderBottomWidth: 6, borderBottomColor: trendColor }
                : { borderTopWidth: 6, borderTopColor: trendColor }
              ),
            }} />
          </Box>
        )}
      </Box>
      {(sublabel || hasTrend) && (
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {sublabel && (
            <Text style={{ color: c.muted, fontSize: 11 }}>{sublabel}</Text>
          )}
          {hasTrend && (
            <Text style={{ color: trendColor, fontSize: 11, fontWeight: 'bold' }}>
              {trendUp ? '+' : ''}{trend!.toFixed(1)}%
            </Text>
          )}
        </Box>
      )}
      {/* Accent underline */}
      <Box style={{ width: 24, height: 2, backgroundColor: accentStr, borderRadius: 1, marginTop: 2 }} />
    </Box>
  );
}
