
import { Box, Col, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';
import type { Achievement } from './useGamifyEvents';

export interface AchievementFeedProps {
  unlocks: Achievement[];
  max?: number;
}

function timeAgo(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}

export function AchievementFeed({ unlocks, max }: AchievementFeedProps) {
  // Newest on top — work on a reversed copy so callers don't need to pre-sort.
  const ordered = unlocks.slice().reverse();
  const cap = max ?? ordered.length;
  const items = ordered.slice(0, cap);

  // Force re-render every 30 s so "2m ago" -> "3m ago" without new events.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x: number) => x + 1), 30000);
    return () => clearInterval(id);
  }, []);

  if (items.length === 0) {
    return (
      <Col style={tileStyle()}>
        <Header />
        <Col style={{ padding: 14, alignItems: 'center', gap: 6 }}>
          <Text style={{ color: COLORS.textDim, fontSize: 11, letterSpacing: 1 }}>[ no unlocks yet ]</Text>
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>earn xp to pop the first achievement</Text>
        </Col>
      </Col>
    );
  }

  return (
    <Col style={tileStyle()}>
      <Header count={unlocks.length} />
      <ScrollView showScrollbar={true} style={{ maxHeight: 180 }}>
        <Col style={{ gap: 4, padding: 8 }}>
          {items.map((a, i) => {
            const fresh = i === 0 && (Date.now() - a.t) < 4000;
            const tone = fresh ? (COLORS.yellow || '#f2e05a') : (COLORS.purple || '#d2a8ff');
            return (
              <Row key={a.id + ':' + a.t} style={{
                alignItems: 'center', gap: 8,
                padding: 8, borderRadius: 6,
                backgroundColor: fresh ? (COLORS.yellowDeep || '#3a2e14') : (COLORS.panelAlt || '#05090f'),
                borderWidth: 1, borderColor: fresh ? tone : (COLORS.border || '#1f2630'),
              }}>
                <Box style={{
                  width: 22, height: 22, borderRadius: 4,
                  backgroundColor: tone,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: COLORS.appBg || '#05090f', fontSize: 12, fontWeight: 700 }}>★</Text>
                </Box>
                <Col style={{ flexGrow: 1, flexBasis: 0, gap: 1 }}>
                  <Text style={{ color: COLORS.textBright, fontSize: 11, fontWeight: 700 }}>{a.label}</Text>
                  <Text style={{ color: COLORS.textDim, fontSize: 9 }}>unlocked · {timeAgo(a.t)}</Text>
                </Col>
                {fresh ? (
                  <Text style={{ color: tone, fontSize: 9, fontWeight: 700, letterSpacing: 2 }}>NEW</Text>
                ) : null}
              </Row>
            );
          })}
        </Col>
      </ScrollView>
    </Col>
  );
}

function Header({ count }: { count?: number } = {}) {
  const tone = COLORS.purple || '#d2a8ff';
  return (
    <Row style={{ alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 10 }}>
      <Box style={{ width: 4, height: 12, backgroundColor: tone, borderRadius: 1 }} />
      <Text style={{ color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>ACHIEVEMENTS</Text>
      <Box style={{ flexGrow: 1 }} />
      {typeof count === 'number' ? (
        <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{count} unlocked</Text>
      ) : null}
    </Row>
  );
}

function tileStyle() {
  return {
    backgroundColor: COLORS.panelBg || '#0b1018',
    borderWidth: 1,
    borderColor: COLORS.border || '#1f2630',
    borderRadius: 8,
    gap: 0,
  } as any;
}
