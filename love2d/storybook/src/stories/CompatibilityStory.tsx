/**
 * Compatibility — unified compat story.
 *
 * Merges Tailwind, HTML element remapping, merge precedence, converter CLI,
 * cross-framework migration, build pipeline, and source-of-truth architecture
 * into one cohesive Layout2 zigzag narrative.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState } from 'react';
import { Box, Text, Image, ScrollView, Pressable, CodeBlock, Row, Input, useBreakpoint, useWindowDimensions, classifiers as S} from '../../../packages/core/src';
import { tw } from '../../../packages/core/src/tw';
import { useThemeColors } from '../../../packages/theme/src';
import {Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn} from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#f59e0b',
  accentDim: 'rgba(245, 158, 11, 0.12)',
  callout: 'rgba(245, 158, 11, 0.06)',
  calloutBorder: 'rgba(245, 158, 11, 0.25)',
  compat: '#22d3ee',
  convert: '#a78bfa',
  pipeline: '#34d399',
  migrate: '#f472b6',
  danger: '#ef4444',
  blue: '#3b82f6',
};

// ── Static code blocks (hoisted — never recreated) ──────

const TW_CODE = `import { tw } from '@reactjit/core'

// Tailwind classes → ReactJIT style objects. Zero install.
<Box style={tw("p-4 flex-row gap-2 bg-gray-800 rounded-lg")}>
  <Text style={tw("text-white text-sm font-bold")}>{'Hello'}</Text>
  <Box style={tw("w-1/2 bg-blue-500 rounded-md p-2")} />
</Box>

// Arbitrary values
<Box style={tw("w-[200] h-[120] bg-[#1a1a2e] rounded-[12]")} />

// Spacing, color, flex, border — full coverage
tw("px-6 py-3 mx-auto gap-4")   // → paddingLeft:24, paddingRight:24, ...
tw("bg-emerald-500/20")          // → backgroundColor with alpha
tw("flex-row items-center")      // → flexDirection:'row', alignItems:'center'`;

const HTML_CODE = `// Paste React+Tailwind JSX verbatim. It just works.

<div className="p-4 bg-gray-800 rounded-lg flex gap-2">
  <h1 className="text-white text-2xl font-bold">{'Title'}</h1>
  <span className="text-gray-400">{'subtitle'}</span>
  <button onClick={() => alert('hi')}>{'Click me'}</button>
</div>

// div → Box, span → Text, h1-h6 → Text (sized+bold)
// button → Pressable, img → Image, input → TextInput
// ul/ol → Box, li → row with bullet, table → flex grid
// section/header/nav/footer/article → Box`;

const CONVERT_CODE = `# Convert HTML/React to ReactJIT JSX
$ rjit convert app.tsx > app.reactjit.tsx

# Pipe mode — paste from clipboard
$ pbpaste | rjit convert > component.tsx

# Stdin interactive
$ rjit convert < legacy-component.tsx

# What it does:
#   div/span/section → Box/Text
#   className="..." → style={tw("...")}
#   inline styles → ReactJIT style objects
#   onClick → onPress, onMouseEnter → onPointerEnter
#   <img src> → <Image src>
#   <input> → <TextInput>`;

const MIGRATE_CODE = `# Full project migration — React+Express → ReactJIT
$ rjit migrate ./my-react-app

# Scans and classifies every file:
#   UI files     → convertToReactJIT (div→Box, tw classes)
#   Logic files  → TSL transpiler → Lua modules
#   Express API  → useServer() hooks
#   Assets       → copied directly
#   Mixed/unknown → flagged in MIGRATION.md

# Generates:
#   src/          ← converted components
#   lua/          ← transpiled logic
#   MIGRATION.md  ← TODO list with manual-fix items`;

const FLUTTER_CODE = `# Dart Flutter → ReactJIT
$ rjit migrate-flutter ./my_flutter_app

# Container → Box, Column → Box (flexDirection:'column')
# Row → Box (flexDirection:'row'), Scaffold → root Box
# Text('hello') → <Text>{'hello'}</Text>
# ElevatedButton → <Pressable>, TextField → <TextInput>
# EdgeInsets.all(16) → padding: 16
# setState(() => count++) → const [count, setCount] = useState(0)`;

const SWIFTUI_CODE = `# SwiftUI → ReactJIT
$ rjit migrate-swiftui ./MyApp

# VStack → Box (column), HStack → Box (row), ZStack → Box (relative)
# .padding(16) → paddingLeft:16, paddingRight:16, ...
# .background(Color.blue) → backgroundColor: '#3b82f6'
# @State var count = 0 → const [count, setCount] = useState(0)
# Button("Tap") { } → <Pressable onPress={() => {}}><Text>Tap</Text></Pressable>
# NavigationView → useNavigation()`;

const TKINTER_CODE = `# Python Tkinter → ReactJIT
$ rjit migrate-tkinter ./my_app.py

# Label → Text, Button → Pressable, Frame → Box
# Canvas → Box, Entry → TextInput, Listbox → ScrollView
# pack(side=LEFT, fill=BOTH) → flexDirection:'row', flexGrow:1
# grid(row=0, column=1) → nested flex Boxes
# StringVar() → useState<string>('')
# .bind('<Button-1>', fn) → onPress={fn}`;

const PYQT_CODE = `# PyQt6 → ReactJIT
$ rjit migrate-pyqt6 ./main_window.py

# QWidget/QMainWindow → Box, QLabel → Text
# QPushButton → Pressable, QLineEdit → TextInput
# QVBoxLayout → Box (column), QHBoxLayout → Box (row)
# QScrollArea → ScrollView
# signal.connect(slot) → onPress/onChange handlers
# QColor(r,g,b) → '#rrggbb' hex string`;

const BLESSED_CODE = `# Node.js blessed (terminal UI) → ReactJIT
$ rjit migrate-blessed ./dashboard.js

# box → Box, scrollablebox → ScrollView
# button → Pressable, textbox → TextInput
# list → ScrollView + Pressable items
# {bold}text{/bold} → fontWeight:'bold'
# {red-fg}error{/red-fg} → color:'#ef4444'
# border: { type: 'line' } → borderWidth: 1`;

const PIPELINE_CODE = `# The build pipeline — lint gates everything
$ rjit lint            # static layout linter (must pass first)
$ rjit build           # dev build (Love2D / iife)
$ rjit dev             # watch + HMR via dv CLI
$ rjit test spec.ts    # run specs inside Love2D process

# Production targets — cross-compile from any host
$ rjit build linux         # self-extracting x64 binary
$ rjit build macos         # macOS bundle (Intel)
$ rjit build macmseries    # macOS bundle (Apple Silicon)
$ rjit build windows       # Windows archive
$ rjit build dist:love     # portable Love2D binary`;

const SYNC_CODE = `# Source-of-truth architecture
#
# lua/             ← edit HERE (Lua runtime)
# packages/core/   ← edit HERE (React primitives)
# packages/renderer/ ← edit HERE (reconciler)
#          │
#    make cli-setup     →  cli/runtime/  (staging)
#          │
#    reactjit update    →  project/lua/  (consumer copy)
#          │
#    reactjit build     →  bundle.js     (final output)
#
# The storybook reads from source directly via symlinks.
# Never edit cli/runtime/ or project/lua/ — they're disposable.`;

const RESPONSIVE_CODE = `import { useBreakpoint, useWindowDimensions } from '@reactjit/core'

// useBreakpoint() — returns 'sm' | 'md' | 'lg' | 'xl'
const bp = useBreakpoint();

// Thresholds (min-width):
//   sm:    0px   (mobile)
//   md:  640px   (tablet)
//   lg: 1024px   (desktop)
//   xl: 1440px   (wide)

// Pattern: derive a compact flag and branch styles
const compact = bp === 'sm';
<Band style={{
  flexDirection: compact ? 'column' : 'row',
  padding: compact ? 8 : 24,
  gap: compact ? 12 : 24,
}}>
  <Half />   {/* full-width when stacked */}
  <Half />
