/**
 * migrate-flutter.mjs — Flutter/Dart → ReactJIT migration
 *
 * Converts Flutter widget trees to ReactJIT TSX components. Handles:
 *
 *   Widgets:    Container→Box, Column→Box(column), Row→Box(row), Stack→Box(relative),
 *               Text→Text, Image→Image, ElevatedButton→Pressable, TextField→TextInput,
 *               ListView→ScrollView, Scaffold→Box, AppBar→Box(row), Card→Box,
 *               Expanded→Box(grow), SizedBox→Box(sized), Center→Box(centered),
 *               GestureDetector/InkWell→Pressable, Checkbox/Switch→toggle Pressable,
 *               AlertDialog→Modal, Drawer→Box, FloatingActionButton→Pressable
 *
 *   Properties: EdgeInsets→padding/margin, BoxDecoration→bg/border/shadow/radius,
 *               TextStyle→fontSize/fontWeight/color, MainAxisAlignment→justifyContent,
 *               CrossAxisAlignment→alignItems, Colors.*→hex, Color(0x)→hex
 *
 *   State:      StatelessWidget→function, StatefulWidget+State→function+useState,
 *               setState((){}→setters, final fields→props
 *
 *   Dart→JS:    print→console.log, $interp→template literals, .add→.push,
 *               .where→.filter, ??/?.→same, for...in→for...of
 *
 * Usage:
 *   rjit migrate-flutter <file.dart>                    # convert, print to stdout
 *   rjit migrate-flutter <file.dart> --output out.tsx   # write to file
 *   rjit migrate-flutter <file.dart> --scaffold [name]  # convert + create project
 *   rjit migrate-flutter <file.dart> --dry-run          # show analysis only
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveProjectName, capitalize, formatStyleObj, formatStyleAttr } from '../lib/migration-core.mjs';
import { scaffoldProject } from './init.mjs';

/** Strip Dart's leading _ and capitalize for setter names: _counter → Counter */
function setterName(name) {
  const stripped = name.startsWith('_') ? name.slice(1) : name;
  return capitalize(stripped);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WIDGET MAPPING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const WIDGET_MAP = {
  'Container':                { component: 'Box',        type: 'container' },
  'Column':                   { component: 'Box',        dir: 'column' },
  'Row':                      { component: 'Box',        dir: 'row' },
  'Stack':                    { component: 'Box',        dir: 'stack' },
  'Positioned':               { component: 'Box',        positioned: true },
  'Text':                     { component: 'Text',       type: 'text' },
  'RichText':                 { component: 'Text',       type: 'text' },
  'SelectableText':           { component: 'Text',       type: 'text' },
  'ElevatedButton':           { component: 'Pressable',  type: 'button' },
  'TextButton':               { component: 'Pressable',  type: 'button' },
  'OutlinedButton':           { component: 'Pressable',  type: 'button', outlined: true },
  'IconButton':               { component: 'Pressable',  type: 'button' },
  'FloatingActionButton':     { component: 'Pressable',  type: 'fab' },
  'TextField':                { component: 'TextInput',  type: 'input' },
  'TextFormField':            { component: 'TextInput',  type: 'input' },
  'Image':                    { component: 'Image',      type: 'image' },
  'Image.asset':              { component: 'Image',      type: 'image' },
  'Image.network':            { component: 'Image',      type: 'image' },
  'Icon':                     { component: 'Text',       type: 'icon' },
  'ListView':                 { component: 'ScrollView', dir: 'column' },
  'ListView.builder':         { component: 'ScrollView', dir: 'column', builder: true },
  'ListView.separated':       { component: 'ScrollView', dir: 'column', builder: true },
  'GridView':                 { component: 'ScrollView', dir: 'column' },
  'GridView.builder':         { component: 'ScrollView', dir: 'column', builder: true },
  'SingleChildScrollView':    { component: 'ScrollView', dir: 'column' },
  'Scaffold':                 { component: 'Box',        type: 'scaffold' },
  'AppBar':                   { component: 'Box',        type: 'appbar' },
  'Padding':                  { component: 'Box',        type: 'padding' },
  'Center':                   { component: 'Box',        type: 'center' },
  'Align':                    { component: 'Box',        type: 'align' },
  'SizedBox':                 { component: 'Box',        type: 'sizedbox' },
  'ConstrainedBox':           { component: 'Box',        type: 'container' },
  'FractionallySizedBox':     { component: 'Box',        type: 'container' },
  'Expanded':                 { component: 'Box',        type: 'expanded' },
  'Flexible':                 { component: 'Box',        type: 'flexible' },
  'Spacer':                   { component: 'Box',        type: 'spacer' },
  'Divider':                  { component: 'Box',        type: 'divider' },
  'Card':                     { component: 'Box',        type: 'card' },
  'Material':                 { component: 'Box',        type: 'container' },
  'Wrap':                     { component: 'Box',        type: 'wrap' },
  'GestureDetector':          { component: 'Pressable',  type: 'gesture' },
  'InkWell':                  { component: 'Pressable',  type: 'gesture' },
  'InkResponse':              { component: 'Pressable',  type: 'gesture' },
  'Checkbox':                 { component: 'Pressable',  type: 'checkbox' },
  'Switch':                   { component: 'Pressable',  type: 'switch' },
  'Radio':                    { component: 'Pressable',  type: 'radio' },
  'Slider':                   { component: 'Box',        type: 'slider' },
  'AlertDialog':              { component: 'Modal',      type: 'dialog' },
  'SimpleDialog':             { component: 'Modal',      type: 'dialog' },
  'Dialog':                   { component: 'Modal',      type: 'dialog' },
  'BottomSheet':              { component: 'Modal',      type: 'dialog' },
  'Drawer':                   { component: 'Box',        type: 'drawer' },
  'TabBar':                   { component: 'Box',        type: 'tabbar' },
  'TabBarView':               { component: 'Box',        type: 'tabbody' },
  'BottomNavigationBar':      { component: 'Box',        type: 'bottomnav' },
  'NavigationBar':            { component: 'Box',        type: 'bottomnav' },
  'CircularProgressIndicator':{ component: 'Box',        type: 'progress' },
  'LinearProgressIndicator':  { component: 'Box',        type: 'progressbar' },
  'Opacity':                  { component: 'Box',        type: 'opacity' },
  'ClipRRect':                { component: 'Box',        type: 'cliprrect' },
  'ClipOval':                 { component: 'Box',        type: 'clipoval' },
  'ListTile':                 { component: 'Pressable',  type: 'listtile' },
  'Form':                     { component: 'Box',        dir: 'column' },
  'SafeArea':                 { component: null,         passthrough: true },
  'MediaQuery':               { component: null,         passthrough: true },
  'Theme':                    { component: null,         passthrough: true },
  'Builder':                  { component: null,         passthrough: true },
  'LayoutBuilder':            { component: null,         passthrough: true },
  'StreamBuilder':            { component: null,         passthrough: true },
  'FutureBuilder':            { component: null,         passthrough: true },
  'ValueListenableBuilder':   { component: null,         passthrough: true },
  'AnimatedBuilder':          { component: null,         passthrough: true },
  'Tooltip':                  { component: null,         passthrough: true },
  'Semantics':                { component: null,         passthrough: true },
  'Hero':                     { component: null,         passthrough: true },
  'PopScope':                 { component: null,         passthrough: true },
  'WillPopScope':             { component: null,         passthrough: true },
  'NotificationListener':     { component: null,         passthrough: true },
  'RepaintBoundary':          { component: null,         passthrough: true },
  'SliverToBoxAdapter':       { component: null,         passthrough: true },
  'SliverList':               { component: 'ScrollView', dir: 'column' },
  'CustomScrollView':         { component: 'ScrollView', dir: 'column' },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MATERIAL COLORS → HEX
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DART_COLORS = {
  'red':          '#F44336', 'redAccent':     '#FF5252',
  'pink':         '#E91E63', 'pinkAccent':    '#FF4081',
  'purple':       '#9C27B0', 'purpleAccent':  '#E040FB',
  'deepPurple':   '#673AB7', 'deepPurpleAccent':'#7C4DFF',
  'indigo':       '#3F51B5', 'indigoAccent':  '#536DFE',
  'blue':         '#2196F3', 'blueAccent':    '#448AFF',
  'lightBlue':    '#03A9F4', 'lightBlueAccent':'#40C4FF',
  'cyan':         '#00BCD4', 'cyanAccent':    '#18FFFF',
  'teal':         '#009688', 'tealAccent':    '#64FFDA',
  'green':        '#4CAF50', 'greenAccent':   '#69F0AE',
  'lightGreen':   '#8BC34A', 'lightGreenAccent':'#B2FF59',
  'lime':         '#CDDC39', 'limeAccent':    '#EEFF41',
  'yellow':       '#FFEB3B', 'yellowAccent':  '#FFFF00',
  'amber':        '#FFC107', 'amberAccent':   '#FFD740',
  'orange':       '#FF9800', 'orangeAccent':  '#FFAB40',
  'deepOrange':   '#FF5722', 'deepOrangeAccent':'#FF6E40',
  'brown':        '#795548',
  'grey':         '#9E9E9E', 'blueGrey':      '#607D8B',
  'black':        '#000000', 'black87':       'rgba(0,0,0,0.87)',
  'black54':      'rgba(0,0,0,0.54)', 'black45': 'rgba(0,0,0,0.45)',
  'black38':      'rgba(0,0,0,0.38)', 'black26': 'rgba(0,0,0,0.26)',
  'black12':      'rgba(0,0,0,0.12)',
  'white':        '#FFFFFF', 'white70':       'rgba(255,255,255,0.7)',
  'white60':      'rgba(255,255,255,0.6)', 'white54': 'rgba(255,255,255,0.54)',
  'white38':      'rgba(255,255,255,0.38)', 'white30': 'rgba(255,255,255,0.3)',
  'white24':      'rgba(255,255,255,0.24)', 'white12': 'rgba(255,255,255,0.12)',
  'white10':      'rgba(255,255,255,0.1)',
  'transparent':  'transparent',
};

// Shade variants: Colors.blue[700] → #1976D2
const COLOR_SHADES = {
  'red':    { 50:'#FFEBEE',100:'#FFCDD2',200:'#EF9A9A',300:'#E57373',400:'#EF5350',500:'#F44336',600:'#E53935',700:'#D32F2F',800:'#C62828',900:'#B71C1C' },
  'blue':   { 50:'#E3F2FD',100:'#BBDEFB',200:'#90CAF9',300:'#64B5F6',400:'#42A5F5',500:'#2196F3',600:'#1E88E5',700:'#1976D2',800:'#1565C0',900:'#0D47A1' },
  'green':  { 50:'#E8F5E9',100:'#C8E6C9',200:'#A5D6A7',300:'#81C784',400:'#66BB6A',500:'#4CAF50',600:'#43A047',700:'#388E3C',800:'#2E7D32',900:'#1B5E20' },
  'grey':   { 50:'#FAFAFA',100:'#F5F5F5',200:'#EEEEEE',300:'#E0E0E0',400:'#BDBDBD',500:'#9E9E9E',600:'#757575',700:'#616161',800:'#424242',900:'#212121' },
  'orange': { 50:'#FFF3E0',100:'#FFE0B2',200:'#FFCC80',300:'#FFB74D',400:'#FFA726',500:'#FF9800',600:'#FB8C00',700:'#F57C00',800:'#EF6C00',900:'#E65100' },
  'purple': { 50:'#F3E5F5',100:'#E1BEE7',200:'#CE93D8',300:'#BA68C8',400:'#AB47BC',500:'#9C27B0',600:'#8E24AA',700:'#7B1FA2',800:'#6A1B9A',900:'#4A148C' },
  'amber':  { 50:'#FFF8E1',100:'#FFECB3',200:'#FFE082',300:'#FFD54F',400:'#FFCA28',500:'#FFC107',600:'#FFB300',700:'#FFA000',800:'#FF8F00',900:'#FF6F00' },
  'yellow': { 50:'#FFFDE7',100:'#FFF9C4',200:'#FFF59D',300:'#FFF176',400:'#FFEE58',500:'#FFEB3B',600:'#FDD835',700:'#FBC02D',800:'#F9A825',900:'#F57F17' },
  'teal':   { 50:'#E0F2F1',100:'#B2DFDB',200:'#80CBC4',300:'#4DB6AC',400:'#26A69A',500:'#009688',600:'#00897B',700:'#00796B',800:'#00695C',900:'#004D40' },
  'pink':   { 50:'#FCE4EC',100:'#F8BBD0',200:'#F48FB1',300:'#F06292',400:'#EC407A',500:'#E91E63',600:'#D81B60',700:'#C2185B',800:'#AD1457',900:'#880E4F' },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FONT WEIGHT MAP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const FONT_WEIGHT_MAP = {
  'FontWeight.w100': '100', 'FontWeight.w200': '200', 'FontWeight.w300': '300',
  'FontWeight.w400': '400', 'FontWeight.w500': '500', 'FontWeight.w600': '600',
  'FontWeight.w700': '700', 'FontWeight.w800': '800', 'FontWeight.w900': '900',
  'FontWeight.bold': 'bold', 'FontWeight.normal': '400',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DART SOURCE PARSER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Extract a brace-matched block starting at `start` (which should be `{`).
 */
function extractBlock(source, start) {
  if (source[start] !== '{') return null;
  let depth = 0, inStr = null, i = start;
  while (i < source.length) {
    const ch = source[i];
    if (inStr) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === inStr) inStr = null;
      i++; continue;
    }
    if (ch === "'" || ch === '"') { inStr = ch; i++; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return { content: source.slice(start + 1, i), end: i + 1 }; }
    i++;
  }
  return { content: source.slice(start + 1), end: source.length };
}

/**
 * Extract paren-matched content starting at `start`.
 */
function extractParens(source, start) {
  if (source[start] !== '(') return null;
  let depth = 0, inStr = null, i = start;
  while (i < source.length) {
    const ch = source[i];
    if (inStr) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === inStr) inStr = null;
      i++; continue;
    }
    if (ch === "'" || ch === '"') { inStr = ch; i++; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth === 0) return { content: source.slice(start + 1, i), end: i + 1 }; }
    i++;
  }
  return { content: source.slice(start + 1), end: source.length };
}

