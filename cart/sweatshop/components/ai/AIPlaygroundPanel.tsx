
import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { AIProviderType, ChatOptions } from '../../lib/ai/types';
import { useChat } from '../../hooks/ai/useChat';
import { useRegisteredTools } from '../../hooks/ai/useToolUse';
import { useTokenCount } from '../../hooks/ai/useTokenCount';
import { useAPIKeys } from '../../lib/ai/keys';
import { browseTools } from '../../lib/ai/browse';
import { streamingSupported } from '../../lib/ai/stream';
import { ChatUI } from './ChatUI';
import { ProviderPicker } from './ProviderPicker';
import { MCPServerList } from './MCPServerList';
import { listTemplates } from '../../lib/ai/templates';

// Real AI playground. Pulls stored API keys from localStorage, routes
// streaming requests to OpenAI / Anthropic directly, executes any tools
// the user has registered, and surfaces MCP server connections and
// prompt templates. No mock data anywhere — an un-keyed user sees a
// visible banner telling them to add a key in Settings.

const SETTINGS_KEY = 'sweatshop:ai:playground:config';

type PlaygroundConfig = {
  provider: AIProviderType;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  streaming: boolean;
  toolsEnabled: boolean;
  templateId: string;
};

const DEFAULT_CONFIG: PlaygroundConfig = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: 'You are a helpful assistant running inside the sweatshop IDE.',
  streaming: true,
  toolsEnabled: true,
  templateId: 'default.chat',
};

function loadConfig(): PlaygroundConfig {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_CONFIG;
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (_e) { return DEFAULT_CONFIG; }
}
function saveConfig(cfg: PlaygroundConfig): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(SETTINGS_KEY, JSON.stringify(cfg)); } catch (_e) {}
}

function Toggle(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => props.onChange(!props.value)}>
      <Box style={{
        paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
        borderRadius: TOKENS.radiusXs,
        borderWidth: 1,
        borderColor: props.value ? COLORS.green : COLORS.border,
        backgroundColor: props.value ? COLORS.greenDeep : COLORS.panelAlt,
      }}>
        <Text fontSize={9} color={props.value ? COLORS.green : COLORS.textDim} style={{ fontFamily: TOKENS.fontMono, fontWeight: 'bold' }}>
          {props.label} {props.value ? 'ON' : 'OFF'}
        </Text>
      </Box>
    </Pressable>
  );
}

function NumField(props: { label: string; value: number; step: number; min: number; max: number; onChange: (n: number) => void }) {
  const [local, setLocal] = useState(String(props.value));
  useEffect(() => { setLocal(String(props.value)); }, [props.value]);
  return (
    <Col style={{ gap: 2 }}>
      <Text fontSize={9} color={COLORS.textDim}>{props.label}</Text>
      <TextInput
        value={local}
        onChangeText={(v: string) => {
          setLocal(v);
          const n = Number(v);
          if (Number.isFinite(n) && n >= props.min && n <= props.max) props.onChange(n);
        }}
        style={{ width: 64, height: 22, paddingLeft: 6, paddingRight: 6, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusXs, backgroundColor: COLORS.panelBg, fontFamily: TOKENS.fontMono, fontSize: 10, color: COLORS.text }}
      />
    </Col>
  );
}