</Band>

// Raw dimensions when you need pixel math
const { width, height } = useWindowDimensions();`;

const RESPONSIVE_SCAFFOLD_CODE = `// All Layout2 scaffolds are responsive out of the box:
//
// Band     → row on md+, column on sm
// Half     → 50/50 on md+, full-width on sm
// HeroBand → reduced padding on sm
// CalloutBand → column layout on sm
// StoryPage   → tighter padding on sm
// StorySection → smaller border-radius + gaps on sm
//
// Storybook sidebar collapses to a hamburger overlay on sm.
// No extra work needed — just use the scaffolds.`;

// ── Static data arrays ──────────────────────────────────

const ELEMENT_MAP = [
  { from: 'div, section, header', to: 'Box' },
  { from: 'nav, footer, article', to: 'Box' },
  { from: 'span, p, label', to: 'Text' },
  { from: 'strong, em, code, pre', to: 'Text' },
  { from: 'h1 – h6', to: 'Text (sized+bold)' },
  { from: 'button', to: 'Pressable' },
  { from: 'img', to: 'Image' },
  { from: 'input, textarea', to: 'TextInput' },
  { from: 'ul, ol', to: 'Box (column)' },
  { from: 'li', to: 'Box (row+bullet)' },
  { from: 'table, tr', to: 'Box (flex grid)' },
  { from: 'a', to: 'Pressable' },
  { from: 'form', to: 'Box' },
  { from: 'td, th', to: 'Text' },
];

const TW_CATEGORIES = [
  { cat: 'Spacing', examples: 'p-4, mx-2, gap-3, px-6, py-2' },
  { cat: 'Sizing', examples: 'w-full, h-1/2, w-[200], min-w-0' },
  { cat: 'Color', examples: 'bg-blue-500, text-white, border-gray-700' },
  { cat: 'Flex', examples: 'flex-row, flex-col, items-center, justify-between' },
  { cat: 'Border', examples: 'border, border-2, rounded-lg, rounded-[12]' },
  { cat: 'Font', examples: 'text-sm, text-2xl, font-bold, font-light' },
  { cat: 'Opacity', examples: 'opacity-50, bg-blue-500/20' },
  { cat: 'Arbitrary', examples: 'w-[200], h-[120], bg-[#1a1a2e]' },
  { cat: 'Shadow', examples: 'shadow-sm, shadow-md, shadow-lg, shadow-2xl' },
  { cat: 'Transform', examples: 'rotate-12, rotate-45, scale-75, scale-125' },
  { cat: 'Gradient', examples: 'bg-gradient-to-r, from-blue-500, to-purple-500' },
];

const FRAMEWORK_COVERAGE = [
  { framework: 'React + Tailwind', cmd: 'rjit convert', status: 'full' },
  { framework: 'React + CSS', cmd: 'rjit convert', status: 'full' },
  { framework: 'Flutter (Dart)', cmd: 'rjit migrate-flutter', status: 'full' },
  { framework: 'SwiftUI', cmd: 'rjit migrate-swiftui', status: 'full' },
  { framework: 'Tkinter (Python)', cmd: 'rjit migrate-tkinter', status: 'full' },
  { framework: 'PyQt6 (Python)', cmd: 'rjit migrate-pyqt6', status: 'full' },
  { framework: 'Blessed (Node.js)', cmd: 'rjit migrate-blessed', status: 'full' },
  { framework: 'Express.js', cmd: 'rjit migrate', status: 'server' },
];

const LINT_RULES = [
  { rule: 'no-mixed-text-children', desc: 'Text + expressions = 3 vertical nodes. Use template literals.' },
  { rule: 'no-padding-shorthand', desc: 'paddingHorizontal/paddingVertical rejected. Use paddingLeft/Right/Top/Bottom.' },
  { rule: 'no-dom-elements', desc: 'No <div>, <span>, <input> in non-compat mode. Use Box/Text/TextInput.' },
  { rule: 'no-hardcoded-colors', desc: 'Naked hex in style props. Use palette constant or useThemeColors().' },
  { rule: 'flexGrow-preferred', desc: 'Hardcoded height in flex child. Use flexGrow: 1 instead.' },
];

const COLOR_FAMILIES = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'] as const;

const COLOR_SHADES = ['300', '500', '700', '900'] as const;

// ── HTML Playground ──────────────────────────────────────

const VOID_TAGS = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr']);

const PG_DEFAULT = `<div class="p-6 bg-gray-900 rounded-xl gap-4">
  <div class="flex-row items-center gap-4">
    <div class="w-14 h-14 bg-blue-500 rounded-full items-center justify-center">
      <span class="text-white font-bold text-xl">JD</span>
    </div>
    <div class="gap-1">
      <h2 class="text-white text-xl font-bold">Jane Doe</h2>
      <span class="text-gray-400 text-sm">Engineer · ReactJIT</span>
    </div>
  </div>
  <p class="text-gray-300 text-sm">Drop any HTML with Tailwind here — renders natively, no browser.</p>
  <div class="flex-row gap-3">
    <button class="px-4 py-2 bg-blue-500 rounded-lg items-center">
      <span class="text-white text-sm font-bold">Follow</span>
    </button>
    <button class="px-4 py-2 bg-gray-700 rounded-lg items-center">
      <span class="text-white text-sm font-bold">Message</span>
    </button>
  </div>
</div>`;

