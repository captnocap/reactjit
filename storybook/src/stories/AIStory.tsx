/**
 * AI — Multi-provider LLM integration with streaming, tools, MCP, and browser automation.
 *
 * useChat() for conversations, useCompletion() for one-shots, useMCPServer() for
 * tool servers, useBrowser() for autonomous web agents. OpenAI + Anthropic providers.
 * Drop-in templates from MinimalChat to PowerChatUI.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, ExternalDependencyNotice } from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#a78bfa',
  accentDim: 'rgba(167, 139, 250, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  green: '#a6e3a1',
  red: '#f38ba8',
  blue: '#89b4fa',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
  peach: '#fab387',
  teal: '#94e2d5',
  pink: '#ec4899',
  sky: '#89dceb',
  sapphire: '#74c7ec',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import { useChat, useCompletion, useModels }
  from '@reactjit/ai'
import { AIProvider } from '@reactjit/ai'
import { useMCPServer } from '@reactjit/ai'
import { useBrowser, createBrowserTools }
  from '@reactjit/ai'`;

const CHAT_CODE = `const { messages, send, isStreaming, stop, error }
  = useChat({
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: key,
    systemPrompt: 'You are a helpful assistant.',
    onChunk: (token) => console.log(token),
  })

// Send a message — streams automatically
await send('Explain quantum computing')

// Stop mid-stream
stop()`;

const TOOLS_CODE = `const tools: ToolDefinition[] = [{
  name: 'get_weather',
  description: 'Get current weather for a city',
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string' }
    },
    required: ['city'],
  },
  execute: async ({ city }) => {
    const res = await fetch(\`/api/weather/\${city}\`)
    return res.json()
  },
}]

const { messages, send } = useChat({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: key,
  tools,
  maxToolRounds: 5,
  onToolCall: (call) =>
    console.log(\`Tool: \${call.name}\`),
})`;

const AGENTIC_LOOP_CODE = `// The agentic loop runs automatically:
//
// 1. User sends message
// 2. LLM responds (streaming)
// 3. If response has tool_calls:
//    a. Execute all calls concurrently
//    b. Format results as messages
//    c. Send back to LLM
//    d. Repeat from step 2
// 4. Stop when no tool_calls or maxToolRounds

// Under the hood:
executeToolCalls(calls, toolMap)
formatToolResults(results)
shouldContinueLoop(msg, round, max)`;

const COMPLETION_CODE = `const { completion, complete, isLoading, stop }
  = useCompletion({
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    apiKey: key,
  })

const result = await complete(
  'Translate to French: Hello world'
)
// result = "Bonjour le monde"`;

const PROVIDER_CODE = `// OpenAI + compatible (Groq, Together, Ollama...)
useChat({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_KEY,
})

// OpenAI-compatible with custom base URL
useChat({
  provider: 'openai',
  model: 'llama-3.1-70b',
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_KEY,
})

// Anthropic Messages API
useChat({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKey: process.env.ANTHROPIC_KEY,
})`;

const MCP_CODE = `const { status, tools, error, disconnect }
  = useMCPServer({
    name: 'filesystem',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-fs'],
    permissions: {
      tools: {
        read_file: { enabled: true },
        write_file: { enabled: false },
      },
    },
    onConfirm: async (name, args) => {
      // Optional user approval gate
      return window.confirm(
        \`Allow \${name}?\`
      )
    },
  })

// tools[] are ToolDefinitions — pass to useChat
const { send } = useChat({
  ...config,
  tools,
})`;

const MCP_TRANSPORTS_CODE = `// stdio — local CLI tool
useMCPServer({
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@anthropic/mcp-fs'],
})

// SSE — remote server
useMCPServer({
  transport: 'sse',
  url: 'https://mcp.example.com/sse',
  headers: { Authorization: 'Bearer ...' },
})

// Streamable HTTP — bidirectional
useMCPServer({
  transport: 'streamable-http',
  url: 'https://mcp.example.com/mcp',
})`;

const BROWSER_CODE = `const browser = useBrowser({ port: 7331 })

// Navigate and extract content
const page = await browser.navigate(
  'https://example.com'
)
console.log(page.title, page.links)

// Interact
await browser.click('#login-btn')
await browser.typeText('#email', 'me@example.com')

// Screenshot (returns base64 PNG)
const img = await browser.screenshot()

// Tab management
const tabs = await browser.listTabs()
await browser.openTab('https://docs.example.com')
await browser.useTab(1)`;

const BROWSER_TOOLS_CODE = `// 9 tools for autonomous AI browsing
const browserTools = createBrowserTools(browser)
// browser_navigate, browser_click,
// browser_type, browser_extract,
// browser_back, browser_tabs,
// browser_use_tab, browser_open_tab,
// browser_execute_js

// Wire into useChat for AI-controlled browsing
const { send } = useChat({
  ...config,
  tools: [...browserTools, ...otherTools],
})
await send('Find the pricing page and summarize it')`;

const COMPONENTS_CODE = `// Message rendering
<AIMessageList
  messages={messages}
  isStreaming={isStreaming}
/>

// Chat input wired to useChat
<AIChatInput
  send={send}
  isLoading={isLoading}
  placeholder="Ask anything..."
/>

// Model picker (fetches from provider)
<AIModelSelector
  provider="openai"
  apiKey={key}
  onChange={setModel}
/>

// Settings panel (temp, tokens, system prompt)
<AISettingsPanel
  config={config}
  onChange={setConfig}
/>

// Conversation sidebar
<AIConversationSidebar
  conversations={convos}
  activeId={activeId}
  onSelect={setActiveId}
/>

// Message with copy/delete/regenerate
<AIMessageWithActions
  message={msg}
  index={i}
  onCopy={copy}
  onRegenerate={regen}
/>`;

const TEMPLATES_CODE = `// Tier 1: Bare minimum — messages + input
<MinimalChat
  provider="anthropic"
  model="claude-haiku-4-5-20251001"
  apiKey={key}
/>

// Tier 2: Header + error banner + stop button
<SimpleChatUI
  provider="anthropic"
  model="claude-sonnet-4-20250514"
  apiKey={key}
  title="Assistant"
  showStopButton
/>

// Tier 3: Sidebar + settings + message actions
<PowerChatUI
  provider="openai"
  model="gpt-4o"
  apiKey={key}
  showSidebar
  showSettings
  showMessageActions
  conversations={convos}
  onNewChat={handleNew}
/>`;

const API_KEYS_CODE = `const { keys, setKey, deleteKey, getKey }
  = useAPIKeys()

// Persist a key (SQLite via @reactjit/storage)
await setKey({
  provider: 'anthropic',
  apiKey: 'sk-ant-...',
  label: 'Production',
})

// Retrieve by provider
const anthropicKey = getKey('anthropic')

// Delete
await deleteKey(anthropicKey.id)`;

const SSE_CODE = `// Low-level SSE parsing
const parser = new SSEParser()
const events = parser.feed(chunk)
// events: [{ event?: string, data: string }]

// HTTP streaming (uses Lua bridge)
const handle = startStream(
  url,
  { method: 'POST', headers, body, proxy },
  (data) => { /* onChunk */ },
  (status) => { /* onDone */ },
  (err) => { /* onError */ },
)`;

const CONTEXT_CODE = `// Wrap app in AIProvider for defaults
<AIProvider config={{
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKey: key,
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: 'Be concise.',
}}>
  <App />
