// browse-agent — local llama (Qwen3.5-9B-HauhauCS) drives an embedded
// Firefox via the browse stealth session. Three panes:
//
//   left   — chat transcript + input + tool-call breadcrumbs
//   right  — live Firefox window (rendered via <Render renderSrc="app:browse">)
//
// The model receives the browse_* tools through useLocalChat({tools: ...}).
// When it emits a TOOL_CALL, the worker pauses, useLocalChat's dispatcher
// looks up the registered handler (createBrowseTools() supplies them all),
// runs it (which round-trips through the Zig browse_bridge → browse TCP
// session → Selenium → Firefox), and posts the result back. Worker resumes
// generation; user sees the browser navigate live in the right pane.
//
// Run:
//   ./scripts/ship browse-agent
//   ./zig-out/bin/browse-agent
//
// Notes:
// - Hardcoded model path (Qwen3.5 because of the XML tool-call format
//   covered by the Hauhaucs fallback parser; vanilla Qwen3 / Hermes /
//   Mistral / Llama-3.1 work without the fallback).
// - Browse runs on port 7332 (separate from the user's main `browse`
//   on 7331 if any) under Xvfb via the app: Render scheme.

import { useEffect, useMemo, useState } from 'react';
import { Box, Row, Col, Text, Pressable, TextInput, ScrollView, Render } from '@reactjit/runtime/primitives';
import { useLocalChat } from '@reactjit/runtime/hooks/useLocalChat';
import { createBrowseTools, setBrowsePort } from '@reactjit/runtime/hooks/useBrowse';

const MODEL = '/home/siah/.lmstudio/models/HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q8_0.gguf';
const BROWSE_PORT = 7332;
const RENDER_SRC = `app:browse --port ${BROWSE_PORT} --disposable`;

const SYSTEM_PRELUDE = [
  'You are a web-browsing assistant with access to a real Firefox browser via tools:',
  '  browser_navigate(url) — visit a URL, returns rendered page text',
  '  browser_click(selector) — click an element',
  '  browser_type(selector, text) — type into an input',
  '  browser_extract() — re-extract current page',
  'When the user asks about a website, USE the tools — do not invent content.',
  'Be concise. After tools return, give a short answer.',
].join('\n');

interface Turn {
  role: 'user' | 'assistant' | 'tool' | 'error';
  text: string;
}