/**
 * Extract bracket-matched content starting at `start`.
 */
function extractBrackets(source, start) {
  if (source[start] !== '[') return null;
  let depth = 0, inStr = null, i = start;
  while (i < source.length) {
    const ch = source[i];
    if (inStr) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === inStr) inStr = null;
      i++; continue;
    }
    if (ch === "'" || ch === '"') { inStr = ch; i++; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) return { content: source.slice(start + 1, i), end: i + 1 }; }
    i++;
  }
  return { content: source.slice(start + 1), end: source.length };
}

/**
 * Parse a Flutter/Dart source file into a structured representation.
 */
export function parseFlutterSource(source) {
  const result = {
    classes: [],    // { name, superclass, properties, buildSource, functions, line }
    imports: [],
    warnings: [],
    rawSource: source,
  };

  const lines = source.split('\n');

  // Pass 1: Imports
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('import ')) result.imports.push(trimmed);
  }

  // Pass 2: Class declarations
  const classRegex = /class\s+(\w+)\s+extends\s+(StatelessWidget|StatefulWidget|State<(\w+)>)\s*(?:with\s+[\w,\s]+)?\s*\{/g;
  let match;
  while ((match = classRegex.exec(source)) !== null) {
    const name = match[1];
    const superclass = match[2];
    const stateOf = match[3] || null;
    const blockStart = match.index + match[0].length - 1;
    const block = extractBlock(source, blockStart);
    if (!block) continue;

    const lineNum = source.slice(0, match.index).split('\n').length;
    const properties = parseClassProperties(block.content);
    const buildSource = extractBuildMethod(block.content);
    const functions = extractMethods(block.content);
    const initState = extractInitState(block.content);

    result.classes.push({
      name, superclass, stateOf, properties, buildSource, functions, initState, line: lineNum,
    });
  }

  return result;
}

/**
 * Extract field declarations from a class body.
 */
function parseClassProperties(body) {
  const props = [];
  const lines = body.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // final Type name; or final Type? name;
    const finalMatch = line.match(/^(?:final\s+)?(\w+[\w<>,?\s]*?)\s+(\w+)\s*;$/);
    if (finalMatch && !['return', 'var', 'const', 'if', 'else', 'for', 'while', 'switch'].includes(finalMatch[1])) {
      props.push({ modifier: 'final', type: finalMatch[1].trim(), name: finalMatch[2], line: i });
      continue;
    }

    // Type name = value;
    const assignMatch = line.match(/^(?:(final|late|static)\s+)?(\w+[\w<>,?\s]*?)\s+(\w+)\s*=\s*(.+?)\s*;$/);
    if (assignMatch && !['return', 'var', 'const', 'if', 'else', 'for', 'while'].includes(assignMatch[2])) {
      props.push({
        modifier: assignMatch[1] || 'var',
        type: assignMatch[2].trim(),
        name: assignMatch[3],
        defaultValue: assignMatch[4].trim(),
        line: i,
      });
      continue;
    }

    // Constructor-assigned: const ClassName({required this.title, this.onTap});
    // We handle these when building the component
  }

  return props;
}

/**
 * Extract the build() method body.
 */
