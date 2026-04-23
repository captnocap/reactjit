import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { summarizeStep, type AutomationKind, type Script } from '../../lib/automation/script';

export interface ScriptRecorderProps {
  recording: boolean;
  draft: Script | null;
  onStart: (kind: AutomationKind) => void;
  onStop: () => Script | null;
  onCancel: () => void;
}

// Records the user's browser/android actions into a draft script. Steps
// append live as the user clicks in the other tabs (those tabs call
// api.recordStep via the shared AutomationScript hook).
export function ScriptRecorder(props: ScriptRecorderProps) {
  const tone = COLORS.red || '#ff6b6b';
  const { recording, draft, onStart, onStop, onCancel } = props;

  return (
    <Col style={{
      gap: 6, padding: 8,
      backgroundColor: COLORS.panelBg || '#0b1018',
      borderWidth: 1, borderColor: recording ? tone : (COLORS.border || '#1f2630'),
      borderRadius: 8,
    }}>
      <Row style={{ alignItems: 'center', gap: 6 }}>
        <Box style={{
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: recording ? tone : (COLORS.border || '#1f2630'),
        }} />
        <Text style={{ color: recording ? tone : COLORS.textDim, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>
          {recording ? 'RECORDING' : 'RECORDER IDLE'}
        </Text>
        <Box style={{ flexGrow: 1 }} />
        {recording ? (
          <>
            <Pressable onPress={onStop} style={btn(COLORS.green || '#7ee787')}>
              <Text style={{ color: COLORS.green || '#7ee787', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>SAVE SCRIPT</Text>
            </Pressable>
            <Pressable onPress={onCancel} style={btn(COLORS.red || '#ff6b6b')}>
              <Text style={{ color: COLORS.red || '#ff6b6b', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>CANCEL</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable onPress={() => onStart('browser')} style={btn(COLORS.blue || '#79c0ff')}>
              <Text style={{ color: COLORS.blue || '#79c0ff', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>REC BROWSER</Text>
            </Pressable>
            <Pressable onPress={() => onStart('android')} style={btn(COLORS.purple || '#d2a8ff')}>
              <Text style={{ color: COLORS.purple || '#d2a8ff', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>REC ANDROID</Text>
            </Pressable>
            <Pressable onPress={() => onStart('mixed')} style={btn(COLORS.yellow || '#f2e05a')}>
              <Text style={{ color: COLORS.yellow || '#f2e05a', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>REC MIXED</Text>
            </Pressable>
          </>
        )}
      </Row>

      {recording && draft ? (
        <Col style={{ gap: 2, padding: 6, backgroundColor: COLORS.panelAlt || '#05090f', borderRadius: 4, borderWidth: 1, borderColor: COLORS.border || '#1f2630' }}>
          <Text style={{ color: COLORS.textDim, fontSize: 9, letterSpacing: 1 }}>
            DRAFT · {draft.kind} · {draft.steps.length} steps
          </Text>
          {draft.steps.length === 0 ? (
            <Text style={{ color: COLORS.textDim, fontSize: 10 }}>
              switch to the {draft.kind === 'android' ? 'Android' : draft.kind === 'browser' ? 'Browser' : 'Browser or Android'} tab and perform real actions — they append here
            </Text>
          ) : null}
          {draft.steps.map((s, i) => (
            <Text key={i} style={{ color: COLORS.textBright, fontSize: 10 }}>
              {String(i + 1).padStart(2, '0')} · {summarizeStep(s)}
            </Text>
          ))}
        </Col>
      ) : null}
    </Col>
  );
}

function btn(tone: string): any {
  return { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, backgroundColor: COLORS.panelAlt || '#05090f', borderWidth: 1, borderColor: tone };
}
