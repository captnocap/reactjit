
import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { diff, type Snapshot, type SliceDiffEntry } from './SnapshotEngine';

export interface SnapshotDiffProps {
  left: Snapshot | null;
  right: Snapshot | null;
}

const KIND_TONE: Record<string, { label: string; color: string }> = {
  same:    { label: 'SAME',    color: '#5c6a78' },
  changed: { label: 'CHANGED', color: '#f2e05a' },
  added:   { label: 'ADDED',   color: '#7ee787' },
  removed: { label: 'REMOVED', color: '#ff6b6b' },
};

export function SnapshotDiff({ left, right }: SnapshotDiffProps) {
  const tone = COLORS.yellow || '#f2e05a';

  if (!left || !right) {
    return (
      <Col style={tileStyle()}>
        <Header tone={tone} />
        <Box style={{ padding: 14 }}>
          <Text style={{ color: COLORS.textDim, fontSize: 11, letterSpacing: 1 }}>
            [ pick two snapshots — mark one DIFF A, the other DIFF B ]
          </Text>
        </Box>
      </Col>
    );
  }

  const entries: SliceDiffEntry[] = useMemo(() => diff(left, right), [left, right]);
  const [showSame, setShowSame] = useState(false);
  const visible = showSame ? entries : entries.filter((e) => e.kind !== 'same');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const counts = useMemo(() => {
    const c: Record<string, number> = { same: 0, changed: 0, added: 0, removed: 0 };
    for (const e of entries) c[e.kind]++;
    return c;
  }, [entries]);

  return (
    <Col style={tileStyle()}>
      <Header tone={tone} />
      <Row style={{
        alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6,
        borderBottomWidth: 1, borderColor: COLORS.border || '#1f2630',
      }}>
        <Text style={{ color: COLORS.textDim, fontSize: 9 }}>A</Text>
        <Text style={{ color: COLORS.textBright, fontSize: 10, fontWeight: 700 }}>{left.meta.name}</Text>
        <Text style={{ color: COLORS.textDim, fontSize: 9 }}>→</Text>
        <Text style={{ color: COLORS.textDim, fontSize: 9 }}>B</Text>
        <Text style={{ color: COLORS.textBright, fontSize: 10, fontWeight: 700 }}>{right.meta.name}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Pill label="CHG" n={counts.changed} color={KIND_TONE.changed.color} />
        <Pill label="ADD" n={counts.added}   color={KIND_TONE.added.color} />
        <Pill label="RM"  n={counts.removed} color={KIND_TONE.removed.color} />
        <Pressable onPress={() => setShowSame(!showSame)} style={{
          paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
          backgroundColor: showSame ? tone : (COLORS.panelAlt || '#05090f'),
          borderWidth: 1, borderColor: tone,
        }}>
          <Text style={{ color: showSame ? (COLORS.appBg || '#05090f') : tone, fontSize: 9, fontWeight: 700 }}>
            {showSame ? 'HIDE SAME' : 'SHOW SAME'}
          </Text>
        </Pressable>
      </Row>

      <ScrollView style={{ maxHeight: 280 }}>
        <Col style={{ gap: 2, padding: 6 }}>
          {visible.length === 0 ? (
            <Text style={{ color: COLORS.textDim, fontSize: 11, padding: 8 }}>no differences</Text>
          ) : null}
          {visible.map((e) => {
            const kind = KIND_TONE[e.kind];
            const isExp = !!expanded[e.id];
            const leftData = left.slices[e.id]?.data;
            const rightData = right.slices[e.id]?.data;
            return (
              <Col key={e.id} style={{
                backgroundColor: COLORS.panelAlt || '#05090f',
                borderRadius: 4, borderLeftWidth: 2, borderColor: kind.color,
                padding: 6, gap: 4,
              }}>
                <Pressable onPress={() => setExpanded((p: Record<string, boolean>) => ({ ...p, [e.id]: !p[e.id] }))}>
                  <Row style={{ alignItems: 'center', gap: 6 }}>
                    <Box style={{ paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2, backgroundColor: kind.color }}>
                      <Text style={{ color: COLORS.appBg || '#05090f', fontSize: 8, fontWeight: 700, letterSpacing: 1 }}>{kind.label}</Text>
                    </Box>
                    <Text style={{ color: COLORS.textBright, fontSize: 11, fontWeight: 700 }}>{e.id}</Text>
                    <Box style={{ flexGrow: 1 }} />
                    {typeof e.leftBytes === 'number' ? (
                      <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{e.leftBytes}B → {typeof e.rightBytes === 'number' ? e.rightBytes + 'B' : '—'}</Text>
                    ) : null}
                    <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{isExp ? '▾' : '▸'}</Text>
                  </Row>
                </Pressable>
                {isExp ? (
                  <Row style={{ gap: 6, alignItems: 'flex-start' }}>
                    <SnippetBox title="A" data={leftData} tone={KIND_TONE.removed.color} />
                    <SnippetBox title="B" data={rightData} tone={KIND_TONE.added.color} />
                  </Row>
                ) : null}
              </Col>
            );
          })}
        </Col>
      </ScrollView>
    </Col>
  );
}

function SnippetBox({ title, data, tone }: { title: string; data: any; tone: string }) {
  let body = '—';
  try { body = data === undefined ? '—' : JSON.stringify(data, null, 2).slice(0, 600); } catch (_) {}
  return (
    <Col style={{
      flexGrow: 1, flexBasis: 0,
      backgroundColor: COLORS.panelBg || '#0b1018',
      borderWidth: 1, borderColor: tone, borderRadius: 4,
      padding: 6, gap: 2,
    }}>
      <Text style={{ color: tone, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{title}</Text>
      <Text style={{ color: COLORS.textBright, fontSize: 10 }}>{body}</Text>
    </Col>
  );
}

function Pill({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <Row style={{ alignItems: 'center', gap: 3 }}>
      <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color: COLORS.textDim, fontSize: 9, fontWeight: 700 }}>{label}</Text>
      <Text style={{ color, fontSize: 10, fontWeight: 700 }}>{n}</Text>
    </Row>
  );
}

function Header({ tone }: { tone: string }) {
  return (
    <Row style={{
      alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 6,
    }}>
      <Box style={{ width: 4, height: 12, backgroundColor: tone, borderRadius: 1 }} />
      <Text style={{ color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>SNAPSHOT DIFF</Text>
    </Row>
  );
}

function tileStyle(): any {
  return {
    backgroundColor: COLORS.panelBg || '#0b1018',
    borderWidth: 1, borderColor: COLORS.border || '#1f2630',
    borderRadius: 8,
  };
}