function extractBuildMethod(classBody) {
  // Match: Widget build(BuildContext context) {
  // Also: @override\n  Widget build(...)
  const buildIdx = classBody.search(/Widget\s+build\s*\(\s*BuildContext\s+\w+\s*\)\s*\{/);
  if (buildIdx === -1) return null;

  let i = buildIdx;
  while (i < classBody.length && classBody[i] !== '{') i++;
  if (i >= classBody.length) return null;

  const block = extractBlock(classBody, i);
  return block ? block.content : null;
}

/**
 * Extract initState() body.
 */
function extractInitState(classBody) {
  const idx = classBody.search(/void\s+initState\s*\(\s*\)\s*\{/);
  if (idx === -1) return null;
  let i = idx;
  while (i < classBody.length && classBody[i] !== '{') i++;
  const block = extractBlock(classBody, i);
  return block ? block.content.replace(/super\.initState\(\)\s*;?\s*/g, '').trim() : null;
}

/**
 * Extract method declarations from a class body.
 */
function extractMethods(classBody) {
  const methods = [];
  const methodRegex = /(?:void|String|int|double|bool|dynamic|Future<\w+>|Widget|List<\w+>)\s+(\w+)\s*\(([^)]*)\)\s*(?:async\s*)?\{/g;
  let m;
  while ((m = methodRegex.exec(classBody)) !== null) {
    if (['build', 'initState', 'dispose', 'didUpdateWidget', 'didChangeDependencies'].includes(m[1])) continue;
    const bracePos = m.index + m[0].length - 1;
    const block = extractBlock(classBody, bracePos);
    if (!block) continue;
    methods.push({ name: m[1], args: m[2], body: block.content.trim() });
  }
  return methods;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WIDGET TREE PARSER (recursive descent on Dart expressions)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parse a build() method body into a tree of widget nodes.
 * Finds the return statement and parses the widget expression.
 */
function parseWidgetBody(source) {
  const src = source.trim();
  // Find the return statement
  const returnIdx = src.search(/\breturn\s/);
  if (returnIdx === -1) return [];

  const afterReturn = src.slice(returnIdx + 7).trim();
  const node = parseWidgetExpr(afterReturn, 0);
  return node ? [node] : [];
}

/**
 * Parse a single widget expression: WidgetName(args) or WidgetName.method(args)
 */
function parseWidgetExpr(src, start) {
  let pos = start;

  // Skip whitespace
  while (pos < src.length && /\s/.test(src[pos])) pos++;
  if (pos >= src.length) return null;

  // Skip line comments
  if (src[pos] === '/' && src[pos + 1] === '/') {
    while (pos < src.length && src[pos] !== '\n') pos++;
    return parseWidgetExpr(src, pos);
  }

  // Conditional expression: condition ? widget1 : widget2
  // We need to detect if this is a ternary — but it's complex.
  // For now, just parse widget calls.

  // Read identifier (WidgetName or WidgetName.constructor)
  let ident = '';
  while (pos < src.length && /[\w.]/.test(src[pos])) {
    ident += src[pos]; pos++;
  }
  if (!ident) return null;

  // Skip whitespace
  while (pos < src.length && /\s/.test(src[pos])) pos++;

  // Must have ( for constructor call
  if (pos >= src.length || src[pos] !== '(') return null;

  const parens = extractParens(src, pos);
  if (!parens) return null;

  pos = parens.end;

  // Parse the named arguments inside the constructor
  const { namedArgs, positionalArgs, children } = parseConstructorArgs(parens.content);

  // Skip trailing comma, semicolon, whitespace
  while (pos < src.length && /[\s,;]/.test(src[pos])) pos++;

  return {
    type: ident,
    namedArgs,
    positionalArgs,
    children,
    _endPos: pos,
  };
}

/**
 * Parse constructor arguments into named args, positional args, and child/children.
 * Flutter uses: WidgetName(key: value, child: OtherWidget(...))
 */
function parseConstructorArgs(argsStr) {
  const namedArgs = {};
  const positionalArgs = [];
  let children = [];

  const args = splitArgs(argsStr);

  for (const arg of args) {
    const trimmed = arg.trim();
    if (!trimmed) continue;

    // Named argument: key: value
    const colonIdx = findNamedArgColon(trimmed);
    if (colonIdx !== -1) {
      const key = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();

      if (key === 'child') {
        const childNode = parseWidgetExpr(value, 0);
        if (childNode) children = [childNode];
        else namedArgs[key] = value;
      } else if (key === 'children') {
        children = parseChildrenList(value);
      } else if (key === 'body') {
        // Scaffold body
        const childNode = parseWidgetExpr(value, 0);
        if (childNode) children = [childNode];
        else namedArgs[key] = value;
      } else {
        namedArgs[key] = value;
      }
    } else {
      // Positional argument (e.g., the string in Text('hello'))
      positionalArgs.push(trimmed);
    }
  }

  return { namedArgs, positionalArgs, children };
}

/**
 * Find the colon position for a named argument, ignoring colons inside
 * strings, parens, brackets, and ternary expressions.
 */
function findNamedArgColon(str) {
  // Must start with a simple identifier before the colon
  const identMatch = str.match(/^(\w+)\s*:/);
  if (!identMatch) return -1;
  return identMatch[1].length;
}

/**
 * Split comma-separated arguments, respecting nesting.
 */
function splitArgs(str) {
  const args = [];
  let depth = 0, bracketDepth = 0, braceDepth = 0;
  let inStr = null;
  let current = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (inStr) {
      current += ch;
      if (ch === '\\') { current += str[++i] || ''; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }

    if (ch === "'" || ch === '"') { inStr = ch; current += ch; continue; }
    if (ch === '(') { depth++; current += ch; continue; }
    if (ch === ')') { depth--; current += ch; continue; }
    if (ch === '[') { bracketDepth++; current += ch; continue; }
    if (ch === ']') { bracketDepth--; current += ch; continue; }
    if (ch === '{') { braceDepth++; current += ch; continue; }
    if (ch === '}') { braceDepth--; current += ch; continue; }

    if (ch === ',' && depth === 0 && bracketDepth === 0 && braceDepth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim()) args.push(current.trim());
  return args;
}

/**
 * Parse a children: [...] list into widget nodes.
 */
function parseChildrenList(value) {
  const trimmed = value.trim();
  const nodes = [];

  // Remove outer brackets
  let content = trimmed;
  if (content.startsWith('[') && content.endsWith(']')) {
    content = content.slice(1, -1).trim();
  } else if (content.startsWith('<Widget>[')) {
    const bracketStart = content.indexOf('[');
    content = content.slice(bracketStart + 1, -1).trim();
  }

  // Split by top-level commas and parse each as a widget
  const items = splitArgs(content);
  for (const item of items) {
    const trimItem = item.trim();
    if (!trimItem) continue;

    // Conditional: if (cond) WidgetName(...)
    const ifMatch = trimItem.match(/^if\s*\((.+?)\)\s*/);
    if (ifMatch) {
      const rest = trimItem.slice(ifMatch[0].length);
      const node = parseWidgetExpr(rest, 0);
      if (node) {
        node._condition = ifMatch[1].trim();
        nodes.push(node);
      }
      continue;
    }

    // Spread: ...widgets
    if (trimItem.startsWith('...')) {
      nodes.push({ type: '_spread', expr: trimItem.slice(3).trim(), _endPos: 0 });
      continue;
    }

    // For: for (var x in y) WidgetName(...)
    const forMatch = trimItem.match(/^for\s*\(\s*(?:var|final)\s+(\w+)\s+in\s+(.+?)\)\s*/);
    if (forMatch) {
      const rest = trimItem.slice(forMatch[0].length);
      const node = parseWidgetExpr(rest, 0);
      if (node) {
        node._forVar = forMatch[1];
        node._forCollection = forMatch[2].trim();
        nodes.push(node);
      }
      continue;
    }

    const node = parseWidgetExpr(trimItem, 0);
    if (node) nodes.push(node);
  }

  return nodes;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROPERTY → STYLE CONVERSION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Resolve a Dart color expression to a hex string.
 */
function resolveColor(expr) {
  if (!expr) return null;
  expr = expr.trim();

  // Colors.blue
  const colorsMatch = expr.match(/^Colors\.(\w+)$/);
  if (colorsMatch) {
    const name = colorsMatch[1];
    if (DART_COLORS[name]) return DART_COLORS[name];
  }

  // Colors.blue[700] or Colors.blue.shade700
  const shadeMatch = expr.match(/^Colors\.(\w+)\[(\d+)\]$/) || expr.match(/^Colors\.(\w+)\.shade(\d+)$/);
  if (shadeMatch) {
    const name = shadeMatch[1];
    const shade = shadeMatch[2];
    if (COLOR_SHADES[name]?.[shade]) return COLOR_SHADES[name][shade];
    if (DART_COLORS[name]) return DART_COLORS[name]; // fallback to base
  }

  // Colors.blue.withOpacity(0.5)
  const withOpacityMatch = expr.match(/^Colors\.(\w+)\.withOpacity\(([\d.]+)\)$/);
  if (withOpacityMatch) {
    const hex = DART_COLORS[withOpacityMatch[1]];
    if (hex && hex.startsWith('#')) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${withOpacityMatch[2]})`;
    }
  }

  // Color(0xFFRRGGBB) or Color(0xAARRGGBB)
  const hexMatch = expr.match(/^(?:const\s+)?Color\(0x([0-9A-Fa-f]{8})\)$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    const a = parseInt(hex.slice(0, 2), 16);
    const rgb = hex.slice(2);
    if (a === 255) return `#${rgb}`;
    return `rgba(${parseInt(rgb.slice(0, 2), 16)},${parseInt(rgb.slice(2, 4), 16)},${parseInt(rgb.slice(4, 6), 16)},${(a / 255).toFixed(2)})`;
  }

  // Theme.of(context).colorScheme.primary etc. — pass through as comment
  if (expr.includes('Theme.of') || expr.includes('colorScheme')) {
    return null; // will generate useThemeColors() comment
  }

  return null;
}

/**
 * Parse EdgeInsets expression into padding/margin style properties.
 */
function parseEdgeInsets(expr) {
  if (!expr) return {};
  expr = expr.trim();

  // EdgeInsets.all(16)
  const allMatch = expr.match(/EdgeInsets\.all\(([\d.]+)\)/);
  if (allMatch) return { padding: parseFloat(allMatch[1]) };

  // EdgeInsets.symmetric(horizontal: 16, vertical: 8)
  const symMatch = expr.match(/EdgeInsets\.symmetric\(([^)]+)\)/);
  if (symMatch) {
    const style = {};
    const hMatch = symMatch[1].match(/horizontal\s*:\s*([\d.]+)/);
    const vMatch = symMatch[1].match(/vertical\s*:\s*([\d.]+)/);
    if (hMatch) { style.paddingLeft = parseFloat(hMatch[1]); style.paddingRight = parseFloat(hMatch[1]); }
    if (vMatch) { style.paddingTop = parseFloat(vMatch[1]); style.paddingBottom = parseFloat(vMatch[1]); }
    return style;
  }

  // EdgeInsets.only(left: 8, top: 16, right: 8, bottom: 16)
  const onlyMatch = expr.match(/EdgeInsets\.only\(([^)]+)\)/);
  if (onlyMatch) {
    const style = {};
    const l = onlyMatch[1].match(/left\s*:\s*([\d.]+)/);
    const t = onlyMatch[1].match(/top\s*:\s*([\d.]+)/);
    const r = onlyMatch[1].match(/right\s*:\s*([\d.]+)/);
    const b = onlyMatch[1].match(/bottom\s*:\s*([\d.]+)/);
    if (l) style.paddingLeft = parseFloat(l[1]);
    if (t) style.paddingTop = parseFloat(t[1]);
    if (r) style.paddingRight = parseFloat(r[1]);
    if (b) style.paddingBottom = parseFloat(b[1]);
    return style;
  }

  // EdgeInsets.fromLTRB(l, t, r, b)
  const ltrbMatch = expr.match(/EdgeInsets\.fromLTRB\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/);
  if (ltrbMatch) {
    return {
      paddingLeft: parseFloat(ltrbMatch[1]),
      paddingTop: parseFloat(ltrbMatch[2]),
      paddingRight: parseFloat(ltrbMatch[3]),
      paddingBottom: parseFloat(ltrbMatch[4]),
    };
  }

  // EdgeInsets.zero
  if (expr === 'EdgeInsets.zero') return { padding: 0 };

  return {};
}

/**
 * Parse a BoxDecoration into style properties.
 */
function parseBoxDecoration(expr) {
  const style = {};
  if (!expr) return style;

  // color:
  const colorMatch = expr.match(/color\s*:\s*([^,\n]+?)(?:\s*,|\s*\))/);
  if (colorMatch) {
    const c = resolveColor(colorMatch[1].trim());
    if (c) style.backgroundColor = c;
  }

  // borderRadius: BorderRadius.circular(N)
  const brMatch = expr.match(/BorderRadius\.circular\(\s*([\d.]+)\s*\)/);
  if (brMatch) style.borderRadius = parseFloat(brMatch[1]);

  // borderRadius: BorderRadius.all(Radius.circular(N))
  const brAllMatch = expr.match(/BorderRadius\.all\(\s*Radius\.circular\(\s*([\d.]+)\s*\)\s*\)/);
  if (brAllMatch) style.borderRadius = parseFloat(brAllMatch[1]);

  // border: Border.all(color: X, width: N)
  const borderMatch = expr.match(/Border\.all\(([^)]+)\)/);
  if (borderMatch) {
    const bColor = borderMatch[1].match(/color\s*:\s*([^,)]+)/);
    const bWidth = borderMatch[1].match(/width\s*:\s*([\d.]+)/);
    if (bColor) { const c = resolveColor(bColor[1].trim()); if (c) style.borderColor = c; }
    style.borderWidth = bWidth ? parseFloat(bWidth[1]) : 1;
  }

  // boxShadow:
  const shadowMatch = expr.match(/BoxShadow\(([^)]+)\)/);
  if (shadowMatch) {
    const sColor = shadowMatch[1].match(/color\s*:\s*([^,)]+)/);
    const sBlur = shadowMatch[1].match(/blurRadius\s*:\s*([\d.]+)/);
    const sX = shadowMatch[1].match(/offset\s*:\s*Offset\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
    if (sBlur) style.shadowBlur = parseFloat(sBlur[1]);
    if (sColor) { const c = resolveColor(sColor[1].trim()); if (c) style.shadowColor = c; }
    else style.shadowColor = 'rgba(0,0,0,0.25)';
    if (sX) { style.shadowOffsetX = parseFloat(sX[1]); style.shadowOffsetY = parseFloat(sX[2]); }
  }

  return style;
}

