/**
 * migrate-tkinter.mjs — Python Tkinter → ReactJIT migration
 *
 * Converts a Tkinter application to a ReactJIT TSX component. Handles:
 *
 *   Widgets:    Label→Text, Button→Pressable, Entry→TextInput, Frame→Box,
 *               Canvas→Box, Listbox→ScrollView, Text→TextInput(multiline),
 *               Checkbutton→toggle Pressable, Radiobutton→selection Pressable,
 *               Scale→Slider, Toplevel→Modal, Menu→Box menu bar,
 *               ttk.Notebook→tabbed Box, ttk.Progressbar→animated Box,
 *               ttk.Combobox→dropdown, Scrollbar→ScrollView wrapper
 *
 *   Geometry:   pack(side,fill,expand,padx,pady) → flex layout
 *               grid(row,col,sticky,columnspan) → nested row/col Boxes
 *               place(x,y,width,height) → absolute positioning
 *
 *   State:      StringVar→useState<string>, IntVar→useState<number>,
 *               BooleanVar→useState<boolean>, DoubleVar→useState<number>
 *               .get()→stateVar, .set(v)→setStateVar(v)
 *
 *   Events:     bind('<Button-1>',fn)→onClick, bind('<Return>',fn)→onKeyDown,
 *               bind('<Enter>',fn)→onPointerEnter, bind('<Leave>',fn)→onPointerLeave,
 *               bind('<Key>',fn)→onKeyDown, command=fn→onClick
 *
 *   Styling:    bg/fg→backgroundColor/color, font tuple→fontSize+fontFamily+fontWeight,
 *               relief→borderWidth+shadow, bd→borderWidth, padx/pady→padding
 *
 *   Dialogs:    messagebox.showinfo→Modal, filedialog→onFileDrop,
 *               simpledialog→TextInput Modal
 *
 * Usage:
 *   rjit migrate-tkinter <app.py>                    # convert, print to stdout
 *   rjit migrate-tkinter <app.py> --output out.tsx   # write to file
 *   rjit migrate-tkinter <dir>                       # convert all .py files
 *   rjit migrate-tkinter <app.py> --dry-run          # show analysis only
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename, dirname, extname, relative, resolve } from 'node:path';
import { deriveProjectName } from '../lib/migration-core.mjs';
import { scaffoldProject } from './init.mjs';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WIDGET MAPPING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const WIDGET_MAP = {
  // Core tk widgets
  'Label':       { component: 'Text',       type: 'text' },
  'Button':      { component: 'Pressable',  type: 'button' },
  'Entry':       { component: 'TextInput',  type: 'input' },
  'Frame':       { component: 'Box',        type: 'container' },
  'LabelFrame':  { component: 'Box',        type: 'container', hasLabel: true },
  'Canvas':      { component: 'Box',        type: 'canvas' },
  'Listbox':     { component: 'ScrollView', type: 'list' },
  'Text':        { component: 'TextInput',  type: 'multiline' },
  'Scrollbar':   { component: null,         type: 'scrollbar' }, // absorbed into ScrollView
  'Checkbutton': { component: 'Pressable',  type: 'checkbox' },
  'Radiobutton': { component: 'Pressable',  type: 'radio' },
  'Scale':       { component: 'Box',        type: 'slider' },
  'Spinbox':     { component: 'TextInput',  type: 'input' },
  'Message':     { component: 'Text',       type: 'text' },
  'Toplevel':    { component: 'Modal',      type: 'modal' },
  'Menu':        { component: 'Box',        type: 'menu' },
  'Menubutton':  { component: 'Pressable',  type: 'button' },
  'OptionMenu':  { component: 'Box',        type: 'dropdown' },
  'PanedWindow': { component: 'Box',        type: 'container' },
  'Separator':   { component: 'Box',        type: 'separator' },

  // ttk variants (same mapping, slightly different default styling)
  'ttk.Label':       { component: 'Text',       type: 'text' },
  'ttk.Button':      { component: 'Pressable',  type: 'button' },
  'ttk.Entry':       { component: 'TextInput',  type: 'input' },
  'ttk.Frame':       { component: 'Box',        type: 'container' },
  'ttk.LabelFrame':  { component: 'Box',        type: 'container', hasLabel: true },
  'ttk.Checkbutton': { component: 'Pressable',  type: 'checkbox' },
  'ttk.Radiobutton': { component: 'Pressable',  type: 'radio' },
  'ttk.Scale':       { component: 'Box',        type: 'slider' },
  'ttk.Spinbox':     { component: 'TextInput',  type: 'input' },
  'ttk.Scrollbar':   { component: null,         type: 'scrollbar' },
  'ttk.Menubutton':  { component: 'Pressable',  type: 'button' },
  'ttk.Separator':   { component: 'Box',        type: 'separator' },
  'ttk.Notebook':    { component: 'Box',        type: 'notebook' },
  'ttk.Treeview':    { component: 'ScrollView', type: 'tree' },
  'ttk.Progressbar': { component: 'Box',        type: 'progressbar' },
  'ttk.Combobox':    { component: 'Box',        type: 'dropdown' },
  'ttk.Panedwindow': { component: 'Box',        type: 'container' },
  'ttk.Sizegrip':    { component: null,         type: 'skip' },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EVENT MAPPING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const EVENT_MAP = {
  '<Button-1>':       'onClick',
  '<ButtonRelease-1>': 'onRelease',
  '<Button-2>':       'onClick',     // middle click
  '<Button-3>':       'onClick',     // right click
  '<Double-Button-1>': 'onClick',
  '<Return>':         'onKeyDown',
  '<KP_Enter>':       'onKeyDown',
  '<Key>':            'onKeyDown',
  '<KeyPress>':       'onKeyDown',
  '<KeyRelease>':     'onKeyUp',
  '<Escape>':         'onKeyDown',
  '<Tab>':            'onKeyDown',
  '<space>':          'onKeyDown',
  '<BackSpace>':      'onKeyDown',
  '<Delete>':         'onKeyDown',
  '<Up>':             'onKeyDown',
  '<Down>':           'onKeyDown',
  '<Left>':           'onKeyDown',
  '<Right>':          'onKeyDown',
  '<Enter>':          'onPointerEnter',  // widget enter (hover), NOT keyboard Enter
  '<Leave>':          'onPointerLeave',
  '<Motion>':         'onDrag',          // mouse motion
  '<B1-Motion>':      'onDrag',          // drag with button held
  '<MouseWheel>':     'onWheel',
  '<FocusIn>':        'onFocus',
  '<FocusOut>':       'onBlur',
  '<Configure>':      'onLayout',
  '<Destroy>':        null,              // no equivalent, drop
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RELIEF → BORDER/SHADOW MAPPING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const RELIEF_MAP = {
  'FLAT':    {},
  'flat':    {},
  'RAISED':  { borderWidth: 1, borderColor: '#888888', shadowOffsetX: 1, shadowOffsetY: 1, shadowBlur: 2, shadowColor: 'rgba(0,0,0,0.3)' },
  'raised':  { borderWidth: 1, borderColor: '#888888', shadowOffsetX: 1, shadowOffsetY: 1, shadowBlur: 2, shadowColor: 'rgba(0,0,0,0.3)' },
  'SUNKEN':  { borderWidth: 1, borderColor: '#555555', shadowOffsetX: -1, shadowOffsetY: -1, shadowBlur: 2, shadowColor: 'rgba(0,0,0,0.2)' },
  'sunken':  { borderWidth: 1, borderColor: '#555555', shadowOffsetX: -1, shadowOffsetY: -1, shadowBlur: 2, shadowColor: 'rgba(0,0,0,0.2)' },
  'RIDGE':   { borderWidth: 2, borderColor: '#aaaaaa' },
  'ridge':   { borderWidth: 2, borderColor: '#aaaaaa' },
  'GROOVE':  { borderWidth: 2, borderColor: '#666666' },
  'groove':  { borderWidth: 2, borderColor: '#666666' },
  'SOLID':   { borderWidth: 1, borderColor: '#000000' },
  'solid':   { borderWidth: 1, borderColor: '#000000' },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TKINTER NAMED COLORS → HEX
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TK_COLORS = {
  'SystemButtonFace': '#f0f0f0', 'SystemWindow': '#ffffff', 'SystemWindowText': '#000000',
  'SystemHighlight': '#0078d7', 'SystemHighlightText': '#ffffff',
  'white': '#ffffff', 'black': '#000000', 'red': '#ff0000', 'green': '#00ff00',
  'blue': '#0000ff', 'yellow': '#ffff00', 'cyan': '#00ffff', 'magenta': '#ff00ff',
  'gray': '#808080', 'grey': '#808080', 'darkgray': '#a9a9a9', 'darkgrey': '#a9a9a9',
  'lightgray': '#d3d3d3', 'lightgrey': '#d3d3d3',
  'orange': '#ffa500', 'pink': '#ffc0cb', 'purple': '#800080', 'brown': '#a52a2a',
  'navy': '#000080', 'teal': '#008080', 'olive': '#808000', 'maroon': '#800000',
  'gold': '#ffd700', 'silver': '#c0c0c0', 'coral': '#ff7f50', 'salmon': '#fa8072',
  'tomato': '#ff6347', 'khaki': '#f0e68c', 'ivory': '#fffff0', 'beige': '#f5f5dc',
  'linen': '#faf0e6', 'wheat': '#f5deb3', 'tan': '#d2b48c', 'chocolate': '#d2691e',
  'firebrick': '#b22222', 'crimson': '#dc143c', 'indianred': '#cd5c5c',
  'lightcoral': '#f08080', 'darkred': '#8b0000', 'orangered': '#ff4500',
  'darkorange': '#ff8c00', 'lightyellow': '#ffffe0', 'lemonchiffon': '#fffacd',
  'darkgreen': '#006400', 'forestgreen': '#228b22', 'limegreen': '#32cd32',
  'lightgreen': '#90ee90', 'palegreen': '#98fb98', 'seagreen': '#2e8b57',
  'mediumseagreen': '#3cb371', 'springgreen': '#00ff7f',
  'darkblue': '#00008b', 'mediumblue': '#0000cd', 'royalblue': '#4169e1',
  'steelblue': '#4682b4', 'dodgerblue': '#1e90ff', 'deepskyblue': '#00bfff',
  'skyblue': '#87ceeb', 'lightskyblue': '#87cefa', 'lightblue': '#add8e6',
  'powderblue': '#b0e0e6', 'cadetblue': '#5f9ea0', 'cornflowerblue': '#6495ed',
  'slateblue': '#6a5acd', 'mediumpurple': '#9370db', 'blueviolet': '#8a2be2',
  'darkviolet': '#9400d3', 'darkorchid': '#9932cc', 'orchid': '#da70d6',
  'plum': '#dda0dd', 'violet': '#ee82ee', 'thistle': '#d8bfd8', 'lavender': '#e6e6fa',
  'hotpink': '#ff69b4', 'deeppink': '#ff1493', 'palevioletred': '#db7093',
  'mistyrose': '#ffe4e1', 'snow': '#fffafa', 'ghostwhite': '#f8f8ff',
  'whitesmoke': '#f5f5f5', 'gainsboro': '#dcdcdc', 'floralwhite': '#fffaf0',
  'oldlace': '#fdf5e6', 'antiquewhite': '#faebd7', 'papayawhip': '#ffefd5',
  'blanchedalmond': '#ffebcd', 'bisque': '#ffe4c4', 'peachpuff': '#ffdab9',
  'navajowhite': '#ffdead', 'moccasin': '#ffe4b5', 'cornsilk': '#fff8dc',
  'mintcream': '#f5fffa', 'azure': '#f0ffff', 'aliceblue': '#f0f8ff',
  'honeydew': '#f0fff0', 'seashell': '#fff5ee',
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PYTHON SOURCE PARSER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parse a Python Tkinter source file into a structured representation.
 * Returns: { widgets, variables, bindings, geometry, functions, rootConfig, imports, rawLines }
 */
