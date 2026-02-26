/**
 * lint.mjs — Static linter for ReactJIT layout patterns
 *
 * Uses TypeScript's ts.createSourceFile() for fast AST parsing (no type checker).
 * Catches layout mistakes before they reach the renderer.
 *
 * Rules:
 *   no-invalid-style-props      (error)   Style properties not recognized by ReactJIT
 *   no-link-without-to          (error)   <Link> missing "to" prop
 *   no-routes-without-fallback  (warning) <Routes> without path="*" catch-all
 *   no-image-without-src        (error)   <Image> missing "src" prop
 *   no-pressable-without-onpress (warning) <Pressable> without onPress handler
 *   no-usecrud-without-schema   (error)   useCRUD() called without a schema argument
 *
 * Removed rules (layout engine handles these correctly now):
 *   no-text-without-fontsize    — layout engine falls back to default fontSize
 *   no-unicode-symbol-in-text   — DejaVu Sans has full unicode symbol coverage
 *   no-row-justify-without-width — rows resolve width from parent correctly
 *   no-flexrow-flexcolumn       — FlexRow/FlexColumn work fine
 *   no-uncontexted-flexgrow     — flex distribution works without explicit sibling sizes
 *   no-deep-flex-nesting        — handles 8+ levels without explicit dims
 *   no-implicit-container-sizing — handles 12+ children without explicit container size
 *
 * API settings detection:
 *   suggest-settings-menu       (info)    API hooks used without useSettingsRegistry()
 *
 * MCP discovery (async, connects to MCP servers at lint time):
 *   mcp-permissions-required    (error)   useMCPServer() without permissions config
 *   mcp-tool-stale              (warning) Tool in config no longer exposed by server
 *
 * Crypto miner detection (source + bundle, non-suppressable):
 *   no-crypto-miner              (error)   Known mining library, pool domain, or protocol detected
 *
 * Bundle checks (post-build, runs on compiled output):
 *   no-duplicate-context         (error)   Multiple createContext("web") = duplicated shared module
 *
 * TSL checks (runs on .tsl files in src/):
 *   tsl-no-js-globals            (error)   JS globals that don't exist in LuaJIT (console, Date, setTimeout, fetch, window, etc.)
 *   tsl-no-zero-index            (error)   arr[0] is always nil — Lua arrays are 1-indexed
 *   tsl-no-any                   (warning) `any` type suppresses checking — add // tsl-any to suppress intentionally
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';

// ── Constants ────────────────────────────────────────────────

const CONTAINER_TAGS = new Set(['Box', 'view', 'FlexRow', 'FlexColumn']);
const TEXT_TAGS = new Set(['Text']); // Only uppercase — grid targets use <text> which doesn't need fontSize
const ROUTER_TAGS = new Set(['Link', 'Route', 'Routes']);
const IMAGE_TAGS = new Set(['Image', 'image']);
const INTERACTIVE_TAGS = new Set(['Pressable']);

// ── Crypto miner detection signatures ───────────────────────
// Hardcoded fallback patterns. The Lua runtime has a more comprehensive
// database in lua/miner_signatures.lua — these are the build-time gate.
// Non-suppressable: you cannot // rjit-ignore-next-line a miner.

const MINER_LIBRARIES = [
  'coinhive', 'coin-hive', 'coinimp', 'crypto-loot', 'cryptoloot',
  'deepminer', 'jsecoin', 'monerominer', 'xmr-miner', 'webmr',
  'webmine', 'mineralt', 'cryptonight-wasm', 'cryptonight-asmjs',
  'node-cryptonight', 'node-xmr', 'xmrig-node', 'browser-miner',
  'webminer', 'browserminer', 'node-multi-hashing',
];

const MINER_POOL_DOMAINS = [
  'coinhive.com', 'coin-hive.com', 'authedmine.com',
  'crypto-loot.com', 'cryptoloot.pro',
  'moneroocean.stream', 'supportxmr.com', 'minexmr.com',
  'hashvault.pro', 'herominers.com', 'nanopool.org',
  'dwarfpool.com', 'pool.minergate.com', 'p2pool.io',
  'webassembly.stream', 'unmineable.com',
  'miningpoolhub.com', 'zpool.ca', 'zergpool.com',
];

const MINER_PROTOCOL_MARKERS = [
  'stratum+tcp://', 'stratum+ssl://', 'stratum+tls://', 'stratum://',
  'mining.configure', 'mining.notify', 'mining.submit',
  'mining.subscribe', 'mining.authorize',
];

const MINER_BEHAVIORAL_PATTERNS = [
  'cryptonight', 'randomx', 'ethash', 'equihash',
  'kawpow', 'progpow', 'hashrate', 'hash_rate',
];

// Miner-specific config/CLI tokens that survive across builds
// COMPOSITE trigger: could appear in config parsing code individually
const MINER_CONFIG_TOKENS = [
  '--donate-level', '--randomx-init', '--randomx-no-numa',
  '--randomx-1gb-pages', '--cpu-max-threads-hint',
  "'h' hashrate, 'p' pause, 'r' resume",
  'forceASMJS', 'cpuminer',
];

// Miner self-identification strings — HARD trigger
const MINER_STRATUM_AGENTS = [
  'XMRig/', 'xmrig/', 'cpuminer/', 'ccminer/',
];

// WASM export names from known mining modules — HARD trigger
const MINER_WASM_EXPORTS = [
  '_hash_cn', '_cryptonight_hash', '_hash_cn_dark',
  'hash_cn', 'randomx_hash', 'cn_hash',
];

/**
 * Scan source text for crypto miner signatures with confidence scoring.
 * Returns { matches: [{ pattern, category, trigger }], detected: boolean }.
 * Hard triggers (libraries, pool domains, protocol, agents) quarantine on one hit.
 * Composite triggers (behavioral, config tokens) require 2+ from different categories.
 */
