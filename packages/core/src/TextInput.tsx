/**
 * TextInput -- editable text field for web and native (Love2D) modes.
 *
 * Web mode:  renders <input> or <textarea> with standard HTML behavior.
 * Native mode: emits a 'TextInput' host element -- Lua's textinput.lua
 *              handles ALL interaction (cursor, selection, keyboard input).
 *              Only boundary events cross the bridge: focus, blur, submit.
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { useRendererMode } from './context';
import { styleToCSS, colorToCSS } from './primitives';
import { useScaledStyle } from './ScaleContext';
import type { TextInputProps, Style, LoveEvent } from './types';

// ── Web mode component ──────────────────────────────────

function WebTextInput({
  value,
  defaultValue,
  onChangeText,
  onSubmit,
  onFocus,
  onBlur,
  placeholder,
  placeholderColor,
  maxLength,
  multiline,
  editable = true,
  secureTextEntry,
  style,
  textStyle,
  autoFocus,
  cursorColor,
}: TextInputProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const containerCSS = styleToCSS(style);
  // Remove flex defaults that don't apply to input containers
  delete (containerCSS as any).flexDirection;

  const textCSS = styleToCSS(textStyle);
  // Build input-specific styles
  const inputCSS: React.CSSProperties = {
    width: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    padding: 0,
    margin: 0,
    fontFamily: textCSS.fontFamily || 'inherit',
    fontSize: textCSS.fontSize || 'inherit',
    fontWeight: textCSS.fontWeight || 'inherit',
    color: textCSS.color || 'inherit',
    textAlign: textCSS.textAlign || 'left',
    letterSpacing: textCSS.letterSpacing,
    lineHeight: textCSS.lineHeight,
    resize: 'none' as const,
  };

  if (cursorColor) {
    inputCSS.caretColor = colorToCSS(cursorColor);
  }

  // Placeholder color via CSS custom property
  const placeholderStyle = placeholderColor
    ? `::placeholder { color: ${colorToCSS(placeholderColor)}; opacity: 1; }`
    : '';

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChangeText?.(e.target.value);
    },
    [onChangeText],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !multiline && onSubmit) {
        e.preventDefault();
        const target = e.target as HTMLInputElement;
        onSubmit(target.value);
      }
    },
    [multiline, onSubmit],
  );

  const commonProps = {
    ref: inputRef as any,
    style: inputCSS,
    value,
    defaultValue,
    placeholder,
    maxLength,
    readOnly: !editable,
    autoFocus,
    onChange: handleChange,
    onFocus,
    onBlur,
    onKeyDown: handleKeyDown,
  };

  // Generate a unique ID for scoped placeholder styles
  const styleId = useRef(
    `rl-ti-${Math.random().toString(36).slice(2, 8)}`,
  );

  return (
    <div style={containerCSS}>
      {placeholderStyle && (
        <style>{`.${styleId.current}${placeholderStyle}`}</style>
      )}
      {multiline ? (
        <textarea
          {...commonProps}
          className={placeholderStyle ? styleId.current : undefined}
        />
      ) : (
        <input
          {...commonProps}
          type={secureTextEntry ? 'password' : 'text'}
          className={placeholderStyle ? styleId.current : undefined}
        />
      )}
    </div>
  );
}

// ── Native mode component ───────────────────────────────

function NativeTextInput({
  value,
  defaultValue,
  onChangeText,
  onSubmit,
  onFocus,
  onBlur,
  placeholder,
  placeholderColor,
  maxLength,
  multiline,
  editable,
  secureTextEntry,
  style,
  textStyle,
  autoFocus,
  cursorColor,
  keyboardType,
}: TextInputProps) {
  const anyProps = arguments[0] as any;
  const playgroundLine = anyProps.__ilrPlaygroundLine;
  const playgroundTag = anyProps.__ilrPlaygroundTag;

  // In native mode, we emit a 'TextInput' host element.
  // Lua's textinput.lua handles ALL interaction -- cursor, selection,
  // keyboard input. No per-keystroke bridge traffic.
  //
  // The only events that cross the bridge are:
  //   textinput:focus  -- user clicked into the field
  //   textinput:blur   -- user clicked away, pressed Escape or Tab
  //   textinput:submit -- user pressed Enter (single-line mode)

  // Merge text style into the main style so Lua can read fontSize/fontFamily/color
  const mergedStyle: Style = {
    ...(style || {}),
  };
  if (textStyle) {
    if (textStyle.fontSize) mergedStyle.fontSize = textStyle.fontSize;
    if (textStyle.fontFamily) mergedStyle.fontFamily = textStyle.fontFamily;
    if (textStyle.fontWeight) mergedStyle.fontWeight = textStyle.fontWeight;
    if (textStyle.color) mergedStyle.color = textStyle.color;
  }

  // Event handlers -- these stay in JS via handlerRegistry, Lua sends
  // boundary events that dispatch to them
  const handleFocus = useCallback(
    (_event: LoveEvent) => {
      onFocus?.();
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (event: LoveEvent) => {
      const text = (event as any).value ?? '';
      onBlur?.();
      onChangeText?.(text);
    },
    [onBlur, onChangeText],
  );

  const handleSubmit = useCallback(
    (event: LoveEvent) => {
      const text = (event as any).value ?? '';
      onSubmit?.(text);
      onChangeText?.(text);
    },
    [onSubmit, onChangeText],
  );

  // Scale style for viewport-proportional rendering
  const scaledMergedStyle = useScaledStyle(mergedStyle);

  // Data props that cross the bridge (Lua reads from node.props)
  const props: Record<string, any> = {
    style: scaledMergedStyle,
    defaultValue: defaultValue ?? '',
    placeholder: placeholder ?? '',
    editable: editable !== false,
    multiline: multiline ?? false,
    secureTextEntry: secureTextEntry ?? false,
    autoFocus: autoFocus ?? false,
  };

  // Controlled value support
  if (value !== undefined) {
    props.value = value;
  }

  // Optional props
  if (maxLength !== undefined) props.maxLength = maxLength;
  if (placeholderColor) props.placeholderColor = placeholderColor;
  if (cursorColor) props.cursorColor = cursorColor;
  if (keyboardType) props.keyboardType = keyboardType;
  if (playgroundLine !== undefined) props.__ilrPlaygroundLine = playgroundLine;
  if (playgroundTag !== undefined) props.__ilrPlaygroundTag = playgroundTag;

  // Handlers -- these are extracted by the reconciler's extractHandlers()
  // and stored in handlerRegistry, NOT sent to Lua
  if (onFocus) props['onTextInputFocus'] = handleFocus;
  if (onBlur || onChangeText) props['onTextInputBlur'] = handleBlur;
  if (onSubmit) props['onTextInputSubmit'] = handleSubmit;

  return React.createElement('TextInput', props);
}

// ── Public component ────────────────────────────────────

export function TextInput(props: TextInputProps) {
  const mode = useRendererMode();

  if (mode === 'web') {
    return <WebTextInput {...props} />;
  }

  return <NativeTextInput {...props} />;
}
