import React, { useState, useCallback } from 'react';
import {
  Box, Text, Pressable, ScrollView, Native,
  MessageList, MessageBubble, ChatInput, CodeBlock, LoadingDots,
} from '@reactjit/core';
import { useBridge } from '@reactjit/core';

// ── Types ────────────────────────────────────────────────────────────

interface Msg {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolName?: string;
  toolInput?: string;
}

// ── Colors (one place, no naked hex in styles) ───────────────────────

const C = {
  bg:          '#0f172a',
  surface:     '#1e293b',
  surfaceAlt:  '#334155',
  border:      '#475569',
  text:        '#e2e8f0',
  textDim:     '#94a3b8',
  textMuted:   '#64748b',
  primary:     '#2563eb',
  primaryHov:  '#3b82f6',
  accent:      '#8b5cf6',
  error:       '#ef4444',
  success:     '#22c55e',
  tool:        '#0d9488',
  userBubble:  '#2563eb',
  aiBubble:    '#1e293b',
  systemBg:    '#1a1a2e',
};

// ── Status badge ─────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'streaming' ? C.success :
    status === 'running'   ? C.primary :
    status === 'starting'  ? C.accent :
    status === 'stopped'   ? C.error :
    C.textMuted;

  return (
    <Box style={{
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: color,
    }} />
  );
}

// ── Tool call display ────────────────────────────────────────────────

function ToolMessage({ msg }: { msg: Msg }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box style={{ alignSelf: 'start', maxWidth: '90%', gap: 2 }}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        {({ hovered }) => (
          <Box style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 4,
            paddingBottom: 4,
            backgroundColor: hovered ? C.surfaceAlt : 'transparent',
            borderRadius: 4,
          }}>
            <Text style={{ fontSize: 11, color: C.tool, fontWeight: 'bold' }}>
              {msg.toolName || 'tool'}
            </Text>
            <Text style={{ fontSize: 11, color: C.textMuted }}>
              {expanded ? 'v' : '>'}
            </Text>
          </Box>
        )}
      </Pressable>
      {expanded && msg.toolInput ? (
        <Box style={{ paddingLeft: 10 }}>
          <CodeBlock
            code={msg.toolInput}
            language="json"
            fontSize={10}
            style={{ maxHeight: 200 }}
          />
        </Box>
      ) : null}
    </Box>
  );
}

// ── App ──────────────────────────────────────────────────────────────

