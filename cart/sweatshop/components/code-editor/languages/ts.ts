export type Token = { text: string; kind: string };

const KEYWORDS = new Set([
  'import', 'from', 'export', 'default', 'as', 'const', 'let', 'var', 'function', 'return',
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch',
  'finally', 'throw', 'new', 'this', 'class', 'extends', 'implements', 'interface', 'type',
  'enum', 'namespace', 'module', 'declare', 'abstract', 'readonly', 'private', 'protected',
  'public', 'static', 'async', 'await', 'yield', 'typeof', 'instanceof', 'in', 'of', 'void',
  'null', 'undefined', 'true', 'false', 'debugger', 'with',
]);

const TYPES = new Set([
  'string', 'number', 'boolean', 'any', 'unknown', 'never', 'void', 'object', 'symbol',
  'bigint', 'Array', 'Record', 'Partial', 'Required', 'Pick', 'Omit', 'Exclude', 'Extract',
  'Promise', 'Map', 'Set', 'Date', 'RegExp', 'Error', 'Function',
]);

function isWordStart(ch: string): boolean {
  return /[a-zA-Z_$]/.test(ch);
}

function isWordChar(ch: string): boolean {
  return /[a-zA-Z0-9_$]/.test(ch);
}

function isDigit(ch: string): boolean {
  return /[0-9]/.test(ch);
}

export function tokenizeTS(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line.charAt(i);
    const next = i + 1 < line.length ? line.charAt(i + 1) : '';

    if (ch === ' ' || ch === '\t') {
      const start = i;
      while (i < line.length && (line.charAt(i) === ' ' || line.charAt(i) === '\t')) i++;
      tokens.push({ text: line.slice(start, i), kind: 'text' });
      continue;
    }

    if (ch === '/' && next === '/') {
      tokens.push({ text: line.slice(i), kind: 'comment' });
      break;
    }

    if (ch === '/' && next === '*') {
      const start = i;
      i += 2;
      while (i < line.length - 1 && !(line.charAt(i) === '*' && line.charAt(i + 1) === '/')) i++;
      if (i < line.length - 1) i += 2;
      tokens.push({ text: line.slice(start, i), kind: 'comment' });
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      const start = i;
      i++;
      while (i < line.length) {
        if (line.charAt(i) === quote && line.charAt(i - 1) !== '\\') { i++; break; }
        i++;
      }
      tokens.push({ text: line.slice(start, i), kind: 'string' });
      continue;
    }

    if (isDigit(ch)) {
      const start = i;
      i++;
      while (i < line.length && (isDigit(line.charAt(i)) || line.charAt(i) === '.')) i++;
      tokens.push({ text: line.slice(start, i), kind: 'number' });
      continue;
    }

    if (isWordStart(ch)) {
      const start = i;
      i++;
      while (i < line.length && isWordChar(line.charAt(i))) i++;
      const word = line.slice(start, i);
      let kind = 'text';
      if (KEYWORDS.has(word)) kind = 'keyword';
      else if (TYPES.has(word)) kind = 'type';
      else if (/^[A-Z][a-zA-Z0-9_$]*$/.test(word)) kind = 'type';
      else if (/^[A-Z][A-Z0-9_]*$/.test(word)) kind = 'constant';
      tokens.push({ text: word, kind });
      continue;
    }

    if ('{}[]()=:;+-*%!&|<>?/.,~'.includes(ch)) {
      tokens.push({ text: ch, kind: 'operator' });
      i++;
      continue;
    }

    tokens.push({ text: ch, kind: 'text' });
    i++;
  }
  if (tokens.length === 0) tokens.push({ text: ' ', kind: 'text' });
  return tokens;
}
