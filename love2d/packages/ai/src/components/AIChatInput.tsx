/**
 * AIChatInput — ChatInput wired to useChat's send function.
 *
 * Handles the disabled state during loading/streaming automatically.
 */

import React from 'react';
import { ChatInput, type Style, type Color } from '@reactjit/core';

export interface AIChatInputProps {
  /** send() from useChat() */
  send: (content: string) => Promise<void>;
  /** isLoading from useChat() — disables input while true */
  isLoading?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Send button label */
  sendLabel?: string;
  /** Send button color */
  sendColor?: Color;
  /** Container style */
  style?: Style;
  /** Whether to allow multiline */
  multiline?: boolean;
  /** Auto-focus */
  autoFocus?: boolean;
  /** Content to render to the left of the input */
  leftSlot?: React.ReactNode;
  /** Content to render between input and send button */
  rightSlot?: React.ReactNode;
}

export function AIChatInput({
  send,
  isLoading = false,
  placeholder = 'Type a message...',
  sendLabel = 'Send',
  sendColor,
  style,
  multiline = false,
  autoFocus = false,
  leftSlot,
  rightSlot,
}: AIChatInputProps) {
  return (
    <ChatInput
      onSend={send}
      disabled={isLoading}
      placeholder={isLoading ? 'Waiting for response...' : placeholder}
      sendLabel={sendLabel}
      sendColor={sendColor}
      style={style}
      multiline={multiline}
      autoFocus={autoFocus}
      leftSlot={leftSlot}
      rightSlot={rightSlot}
    />
  );
}