export function parseTkinterSource(source) {
  const lines = source.split('\n');
  const result = {
    widgets: [],       // { name, widgetType, parent, kwargs, line }
    variables: [],     // { name, varType, defaultValue, line }
    bindings: [],      // { widget, event, handler, line }
    geometry: [],      // { widget, method, kwargs, line }
    functions: [],     // { name, body, args, line }
    menuItems: [],     // { menu, type, kwargs, line }
    rootConfig: {},    // title, geometry, bg, resizable, etc.
    afterCalls: [],    // { delay, callback, line }
    imports: [],       // what's imported
    rawLines: lines,
    warnings: [],
  };

  // Track which names are tk module aliases
  const tkAliases = new Set(['tk', 'tkinter', 'Tk']);
  const ttkAliases = new Set(['ttk']);
  let rootName = 'root';

  // ── Pass 1: Find imports and root window ──────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // import tkinter as tk
    const importAs = line.match(/^import\s+tkinter\s+as\s+(\w+)/);
    if (importAs) { tkAliases.add(importAs[1]); result.imports.push(line); continue; }

    // from tkinter import *
    if (/^from\s+tkinter\s+import\s+\*/.test(line)) {
      tkAliases.add(''); // empty prefix means bare names work
      result.imports.push(line);
      continue;
    }

    // from tkinter import ttk, messagebox, filedialog, etc.
    const fromImport = line.match(/^from\s+tkinter\s+import\s+(.+)/);
    if (fromImport) {
      const names = fromImport[1].split(',').map(s => s.trim());
      for (const n of names) {
        if (n === 'ttk') ttkAliases.add('ttk');
        if (n === 'Tk') tkAliases.add('');
      }
      result.imports.push(line);
      continue;
    }

    // from tkinter import messagebox / filedialog / simpledialog
    if (/^from\s+tkinter\s+import/.test(line)) {
      result.imports.push(line);
      continue;
    }

    // import tkinter
    if (/^import\s+tkinter\b/.test(line)) {
      tkAliases.add('tkinter');
      result.imports.push(line);
      continue;
    }

    // import ttkbootstrap / customtkinter etc.
    if (/^import\s+(ttkbootstrap|customtkinter)/.test(line) || /^from\s+(ttkbootstrap|customtkinter)/.test(line)) {
      result.imports.push(line);
      result.warnings.push(`Third-party tk library detected: "${line}" — styles may not map cleanly`);
      continue;
    }

    // root = tk.Tk() or root = Tk()
    const rootMatch = line.match(/^(\w+)\s*=\s*(?:(\w+)\.)?Tk\s*\(\s*\)/);
    if (rootMatch) {
      rootName = rootMatch[1];
      continue;
    }
  }

  // Build regex patterns for widget detection with all known aliases
  const tkPrefixes = [...tkAliases].filter(a => a).map(a => a + '\\.').concat(['']);
  const ttkPrefixes = [...ttkAliases].map(a => a + '\\.');
  const allWidgetNames = Object.keys(WIDGET_MAP);

  // ── Pass 2: Parse everything ──────────────────
  let currentFunction = null;
  let functionBody = [];
  let functionIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') continue;

    // ── Function definitions ──────────────────
    const funcMatch = trimmed.match(/^def\s+(\w+)\s*\(([^)]*)\)\s*:/);
    if (funcMatch) {
      // Save previous function
      if (currentFunction) {
        result.functions.push({ name: currentFunction.name, args: currentFunction.args, body: functionBody.join('\n'), line: currentFunction.line });
      }
      currentFunction = { name: funcMatch[1], args: funcMatch[2], line: i };
      functionBody = [];
      functionIndent = indent;
      continue;
    }

    // Collect function body
    if (currentFunction && indent > functionIndent) {
      functionBody.push(trimmed);
    } else if (currentFunction && indent <= functionIndent && trimmed !== '') {
      // Function ended
      result.functions.push({ name: currentFunction.name, args: currentFunction.args, body: functionBody.join('\n'), line: currentFunction.line });
      currentFunction = null;
      functionBody = [];
    }

    // ── Root window configuration ─────────────
    const titleMatch = trimmed.match(new RegExp(`^${rootName}\\.title\\s*\\(\\s*['"](.*?)['"]\\s*\\)`));
    if (titleMatch) { result.rootConfig.title = titleMatch[1]; continue; }

    const geoMatch = trimmed.match(new RegExp(`^${rootName}\\.geometry\\s*\\(\\s*['"]?(\\d+)x(\\d+)['"]?\\s*\\)`));
    if (geoMatch) { result.rootConfig.width = parseInt(geoMatch[1]); result.rootConfig.height = parseInt(geoMatch[2]); continue; }

    const configMatch = trimmed.match(new RegExp(`^${rootName}\\.(?:configure|config)\\s*\\((.+)\\)`));
    if (configMatch) {
      const kwargs = parseKwargs(configMatch[1]);
      if (kwargs.bg) result.rootConfig.bg = resolveColor(kwargs.bg);
      if (kwargs.background) result.rootConfig.bg = resolveColor(kwargs.background);
      continue;
    }

    const resizableMatch = trimmed.match(new RegExp(`^${rootName}\\.resizable\\s*\\((.+)\\)`));
    if (resizableMatch) { result.rootConfig.resizable = resizableMatch[1]; continue; }

    // Skip mainloop
    if (trimmed.match(new RegExp(`^${rootName}\\.mainloop\\s*\\(`))) continue;

    // ── Variable declarations ─────────────────
    const varMatch = trimmed.match(/^(\w+)\s*=\s*(?:(\w+)\.)?(?:tk\.)?(StringVar|IntVar|BooleanVar|DoubleVar)\s*\(([^)]*)\)/);
    if (varMatch) {
      const kwargs = parseKwargs(varMatch[4]);
      result.variables.push({
        name: varMatch[1],
        varType: varMatch[3],
        defaultValue: kwargs.value || kwargs[''] || null,
        line: i,
      });
      continue;
    }

    // ── Widget creation ───────────────────────
    let widgetMatch = null;
    for (const wName of allWidgetNames) {
      // Match: name = tk.Widget(parent, **kwargs) or name = Widget(parent, **kwargs)
      // Also handle ttk.Widget
      const patterns = [];
      if (wName.startsWith('ttk.')) {
        const bare = wName.slice(4);
        for (const pre of ttkPrefixes) {
          patterns.push(new RegExp(`^(\\w+)\\s*=\\s*${pre}${bare}\\s*\\((.*)\\)`, 's'));
        }
      } else {
        for (const pre of tkPrefixes) {
          patterns.push(new RegExp(`^(\\w+)\\s*=\\s*${pre}${wName}\\s*\\((.*)\\)`, 's'));
        }
      }
      for (const pat of patterns) {
        const m = trimmed.match(pat);
        if (m) {
          widgetMatch = { name: m[1], widgetType: wName, argsStr: m[2], line: i };
          break;
        }
      }
      if (widgetMatch) break;
    }

    if (widgetMatch) {
      // Parse constructor args: first positional is parent, rest are kwargs
      const { parent, kwargs } = parseWidgetArgs(widgetMatch.argsStr);
      result.widgets.push({
        name: widgetMatch.name,
        widgetType: widgetMatch.widgetType,
        parent: parent,
        kwargs: kwargs,
        line: i,
      });
      continue;
    }

    // ── Geometry manager calls ────────────────
    const geoCallMatch = trimmed.match(/^(\w+)\.(pack|grid|place)\s*\(([^)]*)\)/);
    if (geoCallMatch) {
      const kwargs = parseKwargs(geoCallMatch[3]);
      result.geometry.push({
        widget: geoCallMatch[1],
        method: geoCallMatch[2],
        kwargs: kwargs,
        line: i,
      });
      continue;
    }

    // ── Event bindings ────────────────────────
    const bindMatch = trimmed.match(/^(\w+)\.bind\s*\(\s*['"](<[^'"]+>)['"]\s*,\s*(\w+)\s*\)/);
    if (bindMatch) {
      result.bindings.push({
        widget: bindMatch[1],
        event: bindMatch[2],
        handler: bindMatch[3],
        line: i,
      });
      continue;
    }

    // ── Widget.configure() / .config() ────────
    const widgetConfigMatch = trimmed.match(/^(\w+)\.(?:configure|config)\s*\((.+)\)/);
    if (widgetConfigMatch) {
      // Find the widget and merge kwargs
      const wName = widgetConfigMatch[1];
      const kwargs = parseKwargs(widgetConfigMatch[2]);
      const existing = result.widgets.find(w => w.name === wName);
      if (existing) {
        Object.assign(existing.kwargs, kwargs);
      }
      continue;
    }

    // ── Menu.add_command / add_separator / add_cascade ─
    const menuAddMatch = trimmed.match(/^(\w+)\.(add_command|add_separator|add_cascade|add_checkbutton|add_radiobutton)\s*\(([^)]*)\)/);
    if (menuAddMatch) {
      const kwargs = parseKwargs(menuAddMatch[3]);
      result.menuItems.push({
        menu: menuAddMatch[1],
        type: menuAddMatch[2],
        kwargs: kwargs,
        line: i,
      });
      continue;
    }

    // ── root.after() calls ────────────────────
    const afterMatch = trimmed.match(/^(\w+)\.after\s*\(\s*(\d+)\s*,\s*(\w+)\s*\)/);
    if (afterMatch) {
      result.afterCalls.push({
        widget: afterMatch[1],
        delay: parseInt(afterMatch[2]),
        callback: afterMatch[3],
        line: i,
      });
      continue;
    }

    // ── messagebox calls ──────────────────────
    if (trimmed.includes('messagebox.show') || trimmed.includes('messagebox.ask')) {
      result.warnings.push(`[line ${i + 1}] messagebox call → convert to Modal component`);
      continue;
    }

    // ── filedialog calls ──────────────────────
    if (trimmed.includes('filedialog.')) {
      result.warnings.push(`[line ${i + 1}] filedialog call → use onFileDrop or custom file picker`);
      continue;
    }
  }

  // Save last function
  if (currentFunction) {
    result.functions.push({ name: currentFunction.name, args: currentFunction.args, body: functionBody.join('\n'), line: currentFunction.line });
  }

  result._rootName = rootName;
  return result;
}


