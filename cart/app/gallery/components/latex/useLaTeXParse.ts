import { useMemo } from 'react';
import { resolveSymbol } from './SymbolMap';

export type TextMode = 'math' | 'rm' | 'bf' | 'bb' | 'cal';

export type MathNode =
  | { type: 'text'; value: string; mode?: TextMode }
  | { type: 'symbol'; value: string }
  | { type: 'group'; children: MathNode[] }
  | { type: 'fraction'; numerator: MathNode[]; denominator: MathNode[] }
  | { type: 'sqrt'; radicand: MathNode[]; index?: MathNode[] }
  | { type: 'script'; base: MathNode; superscript?: MathNode[]; subscript?: MathNode[] }
  | { type: 'matrix'; variant: 'matrix' | 'pmatrix' | 'bmatrix' | 'vmatrix'; rows: MathNode[][][] }
  | { type: 'empty' };

type ParseResult = { nodes: MathNode[]; next: number };

function textNode(value: string, mode: TextMode = 'math'): MathNode[] {
  return value ? [{ type: 'text', value, mode }] : [];
}

const MATHBB: Record<string, string> = {
  A: '𝔸', B: '𝔹', C: 'ℂ', D: '𝔻', E: '𝔼', F: '𝔽', G: '𝔾', H: 'ℍ',
  I: '𝕀', J: '𝕁', K: '𝕂', L: '𝕃', M: '𝕄', N: 'ℕ', O: '𝕆', P: 'ℙ',
  Q: 'ℚ', R: 'ℝ', S: '𝕊', T: '𝕋', U: '𝕌', V: '𝕍', W: '𝕎', X: '𝕏',
  Y: '𝕐', Z: 'ℤ',
  a: '𝕒', b: '𝕓', c: '𝕔', d: '𝕕', e: '𝕖', f: '𝕗', g: '𝕘', h: '𝕙',
  i: '𝕚', j: '𝕛', k: '𝕜', l: '𝕝', m: '𝕞', n: '𝕟', o: '𝕠', p: '𝕡',
  q: '𝕢', r: '𝕣', s: '𝕤', t: '𝕥', u: '𝕦', v: '𝕧', w: '𝕨', x: '𝕩',
  y: '𝕪', z: '𝕫',
  '0': '𝟘', '1': '𝟙', '2': '𝟚', '3': '𝟛', '4': '𝟜',
  '5': '𝟝', '6': '𝟞', '7': '𝟟', '8': '𝟠', '9': '𝟡',
};

function mathbbText(s: string): string {
  let out = '';
  for (const ch of s) out += MATHBB[ch] ?? ch;
  return out;
}

// Combining marks applied *after* the base char.
const COMBINING: Record<string, string> = {
  vec: '⃗',       // combining right arrow above
  hat: '̂',       // combining circumflex
  bar: '̄',       // combining macron
  overline: '̅',  // combining overline
  tilde: '̃',     // combining tilde
  dot: '̇',       // combining dot above
  ddot: '̈',      // combining diaeresis
};

function applyCombining(s: string, mark: string): string {
  if (!s) return s;
  let out = '';
  for (const ch of s) out += ch + mark;
  return out;
}

function cloneNode(node: MathNode): MathNode {
  if (node.type === 'group') return { type: 'group', children: node.children.slice() };
  if (node.type === 'script') {
    return {
      type: 'script',
      base: cloneNode(node.base),
      superscript: node.superscript ? node.superscript.slice() : undefined,
      subscript: node.subscript ? node.subscript.slice() : undefined,
    };
  }
  if (node.type === 'fraction') {
    return { type: 'fraction', numerator: node.numerator.slice(), denominator: node.denominator.slice() };
  }
  if (node.type === 'sqrt') {
    return { type: 'sqrt', radicand: node.radicand.slice(), index: node.index ? node.index.slice() : undefined };
  }
  if (node.type === 'matrix') {
    return { type: 'matrix', variant: node.variant, rows: node.rows.map((row) => row.map((cell) => cell.slice())) };
  }
  return { ...node };
}

function parseBalanced(source: string, start: number, open = '{', close = '}'): ParseResult {
  let depth = 1;
  let index = start;
  while (index < source.length) {
    const ch = source[index];
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) break;
    } else if (ch === '\\' && source[index + 1] === close) {
      index += 1;
    }
    index += 1;
  }
  const inner = source.slice(start, index);
  return { nodes: parseSequence(inner).nodes, next: Math.min(source.length, index + 1) };
}

function readCommand(source: string, start: number): { name: string; next: number } {
  let index = start;
  if (index >= source.length) return { name: '', next: index };
  if (!/[A-Za-z]/.test(source[index])) {
    return { name: source[index], next: index + 1 };
  }
  while (index < source.length && /[A-Za-z]/.test(source[index])) index += 1;
  return { name: source.slice(start, index), next: index };
}

