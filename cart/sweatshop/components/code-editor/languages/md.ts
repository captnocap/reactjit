export type Token = { text: string; kind: string };

export function tokenizeMD(line: string): Token[] {
  const tokens: Token[] = [];
  if (line.trim().startsWith('#')) {
    tokens.push({ text: line, kind: 'keyword' });
    return tokens;
  }
  if (line.trim().startsWith('>')) {
    tokens.push({ text: line, kind: 'comment' });
    return tokens;
  }
  if (line.trim().startsWith('- ') || line.trim().startsWith('* ') || /^\d+\.\s/.test(line.trim())) {
    const m = line.match(/^(\s*)(- |\* |\d+\.\s)(.*)$/);
    if (m) {
      tokens.push({ text: m[1], kind: 'text' });
      tokens.push({ text: m[2], kind: 'operator' });
      tokens.push({ text: m[3], kind: 'text' });
      return tokens;
    }
  }
  if (line.trim().startsWith('```')) {
    tokens.push({ text: line, kind: 'string' });
    return tokens;
  }

  let i = 0;
  while (i < line.length) {
    const ch = line.charAt(i);
    const rest = line.slice(i);

    if (ch === '`') {
      const end = rest.indexOf('`', 1);
      const span = end >= 0 ? end + 1 : rest.length;
      tokens.push({ text: rest.slice(0, span), kind: 'string' });
      i += span;
      continue;
    }

    if (ch === '*' || ch === '_') {
      const end = rest.slice(1).indexOf(ch);
      const span = end >= 0 ? end + 2 : rest.length;
      tokens.push({ text: rest.slice(0, span), kind: 'operator' });
      i += span;
      continue;
    }

    if (ch === '[') {
      const close = rest.indexOf(']', 1);
      const paren = rest.indexOf('(', close);
      const closeParen = paren >= 0 ? rest.indexOf(')', paren) : -1;
      const span = closeParen >= 0 ? closeParen + 1 : rest.length;
      tokens.push({ text: rest.slice(0, span), kind: 'property' });
      i += span;
      continue;
    }

    tokens.push({ text: ch, kind: 'text' });
    i++;
  }
  if (tokens.length === 0) tokens.push({ text: ' ', kind: 'text' });
  return tokens;
}
