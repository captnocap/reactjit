import { COLORS, fileGlyph, fileTone, inferFileType, languageForType, statusLabel, statusTone, stripDotSlash } from './theme';

export function iconLabel(icon: string): string {
  if (icon === 'house') return 'HM';
  if (icon === 'package') return 'WS';
  if (icon === 'folder') return 'FD';
  if (icon === 'folder-open') return 'FO';
  if (icon === 'file-code') return 'TS';
  if (icon === 'file-json') return 'JS';
  if (icon === 'file-text') return 'TX';
  if (icon === 'palette') return 'PL';
  if (icon === 'braces') return '{}';
  if (icon === 'terminal') return 'SH';
  if (icon === 'panel-left') return 'ED';
  if (icon === 'search') return 'SR';
  if (icon === 'message') return 'AG';
  if (icon === 'git') return 'BR';
  if (icon === 'bot') return 'AI';
  if (icon === 'globe') return 'WB';
  if (icon === 'sparkles') return 'FX';
  if (icon === 'refresh') return 'RF';
  if (icon === 'close') return 'X';
  if (icon === 'plus') return '+';
  if (icon === 'hash') return '#';
  if (icon === 'at') return '@';
  if (icon === 'send') return '->';
  if (icon === 'info') return 'i';
  if (icon === 'warn') return '!';
  return icon.length <= 2 ? icon : icon.slice(0, 2).toUpperCase();
}

export function trimLines(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => stripDotSlash(line.trimEnd()))
    .filter((line) => line.length > 0);
}

export function primaryMainView(activeView: string, currentFilePath: string): 'landing' | 'settings' | 'editor' {
  if (activeView === 'landing' || currentFilePath === '__landing__') return 'landing';
  if (activeView === 'settings' || currentFilePath === '__settings__') return 'settings';
  return 'editor';
}

export function estimateTokens(text: string, attachments: Array<{ type: string }>): number {
  let estimate = Math.ceil((text || '').length / 4);
  for (const attachment of attachments) {
    estimate += attachment.type === 'git' ? 900 : 500;
  }
  return estimate;
}

export function previousNonSpace(line: string, idx: number): string {
  let i = idx;
  while (i >= 0) {
    const ch = line.charAt(i);
    if (ch !== ' ' && ch !== '\t') return ch;
    i -= 1;
  }
  return '';
}

export function nextNonSpace(line: string, idx: number): string {
  let i = idx;
  while (i < line.length) {
    const ch = line.charAt(i);
    if (ch !== ' ' && ch !== '\t') return ch;
    i += 1;
  }
  return '';
}

export function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

export function isWordStart(ch: string): boolean {
  return (
    (ch >= 'a' && ch <= 'z') ||
    (ch >= 'A' && ch <= 'Z') ||
    ch === '_' ||
    ch === '$'
  );
}

export function isWordChar(ch: string): boolean {
  return isWordStart(ch) || isDigit(ch);
}

export function isKeyword(word: string): boolean {
  return [
    'import', 'from', 'export', 'function', 'return', 'const', 'let', 'var',
    'if', 'else', 'for', 'while', 'async', 'await', 'try', 'catch', 'interface',
    'type', 'extends', 'new', 'class', 'declare', 'useState',
  ].includes(word);
}

export function isTypeWord(word: string): boolean {
  return [
    'string', 'number', 'boolean', 'void', 'any', 'unknown', 'Promise', 'Set',
    'Map', 'Box', 'Text', 'Pressable', 'ScrollView', 'TextInput',
  ].includes(word);
}

export function isPascalWord(word: string): boolean {
  return /^[A-Z][A-Za-z0-9_$]*$/.test(word);
}

export function isConstantWord(word: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(word) && word.includes('_');
}

export function previousWord(line: string, idx: number): string {
  if (idx < 0) return '';
  const prefix = line.slice(0, idx + 1);
  const match = prefix.match(/([A-Za-z_$][A-Za-z0-9_$]*)[^A-Za-z0-9_$]*$/);
  return match ? match[1] : '';
}