const PG_PRESETS = [
  { label: 'Profile', html: PG_DEFAULT },
  { label: 'Dashboard', html: `<div class="p-5 bg-gray-900 rounded-xl gap-4">
  <h2 class="text-white text-lg font-bold">Analytics</h2>
  <div class="flex-row gap-3">
    <div class="flex-1 p-4 bg-blue-500/20 rounded-lg gap-1">
      <span class="text-blue-300 text-xs">Revenue</span>
      <h3 class="text-white text-2xl font-bold">$42,891</h3>
      <span class="text-green-400 text-xs">+12.5%</span>
    </div>
    <div class="flex-1 p-4 bg-purple-500/20 rounded-lg gap-1">
      <span class="text-purple-300 text-xs">Users</span>
      <h3 class="text-white text-2xl font-bold">8,547</h3>
      <span class="text-green-400 text-xs">+8.2%</span>
    </div>
    <div class="flex-1 p-4 bg-emerald-500/20 rounded-lg gap-1">
      <span class="text-emerald-300 text-xs">Uptime</span>
      <h3 class="text-white text-2xl font-bold">99.9%</h3>
      <span class="text-gray-400 text-xs">30 days</span>
    </div>
  </div>
</div>` },
  { label: 'Pricing', html: `<div class="p-6 bg-gray-900 rounded-xl gap-4 items-center">
  <div class="bg-blue-500/20 px-3 py-1 rounded-full">
    <span class="text-blue-300 text-xs font-bold">MOST POPULAR</span>
  </div>
  <h2 class="text-white text-2xl font-bold">Pro Plan</h2>
  <div class="flex-row items-end gap-1">
    <h1 class="text-white text-4xl font-bold">$29</h1>
    <span class="text-gray-400 text-sm">/month</span>
  </div>
  <div class="gap-2 w-full">
    <div class="flex-row gap-2 items-center">
      <span class="text-green-400 text-sm">✓</span>
      <span class="text-gray-300 text-sm">Unlimited projects</span>
    </div>
    <div class="flex-row gap-2 items-center">
      <span class="text-green-400 text-sm">✓</span>
      <span class="text-gray-300 text-sm">Priority support</span>
    </div>
    <div class="flex-row gap-2 items-center">
      <span class="text-green-400 text-sm">✓</span>
      <span class="text-gray-300 text-sm">Custom domains</span>
    </div>
  </div>
  <button class="px-6 py-3 bg-blue-500 rounded-lg items-center">
    <span class="text-white font-bold">Get Started</span>
  </button>
</div>` },
  { label: 'Alert', html: `<div class="p-4 bg-red-500/20 rounded-lg gap-3">
  <div class="flex-row items-center gap-2">
    <span class="text-red-400 font-bold text-lg">⚠</span>
    <h4 class="text-red-300 font-bold">Critical Error</h4>
  </div>
  <p class="text-red-200 text-sm">Database connection lost. Your data is safe but the service is temporarily unavailable.</p>
  <div class="flex-row gap-2">
    <button class="px-3 py-1 bg-red-500 rounded">
      <span class="text-white text-xs font-bold">Retry</span>
    </button>
    <button class="px-3 py-1 bg-gray-700 rounded">
      <span class="text-white text-xs">Dismiss</span>
    </button>
  </div>
</div>` },
] as const;

interface HNode {
  type: 'element' | 'text';
  tag?: string;
  attrs?: Record<string, string>;
  children: HNode[];
  text?: string;
}

function parseInlineCSS(css: string): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const decl of css.split(';')) {
    const colon = decl.indexOf(':');
    if (colon < 0) continue;
    const prop = decl.slice(0, colon).trim();
    const val = decl.slice(colon + 1).trim();
    if (!prop || !val) continue;
    const camel = prop.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
    const num = parseFloat(val);
    out[camel] = !isNaN(num) && val.trim() === String(num) ? num : val;
  }
  return out;
}

function parseHTMLToNodes(raw: string): HNode[] {
  const html = raw.trim();
  let i = 0;
  const len = html.length;
  function skipWS() { while (i < len && /\s/.test(html[i])) i++; }
  function parseTagName(): string {
    const s = i; while (i < len && /[a-zA-Z0-9\-]/.test(html[i])) i++;
    return html.slice(s, i).toLowerCase();
  }
  function parseAttrName(): string {
    const s = i; while (i < len && /[a-zA-Z0-9\-:_.]/.test(html[i])) i++;
    return html.slice(s, i);
  }
  function parseAttrVal(): string {
    const q = html[i];
    if (q === '"' || q === "'") {
      i++; const s = i;
      while (i < len && html[i] !== q) i++;
      const v = html.slice(s, i); i++; return v;
    }
    const s = i; while (i < len && !/[\s>\/]/.test(html[i])) i++;
    return html.slice(s, i);
  }
  function parseAttrs(): Record<string, string> {
    const attrs: Record<string, string> = {};
    while (i < len) {
      skipWS();
      if (html[i] === '>' || (html[i] === '/' && html[i + 1] === '>')) break;
      const name = parseAttrName();
      if (!name) { i++; continue; }
      skipWS();
      if (html[i] === '=') { i++; skipWS(); attrs[name] = parseAttrVal(); }
      else attrs[name] = '';
    }
    return attrs;
  }
  function parseChildren(): HNode[] {
    const nodes: HNode[] = [];
    while (i < len) {
      if (html[i] !== '<') {
        const s = i; while (i < len && html[i] !== '<') i++;
        const text = html.slice(s, i).trim();
        if (text) nodes.push({ type: 'text', text, children: [] });
        continue;
      }
      if (html[i + 1] === '/') break;
      if (html[i + 1] === '!') { while (i < len && html[i] !== '>') i++; i++; continue; }
      i++;
      const tag = parseTagName();
      const attrs = parseAttrs();
      let selfClose = false;
      if (html[i] === '/') { i++; selfClose = true; }
      if (html[i] === '>') i++;
      const node: HNode = { type: 'element', tag, attrs, children: [] };
      if (!selfClose && !VOID_TAGS.has(tag)) {
        node.children = parseChildren();
        if (i < len && html[i] === '<' && html[i + 1] === '/') {
          i += 2; while (i < len && html[i] !== '>') i++; if (i < len) i++;
        }
      }
      nodes.push(node);
    }
    return nodes;
  }
  return parseChildren();
}

function renderHNode(node: HNode, key: string): React.ReactNode {
  if (node.type === 'text') {
    return React.createElement('span', { key }, node.text);
  }
  const tag = node.tag!;
  const attrs = node.attrs ?? {};
  const props: Record<string, unknown> = { key };
  const cl = attrs.class ?? attrs.className;
  if (cl) props.className = cl;
  if (attrs.style) props.style = parseInlineCSS(attrs.style);
  if (attrs.src) props.src = attrs.src;
  if (attrs.placeholder) props.placeholder = attrs.placeholder;
  if (attrs.href) props.onPress = () => {};
  const ch = node.children.map((c, idx) => renderHNode(c, `${key}.${idx}`));
  return React.createElement(tag as never, props, ...ch);
}

function HtmlPlayground() {
  const c = useThemeColors();
  const [html, setHtml] = useState(PG_DEFAULT);
  const [activePreset, setActivePreset] = useState(0);
  let nodes: ReturnType<typeof parseHTMLToNodes> | null;
  try { nodes = parseHTMLToNodes(html); }
  catch { nodes = null; }

  return (
    <Box style={{
      width: '100%',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.compat + '66',
      overflow: 'hidden',
      backgroundColor: c.bgElevated,
    }}>
      {/* Title bar */}
      <S.RowCenterG8 style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 9, paddingBottom: 9, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.bg }}>
        <Box style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' }} />
        <Box style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#eab308' }} />
        <Box style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e' }} />
        <S.VertDivider style={{ height: 14, marginLeft: 4, marginRight: 4 }} />
        <Text style={{ color: C.compat, fontSize: 10, fontWeight: 'bold' }}>{'LIVE HTML + TAILWIND PLAYGROUND'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryTiny>{'renders inside Love2D — no browser'}</S.StoryTiny>
      </S.RowCenterG8>
      {/* Preset tabs */}
      <S.BorderBottom style={{ flexDirection: 'row', backgroundColor: c.bg }}>
        {PG_PRESETS.map((p, idx) => (
          <Pressable key={p.label} onPress={() => { setActivePreset(idx); setHtml(p.html); }}>
            <Box style={{
              paddingLeft: 14,
              paddingRight: 14,
              paddingTop: 8,
              paddingBottom: 8,
              borderBottomWidth: 2,
              borderColor: activePreset === idx ? C.compat : 'transparent',
              backgroundColor: activePreset === idx ? C.compat + '18' : 'transparent',
            }}>
              <Text style={{
                color: activePreset === idx ? C.compat : c.muted,
                fontSize: 9,
                fontWeight: activePreset === idx ? 'bold' : 'normal',
              }}>{p.label}</Text>
            </Box>
          </Pressable>
        ))}
        <Box style={{ flexGrow: 1 }} />
        <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8, justifyContent: 'center' }}>
          <S.StoryTiny style={{ fontFamily: 'monospace' }}>{'HTML + Tailwind → ReactJIT'}</S.StoryTiny>
        </Box>
      </S.BorderBottom>
      {/* Editor + Preview */}
      <Box style={{ flexDirection: 'row', minHeight: 300 }}>
        {/* Left: HTML editor */}
        <S.Half style={{ borderRightWidth: 1, borderColor: c.border }}>
          <S.RowCenterG6 style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.bgElevated }}>
            <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.compat + '88' }} />
            <S.StoryTiny>{'HTML INPUT'}</S.StoryTiny>
          </S.RowCenterG6>
          <Input
            multiline
            submitOnEnter={false}
            value={html}
            onChangeText={setHtml}
            style={{
              flexGrow: 1,
              backgroundColor: c.bg,
              padding: 10,
              fontSize: 9,
              fontFamily: 'monospace',
              color: c.text,
            }}
          />
        </S.Half>
        {/* Right: live preview */}
        <S.Half>
          <S.RowCenterG6 style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.bgElevated }}>
            <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e88' }} />
            <S.StoryTiny>{'LIVE PREVIEW'}</S.StoryTiny>
            <Box style={{ flexGrow: 1 }} />
            <Text style={{ color: '#22c55e', fontSize: 8 }}>{'● rendering'}</Text>
          </S.RowCenterG6>
          <ScrollView style={{ flexGrow: 1 }}>
            <Box style={{ padding: 16, flexGrow: 1 }}>
              {nodes
                ? nodes.map((n, idx) => renderHNode(n, String(idx)))
                : <Text style={{ color: C.danger, fontSize: 9 }}>{'parse error — check your HTML'}</Text>
              }
            </Box>
          </ScrollView>
        </S.Half>
      </Box>
    </Box>
  );
}

