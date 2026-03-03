import React, { useMemo } from 'react';
import { Box, Text } from './primitives';
import type { Style } from './types';

export interface CodeBlockProps {
  code: string;
  language?: string;
  fontSize?: number;
  style?: Style;
  maxLines?: number;
}

type TokenType =
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'component'
  | 'tag'
  | 'prop'
  | 'identifier'
  | 'punctuation'
  | 'text';

interface Token {
  text: string;
  type: TokenType;
}

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for',
  'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'this',
  'class', 'extends', 'import', 'export', 'from', 'default', 'true',
  'false', 'null', 'undefined', 'typeof', 'instanceof', 'in', 'of',
  'try', 'catch', 'finally', 'throw', 'async', 'await', 'yield',
]);

const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: '#c678dd',
  string: '#98c379',
  number: '#d19a66',
  comment: '#5c6370',
  component: '#61afef',
  tag: '#e06c75',
  prop: '#d19a66',
  identifier: '#abb2bf',
  punctuation: '#7f8ba3',
  text: '#abb2bf',
};

const DEFAULT_MAX_LINES = 400;
const DEFAULT_FONT_SIZE = 10;

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let inJSXTag = false;

  while (i < line.length) {
    const ch = line[i];

    if (ch === '/' && line[i + 1] === '/') {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }

    if (ch === '/' && line[i + 1] === '*') {
      const end = line.indexOf('*/', i + 2);
      if (end >= 0) {
        tokens.push({ text: line.slice(i, end + 2), type: 'comment' });
        i = end + 2;
      } else {
        tokens.push({ text: line.slice(i), type: 'comment' });
        break;
      }
      continue;
    }

    if (ch === '"' || ch === '\'' || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === '\\') j += 1;
        j += 1;
      }
      if (j < line.length) j += 1;
      tokens.push({ text: line.slice(i, j), type: 'string' });
      i = j;
      continue;
    }

    if (ch === '<' && line[i + 1] === '/') {
      tokens.push({ text: '</', type: 'tag' });
      i += 2;
      inJSXTag = true;
      const start = i;
      while (i < line.length && /[a-zA-Z0-9_.]/.test(line[i])) i += 1;
      if (i > start) {
        const name = line.slice(start, i);
        tokens.push({ text: name, type: name[0] >= 'A' && name[0] <= 'Z' ? 'component' : 'tag' });
      }
      continue;
    }

    if (ch === '<' && i + 1 < line.length) {
      const next = line[i + 1];
      if (next === '>') {
        tokens.push({ text: '<>', type: 'tag' });
        i += 2;
        continue;
      }
      if (/[a-zA-Z]/.test(next)) {
        tokens.push({ text: '<', type: 'tag' });
        i += 1;
        inJSXTag = true;
        const start = i;
        while (i < line.length && /[a-zA-Z0-9_.]/.test(line[i])) i += 1;
        if (i > start) {
          const name = line.slice(start, i);
          tokens.push({ text: name, type: name[0] >= 'A' && name[0] <= 'Z' ? 'component' : 'tag' });
        }
        continue;
      }
    }

    if (ch === '/' && line[i + 1] === '>') {
      tokens.push({ text: '/>', type: 'tag' });
      i += 2;
      inJSXTag = false;
      continue;
    }

    if (ch === '>' && inJSXTag) {
      tokens.push({ text: '>', type: 'tag' });
      i += 1;
      inJSXTag = false;
      continue;
    }

    if (/[0-9]/.test(ch)) {
      const start = i;
      if (ch === '0' && (line[i + 1] === 'x' || line[i + 1] === 'X')) {
        i += 2;
        while (i < line.length && /[0-9a-fA-F]/.test(line[i])) i += 1;
      } else {
        while (i < line.length && /[0-9.]/.test(line[i])) i += 1;
      }
      tokens.push({ text: line.slice(start, i), type: 'number' });
      continue;
    }

    if (/[a-zA-Z_$]/.test(ch)) {
      const start = i;
      while (i < line.length && /[a-zA-Z0-9_$]/.test(line[i])) i += 1;
      const word = line.slice(start, i);
      if (inJSXTag && line[i] === '=') tokens.push({ text: word, type: 'prop' });
      else if (KEYWORDS.has(word)) tokens.push({ text: word, type: 'keyword' });
      else tokens.push({ text: word, type: 'identifier' });
      continue;
    }

    if (/\s/.test(ch)) {
      const start = i;
      while (i < line.length && /\s/.test(line[i])) i += 1;
      tokens.push({ text: line.slice(start, i), type: 'text' });
      continue;
    }

    if ('{}()[];:,.=+->!&|?'.includes(ch)) {
      const three = line.slice(i, i + 3);
      const two = line.slice(i, i + 2);
      if (three === '===' || three === '!==' || three === '...') {
        tokens.push({ text: three, type: 'punctuation' });
        i += 3;
      } else if (two === '=>' || two === '==' || two === '!=' || two === '&&' || two === '||') {
        tokens.push({ text: two, type: 'punctuation' });
        i += 2;
      } else {
        tokens.push({ text: ch, type: 'punctuation' });
        i += 1;
      }
      continue;
    }

    tokens.push({ text: ch, type: 'text' });
    i += 1;
  }

  return tokens;
}

export function CodeBlock({
  code,
  language,
  fontSize = DEFAULT_FONT_SIZE,
  style,
  maxLines = DEFAULT_MAX_LINES,
}: CodeBlockProps) {
  const { lines, totalLines, truncated } = useMemo(() => {
    const split = (code || '').split('\n');
    const safeMax = Math.max(1, Math.floor(maxLines));
    const visible = split.slice(0, safeMax);
    return {
      lines: visible.map((line) => tokenizeLine(line)),
      totalLines: split.length,
      truncated: split.length > safeMax,
    };
  }, [code, maxLines, language]);

  return (
    <Box
      style={{
        backgroundColor: '#0f111a',
        borderWidth: 1,
        borderColor: '#2b2f3a',
        borderRadius: 8,
        overflow: 'scroll',
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: 12,
        paddingRight: 12,
        ...style,
      }}
    >
      {lines.map((lineTokens, lineIndex) => (
        <Text
          key={`line-${lineIndex}`}
          style={{
            fontSize,
            fontFamily: 'monospace',
            lineHeight: fontSize + 3,
            color: '#abb2bf',
          }}
        >
          {lineTokens.map((token, tokenIndex) => (
            <Text
              key={`line-${lineIndex}-token-${tokenIndex}`}
              style={{
                fontSize,
                fontFamily: 'monospace',
                color: TOKEN_COLORS[token.type],
              }}
            >
              {token.text}
            </Text>
          ))}
        </Text>
      ))}

      {truncated ? (
        <Text
          style={{
            fontSize,
            fontFamily: 'monospace',
            color: '#7f8ba3',
            marginTop: 6,
          }}
        >
          {`... truncated ${totalLines - lines.length} lines`}
        </Text>
      ) : null}
    </Box>
  );
}
