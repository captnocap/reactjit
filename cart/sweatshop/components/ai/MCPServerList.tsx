
import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { useMCPServer } from '../../hooks/ai/useMCPServer';
import { websocketSupported } from '../../lib/ai/mcp';

const STORAGE_KEY = 'sweatshop:ai:mcp:servers';

function loadServers(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_e) { return []; }
}

function saveServers(list: string[]): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (_e) {}
}

function ServerCard(props: { url: string; onRemove: () => void }) {
  const mcp = useMCPServer(props.url);
  const tone = mcp.error ? COLORS.red : mcp.connected ? COLORS.green : COLORS.yellow;
  const label = mcp.error ? 'error' : mcp.connected ? 'connected' : 'connecting';

  return (
    <Col style={{
      padding: TOKENS.padNormal, gap: 4,
      borderRadius: TOKENS.radiusSm,
      borderWidth: 1, borderColor: COLORS.border,
      backgroundColor: COLORS.panelAlt,
    }}>
      <Row style={{ alignItems: 'center', gap: 6 }}>
        <Box style={{ width: 8, height: 8, borderRadius: TOKENS.radiusPill, backgroundColor: tone }} />
        <Text fontSize={TOKENS.fontSm} color={COLORS.textBright} style={{ fontFamily: TOKENS.fontMono, flexGrow: 1, flexBasis: 0 }}>{props.url}</Text>
        <Text fontSize={9} color={tone} style={{ fontFamily: TOKENS.fontMono }}>{label}</Text>
        <Pressable onPress={props.onRemove}>
          <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
            <Text fontSize={9} color={COLORS.red}>drop</Text>
          </Box>
        </Pressable>
      </Row>
      {mcp.info ? (
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>{mcp.info.name}{mcp.info.version ? ' · ' + mcp.info.version : ''}</Text>
      ) : null}
      {mcp.tools.length ? (
        <Row style={{ gap: 4, flexWrap: 'wrap' }}>
          {mcp.tools.map((t) => (
            <Box key={t.name} style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg }}>
              <Text fontSize={9} color={COLORS.text} style={{ fontFamily: TOKENS.fontMono }}>{t.name}</Text>
            </Box>
          ))}
        </Row>
      ) : null}
      {mcp.error ? <Text fontSize={9} color={COLORS.red}>{mcp.error.message}</Text> : null}
    </Col>
  );
}

export function MCPServerList() {
  const [servers, setServers] = useState<string[]>(() => loadServers());
  const [draft, setDraft] = useState('');

  useEffect(() => { saveServers(servers); }, [servers]);

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (servers.includes(trimmed)) return;
    setServers((prev: string[]) => prev.concat(trimmed));
    setDraft('');
  };
  const remove = (url: string) => setServers((prev: string[]) => prev.filter((s) => s !== url));

  const wsOk = websocketSupported();

  return (
    <Col style={{ gap: 6 }}>
      <Text fontSize={10} color={COLORS.purple} style={{ letterSpacing: 0.6, fontWeight: 'bold' }}>MCP SERVERS</Text>
      {!wsOk ? (
        <Box style={{ padding: TOKENS.padNormal, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.yellow, backgroundColor: COLORS.yellowDeep }}>
          <Text fontSize={TOKENS.fontXs} color={COLORS.yellow}>
            Host is missing a WebSocket binding. MCP connections need __ws_* host fns; until they ship, connect actions stay disabled.
          </Text>
        </Box>
      ) : null}
      <Row style={{ gap: 6, alignItems: 'center' }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          style={{
            flexGrow: 1, flexBasis: 0, height: 24,
            paddingLeft: 6, paddingRight: 6,
            borderWidth: 1, borderColor: COLORS.border,
            borderRadius: TOKENS.radiusXs,
            backgroundColor: COLORS.panelBg,
            fontFamily: TOKENS.fontMono, fontSize: 10,
          }}
        />
        <Pressable onPress={add}>
          <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.blue, backgroundColor: COLORS.blueDeep }}>
            <Text fontSize={TOKENS.fontXs} color={COLORS.blue} style={{ fontFamily: TOKENS.fontMono, fontWeight: 'bold' }}>Connect</Text>
          </Box>
        </Pressable>
      </Row>
      <ScrollView style={{ maxHeight: 240, borderWidth: 1, borderColor: COLORS.borderSoft, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg }}>
        <Col style={{ padding: 4, gap: 4 }}>
          {servers.length === 0 ? (
            <Text fontSize={TOKENS.fontXs} color={COLORS.textDim} style={{ padding: 4 }}>No MCP servers. Paste a ws:// URL and Connect.</Text>
          ) : servers.map((url) => (
            <ServerCard key={url} url={url} onRemove={() => remove(url)} />
          ))}
        </Col>
      </ScrollView>
    </Col>
  );
}