</AIProvider>

// Children inherit defaults — override per-hook
const chat = useChat({ model: 'claude-haiku-4-5-20251001' })
const config = useAIConfig() // read context`;

// ── Hoisted data arrays ─────────────────────────────────

const FEATURES = [
  { label: 'useChat', desc: 'Streaming conversation with tool execution loop', color: C.blue },
  { label: 'useCompletion', desc: 'Single-shot text completion with streaming', color: C.teal },
  { label: 'useModels', desc: 'Fetch available models from provider', color: C.green },
  { label: 'useAPIKeys', desc: 'Persist API keys via SQLite storage adapter', color: C.yellow },
  { label: 'useBrowser', desc: 'Control stealth Firefox for web automation', color: C.peach },
  { label: 'useMCPServer', desc: 'Connect to MCP tool servers (stdio/SSE/HTTP)', color: C.mauve },
  { label: 'AIProvider', desc: 'React context for default AI config', color: C.sky },
  { label: 'SSEParser', desc: 'Server-sent events parser for streaming', color: C.sapphire },
  { label: 'createBrowserTools', desc: '9 AI tools for autonomous web browsing', color: C.pink },
  { label: 'executeToolCalls', desc: 'Concurrent tool execution + result formatting', color: C.red },
  { label: 'MCPClient', desc: 'Low-level MCP protocol client', color: C.blue },
  { label: 'estimateToolTokens', desc: 'Token budget estimation for tool definitions', color: C.teal },
];

const PROVIDERS = [
  { label: 'Anthropic', desc: 'Claude models via Messages API', color: C.mauve, models: 'claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5' },
  { label: 'OpenAI', desc: 'GPT models via Chat Completions API', color: C.green, models: 'gpt-4o, gpt-4o-mini, o1, o3' },
  { label: 'OpenAI-compatible', desc: 'Any /v1/chat/completions endpoint', color: C.peach, models: 'Groq, Together, Ollama, vLLM, LM Studio...' },
];

