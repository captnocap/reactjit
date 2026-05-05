import { Box, Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';
import { LineChart } from '../charts/LineChart';
import type { PriceSample, Timeframe } from './hooks/usePriceStream';

export interface PriceChartProps {
  history: PriceSample[];
  loading?: boolean;
  selectedId: string | null;
  currency: string;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}

const TIMEFRAMES: Timeframe[] = ['1h', '1d', '7d', '30d'];

// Wraps the shared LineChart with real CoinGecko /market_chart points.
// Color: green if the end >= start, red otherwise. No synthetic fill-ins.
export function PriceChart(props: PriceChartProps) {
  const { history, loading, selectedId, currency, timeframe, onTimeframeChange } = props;
  const tone = COLORS.blue || '#79c0ff';
  const up = COLORS.green || '#7ee787';
  const down = COLORS.red || '#ff6b6b';

  const lineColor = (() => {
    if (history.length < 2) return tone;
    return history[history.length - 1].price >= history[0].price ? up : down;
  })();

  const points = history.map((p) => p.price);
  const first = history[0]?.price;
  const last = history[history.length - 1]?.price;
  const absDelta = first !== undefined && last !== undefined ? last - first : 0;
  const pctDelta = first ? (absDelta / first) * 100 : 0;

  return (
    <Col style={{
      backgroundColor: COLORS.panelBg || '#0b1018',
      borderWidth: 1, borderColor: COLORS.border || '#1f2630',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <Row style={{
        alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6,
        backgroundColor: COLORS.panelRaised || '#05090f',
        borderBottomWidth: 1, borderColor: COLORS.border || '#1f2630',
      }}>
        <Box style={{ width: 3, height: 10, backgroundColor: tone, borderRadius: 1 }} />
        <Text style={{ color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>PRICE</Text>
        <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{selectedId || '(no symbol)'} · {currency.toUpperCase()}</Text>
        <Box style={{ flexGrow: 1 }} />
        {history.length >= 2 ? (
          <Text style={{ color: lineColor, fontSize: 10, fontWeight: 700 }}>
            {(pctDelta >= 0 ? '+' : '') + pctDelta.toFixed(2)}%
          </Text>
        ) : null}
        <Row style={{ gap: 2 }}>
          {TIMEFRAMES.map((tf) => {
            const active = tf === timeframe;
            return (
              <Pressable key={tf} onPress={() => onTimeframeChange(tf)} style={{
                paddingHorizontal: 6, paddingVertical: 3, borderRadius: 3,
                backgroundColor: active ? tone : (COLORS.panelAlt || '#05090f'),
                borderWidth: 1, borderColor: active ? tone : (COLORS.border || '#1f2630'),
              }}>
                <Text style={{ color: active ? (COLORS.appBg || '#05090f') : COLORS.textDim, fontSize: 9, fontWeight: 700 }}>{tf}</Text>
              </Pressable>
            );
          })}
        </Row>
      </Row>

      <Box style={{ height: 220, padding: 8 }}>
        {history.length === 0 ? (
          <Col style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Text style={{ color: COLORS.textDim, fontSize: 11 }}>
              {loading ? 'loading price history…' : selectedId ? 'no history yet' : 'select a symbol to chart'}
            </Text>
          </Col>
        ) : (
          <LineChart
            data={[{ label: selectedId || 'price', color: lineColor, data: points }]}
            height={200}
          />
        )}
      </Box>
    </Col>
  );
}
