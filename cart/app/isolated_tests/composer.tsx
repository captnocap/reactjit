// composer — visual editor for composing a component out of Box/Text/Pressable.
//
// Surface is a fixed 1000×1000 design space — a flex column. Top-level nodes
// stack naturally; nested children stack inside their parent. No absolute
// positioning anywhere, so the rendered visual matches the JSX output 1:1
// (what you see on the canvas is exactly what `<Box>...</Box>` would render).
//
// Toolbar adds primitives; the layers panel shows the tree and lets you
// reorder/delete; the properties panel edits whichever node is selected; the
// code panel shows the JSX live.
//
// Adding a node when a Box is selected nests it inside that Box. Adding when
// a leaf is selected drops it as a sibling in the same parent. Otherwise it
// goes top-level on the surface.
//
// State accessed from event handlers always goes through refs, because
// onPress closures freeze at first commit in this framework.

import * as React from 'react';
import { Box, Row, Col, Text, Pressable, ScrollView, TextInput, TextArea } from '@reactjit/runtime/primitives';

// ── theme ────────────────────────────────────────────────────────
const C_BG      = '#0e0f12';
const C_PANEL   = '#16181c';
const C_PANEL2  = '#1d2026';
const C_BORDER  = '#2a2e35';
const C_FG      = '#dde2ea';
const C_DIM     = '#7e8694';
const C_ACCENT  = '#22d3ee';
const C_DANGER  = '#f87171';

const SURFACE = 1000;

const PALETTE: string[] = [
  'transparent', '#ffffff', '#000000', '#9ca3af',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#a855f7', '#ec4899',
];

// ── tree model ────────────────────────────────────────────────────
type Kind = 'Box' | 'Text' | 'Pressable';

type Align = 'flex-start' | 'center' | 'flex-end';

interface SNode {
  id: string;
  kind: Kind;
  text?: string;
  bg?: string;
  color?: string;
  width?: number;
  height?: number;
  padding?: number;
  // Container-only. alignH = alignItems (cross axis = horizontal, since column flex);
  // alignV = justifyContent (main axis = vertical). Unset → framework defaults
  // (alignItems: stretch, justifyContent: flex-start).
  alignH?: Align;
  alignV?: Align;
  children: SNode[];
}

let _seq = 0;
const nid = (): string => `n${++_seq}`;

function defaults(kind: Kind): SNode {
  const n: SNode = { id: nid(), kind, children: [] };
  if (kind === 'Box') {
    n.width = 240;
    n.height = 140;
    n.bg = '#1f2937';
    n.padding = 16;
  } else if (kind === 'Text') {
    n.text = 'hello!';
    n.color = '#ffffff';
  } else if (kind === 'Pressable') {
    n.text = 'my button';
    n.bg = '#3b82f6';
    n.color = '#ffffff';
    n.padding = 10;
  }
  return n;
}

function find(ns: SNode[], id: string): SNode | null {
  for (const n of ns) {
    if (n.id === id) return n;
    const c = find(n.children, id);
    if (c) return c;
  }
  return null;
}
function findParent(ns: SNode[], id: string): SNode | null {
  for (const n of ns) {
    if (n.children.some((c) => c.id === id)) return n;
    const p = findParent(n.children, id);
    if (p) return p;
  }
  return null;
}
function patch(ns: SNode[], id: string, p: Partial<SNode>): SNode[] {
  return ns.map((n) =>
    n.id === id
      ? { ...n, ...p }
      : { ...n, children: patch(n.children, id, p) },
  );
}
function remove(ns: SNode[], id: string): SNode[] {
  const out: SNode[] = [];
  for (const n of ns) {
    if (n.id === id) continue;
    out.push({ ...n, children: remove(n.children, id) });
  }
  return out;
}
function add(ns: SNode[], parentId: string | null, node: SNode): SNode[] {
  if (parentId == null) return [...ns, node];
  return ns.map((n) =>
    n.id === parentId
      ? { ...n, children: [...n.children, node] }
      : { ...n, children: add(n.children, parentId, node) },
  );
}
function move(ns: SNode[], id: string, delta: -1 | 1): SNode[] {
  const i = ns.findIndex((n) => n.id === id);
  if (i >= 0) {
    const j = i + delta;
    if (j < 0 || j >= ns.length) return ns;
    const out = [...ns];
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  }
  return ns.map((n) => {
    const k = n.children.findIndex((c) => c.id === id);
    if (k >= 0) {
      const m = k + delta;
      if (m < 0 || m >= n.children.length) return n;
      const cs = [...n.children];
      [cs[k], cs[m]] = [cs[m], cs[k]];
      return { ...n, children: cs };
    }
    return { ...n, children: move(n.children, id, delta) };
  });
}