export default function App() {
  const [prompt, setPrompt] = useState('navigate to https://example.com and tell me the page title');
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [suspended, setSuspended] = useState(false);
  const [firstTurn, setFirstTurn] = useState(true);

  useEffect(() => { setBrowsePort(BROWSE_PORT); }, []);
  const tools = useMemo(() => createBrowseTools() as any, []);
  // Big context — extracted page content from browser_extract is fat,
  // and a multi-turn agent loop blows past 8k after one or two pages.
  // 65k is comfortable on 12GB+ VRAM with this Q8 model.
  const chat = useLocalChat({ model: MODEL, tools, nCtx: 65536 });

  // Mirror tool calls into the transcript as they happen
  useEffect(() => {
    if (chat.toolCalls.length === 0) return;
    setTranscript((tr) => {
      const have = new Set(tr.filter(t => t.role === 'tool').map(t => t.text));
      const news = chat.toolCalls
        .map(tc => ({ role: 'tool' as const, text: `${tc.name}(${JSON.stringify(tc.args)})` }))
        .filter(t => !have.has(t.text));
      return news.length > 0 ? [...tr, ...news] : tr;
    });
  }, [chat.toolCalls]);

  async function send() {
    if (chat.phase === 'generating') return;
    if (!prompt.trim()) return;
    const user = prompt.trim();
    setPrompt('');
    chat.clearToolCalls();
    setTranscript((t) => [...t, { role: 'user', text: user }]);
    const inject = firstTurn ? `${SYSTEM_PRELUDE}\n\nUser: ${user}` : user;
    setFirstTurn(false);
    try {
      const reply = await chat.ask(inject);
      setTranscript((t) => [...t, { role: 'assistant', text: reply }]);
    } catch (e: any) {
      setTranscript((t) => [...t, { role: 'error', text: e?.message || String(e) }]);
    }
  }

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f0f1a' }}>
      <Row style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12, gap: 12, backgroundColor: '#181825', alignItems: 'center' }}>
        <Text style={{ color: '#cdd6f4', fontSize: 13, fontWeight: 'bold' }}>browse-agent</Text>
        <Text style={{ color: '#6c7086', fontSize: 11 }}>
          {`local llama: ${chat.phase}${chat.lastStatus ? ' · ' + chat.lastStatus : ''}`}
        </Text>
      </Row>

      <Row style={{ flexGrow: 1, gap: 4, padding: 4 }}>
        {/* Left: chat */}
        <Col style={{ flexGrow: 1, flexBasis: 0, gap: 6, backgroundColor: '#11111b', borderRadius: 4, padding: 8 }}>
          <Text style={{ color: '#89b4fa', fontSize: 11, fontWeight: 'bold' }}>chat</Text>

          <ScrollView style={{ flexGrow: 1, backgroundColor: '#1e1e2e', borderRadius: 3, padding: 6 }}>
            {transcript.map((t, i) => (
              <Row key={i} style={{ paddingTop: 4, paddingBottom: 4, gap: 6, alignItems: 'flex-start' }}>
                <Text style={{
                  color: t.role === 'user' ? '#f9e2af'
                       : t.role === 'assistant' ? '#a6e3a1'
                       : t.role === 'tool' ? '#74c7ec'
                       : '#f38ba8',
                  fontSize: 11, fontWeight: 'bold', minWidth: 70,
                }}>{t.role}</Text>
                <Text style={{ color: '#cdd6f4', fontSize: 11, flexGrow: 1 }}>{t.text}</Text>
              </Row>
            ))}
            {chat.streaming ? (
              <Row style={{ paddingTop: 4, paddingBottom: 4, gap: 6, alignItems: 'flex-start' }}>
                <Text style={{ color: '#a6e3a1', fontSize: 11, fontWeight: 'bold', minWidth: 70 }}>assistant…</Text>
                <Text style={{ color: '#bac2de', fontSize: 11, flexGrow: 1 }}>{chat.streaming}</Text>
              </Row>
            ) : null}
          </ScrollView>

          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            style={{
              backgroundColor: '#1e1e2e', color: '#cdd6f4',
              borderWidth: 1, borderColor: '#313244', borderRadius: 3,
              paddingTop: 6, paddingBottom: 6, paddingLeft: 8, paddingRight: 8,
              fontSize: 12,
            }}
          />
          <Row style={{ gap: 4 }}>
            <Pressable
              onPress={send}
              style={{
                paddingTop: 6, paddingBottom: 6, paddingLeft: 14, paddingRight: 14,
                borderRadius: 3,
                backgroundColor: chat.phase === 'generating' ? '#45475a' : '#89b4fa',
              }}
            >
              <Text style={{ color: chat.phase === 'generating' ? '#9399b2' : '#0f0f1a', fontSize: 11, fontWeight: 'bold' }}>
                {chat.phase === 'generating' ? 'generating…' : 'send'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setTranscript([]); chat.clearToolCalls(); setFirstTurn(true); }}
              style={{
                paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10,
                borderRadius: 3,
                backgroundColor: '#313244',
              }}
            >
              <Text style={{ color: '#cdd6f4', fontSize: 11 }}>clear</Text>
            </Pressable>
          </Row>
        </Col>

        {/* Right: embedded Firefox */}
        <Col style={{
          flexGrow: 1, flexBasis: 0,
          borderWidth: 1, borderColor: '#2a2a4a', borderRadius: 4, overflow: 'hidden',
          backgroundColor: '#000',
        }}>
          <Row style={{ paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8, backgroundColor: '#181825', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: '#89b4fa', fontSize: 11, fontWeight: 'bold', flexGrow: 1 }}>
              firefox (browse stealth · port {BROWSE_PORT})
            </Text>
            <Pressable
              onPress={() => setSuspended((s) => !s)}
              style={{
                paddingTop: 2, paddingBottom: 2, paddingLeft: 8, paddingRight: 8,
                borderRadius: 3,
                backgroundColor: suspended ? '#f9e2af' : '#2a2a4a',
              }}
            >
              <Text style={{ color: suspended ? '#0f0f1a' : '#cdd6f4', fontSize: 10 }}>
                {suspended ? 'resume' : 'suspend'}
              </Text>
            </Pressable>
          </Row>
          <Render
            renderSrc={RENDER_SRC}
            renderSuspended={suspended}
            style={{ flexGrow: 1, width: '100%' }}
          />
        </Col>
      </Row>
    </Box>
  );
}
