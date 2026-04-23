import { Box, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import type { MarketRow } from './hooks/usePriceStream';

export interface TickerBarProps {
  markets: MarketRow[];
  currency: string;
}

function fmtPrice(v: number, currency: string): string {
  if (!isFinite(v)) return '—';
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 0 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return v.toFixed(digits) + ' ' + currency.toUpperCase();
}
function fmtPct(v: number): string {
  if (!isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

// Compact scrolling strip: one cell per tracked symbol. Green/red on 24h %.
export function TickerBar({ markets, currency }: TickerBarProps) {
  const up = COLORS.green || '#7ee787';
  const down = COLORS.red || '#ff6b6b';

  return (
    <Box style={{
      height: 40,
      backgroundColor: COLORS.panelRaised || '#05090f',
      borderWidth: 1, borderColor: COLORS.border || '#1f2630',
      borderRadius: 6, overflow: 'hidden',
    }}>
      <ScrollView horizontal>
        <Row style={{ paddingHorizontal: 8, gap: 10, alignItems: 'center', height: 38 }}>
          {markets.length === 0 ? (
            <Text style={{ color: COLORS.textDim, fontSize: 10, paddingVertical: 10 }}>
              no symbols tracked — add one below to stream live prices
            </Text>
          ) : null}
          {markets.map((m) => {
            const pct = m.price_change_percentage_24h ?? 0;
            const tone = pct >= 0 ? up : down;
            return (
              <Row key={m.id} style={{ alignItems: 'center', gap: 6 }}>
                <Text style={{ color: COLORS.textDim, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>
                  {m.symbol ? m.symbol.toUpperCase() : m.id}
                </Text>
                <Text style={{ color: COLORS.textBright, fontSize: 11, fontWeight: 700 }}>
                  {fmtPrice(m.current_price, currency)}
                </Text>
                <Box style={{
                  paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3,
                  backgroundColor: COLORS.panelAlt || '#0b1018',
                  borderWidth: 1, borderColor: tone,
                }}>
                  <Text style={{ color: tone, fontSize: 9, fontWeight: 700 }}>{fmtPct(pct)}</Text>
                </Box>
              </Row>
            );
          })}
        </Row>
      </ScrollView>
    </Box>
  );
}
