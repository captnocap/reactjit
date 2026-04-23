import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { useAndroidVM } from './hooks/useAndroidVM';
import type { ScriptStep } from '../../lib/automation/script';

export interface AndroidTabProps {
  onRecordStep?: (s: ScriptStep) => void;
}

export function AndroidTab({ onRecordStep }: AndroidTabProps) {
  const api = useAndroidVM();
  const [tapX, setTapX] = useState('540');
  const [tapY, setTapY] = useState('1200');
  const [swipeFrom, setSwipeFrom] = useState('540,1800');
  const [swipeTo, setSwipeTo] = useState('540,600');
  const [textDraft, setTextDraft] = useState('hello');
  const [launchPkg, setLaunchPkg] = useState('com.android.settings');
  const [outPath, setOutPath] = useState('/tmp/sweatshop-android.png');
  const tone = COLORS.blue || '#79c0ff';
  const missing = api.probe && !api.probe.present;

  const parse = (s: string): [number, number] => {
    const [x, y] = s.split(',').map((n) => parseInt(n.trim(), 10));
    return [isFinite(x) ? x : 0, isFinite(y) ? y : 0];
  };

  return (
    <Col style={{ gap: 10 }}>
      {missing ? (
        <Row style={banner()}>
          <Text style={{ color: COLORS.yellow || '#f2e05a', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>NO ADB</Text>
          <Text style={{ color: COLORS.textBright, fontSize: 10, flexGrow: 1 }}>{api.probe?.installHint}</Text>
          <Pressable onPress={api.refresh} style={chip(tone, false)}>
            <Text style={{ color: tone, fontSize: 9, fontWeight: 700 }}>RECHECK</Text>
          </Pressable>
        </Row>
      ) : (
        <Row style={{ alignItems: 'center', gap: 6 }}>
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>adb · {api.probe?.version || 'checking'}</Text>
          <Box style={{ flexGrow: 1 }} />
          <Pressable onPress={api.refresh} style={chip(tone, false)}>
            <Text style={{ color: tone, fontSize: 9, fontWeight: 700 }}>REFRESH DEVICES</Text>
          </Pressable>
        </Row>
      )}

      <Col style={{ gap: 4, padding: 6, backgroundColor: COLORS.panelBg || '#0b1018', borderRadius: 6, borderWidth: 1, borderColor: COLORS.border || '#1f2630' }}>
        <Row style={{ alignItems: 'center', gap: 6 }}>
          <Box style={{ width: 3, height: 10, backgroundColor: tone, borderRadius: 1 }} />
          <Text style={{ color: tone, fontSize: 9, fontWeight: 700, letterSpacing: 2 }}>DEVICES</Text>
          <Box style={{ flexGrow: 1 }} />
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>{api.devices.length} connected</Text>
        </Row>
        {api.devices.length === 0 ? (
          <Text style={{ color: COLORS.textDim, fontSize: 10 }}>
            no devices — plug in a phone w/ USB debugging on, or start an emulator, then REFRESH DEVICES
          </Text>
        ) : null}
        <Row style={{ flexWrap: 'wrap', gap: 4 }}>
          {api.devices.map((d) => {
            const active = d.serial === api.selected;
            return (
              <Pressable key={d.serial} onPress={() => api.setSelected(d.serial)} style={{
                paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4,
                backgroundColor: active ? tone : (COLORS.panelAlt || '#05090f'),
                borderWidth: 1, borderColor: d.state === 'device' ? tone : (COLORS.red || '#ff6b6b'),
              }}>
                <Text style={{ color: active ? (COLORS.appBg || '#05090f') : COLORS.textBright, fontSize: 10, fontWeight: 700 }}>
                  {d.model || d.serial} · {d.state}
                </Text>
              </Pressable>
            );
          })}
        </Row>
      </Col>

      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        <Field label="tap xy" value={tapX + ',' + tapY} onChange={(v) => { const [x, y] = parse(v); setTapX(String(x)); setTapY(String(y)); }} placeholder="540,1200" />
        <Pressable onPress={async () => {
          const ok = await api.tap(parseInt(tapX, 10), parseInt(tapY, 10));
          if (ok && onRecordStep) onRecordStep({ kind: 'android.tap', serial: api.selected, x: parseInt(tapX, 10), y: parseInt(tapY, 10) });
        }} style={btn(tone, api.running)}>
          <Text style={btnText(tone)}>TAP</Text>
        </Pressable>
      </Row>

      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        <Field label="swipe from" value={swipeFrom} onChange={setSwipeFrom} placeholder="x,y" />
        <Field label="swipe to"   value={swipeTo}   onChange={setSwipeTo}   placeholder="x,y" />
        <Pressable onPress={async () => {
          const [x1, y1] = parse(swipeFrom); const [x2, y2] = parse(swipeTo);
          const ok = await api.swipe(x1, y1, x2, y2, 300);
          if (ok && onRecordStep) onRecordStep({ kind: 'android.swipe', serial: api.selected, x1, y1, x2, y2, durationMs: 300 });
        }} style={btn(tone, api.running)}>
          <Text style={btnText(tone)}>SWIPE</Text>
        </Pressable>
      </Row>

      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        <Field label="type" value={textDraft} onChange={setTextDraft} placeholder="hello world" />
        <Pressable onPress={async () => {
          const ok = await api.type(textDraft);
          if (ok && onRecordStep) onRecordStep({ kind: 'android.type', serial: api.selected, text: textDraft });
        }} style={btn(tone, api.running)}>
          <Text style={btnText(tone)}>TYPE</Text>
        </Pressable>
        <Pressable onPress={async () => { const ok = await api.key('KEYCODE_BACK'); if (ok && onRecordStep) onRecordStep({ kind: 'android.keyevent', serial: api.selected, keycode: 'KEYCODE_BACK' }); }} style={btn(tone, api.running)}><Text style={btnText(tone)}>BACK</Text></Pressable>
        <Pressable onPress={async () => { const ok = await api.key('KEYCODE_HOME'); if (ok && onRecordStep) onRecordStep({ kind: 'android.keyevent', serial: api.selected, keycode: 'KEYCODE_HOME' }); }} style={btn(tone, api.running)}><Text style={btnText(tone)}>HOME</Text></Pressable>
      </Row>

      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        <Field label="launch pkg" value={launchPkg} onChange={setLaunchPkg} placeholder="com.example.app" />
        <Pressable onPress={async () => {
          const ok = await api.launch(launchPkg);
          if (ok && onRecordStep) onRecordStep({ kind: 'android.launch', serial: api.selected, packageName: launchPkg });
        }} style={btn(tone, api.running)}>
          <Text style={btnText(tone)}>LAUNCH</Text>
        </Pressable>
      </Row>

      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        <Field label="screencap out" value={outPath} onChange={setOutPath} placeholder="/tmp/android.png" />
        <Pressable onPress={async () => {
          const r = await api.screencap(outPath);
          if (r.ok && onRecordStep) onRecordStep({ kind: 'android.screencap', serial: api.selected, outPath });
        }} style={btn(tone, api.running)}>
          <Text style={btnText(tone)}>SCREENCAP</Text>
        </Pressable>
      </Row>

      {api.running ? <Text style={{ color: COLORS.yellow || '#f2e05a', fontSize: 10, fontWeight: 700 }}>running adb…</Text> : null}
      {api.lastNote ? <Text style={{ color: COLORS.textBright, fontSize: 10 }}>{api.lastNote}</Text> : null}
    </Col>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <Row style={{ alignItems: 'center', gap: 6, flexGrow: 1 }}>
      <Text style={{ color: COLORS.textDim, fontSize: 9, fontWeight: 700, width: 90, textAlign: 'right' }}>{label.toUpperCase()}</Text>
      <Box style={{
        flexGrow: 1,
        backgroundColor: COLORS.panelAlt || '#05090f',
        borderRadius: 4, borderWidth: 1, borderColor: COLORS.border || '#1f2630',
        paddingHorizontal: 8, paddingVertical: 4,
      }}>
        <TextInput value={value} placeholder={placeholder} onChangeText={onChange} style={{ fontSize: 11, color: COLORS.textBright }} />
      </Box>
    </Row>
  );
}
function chip(tone: string, active: boolean): any { return { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: active ? tone : (COLORS.panelAlt || '#05090f'), borderWidth: 1, borderColor: tone }; }
function btn(tone: string, disabled: boolean): any { return { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, backgroundColor: COLORS.panelAlt || '#05090f', borderWidth: 1, borderColor: tone, opacity: disabled ? 0.5 : 1 }; }
function btnText(tone: string): any { return { color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 1 }; }
function banner(): any { return { padding: 8, borderRadius: 6, gap: 6, alignItems: 'center', backgroundColor: COLORS.yellowDeep || '#3a2e14', borderWidth: 1, borderColor: COLORS.yellow || '#f2e05a' }; }
