import React from 'react';
import { Box, Text, Sparkline } from '@reactjit/core';
import type { Style } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';

export interface CoinTickerRowProps {
  symbol: string;
  name?: string;
  price: number;
  /** Percentage change over 24h, e.g. 2.4 or -1.7 */
  change24h?: number;
  /** Array of price points for the mini sparkline */
  sparkline?: number[];
  /** Currency prefix, defaults to "$" */
  currency?: string;
  style?: Style;
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toPrecision(4);
}

/**
 * Compact crypto / asset price row. Works with CoinGecko or any price feed.
 *
 * ```tsx
 * <CoinTickerRow symbol="BTC" name="Bitcoin" price={68420} change24h={2.4} sparkline={prices} />
 * ```
 */
export function CoinTickerRow({
  symbol,
  name,
  price,
  change24h,
  sparkline,
  currency = '$',
  style,
}: CoinTickerRowProps) {
  const c = useThemeColors();
  const up = change24h !== undefined && change24h >= 0;
  const changeColor = change24h === undefined ? c.muted : up ? '#22c55e' : '#ef4444';

  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', ...style }}>
      {/* Symbol badge */}
      <Box style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: c.bgElevated,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Text style={{ color: c.text, fontSize: 9, fontWeight: 'bold' }}>{symbol.slice(0, 4)}</Text>
      </Box>

      {/* Name */}
      <Box style={{ flexGrow: 1 }}>
        <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{symbol}</Text>
        {name && <Text style={{ color: c.muted, fontSize: 10 }}>{name}</Text>}
      </Box>

      {/* Sparkline */}
      {sparkline && sparkline.length > 0 && (
        <Sparkline
          data={sparkline}
          width={52}
          height={20}
          color={changeColor}
        />
      )}

      {/* Price + change */}
      <Box style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
          {currency}{formatPrice(price)}
        </Text>
        {change24h !== undefined && (
          <Box style={{
            backgroundColor: changeColor + '20',
            borderRadius: 3,
            paddingLeft: 5,
            paddingRight: 5,
            paddingTop: 1,
            paddingBottom: 1,
          }}>
            <Text style={{ color: changeColor, fontSize: 10, fontWeight: 'bold' }}>
              {up ? '+' : ''}{change24h.toFixed(2)}%
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
