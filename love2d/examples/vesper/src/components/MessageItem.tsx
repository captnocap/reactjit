/**
 * MessageItem — A single chat message with role-coded styling.
 *
 * User messages: emerald glow border, right-aligned accent.
 * Assistant messages: amber glow border, code block extraction.
 * Tool messages: cyan accent, compact display.
 */

import React, { useState } from 'react';
import { Box, Text, Pressable, CodeBlock, Markdown, useTypewriter } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';
import { V } from '../theme';
import type { Message } from '@reactjit/ai';

// ── Helpers ──────────────────────────────────────────────

function getMessageText(msg: Message): string {
  return typeof msg.content === 'string'
    ? msg.content
    : msg.content.map(b => b.text || '').join('');
}

// ── Action Button ────────────────────────────────────────

function MsgAction({ label, color, onPress }: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={(state) => ({
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 3,
        paddingBottom: 3,
        borderRadius: 4,
        backgroundColor: state.hovered
          ? 'rgba(255, 255, 255, 0.08)'
          : 'transparent',
      })}
    >
      <Text style={{ fontSize: 10, fontWeight: '500', color }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Message Actions Row ──────────────────────────────────

function ActionsRow({ onCopy, onDelete, onRegenerate, onEdit }: {
  onCopy: () => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
}) {
  return (
    <Box style={{
      flexDirection: 'row',
      gap: 2,
      paddingTop: 4,
    }}>
      <MsgAction label="Copy" color={V.textDim} onPress={onCopy} />
      {onEdit && <MsgAction label="Edit" color={V.textDim} onPress={onEdit} />}
      {onRegenerate && <MsgAction label="Retry" color={V.textDim} onPress={onRegenerate} />}
      {onDelete && <MsgAction label="Delete" color={V.error} onPress={onDelete} />}
    </Box>
  );
}

// ── Tool Call Display ────────────────────────────────────

function ToolCallDisplay({ toolCalls }: { toolCalls: Message['toolCalls'] }) {
  if (!toolCalls || toolCalls.length === 0) return null;
  return (
    <Box style={{ gap: 4, paddingTop: 6 }}>
      {toolCalls.map((tc, i) => (
        <Box key={i} style={{
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 6,
          paddingBottom: 6,
          borderRadius: 4,
          backgroundColor: V.toolSubtle,
          borderLeftWidth: 2,
          borderLeftColor: V.tool,
        }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: V.tool }}>
            {`\u25B6 ${tc.name}`}
          </Text>
          <Text style={{ fontSize: 10, color: V.textDim }}>
            {tc.arguments.length > 120 ? `${tc.arguments.slice(0, 120)}...` : tc.arguments}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

// ── MessageItem ──────────────────────────────────────────

export interface MessageItemProps {
  message: Message;
  index: number;
  isLatest?: boolean;
  onCopy?: (text: string) => void;
  onDelete?: (index: number) => void;
  onRegenerate?: (index: number) => void;
  onEdit?: (index: number, newContent: string) => void;
}

export function MessageItem({
  message,
  index,
  isLatest,
  onCopy,
  onDelete,
  onRegenerate,
  onEdit,
}: MessageItemProps) {
  const [hovered, setHovered] = useState(false);
  const c = useThemeColors();
  const text = getMessageText(message);
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isTool = message.role === 'tool';

  // Typewriter effect on the latest assistant message only
  const typedText = useTypewriter(
    isAssistant && isLatest ? text : '',
    { speed: 12, delay: 100 },
  );
  const displayText = isAssistant && isLatest && typedText ? typedText : text;

  // Role-specific styling
  const glowColor = isUser ? V.userGlow : isAssistant ? V.assistantGlow : V.toolSubtle;
  const accentColor = isUser ? V.user : isAssistant ? V.assistant : V.tool;
  const bgColor = isUser ? V.userSubtle : isAssistant ? V.assistantSubtle : V.toolSubtle;
  const roleLabel = isUser ? 'You' : isAssistant ? 'Vesper' : isTool ? 'Tool' : 'System';

  if (message.role === 'system') return null;

  return (
    <Pressable
      onPress={() => setHovered(h => !h)}
      style={{
        width: '100%',
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 2,
        paddingBottom: 2,
      }}
    >
      <Box style={{
        width: '100%',
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 10,
        paddingBottom: 10,
        borderRadius: 6,
        backgroundColor: bgColor,
        borderLeftWidth: 2,
        borderLeftColor: accentColor,
        gap: 4,
      }}>
        {/* Header: role label + timestamp placeholder */}
        <Box style={{
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Text style={{
            fontSize: 11,
            fontWeight: '700',
            color: accentColor,
          }}>
            {roleLabel}
          </Text>
        </Box>

        {/* Content */}
        {isAssistant ? (
          <Markdown
            content={displayText}
            style={{ fontSize: 14 }}
          />
        ) : (
          <Text style={{
            fontSize: 14,
            color: c.text,
            lineHeight: 1.5,
          }}>
            {text}
          </Text>
        )}

        {/* Tool calls (if assistant message has them) */}
        {isAssistant && <ToolCallDisplay toolCalls={message.toolCalls} />}

        {/* Actions (hover-reveal) */}
        {hovered && (
          <ActionsRow
            onCopy={() => onCopy?.(text)}
            onDelete={onDelete ? () => onDelete(index) : undefined}
            onRegenerate={isAssistant && onRegenerate ? () => onRegenerate(index) : undefined}
            onEdit={isUser && onEdit ? () => onEdit(index, text) : undefined}
          />
        )}
      </Box>
    </Pressable>
  );
}