// ── Live Demos ──────────────────────────────────────────

function TailwindLiveDemo() {
  const c = useThemeColors();
  const [input, setInput] = useState('p-4 flex-row gap-2 bg-blue-500 rounded-lg');
  let resolved: string;
  try {
    const style = tw(input);
    resolved = JSON.stringify(style, null, 2);
  } catch {
    resolved = '// invalid class';
  }

  return (
    <S.Bordered style={{ width: '100%', backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 8 }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'LIVE: tw() PARSER'}</Text>
      <S.Bordered style={{ backgroundColor: c.bg, borderRadius: 4, padding: 8 }}>
        <Text style={{ color: C.compat, fontSize: 9, fontFamily: 'monospace' }}>{`tw("${input}")`}</Text>
      </S.Bordered>
      <S.HorzDivider />
      <S.StoryTiny>{'Resolved style object:'}</S.StoryTiny>
      <S.Bordered style={{ backgroundColor: c.bg, borderRadius: 4, padding: 8 }}>
        <Text style={{ color: c.text, fontSize: 8, fontFamily: 'monospace' }}>{resolved}</Text>
      </S.Bordered>
      <S.RowWrap style={{ gap: 4 }}>
        {['p-4 flex-row gap-2 bg-blue-500 rounded-lg',
          'mx-auto w-1/2 text-center font-bold text-xl',
          'border-2 border-red-500 bg-red-500/10 rounded-[16]',
          'px-6 py-3 bg-gradient-to-r items-center justify-between',
        ].map((cls) => (
          <Pressable key={cls} onPress={() => setInput(cls)}>
            <Box style={{
              backgroundColor: input === cls ? C.accent + '33' : c.bg,
              borderRadius: 4,
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 3,
              paddingBottom: 3,
              borderWidth: 1,
              borderColor: input === cls ? C.accent : c.border,
            }}>
              <Text style={{ color: input === cls ? C.accent : c.muted, fontSize: 7, fontFamily: 'monospace' }}>{cls.slice(0, 28)}</Text>
            </Box>
          </Pressable>
        ))}
      </S.RowWrap>
    </S.Bordered>
  );
}

function TwCategoriesDemo() {
  const c = useThemeColors();
  return (
    <S.Bordered style={{ width: '100%', backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 4 }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'TAILWIND COVERAGE'}</Text>
      <S.HorzDivider style={{ marginBottom: 2 }} />
      {TW_CATEGORIES.map((row) => (
        <S.RowCenterG8 key={row.cat}>
          <Box style={{ width: 60 }}>
            <Text style={{ color: C.accent, fontSize: 8, fontWeight: 'bold' }}>{row.cat}</Text>
          </Box>
          <S.StoryTiny style={{ fontFamily: 'monospace' }}>{row.examples}</S.StoryTiny>
        </S.RowCenterG8>
      ))}
    </S.Bordered>
  );
}

