import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import type { MarketRow } from './hooks/usePriceStream';

export interface PriceStatsProps {
  row: MarketRow | null;
  currency: string;
}

function fmt(v: number | undefined, currency: string, digits?: number): string {
  if (v === undefined || v === null || !isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toFixed(2) + 'B ' + currency.toUpperCase();
  if (abs >= 1e6) return (v / 1e6).toFixed(2) + 'M ' + currency.toUpperCase();
  if (abs >= 1e3) return (v / 1e3).toFixed(2) + 'K ' + currency.toUpperCase();
  const d = digits ?? (abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6);
  return v.toFixed(d) + ' ' + currency.toUpperCase();
}
function pct(v: number | undefined): string {
  if (v === undefined || v === null || !isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

// Live stats block. Everything comes from the /coins/markets row currently
// returned by usePriceStream; no derived-from-mock fields. If a field is
// missing (CoinGecko omits it for some coins) we show an em dash.
export function PriceStats({ row, currency }: PriceStatsProps) {
  const tone = COLORS.blue || '#79c0ff';
  if (!row) {
    return (
      <Col style={box()}>
        <Header tone={tone} />
        <Text style={{ color: COLORS.textDim, fontSize: 11, padding: 10 }}>
          select a symbol to stream its stats
        </Text>
      </Col>
    );
  }

  const change = row.price_change_percentage_24h ?? 0;
  const changeTone = change >= 0 ? (COLORS.green || '#7ee787') : (COLORS.red || '#ff6b6b');

  return (
    <Col style={box()}>
      <Header tone={tone} />
      <Col style={{ padding: 10, gap: 6 }}>
        <Row style={{ alignItems: 'baseline', gap: 8 }}>
          <Text style={{ color: COLORS.textBright, fontSize: 20, fontWeight: 700 }}>
            {fmt(row.current_price, currency)}
          </Text>
          <Box style={{
            paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
            backgroundColor: COLORS.panelAlt || '#0b1018',
            borderWidth: 1, borderColor: changeTone,
          }}>
            <Text style={{ color: changeTone, fontSize: 11, fontWeight: 700 }}>24h {pct(change)}</Text>
          </Box>
          <Box style={{ flexGrow: 1 }} />
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{row.name} ({row.symbol?.toUpperCase()})</Text>
        </Row>
        <Row style={{ flexWrap: 'wrap', gap: 12 }}>
          <Stat label="24H HIGH" value={fmt(row.high_24h, currency)} />
          <Stat label="24H LOW"  value={fmt(row.low_24h, currency)} />
          <Stat label="VOLUME"   value={fmt(row.total_volume, currency, 0)} />
          <Stat label="MKT CAP"  value={fmt(row.market_cap, currency, 0)} />
          <Stat label="ATH"      value={fmt(row.ath, currency)} />
          <Stat label="ATL"      value={fmt(row.atl, currency)} />
        </Row>
      </Col>
    </Col>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Col style={{ gap: 2, minWidth: 96 }}>
      <Text style={{ color: COLORS.textDim, fontSize: 9, fontWeight: 700, letterSpacing: 2 }}>{label}</Text>
      <Text style={{ color: COLORS.textBright, fontSize: 12, fontWeight: 700 }}>{value}</Text>
    </Col>
  );
}

function Header({ tone }: { tone: string }) {
  return (
    <Row style={{ alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 8 }}>
      <Box style={{ width: 3, height: 10, backgroundColor: tone, borderRadius: 1 }} />
      <Text style={{ color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>PRICE STATS</Text>
    </Row>
  );
}

function box(): any {
  return {
    backgroundColor: COLORS.panelBg || '#0b1018',
    borderWidth: 1, borderColor: COLORS.border || '#1f2630',
    borderRadius: 8,
  };
}
