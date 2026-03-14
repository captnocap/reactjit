import React, { useState, useCallback } from 'react';
import { Box, Text } from './primitives';
import { TextInput } from './TextInput';
import { Pressable } from './Pressable';
import type { Style, Color } from './types';

export interface ChatInputProps {
  /** Called when the user submits a message */
  onSend?: (text: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled (e.g. while loading) */
  disabled?: boolean;
  /** Controlled value */
  value?: string;
  /** Controlled onChange */
  onChangeText?: (text: string) => void;
  /** Custom send button label */
  sendLabel?: string;
  /** Send button color */
  sendColor?: Color;
  /** Container style */
  style?: Style;
  /** Input style */
  inputStyle?: Style;
  /** Whether to allow multiline input */
  multiline?: boolean;
  /** Auto-focus the input */
  autoFocus?: boolean;
  /** Content to render to the left of the input */
  leftSlot?: React.ReactNode;
  /** Content to render between the input and send button */
  rightSlot?: React.ReactNode;
}

export function ChatInput({
  onSend,
  placeholder = 'Type a message...',
  disabled = false,
  value: controlledValue,
  onChangeText: controlledOnChange,
  sendLabel = 'Send',
  sendColor = '#2563eb',
  style,
  inputStyle,
  multiline = false,
  autoFocus = false,
  leftSlot,
  rightSlot,
}: ChatInputProps) {
  const [internalValue, setInternalValue] = useState('');
  const isControlled = controlledValue !== undefined;
  const text = isControlled ? controlledValue : internalValue;

  // rjit-ignore-next-line — framework API: chat input handlers
  const handleChange = useCallback((t: string) => {
    if (controlledOnChange) controlledOnChange(t);
    if (!isControlled) setInternalValue(t);
  }, [isControlled, controlledOnChange]);

  // rjit-ignore-next-line — framework API: chat input handlers
  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    if (onSend) onSend(trimmed);
    if (!isControlled) setInternalValue('');
  }, [text, disabled, onSend, isControlled]);

  // rjit-ignore-next-line — framework API: chat input handlers
  const handleSubmit = useCallback((t: string) => {
    const trimmed = t.trim();
    if (!trimmed || disabled) return;
    if (onSend) onSend(trimmed);
    if (!isControlled) setInternalValue('');
  }, [disabled, onSend, isControlled]);

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <Box style={{
      flexDirection: 'row',
      alignItems: 'end',
      gap: 8,
      padding: 8,
      backgroundColor: '#0f172a',
      borderWidth: 1,
      borderColor: '#334155',
      borderRadius: 12,
      ...style,
    }}>
      {leftSlot}
      <Box style={{ flexGrow: 1 }}>
        <TextInput
          value={text}
          onChangeText={handleChange}
          onSubmit={handleSubmit}
          placeholder={placeholder}
          placeholderColor="#475569"
          multiline={multiline}
          editable={!disabled}
          autoFocus={autoFocus}
          style={{
            backgroundColor: 'transparent',
            minHeight: 20,
            ...inputStyle,
          }}
          textStyle={{
            color: '#e2e8f0',
            fontSize: 14,
          }}
        />
      </Box>
      {rightSlot}
      <Pressable onPress={canSend ? handleSend : undefined}>
        {({ pressed }) => (
          <Box style={{
            backgroundColor: canSend ? sendColor : '#1e293b',
            borderRadius: 8,
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 8,
            paddingBottom: 8,
            opacity: canSend ? (pressed ? 0.8 : 1) : 0.4,
          }}>
            <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: 'bold' }}>
              {sendLabel}
            </Text>
          </Box>
        )}
      </Pressable>
    </Box>
  );
}