export function AIPlaygroundPanel() {
  const [cfg, setCfg] = useState<PlaygroundConfig>(() => loadConfig());
  useEffect(() => { saveConfig(cfg); }, [cfg]);

  const { keys } = useAPIKeys();
  const registered = useRegisteredTools();
  const browse = useMemo(() => browseTools(), []);
  const activeTools = cfg.toolsEnabled ? registered.concat(browse) : [];

  const [streamingText, setStreamingText] = useState('');
  const chatOpts: ChatOptions = {
    provider: cfg.provider,
    model: cfg.model,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
    systemPrompt: cfg.systemPrompt,
    tools: activeTools,
    onChunk: (c) => setStreamingText((prev: string) => prev + c),
  };
  const chat = useChat(chatOpts);

  // Reset streaming tail once the stream closes.
  useEffect(() => { if (!chat.isStreaming) setStreamingText(''); }, [chat.isStreaming]);

  const tokens = useTokenCount(chat.messages);
  const hasKey = keys.some((k) => k.provider === cfg.provider);
  const templates = listTemplates();

  return (
    <Col style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: TOKENS.padNormal, gap: TOKENS.spaceSm }}>
      <Row style={{ gap: TOKENS.spaceSm, alignItems: 'center', flexWrap: 'wrap' }}>
        <Text fontSize={TOKENS.fontLg} color={COLORS.textBright} style={{ fontFamily: TOKENS.fontUI, fontWeight: 'bold' }}>AI Playground</Text>
        <Box style={{ flexGrow: 1, flexBasis: 0 }} />
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>~{tokens.total} tok · {chat.messages.length} msgs</Text>
      </Row>

      {!hasKey ? (
        <Box style={{ padding: TOKENS.padNormal, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.yellow, backgroundColor: COLORS.yellowDeep }}>
          <Text fontSize={TOKENS.fontSm} color={COLORS.yellow}>
            No API key stored for {cfg.provider}. Add one in Settings → API keys before sending.
          </Text>
        </Box>
      ) : null}

      {!streamingSupported() ? (
        <Box style={{ padding: TOKENS.padNormal, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.yellow, backgroundColor: COLORS.yellowDeep }}>
          <Text fontSize={TOKENS.fontXs} color={COLORS.yellow}>
            True token streaming requires a host __http_stream_* binding — not shipped yet. Responses currently arrive as one final message.
          </Text>
        </Box>
      ) : null}

      <Row style={{ gap: TOKENS.spaceSm, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <ProviderPicker
          provider={cfg.provider}
          model={cfg.model}
          onProvider={(p) => setCfg((c) => ({ ...c, provider: p }))}
          onModel={(m) => setCfg((c) => ({ ...c, model: m }))}
        />
        <NumField label="temp"       value={cfg.temperature} step={0.1} min={0} max={2}     onChange={(n) => setCfg((c) => ({ ...c, temperature: n }))} />
        <NumField label="max tokens" value={cfg.maxTokens}   step={128} min={1} max={200000} onChange={(n) => setCfg((c) => ({ ...c, maxTokens: n }))} />
        <Toggle label="stream" value={cfg.streaming}    onChange={(v) => setCfg((c) => ({ ...c, streaming: v }))} />
        <Toggle label="tools"  value={cfg.toolsEnabled} onChange={(v) => setCfg((c) => ({ ...c, toolsEnabled: v }))} />
      </Row>

      <Col style={{ gap: 3 }}>
        <Row style={{ gap: 6, alignItems: 'center' }}>
          <Text fontSize={9} color={COLORS.textDim} style={{ letterSpacing: 0.6, fontWeight: 'bold' }}>SYSTEM PROMPT</Text>
          <Row style={{ gap: 4, flexWrap: 'wrap' }}>
            {templates.map((t) => (
              <Pressable key={t.id} onPress={() => setCfg((c) => ({ ...c, templateId: t.id, systemPrompt: t.system || c.systemPrompt }))}>
                <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: cfg.templateId === t.id ? COLORS.blue : COLORS.borderSoft, backgroundColor: cfg.templateId === t.id ? COLORS.blueDeep : COLORS.panelAlt }}>
                  <Text fontSize={9} color={cfg.templateId === t.id ? COLORS.blue : COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>{t.title}</Text>
                </Box>
              </Pressable>
            ))}
          </Row>
        </Row>
        <TextInput
          value={cfg.systemPrompt}
          onChangeText={(v: string) => setCfg((c) => ({ ...c, systemPrompt: v }))}
          multiline={true}
          style={{ minHeight: 32, maxHeight: 80, paddingLeft: 6, paddingRight: 6, paddingTop: 4, paddingBottom: 4, borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusXs, backgroundColor: COLORS.panelBg, fontFamily: TOKENS.fontUI, fontSize: TOKENS.fontXs, color: COLORS.text }}
        />
      </Col>

      {activeTools.length ? (
        <Row style={{ gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <Text fontSize={9} color={COLORS.textDim} style={{ letterSpacing: 0.6, fontWeight: 'bold' }}>TOOLS</Text>
          {activeTools.map((t) => (
            <Box key={t.name} style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelAlt }}>
              <Text fontSize={9} color={COLORS.text} style={{ fontFamily: TOKENS.fontMono }}>{t.name}</Text>
            </Box>
          ))}
        </Row>
      ) : null}

      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, gap: TOKENS.spaceSm, alignItems: 'stretch' }}>
        <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 0 }}>
          <ChatUI
            messages={chat.messages}
            isLoading={chat.isLoading}
            isStreaming={chat.isStreaming}
            streamingText={streamingText}
            onSend={chat.send}
            onStop={chat.stop}
          />
          {chat.error ? (
            <Box style={{ marginTop: 4, padding: TOKENS.padTight, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.red, backgroundColor: COLORS.redDeep }}>
              <Text fontSize={9} color={COLORS.red} style={{ fontFamily: TOKENS.fontMono }}>{chat.error.message}</Text>
            </Box>
          ) : null}
        </Col>
        <Col style={{ width: 260, minHeight: 0 }}>
          <ScrollView style={{ flexGrow: 1, flexBasis: 0 }}>
            <Col style={{ gap: TOKENS.spaceSm }}>
              <MCPServerList />
            </Col>
          </ScrollView>
        </Col>
      </Row>
    </Col>
  );
}