// ── codegen ────────────────────────────────────────────────────────
function styleProps(n: SNode): string[] {
  const p: string[] = [];
  if (n.width  != null) p.push(`width: ${n.width}`);
  if (n.height != null) p.push(`height: ${n.height}`);
  if (n.bg && n.bg !== 'transparent') p.push(`backgroundColor: '${n.bg}'`);
  if (n.padding != null && n.padding > 0) p.push(`padding: ${n.padding}`);
  if (n.alignH) p.push(`alignItems: '${n.alignH}'`);
  if (n.alignV) p.push(`justifyContent: '${n.alignV}'`);
  return p;
}
function emit(n: SNode, depth: number): string {
  const ind = '  '.repeat(depth);
  const sp = styleProps(n);
  const styleAttr = sp.length ? ` style={{ ${sp.join(', ')} }}` : '';
  const colorAttr = (n.kind !== 'Box' && n.color) ? ` color="${n.color}"` : '';
  const txt = n.text ?? '';
  if (n.kind === 'Text')      return `${ind}<Text${colorAttr}${styleAttr}>${txt}</Text>`;
  if (n.kind === 'Pressable') return `${ind}<Pressable${colorAttr}${styleAttr}>${txt}</Pressable>`;
  if (n.children.length === 0) return `${ind}<Box${styleAttr} />`;
  const inner = n.children.map((c) => emit(c, depth + 1)).join('\n');
  return `${ind}<Box${styleAttr}>\n${inner}\n${ind}</Box>`;
}
function emitAll(tree: SNode[]): string {
  if (tree.length === 0) return '';
  return tree.map((n) => emit(n, 0)).join('\n');
}

// ── parser ─────────────────────────────────────────────────────────
// Hand-rolled recursive-descent parser for the JSX subset we emit:
//   <Box style={{ key: value, ... }}>...</Box>
//   <Text color="..." style={{ ... }}>body</Text>
//   <Pressable color="..." style={{ ... }}>body</Pressable>
// Style values may be number literals or single/double-quoted strings.
// Anything outside this subset throws — we keep the last-good tree on
// failure so live typing doesn't blow up the canvas.

class ParseError extends Error {}

class JsxParser {
  src: string;
  pos: number;
  constructor(src: string) { this.src = src; this.pos = 0; }

  eof(): boolean { return this.pos >= this.src.length; }

  skipWS(): void {
    while (this.pos < this.src.length) {
      const c = this.src[this.pos];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { this.pos++; continue; }
      // line comment
      if (c === '/' && this.src[this.pos + 1] === '/') {
        while (this.pos < this.src.length && this.src[this.pos] !== '\n') this.pos++;
        continue;
      }
      // block comment
      if (c === '/' && this.src[this.pos + 1] === '*') {
        this.pos += 2;
        while (this.pos < this.src.length && !(this.src[this.pos] === '*' && this.src[this.pos + 1] === '/')) this.pos++;
        if (this.pos < this.src.length) this.pos += 2;
        continue;
      }
      break;
    }
  }

  peek(s: string): boolean {
    return this.src.slice(this.pos, this.pos + s.length) === s;
  }

  expect(s: string): void {
    if (!this.peek(s)) {
      const got = this.src.slice(this.pos, this.pos + 20).replace(/\n/g, '\\n');
      throw new ParseError(`expected "${s}" at pos ${this.pos}, got "${got}"`);
    }
    this.pos += s.length;
  }

  readIdent(): string {
    const m = this.src.slice(this.pos).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (!m) throw new ParseError(`expected identifier at pos ${this.pos}`);
    this.pos += m[0].length;
    return m[0];
  }

  parseString(): string {
    const q = this.src[this.pos];
    if (q !== '"' && q !== "'") throw new ParseError(`expected quote at pos ${this.pos}`);
    this.pos++;
    let out = '';
    while (this.pos < this.src.length && this.src[this.pos] !== q) {
      if (this.src[this.pos] === '\\') {
        this.pos++;
        out += this.src[this.pos++] ?? '';
      } else {
        out += this.src[this.pos++];
      }
    }
    if (this.pos >= this.src.length) throw new ParseError(`unterminated string`);
    this.pos++; // closing quote
    return out;
  }

  parseExprValue(): any {
    this.skipWS();
    if (this.peek('"') || this.peek("'")) return this.parseString();
    const m = this.src.slice(this.pos).match(/^-?\d+(\.\d+)?/);
    if (m) {
      this.pos += m[0].length;
      return parseFloat(m[0]);
    }
    if (this.peek('true'))  { this.pos += 4; return true; }
    if (this.peek('false')) { this.pos += 5; return false; }
    if (this.peek('null'))  { this.pos += 4; return null; }
    throw new ParseError(`expected literal value at pos ${this.pos}`);
  }

