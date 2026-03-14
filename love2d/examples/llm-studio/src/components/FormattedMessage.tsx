import React, { useState } from 'react';
import { Box, Text, Pressable, TextInput, Markdown } from '@reactjit/core';
import type { Message } from '@reactjit/ai';
import { C } from '../theme';
import { Btn } from './shared';

function MsgAction({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      {({ hovered: h }) => (
        <Box style={{
          paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1,
          borderRadius: 3, backgroundColor: h ? C.surfaceHover : 'transparent',
        }}>
          <Text style={{ fontSize: 9, color, fontWeight: 'bold' }}>{label}</Text>
        </Box>
      )}
    </Pressable>
  );
}

// ── Formatted message with markdown-like rendering ───────────────────────────

export function FormattedMessage({ message, onCopy, onDelete, onRegenerate, onEdit, onBranch, searchHighlight, timestamp }: {
  message: Message;
  onCopy?: () => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
  onEdit?: (newContent: string) => void;
  onBranch?: () => void;
  searchHighlight?: boolean;
  timestamp?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const content = typeof message.content === 'string'
    ? message.content
    : message.content.map(b => b.text || '').join('');

  if (message.role === 'system' || message.role === 'tool') return null;

  const isUser = message.role === 'user';

  const handleCopy = () => {
    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const startEdit = () => {
    setEditText(content);
    setEditing(true);
  };

  const commitEdit = () => {
    if (editText.trim() && editText !== content) {
      onEdit?.(editText);
    }
    setEditing(false);
  };

  return (
    <Pressable onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}>
      {() => (
        <Box style={{
          paddingLeft: isUser ? 60 : 16, paddingRight: isUser ? 16 : 60,
          paddingTop: 8, paddingBottom: 8,
          ...(searchHighlight ? { backgroundColor: '#2a2a10', borderLeftWidth: 3, borderColor: C.yellow } : {}),
        }}>
          {/* Role label + actions */}
          <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 4 }}>
            <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isUser ? C.user : C.assistant }} />
              <Text style={{ fontSize: 10, color: isUser ? C.user : C.assistant, fontWeight: 'bold', fontFamily: 'monospace' }}>
                {isUser ? 'YOU' : 'ASSISTANT'}
              </Text>
              <Text style={{ fontSize: 8, color: C.textDim, fontFamily: 'monospace' }}>
                {`${Math.round(content.length / 4)} tok`}
              </Text>
              {timestamp && (
                <Text style={{ fontSize: 8, color: C.textDim, fontFamily: 'monospace' }}>
                  {new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </Box>
            {hovered && !editing && (
              <Box style={{ flexDirection: 'row', gap: 4 }}>
                <MsgAction label={copied ? 'Copied' : 'Copy'} color={copied ? C.green : C.textDim} onPress={handleCopy} />
                {onEdit && <MsgAction label="Edit" color={C.textDim} onPress={startEdit} />}
                {onBranch && <MsgAction label="Branch" color={C.accent} onPress={onBranch} />}
                {!isUser && onRegenerate && (
                  <MsgAction label="Retry" color={C.textDim} onPress={onRegenerate} />
                )}
                {onDelete && <MsgAction label="Del" color={C.red} onPress={onDelete} />}
              </Box>
            )}
          </Box>

          {/* Content or editor */}
          {editing ? (
            <Box style={{ gap: 6 }}>
              <TextInput
                value={editText} onChangeText={setEditText}
                multiline
                style={{ backgroundColor: C.bgInput, borderRadius: 8, padding: 10, minHeight: 80 }}
                textStyle={{ color: C.text, fontSize: 13 }}
                autoFocus
              />
              <Box style={{ flexDirection: 'row', gap: 6 }}>
                <Btn label="Save" color="#fff" bgColor={C.accent} onPress={commitEdit} />
                <Btn label="Cancel" color={C.textMuted} bgColor={C.surface} onPress={() => setEditing(false)} />
              </Box>
            </Box>
          ) : (
            <Markdown text={content} style={{
              padding: 12, borderRadius: 10,
              backgroundColor: isUser ? C.surfaceActive : C.surface,
            }} />
          )}
        </Box>
      )}
    </Pressable>
  );
}
