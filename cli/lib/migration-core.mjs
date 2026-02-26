/**
 * migration-core.mjs — Shared conversion pipeline for all migration scripts.
 *
 * Each migration script (blessed, swiftui, tkinter, convert) parses source code
 * into a common IR (intermediate representation), then calls assembleComponent()
 * to generate ReactJIT TSX output.
 *
 * IR shape:
 *   {
 *     componentName: string,
 *     source: { framework, title? },
 *     state: [{ name, setter, type?, defaultValue }],
 *     effects: [{ setup, cleanup?, deps? }],
 *     functions: [{ name, args, body }],
 *     tree: WidgetNode[],
 *     keybindings?: [{ keys, comment }],
 *     warnings?: string[],
 *     extraComponents?: string[],   // additional component functions (tabs, etc.)
 *   }
 *
 * WidgetNode shape:
 *   {
 *     component: 'Box'|'Text'|'Pressable'|'TextInput'|'ScrollView'|'Modal'|'Image',
 *     style?: {},           hoverStyle?: {},
 *     events?: {},          props?: {},
 *     label?: string,       textContent?: string,
 *     comment?: string,     children?: WidgetNode[],
 *     isConditional?: { condition },
 *     isMap?: { collection, itemVar, keyExpr? },
 *     isFragment?: boolean,
 *     tableData?: { headers: string[], rows?: string },
 *   }
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function toPascalCase(str) {
  return str.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
}

export function escapeStr(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function indent(depth) {
  return '  '.repeat(depth);
}

/**
 * Infer a TypeScript type annotation from a JS value expression.
 * Returns '<number>', '<string>', etc. or '' if unknown.
 */
export function inferTypeAnnotation(value) {
  if (!value) return '';
  const v = value.trim();
  if (/^\d+$/.test(v)) return '<number>';
  if (v === 'true' || v === 'false') return '<boolean>';
  if (v.startsWith("'") || v.startsWith('"') || v.startsWith('`')) return '<string>';
  if (v === '[]' || v.startsWith('[')) return '<any[]>';
  if (v === '{}' || v.startsWith('{')) return '';
  if (v === 'null') return '';
  return '';
}

/**
 * Strip blessed {tag} markup from strings.
 * e.g. "{bold}Hello{/bold} {red-fg}World{/red-fg}" → "Hello World"
 */