/**
 * Parse TextStyle into style properties.
 */
function parseTextStyle(expr) {
  const style = {};
  if (!expr) return style;

  const sizeMatch = expr.match(/fontSize\s*:\s*([\d.]+)/);
  if (sizeMatch) style.fontSize = parseFloat(sizeMatch[1]);

  const weightMatch = expr.match(/fontWeight\s*:\s*(FontWeight\.\w+)/);
  if (weightMatch && FONT_WEIGHT_MAP[weightMatch[1]]) style.fontWeight = FONT_WEIGHT_MAP[weightMatch[1]];

  const colorMatch = expr.match(/color\s*:\s*([^,)]+)/);
  if (colorMatch) {
    const c = resolveColor(colorMatch[1].trim());
    if (c) style.color = c;
  }

  const familyMatch = expr.match(/fontFamily\s*:\s*['"]([^'"]+)['"]/);
  if (familyMatch) style.fontFamily = familyMatch[1];

  const styleMatch = expr.match(/fontStyle\s*:\s*FontStyle\.(\w+)/);
  if (styleMatch && styleMatch[1] === 'italic') style.fontStyle = 'italic';

  const heightMatch = expr.match(/height\s*:\s*([\d.]+)/);
  if (heightMatch) style.lineHeight = parseFloat(heightMatch[1]);

  const spacingMatch = expr.match(/letterSpacing\s*:\s*([-\d.]+)/);
  if (spacingMatch) style.letterSpacing = parseFloat(spacingMatch[1]);

  const decoMatch = expr.match(/decoration\s*:\s*TextDecoration\.(\w+)/);
  if (decoMatch) {
    if (decoMatch[1] === 'underline') style.textDecorationLine = 'underline';
    else if (decoMatch[1] === 'lineThrough') style.textDecorationLine = 'line-through';
  }

  return style;
}

/**
 * Parse MainAxisAlignment to justifyContent.
 */
function resolveMainAxisAlignment(val) {
  const map = {
    'MainAxisAlignment.start': 'start',
    'MainAxisAlignment.end': 'end',
    'MainAxisAlignment.center': 'center',
    'MainAxisAlignment.spaceBetween': 'space-between',
    'MainAxisAlignment.spaceAround': 'space-around',
    'MainAxisAlignment.spaceEvenly': 'space-evenly',
  };
  return map[val?.trim()] || null;
}

/**
 * Parse CrossAxisAlignment to alignItems.
 */
