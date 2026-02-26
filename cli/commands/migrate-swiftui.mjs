/**
 * migrate-swiftui.mjs — SwiftUI → ReactJIT migration
 *
 * Converts SwiftUI views to ReactJIT TSX components. Handles:
 *
 *   Views:      VStack→Box(column), HStack→Box(row), ZStack→Box(relative),
 *               Text→Text, Image→Image, Button→Pressable, TextField→TextInput,
 *               Toggle→Pressable, List/ForEach→ScrollView+map, Spacer→Box(grow),
 *               NavigationView→Box, TabView→tabbed Box, ScrollView→ScrollView
 *
 *   Modifiers:  .padding()→padding, .frame()→width/height, .background()→backgroundColor,
 *               .foregroundColor()→color, .font()→fontSize, .cornerRadius()→borderRadius,
 *               .opacity()→opacity, .shadow()→shadow, .onTapGesture→onClick
 *
 *   State:      @State→useState, @Binding→props, @ObservedObject→context,
 *               @Environment→hooks, $binding→value+setter
 *
 *   Control:    if/else→conditional rendering, ForEach→.map(),
 *               .sheet()→Modal, .alert()→Modal
 *
 * Usage:
 *   rjit migrate-swiftui <file.swift>                    # convert, print to stdout
 *   rjit migrate-swiftui <file.swift> --output out.tsx   # write to file
 *   rjit migrate-swiftui <file.swift> --dry-run          # show analysis only
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { deriveProjectName } from '../lib/migration-core.mjs';
import { scaffoldProject } from './init.mjs';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VIEW MAPPING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VIEW_MAP = {
  'VStack':           { component: 'Box',        dir: 'column' },
  'HStack':           { component: 'Box',        dir: 'row' },
  'ZStack':           { component: 'Box',        dir: 'zstack' },
  'LazyVStack':       { component: 'Box',        dir: 'column' },
  'LazyHStack':       { component: 'Box',        dir: 'row' },
  'LazyVGrid':        { component: 'Box',        dir: 'column' },
  'LazyHGrid':        { component: 'Box',        dir: 'row' },
  'Text':             { component: 'Text',       dir: null },
  'Label':            { component: 'Text',       dir: null },
  'Image':            { component: 'Image',      dir: null },
  'Button':           { component: 'Pressable',  dir: null },
  'TextField':        { component: 'TextInput',  dir: null },
  'SecureField':      { component: 'TextInput',  dir: null, secure: true },
  'TextEditor':       { component: 'TextInput',  dir: null, multiline: true },
  'Toggle':           { component: 'Pressable',  dir: null, toggle: true },
  'Slider':           { component: 'Box',        dir: null, slider: true },
  'Stepper':          { component: 'Box',        dir: null, stepper: true },
  'Picker':           { component: 'Box',        dir: null, picker: true },
  'DatePicker':       { component: 'Box',        dir: null, picker: true },
  'ColorPicker':      { component: 'Box',        dir: null, picker: true },
  'List':             { component: 'ScrollView', dir: 'column' },
  'ScrollView':       { component: 'ScrollView', dir: null },
  'ForEach':          { component: null,         dir: null, forEach: true },
  'Form':             { component: 'Box',        dir: 'column' },
  'Section':          { component: 'Box',        dir: 'column', section: true },
  'Group':            { component: null,         dir: null }, // passthrough
  'NavigationView':   { component: 'Box',        dir: 'column', nav: true },
  'NavigationStack':  { component: 'Box',        dir: 'column', nav: true },
  'NavigationLink':   { component: 'Pressable',  dir: null, navLink: true },
  'TabView':          { component: 'Box',        dir: null, tabView: true },
  'Spacer':           { component: 'Box',        dir: null, spacer: true },
  'Divider':          { component: 'Box',        dir: null, divider: true },
  'Color':            { component: 'Box',        dir: null, colorFill: true },
  'Rectangle':        { component: 'Box',        dir: null },
  'RoundedRectangle': { component: 'Box',        dir: null },
  'Circle':           { component: 'Box',        dir: null, circle: true },
  'Capsule':          { component: 'Box',        dir: null, capsule: true },
  'Ellipse':          { component: 'Box',        dir: null },
  'ProgressView':     { component: 'Box',        dir: null, progress: true },
  'GeometryReader':   { component: 'Box',        dir: null, geoReader: true },
  'EmptyView':        { component: null,         dir: null },
  'AnyView':          { component: null,         dir: null }, // passthrough
  'Menu':             { component: 'Pressable',  dir: null },
  'ToolbarItem':      { component: null,         dir: null, skip: true },
  'ToolbarItemGroup': { component: null,         dir: null, skip: true },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SWIFTUI COLORS → HEX
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SWIFT_COLORS = {
  'blue':       '#3B82F6', 'red':      '#EF4444', 'green':    '#22C55E',
  'yellow':     '#EAB308', 'orange':   '#F97316', 'pink':     '#EC4899',
  'purple':     '#A855F7', 'indigo':   '#6366F1', 'teal':     '#14B8A6',
  'mint':       '#34D399', 'cyan':     '#06B6D4', 'brown':    '#92400E',
  'white':      '#FFFFFF', 'black':    '#000000', 'gray':     '#6B7280',
  'clear':      'transparent',
  'primary':    '#FFFFFF', 'secondary': '#9CA3AF',
  'accentColor': '#3B82F6',
};

// System colors (UIColor style)
const SYSTEM_COLORS = {
  'systemRed':        '#FF3B30', 'systemGreen':   '#34C759', 'systemBlue':     '#007AFF',
  'systemOrange':     '#FF9500', 'systemYellow':  '#FFCC00', 'systemPink':     '#FF2D55',
  'systemPurple':     '#AF52DE', 'systemTeal':    '#5AC8FA', 'systemIndigo':   '#5856D6',
  'systemGray':       '#8E8E93', 'systemGray2':   '#AEAEB2', 'systemGray3':    '#C7C7CC',
  'systemGray4':      '#D1D1D6', 'systemGray5':   '#E5E5EA', 'systemGray6':    '#F2F2F7',
  'systemBackground': '#000000', 'secondarySystemBackground': '#1C1C1E',
  'tertiarySystemBackground': '#2C2C2E',
  'label':            '#FFFFFF', 'secondaryLabel': '#9CA3AF',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FONT PRESETS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const FONT_MAP = {
  'largeTitle':  { fontSize: 34, fontWeight: 'bold' },
  'title':       { fontSize: 28, fontWeight: 'bold' },
  'title2':      { fontSize: 22, fontWeight: 'bold' },
  'title3':      { fontSize: 20, fontWeight: '600' },
  'headline':    { fontSize: 17, fontWeight: '600' },
  'body':        { fontSize: 17 },
  'callout':     { fontSize: 16 },
  'subheadline': { fontSize: 15 },
  'footnote':    { fontSize: 13 },
  'caption':     { fontSize: 12 },
  'caption2':    { fontSize: 11 },
};

const WEIGHT_MAP = {
  'ultraLight': '100', 'thin': '200', 'light': '300', 'regular': '400',
  'medium': '500', 'semibold': '600', 'bold': 'bold', 'heavy': '800', 'black': '900',
};


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SWIFT SOURCE PARSER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Extract the brace-matched block starting at position `start` (which should be `{`).
 * Returns { content, end } where end is the position AFTER the closing `}`.
 */
function extractBlock(source, start) {
  if (source[start] !== '{') return null;
  let depth = 0;
  let inStr = null;
  let i = start;
  while (i < source.length) {
    const ch = source[i];
    if (inStr) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === inStr) inStr = null;
      i++; continue;
    }
    if (ch === '"') { inStr = '"'; i++; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return { content: source.slice(start + 1, i), end: i + 1 }; }
    i++;
  }
  return { content: source.slice(start + 1), end: source.length };
}

/**
 * Extract parenthesized arguments starting at `start` (which should be `(`).
 * Returns { content, end }.
 */
function extractParens(source, start) {
  if (source[start] !== '(') return null;
  let depth = 0;
  let inStr = null;
  let i = start;
  while (i < source.length) {
    const ch = source[i];
    if (inStr) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === inStr) inStr = null;
      i++; continue;
    }
    if (ch === '"') { inStr = '"'; i++; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth === 0) return { content: source.slice(start + 1, i), end: i + 1 }; }
    i++;
  }
  return { content: source.slice(start + 1), end: source.length };
}

/**
 * Parse a SwiftUI source file into a structured representation.
 */
