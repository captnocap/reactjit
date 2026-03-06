/**
 * MessagePanel — bidirectional message thread between Vesper and the human.
 *
 * Shows messages in a chat-like thread. Vesper can compose replies.
 * Human sends via: curl -X POST http://localhost:9100/message -d "text"
 * Or: GET http://localhost:9100/inbox to read Vesper's replies.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Box, Text, Pressable, ScrollView, TextInput } from '@reactjit/core';
import { C } from '../theme';
import type { Message } from '../hooks/useMessages';

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function MessageBubble({ msg }: { msg: Message }) {
  const isVesper = msg.sender === 'vesper';
  return (
    <Box style={{
      alignSelf: isVesper ? 'flex-end' : 'flex-start',
      maxWidth: '80%',
      padding: 8,
      borderRadius: 8,
      backgroundColor: isVesper ? C.accentDim + '22' : C.surface,
      borderWidth: 1,
      borderColor: isVesper ? C.accentDim + '44' : C.border,
    }}>
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <Text style={{ fontSize: 8, color: isVesper ? C.accent : C.warning, fontWeight: 'bold' }}>
          {isVesper ? 'VESPER' : 'HUMAN'}
        </Text>
        <Text style={{ fontSize: 7, color: C.textMuted }}>{timeAgo(msg.ts)}</Text>
      </Box>
      <Text style={{ fontSize: 10, color: C.text, marginTop: 3, lineHeight: 15 }}>{msg.text}</Text>
    </Box>
  );
}

interface Props {
  messages: Message[];
  unreadCount: number;
  onSend: (text: string) => void;
  onMarkRead: () => void;
  onClear: () => void;
}

export function MessagePanel({ messages, unreadCount, onSend, onMarkRead, onClear }: Props) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<any>(null);

  // Mark messages read when panel is visible
  useEffect(() => {
    if (unreadCount > 0) onMarkRead();
  }, [unreadCount, onMarkRead]);

  const handleSend = () => {
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft('');
  };

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
      {/* Header */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 8,
        borderBottomWidth: 1, borderColor: C.border, flexShrink: 0,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'MESSAGES'}</Text>
          <Text style={{ fontSize: 8, color: C.textDim }}>{`${messages.length} total`}</Text>
        </Box>
        {messages.length > 0 && (
          <Pressable onPress={onClear} style={{
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
            borderRadius: 3, borderWidth: 1, borderColor: C.border,
          }}>
            <Text style={{ fontSize: 8, color: C.textMuted }}>{'clear'}</Text>
          </Pressable>
        )}
      </Box>

      {/* Thread */}
      <ScrollView ref={scrollRef} style={{ flexGrow: 1 }}>
        <Box style={{ padding: 8, gap: 6 }}>
          {messages.length === 0 ? (
            <Box style={{ padding: 20, alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 10, color: C.textDim }}>{'No messages yet.'}</Text>
              <Text style={{ fontSize: 8, color: C.textMuted, textAlign: 'center', lineHeight: 13 }}>
                {'Send from anywhere:\ncurl -X POST http://localhost:9100/message -d "hey"'}
              </Text>
              <Text style={{ fontSize: 8, color: C.textMuted, textAlign: 'center', lineHeight: 13 }}>
                {'Read replies:\ncurl http://localhost:9100/inbox'}
              </Text>
            </Box>
          ) : (
            messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
          )}
        </Box>
      </ScrollView>

      {/* Compose bar */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6,
        borderTopWidth: 1, borderColor: C.border, flexShrink: 0,
      }}>
        <TextInput
          placeholder="Reply..."
          placeholderColor={C.textMuted}
          value={draft}
          onLiveChange={setDraft}
          liveChangeDebounce={0}
          onSubmit={handleSend}
          style={{
            flexGrow: 1, fontSize: 10, color: C.text,
            backgroundColor: C.surface, height: 26,
            borderRadius: 4, borderWidth: 1, borderColor: C.border,
            paddingLeft: 8, paddingRight: 8,
          }}
        />
        <Pressable onPress={handleSend} style={{
          paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
          backgroundColor: draft.trim() ? C.accentDim + '33' : 'transparent',
          borderRadius: 4, borderWidth: 1,
          borderColor: draft.trim() ? C.accentDim : C.border,
        }}>
          <Text style={{ fontSize: 9, color: draft.trim() ? C.accent : C.textMuted }}>{'send'}</Text>
        </Pressable>
      </Box>
    </Box>
  );
}