function ColorPaletteDemo() {
  const c = useThemeColors();
  return (
    <S.Bordered style={{ width: '100%', backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 3 }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'COLOR PALETTE — 22 FAMILIES × 11 SHADES'}</Text>
      <S.HorzDivider style={{ marginBottom: 2 }} />
      {COLOR_FAMILIES.map(color => (
        <Box key={color} className="flex-row gap-1" style={{ width: '100%' }}>
          {COLOR_SHADES.map(shade => (
            <Box key={shade} style={{
              ...tw(`bg-${color}-${shade} rounded`),
              flexGrow: 1, height: 14, justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 6 }}>{`${color[0]}${shade}`}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </S.Bordered>
  );
}

function ElementMapDemo() {
  const c = useThemeColors();
  return (
    <S.Bordered style={{ width: '100%', backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 4 }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'ELEMENT MAPPING'}</Text>
      <S.HorzDivider style={{ marginBottom: 2 }} />
      {ELEMENT_MAP.map((row) => (
        <S.RowCenterG8 key={row.from}>
          <Box style={{ width: 180 }}>
            <Text style={{ color: C.danger, fontSize: 8, fontFamily: 'monospace' }}>{row.from}</Text>
          </Box>
          <S.StoryTiny>{'→'}</S.StoryTiny>
          <Text style={{ color: C.pipeline, fontSize: 8, fontFamily: 'monospace', fontWeight: 'bold' }}>{row.to}</Text>
        </S.RowCenterG8>
      ))}
    </S.Bordered>
  );
}

function HtmlLiveDemo() {
  const c = useThemeColors();
  const [clicks, setClicks] = useState(0);

  return (
    <S.Bordered style={{ width: '100%', backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 10 }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'LIVE: HTML ELEMENTS IN REACTJIT'}</Text>
      <S.HorzDivider />

      {/* Headings */}
      <div className="p-3 bg-gray-800 rounded-lg w-full gap-1">
        <h1 style={{ color: '#FFFFFF' }}>{'h1 — 32px'}</h1>
        <h2 style={{ color: '#CCCCCC' }}>{'h2 — 28px'}</h2>
        <h3 style={{ color: '#AAAAAA' }}>{'h3 — 24px'}</h3>
        <h4 style={{ color: '#888888' }}>{'h4 — 20px'}</h4>
      </div>

      {/* Semantic */}
      <section className="p-3 bg-gray-800 rounded-lg w-full gap-2">
        <header className="p-2 bg-blue-900 rounded">
          <span className="text-white text-xs">{'<header>'}</span>
        </header>
        <nav className="p-2 bg-green-900 rounded">
          <span className="text-white text-xs">{'<nav>'}</span>
        </nav>
        <article className="p-2 bg-purple-900 rounded">
          <span className="text-white text-xs">{'<article>'}</span>
        </article>
        <footer className="p-2 bg-red-900 rounded">
          <span className="text-white text-xs">{'<footer>'}</span>
        </footer>
      </section>

      {/* Inline text */}
      <div className="p-3 bg-gray-800 rounded-lg w-full gap-1">
        <strong style={{ color: '#FFFFFF' }}>{'<strong> bold'}</strong>
        <em style={{ color: '#AAAAAA', fontStyle: 'italic' }}>{'<em> italic'}</em>
        <code style={{ color: '#22D3EE' }}>{'<code> monospace'}</code>
      </div>

      {/* Button with onClick */}
      <div className="p-3 bg-gray-800 rounded-lg w-full flex-row gap-3 items-center">
        <button className="px-4 py-2 bg-blue-500 rounded-lg" onClick={() => setClicks(n => n + 1)}>
          <span className="text-white text-sm font-bold">{'Click me'}</span>
        </button>
        <span className="text-white text-sm">{`Clicks: ${clicks}`}</span>
      </div>

      {/* Lists */}
      <div className="p-3 bg-gray-800 rounded-lg w-full flex-row gap-8">
        <ul className="gap-1">
          <li className="flex-row gap-2">
            <span className="text-gray-400 text-xs">{'•'}</span>
            <span className="text-white text-xs">{'Unordered item'}</span>
          </li>
          <li className="flex-row gap-2">
            <span className="text-gray-400 text-xs">{'•'}</span>
            <span className="text-white text-xs">{'Another item'}</span>
          </li>
        </ul>
        <ol className="gap-1">
          <li className="flex-row gap-2">
            <span className="text-gray-400 text-xs">{'1.'}</span>
            <span className="text-white text-xs">{'Ordered first'}</span>
          </li>
          <li className="flex-row gap-2">
            <span className="text-gray-400 text-xs">{'2.'}</span>
            <span className="text-white text-xs">{'Ordered second'}</span>
          </li>
        </ol>
      </div>

      {/* Table */}
      <table className="p-3 bg-gray-800 rounded-lg w-full gap-1">
        <thead>
          <tr className="flex-row gap-4">
            <th style={{ color: '#3B82F6', fontSize: 10, fontWeight: 'bold', minWidth: 70 }}>{'Name'}</th>
            <th style={{ color: '#3B82F6', fontSize: 10, fontWeight: 'bold', minWidth: 70 }}>{'Role'}</th>
            <th style={{ color: '#3B82F6', fontSize: 10, fontWeight: 'bold', minWidth: 70 }}>{'Status'}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="flex-row gap-4">
            <td style={{ color: '#FFFFFF', fontSize: 10, minWidth: 70 }}>{'Alice'}</td>
            <td style={{ color: '#FFFFFF', fontSize: 10, minWidth: 70 }}>{'Engineer'}</td>
            <td style={{ color: '#22C55E', fontSize: 10, minWidth: 70 }}>{'Active'}</td>
          </tr>
          <tr className="flex-row gap-4">
            <td style={{ color: '#FFFFFF', fontSize: 10, minWidth: 70 }}>{'Bob'}</td>
            <td style={{ color: '#FFFFFF', fontSize: 10, minWidth: 70 }}>{'Designer'}</td>
            <td style={{ color: '#EAB308', fontSize: 10, minWidth: 70 }}>{'Away'}</td>
          </tr>
        </tbody>
      </table>

      {/* Form */}
      <form className="p-3 bg-gray-800 rounded-lg w-full gap-3">
        <div className="gap-1">
          <label style={{ color: '#9CA3AF', fontSize: 10 }}>{'Email'}</label>
          <input placeholder="you@example.com" style={{ fontSize: 12 }} />
        </div>
        <button className="px-4 py-2 bg-green-500 rounded-lg items-center">
          <span className="text-white text-sm font-bold">{'Submit'}</span>
        </button>
      </form>
    </S.Bordered>
  );
}

function CopyPasteDemo() {
  const c = useThemeColors();
  return (
    <S.Bordered style={{ width: '100%', backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 8 }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'COPY-PASTE PROOF'}</Text>
      <S.StoryTiny>{'Real React+Tailwind JSX running in ReactJIT:'}</S.StoryTiny>
      <S.HorzDivider />
      <div className="p-4 bg-gray-900 rounded-xl w-full">
        <div className="flex-row gap-4 items-center">
          <div className="w-12 h-12 bg-blue-500 rounded-full items-center justify-center">
            <span className="text-white font-bold text-lg">{'JD'}</span>
          </div>
          <div className="gap-1">
            <h4 style={{ color: '#FFFFFF' }}>{'Jane Doe'}</h4>
            <p style={{ color: '#9CA3AF', fontSize: 11 }}>{'Senior Engineer at Acme Corp'}</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-700 gap-2">
          <div className="flex-row justify-between">
            <span className="text-gray-400 text-xs">{'Projects'}</span>
            <span className="text-white text-xs font-bold">{'24'}</span>
          </div>
          <div className="flex-row justify-between">
            <span className="text-gray-400 text-xs">{'Commits'}</span>
            <span className="text-white text-xs font-bold">{'1,847'}</span>
          </div>
          <div className="flex-row justify-between">
            <span className="text-gray-400 text-xs">{'Reviews'}</span>
            <span className="text-white text-xs font-bold">{'392'}</span>
          </div>
        </div>
      </div>
      {/* Social card */}
      <div className="p-4 bg-gray-800 rounded-lg w-full gap-3">
        <div className="flex-row items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 items-center justify-center">
            <span className="text-white font-bold text-sm">{'JD'}</span>
          </div>
          <div className="gap-1">
            <span className="text-white font-bold text-sm">{'Jane Doe'}</span>
            <span className="text-gray-400 text-xs">{'@janedoe'}</span>
          </div>
        </div>
        <span className="text-gray-300 text-xs">{'Just shipped my app with ReactJIT. Pasted my React components and they rendered pixel-perfect. No rewrite needed.'}</span>
        <div className="flex-row gap-3 pt-2">
          <span className="text-gray-500 text-xs">{'♡ 42'}</span>
          <span className="text-gray-500 text-xs">{'↻ 12'}</span>
          <span className="text-gray-500 text-xs">{'↗ 3'}</span>
        </div>
      </div>
    </S.Bordered>
  );
}

function MergePrecedenceDemo() {
  const c = useThemeColors();
  return (
    <S.Bordered style={{ width: '100%', backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 8 }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'MERGE PRECEDENCE'}</Text>
      <S.StoryTiny>{'Priority: className (tw) < shorthand props < style={}'}</S.StoryTiny>
      <S.HorzDivider />

      {/* className < shorthand */}
      <Box style={{ gap: 4 }}>
        <S.StoryTiny>{'className="p-8" + padding={4} → padding wins (4):'}</S.StoryTiny>
        <S.CenterW100 className="p-8 bg-red-500 rounded-lg" padding={4}>
          <S.WhiteBody>{'padding=4 overrides className="p-8"'}</S.WhiteBody>
        </S.CenterW100>
      </Box>

      {/* className < style */}
      <Box style={{ gap: 4 }}>
        <S.StoryTiny>{'className="bg-red-500" + style={{ bg: blue }} → blue wins:'}</S.StoryTiny>
        <Box className="bg-red-500 rounded-lg p-4" style={{ backgroundColor: C.blue, width: '100%', alignItems: 'center' }}>
          <S.WhiteBody>{'style={{ bg: blue }} overrides bg-red-500'}</S.WhiteBody>
        </Box>
      </Box>

      {/* Equivalence proof */}
      <Box style={{ gap: 4 }}>
        <S.StoryTiny>{'Tailwind (left) vs native style (right) — identical output:'}</S.StoryTiny>
        <Row gap={8} style={{ width: '100%' }}>
          <Box className="flex-1">
            <Box className="bg-indigo-600 rounded-lg p-3 flex-row items-center justify-between" style={{ width: '100%' }}>
              <S.WhiteMedText style={{ fontWeight: 'bold' }}>{'Hello'}</S.WhiteMedText>
              <Box className="bg-indigo-400 rounded" style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
                <S.WhiteCaption>{'badge'}</S.WhiteCaption>
              </Box>
            </Box>
          </Box>
          <S.Half style={{ flexShrink: 1 }}>
            <S.RowCenter style={{ backgroundColor: '#4f46e5', borderRadius: 8, padding: 12, justifyContent: 'space-between', width: '100%' }}>
              <S.WhiteMedText style={{ fontWeight: 'bold' }}>{'Hello'}</S.WhiteMedText>
              <Box style={{ backgroundColor: '#818cf8', borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
                <S.WhiteCaption>{'badge'}</S.WhiteCaption>
              </Box>
            </S.RowCenter>
          </S.Half>
        </Row>
      </Box>
    </S.Bordered>
  );
}

function VisualEffectsDemo() {
  const c = useThemeColors();
  return (
    <S.Bordered style={{ width: '100%', backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 8 }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'VISUAL EFFECTS'}</Text>
      <S.HorzDivider />

      {/* Shadows */}
      <S.StoryTiny>{'Shadows: shadow-sm through shadow-2xl'}</S.StoryTiny>
      <S.RowG6 style={{ width: '100%' }}>
        {(['sm', 'md', 'lg', 'xl', '2xl'] as const).map(s => (
          <Box key={s} style={{
            ...tw(`shadow-${s} bg-slate-700 rounded-lg p-2`),
            flexGrow: 1, alignItems: 'center',
          }}>
            <S.WhiteTiny>{`${s}`}</S.WhiteTiny>
          </Box>
        ))}
      </S.RowG6>

      {/* Transforms */}
      <S.StoryTiny>{'Transforms: rotate + scale'}</S.StoryTiny>
      <Box className="flex-row gap-6 items-center justify-center" style={{ width: '100%', paddingTop: 4, paddingBottom: 4 }}>
        <Box style={{ ...tw('bg-purple-500 rounded rotate-12'), width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 7 }}>{'12°'}</Text>
        </Box>
        <Box style={{ ...tw('bg-purple-500 rounded rotate-45'), width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 7 }}>{'45°'}</Text>
        </Box>
        <Box style={{ ...tw('bg-teal-500 rounded scale-75'), width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 7 }}>{'75%'}</Text>
        </Box>
        <Box style={{ ...tw('bg-teal-500 rounded scale-125'), width: 36, height: 36, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 7 }}>{'125%'}</Text>
        </Box>
      </Box>

      {/* Gradients */}
      <S.StoryTiny>{'Gradients: horizontal, vertical, diagonal'}</S.StoryTiny>
      <S.StackG4W100>
        <Box style={{ ...tw('bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg p-3'), width: '100%' }}>
          <S.WhiteCaption>{'bg-gradient-to-r from-blue-500 to-purple-500'}</S.WhiteCaption>
        </Box>
        <Box style={{ ...tw('bg-gradient-to-b from-emerald-400 to-cyan-500 rounded-lg p-3'), width: '100%' }}>
          <S.WhiteCaption>{'bg-gradient-to-b from-emerald-400 to-cyan-500'}</S.WhiteCaption>
        </Box>
        <Box style={{ ...tw('bg-gradient-to-br from-rose-500 to-amber-500 rounded-lg p-3'), width: '100%' }}>
          <S.WhiteCaption>{'bg-gradient-to-br from-rose-500 to-amber-500'}</S.WhiteCaption>
        </Box>
      </S.StackG4W100>

      {/* Opacity */}
      <S.StoryTiny>{'Opacity: 25%, 50%, 75%, 100%'}</S.StoryTiny>
      <Box className="flex-row gap-3" style={{ width: '100%' }}>
        {([25, 50, 75, 100] as const).map(o => (
          <Box key={o} style={{
            ...tw(`opacity-${o} bg-blue-500 rounded-lg p-3`),
            flexGrow: 1, alignItems: 'center',
          }}>
            <S.WhiteCaption>{`${o}%`}</S.WhiteCaption>
          </Box>
        ))}
      </Box>
    </S.Bordered>
  );
}

function FrameworkCoverageDemo() {
  const c = useThemeColors();
  return (
    <S.Bordered style={{ width: '100%', backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 4 }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'MIGRATION COVERAGE'}</Text>
      <S.HorzDivider style={{ marginBottom: 2 }} />
      {FRAMEWORK_COVERAGE.map((fw) => (
        <S.RowCenterG8 key={fw.framework}>
          <Box style={{ width: 90 }}>
            <Text style={{ color: c.text, fontSize: 8 }}>{fw.framework}</Text>
          </Box>
          <Box style={{ width: 100 }}>
            <Text style={{ color: C.convert, fontSize: 8, fontFamily: 'monospace' }}>{fw.cmd}</Text>
          </Box>
          <Box style={{
            backgroundColor: (fw.status === 'full' ? C.pipeline : C.compat) + '1a',
            borderRadius: 4,
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 2,
            paddingBottom: 2,
          }}>
            <Text style={{ color: fw.status === 'full' ? C.pipeline : C.compat, fontSize: 8 }}>
              {fw.status === 'full' ? 'full' : 'server-side'}
            </Text>
          </Box>
        </S.RowCenterG8>
      ))}
    </S.Bordered>
  );
}

function LintRulesDemo() {
  const c = useThemeColors();
  return (
    <S.Bordered style={{ width: '100%', backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 6 }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'LINT RULES (GATE ALL BUILDS)'}</Text>
      <S.HorzDivider style={{ marginBottom: 2 }} />
      {LINT_RULES.map((rule) => (
        <Box key={rule.rule} style={{ gap: 2 }}>
          <Text style={{ color: C.danger, fontSize: 8, fontFamily: 'monospace', fontWeight: 'bold' }}>{rule.rule}</Text>
          <S.StoryTiny>{rule.desc}</S.StoryTiny>
        </Box>
      ))}
    </S.Bordered>
  );
}

function PipelineFlowDemo() {
  const c = useThemeColors();
  const stages = [
    { label: 'Source', desc: 'lua/ + packages/', color: C.convert },
    { label: 'Lint', desc: 'rjit lint (gates build)', color: C.danger },
    { label: 'Bundle', desc: 'esbuild (iife format)', color: C.accent },
    { label: 'Sync', desc: 'make cli-setup', color: C.pipeline },
    { label: 'Update', desc: 'reactjit update', color: C.compat },
    { label: 'Ship', desc: 'rjit build <target>', color: C.migrate },
  ];
  return (
    <S.Bordered style={{ width: '100%', backgroundColor: c.bgElevated, borderRadius: 8, padding: 12, gap: 6 }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'BUILD PIPELINE'}</Text>
      <S.HorzDivider style={{ marginBottom: 4 }} />
      {stages.map((stage, i) => (
        <S.RowCenterG8 key={stage.label}>
          <Box style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: stage.color + '33',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ color: stage.color, fontSize: 9, fontWeight: 'bold' }}>{String(i + 1)}</Text>
          </Box>
          <Box style={{ width: 50 }}>
            <S.StoryBreadcrumbActive style={{ fontWeight: 'bold' }}>{stage.label}</S.StoryBreadcrumbActive>
          </Box>
          <S.StoryTiny>{stage.desc}</S.StoryTiny>
        </S.RowCenterG8>
      ))}
    </S.Bordered>
  );
}

function ResponsiveDemo() {
  const c = useThemeColors();
  const bp = useBreakpoint();
  const { width, height } = useWindowDimensions();
  const compact = bp === 'sm';

  const bpData = [
    { label: 'sm', min: 0, active: bp === 'sm' },
    { label: 'md', min: 640, active: bp === 'md' },
    { label: 'lg', min: 1024, active: bp === 'lg' },
    { label: 'xl', min: 1440, active: bp === 'xl' },
  ];

  return (
    <S.StackG10W100>
      {/* Current viewport readout */}
      <Box style={{
        width: '100%',
        backgroundColor: c.bgElevated,
        borderRadius: 8,
        padding: 10,
        flexDirection: compact ? 'column' : 'row',
        gap: compact ? 6 : 16,
        alignItems: compact ? 'flex-start' : 'center',
      }}>
        <Text style={{ color: C.accent, fontSize: 11, fontWeight: 'bold' }}>
          {`viewport: ${width} × ${height}`}
        </Text>
        <Text style={{ color: c.text, fontSize: 11 }}>
          {`breakpoint: ${bp}`}
        </Text>
        <S.StoryCap>
          {'Resize the window to see transitions'}
        </S.StoryCap>
      </Box>

      {/* Breakpoint indicator bar */}
      <S.RowG4 style={{ width: '100%' }}>
        {bpData.map(b => (
          <Box key={b.label} style={{
            flexGrow: 1,
            flexBasis: 0,
            backgroundColor: b.active ? C.accent : c.surface,
            borderRadius: 4,
            paddingTop: 6,
            paddingBottom: 6,
            alignItems: 'center',
          }}>
            <Text style={{ color: b.active ? '#000' : c.textDim, fontSize: 10, fontWeight: 'bold' }}>
              {b.label}
            </Text>
            <Text style={{ color: b.active ? '#000' : c.muted, fontSize: 8 }}>
              {`≥ ${b.min}px`}
            </Text>
          </Box>
        ))}
      </S.RowG4>

      {/* Live row/column switch demo */}
      <S.StackG6W100 style={{ backgroundColor: c.bgElevated, borderRadius: 8, padding: 10 }}>
        <S.StoryLabelText>
          {'LIVE LAYOUT SWITCH'}
        </S.StoryLabelText>
        <Box style={{
          flexDirection: compact ? 'column' : 'row',
          gap: 8,
          width: '100%',
        }}>
          {['Panel A', 'Panel B', 'Panel C'].map(label => (
            <S.SurfaceBordered key={label} style={{ flexGrow: 1, flexBasis: 0, borderRadius: 6, padding: 10, alignItems: 'center' }}>
              <S.StoryBody>{label}</S.StoryBody>
              <S.StoryTiny>
                {compact ? 'stacked' : 'side-by-side'}
              </S.StoryTiny>
            </S.SurfaceBordered>
          ))}
        </Box>
      </S.StackG6W100>
    </S.StackG10W100>
  );
}

// ── CompatibilityStory ──────────────────────────────────

export function CompatibilityStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="refresh-cw" tintColor={C.accent} />
        <S.StoryTitle>
          {'Compatibility'}
        </S.StoryTitle>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'cli + compat'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>
          {'Hedonism in your source code'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        <PageColumn>
        {/* ── Hero ── */}
        <HeroBand accentColor={C.accent}>
          <S.StoryHeadline>
            {'From any framework to ReactJIT. Zero rewrites required.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'Paste React+Tailwind verbatim and it renders. HTML elements remap to primitives. Tailwind classes become style objects. Converter CLI batch-transforms codebases. Dedicated migrators handle Flutter, SwiftUI, Tkinter, PyQt6, and Blessed. The build pipeline handles linting, bundling, cross-compilation, and runtime syncing.'}
          </S.StoryMuted>
        </HeroBand>

        {/* ── HTML Playground ── */}
        <Box style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 4 }}>
          <HtmlPlayground />
        </Box>

        <Divider />

        {/* ── Band 1: TAILWIND PARSER — demo | text+code ── */}
        <Band>
          <Half>
            <TailwindLiveDemo />
          </Half>
          <Half>
            <SectionLabel icon="code" accentColor={C.compat}>{'TAILWIND PARSER'}</SectionLabel>
            <S.StoryBody>
              {'Zero-install Tailwind parser built into @reactjit/core. Pass class strings to tw() and get native style objects. Covers spacing, sizing, colors (with alpha), flex, borders, fonts, shadows, transforms, gradients, and arbitrary values via bracket syntax.'}
            </S.StoryBody>
            <S.StoryCap>
              {'No PostCSS. No build step. No node_modules. Pure TypeScript function that maps class names to style objects at call time.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={TW_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 2: TW COVERAGE — text | demos ── */}
        <Band>
          <Half>
            <SectionLabel icon="layers" accentColor={C.compat}>{'CLASS COVERAGE'}</SectionLabel>
            <S.StoryBody>
              {'The tw() parser handles the full Tailwind utility surface: spacing scale (0-96), fractional widths, the complete color palette with shade variants (22 families × 11 shades), flexbox, borders with radius, font sizes (xs-9xl), weights, shadows, transforms, gradients, opacity, and arbitrary values in square brackets.'}
            </S.StoryBody>
            <TwCategoriesDemo />
          </Half>
          <Half>
            <ColorPaletteDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 3: VISUAL EFFECTS — demo | text ── */}
        <Band>
          <Half>
            <VisualEffectsDemo />
          </Half>
          <Half>
            <SectionLabel icon="sparkles" accentColor={C.compat}>{'SHADOWS · TRANSFORMS · GRADIENTS'}</SectionLabel>
            <S.StoryBody>
              {'Tailwind shadow classes map to the Love2D shadow system. Rotation and scale transform the element at paint time. Gradients resolve to backgroundGradient with direction and color stops. All via className or tw() — identical to native style objects.'}
            </S.StoryBody>
            <S.StoryCap>
              {'shadow-sm/md/lg/xl/2xl, rotate-N, scale-N, bg-gradient-to-r/b/br with from-/to- color stops.'}
            </S.StoryCap>
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: why compat exists ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'ReactJIT has no DOM. No CSS. No browser. Components are geometry descriptions for a GPU painter. But developers have muscle memory — they reach for className, <div>, and Tailwind utilities. Instead of fighting that, we parse it. tw() converts classes to style objects. HTML elements remap to primitives. You paste your React code and it works.'}
          </S.StoryBody>
        </CalloutBand>

        <Divider />

        {/* ── Band 4: HTML ELEMENTS — table | live demos ── */}
        <Band>
          <Half>
            <SectionLabel icon="box" accentColor={C.compat}>{'HTML ELEMENT REMAPPING'}</SectionLabel>
            <S.StoryBody>
              {'Every standard HTML element is remapped to a ReactJIT primitive at the reconciler level. div becomes Box. span becomes Text. button becomes Pressable. Combined with tw(), you can paste a React+Tailwind component from any codebase and it renders immediately.'}
            </S.StoryBody>
            <ElementMapDemo />
            <CodeBlock language="tsx" fontSize={9} code={HTML_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <HtmlLiveDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 5: COPY-PASTE PROOF + MERGE PRECEDENCE ── */}
        <Band>
          <Half>
            <CopyPasteDemo />
          </Half>
          <Half>
            <SectionLabel icon="check-circle" accentColor={C.compat}>{'COPY-PASTE PROOF + MERGE RULES'}</SectionLabel>
            <S.StoryBody>
              {'Real React+Tailwind components, pasted verbatim. Profile cards, social posts — they just work. When you mix className with shorthand props with style={}, the priority is clear: className < shorthand < style. style always wins.'}
            </S.StoryBody>
            <MergePrecedenceDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 6: CONVERTER CLI — text+code | demo ── */}
        <Band>
          <Half>
            <SectionLabel icon="terminal" accentColor={C.convert}>{'CONVERTER CLI'}</SectionLabel>
            <S.StoryBody>
              {'For batch conversion of existing React codebases, rjit convert transforms HTML/JSX to native ReactJIT primitives. It resolves Tailwind classes, remaps DOM events, normalizes inline styles, and extracts text content. Pipe mode works with clipboard for quick one-offs.'}
            </S.StoryBody>
            <CodeBlock language="bash" fontSize={9} code={CONVERT_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <SectionLabel icon="git-merge" accentColor={C.migrate}>{'PROJECT MIGRATION'}</SectionLabel>
            <S.StoryBody>
              {'Full-project migration scans every file, classifies it (UI, logic, server, assets), and routes each through the right converter. Express routes become useServer() hooks. Business logic transpiles to Lua. A MIGRATION.md report flags anything that needs manual attention.'}
            </S.StoryBody>
            <CodeBlock language="bash" fontSize={9} code={MIGRATE_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 7: CROSS-FRAMEWORK — demo | text ── */}
        <Band>
          <Half>
            <FrameworkCoverageDemo />
          </Half>
          <Half>
            <SectionLabel icon="globe" accentColor={C.migrate}>{'CROSS-FRAMEWORK MIGRATION'}</SectionLabel>
            <S.StoryBody>
              {'Dedicated migrators for six frameworks. Each understands the source framework\'s widget tree, layout model, state management, and event system. The output is idiomatic ReactJIT — not a mechanical translation, but real components with proper flex layout, hooks, and event handlers.'}
            </S.StoryBody>
          </Half>
        </Band>

        {/* ── Sub-bands: framework details ── */}
        <Box style={{
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 4,
          paddingBottom: 16,
          gap: 12,
        }}>
          <S.RowG12>
            <S.HalfCenter style={{ overflow: 'hidden' }}>
              <CodeBlock language="bash" fontSize={8} code={FLUTTER_CODE} style={{ width: '100%' }} />
            </S.HalfCenter>
            <S.HalfCenter style={{ overflow: 'hidden' }}>
              <CodeBlock language="bash" fontSize={8} code={SWIFTUI_CODE} style={{ width: '100%' }} />
            </S.HalfCenter>
          </S.RowG12>
          <S.RowG12>
            <S.HalfCenter style={{ overflow: 'hidden' }}>
              <CodeBlock language="bash" fontSize={8} code={TKINTER_CODE} style={{ width: '100%' }} />
            </S.HalfCenter>
            <S.HalfCenter style={{ overflow: 'hidden' }}>
              <CodeBlock language="bash" fontSize={8} code={PYQT_CODE} style={{ width: '100%' }} />
            </S.HalfCenter>
          </S.RowG12>
          <S.RowG12>
            <S.HalfCenter style={{ overflow: 'hidden' }}>
              <CodeBlock language="bash" fontSize={8} code={BLESSED_CODE} style={{ width: '100%' }} />
            </S.HalfCenter>
            <S.HalfCenter style={{ gap: 8 }}>
              {/* rjit-ignore-next-line */}
              <S.StoryCap style={{ fontStyle: 'italic' }}>
                {'All migrators use a shared IR (intermediate representation) and the same component assembly pipeline. Custom framework? Implement parse + generate against migration-core.mjs.'}
              </S.StoryCap>
            </S.HalfCenter>
          </S.RowG12>
        </Box>

        {/* ── Callout: migration philosophy ── */}
        <CalloutBand borderColor={C.calloutBorder} bgColor={C.callout}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'Migration is a spectrum, not a switch. Start by pasting existing code — tw() and HTML compat handle it. Run rjit convert for batch cleanup. Use dedicated migrators for non-React codebases. Over time, adopt native primitives and hooks as you learn the system. The compat layer doesn\'t go away.'}
          </S.StoryBody>
        </CalloutBand>

        <Divider />

        {/* ── Band 8: BUILD PIPELINE — text+code | demo ── */}
        <Band>
          <Half>
            <SectionLabel icon="cpu" accentColor={C.pipeline}>{'BUILD PIPELINE'}</SectionLabel>
            <S.StoryBody>
              {'The CLI encodes all esbuild flags, enforces lint gates before every build, handles runtime file placement, and produces correct distribution packages for five platforms. Never run raw esbuild. Never copy Lua files manually. The pipeline does it.'}
            </S.StoryBody>
            <CodeBlock language="bash" fontSize={9} code={PIPELINE_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <PipelineFlowDemo />
            <LintRulesDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 9: SOURCE-OF-TRUTH — code | text ── */}
        <Band>
          <Half>
            <CodeBlock language="bash" fontSize={9} code={SYNC_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <SectionLabel icon="database" accentColor={C.pipeline}>{'SOURCE-OF-TRUTH ARCHITECTURE'}</SectionLabel>
            <S.StoryBody>
              {'Framework files flow one way: source → staging → consumer. Edit lua/ and packages/ at the monorepo root. make cli-setup copies to cli/runtime/. reactjit update copies from cli/runtime/ into your project. The storybook bypasses this entirely — it reads from source via symlinks.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Never edit cli/runtime/ or project/lua/ directly. Those are disposable copies. The storybook\'s lua/ directory is a symlink — never replace it with a real directory.'}
            </S.StoryCap>
          </Half>
        </Band>

        <Divider />

        {/* ── Band 10: RESPONSIVE BREAKPOINTS — code | demo ── */}
        <Band>
          <Half>
            <SectionLabel icon="smartphone" accentColor={C.compat}>{'RESPONSIVE BREAKPOINTS'}</SectionLabel>
            <S.StoryBody>
              {'useBreakpoint() returns sm/md/lg/xl based on viewport width. useWindowDimensions() gives raw pixels. All Layout2 scaffolds (Band, Half, HeroBand, CalloutBand) and the storybook sidebar respond automatically — row layouts stack to columns on sm, padding tightens, and the sidebar collapses to a hamburger overlay.'}
            </S.StoryBody>
            <CodeBlock language="typescript" fontSize={9} code={RESPONSIVE_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <ResponsiveDemo />
            <CodeBlock language="bash" fontSize={9} code={RESPONSIVE_SCAFFOLD_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        {/* ── Footer padding ── */}
        <Box style={{ height: 24 }} />

        </PageColumn>
      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 8, paddingBottom: 8 }}>
        <S.StoryCap>
          {'reactjit / compat'}
        </S.StoryCap>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>
          {'tw() · HTML compat · rjit convert · rjit migrate · rjit build · responsive'}
        </S.StoryCap>
      </S.RowCenterBorder>
    </S.StoryRoot>
  );
}