const COMPONENTS = [
  { label: 'AIMessageList', desc: 'Render messages with code block extraction', color: C.blue },
  { label: 'AIChatInput', desc: 'Input field wired to useChat.send()', color: C.teal },
  { label: 'AIModelSelector', desc: 'Dropdown with live model fetching', color: C.green },
  { label: 'AISettingsPanel', desc: 'Temperature, tokens, system prompt sliders', color: C.yellow },
  { label: 'AIConversationSidebar', desc: 'Conversation list with search + new chat', color: C.peach },
  { label: 'AIMessageWithActions', desc: 'Message bubble + copy/delete/regenerate', color: C.mauve },
];

const MCP_FEATURES = [
  { label: 'stdio transport', desc: 'Local CLI tools (npx, python, etc.)', color: C.blue },
  { label: 'SSE transport', desc: 'Remote servers with event streaming', color: C.teal },
  { label: 'streamable-http', desc: 'Bidirectional HTTP transport', color: C.green },
  { label: 'Permission filtering', desc: 'Whitelist/blacklist tools by name', color: C.yellow },
  { label: 'Confirm gate', desc: 'Optional user approval before execution', color: C.peach },
  { label: 'Token estimation', desc: 'Budget tool definitions against context window', color: C.mauve },
];

const BROWSER_FEATURES = [
  { label: 'navigate', desc: 'Go to URL, returns parsed page content', color: C.blue },
  { label: 'click', desc: 'Click element by CSS selector', color: C.teal },
  { label: 'typeText', desc: 'Type into input fields', color: C.green },
  { label: 'screenshot', desc: 'Capture current frame as base64 PNG', color: C.yellow },
  { label: 'executeJs', desc: 'Run arbitrary JavaScript in page context', color: C.peach },
  { label: 'listTabs / useTab', desc: 'Multi-tab management', color: C.mauve },
  { label: 'extractContent', desc: 'Re-parse current page (title, text, links, forms)', color: C.pink },
  { label: 'back / forward', desc: 'Browser history navigation', color: C.sky },
];

// ── Live Demo: Conversation Flow ────────────────────────

const DEMO_MESSAGES = [
  { role: 'user' as const, content: 'What is the capital of France?' },
  { role: 'assistant' as const, content: 'The capital of France is **Paris**. It\'s the largest city in France and serves as the country\'s political, economic, and cultural center.' },
  { role: 'user' as const, content: 'What about Germany?' },
  { role: 'assistant' as const, content: 'The capital of Germany is **Berlin**. It\'s the largest city in Germany by population and area.' },
];

function ConversationDemo() {
  const c = useThemeColors();
  const [visibleCount, setVisibleCount] = useState(0);

  const replay = useCallback(() => {
    setVisibleCount(0);
    let i = 0;
    const show = () => {
      i++;
      setVisibleCount(i);
      if (i < DEMO_MESSAGES.length) {
        setTimeout(show, 800);
      }
    };
    setTimeout(show, 400);
  }, []);

  useEffect(() => { replay(); }, []);

  const visible = DEMO_MESSAGES.slice(0, visibleCount);

  return (
    <S.StackG6W100>
      <S.RowCenterG8>
        <S.StoryCap>useChat() message flow</S.StoryCap>
        <Pressable onPress={replay}>
          <Box style={{ backgroundColor: C.blue, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: '#1e1e2e' }}>Replay</Text>
          </Box>
        </Pressable>
      </S.RowCenterG8>

      <Box style={{ backgroundColor: c.surface1, borderRadius: 6, padding: 8, gap: 6, minHeight: 80 }}>
        {visible.map((msg, i) => (
          <S.RowG6 key={i} style={{ alignItems: 'start' }}>
            <Box style={{
              width: 6, height: 6, borderRadius: 3, marginTop: 3, flexShrink: 0,
              backgroundColor: msg.role === 'user' ? C.blue : C.mauve,
            }} />
            <Box style={{ gap: 1, flexShrink: 1 }}>
              <Text style={{ fontSize: 8, color: msg.role === 'user' ? C.blue : C.mauve }}>
                {msg.role}
              </Text>
              <S.StoryBreadcrumbActive>{msg.content}</S.StoryBreadcrumbActive>
            </Box>
          </S.RowG6>
        ))}
        {visibleCount < DEMO_MESSAGES.length && (
          <S.RowCenterG4 style={{ paddingLeft: 12 }}>
            <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent }} />
            <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent, opacity: 0.6 }} />
            <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent, opacity: 0.3 }} />
          </S.RowCenterG4>
        )}
      </Box>
    </S.StackG6W100>
  );
}

// ── Live Demo: Agentic Tool Loop ────────────────────────