function scanForMinerPatterns(source) {
  const lower = source.toLowerCase();
  const matches = [];

  // === HARD triggers (single match = detected) ===

  for (const lib of MINER_LIBRARIES) {
    if (lower.includes(lib)) {
      matches.push({ pattern: lib, category: 'library', trigger: 'hard' });
    }
  }
  for (const domain of MINER_POOL_DOMAINS) {
    if (lower.includes(domain)) {
      matches.push({ pattern: domain, category: 'pool_domain', trigger: 'hard' });
    }
  }
  for (const marker of MINER_PROTOCOL_MARKERS) {
    if (lower.includes(marker.toLowerCase())) {
      matches.push({ pattern: marker, category: 'protocol', trigger: 'hard' });
    }
  }
  for (const agent of MINER_STRATUM_AGENTS) {
    if (lower.includes(agent.toLowerCase())) {
      matches.push({ pattern: agent, category: 'stratum_agent', trigger: 'hard' });
    }
  }
  for (const exp of MINER_WASM_EXPORTS) {
    if (lower.includes(exp.toLowerCase())) {
      matches.push({ pattern: exp, category: 'wasm_export', trigger: 'hard' });
    }
  }

  // === COMPOSITE triggers (need 2+ from different categories) ===

  for (const pattern of MINER_BEHAVIORAL_PATTERNS) {
    if (lower.includes(pattern)) {
      matches.push({ pattern, category: 'behavioral', trigger: 'composite' });
    }
  }
  for (const token of MINER_CONFIG_TOKENS) {
    if (lower.includes(token.toLowerCase())) {
      matches.push({ pattern: token, category: 'config_token', trigger: 'composite' });
    }
  }

  // Evaluate confidence: any hard = detected, OR 2+ distinct composite categories
  let detected = false;
  if (matches.some(m => m.trigger === 'hard')) {
    detected = true;
  } else {
    const compositeCategories = new Set(
      matches.filter(m => m.trigger === 'composite').map(m => m.category)
    );
    detected = compositeCategories.size >= 2;
  }

  return { matches, detected };
}

// ── Color helpers ────────────────────────────────────────────

import { red, yellow, cyan, dim, bold } from '../lib/log.mjs';

// ── Find .tsx / .tsl files recursively ───────────────────────

function findTsxFiles(dir) {
  const files = [];
  const skip = new Set(['node_modules', 'dist', '.git', 'build', 'out']);
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.tsx')) files.push(full);
    }
  }
  walk(dir);
  return files;
}

function findTslFiles(dir) {
  const files = [];
  const skip = new Set(['node_modules', 'dist', '.git', 'build', 'out']);
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.tsl')) files.push(full);
    }
  }
  walk(dir);
  return files;
}

// ── Style extraction from JSX ────────────────────────────────

/**
 * Extract style property info from a JSX opening/self-closing element.
 * Returns null if no style attr, { analyzable: false } if style is a variable,
 * or a full StyleInfo object if it's an inline object literal.
 */
function extractStyleInfo(element, ts) {
  const attrs = element.attributes;
  if (!attrs) return null;

  for (const attr of attrs.properties) {
    if (!ts.isJsxAttribute(attr)) continue;
    if (!attr.name || attr.name.text !== 'style') continue;

    const init = attr.initializer;
    if (!init) return null;

    // style="string" — not a valid pattern in React, skip
    if (ts.isStringLiteral(init)) return null;

    // style={expr}
    if (ts.isJsxExpression(init) && init.expression) {
      const expr = init.expression;

      // style={{ ... }} — analyzable
      if (ts.isObjectLiteralExpression(expr)) {
        return extractFromObjectLiteral(expr, ts);
      }

      // style={variable} or style={fn()} — not analyzable
      return { analyzable: false };
    }

    return null;
  }

  return null; // no style attribute found
}

/**
 * Extract property names and key values from an object literal.
 */
function extractFromObjectLiteral(objLit, ts) {
  const info = {
    analyzable: true,
    hasSpread: false,
    props: new Set(),
    flexDirection: null,
    justifyContent: null,
  };

  for (const prop of objLit.properties) {
    if (ts.isSpreadAssignment(prop) || ts.isSpreadElement?.(prop)) {
      info.hasSpread = true;
      continue;
    }
    if (!ts.isPropertyAssignment(prop)) continue;

    const name = ts.isIdentifier(prop.name)
      ? prop.name.text
      : ts.isStringLiteral(prop.name)
        ? prop.name.text
        : null;
    if (!name) continue;

    info.props.add(name);

    // Extract flexDirection value for sibling analysis
    if (name === 'flexDirection' && ts.isStringLiteral(prop.initializer)) {
      info.flexDirection = prop.initializer.text;
    }
    // Extract justifyContent value for row-width rule
    if (name === 'justifyContent' && ts.isStringLiteral(prop.initializer)) {
      info.justifyContent = prop.initializer.text;
    }
  }

  return info;
}

// ── JSX attribute extraction (for router lint rules) ─────────

/**
 * Extract JSX attribute names and their string literal values from an element.
 * Returns a Map<string, string | true> where:
 *   - string value: attribute has a string literal value
 *   - true: attribute exists but has a non-string or no value
 */
function extractJsxAttrs(element, ts) {
  const attrs = element.attributes;
  if (!attrs) return new Map();

  const result = new Map();
  for (const attr of attrs.properties) {
    if (!ts.isJsxAttribute(attr)) continue;
    if (!attr.name) continue;
    const name = attr.name.text;

    if (!attr.initializer) {
      // Boolean attribute: <Link replace />
      result.set(name, true);
      continue;
    }

    // String literal: <Route path="/foo" />
    if (ts.isStringLiteral(attr.initializer)) {
      result.set(name, attr.initializer.text);
      continue;
    }

    // JSX expression: <Link to={...} />
    if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
      if (ts.isStringLiteral(attr.initializer.expression)) {
        result.set(name, attr.initializer.expression.text);
      } else {
        result.set(name, true); // non-string expression, but attribute exists
      }
      continue;
    }

    result.set(name, true);
  }

  return result;
}

// ── String content extraction from expressions ──────────────

/**
 * Recursively extract string literal content from an expression.
 * Handles ternaries (both branches), concatenation, template literals,
 * and parenthesized expressions. Returns empty string for non-analyzable nodes.
 */
function collectStringContent(node, ts) {
  if (!node) return '';
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isConditionalExpression(node)) {
    // Collect from BOTH branches — either could contain problematic chars
    return collectStringContent(node.whenTrue, ts) + collectStringContent(node.whenFalse, ts);
  }
  if (ts.isParenthesizedExpression(node)) {
    return collectStringContent(node.expression, ts);
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return collectStringContent(node.left, ts) + collectStringContent(node.right, ts);
  }
  if (ts.isTemplateExpression(node)) {
    let result = node.head.text || '';
    for (const span of node.templateSpans) {
      result += collectStringContent(span.expression, ts);
      result += span.literal.text || '';
    }
    return result;
  }
  return '';
}

// ── AST walking — build JsxContext tree ──────────────────────

function getTagName(element, ts) {
  const tag = element.tagName;
  if (ts.isIdentifier(tag)) return tag.text;
  if (ts.isPropertyAccessExpression(tag)) return tag.name.text;
  return null;
}

/**
 * Walk a source file's AST and build a flat list of JsxContext objects,
 * with parent/children/sibling links for rule analysis.
 */
