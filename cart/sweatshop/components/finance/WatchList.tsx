import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import type { MarketRow } from './hooks/usePriceStream';

export interface WatchListProps {
  markets: MarketRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  currency: string;
}

type SortKey = 'change' | 'price' | 'volume' | 'mcap' | 'name';

function fmt(v: number | undefined, currency: string): string {
  if (v === undefined || !isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  const d = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return v.toFixed(d);
}

export function WatchList(props: WatchListProps) {
  const { markets, selectedId, onSelect, onRemove, currency } = props;
  const [sortKey, setSortKey] = useState<SortKey>('change');
  const [desc, setDesc] = useState(true);
  const tone = COLORS.blue || '#79c0ff';
  const up = COLORS.green || '#7ee787';
  const down = COLORS.red || '#ff6b6b';

  const sorted = useMemo(() => {
    const rows = markets.slice();
    rows.sort((a, b) => {
      let da = 0, db = 0;
      if (sortKey === 'change') { da = a.price_change_percentage_24h ?? 0; db = b.price_change_percentage_24h ?? 0; }
      else if (sortKey === 'price') { da = a.current_price ?? 0; db = b.current_price ?? 0; }
      else if (sortKey === 'volume') { da = a.total_volume ?? 0; db = b.total_volume ?? 0; }
      else if (sortKey === 'mcap') { da = a.market_cap ?? 0; db = b.market_cap ?? 0; }
      else return desc ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
      return desc ? db - da : da - db;
    });
    return rows;
  }, [markets, sortKey, desc]);

  const setSort = (k: SortKey) => {
    if (k === sortKey) setDesc(!desc);
    else { setSortKey(k); setDesc(true); }
  };

  return (
    <Col style={{
      backgroundColor: COLORS.panelBg || '#0b1018',
      borderWidth: 1, borderColor: COLORS.border || '#1f2630',
      borderRadius: 8, overflow: 'hidden',
    }}>
      <Row style={{
        alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6,
        backgroundColor: COLORS.panelRaised || '#05090f',
        borderBottomWidth: 1, borderColor: COLORS.border || '#1f2630',
      }}>
        <Box style={{ width: 3, height: 10, backgroundColor: tone, borderRadius: 1 }} />
        <Text style={{ color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>WATCHLIST</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{markets.length} rows</Text>
      </Row>

      <Row style={{ gap: 4, padding: 6, borderBottomWidth: 1, borderColor: COLORS.border || '#1f2630', alignItems: 'center' }}>
        <SortBtn label="NAME"   active={sortKey === 'name'}   desc={desc} onPress={() => setSort('name')} />
        <SortBtn label="PRICE"  active={sortKey === 'price'}  desc={desc} onPress={() => setSort('price')} />
        <SortBtn label="24H %"  active={sortKey === 'change'} desc={desc} onPress={() => setSort('change')} />
        <SortBtn label="VOLUME" active={sortKey === 'volume'} desc={desc} onPress={() => setSort('volume')} />
        <SortBtn label="M.CAP"  active={sortKey === 'mcap'}   desc={desc} onPress={() => setSort('mcap')} />
      </Row>

      <ScrollView style={{ maxHeight: 280 }}>
        <Col>
          {sorted.length === 0 ? (
            <Text style={{ color: COLORS.textDim, fontSize: 11, padding: 10 }}>no symbols in watchlist yet</Text>
          ) : null}
          {sorted.map((r) => {
            const pct = r.price_change_percentage_24h ?? 0;
            const ptone = pct >= 0 ? up : down;
            const active = r.id === selectedId;
            return (
              <Row key={r.id} style={{
                alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6,
                backgroundColor: active ? (COLORS.panelHover || '#173048') : 'transparent',
                borderLeftWidth: 2, borderColor: active ? tone : 'transparent',
              }}>
                <Pressable onPress={() => onSelect(r.id)} style={{ flexGrow: 1 }}>
                  <Row style={{ alignItems: 'center', gap: 8 }}>
                    <Col style={{ width: 110 }}>
                      <Text style={{ color: COLORS.textBright, fontSize: 11, fontWeight: 700 }}>
                        {r.symbol ? r.symbol.toUpperCase() : r.id}
                      </Text>
                      <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{r.name}</Text>
                    </Col>
                    <Text style={{ color: COLORS.textBright, fontSize: 11, width: 80, textAlign: 'right' }}>
                      {fmt(r.current_price, currency)}
                    </Text>
                    <Box style={{
                      paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, width: 60,
                      backgroundColor: COLORS.panelAlt || '#05090f',
                      borderWidth: 1, borderColor: ptone,
                      alignItems: 'center',
                    }}>
                      <Text style={{ color: ptone, fontSize: 10, fontWeight: 700 }}>
                        {(pct >= 0 ? '+' : '') + pct.toFixed(2) + '%'}
                      </Text>
                    </Box>
                    <Text style={{ color: COLORS.textDim, fontSize: 9, width: 60, textAlign: 'right' }}>
                      {fmt(r.total_volume, currency)}
                    </Text>
                    <Text style={{ color: COLORS.textDim, fontSize: 9, width: 60, textAlign: 'right' }}>
                      {fmt(r.market_cap, currency)}
                    </Text>
                  </Row>
                </Pressable>
                <Pressable onPress={() => onRemove(r.id)}>
                  <Text style={{ color: COLORS.red || '#ff6b6b', fontSize: 12, fontWeight: 700, paddingHorizontal: 4 }}>×</Text>
                </Pressable>
              </Row>
            );
          })}
        </Col>
      </ScrollView>
    </Col>
  );
}

function SortBtn({ label, active, desc, onPress }: { label: string; active: boolean; desc: boolean; onPress: () => void }) {
  const tone = COLORS.blue || '#79c0ff';
  return (
    <Pressable onPress={onPress} style={{
      paddingHorizontal: 6, paddingVertical: 3, borderRadius: 3,
      backgroundColor: active ? tone : (COLORS.panelAlt || '#05090f'),
      borderWidth: 1, borderColor: active ? tone : (COLORS.border || '#1f2630'),
    }}>
      <Text style={{ color: active ? (COLORS.appBg || '#05090f') : COLORS.textDim, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>
        {label}{active ? (desc ? ' ▼' : ' ▲') : ''}
      </Text>
    </Pressable>
  );
}