  parseObjectBody(): { [k: string]: any } {
    const obj: { [k: string]: any } = {};
    this.skipWS();
    while (!this.peek('}')) {
      this.skipWS();
      let key: string;
      if (this.peek('"') || this.peek("'")) key = this.parseString();
      else key = this.readIdent();
      this.skipWS();
      this.expect(':');
      this.skipWS();
      obj[key] = this.parseExprValue();
      this.skipWS();
      if (this.peek(',')) { this.pos++; this.skipWS(); }
    }
    return obj;
  }

  parseAttrValue(): any {
    if (this.peek('"') || this.peek("'")) return this.parseString();
    if (this.peek('{')) {
      this.pos++; // {
      this.skipWS();
      let value: any;
      if (this.peek('{')) {
        this.pos++; // second {
        value = this.parseObjectBody();
        this.expect('}');
      } else {
        value = this.parseExprValue();
      }
      this.skipWS();
      this.expect('}');
      return value;
    }
    throw new ParseError(`expected attribute value at pos ${this.pos}`);
  }

  parseAttrs(): { [k: string]: any } {
    const attrs: { [k: string]: any } = {};
    while (true) {
      this.skipWS();
      if (this.peek('>') || this.peek('/>')) break;
      const name = this.readIdent();
      this.skipWS();
      this.expect('=');
      this.skipWS();
      attrs[name] = this.parseAttrValue();
    }
    return attrs;
  }

  parseElement(): SNode {
    this.skipWS();
    this.expect('<');
    const tag = this.readIdent();
    if (tag !== 'Box' && tag !== 'Text' && tag !== 'Pressable') {
      throw new ParseError(`unknown tag <${tag}> — only Box, Text, Pressable are recognized`);
    }
    const attrs = this.parseAttrs();
    this.skipWS();
    const node: SNode = { id: nid(), kind: tag as Kind, children: [] };
    Object.assign(node, attrsToNode(attrs));

    if (this.peek('/>')) {
      this.pos += 2;
      return node;
    }
    this.expect('>');

    if (tag === 'Text' || tag === 'Pressable') {
      const closing = `</${tag}>`;
      const end = this.src.indexOf(closing, this.pos);
      if (end < 0) throw new ParseError(`unterminated <${tag}>`);
      node.text = this.src.slice(this.pos, end).replace(/^\s+|\s+$/g, '');
      this.pos = end + closing.length;
    } else {
      while (true) {
        this.skipWS();
        if (this.peek(`</${tag}>`)) {
          this.pos += `</${tag}>`.length;
          break;
        }
        if (this.eof()) throw new ParseError(`unterminated <${tag}>`);
        node.children.push(this.parseElement());
      }
    }
    return node;
  }
}

function attrsToNode(attrs: { [k: string]: any }): Partial<SNode> {
  const out: Partial<SNode> = {};
  if (typeof attrs.color === 'string') out.color = attrs.color;
  const style = attrs.style;
  if (style && typeof style === 'object') {
    if (typeof style.width   === 'number') out.width   = style.width;
    if (typeof style.height  === 'number') out.height  = style.height;
    if (typeof style.padding === 'number') out.padding = style.padding;
    if (typeof style.backgroundColor === 'string') out.bg = style.backgroundColor;
    if (typeof style.alignItems === 'string') out.alignH = style.alignItems as Align;
    if (typeof style.justifyContent === 'string') out.alignV = style.justifyContent as Align;
  }
  return out;
}

function parseAll(src: string): SNode[] {
  const trimmed = src.trim();
  if (trimmed.length === 0) return [];
  const p = new JsxParser(src);
  const out: SNode[] = [];
  p.skipWS();
  while (!p.eof()) {
    out.push(p.parseElement());
    p.skipWS();
  }
  return out;
}

// ── helpers ────────────────────────────────────────────────────────
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ── surface ────────────────────────────────────────────────────────
function ResizeHandle({ onBegin }: { onBegin: () => void }) {
  return (
    <Pressable
      onMouseDown={onBegin}
      style={{
        position: 'absolute',
        right: -7,
        bottom: -7,
        width: 14,
        height: 14,
        backgroundColor: C_ACCENT,
        borderWidth: 1,
        borderColor: '#000',
        zIndex: 1000,
      }}
    />
  );
}