function buildContexts(sourceFile, filePath, ts) {
  const contexts = [];
  const sourceLines = sourceFile.getFullText().split('\n');

  // Check if the line before a node contains an ignore comment
  function isIgnored(lineNum) {
    // lineNum is 1-based
    if (lineNum < 2) return false;
    const prevLine = sourceLines[lineNum - 2]; // -2: 1-based to 0-based, then -1 for previous
    return prevLine && /rjit-ignore-next-line/.test(prevLine);
  }

  function visit(node, jsxParent, flexDepth, isDirectChild) {
    if (ts.isJsxElement(node)) {
      const opening = node.openingElement;
      const tagName = getTagName(opening, ts);
      const style = extractStyleInfo(opening, ts);
      const pos = ts.getLineAndCharacterOfPosition(sourceFile, opening.getStart(sourceFile));
      const line = pos.line + 1;

      const ctx = {
        tagName,
        style,
        parent: jsxParent,
        directChildren: [],
        file: filePath,
        line,
        col: pos.character + 1,
        flexDepth,
        ignored: isIgnored(line),
        _attrs: null,
      };

      // Extract JSX attributes for all ReactJIT primitives (needed for shorthand prop checks)
      if (CONTAINER_TAGS.has(tagName) || TEXT_TAGS.has(tagName) || ROUTER_TAGS.has(tagName) || IMAGE_TAGS.has(tagName) || INTERACTIVE_TAGS.has(tagName)) {
        ctx._attrs = extractJsxAttrs(opening, ts);
      }

      // Extract text content for Text elements so rules can inspect it
      if (TEXT_TAGS.has(tagName)) {
        let textContent = '';
        let hasNonWhitespaceJsxText = false;
        let hasJsxExpression = false;
        for (const child of node.children) {
          if (ts.isJsxText(child)) {
            textContent += child.text;
            if (child.text.trim() !== '') hasNonWhitespaceJsxText = true;
          } else if (ts.isJsxExpression(child) && child.expression) {
            textContent += collectStringContent(child.expression, ts);
            hasJsxExpression = true;
          }
        }
        ctx.textContent = textContent;
        ctx.hasMixedTextChildren = hasNonWhitespaceJsxText && hasJsxExpression;
      }

      contexts.push(ctx);
      if (jsxParent && isDirectChild) {
        jsxParent.directChildren.push(ctx);
      }

      // Compute child flex depth:
      // - Reset to 1 if this container has explicit width AND height (new sizing context)
      // - Reset to 1 if this container has a direct child with explicit main-axis sizing
      //   (sibling establishes the sizing context for all children)
      // - Otherwise increment
      const hasExplicitSizeFromStyle = style && style.analyzable
        && style.props.has('width') && style.props.has('height');
      const hasExplicitSizeFromShorthand = ctx._attrs
        && (ctx._attrs.has('fill') || (ctx._attrs.has('w') && ctx._attrs.has('h')));
      const hasExplicitSize = hasExplicitSizeFromStyle || hasExplicitSizeFromShorthand;

      let hasAnchoredChild = false;
      if (CONTAINER_TAGS.has(tagName) && !hasExplicitSize) {
        const isRow = (style && style.analyzable && style.flexDirection === 'row')
          || (ctx._attrs && ctx._attrs.get('direction') === 'row')
          || tagName === 'FlexRow';
        const mainProp = isRow ? 'width' : 'height';
        const mainShorthand = isRow ? 'w' : 'h';
        for (const child of node.children) {
          let cs = null;
          let childAttrs = null;
          if (ts.isJsxElement(child)) {
            cs = extractStyleInfo(child.openingElement, ts);
            childAttrs = extractJsxAttrs(child.openingElement, ts);
          } else if (ts.isJsxSelfClosingElement(child)) {
            cs = extractStyleInfo(child, ts);
            childAttrs = extractJsxAttrs(child, ts);
          }
          if (cs && cs.analyzable && cs.props.has(mainProp)) {
            hasAnchoredChild = true;
            break;
          }
          if (childAttrs && (childAttrs.has(mainShorthand) || childAttrs.has('fill'))) {
            hasAnchoredChild = true;
            break;
          }
        }
      }

      const childDepth = CONTAINER_TAGS.has(tagName)
        ? ((hasExplicitSize || hasAnchoredChild) ? 1 : flexDepth + 1)
        : flexDepth;

      // Walk JSX children
      for (const child of node.children) {
        if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
          // Direct JSX child
          visit(child, ctx, childDepth, true);
        } else {
          // JsxExpression, JsxText, JsxFragment — walk into, but elements
          // found inside are NOT direct children (they're in expressions)
          ts.forEachChild(child, (c) => visit(c, ctx, childDepth, false));
        }
      }
      return;
    }

    if (ts.isJsxSelfClosingElement(node)) {
      const tagName = getTagName(node, ts);
      const style = extractStyleInfo(node, ts);
      const pos = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
      const line = pos.line + 1;

      const ctx = {
        tagName,
        style,
        parent: jsxParent,
        directChildren: [],
        file: filePath,
        line,
        col: pos.character + 1,
        flexDepth,
        ignored: isIgnored(line),
        _attrs: null,
      };

      // Extract JSX attributes for all ReactJIT primitives (needed for shorthand prop checks)
      if (CONTAINER_TAGS.has(tagName) || TEXT_TAGS.has(tagName) || ROUTER_TAGS.has(tagName) || IMAGE_TAGS.has(tagName) || INTERACTIVE_TAGS.has(tagName)) {
        ctx._attrs = extractJsxAttrs(node, ts);
      }

      contexts.push(ctx);
      if (jsxParent && isDirectChild) {
        jsxParent.directChildren.push(ctx);
      }
      return;
    }

    // Non-JSX nodes: keep walking to find nested JSX
    ts.forEachChild(node, (child) => visit(child, jsxParent, flexDepth, false));
  }

  visit(sourceFile, null, 0, false);
  return contexts;
}

// ── Call expression analysis (for hook lint rules) ────────────

const STORAGE_HOOKS = new Set(['useCRUD', 'useStorage', 'createCRUD']);

/**
 * Walk a source file's AST to find storage hook call expressions.
 * Returns a flat list of call context objects for rule analysis.
 */
