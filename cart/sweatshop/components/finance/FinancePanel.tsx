import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

import { SymbolPicker } from './SymbolPicker';
import { TickerBar } from './TickerBar';
import { PriceChart } from './PriceChart';
import { PriceStats } from './PriceStats';
import { WatchList } from './WatchList';
import { usePriceStream, type Timeframe } from './hooks/usePriceStream';
import { useServiceKey } from '../../lib/apis/useServiceKey';

const STORE_KEY = 'sweatshop.finance.config.v1';
const DEFAULT_TRACKED = ['bitcoin', 'ethereum', 'solana'];
const CURRENCIES = ['usd', 'eur', 'gbp', 'jpy', 'btc'];
const INTERVALS = [10, 30, 60, 300];

interface Persisted { tracked: string[]; selected: string; currency: string; timeframe: Timeframe; intervalSec: number; }

function readCfg(): Persisted {
  try {
    const g: any = globalThis as any;
    const raw = typeof g.__store_get === 'function' ? g.__store_get(STORE_KEY)
      : (typeof g.localStorage !== 'undefined' ? g.localStorage.getItem(STORE_KEY) : null);
    if (raw) return { tracked: DEFAULT_TRACKED, selected: 'bitcoin', currency: 'usd', timeframe: '1d' as Timeframe, intervalSec: 30, ...JSON.parse(raw) };
  } catch (_) {}
  return { tracked: DEFAULT_TRACKED, selected: 'bitcoin', currency: 'usd', timeframe: '1d', intervalSec: 30 };
}
function writeCfg(c: Persisted) {
  try {
    const g: any = globalThis as any;
    const raw = JSON.stringify(c);
    if (typeof g.__store_set === 'function') g.__store_set(STORE_KEY, raw);
    else if (typeof g.localStorage !== 'undefined') g.localStorage.setItem(STORE_KEY, raw);
  } catch (_) {}
}

export function FinancePanel() {
  const initial = readCfg();
  const [tracked, setTracked]       = useState<string[]>(initial.tracked);
  const [selected, setSelected]     = useState<string>(initial.selected);
  const [currency, setCurrency]     = useState<string>(initial.currency);
  const [timeframe, setTimeframe]   = useState<Timeframe>(initial.timeframe);
  const [intervalSec, setInterval2] = useState<number>(initial.intervalSec);

  useEffect(() => { writeCfg({ tracked, selected, currency, timeframe, intervalSec }); },
    [tracked, selected, currency, timeframe, intervalSec]);

  const key = useServiceKey('coingecko');
  const stream = usePriceStream({
    ids: tracked, selected, currency, timeframe, intervalMs: intervalSec * 1000,
  });

  const selectedRow = stream.markets.find((m) => m.id === selected) ?? null;
  const tone = COLORS.blue || '#79c0ff';
  const banner = !key.apiKey
    ? { label: 'NO API KEY', body: 'Calls to CoinGecko work without a key but are rate-limited. Add a demo key in Settings → Service Keys for higher throughput.' }
    : stream.rateLimited
    ? { label: 'RATE LIMITED', body: 'CoinGecko returned 429. Back off by raising the refresh interval or wait a minute.' }
    : stream.error
    ? { label: 'API ERROR', body: String(stream.error.message || stream.error) }
    : null;

  return (
    <ScrollView style={{ flexGrow: 1 }}>
      <Col style={{ padding: 10, gap: 10, backgroundColor: COLORS.appBg || '#02050a' }}>
        {banner ? (
          <Row style={{
            padding: 8, borderRadius: 6, gap: 6, alignItems: 'center',
            backgroundColor: COLORS.yellowDeep || '#3a2e14',
            borderWidth: 1, borderColor: COLORS.yellow || '#f2e05a',
          }}>
            <Text style={{ color: COLORS.yellow || '#f2e05a', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{banner.label}</Text>
            <Text style={{ color: COLORS.textBright, fontSize: 10, flexGrow: 1 }}>{banner.body}</Text>
          </Row>
        ) : null}

        <Row style={{
          alignItems: 'center', gap: 8, padding: 8,
          backgroundColor: COLORS.panelRaised || '#05090f',
          borderRadius: 6, borderWidth: 1, borderColor: COLORS.border || '#1f2630',
        }}>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />
          <Text style={{ color: tone, fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>◆ FINANCE</Text>
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>
            live via coingecko · {stream.lastUpdate ? new Date(stream.lastUpdate).toLocaleTimeString() : 'pending'}
            {stream.loading ? ' · fetching' : ''}
          </Text>
          <Box style={{ flexGrow: 1 }} />
          <Pressable onPress={stream.refetch} style={chip(tone, false)}>
            <Text style={{ color: tone, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>REFRESH</Text>
          </Pressable>
        </Row>

        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          <ChipGroup label="fiat" options={CURRENCIES.map((c) => ({ v: c, l: c.toUpperCase() }))} value={currency} onChange={setCurrency} />
          <ChipGroup label="refresh"
            options={INTERVALS.map((n) => ({ v: String(n), l: n + 's' }))}
            value={String(intervalSec)}
            onChange={(v) => setInterval2(parseInt(v, 10))} />
        </Row>

        <TickerBar markets={stream.markets} currency={currency} />

        <SymbolPicker
          tracked={tracked}
          selected={selected}
          onSelect={setSelected}
          onAdd={(id) => setTracked((ts: string[]) => ts.includes(id) ? ts : ts.concat([id]))}
          onRemove={(id) => setTracked((ts: string[]) => ts.filter((t) => t !== id))}
          onClear={() => setTracked([])}
          recent={stream.markets.map((m) => m.id).filter((id) => !tracked.includes(id))}
        />

        <PriceChart
          history={stream.history}
          loading={stream.loading}
          selectedId={selected}
          currency={currency}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
        />
        <PriceStats row={selectedRow} currency={currency} />
        <WatchList markets={stream.markets} selectedId={selected} onSelect={setSelected}
          onRemove={(id) => setTracked((ts: string[]) => ts.filter((t) => t !== id))}
          currency={currency} />
      </Col>
    </ScrollView>
  );
}

function ChipGroup({ label, options, value, onChange }: { label: string; options: { v: string; l: string }[]; value: string; onChange: (v: string) => void }) {
  const tone = COLORS.blue || '#79c0ff';
  return (
    <Row style={{ alignItems: 'center', gap: 4 }}>
      <Text style={{ color: COLORS.textDim, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{label.toUpperCase()}</Text>
      {options.map((o) => {
        const active = o.v === value;
        return (
          <Pressable key={o.v} onPress={() => onChange(o.v)} style={chip(tone, active)}>
            <Text style={{ color: active ? (COLORS.appBg || '#05090f') : COLORS.textDim, fontSize: 9, fontWeight: 700 }}>{o.l}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

function chip(tone: string, active: boolean): any {
  return {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    backgroundColor: active ? tone : (COLORS.panelAlt || '#05090f'),
    borderWidth: 1, borderColor: active ? tone : (COLORS.border || '#1f2630'),
  };
}