/**
 * Parse Python keyword arguments from a string like:
 *   text="Hello", bg='#333', font=("Arial", 14), command=on_click, width=30
 * Returns an object of key-value pairs.
 */
function parseKwargs(str) {
  const kwargs = {};
  if (!str || !str.trim()) return kwargs;

  let i = 0;
  const s = str.trim();

  while (i < s.length) {
    // Skip whitespace and commas
    while (i < s.length && (s[i] === ' ' || s[i] === ',' || s[i] === '\t' || s[i] === '\n')) i++;
    // Bail on stray `)` — can appear when outer regex already stripped the real closing paren
    if (i < s.length && s[i] === ')') { i++; continue; }
    if (i >= s.length) break;

    // Read key
    let key = '';
    while (i < s.length && s[i] !== '=' && s[i] !== ',' && s[i] !== ')') {
      key += s[i]; i++;
    }
    key = key.trim();

    if (i >= s.length || s[i] !== '=') {
      // Positional arg
      if (key) kwargs[kwargs._posCount || 0] = key;
      kwargs._posCount = (kwargs._posCount || 0) + 1;
      continue;
    }

    i++; // skip =

    // Skip whitespace
    while (i < s.length && s[i] === ' ') i++;

    // Read value
    let value = '';
    if (s[i] === '"' || s[i] === "'") {
      // Quoted string
      const quote = s[i]; i++;
      while (i < s.length && s[i] !== quote) {
        if (s[i] === '\\') { value += s[i]; i++; }
        value += s[i]; i++;
      }
      if (i < s.length) i++; // skip closing quote
    } else if (s[i] === '(') {
      // Tuple: font=("Arial", 14, "bold")
      let depth = 0;
      while (i < s.length) {
        if (s[i] === '(') depth++;
        else if (s[i] === ')') { depth--; if (depth === 0) { value += s[i]; i++; break; } }
        value += s[i]; i++;
      }
    } else if (s[i] === '[') {
      // List
      let depth = 0;
      while (i < s.length) {
        if (s[i] === '[') depth++;
        else if (s[i] === ']') { depth--; if (depth === 0) { value += s[i]; i++; break; } }
        value += s[i]; i++;
      }
    } else if (s[i] === '{') {
      // Dict
      let depth = 0;
      while (i < s.length) {
        if (s[i] === '{') depth++;
        else if (s[i] === '}') { depth--; if (depth === 0) { value += s[i]; i++; break; } }
        value += s[i]; i++;
      }
    } else {
      // Bare value (number, identifier, tk.CONSTANT, f-string, etc.)
      // Track quotes so we don't stop at `)` or `,` inside strings
      let inQ = null;
      while (i < s.length) {
        const ch = s[i];
        if (inQ) {
          if (ch === inQ && s[i - 1] !== '\\') inQ = null;
          value += ch; i++;
        } else if (ch === '"' || ch === "'") {
          inQ = ch; value += ch; i++;
        } else if (ch === ',' || ch === '\n') {
          break;
        } else if (ch === ')') {
          // Only stop if not inside parens within the value
          break;
        } else {
          value += ch; i++;
        }
      }
      value = value.trim();
    }

    kwargs[key] = value;
  }

  // Clean up positional counter
  delete kwargs._posCount;
  return kwargs;
}


/**
 * Parse widget constructor args — first positional arg is parent, rest are kwargs.
 */
