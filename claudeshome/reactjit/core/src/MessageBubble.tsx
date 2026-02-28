import React from 'react';
import { Box, Text } from './primitives';
import type { Style, Color } from './types';

export type MessageBubbleVariant = 'left' | 'right' | 'center';

export interface MessageBubbleProps {
  /** Message content text */
  children: React.ReactNode;
  /** Visual alignment and styling variant */
  variant?: MessageBubbleVariant;
  /** Optional label shown above the message (e.g. sender name) */
  label?: string;
  /** Optional timestamp shown below the message */
  timestamp?: string;
  /** Background color override */
  bg?: Color;
  /** Text color override */
  color?: Color;
  /** Font size for message content */
  fontSize?: number;
  /** Container style override */
  style?: Style;
  /** Content text style override */
  contentStyle?: Style;
}

const variantStyles: Record<MessageBubbleVariant, { align: 'start' | 'end' | 'center'; bg: string; color: string; radius: Style }> = {
  left: {
    align: 'start',
    bg: '#1e293b',
    color: '#e2e8f0',
    radius: { borderTopLeftRadius: 4, borderTopRightRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  },
  right: {
    align: 'end',
    bg: '#2563eb',
    color: '#ffffff',
    radius: { borderTopLeftRadius: 16, borderTopRightRadius: 4, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  },
  center: {
    align: 'center',
    bg: '#334155',
    color: '#94a3b8',
    radius: { borderRadius: 12 },
  },
};

export function MessageBubble({
  children,
  variant = 'left',
  label,
  timestamp,
  bg,
  color,
  fontSize = 14,
  style,
  contentStyle,
}: MessageBubbleProps) {
  const v = variantStyles[variant];

  return (
    <Box style={{ alignSelf: v.align, maxWidth: '80%', gap: 2, ...style }}>
      {label && (
        <Text style={{ fontSize: 11, color: '#64748b', paddingLeft: 4, paddingRight: 4 }}>
          {label}
        </Text>
      )}
      <Box style={{
        backgroundColor: bg || v.bg,
        padding: 10,
        paddingLeft: 14,
        paddingRight: 14,
        ...v.radius,
      }}>
        {typeof children === 'string' ? (
          <Text style={{ fontSize, color: color || v.color, ...contentStyle }}>
            {children}
          </Text>
        ) : (
          children
        )}
      </Box>
      {timestamp && (
        <Text style={{ fontSize: 10, color: '#475569', paddingLeft: 4, paddingRight: 4, alignSelf: v.align }}>
          {timestamp}
        </Text>
      )}
    </Box>
  );
}
