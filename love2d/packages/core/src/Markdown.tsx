/**
 * Markdown -- Lua-owned markdown renderer (same pattern as CodeBlock)
 *
 * Emits a 'Markdown' host element. Lua parses and renders it directly.
 * Pass markdown as a string prop — Lua reads it from props.text.
 */

import React from 'react';
import { useScaledStyle, useScale } from './ScaleContext';
import type { Style } from './types';

export interface MarkdownProps {
  text?: string;
  fontSize?: number;
  style?: Style;
  children?: React.ReactNode;
}

export function Markdown({ text, fontSize = 12, style, children }: MarkdownProps) {
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);

  return React.createElement('Markdown', {
    text,
    fontSize: Math.round(fontSize * scale),
    style: scaledStyle,
  }, children);
}