export function App() {
  const bridge = useBridge();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState('');
  const [status, setStatus] = useState('idle');
  const [model, setModel] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');

  // ── Event handlers from Lua capability ───────────────────────────

  const onSystemInit = useCallback((e: any) => {
    setModel(e.model || '');
    setSessionId(e.sessionId || '');
    setMessages(prev => [...prev, {
      id: `sys-${Date.now()}`,
      role: 'system',
      content: `Connected to ${e.model || 'claude'}`,
    }]);
  }, []);

  const onTextDelta = useCallback((e: any) => {
    setStreaming(e.fullText || '');
  }, []);

  const onTextDone = useCallback((e: any) => {
    setMessages(prev => [...prev, {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: e.text || '',
    }]);
    setStreaming('');
  }, []);

  const onToolUse = useCallback((e: any) => {
    let inputStr = '';
    if (e.input) {
      try { inputStr = JSON.stringify(e.input, null, 2); }
      catch { inputStr = String(e.input); }
    }
    setMessages(prev => [...prev, {
      id: `tool-${Date.now()}-${Math.random()}`,
      role: 'tool',
      content: e.name || 'tool',
      toolName: e.name,
      toolInput: inputStr,
    }]);
  }, []);

  const onError = useCallback((e: any) => {
    setError(e.error || 'Unknown error');
    setMessages(prev => [...prev, {
      id: `err-${Date.now()}`,
      role: 'system',
      content: `Error: ${e.error || 'Unknown error'}`,
    }]);
  }, []);

  const onStatusChange = useCallback((e: any) => {
    setStatus(e.status || 'idle');
  }, []);

  // ── Send message ─────────────────────────────────────────────────

  const handleSend = useCallback(async (text: string) => {
    // Add user message to chat
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }]);
    setError('');

    // Send to Lua via RPC
    try {
      await bridge.rpc('claude:send', { message: text });
    } catch (err: any) {
      setError(err?.message || 'Failed to send');
    }
  }, [bridge]);

  // ── Stop ─────────────────────────────────────────────────────────

  const handleStop = useCallback(async () => {
    try { await bridge.rpc('claude:stop'); } catch {}
  }, [bridge]);

  // ── Render ───────────────────────────────────────────────────────

  const isBusy = status === 'running' || status === 'streaming' || status === 'starting';

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg }}>

      {/* Invisible capability node — wires Lua events to React handlers */}
      <Native
        type="ClaudeCode"
        workingDir="/home/siah/creative/reactjit"
        model="sonnet"
        onSystemInit={onSystemInit}
        onTextDelta={onTextDelta}
        onTextDone={onTextDone}
        onToolUse={onToolUse}
        onError={onError}
        onStatusChange={onStatusChange}
      />

      {/* ── Header ──────────────────────────────────────────────── */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 10,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderColor: C.border,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: C.text }}>
            Claude Code
          </Text>
          {model ? (
            <Text style={{ fontSize: 11, color: C.textMuted }}>
              {model}
            </Text>
          ) : null}
        </Box>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StatusDot status={status} />
          <Text style={{ fontSize: 11, color: C.textDim }}>
            {status}
          </Text>
          {isBusy ? (
            <Pressable onPress={handleStop}>
              {({ hovered }) => (
                <Box style={{
                  paddingLeft: 8, paddingRight: 8,
                  paddingTop: 3, paddingBottom: 3,
                  backgroundColor: hovered ? C.error : C.surfaceAlt,
                  borderRadius: 4,
                }}>
                  <Text style={{ fontSize: 10, color: C.text }}>
                    Stop
                  </Text>
                </Box>
              )}
            </Pressable>
          ) : null}
        </Box>
      </Box>

      {/* ── Messages ────────────────────────────────────────────── */}
      {/* rjit-ignore-next-line */}
      <MessageList
        padding={12}
        gap={6}
        style={{ flexGrow: 1 }}
        emptyContent={
          <Box style={{ alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
            <Text style={{ fontSize: 14, color: C.textMuted }}>
              Send a message to start
            </Text>
          </Box>
        }
      >
        {messages.map((msg) => {
          if (msg.role === 'tool') {
            return <ToolMessage key={msg.id} msg={msg} />;
          }
          if (msg.role === 'system') {
            return (
              <MessageBubble
                key={msg.id}
                variant="center"
                bg={C.systemBg}
                color={C.textMuted}
                fontSize={11}
              >
                {msg.content}
              </MessageBubble>
            );
          }
          return (
            <MessageBubble
              key={msg.id}
              variant={msg.role === 'user' ? 'right' : 'left'}
              bg={msg.role === 'user' ? C.userBubble : C.aiBubble}
              color={C.text}
              fontSize={13}
            >
              {msg.content}
            </MessageBubble>
          );
        })}

        {/* Streaming indicator */}
        {streaming ? (
          <MessageBubble variant="left" bg={C.aiBubble} color={C.text} fontSize={13}>
            {streaming}
          </MessageBubble>
        ) : null}

        {/* Loading dots while waiting */}
        {isBusy && !streaming ? (
          <Box style={{ alignSelf: 'start', paddingLeft: 14, paddingTop: 4 }}>
            <LoadingDots size={6} color={C.textMuted} />
          </Box>
        ) : null}
      </MessageList>

      {/* ── Error bar ───────────────────────────────────────────── */}
      {error ? (
        <Box style={{
          paddingLeft: 12, paddingRight: 12,
          paddingTop: 6, paddingBottom: 6,
          backgroundColor: '#7f1d1d',
        }}>
          <Text style={{ fontSize: 11, color: '#fca5a5' }}>
            {error}
          </Text>
        </Box>
      ) : null}

      {/* ── Input ───────────────────────────────────────────────── */}
      <Box style={{ padding: 12 }}>
        <ChatInput
          onSend={handleSend}
          disabled={isBusy}
          placeholder={isBusy ? 'Waiting for response...' : 'Ask Claude something...'}
          sendColor={C.primary}
          multiline={true}
          autoFocus={true}
          style={{
            backgroundColor: C.surface,
            borderColor: C.border,
          }}
        />
      </Box>
    </Box>
  );
}