const TOOL_STEPS = [
  { label: 'User', text: 'What\'s the weather in Tokyo?', color: C.blue },
  { label: 'LLM', text: 'I\'ll check the weather for you.', color: C.mauve },
  { label: 'Tool Call', text: 'get_weather({ city: "Tokyo" })', color: C.yellow },
  { label: 'Tool Result', text: '{ temp: 22, condition: "Sunny" }', color: C.green },
  { label: 'LLM', text: 'It\'s 22C and sunny in Tokyo right now!', color: C.mauve },
];

function AgenticLoopDemo() {
  const c = useThemeColors();
  const [step, setStep] = useState(0);

  const replay = useCallback(() => {
    setStep(0);
    let i = 0;
    const advance = () => {
      i++;
      setStep(i);
      if (i < TOOL_STEPS.length) {
        setTimeout(advance, 600);
      }
    };
    setTimeout(advance, 400);
  }, []);

  useEffect(() => { replay(); }, []);

  return (
    <S.StackG6W100>
      <S.RowCenterG8>
        <S.StoryCap>Agentic tool execution loop</S.StoryCap>
        <Pressable onPress={replay}>
          <Box style={{ backgroundColor: C.yellow, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: '#1e1e2e' }}>Replay</Text>
          </Box>
        </Pressable>
      </S.RowCenterG8>

      <Box style={{ gap: 4 }}>
        {TOOL_STEPS.slice(0, step).map((s, i) => (
          <S.RowCenterG8 key={i}>
            <Box style={{
              width: 14, height: 14, borderRadius: 7,
              backgroundColor: s.color, alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 7, color: '#1e1e2e' }}>{`${i + 1}`}</Text>
            </Box>
            <Box style={{ gap: 1, flexShrink: 1 }}>
              <Text style={{ fontSize: 8, color: s.color }}>{s.label}</Text>
              <S.StoryBreadcrumbActive>{s.text}</S.StoryBreadcrumbActive>
            </Box>
          </S.RowCenterG8>
        ))}
        {step > 0 && step < TOOL_STEPS.length && (
          <S.RowCenterG4 style={{ paddingLeft: 22 }}>
            <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent }} />
            <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent, opacity: 0.6 }} />
            <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent, opacity: 0.3 }} />
          </S.RowCenterG4>
        )}
      </Box>
    </S.StackG6W100>
  );
}

// ── Live Demo: Provider Comparison ──────────────────────

function ProviderCatalog() {
  const c = useThemeColors();
  return (
    <S.StackG6W100>
      {PROVIDERS.map(p => (
        <Box key={p.label} style={{ backgroundColor: c.surface1, borderRadius: 6, padding: 8, gap: 4 }}>
          <S.RowCenterG6>
            <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.color, flexShrink: 0 }} />
            <Text style={{ fontSize: 10, color: p.color }}>{p.label}</Text>
          </S.RowCenterG6>
          <S.StoryBreadcrumbActive style={{ paddingLeft: 14 }}>{p.desc}</S.StoryBreadcrumbActive>
          <S.StoryTiny style={{ paddingLeft: 14 }}>{p.models}</S.StoryTiny>
        </Box>
      ))}
    </S.StackG6W100>
  );
}

// ── Live Demo: Streaming Pipeline ───────────────────────

const STREAM_STEPS = [
  { label: 'HTTP POST', desc: '/v1/messages', color: C.blue },
  { label: 'SSE chunks', desc: 'data: {"type":"content_block_delta",...}', color: C.teal },
  { label: 'SSEParser', desc: 'feed(chunk) -> SSEEvent[]', color: C.green },
  { label: 'Provider', desc: 'parseStreamChunk() -> StreamDelta', color: C.yellow },
  { label: 'useChat', desc: 'Append to message, update React state', color: C.mauve },
  { label: 'UI', desc: 'AIMessageList re-renders with new tokens', color: C.pink },
];

function StreamingPipelineDemo() {
  const c = useThemeColors();
  const [active, setActive] = useState(-1);

  const replay = useCallback(() => {
    setActive(-1);
    let i = -1;
    const advance = () => {
      i++;
      setActive(i);
      if (i < STREAM_STEPS.length - 1) {
        setTimeout(advance, 500);
      }
    };
    setTimeout(advance, 300);
  }, []);

  useEffect(() => { replay(); }, []);

  return (
    <S.StackG4W100>
      <S.RowCenterG8>
        <S.StoryCap>SSE streaming pipeline</S.StoryCap>
        <Pressable onPress={replay}>
          <Box style={{ backgroundColor: C.teal, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: '#1e1e2e' }}>Replay</Text>
          </Box>
        </Pressable>
      </S.RowCenterG8>

      {STREAM_STEPS.map((s, i) => (
        <Box key={i} style={{
          flexDirection: 'row', gap: 8, alignItems: 'center',
          opacity: i <= active ? 1 : 0.3,
        }}>
          <Box style={{
            width: 18, height: 1,
            backgroundColor: i <= active ? s.color : c.border,
          }} />
          <Box style={{ gap: 1, flexShrink: 1 }}>
            <Text style={{ fontSize: 9, color: s.color }}>{s.label}</Text>
            <S.StoryTiny>{s.desc}</S.StoryTiny>
          </Box>
        </Box>
      ))}
    </S.StackG4W100>
  );
}