function resolveCrossAxisAlignment(val) {
  const map = {
    'CrossAxisAlignment.start': 'start',
    'CrossAxisAlignment.end': 'end',
    'CrossAxisAlignment.center': 'center',
    'CrossAxisAlignment.stretch': 'stretch',
  };
  return map[val?.trim()] || null;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CODE GENERATOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function generateReactJIT(parsedFile) {
  const allComponents = new Set(['Box']);
  const allWarnings = [...parsedFile.warnings];
  const outputs = [];

  // Pair StatefulWidget with its State class
  const stateClasses = {};
  for (const cls of parsedFile.classes) {
    if (cls.stateOf) stateClasses[cls.stateOf] = cls;
  }

  for (const cls of parsedFile.classes) {
    // Skip State classes — they get merged into their StatefulWidget
    if (cls.stateOf) continue;

    const components = new Set(['Box']);
    const warnings = [];

    const isStateful = cls.superclass === 'StatefulWidget';
    const stateClass = isStateful ? stateClasses[cls.name] : null;
    const buildSource = stateClass?.buildSource || cls.buildSource;
    if (!buildSource) continue;

    // Parse build method into widget tree
    const viewTree = parseWidgetBody(buildSource);

    // Generate state declarations
    const stateDecls = [];
    const stateProps = stateClass?.properties || [];
    for (const p of stateProps) {
      if (p.modifier === 'final' && !p.defaultValue) continue; // constructor param
      const tsType = dartTypeToTS(p.type);
      const jsDefault = dartValueToJS(p.defaultValue, p.type);
      stateDecls.push(`  const [${p.name}, set${setterName(p.name)}] = useState${tsType ? `<${tsType}>` : ''}(${jsDefault});`);
    }

    // Widget props (final fields on StatefulWidget or StatelessWidget)
    const widgetProps = cls.properties.filter(p => p.modifier === 'final' && !p.defaultValue);

    // Generate functions
    const funcDecls = [];
    const methods = stateClass?.functions || cls.functions;
    for (const f of methods) {
      const jsArgs = convertDartArgs(f.args);
      funcDecls.push(`  const ${f.name} = (${jsArgs}) => {`);
      const bodyLines = f.body.split('\n');
      // Pre-process: collapse multi-line setState blocks into single lines
      const collapsedLines = collapseSetStateBlocks(bodyLines);
      for (const bl of collapsedLines) {
        const converted = convertDartLine(bl.trim(), stateProps);
        if (converted) funcDecls.push(`    ${converted}`);
      }
      funcDecls.push(`  };`);
      funcDecls.push('');
    }

    // initState → useEffect
    const effectDecls = [];
    if (stateClass?.initState) {
      effectDecls.push(`  useEffect(() => {`);
      const initLines = collapseSetStateBlocks(stateClass.initState.split('\n'));
      for (const il of initLines) {
        const converted = convertDartLine(il.trim(), stateProps);
        if (converted) effectDecls.push(`    ${converted}`);
      }
      effectDecls.push(`  }, []);`);
      effectDecls.push('');
    }

    // Generate JSX
    const jsxLines = generateWidgetTree(viewTree, 2, components, warnings, stateProps);

    // Build props signature
    const propsStr = widgetProps.length > 0
      ? `{ ${widgetProps.map(p => p.name).join(', ')} }: { ${widgetProps.map(p => `${p.name}: ${dartTypeToTS(p.type) || 'any'}`).join('; ')} }`
      : '';

    // Assemble
    const output = [];
    output.push(`export function ${cls.name}(${propsStr}) {`);
    if (stateDecls.length > 0) { output.push(...stateDecls); output.push(''); }
    if (funcDecls.length > 0) output.push(...funcDecls);
    if (effectDecls.length > 0) output.push(...effectDecls);
    output.push('  return (');
    output.push(...jsxLines);
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

  const mainClass = parsedFile.classes.find(c => !c.stateOf);
  if (mainClass) fileLines.push(`// Migrated from Flutter: ${mainClass.name}`);
  fileLines.push('');
  fileLines.push(outputs.join('\n\n'));

  return {
    code: fileLines.join('\n'),
    warnings: [...new Set(allWarnings)],
    components: [...allComponents],
    stats: {
      views: parsedFile.classes.filter(c => !c.stateOf).length,
      stateVars: parsedFile.classes.reduce((sum, c) => sum + (c.stateOf ? c.properties.filter(p => p.defaultValue).length : 0), 0),
      functions: parsedFile.classes.reduce((sum, c) => sum + c.functions.length, 0),
      props: parsedFile.classes.reduce((sum, c) => sum + c.properties.filter(p => p.modifier === 'final' && !p.defaultValue).length, 0),
    },
  };
}

/**
 * Generate JSX lines from a widget tree.
 */
function generateWidgetTree(nodes, depth, components, warnings, stateProps) {
  const out = [];
  const ind = (d) => '  '.repeat(d);

  for (const node of nodes) {
    // Spread expression
    if (node.type === '_spread') {
      out.push(`${ind(depth)}{${convertDartExpr(node.expr, stateProps)}}`);
      continue;
    }

    // Conditional wrapper
    const condPrefix = node._condition ? `{${convertDartExpr(node._condition, stateProps)} && (\n${ind(depth + 1)}` : '';
    const condSuffix = node._condition ? `\n${ind(depth)})}` : '';
    const innerDepth = node._condition ? depth + 1 : depth;

    // For loop wrapper
    if (node._forVar) {
      out.push(`${ind(depth)}{${convertDartExpr(node._forCollection, stateProps)}.map((${node._forVar}) => (`);
      out.push(...generateSingleWidget(node, depth + 1, components, warnings, stateProps));
      out.push(`${ind(depth)}))}`);
      continue;
    }

    if (condPrefix) out.push(`${ind(depth)}${condPrefix}`);
    out.push(...generateSingleWidget(node, innerDepth, components, warnings, stateProps));
    if (condSuffix) out.push(`${ind(depth)}${condSuffix}`);
  }

  return out;
}

/**
 * Generate JSX for a single widget node.
 */
function generateSingleWidget(node, depth, components, warnings, stateProps) {
  const out = [];
  const ind = (d) => '  '.repeat(d);
  const args = node.namedArgs || {};

  const mapping = WIDGET_MAP[node.type];

  // Unknown widget — render as custom component call
  if (!mapping) {
    const hasKids = node.children?.length > 0;
    if (hasKids) {
      out.push(`${ind(depth)}<${node.type}>`);
      out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
      out.push(`${ind(depth)}</${node.type}>`);
    } else {
      out.push(`${ind(depth)}<${node.type} />`);
    }
    return out;
  }

  // Passthrough widgets — render children directly
  if (mapping.passthrough) {
    if (node.children?.length > 0) {
      out.push(...generateWidgetTree(node.children, depth, components, warnings, stateProps));
    } else if (args.child) {
      const childNode = parseWidgetExpr(args.child, 0);
      if (childNode) out.push(...generateWidgetTree([childNode], depth, components, warnings, stateProps));
    }
    return out;
  }

  const comp = mapping.component;
  if (!comp) return out;
  components.add(comp);

  const style = {};
  const events = [];

  // ── Text ──────────────────────────────
  if (mapping.type === 'text') {
    components.add('Text');
    let textContent = '';
    if (node.positionalArgs?.[0]) {
      textContent = resolveDartString(node.positionalArgs[0]);
    }
    if (args.style) Object.assign(style, parseTextStyle(args.style));
    if (args.textAlign) {
      const ta = args.textAlign.replace('TextAlign.', '');
      if (ta === 'center') style.textAlign = 'center';
      else if (ta === 'right' || ta === 'end') style.textAlign = 'right';
    }
    if (args.maxLines) {
      // No direct equivalent, skip
    }
    const styleStr = formatStyleAttr(style);
    out.push(`${ind(depth)}<Text${styleStr}>${textContent}</Text>`);
    return out;
  }

  // ── Icon ──────────────────────────────
  if (mapping.type === 'icon') {
    components.add('Text');
    const iconName = node.positionalArgs?.[0] || 'Icons.help';
    if (args.color) { const c = resolveColor(args.color); if (c) style.color = c; }
    if (args.size) style.fontSize = parseFloat(args.size);
    const styleStr = formatStyleAttr(style);
    out.push(`${ind(depth)}<Text${styleStr}>{/* Icon: ${iconName} */}</Text>`);
    return out;
  }

  // ── Image ─────────────────────────────
  if (mapping.type === 'image') {
    components.add('Image');
    let src = 'placeholder';
    if (node.type === 'Image.network' && node.positionalArgs?.[0]) {
      src = node.positionalArgs[0].replace(/^['"]|['"]$/g, '');
    } else if (node.type === 'Image.asset' && node.positionalArgs?.[0]) {
      src = node.positionalArgs[0].replace(/^['"]|['"]$/g, '');
    } else if (args.image) {
      src = args.image;
    }
    if (args.width) style.width = parseFloat(args.width);
    if (args.height) style.height = parseFloat(args.height);
    if (args.fit) {
      // BoxFit → objectFit-like behavior — just note in comment
    }
    const styleStr = formatStyleAttr(style);
    out.push(`${ind(depth)}<Image src="${src}"${styleStr} />`);
    return out;
  }

  // ── Button ────────────────────────────
  if (mapping.type === 'button') {
    components.add('Pressable');
    components.add('Text');
    let handler = 'undefined';
    if (args.onPressed) handler = convertDartClosure(args.onPressed, stateProps);
    if (args.style) {
      // ElevatedButton.styleFrom(...) — extract colors
      const bgMatch = args.style.match(/backgroundColor\s*:\s*([^,)]+)/);
      if (bgMatch) { const c = resolveColor(bgMatch[1].trim()); if (c) style.backgroundColor = c; }
      const fgMatch = args.style.match(/foregroundColor\s*:\s*([^,)]+)/);
      if (fgMatch) { const c = resolveColor(fgMatch[1].trim()); if (c) style.color = c; }
      const padMatch = args.style.match(/padding\s*:\s*([^,)]+EdgeInsets[^,)]+\))/);
      if (padMatch) Object.assign(style, parseEdgeInsets(padMatch[1]));
      const brMatch = args.style.match(/(?:shape|borderRadius)\s*:\s*([^,)]+)/);
      if (brMatch) {
        const crMatch = brMatch[1].match(/BorderRadius\.circular\(\s*([\d.]+)\s*\)/);
        if (crMatch) style.borderRadius = parseFloat(crMatch[1]);
      }
    }
    if (mapping.outlined) {
      style.borderWidth = style.borderWidth || 1;
      style.borderColor = style.borderColor || '#666';
    }
    const styleStr = formatStyleAttr(style);
    out.push(`${ind(depth)}<Pressable onClick={${handler}}${styleStr}>`);
    if (node.children?.length > 0) {
      out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
    } else if (args.child) {
      const childNode = parseWidgetExpr(args.child, 0);
      if (childNode) out.push(...generateWidgetTree([childNode], depth + 1, components, warnings, stateProps));
    }
    out.push(`${ind(depth)}</Pressable>`);
    return out;
  }

  // ── FAB ───────────────────────────────
  if (mapping.type === 'fab') {
    components.add('Pressable');
    let handler = 'undefined';
    if (args.onPressed) handler = convertDartClosure(args.onPressed, stateProps);
    style.position = 'absolute';
    style.bottom = 16;
    style.right = 16;
    style.borderRadius = 28;
    style.padding = 16;
    if (args.backgroundColor) { const c = resolveColor(args.backgroundColor); if (c) style.backgroundColor = c; }
    else style.backgroundColor = '#2196F3';
    const styleStr = formatStyleAttr(style);
    out.push(`${ind(depth)}<Pressable onClick={${handler}}${styleStr}>`);
    if (node.children?.length > 0) {
      out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
    } else if (args.child) {
      const childNode = parseWidgetExpr(args.child, 0);
      if (childNode) out.push(...generateWidgetTree([childNode], depth + 1, components, warnings, stateProps));
    }
    out.push(`${ind(depth)}</Pressable>`);
    return out;
  }

  // ── TextInput ─────────────────────────
  if (mapping.type === 'input') {
    components.add('TextInput');
    if (args.decoration) {
      const labelMatch = args.decoration.match(/labelText\s*:\s*['"]([^'"]+)['"]/);
      const hintMatch = args.decoration.match(/hintText\s*:\s*['"]([^'"]+)['"]/);
      if (hintMatch) style._placeholder = hintMatch[1];
      else if (labelMatch) style._placeholder = labelMatch[1];
    }
    const placeholder = style._placeholder; delete style._placeholder;
    let valueStr = '';
    if (args.controller) {
      valueStr = ` value={${args.controller}.text} onTextInput={(e) => ${args.controller}.text = e.text}`;
    }
    if (args.onChanged) {
      const handler = convertDartClosure(args.onChanged, stateProps);
      valueStr += ` onLiveChange={${handler}}`;
    }
    const placeholderStr = placeholder ? ` placeholder="${placeholder}"` : '';
    const obscureStr = args.obscureText === 'true' ? ' secureTextEntry' : '';
    const multilineStr = args.maxLines && parseInt(args.maxLines) > 1 ? ' multiline' : '';
    const styleStr = formatStyleAttr(style);
    out.push(`${ind(depth)}<TextInput${styleStr}${valueStr}${placeholderStr}${obscureStr}${multilineStr} />`);
    return out;
  }

  // ── Scaffold ──────────────────────────
  if (mapping.type === 'scaffold') {
    style.width = '100%'; style.height = '100%';
    if (args.backgroundColor) { const c = resolveColor(args.backgroundColor); if (c) style.backgroundColor = c; }
    const styleStr = formatStyleAttr(style);
    out.push(`${ind(depth)}<Box${styleStr}>`);
    // AppBar
    if (args.appBar) {
      const appBarNode = parseWidgetExpr(args.appBar, 0);
      if (appBarNode) out.push(...generateWidgetTree([appBarNode], depth + 1, components, warnings, stateProps));
    }
    // Body
    if (node.children?.length > 0) {
      out.push(`${ind(depth + 1)}<Box style={{ flexGrow: 1 }}>`);
      out.push(...generateWidgetTree(node.children, depth + 2, components, warnings, stateProps));
      out.push(`${ind(depth + 1)}</Box>`);
    }
    // FAB
    if (args.floatingActionButton) {
      const fabNode = parseWidgetExpr(args.floatingActionButton, 0);
      if (fabNode) out.push(...generateWidgetTree([fabNode], depth + 1, components, warnings, stateProps));
    }
    // Bottom nav
    if (args.bottomNavigationBar) {
      const navNode = parseWidgetExpr(args.bottomNavigationBar, 0);
      if (navNode) out.push(...generateWidgetTree([navNode], depth + 1, components, warnings, stateProps));
    }
    // Drawer
    if (args.drawer) {
      warnings.push('Scaffold drawer → needs manual conversion to sidebar pattern');
    }
    out.push(`${ind(depth)}</Box>`);
    return out;
  }

  // ── AppBar ────────────────────────────
  if (mapping.type === 'appbar') {
    components.add('Text');
    let barBg = '';
    if (args.backgroundColor) { const c = resolveColor(args.backgroundColor); if (c) barBg = `'${c}'`; }
    out.push(`${ind(depth)}<Box style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12${barBg ? `, backgroundColor: ${barBg}` : ''} }}>`);
    if (args.leading) {
      const leadNode = parseWidgetExpr(args.leading, 0);
      if (leadNode) out.push(...generateWidgetTree([leadNode], depth + 1, components, warnings, stateProps));
    }
    if (args.title) {
      const titleNode = parseWidgetExpr(args.title, 0);
      if (titleNode) {
        out.push(`${ind(depth + 1)}<Box style={{ flexGrow: 1 }}>`);
        out.push(...generateWidgetTree([titleNode], depth + 2, components, warnings, stateProps));
        out.push(`${ind(depth + 1)}</Box>`);
      }
    }
    if (args.actions) {
      const actionNodes = parseChildrenList(args.actions);
      if (actionNodes.length > 0) {
        out.push(...generateWidgetTree(actionNodes, depth + 1, components, warnings, stateProps));
      }
    }
    out.push(`${ind(depth)}</Box>`);
    return out;
  }

  // ── Padding ───────────────────────────
  if (mapping.type === 'padding') {
    const padStyle = args.padding ? parseEdgeInsets(args.padding) : { padding: 16 };
    if (node.children?.length > 0) {
      // Apply padding directly to first child
      const firstChild = node.children[0];
      firstChild._extraStyle = { ...(firstChild._extraStyle || {}), ...padStyle };
      out.push(...generateWidgetTree(node.children, depth, components, warnings, stateProps));
    } else {
      Object.assign(style, padStyle);
      const styleStr = formatStyleAttr(style);
      out.push(`${ind(depth)}<Box${styleStr} />`);
    }
    return out;
  }

  // ── Center ────────────────────────────
  if (mapping.type === 'center') {
    style.alignItems = 'center'; style.justifyContent = 'center';
    const styleStr = formatStyleAttr(style);
    out.push(`${ind(depth)}<Box${styleStr}>`);
    if (node.children?.length > 0) {
      out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
    }
    out.push(`${ind(depth)}</Box>`);
    return out;
  }

  // ── SizedBox ──────────────────────────
  if (mapping.type === 'sizedbox') {
    if (args.width) style.width = parseFloat(args.width);
    if (args.height) style.height = parseFloat(args.height);
    if (node.children?.length > 0) {
      const styleStr = formatStyleAttr(style);
      out.push(`${ind(depth)}<Box${styleStr}>`);
      out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
      out.push(`${ind(depth)}</Box>`);
    } else {
      const styleStr = formatStyleAttr(style);
      out.push(`${ind(depth)}<Box${styleStr} />`);
    }
    return out;
  }

  // ── Expanded ──────────────────────────
  if (mapping.type === 'expanded') {
    const flex = args.flex ? parseInt(args.flex) : 1;
    style.flexGrow = flex;
    const styleStr = formatStyleAttr(style);
    out.push(`${ind(depth)}<Box${styleStr}>`);
    if (node.children?.length > 0) {
      out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
    }
    out.push(`${ind(depth)}</Box>`);
    return out;
  }

  // ── Flexible ──────────────────────────
  if (mapping.type === 'flexible') {
    const flex = args.flex ? parseInt(args.flex) : 1;
    style.flexGrow = flex;
    style.flexShrink = 1;
    const styleStr = formatStyleAttr(style);
    out.push(`${ind(depth)}<Box${styleStr}>`);
    if (node.children?.length > 0) {
      out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
    }
    out.push(`${ind(depth)}</Box>`);
    return out;
  }

  // ── Spacer ────────────────────────────
  if (mapping.type === 'spacer') {
    out.push(`${ind(depth)}<Box style={{ flexGrow: 1 }} />`);
    return out;
  }

  // ── Divider ───────────────────────────
  if (mapping.type === 'divider') {
    const divColor = args.color ? resolveColor(args.color) : '#333';
    const divHeight = args.thickness ? parseFloat(args.thickness) : 1;
    out.push(`${ind(depth)}<Box style={{ width: '100%', height: ${divHeight}, backgroundColor: '${divColor}' }} />`);
    return out;
  }

  // ── Card ──────────────────────────────
  if (mapping.type === 'card') {
    style.borderRadius = 8;
    style.shadowBlur = 4;
    style.shadowColor = 'rgba(0,0,0,0.25)';
    if (args.color) { const c = resolveColor(args.color); if (c) style.backgroundColor = c; }
    if (args.elevation) style.shadowBlur = parseFloat(args.elevation) * 2;
    if (args.margin) Object.assign(style, replaceKeys(parseEdgeInsets(args.margin), 'padding', 'margin'));
    if (args.shape) {
      const brMatch = args.shape.match(/BorderRadius\.circular\(\s*([\d.]+)\s*\)/);
      if (brMatch) style.borderRadius = parseFloat(brMatch[1]);
    }
    const styleStr = formatStyleAttr(style);
    out.push(`${ind(depth)}<Box${styleStr}>`);
    if (node.children?.length > 0) {
      out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
    }
    out.push(`${ind(depth)}</Box>`);
    return out;
  }

  // ── Container ─────────────────────────
  if (mapping.type === 'container') {
    if (args.padding) Object.assign(style, parseEdgeInsets(args.padding));
    if (args.margin) Object.assign(style, replaceKeys(parseEdgeInsets(args.margin), 'padding', 'margin'));
    if (args.width) style.width = parseFloat(args.width);
    if (args.height) style.height = parseFloat(args.height);
    if (args.color) { const c = resolveColor(args.color); if (c) style.backgroundColor = c; }
    if (args.decoration) Object.assign(style, parseBoxDecoration(args.decoration));
    if (args.alignment) {
      style.alignItems = 'center';
      style.justifyContent = 'center';
    }
    if (args.constraints) {
      const minW = args.constraints.match(/minWidth\s*:\s*([\d.]+)/);
      const maxW = args.constraints.match(/maxWidth\s*:\s*([\d.]+)/);
      const minH = args.constraints.match(/minHeight\s*:\s*([\d.]+)/);
      const maxH = args.constraints.match(/maxHeight\s*:\s*([\d.]+)/);
      if (minW) style.minWidth = parseFloat(minW[1]);
      if (maxW) style.maxWidth = parseFloat(maxW[1]);
      if (minH) style.minHeight = parseFloat(minH[1]);
      if (maxH) style.maxHeight = parseFloat(maxH[1]);
    }
    // Merge extra style from Padding wrapper
    if (node._extraStyle) Object.assign(style, node._extraStyle);
    const styleStr = formatStyleAttr(style);
    const hasKids = node.children?.length > 0;
    out.push(`${ind(depth)}<Box${styleStr}${hasKids ? '>' : ' />'}`);
    if (hasKids) {
      out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
      out.push(`${ind(depth)}</Box>`);
    }
    return out;
  }

  // ── Gesture / InkWell ─────────────────
  if (mapping.type === 'gesture') {
    components.add('Pressable');
    if (args.onTap) events.push(`onClick={${convertDartClosure(args.onTap, stateProps)}}`);
    if (args.onLongPress) events.push(`onLongPress={${convertDartClosure(args.onLongPress, stateProps)}}`);
    if (args.onDoubleTap) events.push(`onClick={${convertDartClosure(args.onDoubleTap, stateProps)}}`);
    if (node._extraStyle) Object.assign(style, node._extraStyle);
    const styleStr = formatStyleAttr(style);
    const evStr = events.length ? ' ' + events.join(' ') : '';
    out.push(`${ind(depth)}<Pressable${styleStr}${evStr}>`);
    if (node.children?.length > 0) {
      out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
    }
    out.push(`${ind(depth)}</Pressable>`);
    return out;
  }

  // ── Checkbox ──────────────────────────
  if (mapping.type === 'checkbox') {
    components.add('Pressable');
    components.add('Text');
    const value = args.value || 'false';
    const handler = args.onChanged ? convertDartClosure(args.onChanged, stateProps) : '() => {}';
    out.push(`${ind(depth)}<Pressable onClick={${handler}}>`);
    out.push(`${ind(depth + 1)}<Box style={{ width: 18, height: 18, borderWidth: 2, borderColor: '#666', borderRadius: 3, backgroundColor: ${convertDartExpr(value, stateProps)} ? '#2196F3' : 'transparent' }} />`);
    out.push(`${ind(depth)}</Pressable>`);
    return out;
  }

  // ── Switch ────────────────────────────
  if (mapping.type === 'switch') {
    components.add('Pressable');
    const value = args.value || 'false';
    const handler = args.onChanged ? convertDartClosure(args.onChanged, stateProps) : '() => {}';
    out.push(`${ind(depth)}<Pressable onClick={${handler}}>`);
    out.push(`${ind(depth + 1)}<Box style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: ${convertDartExpr(value, stateProps)} ? '#2196F3' : '#555' }} />`);
    out.push(`${ind(depth)}</Pressable>`);
    return out;
  }

  // ── ListTile ──────────────────────────
  if (mapping.type === 'listtile') {
    components.add('Pressable');
    components.add('Text');
    const evStr = args.onTap ? ` onClick={${convertDartClosure(args.onTap, stateProps)}}` : '';
    out.push(`${ind(depth)}<Pressable style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 16 }}${evStr}>`);
    if (args.leading) {
      const leadNode = parseWidgetExpr(args.leading, 0);
      if (leadNode) out.push(...generateWidgetTree([leadNode], depth + 1, components, warnings, stateProps));
    }
    out.push(`${ind(depth + 1)}<Box style={{ flexGrow: 1 }}>`);
    if (args.title) {
      const titleNode = parseWidgetExpr(args.title, 0);
      if (titleNode) out.push(...generateWidgetTree([titleNode], depth + 2, components, warnings, stateProps));
    }
    if (args.subtitle) {
      const subNode = parseWidgetExpr(args.subtitle, 0);
      if (subNode) out.push(...generateWidgetTree([subNode], depth + 2, components, warnings, stateProps));
    }
    out.push(`${ind(depth + 1)}</Box>`);
    if (args.trailing) {
      const trailNode = parseWidgetExpr(args.trailing, 0);
      if (trailNode) out.push(...generateWidgetTree([trailNode], depth + 1, components, warnings, stateProps));
    }
    out.push(`${ind(depth)}</Pressable>`);
    return out;
  }

  // ── Opacity ───────────────────────────
  if (mapping.type === 'opacity') {
    style.opacity = args.opacity ? parseFloat(args.opacity) : 1;
    const styleStr = formatStyleAttr(style);
    out.push(`${ind(depth)}<Box${styleStr}>`);
    if (node.children?.length > 0) {
      out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
    }
    out.push(`${ind(depth)}</Box>`);
    return out;
  }

  // ── ClipRRect ─────────────────────────
  if (mapping.type === 'cliprrect') {
    const brMatch = (args.borderRadius || '').match(/BorderRadius\.circular\(\s*([\d.]+)\s*\)/);
    if (brMatch) style.borderRadius = parseFloat(brMatch[1]);
    else style.borderRadius = 8;
    style.overflow = 'hidden';
    const styleStr = formatStyleAttr(style);
    out.push(`${ind(depth)}<Box${styleStr}>`);
    if (node.children?.length > 0) {
      out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
    }
    out.push(`${ind(depth)}</Box>`);
    return out;
  }

  // ── ClipOval ──────────────────────────
  if (mapping.type === 'clipoval') {
    style.borderRadius = 9999;
    style.overflow = 'hidden';
    const styleStr = formatStyleAttr(style);
    out.push(`${ind(depth)}<Box${styleStr}>`);
    if (node.children?.length > 0) {
      out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
    }
    out.push(`${ind(depth)}</Box>`);
    return out;
  }

  // ── Wrap ──────────────────────────────
  if (mapping.type === 'wrap') {
    style.flexDirection = 'row';
    style.flexWrap = 'wrap';
    if (args.spacing) style.gap = parseFloat(args.spacing);
    if (args.runSpacing) style.rowGap = parseFloat(args.runSpacing);
    const styleStr = formatStyleAttr(style);
    out.push(`${ind(depth)}<Box${styleStr}>`);
    if (node.children?.length > 0) {
      out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
    }
    out.push(`${ind(depth)}</Box>`);
    return out;
  }

  // ── Dialog ────────────────────────────
  if (mapping.type === 'dialog') {
    components.add('Modal');
    out.push(`${ind(depth)}<Modal visible={true} onClose={() => {}}>`);
    if (args.title) {
      const titleNode = parseWidgetExpr(args.title, 0);
      if (titleNode) out.push(...generateWidgetTree([titleNode], depth + 1, components, warnings, stateProps));
    }
    if (args.content) {
      const contentNode = parseWidgetExpr(args.content, 0);
      if (contentNode) out.push(...generateWidgetTree([contentNode], depth + 1, components, warnings, stateProps));
    }
    if (node.children?.length > 0) {
      out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
    }
    out.push(`${ind(depth)}</Modal>`);
    return out;
  }

  // ── Progress indicators ───────────────
  if (mapping.type === 'progress') {
    out.push(`${ind(depth)}<Box style={{ width: 24, height: 24, borderWidth: 2, borderColor: '#2196F3', borderRadius: 12 }}>`);
    out.push(`${ind(depth + 1)}{/* CircularProgressIndicator */}`);
    out.push(`${ind(depth)}</Box>`);
    return out;
  }
  if (mapping.type === 'progressbar') {
    out.push(`${ind(depth)}<Box style={{ width: '100%', height: 4, backgroundColor: '#333', borderRadius: 2 }}>`);
    out.push(`${ind(depth + 1)}<Box style={{ width: '50%', height: '100%', backgroundColor: '#2196F3', borderRadius: 2 }} />`);
    out.push(`${ind(depth)}</Box>`);
    return out;
  }

  // ── BottomNavigationBar ───────────────
  if (mapping.type === 'bottomnav') {
    components.add('Pressable');
    components.add('Text');
    out.push(`${ind(depth)}<Box style={{ flexDirection: 'row', justifyContent: 'space-around', padding: 8, borderTopWidth: 1, borderColor: '#333' }}>`);
    if (args.items) {
      const items = parseChildrenList(args.items);
      for (const item of items) {
        if (item.namedArgs?.label) {
          const label = resolveDartString(item.namedArgs.label.trim());
          out.push(`${ind(depth + 1)}<Pressable style={{ alignItems: 'center', padding: 8 }}>`);
          out.push(`${ind(depth + 2)}<Text style={{ fontSize: 12 }}>${label}</Text>`);
          out.push(`${ind(depth + 1)}</Pressable>`);
        }
      }
    }
    out.push(`${ind(depth)}</Box>`);
    return out;
  }

  // ── Drawer ────────────────────────────
  if (mapping.type === 'drawer') {
    style.width = 280;
    style.backgroundColor = '#1a1a1a';
    const styleStr = formatStyleAttr(style);
    out.push(`${ind(depth)}<Box${styleStr}>`);
    if (node.children?.length > 0) {
      out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
    }
    out.push(`${ind(depth)}</Box>`);
    return out;
  }

  // ── Positioned ────────────────────────
  if (mapping.positioned) {
    style.position = 'absolute';
    if (args.left) style.left = parseFloat(args.left);
    if (args.top) style.top = parseFloat(args.top);
    if (args.right) style.right = parseFloat(args.right);
    if (args.bottom) style.bottom = parseFloat(args.bottom);
    if (args.width) style.width = parseFloat(args.width);
    if (args.height) style.height = parseFloat(args.height);
    const styleStr = formatStyleAttr(style);
    out.push(`${ind(depth)}<Box${styleStr}>`);
    if (node.children?.length > 0) {
      out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
    }
    out.push(`${ind(depth)}</Box>`);
    return out;
  }

  // ── Column / Row / Stack / ScrollView / generic ──
  if (mapping.dir) {
    if (mapping.dir === 'column') style.flexDirection = 'column';
    else if (mapping.dir === 'row') style.flexDirection = 'row';
    else if (mapping.dir === 'stack') style.position = 'relative';
  }

  if (args.mainAxisAlignment) {
    const jc = resolveMainAxisAlignment(args.mainAxisAlignment);
    if (jc) style.justifyContent = jc;
  }
  if (args.crossAxisAlignment) {
    const ai = resolveCrossAxisAlignment(args.crossAxisAlignment);
    if (ai) style.alignItems = ai;
  }
  if (args.mainAxisSize) {
    if (args.mainAxisSize === 'MainAxisSize.min') {
      // auto-size, no flexGrow
    } else {
      style.flexGrow = 1;
    }
  }
  if (args.spacing) style.gap = parseFloat(args.spacing);

  // ScrollView specifics
  if (comp === 'ScrollView') {
    components.add('ScrollView');
    if (!style.flexGrow && !style.height) style.flexGrow = 1;
    // ListView.builder → map pattern
    if (mapping.builder && args.itemBuilder) {
      const builderStr = args.itemBuilder.trim();
      const itemCount = args.itemCount || 'items.length';
      // We'll generate a .map() pattern
      const styleStr = formatStyleAttr(style);
      out.push(`${ind(depth)}<ScrollView${styleStr}>`);
      out.push(`${ind(depth + 1)}{Array.from({ length: ${convertDartExpr(itemCount, stateProps)} }, (_, index) => {`);
      out.push(`${ind(depth + 2)}${convertDartLine(builderStr, stateProps) || '// TODO: convert itemBuilder'}`);
      out.push(`${ind(depth + 1)}})}`);
      out.push(`${ind(depth)}</ScrollView>`);
      return out;
    }
  }

  // Merge extra style from Padding wrapper
  if (node._extraStyle) Object.assign(style, node._extraStyle);

  // Generic container with direction and children
  if (args.padding) Object.assign(style, parseEdgeInsets(args.padding));
  if (args.color) { const c = resolveColor(args.color); if (c) style.backgroundColor = c; }

  const styleStr = formatStyleAttr(style);
  const hasKids = node.children?.length > 0;
  out.push(`${ind(depth)}<${comp}${styleStr}${hasKids ? '>' : ' />'}`);
  if (hasKids) {
    out.push(...generateWidgetTree(node.children, depth + 1, components, warnings, stateProps));
    out.push(`${ind(depth)}</${comp}>`);
  }

  return out;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DART → JS HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function dartTypeToTS(dartType) {
  if (!dartType) return null;
  const t = dartType.trim().replace(/\?$/, '');
  if (t === 'String') return 'string';
  if (t === 'int' || t === 'double' || t === 'num') return 'number';
  if (t === 'bool') return 'boolean';
  if (t === 'void') return 'void';
  if (t.startsWith('List<')) return `${dartTypeToTS(t.slice(5, -1))}[]`;
  if (t.startsWith('Map<')) return 'Record<string, any>';
  if (dartType.endsWith('?')) return `${dartTypeToTS(t)} | null`;
  return t;
}

function dartValueToJS(val, type) {
  if (!val) {
    if (!type) return "''";
    const t = type.trim().replace(/\?$/, '');
    if (t === 'String') return "''";
    if (t === 'bool') return 'false';
    if (t === 'int' || t === 'double' || t === 'num') return '0';
    if (t.startsWith('List')) return '[]';
    if (t.startsWith('Map')) return '{}';
    return 'null';
  }
  let v = val.trim();
  if (v === 'true' || v === 'false') return v;
  if (v === 'null') return 'null';
  if (/^-?\d+(\.\d+)?$/.test(v)) return v;
  // Dart string literals
  if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
    return convertDartString(v);
  }
  // List literal
  if (v.startsWith('[')) return v.replace(/\bconst\b\s*/g, '');
  // Map literal
  if (v.startsWith('{')) return v;
  return v;
}

