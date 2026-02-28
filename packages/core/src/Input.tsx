/**
 * Input — unified text input for single-line and multi-line editing.
 *
 * Emits a 'TextInput' or 'TextEditor' host element. Lua handles ALL
 * interaction (cursor, selection, keyboard). Only boundary events cross
 * the bridge: focus, blur, submit, change.
 *
 * Default: single-line. Set multiline={true} for multi-line editing.
 * Editor features (lineNumbers, syntaxHighlight, tooltipLevel, sessionId)
 * imply multiline automatically.
 */

import React, { useCallback } from 'react';
import { useScaledStyle } from './ScaleContext';
import type { InputProps, Style, LoveEvent } from './types';

function isEditorMode(props: InputProps): boolean {
  // Bare multiline (without editor features) stays on the TextInput path.
  // Only escalate to TextEditor when editor-specific features are requested.
  return !!(
    props.lineNumbers ||
    props.syntaxHighlight ||
    props.tooltipLevel ||
    props.sessionId ||
    // multiline without submitOnEnter uses the editor path (old behavior)
    (props.multiline && !props.submitOnEnter)
  );
}

export function Input(rawProps: InputProps) {
  const {
    value,
    defaultValue,
    onChangeText,
    onSubmit,
    onFocus,
    onBlur,
    onLiveChange,
    liveChangeDebounce,
    onChange,
    changeDelay,
    placeholder,
    placeholderColor,
    maxLength,
    multiline,
    editable,
    secureTextEntry,
    live,
    keyboardType,
    lineNumbers,
    syntaxHighlight,
    tooltipLevel,
    sessionId,
    style,
    textStyle,
    autoFocus,
    keystrokeTarget,
    submitTarget,
    escapeTarget,
    submitOnEnter,
    spellCheck,
    cursorColor,
    cursorPosition,
  } = rawProps as any;

  const anyProps = rawProps as any;
  const playgroundLine = anyProps.__ilrPlaygroundLine;
  const playgroundTag = anyProps.__ilrPlaygroundTag;

  const editor = isEditorMode(rawProps);

  // Merge text style into main style so Lua can read fontSize/fontFamily/color
  const mergedStyle: Style = { ...(style || {}) };
  if (textStyle) {
    if (textStyle.fontSize) mergedStyle.fontSize = textStyle.fontSize;
    if (textStyle.fontFamily) mergedStyle.fontFamily = textStyle.fontFamily;
    if (textStyle.fontWeight) mergedStyle.fontWeight = textStyle.fontWeight;
    if (textStyle.color) mergedStyle.color = textStyle.color;
  }

  const scaledMergedStyle = useScaledStyle(mergedStyle);

  // -- Callbacks --

  const handleFocus = useCallback(
    (_event: LoveEvent) => { onFocus?.(); },
    [onFocus],
  );

  const handleBlur = useCallback(
    (event: LoveEvent) => {
      const text = (event as any).value ?? '';
      onBlur?.(text);
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

  // live=true: forward keystrokes via onLiveChange or onChangeText
  const effectiveLiveChange = onLiveChange || (live ? onChangeText : undefined);

  const handleLiveChange = useCallback(
    (event: LoveEvent) => {
      const text = (event as any).value ?? '';
      effectiveLiveChange?.(text);
    },
    [effectiveLiveChange],
  );

  // live=true on editor path: forward idle-detection via onChange or onChangeText
  const effectiveOnChange = onChange || (live ? onChangeText : undefined);

  const handleChange = useCallback(
    (event: LoveEvent) => {
      const text = (event as any).value ?? '';
      effectiveOnChange?.(text);
    },
    [effectiveOnChange],
  );

  // -- Build props for the host element --

  if (editor) {
    // TextEditor host element
    const props: Record<string, any> = {
      style: scaledMergedStyle,
      initialValue: defaultValue ?? '',
      placeholder: placeholder ?? '',
      readOnly: editable === false,
      lineNumbers: lineNumbers ?? false,
      syntaxHighlight: syntaxHighlight ?? false,
      tooltipLevel: tooltipLevel ?? '',
    };

    if (spellCheck) props.spellCheck = true;
    if (keystrokeTarget) props.keystrokeTarget = keystrokeTarget;
    if (submitTarget) props.submitTarget = submitTarget;
    if (playgroundLine !== undefined) props.__ilrPlaygroundLine = playgroundLine;
    if (playgroundTag !== undefined) props.__ilrPlaygroundTag = playgroundTag;
    if (changeDelay !== undefined) props.changeDelay = changeDelay;
    if (sessionId !== undefined) props.sessionId = sessionId;
    if (value !== undefined) props.value = value;

    // Handlers
    if (onFocus) props['onTextEditorFocus'] = handleFocus;
    if (onBlur || onChangeText) props['onTextEditorBlur'] = handleBlur;
    if (onSubmit) props['onTextEditorSubmit'] = handleSubmit;
    if (effectiveOnChange) props['onTextEditorChange'] = handleChange;

    return React.createElement('TextEditor', props);
  }

  // TextInput host element (single-line, or multiline with submitOnEnter)
  const props: Record<string, any> = {
    style: scaledMergedStyle,
    defaultValue: defaultValue ?? '',
    placeholder: placeholder ?? '',
    editable: editable !== false,
    multiline: multiline ?? false,
    secureTextEntry: secureTextEntry ?? false,
    autoFocus: autoFocus ?? false,
  };

  if (submitOnEnter) props.submitOnEnter = true;

  if (value !== undefined) props.value = value;
  if (spellCheck) props.spellCheck = true;
  if (keystrokeTarget) props.keystrokeTarget = keystrokeTarget;
  if (submitTarget) props.submitTarget = submitTarget;
  if (escapeTarget) props.escapeTarget = escapeTarget;
  if (maxLength !== undefined) props.maxLength = maxLength;
  if (placeholderColor) props.placeholderColor = placeholderColor;
  if (cursorColor) props.cursorColor = cursorColor;
  if (cursorPosition !== undefined) props.cursorPosition = cursorPosition;
  if (keyboardType) props.keyboardType = keyboardType;
  if (playgroundLine !== undefined) props.__ilrPlaygroundLine = playgroundLine;
  if (playgroundTag !== undefined) props.__ilrPlaygroundTag = playgroundTag;

  if (effectiveLiveChange) {
    props.liveChange = true;
    if (liveChangeDebounce !== undefined) props.liveChangeDebounce = liveChangeDebounce;
  }

  // Handlers
  if (onFocus) props['onTextInputFocus'] = handleFocus;
  if (onBlur || onChangeText) props['onTextInputBlur'] = handleBlur;
  if (onSubmit) props['onTextInputSubmit'] = handleSubmit;
  if (effectiveLiveChange) props['onTextInputChange'] = handleLiveChange;

  return React.createElement('TextInput', props);
}
