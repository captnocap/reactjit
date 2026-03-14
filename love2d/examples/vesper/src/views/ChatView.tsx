/**
 * ChatView — Main conversation screen.
 *
 * ScrollView of messages + InputHub at the bottom.
 * Empty state with Vesper branding when no messages.
 */

import React, { useRef } from 'react';
import { Box, Text, Pressable, ScrollView, LoadingDots, useShake, useClipboard } from '@reactjit/core';
import { V } from '../theme';
import { InputHub } from '../layout/InputHub';
import { MessageItem } from '../components/MessageItem';
import type { Message, ModelInfo } from '@reactjit/ai';
import type { ProviderConfig } from '../types';

// ── Empty State ──────────────────────────────────────────

const SUGGESTIONS = [
  'Write a story about a forgotten library',
  'Explain quantum entanglement simply',
  'Debug this function for me',
  'Help me design an API',
];

function EmptyState({ onSend }: { onSend: (text: string) => void }) {
  return (
    <Box style={{
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    }}>
      <Text style={{
        fontSize: 32,
        fontWeight: '700',
        color: V.accent,
      }}>
        Vesper
      </Text>
      <Text style={{
        fontSize: 14,
        color: V.textDim,
      }}>
        What would you like to explore?
      </Text>
      <Box style={{ gap: 6, paddingTop: 16 }}>
        {SUGGESTIONS.map((suggestion, i) => (
          <Pressable
            key={`sug-${i}`}
            onPress={() => onSend(suggestion)}
            style={(state) => ({
              paddingLeft: 14,
              paddingRight: 14,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: state.hovered ? V.accent : V.borderSubtle,
              backgroundColor: state.hovered ? V.accentSubtle : V.bgAlt,
            })}
          >
            <Text style={{ fontSize: 13, color: V.textSecondary }}>
              {suggestion}
            </Text>
          </Pressable>
        ))}
      </Box>
    </Box>
  );
}

// ── ChatView ─────────────────────────────────────────────

export interface ChatViewProps {
  messages: Message[];
  send: (content: string) => Promise<void>;
  isLoading: boolean;
  isStreaming: boolean;
  stop: () => void;
  provider: ProviderConfig;
  model: string;
  models: ModelInfo[];
  onSelectModel: (id: string) => void;
  tokenEstimate: number;
  error?: Error | null;
  onDeleteMessage?: (index: number) => void;
  onRegenerateMessage?: (index: number) => void;
  onEditMessage?: (index: number, content: string) => void;
}

export function ChatView({
  messages,
  send,
  isLoading,
  isStreaming,
  stop,
  provider,
  model,
  models,
  onSelectModel,
  tokenEstimate,
  error,
  onDeleteMessage,
  onRegenerateMessage,
  onEditMessage,
}: ChatViewProps) {
  const { copy } = useClipboard();
  const errorShake = useShake({ intensity: 6, duration: 350 });
  const prevErrorRef = useRef<Error | null | undefined>(null);
  if (error && error !== prevErrorRef.current) errorShake.shake();
  prevErrorRef.current = error;
  // rjit-ignore-next-line
  const hasMessages = messages.filter(m => m.role !== 'system').length > 0;
  // rjit-ignore-next-line
  const lastAssistantIdx = messages.reduce((acc, m, i) => m.role === 'assistant' ? i : acc, -1);

  return (
    <Box style={{ flexGrow: 1, width: '100%', flexDirection: 'column' }}>
      {/* Message area */}
      {hasMessages ? (
        <ScrollView style={{
          flexGrow: 1,
          width: '100%',
        }}>
          <Box style={{
            width: '100%',
            gap: 4,
            paddingTop: 12,
            paddingBottom: 12,
          }}>
            {messages.map((msg, i) => (
              <MessageItem
                key={i}
                message={msg}
                index={i}
                isLatest={i === lastAssistantIdx}
                onCopy={(text) => copy(text)}
                onDelete={onDeleteMessage}
                onRegenerate={onRegenerateMessage}
                onEdit={onEditMessage}
              />
            ))}

            {/* Streaming indicator */}
            {isStreaming && messages.length > 0 && messages[messages.length - 1].role !== 'assistant' && (
              <Box style={{
                paddingLeft: 32,
                paddingTop: 8,
                paddingBottom: 8,
              }}>
                <LoadingDots label="Vesper is thinking" color={V.assistant} />
              </Box>
            )}
          </Box>
        </ScrollView>
      ) : (
        <EmptyState onSend={send} />
      )}

      {/* Error banner with shake */}
      {error && (
        <Box style={{
          width: '100%',
          paddingLeft: 16, paddingRight: 16,
          paddingTop: 6, paddingBottom: 6,
          ...errorShake.style,
        }}>
          <Box style={{
            width: '100%',
            paddingLeft: 10, paddingRight: 10,
            paddingTop: 8, paddingBottom: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(239, 68, 68, 0.10)',
            borderLeftWidth: 2,
            borderLeftColor: V.error,
          }}>
            <Text style={{ fontSize: 12, color: V.error }}>
              {error.message}
            </Text>
          </Box>
        </Box>
      )}

      {/* Input hub */}
      <InputHub
        provider={provider}
        model={model}
        models={models}
        onSelectModel={onSelectModel}
        send={send}
        isLoading={isLoading}
        isStreaming={isStreaming}
        onStop={stop}
        tokenEstimate={tokenEstimate}
      />
    </Box>
  );
}
