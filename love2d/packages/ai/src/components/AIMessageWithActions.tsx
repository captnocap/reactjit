/**
 * AIMessageWithActions — MessageBubble with copy/delete/regenerate action bar.
 */

import React, { useCallback } from 'react';
import { Box, MessageBubble, ActionBar, type Style, type ActionBarItem } from '@reactjit/core';
import type { Message } from '../types';

export interface AIMessageWithActionsProps {
  /** The message to display */
  message: Message;
  /** Index in message list (needed for delete/regenerate) */
  index: number;
  /** Called when copy is pressed */
  onCopy?: (content: string) => void;
  /** Called when delete is pressed */
  onDelete?: (index: number) => void;
  /** Called when regenerate is pressed (only for assistant messages) */
  onRegenerate?: (index: number) => void;
  /** Additional custom actions */
  extraActions?: ActionBarItem[];
  /** Whether to show actions (default: true, or on hover for power users) */
  showActions?: boolean;
  /** Container style */
  style?: Style;
}

export function AIMessageWithActions({
  message,
  index,
  onCopy,
  onDelete,
  onRegenerate,
  extraActions = [],
  showActions = true,
  style,
}: AIMessageWithActionsProps) {
  const content = typeof message.content === 'string'
    ? message.content
    : message.content.map(b => b.text || '').join('');

  const isAssistant = message.role === 'assistant';
  const isUser = message.role === 'user';
  const variant = isUser ? 'right' : isAssistant ? 'left' : 'center';

  const actions: ActionBarItem[] = [
    ...(onCopy ? [{ key: 'copy', label: 'Copy' }] : []),
    ...(onDelete ? [{ key: 'delete', label: 'Delete' }] : []),
    ...(isAssistant && onRegenerate ? [{ key: 'regenerate', label: 'Regenerate' }] : []),
    ...extraActions,
  ];

  const handleAction = useCallback((key: string) => {
    switch (key) {
      case 'copy': onCopy?.(content); break;
      case 'delete': onDelete?.(index); break;
      case 'regenerate': onRegenerate?.(index); break;
    }
  }, [content, index, onCopy, onDelete, onRegenerate]);

  return (
    <Box style={{ gap: 2, ...style }}>
      <MessageBubble
        variant={variant}
        label={isAssistant ? 'Assistant' : isUser ? 'You' : undefined}
      >
        {content}
      </MessageBubble>
      {showActions && actions.length > 0 && (
        <ActionBar
          items={actions}
          onAction={handleAction}
          style={{
            alignSelf: isUser ? 'end' : 'start',
            paddingLeft: 4,
            paddingRight: 4,
          }}
        />
      )}
    </Box>
  );
}
