/**
 * CodeBlock -- Syntax-highlighted code display (Lua-owned primitive)
 *
 * Emits a 'CodeBlock' host element. Lua renders it directly.
 * Pass code as a string prop — Lua reads it from props.code.
 * Children (Text nodes) also work but the string prop is preferred.
 */

import React from 'react';
import { useScaledStyle, useScale } from './ScaleContext';
import type { Style } from './types';

export interface CodeBlockProps {
  code?: string;
  language?: string;
  fontSize?: number;
  style?: Style;
  children?: React.ReactNode;
}

export function CodeBlock({ code, language, fontSize = 10, style, children }: CodeBlockProps) {
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);

  return React.createElement('CodeBlock', {
    code,
    language: language ?? 'auto',
    fontSize: Math.round(fontSize * scale),
    style: { padding: 10, ...scaledStyle },
  }, children);
}