function parseScriptContent(source: string, start: number): ParseResult {
  if (source[start] === '{') return parseBalanced(source, start + 1);
  const atom = parseAtom(source, start);
  return { nodes: atom.nodes.length > 0 ? atom.nodes : textNode(source[start] || ''), next: atom.next };
}

function attachScript(base: MathNode[], kind: '^' | '_', script: MathNode[]): MathNode[] {
  if (base.length === 0) return base;
  const lastIndex = base.length - 1;
  const prev = base[lastIndex];
  if (prev.type === 'script') {
    const next = cloneNode(prev) as Extract<MathNode, { type: 'script' }>;
    if (kind === '^') next.superscript = script;
    else next.subscript = script;
    return base.slice(0, lastIndex).concat(next);
  }
  const wrapped: MathNode = kind === '^'
    ? { type: 'script', base: cloneNode(prev), superscript: script }
    : { type: 'script', base: cloneNode(prev), subscript: script };
  return base.slice(0, lastIndex).concat(wrapped);
}

function parseAtom(source: string, start: number): ParseResult {
  let index = start;
  if (index >= source.length) return { nodes: [], next: index };
  const ch = source[index];

  if (ch === '{') {
    return parseBalanced(source, index + 1);
  }

  if (ch === '\\') {
    const { name, next } = readCommand(source, index + 1);
    if (!name) return { nodes: textNode('\\'), next: index + 1 };

    if (name === 'frac' || name === 'binom') {
      const numerator = source[next] === '{' ? parseBalanced(source, next + 1) : parseAtom(source, next);
      const denominator = numerator.next < source.length && source[numerator.next] === '{'
        ? parseBalanced(source, numerator.next + 1)
        : parseAtom(source, numerator.next);
      const node: MathNode =
        name === 'binom'
          ? { type: 'group', children: [{ type: 'text', value: '(' }, { type: 'fraction', numerator: numerator.nodes, denominator: denominator.nodes }, { type: 'text', value: ')' }] }
          : { type: 'fraction', numerator: numerator.nodes, denominator: denominator.nodes };
      return { nodes: [node], next: denominator.next };
    }

    if (name === 'sqrt') {
      let read = next;
      let indexNodes: MathNode[] | undefined;
      if (source[read] === '[') {
        const inner = parseBalanced(source, read + 1, '[', ']');
        indexNodes = inner.nodes;
        read = inner.next;
      }
      const radicand = source[read] === '{' ? parseBalanced(source, read + 1) : parseAtom(source, read);
      return { nodes: [{ type: 'sqrt', index: indexNodes, radicand: radicand.nodes }], next: radicand.next };
    }

    if (name === 'begin') {
      const env = source[next] === '{' ? parseBalanced(source, next + 1) : { nodes: [] as MathNode[], next };
      const envName = env.nodes.map((node) => (node.type === 'text' ? node.value : '')).join('').trim();
      const endTag = `\\end{${envName}}`;
      const bodyStart = env.next;
      const bodyEnd = source.indexOf(endTag, bodyStart);
      const body = bodyEnd >= 0 ? source.slice(bodyStart, bodyEnd) : source.slice(bodyStart);
      return {
        nodes: [parseMatrix(envName as any, body)],
        next: bodyEnd >= 0 ? bodyEnd + endTag.length : source.length,
      };
    }

    if (name === 'text' || name === 'mathrm' || name === 'operatorname') {
      if (source[next] === '{') {
        const inner = parseRawText(source, next + 1);
        return { nodes: textNode(inner.text, 'rm'), next: inner.next };
      }
      return { nodes: textNode(name, 'rm'), next };
    }

    if (name === 'mathbb') {
      if (source[next] === '{') {
        const inner = parseRawText(source, next + 1);
        return { nodes: textNode(mathbbText(inner.text), 'rm'), next: inner.next };
      }
      return { nodes: textNode(name, 'rm'), next };
    }

    if (name === 'mathbf' || name === 'bm') {
      if (source[next] === '{') {
        const inner = parseRawText(source, next + 1);
        return { nodes: textNode(inner.text, 'bf'), next: inner.next };
      }
      return { nodes: textNode(name, 'bf'), next };
    }

    if (name === 'mathit') {
      if (source[next] === '{') {
        const inner = parseRawText(source, next + 1);
        return { nodes: textNode(inner.text, 'math'), next: inner.next };
      }
      return { nodes: textNode(name, 'math'), next };
    }

    if (name === 'mathcal') {
      if (source[next] === '{') {
        const inner = parseRawText(source, next + 1);
        return { nodes: textNode(inner.text, 'cal'), next: inner.next };
      }
      return { nodes: textNode(name, 'cal'), next };
    }

    if (name in COMBINING) {
      const mark = COMBINING[name];
      if (source[next] === '{') {
        const inner = parseRawText(source, next + 1);
        return { nodes: textNode(applyCombining(inner.text, mark), 'math'), next: inner.next };
      }
      if (next < source.length) {
        return { nodes: textNode(applyCombining(source[next], mark), 'math'), next: next + 1 };
      }
      return { nodes: textNode(name), next };
    }

    if (name === 'underline') {
      // Soft fallback — render underlined arg as its content.
      if (source[next] === '{') {
        const inner = parseBalanced(source, next + 1);
        return { nodes: inner.nodes, next: inner.next };
      }
      return { nodes: textNode(name), next };
    }

    if (name === 'ce' || name === 'chemfig') {
      if (source[next] === '{') {
        const inner = parseRawText(source, next + 1);
        const normalized = name === 'ce' ? normalizeChemSource(inner.text) : inner.text;
        return { nodes: parseSequence(normalized).nodes, next: inner.next };
      }
      return { nodes: textNode(name), next };
    }

    const symbol = resolveSymbol(name);
    if (symbol) return { nodes: [{ type: 'symbol', value: symbol }], next };
    return { nodes: textNode(name), next };
  }

  if (ch === '^' || ch === '_') {
    return { nodes: [], next: index + 1 };
  }

  if (ch === '}' || ch === ']') {
    return { nodes: [], next: index };
  }

  if (/\s/.test(ch)) {
    let j = index;
    while (j < source.length && /\s/.test(source[j])) j += 1;
    return { nodes: [{ type: 'text', value: ' ' }], next: j };
  }

  let j = index;
  while (j < source.length) {
    const cur = source[j];
    if (cur === '\\' || cur === '{' || cur === '}' || cur === '[' || cur === ']' || cur === '^' || cur === '_') break;
    if (/\s/.test(cur)) break;
    j += 1;
  }
  return { nodes: [{ type: 'text', value: source.slice(index, j) }], next: j };
}

