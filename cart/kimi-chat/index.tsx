// Probe cart for the Kimi backend through the unified worker contract.
//
// Spawns kimi_wire_sdk.Session via __worker_start("kimi_cli_wire", ...),
// streams normalized WorkerEvent rows back. Same shape as cart/local-chat
// and cart/codex-chat — different backend tag.

import { useState, useRef } from 'react';
import { Box, Pressable, ScrollView, TextInput } from '@reactjit/runtime/primitives';
import { installBrowserShims } from '@reactjit/runtime/hooks';
import { useAssistant, type WorkerEvent } from '@reactjit/runtime/hooks/useAssistant';
import { callHost, hasHost } from '@reactjit/runtime/ffi';

installBrowserShims();

function processCwd(): string {
  if (hasHost('__cwd')) {
    try {
      const v = callHost<string>('__cwd', '');
      if (typeof v === 'string' && v.length > 0) return v;
    } catch { /* ignore */ }
  }
  if (hasHost('__env')) {
    try {
      const home = callHost<string>('__env', '', 'HOME');
      if (typeof home === 'string' && home.length > 0) return home;
    } catch { /* ignore */ }
  }
  return '/tmp';
}

function eventLabel(ev: WorkerEvent): string {
  if (ev.kind === 'assistant_message') return `assistant${ev.phase ? ` (${ev.phase})` : ''}`;
  if (ev.kind === 'completion') return 'completion';
  if (ev.kind === 'error_') return 'error';
  if (ev.kind === 'lifecycle') return `lifecycle${ev.status_text ? ` (${ev.status_text})` : ''}`;
  if (ev.kind === 'status') return `status${ev.status_text ? ` (${ev.status_text})` : ''}`;
  if (ev.kind === 'tool_call') return 'tool_call';
  return ev.kind;
}

export default function KimiChat() {
  const cwd = processCwd();
  const assistant = useAssistant({
    backend: 'kimi_cli_wire',
    cwd,
    model: 'k2',
    yolo: true,
    persistAcrossUnmount: true,
  });

  const [input, setInput] = useState('');
  const inputRef = useRef('');
  inputRef.current = input;

  const submit = () => {
    const text = inputRef.current.trim();
    if (!text) return;
    if (!assistant.ask(text)) return;
    setInput('');
  };

  return (
    <Box style={{
      flexGrow: 1,
      flexDirection: 'column',
      backgroundColor: '#0e0e10',
      width: '100%', height: '100%',
      paddingTop: 24, paddingBottom: 24, paddingLeft: 24, paddingRight: 24,
      gap: 12,
    }}>
      <Box style={{ flexDirection: 'column', gap: 4 }}>
        <Box style={{ flexDirection: 'row' }}>
          <Box style={{
            paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8,
            backgroundColor: phaseColor(assistant.phase),
            borderRadius: 4,
          }}>
            <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: 12 }}>
              {assistant.phase}
            </span>
          </Box>
        </Box>
        <Box style={{ paddingTop: 4 }}>
          <span style={{ color: '#888', fontFamily: 'monospace', fontSize: 11 }}>
            worker: {assistant.workerId ?? '(none)'} · backend: kimi_cli_wire · model: k2
          </span>
        </Box>
        {assistant.error ? (
          <Box style={{ paddingTop: 4 }}>
            <span style={{ color: '#ff6b6b', fontFamily: 'monospace', fontSize: 12 }}>
              error: {assistant.error}
            </span>
          </Box>
        ) : null}
      </Box>

      <ScrollView showScrollbar style={{
        flexGrow: 1,
        backgroundColor: '#1a1a1f',
        borderRadius: 6,
        width: '100%',
      }}>
        <Box style={{
          flexDirection: 'column', gap: 6,
          paddingTop: 12, paddingBottom: 12, paddingLeft: 14, paddingRight: 14,
        }}>
          {assistant.events.map((ev) => (
            <Box key={ev.id} style={{
              flexDirection: 'column',
              borderLeftWidth: 3,
              borderLeftColor: eventBorderColor(ev.kind),
              paddingLeft: 8,
              paddingTop: 2, paddingBottom: 2,
            }}>
              <span style={{ color: '#888', fontFamily: 'monospace', fontSize: 10 }}>
                #{ev.id} · {eventLabel(ev)}
                {ev.role ? ` · role=${ev.role}` : ''}
              </span>
              {ev.text ? (
                <span style={{ color: '#e8e8e8', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                  {ev.text}
                </span>
              ) : null}
              {!ev.text && ev.payload_json ? (
                <span style={{ color: '#999', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre-wrap' }}>
                  {ev.payload_json}
                </span>
              ) : null}
            </Box>
          ))}
          {assistant.events.length === 0 ? (
            <span style={{ color: '#666', fontFamily: 'monospace', fontSize: 12 }}>
              {assistant.phase === 'init' || assistant.phase === 'starting'
                ? 'starting kimi --wire…'
                : 'send a message to start a turn'}
            </span>
          ) : null}
        </Box>
      </ScrollView>

      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Box style={{
          flexGrow: 1,
          backgroundColor: '#1a1a1f',
          borderRadius: 6,
          paddingTop: 10, paddingBottom: 10, paddingLeft: 14, paddingRight: 14,
        }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={submit}
            placeholder={assistant.ready() ? 'message…' : 'waiting on worker…'}
            style={{
              color: '#e8e8e8',
              fontFamily: 'monospace',
              fontSize: 14,
              width: '100%',
            }}
          />
        </Box>
        <Pressable onPress={submit}>
          <Box style={{
            paddingTop: 10, paddingBottom: 10, paddingLeft: 18, paddingRight: 18,
            backgroundColor: assistant.ready() ? '#3b82f6' : '#3a3a40',
            borderRadius: 6,
          }}>
            <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: 13 }}>send</span>
          </Box>
        </Pressable>
      </Box>
    </Box>
  );
}

function phaseColor(phase: string): string {
  switch (phase) {
    case 'idle': return '#3a7d3a';
    case 'streaming': return '#3b82f6';
    case 'failed': return '#b03030';
    case 'closed': return '#555';
    case 'starting': return '#ad7f2a';
    default: return '#3a3a40';
  }
}

function eventBorderColor(kind: WorkerEvent['kind']): string {
  switch (kind) {
    case 'assistant_message': return '#3b82f6';
    case 'completion': return '#3a7d3a';
    case 'error_': return '#b03030';
    case 'lifecycle': return '#888';
    case 'status': return '#ad7f2a';
    case 'tool_call': return '#a07ad6';
    default: return '#444';
  }
}
