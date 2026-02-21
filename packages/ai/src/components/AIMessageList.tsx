/**
 * AIMessageList — MessageList wired to display AI chat messages.
 *
 * Renders Message[] from useChat as a scrollable conversation,
 * mapping roles to MessageBubble variants with streaming support.
 */

import React from 'react';
import {
  Box, Text, MessageList, MessageBubble, LoadingDots, CodeBlock,
  type Style,
} from '@reactjit/core';
import type { Message } from '../types';

export interface AIMessageListProps {
  /** Messages from useChat().messages */
  messages: Message[];
  /** Whether the AI is currently generating */
  isStreaming?: boolean;
  /** Whether to show a loading indicator when streaming */
  showLoadingIndicator?: boolean;
  /** Label for user messages */
  userLabel?: string;
  /** Label for assistant messages */
  assistantLabel?: string;
  /** Custom message renderer — return null to use default */
  renderMessage?: (message: Message, index: number) => React.ReactNode | null;
  /** Container style */
  style?: Style;
  /** Empty state content */
  emptyContent?: React.ReactNode;
}

function extractCodeBlocks(text: string): Array<{ type: 'text' | 'code'; content: string; language?: string }> {
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', content: match[2], language: match[1] || undefined });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
}

function DefaultMessage({ message, userLabel, assistantLabel }: {
  message: Message;
  userLabel?: string;
  assistantLabel?: string;
}) {
  const content = typeof message.content === 'string'
    ? message.content
    : message.content.map(b => b.text || '').join('');

  if (message.role === 'user') {
    return (
      <MessageBubble variant="right" label={userLabel}>
        {content}
      </MessageBubble>
    );
  }

  if (message.role === 'assistant') {
    const parts = extractCodeBlocks(content);
    const hasCode = parts.some(p => p.type === 'code');

    if (!hasCode) {
      return (
        <MessageBubble variant="left" label={assistantLabel}>
          {content}
        </MessageBubble>
      );
    }

    return (
      <MessageBubble variant="left" label={assistantLabel}>
        <Box style={{ gap: 6 }}>
          {parts.map((part, i) =>
            part.type === 'code' ? (
              <CodeBlock
                key={i}
                code={part.content}
                language={part.language}
                style={{ borderRadius: 6 }}
              />
            ) : (
              <Text key={i} style={{ fontSize: 14, color: '#e2e8f0' }}>
                {part.content.trim()}
              </Text>
            )
          )}
        </Box>
      </MessageBubble>
    );
  }

  if (message.role === 'tool') {
    return (
      <MessageBubble variant="center">
        <Text style={{ fontSize: 12, color: '#94a3b8' }}>
          Tool result
        </Text>
      </MessageBubble>
    );
  }

  // system messages — usually hidden
  return null;
}

export function AIMessageList({
  messages,
  isStreaming = false,
  showLoadingIndicator = true,
  userLabel,
  assistantLabel,
  renderMessage,
  style,
  emptyContent,
}: AIMessageListProps) {
  const defaultEmpty = (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 14, color: '#475569' }}>
        Start a conversation
      </Text>
    </Box>
  );

  return (
    <MessageList style={style} emptyContent={emptyContent || defaultEmpty}>
      {messages.map((msg, i) => {
        if (renderMessage) {
          const custom = renderMessage(msg, i);
          if (custom !== null) return <React.Fragment key={i}>{custom}</React.Fragment>;
        }
        return <DefaultMessage key={i} message={msg} userLabel={userLabel} assistantLabel={assistantLabel} />;
      })}
      {isStreaming && showLoadingIndicator && (
        <LoadingDots label="Thinking" color="#64748b" />
      )}
    </MessageList>
  );
}
