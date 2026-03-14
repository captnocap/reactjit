import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Box, Text, Image, Pressable, ScrollView, TextInput, CodeBlock, useAnimation, useHotState } from '@reactjit/core';

export interface EvalResult { component: React.ComponentType | null; error: string | null; }

// Callback set by HotPanel to receive element clicks
let _onElementClick: ((info: { tag: string; line: number; x: number; y: number; width: number; height: number }) => void) | null = null;

export function setElementClickHandler(fn: typeof _onElementClick) {
  _onElementClick = fn;
}

// Rect cache keyed by "tag:line"
const _elementRects = new Map<string, { x: number; y: number; width: number; height: number }>();

// Wrapped createElement that makes tracked elements Ctrl+clickable for steering
function wrappedCreateElement(type: any, props: any, ...children: any[]) {
  if (props && props.__rjitPlaygroundTag && props.__rjitPlaygroundLine) {
    const tag = props.__rjitPlaygroundTag;
    const line = props.__rjitPlaygroundLine;
    const key = `${tag}:${line}`;
    // Strip tracking props from output
    const { __rjitPlaygroundTag, __rjitPlaygroundLine, ...cleanProps } = props;
    // Wrap in a Pressable that reports Ctrl+click only
    const inner = React.createElement(type, cleanProps, ...children);
    return React.createElement(Pressable, {
      onLayout: (rect: any) => { _elementRects.set(key, rect); },
      onPress: (e: any) => {
        if (e?.ctrl && _onElementClick) {
          const rect = _elementRects.get(key) ?? { x: e?.x ?? 0, y: e?.y ?? 0, width: 0, height: 0 };
          _onElementClick({ tag, line, ...rect });
        }
      },
    }, inner);
  }
  return React.createElement(type, props, ...children);
}

// Fake React with our wrapped createElement
const WrappedReact = { ...React, createElement: wrappedCreateElement };

const SCOPE_NAMES = [
  'React', 'useState', 'useCallback', 'useRef', 'useMemo',
  'Box', 'Text', 'Image', 'Pressable', 'ScrollView', 'TextInput', 'CodeBlock',
  'useAnimation', 'useHotState',
] as const;

const SCOPE_VALUES = [
  WrappedReact, useState, useCallback, useRef, useMemo,
  Box, Text, Image, Pressable, ScrollView, TextInput, CodeBlock,
  useAnimation, useHotState,
];

export function evalComponent(transformedCode: string): EvalResult {
  try {
    const funcMatch = transformedCode.match(/function\s+([A-Z][a-zA-Z0-9]*)\s*\(/);
    const constMatch = transformedCode.match(/(?:const|let|var)\s+([A-Z][a-zA-Z0-9]*)\s*=/);
    const name = funcMatch?.[1] || constMatch?.[1];
    const wrapped = name
      ? `${transformedCode}\nreturn ${name};`
      : `return function __Component__() { return ${transformedCode.trim().replace(/;$/, '')}; };`;
    const fn = new Function(...SCOPE_NAMES, wrapped);
    const result = fn(...SCOPE_VALUES);
    if (typeof result === 'function') return { component: result, error: null };
    return { component: null, error: 'No component found.' };
  } catch (e: any) {
    return { component: null, error: e?.message || String(e) };
  }
}
