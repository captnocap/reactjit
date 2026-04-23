export type Token = { text: string; kind: string };

const KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
  'then', 'true', 'until', 'while',
]);

const LIBS = new Set([
  'print', 'pairs', 'ipairs', 'next', 'type', 'tostring', 'tonumber', 'assert',
  'error', 'pcall', 'xpcall', 'require', 'load', 'loadfile', 'dofile',
]);

export function tokenizeLua(line: string): Token[] {
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

    if (ch === '-' && next === '-') {
      tokens.push({ text: line.slice(i), kind: 'comment' });
      break;
    }

    if (ch === '"' || ch === "'") {
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

    if (ch === '[' && next === '[') {
      const start = i;
      i += 2;
      while (i < line.length - 1 && !(line.charAt(i) === ']' && line.charAt(i + 1) === ']')) i++;
      if (i < line.length - 1) i += 2;
      tokens.push({ text: line.slice(start, i), kind: 'string' });
      continue;
    }

    if (/[0-9]/.test(ch)) {
      const start = i;
      i++;
      while (i < line.length && (/[0-9]/.test(line.charAt(i)) || line.charAt(i) === '.')) i++;
      tokens.push({ text: line.slice(start, i), kind: 'number' });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      i++;
      while (i < line.length && /[a-zA-Z0-9_]/.test(line.charAt(i))) i++;
      const word = line.slice(start, i);
      let kind = 'variable';
      if (KEYWORDS.has(word)) kind = 'keyword';
      else if (LIBS.has(word)) kind = 'function';
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
