/**
 * Tiny Intent-subset parser for chat-response surfaces.
 *
 * Input: a string the model emits, ideally wrapped in `[ ... ]`.
 * Output: an AST (Node[]).
 *
 * Allowlist tags only — unknown tags fall back to plain text so model
 * mistakes are visible, not crashes.
 *
 * Supported:
 *   <Row>...</Row>           container, horizontal
 *   <Col>...</Col>           container, vertical
 *   <Card>...</Card>         padded surface
 *   <Title>text</Title>      large text
 *   <Text>text</Text>        body text
 *   <List items...>          one item per line of text content
 *   <Btn reply="...">label</Btn>   choice button; clicking sends reply
 *
 * Attributes: key="value" or key='value' or bare key (boolean true).
 * Self-closing supported: <Foo />.
 */

export type NodeKind =
  | 'Row' | 'Col' | 'Card' | 'Title' | 'Text' | 'List' | 'Btn'
  | 'Form' | 'Field' | 'Submit'
  | 'Badge' | 'Code' | 'Divider' | 'Kbd' | 'Spacer'
  | 'text';

export interface Node {
  kind: NodeKind;
  attrs: Record<string, string | true>;
  children: Node[];
  text?: string;
}

const ALLOWED = new Set<NodeKind>([
  'Row', 'Col', 'Card', 'Title', 'Text', 'List', 'Btn',
  'Form', 'Field', 'Submit',
  'Badge', 'Code', 'Divider', 'Kbd', 'Spacer',
]);

export function parseIntent(input: string): Node[] {
  // Strip an outer [ ... ] wrapper if present.
  let src = input.trim();
  const openBracket = src.indexOf('[');
  const closeBracket = src.lastIndexOf(']');
  if (openBracket !== -1 && closeBracket > openBracket) {
    src = src.slice(openBracket + 1, closeBracket).trim();
  }
  // Strip a fragment wrapper <>...</> if present.
  if (src.startsWith('<>') && src.endsWith('</>')) {
    src = src.slice(2, -3).trim();
  }
  const p = new Parser(src);
  return p.parseChildren(null);
}

class Parser {
  pos = 0;
  constructor(public src: string) {}

  parseChildren(closer: string | null): Node[] {
    const out: Node[] = [];
    while (this.pos < this.src.length) {
      const lt = this.src.indexOf('<', this.pos);
      if (lt === -1) {
        const tail = this.src.slice(this.pos).trim();
        if (tail) out.push({ kind: 'text', attrs: {}, children: [], text: tail });
        this.pos = this.src.length;
        break;
      }
      if (lt > this.pos) {
        const txt = this.src.slice(this.pos, lt).trim();
        if (txt) out.push({ kind: 'text', attrs: {}, children: [], text: txt });
      }
      this.pos = lt;
      // Our own closing tag — consume and return.
      if (closer && this.peekClose(closer)) {
        this.pos += closer.length + 3;
        return out;
      }
      // Unrelated closing tag — skip to recover, don't unwind.
      if (this.src[this.pos + 1] === '/') {
        const gt = this.src.indexOf('>', this.pos);
        if (gt === -1) { this.pos = this.src.length; break; }
        this.pos = gt + 1;
        continue;
      }
      const node = this.parseElement();
      if (node) out.push(node);
    }
    return out;
  }

  peekClose(name: string): boolean {
    const tag = `</${name}>`;
    return this.src.slice(this.pos, this.pos + tag.length).toLowerCase() === tag.toLowerCase();
  }

  parseElement(): Node | null {
    if (this.src[this.pos] !== '<') return null;
    this.pos++; // consume <
    const nameStart = this.pos;
    while (this.pos < this.src.length && /[A-Za-z0-9_]/.test(this.src[this.pos])) this.pos++;
    const rawName = this.src.slice(nameStart, this.pos);
    const name = normalizeName(rawName);
    const attrs: Record<string, string | true> = {};
    let selfClose = false;

    while (this.pos < this.src.length) {
      this.skipWs();
      const ch = this.src[this.pos];
      if (ch === '>') {
        this.pos++;
        break;
      }
      if (ch === '/' && this.src[this.pos + 1] === '>') {
        selfClose = true;
        this.pos += 2;
        break;
      }
      if (this.pos >= this.src.length) break;
      const keyStart = this.pos;
      while (this.pos < this.src.length && /[A-Za-z0-9_-]/.test(this.src[this.pos])) this.pos++;
      const key = this.src.slice(keyStart, this.pos);
      if (!key) {
        this.pos++; // skip stray char
        continue;
      }
      this.skipWs();
      if (this.src[this.pos] === '=') {
        this.pos++;
        this.skipWs();
        const q = this.src[this.pos];
        if (q === '"' || q === "'") {
          this.pos++;
          const valStart = this.pos;
          while (this.pos < this.src.length && this.src[this.pos] !== q) this.pos++;
          attrs[key] = this.src.slice(valStart, this.pos);
          if (this.src[this.pos] === q) this.pos++;
        } else {
          const valStart = this.pos;
          while (this.pos < this.src.length && !/[\s>/]/.test(this.src[this.pos])) this.pos++;
          attrs[key] = this.src.slice(valStart, this.pos);
        }
      } else {
        attrs[key] = true;
      }
    }

    if (!ALLOWED.has(name as NodeKind)) {
      // Unknown tag — render its text content as plain text, recover.
      if (selfClose) return { kind: 'text', attrs: {}, children: [], text: `<${rawName}/>` };
      const inner = this.parseChildren(rawName);
      const flat = inner.map((n) => n.text ?? '').join(' ').trim();
      return { kind: 'text', attrs: {}, children: [], text: flat || `<${rawName}>` };
    }

    if (selfClose) return { kind: name as NodeKind, attrs, children: [] };
    const children = this.parseChildren(rawName);
    return { kind: name as NodeKind, attrs, children };
  }

  skipWs() {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) this.pos++;
  }
}

function normalizeName(raw: string): string {
  // Accept lowercase variants too (Gemma may emit <row> instead of <Row>).
  const map: Record<string, NodeKind> = {
    row: 'Row', col: 'Col', column: 'Col', card: 'Card',
    title: 'Title', text: 'Text', list: 'List', btn: 'Btn', button: 'Btn',
    form: 'Form', field: 'Field', input: 'Field',
    submit: 'Submit',
    badge: 'Badge', pill: 'Badge', chip: 'Badge', tag: 'Badge',
    code: 'Code', pre: 'Code',
    divider: 'Divider', hr: 'Divider', separator: 'Divider',
    kbd: 'Kbd', key: 'Kbd', shortcut: 'Kbd',
    spacer: 'Spacer', gap: 'Spacer',
  };
  return map[raw.toLowerCase()] ?? raw;
}
