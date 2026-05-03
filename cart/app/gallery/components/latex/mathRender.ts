import { createElement as h } from 'react';
import type { ReactNode } from 'react';
import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import type { MathNode, TextMode } from './useLaTeXParse';

export type MathRenderOptions = {
  fontSize: number;
  color: string;
  inline?: boolean;
};

function nodeKey(node: MathNode, index: number): string {
  return `${node.type}-${index}`;
}

function baseStyle(options: MathRenderOptions) {
  return {
    color: options.color,
    fontSize: options.fontSize,
    lineHeight: options.fontSize * 1.15,
  };
}

function styleForMode(mode: TextMode | undefined) {
  if (mode === 'rm') return { fontStyle: 'normal', fontWeight: 'normal' as const };
  if (mode === 'bf') return { fontStyle: 'normal', fontWeight: 'bold' as const };
  if (mode === 'cal') return { fontStyle: 'italic', fontWeight: 'normal' as const };
  return { fontStyle: 'italic', fontWeight: 'normal' as const };
}

// In math mode, only alphabetic runs should be italic; digits/operators stay upright.
function renderMathMixed(value: string, options: MathRenderOptions, key: string) {
  const parts: Array<{ text: string; letters: boolean }> = [];
  let buf = '';
  let letters = false;
  for (const ch of value) {
    const isLetter = /[A-Za-z]/.test(ch);
    if (buf === '') {
      buf = ch;
      letters = isLetter;
      continue;
    }
    if (isLetter === letters) {
      buf += ch;
    } else {
      parts.push({ text: buf, letters });
      buf = ch;
      letters = isLetter;
    }
  }
  if (buf !== '') parts.push({ text: buf, letters });

  if (parts.length === 1) {
    const { text, letters: lettersOnly } = parts[0];
    return h(Text, {
      key,
      style: { ...baseStyle(options), fontStyle: lettersOnly ? 'italic' : 'normal' },
    }, text);
  }
  return h(Row, { key, style: { alignItems: 'flex-start' } }, parts.map((part, index) => (
    h(Text, {
      key: `${key}-p${index}`,
      style: { ...baseStyle(options), fontStyle: part.letters ? 'italic' : 'normal' },
    }, part.text)
  )));
}

function renderText(value: string, options: MathRenderOptions, key: string, mode?: TextMode) {
  if (!mode || mode === 'math') {
    return renderMathMixed(value, options, key);
  }
  return h(Text, {
    key,
    style: { ...baseStyle(options), ...styleForMode(mode) },
  }, value);
}

function renderGroup(nodes: MathNode[], options: MathRenderOptions, keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => renderNode(node, options, `${keyPrefix}-${nodeKey(node, index)}`));
}

function renderScript(node: Extract<MathNode, { type: 'script' }>, options: MathRenderOptions, key: string) {
  const scriptSize = Math.max(9, Math.round(options.fontSize * 0.68));
  const base = renderNode(node.base, options, `${key}-base`);
  const hasSuper = !!node.superscript?.length;
  const hasSub = !!node.subscript?.length;

  return h(Row, { key, style: { alignItems: 'flex-start' } }, [
    base,
    h(Col, { key: `${key}-stack`, style: { alignItems: 'flex-start', gap: 0, marginLeft: 1 } }, [
      hasSuper
        ? h(Box, { key: `${key}-sup-wrap`, style: { marginTop: -Math.max(3, options.fontSize * 0.25) } }, [
            h(Row, { key: `${key}-sup-row`, style: { alignItems: 'flex-start' } }, renderGroup(node.superscript!, { ...options, fontSize: scriptSize }, `${key}-sup`)),
          ])
        : h(Box, { key: `${key}-sup-spacer`, style: { height: options.fontSize * 0.35 } }),
      hasSub
        ? h(Box, { key: `${key}-sub-wrap`, style: { marginTop: Math.max(1, options.fontSize * 0.02) } }, [
            h(Row, { key: `${key}-sub-row`, style: { alignItems: 'flex-start' } }, renderGroup(node.subscript!, { ...options, fontSize: scriptSize }, `${key}-sub`)),
          ])
        : null,
    ]),
  ]);
}