function parseSequence(source: string): ParseResult {
  const nodes: MathNode[] = [];
  let index = 0;
  while (index < source.length) {
    const ch = source[index];
    if (ch === '}' || ch === ']') break;
    if (ch === '^' || ch === '_') {
      const script = parseScriptContent(source, index + 1);
      const next = attachScript(nodes, ch, script.nodes);
      nodes.length = 0;
      nodes.push(...next);
      index = script.next;
      continue;
    }
    const atom = parseAtom(source, index);
    if (atom.nodes.length > 0) nodes.push(...atom.nodes);
    index = atom.next > index ? atom.next : index + 1;
  }
  return { nodes, next: index };
}

function parseRawText(source: string, start: number): { text: string; next: number } {
  let index = start;
  let depth = 1;
  let out = '';
  while (index < source.length) {
    const ch = source[index];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
    out += ch;
    index += 1;
  }
  return { text: out, next: Math.min(source.length, index + 1) };
}

function splitTopLevel(source: string, delimiter: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth = Math.max(0, depth - 1);
    if (depth === 0 && source.startsWith(delimiter, i)) {
      out.push(source.slice(start, i));
      start = i + delimiter.length;
      i += delimiter.length - 1;
    }
  }
  out.push(source.slice(start));
  return out;
}

function parseMatrix(variant: 'matrix' | 'pmatrix' | 'bmatrix' | 'vmatrix', body: string): MathNode {
  const rows = splitTopLevel(body, '\\\\')
    .map((row) => splitTopLevel(row, '&').map((cell) => parseSequence(cell).nodes))
    .filter((row) => row.some((cell) => cell.length > 0));
  return { type: 'matrix', variant, rows };
}

function normalizeChemSource(source: string): string {
  let out = source.replace(/\s+/g, ' ').trim();
  out = out.replace(/<=>/g, ' \\leftrightarrow ');
  out = out.replace(/<->/g, ' \\leftrightarrow ');
  out = out.replace(/->/g, ' \\to ');
  out = out.replace(/<-/g, ' \\leftarrow ');
  out = out.replace(/([A-Za-z\)])(\d+)/g, '$1_$2');
  out = out.replace(/\b([A-Z][a-z]?)_([0-9]+)/g, '$1_$2');
  return out;
}

export function parseLaTeX(source: string): MathNode[] {
  return parseSequence(String(source || '')).nodes;
}

export function useLaTeXParse(source: string): MathNode[] {
  return useMemo(() => parseLaTeX(source), [source]);
}