export function tokenizeLine(line: string, context?: { inImportSpecifiers?: boolean }): Array<{ text: string; kind: string }> {
  const tokens: Array<{ text: string; kind: string }> = [];
  let i = 0;
  const inImportSpecifiers = !!context?.inImportSpecifiers;

  while (i < line.length) {
    const ch = line.charAt(i);
    const next = i + 1 < line.length ? line.charAt(i + 1) : '';

    if (ch === ' ' || ch === '\t') {
      const start = i;
      while (i < line.length && (line.charAt(i) === ' ' || line.charAt(i) === '\t')) i += 1;
      tokens.push({ text: line.slice(start, i), kind: 'text' });
      continue;
    }

    if (ch === '/' && next === '/') {
      tokens.push({ text: line.slice(i), kind: 'comment' });
      break;
    }

    if (ch === '"' || ch === '\'' || ch === '`') {
      const quote = ch;
      const start = i;
      i += 1;
      while (i < line.length) {
        if (line.charAt(i) === quote && line.charAt(i - 1) !== '\\') {
          i += 1;
          break;
        }
        i += 1;
      }
      tokens.push({ text: line.slice(start, i), kind: 'string' });
      continue;
    }

    if (isDigit(ch)) {
      const start = i;
      i += 1;
      while (i < line.length && (isDigit(line.charAt(i)) || line.charAt(i) === '.')) i += 1;
      tokens.push({ text: line.slice(start, i), kind: 'number' });
      continue;
    }

    if (ch === '<') {
      tokens.push({ text: '<', kind: 'tag' });
      i += 1;
      if (line.charAt(i) === '/') {
        tokens.push({ text: '/', kind: 'tag' });
        i += 1;
      }
      const start = i;
      while (i < line.length && isWordChar(line.charAt(i))) i += 1;
      if (i > start) tokens.push({ text: line.slice(start, i), kind: 'tag' });
      continue;
    }

    if (isWordStart(ch)) {
      const start = i;
      i += 1;
      while (i < line.length && isWordChar(line.charAt(i))) i += 1;
      const word = line.slice(start, i);
      const prev = previousNonSpace(line, start - 1);
      const prevWordName = previousWord(line, start - 1);
      const nextCh = nextNonSpace(line, i);
      let kind = 'text';
      if (isKeyword(word) || word === 'as') kind = 'keyword';
      else if (inImportSpecifiers) {
        if (isConstantWord(word)) kind = 'constant';
        else if (isPascalWord(word) || isTypeWord(word)) kind = 'type';
        else kind = 'imported';
      } else if (isConstantWord(word)) kind = 'constant';
      else if (isTypeWord(word)) kind = 'type';
      else if (prev === '<' || (prev === '/' && previousNonSpace(line, start - 2) === '<')) kind = 'tag';
      else if (nextCh === '=' && line.indexOf('<') >= 0) kind = 'attr';
      else if (prev === '.') kind = 'property';
      else if (prevWordName === 'const' || prevWordName === 'let' || prevWordName === 'var' || prevWordName === 'function' || prevWordName === 'class' || prevWordName === 'interface' || prevWordName === 'type') kind = 'symbol';
      else if (nextCh === '(' || word.startsWith('use')) kind = 'function';
      else if (isPascalWord(word)) kind = 'type';
      else if (word === 'props' || word === 'msg' || word === 'state') kind = 'variable';
      tokens.push({ text: word, kind });
      continue;
    }

    if ('{}[]()=:+-*%!&|?/'.includes(ch)) {
      tokens.push({ text: ch, kind: 'operator' });
      i += 1;
      continue;
    }

    if (ch === '>' && previousNonSpace(line, i - 1) !== '=') {
      tokens.push({ text: '>', kind: 'tag' });
      i += 1;
      continue;
    }

    tokens.push({ text: ch, kind: 'text' });
    i += 1;
  }

  if (tokens.length === 0) tokens.push({ text: ' ', kind: 'text' });
  return tokens;
}

export function lineMarker(line: string): string {
  if (line.includes('TODO') || line.includes('FIXME')) return 'todo';
  if (line.includes('function ') || line.includes('export ')) return 'symbol';
  if (line.includes('__exec') || line.includes('git ') || line.includes('curl ')) return 'tool';
  if (line.includes('return ')) return 'flow';
  return '';
}

export function editorAccentTone(marker: string, active: boolean): string {
  if (active) return COLORS.blue;
  if (marker === 'todo') return COLORS.red;
  if (marker === 'symbol') return COLORS.blue;
  if (marker === 'tool') return COLORS.green;
  if (marker === 'flow') return COLORS.purple;
  return '#202938';
}

export function editorTokenTone(kind: string): string {
  if (kind === 'comment') return '#6f9973';
  if (kind === 'string') return '#a5d6a7';
  if (kind === 'number') return '#79c0ff';
  if (kind === 'keyword') return '#c7a8ff';
  if (kind === 'type') return '#90cdf4';
  if (kind === 'imported') return '#79c0ff';
  if (kind === 'symbol') return '#d2a8ff';
  if (kind === 'constant') return '#ffb86b';
  if (kind === 'property') return '#b8c5d6';
  if (kind === 'tag') return '#7ee787';
  if (kind === 'attr') return '#f2c572';
  if (kind === 'function') return '#f2c572';
  if (kind === 'variable') return '#d9e2f2';
  if (kind === 'operator') return '#8b9bb0';
  return COLORS.text;
}
