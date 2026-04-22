
import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

import { listSlices, categoryOf } from './SnapshotRegistry';
import { useSnapshots } from './useSnapshots';
import { useSnapshotAutosave, AUTOSAVE_DEFAULTS } from './SnapshotAutosave';
import { SnapshotRow } from './SnapshotRow';
import { SnapshotDiff } from './SnapshotDiff';

export interface SnapshotPanelProps { width?: number | string; }

const INTERVAL_STEPS = [1, 2, 5, 10, 30, 60];
const RETAIN_STEPS = [3, 5, 10, 20, 50];

export function SnapshotPanel(props: SnapshotPanelProps) {
  const snapshots = useSnapshots();
  const slices = listSlices();

  const [autosaveOn, setAutosaveOn] = useState(AUTOSAVE_DEFAULTS.enabled);
  const [intervalMin, setIntervalMin] = useState(5);
  const [maxRetained, setMaxRetained] = useState(AUTOSAVE_DEFAULTS.maxRetained);
  const [sliceEnabled, setSliceEnabled] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    slices.forEach((s) => { init[s.id] = true; });
    return init;
  });
  const [diffA, setDiffA] = useState<string | null>(null);
  const [diffB, setDiffB] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const include = useMemo(() => (id: string) => sliceEnabled[id] !== false, [sliceEnabled]);

  useSnapshotAutosave({
    enabled: autosaveOn, intervalMs: intervalMin * 60 * 1000, maxRetained, include,
    onError: (e) => setToast('autosave error: ' + String(e)),
  });

  const snapA = diffA ? snapshots.load(diffA) : null;
  const snapB = diffB ? snapshots.load(diffB) : null;

  const take = () => {
    const meta = snapshots.create({ include });
    setSelected(meta.id);
    setToast('saved ' + meta.sliceCount + ' slices · ' + meta.bytes + ' B');
  };

  const doRestore = (id: string) => {
    const result = snapshots.restoreById(id, { include });
    if (!result) { setToast('snapshot missing'); return; }
    setToast('restored ' + result.applied.length + ' · missing ' + result.missing.length + ' · errors ' + result.errors.length);
  };

  const pickDiff = (id: string, slot: 'a' | 'b') => {
    if (slot === 'a') setDiffA(diffA === id ? null : id);
    else setDiffB(diffB === id ? null : id);
  };

  const categoriesBySlice = useMemo(() => {
    const groups: Record<string, string[]> = {};
    slices.forEach((s) => { const c = categoryOf(s); (groups[c] = groups[c] || []).push(s.id); });
    return groups;
  }, [slices]);

  const tone = COLORS.blue || '#79c0ff';

  return (
    <Col style={{
      width: props.width ?? 420, flexGrow: 1, flexBasis: 0, minHeight: 0,
      backgroundColor: COLORS.appBg || '#02050a',
      borderLeftWidth: 1, borderColor: COLORS.border || '#1a222c',
    }}>
      <Row style={headerStyle(tone)}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />
        <Text style={{ color: tone, fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>◆ SNAPSHOTS</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{snapshots.index.length} saved · {slices.length} slices registered</Text>
      </Row>

      <ScrollView style={{ flexGrow: 1, flexBasis: 0 }}>
        <Col style={{ padding: 10, gap: 10 }}>
          <Row style={{ gap: 6 }}>
            <Pressable onPress={take} style={primaryBtn(COLORS.green || '#7ee787')}>
              <Text style={{ color: COLORS.appBg || '#05090f', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>+ TAKE SNAPSHOT</Text>
            </Pressable>
            <Pressable onPress={() => { snapshots.clearAll(); setToast('cleared all'); }} style={dangerBtn(COLORS.red || '#ff6b6b')}>
              <Text style={{ color: COLORS.red || '#ff6b6b', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>CLEAR ALL</Text>
            </Pressable>
          </Row>

          <Col style={panelBox(tone)}>
            <Row style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>AUTOSAVE</Text>
              <Box style={{ flexGrow: 1 }} />
              <Pressable onPress={() => setAutosaveOn(!autosaveOn)} style={chip(autosaveOn, tone)}>
                <Text style={{ color: autosaveOn ? (COLORS.appBg || '#05090f') : tone, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>
                  {autosaveOn ? 'ON' : 'OFF'}
                </Text>
              </Pressable>
            </Row>
            <StepRow label="every" suffix="min" steps={INTERVAL_STEPS} value={intervalMin} onChange={setIntervalMin} tone={tone} />
            <StepRow label="keep" suffix="auto" steps={RETAIN_STEPS} value={maxRetained} onChange={setMaxRetained} tone={tone} />
          </Col>

          <Col style={panelBox(COLORS.yellow || '#f2e05a')}>
            <Row style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ color: COLORS.yellow || '#f2e05a', fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>SLICES</Text>
              <Box style={{ flexGrow: 1 }} />
              <Text style={{ color: COLORS.textDim, fontSize: 9 }}>
                {Object.values(sliceEnabled).filter(Boolean).length}/{slices.length} on
              </Text>
            </Row>
            {slices.length === 0 ? (
              <Text style={{ color: COLORS.textDim, fontSize: 10 }}>no slices registered yet — contributors call registerSlice()</Text>
            ) : null}
            {Object.keys(categoriesBySlice).sort().map((cat) => (
              <Col key={cat} style={{ gap: 3 }}>
                <Text style={{ color: COLORS.textDim, fontSize: 9, letterSpacing: 1 }}>{cat.toUpperCase()}</Text>
                <Row style={{ flexWrap: 'wrap', gap: 4 }}>
                  {categoriesBySlice[cat].map((id) => {
                    const on = sliceEnabled[id] !== false;
                    return (
                      <Pressable key={id} onPress={() => setSliceEnabled((prev: Record<string, boolean>) => ({ ...prev, [id]: !on }))}
                        style={{
                          paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
                          backgroundColor: on ? (COLORS.panelHover || '#173048') : (COLORS.panelAlt || '#05090f'),
                          borderWidth: 1, borderColor: on ? tone : (COLORS.border || '#1f2630'),
                        }}>
                        <Text style={{ color: on ? COLORS.textBright : COLORS.textDim, fontSize: 9, fontWeight: 700 }}>
                          {on ? '✓ ' : ''}{id}
                        </Text>
                      </Pressable>
                    );
                  })}
                </Row>
              </Col>
            ))}
          </Col>

          <Col style={{ gap: 6 }}>
            {snapshots.index.length === 0 ? (
              <Text style={{ color: COLORS.textDim, fontSize: 11, padding: 8 }}>[ no snapshots yet — hit TAKE SNAPSHOT ]</Text>
            ) : null}
            {snapshots.index.map((m) => (
              <SnapshotRow
                key={m.id}
                meta={m}
                selected={selected === m.id}
                diffPick={diffA === m.id ? 'a' : diffB === m.id ? 'b' : null}
                onSelect={setSelected}
                onRestore={doRestore}
                onDelete={(id) => snapshots.remove(id)}
                onRename={(id, name) => snapshots.rename(id, name)}
                onPickDiff={pickDiff}
              />
            ))}
          </Col>

          <SnapshotDiff left={snapA} right={snapB} />

          {toast ? (
            <Box style={{
              backgroundColor: COLORS.panelAlt || '#05090f',
              borderWidth: 1, borderColor: tone,
              borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4,
            }}>
              <Text style={{ color: tone, fontSize: 10 }}>{toast}</Text>
            </Box>
          ) : null}
        </Col>
      </ScrollView>
    </Col>
  );
}

function StepRow({ label, suffix, steps, value, onChange, tone }: { label: string; suffix?: string; steps: number[]; value: number; onChange: (v: number) => void; tone: string }) {
  return (
    <Row style={{ alignItems: 'center', gap: 4 }}>
      <Text style={{ color: COLORS.textDim, fontSize: 9, width: 40, textAlign: 'right' }}>{label}</Text>
      {steps.map((n) => {
        const active = n === value;
        return (
          <Pressable key={n} onPress={() => onChange(n)} style={{
            paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4,
            backgroundColor: active ? tone : (COLORS.panelAlt || '#05090f'),
            borderWidth: 1, borderColor: active ? tone : (COLORS.border || '#1f2630'),
          }}>
            <Text style={{ color: active ? (COLORS.appBg || '#05090f') : COLORS.textDim, fontSize: 9, fontWeight: 700 }}>{n}</Text>
          </Pressable>
        );
      })}
      {suffix ? <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{suffix}</Text> : null}
    </Row>
  );
}

function headerStyle(tone: string): any {
  return {
    alignItems: 'center', gap: 8, padding: 10,
    backgroundColor: COLORS.panelRaised || '#05090f',
    borderBottomWidth: 1, borderColor: COLORS.border || '#1a222c',
  };
}
function panelBox(tone: string): any {
  return {
    gap: 6, padding: 8, borderRadius: 6,
    backgroundColor: COLORS.panelBg || '#0b1018',
    borderWidth: 1, borderColor: COLORS.border || '#1f2630',
  };
}
function primaryBtn(tone: string): any {
  return { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, backgroundColor: tone, borderWidth: 1, borderColor: tone };
}
function dangerBtn(tone: string): any {
  return { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, backgroundColor: COLORS.panelAlt || '#05090f', borderWidth: 1, borderColor: tone };
}
function chip(active: boolean, tone: string): any {
  return { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: active ? tone : (COLORS.panelAlt || '#05090f'), borderWidth: 1, borderColor: tone };
}
