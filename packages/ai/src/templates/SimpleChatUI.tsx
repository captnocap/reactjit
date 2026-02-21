/**
 * SimpleChatUI — A clean, self-contained chat interface.
 *
 * Messages + input + loading indicator + optional header.
 * Calls useChat internally. Wrap with <AIProvider> to configure.
 */

import React from 'react';
import { Box, Text, Pressable, type Style, type Color } from '@reactjit/core';
import { useChat } from '../hooks';
import type { ChatOptions, Message } from '../types';
import { AIMessageList } from '../components/AIMessageList';
import { AIChatInput } from '../components/AIChatInput';

export interface SimpleChatUIProps extends ChatOptions {
  /** Title shown in the header */
  title?: string;
  /** Subtitle shown below title */
  subtitle?: string;
  /** Whether to show the header */
  showHeader?: boolean;
  /** Whether to show a stop button during streaming */
  showStopButton?: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Custom message renderer */
  renderMessage?: (message: Message, index: number) => React.ReactNode | null;
  /** Accent color for send button */
  accentColor?: Color;
  /** Container style */
  style?: Style;
  /** Called after each message is sent (for analytics, logging, etc.) */
  onMessageSent?: (content: string) => void;
}

export function SimpleChatUI({
  title = 'Chat',
  subtitle,
  showHeader = true,
  showStopButton = true,
  placeholder,
  renderMessage,
  accentColor = '#2563eb',
  style,
  onMessageSent,
  ...chatOptions
}: SimpleChatUIProps) {
  const { messages, send, isLoading, isStreaming, stop, error } = useChat(chatOptions);

  const handleSend = async (content: string) => {
    await send(content);
    onMessageSent?.(content);
  };

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#0f172a',
      ...style,
    }}>
      {/* Header */}
      {showHeader && (
        <Box style={{
          padding: 12,
          paddingLeft: 16,
          paddingRight: 16,
          borderBottomWidth: 1,
          borderColor: '#1e293b',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Box style={{ gap: 1 }}>
            <Text style={{ fontSize: 15, color: '#f1f5f9', fontWeight: 'bold' }}>
              {title}
            </Text>
            {subtitle && (
              <Text style={{ fontSize: 11, color: '#64748b' }}>
                {subtitle}
              </Text>
            )}
          </Box>
          {isStreaming && showStopButton && (
            <Pressable onPress={stop}>
              {({ pressed }) => (
                <Box style={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 4,
                  paddingBottom: 4,
                  borderRadius: 6,
                  backgroundColor: pressed ? '#7f1d1d' : '#991b1b',
                }}>
                  <Text style={{ fontSize: 11, color: '#fecaca', fontWeight: 'bold' }}>
                    Stop
                  </Text>
                </Box>
              )}
            </Pressable>
          )}
        </Box>
      )}

      {/* Error banner */}
      {error && (
        <Box style={{
          padding: 8,
          paddingLeft: 16,
          backgroundColor: '#450a0a',
          borderBottomWidth: 1,
          borderColor: '#7f1d1d',
        }}>
          <Text style={{ fontSize: 12, color: '#fca5a5' }}>
            {error.message}
          </Text>
        </Box>
      )}

      {/* Messages */}
      <AIMessageList
        messages={messages}
        isStreaming={isStreaming}
        renderMessage={renderMessage}
      />

      {/* Input */}
      <Box style={{ padding: 12 }}>
        <AIChatInput
          send={handleSend}
          isLoading={isLoading}
          placeholder={placeholder}
          sendColor={accentColor}
          autoFocus
        />
      </Box>
    </Box>
  );
}