function StageNode({ node, sel, resizingId, onSelect, onBeginResize }: {
  node: SNode;
  sel: string | null;
  resizingId: string | null;
  onSelect: (id: string) => void;
  onBeginResize: (id: string) => void;
}) {
  const isSel = node.id === sel;
  const isResizing = node.id === resizingId;
  const s: any = {
    position: 'relative',
    borderWidth: isSel ? 2 : 1,
    borderColor: isSel ? C_ACCENT : 'rgba(255,255,255,0.06)',
  };
  if (node.width  != null) s.width  = node.width;
  if (node.height != null) s.height = node.height;
  if (node.bg && node.bg !== 'transparent') s.backgroundColor = node.bg;
  if (node.padding != null) s.padding = node.padding;
  if (node.alignH) s.alignItems = node.alignH;
  if (node.alignV) s.justifyContent = node.alignV;

  if (node.kind === 'Text') {
    return (
      <Pressable style={s} onPress={() => onSelect(node.id)}>
        <Text color={node.color ?? '#fff'}>{node.text ?? ''}</Text>
        {isResizing && <ResizeHandle onBegin={() => onBeginResize(node.id)} />}
      </Pressable>
    );
  }
  if (node.kind === 'Pressable') {
    return (
      <Pressable style={s} onPress={() => onSelect(node.id)}>
        <Text color={node.color ?? '#fff'}>{node.text ?? ''}</Text>
        {isResizing && <ResizeHandle onBegin={() => onBeginResize(node.id)} />}
      </Pressable>
    );
  }
  // Box
  return (
    <Pressable style={s} onPress={() => onSelect(node.id)}>
      {node.children.map((c) => (
        <StageNode
          key={c.id}
          node={c}
          sel={sel}
          resizingId={resizingId}
          onSelect={onSelect}
          onBeginResize={onBeginResize}
        />
      ))}
      {isResizing && <ResizeHandle onBegin={() => onBeginResize(node.id)} />}
    </Pressable>
  );
}

function Stage({ tree, sel, resizingId, onSelect, onBeginResize }: {
  tree: SNode[];
  sel: string | null;
  resizingId: string | null;
  onSelect: (id: string | null) => void;
  onBeginResize: (id: string) => void;
}) {
  return (
    <Pressable
      style={{
        width: SURFACE,
        height: SURFACE,
        backgroundColor: '#0a0a0c',
        borderWidth: 1,
        borderColor: C_BORDER,
        padding: 16,
        gap: 12,
        alignItems: 'flex-start',
      }}
      onPress={() => onSelect(null)}
    >
      {tree.map((n) => (
        <StageNode
          key={n.id}
          node={n}
          sel={sel}
          resizingId={resizingId}
          onSelect={(id) => onSelect(id)}
          onBeginResize={onBeginResize}
        />
      ))}
    </Pressable>
  );
}

// ── layers panel ──────────────────────────────────────────────────
function Layers({ tree, sel, onSelect, onMove, onDelete }: {
  tree: SNode[]; sel: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, d: -1 | 1) => void;
  onDelete: (id: string) => void;
}) {
  const rows: any[] = [];
  function walk(ns: SNode[], depth: number): void {
    for (const n of ns) {
      const isSel = n.id === sel;
      rows.push(
        <Pressable
          key={n.id}
          onPress={() => onSelect(n.id)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: 4,
            paddingBottom: 4,
            paddingRight: 6,
            paddingLeft: 8 + depth * 14,
            backgroundColor: isSel ? C_PANEL2 : 'transparent',
            borderLeftWidth: 2,
            borderLeftColor: isSel ? C_ACCENT : 'transparent',
          }}
        >
          <Text size={11} color={isSel ? C_ACCENT : C_FG} style={{ flexGrow: 1 }}>
            {n.kind}{n.text ? ` · ${truncate(n.text, 12)}` : ''}
          </Text>
          <Pressable onPress={() => onMove(n.id, -1)} style={{ paddingLeft: 4, paddingRight: 4 }}>
            <Text size={10} color={C_DIM}>▲</Text>
          </Pressable>
          <Pressable onPress={() => onMove(n.id, 1)} style={{ paddingLeft: 4, paddingRight: 4 }}>
            <Text size={10} color={C_DIM}>▼</Text>
          </Pressable>
          <Pressable onPress={() => onDelete(n.id)} style={{ paddingLeft: 4, paddingRight: 4 }}>
            <Text size={10} color={C_DANGER}>✕</Text>
          </Pressable>
        </Pressable>,
      );
      walk(n.children, depth + 1);
    }
  }
  walk(tree, 0);
  return (
    <Col style={{
      width: 200,
      height: '100%',
      backgroundColor: C_PANEL,
      borderRightWidth: 1,
      borderRightColor: C_BORDER,
    }}>
      <PanelTitle text="LAYERS" />
      <ScrollView style={{ flexGrow: 1, height: '100%' }}>
        {rows.length === 0
          ? <Text size={11} color={C_DIM} style={{ padding: 12 }}>(empty — add a Box above)</Text>
          : rows
        }
      </ScrollView>
    </Col>
  );
}