export function stripBlessedTags(str) {
  if (!str) return str;
  return str.replace(/\{\/?\w+(?:-\w+)?\}/g, '');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COLOR RESOLUTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Comprehensive color map: terminal colors + CSS named colors */
export const STANDARD_COLORS = {
  // Terminal colors (blessed/curses)
  'white':        '#FFFFFF', 'black':       '#000000',
  'red':          '#EF4444', 'green':       '#22C55E',
  'blue':         '#3B82F6', 'yellow':      '#EAB308',
  'cyan':         '#06B6D4', 'magenta':     '#A855F7',
  'gray':         '#6B7280', 'grey':        '#6B7280',
  'lightred':     '#F87171', 'lightgreen':  '#4ADE80',
  'lightblue':    '#60A5FA', 'lightyellow': '#FDE047',
  'lightcyan':    '#22D3EE', 'lightmagenta':'#C084FC',
  'lightwhite':   '#F8FAFC', 'lightblack':  '#374151',
  'lightgray':    '#9CA3AF', 'lightgrey':   '#9CA3AF',
  'darkred':      '#991B1B', 'darkgreen':   '#166534',
  'darkblue':     '#1E3A5F', 'darkyellow':  '#A16207',
  'darkcyan':     '#0E7490', 'darkmagenta': '#7E22CE',
  // CSS/Tkinter named colors
  'orange':       '#F97316', 'purple':      '#A855F7',
  'pink':         '#EC4899', 'brown':       '#92400E',
  'navy':         '#1E3A5F', 'teal':        '#14B8A6',
  'maroon':       '#7F1D1D', 'olive':       '#84CC16',
  'aqua':         '#06B6D4', 'silver':      '#C0C0C0',
  'gold':         '#EAB308', 'lime':        '#84CC16',
  'indigo':       '#6366F1', 'coral':       '#F97316',
  'salmon':       '#FA8072', 'khaki':       '#F0E68C',
  'ivory':        '#FFFFF0', 'azure':       '#F0FFFF',
  'beige':        '#F5F5DC', 'lavender':    '#E6E6FA',
  'linen':        '#FAF0E6', 'wheat':       '#F5DEB3',
  'tomato':       '#FF6347', 'orchid':      '#DA70D6',
  'plum':         '#DDA0DD', 'peru':        '#CD853F',
  'sienna':       '#A0522D', 'tan':         '#D2B48C',
  'crimson':      '#DC143C', 'firebrick':   '#B22222',
  'transparent':  'transparent',
  'default':      null,
};

/**
 * Resolve a color name to hex. Passes through hex/rgb values unchanged.
 */
export function resolveColor(color) {
  if (!color) return null;
  const c = String(color).trim().replace(/^['"]|['"]$/g, '');
  if (c.startsWith('#') || c.startsWith('rgb') || c === 'transparent') return c;
  return STANDARD_COLORS[c.toLowerCase()] || c;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STYLE FORMATTING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Format a single style entry value for JSX output */
function formatValue(v) {
  if (typeof v === 'number') return `${v}`;
  if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) return `${Number(v)}`;
  if (typeof v === 'string') return `'${v}'`;
  return `${v}`;
}

/**
 * Convert a style object into a JSX style attribute string.
 * Returns '' if no style properties, or ' style={{ ... }}' or multi-line.
 */
export function formatStyleAttr(style) {
  if (!style) return '';
  const entries = Object.entries(style).filter(([k]) => !k.startsWith('_'));
  if (entries.length === 0) return '';
  const parts = entries.map(([k, v]) => `${k}: ${formatValue(v)}`);
  if (parts.length <= 3) return ` style={{ ${parts.join(', ')} }}`;
  return ` style={{\n    ${parts.join(',\n    ')}\n  }}`;
}

/**
 * Convert a style object into a JS object literal string (no 'style=' wrapper).
 */
export function formatStyleObj(style) {
  if (!style) return '{}';
  const entries = Object.entries(style).filter(([k]) => !k.startsWith('_'));
  if (entries.length === 0) return '{}';
  const parts = entries.map(([k, v]) => `${k}: ${formatValue(v)}`);
  return `{ ${parts.join(', ')} }`;
}

/**
 * Clean up a style object: remove undefined/null values, coerce numeric strings.
 */
export function normalizeStyle(style) {
  if (!style) return {};
  const out = {};
  for (const [k, v] of Object.entries(style)) {
    if (v === undefined || v === null) continue;
    if (k.startsWith('_')) continue;
    out[k] = v;
  }
  return out;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATE & EFFECT GENERATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a useState declaration line.
 * @param {{ name: string, setter?: string, type?: string, defaultValue: string }} sv
 */
export function generateStateDecl(sv) {
  const setter = sv.setter || `set${capitalize(sv.name)}`;
  const type = sv.type ? `<${sv.type}>` : inferTypeAnnotation(sv.defaultValue);
  return `  const [${sv.name}, ${setter}] = useState${type}(${sv.defaultValue});`;
}

/**
 * Generate a useEffect declaration block.
 * @param {{ setup: string, cleanup?: string, deps?: string }} eff
 */
export function generateEffectDecl(eff) {
  const lines = [];
  lines.push(`  useEffect(() => {`);
  for (const line of eff.setup.split('\n')) {
    lines.push(`    ${line}`);
  }
  if (eff.cleanup) {
    lines.push(`    return () => { ${eff.cleanup} };`);
  }
  lines.push(`  }, [${eff.deps || ''}]);`);
  return lines.join('\n');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JSX TREE GENERATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a JSX tree from WidgetNode[].
 * Tracks used components via the `components` Set.
 *
 * @param {WidgetNode[]} nodes
 * @param {number} depth - indentation depth
 * @param {Set<string>} components - collects used component names
 * @returns {string[]} lines of JSX
 */
export function generateJSXTree(nodes, depth, components) {
  const out = [];
  const ind = indent(depth);

  for (const node of nodes) {
    // Fragment wrapper
    if (node.isFragment) {
      out.push(`${ind}<>`);
      if (node.children?.length) {
        out.push(...generateJSXTree(node.children, depth + 1, components));
      }
      out.push(`${ind}</>`);
      continue;
    }

    // Conditional rendering
    if (node.isConditional) {
      out.push(`${ind}{${node.isConditional.condition} && (`);
      // Render the node itself (without the conditional wrapper)
      const inner = { ...node, isConditional: undefined };
      out.push(...generateJSXTree([inner], depth + 1, components));
      out.push(`${ind})}`);
      continue;
    }

    // Map/iteration
    if (node.isMap) {
      const { collection, itemVar, keyExpr } = node.isMap;
      out.push(`${ind}{${collection}.map((${itemVar}, i) => (`);
      if (node.children?.length) {
        out.push(...generateJSXTree(node.children, depth + 1, components));
      }
      out.push(`${ind}))}`);
      continue;
    }

    // Comment-only node
    if (node.comment && !node.component) {
      out.push(`${ind}{/* ${node.comment} */}`);
      continue;
    }

    const comp = node.component;
    if (comp) components.add(comp);

    // Section label (rendered before the node — skip for table nodes, generateTableJSX handles its own label)
    if (node.label && !node.tableData) {
      out.push(`${ind}<Text style={{ fontSize: 12, fontWeight: '600', color: '#888', paddingBottom: 4 }}>{"${escapeStr(node.label)}"}</Text>`);
      components.add('Text');
    }

    // Build attributes
    const attrs = [];

    // Style
    const styleStr = formatStyleAttr(node.style);
    if (styleStr) attrs.push(styleStr);

    // Hover style
    if (node.hoverStyle && Object.keys(node.hoverStyle).length > 0) {
      attrs.push(` hoverStyle={${formatStyleObj(node.hoverStyle)}}`);
    }

    // Events
    if (node.events) {
      for (const [evName, handler] of Object.entries(node.events)) {
        attrs.push(` ${evName}={${handler}}`);
      }
    }

    // Props
    if (node.props) {
      for (const [propName, val] of Object.entries(node.props)) {
        attrs.push(` ${propName}=${val}`);
      }
    }

    // Comment inline
    if (node.comment) {
      out.push(`${ind}{/* ${node.comment} */}`);
    }

    const attrStr = attrs.join('');
    const hasChildren = (node.children?.length > 0) || node.textContent || node.tableData;

    // Table node (listtable/table with data)
    if (node.tableData) {
      components.add('ScrollView');
      components.add('Text');
      out.push(...generateTableJSX(node, depth, components));
      continue;
    }

    // Self-closing if no children
    if (!hasChildren) {
      out.push(`${ind}<${comp}${attrStr} />`);
      continue;
    }

    // Open tag
    out.push(`${ind}<${comp}${attrStr}>`);

    // Text content
    if (node.textContent) {
      components.add('Text');
      if (comp === 'Text') {
        // Text node with content — just put content inside
        out.pop(); // remove the open tag we just pushed
        out.push(`${ind}<Text${attrStr}>${node.textContent}</Text>`);
        continue;
      } else {
        out.push(`${indent(depth + 1)}<Text>${node.textContent}</Text>`);
      }
    }

    // Recurse children
    if (node.children?.length) {
      out.push(...generateJSXTree(node.children, depth + 1, components));
    }

    // Close tag
    out.push(`${ind}</${comp}>`);
  }

  return out;
}

/**
 * Generate JSX for a table node with headers and data rows.
 */
export function generateTableJSX(node, depth, components) {
  const out = [];
  const ind = indent(depth);
  const { headers, rows } = node.tableData;

  const styleStr = formatStyleAttr(node.style);

  // Section label
  if (node.label) {
    out.push(`${ind}<Text style={{ fontSize: 12, fontWeight: '600', color: '#888', paddingBottom: 4 }}>{"${escapeStr(node.label)}"}</Text>`);
    components.add('Text');
  }

  out.push(`${ind}<ScrollView${styleStr}>`);

  // Header row
  if (headers && headers.length > 0) {
    out.push(`${indent(depth + 1)}<Box style={{ flexDirection: 'row', gap: 16, paddingBottom: 8 }}>`);
    components.add('Box');
    for (const h of headers) {
      out.push(`${indent(depth + 2)}<Text style={{ fontWeight: 'bold', color: '#3B82F6', minWidth: 80 }}>${stripBlessedTags(h)}</Text>`);
    }
    out.push(`${indent(depth + 1)}</Box>`);
  }

  // Data rows
  if (rows) {
    out.push(`${indent(depth + 1)}{/* Data rows — populate from state */}`);
    out.push(`${indent(depth + 1)}{/* ${rows.replace(/\n/g, ' ').slice(0, 120)} */}`);
  }

  out.push(`${ind}</ScrollView>`);
  return out;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OUTPUT ASSEMBLY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Assemble a complete ReactJIT component from the common IR.
 *
 * @param {object} ir - The intermediate representation
 * @returns {{ code: string, warnings: string[], components: string[], stats: object }}
 */
export function assembleComponent(ir) {
  const components = new Set(['Box']);
  const output = [];

  // Generate JSX tree (populates components set)
  const jsxLines = generateJSXTree(ir.tree, 2, components);

  // Build state declarations
  const stateLines = (ir.state || []).map(sv => generateStateDecl(sv));

  // Build function declarations
  const funcLines = [];
  for (const fn of (ir.functions || [])) {
    funcLines.push(`  const ${fn.name} = (${fn.args}) => {`);
    for (const line of fn.body.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) funcLines.push(`    ${trimmed}`);
    }
    funcLines.push(`  };`);
    funcLines.push('');
  }

  // Build effect declarations
  const effectLines = (ir.effects || []).map(eff => generateEffectDecl(eff));

  // Keybinding comments
  const kbLines = [];
  for (const kb of (ir.keybindings || [])) {
    const keys = Array.isArray(kb.keys) ? kb.keys.join(', ') : kb.keys;
    kbLines.push(`  // Keybinding: [${keys}] → ${kb.comment || 'action'}`);
  }

  // Build imports
  const needsUseState = stateLines.length > 0;
  const needsUseEffect = effectLines.length > 0 || (ir.effects?.length > 0);
  const reactHooks = [];
  if (needsUseState) reactHooks.push('useState');
  if (needsUseEffect) reactHooks.push('useEffect');
  const hooksImport = reactHooks.length > 0 ? `, { ${reactHooks.join(', ')} }` : '';

  output.push(`import React${hooksImport} from 'react';`);
  output.push(`import { ${[...components].sort().join(', ')} } from '@reactjit/core';`);
  output.push('');

  // Source comment
  const title = ir.source?.title || ir.componentName;
  const framework = ir.source?.framework || 'unknown';
  output.push(`// Migrated from ${capitalize(framework)}: "${title}"`);
  output.push('');

  // Extra component functions (tabs, sub-components)
  if (ir.extraComponents?.length) {
    for (const comp of ir.extraComponents) {
      output.push(comp);
      output.push('');
    }
  }

  // Main component
  output.push(`export default function ${ir.componentName}() {`);
  if (stateLines.length > 0) {
    output.push(...stateLines);
    output.push('');
  }
  if (funcLines.length > 0) output.push(...funcLines);
  if (effectLines.length > 0) {
    output.push(...effectLines);
    output.push('');
  }
  if (kbLines.length > 0) {
    output.push(...kbLines);
    output.push('');
  }

  output.push('  return (');
  output.push(...jsxLines);
  output.push('  );');
  output.push('}');

  return {
    code: output.join('\n'),
    warnings: [...new Set(ir.warnings || [])],
    components: [...components],
    stats: {
      widgets: countNodes(ir.tree),
      events: countEvents(ir.tree),
      functions: (ir.functions || []).length,
      stateVars: stateLines.length,
    },
  };
}

/** Count total nodes in tree */
function countNodes(nodes) {
  let n = 0;
  for (const node of (nodes || [])) {
    n++;
    if (node.children) n += countNodes(node.children);
  }
  return n;
}

/** Count total events in tree */
function countEvents(nodes) {
  let n = 0;
  for (const node of (nodes || [])) {
    if (node.events) n += Object.keys(node.events).length;
    if (node.children) n += countEvents(node.children);
  }
  return n;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BRACE MATCHING (shared parser utility)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Extract a brace-matched block starting at `start` (which should point to `{`).
 * Returns the full text including braces, or null if not matched.
 */
export function extractBlock(source, start) {
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
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; i++; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return source.slice(start, i + 1); }
    i++;
  }
  return null;
}

/**
 * Extract bracket-matched content starting at `start` (which should point to `[`).
 * Returns the full text including brackets, or null.
 */
export function extractBrackets(source, start) {
  if (source[start] !== '[') return null;
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
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; i++; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) return source.slice(start, i + 1); }
    i++;
  }
  return null;
}

/**
 * Extract paren-matched content starting at `start` (which should point to `(`).
 * Returns the full text including parens, or null.
 */
export function extractParens(source, start) {
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
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; i++; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth === 0) return source.slice(start, i + 1); }
    i++;
  }
  return null;
}
