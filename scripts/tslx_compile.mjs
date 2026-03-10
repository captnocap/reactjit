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
import { transpile as tslTranspile } from '../cli/lib/tsl.mjs';

// ── Helpers ──────────────────────────────────────────────

function toSnakeCase(name) {
  return name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

function indent(str, level) {
  const pad = '  '.repeat(level);
  return str.split('\n').map(l => l.length ? pad + l : l).join('\n');
}

/**
 * Convert TS-style raw block text to valid Lua:
 *   const/let → local, || → or, && → and, !== → ~=,
 *   "key": val → ["key"] = val, { a, b } → { a = a, b = b },
 *   template literals `...${x}...` → "..." .. x .. "..."
 */
function tsBlockToLua(text) {
  let result = text
    // const/let → local
    .replace(/\b(const|let)\s+/g, 'local ')
    // !== and != → ~=
    .replace(/!==?/g, '~=')
    // === and == stay as ==
    .replace(/===/g, '==')
    // || → or
    .replace(/\|\|/g, 'or')
    // && → and
    .replace(/&&/g, 'and')
    // .length → # (Lua length operator for tables and strings)
    .replace(/(\w+(?:\.\w+)*)\.length\b/g, '#$1')
    // "quoted-key": value → ["quoted-key"] = value (in table constructors)
    .replace(/"([^"]+)"\s*:/g, '["$1"] =')
    // unquoted key: value → key = value (in table constructors, not ternary)
    // Match word followed by : and a value (not :: for Lua method calls)
    .replace(/(\w+)\s*:\s*(?!:)/g, '$1 = ')
    // shorthand { el, bg, massStr } → { el = el, bg = bg, massStr = massStr }
    .replace(/\{([^{}]*)\}/g, (match, inner) => {
      // Only transform if it looks like shorthand (identifiers separated by commas, no = signs)
      const parts = inner.split(',').map(p => p.trim()).filter(Boolean);
      const allIdent = parts.every(p => /^\w+$/.test(p));
      if (allIdent && parts.length > 0 && !inner.includes('=') && !inner.includes(':')) {
        return '{ ' + parts.map(p => `${p} = ${p}`).join(', ') + ' }';
      }
      return match;
    })
    // template literals `...${expr}...` → "..." .. expr .. "..."
    .replace(/`([^`]*)`/g, (_, content) => {
      const parts = [];
      let last = 0;
      const re = /\$\{([^}]+)\}/g;
      let m;
      while ((m = re.exec(content)) !== null) {
        if (m.index > last) parts.push('"' + content.slice(last, m.index) + '"');
        parts.push(m[1]);
        last = m.index + m[0].length;
      }
      if (last < content.length) parts.push('"' + content.slice(last) + '"');
      return parts.join(' .. ') || '""';
    });

  // Array literals [...] → {...} — standalone arrays only, not property access foo[x]
  // Run repeatedly to handle nested arrays (inner brackets convert first)
  let prev;
  do {
    prev = result;
    result = result.replace(/\[([^\[\]]*)\]/g, (match, inner, offset) => {
      if (offset > 0 && /[\w\])]/.test(result[offset - 1])) return match;
      // Skip Lua table key syntax: ["key"] = value (already converted from "key": value)
      const after = result.slice(offset + match.length);
      if (/^"[^"]*"$/.test(inner.trim()) && /^\s*=/.test(after)) return match;
      return '{' + inner + '}';
    });
  } while (result !== prev);

  // Ternary: condition ? trueVal : falseVal → (condition) and trueVal or falseVal
  // Handles both standalone ternaries and ternaries after assignment (local x = cond ? a : b)
  result = result.replace(/(=\s*)?([^\n;,={]+?)\s*\?\s*([^:]+?)\s*:\s*([^\n;,}]+)/g, (match, assign, cond, t, f) => {
    if (cond.includes('function')) return match;
    return (assign || '') + `(${cond.trim()}) and ${t.trim()} or ${f.trim()}`;
  });

  return result;
}

// ── Parse .tslx ─────────────────────────────────────────

function parseTslx(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Extract capability name
  const capMatch = raw.match(/capability\s+(\w+)\s*\{/);
  if (!capMatch) throw new Error('No capability declaration found');
  const name = capMatch[1];

  // Extract require statements: require "lua.capabilities.chemistry" as Chemistry
  const requires = [];
  const reqRe = /require\s+"([\w./]+)"\s+as\s+(\w+)/g;
  let reqMatch;
  while ((reqMatch = reqRe.exec(raw)) !== null) {
    requires.push({ module: reqMatch[1], alias: reqMatch[2] });
  }

  // Extract schema block
  const schemaMatch = raw.match(/schema:\s*(\{[\s\S]*?\n  \})/);
  const schemaSource = schemaMatch ? schemaMatch[1] : '{}';

  // Helper: extract a brace-delimited block body by keyword at capability level (2-space indent)
  function extractBlock(keyword) {
    const re = new RegExp('\\n  ' + keyword);
    const idx = raw.search(re);
    if (idx === -1) return null;
    let bStart = raw.indexOf('{', idx);
    let d = 0, bEnd = -1;
    for (let i = bStart; i < raw.length; i++) {
      if (raw[i] === '{') d++;
      if (raw[i] === '}') { d--; if (d === 0) { bEnd = i; break; } }
    }
    return { inner: raw.slice(bStart + 1, bEnd).trim(), full: raw.slice(bStart, bEnd + 1) };
  }

  // Extract state block: state { count = 0 } or state: { count = 0 } → full Lua table literal
  const stateBlock = extractBlock('state:?\\s*\\{');
  const stateSource = stateBlock ? stateBlock.full : null;

  // Extract compute block: compute(props) { ... } or compute(props, state) { ... }
  const computeBlock = extractBlock('compute\\(');
  const computeBody = computeBlock ? computeBlock.inner : null;
  const computeHasState = computeBody !== null && /compute\(props\s*,\s*state\)/.test(raw);

  // Extract handlers block: handlers(state, refresh) { ... }
  const handlersBlock = extractBlock('handlers\\(');
  const handlersBody = handlersBlock ? handlersBlock.inner : null;

  // Extract tick block: tick(state, dt) { ... }
  const tickBlock = extractBlock('tick\\(');
  const tickBody = tickBlock ? tickBlock.inner : null;

  // Extract render function body — find render(data), render(props), render(props, state), or render(props, state, computed)
  const renderMatch = raw.match(/render\((data|props)(?:\s*,\s*(state)(?:\s*,\s*(computed))?)?\)/);
  if (!renderMatch) throw new Error('No render(data), render(props), render(props, state), or render(props, state, computed) function found');
  const renderParam = renderMatch[1]; // "data" or "props"
  const renderHasState = !!renderMatch[2]; // true if render(props, state) or render(props, state, computed)
  const renderHasComputed = !!renderMatch[3]; // true if render(props, state, computed)
  const renderStart = raw.indexOf(renderMatch[0]);
  if (renderStart === -1) throw new Error('No render function found');

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
  // render(props, state, computed) → all three params available
  const renderParams = ['props: any'];
  if (renderHasState) renderParams.push('state: any');
  if (renderHasComputed) renderParams.push('computed: any');
  const renderSig = renderParams.join(', ');
  const tsxSource = `function __render(${renderSig}) {\n${renderBody}\n}`;

  // Parse JSX with TypeScript compiler
  const sourceFile = ts.createSourceFile(
    'render.tsx',
    tsxSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  // Extract render-local variable declarations → substitution map
  // e.g. const s = props.size → renderLocals.s = "props.size"
  // Built progressively so later locals can reference earlier ones:
  //   const s = props.size; const h = s * 36 / 32 → h resolves to props.size * 36 / 32
  const fn = sourceFile.statements[0];
  const renderLocals = {};
  activeRenderLocals = renderLocals; // set early so exprToLua can resolve during parsing
  for (const stmt of fn.body.statements) {
    if (stmt.kind === ts.SyntaxKind.VariableStatement) {
      for (const decl of stmt.declarationList.declarations) {
        if (decl.name.kind === ts.SyntaxKind.Identifier && decl.initializer) {
          renderLocals[decl.name.text] = exprToLua(decl.initializer, sourceFile);
        }
      }
    }
  }

  // Find the return statement's JSX
  const returnStmt = fn.body.statements.find(s => s.kind === ts.SyntaxKind.ReturnStatement);
  if (!returnStmt || !returnStmt.expression) throw new Error('No return expression in render');

  // Unwrap parenthesized expression: return (...) → the inner JSX
  let jsxRoot = returnStmt.expression;
  if (jsxRoot.kind === ts.SyntaxKind.ParenthesizedExpression) {
    jsxRoot = jsxRoot.expression;
  }

  // Parse schema into structured data
  const schema = parseSchemaSource(schemaSource);

  return { name, schema, schemaSource, jsxRoot, sourceFile, requires, computeBody, computeHasState, renderParam, renderHasState, renderHasComputed, renderLocals, stateSource, handlersBody, tickBody };
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
const dynamicBindings = []; // { key, expr, prop? }
const listRebuilders = [];  // { index, wrapperKey, arrayExpr, itemParam, itemLua }
let listItemKeyCounter = 0;
let activeRenderLocals = {}; // render-local variable substitutions
const pushEventHandlers = []; // { name, payload, handlerKey }
const setStateHandlers = []; // { handlerKey, fields: [{key, val}] }
let setStateCounter = 0;
let listItemNeedsStateRefresh = false; // set by listItemElementToLua when setState detected

function resetState() {
  keyCounter = 0;
  dynamicBindings.length = 0;
  listRebuilders.length = 0;
  listItemKeyCounter = 0;
  activeRenderLocals = {};
  setStateHandlers.length = 0;
  setStateCounter = 0;
  listItemNeedsStateRefresh = false;
  pushEventHandlers.length = 0;
}

/**
 * Check if a Lua expression string is a static literal (safe for template time)
 */
function isStaticValue(luaExpr) {
  if (luaExpr === 'true' || luaExpr === 'false' || luaExpr === 'nil') return true;
  if (/^-?\d+(\.\d+)?$/.test(luaExpr)) return true;  // number
  if (/^"[^"]*"$/.test(luaExpr)) return true;          // string literal
  if (/^\{[^}]*\}$/.test(luaExpr)) {                   // shallow table literal
    // Check if all values inside are also static
    const inner = luaExpr.slice(1, -1).trim();
    if (!inner) return true;
    // Simple heuristic: if it contains data. or props. references, it's dynamic
    if (/\b(data|props)\b/.test(inner)) return false;
    return true;
  }
  return false;
}

/**
 * Check if a TS AST node is a JSX node (element, self-closing, or fragment)
 */
function isJsxNode(node) {
  if (!node) return false;
  // Unwrap parenthesized expressions: (condition && (<Element/>))
  let n = node;
  while (n.kind === ts.SyntaxKind.ParenthesizedExpression) {
    n = n.expression;
  }
  return n.kind === ts.SyntaxKind.JsxElement ||
         n.kind === ts.SyntaxKind.JsxSelfClosingElement ||
         n.kind === ts.SyntaxKind.JsxFragment;
}

/**
 * Unwrap parenthesized expressions to get the inner node
 */
function unwrapParens(node) {
  while (node && node.kind === ts.SyntaxKind.ParenthesizedExpression) {
    node = node.expression;
  }
  return node;
}

/**
 * Parse an arrow function that calls pushEvent: () => pushEvent("name", { ... })
 * Returns { eventName, payloadLua } or null if not a pushEvent call.
 */
function parsePushEventCall(arrowNode, sf) {
  let body = arrowNode.body;
  // Block body: { return pushEvent(...) } or { pushEvent(...) }
  if (body.kind === ts.SyntaxKind.Block) {
    const stmt = body.statements[0];
    if (!stmt) return null;
    if (stmt.kind === ts.SyntaxKind.ReturnStatement) body = stmt.expression;
    else if (stmt.kind === ts.SyntaxKind.ExpressionStatement) body = stmt.expression;
    else return null;
  }
  if (!body || body.kind !== ts.SyntaxKind.CallExpression) return null;
  const callee = body.expression;
  if (callee.kind !== ts.SyntaxKind.Identifier || callee.text !== 'pushEvent') return null;

  const args = body.arguments;
  if (args.length < 1) return null;
  const eventName = args[0].kind === ts.SyntaxKind.StringLiteral ? args[0].text : exprToLua(args[0], sf);

  let payloadLua = 'nil';
  if (args.length >= 2) {
    payloadLua = exprToLua(args[1], sf);
  }
  return { eventName, payloadLua };
}

/**
 * Parse an arrow function that calls setState: () => setState({ key: value })
 * Also handles parameterized: (text) => setState({ search: text })
 * Returns { fields, params } or null if not a setState call.
 * fields is array of {key, val}. params is array of parameter names (may be empty).
 */
function parseSetStateCall(arrowNode, sf) {
  let body = arrowNode.body;
  if (body.kind === ts.SyntaxKind.Block) {
    const stmt = body.statements[0];
    if (!stmt) return null;
    if (stmt.kind === ts.SyntaxKind.ReturnStatement) body = stmt.expression;
    else if (stmt.kind === ts.SyntaxKind.ExpressionStatement) body = stmt.expression;
    else return null;
  }
  if (!body || body.kind !== ts.SyntaxKind.CallExpression) return null;
  const callee = body.expression;
  if (callee.kind !== ts.SyntaxKind.Identifier || callee.text !== 'setState') return null;

  const args = body.arguments;
  if (args.length < 1) return null;

  // Extract parameter names from the arrow function (e.g., (text) => ...)
  const params = [];
  if (arrowNode.parameters) {
    for (const p of arrowNode.parameters) {
      params.push(p.name.text || p.name.escapedText);
    }
  }

  // Extract field assignments from the object literal
  const objNode = args[0];
  if (objNode.kind !== ts.SyntaxKind.ObjectLiteralExpression) return null;

  const fields = [];
  for (const p of objNode.properties) {
    const key = p.name.text || p.name.escapedText;
    const val = exprToLua(p.initializer, sf);
    fields.push({ key, val });
  }
  return { fields, params };
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
    'Pressable': 'View',
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
        // Handle shorthand properties: { gap } → gap = gap
        const val = p.kind === ts.SyntaxKind.ShorthandPropertyAssignment
          ? exprToLua(p.name, sf)
          : exprToLua(p.initializer, sf);
        return `${key} = ${val}`;
      });
      return `{ ${props.join(', ')} }`;
    }

    case ts.SyntaxKind.PropertyAccessExpression: {
      const prop = node.name.text || node.name.escapedText;
      // .length → #expr (Lua table/string length operator)
      if (prop === 'length') {
        const obj = exprToLua(node.expression, sf);
        return `#${obj}`;
      }
      // Check if the root identifier is a render local: el.symbol → data.el.symbol
      const root = node.expression;
      if (root.kind === ts.SyntaxKind.Identifier && activeRenderLocals[root.text] !== undefined) {
        const resolved = activeRenderLocals[root.text];
        return `${resolved}.${prop}`;
      }
      const text = node.getText(sf);
      return text;
    }

    case ts.SyntaxKind.BinaryExpression: {
      const left = exprToLua(node.left, sf);
      const right = exprToLua(node.right, sf);
      const opKind = node.operatorToken.kind;
      if (opKind === ts.SyntaxKind.AmpersandAmpersandToken) return `(${left}) and (${right})`;
      if (opKind === ts.SyntaxKind.BarBarToken) return `(${left}) or (${right})`;
      if (opKind === ts.SyntaxKind.ExclamationEqualsEqualsToken || opKind === ts.SyntaxKind.ExclamationEqualsToken) return `${left} ~= ${right}`;
      if (opKind === ts.SyntaxKind.EqualsEqualsEqualsToken || opKind === ts.SyntaxKind.EqualsEqualsToken) return `${left} == ${right}`;
      if (opKind === ts.SyntaxKind.PlusToken) return `${left} + ${right}`;
      if (opKind === ts.SyntaxKind.MinusToken) return `${left} - ${right}`;
      if (opKind === ts.SyntaxKind.AsteriskToken) return `${left} * ${right}`;
      if (opKind === ts.SyntaxKind.SlashToken) return `${left} / ${right}`;
      if (opKind === ts.SyntaxKind.PercentToken) return `${left} % ${right}`;
      if (opKind === ts.SyntaxKind.LessThanToken) return `${left} < ${right}`;
      if (opKind === ts.SyntaxKind.GreaterThanToken) return `${left} > ${right}`;
      if (opKind === ts.SyntaxKind.LessThanEqualsToken) return `${left} <= ${right}`;
      if (opKind === ts.SyntaxKind.GreaterThanEqualsToken) return `${left} >= ${right}`;
      // Fallback for unhandled operators
      return node.getText(sf);
    }

    case ts.SyntaxKind.ConditionalExpression: {
      // condition ? a : b → (condition) and a or b
      const cond = exprToLua(node.condition, sf);
      const t = exprToLua(node.whenTrue, sf);
      const f = exprToLua(node.whenFalse, sf);
      return `(${cond}) and ${t} or ${f}`;
    }

    case ts.SyntaxKind.PrefixUnaryExpression: {
      // !x → not x
      if (node.operator === ts.SyntaxKind.ExclamationToken) {
        return `not ${exprToLua(node.operand, sf)}`;
      }
      if (node.operator === ts.SyntaxKind.MinusToken) {
        return `-${exprToLua(node.operand, sf)}`;
      }
      return node.getText(sf);
    }

    case ts.SyntaxKind.Identifier:
      // Substitute render-local variables with their resolved expressions
      if (activeRenderLocals[node.text] !== undefined) {
        const resolved = activeRenderLocals[node.text];
        // Wrap in parens if resolved contains operators to prevent precedence issues
        if (/\b(or|and)\b/.test(resolved)) return `(${resolved})`;
        return resolved;
      }
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

  // JSX expression: {data.x}, {cond && <El/>}, {cond ? <A/> : <B/>}
  if (node.kind === ts.SyntaxKind.JsxExpression && node.expression) {
    const expr = node.expression;

    // Conditional AND: {condition && <Element/>}
    if (expr.kind === ts.SyntaxKind.BinaryExpression &&
        expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      const condLua = exprToLua(expr.left, sf);
      const rhs = unwrapParens(expr.right);

      if (isJsxNode(rhs)) {
        const entries = jsxToTemplate(rhs, sf, parentKey);
        for (const entry of entries) {
          if (!entry.style) entry.style = {};
          entry.style.display = '"none"';
          dynamicBindings.push({ key: entry.key, condition: condLua, _conditional: 'show' });
        }
        return entries;
      }
      // Non-JSX right side: treat as text binding with Lua and/or
      const key = parentKey + '_t';
      dynamicBindings.push({ key, expr: `(${condLua}) and (${exprToLua(rhs, sf)}) or ""` });
      return [{ type: '__TEXT__', key, text: '', _isDynamic: true }];
    }

    // Ternary: {condition ? <A/> : <B/>}
    if (expr.kind === ts.SyntaxKind.ConditionalExpression) {
      const condLua = exprToLua(expr.condition, sf);
      const whenTrue = unwrapParens(expr.whenTrue);
      const whenFalse = unwrapParens(expr.whenFalse);

      // Both branches are JSX → conditional display toggle
      if (isJsxNode(whenTrue) && isJsxNode(whenFalse)) {
        const trueEntries = jsxToTemplate(whenTrue, sf, parentKey + '_T');
        const falseEntries = jsxToTemplate(whenFalse, sf, parentKey + '_F');

        for (const entry of trueEntries) {
          if (!entry.style) entry.style = {};
          entry.style.display = '"none"';
          dynamicBindings.push({ key: entry.key, condition: condLua, _conditional: 'show' });
        }
        for (const entry of falseEntries) {
          if (!entry.style) entry.style = {};
          entry.style.display = '"none"';
          dynamicBindings.push({ key: entry.key, condition: condLua, _conditional: 'hide' });
        }

        return [...trueEntries, ...falseEntries];
      }

      // One branch is JSX, the other isn't (or neither) → text binding
      const key = parentKey + '_t';
      const luaExpr = `(${condLua}) and ${exprToLua(whenTrue, sf)} or ${exprToLua(whenFalse, sf)}`;
      dynamicBindings.push({ key, expr: luaExpr });
      return [{ type: '__TEXT__', key, text: '', _isDynamic: true }];
    }

    // .map() call: {data.items.map((item) => <El/>)}
    if (expr.kind === ts.SyntaxKind.CallExpression) {
      const callee = expr.expression;
      if (callee.kind === ts.SyntaxKind.PropertyAccessExpression &&
          (callee.name.text === 'map' || callee.name.escapedText === 'map')) {
        const arrayExpr = exprToLua(callee.expression, sf);
        const callback = expr.arguments[0];
        const itemParam = callback.parameters[0].name.text || callback.parameters[0].name.escapedText;

        let jsxBody = callback.body;
        jsxBody = unwrapParens(jsxBody);

        // If body is a block with a return statement, extract the return expression
        if (jsxBody.kind === ts.SyntaxKind.Block) {
          const ret = jsxBody.statements.find(s => s.kind === ts.SyntaxKind.ReturnStatement);
          if (ret && ret.expression) jsxBody = unwrapParens(ret.expression);
        }

        const listIndex = listRebuilders.length;
        const wrapperKey = parentKey + '_list_' + listIndex;

        // Reset list item key counter and setState flag for this list
        listItemKeyCounter = 0;
        listItemNeedsStateRefresh = false;

        // Generate the Lua code for a single list item template entry
        const itemLua = listItemEntryToLua(jsxBody, sf, 'li', 2);

        listRebuilders.push({
          index: listIndex,
          wrapperKey,
          arrayExpr,
          itemParam,
          itemLua,
          needsStateRefresh: listItemNeedsStateRefresh,
        });

        // Return a wrapper View for the list in the main template
        // Marked so processElement can propagate parent layout style
        return [{
          type: 'View',
          key: wrapperKey,
          _isListWrapper: true,
        }];
      }
    }

    // Default: plain expression text binding
    const key = parentKey + '_t';
    const exprText = expr.getText(sf);
    dynamicBindings.push({ key, expr: exprText });
    return [{ type: '__TEXT__', key, text: '', _isDynamic: true }];
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
  const handlerBindings = {};
  let hasStyle = false;

  if (opening.attributes) {
    for (const attr of opening.attributes.properties) {
      if (attr.kind === ts.SyntaxKind.JsxAttribute) {
        const attrName = attr.name.text || attr.name.escapedText;
        if (attrName === 'style' && attr.initializer?.expression) {
          hasStyle = true;
          // Parse style object — separate static from dynamic
          const styleNode = attr.initializer.expression;
          if (styleNode.kind === ts.SyntaxKind.ObjectLiteralExpression) {
            for (const p of styleNode.properties) {
              const k = p.name.text || p.name.escapedText;
              style[k] = p.kind === ts.SyntaxKind.ShorthandPropertyAssignment
                ? exprToLua(p.name, sf) : exprToLua(p.initializer, sf);
            }
          }
        } else if (attrName === 'key') {
          // Use explicit key
        } else if (attrName.startsWith('on') && attr.initializer?.kind === ts.SyntaxKind.JsxExpression && attr.initializer.expression) {
          // Check for handlers.X reference: onPress={handlers.onIncrement}
          const valExpr = attr.initializer.expression;
          if (valExpr.kind === ts.SyntaxKind.PropertyAccessExpression &&
              valExpr.expression.kind === ts.SyntaxKind.Identifier &&
              (valExpr.expression.text === 'handlers' || valExpr.expression.escapedText === 'handlers')) {
            handlerBindings[attrName] = valExpr.name.text || valExpr.name.escapedText;
          } else if (valExpr.kind === ts.SyntaxKind.ArrowFunction) {
            // () => pushEvent("eventName", { payload }) → Lua pushEvent closure
            const pushInfo = parsePushEventCall(valExpr, sf);
            if (pushInfo) {
              handlerBindings[attrName] = `__push_${pushInfo.eventName}`;
              if (!handlerBindings._pushEvents) handlerBindings._pushEvents = [];
              handlerBindings._pushEvents.push({ name: pushInfo.eventName, payload: pushInfo.payloadLua, handlerKey: `__push_${pushInfo.eventName}` });
            } else {
              // () => setState({ key: value }) → Lua state mutation + refresh
              const ssInfo = parseSetStateCall(valExpr, sf);
              if (ssInfo) {
                const handlerKey = `__setState_${setStateCounter++}`;
                handlerBindings[attrName] = handlerKey;
                if (!handlerBindings._setStates) handlerBindings._setStates = [];
                handlerBindings._setStates.push({ handlerKey, fields: ssInfo.fields, params: ssInfo.params || [] });
              } else {
                props[attrName] = attrToLua(attr.initializer, sf);
              }
            }
          } else {
            props[attrName] = attrToLua(attr.initializer, sf);
          }
        } else {
          props[attrName] = attrToLua(attr.initializer, sf);
        }
      }
    }
  }

  // Process children
  const children = getJsxChildren(fullNode, sf, key);

  // Propagate parent's flex layout properties to .map() wrapper Views
  // so list items inherit the correct flow direction from their context.
  // Only propagate static values into the template; dynamic values become bindings.
  const layoutProps = ['flexDirection', 'flexWrap', 'gap', 'alignItems'];
  for (const child of children) {
    if (child._isListWrapper) {
      if (!child.style) child.style = {};
      for (const prop of layoutProps) {
        if (style[prop] !== undefined && child.style[prop] === undefined) {
          if (isStaticValue(style[prop])) {
            child.style[prop] = style[prop];
          } else {
            // Dynamic layout prop — track as binding, use in updateTree()
            dynamicBindings.push({ key: child.key, expr: style[prop], styleProp: prop });
          }
        }
      }
      delete child._isListWrapper;
    }
  }

  // Separate static props from dynamic props
  const staticProps = {};
  for (const [pName, pVal] of Object.entries(props)) {
    if (isStaticValue(pVal)) {
      staticProps[pName] = pVal;
    } else {
      // Dynamic prop — track as binding for updateTree
      dynamicBindings.push({ key, expr: pVal, prop: pName });
    }
  }

  // Separate static style values from dynamic style values
  const staticStyle = {};
  for (const [sName, sVal] of Object.entries(style)) {
    if (isStaticValue(sVal)) {
      staticStyle[sName] = sVal;
    } else {
      // Dynamic style — track as style binding for updateTree
      dynamicBindings.push({ key, expr: sVal, styleProp: sName });
    }
  }

  // For Text elements, if children are dynamic expressions, wrap them
  const entry = { type: luaType, key };
  if (hasStyle && Object.keys(staticStyle).length > 0) entry.style = staticStyle;
  if (Object.keys(staticProps).length > 0) entry.props = staticProps;
  // Collect pushEvent and setState handlers into module-level lists
  if (handlerBindings._pushEvents) {
    pushEventHandlers.push(...handlerBindings._pushEvents);
    delete handlerBindings._pushEvents;
  }
  if (handlerBindings._setStates) {
    setStateHandlers.push(...handlerBindings._setStates);
    delete handlerBindings._setStates;
  }
  if (Object.keys(handlerBindings).length > 0) entry.handlerBindings = handlerBindings;

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

// ── List Item Template (for .map() support) ─────────────

/**
 * Generate Lua code for a single list item template entry.
 * All values are baked inline (no separate bindings needed since lists rebuild each update).
 * Keys include `.. _i` for per-item uniqueness.
 */
function listItemEntryToLua(node, sf, parentPrefix, level, condition) {
  const pad = '  '.repeat(level);

  // Fragment: unwrap children
  if (node.kind === ts.SyntaxKind.JsxFragment) {
    return listItemChildrenToLua(node, sf, parentPrefix, level);
  }

  // Self-closing element
  if (node.kind === ts.SyntaxKind.JsxSelfClosingElement) {
    return listItemElementToLua(node, node, sf, parentPrefix, level, condition);
  }

  // Element with children
  if (node.kind === ts.SyntaxKind.JsxElement) {
    return listItemElementToLua(node.openingElement, node, sf, parentPrefix, level, condition);
  }

  // JSX expression
  if (node.kind === ts.SyntaxKind.JsxExpression && node.expression) {
    const expr = node.expression;

    // Conditional: {cond && <El/>}
    if (expr.kind === ts.SyntaxKind.BinaryExpression &&
        expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      const condLua = exprToLua(expr.left, sf);
      const rhs = unwrapParens(expr.right);
      if (isJsxNode(rhs)) {
        return listItemEntryToLua(rhs, sf, parentPrefix, level, condLua);
      }
      // Non-JSX: text binding
      const suffix = listItemKeyCounter++;
      const fullExpr = `(${condLua}) and (${exprToLua(rhs, sf)}) or ""`;
      return `${pad}{ type = "__TEXT__", key = "${parentPrefix}_e${suffix}_" .. _i, text = ${fullExpr} }`;
    }

    // Ternary: {cond ? <A/> : <B/>}
    if (expr.kind === ts.SyntaxKind.ConditionalExpression) {
      const condLua = exprToLua(expr.condition, sf);
      const whenTrue = unwrapParens(expr.whenTrue);
      const whenFalse = unwrapParens(expr.whenFalse);
      if (isJsxNode(whenTrue) && isJsxNode(whenFalse)) {
        const trueLua = listItemEntryToLua(whenTrue, sf, parentPrefix + 'T', level, condLua);
        const falseLua = listItemEntryToLua(whenFalse, sf, parentPrefix + 'F', level,
          `not (${condLua})`);
        return [trueLua, falseLua].filter(Boolean).join(',\n');
      }
      const suffix = listItemKeyCounter++;
      const luaExpr = `(${condLua}) and ${exprToLua(whenTrue, sf)} or ${exprToLua(whenFalse, sf)}`;
      return `${pad}{ type = "__TEXT__", key = "${parentPrefix}_e${suffix}_" .. _i, text = ${luaExpr} }`;
    }

    // Nested .map() call: {row.map(z => <El/>)}
    if (expr.kind === ts.SyntaxKind.CallExpression) {
      const callee = expr.expression;
      if (callee.kind === ts.SyntaxKind.PropertyAccessExpression &&
          (callee.name.text === 'map' || callee.name.escapedText === 'map')) {
        const innerArrayExpr = exprToLua(callee.expression, sf);
        const innerCallback = expr.arguments[0];
        const innerItemParam = innerCallback.parameters[0].name.text || innerCallback.parameters[0].name.escapedText;
        // Use _j, _k, _l for nested iterator vars to avoid collision with outer _i
        const innerIterVar = level <= 2 ? '_j' : level <= 3 ? '_k' : '_l';

        let innerJsxBody = innerCallback.body;
        innerJsxBody = unwrapParens(innerJsxBody);

        // Handle block body with if/return statements
        if (innerJsxBody.kind === ts.SyntaxKind.Block) {
          const stmts = innerJsxBody.statements;
          // Generate inline Lua for loop with conditional branches
          const branches = [];
          for (const stmt of stmts) {
            if (stmt.kind === ts.SyntaxKind.IfStatement) {
              const cond = exprToLua(stmt.expression, sf);
              const thenBody = stmt.thenStatement;
              let thenRet = null;
              if (thenBody.kind === ts.SyntaxKind.Block) {
                const retStmt = thenBody.statements.find(s => s.kind === ts.SyntaxKind.ReturnStatement);
                if (retStmt) thenRet = unwrapParens(retStmt.expression);
              } else if (thenBody.kind === ts.SyntaxKind.ReturnStatement) {
                thenRet = unwrapParens(thenBody.expression);
              }
              if (thenRet && isJsxNode(thenRet)) {
                const savedCounter = listItemKeyCounter;
                const itemLua = listItemEntryToLua(thenRet, sf, parentPrefix + '_inner', level + 1);
                branches.push({ cond, itemLua });
              }
            } else if (stmt.kind === ts.SyntaxKind.ReturnStatement && stmt.expression) {
              const retExpr = unwrapParens(stmt.expression);
              if (isJsxNode(retExpr)) {
                const itemLua = listItemEntryToLua(retExpr, sf, parentPrefix + '_inner', level + 1);
                branches.push({ cond: null, itemLua }); // else/default branch
              }
            }
          }

          // Emit nested for loop with if/elseif/else
          const innerPad = pad + '  ';
          const innerPad2 = innerPad + '  ';
          let loopBody = '';
          for (let bi = 0; bi < branches.length; bi++) {
            const b = branches[bi];
            if (b.cond && bi === 0) {
              loopBody += `${innerPad}if ${b.cond} then\n${innerPad2}inner_children[#inner_children + 1] =\n${b.itemLua}\n`;
            } else if (b.cond) {
              loopBody += `${innerPad}elseif ${b.cond} then\n${innerPad2}inner_children[#inner_children + 1] =\n${b.itemLua}\n`;
            } else {
              loopBody += `${innerPad}else\n${innerPad2}inner_children[#inner_children + 1] =\n${b.itemLua}\n`;
            }
          }
          if (branches.length > 0) loopBody += `${innerPad}end\n`;

          // Return as inline nested code that builds inner_children
          // We need to replace the key suffix from _i to include the nested iterator
          const fixedLoopBody = loopBody.replace(/_" \.\. _i/g, `_" .. _i .. "_" .. ${innerIterVar}`);
          return `${pad}-- nested_map build children inline\n${pad}local inner_children = {}\n${pad}for ${innerIterVar}, ${innerItemParam} in ipairs(${innerArrayExpr}) do\n${fixedLoopBody}${pad}end`;
        }

        // Simple expression body (single JSX element)
        if (isJsxNode(innerJsxBody)) {
          const innerItemLua = listItemEntryToLua(innerJsxBody, sf, parentPrefix + '_inner', level + 1);
          const fixedItemLua = innerItemLua.replace(/_" \.\. _i/g, `_" .. _i .. "_" .. ${innerIterVar}`);
          return `${pad}-- nested_map build children inline\n${pad}local inner_children = {}\n${pad}for ${innerIterVar}, ${innerItemParam} in ipairs(${innerArrayExpr}) do\n${pad}  inner_children[#inner_children + 1] =\n${fixedItemLua}\n${pad}end`;
        }
      }
    }

    // Plain text expression: {item.name}
    const suffix = listItemKeyCounter++;
    const luaExpr = exprToLua(expr, sf);
    return `${pad}{ type = "__TEXT__", key = "${parentPrefix}_e${suffix}_" .. _i, text = ${luaExpr} or "" }`;
  }

  // Plain text
  if (node.kind === ts.SyntaxKind.JsxText) {
    const trimmed = node.text.trim();
    if (!trimmed) return null;
    const suffix = listItemKeyCounter++;
    return `${pad}{ type = "__TEXT__", key = "${parentPrefix}_t${suffix}_" .. _i, text = "${trimmed}" }`;
  }

  return null;
}

function listItemElementToLua(opening, fullNode, sf, parentPrefix, level, condition) {
  const pad = '  '.repeat(level);
  const tagName = opening.tagName.getText(sf);
  const luaType = resolveType(tagName);
  const suffix = listItemKeyCounter++;
  const myKey = `${parentPrefix}_${suffix}`;

  const parts = [];
  parts.push(`type = "${luaType}"`);
  parts.push(`key = "${myKey}_" .. _i`);

  // Attributes
  const styleParts = [];
  const propParts = [];
  const handlerParts = [];
  let listItemHasSetState = false;
  if (opening.attributes) {
    for (const attr of opening.attributes.properties) {
      if (attr.kind !== ts.SyntaxKind.JsxAttribute) continue;
      const attrName = attr.name.text || attr.name.escapedText;
      if (attrName === 'key') continue;
      if (attrName === 'style' && attr.initializer?.expression) {
        const styleNode = attr.initializer.expression;
        if (styleNode.kind === ts.SyntaxKind.ObjectLiteralExpression) {
          for (const p of styleNode.properties) {
            const k = p.name.text || p.name.escapedText;
            const sval = p.kind === ts.SyntaxKind.ShorthandPropertyAssignment
              ? exprToLua(p.name, sf) : exprToLua(p.initializer, sf);
            styleParts.push(`${k} = ${sval}`);
          }
        }
      } else if (attrName.startsWith('on') && attr.initializer?.kind === ts.SyntaxKind.JsxExpression && attr.initializer.expression) {
        const valExpr = attr.initializer.expression;
        if (valExpr.kind === ts.SyntaxKind.ArrowFunction) {
          const ssInfo = parseSetStateCall(valExpr, sf);
          if (ssInfo) {
            listItemNeedsStateRefresh = true;
            const assigns = ssInfo.fields.map(f => `state.${f.key} = ${f.val}`).join('; ');
            const paramList = (ssInfo.params && ssInfo.params.length > 0) ? ssInfo.params.join(', ') : '';
            handlerParts.push(`${attrName} = function(${paramList}) ${assigns}; refresh() end`);
          } else {
            const pushInfo = parsePushEventCall(valExpr, sf);
            if (pushInfo) {
              handlerParts.push(`${attrName} = function() if Capabilities._pushEventFn then Capabilities._pushEventFn({ type = "${pushInfo.eventName}", payload = ${pushInfo.payloadLua} }) end end`);
            } else {
              propParts.push(`${attrName} = ${attrToLua(attr.initializer, sf)}`);
            }
          }
        } else if (valExpr.kind === ts.SyntaxKind.PropertyAccessExpression &&
                   valExpr.expression.kind === ts.SyntaxKind.Identifier &&
                   (valExpr.expression.text === 'handlers' || valExpr.expression.escapedText === 'handlers')) {
          handlerParts.push(`${attrName} = h.${valExpr.name.text || valExpr.name.escapedText}`);
        } else {
          propParts.push(`${attrName} = ${attrToLua(attr.initializer, sf)}`);
        }
      } else {
        propParts.push(`${attrName} = ${attrToLua(attr.initializer, sf)}`);
      }
    }
  }

  // Inject display toggle for conditional elements
  if (condition) {
    styleParts.push(`display = (${condition}) and "flex" or "none"`);
  }

  if (styleParts.length > 0) parts.push(`style = { ${styleParts.join(', ')} }`);
  if (propParts.length > 0) parts.push(`props = { ${propParts.join(', ')} }`);
  if (handlerParts.length > 0) parts.push(`handlers = { ${handlerParts.join(', ')} }`);

  // Children
  const childLua = listItemChildrenToLua(fullNode, sf, myKey, level + 1);
  if (childLua) {
    // Check if children contain a nested map (builds inner_children inline)
    if (childLua.includes('-- nested_map')) {
      // The nested map code builds inner_children and must run before the template entry
      // Split: code block goes before, the entry references inner_children
      parts.push(`children = inner_children`);
      return `${childLua}\n${pad}tmpl[#tmpl + 1] =\n${pad}{ ${parts.join(', ')} }`;
    }
    parts.push(`children = {\n${childLua}\n${pad}  }`);
  }

  return `${pad}{ ${parts.join(', ')} }`;
}

function listItemChildrenToLua(node, sf, parentPrefix, level) {
  const children = node.children || [];
  const lines = [];
  for (let i = 0; i < children.length; i++) {
    const lua = listItemEntryToLua(children[i], sf, parentPrefix, level);
    if (lua) lines.push(lua);
  }
  return lines.length > 0 ? lines.join(',\n') : null;
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

    if (entry.props && Object.keys(entry.props).length > 0) {
      const propParts = Object.entries(entry.props).map(([k, v]) => `${k} = ${v}`);
      parts.push(`props = { ${propParts.join(', ')} }`);
    }

    if (entry.style && Object.keys(entry.style).length > 0) {
      const styleParts = Object.entries(entry.style).map(([k, v]) => `${k} = ${v}`);
      parts.push(`style = { ${styleParts.join(', ')} }`);
    }

    if (entry.handlerBindings && Object.keys(entry.handlerBindings).length > 0) {
      const hParts = Object.entries(entry.handlerBindings)
        .filter(([k]) => k !== '_pushEvents')
        .map(([event, handler]) => `${event} = h.${handler}`);
      parts.push(`handlers = { ${hParts.join(', ')} }`);
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

function bindingsToLua(bindings, dataVar) {
  // Group style bindings by node key to batch them into one updateChildProps call
  const styleByKey = {};
  const otherBindings = [];
  const conditionalBindings = [];

  for (const b of bindings) {
    if (b._conditional) {
      conditionalBindings.push(b);
    } else if (b.styleProp) {
      if (!styleByKey[b.key]) styleByKey[b.key] = {};
      styleByKey[b.key][b.styleProp] = b.expr;
    } else {
      otherBindings.push(b);
    }
  }

  const lines = [];

  // Emit conditional display toggles (show/hide based on condition)
  for (const b of conditionalBindings) {
    if (b._conditional === 'show') {
      // {condition && <El/>} → show when condition is truthy
      lines.push(`  Tree.updateChildProps(handles["${b.key}"], { style = { display = (${b.condition}) and "flex" or "none" } })`);
    } else {
      // ternary false branch → show when condition is falsy
      lines.push(`  Tree.updateChildProps(handles["${b.key}"], { style = { display = (${b.condition}) and "none" or "flex" } })`);
    }
  }

  // Emit style bindings (batched per node)
  for (const [key, styleProps] of Object.entries(styleByKey)) {
    const parts = Object.entries(styleProps).map(([k, v]) => `${k} = ${v}`);
    lines.push(`  Tree.updateChildProps(handles["${key}"], { style = { ${parts.join(', ')} } })`);
  }

  // Emit prop and text bindings
  for (const b of otherBindings) {
    let luaExpr = b.expr;
    if (b.prop) {
      lines.push(`  Tree.updateChildProps(handles["${b.key}"], { ${b.prop} = ${luaExpr} or "" })`);
    } else {
      lines.push(`  Tree.updateChildProps(handles["${b.key}"], { text = ${luaExpr} or "" })`);
    }
  }
  return lines.join('\n');
}

function emitLua(parsed) {
  const { name, schema, jsxRoot, sourceFile, requires, computeBody, computeHasState,
          renderParam, renderHasState, renderHasComputed, renderLocals, stateSource, handlersBody, tickBody } = parsed;
  const snakeName = toSnakeCase(name);

  resetState();
  activeRenderLocals = renderLocals || {};
  const templateEntries = jsxToTemplate(jsxRoot, sourceFile, '');
  const templateLua = templateToLua(templateEntries, 2);
  const schemaLua = schemaToLua(schema);

  const dataVar = computeBody ? 'data' : 'props';

  // Post-process all dynamic bindings: apply TS→Lua conversion and render local substitution
  for (const b of dynamicBindings) {
    for (const field of ['expr', 'condition']) {
      if (!b[field]) continue;
      let v = b[field];
      // Substitute render locals that weren't caught by AST (fallback getText paths)
      // Only substitute if the local isn't already part of a property access (e.g. data.bg)
      for (const [local, resolved] of Object.entries(renderLocals || {})) {
        // Negative lookbehind: don't replace if preceded by a dot (already resolved)
        v = v.replace(new RegExp('(?<!\\.)\\b' + local + '\\b', 'g'), resolved);
      }
      // When render(props, state, computed): computed.X → data.X, state stays as state
      // When render(props, state) without computed: state.X → data.X (state IS compute output)
      if (renderHasComputed && computeBody) {
        v = v.replace(/\bcomputed\./g, 'data.');
      } else if (renderHasState && computeBody) {
        v = v.replace(/\bstate\./g, 'data.');
      }
      // Convert TS syntax to Lua
      v = tsBlockToLua(v);
      b[field] = v;
    }
  }

  // Post-process pushEvent handler payloads: same substitutions as dynamic bindings
  for (const ph of pushEventHandlers) {
    let v = ph.payload;
    for (const [local_, resolved] of Object.entries(renderLocals || {})) {
      v = v.replace(new RegExp('(?<!\\.)\\b' + local_ + '\\b', 'g'), resolved);
    }
    if (renderHasComputed && computeBody) {
      v = v.replace(/\bcomputed\./g, 'data.');
    } else if (renderHasState && computeBody) {
      v = v.replace(/\bstate\./g, 'data.');
    }
    v = tsBlockToLua(v);
    ph.payload = v;
  }

  const updateLua = bindingsToLua(dynamicBindings, dataVar);

  const requireLines = requires
    // Skip requires for other .tslx capabilities (single PascalCase name, no dots/slashes).
    // These are looked up by type name via Capabilities.registry, not Lua require().
    .filter(r => r.module.includes('.') || r.module.includes('/'))
    .map(r => {
      // Convert / to . for Lua module paths (chemistry/elements → chemistry.elements)
      const luaModule = r.module.replace(/\//g, '.');
      return `local ${r.alias} = require("${luaModule}")`;
    }).join('\n');

  const hasSetState = setStateHandlers.length > 0;
  // setState implies statefulness — the capability needs state + refresh
  const isStateful = stateSource !== null || handlersBody !== null || tickBody !== null || hasSetState;
  const hasPushEvents = pushEventHandlers.length > 0;
  const needsHandlerTable = hasPushEvents || hasSetState || !!handlersBody;

  // Events list for capability registration
  const eventsLua = hasPushEvents
    ? '{ ' + [...new Set(pushEventHandlers.map(ph => `"${ph.name}"`))].join(', ') + ' }'
    : '{}';

  // Generate pushEvent closure assignment lines for use inside create()
  const pushClosureLines = hasPushEvents ? pushEventHandlers.map(ph => {
    let computeLine;
    if (computeBody) {
      computeLine = computeHasState
        ? '      local data = computeData(capState.props, capState.state)'
        : '      local data = computeData(capState.props)';
    } else if (renderParam === 'data') {
      computeLine = '      local data = capState.props';
    } else {
      computeLine = '      local props = capState.props';
    }
    return `    h.__push_${ph.name} = function()\n${computeLine}\n      if Capabilities._pushEventFn then\n        Capabilities._pushEventFn({\n          type = "${ph.name}",\n          payload = ${ph.payload}\n        })\n      end\n    end`;
  }).join('\n') : '';

  // Generate setState closure assignment lines for use inside create()
  // Each closure sets state fields and calls refresh()
  const setStateClosureLines = hasSetState ? setStateHandlers.map(sh => {
    const assignments = sh.fields.map(f => {
      let val = f.val;
      // Apply render local substitution and state→data mapping
      for (const [local_, resolved] of Object.entries(renderLocals || {})) {
        val = val.replace(new RegExp('(?<!\\.)\\b' + local_ + '\\b', 'g'), resolved);
      }
      // In setState context, values referencing list iterator vars stay as-is
      // but computed/state refs need to resolve against the capability's actual state
      val = tsBlockToLua(val);
      return `      capState.state.${f.key} = ${val}`;
    }).join('\n');
    const paramList = (sh.params && sh.params.length > 0) ? sh.params.join(', ') : '';
    return `    h.${sh.handlerKey} = function(${paramList})\n${assignments}\n      refresh()\n    end`;
  }).join('\n') : '';

  // Compute function — use the TSL transpiler for proper AST-based JS→Lua conversion
  let computeFn = '';
  if (computeBody) {
    const tsSig = computeHasState ? 'function computeData(props: any, state: any)' : 'function computeData(props: any)';
    const tsSource = `${tsSig} {\n${computeBody}\n}`;
    try {
      const luaOutput = tslTranspile(tsSource, 'compute.tsl');
      // TSL outputs the whole function; just prefix 'local'
      computeFn = '\n' + luaOutput.replace(/^function /, 'local function ').trim() + '\n';
    } catch (e) {
      // Fallback to regex-based conversion if TSL transpiler fails
      const sig = computeHasState ? 'local function computeData(props, state)' : 'local function computeData(props)';
      const luaBody = tsBlockToLua(computeBody);
      computeFn = `\n${sig}\n${luaBody.split('\n').map(l => '  ' + l).join('\n')}\nend\n`;
      console.error(`Warning: TSL transpile failed for compute block, using fallback: ${e.message}`);
    }
  }

  // Post-process list rebuilder expressions BEFORE building function strings
  for (const lr of listRebuilders) {
    for (const field of ['arrayExpr', 'itemLua']) {
      let v = lr[field];
      if (!v) continue;
      for (const [local_, resolved] of Object.entries(renderLocals || {})) {
        // Skip table key positions: don't replace identifiers followed by ' = ' (but allow '==')
        v = v.replace(new RegExp('(?<!\\.)\\b' + local_ + '\\b(?!\\s*=[^=])', 'g'), resolved);
      }
      if (renderHasComputed && computeBody) {
        v = v.replace(/\bcomputed\./g, 'data.');
      } else if (renderHasState && computeBody) {
        v = v.replace(/\bstate\./g, 'data.');
      }
      v = tsBlockToLua(v);
      lr[field] = v;
    }
  }

  // List rebuilder functions — add extra params when list items reference data/props/state
  const listFns = listRebuilders.map(lr => {
    const allLua = lr.itemLua + ' ' + (lr.arrayExpr || '');
    const needsData = /\bdata\./.test(allLua);
    const needsProps = /\bprops\./.test(allLua) || /\bcapState\.props/.test(allLua);
    lr._needsData = needsData;
    lr._needsProps = needsProps;
    let extraParams = '';
    if (needsData) extraParams += ', data';
    if (needsProps) extraParams += ', props';
    if (lr.needsStateRefresh) extraParams += ', state, refresh';
    const hasNestedMap = lr.itemLua.includes('-- nested_map');
    // When nested map is used, the item code handles its own tmpl appending
    const loopBody = hasNestedMap
      ? `\n${lr.itemLua}`
      : `\n    tmpl[#tmpl + 1] =\n${lr.itemLua}`;
    return `local function rebuildList_${lr.index}(wrapperNodeId, items${extraParams})
  Tree.removeDeclaredChildren(wrapperNodeId)
  if not items or #items == 0 then return end
  local tmpl = {}
  for _i, ${lr.itemParam} in ipairs(items) do${loopBody}
  end
  Tree.declareChildren(wrapperNodeId, tmpl)
end`;
  }).join('\n\n');

  const listCalls = listRebuilders.map(lr => {
    let extraArgs = '';
    if (lr._needsData) extraArgs += ', data';
    if (lr._needsProps) extraArgs += ', props';
    if (lr.needsStateRefresh) extraArgs += ', state, refresh';
    return `  rebuildList_${lr.index}(handles["${lr.wrapperKey}"], ${lr.arrayExpr}${extraArgs})`;
  }).join('\n');

  const anyListNeedsRefresh = listRebuilders.some(lr => lr.needsStateRefresh);

  if (isStateful) {
    // === STATEFUL PATH: state + handlers ===

    // Handlers function
    const handlersFn = handlersBody
      ? `\nlocal function buildHandlers(state, refresh)\n${tsBlockToLua(handlersBody).split('\n').map(l => '  ' + l).join('\n')}\nend\n`
      : '';

    // Tick function
    const tickFn = tickBody
      ? `\nlocal function tickFn(state, dt, props)\n${tsBlockToLua(tickBody).split('\n').map(l => '  ' + l).join('\n')}\nend\n`
      : '';

    // Template function takes h (handler table) when handlers or pushEvent exist
    const templateSig = needsHandlerTable ? 'local function buildTemplate(h)' : 'local function buildTemplate()';

    // updateTree with state parameter
    const allUpdateLines = [updateLua, listCalls].filter(Boolean).join('\n');
    let updateBody;
    if (computeBody) {
      const computeCall = computeHasState
        ? '  local data = computeData(props, state)'
        : '  local data = computeData(props)';
      updateBody = `${computeCall}\n${allUpdateLines || '  -- no dynamic bindings'}`;
    } else {
      updateBody = allUpdateLines || '  -- no dynamic bindings';
    }

    const stateInit = stateSource ? stateSource.replace(/(\w+)\s*:/g, '$1 =') : '{}';

    // Create function — build handlers, stamp template, wire refresh
    let createHandlers;
    if (needsHandlerTable) {
      const parts = [];
      if (handlersBody) {
        parts.push('    local h = buildHandlers(state, refresh)');
      } else {
        parts.push('    local h = {}');
      }
      if (hasPushEvents) parts.push(pushClosureLines);
      if (hasSetState) parts.push(setStateClosureLines);
      parts.push('    capState.handles = Tree.declareChildren(nodeId, buildTemplate(h))');
      if (handlersBody) parts.push('    capState.handlerTable = h');
      createHandlers = parts.join('\n');
    } else {
      createHandlers = '    capState.handles = Tree.declareChildren(nodeId, buildTemplate())';
    }

    return `--[[
  capabilities/${snakeName}.lua — Auto-generated from ${name}.tslx
  DO NOT EDIT — regenerate with: node scripts/tslx_compile.mjs tslx/${name}.tslx
]]

local Capabilities = require("lua.capabilities")
local Tree = require("lua.tree")
${requireLines ? requireLines + '\n' : ''}${computeFn}${handlersFn}${tickFn}${listFns ? listFns + '\n\n' : ''}${templateSig}
  return {
${templateLua}
  }
end

local function updateTree(handles, props, state${anyListNeedsRefresh ? ', refresh' : ''})
${updateBody}
end

Capabilities.register("${name}", {
  visual = false,

  schema = {
${schemaLua}
  },

  events = ${eventsLua},

  create = function(nodeId, props)
    -- Capability node fills its parent (like a React fragment)
    local node = Tree.getNodes()[nodeId]
    if node then
      if not node.style then node.style = {} end
      node.style.width = "100%"
      node.style.height = "100%"
    end
    local state = ${stateInit}
    local capState = { state = state, props = props }
    local function refresh()
      updateTree(capState.handles, capState.props, capState.state${anyListNeedsRefresh ? ', refresh' : ''})
    end
${createHandlers}
    capState.refresh = refresh
    updateTree(capState.handles, props, state${anyListNeedsRefresh ? ', refresh' : ''})
    return capState
  end,

  update = function(nodeId, props, prev, capState)
    capState.props = props
    updateTree(capState.handles, props, capState.state${anyListNeedsRefresh ? ', capState.refresh' : ''})
  end,

  destroy = function(nodeId, capState)
    Tree.removeDeclaredChildren(nodeId)
  end,

  tick = ${tickBody
    ? `function(nodeId, capState, dt, pushEvent)
    tickFn(capState.state, dt, capState.props)
    updateTree(capState.handles, capState.props, capState.state${anyListNeedsRefresh ? ', capState.refresh' : ''})
  end`
    : 'function() end'},
})
`;
  } else {
    // === STATELESS PATH: no state, no handlers ===

    const allUpdateLines = [updateLua, listCalls].filter(Boolean).join('\n');
    const updateBody = computeBody
      ? `  local data = computeData(props)\n${allUpdateLines || '  -- no dynamic bindings'}`
      : (allUpdateLines || '  -- no dynamic bindings');

    const templateSig = needsHandlerTable ? 'local function buildTemplate(h)' : 'local function buildTemplate()';

    // Create/update/destroy bodies differ when pushEvent handlers exist
    let createBody, updateFn, destroyFn;
    if (hasPushEvents) {
      createBody = `    local capState = { props = props }
    local h = {}
${pushClosureLines}
    capState.handles = Tree.declareChildren(nodeId, buildTemplate(h))
    updateTree(capState.handles, props)
    return capState`;
      updateFn = `function(nodeId, props, prev, capState)
    capState.props = props
    updateTree(capState.handles, props)
  end`;
      destroyFn = `function(nodeId, capState)
    Tree.removeDeclaredChildren(nodeId)
  end`;
    } else {
      createBody = `    local handles = Tree.declareChildren(nodeId, buildTemplate())
    updateTree(handles, props)
    return { handles = handles }`;
      updateFn = `function(nodeId, props, prev, state)
    updateTree(state.handles, props)
  end`;
      destroyFn = `function(nodeId, state)
    Tree.removeDeclaredChildren(nodeId)
  end`;
    }

    return `--[[
  capabilities/${snakeName}.lua — Auto-generated from ${name}.tslx
  DO NOT EDIT — regenerate with: node scripts/tslx_compile.mjs tslx/${name}.tslx
]]

local Capabilities = require("lua.capabilities")
local Tree = require("lua.tree")
${requireLines ? requireLines + '\n' : ''}${computeFn}${listFns ? listFns + '\n\n' : ''}${templateSig}
  return {
${templateLua}
  }
end

local function updateTree(handles, props)
${updateBody}
end

Capabilities.register("${name}", {
  visual = false,

  schema = {
${schemaLua}
  },

  events = ${eventsLua},

  create = function(nodeId, props)
    -- Capability node fills its parent (like a React fragment)
    local node = Tree.getNodes()[nodeId]
    if node then
      if not node.style then node.style = {} end
      node.style.width = "100%"
      node.style.height = "100%"
    end
${createBody}
  end,

  update = ${updateFn},

  destroy = ${destroyFn},

  tick = function() end,
})
`;
  }
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
