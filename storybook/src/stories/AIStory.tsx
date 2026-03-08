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
    <Box style={{ gap: 6, width: '100%' }}>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <S.StoryCap>useChat() message flow</S.StoryCap>
        <Pressable onPress={replay}>
          <Box style={{ backgroundColor: C.blue, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: '#1e1e2e' }}>Replay</Text>
          </Box>
        </Pressable>
      </Box>

      <Box style={{ backgroundColor: c.surface1, borderRadius: 6, padding: 8, gap: 6, minHeight: 80 }}>
        {visible.map((msg, i) => (
          <Box key={i} style={{
            flexDirection: 'row',
            gap: 6,
            alignItems: 'start',
          }}>
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
          </Box>
        ))}
        {visibleCount < DEMO_MESSAGES.length && (
          <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center', paddingLeft: 12 }}>
            <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent }} />
            <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent, opacity: 0.6 }} />
            <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent, opacity: 0.3 }} />
          </Box>
        )}
      </Box>
    </Box>
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
    <Box style={{ gap: 6, width: '100%' }}>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <S.StoryCap>Agentic tool execution loop</S.StoryCap>
        <Pressable onPress={replay}>
          <Box style={{ backgroundColor: C.yellow, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: '#1e1e2e' }}>Replay</Text>
          </Box>
        </Pressable>
      </Box>

      <Box style={{ gap: 4 }}>
        {TOOL_STEPS.slice(0, step).map((s, i) => (
          <Box key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
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
          </Box>
        ))}
        {step > 0 && step < TOOL_STEPS.length && (
          <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center', paddingLeft: 22 }}>
            <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent }} />
            <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent, opacity: 0.6 }} />
            <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent, opacity: 0.3 }} />
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ── Live Demo: Provider Comparison ──────────────────────

function ProviderCatalog() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 6, width: '100%' }}>
      {PROVIDERS.map(p => (
        <Box key={p.label} style={{ backgroundColor: c.surface1, borderRadius: 6, padding: 8, gap: 4 }}>
          <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.color, flexShrink: 0 }} />
            <Text style={{ fontSize: 10, color: p.color }}>{p.label}</Text>
          </Box>
          <Text style={{ fontSize: 9, color: c.text, paddingLeft: 14 }}>{p.desc}</Text>
          <Text style={{ fontSize: 8, color: c.muted, paddingLeft: 14 }}>{p.models}</Text>
        </Box>
      ))}
    </Box>
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
    <Box style={{ gap: 4, width: '100%' }}>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <S.StoryCap>SSE streaming pipeline</S.StoryCap>
        <Pressable onPress={replay}>
          <Box style={{ backgroundColor: C.teal, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: '#1e1e2e' }}>Replay</Text>
          </Box>
        </Pressable>
      </Box>

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
    </Box>
  );
}

// ── Live Demo: Component Catalog ────────────────────────

function ComponentCatalog() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 3, width: '100%' }}>
      {COMPONENTS.map(comp => (
        <Box key={comp.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: comp.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 9, color: c.text, width: 160, flexShrink: 0 }}>{comp.label}</Text>
          <S.StoryCap>{comp.desc}</S.StoryCap>
        </Box>
      ))}
    </Box>
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
    <Box style={{ gap: 8, width: '100%' }}>
      {TEMPLATES.map(t => (
        <Box key={t.name} style={{ backgroundColor: c.surface1, borderRadius: 6, padding: 8, gap: 4 }}>
          <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Box style={{ backgroundColor: t.color, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 3 }}>
              <Text style={{ fontSize: 8, color: '#1e1e2e' }}>{t.tier}</Text>
            </Box>
            <Text style={{ fontSize: 10, color: t.color }}>{t.name}</Text>
          </Box>
          <Text style={{ fontSize: 9, color: c.text, paddingLeft: 2 }}>{t.desc}</Text>
          <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', paddingLeft: 2 }}>
            {t.parts.map(p => (
              <Box key={p} style={{ backgroundColor: c.bg, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 3 }}>
                <S.StoryTiny>{p}</S.StoryTiny>
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// ── Live Demo: MCP Feature List ─────────────────────────

function MCPFeatureList() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 3, width: '100%' }}>
      {MCP_FEATURES.map(f => (
        <Box key={f.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: f.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 9, color: c.text, width: 120, flexShrink: 0 }}>{f.label}</Text>
          <S.StoryCap>{f.desc}</S.StoryCap>
        </Box>
      ))}
    </Box>
  );
}

// ── Live Demo: Browser Actions ──────────────────────────

function BrowserFeatureList() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 3, width: '100%' }}>
      {BROWSER_FEATURES.map(f => (
        <Box key={f.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: f.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 9, color: c.text, width: 120, flexShrink: 0 }}>{f.label}</Text>
          <S.StoryCap>{f.desc}</S.StoryCap>
        </Box>
      ))}
    </Box>
  );
}