function parseWidgetArgs(argsStr) {
  // Handle multiline constructors
  const clean = argsStr.replace(/\n\s*/g, ' ').trim();

  // Find first comma that's not inside parens/brackets/quotes
  let parent = '';
  let depth = 0;
  let inStr = null;
  let i = 0;

  for (; i < clean.length; i++) {
    const ch = clean[i];
    if (inStr) {
      if (ch === inStr && clean[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; continue; }
    if (ch === ')' || ch === ']' || ch === '}') { depth--; continue; }
    if (ch === ',' && depth === 0) break;
  }

  parent = clean.slice(0, i).trim();
  const rest = clean.slice(i + 1).trim();
  const kwargs = parseKwargs(rest);

  return { parent, kwargs };
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STYLE CONVERSION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Convert tk widget kwargs to ReactJIT style object */
function convertStyle(kwargs, widgetType) {
  const style = {};
  const warnings = [];

  // ── Colors ──────────────────────────────────
  if (kwargs.bg || kwargs.background) {
    style.backgroundColor = resolveColor(kwargs.bg || kwargs.background);
  }
  if (kwargs.fg || kwargs.foreground) {
    style.color = resolveColor(kwargs.fg || kwargs.foreground);
  }
  if (kwargs.selectbackground) {
    // Store for hover/active style generation
    style._selectBg = resolveColor(kwargs.selectbackground);
  }
  if (kwargs.selectforeground) {
    style._selectFg = resolveColor(kwargs.selectforeground);
  }
  if (kwargs.activebackground) {
    style._activeBg = resolveColor(kwargs.activebackground);
  }
  if (kwargs.activeforeground) {
    style._activeFg = resolveColor(kwargs.activeforeground);
  }
  if (kwargs.disabledforeground) {
    style._disabledFg = resolveColor(kwargs.disabledforeground);
  }
  if (kwargs.highlightbackground) {
    style.outlineColor = resolveColor(kwargs.highlightbackground);
  }
  if (kwargs.highlightcolor) {
    style.outlineColor = resolveColor(kwargs.highlightcolor);
  }
  if (kwargs.insertbackground) {
    // Cursor color — no direct equivalent
  }

  // ── Font ────────────────────────────────────
  if (kwargs.font) {
    const font = parseFont(kwargs.font);
    if (font.family) style.fontFamily = font.family;
    if (font.size) style.fontSize = font.size;
    if (font.weight) style.fontWeight = font.weight;
    if (font.slant === 'italic') style.fontStyle = 'italic';
    if (font.underline) style.textDecorationLine = 'underline';
    if (font.overstrike) style.textDecorationLine = 'line-through';
  }

  // ── Dimensions ──────────────────────────────
  if (kwargs.width) {
    const w = parseInt(kwargs.width);
    if (!isNaN(w)) {
      // tk width for text widgets is in characters, for others it's pixels
      if (['text', 'input', 'multiline', 'button'].includes(widgetType)) {
        style.width = w * 8; // approximate character width
      } else {
        style.width = w;
      }
    }
  }
  if (kwargs.height) {
    const h = parseInt(kwargs.height);
    if (!isNaN(h)) {
      if (['text', 'multiline'].includes(widgetType)) {
        style.height = h * 20; // approximate line height
      } else {
        style.height = h;
      }
    }
  }

  // ── Padding ─────────────────────────────────
  if (kwargs.padx) {
    const px = parseInt(kwargs.padx);
    if (!isNaN(px)) { style.paddingLeft = px; style.paddingRight = px; }
  }
  if (kwargs.pady) {
    const py = parseInt(kwargs.pady);
    if (!isNaN(py)) { style.paddingTop = py; style.paddingBottom = py; }
  }
  if (kwargs.ipadx) {
    const ipx = parseInt(kwargs.ipadx);
    if (!isNaN(ipx)) { style.paddingLeft = (style.paddingLeft || 0) + ipx; style.paddingRight = (style.paddingRight || 0) + ipx; }
  }
  if (kwargs.ipady) {
    const ipy = parseInt(kwargs.ipady);
    if (!isNaN(ipy)) { style.paddingTop = (style.paddingTop || 0) + ipy; style.paddingBottom = (style.paddingBottom || 0) + ipy; }
  }
  if (kwargs.padding) {
    // ttk padding: single number or tuple
    const p = parsePadding(kwargs.padding);
    Object.assign(style, p);
  }

  // ── Border ──────────────────────────────────
  if (kwargs.bd || kwargs.borderwidth) {
    style.borderWidth = parseInt(kwargs.bd || kwargs.borderwidth) || 0;
  }
  if (kwargs.relief) {
    const r = kwargs.relief.replace(/^tk\./, '').replace(/^tkinter\./, '');
    const reliefStyle = RELIEF_MAP[r];
    if (reliefStyle) Object.assign(style, reliefStyle);
  }
  if (kwargs.highlightthickness) {
    const ht = parseInt(kwargs.highlightthickness);
    if (ht > 0) { style.outlineWidth = ht; }
  }

  // ── Text alignment ─────────────────────────
  if (kwargs.anchor) {
    const anchor = kwargs.anchor.replace(/^tk\./, '');
    if (['center', 'CENTER'].includes(anchor)) style.textAlign = 'center';
    else if (['e', 'E', 'ne', 'se'].includes(anchor)) style.textAlign = 'right';
    else if (['w', 'W', 'nw', 'sw'].includes(anchor)) style.textAlign = 'left';
  }
  if (kwargs.justify) {
    const j = kwargs.justify.replace(/^tk\./, '').toLowerCase();
    if (j === 'center') style.textAlign = 'center';
    else if (j === 'right') style.textAlign = 'right';
    else style.textAlign = 'left';
  }

  // ── Wrapping ────────────────────────────────
  if (kwargs.wraplength) {
    style.maxWidth = parseInt(kwargs.wraplength);
  }

  // ── Cursor (no-op in ReactJIT) ──────────────
  // kwargs.cursor — skip

  // ── State ───────────────────────────────────
  if (kwargs.state === 'disabled' || kwargs.state === 'tk.DISABLED') {
    style.opacity = 0.5;
  }

  // ── Border radius for rounded corners ───────
  // tk doesn't have border-radius natively, but ttk themes sometimes do
  // We'll add a small radius for buttons and entries for a modern look
  if (['button', 'input', 'dropdown'].includes(widgetType) && !style.borderRadius) {
    style.borderRadius = 4;
  }

  return { style, warnings };
}


/** Resolve a Tkinter color value to hex */
function resolveColor(val) {
  if (!val) return null;
  val = val.trim().replace(/^['"]|['"]$/g, '');
  // Already hex
  if (val.startsWith('#')) return val;
  // Named color
  if (TK_COLORS[val.toLowerCase()]) return TK_COLORS[val.toLowerCase()];
  // tk.CONSTANT
  val = val.replace(/^tk\./, '').replace(/^tkinter\./, '');
  if (TK_COLORS[val.toLowerCase()]) return TK_COLORS[val.toLowerCase()];
  return val; // pass through
}


/** Parse a tk font specification */
function parseFont(fontStr) {
  const result = {};
  if (!fontStr) return result;

  fontStr = fontStr.trim();

  // Tuple format: ("Arial", 14) or ("Arial", 14, "bold") or ("Arial", 14, "bold italic")
  const tupleMatch = fontStr.match(/^\(?\s*['"]([^'"]+)['"]\s*,\s*(\d+)(?:\s*,\s*['"]([^'"]+)['"])?\s*\)?$/);
  if (tupleMatch) {
    result.family = tupleMatch[1];
    result.size = parseInt(tupleMatch[2]);
    if (tupleMatch[3]) {
      const modifiers = tupleMatch[3].toLowerCase();
      if (modifiers.includes('bold')) result.weight = 'bold';
      if (modifiers.includes('italic')) result.slant = 'italic';
      if (modifiers.includes('underline')) result.underline = true;
      if (modifiers.includes('overstrike')) result.overstrike = true;
    }
    return result;
  }

  // Named font: "TkDefaultFont" or "Helvetica 12 bold"
  const parts = fontStr.replace(/^['"]|['"]$/g, '').split(/\s+/);
  if (parts.length >= 1) result.family = parts[0];
  if (parts.length >= 2 && /^\d+$/.test(parts[1])) result.size = parseInt(parts[1]);
  if (parts.includes('bold')) result.weight = 'bold';
  if (parts.includes('italic')) result.slant = 'italic';

  return result;
}


/** Parse tk/ttk padding value */
function parsePadding(padStr) {
  if (!padStr) return {};
  const clean = padStr.replace(/[()]/g, '').trim();
  const parts = clean.split(/[\s,]+/).map(s => parseInt(s.trim()));
  if (parts.length === 1) return { padding: parts[0] };
  if (parts.length === 2) return { paddingLeft: parts[0], paddingRight: parts[0], paddingTop: parts[1], paddingBottom: parts[1] };
  if (parts.length === 4) return { paddingLeft: parts[0], paddingTop: parts[1], paddingRight: parts[2], paddingBottom: parts[3] };
  return { padding: parts[0] };
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GEOMETRY → FLEX LAYOUT CONVERSION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Convert pack/grid/place geometry to flex layout styles.
 * Returns { containerStyle, itemStyle } — container style goes on the parent,
 * item style goes on the widget itself.
 */
function convertGeometry(geo) {
  const containerHints = {};
  const itemStyle = {};
  const warnings = [];

  if (geo.method === 'pack') {
    const k = geo.kwargs;

    // side → flexDirection on parent
    const side = (k.side || 'TOP').replace(/^tk\./, '').toUpperCase();
    if (side === 'LEFT' || side === 'RIGHT') {
      containerHints.flexDirection = 'row';
    } else {
      containerHints.flexDirection = 'column';
    }

    // fill → width/height
    const fill = (k.fill || 'NONE').replace(/^tk\./, '').toUpperCase();
    if (fill === 'X' || fill === 'BOTH') itemStyle.width = '100%';
    if (fill === 'Y' || fill === 'BOTH') itemStyle.height = '100%';

    // expand → flexGrow
    if (k.expand === 'True' || k.expand === '1' || k.expand === 'tk.YES' || k.expand === 'YES') {
      itemStyle.flexGrow = 1;
    }

    // padx/pady → margin on the item
    if (k.padx) {
      const px = parseInt(k.padx);
      if (!isNaN(px)) { itemStyle.marginLeft = px; itemStyle.marginRight = px; }
    }
    if (k.pady) {
      const py = parseInt(k.pady);
      if (!isNaN(py)) { itemStyle.marginTop = py; itemStyle.marginBottom = py; }
    }

    // anchor → alignSelf
    if (k.anchor) {
      const a = k.anchor.replace(/^tk\./, '').toLowerCase();
      if (a === 'center') itemStyle.alignSelf = 'center';
      else if (a === 'w' || a === 'nw' || a === 'sw') itemStyle.alignSelf = 'start';
      else if (a === 'e' || a === 'ne' || a === 'se') itemStyle.alignSelf = 'end';
    }

  } else if (geo.method === 'grid') {
    const k = geo.kwargs;

    // Grid layout → we generate row/column structure in the tree builder
    containerHints._isGrid = true;
    containerHints._row = parseInt(k.row) || 0;
    containerHints._col = parseInt(k.column || k.col) || 0;
    containerHints._rowspan = parseInt(k.rowspan) || 1;
    containerHints._colspan = parseInt(k.columnspan) || 1;

    // sticky → alignment + fill
    if (k.sticky) {
      const sticky = k.sticky.replace(/['"]/g, '').toLowerCase();
      if (sticky.includes('e') && sticky.includes('w')) itemStyle.width = '100%';
      if (sticky.includes('n') && sticky.includes('s')) itemStyle.height = '100%';
      if (sticky === 'nsew' || sticky === 'news') {
        itemStyle.width = '100%';
        itemStyle.height = '100%';
        itemStyle.flexGrow = 1;
      }
      if (sticky === 'ew' || sticky === 'we') itemStyle.width = '100%';
      if (sticky === 'ns' || sticky === 'sn') itemStyle.height = '100%';
    }

    // padx/pady → margin
    if (k.padx) {
      const px = parseInt(k.padx);
      if (!isNaN(px)) { itemStyle.marginLeft = px; itemStyle.marginRight = px; }
    }
    if (k.pady) {
      const py = parseInt(k.pady);
      if (!isNaN(py)) { itemStyle.marginTop = py; itemStyle.marginBottom = py; }
    }

  } else if (geo.method === 'place') {
    const k = geo.kwargs;

    itemStyle.position = 'absolute';
    if (k.x) itemStyle.left = parseInt(k.x);
    if (k.y) itemStyle.top = parseInt(k.y);
    if (k.width) itemStyle.width = parseInt(k.width);
    if (k.height) itemStyle.height = parseInt(k.height);
    if (k.relx) {
      const rx = parseFloat(k.relx);
      itemStyle.left = `${Math.round(rx * 100)}%`;
    }
    if (k.rely) {
      const ry = parseFloat(k.rely);
      itemStyle.top = `${Math.round(ry * 100)}%`;
    }
    if (k.relwidth) itemStyle.width = `${Math.round(parseFloat(k.relwidth) * 100)}%`;
    if (k.relheight) itemStyle.height = `${Math.round(parseFloat(k.relheight) * 100)}%`;

    if (k.anchor) {
      warnings.push(`place anchor="${k.anchor}" → needs manual transform.translate adjustment`);
    }
  }

  return { containerHints, itemStyle, warnings };
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CODE GENERATOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a complete ReactJIT TSX component from the parsed Tkinter structure.
 */
export function generateReactJIT(parsed) {
  const components = new Set(['Box']);
  const warnings = [...parsed.warnings];

  // ── Build widget tree ───────────────────────
  // Map widget names to their parsed data
  const widgetMap = {};
  for (const w of parsed.widgets) {
    widgetMap[w.name] = w;
  }

  // Map widgets to their geometry
  const geoMap = {};
  for (const g of parsed.geometry) {
    geoMap[g.widget] = g;
  }

  // Map widgets to their bindings
  const bindMap = {};
  for (const b of parsed.bindings) {
    if (!bindMap[b.widget]) bindMap[b.widget] = [];
    bindMap[b.widget].push(b);
  }

  // Build parent → children relationships
  const children = {}; // parent → [child names in order]
  for (const w of parsed.widgets) {
    const parent = w.parent || parsed._rootName;
    if (!children[parent]) children[parent] = [];
    children[parent].push(w.name);
  }

  // Detect grid layout: group children by row/col
  function getGridLayout(parentName) {
    const kids = children[parentName] || [];
    const gridChildren = [];
    let isGrid = false;

    for (const kidName of kids) {
      const geo = geoMap[kidName];
      if (geo && geo.method === 'grid') {
        isGrid = true;
        const row = parseInt(geo.kwargs.row) || 0;
        const col = parseInt(geo.kwargs.column || geo.kwargs.col) || 0;
        gridChildren.push({ name: kidName, row, col });
      }
    }

    if (!isGrid) return null;

    // Group by row
    const rows = {};
    for (const gc of gridChildren) {
      if (!rows[gc.row]) rows[gc.row] = [];
      rows[gc.row].push(gc);
    }

    // Sort rows and cols
    const sortedRows = Object.keys(rows).map(Number).sort((a, b) => a - b);
    for (const r of sortedRows) {
      rows[r].sort((a, b) => a.col - b.col);
    }

    return { rows, sortedRows };
  }

  // Detect pack layout direction
  function getPackDirection(parentName) {
    const kids = children[parentName] || [];
    let hasHorizontal = false;
    let hasVertical = false;

    for (const kidName of kids) {
      const geo = geoMap[kidName];
      if (geo && geo.method === 'pack') {
        const side = (geo.kwargs.side || 'TOP').replace(/^tk\./, '').toUpperCase();
        if (side === 'LEFT' || side === 'RIGHT') hasHorizontal = true;
        else hasVertical = true;
      }
    }

    if (hasHorizontal && !hasVertical) return 'row';
    return 'column'; // default
  }

  // ── Generate widget JSX ─────────────────────
  // Returns an array of indented JSX lines (no shared mutable state)
  function generateWidget(widgetName, depth) {
    const out = [];
    const ind = (d) => '  '.repeat(d);

    const w = widgetMap[widgetName];
    if (!w) return out; // root or unknown

    const mapping = WIDGET_MAP[w.widgetType];
    if (!mapping || !mapping.component) {
      if (mapping && mapping.type === 'scrollbar') return out; // absorbed
      if (mapping && mapping.type === 'skip') return out;
      warnings.push(`Widget "${w.widgetType}" for "${widgetName}" — no mapping, skipped`);
      return out;
    }

    components.add(mapping.component);
    if (mapping.component === 'Pressable') components.add('Text');

    const { style: widgetStyle, warnings: styleWarnings } = convertStyle(w.kwargs, mapping.type);
    warnings.push(...styleWarnings);

    // Merge geometry styles
    const geo = geoMap[widgetName];
    let geoItemStyle = {};
    if (geo) {
      const geoResult = convertGeometry(geo);
      geoItemStyle = geoResult.itemStyle;
      warnings.push(...geoResult.warnings);
    }

    const mergedStyle = { ...widgetStyle, ...geoItemStyle };

    // Remove internal-only style keys
    const activeBg = mergedStyle._activeBg; delete mergedStyle._activeBg;
    const activeFg = mergedStyle._activeFg; delete mergedStyle._activeFg;
    const selectBg = mergedStyle._selectBg; delete mergedStyle._selectBg;
    const selectFg = mergedStyle._selectFg; delete mergedStyle._selectFg;
    const disabledFg = mergedStyle._disabledFg; delete mergedStyle._disabledFg;

    // Build event props
    const events = [];
    const bindings = bindMap[widgetName] || [];
    for (const b of bindings) {
      const rjitEvent = EVENT_MAP[b.event];
      if (rjitEvent === null) continue;
      if (rjitEvent) {
        events.push(`${rjitEvent}={${b.handler}}`);
      } else {
        warnings.push(`Unknown tk event "${b.event}" on "${widgetName}"`);
      }
    }

    // command= prop → onClick
    if (w.kwargs.command) {
      events.push(`onClick={${w.kwargs.command}}`);
    }

    // textvariable / variable → value + onChange
    let valueBinding = null;
    if (w.kwargs.textvariable) {
      valueBinding = w.kwargs.textvariable;
    }
    if (w.kwargs.variable) {
      valueBinding = w.kwargs.variable;
    }

    const kids = children[widgetName] || [];
    const hasKids = kids.length > 0;
    const evStr = events.length ? ' ' + events.join(' ') : '';

    // Helper to collect child widget output
    const childLines = (kidNames, kidDepth) => {
      const cl = [];
      for (const kn of kidNames) cl.push(...generateWidget(kn, kidDepth));
      return cl;
    };

    // ── Generate by widget type ───────────────
    switch (mapping.type) {
      case 'text': {
        const text = w.kwargs.text || w.kwargs.textvariable || '';
        const isVar = parsed.variables.some(v => v.name === text);
        const textContent = isVar ? `{${text}}` :
          text.startsWith("f'") || text.startsWith('f"') ? `{\`${text.slice(2, -1)}\`}` :
          text;
        const styleStr = formatStyle(mergedStyle);
        out.push(`${ind(depth)}<Text${styleStr}${evStr}>${textContent}</Text>`);
        break;
      }

      case 'button': {
        const text = w.kwargs.text || 'Button';
        const isVar = parsed.variables.some(v => v.name === text);
        const textContent = isVar ? `{${text}}` : text;
        const styleStr = formatStyle(mergedStyle);
        let hoverStr = '';
        if (activeBg || activeFg) {
          const hs = {};
          if (activeBg) hs.backgroundColor = activeBg;
          if (activeFg) hs.color = activeFg;
          hoverStr = ` hoverStyle={${inlineStyle(hs)}}`;
        }
        out.push(`${ind(depth)}<Pressable${styleStr}${hoverStr}${evStr}>`);
        out.push(`${ind(depth + 1)}<Text${mergedStyle.color ? ` style={{ color: '${mergedStyle.color}' }}` : ''}>${textContent}</Text>`);
        out.push(`${ind(depth)}</Pressable>`);
        break;
      }

      case 'input': {
        const styleStr = formatStyle(mergedStyle);
        let valueStr = '';
        if (valueBinding) {
          valueStr = ` value={${valueBinding}} onTextInput={(e) => set${capitalize(valueBinding)}(e.text)}`;
        }
        const placeholder = w.kwargs.placeholder || '';
        const placeholderStr = placeholder ? ` placeholder="${placeholder}"` : '';
        out.push(`${ind(depth)}<TextInput${styleStr}${valueStr}${placeholderStr}${evStr} />`);
        break;
      }

      case 'multiline': {
        const styleStr = formatStyle(mergedStyle);
        out.push(`${ind(depth)}<TextInput${styleStr} multiline${evStr} />`);
        warnings.push(`tk.Text "${widgetName}" → TextInput multiline — rich text features need manual conversion`);
        break;
      }

      case 'container': {
        const gridLayout = getGridLayout(widgetName);

        if (gridLayout) {
          const containerStyle = { ...mergedStyle };
          if (!containerStyle.flexDirection) containerStyle.flexDirection = 'column';
          const styleStr = formatStyle(containerStyle);

          if (mapping.hasLabel && w.kwargs.text) {
            out.push(`${ind(depth)}{/* ${w.kwargs.text} */}`);
          }
          out.push(`${ind(depth)}<Box${styleStr}>`);

          for (const rowIdx of gridLayout.sortedRows) {
            const cols = gridLayout.rows[rowIdx];
            if (cols.length === 1) {
              out.push(...generateWidget(cols[0].name, depth + 1));
            } else {
              out.push(`${ind(depth + 1)}<Box style={{ flexDirection: 'row', gap: 8 }}>`);
              for (const col of cols) {
                out.push(...generateWidget(col.name, depth + 2));
              }
              out.push(`${ind(depth + 1)}</Box>`);
            }
          }

          out.push(`${ind(depth)}</Box>`);
        } else {
          const dir = getPackDirection(widgetName);
          const containerStyle = { ...mergedStyle };
          if (dir === 'row') containerStyle.flexDirection = 'row';

          const childGeos = kids.map(k => geoMap[k]).filter(Boolean);
          if (childGeos.length > 0) {
            const avgPad = childGeos.reduce((sum, g) => {
              return sum + (parseInt(g.kwargs.pady || g.kwargs.padx || 0) || 0);
            }, 0) / childGeos.length;
            if (avgPad > 0) containerStyle.gap = Math.round(avgPad);
          }

          const styleStr = formatStyle(containerStyle);

          if (mapping.hasLabel && w.kwargs.text) {
            out.push(`${ind(depth)}{/* ${w.kwargs.text} */}`);
          }
          out.push(`${ind(depth)}<Box${styleStr}>`);
          out.push(...childLines(kids, depth + 1));
          out.push(`${ind(depth)}</Box>`);
        }
        break;
      }

      case 'list': {
        components.add('ScrollView');
        components.add('Pressable');
        const styleStr = formatStyle({ ...mergedStyle, overflow: 'scroll' });
        out.push(`${ind(depth)}<ScrollView${styleStr}>`);
        out.push(`${ind(depth + 1)}{/* TODO: populate list items from data */}`);
        out.push(`${ind(depth + 1)}{items.map((item, i) => (`);
        out.push(`${ind(depth + 2)}<Pressable key={i} onClick={() => onSelect(i)}>`);
        out.push(`${ind(depth + 3)}<Text>{item}</Text>`);
        out.push(`${ind(depth + 2)}</Pressable>`);
        out.push(`${ind(depth + 1)}))}`);
        out.push(`${ind(depth)}</ScrollView>`);
        break;
      }

      case 'canvas': {
        const styleStr = formatStyle(mergedStyle);
        out.push(`${ind(depth)}<Box${styleStr}>`);
        out.push(`${ind(depth + 1)}{/* TODO: Canvas "${widgetName}" — use Scene3D or manual drawing */}`);
        out.push(`${ind(depth)}</Box>`);
        warnings.push(`Canvas "${widgetName}" → Box placeholder — canvas drawing needs manual conversion`);
        break;
      }

      case 'checkbox': {
        const text = w.kwargs.text || '';
        const variable = w.kwargs.variable;
        const styleStr = formatStyle(mergedStyle);
        out.push(`${ind(depth)}<Pressable${styleStr} onClick={() => set${capitalize(variable || widgetName)}(prev => !prev)}>`);
        out.push(`${ind(depth + 1)}<Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>`);
        out.push(`${ind(depth + 2)}<Box style={{ width: 18, height: 18, borderWidth: 2, borderColor: '#666', borderRadius: 3, backgroundColor: ${variable || widgetName} ? '#3b82f6' : 'transparent' }} />`);
        out.push(`${ind(depth + 2)}<Text>${text}</Text>`);
        out.push(`${ind(depth + 1)}</Box>`);
        out.push(`${ind(depth)}</Pressable>`);
        break;
      }

      case 'radio': {
        const text = w.kwargs.text || '';
        const variable = w.kwargs.variable;
        const value = w.kwargs.value || `'${text}'`;
        const styleStr = formatStyle(mergedStyle);
        out.push(`${ind(depth)}<Pressable${styleStr} onClick={() => set${capitalize(variable || widgetName)}(${value})}>`);
        out.push(`${ind(depth + 1)}<Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>`);
        out.push(`${ind(depth + 2)}<Box style={{ width: 18, height: 18, borderWidth: 2, borderColor: '#666', borderRadius: 9, backgroundColor: ${variable || widgetName} === ${value} ? '#3b82f6' : 'transparent' }} />`);
        out.push(`${ind(depth + 2)}<Text>${text}</Text>`);
        out.push(`${ind(depth + 1)}</Box>`);
        out.push(`${ind(depth)}</Pressable>`);
        break;
      }

      case 'slider': {
        const variable = w.kwargs.variable;
        const from = w.kwargs['from_'] || w.kwargs.from || '0';
        const to = w.kwargs.to || '100';
        const orient = (w.kwargs.orient || 'HORIZONTAL').replace(/^tk\./, '').toUpperCase();
        const isHoriz = orient === 'HORIZONTAL';
        const styleStr = formatStyle({ ...mergedStyle, flexDirection: isHoriz ? 'row' : 'column', alignItems: 'center', gap: 8 });
        out.push(`${ind(depth)}<Box${styleStr}>`);
        out.push(`${ind(depth + 1)}<Text>{${variable || widgetName}}</Text>`);
        out.push(`${ind(depth + 1)}{/* TODO: implement slider — range ${from} to ${to} */}`);
        out.push(`${ind(depth + 1)}<Box style={{ ${isHoriz ? 'width: 200, height: 4' : 'width: 4, height: 200'}, backgroundColor: '#444', borderRadius: 2 }}>`);
        out.push(`${ind(depth + 2)}<Box style={{ ${isHoriz ? `width: \`\${((${variable || widgetName} - ${from}) / (${to} - ${from})) * 100}%\`` : `height: \`\${((${variable || widgetName} - ${from}) / (${to} - ${from})) * 100}%\``}, ${isHoriz ? 'height' : 'width'}: '100%', backgroundColor: '#3b82f6', borderRadius: 2 }} />`);
        out.push(`${ind(depth + 1)}</Box>`);
        out.push(`${ind(depth)}</Box>`);
        break;
      }

      case 'separator': {
        const orient = (w.kwargs.orient || 'HORIZONTAL').replace(/^tk\./, '').toUpperCase();
        if (orient === 'HORIZONTAL') {
          out.push(`${ind(depth)}<Box style={{ width: '100%', height: 1, backgroundColor: '#444' }} />`);
        } else {
          out.push(`${ind(depth)}<Box style={{ width: 1, height: '100%', backgroundColor: '#444' }} />`);
        }
        break;
      }

      case 'progressbar': {
        const variable = w.kwargs.variable || 'progress';
        const max = w.kwargs.maximum || '100';
        const styleStr = formatStyle({ ...mergedStyle, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden' });
        out.push(`${ind(depth)}<Box${styleStr}>`);
        out.push(`${ind(depth + 1)}<Box style={{ width: \`\${(${variable} / ${max}) * 100}%\`, height: '100%', backgroundColor: '#3b82f6', borderRadius: 4 }} />`);
        out.push(`${ind(depth)}</Box>`);
        break;
      }

      case 'notebook': {
        components.add('Pressable');
        out.push(`${ind(depth)}{/* Notebook "${widgetName}" — tabbed interface */}`);
        const styleStr = formatStyle(mergedStyle);
        out.push(`${ind(depth)}<Box${styleStr}>`);
        out.push(`${ind(depth + 1)}<Box style={{ flexDirection: 'row', gap: 0, borderBottomWidth: 1, borderColor: '#444' }}>`);
        out.push(`${ind(depth + 2)}{tabs.map((tab, i) => (`);
        out.push(`${ind(depth + 3)}<Pressable key={i} onClick={() => setActiveTab(i)} style={{ padding: 8, backgroundColor: activeTab === i ? '#333' : 'transparent' }}>`);
        out.push(`${ind(depth + 4)}<Text style={{ color: activeTab === i ? '#fff' : '#888' }}>{tab.label}</Text>`);
        out.push(`${ind(depth + 3)}</Pressable>`);
        out.push(`${ind(depth + 2)}))}`);
        out.push(`${ind(depth + 1)}</Box>`);
        out.push(`${ind(depth + 1)}{/* Tab content renders here based on activeTab */}`);
        out.push(`${ind(depth)}</Box>`);
        warnings.push(`Notebook "${widgetName}" → manual tab state management needed`);
        break;
      }

      case 'modal': {
        components.add('Modal');
        const title = w.kwargs.title || '';
        out.push(`${ind(depth)}{${widgetName}Visible && (`);
        out.push(`${ind(depth + 1)}<Modal visible={${widgetName}Visible} onClose={() => set${capitalize(widgetName)}Visible(false)}>`);
        if (title) out.push(`${ind(depth + 2)}<Text style={{ fontSize: 18, fontWeight: 'bold' }}>${title}</Text>`);
        out.push(...childLines(kids, depth + 2));
        out.push(`${ind(depth + 1)}</Modal>`);
        out.push(`${ind(depth)})}`);
        break;
      }

      case 'menu': {
        const items = parsed.menuItems.filter(mi => mi.menu === widgetName);
        if (items.length > 0) {
          out.push(`${ind(depth)}<Box style={{ flexDirection: 'row', backgroundColor: '#2a2a2a', padding: 4, gap: 2 }}>`);
          for (const item of items) {
            if (item.type === 'add_separator') {
              out.push(`${ind(depth + 1)}<Box style={{ width: 1, height: 20, backgroundColor: '#555' }} />`);
            } else if (item.type === 'add_cascade') {
              out.push(`${ind(depth + 1)}{/* Menu cascade: ${item.kwargs.label || 'submenu'} */}`);
              out.push(`${ind(depth + 1)}<Pressable style={{ padding: 4, paddingLeft: 12, paddingRight: 12, borderRadius: 3 }}>`);
              out.push(`${ind(depth + 2)}<Text style={{ color: '#ccc', fontSize: 13 }}>${item.kwargs.label || 'Menu'}</Text>`);
              out.push(`${ind(depth + 1)}</Pressable>`);
            } else {
              const label = item.kwargs.label || '';
              const cmd = item.kwargs.command || '() => {}';
              out.push(`${ind(depth + 1)}<Pressable onClick={${cmd}} style={{ padding: 4, paddingLeft: 12, paddingRight: 12, borderRadius: 3 }}>`);
              out.push(`${ind(depth + 2)}<Text style={{ color: '#ccc', fontSize: 13 }}>${label}</Text>`);
              out.push(`${ind(depth + 1)}</Pressable>`);
            }
          }
          out.push(`${ind(depth)}</Box>`);
        }
        break;
      }

      case 'dropdown': {
        const variable = w.kwargs.textvariable || w.kwargs.variable;
        const styleStr = formatStyle({ ...mergedStyle, borderWidth: 1, borderColor: '#555', borderRadius: 4, padding: 8 });
        out.push(`${ind(depth)}<Pressable${styleStr} onClick={() => set${capitalize(widgetName)}Open(prev => !prev)}>`);
        out.push(`${ind(depth + 1)}<Text>{${variable || `'Select...'`}}</Text>`);
        out.push(`${ind(depth)}</Pressable>`);
        out.push(`${ind(depth)}{/* TODO: dropdown menu for "${widgetName}" — render options list when open */}`);
        break;
      }

      default: {
        const styleStr = formatStyle(mergedStyle);
        out.push(`${ind(depth)}<Box${styleStr}>`);
        out.push(...childLines(kids, depth + 1));
        if (!hasKids) out.push(`${ind(depth + 1)}{/* ${w.widgetType} "${widgetName}" */}`);
        out.push(`${ind(depth)}</Box>`);
      }
    }

    return out;
  }

  // ── Generate the full component ─────────────

  // Determine the component name from the root title or filename
  const componentName = parsed.rootConfig.title
    ? parsed.rootConfig.title.replace(/[^a-zA-Z0-9]/g, '')
    : 'App';

  // Header: imports
  const headerLines = [];

  // useState declarations for variables
  const stateDecls = [];
  for (const v of parsed.variables) {
    const typeMap = { 'StringVar': 'string', 'IntVar': 'number', 'BooleanVar': 'boolean', 'DoubleVar': 'number' };
    const defaultMap = { 'StringVar': "''", 'IntVar': '0', 'BooleanVar': 'false', 'DoubleVar': '0' };
    const tsType = typeMap[v.varType] || 'any';
    const defaultVal = v.defaultValue || defaultMap[v.varType] || "''";
    let cleanDefault = defaultVal.replace(/^['"]|['"]$/g, '');
    // Convert Python literals to JS
    if (cleanDefault === 'True') cleanDefault = 'true';
    else if (cleanDefault === 'False') cleanDefault = 'false';
    else if (cleanDefault === 'None') cleanDefault = 'null';
    const jsDefault = tsType === 'string' ? `'${cleanDefault}'` : cleanDefault;
    stateDecls.push(`  const [${v.name}, set${capitalize(v.name)}] = useState<${tsType}>(${jsDefault});`);
  }

  // Convert Python functions to JS function stubs
  const funcDecls = [];
  for (const f of parsed.functions) {
    if (['__init__', '__del__'].includes(f.name)) continue;
    const jsArgs = f.args.replace(/self,?\s*/, '').replace(/\bevent\b/, 'e').replace(/:\s*\w+/g, '');
    funcDecls.push(`  // Converted from Python: def ${f.name}(${f.args})`);
    funcDecls.push(`  const ${f.name} = (${jsArgs}) => {`);
    // Convert body lines
    const bodyLines = f.body.split('\n').filter(l => l.trim());
    for (const bl of bodyLines) {
      funcDecls.push(`    ${convertPythonLine(bl, parsed.variables)}`);
    }
    funcDecls.push(`  };`);
    funcDecls.push('');
  }

  // afterCalls → useEffect with setTimeout (tk after() is a one-shot timer)
  const effectDecls = [];
  for (const ac of parsed.afterCalls) {
    effectDecls.push(`  // Converted from: ${ac.widget}.after(${ac.delay}, ${ac.callback})`);
    effectDecls.push(`  // Note: Tkinter after() is a one-shot setTimeout. If the callback calls after()`);
    effectDecls.push(`  // again recursively, consider converting to setInterval instead.`);
    effectDecls.push(`  useEffect(() => {`);
    effectDecls.push(`    const timer = setTimeout(${ac.callback}, ${ac.delay});`);
    effectDecls.push(`    return () => clearTimeout(timer);`);
    effectDecls.push(`  }, []);`);
    effectDecls.push('');
  }

  // ── Build the JSX tree ──────────────────────
  const rootStyle = {
    width: parsed.rootConfig.width ? `${parsed.rootConfig.width}` : "'100%'",
    height: parsed.rootConfig.height ? `${parsed.rootConfig.height}` : "'100%'",
  };
  if (parsed.rootConfig.bg) rootStyle.backgroundColor = `'${parsed.rootConfig.bg}'`;

  const rootKids = children[parsed._rootName] || [];
  const rootDir = getPackDirection(parsed._rootName);
  const rootGrid = getGridLayout(parsed._rootName);

  const jsxLines = [];
  const ind = (d) => '  '.repeat(d);

  // Root container
  const rootStyleParts = Object.entries(rootStyle).map(([k, v]) => {
    if (typeof v === 'number') return `${k}: ${v}`;
    if (v.startsWith("'")) return `${k}: ${v}`;
    return `${k}: ${v}`;
  });
  if (rootDir === 'row') rootStyleParts.push("flexDirection: 'row'");

  jsxLines.push(`${ind(2)}<Box style={{ ${rootStyleParts.join(', ')} }}>`);

  // Menu bar (if root has a menu configured)
  const rootMenuConfig = parsed.widgets.find(w => w.widgetType === 'Menu' && (w.parent === parsed._rootName || w.parent === ''));
  if (rootMenuConfig) {
    const rootMenuItems = parsed.menuItems.filter(mi => mi.menu === rootMenuConfig.name);
    if (rootMenuItems.length > 0) {
      jsxLines.push(`${ind(3)}<Box style={{ flexDirection: 'row', backgroundColor: '#2a2a2a', padding: 4, gap: 2 }}>`);
      for (const item of rootMenuItems) {
        if (item.type === 'add_cascade') {
          jsxLines.push(`${ind(4)}<Pressable style={{ padding: 4, paddingLeft: 12, paddingRight: 12, borderRadius: 3 }}>`);
          jsxLines.push(`${ind(5)}<Text style={{ color: '#ccc', fontSize: 13 }}>${item.kwargs.label || 'Menu'}</Text>`);
          jsxLines.push(`${ind(4)}</Pressable>`);
          components.add('Pressable');
        }
      }
      jsxLines.push(`${ind(3)}</Box>`);
    }
  }

  if (rootGrid) {
    for (const rowIdx of rootGrid.sortedRows) {
      const cols = rootGrid.rows[rowIdx];
      if (cols.length === 1) {
        jsxLines.push(...generateWidget(cols[0].name, 3));
      } else {
        jsxLines.push(`${ind(3)}<Box style={{ flexDirection: 'row', gap: 8 }}>`);
        for (const col of cols) {
          jsxLines.push(...generateWidget(col.name, 4));
        }
        jsxLines.push(`${ind(3)}</Box>`);
      }
    }
  } else {
    for (const kidName of rootKids) {
      jsxLines.push(...generateWidget(kidName, 3));
    }
  }

  jsxLines.push(`${ind(2)}</Box>`);

  // ── Assemble final output ───────────────────
  const output = [];

  output.push(`import React, { useState, useEffect } from 'react';`);
  output.push(`import { ${[...components].sort().join(', ')} } from '@reactjit/core';`);
  output.push('');

  if (parsed.rootConfig.title) {
    output.push(`// Migrated from Tkinter: "${parsed.rootConfig.title}"`);
  }
  output.push(`// Original window: ${parsed.rootConfig.width || '?'}x${parsed.rootConfig.height || '?'}`);
  output.push('');

  output.push(`export default function ${componentName}() {`);

  // State
  if (stateDecls.length > 0) {
    output.push(...stateDecls);
    output.push('');
  }

  // Functions
  if (funcDecls.length > 0) {
    output.push(...funcDecls);
  }

  // Effects
  if (effectDecls.length > 0) {
    output.push(...effectDecls);
  }

  output.push('  return (');
  output.push(...jsxLines);
  output.push('  );');
  output.push('}');

  return {
    code: output.join('\n'),
    warnings: [...new Set(warnings)],
    components: [...components],
    stats: {
      widgets: parsed.widgets.length,
      variables: parsed.variables.length,
      functions: parsed.functions.length,
      bindings: parsed.bindings.length,
      routes: parsed.menuItems.length,
    },
  };
}


/** Format a style object as a JSX style attribute */
function formatStyle(style) {
  const entries = Object.entries(style).filter(([k]) => !k.startsWith('_'));
  if (entries.length === 0) return '';

  const parts = entries.map(([k, v]) => {
    if (typeof v === 'number') return `${k}: ${v}`;
    // Coerce pure-numeric strings to numbers (e.g. '200' → 200, but keep '100%')
    if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) return `${k}: ${Number(v)}`;
    if (typeof v === 'string') return `${k}: '${v}'`;
    return `${k}: ${v}`;
  });

  if (parts.length <= 3) {
    return ` style={{ ${parts.join(', ')} }}`;
  }
  return ` style={{\n    ${parts.join(',\n    ')}\n  }}`;
}

/** Format style as inline object (no style= wrapper) */
function inlineStyle(obj) {
  const parts = Object.entries(obj).map(([k, v]) => {
    if (typeof v === 'string') return `${k}: '${v}'`;
    return `${k}: ${v}`;
  });
  return `{ ${parts.join(', ')} }`;
}

/** Capitalize first letter */
function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}


/**
 * Best-effort conversion of a single Python line to JavaScript.
 * NOT a full transpiler — just handles the most common patterns.
 */
function convertPythonLine(pyLine, variables) {
  let line = pyLine.trim();

  // Skip pass, comments
  if (line === 'pass') return '// pass';
  if (line.startsWith('#')) return '/' + line;

  // var.set(value) → setVar(value)
  for (const v of variables) {
    const setPattern = new RegExp(`\\b${v.name}\\.set\\((.+)\\)`, 'g');
    line = line.replace(setPattern, `set${capitalize(v.name)}($1)`);
    const getPattern = new RegExp(`\\b${v.name}\\.get\\(\\)`, 'g');
    line = line.replace(getPattern, v.name);
  }

  // widget.config(text=X) → // widget config (complex, skip)
  if (/\w+\.config\(/.test(line) || /\w+\.configure\(/.test(line)) {
    return `// TODO: ${line}`;
  }

  // if/elif/else
  line = line.replace(/^if\s+(.+):$/, 'if ($1) {');
  line = line.replace(/^elif\s+(.+):$/, '} else if ($1) {');
  line = line.replace(/^else\s*:$/, '} else {');

  // for loop
  line = line.replace(/^for\s+(\w+)\s+in\s+range\((.+)\):$/, 'for (let $1 = 0; $1 < $2; $1++) {');
  line = line.replace(/^for\s+(\w+)\s+in\s+(.+):$/, 'for (const $1 of $2) {');

  // while
  line = line.replace(/^while\s+(.+):$/, 'while ($1) {');

  // return
  line = line.replace(/^return\s+(.+)$/, 'return $1;');

  // print → console.log
  line = line.replace(/\bprint\s*\(/, 'console.log(');

  // len() → .length
  line = line.replace(/\blen\((\w+)\)/g, '$1.length');

  // str() → String()
  line = line.replace(/\bstr\((.+?)\)/g, 'String($1)');

  // int() → parseInt()
  line = line.replace(/\bint\((.+?)\)/g, 'parseInt($1)');

  // float() → parseFloat()
  line = line.replace(/\bfloat\((.+?)\)/g, 'parseFloat($1)');

  // True/False/None → true/false/null
  line = line.replace(/\bTrue\b/g, 'true');
  line = line.replace(/\bFalse\b/g, 'false');
  line = line.replace(/\bNone\b/g, 'null');

  // and/or/not → &&/||/!
  // Use space-aware patterns so we don't mangle words like "command", "notation", "cannot"
  // Allow non-word chars (parens, operators) as boundaries too
  line = line.replace(/(?<=\s|[^a-zA-Z0-9_])and(?=\s)/g, '&&');
  line = line.replace(/(?<=\s|[^a-zA-Z0-9_])or(?=\s)/g, '||');
  line = line.replace(/(?<=^|\s|[^a-zA-Z0-9_])not(?=\s)/g, '!');

  // self.X → this.X (in case of class methods, though we flatten)
  line = line.replace(/\bself\./g, '');

  // f-strings: f"Hello {name}" → `Hello ${name}`
  line = line.replace(/f['"](.+?)['"]/g, (match, inner) => {
    return '`' + inner.replace(/\{/g, '${') + '`';
  });

  // Assignment with type hint → let
  line = line.replace(/^(\w+)\s*:\s*\w+\s*=\s*(.+)$/, 'let $1 = $2;');

  // Simple assignment → let (can't track first-use vs reassignment without full scope analysis)
  if (/^\w+\s*=\s*.+$/.test(line) && !line.includes('==') && !line.startsWith('let ') && !line.startsWith('const ')) {
    line = 'let ' + line + ';';
  }

  // .append() → .push()
  line = line.replace(/\.append\(/g, '.push(');

  // .items() → Object.entries()
  line = line.replace(/(\w+)\.items\(\)/g, 'Object.entries($1)');

  // .keys() → Object.keys()
  line = line.replace(/(\w+)\.keys\(\)/g, 'Object.keys($1)');

  // .values() → Object.values()
  line = line.replace(/(\w+)\.values\(\)/g, 'Object.values($1)');

  // Add semicolon if missing
  if (line && !line.endsWith('{') && !line.endsWith('}') && !line.endsWith(';') && !line.startsWith('//') && !line.startsWith('/*')) {
    line += ';';
  }

  return line;
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLI ENTRY POINT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function migrateTkinterCommand(args) {
  const helpMode = args.includes('--help') || args.includes('-h');
  const dryRun = args.includes('--dry-run');
  const outputIdx = args.indexOf('--output');
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;
  const scaffoldIdx = args.indexOf('--scaffold');
  const scaffoldName = (scaffoldIdx !== -1 && args[scaffoldIdx + 1] && !args[scaffoldIdx + 1].startsWith('-'))
    ? args[scaffoldIdx + 1] : null;
  const scaffoldMode = scaffoldIdx !== -1;

  if (scaffoldMode && outputFile) {
    console.error('  Cannot use --scaffold and --output together.');
    process.exit(1);
  }

  if (helpMode) {
    console.log(`
  rjit migrate-tkinter — Convert Python Tkinter apps to ReactJIT

  Usage:
    rjit migrate-tkinter <app.py>                          Convert and print to stdout
    rjit migrate-tkinter <app.py> --output out.tsx          Write to file
    rjit migrate-tkinter <app.py> --scaffold [name]         Convert + create a new project
    rjit migrate-tkinter <app.py> --dry-run                 Show analysis only

  What it converts:
    Widgets:    Label→Text, Button→Pressable, Entry→TextInput, Frame→Box,
                Canvas→Box, Listbox→ScrollView, Checkbutton/Radiobutton→Pressable,
                Scale→slider Box, Toplevel→Modal, Menu→menu bar Box
    Layout:     pack()→flex, grid()→nested rows, place()→absolute positioning
    State:      StringVar→useState<string>, IntVar→useState<number>
    Events:     bind('<Button-1>')→onClick, bind('<Return>')→onKeyDown
    Styling:    bg/fg→colors, font tuple→fontSize/fontFamily, relief→border+shadow
    Functions:  Python→JavaScript (best-effort, needs review)
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

  // Parse
  const parsed = parseTkinterSource(input);

  if (dryRun) {
    console.log(`\n  Analysis of ${fileArg}:\n`);
    console.log(`  Root window: ${parsed.rootConfig.title || 'untitled'} (${parsed.rootConfig.width || '?'}x${parsed.rootConfig.height || '?'})`);
    console.log(`  Widgets:     ${parsed.widgets.length}`);
    console.log(`  Variables:   ${parsed.variables.length}`);
    console.log(`  Functions:   ${parsed.functions.length}`);
    console.log(`  Bindings:    ${parsed.bindings.length}`);
    console.log(`  Menu items:  ${parsed.menuItems.length}`);
    console.log(`  after() calls: ${parsed.afterCalls.length}`);
    console.log(`\n  Widgets:`);
    for (const w of parsed.widgets) {
      const geo = parsed.geometry.find(g => g.widget === w.name);
      const geoStr = geo ? ` [${geo.method}]` : ' [no geometry]';
      const mapping = WIDGET_MAP[w.widgetType];
      console.log(`    ${w.name}: ${w.widgetType} → ${mapping?.component || '???'}${geoStr}`);
    }
    if (parsed.variables.length > 0) {
      console.log(`\n  Variables:`);
      for (const v of parsed.variables) {
        console.log(`    ${v.name}: ${v.varType} = ${v.defaultValue || 'default'}`);
      }
    }
    if (parsed.warnings.length > 0) {
      console.log(`\n  Warnings:`);
      for (const w of parsed.warnings) {
        console.log(`    ${w}`);
      }
    }
    console.log('');
    return;
  }

  // Generate
  const result = generateReactJIT(parsed);

  // Output
  if (scaffoldMode) {
    const projectName = scaffoldName || deriveProjectName(fileArg);
    const dest = join(process.cwd(), projectName);
    scaffoldProject(dest, { name: projectName, appTsx: result.code });
    console.log(`  Converted ${fileArg} → ${projectName}/src/App.tsx`);
    console.log(`  ${result.stats.widgets} widgets, ${result.stats.variables} state vars, ${result.stats.functions} functions`);
    console.log(`  Components: ${result.components.join(', ')}`);
    if (result.warnings.length > 0) {
      console.log(`  ${result.warnings.length} warning(s):`);
      for (const w of result.warnings) {
        console.log(`    ${w}`);
      }
    }
    console.log(`\n  Next steps:`);
    console.log(`    cd ${projectName}`);
    console.log(`    reactjit dev`);
  } else if (outputFile) {
    writeFileSync(outputFile, result.code, 'utf-8');
    console.log(`  Converted ${fileArg} → ${outputFile}`);
    console.log(`  ${result.stats.widgets} widgets, ${result.stats.variables} state vars, ${result.stats.functions} functions`);
    console.log(`  Components: ${result.components.join(', ')}`);
    if (result.warnings.length > 0) {
      console.log(`  ${result.warnings.length} warning(s):`);
      for (const w of result.warnings) {
        console.log(`    ${w}`);
      }
    }
  } else {
    process.stdout.write(result.code);
    if (process.stderr.isTTY) {
      console.error(`\n--- ${result.stats.widgets} widgets | ${result.components.join(', ')} | ${result.warnings.length} warning(s) ---`);
    }
  }
}