function convertDartArgs(args) {
  if (!args) return '';
  return args
    .replace(/\bBuildContext\s+\w+\s*,?\s*/g, '')
    .replace(/\bString\s+/g, '')
    .replace(/\bint\s+/g, '')
    .replace(/\bdouble\s+/g, '')
    .replace(/\bbool\s+/g, '')
    .replace(/\bdynamic\s+/g, '')
    .replace(/\bList<\w+>\s+/g, '')
    .replace(/\bMap<[^>]+>\s+/g, '')
    .replace(/\brequired\s+/g, '')
    .replace(/\bthis\./g, '')
    .trim();
}

/**
 * Collapse multi-line setState(() { ... }); blocks into a single line
 * so convertDartLine can process them with extractBlock.
 */
function collapseSetStateBlocks(lines) {
  const result = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (/^setState\s*\(\s*\(\s*\)\s*\{/.test(trimmed)) {
      // Found start of setState block — accumulate until matching close
      let depth = 0;
      let collapsed = '';
      for (let j = i; j < lines.length; j++) {
        const line = lines[j].trim();
        collapsed += (collapsed ? ' ' : '') + line;
        for (const ch of line) {
          if (ch === '{') depth++;
          else if (ch === '}') depth--;
        }
        if (depth <= 0) {
          i = j + 1;
          break;
        }
        if (j === lines.length - 1) {
          i = j + 1; // unterminated, push what we have
        }
      }
      result.push(collapsed);
    } else {
      result.push(lines[i]);
      i++;
    }
  }
  return result;
}

function convertDartLine(line, stateProps) {
  if (!line) return '';
  let l = line.trim();
  if (!l || l.startsWith('//')) return l;

  // setState(() { ... }) → extract assignments and convert to setters
  const setStateMatch = l.match(/^setState\s*\(\s*\(\s*\)\s*\{/);
  if (setStateMatch) {
    // Try to extract the body
    const braceStart = l.indexOf('{', l.indexOf('setState'));
    if (braceStart !== -1) {
      const block = extractBlock(l, braceStart);
      if (block) {
        const bodyLines = block.content.split(';').filter(s => s.trim());
        return bodyLines.map(bl => convertSetStateAssignment(bl.trim(), stateProps)).filter(Boolean).join('\n    ');
      }
    }
    return `// TODO: setState conversion needed`;
  }

  // setState(() => expr)
  const setStateLambda = l.match(/^setState\s*\(\s*\(\s*\)\s*=>\s*(.+)\s*\)\s*;?$/);
  if (setStateLambda) {
    return convertSetStateAssignment(setStateLambda[1].replace(/;$/, ''), stateProps);
  }

  // Dart string interpolation
  l = convertDartStringInterp(l);

  // .add() → .push()
  l = l.replace(/\.add\(/g, '.push(');
  // .where() → .filter()
  l = l.replace(/\.where\(/g, '.filter(');
  // .isEmpty → .length === 0
  l = l.replace(/!(\w+(?:\.\w+)*)\.isEmpty\b/g, '$1.length > 0');
  l = l.replace(/\.isEmpty\b/g, '.length === 0');
  // .isNotEmpty → .length > 0
  l = l.replace(/\.isNotEmpty\b/g, '.length > 0');
  // print() → console.log()
  l = l.replace(/\bprint\(/g, 'console.log(');
  // Dart variable declarations
  l = l.replace(/^final\s+(\w+)\s+/, 'const $1 ');
  l = l.replace(/^var\s+/, 'let ');
  l = l.replace(/^const\s+/, 'const ');
  // Non-null assertion ! → strip
  l = l.replace(/(\w)!\.(\w)/g, '$1.$2');
  l = l.replace(/(\w)!\s/g, '$1 ');

  // State assignments → setters
  if (stateProps) {
    for (const p of stateProps) {
      if (!p.defaultValue && p.modifier === 'final') continue;
      const assignRe = new RegExp(`\\b${p.name}\\s*=\\s*(.+?)\\s*;?$`);
      const assignMatch = l.match(assignRe);
      if (assignMatch && !l.includes('==') && !l.startsWith('const ') && !l.startsWith('let ') && !l.startsWith('var ')) {
        l = l.replace(assignRe, `set${setterName(p.name)}(${assignMatch[1].trim()});`);
      }
    }
  }

  // Add semicolon if missing
  if (l && !l.endsWith('{') && !l.endsWith('}') && !l.endsWith(';') && !l.startsWith('//')) {
    l += ';';
  }

  return l;
}

function convertSetStateAssignment(expr, stateProps) {
  if (!expr) return '';
  const trimmed = expr.trim().replace(/;$/, '');
  // name = value → setName(value)
  const assignMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
  if (assignMatch) {
    const name = assignMatch[1];
    const value = assignMatch[2].trim();
    // Check if it's a state variable
    const isState = stateProps?.some(p => p.name === name);
    if (isState) return `set${setterName(name)}(${convertDartExpr(value, stateProps)});`;
  }
  // name++ or name--
  const incMatch = trimmed.match(/^(\w+)(\+\+|--)$/);
  if (incMatch) {
    const isState = stateProps?.some(p => p.name === incMatch[1]);
    if (isState) return `set${setterName(incMatch[1])}(prev => prev ${incMatch[2] === '++' ? '+ 1' : '- 1'});`;
  }
  // name += value
  const compoundMatch = trimmed.match(/^(\w+)\s*(\+=|-=|\*=|\/=)\s*(.+)$/);
  if (compoundMatch) {
    const isState = stateProps?.some(p => p.name === compoundMatch[1]);
    const op = compoundMatch[2][0]; // +, -, *, /
    if (isState) return `set${setterName(compoundMatch[1])}(prev => prev ${op} ${convertDartExpr(compoundMatch[3], stateProps)});`;
  }
  return convertDartLine(trimmed, stateProps);
}

function convertDartExpr(expr, stateProps) {
  if (!expr) return 'true';
  let e = expr.trim();
  e = convertDartStringInterp(e);
  e = e.replace(/\.isEmpty\b/g, '.length === 0');
  e = e.replace(/\.isNotEmpty\b/g, '.length > 0');
  e = e.replace(/\bprint\(/g, 'console.log(');
  // Non-null assertion
  e = e.replace(/(\w)!\./g, '$1.');
  return e;
}

function convertDartClosure(body, stateProps) {
  if (!body) return '() => {}';
  const trimmed = body.trim();
  // () { ... }
  if (trimmed.startsWith('()')) {
    const braceIdx = trimmed.indexOf('{');
    if (braceIdx !== -1) {
      const block = extractBlock(trimmed, braceIdx);
      if (block) {
        const lines = block.content.split('\n').map(l => convertDartLine(l.trim(), stateProps)).filter(Boolean);
        if (lines.length === 1) return `() => { ${lines[0]} }`;
        return `() => {\n    ${lines.join('\n    ')}\n  }`;
      }
    }
    // () => expr
    const arrowMatch = trimmed.match(/^\(\)\s*=>\s*(.+)$/);
    if (arrowMatch) return `() => { ${convertDartLine(arrowMatch[1], stateProps)} }`;
  }
  // (value) { ... } or (value) => expr — callback with parameter
  const paramMatch = trimmed.match(/^\((\w+)\)\s*(?:\{|=>)/);
  if (paramMatch) {
    const param = paramMatch[1];
    const arrowIdx = trimmed.indexOf('=>');
    const braceIdx = trimmed.indexOf('{');
    if (arrowIdx !== -1 && (braceIdx === -1 || arrowIdx < braceIdx)) {
      const expr = trimmed.slice(arrowIdx + 2).trim();
      return `(${param}) => { ${convertDartLine(expr, stateProps)} }`;
    }
    if (braceIdx !== -1) {
      const block = extractBlock(trimmed, braceIdx);
      if (block) {
        const lines = block.content.split('\n').map(l => convertDartLine(l.trim(), stateProps)).filter(Boolean);
        return `(${param}) => {\n    ${lines.join('\n    ')}\n  }`;
      }
    }
  }
  // Bare function reference
  if (/^\w+$/.test(trimmed)) return trimmed;
  return `() => { ${convertDartLine(trimmed, stateProps)} }`;
}

function resolveDartString(expr) {
  if (!expr) return '';
  const trimmed = expr.trim();
  // Remove const keyword
  const clean = trimmed.replace(/^const\s+/, '');
  // 'literal' or "literal"
  if ((clean.startsWith("'") && clean.endsWith("'")) || (clean.startsWith('"') && clean.endsWith('"'))) {
    let inner = clean.slice(1, -1);
    // Dart string interpolation: $name or ${expr}
    if (inner.includes('$')) {
      inner = inner.replace(/\$\{([^}]+)\}/g, '${$1}').replace(/\$(\w+)/g, '${$1}');
      return `{\`${inner}\`}`;
    }
    return inner;
  }
  // Variable reference
  return `{${convertDartExpr(clean)}}`;
}

function convertDartString(str) {
  if (!str) return "''";
  const inner = str.slice(1, -1);
  if (inner.includes('$')) {
    const jsInner = inner.replace(/\$\{([^}]+)\}/g, '${$1}').replace(/\$(\w+)/g, '${$1}');
    return `\`${jsInner}\``;
  }
  return `'${inner}'`;
}

function convertDartStringInterp(line) {
  // Convert Dart string interpolation in entire line
  // '$name' → `${name}` and '${expr}' → `${expr}`
  return line.replace(/'([^']*\$[^']*)'/g, (match, inner) => {
    const jsInner = inner.replace(/\$\{([^}]+)\}/g, '${$1}').replace(/\$(\w+)/g, '${$1}');
    return `\`${jsInner}\``;
  }).replace(/"([^"]*\$[^"]*)"/g, (match, inner) => {
    const jsInner = inner.replace(/\$\{([^}]+)\}/g, '${$1}').replace(/\$(\w+)/g, '${$1}');
    return `\`${jsInner}\``;
  });
}

/** Replace padding keys with margin keys in a style object */
function replaceKeys(obj, from, to) {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k.replace(from, to)] = v;
  }
  return result;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLI ENTRY POINT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function migrateFlutterCommand(args) {
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
  rjit migrate-flutter — Convert Flutter/Dart apps to ReactJIT

  Usage:
    rjit migrate-flutter <file.dart>                           Convert and print to stdout
    rjit migrate-flutter <file.dart> --output out.tsx           Write to file
    rjit migrate-flutter <file.dart> --scaffold [name]          Convert + create a new project
    rjit migrate-flutter <file.dart> --dry-run                  Show analysis only

  What it converts:
    Widgets:    Column→Box(column), Row→Box(row), Container→Box, Text→Text,
                ElevatedButton→Pressable, TextField→TextInput, ListView→ScrollView,
                Scaffold→Box, Card→Box, GestureDetector→Pressable, AlertDialog→Modal
    Layout:     EdgeInsets→padding, MainAxisAlignment→justifyContent,
                CrossAxisAlignment→alignItems, Expanded→flexGrow, SizedBox→width/height
    Styling:    BoxDecoration→bg/border/shadow, TextStyle→fontSize/fontWeight/color,
                Colors.*→hex, Color(0x)→hex
    State:      StatefulWidget→useState, setState→setters, final fields→props
    Functions:  Dart→JavaScript (best-effort, needs review)
`);
    return;
  }

  const skipArgs = new Set();
  if (outputFile) skipArgs.add(outputFile);
  if (scaffoldName) skipArgs.add(scaffoldName);
  const fileArg = args.find(a => !a.startsWith('-') && !skipArgs.has(a));
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

  const parsed = parseFlutterSource(input);

  if (dryRun) {
    console.log(`\n  Analysis of ${fileArg}:\n`);
    console.log(`  Classes: ${parsed.classes.length}`);
    for (const cls of parsed.classes) {
      const typeStr = cls.stateOf ? ` (State<${cls.stateOf}>)` : cls.superclass === 'StatefulWidget' ? ' (StatefulWidget)' : ' (StatelessWidget)';
      console.log(`    ${cls.name}${typeStr}`);
      console.log(`      Properties: ${cls.properties.length}`);
      for (const p of cls.properties) {
        console.log(`        ${p.modifier} ${p.type || '?'} ${p.name}${p.defaultValue ? ' = ' + p.defaultValue.slice(0, 40) : ''}`);
      }
      console.log(`      Functions: ${cls.functions.length}`);
      for (const f of cls.functions) {
        console.log(`        ${f.name}(${f.args})`);
      }
      if (cls.buildSource) {
        const tree = parseWidgetBody(cls.buildSource);
        console.log(`      Widget tree: ${countNodes(tree)} nodes`);
        printTree(tree, '        ');
      }
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
  for (const n of (nodes || [])) {
    count++;
    if (n.children) count += countNodes(n.children);
  }
  return count;
}

function printTree(nodes, prefix) {
  for (const n of (nodes || [])) {
    const argsStr = n.positionalArgs?.length ? `(${n.positionalArgs[0]?.slice(0, 30) || ''})` : '';
    const namedStr = Object.keys(n.namedArgs || {}).length ? ` {${Object.keys(n.namedArgs).join(', ')}}` : '';
    console.log(`${prefix}${n.type}${argsStr}${namedStr}`);
    if (n.children?.length) printTree(n.children, prefix + '  ');
  }
}