// ── Feature Catalog ─────────────────────────────────────

function FeatureCatalog() {
  const c = useThemeColors();
  return (
    <Box style={{ gap: 3, width: '100%' }}>
      {FEATURES.map(f => (
        <Box key={f.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: f.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 9, color: c.text, width: 150, flexShrink: 0 }}>{f.label}</Text>
          <S.StoryCap>{f.desc}</S.StoryCap>
        </Box>
      ))}
    </Box>
  );
}

// ── AIStory ─────────────────────────────────────────────

export function AIStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="cpu" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'AI'}
        </Text>
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
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'LLMs, tools, agents, browsers'}
        </Text>
      </Box>

      {/* ── Content ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <HeroBand accentColor={C.accent}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'Multi-provider LLM integration in one hook call.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'useChat() streams conversations with automatic tool execution loops. useCompletion() handles one-shots. useMCPServer() connects to any Model Context Protocol server. useBrowser() controls a stealth Firefox session for autonomous web agents. OpenAI, Anthropic, and any compatible endpoint — same API.'}
          </Text>
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
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Core hooks for chat and completion. Provider context for app-wide defaults. MCP integration for tool servers. Browser automation for web agents.'}
            </Text>
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
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'The main hook. Returns messages, send(), streaming state, and stop(). Streams tokens via SSE with per-chunk callbacks. Handles both Anthropic and OpenAI streaming formats transparently.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Messages are updated in-place during streaming — no flicker, no rebatching. System prompt injection, partial updates, and cancellation via AbortController.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={CHAT_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 3: text + code | demo — TOOL EXECUTION ── */}
        <Band>
          <Half>
            <SectionLabel icon="terminal" accentColor={C.accent}>{'TOOL EXECUTION'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Define tools with JSON Schema parameters and an execute function. useChat runs the agentic loop automatically — LLM calls tools, results go back, LLM responds. Up to maxToolRounds iterations.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'All tool calls in a single response execute concurrently via Promise.all. Results are formatted as tool-role messages and appended to history before the next LLM call.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={TOOLS_CODE} />
          </Half>
          <Half>
            <AgenticLoopDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: agentic loop ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'The agentic loop is fully automatic. User sends a message, LLM responds, if the response includes tool calls they execute concurrently, results feed back to the LLM, and it continues until no more tool calls or maxToolRounds (default 10). No manual orchestration needed.'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* ── Band 4: code | text — AGENTIC LOOP INTERNALS ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={AGENTIC_LOOP_CODE} />
          </Half>
          <Half>
            <SectionLabel icon="repeat" accentColor={C.accent}>{'LOOP INTERNALS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Three utility functions power the loop. executeToolCalls() runs all calls concurrently against a tool map. formatToolResults() wraps execution results as tool-role messages. shouldContinueLoop() checks for remaining tool calls and round limits.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Refs over useState for synchronization — messagesRef, optionsRef, and abortRef track current values without triggering re-renders during the loop.'}
            </Text>
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
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Two built-in providers: Anthropic (Messages API) and OpenAI (Chat Completions). Any OpenAI-compatible endpoint works with a custom baseURL — Groq, Together, Ollama, vLLM, LM Studio.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Each provider implements formatRequest(), parseResponse(), parseStreamChunk(), and formatToolResult(). Streaming format differences (Anthropic events vs OpenAI deltas) are abstracted away.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={PROVIDER_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 6: text + code | demo — STREAMING ── */}
        <Band>
          <Half>
            <SectionLabel icon="zap" accentColor={C.accent}>{'STREAMING PIPELINE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Raw HTTP bytes flow through the SSEParser into provider-specific parsers that yield StreamDelta objects. Deltas carry content tokens and incremental tool call arguments. useChat assembles them into messages in real-time.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'startStream() uses globalThis.fetchStream — the Lua bridge handles HTTP for both Love2D and WASM targets. SSEParser handles \\n\\n and \\r\\n\\r\\n delimiters, multi-line data fields, and comment lines.'}
            </Text>
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
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Single-turn text completion. No conversation history, no tool loop. Call complete() with a prompt, get a string back. Streaming with per-chunk callbacks, same as useChat.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Ideal for translation, summarization, code generation — anything where you don\'t need multi-turn context.'}
            </Text>
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
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Wrap your app in AIProvider to set default config for all hooks. Provider, model, API key, temperature, maxTokens, and systemPrompt propagate down. Individual hooks can override any field.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'useAIConfig() reads the current context value — useful for settings panels that need to display the active configuration.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: MCP ── */}
        <CalloutBand borderColor={'rgba(167, 139, 250, 0.25)'} bgColor={'rgba(167, 139, 250, 0.08)'}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.accent} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'MCP (Model Context Protocol) lets any LLM call external tools — file systems, databases, APIs, code execution. useMCPServer() handles the protocol handshake, tool discovery, and permission filtering. Tools slot directly into useChat().'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* ── Band 9: demo | text + code — MCP ── */}
        <Band>
          <Half>
            <MCPFeatureList />
          </Half>
          <Half>
            <SectionLabel icon="plug" accentColor={C.accent}>{'useMCPServer'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Connect to any MCP server. Three transports: stdio for local CLI tools, SSE for remote servers, streamable-http for bidirectional HTTP. Permissions filter which tools are exposed. Optional confirm gate for user approval.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Returns ToolDefinition[] that plug directly into useChat\'s tools array. MCPClient handles the protocol — connect, list tools, call tool, close.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={MCP_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 10: text + code | demo — MCP TRANSPORTS ── */}
        <Band>
          <Half>
            <SectionLabel icon="wifi" accentColor={C.accent}>{'MCP TRANSPORTS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'stdio spawns a local process and communicates over stdin/stdout — perfect for CLI tools. SSE connects to a remote server and reads events. streamable-http uses bidirectional HTTP POST for both sending and receiving.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'estimateToolTokens() calculates token budget per tool definition. estimateToolBudget() sums all tools and reports context window usage percentage.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={MCP_TRANSPORTS_CODE} />
          </Half>
          <Half>
            <Box style={{ gap: 6, width: '100%' }}>
              <Text style={{ fontSize: 9, color: c.muted }}>Token estimation</Text>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 6, padding: 8, gap: 4 }}>
                <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.yellow }} />
                  <Text style={{ fontSize: 9, color: c.text }}>{'estimateToolTokens(tool)'}</Text>
                </Box>
                <Text style={{ fontSize: 8, color: c.muted, paddingLeft: 13 }}>{'JSON.stringify(tool).length / 4 + 20 overhead'}</Text>
              </Box>
              <Box style={{ backgroundColor: c.surface1, borderRadius: 6, padding: 8, gap: 4 }}>
                <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.peach }} />
                  <Text style={{ fontSize: 9, color: c.text }}>{'estimateToolBudget(tools)'}</Text>
                </Box>
                <Text style={{ fontSize: 8, color: c.muted, paddingLeft: 13 }}>{'{ total: number, note: "~X% of 128K context" }'}</Text>
              </Box>
            </Box>
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
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Control a stealth Firefox session over TCP. Navigate, click, type, screenshot, execute JS, manage tabs. Returns parsed PageContent with title, text, links, and forms.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Connects via globalThis.browseRequest to a Lua worker thread. Default port 7331. Page text truncated to 8000 chars, links to 50 for LLM context efficiency.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={BROWSER_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 12: text + code | demo — BROWSER TOOLS ── */}
        <Band>
          <Half>
            <SectionLabel icon="compass" accentColor={C.accent}>{'BROWSER TOOLS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'createBrowserTools() returns 9 ToolDefinition objects — navigate, click, type, extract, back, tabs, use_tab, open_tab, execute_js. Wire them into useChat and the AI controls the browser autonomously.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'The AI sees page content as structured text (title, text, links[], forms[]) — not raw HTML. This keeps token usage efficient while giving the model enough context to navigate.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={BROWSER_TOOLS_CODE} />
          </Half>
          <Half>
            <Box style={{ gap: 6, width: '100%' }}>
              <Text style={{ fontSize: 9, color: c.muted }}>Browser tool names</Text>
              {['browser_navigate', 'browser_click', 'browser_type', 'browser_extract', 'browser_back', 'browser_tabs', 'browser_use_tab', 'browser_open_tab', 'browser_execute_js'].map((name, i) => (
                <Box key={name} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Text style={{ fontSize: 8, color: C.accent }}>{`${i + 1}.`}</Text>
                  <Box style={{ backgroundColor: c.surface1, borderRadius: 3, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2 }}>
                    <Text style={{ fontSize: 9, color: C.peach }}>{name}</Text>
                  </Box>
                </Box>
              ))}
            </Box>
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: components ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'6 composable components build any chat interface. 3 drop-in templates go from zero to working UI in one JSX tag. MinimalChat for prototypes, SimpleChatUI for clean apps, PowerChatUI for full-featured products.'}
          </Text>
        </CalloutBand>

        <Divider />

        {/* ── Band 13: demo | text + code — COMPONENTS ── */}
        <Band>
          <Half>
            <ComponentCatalog />
          </Half>
          <Half>
            <SectionLabel icon="box" accentColor={C.accent}>{'COMPONENTS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Six composable building blocks. AIMessageList renders conversations with automatic code block extraction. AIChatInput wires to useChat.send(). AIModelSelector fetches live model lists. AISettingsPanel controls temperature, tokens, and system prompts.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'AIConversationSidebar manages multiple conversations with search. AIMessageWithActions adds copy, delete, and regenerate to each message bubble.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} style={{ width: '100%' }} code={COMPONENTS_CODE} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 14: text + code | demo — TEMPLATES ── */}
        <Band>
          <Half>
            <SectionLabel icon="layout" accentColor={C.accent}>{'TEMPLATES'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Three tiers of drop-in chat UIs. MinimalChat is messages + input — nothing else. SimpleChatUI adds a header, error banner, and stop button. PowerChatUI adds a conversation sidebar, settings panel, and message actions.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'All templates accept ChatOptions — they call useChat() internally. Customize via props: title, placeholder, accentColor, renderMessage, callbacks for sidebar events.'}
            </Text>
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
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'useAPIKeys() persists API keys via the @reactjit/storage adapter (SQLite). Set, get, and delete keys by provider. Each key record includes provider type, label, optional baseURL, and model list.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Keys are stored in the ai_keys collection. Falls back to in-memory storage if no storage adapter is available. Key IDs are generated as {provider}_{timestamp36}.'}
            </Text>
          </Half>
        </Band>

        <Divider />

        {/* ── Full-width: Feature Catalog ── */}
        <Box style={{
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 24,
          gap: 8,
        }}>
          <SectionLabel icon="list" accentColor={C.accent}>{'FULL API SURFACE'}</SectionLabel>
          <Text style={{ color: c.muted, fontSize: 9 }}>{'Every export from @reactjit/ai:'}</Text>
          <FeatureCatalog />
        </Box>

        <Divider />

        {/* ── Final callout ── */}
        <CalloutBand borderColor={'rgba(167, 139, 250, 0.25)'} bgColor={'rgba(167, 139, 250, 0.08)'}>
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.accent} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'One hook to chat. One hook to browse. One hook to connect tool servers. Same API for OpenAI and Anthropic. Templates go from zero to production UI in a single JSX tag. The AI doesn\'t need to know about SSE parsing, provider differences, or protocol handshakes — just useChat() and send().'}
          </Text>
        </CalloutBand>

      </ScrollView>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Packages'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="cpu" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'AI'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </S.StoryRoot>
  );
}