// ── properties panel ──────────────────────────────────────────────
function Props({ node, onPatch }: {
  node: SNode | null;
  onPatch: (p: Partial<SNode>) => void;
}) {
  if (!node) {
    return (
      <Col style={{
        width: 260,
        height: '100%',
        backgroundColor: C_PANEL,
        borderLeftWidth: 1,
        borderLeftColor: C_BORDER,
      }}>
        <PanelTitle text="PROPERTIES" />
        <Text size={11} color={C_DIM} style={{ padding: 12 }}>
          Click any node on the surface or in the layers panel.
        </Text>
      </Col>
    );
  }
  const showText = node.kind === 'Text' || node.kind === 'Pressable';
  const showBg   = node.kind === 'Box'  || node.kind === 'Pressable';
  const showFg   = node.kind === 'Text' || node.kind === 'Pressable';

  return (
    <Col key={node.id} style={{
      width: 260,
      height: '100%',
      backgroundColor: C_PANEL,
      borderLeftWidth: 1,
      borderLeftColor: C_BORDER,
    }}>
      <PanelTitle text="PROPERTIES" />
      <ScrollView style={{ flexGrow: 1, height: '100%' }}>
        <Col style={{ padding: 10, gap: 4 }}>
          <Row style={{ alignItems: 'baseline', gap: 6 }}>
            <Text size={12} color={C_ACCENT} bold>{node.kind}</Text>
            <Text size={10} color={C_DIM}>{node.id}</Text>
          </Row>

          {showText && (
            <>
              <SectionLabel text="content" />
              <TextField label="text" value={node.text ?? ''} onChange={(v: string) => onPatch({ text: v })} />
            </>
          )}

          <SectionLabel text="size" />
          <NumField label="width"  value={node.width  ?? 0} onChange={(v: number) => onPatch({ width:  v })} />
          <NumField label="height" value={node.height ?? 0} onChange={(v: number) => onPatch({ height: v })} />
          {showBg && (
            <NumField label="padding" value={node.padding ?? 0} onChange={(v: number) => onPatch({ padding: v })} />
          )}

          {showBg && (
            <>
              <SectionLabel text="align children" />
              <AlignGrid
                alignH={node.alignH}
                alignV={node.alignV}
                onChange={(h, v) => onPatch({ alignH: h, alignV: v })}
              />
            </>
          )}

          {showBg && (
            <>
              <SectionLabel text="background" />
              <Swatches value={node.bg ?? 'transparent'} onChange={(v: string) => onPatch({ bg: v })} />
              <HexField label="hex" value={node.bg ?? ''} onChange={(v: string) => onPatch({ bg: v })} />
            </>
          )}

          {showFg && (
            <>
              <SectionLabel text="text color" />
              <Swatches value={node.color ?? '#ffffff'} onChange={(v: string) => onPatch({ color: v })} />
              <HexField label="hex" value={node.color ?? ''} onChange={(v: string) => onPatch({ color: v })} />
            </>
          )}
        </Col>
      </ScrollView>
    </Col>
  );
}

