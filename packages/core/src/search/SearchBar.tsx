/**
 * SearchBar — headless search input with clear button and icon slot.
 *
 * All text editing lives in Lua (zero per-keystroke bridge traffic).
 * The debounced onSearch fires after the user pauses typing.
 *
 * @example
 * // Minimal — fires onSearch after 300ms of silence
 * <SearchBar onSearch={setQuery} />
 *
 * @example
 * // Custom debounce + submit handler
 * <SearchBar debounce={500} onSearch={setQuery} onSubmit={runSearch} />
 */

import React, { useCallback, useState } from 'react';
import { Box, Text, Pressable } from '../primitives';
import { TextInput } from '../TextInput';
import type { Style } from '../types';

export interface SearchBarProps {
  /** Called after the user pauses typing (debounced in Lua, no bridge spam). */
  onSearch?: (query: string) => void;
  /** Called when the user presses Enter. Receives the current query. */
  onSubmit?: (query: string) => void;
  /** Called when the clear button is pressed or query becomes empty. */
  onClear?: () => void;
  /** Debounce delay in ms. Default: 300. */
  debounce?: number;
  placeholder?: string;
  /** Container style. */
  style?: Style;
  /** Style for the inner TextInput. */
  inputStyle?: Style;
  /** Focus the input on mount. */
  autoFocus?: boolean;
  /** Controlled value (synced down to Lua on change). */
  value?: string;
  /** Icon slot rendered before the input. Defaults to a plain magnifier box. */
  icon?: React.ReactNode;
  /** Render prop for the clear button. Defaults to an 'x' box. */
  clearIcon?: React.ReactNode;
  /** Disable the input. */
  disabled?: boolean;
  /** Border radius. Default: 8. */
  borderRadius?: number;
  /** Primary accent color for focus ring and icon. */
  accentColor?: string;
  /** Background color. */
  backgroundColor?: string;
  /** Text color. */
  color?: string;
  /** Border color (unfocused). */
  borderColor?: string;
}

export function SearchBar({
  onSearch,
  onSubmit,
  onClear,
  debounce = 300,
  placeholder = 'Search...',
  style,
  inputStyle,
  autoFocus,
  value,
  icon,
  clearIcon,
  disabled,
  borderRadius = 8,
  accentColor = '#3b82f6',
  backgroundColor = 'rgba(255,255,255,0.07)',
  color = 'rgba(255,255,255,0.9)',
  borderColor = 'rgba(255,255,255,0.12)',
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const handleLiveChange = useCallback(
    (text: string) => {
      setQuery(text);
      onSearch?.(text);
      if (text === '') onClear?.();
    },
    [onSearch, onClear],
  );

  const handleSubmit = useCallback(
    (text: string) => {
      setQuery(text);
      onSubmit?.(text);
    },
    [onSubmit],
  );

  const handleBlur = useCallback(
    (/* text unused — query state already tracks latest debounced value */) => {
      setFocused(false);
    },
    [],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    onSearch?.('');
    onClear?.();
  }, [onSearch, onClear]);

  const hasQuery = query.length > 0;

  return (
    <Box
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor,
        borderRadius,
        borderWidth: 1,
        borderColor: focused ? accentColor : borderColor,
        paddingLeft: 10,
        paddingRight: hasQuery ? 4 : 10,
        gap: 6,
        ...(style as any),
      }}
    >
      {/* Search icon */}
      {icon ?? (
        <Box style={{ width: 14, height: 14, opacity: focused ? 1 : 0.5 }}>
          {/* Magnifier: circle + handle */}
          <Box
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              borderWidth: 2,
              borderColor: focused ? accentColor : color,
            }}
          />
          <Box
            style={{
              position: 'absolute',
              width: 2,
              height: 5,
              backgroundColor: focused ? accentColor : color,
              borderRadius: 1,
              top: 8,
              left: 10,
              // 45-degree handle via transforms is unavailable; use offset
            }}
          />
        </Box>
      )}

      {/* Input */}
      <TextInput
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        editable={!disabled}
        onLiveChange={handleLiveChange}
        onSubmit={handleSubmit}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        liveChangeDebounce={debounce}
        style={{
          flexGrow: 1,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: 'transparent',
          ...(inputStyle as any),
        }}
        textStyle={{ fontSize: 13, color }}
      />

      {/* Clear button */}
      {hasQuery && (
        <Pressable
          onPress={handleClear}
          style={({ hovered }) => ({
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: hovered ? 'rgba(255,255,255,0.12)' : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          {clearIcon ?? (
            <Box style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
              {/* X shape from two diagonal boxes — no unicode */}
              <Box
                style={{
                  position: 'absolute',
                  width: 10,
                  height: 2,
                  backgroundColor: color,
                  borderRadius: 1,
                  opacity: 0.7,
                }}
              />
              <Box
                style={{
                  position: 'absolute',
                  width: 2,
                  height: 10,
                  backgroundColor: color,
                  borderRadius: 1,
                  opacity: 0.7,
                }}
              />
            </Box>
          )}
        </Pressable>
      )}
    </Box>
  );
}
