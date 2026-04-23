import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { useBrowserAutomation } from './hooks/useBrowserAutomation';

export interface BrowserTabProps {
  onRecordStep?: (s: { kind: 'browser.goto' | 'browser.screenshot' | 'browser.extractText'; [k: string]: any }) => void;
}

export function BrowserTab({ onRecordStep }: BrowserTabProps) {
  const api = useBrowserAutomation();
  const [url, setUrl] = useState('https://example.com');
  const [selector, setSelector] = useState('h1');
  const [outPath, setOutPath] = useState('/tmp/sweatshop-shot.png');
  const [extracted, setExtracted] = useState<string[] | null>(null);
  const [htmlBytes, setHtmlBytes] = useState<number | null>(null);

  const tone = COLORS.blue || '#79c0ff';
  const missing = api.probe && !api.probe.binary;

  return (
    <Col style={{ gap: 10 }}>
      {missing ? (
        <Row style={banner()}>
          <Text style={{ color: COLORS.yellow || '#f2e05a', fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>NO CHROMIUM</Text>
          <Text style={{ color: COLORS.textBright, fontSize: 10, flexGrow: 1 }}>
            {api.probe?.installHint}
          </Text>
          <Pressable onPress={api.refreshProbe} style={chip(tone, false)}>
            <Text style={{ color: tone, fontSize: 9, fontWeight: 700 }}>RECHECK</Text>
          </Pressable>
        </Row>
      ) : (
        <Row style={{ alignItems: 'center', gap: 6 }}>
          <Text style={{ color: COLORS.textDim, fontSize: 9 }}>
            chromium: {api.probing ? '…' : api.probe?.binary || 'unknown'}
            {api.probe?.probe.path ? ' (' + api.probe.probe.path + ')' : ''}
          </Text>
          <Box style={{ flexGrow: 1 }} />
          <Pressable onPress={api.refreshProbe} style={chip(tone, false)}>
            <Text style={{ color: tone, fontSize: 9, fontWeight: 700 }}>RECHECK</Text>
          </Pressable>
        </Row>
      )}

      <Field label="URL" value={url} onChange={setUrl} placeholder="https://…" />

      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        <Pressable onPress={async () => {
          const r = await api.goto(url);
          setHtmlBytes(r.ok ? r.html.length : null);
          setExtracted(null);
          if (r.ok && onRecordStep) onRecordStep({ kind: 'browser.goto', url });
        }} style={btn(tone, api.running)} >
          <Text style={btnText(tone)}>GO</Text>
        </Pressable>
        <Pressable onPress={async () => {
          const r = await api.screenshot(url, outPath);
          if (r.ok && onRecordStep) onRecordStep({ kind: 'browser.screenshot', url, outPath });
        }} style={btn(tone, api.running)}>
          <Text style={btnText(tone)}>SCREENSHOT</Text>
        </Pressable>
        <Pressable onPress={async () => {
          const r = await api.extractText(url, selector);
          setExtracted(r.ok ? r.texts : [r.err || 'extract failed']);
          setHtmlBytes(null);
          if (r.ok && onRecordStep) onRecordStep({ kind: 'browser.extractText', url, selector });
        }} style={btn(tone, api.running)}>
          <Text style={btnText(tone)}>EXTRACT</Text>
        </Pressable>
      </Row>

      <Row style={{ gap: 6 }}>
        <Field label="selector" value={selector} onChange={setSelector} placeholder="h1 / #id / .class" />
        <Field label="screenshot-out" value={outPath} onChange={setOutPath} placeholder="/tmp/shot.png" />
      </Row>

      {api.running ? (
        <Text style={{ color: COLORS.yellow || '#f2e05a', fontSize: 10, fontWeight: 700 }}>running chromium…</Text>
      ) : null}

      {api.lastResult ? (
        <Text style={{ color: api.lastResult.ok ? (COLORS.green || '#7ee787') : (COLORS.red || '#ff6b6b'), fontSize: 10, fontWeight: 700 }}>
          {api.lastResult.kind} · {api.lastResult.note}
        </Text>
      ) : null}

      {htmlBytes !== null ? (
        <Text style={{ color: COLORS.textDim, fontSize: 10 }}>
          loaded {htmlBytes} bytes of DOM for {url}
        </Text>
      ) : null}

      {extracted !== null ? (
        <ScrollView style={{ maxHeight: 220 }}>
          <Col style={{ gap: 2, padding: 6, backgroundColor: COLORS.panelAlt || '#05090f', borderRadius: 4, borderWidth: 1, borderColor: COLORS.border || '#1f2630' }}>
            <Text style={{ color: COLORS.textDim, fontSize: 9, fontWeight: 700, letterSpacing: 2 }}>
              MATCHES · {extracted.length} for "{selector}"
            </Text>
            {extracted.length === 0 ? <Text style={{ color: COLORS.textDim, fontSize: 10 }}>(no matches — our selector grammar supports tag / #id / .class only; deeper selectors need DevTools)</Text> : null}
            {extracted.map((t, i) => (
              <Text key={i} style={{ color: COLORS.textBright, fontSize: 11 }}>· {t}</Text>
            ))}
          </Col>
        </ScrollView>
      ) : null}
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
function chip(tone: string, active: boolean): any {
  return { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, backgroundColor: active ? tone : (COLORS.panelAlt || '#05090f'), borderWidth: 1, borderColor: tone };
}
function btn(tone: string, disabled: boolean): any {
  return { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, backgroundColor: COLORS.panelAlt || '#05090f', borderWidth: 1, borderColor: tone, opacity: disabled ? 0.5 : 1 };
}
function btnText(tone: string): any {
  return { color: tone, fontSize: 10, fontWeight: 700, letterSpacing: 1 };
}
function banner(): any {
  return {
    padding: 8, borderRadius: 6, gap: 6, alignItems: 'center',
    backgroundColor: COLORS.yellowDeep || '#3a2e14',
    borderWidth: 1, borderColor: COLORS.yellow || '#f2e05a',
  };
}
