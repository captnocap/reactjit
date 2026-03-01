/**
 * CodeBlock -- Syntax-highlighted code display (Lua-owned primitive)
 *
 * Emits a 'CodeBlock' host element. Lua renders it directly.
 */

import React from 'react';
import { useScaledStyle, useScale } from './ScaleContext';
import type { Style } from './types';

export interface CodeBlockProps {
  code: string;
  language?: string;
  fontSize?: number;
  style?: Style;
}

export function CodeBlock({ code, language, fontSize = 10, style }: CodeBlockProps) {
  const scale = useScale();
  const scaledStyle = useScaledStyle(style);

  const props: Record<string, any> = {
    code,
    language: language ?? 'auto',
    fontSize: Math.round(fontSize * scale),
    style: scaledStyle || {},
  };

  return React.createElement('CodeBlock', props);
}
