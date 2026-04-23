import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { summarizeStep, type Script, type StepResult } from '../../lib/automation/script';

export interface ScriptRunnerProps {
  scripts: Script[];
  running: boolean;
  runProgress: { scriptId: string; index: number; total: number; results: StepResult[] } | null;
  onRun: (s: Script) => void;
  onStop: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export function ScriptRunner(props: ScriptRunnerProps) {
  const { scripts, running, runProgress, onRun, onStop, onDelete } = props;
  const [selected, setSelected] = useState<string | null>(scripts[0]?.id ?? null);
  const cur = scripts.find((s) => s.id === (selected ?? scripts[0]?.id)) ?? null;
  const tone = COLORS.green || '#7ee787';

  return (
    <Col style={{
      gap: 6, padding: 8,
      backgroundColor: COLORS.panelBg || '#0b1018',
      borderWidth: 1, borderColor: COLORS.border || '#1f2630',
      borderRadius: 8,
    }}>
      <Row style={{ alignItems: 'center', gap: 6 }}>
        <Box style={{ width: 3, height: 10, backgroundColor: tone, borderRadius: 1 }} />
        <Text style={{ color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>SCRIPTS</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{scripts.length} saved</Text>
      </Row>

      {scripts.length === 0 ? (
        <Text style={{ color: COLORS.textDim, fontSize: 10 }}>
          no saved scripts — use the recorder above to capture actions, then SAVE SCRIPT
        </Text>
      ) : null}

      <Col style={{ gap: 4 }}>
        {scripts.map((s) => {
          const isActive = cur?.id === s.id;
          return (
            <Row key={s.id} style={{
              alignItems: 'center', gap: 6,
              paddingHorizontal: 8, paddingVertical: 5, borderRadius: 4,
              backgroundColor: isActive ? (COLORS.panelHover || '#173048') : (COLORS.panelAlt || '#05090f'),
              borderWidth: 1, borderColor: isActive ? tone : (COLORS.border || '#1f2630'),
            }}>
              <Pressable onPress={() => setSelected(s.id)} style={{ flexGrow: 1 }}>
                <Col style={{ gap: 1 }}>
                  <Text style={{ color: COLORS.textBright, fontSize: 11, fontWeight: 700 }}>{s.name}</Text>
                  <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{s.kind} · {s.steps.length} steps</Text>
                </Col>
              </Pressable>
              <Pressable onPress={() => onRun(s)} style={btn(tone, running)}>
                <Text style={{ color: tone, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{running && runProgress?.scriptId === s.id ? 'RUNNING…' : 'RUN'}</Text>
              </Pressable>
              <Pressable onPress={() => onDelete(s.id)} style={btn(COLORS.red || '#ff6b6b', false)}>
                <Text style={{ color: COLORS.red || '#ff6b6b', fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>DEL</Text>
              </Pressable>
            </Row>
          );
        })}
      </Col>

      {cur ? (
        <ScrollView style={{ maxHeight: 240 }}>
          <Col style={{ gap: 2, padding: 6, backgroundColor: COLORS.panelAlt || '#05090f', borderRadius: 4, borderWidth: 1, borderColor: COLORS.border || '#1f2630' }}>
            <Row style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ color: COLORS.textDim, fontSize: 9, letterSpacing: 1 }}>PREVIEW · {cur.name}</Text>
              <Box style={{ flexGrow: 1 }} />
              {running ? (
                <Pressable onPress={onStop} style={btn(COLORS.red || '#ff6b6b', false)}>
                  <Text style={{ color: COLORS.red || '#ff6b6b', fontSize: 9, fontWeight: 700 }}>STOP</Text>
                </Pressable>
              ) : null}
            </Row>
            {cur.steps.map((s, i) => {
              const r = runProgress && runProgress.scriptId === cur.id ? runProgress.results[i] : undefined;
              const active = runProgress && runProgress.scriptId === cur.id && runProgress.index === i && running;
              const stepTone = active ? (COLORS.yellow || '#f2e05a')
                : r === undefined ? COLORS.textDim
                : r.ok ? (COLORS.green || '#7ee787') : (COLORS.red || '#ff6b6b');
              return (
                <Row key={i} style={{ gap: 6, alignItems: 'center' }}>
                  <Text style={{ color: stepTone, fontSize: 10, fontWeight: 700, width: 22, textAlign: 'right' }}>{String(i + 1).padStart(2, '0')}</Text>
                  <Text style={{ color: COLORS.textBright, fontSize: 10, flexGrow: 1 }}>{summarizeStep(s)}</Text>
                  {r ? (
                    <Text style={{ color: stepTone, fontSize: 9 }}>{r.note}</Text>
                  ) : active ? (
                    <Text style={{ color: stepTone, fontSize: 9, fontWeight: 700 }}>…</Text>
                  ) : null}
                </Row>
              );
            })}
          </Col>
        </ScrollView>
      ) : null}
    </Col>
  );
}

function btn(tone: string, disabled: boolean): any {
  return {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4,
    backgroundColor: COLORS.panelAlt || '#05090f',
    borderWidth: 1, borderColor: tone,
    opacity: disabled ? 0.5 : 1,
  };
}
