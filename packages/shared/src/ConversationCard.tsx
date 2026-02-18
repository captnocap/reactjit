import React from 'react';
import { Box, Text } from './primitives';
import { Pressable } from './Pressable';
import type { Style, Color } from './types';

export interface ConversationCardProps {
  /** Conversation title or first message preview */
  title: string;
  /** Secondary text (last message preview, date, etc.) */
  subtitle?: string;
  /** Whether this conversation is currently selected */
  active?: boolean;
  /** Called when the card is pressed */
  onPress?: () => void;
  /** Active/selected background color */
  activeBg?: Color;
  /** Container style */
  style?: Style;
}

export function ConversationCard({
  title,
  subtitle,
  active = false,
  onPress,
  activeBg = '#1e3a5f',
  style,
}: ConversationCardProps) {
  return (
    <Pressable onPress={onPress}>
      {({ pressed, hovered }) => (
        <Box style={{
          padding: 10,
          paddingLeft: 12,
          paddingRight: 12,
          borderRadius: 8,
          backgroundColor: active
            ? activeBg
            : pressed
              ? '#1e293b'
              : hovered
                ? '#162032'
                : 'transparent',
          gap: 2,
          ...style,
        }}>
          <Text
            style={{
              fontSize: 13,
              color: active ? '#e2e8f0' : '#cbd5e1',
              fontWeight: active ? 'bold' : 'normal',
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={{ fontSize: 11, color: '#64748b' }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </Box>
      )}
    </Pressable>
  );
}
