import React from 'react';
import { Box } from './primitives';
import { ScrollView } from './ScrollView';
import type { Style } from './types';

export interface MessageListProps {
  /** Message elements to render */
  children: React.ReactNode;
  /** Gap between messages */
  gap?: number;
  /** Padding around the message list */
  padding?: number;
  /** Whether to invert the scroll (newest at bottom, auto-scroll down) */
  inverted?: boolean;
  /** Container style */
  style?: Style;
  /** Inner content style */
  contentStyle?: Style;
  /** Content to show when there are no children */
  emptyContent?: React.ReactNode;
}

export function MessageList({
  children,
  gap = 8,
  padding = 12,
  inverted = true,
  style,
  contentStyle,
  emptyContent,
}: MessageListProps) {
  const childArray = React.Children.toArray(children);
  const isEmpty = childArray.length === 0;

  return (
    <ScrollView
      style={{
        flexGrow: 1,
        ...style,
      }}
    >
      <Box style={{
        padding,
        gap,
        justifyContent: inverted ? 'end' : 'start',
        flexGrow: 1,
        ...contentStyle,
      }}>
        {isEmpty && emptyContent ? emptyContent : children}
      </Box>
    </ScrollView>
  );
}
