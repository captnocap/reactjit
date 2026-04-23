import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { BrowserTab } from './BrowserTab';
import { AndroidTab } from './AndroidTab';
import { ScriptRecorder } from './ScriptRecorder';
import { ScriptRunner } from './ScriptRunner';
import { useAutomationScript } from './hooks/useAutomationScript';
import type { ScriptStep } from '../../lib/automation/script';

type TabId = 'browser' | 'android' | 'scripts';

export function AutomationPanel() {
  const script = useAutomationScript();
  const [tab, setTab] = useState<TabId>('browser');
  const tone = COLORS.purple || '#d2a8ff';

  // Only record steps that match the current recording mode. mixed accepts all.
  const forward = (s: ScriptStep) => {
    if (!script.recording) return;
    const kind = script.recordKind;
    const ns: any = s.kind;
    const matches = kind === 'mixed'
      || (kind === 'browser' && String(ns).startsWith('browser.'))
      || (kind === 'android' && String(ns).startsWith('android.'));
    if (matches) script.recordStep(s);
  };

  return (
    <ScrollView style={{ flexGrow: 1 }}>
      <Col style={{ padding: 10, gap: 10, backgroundColor: COLORS.appBg || '#02050a' }}>
        <Row style={{
          alignItems: 'center', gap: 8, padding: 8,
          backgroundColor: COLORS.panelRaised || '#05090f',
          borderRadius: 6, borderWidth: 1, borderColor: COLORS.border || '#1f2630',
        }}>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />
          <Text style={{ color: tone, fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>◆ AUTOMATION</Text>
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>
            real chromium + adb via __exec · recorder-to-replay
          </Text>
          <Box style={{ flexGrow: 1 }} />
          {script.running ? (
            <Text style={{ color: COLORS.yellow || '#f2e05a', fontSize: 10, fontWeight: 700 }}>
              running step {((script.runProgress?.index ?? 0) + 1)} of {script.runProgress?.total ?? 0}
            </Text>
          ) : null}
        </Row>

        <Row style={{ gap: 4 }}>
          {(['browser', 'android', 'scripts'] as TabId[]).map((t) => {
            const active = t === tab;
            return (
              <Pressable key={t} onPress={() => setTab(t)} style={{
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4,
                backgroundColor: active ? tone : (COLORS.panelAlt || '#05090f'),
                borderWidth: 1, borderColor: active ? tone : (COLORS.border || '#1f2630'),
              }}>
                <Text style={{ color: active ? (COLORS.appBg || '#05090f') : COLORS.textBright, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
                  {t.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </Row>

        <ScriptRecorder
          recording={script.recording}
          draft={script.draft}
          onStart={(k) => script.startRecording(k)}
          onStop={() => { script.stopRecording(); return null; }}
          onCancel={script.cancelRecording}
        />

        {tab === 'browser' ? <BrowserTab onRecordStep={forward} /> : null}
        {tab === 'android' ? <AndroidTab onRecordStep={forward} /> : null}
        {tab === 'scripts' ? (
          <ScriptRunner
            scripts={script.scripts}
            running={script.running}
            runProgress={script.runProgress}
            onRun={script.runScript}
            onStop={script.stopRun}
            onDelete={script.deleteScript}
            onRename={script.renameScript}
          />
        ) : null}
      </Col>
    </ScrollView>
  );
}