export function parseSwiftUISource(source) {
  const result = {
    structs: [],    // { name, conformances, properties, bodySource, line }
    imports: [],
    appEntry: null,
    warnings: [],
    rawSource: source,
  };

  const lines = source.split('\n');

  // Pass 1: Find imports
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import ')) {
      result.imports.push(line);
    }
  }

  // Pass 2: Find struct declarations
  const structRegex = /struct\s+(\w+)\s*(?::\s*([^{]+))?\s*\{/g;
  let match;
  while ((match = structRegex.exec(source)) !== null) {
    const name = match[1];
    const conformances = match[2] ? match[2].split(',').map(s => s.trim()) : [];
    const blockStart = match.index + match[0].length - 1; // position of {
    const block = extractBlock(source, blockStart);
    if (!block) continue;

    const isView = conformances.some(c => c === 'View');
    const isApp = conformances.some(c => c === 'App');

    // Find line number
    const lineNum = source.slice(0, match.index).split('\n').length;

    if (isApp) {
      result.appEntry = { name, bodySource: block.content, line: lineNum };
      continue;
    }

    // Extract properties (state vars, lets, etc.) and body
    const properties = parseStructProperties(block.content);
    const bodySource = extractBodySource(block.content);
    const functions = extractFunctions(block.content);

    result.structs.push({
      name,
      conformances,
      isView,
      properties,
      bodySource,
      functions,
      line: lineNum,
    });
  }

  return result;
}


/**
 * Extract @State, @Binding, let, var properties from a struct body.
 */
function parseStructProperties(body) {
  const props = [];
  const lines = body.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // @State private var name: Type = value
    const stateMatch = line.match(/^@(State|Binding|ObservedObject|StateObject|EnvironmentObject|Published)\s+(?:private\s+)?var\s+(\w+)\s*(?::\s*([^=]+?))?\s*(?:=\s*(.+))?$/);
    if (stateMatch) {
      let defaultValue = stateMatch[4]?.trim() || null;
      // Handle multi-line array/dict literals: if default starts with [ or { but isn't closed, read ahead
      if (defaultValue && (defaultValue.startsWith('[') || defaultValue.startsWith('{'))) {
        const open = defaultValue.startsWith('[') ? '[' : '{';
        const close = open === '[' ? ']' : '}';
        let depth = 0;
        for (const ch of defaultValue) { if (ch === open) depth++; if (ch === close) depth--; }
        while (depth > 0 && i + 1 < lines.length) {
          i++;
          defaultValue += '\n' + lines[i].trim();
          for (const ch of lines[i]) { if (ch === open) depth++; if (ch === close) depth--; }
        }
      }
      props.push({
        wrapper: stateMatch[1],
        name: stateMatch[2],
        type: stateMatch[3]?.trim() || null,
        defaultValue,
        line: i,
      });
      continue;
    }

    // @Environment(\.something) var name
    const envMatch = line.match(/^@Environment\(\\\.(\w+)\)\s+(?:private\s+)?var\s+(\w+)/);
    if (envMatch) {
      props.push({
        wrapper: 'Environment',
        name: envMatch[2],
        envKey: envMatch[1],
        type: null,
        defaultValue: null,
        line: i,
      });
      continue;
    }

    // let name: Type (props from parent)
    const letMatch = line.match(/^let\s+(\w+)\s*:\s*(.+)$/);
    if (letMatch) {
      props.push({
        wrapper: 'let',
        name: letMatch[1],
        type: letMatch[2].trim(),
        defaultValue: null,
        line: i,
      });
      continue;
    }

    // var name: Type (computed or stored)
    // Skip if it's `var body: some View` — that's handled separately
    const varMatch = line.match(/^(?:private\s+)?var\s+(\w+)\s*:\s*([^{]+)$/);
    if (varMatch && varMatch[1] !== 'body') {
      props.push({
        wrapper: 'var',
        name: varMatch[1],
        type: varMatch[2].trim(),
        defaultValue: null,
        line: i,
      });
      continue;
    }

    // Computed var with body (just record it exists)
    const computedMatch = line.match(/^(?:private\s+)?var\s+(\w+)\s*:\s*([^{]+)\s*\{/);
    if (computedMatch && computedMatch[1] !== 'body') {
      props.push({
        wrapper: 'computed',
        name: computedMatch[1],
        type: computedMatch[2].trim(),
        defaultValue: null,
        line: i,
      });
    }
  }

  return props;
}


/**
 * Extract the body: some View { ... } source from a struct.
 */
function extractBodySource(structBody) {
  const bodyIdx = structBody.indexOf('var body: some View');
  if (bodyIdx === -1) return null;

  // Find the opening brace
  let i = bodyIdx + 'var body: some View'.length;
  while (i < structBody.length && structBody[i] !== '{') i++;
  if (i >= structBody.length) return null;

  const block = extractBlock(structBody, i);
  return block ? block.content : null;
}


/**
 * Extract func declarations from a struct body.
 */
function extractFunctions(structBody) {
  const funcs = [];
  const funcRegex = /\bfunc\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(\S+)\s*)?\{/g;
  let match;

  while ((match = funcRegex.exec(structBody)) !== null) {
    const bracePos = match.index + match[0].length - 1;
    const block = extractBlock(structBody, bracePos);
    if (!block) continue;

    funcs.push({
      name: match[1],
      args: match[2],
      returnType: match[3] || null,
      body: block.content.trim(),
    });
  }

  return funcs;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VIEW TREE PARSER (recursive descent)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parse a ViewBuilder body into a tree of view nodes.
 * Each node: { type, args, children, modifiers, raw }
 */
function parseViewBody(source) {
  const nodes = [];
  let pos = 0;
  const src = source.trim();

  while (pos < src.length) {
    // Skip whitespace and newlines
    while (pos < src.length && /\s/.test(src[pos])) pos++;
    if (pos >= src.length) break;

    // Skip line comments
    if (src[pos] === '/' && src[pos + 1] === '/') {
      while (pos < src.length && src[pos] !== '\n') pos++;
      continue;
    }

    // Skip block comments
    if (src[pos] === '/' && src[pos + 1] === '*') {
      pos += 2;
      while (pos < src.length - 1 && !(src[pos] === '*' && src[pos + 1] === '/')) pos++;
      pos += 2;
      continue;
    }

    // #Preview, #if, etc. — skip
    if (src[pos] === '#') {
      while (pos < src.length && src[pos] !== '\n') pos++;
      continue;
    }

    // if/else conditional views
    if (src.slice(pos).match(/^if\s/)) {
      const node = parseIfBlock(src, pos);
      if (node) {
        nodes.push(node);
        pos = node._endPos;
        continue;
      }
    }

    // ForEach
    if (src.slice(pos, pos + 7) === 'ForEach') {
      const node = parseViewCall(src, pos);
      if (node) {
        nodes.push(node);
        pos = node._endPos;
        // Parse modifiers
        const { modifiers, endPos } = parseModifiers(src, pos);
        node.modifiers = modifiers;
        pos = endPos;
        continue;
      }
    }

    // View call: Identifier(args) { children } .modifier()
    if (/[A-Z]/.test(src[pos])) {
      const node = parseViewCall(src, pos);
      if (node) {
        nodes.push(node);
        pos = node._endPos;
        // Parse modifiers
        const { modifiers, endPos } = parseModifiers(src, pos);
        node.modifiers = modifiers;
        pos = endPos;
        continue;
      }
    }

    // String literal at top level (rare but valid in ViewBuilder)
    if (src[pos] === '"') {
      const end = findStringEnd(src, pos);
      const strContent = src.slice(pos + 1, end);
      nodes.push({ type: 'Text', args: `"${strContent}"`, children: [], modifiers: [], _endPos: end + 1 });
      pos = end + 1;
      const { modifiers, endPos } = parseModifiers(src, pos);
      nodes[nodes.length - 1].modifiers = modifiers;
      pos = endPos;
      continue;
    }

    // Fallback: skip to next line
    const nextNewline = src.indexOf('\n', pos);
    if (nextNewline === -1) break;
    pos = nextNewline + 1;
  }

  return nodes;
}


/**
 * Parse a view call: Identifier(args) { children }
 */
function parseViewCall(src, start) {
  let pos = start;

  // Read identifier (can include dots like Color.blue)
  let ident = '';
  while (pos < src.length && /[\w.]/.test(src[pos])) {
    ident += src[pos]; pos++;
  }
  if (!ident) return null;

  // Skip whitespace
  while (pos < src.length && (src[pos] === ' ' || src[pos] === '\t')) pos++;

  // Parse args if `(`
  let args = '';
  if (pos < src.length && src[pos] === '(') {
    const parens = extractParens(src, pos);
    if (parens) {
      args = parens.content;
      pos = parens.end;
    }
  }

  // Skip whitespace
  while (pos < src.length && /\s/.test(src[pos])) pos++;

  // Parse children block if `{`
  let children = [];
  let _iterVar = null;
  if (pos < src.length && src[pos] === '{') {
    const block = extractBlock(src, pos);
    if (block) {
      let content = block.content;
      // Detect closure parameter: "varName in\n" or "varName, idx in\n"
      const closureParamMatch = content.match(/^\s*(\w+)(?:\s*,\s*\w+)?\s+in\b/);
      if (closureParamMatch) {
        _iterVar = closureParamMatch[1];
        // Strip the "varName in" from the content before parsing
        content = content.replace(/^\s*\w+(?:\s*,\s*\w+)?\s+in\b/, '');
      }
      children = parseViewBody(content);
      pos = block.end;
    }
  }

  return { type: ident, args, children, modifiers: [], _iterVar, _endPos: pos };
}


/**
 * Parse chained modifiers: .font(.title).padding(16).background(...)
 */
function parseModifiers(src, start) {
  const modifiers = [];
  let pos = start;

  while (pos < src.length) {
    // Skip whitespace/newlines
    while (pos < src.length && /\s/.test(src[pos])) pos++;

    // Check for dot-prefixed modifier
    if (pos >= src.length || src[pos] !== '.') break;

    // Could be .someModifier or could be next statement — peek ahead
    const rest = src.slice(pos + 1);
    const identMatch = rest.match(/^(\w+)/);
    if (!identMatch) break;

    const modName = identMatch[1];

    // If it's a known SwiftUI view type after dot, it might be an enum member, not a modifier
    // But modifiers like .font, .padding, .frame etc. always start lowercase
    if (/^[A-Z]/.test(modName) && !['Type'].includes(modName)) break;

    pos++; // skip the dot
    pos += modName.length;

    // Skip whitespace
    while (pos < src.length && (src[pos] === ' ' || src[pos] === '\t')) pos++;

    // Parse args if `(`
    let args = '';
    if (pos < src.length && src[pos] === '(') {
      const parens = extractParens(src, pos);
      if (parens) {
        args = parens.content;
        pos = parens.end;
      }
    }

    // Parse trailing closure if `{`
    let closureBody = '';
    // Skip whitespace
    while (pos < src.length && (src[pos] === ' ' || src[pos] === '\t')) pos++;
    if (pos < src.length && src[pos] === '{') {
      const block = extractBlock(src, pos);
      if (block) {
        closureBody = block.content.trim();
        pos = block.end;
      }
    }

    modifiers.push({ name: modName, args: args.trim(), closureBody });
  }

  return { modifiers, endPos: pos };
}


/**
 * Parse an if/else block in a ViewBuilder.
 */
function parseIfBlock(src, start) {
  let pos = start;

  // "if condition {"
  const ifMatch = src.slice(pos).match(/^if\s+(.+?)\s*\{/);
  if (!ifMatch) return null;

  pos += ifMatch[0].length - 1; // at the {
  const ifBlock = extractBlock(src, pos);
  if (!ifBlock) return null;

  const ifChildren = parseViewBody(ifBlock.content);
  pos = ifBlock.end;

  // Check for else
  while (pos < src.length && /\s/.test(src[pos])) pos++;

  let elseChildren = [];
  if (src.slice(pos, pos + 4) === 'else') {
    pos += 4;
    while (pos < src.length && /\s/.test(src[pos])) pos++;

    if (src.slice(pos, pos + 2) === 'if') {
      // else if — recurse
      const elseIfNode = parseIfBlock(src, pos);
      if (elseIfNode) {
        elseChildren = [elseIfNode];
        pos = elseIfNode._endPos;
      }
    } else if (src[pos] === '{') {
      const elseBlock = extractBlock(src, pos);
      if (elseBlock) {
        elseChildren = parseViewBody(elseBlock.content);
        pos = elseBlock.end;
      }
    }
  }

  return {
    type: '_if',
    condition: ifMatch[1].trim(),
    children: ifChildren,
    elseChildren,
    modifiers: [],
    _endPos: pos,
  };
}


/**
 * Find end of a Swift string (handling escape sequences).
 */
function findStringEnd(src, start) {
  let i = start + 1; // skip opening quote
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === '"') return i;
    i++;
  }
  return src.length - 1;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MODIFIER → STYLE CONVERSION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Convert SwiftUI modifiers to ReactJIT style properties.
 * Returns { style, events, extraProps, sideEffects, warnings }
 */
function convertModifiers(modifiers) {
  const style = {};
  const events = [];
  const extraProps = [];
  const sideEffects = []; // onAppear, onChange, etc.
  const warnings = [];
  let sheetBinding = null;
  let alertBinding = null;
  let navTitle = null;

  for (const mod of modifiers) {
    switch (mod.name) {
      // ── Padding ──────────────────────
      case 'padding': {
        if (!mod.args) {
          style.padding = 16;
        } else if (/^\d+$/.test(mod.args)) {
          style.padding = parseInt(mod.args);
        } else {
          // .padding(.horizontal, 16) or .padding(.top, 8)
          const edgeMatch = mod.args.match(/\.(\w+)\s*,\s*(\d+)/);
          if (edgeMatch) {
            const edge = edgeMatch[1];
            const val = parseInt(edgeMatch[2]);
            if (edge === 'horizontal') { style.paddingLeft = val; style.paddingRight = val; }
            else if (edge === 'vertical') { style.paddingTop = val; style.paddingBottom = val; }
            else if (edge === 'top') style.paddingTop = val;
            else if (edge === 'bottom') style.paddingBottom = val;
            else if (edge === 'leading') style.paddingLeft = val;
            else if (edge === 'trailing') style.paddingRight = val;
          } else if (/^\.\w+$/.test(mod.args)) {
            // .padding(.horizontal) — default 16
            const edge = mod.args.slice(1);
            if (edge === 'horizontal') { style.paddingLeft = 16; style.paddingRight = 16; }
            else if (edge === 'vertical') { style.paddingTop = 16; style.paddingBottom = 16; }
            else style.padding = 16;
          } else {
            // EdgeInsets or complex — just use default
            style.padding = 16;
          }
        }
        break;
      }

      // ── Frame ────────────────────────
      case 'frame': {
        const widthMatch = mod.args.match(/(?:^|,\s*)width\s*:\s*(\S+)/);
        const heightMatch = mod.args.match(/(?:^|,\s*)height\s*:\s*(\S+)/);
        const maxWidthMatch = mod.args.match(/maxWidth\s*:\s*(\S+)/);
        const maxHeightMatch = mod.args.match(/maxHeight\s*:\s*(\S+)/);
        const minWidthMatch = mod.args.match(/minWidth\s*:\s*(\S+)/);
        const minHeightMatch = mod.args.match(/minHeight\s*:\s*(\S+)/);
        const alignMatch = mod.args.match(/alignment\s*:\s*\.(\w+)/);

        if (widthMatch) {
          const w = widthMatch[1].replace(/,.*$/, '');
          style.width = /^\d+$/.test(w) ? parseInt(w) : w;
        }
        if (heightMatch) {
          const h = heightMatch[1].replace(/,.*$/, '');
          style.height = /^\d+$/.test(h) ? parseInt(h) : h;
        }
        if (maxWidthMatch) {
          const mw = maxWidthMatch[1].replace(/,.*$/, '');
          if (mw === '.infinity') { style.width = '100%'; style.flexGrow = 1; }
          else if (/^\d+$/.test(mw)) style.maxWidth = parseInt(mw);
        }
        if (maxHeightMatch) {
          const mh = maxHeightMatch[1].replace(/,.*$/, '');
          if (mh === '.infinity') { style.height = '100%'; style.flexGrow = 1; }
          else if (/^\d+$/.test(mh)) style.maxHeight = parseInt(mh);
        }
        if (minWidthMatch) { const v = minWidthMatch[1].replace(/,.*$/, ''); if (/^\d+$/.test(v)) style.minWidth = parseInt(v); }
        if (minHeightMatch) { const v = minHeightMatch[1].replace(/,.*$/, ''); if (/^\d+$/.test(v)) style.minHeight = parseInt(v); }

        if (alignMatch) {
          const align = alignMatch[1];
          if (align === 'leading') style.alignItems = 'start';
          else if (align === 'trailing') style.alignItems = 'end';
          else if (align === 'center') style.alignItems = 'center';
          else if (align === 'topLeading') { style.alignItems = 'start'; style.justifyContent = 'start'; }
          else if (align === 'bottomTrailing') { style.alignItems = 'end'; style.justifyContent = 'end'; }
        }
        break;
      }

      // ── Colors ───────────────────────
      case 'background': {
        const color = resolveSwiftColor(mod.args);
        if (color) style.backgroundColor = color;
        break;
      }
      case 'foregroundColor':
      case 'foregroundStyle': {
        const color = resolveSwiftColor(mod.args);
        if (color) style.color = color;
        break;
      }
      case 'tint': {
        const color = resolveSwiftColor(mod.args);
        if (color) style.color = color;
        break;
      }

      // ── Typography ───────────────────
      case 'font': {
        const preset = mod.args.replace(/^\./, '');
        if (FONT_MAP[preset]) {
          Object.assign(style, FONT_MAP[preset]);
        } else {
          // .font(.system(size: 48))
          const sizeMatch = mod.args.match(/size\s*:\s*(\d+)/);
          if (sizeMatch) style.fontSize = parseInt(sizeMatch[1]);
          const weightMatch = mod.args.match(/weight\s*:\s*\.(\w+)/);
          if (weightMatch && WEIGHT_MAP[weightMatch[1]]) style.fontWeight = WEIGHT_MAP[weightMatch[1]];
          const designMatch = mod.args.match(/design\s*:\s*\.monospaced/);
          if (designMatch) style.fontFamily = 'monospace';
        }
        break;
      }
      case 'fontWeight': {
        const w = mod.args.replace(/^\./, '');
        if (WEIGHT_MAP[w]) style.fontWeight = WEIGHT_MAP[w];
        break;
      }
      case 'bold': {
        style.fontWeight = 'bold';
        break;
      }
      case 'italic': {
        style.fontStyle = 'italic';
        break;
      }
      case 'strikethrough': {
        if (mod.args && mod.args !== 'true') {
          // Conditional: .strikethrough(expr) — store for runtime conditional
          style._conditionalStrike = mod.args;
        } else {
          style.textDecorationLine = 'line-through';
        }
        break;
      }
      case 'underline': {
        style.textDecorationLine = 'underline';
        break;
      }
      case 'multilineTextAlignment': {
        const align = mod.args.replace(/^\./, '');
        if (align === 'center') style.textAlign = 'center';
        else if (align === 'trailing') style.textAlign = 'right';
        else style.textAlign = 'left';
        break;
      }
      case 'lineLimit': {
        // No direct equivalent; warn
        break;
      }

      // ── Shape / Border ────────────────
      case 'cornerRadius': {
        style.borderRadius = parseInt(mod.args) || 8;
        break;
      }
      case 'clipShape': {
        if (/Circle/.test(mod.args)) style.borderRadius = 9999;
        else if (/Capsule/.test(mod.args)) style.borderRadius = 9999;
        else if (/RoundedRectangle/.test(mod.args)) {
          const crMatch = mod.args.match(/cornerRadius\s*:\s*(\d+)/);
          if (crMatch) style.borderRadius = parseInt(crMatch[1]);
        }
        break;
      }
      case 'border': {
        const parts = mod.args.split(',');
        const color = resolveSwiftColor(parts[0]?.trim());
        const width = parts[1]?.match(/width\s*:\s*(\d+)/)?.[1];
        if (color) style.borderColor = color;
        style.borderWidth = width ? parseInt(width) : 1;
        break;
      }

      // ── Visual Effects ────────────────
      case 'opacity': {
        style.opacity = parseFloat(mod.args) || 1;
        break;
      }
      case 'shadow': {
        const radiusMatch = mod.args.match(/radius\s*:\s*(\d+)/);
        if (radiusMatch) {
          style.shadowBlur = parseInt(radiusMatch[1]);
          style.shadowColor = 'rgba(0,0,0,0.25)';
          const xMatch = mod.args.match(/x\s*:\s*(-?\d+)/);
          const yMatch = mod.args.match(/y\s*:\s*(-?\d+)/);
          if (xMatch) style.shadowOffsetX = parseInt(xMatch[1]);
          if (yMatch) style.shadowOffsetY = parseInt(yMatch[1]);
        } else if (/^\d+$/.test(mod.args.trim())) {
          style.shadowBlur = parseInt(mod.args);
          style.shadowColor = 'rgba(0,0,0,0.25)';
        }
        break;
      }
      case 'hidden': {
        style.display = 'none';
        break;
      }

      // ── Events ────────────────────────
      case 'onTapGesture': {
        events.push({ name: 'onClick', handler: mod.closureBody || mod.args });
        break;
      }
      case 'onLongPressGesture': {
        events.push({ name: 'onLongPress', handler: mod.closureBody || mod.args });
        break;
      }
      case 'onAppear': {
        sideEffects.push({ type: 'onAppear', body: mod.closureBody || mod.args });
        break;
      }
      case 'onDisappear': {
        sideEffects.push({ type: 'onDisappear', body: mod.closureBody || mod.args });
        break;
      }
      case 'onChange': {
        const ofMatch = mod.args.match(/of\s*:\s*(\w+)/);
        sideEffects.push({ type: 'onChange', dep: ofMatch?.[1] || '?', body: mod.closureBody || '' });
        break;
      }
      case 'onDelete': {
        events.push({ name: 'onDelete', handler: mod.args });
        break;
      }

      // ── Sheets / Alerts ───────────────
      case 'sheet': {
        const presented = mod.args.match(/isPresented\s*:\s*\$(\w+)/);
        sheetBinding = presented?.[1] || null;
        if (mod.closureBody) {
          // Parse the sheet content as a view tree
          sideEffects.push({ type: 'sheet', binding: sheetBinding, body: mod.closureBody });
        }
        break;
      }
      case 'alert': {
        const presented = mod.args.match(/isPresented\s*:\s*\$(\w+)/);
        alertBinding = presented?.[1] || null;
        sideEffects.push({ type: 'alert', binding: alertBinding, body: mod.closureBody || mod.args });
        break;
      }
      case 'fullScreenCover': {
        const presented = mod.args.match(/isPresented\s*:\s*\$(\w+)/);
        sideEffects.push({ type: 'sheet', binding: presented?.[1], body: mod.closureBody || '' });
        break;
      }

      // ── Navigation ────────────────────
      case 'navigationTitle': {
        const title = mod.args.replace(/^['"]|['"]$/g, '');
        navTitle = title;
        break;
      }
      case 'navigationBarTitleDisplayMode':
      case 'navigationBarHidden':
      case 'toolbar':
      case 'toolbarBackground':
        // Skip — no direct equivalent
        break;

      // ── Layout hints ──────────────────
      case 'edgesIgnoringSafeArea':
      case 'ignoresSafeArea':
      case 'safeAreaInset':
        break; // no equivalent
      case 'listStyle':
      case 'listRowBackground':
      case 'listRowInsets':
      case 'listRowSeparator':
        break; // list styling — skip
      case 'buttonStyle':
      case 'toggleStyle':
      case 'pickerStyle':
      case 'textFieldStyle':
      case 'labelStyle':
      case 'progressViewStyle':
        break; // style variants — skip

      case 'disabled': {
        if (mod.args === 'true' || mod.args.includes('isEmpty')) {
          style.opacity = 0.5;
        }
        break;
      }

      case 'offset': {
        const xMatch = mod.args.match(/x\s*:\s*(-?\d+)/);
        const yMatch = mod.args.match(/y\s*:\s*(-?\d+)/);
        if (xMatch || yMatch) {
          style.position = 'absolute';
          if (xMatch) style.left = parseInt(xMatch[1]);
          if (yMatch) style.top = parseInt(yMatch[1]);
        }
        break;
      }

      case 'rotationEffect':
      case 'scaleEffect':
      case 'animation':
      case 'transition':
      case 'withAnimation':
        warnings.push(`Modifier .${mod.name}() → no direct equivalent in ReactJIT`);
        break;

      case 'overlay':
        warnings.push(`Modifier .overlay() → needs manual conversion`);
        break;

      case 'mask':
        warnings.push(`Modifier .mask() → no equivalent in ReactJIT`);
        break;

      // ── Accessibility ─────────────────
      case 'accessibilityLabel':
      case 'accessibilityHint':
      case 'accessibilityValue':
      case 'accessibilityIdentifier':
      case 'accessibilityHidden':
        break; // skip

      default:
        // Unknown modifier — silently skip common ones
        if (!['tag', 'id', 'zIndex', 'layoutPriority', 'fixedSize',
              'allowsHitTesting', 'contentShape', 'clipped',
              'aspectRatio', 'scaledToFit', 'scaledToFill',
              'resizable', 'renderingMode', 'interpolation',
              'symbolRenderingMode', 'imageScale',
              'redacted', 'unredacted', 'privacySensitive',
              'refreshable', 'searchable', 'task',
              'environment', 'environmentObject',
              'preferredColorScheme', 'accentColor',
              'confirmationDialog', 'popover', 'contextMenu',
              'swipeActions', 'badge', 'help',
              'focused', 'focusable', 'submitLabel',
              'autocapitalization', 'disableAutocorrection', 'textInputAutocapitalization',
              'keyboardType', 'textContentType',
             ].includes(mod.name)) {
          warnings.push(`Unknown modifier .${mod.name}(${mod.args.slice(0, 30)}${mod.args.length > 30 ? '...' : ''})`);
        }
    }
  }

  return { style, events, extraProps, sideEffects, warnings, sheetBinding, alertBinding, navTitle };
}


/**
 * Resolve a SwiftUI color expression to a hex string.
 */
function resolveSwiftColor(expr) {
  if (!expr) return null;
  expr = expr.trim();

  // .blue, .red, etc.
  if (expr.startsWith('.')) {
    const name = expr.slice(1);
    if (SWIFT_COLORS[name]) return SWIFT_COLORS[name];
  }

  // Color.blue, Color.red
  if (expr.startsWith('Color.')) {
    const name = expr.slice(6);
    if (SWIFT_COLORS[name]) return SWIFT_COLORS[name];
  }

  // Color(.systemGray6), Color(.label), etc.
  const sysMatch = expr.match(/^Color\(\s*\.(\w+)\s*\)/);
  if (sysMatch && SYSTEM_COLORS[sysMatch[1]]) return SYSTEM_COLORS[sysMatch[1]];

  // UIColor.systemRed etc.
  const uiMatch = expr.match(/UIColor\.(\w+)/);
  if (uiMatch && SYSTEM_COLORS[uiMatch[1]]) return SYSTEM_COLORS[uiMatch[1]];

  // Color(red:, green:, blue:)
  const rgbMatch = expr.match(/Color\(\s*red\s*:\s*([\d.]+)\s*,\s*green\s*:\s*([\d.]+)\s*,\s*blue\s*:\s*([\d.]+)/);
  if (rgbMatch) {
    const r = Math.round(parseFloat(rgbMatch[1]) * 255);
    const g = Math.round(parseFloat(rgbMatch[2]) * 255);
    const b = Math.round(parseFloat(rgbMatch[3]) * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // Color("customName") — asset catalog, pass through
  const assetMatch = expr.match(/^Color\(\s*["'](\w+)["']\s*\)/);
  if (assetMatch) return `/* Color asset: ${assetMatch[1]} */ '#888888'`;

  // Bare name
  if (SWIFT_COLORS[expr]) return SWIFT_COLORS[expr];

  return null;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CODE GENERATOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function generateReactJIT(parsedFile) {
  const allComponents = new Set(['Box']);
  const allWarnings = [...parsedFile.warnings];
  const outputs = [];

  for (const struct of parsedFile.structs) {
    if (!struct.isView || !struct.bodySource) continue;

    const components = new Set(['Box']);
    const warnings = [];

    // Parse the body into a view tree
    const viewTree = parseViewBody(struct.bodySource);

    // Convert state
    const stateDecls = [];
    for (const p of struct.properties) {
      if (p.wrapper === 'State') {
        const tsType = swiftTypeToTS(p.type);
        const jsDefault = swiftValueToJS(p.defaultValue, p.type);
        stateDecls.push(`  const [${p.name}, set${capitalize(p.name)}] = useState${tsType ? `<${tsType}>` : ''}(${jsDefault});`);
      } else if (p.wrapper === 'Binding') {
        // Props from parent — declared as function params
        // We'll note them as component props
      } else if (p.wrapper === 'Environment') {
        if (p.envKey === 'dismiss') {
          stateDecls.push(`  // @Environment(\\.dismiss) — use onClose prop or navigation`);
        } else if (p.envKey === 'colorScheme') {
          stateDecls.push(`  const c = useThemeColors();`);
        } else {
          stateDecls.push(`  // @Environment(\\.${p.envKey}) — needs manual conversion`);
        }
      } else if (p.wrapper === 'ObservedObject' || p.wrapper === 'StateObject') {
        stateDecls.push(`  // @${p.wrapper} var ${p.name} — convert to useContext or props`);
      } else if (p.wrapper === 'computed') {
        // Will need the actual computed body — skip for now
        stateDecls.push(`  // computed var ${p.name}: ${p.type || '?'} — convert manually`);
      }
    }

    // Convert functions
    const funcDecls = [];
    for (const f of struct.functions) {
      funcDecls.push(`  const ${f.name} = (${convertSwiftArgs(f.args)}) => {`);
      const bodyLines = f.body.split('\n');
      for (const bl of bodyLines) {
        funcDecls.push(`    ${convertSwiftLine(bl.trim(), struct.properties)}`);
      }
      funcDecls.push(`  };`);
      funcDecls.push('');
    }

    // Generate JSX
    const jsxLines = generateViewTree(viewTree, 2, components, warnings, struct.properties);

    // Collect side effects from modifiers (onAppear, sheet, etc.)
    const effects = collectSideEffects(viewTree);
    const effectDecls = [];
    for (const eff of effects) {
      if (eff.type === 'onAppear') {
        effectDecls.push(`  useEffect(() => {`);
        effectDecls.push(`    ${convertSwiftLine(eff.body, struct.properties)}`);
        effectDecls.push(`  }, []);`);
        effectDecls.push('');
      } else if (eff.type === 'onChange') {
        effectDecls.push(`  useEffect(() => {`);
        effectDecls.push(`    ${convertSwiftLine(eff.body, struct.properties)}`);
        effectDecls.push(`  }, [${eff.dep}]);`);
        effectDecls.push('');
      }
    }

    // Collect sheet modals
    const sheets = effects.filter(e => e.type === 'sheet' && e.binding);
    const sheetJSX = [];
    for (const sheet of sheets) {
      components.add('Modal');
      const sheetTree = parseViewBody(sheet.body);
      const sheetLines = generateViewTree(sheetTree, 4, components, warnings, struct.properties);
      sheetJSX.push(`      {${sheet.binding} && (`);
      sheetJSX.push(`        <Modal visible={${sheet.binding}} onClose={() => set${capitalize(sheet.binding)}(false)}>`);
      sheetJSX.push(...sheetLines);
      sheetJSX.push(`        </Modal>`);
      sheetJSX.push(`      )}`);
    }

    // Build props from @Binding and let properties
    const bindingProps = struct.properties.filter(p => p.wrapper === 'Binding' || p.wrapper === 'let');
    const propsStr = bindingProps.length > 0
      ? `{ ${bindingProps.map(p => p.name).join(', ')} }: { ${bindingProps.map(p => `${p.name}: ${swiftTypeToTS(p.type) || 'any'}`).join('; ')} }`
      : '';

    // Assemble
    const output = [];
    output.push(`export function ${struct.name}(${propsStr}) {`);
    if (stateDecls.length > 0) { output.push(...stateDecls); output.push(''); }
    if (funcDecls.length > 0) output.push(...funcDecls);
    if (effectDecls.length > 0) output.push(...effectDecls);
    output.push('  return (');
    if (sheetJSX.length > 0) {
      // Wrap in fragment when there are modal overlays
      output.push('    <>');
      output.push(...jsxLines);
      output.push(...sheetJSX);
      output.push('    </>');
    } else {
      output.push(...jsxLines);
    }
    output.push('  );');
    output.push('}');

    for (const c of components) allComponents.add(c);
    allWarnings.push(...warnings);
    outputs.push(output.join('\n'));
  }

  // Build final file
  const fileLines = [];
  fileLines.push(`import React, { useState, useEffect } from 'react';`);
  fileLines.push(`import { ${[...allComponents].sort().join(', ')} } from '@reactjit/core';`);
  fileLines.push('');

  if (parsedFile.structs.length > 0) {
    const mainView = parsedFile.structs.find(s => s.isView);
    if (mainView) {
      fileLines.push(`// Migrated from SwiftUI: ${mainView.name}`);
    }
  }
  fileLines.push('');

  fileLines.push(outputs.join('\n\n'));

  return {
    code: fileLines.join('\n'),
    warnings: [...new Set(allWarnings)],
    components: [...allComponents],
    stats: {
      views: parsedFile.structs.filter(s => s.isView).length,
      stateVars: parsedFile.structs.reduce((sum, s) => sum + s.properties.filter(p => p.wrapper === 'State').length, 0),
      functions: parsedFile.structs.reduce((sum, s) => sum + s.functions.length, 0),
      bindings: parsedFile.structs.reduce((sum, s) => sum + s.properties.filter(p => p.wrapper === 'Binding').length, 0),
    },
  };
}


/**
 * Generate JSX lines from a view tree.
 * Returns array of indented strings.
 */
function generateViewTree(nodes, depth, components, warnings, props) {
  const out = [];
  const ind = (d) => '  '.repeat(d);

  for (const node of nodes) {
    if (node.type === '_if') {
      out.push(...generateIfNode(node, depth, components, warnings, props));
      continue;
    }

    // Convert modifiers to style/events
    const { style, events, sideEffects, warnings: modWarnings, navTitle } = convertModifiers(node.modifiers || []);
    warnings.push(...modWarnings);

    // ── ForEach (check before VIEW_MAP to avoid fallback) ──
    if (node.type === 'ForEach') {
      const { collection } = resolveForEachArgs(node.args);
      const itemVar = node._iterVar || 'item';
      out.push(`${ind(depth)}{${collection}.map((${itemVar}) => (`);
      if (node.children.length > 0) {
        out.push(...generateViewTree(node.children, depth + 1, components, warnings, props));
      }
      out.push(`${ind(depth)}))}`);
      continue;
    }

    const mapping = VIEW_MAP[node.type];
    if (!mapping) {
      // Could be a custom view call
      out.push(`${ind(depth)}<${node.type}${node.args ? ` /* ${node.args} */` : ''} />`);
      continue;
    }

    if (mapping.skip) continue;

    // Special views
    if (mapping.spacer) {
      out.push(`${ind(depth)}<Box style={{ flexGrow: 1 }} />`);
      continue;
    }

    if (mapping.divider) {
      out.push(`${ind(depth)}<Box style={{ width: '100%', height: 1, backgroundColor: '#333' }} />`);
      continue;
    }

    const comp = mapping.component;
    if (!comp) {
      // Passthrough (Group, EmptyView) — render children directly
      if (node.children.length > 0) {
        out.push(...generateViewTree(node.children, depth, components, warnings, props));
      }
      continue;
    }

    components.add(comp);

    // ── Text ─────────────────────────
    if (node.type === 'Text' || node.type === 'Label') {
      components.add('Text');
      const textContent = resolveTextContent(node.args);
      // Handle conditional strikethrough
      if (style._conditionalStrike) {
        const cond = convertSwiftExpr(style._conditionalStrike, props);
        const baseStyle = { ...style };
        delete baseStyle._conditionalStrike;
        const withStrike = { ...baseStyle, textDecorationLine: 'line-through' };
        out.push(`${ind(depth)}<Text style={${cond} ? ${formatStyleObj(withStrike)} : ${formatStyleObj(baseStyle)}}>${textContent}</Text>`);
      } else {
        const styleStr = formatStyle(style);
        out.push(`${ind(depth)}<Text${styleStr}>${textContent}</Text>`);
      }
      continue;
    }

    // ── Image ────────────────────────
    if (node.type === 'Image') {
      components.add('Image');
      const imgSrc = resolveImageSource(node.args);
      const styleStr = formatStyle(style);
      if (imgSrc.systemName) {
        // SF Symbol → emoji fallback or comment
        components.add('Text');
        out.push(`${ind(depth)}<Text${styleStr}>{/* SF Symbol: ${imgSrc.systemName} */}</Text>`);
      } else {
        out.push(`${ind(depth)}<Image src="${imgSrc.name || 'placeholder'}"${styleStr} />`);
      }
      continue;
    }

    // ── Button ───────────────────────
    if (node.type === 'Button') {
      components.add('Pressable');
      components.add('Text');
      const handler = resolveButtonAction(node.args, node.children, props);
      const styleStr = formatStyle(style);
      out.push(`${ind(depth)}<Pressable onClick={${handler}}${styleStr}>`);
      if (node.children.length > 0) {
        out.push(...generateViewTree(node.children, depth + 1, components, warnings, props));
      } else {
        // Inline label from args
        const label = extractStringArg(node.args);
        if (label) out.push(`${ind(depth + 1)}<Text>${label}</Text>`);
      }
      out.push(`${ind(depth)}</Pressable>`);
      continue;
    }

    // ── TextField ────────────────────
    if (node.type === 'TextField' || node.type === 'SecureField') {
      components.add('TextInput');
      const { placeholder, binding } = resolveTextFieldArgs(node.args);
      const styleStr = formatStyle(style);
      let valueStr = '';
      if (binding) {
        valueStr = ` value={${binding}} onTextInput={(e) => set${capitalize(binding)}(e.text)}`;
      }
      const placeholderStr = placeholder ? ` placeholder="${placeholder}"` : '';
      const secureStr = mapping.secure ? ' secureTextEntry' : '';
      out.push(`${ind(depth)}<TextInput${styleStr}${valueStr}${placeholderStr}${secureStr} />`);
      continue;
    }

    // ── Toggle ───────────────────────
    if (mapping.toggle) {
      components.add('Pressable');
      components.add('Text');
      const { label, binding } = resolveToggleArgs(node.args);
      const styleStr = formatStyle(style);
      out.push(`${ind(depth)}<Pressable onClick={() => set${capitalize(binding || 'toggle')}(prev => !prev)}${styleStr}>`);
      out.push(`${ind(depth + 1)}<Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>`);
      out.push(`${ind(depth + 2)}<Box style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: ${binding || 'toggle'} ? '#3B82F6' : '#555' }} />`);
      if (label) out.push(`${ind(depth + 2)}<Text>${label}</Text>`);
      out.push(`${ind(depth + 1)}</Box>`);
      out.push(`${ind(depth)}</Pressable>`);
      continue;
    }

    // ── NavigationLink ───────────────
    if (mapping.navLink) {
      components.add('Pressable');
      out.push(`${ind(depth)}<Pressable${formatStyle(style)}>`);
      out.push(`${ind(depth + 1)}{/* NavigationLink — destination needs manual routing */}`);
      if (node.children.length > 0) {
        out.push(...generateViewTree(node.children, depth + 1, components, warnings, props));
      }
      out.push(`${ind(depth)}</Pressable>`);
      continue;
    }

    // ── Progress ─────────────────────
    if (mapping.progress) {
      const styleStr = formatStyle({ ...style, backgroundColor: '#333', borderRadius: 4, height: 8, overflow: 'hidden' });
      out.push(`${ind(depth)}<Box${styleStr}>`);
      out.push(`${ind(depth + 1)}<Box style={{ width: '50%', height: '100%', backgroundColor: '#3B82F6', borderRadius: 4 }} />`);
      out.push(`${ind(depth)}</Box>`);
      continue;
    }

    // ── Color fills ──────────────────
    if (mapping.colorFill) {
      const color = resolveSwiftColor(node.args || node.type);
      const fillStyle = { ...style, backgroundColor: color || '#888' };
      if (!fillStyle.width) fillStyle.flexGrow = 1;
      out.push(`${ind(depth)}<Box${formatStyle(fillStyle)} />`);
      continue;
    }

    // ── Circle / Capsule ─────────────
    if (mapping.circle || mapping.capsule) {
      style.borderRadius = 9999;
    }

    // ── Container views (VStack, HStack, etc.) ───
    if (mapping.dir) {
      if (mapping.dir === 'column') style.flexDirection = style.flexDirection || 'column';
      else if (mapping.dir === 'row') style.flexDirection = style.flexDirection || 'row';
      else if (mapping.dir === 'zstack') style.position = 'relative';
    }

    // Extract spacing from args
    const spacingMatch = node.args?.match(/spacing\s*:\s*(\d+)/);
    if (spacingMatch) style.gap = parseInt(spacingMatch[1]);

    // Extract alignment from args
    const alignMatch = node.args?.match(/alignment\s*:\s*\.(\w+)/);
    if (alignMatch) {
      const a = alignMatch[1];
      if (a === 'leading') style.alignItems = 'start';
      else if (a === 'trailing') style.alignItems = 'end';
      else if (a === 'center') style.alignItems = 'center';
      else if (a === 'top') style.justifyContent = 'start';
      else if (a === 'bottom') style.justifyContent = 'end';
    }

    // Add onClick from events
    const evStr = events.map(e => ` ${e.name}={${convertSwiftClosure(e.handler, props)}}`).join('');

    const styleStr = formatStyle(style);
    const hasKids = node.children.length > 0;

    if (comp === 'ScrollView') {
      components.add('ScrollView');
      const scrollStyle = { ...style };
      if (!scrollStyle.height && !scrollStyle.flexGrow) scrollStyle.flexGrow = 1;
      out.push(`${ind(depth)}<ScrollView${formatStyle(scrollStyle)}${evStr}>`);
      if (hasKids) out.push(...generateViewTree(node.children, depth + 1, components, warnings, props));
      out.push(`${ind(depth)}</ScrollView>`);
    } else if (mapping.section) {
      // Section with optional header
      const header = extractStringArg(node.args);
      if (header) {
        components.add('Text');
        out.push(`${ind(depth)}<Text style={{ fontSize: 13, fontWeight: '600', color: '#888', paddingLeft: 16, paddingTop: 16, paddingBottom: 4 }}>${header}</Text>`);
      }
      out.push(`${ind(depth)}<Box${styleStr}${evStr}>`);
      if (hasKids) out.push(...generateViewTree(node.children, depth + 1, components, warnings, props));
      out.push(`${ind(depth)}</Box>`);
    } else {
      out.push(`${ind(depth)}<${comp}${styleStr}${evStr}${hasKids ? '>' : ' />'}`);
      if (hasKids) {
        out.push(...generateViewTree(node.children, depth + 1, components, warnings, props));
        out.push(`${ind(depth)}</${comp}>`);
      }
    }
  }

  return out;
}


/**
 * Generate JSX for if/else conditional blocks.
 */
function generateIfNode(node, depth, components, warnings, props) {
  const out = [];
  const ind = (d) => '  '.repeat(d);
  const cond = convertSwiftExpr(node.condition, props);

  if (node.elseChildren.length > 0) {
    out.push(`${ind(depth)}{${cond} ? (`);
    out.push(...generateViewTree(node.children, depth + 1, components, warnings, props));
    out.push(`${ind(depth)}) : (`);
    if (node.elseChildren.length === 1 && node.elseChildren[0].type === '_if') {
      // else if chain
      out.push(...generateIfNode(node.elseChildren[0], depth + 1, components, warnings, props));
    } else {
      out.push(...generateViewTree(node.elseChildren, depth + 1, components, warnings, props));
    }
    out.push(`${ind(depth)})}`);
  } else {
    out.push(`${ind(depth)}{${cond} && (`);
    out.push(...generateViewTree(node.children, depth + 1, components, warnings, props));
    out.push(`${ind(depth)})}`);
  }

  return out;
}


/**
 * Collect all side effects from a view tree (recursive).
 */
function collectSideEffects(nodes) {
  const effects = [];
  for (const node of nodes) {
    if (node.modifiers) {
      const { sideEffects } = convertModifiers(node.modifiers);
      effects.push(...sideEffects);
    }
    if (node.children) effects.push(...collectSideEffects(node.children));
    if (node.elseChildren) effects.push(...collectSideEffects(node.elseChildren));
  }
  return effects;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SWIFT → JS HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function swiftTypeToTS(swiftType) {
  if (!swiftType) return null;
  const t = swiftType.trim();
  if (t === 'String') return 'string';
  if (t === 'Int' || t === 'Double' || t === 'Float' || t === 'CGFloat') return 'number';
  if (t === 'Bool') return 'boolean';
  if (t === 'Void') return 'void';
  if (t.startsWith('[') && t.endsWith(']')) return `${swiftTypeToTS(t.slice(1, -1))}[]`;
  if (t.endsWith('?')) return `${swiftTypeToTS(t.slice(0, -1))} | null`;
  // Function types: (Args) -> Return or () -> Void
  const funcMatch = t.match(/^\(([^)]*)\)\s*->\s*(.+)$/);
  if (funcMatch) {
    const args = funcMatch[1].trim();
    const ret = swiftTypeToTS(funcMatch[2].trim());
    if (!args) return `() => ${ret}`;
    const tsArgs = args.split(',').map((a, i) => {
      const parts = a.trim().split(':');
      if (parts.length === 2) return `${parts[0].trim()}: ${swiftTypeToTS(parts[1].trim())}`;
      return `arg${i}: ${swiftTypeToTS(parts[0].trim())}`;
    }).join(', ');
    return `(${tsArgs}) => ${ret}`;
  }
  return t; // pass through custom types
}

function swiftValueToJS(val, type) {
  if (!val) {
    // Provide sensible defaults by type
    if (!type) return "''";
    const t = type.trim();
    if (t === 'String') return "''";
    if (t === 'Bool') return 'false';
    if (t === 'Int' || t === 'Double' || t === 'Float') return '0';
    if (t.startsWith('[')) return '[]';
    return 'null';
  }
  let v = val.trim();
  // Swift booleans
  if (v === 'true' || v === 'false') return v;
  // Swift nil
  v = v.replace(/\bnil\b/g, 'null');
  // String
  if (v.startsWith('"') && v.endsWith('"')) return `'${v.slice(1, -1)}'`;
  // Array literal
  if (v.startsWith('[')) {
    // Replace struct initializers with object literals
    v = v.replace(/(\w+)\(([^)]*)\)/g, (_, name, args) => {
      const pairs = args.split(',').map(a => {
        const m = a.trim().match(/^(\w+)\s*:\s*(.+)$/);
        if (m) return `${m[1]}: ${swiftValueToJS(m[2].trim())}`;
        return a.trim();
      });
      return `{ ${pairs.join(', ')} }`;
    });
    return v;
  }
  // Number
  if (/^-?\d+(\.\d+)?$/.test(v)) return v;
  // Pass through
  return v;
}

function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function convertSwiftArgs(args) {
  if (!args) return '';
  // Parse each parameter: "label name: Type = default" → "name"
  return args.split(',').map(param => {
    const p = param.trim();
    // "_ name: Type" or "label name: Type" or "name: Type"
    const m = p.match(/^(?:_\s+)?(?:\w+\s+)?(\w+)\s*:\s*/);
    if (m) return m[1];
    // Bare name
    return p.replace(/\s*:.*$/, '').replace(/\s*=.*$/, '').trim();
  }).filter(Boolean).join(', ');
}

function convertSwiftLine(line, props) {
  if (!line) return '';
  let l = line.trim();

  // Skip empty/comments
  if (!l || l.startsWith('//')) return l;

  // guard let x = y else { return }
  l = l.replace(/guard\s+let\s+(\w+)\s*=\s*(.+?)\s+else\s*\{.*\}/, 'if (!$2) return; const $1 = $2;');

  // if let x = optional { → if (optional != null) {
  l = l.replace(/if\s+let\s+(\w+)\s*=\s*(.+?)\s*\{/, 'if ($2 != null) {');

  // String interpolation: \(expr) → ${expr}
  l = l.replace(/\\\(([^)]+)\)/g, '${$1}');

  // Swift method conversions (before state assignment detection, so patterns are ready)

  // .toggle() → setter
  l = l.replace(/(\w+)\.toggle\(\)/g, (_, name) => `set${capitalize(name)}(prev => !prev)`);

  // .append() → .push()
  l = l.replace(/\.append\(/g, '.push(');

  // .removeAll(where:) → filter
  l = l.replace(/(\w+)\.removeAll\(where:\s*\{([^}]+)\}\)/g, (_, arr, pred) => {
    const jsPred = pred.replace(/\$0/g, 'x');
    return `${arr} = ${arr}.filter(x => !(${jsPred}))`;
  });

  // .remove(atOffsets:) → splice pattern
  l = l.replace(/(\w+)\.remove\(atOffsets:\s*(\w+)\)/g, '/* TODO: $1.remove(atOffsets: $2) */');

  // .count → .length
  l = l.replace(/\.count\b/g, '.length');

  // .capitalized → JS capitalize helper
  l = l.replace(/(\w+)\.capitalized\b/g, '$1.charAt(0).toUpperCase() + $1.slice(1)');

  // $binding → binding (for reads), set binding for writes
  if (props) {
    for (const p of props) {
      if (p.wrapper === 'State') {
        // assignment: stateVar = value → setter
        const assignRe = new RegExp(`\\b${p.name}\\s*=\\s*(.+?)(?:;|$)`);
        const assignMatch = l.match(assignRe);
        if (assignMatch && !l.includes('let ') && !l.includes('var ') && !l.includes('==')) {
          l = l.replace(assignRe, `set${capitalize(p.name)}($1)`);
        }
        // $binding read → just the name
        l = l.replace(new RegExp(`\\$${p.name}\\b`, 'g'), p.name);
      }
    }
  }

  // !x.isEmpty → x.length > 0 (before general .isEmpty)
  l = l.replace(/!(\w+(?:\.\w+)*)\.isEmpty\b/g, '$1.length > 0');
  // .isEmpty → .length === 0
  l = l.replace(/\.isEmpty\b/g, '.length === 0');

  // print() → console.log()
  l = l.replace(/\bprint\(/g, 'console.log(');

  // nil → null
  l = l.replace(/\bnil\b/g, 'null');

  // Swift if without parens → JS if with parens
  // Match "if condition {" but not "if (condition) {" (already has parens)
  l = l.replace(/^if\s+(?!\()(.+?)\s*\{/, 'if ($1) {');

  // Add semicolon if missing
  if (l && !l.endsWith('{') && !l.endsWith('}') && !l.endsWith(';') && !l.startsWith('//')) {
    l += ';';
  }

  return l;
}

function convertSwiftExpr(expr, props) {
  if (!expr) return 'true';
  let e = expr.trim();

  // !searchQuery.isEmpty → searchQuery.length > 0
  e = e.replace(/!(\w+)\.isEmpty/g, '$1.length > 0');
  e = e.replace(/(\w+)\.isEmpty/g, '$1.length === 0');

  // String interpolation
  e = e.replace(/\\\(([^)]+)\)/g, '${$1}');

  // $binding → name
  e = e.replace(/\$(\w+)/g, '$1');

  // .count → .length
  e = e.replace(/\.count\b/g, '.length');

  // nil → null
  e = e.replace(/\bnil\b/g, 'null');

  return e;
}

function convertSwiftClosure(body, props) {
  if (!body) return '() => {}';
  const trimmed = body.trim();

  // Single expression: { expr }
  if (!trimmed.includes('\n') && !trimmed.includes(';')) {
    return `() => { ${convertSwiftLine(trimmed, props)} }`;
  }

  // Multi-line
  const lines = trimmed.split('\n').map(l => convertSwiftLine(l.trim(), props)).filter(Boolean);
  return `() => {\n    ${lines.join('\n    ')}\n  }`;
}

function resolveTextContent(args) {
  if (!args) return '';
  const trimmed = args.trim();

  // "literal string"
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    let inner = trimmed.slice(1, -1);
    // Convert string interpolation \(expr) → ${expr}
    inner = inner.replace(/\\\(([^)]+)\)/g, '${$1}');
    if (inner.includes('${')) return `{\`${inner}\`}`;
    return inner;
  }

  // verbatim: String(localized:) etc — just pass through
  if (/^verbatim\s*:/.test(trimmed)) return trimmed.replace(/^verbatim\s*:\s*/, '');

  // Variable reference — convert Swift method calls
  let jsExpr = trimmed;
  jsExpr = jsExpr.replace(/(\w+)\.capitalized\b/g, '$1.charAt(0).toUpperCase() + $1.slice(1)');
  jsExpr = jsExpr.replace(/\.count\b/g, '.length');
  jsExpr = jsExpr.replace(/\.isEmpty\b/g, '.length === 0');
  return `{${jsExpr}}`;
}

function resolveImageSource(args) {
  if (!args) return { name: null, systemName: null };
  // Direct systemName: "icon"
  const sysMatch = args.match(/systemName\s*:\s*"([^"]+)"/);
  if (sysMatch) return { name: null, systemName: sysMatch[1] };
  // Ternary with systemName: condition ? "icon1" : "icon2" — still a system name
  const sysTernary = args.match(/systemName\s*:\s*(.+)/);
  if (sysTernary) return { name: null, systemName: sysTernary[1].trim() };
  const nameMatch = args.match(/"([^"]+)"/);
  return { name: nameMatch?.[1] || null, systemName: null };
}

function resolveButtonAction(args, children, props) {
  if (!args) return '() => {}';

  // Simple: Button(action: doSomething) — bare function reference
  const simpleAction = args.match(/action\s*:\s*(\w+)\s*$/);
  if (simpleAction) return simpleAction[1];

  // Button(action: { closure }) { label } pattern
  const actionMatch = args.match(/action\s*:\s*\{?\s*(.+?)\s*\}?\s*$/s);
  if (actionMatch) {
    const content = actionMatch[1].trim();
    // If it's just a function name, call it
    if (/^\w+$/.test(content)) return `() => { ${content}(); }`;
    return convertSwiftClosure(content, props);
  }

  // Button("label") { action } — action is in the trailing closure (children)
  const closureMatch = args.match(/^\s*\{(.+)\}\s*$/s);
  if (closureMatch) return convertSwiftClosure(closureMatch[1], props);

  return `() => { ${convertSwiftLine(args, props)} }`;
}

function resolveTextFieldArgs(args) {
  const placeholder = extractStringArg(args) || '';
  const bindingMatch = args.match(/text\s*:\s*\$(\w+)/);
  return { placeholder, binding: bindingMatch?.[1] || null };
}

function resolveToggleArgs(args) {
  const label = extractStringArg(args) || '';
  const bindingMatch = args.match(/isOn\s*:\s*\$(\w+)/);
  return { label, binding: bindingMatch?.[1] || null };
}

function resolveForEachArgs(args, childrenSource) {
  // ForEach(items) { item in ... } or ForEach(items, id: \.self) { item in ... }
  let collection = args.replace(/,\s*id\s*:.*$/, '').trim();

  // Try to extract the closure parameter name from the children source
  // The trailing closure body starts with "varName in\n" or "varName, index in\n"
  let itemVar = 'item';
  // Not available here directly, but parseViewBody skips the "word in" line
  // We'll default to 'item' and enhance later if needed

  return { collection, itemVar };
}

function extractStringArg(args) {
  if (!args) return null;
  const match = args.match(/"([^"]+)"/);
  return match?.[1] || null;
}


/** Format a style object as a plain JS object literal string */
function formatStyleObj(style) {
  const entries = Object.entries(style).filter(([k]) => !k.startsWith('_'));
  if (entries.length === 0) return '{}';
  const parts = entries.map(([k, v]) => {
    if (typeof v === 'number') return `${k}: ${v}`;
    if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) return `${k}: ${Number(v)}`;
    if (typeof v === 'string') return `${k}: '${v}'`;
    return `${k}: ${v}`;
  });
  return `{ ${parts.join(', ')} }`;
}

/** Format a style object as a JSX style attribute */
function formatStyle(style) {
  const entries = Object.entries(style).filter(([k]) => !k.startsWith('_'));
  if (entries.length === 0) return '';

  const parts = entries.map(([k, v]) => {
    if (typeof v === 'number') return `${k}: ${v}`;
    if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) return `${k}: ${Number(v)}`;
    if (typeof v === 'string') return `${k}: '${v}'`;
    return `${k}: ${v}`;
  });

  if (parts.length <= 3) return ` style={{ ${parts.join(', ')} }}`;
  return ` style={{\n    ${parts.join(',\n    ')}\n  }}`;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLI ENTRY POINT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function migrateSwiftUICommand(args) {
  const helpMode = args.includes('--help') || args.includes('-h');
  const dryRun = args.includes('--dry-run');
  const outputIdx = args.indexOf('--output');
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;
  const scaffoldIdx = args.indexOf('--scaffold');
  const scaffoldName = (scaffoldIdx !== -1 && args[scaffoldIdx + 1] && !args[scaffoldIdx + 1].startsWith('-'))
    ? args[scaffoldIdx + 1] : null;
  const scaffoldMode = scaffoldIdx !== -1;

  if (scaffoldMode && outputFile) {
    console.error('Cannot use --scaffold and --output together.');
    process.exit(1);
  }

  if (helpMode) {
    console.log(`
  rjit migrate-swiftui — Convert SwiftUI apps to ReactJIT

  Usage:
    rjit migrate-swiftui <file.swift>                           Convert and print to stdout
    rjit migrate-swiftui <file.swift> --output out.tsx           Write to file
    rjit migrate-swiftui <file.swift> --scaffold [name]          Convert + create a new project
    rjit migrate-swiftui <file.swift> --dry-run                  Show analysis only

  What it converts:
    Views:      VStack→Box(column), HStack→Box(row), Text→Text, Button→Pressable,
                TextField→TextInput, Image→Image, List→ScrollView, Toggle→Pressable
    Modifiers:  .padding→padding, .frame→width/height, .font→fontSize,
                .foregroundColor→color, .background→backgroundColor, .cornerRadius→borderRadius
    State:      @State→useState, @Binding→props, @Environment→hooks
    Control:    if/else→ternary, ForEach→.map(), .sheet→Modal
    Functions:  Swift→JavaScript (best-effort, needs review)
`);
    return;
  }

  const fileArg = args.find(a => !a.startsWith('-') && a !== outputFile && a !== scaffoldName);
  if (!fileArg) {
    console.error('No input file specified. Use --help for usage.');
    process.exit(1);
  }

  let input;
  try {
    input = readFileSync(fileArg, 'utf-8');
  } catch (err) {
    console.error(`Error reading file: ${fileArg}`);
    process.exit(1);
  }

  const parsed = parseSwiftUISource(input);

  if (dryRun) {
    console.log(`\n  Analysis of ${fileArg}:\n`);
    console.log(`  Structs: ${parsed.structs.length}`);
    for (const s of parsed.structs) {
      const viewStr = s.isView ? ' (View)' : '';
      console.log(`    ${s.name}: ${s.conformances.join(', ')}${viewStr}`);
      console.log(`      Properties: ${s.properties.length}`);
      for (const p of s.properties) {
        console.log(`        @${p.wrapper} ${p.name}: ${p.type || '?'}${p.defaultValue ? ' = ' + p.defaultValue.slice(0, 40) : ''}`);
      }
      console.log(`      Functions: ${s.functions.length}`);
      for (const f of s.functions) {
        console.log(`        ${f.name}(${f.args})${f.returnType ? ' -> ' + f.returnType : ''}`);
      }
      if (s.bodySource) {
        const tree = parseViewBody(s.bodySource);
        console.log(`      View tree: ${countNodes(tree)} nodes`);
        printTree(tree, '        ');
      }
    }
    if (parsed.appEntry) {
      console.log(`\n  App entry: ${parsed.appEntry.name}`);
    }
    if (parsed.warnings.length > 0) {
      console.log(`\n  Warnings:`);
      for (const w of parsed.warnings) console.log(`    ${w}`);
    }
    console.log('');
    return;
  }

  const result = generateReactJIT(parsed);

  if (scaffoldMode) {
    const projectName = scaffoldName || deriveProjectName(fileArg);
    const dest = join(process.cwd(), projectName);
    scaffoldProject(dest, { name: projectName, appTsx: result.code });
    console.log(`  ${result.stats.views} views, ${result.stats.stateVars} state vars, ${result.stats.functions} functions`);
    console.log(`  Components: ${result.components.join(', ')}`);
    if (result.warnings.length > 0) {
      console.log(`  ${result.warnings.length} warning(s):`);
      for (const w of result.warnings.slice(0, 20)) console.log(`    ${w}`);
      if (result.warnings.length > 20) console.log(`    ... and ${result.warnings.length - 20} more`);
    }
    console.log(`\n  Next steps:\n    cd ${projectName}\n    reactjit dev`);
    return;
  }

  if (outputFile) {
    writeFileSync(outputFile, result.code, 'utf-8');
    console.log(`  Converted ${fileArg} → ${outputFile}`);
    console.log(`  ${result.stats.views} views, ${result.stats.stateVars} state vars, ${result.stats.functions} functions`);
    console.log(`  Components: ${result.components.join(', ')}`);
    if (result.warnings.length > 0) {
      console.log(`  ${result.warnings.length} warning(s):`);
      for (const w of result.warnings.slice(0, 20)) console.log(`    ${w}`);
      if (result.warnings.length > 20) console.log(`    ... and ${result.warnings.length - 20} more`);
    }
  } else {
    process.stdout.write(result.code);
    if (process.stderr.isTTY) {
      console.error(`\n--- ${result.stats.views} views | ${result.components.join(', ')} | ${result.warnings.length} warning(s) ---`);
    }
  }
}


function countNodes(nodes) {
  let count = 0;
  for (const n of nodes) {
    count++;
    if (n.children) count += countNodes(n.children);
    if (n.elseChildren) count += countNodes(n.elseChildren);
  }
  return count;
}

function printTree(nodes, prefix) {
  for (const n of nodes) {
    const modStr = n.modifiers?.length ? ` [${n.modifiers.map(m => '.' + m.name).join('')}]` : '';
    const argsStr = n.args ? `(${n.args.slice(0, 40)}${n.args.length > 40 ? '...' : ''})` : '';
    console.log(`${prefix}${n.type}${argsStr}${modStr}`);
    if (n.children?.length) printTree(n.children, prefix + '  ');
    if (n.elseChildren?.length) {
      console.log(`${prefix}else:`);
      printTree(n.elseChildren, prefix + '  ');
    }
  }
}