function findCallExpressions(sourceFile, filePath, ts) {
  const calls = [];
  const sourceLines = sourceFile.getFullText().split('\n');

  function isIgnored(lineNum) {
    if (lineNum < 2) return false;
    const prevLine = sourceLines[lineNum - 2];
    return prevLine && /rjit-ignore-next-line/.test(prevLine);
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      let funcName = null;
      if (ts.isIdentifier(node.expression)) {
        funcName = node.expression.text;
      }

      if (funcName && STORAGE_HOOKS.has(funcName)) {
        const pos = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
        const line = pos.line + 1;
        calls.push({
          funcName,
          argCount: node.arguments.length,
          file: filePath,
          line,
          col: pos.character + 1,
          ignored: isIgnored(line),
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return calls;
}

const callRules = [
  // useCRUD() requires a schema for type safety and runtime validation
  {
    name: 'no-usecrud-without-schema',
    severity: 'error',
    check(call) {
      if (call.funcName !== 'useCRUD' && call.funcName !== 'createCRUD') return null;
      const minArgs = call.funcName === 'createCRUD' ? 3 : 2;
      if (call.argCount < minArgs) {
        const sig = call.funcName === 'createCRUD'
          ? 'createCRUD(collection, schema, adapter)'
          : 'useCRUD(collection, schema)';
        return `${call.funcName}() requires at least ${minArgs} arguments: ${sig} — schema validation ensures type safety and runtime correctness`;
      }
      return null;
    },
  },
];

// ── API usage detection ───────────────────────────────────────

const API_IMPORT_SOURCES = new Set([
  '@reactjit/apis',
  '@reactjit/ai',
]);

/**
 * Scan a source file for imports from @reactjit/apis or @reactjit/ai,
 * and for useSettingsRegistry() calls. Mutates the apiUsage accumulator.
 */
function detectAPIUsage(sourceFile, filePath, ts, apiUsage) {
  function visit(node) {
    // Detect import declarations from API packages
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      const spec = node.moduleSpecifier;
      if (ts.isStringLiteral(spec)) {
        const mod = spec.text;
        if (API_IMPORT_SOURCES.has(mod) || mod.startsWith('@reactjit/apis/')) {
          const pos = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
          apiUsage.imports.push({
            module: mod,
            file: filePath,
            line: pos.line + 1,
            col: pos.character + 1,
          });
        }
      }
    }

    // Detect useSettingsRegistry() calls
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 'useSettingsRegistry') {
        apiUsage.hasSettingsRegistry = true;
      }
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);
}

// ── MCP server call detection ─────────────────────────────────

/**
 * Walk AST to find useMCPServer() calls and extract their config objects.
 * Returns a list of { name, transport, command, args, url, env, timeout,
 *                      hasPermissions, file, line, col, ignored }.
 */
function findMCPServerCalls(sourceFile, filePath, ts) {
  const calls = [];
  const sourceLines = sourceFile.getFullText().split('\n');

  function isIgnored(lineNum) {
    if (lineNum < 2) return false;
    const prevLine = sourceLines[lineNum - 2];
    return prevLine && /rjit-ignore-next-line/.test(prevLine);
  }

  /** Extract a string literal value from an AST node, or null */
  function getString(node) {
    if (ts.isStringLiteral(node)) return node.text;
    if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    return null;
  }

  /** Extract a numeric literal value from an AST node, or null */
  function getNumber(node) {
    if (ts.isNumericLiteral(node)) return Number(node.text);
    return null;
  }

  /** Extract an array of string literals from an array literal node */
  function getStringArray(node) {
    if (!ts.isArrayLiteralExpression(node)) return null;
    const result = [];
    for (const el of node.elements) {
      const s = getString(el);
      if (s != null) result.push(s);
      else return null; // non-string element — can't analyze
    }
    return result;
  }

  /** Extract a Record<string, string> from an object literal node */
  function getStringRecord(node) {
    if (!ts.isObjectLiteralExpression(node)) return null;
    const result = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) return null;
      const key = ts.isIdentifier(prop.name) ? prop.name.text
        : ts.isStringLiteral(prop.name) ? prop.name.text : null;
      if (!key) return null;
      const val = getString(prop.initializer);
      if (val == null) return null;
      result[key] = val;
    }
    return result;
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      let funcName = null;
      if (ts.isIdentifier(node.expression)) {
        funcName = node.expression.text;
      }

      if (funcName === 'useMCPServer' && node.arguments.length >= 1) {
        const pos = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
        const line = pos.line + 1;
        const configArg = node.arguments[0];

        const info = {
          name: null,
          transport: null,
          command: null,
          args: null,
          url: null,
          env: null,
          headers: null,
          timeout: null,
          hasPermissions: false,
          file: filePath,
          line,
          col: pos.character + 1,
          ignored: isIgnored(line),
        };

        // Extract config from object literal
        if (ts.isObjectLiteralExpression(configArg)) {
          for (const prop of configArg.properties) {
            if (!ts.isPropertyAssignment(prop)) continue;
            const key = ts.isIdentifier(prop.name) ? prop.name.text : null;
            if (!key) continue;

            switch (key) {
              case 'name': info.name = getString(prop.initializer); break;
              case 'transport': info.transport = getString(prop.initializer); break;
              case 'command': info.command = getString(prop.initializer); break;
              case 'args': info.args = getStringArray(prop.initializer); break;
              case 'url': info.url = getString(prop.initializer); break;
              case 'env': info.env = getStringRecord(prop.initializer); break;
              case 'headers': info.headers = getStringRecord(prop.initializer); break;
              case 'timeout': info.timeout = getNumber(prop.initializer); break;
              case 'permissions': info.hasPermissions = true; break;
            }
          }
        }

        calls.push(info);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return calls;
}

// ── MCP async discovery and config management ────────────────

const CHARS_PER_TOKEN = 4;
const PER_TOOL_OVERHEAD = 20;

function estimateToolTokensLint(tool) {
  const json = JSON.stringify({ name: tool.name, description: tool.description, parameters: tool.inputSchema });
  return Math.ceil(json.length / CHARS_PER_TOKEN) + PER_TOOL_OVERHEAD;
}

/**
 * Connect to an MCP server, discover its tools, and manage mcp.tools.json.
 * Returns diagnostics to append.
 */
async function runMCPDiscovery(mcpCalls, cwd, options = {}) {
  const diagnostics = [];
  if (mcpCalls.length === 0) return diagnostics;

  // Read existing config
  const configPath = join(cwd, 'mcp.tools.json');
  let config = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      config = {};
    }
  }

  let configModified = false;

  for (const call of mcpCalls) {
    if (call.ignored) continue;

    // Must have a name to key the config
    if (!call.name) {
      diagnostics.push({
        rule: 'mcp-permissions-required',
        severity: 'error',
        message: 'useMCPServer() config must have a string literal "name" property to identify the server in mcp.tools.json',
        file: call.file,
        line: call.line,
        col: call.col,
      });
      continue;
    }

    // Must have a transport
    if (!call.transport) {
      diagnostics.push({
        rule: 'mcp-permissions-required',
        severity: 'error',
        message: `useMCPServer('${call.name}'): config must have a "transport" property ('stdio' | 'sse' | 'streamable-http')`,
        file: call.file,
        line: call.line,
        col: call.col,
      });
      continue;
    }

    // Try to connect and discover tools
    let discoveredTools = null;
    try {
      discoveredTools = await discoverMCPTools(call);
    } catch (err) {
      diagnostics.push({
        rule: 'mcp-permissions-required',
        severity: 'warning',
        message: `useMCPServer('${call.name}'): could not connect to MCP server (${err.message}). Tool permissions not verified.`,
        file: call.file,
        line: call.line,
        col: call.col,
      });
    }

    if (discoveredTools) {
      const serverConfig = config[call.name] || { tools: {} };
      const existingTools = serverConfig.tools || {};
      let newToolCount = 0;
      let staleToolCount = 0;

      // Add missing tools (disabled by default)
      for (const tool of discoveredTools) {
        if (!existingTools[tool.name]) {
          existingTools[tool.name] = {
            enabled: false,
            confirm: false,
            description: tool.description || '',
            inputSchema: tool.inputSchema || {},
            tokenEstimate: estimateToolTokensLint(tool),
          };
          newToolCount++;
        } else {
          // Update schema and description from live server (keep user's enabled/confirm)
          existingTools[tool.name].description = tool.description || existingTools[tool.name].description;
          existingTools[tool.name].inputSchema = tool.inputSchema || existingTools[tool.name].inputSchema;
          existingTools[tool.name].tokenEstimate = estimateToolTokensLint(tool);
          // Clear stale flag if tool is back
          if (existingTools[tool.name]._stale) {
            delete existingTools[tool.name]._stale;
          }
        }
      }

      // Mark stale tools
      const discoveredNames = new Set(discoveredTools.map(t => t.name));
      for (const [name, perm] of Object.entries(existingTools)) {
        if (!discoveredNames.has(name) && !perm._stale) {
          existingTools[name]._stale = true;
          staleToolCount++;
        }
      }

      // Compute token budget
      const allTokens = discoveredTools.reduce((sum, t) => sum + estimateToolTokensLint(t), 0);
      const pct = ((allTokens / 128000) * 100).toFixed(1);

      serverConfig.tools = existingTools;
      serverConfig.lastDiscovered = new Date().toISOString();
      serverConfig.tokenBudget = {
        totalIfAllEnabled: allTokens,
        note: `~${pct}% of 128K context`,
      };

      config[call.name] = serverConfig;
      configModified = true;

      // Determine if this is a first-time discovery or update
      const isFirstTime = !existsSync(configPath) || !config[call.name]?.tools;

      if (newToolCount > 0 && Object.keys(existingTools).length === newToolCount) {
        // All tools are new — first discovery
        diagnostics.push({
          rule: 'mcp-permissions-required',
          severity: 'info',
          message: `useMCPServer('${call.name}'): discovered ${discoveredTools.length} tools, wrote mcp.tools.json (all disabled). Enable tools in mcp.tools.json and pass permissions to the hook.`,
          file: call.file,
          line: call.line,
          col: call.col,
        });
      } else if (newToolCount > 0) {
        // Some new tools added
        const newNames = discoveredTools
          .filter(t => !existingTools[t.name] || existingTools[t.name]._stale)
          .map(t => `"${t.name}"`)
          .join(', ');
        diagnostics.push({
          rule: 'mcp-permissions-required',
          severity: 'warning',
          message: `useMCPServer('${call.name}'): MCP server exposes ${newToolCount} new tool${newToolCount > 1 ? 's' : ''} not in mcp.tools.json — added as disabled.`,
          file: call.file,
          line: call.line,
          col: call.col,
        });
      }

      if (staleToolCount > 0) {
        diagnostics.push({
          rule: 'mcp-tool-stale',
          severity: 'warning',
          message: `useMCPServer('${call.name}'): ${staleToolCount} tool${staleToolCount > 1 ? 's' : ''} in mcp.tools.json no longer exposed by server (marked _stale).`,
          file: call.file,
          line: call.line,
          col: call.col,
        });
      }
    }

    // Check that permissions prop is present in the hook call
    if (!call.hasPermissions) {
      diagnostics.push({
        rule: 'mcp-permissions-required',
        severity: 'error',
        message: `useMCPServer('${call.name}'): missing "permissions" prop. Import mcp.tools.json and pass: permissions: mcpConfig.${call.name}`,
        file: call.file,
        line: call.line,
        col: call.col,
      });
    }
  }

  // Write updated config
  if (configModified) {
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    if (!options.silent) {
      console.log(`  ${dim('wrote')} mcp.tools.json`);
    }
  }

  return diagnostics;
}