// ── Live Demo: Component Catalog ────────────────────────

function ComponentCatalog() {
  const c = useThemeColors();
  return (
    <S.StackG3W100>
      {COMPONENTS.map(comp => (
        <S.RowCenterG8 key={comp.label}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: comp.color, flexShrink: 0 }} />
          <S.StoryBreadcrumbActive style={{ width: 160, flexShrink: 0 }}>{comp.label}</S.StoryBreadcrumbActive>
          <S.StoryCap>{comp.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// ── Live Demo: Template Tiers ───────────────────────────

const TEMPLATES = [
  {
    name: 'MinimalChat',
    tier: 'Tier 1',
    desc: 'Messages + input. Nothing else.',
    parts: ['AIMessageList', 'AIChatInput'],
    color: C.green,
  },
  {
    name: 'SimpleChatUI',
    tier: 'Tier 2',
    desc: 'Header, error banner, stop button.',
    parts: ['Header', 'Error Banner', 'AIMessageList', 'AIChatInput', 'Stop Button'],
    color: C.blue,
  },
  {
    name: 'PowerChatUI',
    tier: 'Tier 3',
    desc: 'Sidebar, settings panel, message actions.',
    parts: ['AIConversationSidebar', 'Header', 'AISettingsPanel', 'AIMessageWithActions', 'AIChatInput'],
    color: C.mauve,
  },
];

function TemplateTierDemo() {
  const c = useThemeColors();
  return (
    <S.StackG8W100>
      {TEMPLATES.map(t => (
        <Box key={t.name} style={{ backgroundColor: c.surface1, borderRadius: 6, padding: 8, gap: 4 }}>
          <S.RowCenterG8>
            <Box style={{ backgroundColor: t.color, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 3 }}>
              <Text style={{ fontSize: 8, color: '#1e1e2e' }}>{t.tier}</Text>
            </Box>
            <Text style={{ fontSize: 10, color: t.color }}>{t.name}</Text>
          </S.RowCenterG8>
          <S.StoryBreadcrumbActive style={{ paddingLeft: 2 }}>{t.desc}</S.StoryBreadcrumbActive>
          <S.RowWrap style={{ gap: 4, paddingLeft: 2 }}>
            {t.parts.map(p => (
              <S.PadH6 key={p} style={{ backgroundColor: c.bg, paddingTop: 2, paddingBottom: 2, borderRadius: 3 }}>
                <S.StoryTiny>{p}</S.StoryTiny>
              </S.PadH6>
            ))}
          </S.RowWrap>
        </Box>
      ))}
    </S.StackG8W100>
  );
}

// ── Live Demo: MCP Feature List ─────────────────────────

function MCPFeatureList() {
  const c = useThemeColors();
  return (
    <S.StackG3W100>
      {MCP_FEATURES.map(f => (
        <S.RowCenterG8 key={f.label}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: f.color, flexShrink: 0 }} />
          <S.StoryBreadcrumbActive style={{ width: 120, flexShrink: 0 }}>{f.label}</S.StoryBreadcrumbActive>
          <S.StoryCap>{f.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// ── Live Demo: Browser Actions ──────────────────────────

function BrowserFeatureList() {
  const c = useThemeColors();
  return (
    <S.StackG3W100>
      {BROWSER_FEATURES.map(f => (
        <S.RowCenterG8 key={f.label}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: f.color, flexShrink: 0 }} />
          <S.StoryBreadcrumbActive style={{ width: 120, flexShrink: 0 }}>{f.label}</S.StoryBreadcrumbActive>
          <S.StoryCap>{f.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// ── Feature Catalog ─────────────────────────────────────

function FeatureCatalog() {
  const c = useThemeColors();
  return (
    <S.StackG3W100>
      {FEATURES.map(f => (
        <S.RowCenterG8 key={f.label}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: f.color, flexShrink: 0 }} />
          <S.StoryBreadcrumbActive style={{ width: 150, flexShrink: 0 }}>{f.label}</S.StoryBreadcrumbActive>
          <S.StoryCap>{f.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// ── AIStory ─────────────────────────────────────────────

export function AIStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="cpu" tintColor={C.accent} />
        <S.StoryTitle>
          {'AI'}
        </S.StoryTitle>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/ai'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>
          {'LLMs, tools, agents, browsers'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Content ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <HeroBand accentColor={C.accent}>
          <S.StoryHeadline>
            {'Multi-provider LLM integration in one hook call.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'useChat() streams conversations with automatic tool execution loops. useCompletion() handles one-shots. useMCPServer() connects to any Model Context Protocol server. useBrowser() controls a stealth Firefox session for autonomous web agents. OpenAI, Anthropic, and any compatible endpoint — same API.'}
          </S.StoryMuted>
        </HeroBand>

        <Divider />

        <ExternalDependencyNotice
          detail={'Live model execution requires a user-supplied provider key or a compatible local endpoint. Until that connector exists, this page is a mock/demo shell for the integration surface and should not be read as proof of a live model session.'}
        />

        <Divider />

        {/* ── Band 1: text | code — INSTALL ── */}
        <Band>
          <Half>
            <SectionLabel icon="download" accentColor={C.accent}>{'INSTALL'}</SectionLabel>
            <S.StoryBody>
              {'Core hooks for chat and completion. Provider context for app-wide defaults. MCP integration for tool servers. Browser automation for web agents.'}
            </S.StoryBody>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={INSTALL_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 2: demo | text + code — useChat ── */}
        <Band>
          <Half>
            <ConversationDemo />
          </Half>
          <Half>
            <SectionLabel icon="message-circle" accentColor={C.accent}>{'useChat'}</SectionLabel>
            <S.StoryBody>
              {'The main hook. Returns messages, send(), streaming state, and stop(). Streams tokens via SSE with per-chunk callbacks. Handles both Anthropic and OpenAI streaming formats transparently.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Messages are updated in-place during streaming — no flicker, no rebatching. System prompt injection, partial updates, and cancellation via AbortController.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={CHAT_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 3: text + code | demo — TOOL EXECUTION ── */}
        <Band>
          <Half>
            <SectionLabel icon="terminal" accentColor={C.accent}>{'TOOL EXECUTION'}</SectionLabel>
            <S.StoryBody>
              {'Define tools with JSON Schema parameters and an execute function. useChat runs the agentic loop automatically — LLM calls tools, results go back, LLM responds. Up to maxToolRounds iterations.'}
            </S.StoryBody>
            <S.StoryCap>
              {'All tool calls in a single response execute concurrently via Promise.all. Results are formatted as tool-role messages and appended to history before the next LLM call.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={TOOLS_CODE} />
          </Half>
          <Half>
            <AgenticLoopDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: agentic loop ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'The agentic loop is fully automatic. User sends a message, LLM responds, if the response includes tool calls they execute concurrently, results feed back to the LLM, and it continues until no more tool calls or maxToolRounds (default 10). No manual orchestration needed.'}
          </S.StoryBody>
        </CalloutBand>

        <Divider />

        {/* ── Band 4: code | text — AGENTIC LOOP INTERNALS ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={AGENTIC_LOOP_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="repeat" accentColor={C.accent}>{'LOOP INTERNALS'}</SectionLabel>
            <S.StoryBody>
              {'Three utility functions power the loop. executeToolCalls() runs all calls concurrently against a tool map. formatToolResults() wraps execution results as tool-role messages. shouldContinueLoop() checks for remaining tool calls and round limits.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Refs over useState for synchronization — messagesRef, optionsRef, and abortRef track current values without triggering re-renders during the loop.'}
            </S.StoryCap>
          </Half>
        </Band>

        <Divider />

        {/* ── Band 5: demo | text + code — PROVIDERS ── */}
        <Band>
          <Half>
            <ProviderCatalog />
          </Half>
          <Half>
            <SectionLabel icon="globe" accentColor={C.accent}>{'PROVIDERS'}</SectionLabel>
            <S.StoryBody>
              {'Two built-in providers: Anthropic (Messages API) and OpenAI (Chat Completions). Any OpenAI-compatible endpoint works with a custom baseURL — Groq, Together, Ollama, vLLM, LM Studio.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Each provider implements formatRequest(), parseResponse(), parseStreamChunk(), and formatToolResult(). Streaming format differences (Anthropic events vs OpenAI deltas) are abstracted away.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={PROVIDER_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 6: text + code | demo — STREAMING ── */}
        <Band>
          <Half>
            <SectionLabel icon="zap" accentColor={C.accent}>{'STREAMING PIPELINE'}</SectionLabel>
            <S.StoryBody>
              {'Raw HTTP bytes flow through the SSEParser into provider-specific parsers that yield StreamDelta objects. Deltas carry content tokens and incremental tool call arguments. useChat assembles them into messages in real-time.'}
            </S.StoryBody>
            <S.StoryCap>
              {'startStream() uses globalThis.fetchStream — the Lua bridge handles HTTP for both Love2D and WASM targets. SSEParser handles \\n\\n and \\r\\n\\r\\n delimiters, multi-line data fields, and comment lines.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={SSE_CODE} />
          </Half>
          <Half>
            <StreamingPipelineDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 7: text | code — COMPLETION ── */}
        <Band>
          <Half>
            <SectionLabel icon="edit" accentColor={C.accent}>{'useCompletion'}</SectionLabel>
            <S.StoryBody>
              {'Single-turn text completion. No conversation history, no tool loop. Call complete() with a prompt, get a string back. Streaming with per-chunk callbacks, same as useChat.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Ideal for translation, summarization, code generation — anything where you don\'t need multi-turn context.'}
            </S.StoryCap>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={COMPLETION_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 8: code | text — CONTEXT PROVIDER ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={CONTEXT_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="layers" accentColor={C.accent}>{'AIProvider CONTEXT'}</SectionLabel>
            <S.StoryBody>
              {'Wrap your app in AIProvider to set default config for all hooks. Provider, model, API key, temperature, maxTokens, and systemPrompt propagate down. Individual hooks can override any field.'}
            </S.StoryBody>
            <S.StoryCap>
              {'useAIConfig() reads the current context value — useful for settings panels that need to display the active configuration.'}
            </S.StoryCap>
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: MCP ── */}
        <CalloutBand borderColor={'rgba(167, 139, 250, 0.25)'} bgColor={'rgba(167, 139, 250, 0.08)'}>
          <S.StoryInfoIcon src="info" tintColor={C.accent} />
          <S.StoryBody>
            {'MCP (Model Context Protocol) lets any LLM call external tools — file systems, databases, APIs, code execution. useMCPServer() handles the protocol handshake, tool discovery, and permission filtering. Tools slot directly into useChat().'}
          </S.StoryBody>
        </CalloutBand>

        <Divider />

        {/* ── Band 9: demo | text + code — MCP ── */}
        <Band>
          <Half>
            <MCPFeatureList />
          </Half>
          <Half>
            <SectionLabel icon="plug" accentColor={C.accent}>{'useMCPServer'}</SectionLabel>
            <S.StoryBody>
              {'Connect to any MCP server. Three transports: stdio for local CLI tools, SSE for remote servers, streamable-http for bidirectional HTTP. Permissions filter which tools are exposed. Optional confirm gate for user approval.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Returns ToolDefinition[] that plug directly into useChat\'s tools array. MCPClient handles the protocol — connect, list tools, call tool, close.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={MCP_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 10: text + code | demo — MCP TRANSPORTS ── */}
        <Band>
          <Half>
            <SectionLabel icon="wifi" accentColor={C.accent}>{'MCP TRANSPORTS'}</SectionLabel>
            <S.StoryBody>
              {'stdio spawns a local process and communicates over stdin/stdout — perfect for CLI tools. SSE connects to a remote server and reads events. streamable-http uses bidirectional HTTP POST for both sending and receiving.'}
            </S.StoryBody>
            <S.StoryCap>
              {'estimateToolTokens() calculates token budget per tool definition. estimateToolBudget() sums all tools and reports context window usage percentage.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={MCP_TRANSPORTS_CODE} />
          </Half>
          <Half>
            <S.StackG6W100>
              <S.StoryCap>Token estimation</S.StoryCap>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 6, padding: 8, gap: 4 }}>
                <S.RowCenterG6>
                  <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.yellow }} />
                  <S.StoryBreadcrumbActive>{'estimateToolTokens(tool)'}</S.StoryBreadcrumbActive>
                </S.RowCenterG6>
                <S.StoryTiny style={{ paddingLeft: 13 }}>{'JSON.stringify(tool).length / 4 + 20 overhead'}</S.StoryTiny>
              </Box>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 6, padding: 8, gap: 4 }}>
                <S.RowCenterG6>
                  <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.peach }} />
                  <S.StoryBreadcrumbActive>{'estimateToolBudget(tools)'}</S.StoryBreadcrumbActive>
                </S.RowCenterG6>
                <S.StoryTiny style={{ paddingLeft: 13 }}>{'{ total: number, note: "~X% of 128K context" }'}</S.StoryTiny>
              </Box>
            </S.StackG6W100>
          </Half>
        </Band>

        <Divider />

        {/* ── Band 11: demo | text + code — BROWSER ── */}
        <Band>
          <Half>
            <BrowserFeatureList />
          </Half>
          <Half>
            <SectionLabel icon="monitor" accentColor={C.accent}>{'useBrowser'}</SectionLabel>
            <S.StoryBody>
              {'Control a stealth Firefox session over TCP. Navigate, click, type, screenshot, execute JS, manage tabs. Returns parsed PageContent with title, text, links, and forms.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Connects via globalThis.browseRequest to a Lua worker thread. Default port 7331. Page text truncated to 8000 chars, links to 50 for LLM context efficiency.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={BROWSER_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 12: text + code | demo — BROWSER TOOLS ── */}
        <Band>
          <Half>
            <SectionLabel icon="compass" accentColor={C.accent}>{'BROWSER TOOLS'}</SectionLabel>
            <S.StoryBody>
              {'createBrowserTools() returns 9 ToolDefinition objects — navigate, click, type, extract, back, tabs, use_tab, open_tab, execute_js. Wire them into useChat and the AI controls the browser autonomously.'}
            </S.StoryBody>
            <S.StoryCap>
              {'The AI sees page content as structured text (title, text, links[], forms[]) — not raw HTML. This keeps token usage efficient while giving the model enough context to navigate.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={BROWSER_TOOLS_CODE} />
          </Half>
          <Half>
            <S.StackG6W100>
              <S.StoryCap>Browser tool names</S.StoryCap>
              {['browser_navigate', 'browser_click', 'browser_type', 'browser_extract', 'browser_back', 'browser_tabs', 'browser_use_tab', 'browser_open_tab', 'browser_execute_js'].map((name, i) => (
                <S.RowCenterG6 key={name}>
                  <Text style={{ fontSize: 8, color: C.accent }}>{`${i + 1}.`}</Text>
                  <Box style={{ backgroundColor: c.surface1, borderRadius: 3, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
                    <Text style={{ fontSize: 9, color: C.peach }}>{name}</Text>
                  </Box>
                </S.RowCenterG6>
              ))}
            </S.StackG6W100>
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: components ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'6 composable components build any chat interface. 3 drop-in templates go from zero to working UI in one JSX tag. MinimalChat for prototypes, SimpleChatUI for clean apps, PowerChatUI for full-featured products.'}
          </S.StoryBody>
        </CalloutBand>

        <Divider />

        {/* ── Band 13: demo | text + code — COMPONENTS ── */}
        <Band>
          <Half>
            <ComponentCatalog />
          </Half>
          <Half>
            <SectionLabel icon="box" accentColor={C.accent}>{'COMPONENTS'}</SectionLabel>
            <S.StoryBody>
              {'Six composable building blocks. AIMessageList renders conversations with automatic code block extraction. AIChatInput wires to useChat.send(). AIModelSelector fetches live model lists. AISettingsPanel controls temperature, tokens, and system prompts.'}
            </S.StoryBody>
            <S.StoryCap>
              {'AIConversationSidebar manages multiple conversations with search. AIMessageWithActions adds copy, delete, and regenerate to each message bubble.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={COMPONENTS_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 14: text + code | demo — TEMPLATES ── */}
        <Band>
          <Half>
            <SectionLabel icon="layout" accentColor={C.accent}>{'TEMPLATES'}</SectionLabel>
            <S.StoryBody>
              {'Three tiers of drop-in chat UIs. MinimalChat is messages + input — nothing else. SimpleChatUI adds a header, error banner, and stop button. PowerChatUI adds a conversation sidebar, settings panel, and message actions.'}
            </S.StoryBody>
            <S.StoryCap>
              {'All templates accept ChatOptions — they call useChat() internally. Customize via props: title, placeholder, accentColor, renderMessage, callbacks for sidebar events.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={TEMPLATES_CODE} />
          </Half>
          <Half>
            <TemplateTierDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 15: code | text — API KEYS ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={API_KEYS_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="key" accentColor={C.accent}>{'API KEY MANAGEMENT'}</SectionLabel>
            <S.StoryBody>
              {'useAPIKeys() persists API keys via the @reactjit/storage adapter (SQLite). Set, get, and delete keys by provider. Each key record includes provider type, label, optional baseURL, and model list.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Keys are stored in the ai_keys collection. Falls back to in-memory storage if no storage adapter is available. Key IDs are generated as {provider}_{timestamp36}.'}
            </S.StoryCap>
          </Half>
        </Band>

        <Divider />

        {/* ── Full-width: Feature Catalog ── */}
        <S.StoryFullBand>
          <SectionLabel icon="list" accentColor={C.accent}>{'FULL API SURFACE'}</SectionLabel>
          <S.StoryCap>{'Every export from @reactjit/ai:'}</S.StoryCap>
          <FeatureCatalog />
        </S.StoryFullBand>

        <Divider />

        {/* ── Final callout ── */}
        <CalloutBand borderColor={'rgba(167, 139, 250, 0.25)'} bgColor={'rgba(167, 139, 250, 0.08)'}>
          <S.StoryInfoIcon src="info" tintColor={C.accent} />
          <S.StoryBody>
            {'One hook to chat. One hook to browse. One hook to connect tool servers. Same API for OpenAI and Anthropic. Templates go from zero to production UI in a single JSX tag. The AI doesn\'t need to know about SSE parsing, provider differences, or protocol handshakes — just useChat() and send().'}
          </S.StoryBody>
        </CalloutBand>

      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="cpu" />
        <S.StoryBreadcrumbActive>{'AI'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