function PanelTitle({ text }: { text: string }) {
  return (
    <Box style={{
      paddingLeft: 10, paddingRight: 10,
      paddingTop: 8, paddingBottom: 8,
      borderBottomWidth: 1, borderBottomColor: C_BORDER,
    }}>
      <Text size={10} color={C_DIM} bold style={{ letterSpacing: 1.5 }}>{text}</Text>
    </Box>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <Text
      size={10}
      color={C_DIM}
      bold
      style={{ letterSpacing: 1, marginTop: 10, marginBottom: 2 }}
    >
      {text.toUpperCase()}
    </Text>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Row style={{ alignItems: 'center', gap: 8, paddingTop: 2, paddingBottom: 2 }}>
      <Text size={11} color={C_DIM} style={{ width: 56 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={{
          flexGrow: 1,
          paddingLeft: 6, paddingRight: 6, paddingTop: 4, paddingBottom: 4,
          backgroundColor: '#000', color: C_FG,
          borderWidth: 1, borderColor: C_BORDER, fontSize: 12,
        }}
      />
    </Row>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Row style={{ alignItems: 'center', gap: 8, paddingTop: 2, paddingBottom: 2 }}>
      <Text size={11} color={C_DIM} style={{ width: 56 }}>{label}</Text>
      <TextInput
        value={String(value)}
        onChangeText={(s: string) => {
          const n = parseFloat(s);
          if (!isNaN(n)) onChange(n);
        }}
        style={{
          flexGrow: 1,
          paddingLeft: 6, paddingRight: 6, paddingTop: 4, paddingBottom: 4,
          backgroundColor: '#000', color: C_FG,
          borderWidth: 1, borderColor: C_BORDER, fontSize: 12,
        }}
      />
    </Row>
  );
}

function HexField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Row style={{ alignItems: 'center', gap: 8, paddingTop: 2, paddingBottom: 2 }}>
      <Text size={11} color={C_DIM} style={{ width: 56 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={{
          flexGrow: 1,
          paddingLeft: 6, paddingRight: 6, paddingTop: 4, paddingBottom: 4,
          backgroundColor: '#000', color: C_FG,
          borderWidth: 1, borderColor: C_BORDER, fontSize: 12, fontFamily: 'mono',
        }}
      />
    </Row>
  );
}

function Swatches({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Row style={{ flexWrap: 'wrap', gap: 4, paddingTop: 4, paddingBottom: 4 }}>
      {PALETTE.map((c) => {
        const sel = c === value;
        const isTransparent = c === 'transparent';
        return (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            style={{
              width: 22,
              height: 22,
              backgroundColor: isTransparent ? '#1a1a1a' : c,
              borderWidth: sel ? 2 : 1,
              borderColor: sel ? C_ACCENT : C_BORDER,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isTransparent && <Text size={10} color="#666">×</Text>}
          </Pressable>
        );
      })}
    </Row>
  );
}

// 3×3 alignment grid: each cell is itself a flex container that mirrors the
// alignment it represents, so the dot inside it sits where children would.
// Click a cell → alignH (alignItems) and alignV (justifyContent) get set in
// one shot. Click the active cell again → unset both (revert to framework
// default: stretch + flex-start).
function AlignGrid({ alignH, alignV, onChange }: {
  alignH: Align | undefined;
  alignV: Align | undefined;
  onChange: (h: Align | undefined, v: Align | undefined) => void;
}) {
  const opts: Align[] = ['flex-start', 'center', 'flex-end'];
  const cell = 28;
  const dot  = 6;
  return (
    <Col style={{ gap: 0, alignItems: 'flex-start' }}>
      {opts.map((v) => (
        <Row key={v} style={{ gap: 0 }}>
          {opts.map((h) => {
            const isSel = alignH === h && alignV === v;
            return (
              <Pressable
                key={h}
                onPress={() => isSel ? onChange(undefined, undefined) : onChange(h, v)}
                style={{
                  width: cell,
                  height: cell,
                  borderWidth: 1,
                  borderColor: isSel ? C_ACCENT : C_BORDER,
                  backgroundColor: isSel ? '#0a2933' : '#0a0a0c',
                  alignItems: h,
                  justifyContent: v,
                  padding: 4,
                }}
              >
                <Box style={{
                  width: dot,
                  height: dot,
                  backgroundColor: isSel ? C_ACCENT : C_DIM,
                }} />
              </Pressable>
            );
          })}
        </Row>
      ))}
      <Text size={10} color={C_DIM} style={{ marginTop: 4 }}>
        {alignH && alignV ? `${labelOf(alignH)} · ${labelOf(alignV)}` : 'default (stretch · top)'}
      </Text>
    </Col>
  );
}
function labelOf(a: Align): string {
  if (a === 'flex-start') return 'start';
  if (a === 'flex-end')   return 'end';
  return 'center';
}

// ── toolbar ────────────────────────────────────────────────────────
function ToolBtn({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
        backgroundColor: C_PANEL,
        borderWidth: 1,
        borderColor: danger ? C_DANGER : C_BORDER,
      }}
    >
      <Text size={11} color={danger ? C_DANGER : C_FG}>{label}</Text>
    </Pressable>
  );
}

function Toolbar({ onAdd, onClear }: { onAdd: (k: Kind) => void; onClear: () => void }) {
  return (
    <Row style={{
      alignItems: 'center', height: 44,
      paddingLeft: 12, paddingRight: 12, gap: 8,
      backgroundColor: C_PANEL2,
      borderBottomWidth: 1, borderBottomColor: C_BORDER,
    }}>
      <Text size={12} color={C_FG} bold style={{ letterSpacing: 1.2 }}>COMPOSER</Text>
      <Box style={{ width: 1, height: 24, backgroundColor: C_BORDER, marginLeft: 4, marginRight: 4 }} />
      <ToolBtn label="+ Box"       onPress={() => onAdd('Box')} />
      <ToolBtn label="+ Text"      onPress={() => onAdd('Text')} />
      <ToolBtn label="+ Pressable" onPress={() => onAdd('Pressable')} />
      <Box style={{ flexGrow: 1 }} />
      <Text size={10} color={C_DIM}>click = select · double-click = drag corner to resize</Text>
      <Box style={{ width: 1, height: 24, backgroundColor: C_BORDER, marginLeft: 4, marginRight: 4 }} />
      <ToolBtn label="clear" onPress={onClear} danger />
    </Row>
  );
}

// ── code panel ────────────────────────────────────────────────────
// Editable. The parent owns codeText state; on every keystroke we attempt to
// parse and (on success) hand the parser's tree back via onChangeTree. On
// parse failure the tree stays at its last good value and the error string
// shows in a red bar — typing JSX live "lights up" the canvas as soon as it
// reaches a parsable state.
function CodePanel({
  code,
  parseError,
  onChangeText,
}: {
  code: string;
  parseError: string | null;
  onChangeText: (s: string) => void;
}) {
  return (
    <Col style={{
      height: 260,
      backgroundColor: '#06070a',
      borderTopWidth: 1,
      borderTopColor: C_BORDER,
    }}>
      <Row style={{
        alignItems: 'center',
        gap: 10,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: C_BORDER,
      }}>
        <Text size={10} color={C_DIM} bold style={{ letterSpacing: 1.5 }}>CODE</Text>
        <Text size={10} color={C_DIM}>edit, paste, or watch the canvas write it</Text>
        <Box style={{ flexGrow: 1 }} />
        {parseError
          ? <Text size={10} color={C_DANGER} style={{ fontFamily: 'mono' }}>{truncate(parseError, 80)}</Text>
          : <Text size={10} color="#22c55e">✓ parses</Text>
        }
      </Row>
      <TextArea
        value={code}
        onChangeText={onChangeText}
        placeholder="<Box style={{ width: 240, height: 140, backgroundColor: '#1f2937', padding: 16 }}>
  <Text color='#fff'>hello!</Text>
</Box>"
        style={{
          flexGrow: 1,
          width: '100%',
          padding: 12,
          backgroundColor: '#06070a',
          color: C_FG,
          fontFamily: 'mono',
          fontSize: 12,
        }}
      />
    </Col>
  );
}

// ── host mouse polling (cribbed from cart/testing_carts/tile_drag.tsx) ──
const host: any = globalThis as any;
function readMouseX(): number {
  try { const v = Number(host.getMouseX?.()); return Number.isFinite(v) ? v : 0; } catch { return 0; }
}
function readMouseY(): number {
  try { const v = Number(host.getMouseY?.()); return Number.isFinite(v) ? v : 0; } catch { return 0; }
}
function readMouseDown(): boolean {
  try { return !!host.getMouseDown?.(); } catch { return false; }
}

// Largest content box a node can occupy when nested inside `parent`. Top-level
// nodes are clamped to the surface minus its own padding so a Box can never
// extend past the 1000×1000 design area.
function maxSizeIn(parent: SNode | null): { w: number; h: number } {
  if (parent == null) return { w: SURFACE - 32, h: SURFACE - 32 };
  const pad = (parent.padding ?? 0) * 2;
  const w = (parent.width  ?? SURFACE) - pad;
  const h = (parent.height ?? SURFACE) - pad;
  return { w: Math.max(20, w), h: Math.max(20, h) };
}

// ── app ──────────────────────────────────────────────────────────
export default function Composer() {
  const [tree, setTree] = React.useState<SNode[]>([]);
  const [codeText, setCodeText] = React.useState<string>('');
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [sel, setSel] = React.useState<string | null>(null);
  const [resizingId, setResizingId] = React.useState<string | null>(null);

  // Live refs so onPress closures (frozen at first commit in this framework)
  // can still read the latest state without going stale.
  const treeRef = React.useRef<SNode[]>(tree);
  treeRef.current = tree;
  const selRef = React.useRef<string | null>(sel);
  selRef.current = sel;

  // Two-way code/tree sync.
  //
  // updateTree() — every visual edit goes through here. It bumps the tree AND
  // re-emits codeText, so the textarea reflects the new shape.
  //
  // handleCodeChange() — every keystroke in the textarea. It bumps codeText
  // verbatim (so user's formatting is preserved) and tries to parse. On
  // success we replace the tree (selection drops, since IDs are reassigned);
  // on failure we keep the last good tree and show parseError.
  const updateTree = React.useCallback((fn: (prev: SNode[]) => SNode[]) => {
    setTree((prev) => {
      const next = fn(prev);
      setCodeText(emitAll(next));
      return next;
    });
  }, []);

  const handleCodeChange = React.useCallback((s: string) => {
    setCodeText(s);
    try {
      const parsed = parseAll(s);
      setTree(parsed);
      setParseError(null);
      // Selection by id is meaningless after a re-parse (fresh ids), so drop it.
      if (selRef.current && !find(parsed, selRef.current)) {
        setSel(null);
        setResizingId(null);
      }
    } catch (e: any) {
      setParseError(e?.message ? String(e.message) : String(e));
    }
  }, []);

  // Double-click detection.
  const lastClickRef = React.useRef<{ id: string; t: number }>({ id: '', t: 0 });

  // Resize-drag bookkeeping.
  type DragState = { id: string; mx0: number; my0: number; w0: number; h0: number; maxW: number; maxH: number };
  const dragRef = React.useRef<DragState | null>(null);
  const frameRef = React.useRef<any>(null);

  const stopFrame = React.useCallback(() => {
    if (frameRef.current == null) return;
    const cancel = host.cancelAnimationFrame?.bind(host);
    if (cancel) cancel(frameRef.current); else clearTimeout(frameRef.current);
    frameRef.current = null;
  }, []);

  const scheduleFrame = React.useCallback((cb: () => void) => {
    const raf = host.requestAnimationFrame?.bind(host);
    if (raf) frameRef.current = raf(cb);
    else frameRef.current = setTimeout(cb, 16);
  }, []);

  const tick = React.useCallback(() => {
    const d = dragRef.current;
    if (d == null) { stopFrame(); return; }
    if (!readMouseDown()) {
      dragRef.current = null;
      stopFrame();
      return;
    }
    const mx = readMouseX();
    const my = readMouseY();
    let w = d.w0 + (mx - d.mx0);
    let h = d.h0 + (my - d.my0);
    w = Math.min(d.maxW, Math.max(20, w));
    h = Math.min(d.maxH, Math.max(20, h));
    updateTree((prev) => patch(prev, d.id, { width: Math.round(w), height: Math.round(h) }));
    scheduleFrame(tick);
  }, [updateTree, scheduleFrame, stopFrame]);

  const handleBeginResize = React.useCallback((id: string) => {
    const t = treeRef.current;
    const node = find(t, id);
    if (!node) return;
    const parent = findParent(t, id);
    const { w: maxW, h: maxH } = maxSizeIn(parent);
    dragRef.current = {
      id,
      mx0: readMouseX(),
      my0: readMouseY(),
      w0: node.width  ?? 0,
      h0: node.height ?? 0,
      maxW,
      maxH,
    };
    stopFrame();
    scheduleFrame(tick);
  }, [scheduleFrame, stopFrame, tick]);

  React.useEffect(() => () => stopFrame(), [stopFrame]);

  const handleAdd = React.useCallback((kind: Kind) => {
    const s = selRef.current;
    const t = treeRef.current;
    const selected = s ? find(t, s) : null;
    let parent: SNode | null = null;
    if (selected?.kind === 'Box') parent = selected;
    else if (selected) parent = findParent(t, selected.id);
    const n = defaults(kind);
    const lim = maxSizeIn(parent);
    if (n.width  != null && n.width  > lim.w) n.width  = lim.w;
    if (n.height != null && n.height > lim.h) n.height = lim.h;
    updateTree((prev) => add(prev, parent?.id ?? null, n));
    setSel(n.id);
    setResizingId(null);
  }, [updateTree]);

  const handlePatch = React.useCallback((p: Partial<SNode>) => {
    const id = selRef.current;
    if (!id) return;
    updateTree((prev) => patch(prev, id, p));
  }, [updateTree]);

  const handleSelect = React.useCallback((id: string | null) => {
    if (id == null) {
      setSel(null);
      setResizingId(null);
      lastClickRef.current = { id: '', t: 0 };
      return;
    }
    const now = (host.performance?.now?.() as number) ?? Date.now();
    const last = lastClickRef.current;
    const isDouble = last.id === id && (now - last.t) < 400;
    lastClickRef.current = { id, t: now };
    setSel(id);
    if (isDouble) setResizingId(id);
    else if (resizingId !== null && resizingId !== id) setResizingId(null);
  }, [resizingId]);

  const handleMove = React.useCallback((id: string, d: -1 | 1) => {
    updateTree((prev) => move(prev, id, d));
  }, [updateTree]);

  const handleDelete = React.useCallback((id: string) => {
    updateTree((prev) => remove(prev, id));
    if (selRef.current === id) setSel(null);
    if (resizingId === id) setResizingId(null);
  }, [updateTree, resizingId]);

  const handleClear = React.useCallback(() => {
    setTree([]);
    setCodeText('');
    setParseError(null);
    setSel(null);
    setResizingId(null);
  }, []);

  const selNode = sel ? find(tree, sel) : null;

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: C_BG }}>
      <Toolbar onAdd={handleAdd} onClear={handleClear} />
      <Row style={{ flexGrow: 1 }}>
        <Layers
          tree={tree}
          sel={sel}
          onSelect={handleSelect}
          onMove={handleMove}
          onDelete={handleDelete}
        />
        <Box style={{ flexGrow: 1, backgroundColor: C_BG }}>
          <ScrollView style={{ flexGrow: 1, width: '100%', height: '100%' }}>
            <Box style={{ padding: 20, alignItems: 'flex-start' }}>
              <Stage
                tree={tree}
                sel={sel}
                resizingId={resizingId}
                onSelect={handleSelect}
                onBeginResize={handleBeginResize}
              />
            </Box>
          </ScrollView>
        </Box>
        <Props node={selNode} onPatch={handlePatch} />
      </Row>
      <CodePanel code={codeText} parseError={parseError} onChangeText={handleCodeChange} />
    </Col>
  );
}