function renderFraction(node: Extract<MathNode, { type: 'fraction' }>, options: MathRenderOptions, key: string) {
  const next = { ...options, fontSize: Math.max(10, Math.round(options.fontSize * 0.82)) };
  return h(Col, { key, style: { alignItems: 'center', justifyContent: 'center', paddingLeft: 2, paddingRight: 2 } }, [
    h(Row, { key: `${key}-num`, style: { alignItems: 'center' } }, renderGroup(node.numerator, next, `${key}-num`)),
    h(Box, { key: `${key}-bar`, style: { width: '100%', minWidth: 10, borderTopWidth: 1, borderColor: options.color, marginTop: 2, marginBottom: 2 } }),
    h(Row, { key: `${key}-den`, style: { alignItems: 'center' } }, renderGroup(node.denominator, next, `${key}-den`)),
  ]);
}

function renderSqrt(node: Extract<MathNode, { type: 'sqrt' }>, options: MathRenderOptions, key: string) {
  const next = { ...options, fontSize: Math.max(10, Math.round(options.fontSize * 0.9)) };
  return h(Row, { key, style: { alignItems: 'flex-start' } }, [
    h(Text, { key: `${key}-glyph`, style: { color: options.color, fontSize: options.fontSize, lineHeight: options.fontSize * 1.1 } }, '√'),
    h(Col, { key: `${key}-body`, style: { alignItems: 'flex-start', paddingLeft: 3, borderTopWidth: 1, borderColor: options.color, paddingTop: 2 } }, [
      node.index
        ? h(Row, { key: `${key}-idx`, style: { alignItems: 'flex-start', marginBottom: -2 } }, renderGroup(node.index, { ...options, fontSize: Math.max(8, Math.round(options.fontSize * 0.58)) }, `${key}-index`))
        : null,
      h(Row, { key: `${key}-rad`, style: { alignItems: 'flex-start' } }, renderGroup(node.radicand, next, `${key}-rad`)),
    ]),
  ]);
}

function renderMatrix(node: Extract<MathNode, { type: 'matrix' }>, options: MathRenderOptions, key: string) {
  const delimiters: Record<'matrix' | 'pmatrix' | 'bmatrix' | 'vmatrix', [string, string]> = {
    matrix: ['', ''],
    pmatrix: ['(', ')'],
    bmatrix: ['[', ']'],
    vmatrix: ['|', '|'],
  };
  const [left, right] = delimiters[node.variant];
  return h(Row, { key, style: { alignItems: 'stretch' } }, [
    left ? h(Text, { key: `${key}-l`, style: { color: options.color, fontSize: options.fontSize * 1.2 } }, left) : null,
    h(Col, { key: `${key}-grid`, style: { alignItems: 'flex-start', paddingLeft: 4, paddingRight: 4, gap: 2 } }, node.rows.map((row, rowIndex) => (
      h(Row, { key: `${key}-row-${rowIndex}`, style: { alignItems: 'center', gap: 8 } }, row.map((cell, cellIndex) => (
        h(Row, { key: `${key}-cell-${rowIndex}-${cellIndex}`, style: { alignItems: 'center' } }, renderGroup(cell, { ...options, fontSize: Math.max(10, Math.round(options.fontSize * 0.9)) }, `${key}-r${rowIndex}c${cellIndex}`))
      )))
    ))),
    right ? h(Text, { key: `${key}-r`, style: { color: options.color, fontSize: options.fontSize * 1.2 } }, right) : null,
  ]);
}

export function renderNode(node: MathNode, options: MathRenderOptions, key: string): ReactNode {
  if (node.type === 'empty') return null;
  if (node.type === 'text') return renderText(node.value, options, key, node.mode);
  if (node.type === 'symbol') return renderText(node.value, options, key, 'rm');
  if (node.type === 'group') return h(Row, { key, style: { alignItems: 'flex-start' } }, renderGroup(node.children, options, key));
  if (node.type === 'fraction') return renderFraction(node, options, key);
  if (node.type === 'sqrt') return renderSqrt(node, options, key);
  if (node.type === 'script') return renderScript(node, options, key);
  if (node.type === 'matrix') return renderMatrix(node, options, key);
  return null;
}

export function renderMathTree(nodes: MathNode[], options: MathRenderOptions) {
  return h(Row, { style: { alignItems: 'flex-start', flexWrap: 'wrap' } }, nodes.map((node, index) => renderNode(node, options, nodeKey(node, index))));
}