/**
 * Connect to an MCP server and list its tools.
 * Uses child_process for stdio, fetch for HTTP transports.
 * Timeout: 5 seconds for lint-time discovery.
 */
async function discoverMCPTools(callInfo) {
  const DISCOVER_TIMEOUT = 5000;

  if (callInfo.transport === 'stdio') {
    return discoverStdio(callInfo, DISCOVER_TIMEOUT);
  } else if (callInfo.transport === 'sse' || callInfo.transport === 'streamable-http') {
    return discoverHttp(callInfo, DISCOVER_TIMEOUT);
  }

  throw new Error(`Unknown transport: ${callInfo.transport}`);
}

async function discoverStdio(info, timeout) {
  const { spawn } = await import('node:child_process');

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`timeout after ${timeout}ms`));
    }, timeout);

    const env = { ...process.env, ...info.env };
    const proc = spawn(info.command, info.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    let buffer = '';
    let phase = 'initialize'; // initialize → list → done
    let reqId = 1;

    proc.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed);

          if (phase === 'initialize' && json.id === 1) {
            // Initialize response received — send initialized notification + tools/list
            const notification = JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n';
            proc.stdin.write(notification);

            reqId = 2;
            const listReq = JSON.stringify({ jsonrpc: '2.0', id: reqId, method: 'tools/list', params: {} }) + '\n';
            proc.stdin.write(listReq);
            phase = 'list';
          } else if (phase === 'list' && json.id === 2) {
            // Tools list received
            clearTimeout(timer);
            proc.stdin.end();
            proc.kill();
            if (json.error) {
              reject(new Error(`MCP error: ${json.error.message}`));
            } else {
              resolve(json.result?.tools || []);
            }
          }
        } catch {}
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn: ${err.message}`));
    });

    proc.on('exit', (code) => {
      clearTimeout(timer);
      if (phase !== 'done') {
        reject(new Error(`Process exited with code ${code} before discovery completed`));
      }
    });

    // Send initialize request
    const initReq = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-05',
        capabilities: {},
        clientInfo: { name: 'reactjit-lint', version: '1.0.0' },
      },
    }) + '\n';
    proc.stdin.write(initReq);
  });
}

async function discoverHttp(info, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    // Initialize
    const initResp = await fetch(info.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...info.headers },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: {
          protocolVersion: '2025-11-05',
          capabilities: {},
          clientInfo: { name: 'reactjit-lint', version: '1.0.0' },
        },
      }),
      signal: controller.signal,
    });

    if (!initResp.ok) throw new Error(`HTTP ${initResp.status}`);
    const initJson = await initResp.json();
    if (initJson.error) throw new Error(`MCP: ${initJson.error.message}`);

    // Send initialized notification (fire and forget)
    fetch(info.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...info.headers },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }),
    }).catch(() => {});

    // List tools
    const listResp = await fetch(info.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...info.headers },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
      signal: controller.signal,
    });

    if (!listResp.ok) throw new Error(`HTTP ${listResp.status}`);
    const listJson = await listResp.json();
    if (listJson.error) throw new Error(`MCP: ${listJson.error.message}`);

    return listJson.result?.tools || [];
  } finally {
    clearTimeout(timer);
  }
}

// ── Rules ────────────────────────────────────────────────────

const rules = [

  // Invalid style properties that don't exist in ReactJIT
  // Only checks ReactJIT primitives (Box, Text, Image, view, text) — not HTML elements
  {
    name: 'no-invalid-style-props',
    severity: 'error',
    check(ctx) {
      if (!ctx.style || !ctx.style.analyzable) return null;

      // Only lint ReactJIT primitives, not HTML elements like div/span/nav
      const ILOVE_TAGS = new Set([...CONTAINER_TAGS, ...TEXT_TAGS, 'Image', 'image', 'Pressable', 'ScrollView', 'TextInput']);
      if (!ILOVE_TAGS.has(ctx.tagName)) return null;

      const VALID_PROPS = new Set([
        // Sizing
        'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'aspectRatio',
        // Flexbox
        'display', 'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'alignSelf',
        'flexGrow', 'flexShrink', 'flexBasis', 'gap',
        // Spacing
        'padding', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom',
        'margin', 'marginLeft', 'marginRight', 'marginTop', 'marginBottom',
        // Visual
        'backgroundColor', 'borderRadius', 'borderWidth',
        'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
        'borderColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
        'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
        'overflow', 'opacity', 'zIndex', 'scrollX', 'scrollY',
        'visibility',
        // Shadow
        'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'shadowBlur',
        // Gradient
        'backgroundGradient',
        // Transform
        'transform',
        // Text
        'color', 'fontSize', 'fontFamily', 'fontWeight', 'textAlign',
        'textOverflow', 'textDecorationLine', 'lineHeight', 'letterSpacing',
        'userSelect',
        // Text shadow
        'textShadowColor', 'textShadowOffsetX', 'textShadowOffsetY',
        // Image
        'objectFit',
        // Position
        'position', 'top', 'bottom', 'left', 'right',
        // Outline
        'outlineColor', 'outlineWidth', 'outlineOffset',
        // Transitions & Animations (Lua-side)
        'transition', 'animation',
      ]);

      const invalid = [];
      for (const prop of ctx.style.props) {
        if (!VALID_PROPS.has(prop)) {
          invalid.push(prop);
        }
      }

      if (invalid.length > 0) {
        return `Invalid style propert${invalid.length > 1 ? 'ies' : 'y'}: ${invalid.join(', ')} — not recognized by ReactJIT's style system`;
      }
      return null;
    },
  },

  // ── Router rules ──────────────────────────────────────────

  // <Link> without a `to` prop navigates nowhere
  {
    name: 'no-link-without-to',
    severity: 'error',
    check(ctx) {
      if (ctx.tagName !== 'Link') return null;
      if (!ctx._attrs) return null;
      if (ctx._attrs.has('to')) return null;
      return '<Link> is missing the "to" prop — it must specify a navigation target (e.g. <Link to="/page">)';
    },
  },

  // <Routes> without a path="*" fallback renders nothing for unmatched URLs
  {
    name: 'no-routes-without-fallback',
    severity: 'warning',
    check(ctx) {
      if (ctx.tagName !== 'Routes') return null;
      if (ctx.directChildren.length === 0) return null;

      const hasCatchAll = ctx.directChildren.some((child) => {
        return child.tagName === 'Route' && child._attrs && child._attrs.get('path') === '*';
      });

      if (!hasCatchAll) {
        return '<Routes> has no <Route path="*"> fallback — unmatched URLs will render nothing. Add a catch-all route for 404 handling';
      }
      return null;
    },
  },

  // ── Image rules ───────────────────────────────────────────────

  // <Image> without a `src` prop renders nothing
  {
    name: 'no-image-without-src',
    severity: 'error',
    check(ctx) {
      if (!IMAGE_TAGS.has(ctx.tagName)) return null;
      if (!ctx._attrs) return null;
      if (ctx._attrs.has('src')) return null;
      return '<Image> is missing the "src" prop — it must specify an image source (e.g. <Image src="path/to/image.png" />)';
    },
  },

  // ── Interactive element rules ─────────────────────────────────

  // <Pressable> without onPress creates a clickable element that does nothing
  {
    name: 'no-pressable-without-onpress',
    severity: 'warning',
    check(ctx) {
      if (!INTERACTIVE_TAGS.has(ctx.tagName)) return null;
      if (!ctx._attrs) return null;
      if (ctx._attrs.has('onPress')) return null;
      return '<Pressable> has no "onPress" handler — it creates an interactive element that does nothing when clicked. Add an onPress prop or use a Box instead';
    },
  },

];

