/**
 * lint.mjs — Static linter for ReactJIT layout patterns
 *
 * Uses TypeScript's ts.createSourceFile() for fast AST parsing (no type checker).
 * Catches layout mistakes before they reach the renderer.
 *
 * Rules:
 *   no-text-without-fontsize    (error)   Text without fontSize cannot be measured
 *   no-unicode-symbol-in-text   (error)   Unicode symbols in Text won't render in Love2D
 *   no-mixed-text-children      (error)   Mixed text + expressions create overlapping __TEXT__ nodes
 *   no-row-justify-without-width (error)  Row with justifyContent but no width
 *   no-uncontexted-flexgrow     (warning) flexGrow where siblings lack explicit sizing
 *   no-deep-flex-nesting        (warning) 3+ flex container levels without explicit dimensions
 *   no-flexrow-flexcolumn       (warning) Prefer Box with flexDirection
 *   no-implicit-container-sizing (warning) >5 children without explicit container size
 *   no-link-without-to          (error)   <Link> missing "to" prop
 *   no-routes-without-fallback  (warning) <Routes> without path="*" catch-all
 *   no-image-without-src        (error)   <Image> missing "src" prop
 *   no-pressable-without-onpress (warning) <Pressable> without onPress handler
 *   no-usecrud-without-schema   (error)   useCRUD() called without a schema argument
 *
 * API settings detection:
 *   suggest-settings-menu       (info)    API hooks used without useSettingsRegistry()
 *
 * MCP discovery (async, connects to MCP servers at lint time):
 *   mcp-permissions-required    (error)   useMCPServer() without permissions config
 *   mcp-tool-stale              (warning) Tool in config no longer exposed by server
 *
 * Bundle checks (post-build, runs on compiled output):
 *   no-duplicate-context         (error)   Multiple createContext("web") = duplicated shared module
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

// ── Color helpers ────────────────────────────────────────────

const color = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;
const red    = color('31');
const yellow = color('33');
const cyan   = color('36');
const dim    = color('2');
const bold   = color('1');

// ── Find .tsx files recursively ──────────────────────────────

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
    return prevLine && /ilr-ignore-next-line/.test(prevLine);
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
    return prevLine && /ilr-ignore-next-line/.test(prevLine);
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
    return prevLine && /ilr-ignore-next-line/.test(prevLine);
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

  // Every <Text> must have fontSize for Love2D/Web measurement
  {
    name: 'no-text-without-fontsize',
    severity: 'error',
    check(ctx) {
      if (!TEXT_TAGS.has(ctx.tagName)) return null;

      // Accept shorthand `size` prop on the element: <Text size={14}>
      if (ctx._attrs && ctx._attrs.has('size')) return null;

      // No style attribute at all
      if (!ctx.style) {
        return 'Text element has no style attribute — fontSize (or size shorthand) is required for Love2D/Web targets';
      }

      // Style is a variable — can't verify, skip
      if (!ctx.style.analyzable) return null;

      // Has spread — fontSize might be in the spread, skip
      if (ctx.style.hasSpread && !ctx.style.props.has('fontSize')) return null;

      // Has fontSize — OK
      if (ctx.style.props.has('fontSize')) return null;

      return 'Text element missing fontSize in style (or size shorthand) — required for text measurement on Love2D/Web';
    },
  },

  // Unicode symbols (geometric shapes, arrows, dingbats, block elements, technical
  // symbols, etc.) don't render in Love2D's default font. They must be converted to
  // Box-based geometry — e.g., a play triangle as colored Box elements, pause bars as
  // two narrow Box elements, block characters as a boolean grid with backgroundColor.
  {
    name: 'no-unicode-symbol-in-text',
    severity: 'error',
    check(ctx) {
      if (!TEXT_TAGS.has(ctx.tagName)) return null;
      if (!ctx.textContent) return null;

      // Unicode blocks that contain "icon" characters Love2D's font won't render
      const SYMBOL_RANGES = [
        [0x2190, 0x21FF], // Arrows (← ↑ → ↓ ⇒ etc.)
        [0x2200, 0x22FF], // Mathematical Operators (∞ ≤ ≥ ≠ etc.)
        [0x2300, 0x23FF], // Miscellaneous Technical (⌘ ⏎ ⏸ ⏹ ⏺ etc.)
        [0x2500, 0x257F], // Box Drawing (─ │ ┌ ┐ └ ┘ etc.)
        [0x2580, 0x259F], // Block Elements (█ ▀ ▄ ▌ ▐ etc.)
        [0x25A0, 0x25FF], // Geometric Shapes (■ □ ▲ ▶ ● ○ etc.)
        [0x2600, 0x26FF], // Miscellaneous Symbols (☀ ☎ ♠ ♣ ♥ etc.)
        [0x2700, 0x27BF], // Dingbats (✂ ✓ ✗ ✦ etc.)
        [0x2B00, 0x2BFF], // Misc Symbols and Arrows (⬆ ⬇ ⬛ ⭐ etc.)
        [0x1F300, 0x1F9FF], // Emoji / Symbols / Pictographs
      ];

      function isSymbol(cp) {
        for (const [lo, hi] of SYMBOL_RANGES) {
          if (cp >= lo && cp <= hi) return true;
        }
        return false;
      }

      const found = [];
      for (const ch of ctx.textContent) {
        const cp = ch.codePointAt(0);
        if (isSymbol(cp)) {
          const hex = 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
          if (!found.some(f => f.hex === hex)) {
            found.push({ char: ch, hex });
          }
        }
      }

      if (found.length === 0) return null;

      const chars = found.map(f => `${f.char} (${f.hex})`).join(', ');
      return `Text contains Unicode symbol${found.length > 1 ? 's' : ''}: ${chars} — these won't render in Love2D's default font. Use Box-based geometry instead (colored Box elements for shapes, see NeofetchDemo heart pattern)`;
    },
  },

  // Mixed text and expressions in <Text> creates multiple __TEXT__ nodes.
  // The layout engine lays them out as separate flex items at y=0, causing overlap.
  // Fix: use a template literal {`text ${value}`} to produce a single __TEXT__ node.
  {
    name: 'no-mixed-text-children',
    severity: 'error',
    check(ctx) {
      if (!TEXT_TAGS.has(ctx.tagName)) return null;
      if (!ctx.hasMixedTextChildren) return null;

      return 'Mixed text and expressions in <Text> creates multiple __TEXT__ nodes that overlap in layout — use a template literal instead: {`text ${value}`}';
    },
  },

  // Row containers with justifyContent may need explicit width for predictable alignment
  {
    name: 'no-row-justify-without-width',
    severity: 'warning',
    check(ctx) {
      if (!CONTAINER_TAGS.has(ctx.tagName)) return null;

      const attrs = ctx._attrs;

      // Determine if this is a row (style.flexDirection or direction shorthand)
      const isRowFromStyle = ctx.style && ctx.style.analyzable && ctx.style.flexDirection === 'row';
      const isRowFromShorthand = attrs && (attrs.get('direction') === 'row');
      const isRow = isRowFromStyle || isRowFromShorthand || ctx.tagName === 'FlexRow';
      if (!isRow) return null;

      // Check for justifyContent in style or justify shorthand
      const hasJustifyInStyle = ctx.style && ctx.style.analyzable && ctx.style.props.has('justifyContent');
      const hasJustifyShorthand = attrs && attrs.has('justify');
      if (!hasJustifyInStyle && !hasJustifyShorthand) return null;

      // Check for width in style or w shorthand or fill shorthand
      const hasWidthInStyle = ctx.style && ctx.style.analyzable && ctx.style.props.has('width');
      const hasWidthShorthand = attrs && (attrs.has('w') || attrs.has('fill'));
      if (hasWidthInStyle || hasWidthShorthand) return null;

      // Style has spread — width might be in the spread, skip
      if (ctx.style && ctx.style.analyzable && ctx.style.hasSpread) return null;

      // "start" is the default — it doesn't distribute space, so no width needed
      const justifyValue = (ctx.style && ctx.style.analyzable && ctx.style.justifyContent)
        || (attrs && typeof attrs.get('justify') === 'string' && attrs.get('justify'));
      if (justifyValue === 'start' || justifyValue === 'flex-start') return null;

      return "Row with justifyContent may need explicit width for predictable alignment (auto-sizing uses content width)";
    },
  },

  // Prefer <Box style={{ flexDirection: 'row' }}> over <FlexRow>
  {
    name: 'no-flexrow-flexcolumn',
    severity: 'warning',
    check(ctx) {
      if (ctx.tagName === 'FlexRow') {
        return "Use <Box style={{ flexDirection: 'row' }}> instead of <FlexRow> — keeps the layout tree transparent";
      }
      if (ctx.tagName === 'FlexColumn') {
        return 'Use <Box> instead of <FlexColumn> — column is the default flexDirection';
      }
      return null;
    },
  },

  // flexGrow where siblings lack explicit main-axis sizing, OR all siblings grow with no sizes
  {
    name: 'no-uncontexted-flexgrow',
    severity: 'warning',
    check(ctx) {
      // Check for flexGrow in style or grow shorthand
      const hasGrowInStyle = ctx.style && ctx.style.analyzable && ctx.style.props.has('flexGrow');
      const hasGrowShorthand = ctx._attrs && ctx._attrs.has('grow');
      if (!hasGrowInStyle && !hasGrowShorthand) return null;

      // Need a parent with multiple direct children for sibling analysis
      if (!ctx.parent || ctx.parent.directChildren.length < 2) return null;

      // Determine parent's flex direction
      let parentDir = 'column'; // default
      if (ctx.parent.tagName === 'FlexRow') {
        parentDir = 'row';
      } else if (ctx.parent.style && ctx.parent.style.analyzable && ctx.parent.style.flexDirection) {
        parentDir = ctx.parent.style.flexDirection;
      } else if (ctx.parent._attrs && ctx.parent._attrs.get('direction') === 'row') {
        parentDir = 'row';
      }

      const mainProp = parentDir === 'row' ? 'width' : 'height';
      const mainShorthand = parentDir === 'row' ? 'w' : 'h';
      const siblings = ctx.parent.directChildren.filter((s) => s !== ctx);

      // Helper: does a node have explicit main-axis size (style or shorthand)?
      function hasMainSize(node) {
        if (node.style && node.style.analyzable && node.style.props.has(mainProp)) return true;
        if (node._attrs && (node._attrs.has(mainShorthand) || node._attrs.has('fill'))) return true;
        return false;
      }

      // Helper: does a node use flexGrow (style or shorthand)?
      function hasGrow(node) {
        if (node.style && node.style.analyzable && node.style.props.has('flexGrow')) return true;
        if (node._attrs && node._attrs.has('grow')) return true;
        return false;
      }

      // Case 1: ALL siblings also grow and NONE have explicit main-axis size
      const analyzableSibs = siblings.filter(
        (s) => (s.style && s.style.analyzable && !s.style.hasSpread) || s._attrs,
      );
      if (analyzableSibs.length > 0) {
        const allGrow = analyzableSibs.every((s) => hasGrow(s));
        const noneHaveSize = analyzableSibs.every((s) => !hasMainSize(s));
        const selfLacksSize = !hasMainSize(ctx);

        if (allGrow && noneHaveSize && selfLacksSize) {
          return `All ${ctx.parent.directChildren.length} siblings use flexGrow without explicit ${mainProp} — layout will depend on content measurement which is unreliable. Add ${mainProp} (or ${mainShorthand} shorthand) or use justifyContent on the parent`;
        }
      }

      // Case 2: Some siblings don't grow and lack explicit sizing
      for (const sib of siblings) {
        if (hasGrow(sib)) continue;
        if (!sib.style || !sib.style.analyzable || sib.style.hasSpread) {
          if (!sib._attrs) continue; // Can't analyze
        }
        if (!hasMainSize(sib)) {
          return `flexGrow used but sibling at line ${sib.line} lacks explicit ${mainProp} — in a ${parentDir} container, non-growing siblings need ${mainProp} (or ${mainShorthand} shorthand) for predictable layout`;
        }
      }

      return null;
    },
  },

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

  // Deep flex nesting without explicit dimensions
  {
    name: 'no-deep-flex-nesting',
    severity: 'warning',
    check(ctx) {
      if (!CONTAINER_TAGS.has(ctx.tagName)) return null;
      if (ctx.flexDepth < 6) return null;

      // Has explicit dimensions via style — OK
      if (ctx.style && ctx.style.analyzable) {
        if (ctx.style.props.has('width') && ctx.style.props.has('height')) return null;
        if (ctx.style.hasSpread) return null;
      }

      // Has explicit dimensions via shorthand (w+h or fill) — OK
      if (ctx._attrs) {
        if (ctx._attrs.has('fill')) return null;
        if (ctx._attrs.has('w') && ctx._attrs.has('h')) return null;
      }

      return `Flex container nested ${ctx.flexDepth} levels deep without explicit width and height — may produce unexpected layout`;
    },
  },

  // Large number of children without explicit container sizing
  // Skips the outermost returned element (it fills its parent naturally)
  {
    name: 'no-implicit-container-sizing',
    severity: 'warning',
    check(ctx) {
      if (!CONTAINER_TAGS.has(ctx.tagName)) return null;
      if (ctx.directChildren.length <= 10) return null;
      // Outermost element fills its parent naturally
      if (!ctx.parent) return null;

      // Has explicit dimensions via style — OK
      if (ctx.style && ctx.style.analyzable) {
        if (ctx.style.props.has('width') && ctx.style.props.has('height')) return null;
        if (ctx.style.hasSpread) return null;
      }

      // Has explicit dimensions via shorthand (w+h or fill) — OK
      if (ctx._attrs) {
        if (ctx._attrs.has('fill')) return null;
        if (ctx._attrs.has('w') && ctx._attrs.has('h')) return null;
      }

      return `Container with ${ctx.directChildren.length} direct children has no explicit width/height — add explicit dimensions for deterministic layout`;
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
  if (files.length === 0) {
    if (!options.silent) console.log('  No .tsx files found in src/.');
    return { errors: 0, warnings: 0, diagnostics: [] };
  }

  const diagnostics = [];
  const allMCPCalls = [];
  const apiUsage = { imports: [], hasSettingsRegistry: false };

  for (const filePath of files) {
    const source = readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.ES2020,
      /* setParentNodes */ true,
      ts.ScriptKind.TSX,
    );

    const contexts = buildContexts(sourceFile, filePath, ts);

    for (const ctx of contexts) {
      if (ctx.ignored) continue; // ilr-ignore-next-line
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
    console.log(`  ${parts.join(', ')} in ${files.length} file${files.length !== 1 ? 's' : ''}`);
    console.log('');
  } else if (!options.silent) {
    console.log(`\n  ${dim('OK')} ${files.length} file${files.length !== 1 ? 's' : ''} checked, no issues\n`);
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
