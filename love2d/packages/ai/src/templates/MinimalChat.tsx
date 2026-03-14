/**
 * MinimalChat — Absolute bare minimum AI chat.
 *
 * Just messages + input. Nothing else. Calls useChat internally.
 * Wrap with <AIProvider> to configure.
 */

import React from 'react';
import { Box, type Style } from '@reactjit/core';
import { useChat } from '../hooks';
import type { ChatOptions } from '../types';
import { AIMessageList } from '../components/AIMessageList';
import { AIChatInput } from '../components/AIChatInput';

export interface MinimalChatProps extends ChatOptions {
  /** Container style */
  style?: Style;
}

export function MinimalChat({ style, ...chatOptions }: MinimalChatProps) {
  const { messages, send, isLoading, isStreaming } = useChat(chatOptions);

  return (
    <Box style={{ width: '100%', height: '100%', ...style }}>
      <AIMessageList
        messages={messages}
        isStreaming={isStreaming}
      />
      <AIChatInput
        send={send}
        isLoading={isLoading}
        autoFocus
      />
    </Box>
  );
}
