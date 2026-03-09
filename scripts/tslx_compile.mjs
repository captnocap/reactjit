#!/usr/bin/env node
/**
 * tslx_compile.mjs — Compile .tslx files to Lua capability + TSX wrapper
 *
 * Usage: node scripts/tslx_compile.mjs tslx/HelloCard.tslx
 *
 * Outputs:
 *   lua/capabilities/<snake_name>.lua   — Lua capability with Tree.declareChildren
 *   (future: packages/<pkg>/src/<Name>.tsx — one-liner TSX wrapper)
 */

import ts from 'typescript';
import fs from 'fs';
import path from 'path';

// ── Helpers ──────────────────────────────────────────────

function toSnakeCase(name) {
  return name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

function indent(str, level) {
  const pad = '  '.repeat(level);
  return str.split('\n').map(l => l.length ? pad + l : l).join('\n');
}

// ── Parse .tslx ─────────────────────────────────────────

function parseTslx(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Extract capability name
  const capMatch = raw.match(/capability\s+(\w+)\s*\{/);
  if (!capMatch) throw new Error('No capability declaration found');
  const name = capMatch[1];

  // Extract schema block
  const schemaMatch = raw.match(/schema:\s*(\{[\s\S]*?\n  \})/);
  const schemaSource = schemaMatch ? schemaMatch[1] : '{}';

  // Extract render function body — find render(props) { ... }
  // We need to find the balanced braces for the render function
  const renderStart = raw.indexOf('render(props)');
  if (renderStart === -1) throw new Error('No render(props) function found');

  // Find the opening brace of the render function
  let braceStart = raw.indexOf('{', renderStart);
  let depth = 0;
  let braceEnd = -1;
  for (let i = braceStart; i < raw.length; i++) {
    if (raw[i] === '{') depth++;
    if (raw[i] === '}') {
      depth--;
      if (depth === 0) { braceEnd = i; break; }
    }
  }
  const renderBody = raw.slice(braceStart + 1, braceEnd).trim();

  // Wrap the render body as a valid TSX function so TypeScript can parse it
  const tsxSource = `function __render(props: any) {\n${renderBody}\n}`;

  // Parse JSX with TypeScript compiler
  const sourceFile = ts.createSourceFile(
    'render.tsx',
    tsxSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  // Find the return statement's JSX
  const fn = sourceFile.statements[0];
  const returnStmt = fn.body.statements.find(s => s.kind === ts.SyntaxKind.ReturnStatement);
  if (!returnStmt || !returnStmt.expression) throw new Error('No return expression in render');

  // Unwrap parenthesized expression: return (...) → the inner JSX
  let jsxRoot = returnStmt.expression;
  if (jsxRoot.kind === ts.SyntaxKind.ParenthesizedExpression) {
    jsxRoot = jsxRoot.expression;
  }

  // Parse schema into structured data
  const schema = parseSchemaSource(schemaSource);

  return { name, schema, schemaSource, jsxRoot, sourceFile };
}

function parseSchemaSource(src) {
  // Simple parse of schema: { key: { type, default, desc }, ... }
  const entries = [];
  const re = /(\w+)\s*:\s*\{\s*type:\s*"(\w+)"(?:,\s*default:\s*(".*?"|[\d.]+|true|false))?(?:,\s*desc:\s*"(.*?)")?\s*\}/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    entries.push({ name: m[1], type: m[2], default: m[3] || null, desc: m[4] || null });
  }
  return entries;
}

// ── JSX → Lua Template ──────────────────────────────────

let keyCounter = 0;
const dynamicBindings = []; // { key, expr }

function resetState() {
  keyCounter = 0;
  dynamicBindings.length = 0;
}

/**
 * Map JSX element tag name to Lua node type
 */
function resolveType(tagName) {
  const map = {
    'Box': 'View',
    'View': 'View',
    'Text': 'Text',
    'Image': 'Image',
    'ScrollView': 'ScrollView',
  };
  return map[tagName] || tagName;
}

/**
 * Convert a JSX attribute value AST node to a Lua literal string
 */
function attrToLua(node, sf) {
  if (!node) return 'true'; // bare attribute like `disabled`

  // {expression}
  if (node.kind === ts.SyntaxKind.JsxExpression) {
    return exprToLua(node.expression, sf);
  }

  // "string literal"
  if (node.kind === ts.SyntaxKind.StringLiteral) {
    return `"${node.text}"`;
  }

  return exprToLua(node, sf);
}

/**
 * Convert a TS expression AST node to a Lua literal
 */
function exprToLua(node, sf) {
  if (!node) return 'nil';

  switch (node.kind) {
    case ts.SyntaxKind.StringLiteral:
      return `"${node.text}"`;

    case ts.SyntaxKind.NumericLiteral:
      return node.text;

    case ts.SyntaxKind.TrueKeyword:
      return 'true';

    case ts.SyntaxKind.FalseKeyword:
      return 'false';

    case ts.SyntaxKind.ObjectLiteralExpression: {
      const props = node.properties.map(p => {
        const key = p.name.text || p.name.escapedText;
        const val = exprToLua(p.initializer, sf);
        return `${key} = ${val}`;
      });
      return `{ ${props.join(', ')} }`;
    }

    case ts.SyntaxKind.PropertyAccessExpression: {
      // props.title → "props.title" (tracked as dynamic)
      const text = node.getText(sf);
      return text;
    }

    case ts.SyntaxKind.Identifier:
      return node.text;

    default:
      // Fallback: grab source text
      return node.getText(sf);
  }
}

/**
 * Convert a JSX element/fragment into a Lua template table entry
 */
function jsxToTemplate(node, sf, parentKey) {
  // Fragment: unwrap children
  if (node.kind === ts.SyntaxKind.JsxFragment) {
    const children = getJsxChildren(node, sf);
    return children;
  }

  // Self-closing element
  if (node.kind === ts.SyntaxKind.JsxSelfClosingElement) {
    return [processElement(node, node, sf, parentKey)];
  }

  // Opening/closing element
  if (node.kind === ts.SyntaxKind.JsxElement) {
    return [processElement(node.openingElement, node, sf, parentKey)];
  }

  // Text expression: {props.something}
  if (node.kind === ts.SyntaxKind.JsxExpression && node.expression) {
    const key = parentKey + '_t';
    const exprText = node.expression.getText(sf);

    // Track dynamic binding
    dynamicBindings.push({ key, expr: exprText });

    return [{
      type: '__TEXT__',
      key,
      text: '',
      _isDynamic: true,
    }];
  }

  // Plain text (whitespace, etc) — skip empty
  if (node.kind === ts.SyntaxKind.JsxText) {
    const trimmed = node.text.trim();
    if (!trimmed) return [];
    const key = parentKey + '_t';
    return [{
      type: '__TEXT__',
      key,
      text: trimmed,
    }];
  }

  return [];
}

function processElement(opening, fullNode, sf, parentKeyPrefix) {
  const tagName = opening.tagName.getText(sf);
  const luaType = resolveType(tagName);
  const key = parentKeyPrefix ? `${parentKeyPrefix}_${keyCounter++}` : `n${keyCounter++}`;

  // Extract attributes
  const style = {};
  const props = {};
  let hasStyle = false;

  if (opening.attributes) {
    for (const attr of opening.attributes.properties) {
      if (attr.kind === ts.SyntaxKind.JsxAttribute) {
        const attrName = attr.name.text || attr.name.escapedText;
        if (attrName === 'style' && attr.initializer?.expression) {
          hasStyle = true;
          // Parse style object
          const styleNode = attr.initializer.expression;
          if (styleNode.kind === ts.SyntaxKind.ObjectLiteralExpression) {
            for (const p of styleNode.properties) {
              const k = p.name.text || p.name.escapedText;
              style[k] = exprToLua(p.initializer, sf);
            }
          }
        } else if (attrName === 'key') {
          // Use explicit key
        } else {
          props[attrName] = attrToLua(attr.initializer, sf);
        }
      }
    }
  }

  // Process children
  const children = getJsxChildren(fullNode, sf, key);

  // For Text elements, if children are dynamic expressions, wrap them
  const entry = { type: luaType, key };
  if (hasStyle) entry.style = style;
  if (Object.keys(props).length > 0) entry.props = props;

  if (luaType === 'Text' && children.length > 0) {
    // Text nodes need __TEXT__ children
    entry.children = children;
  } else if (children.length > 0) {
    entry.children = children;
  }

  return entry;
}

function getJsxChildren(node, sf, parentKey) {
  const results = [];
  const children = node.children || [];

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const childKey = parentKey ? `${parentKey}_${i}` : `c${i}`;
    const entries = jsxToTemplate(child, sf, childKey);
    results.push(...entries);
  }

  return results;
}

// ── Lua Emitter ──────────────────────────────────────────

function templateToLua(entries, level) {
  const pad = '  '.repeat(level);
  const lines = [];

  for (const entry of entries) {
    const parts = [];
    parts.push(`type = "${entry.type}"`);
    parts.push(`key = "${entry.key}"`);

    if (entry.text !== undefined) {
      parts.push(`text = "${entry.text}"`);
    }

    if (entry.style && Object.keys(entry.style).length > 0) {
      const styleParts = Object.entries(entry.style).map(([k, v]) => `${k} = ${v}`);
      parts.push(`style = { ${styleParts.join(', ')} }`);
    }

    if (entry.children && entry.children.length > 0) {
      const childLua = templateToLua(entry.children, level + 1);
      parts.push(`children = {\n${childLua}\n${pad}  }`);
    }

    lines.push(`${pad}{ ${parts.join(', ')} },`);
  }

  return lines.join('\n');
}

function schemaToLua(schema) {
  const lines = schema.map(s => {
    const parts = [`type = "${s.type}"`];
    if (s.default !== null) parts.push(`default = ${s.default}`);
    if (s.desc !== null) parts.push(`desc = "${s.desc}"`);
    return `    ${s.name} = { ${parts.join(', ')} },`;
  });
  return lines.join('\n');
}

function bindingsToLua(bindings) {
  const lines = [];
  for (const b of bindings) {
    // Convert props.X to props.X (Lua access is the same syntax)
    // but we need to handle the default: props.title or ""
    const luaExpr = b.expr.replace(/^props\./, 'props.');
    // Determine default based on type (string → "", number → 0)
    const defaultVal = '""';
    lines.push(`  Tree.updateChildProps(handles["${b.key}"], { text = ${luaExpr} or ${defaultVal} })`);
  }
  return lines.join('\n');
}

function emitLua(parsed) {
  const { name, schema, jsxRoot, sourceFile } = parsed;
  const snakeName = toSnakeCase(name);

  resetState();
  const templateEntries = jsxToTemplate(jsxRoot, sourceFile, '');
  const templateLua = templateToLua(templateEntries, 2);
  const schemaLua = schemaToLua(schema);
  const updateLua = bindingsToLua(dynamicBindings);

  return `--[[
  capabilities/${snakeName}.lua — Auto-generated from ${name}.tslx
  DO NOT EDIT — regenerate with: node scripts/tslx_compile.mjs tslx/${name}.tslx
]]

local Capabilities = require("lua.capabilities")
local Tree = require("lua.tree")

local function buildTemplate()
  return {
${templateLua}
  }
end

local function updateTree(handles, props)
${updateLua || '  -- no dynamic bindings'}
end

Capabilities.register("${name}", {
  visual = false,

  schema = {
${schemaLua}
  },

  events = {},

  create = function(nodeId, props)
    local handles = Tree.declareChildren(nodeId, buildTemplate())
    updateTree(handles, props)
    return { handles = handles }
  end,

  update = function(nodeId, props, prev, state)
    updateTree(state.handles, props)
  end,

  destroy = function(nodeId, state)
    Tree.removeDeclaredChildren(nodeId)
  end,

  tick = function() end,
})
`;
}

// ── Main ─────────────────────────────────────────────────

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/tslx_compile.mjs <file.tslx>');
  process.exit(1);
}

const fullPath = path.resolve(inputPath);
if (!fs.existsSync(fullPath)) {
  console.error(`File not found: ${fullPath}`);
  process.exit(1);
}

const parsed = parseTslx(fullPath);
const lua = emitLua(parsed);

// Determine output path
const snakeName = toSnakeCase(parsed.name);
const outDir = path.join(path.dirname(fullPath), '..', 'lua', 'capabilities');
const outPath = path.join(outDir, `${snakeName}.lua`);

// Print to stdout for inspection
console.log('--- Generated Lua ---');
console.log(lua);
console.log(`--- Would write to: ${outPath} ---`);

// Write if --write flag is passed
if (process.argv.includes('--write')) {
  fs.writeFileSync(outPath, lua);
  console.log(`Wrote: ${outPath}`);
}
