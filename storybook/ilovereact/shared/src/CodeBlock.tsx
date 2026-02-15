/**
 * CodeBlock -- Syntax-highlighted code display (Lua-owned primitive)
 *
 * Web mode: renders a <pre> with code highlighting
 * Native mode: emits a 'CodeBlock' host element — Lua renders it directly
 */

import React from 'react';
import { useRendererMode } from './context';
import { styleToCSS } from './primitives';
import type { Style } from './types';

export interface CodeBlockProps {
  code: string;
  language?: string;
  fontSize?: number;
  style?: Style;
}

function WebCodeBlock({ code, fontSize = 10, style }: CodeBlockProps) {
  const containerCSS = styleToCSS(style);

  return (
    <pre
      style={{
        margin: 0,
        padding: 10,
        backgroundColor: '#0d1117',
        borderRadius: 4,
        border: '1px solid #1e293b',
        overflow: 'auto',
        fontFamily: 'monospace',
        fontSize,
        color: '#c9d1d9',
        lineHeight: 1.4,
        ...containerCSS,
      }}
    >
      {code}
    </pre>
  );
}

function NativeCodeBlock({ code, language, fontSize = 10, style }: CodeBlockProps) {
  // Lua owns all rendering - just pass props
  const props: Record<string, any> = {
    code,
    language: language ?? 'auto',
    fontSize,
    style: style || {},
  };

  return React.createElement('CodeBlock', props);
}

export function CodeBlock(props: CodeBlockProps) {
  const mode = useRendererMode();

  if (mode === 'web') {
    return <WebCodeBlock {...props} />;
  }

  return <NativeCodeBlock {...props} />;
}