// ── TSL lint ─────────────────────────────────────────────────

// JS globals that silently don't exist in LuaJIT.
// Accessing these produces nil/errors at runtime, not at transpile time.
const TSL_BANNED_GLOBALS = new Set([
  'console', 'Date', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'fetch', 'window', 'document', 'navigator', 'location', 'history',
  'localStorage', 'sessionStorage', 'XMLHttpRequest', 'WebSocket',
  'Promise', 'Symbol', 'WeakMap', 'WeakSet', 'Proxy', 'Reflect',
  'process', 'Buffer', 'global', 'globalThis',
]);

/**
 * Lint a single .tsl file using the TypeScript AST.
 * Returns a flat list of diagnostic objects.
 */
function lintTslFile(filePath, source, ts) {
  const diagnostics = [];
  const sourceLines = source.split('\n');

  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.ES2020,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  function lineOf(node) {
    return ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).line + 1;
  }

  function colOf(node) {
    return ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).character + 1;
  }

  // Check if the line before `lineNum` (1-based) contains a suppression comment.
  // For TSL we use `// tsl-ignore` or the shared `rjit-ignore-next-line`.
  function isIgnored(lineNum) {
    if (lineNum < 2) return false;
    const prev = sourceLines[lineNum - 2] || '';
    return /tsl-ignore|rjit-ignore-next-line/.test(prev);
  }

  // Track identifiers that are locally declared so we can avoid false positives
  // on things like `const Date = myCustomThing`. Simple heuristic: if the name
  // appears in a VariableDeclaration or Parameter at any scope, don't flag it.
  const locallyDeclared = new Set();
  function collectDeclarations(node) {
    if (
      ts.isVariableDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isArrowFunction(node)
    ) {
      if (node.name && ts.isIdentifier(node.name)) {
        locallyDeclared.add(node.name.text);
      }
      if (ts.isFunctionDeclaration(node) && node.parameters) {
        for (const p of node.parameters) {
          if (ts.isIdentifier(p.name)) locallyDeclared.add(p.name.text);
        }
      }
    }
    ts.forEachChild(node, collectDeclarations);
  }
  collectDeclarations(sourceFile);

  function visit(node) {
    // ── Rule: no-js-globals ──────────────────────────────────
    // Flag references to JS globals that don't exist in LuaJIT.
    // Matches:
    //   - console.log(...)         → PropertyAccessExpression, obj=console
    //   - setTimeout(fn, 100)      → CallExpression callee is banned Identifier
    //   - window.innerWidth        → PropertyAccessExpression, obj=window
    //   - document.getElementById  → PropertyAccessExpression, obj=document
    //   - new Date()               → NewExpression callee=Date (already hard-errors on `new`, but flag the global too)
    if (ts.isIdentifier(node)) {
      const name = node.text;
      if (TSL_BANNED_GLOBALS.has(name) && !locallyDeclared.has(name)) {
        // Only flag identifiers that are in expression position (not as a
        // property name in `obj.console` or an import specifier).
        const parent = node.parent;
        const isPropertyName =
          parent &&
          ts.isPropertyAccessExpression(parent) &&
          parent.name === node;
        const isImportSpecifier =
          parent && (ts.isImportSpecifier(parent) || ts.isImportClause(parent));
        const isTypeReference =
          parent && ts.isTypeReferenceNode(parent);

        if (!isPropertyName && !isImportSpecifier && !isTypeReference) {
          const line = lineOf(node);
          if (!isIgnored(line)) {
            diagnostics.push({
              rule: 'tsl-no-js-globals',
              severity: 'error',
              message: `"${name}" doesn't exist in LuaJIT — this will produce nil or a runtime error. ${name === 'console' ? 'Use print() instead.' : name === 'Date' ? 'Use os.time() or os.date() instead.' : `Remove it or rewrite using Lua stdlib.`}`,
              file: filePath,
              line,
              col: colOf(node),
            });
          }
        }
      }
    }

    // ── Rule: tsl-no-zero-index ──────────────────────────────
    // arr[0] compiles to Lua arr[0] which is nil — Lua arrays are 1-indexed.
    if (ts.isElementAccessExpression(node)) {
      const arg = node.argumentExpression;
      if (ts.isNumericLiteral(arg) && arg.text === '0') {
        const line = lineOf(node);
        if (!isIgnored(line)) {
          diagnostics.push({
            rule: 'tsl-no-zero-index',
            severity: 'error',
            message: 'Array index [0] is always nil in Lua — arrays are 1-indexed. Use [1] for the first element.',
            file: filePath,
            line,
            col: colOf(node),
          });
        }
      }
    }

    // ── Rule: tsl-no-any ────────────────────────────────────
    // `any` silently suppresses type checking. Warn unless suppressed with // tsl-any.
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const line = lineOf(node);
      // tsl-any on the same line or the line above both count as suppression
      const sameLine = sourceLines[line - 1] || '';
      const prevLine = sourceLines[line - 2] || '';
      const suppressed =
        /tsl-any|tsl-ignore|rjit-ignore-next-line/.test(sameLine) ||
        /tsl-any|tsl-ignore|rjit-ignore-next-line/.test(prevLine);
      if (!suppressed) {
        diagnostics.push({
          rule: 'tsl-no-any',
          severity: 'warning',
          message: '`any` suppresses type checking — give this a concrete type or table shape. Add `// tsl-any` to suppress intentionally.',
          file: filePath,
          line,
          col: colOf(node),
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return diagnostics;
}

/**
 * Run TSL lint on all .tsl files under srcDir.
 * Returns flat diagnostics array.
 */
function runTslLint(srcDir, ts) {
  const files = findTslFiles(srcDir);
  const diagnostics = [];
  for (const filePath of files) {
    const source = readFileSync(filePath, 'utf-8');
    diagnostics.push(...lintTslFile(filePath, source, ts));
  }
  return { diagnostics, fileCount: files.length };
}

// ── Public API ───────────────────────────────────────────────

/**
 * Run the linter on all .tsx files under `cwd/src/`.
 * Returns { errors, warnings, diagnostics }.
 */
export async function runLint(cwd, options = {}) {
  const _require = createRequire(import.meta.url);
  let ts;
  try {
    ts = _require('typescript');
  } catch {
    console.error('  typescript not found — install it: npm install -D typescript');
    return { errors: 0, warnings: 0, diagnostics: [] };
  }

  const srcDir = join(cwd, 'src');
  if (!existsSync(srcDir)) {
    if (!options.silent) console.error('  No src/ directory found.');
    return { errors: 0, warnings: 0, diagnostics: [] };
  }

  const files = findTsxFiles(srcDir);
  const diagnostics = [];
  const allMCPCalls = [];
  const apiUsage = { imports: [], hasSettingsRegistry: false };

  for (const filePath of files) {
    const source = readFileSync(filePath, 'utf-8');

    // Crypto miner detection — scans raw source for mining signatures.
    // Non-suppressable: rjit-ignore-next-line does NOT work for this rule.
    // Uses confidence scoring: hard triggers on single hit, composite needs 2+ categories.
    const minerResult = scanForMinerPatterns(source);
    if (minerResult.detected) {
      const patternList = minerResult.matches.map(m =>
        `${m.category}: "${m.pattern}" [${m.trigger}]`
      ).join(', ');
      diagnostics.push({
        rule: 'no-crypto-miner',
        severity: 'error',
        message: `Crypto miner signature detected: ${patternList}. Mining code is not allowed in ReactJIT applications.`,
        file: filePath,
        line: 1,
        col: 1,
      });
    }

    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.ES2020,
      /* setParentNodes */ true,
      ts.ScriptKind.TSX,
    );

    const contexts = buildContexts(sourceFile, filePath, ts);

    for (const ctx of contexts) {
      if (ctx.ignored) continue; // rjit-ignore-next-line
      for (const rule of rules) {
        const message = rule.check(ctx);
        if (message) {
          diagnostics.push({
            rule: rule.name,
            severity: rule.severity,
            message,
            file: filePath,
            line: ctx.line,
            col: ctx.col,
          });
        }
      }
    }

    // Call expression rules (storage hooks, etc.)
    const calls = findCallExpressions(sourceFile, filePath, ts);
    for (const call of calls) {
      if (call.ignored) continue;
      for (const rule of callRules) {
        const message = rule.check(call);
        if (message) {
          diagnostics.push({
            rule: rule.name,
            severity: rule.severity,
            message,
            file: filePath,
            line: call.line,
            col: call.col,
          });
        }
      }
    }

    // MCP server calls
    const mcpCalls = findMCPServerCalls(sourceFile, filePath, ts);
    allMCPCalls.push(...mcpCalls);

    // API usage detection — find imports from @reactjit/apis or @reactjit/ai
    detectAPIUsage(sourceFile, filePath, ts, apiUsage);
  }

  // TSL lint pass — scan .tsl files in src/
  const { diagnostics: tslDiagnostics, fileCount: tslFileCount } = runTslLint(srcDir, ts);
  diagnostics.push(...tslDiagnostics);

  if (files.length === 0 && tslFileCount === 0) {
    if (!options.silent) console.log('  No .tsx or .tsl files found in src/.');
    return { errors: 0, warnings: 0, diagnostics: [] };
  }

  // Async MCP discovery pass — connect to servers and manage mcp.tools.json
  if (allMCPCalls.length > 0) {
    if (!options.silent) {
      console.log(`  ${dim('MCP')} found ${allMCPCalls.length} useMCPServer() call${allMCPCalls.length > 1 ? 's' : ''}, discovering tools...`);
    }
    const mcpDiagnostics = await runMCPDiscovery(allMCPCalls, cwd, options);
    diagnostics.push(...mcpDiagnostics);
  }

  // API settings menu suggestion
  if (apiUsage.imports.length > 0 && !apiUsage.hasSettingsRegistry) {
    const first = apiUsage.imports[0];
    diagnostics.push({
      rule: 'suggest-settings-menu',
      severity: 'info',
      message: `API hooks detected (${apiUsage.imports.length} import${apiUsage.imports.length > 1 ? 's' : ''}) without useSettingsRegistry(). Add it to enable the in-app API key manager (F10).`,
      file: first.file,
      line: first.line,
      col: first.col,
    });
  }

  // Sort diagnostics by file, then line
  diagnostics.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  // Report
  let errors = 0;
  let warnings = 0;

  if (diagnostics.length > 0 && !options.silent) {
    console.log('');

    let lastFile = null;
    for (const d of diagnostics) {
      const relPath = relative(cwd, d.file);

      // Group by file
      if (relPath !== lastFile) {
        if (lastFile) console.log('');
        console.log(`  ${bold(relPath)}`);
        lastFile = relPath;
      }

      const sev = d.severity === 'error' ? red('error')
        : d.severity === 'info' ? cyan('info ')
        : yellow('warn ');
      const loc = dim(`${d.line}:${d.col}`);
      const ruleName = dim(`[${d.rule}]`);

      console.log(`    ${loc}  ${sev}  ${d.message}  ${ruleName}`);

      if (d.severity === 'error') errors++;
      else if (d.severity === 'warning') warnings++;
    }

    console.log('');
    const parts = [];
    if (errors > 0) parts.push(red(`${errors} error${errors !== 1 ? 's' : ''}`));
    if (warnings > 0) parts.push(yellow(`${warnings} warning${warnings !== 1 ? 's' : ''}`));
    const totalFiles = files.length + tslFileCount;
    console.log(`  ${parts.join(', ')} in ${totalFiles} file${totalFiles !== 1 ? 's' : ''}`);
    console.log('');
  } else if (!options.silent) {
    const totalFiles = files.length + tslFileCount;
    console.log(`\n  ${dim('OK')} ${totalFiles} file${totalFiles !== 1 ? 's' : ''} checked, no issues\n`);
  }

  return { errors, warnings, diagnostics };
}

/**
 * Post-build bundle checks.
 *
 * Scans the compiled bundle for structural problems that can't be caught
 * by source-level linting (e.g. duplicate module instances from divergent
 * import paths).
 *
 * Rules:
 *   no-duplicate-context  (error)  Multiple createContext("web") calls indicate
 *                                  duplicated shared module — components will read
 *                                  the wrong React context and silently break.
 */
export function runBundleChecks(bundlePath, options = {}) {
  if (!existsSync(bundlePath)) {
    return { errors: 0, diagnostics: [] };
  }

  const source = readFileSync(bundlePath, 'utf-8');
  const diagnostics = [];

  // Count createContext("web") / createContext('web') occurrences.
  // A healthy bundle has exactly one (from packages/core/src/context.ts).
  // Two or more means esbuild bundled separate copies of the shared package
  // (e.g. @reactjit/core resolved to a stale copy instead of packages/core/src).
  // esbuild emits `(0, import_react.createContext)("web")` — match both forms.
  const contextPattern = /createContext\)\(["']web["']\)|createContext\(["']web["']\)/g;
  const matches = [];
  let m;
  while ((m = contextPattern.exec(source)) !== null) {
    matches.push(m.index);
  }

  if (matches.length > 1) {
    // Find approximate line numbers for the matches
    const locations = matches.map((idx) => {
      const before = source.slice(0, idx);
      return before.split('\n').length;
    });

    diagnostics.push({
      rule: 'no-duplicate-context',
      severity: 'error',
      message: `Bundle contains ${matches.length} createContext("web") calls (lines: ${locations.join(', ')}) — this means the shared package was bundled multiple times from different import paths. All imports must resolve to the same physical file. Check for @reactjit/core imports that should be relative paths to packages/core/src.`,
      file: bundlePath,
      line: locations[0],
      col: 1,
    });
  }

  // Crypto miner detection on the final bundle.
  // This catches miners that enter via node_modules dependencies
  // (not visible in user source files during source-level lint).
  // Uses confidence scoring: hard triggers on single hit, composite needs 2+ categories.
  const minerResult = scanForMinerPatterns(source);
  if (minerResult.detected) {
    const patternList = minerResult.matches.map(m =>
      `${m.category}: "${m.pattern}" [${m.trigger}]`
    ).join(', ');
    diagnostics.push({
      rule: 'no-crypto-miner',
      severity: 'error',
      message: `Crypto miner signature detected in bundle: ${patternList}. A dependency may contain mining code. Audit your node_modules.`,
      file: bundlePath,
      line: 1,
      col: 1,
    });
  }

  // Report
  let errors = 0;
  if (diagnostics.length > 0 && !options.silent) {
    console.log('');
    console.log(`  ${bold('Bundle checks:')} ${bundlePath}`);
    for (const d of diagnostics) {
      const sev = red('error');
      const ruleName = dim(`[${d.rule}]`);
      console.log(`    ${sev}  ${d.message}  ${ruleName}`);
      errors++;
    }
    console.log('');
  }

  return { errors, diagnostics };
}

/**
 * CLI entry point for `reactjit lint`.
 */
export async function lintCommand(args) {
  const cwd = process.cwd();
  console.log('\n  ReactJIT lint\n');
  const { errors } = await runLint(cwd);
  if (errors > 0) process.exit(1);
}
