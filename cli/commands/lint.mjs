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
 *
 * Lua checks (runs on .lua files in lua/):
 *   lua-no-forward-ref           (error)   Call to local function before its declaration — causes nil crash at runtime
 *   lua-no-accidental-global     (error)   Assignment without `local` keyword — pollutes _G in LuaJIT
 *   lua-no-node-cache            (warning) Caching a node table reference across frames — nodes are recreated each commit
 *   lua-no-ffi-without-pcall     (error)   ffi.load() or ffi.C.* call outside pcall/xpcall wrapper
 *   lua-no-ffi-load-shared-lib   (warning) ffi.load("LibName") when Love2D already loaded it — use ffi.C.* instead
 *   lua-no-unguarded-division    (warning) Division where denominator could be zero or nil
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';

// ── Incremental lint cache ──────────────────────────────────
// Stores { [relPath]: { mtimeMs, diagnostics } } so unchanged
// files skip parsing entirely on subsequent runs.

const LINT_CACHE_FILE = '.rjit-lint-cache.json';

function loadLintCache(cwd) {
  const cachePath = join(cwd, LINT_CACHE_FILE);
  try {
    if (existsSync(cachePath)) {
      return JSON.parse(readFileSync(cachePath, 'utf-8'));
    }
  } catch { /* corrupted cache — start fresh */ }
  return {};
}

function saveLintCache(cwd, cache) {
  const cachePath = join(cwd, LINT_CACHE_FILE);
  try {
    writeFileSync(cachePath, JSON.stringify(cache), 'utf-8');
  } catch { /* non-fatal — next run will just re-scan everything */ }
}

function getFileMtime(filePath) {
  try {
    return statSync(filePath).mtimeMs;
  } catch { return 0; }
}

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

function findLuaFiles(dir) {
  const files = [];
  const skip = new Set(['node_modules', 'dist', '.git', 'build', 'out']);
  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.lua')) files.push(full);
    }
  }
  walk(dir);
  return files;
}

// ── Lua forward reference detection ─────────────────────────

/**
 * Strip Lua comments and string literals from source lines.
 * Returns an array of "clean" lines safe for pattern matching.
 * Handles line comments (--), block comments (--[[ ]]), single/double
 * quoted strings, and long strings ([[ ]], [=[ ]=], etc.).
 */
function stripLuaCommentsAndStrings(lines) {
  const clean = [];
  let inBlock = false;
  let blockClose = null;

  for (const raw of lines) {
    let line = raw;

    // Continue consuming a multi-line block comment or long string
    if (inBlock) {
      const ci = line.indexOf(blockClose);
      if (ci >= 0) {
        line = ' '.repeat(ci + blockClose.length) + line.slice(ci + blockClose.length);
        inBlock = false;
        blockClose = null;
      } else {
        clean.push('');
        continue;
      }
    }

    // Process remaining characters
    let result = '';
    let j = 0;
    while (j < line.length) {
      // Block comment: --[[ or --[===[
      if (line[j] === '-' && line[j + 1] === '-' && line[j + 2] === '[') {
        const eqm = line.slice(j + 2).match(/^\[(=*)\[/);
        if (eqm) {
          const close = ']' + eqm[1] + ']';
          const ci = line.indexOf(close, j + 4 + eqm[1].length);
          if (ci >= 0) {
            // Opens and closes on same line
            result += ' '.repeat(ci + close.length - j);
            j = ci + close.length;
            continue;
          }
          inBlock = true;
          blockClose = close;
          break;
        }
      }

      // Line comment: --
      if (line[j] === '-' && line[j + 1] === '-') {
        break;
      }

      // Long string: [[ or [===[
      if (line[j] === '[') {
        const eqm = line.slice(j).match(/^\[(=*)\[/);
        if (eqm) {
          const close = ']' + eqm[1] + ']';
          const ci = line.indexOf(close, j + 2 + eqm[1].length);
          if (ci >= 0) {
            result += ' '.repeat(ci + close.length - j);
            j = ci + close.length;
            continue;
          }
          inBlock = true;
          blockClose = close;
          break;
        }
      }

      // Quoted strings: "..." or '...'
      if (line[j] === '"' || line[j] === "'") {
        const q = line[j];
        j++;
        while (j < line.length && line[j] !== q) {
          if (line[j] === '\\') j++;
          j++;
        }
        if (j < line.length) j++; // closing quote
        result += ' ';
        continue;
      }

      result += line[j];
      j++;
    }

    clean.push(result);
  }

  return clean;
}

// Lua built-ins and keywords — never flag calls to these
const LUA_BUILTINS = new Set([
  // keywords (some look like calls with parens after)
  'if', 'else', 'elseif', 'for', 'while', 'repeat', 'return',
  'local', 'function', 'end', 'then', 'do', 'in', 'not', 'and', 'or',
  'nil', 'true', 'false', 'break', 'goto', 'until',
  // Lua standard library
  'print', 'type', 'tostring', 'tonumber', 'error', 'assert',
  'pcall', 'xpcall', 'require', 'pairs', 'ipairs', 'next',
  'select', 'unpack', 'rawget', 'rawset', 'rawequal', 'rawlen',
  'setmetatable', 'getmetatable', 'setfenv', 'getfenv',
  'collectgarbage', 'dofile', 'load', 'loadfile', 'loadstring',
  // LuaJIT
  'bit', 'ffi', 'jit',
  // Love2D
  'love',
]);

/**
 * Lint a Lua file for forward references to local functions.
 *
 * Catches calls to `local function NAME()` or `local NAME = function()`
 * where the call appears before the declaration and no forward
 * `local NAME` exists above the call site.
 *
 * Crash pattern:
 *   local function a()
 *     b()              -- b is compiled as a global lookup → nil → crash
 *   end
 *   local function b() ... end
 *
 * Fix:
 *   local b            -- forward-declare
 *   local function a()
 *     b()              -- captured as upvalue, assigned before a() runs
 *   end
 *   b = function() ... end
 */
function lintLuaForwardRefs(filePath, rawLines) {
  const diagnostics = [];
  const cleanLines = stripLuaCommentsAndStrings(rawLines);

  // Phase 1: Find all `local function NAME(` and `local NAME = function(` declarations
  const localFuncDecls = new Map(); // name → first line number (1-based)
  const LOCAL_FUNC_RE = /\blocal\s+function\s+(\w+)\s*\(/;
  const LOCAL_ASSIGN_FUNC_RE = /\blocal\s+(\w+)\s*=\s*function\s*\(/;

  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];
    let m = LOCAL_FUNC_RE.exec(line);
    if (m && !localFuncDecls.has(m[1])) {
      localFuncDecls.set(m[1], i + 1);
      continue;
    }
    m = LOCAL_ASSIGN_FUNC_RE.exec(line);
    if (m && !localFuncDecls.has(m[1])) {
      localFuncDecls.set(m[1], i + 1);
    }
  }

  if (localFuncDecls.size === 0) return diagnostics; // nothing to check

  // Phase 2: Find forward declarations — `local NAME` without `= function(`
  const forwardDecls = new Map(); // name → earliest line (1-based)
  const LOCAL_DECL_RE = /\blocal\s+([\w][\w\s,]*)/;

  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];
    const m = LOCAL_DECL_RE.exec(line);
    if (!m) continue;

    const rest = m[1];
    // Skip `local function` declarations — those are caught in phase 1
    if (/^function\b/.test(rest)) continue;

    // Handle `local a, b, c` and `local a = expr`
    for (const part of rest.split(',')) {
      const nameMatch = part.trim().match(/^(\w+)/);
      if (!nameMatch) continue;
      const name = nameMatch[1];

      // Skip `local name = function(` — that's a func decl, not a forward decl
      if (/=\s*function\s*\(/.test(part)) continue;

      const lineNum = i + 1;
      if (!forwardDecls.has(name) || lineNum < forwardDecls.get(name)) {
        forwardDecls.set(name, lineNum);
      }
    }
  }

  // Phase 3: Find bare function calls and cross-reference
  // Match NAME( but not .NAME( or :NAME( or string matches
  const CALL_RE = /(?<![.:\w])(\w+)\s*\(/g;
  const seen = new Set(); // deduplicate per name per line

  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];
    CALL_RE.lastIndex = 0;
    seen.clear();
    let m;

    while ((m = CALL_RE.exec(line)) !== null) {
      const name = m[1];
      if (LUA_BUILTINS.has(name)) continue;
      if (!localFuncDecls.has(name)) continue;
      if (seen.has(name)) continue;

      const callLine = i + 1;
      const declLine = localFuncDecls.get(name);

      // Only flag if declaration is AFTER this call
      if (declLine <= callLine) continue;

      // Check for a forward declaration before the call
      const fwdLine = forwardDecls.get(name);
      if (fwdLine !== undefined && fwdLine < callLine) continue;

      // Check for -- rjit-ignore-next-line on the previous line
      if (i > 0 && /rjit-ignore-next-line/.test(rawLines[i - 1])) continue;

      seen.add(name);
      diagnostics.push({
        rule: 'lua-no-forward-ref',
        severity: 'error',
        message: `Forward reference to local function '${name}' (defined at line ${declLine}). Add \`local ${name}\` before this point to forward-declare it.`,
        file: filePath,
        line: callLine,
        col: m.index + 1,
      });
    }
  }

  return diagnostics;
}

// ── Lua accidental global detection ──────────────────────────

// Lua keywords and built-in globals that are valid assignment targets
const LUA_GLOBALS_WHITELIST = new Set([
  // Standard globals
  '_G', '_VERSION', '_ENV',
  // Love2D callbacks
  'love',
  // Standard Lua globals (intentionally overridable, e.g. print capture)
  'print', 'error', 'assert', 'require', 'type', 'tostring', 'tonumber',
  'pairs', 'ipairs', 'next', 'select', 'rawget', 'rawset', 'rawequal',
  'pcall', 'xpcall', 'setmetatable', 'getmetatable', 'setfenv', 'getfenv',
  'collectgarbage', 'dofile', 'loadfile', 'loadstring', 'unpack',
  // Common patterns in module files
  'M', 'module',
]);

// Patterns that look like globals but aren't
const LUA_KEYWORDS_SET = new Set([
  'if', 'else', 'elseif', 'for', 'while', 'repeat', 'return',
  'local', 'function', 'end', 'then', 'do', 'in', 'not', 'and', 'or',
  'nil', 'true', 'false', 'break', 'goto', 'until',
]);

/**
 * Detect assignments without `local` keyword that pollute _G.
 *
 * Catches: `foo = 42`, `bar = function()`, `baz = {}`
 * Skips: `local foo = 42`, `self.foo = 42`, `M.foo = 42`, `t[k] = v`,
 *        `foo.bar = 42`, `foo:bar()`, table field assignments inside constructors,
 *        loop variables (for k, v in ...), function params.
 */
function lintLuaAccidentalGlobals(filePath, rawLines) {
  const diagnostics = [];
  const cleanLines = stripLuaCommentsAndStrings(rawLines);

  // Track names declared with `local` (including function params and for-loop vars)
  const declaredLocals = new Set();

  // Track module-return pattern: `local M = {}` ... `return M`
  const moduleVars = new Set();

  // First pass: collect all local declarations and module tables
  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];

    // `local NAME` or `local NAME = ...` or `local NAME, NAME2 = ...`
    const localMatch = line.match(/\blocal\s+([\w][\w\s,]*)/);
    if (localMatch) {
      const rest = localMatch[1];
      if (/^function\b/.test(rest)) {
        // `local function NAME`
        const fname = rest.match(/^function\s+(\w+)/);
        if (fname) declaredLocals.add(fname[1]);
      } else {
        for (const part of rest.split(',')) {
          const nm = part.trim().match(/^(\w+)/);
          if (nm) {
            declaredLocals.add(nm[1]);
            // Detect module table pattern: `local M = {}`
            if (/=\s*\{\s*\}/.test(part)) moduleVars.add(nm[1]);
          }
        }
      }
    }

    // `for NAME =` or `for NAME, NAME in`
    const forMatch = line.match(/\bfor\s+([\w,\s]+)\s+(?:=|in)\b/);
    if (forMatch) {
      for (const part of forMatch[1].split(',')) {
        const nm = part.trim().match(/^(\w+)/);
        if (nm) declaredLocals.add(nm[1]);
      }
    }

    // `function M.foo()` or `function M:foo()` params
    const funcParamMatch = line.match(/\bfunction\s*[\w.:]*\s*\(([^)]*)\)/);
    if (funcParamMatch && funcParamMatch[1].trim()) {
      for (const part of funcParamMatch[1].split(',')) {
        const nm = part.trim().match(/^(\w+)/);
        if (nm) declaredLocals.add(nm[1]);
      }
    }
  }

  // Second pass: compute brace depth at each line (forward scan)
  // braceDepth > 0 means we're inside a table constructor
  const braceDepthAtLine = new Array(cleanLines.length);
  let runningBraceDepth = 0;
  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];
    for (let ci = 0; ci < line.length; ci++) {
      if (line[ci] === '{') runningBraceDepth++;
      if (line[ci] === '}') runningBraceDepth--;
    }
    braceDepthAtLine[i] = runningBraceDepth;
  }

  // Third pass: find bare assignments
  // Match `IDENT = ` at start of line or after semicolons, but not `IDENT.x =`, `IDENT[x] =`, `IDENT:x(`
  const BARE_ASSIGN_RE = /^(\s*)(\w+)\s*=[^=]/;

  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];
    const m = BARE_ASSIGN_RE.exec(line);
    if (!m) continue;

    const name = m[2];

    // Skip keywords, whitelisted globals, declared locals
    if (LUA_KEYWORDS_SET.has(name)) continue;
    if (LUA_GLOBALS_WHITELIST.has(name)) continue;
    if (declaredLocals.has(name)) continue;
    if (moduleVars.has(name)) continue;

    // Skip if this line has `local` before the name (handles multiline local declarations)
    if (/\blocal\b/.test(line.slice(0, m.index + m[1].length))) continue;

    // Skip if the name is a field of something (check the raw line for preceding `.` or `:`)
    const rawLine = rawLines[i];
    const nameIdx = rawLine.indexOf(name);
    if (nameIdx > 0) {
      const prevChar = rawLine[nameIdx - 1];
      if (prevChar === '.' || prevChar === ':') continue;
    }

    // Skip if we're inside a table constructor (brace depth > 0).
    // Check the brace depth BEFORE this line starts (use previous line's depth),
    // or check if the current line itself is inside braces.
    // We check the depth at the previous line end — if > 0, we're inside { }.
    const depthBefore = i > 0 ? braceDepthAtLine[i - 1] : 0;
    // Also count opening braces on this line before the assignment
    let lineDepthBefore = depthBefore;
    for (let ci = 0; ci < m.index + m[1].length; ci++) {
      if (line[ci] === '{') lineDepthBefore++;
      if (line[ci] === '}') lineDepthBefore--;
    }
    if (lineDepthBefore > 0) continue; // inside a table constructor

    // rjit-ignore-next-line
    if (i > 0 && /rjit-ignore-next-line/.test(rawLines[i - 1])) continue;

    diagnostics.push({
      rule: 'lua-no-accidental-global',
      severity: 'error',
      message: `Assignment to undeclared variable '${name}' — missing \`local\` keyword? This pollutes _G.`,
      file: filePath,
      line: i + 1,
      col: m[1].length + 1,
    });
  }

  return diagnostics;
}

// ── Lua node cache detection ─────────────────────────────────

/**
 * Detect patterns that cache node table references across frames.
 *
 * Node tables are value types recreated each reconciler commit. Holding a
 * reference to a node from a previous frame causes stale data reads and
 * crashes when the node is garbage collected.
 *
 * Catches:
 *   self.hoveredNode = node
 *   self.selectedNode = someNode
 *   cache[node] = ...
 *   nodeCache[node] = ...
 *   someTable[node] = ...  (when `node` is a known node variable)
 *
 * The heuristic: flag `self.<name>Node = <expr>` and `<table>[node] = <expr>`
 * patterns. These are the two recurring crash patterns from the inspector saga.
 */
function lintLuaNodeCache(filePath, rawLines) {
  const diagnostics = [];
  const cleanLines = stripLuaCommentsAndStrings(rawLines);

  // Pattern 1: self.whateverNode = expr (not nil)
  // Only match self.xyzNode, not self.xyzNodeId or self.xyzNodeKey etc.
  const SELF_NODE_RE = /\bself\.(\w*[Nn]ode)\s*=\s*(?!nil\b)(\S)/;

  // Pattern 2: table[node] = expr (caching with node TABLE as key)
  // Only match bare `node` or `selectedNode` etc., NOT `nodeId`, `nodeKey`, `nodeIndex`, `nodeCount`
  const NODE_ID_SUFFIXES = /(?:Id|Key|Index|Count|Name|Type|Path|Idx|Num|Hash|Str)$/;
  const TABLE_NODE_KEY_RE = /\b(\w+)\[(\w*[Nn]ode\w*)\]\s*=\s*(?!nil\b)/;

  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];

    // rjit-ignore-next-line
    if (i > 0 && /rjit-ignore-next-line/.test(rawLines[i - 1])) continue;

    let m = SELF_NODE_RE.exec(line);
    if (m && !NODE_ID_SUFFIXES.test(m[1])) {
      diagnostics.push({
        rule: 'lua-no-node-cache',
        severity: 'warning',
        message: `Caching node reference in 'self.${m[1]}' — node tables are recreated each commit and go stale. Query the tree each frame instead.`,
        file: filePath,
        line: i + 1,
        col: m.index + 1,
      });
      continue;
    }

    m = TABLE_NODE_KEY_RE.exec(line);
    if (m && !NODE_ID_SUFFIXES.test(m[2])) {
      diagnostics.push({
        rule: 'lua-no-node-cache',
        severity: 'warning',
        message: `Caching with node as table key '${m[1]}[${m[2]}]' — node tables are recreated each commit. Use node.id as key instead.`,
        file: filePath,
        line: i + 1,
        col: m.index + 1,
      });
    }
  }

  return diagnostics;
}

// ── Lua FFI without pcall detection ──────────────────────────

// Files that ARE the safe FFI wrapper — they're supposed to have bare ffi.load
const FFI_WRAPPER_FILES = new Set(['lib_loader.lua']);

// Standard POSIX/libc symbols — always available via ffi.C, no pcall needed
const LIBC_SYMBOLS = new Set([
  // File I/O
  'open', 'close', 'read', 'write', 'creat', 'lseek', 'fstat', 'stat',
  'fopen', 'fclose', 'fread', 'fwrite', 'fseek', 'ftell', 'fflush',
  'rename', 'remove', 'unlink', 'mkdir', 'rmdir', 'access', 'chmod',
  'dup', 'dup2', 'pipe', 'fcntl', 'ftruncate', 'truncate', 'fsync',
  // Process
  'fork', 'exec', 'execvp', 'execve', 'wait', 'waitpid', 'exit', '_exit',
  'getpid', 'getppid', 'getuid', 'getgid', 'setsid', 'setpgid',
  'kill', 'signal', 'sigaction', 'raise',
  // Memory
  'malloc', 'calloc', 'realloc', 'free', 'memcpy', 'memset', 'memmove', 'memcmp',
  'mmap', 'munmap', 'mprotect', 'msync', 'mlock', 'munlock',
  // String
  'strlen', 'strcpy', 'strncpy', 'strcmp', 'strncmp', 'strcat', 'strncat',
  'strstr', 'strchr', 'strrchr', 'strerror', 'strtol', 'strtoul', 'strtod',
  // I/O control
  'ioctl', 'poll', 'select', 'epoll_create', 'epoll_ctl', 'epoll_wait',
  // Network
  'socket', 'bind', 'listen', 'accept', 'connect', 'send', 'recv',
  'sendto', 'recvfrom', 'setsockopt', 'getsockopt', 'getaddrinfo', 'freeaddrinfo',
  'inet_pton', 'inet_ntop', 'htons', 'ntohs', 'htonl', 'ntohl',
  // SHM/IPC
  'shmget', 'shmat', 'shmdt', 'shmctl', 'shm_open', 'shm_unlink',
  'sem_open', 'sem_close', 'sem_post', 'sem_wait', 'sem_unlink',
  // Time
  'time', 'clock', 'gettimeofday', 'clock_gettime', 'sleep', 'usleep', 'nanosleep',
  // Misc
  'printf', 'sprintf', 'snprintf', 'fprintf', 'sscanf',
  'getenv', 'setenv', 'unsetenv', 'system', 'popen', 'pclose',
  'dlopen', 'dlsym', 'dlclose', 'dlerror',
  'errno',
  // Terminal / PTY control
  'tcgetattr', 'tcsetattr', 'tcflush', 'cfsetispeed', 'cfsetospeed', 'cfmakeraw',
  'posix_openpt', 'grantpt', 'unlockpt', 'ptsname_r',
  // Filesystem / process (additional)
  'chdir', 'getcwd', 'readlink',
  // glibc internals (always present on Linux)
  '__errno_location',
]);

// Symbols provided by the Love2D runtime — SDL2 and OpenGL are linked by the
// host process, so ffi.C.* access is safe without pcall.  These would only be
// missing if Love2D itself failed to start, at which point nothing works anyway.
const LOVE2D_RUNTIME_SYMBOLS = new Set([
  // SDL2
  'SDL_GL_GetProcAddress', 'SDL_SetWindowAlwaysOnTop', 'SDL_SYSWM_X11',
  // OpenGL core (used by vterm, videos, overlay_shm)
  'glActiveTexture', 'glBindBuffer', 'glBindFramebuffer', 'glBindTexture',
  'glBindVertexArray', 'glBlendFunc', 'glBlitFramebuffer',
  'glCheckFramebufferStatus', 'glDeleteFramebuffers', 'glDeleteTextures',
  'glDisable', 'glEnable', 'glFramebufferTexture2D', 'glGenFramebuffers',
  'glGenTextures', 'glGetIntegerv', 'glPixelStorei', 'glReadPixels',
  'glScissor', 'glTexImage2D', 'glTexParameteri', 'glUseProgram',
  'glViewport',
]);

/**
 * Detect ffi.load() and ffi.C.* calls not wrapped in pcall/xpcall.
 *
 * Every FFI integration (SDL2, mpv, gbm, EGL, X11) had a crash phase from
 * missing libraries. The pcall wrapper pattern from dragdrop.lua should be
 * the standard.
 *
 * Catches:
 *   local lib = ffi.load("SDL2")
 *   ffi.C.shmget(...)
 *
 * Allows:
 *   local ok, lib = pcall(ffi.load, "SDL2")
 *   pcall(function() ffi.C.shmget(...) end)
 *   xpcall(function() ... ffi.load("x") ... end, handler)
 */
function lintLuaFfiWithoutPcall(filePath, rawLines) {
  const diagnostics = [];
  const cleanLines = stripLuaCommentsAndStrings(rawLines);

  // Skip lib_loader.lua — it IS the pcall wrapper
  const basename = filePath.split('/').pop();
  if (FFI_WRAPPER_FILES.has(basename)) return diagnostics;

  // Pattern: ffi.load( on a line
  const FFI_LOAD_RE = /\bffi\.load\s*\(/;
  // Pattern: ffi.C.identifier( on a line
  const FFI_C_RE = /\bffi\.C\.(\w+)/;

  // Pcall wrappers on the same line
  const PCALL_SAME_LINE = /\bx?pcall\s*\(\s*ffi\.load/;
  const PCALL_FUNC_WRAP = /\bx?pcall\s*\(\s*function/;

  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];

    // rjit-ignore-next-line
    if (i > 0 && /rjit-ignore-next-line/.test(rawLines[i - 1])) continue;

    // Check ffi.load
    if (FFI_LOAD_RE.test(line)) {
      // OK if pcall(ffi.load, ...) on same line
      if (PCALL_SAME_LINE.test(line)) continue;
      // OK if inside pcall(function() ... end) — check if we're inside a pcall block
      if (isInsidePcallBlock(cleanLines, i)) continue;

      const col = line.indexOf('ffi.load');
      diagnostics.push({
        rule: 'lua-no-ffi-without-pcall',
        severity: 'error',
        message: `ffi.load() without pcall wrapper — will crash if library is missing. Use \`local ok, lib = pcall(ffi.load, name)\`.`,
        file: filePath,
        line: i + 1,
        col: col + 1,
      });
    }

    // Check ffi.C.* — only flag non-standard-libc symbols
    // Standard libc symbols (open, close, read, write, ioctl, etc.) are always
    // available in the C namespace. Only flag symbols from optional libraries
    // (SDL, mpv, X11, EGL, etc.).
    const ffiCMatch = FFI_C_RE.exec(line);
    if (ffiCMatch) {
      const sym = ffiCMatch[1];
      // Skip standard POSIX/libc symbols — these are always available
      if (LIBC_SYMBOLS.has(sym)) continue;
      // Skip Love2D runtime symbols (SDL2/OpenGL) — guaranteed by host process
      if (LOVE2D_RUNTIME_SYMBOLS.has(sym)) continue;
      // OK if inside pcall(function() ... end) block
      if (PCALL_FUNC_WRAP.test(line)) continue;
      if (isInsidePcallBlock(cleanLines, i)) continue;

      diagnostics.push({
        rule: 'lua-no-ffi-without-pcall',
        severity: 'error',
        message: `ffi.C.${sym} without pcall wrapper — will crash if symbol is unavailable. Wrap in pcall/xpcall.`,
        file: filePath,
        line: i + 1,
        col: ffiCMatch.index + 1,
      });
    }
  }

  return diagnostics;
}

/**
 * Heuristic: check if line `idx` is inside a pcall(function() ... end) block.
 * Scans upward for a pcall/xpcall opening and checks brace/end balancing.
 */
function isInsidePcallBlock(cleanLines, idx) {
  // Look back up to 30 lines for a pcall(function
  let funcDepth = 0;
  for (let j = idx; j >= Math.max(0, idx - 30); j--) {
    const line = cleanLines[j];
    // Count `end` tokens going backward (they close inner blocks)
    const ends = (line.match(/\bend\b/g) || []).length;
    // Count function/do/if/for/while openers
    const openers = (line.match(/\b(?:function|do|if|for|while|repeat)\b/g) || []).length;
    funcDepth += ends - openers;

    if (funcDepth < 0) {
      // We've found an unmatched opener — check if it's a pcall(function
      if (/\bx?pcall\s*\(\s*function\b/.test(line)) return true;
      break;
    }
  }
  return false;
}

// ── Lua ffi.load shared lib detection ────────────────────────

// Libraries that Love2D already has loaded — using ffi.load opens a SECOND instance
const LOVE2D_LOADED_LIBS = new Set([
  'SDL2', 'SDL2-2.0', 'libSDL2', 'libSDL2-2.0',
  'openal', 'OpenAL', 'openal32',
  'GL', 'opengl32', 'GLESv2',
  'lua51', 'luajit-5.1',
]);

/**
 * Detect ffi.load("LibName") for libraries Love2D already loaded.
 * Using ffi.load opens a second instance instead of using the one Love2D
 * already initialized. Use ffi.C.* to access symbols from the host process.
 */
function lintLuaFfiLoadSharedLib(filePath, rawLines) {
  const diagnostics = [];
  const cleanLines = stripLuaCommentsAndStrings(rawLines);

  // Skip lib_loader.lua
  const basename = filePath.split('/').pop();
  if (FFI_WRAPPER_FILES.has(basename)) return diagnostics;

  const FFI_LOAD_STR_RE = /\bffi\.load\s*\(\s*["'](\w[\w.-]*)["']\s*\)/g;

  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];
    FFI_LOAD_STR_RE.lastIndex = 0;

    // rjit-ignore-next-line
    if (i > 0 && /rjit-ignore-next-line/.test(rawLines[i - 1])) continue;

    let m;
    while ((m = FFI_LOAD_STR_RE.exec(line)) !== null) {
      const libName = m[1];
      if (LOVE2D_LOADED_LIBS.has(libName)) {
        diagnostics.push({
          rule: 'lua-no-ffi-load-shared-lib',
          severity: 'warning',
          message: `ffi.load("${libName}") opens a second instance — Love2D already loaded this. Use ffi.C.* to access its symbols.`,
          file: filePath,
          line: i + 1,
          col: m.index + 1,
        });
      }
    }
  }

  return diagnostics;
}

// ── Lua unguarded division detection ─────────────────────────

/**
 * Detect divisions where the denominator could be zero or nil.
 *
 * Catches:
 *   x / y          where y is a variable (not a literal number)
 *   x / (a + b)    where the result could be zero
 *
 * Allows:
 *   x / 2, x / 255, x / math.pi   (literal constants)
 *   x / #t                         (length — only 0 for empty, usually intentional)
 *   math.max(1, y)                 (already guarded)
 *
 * The heuristic is conservative: only flag `/ variable` where variable is a
 * bare identifier, not a function call result or literal.
 */
function lintLuaUnguardedDivision(filePath, rawLines) {
  const diagnostics = [];
  const cleanLines = stripLuaCommentsAndStrings(rawLines);

  // Match / followed by a bare identifier (not a number, not a function call, not a method)
  // Negative lookbehind for `=` to skip `/=` patterns (not valid Lua but defensive)
  const DIV_RE = /\/\s*(\w+)\b/g;

  // Identifiers that are safe denominators (known non-zero)
  const SAFE_DENOMINATORS = new Set([
    'math', 'pi', 'huge', 'maxinteger',
  ]);

  // Check if denominator is guarded by math.max on the same line
  const MATH_MAX_GUARD = /math\.max\s*\(\s*[1-9]/;

  // First pass: collect all local assignments of constants and guard patterns
  // `local FOO = 44100` → FOO is a known non-zero constant
  // `if x == 0 then return end` on the line before → x is guarded
  const knownNonZero = new Set();
  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];
    // Local assignment to a positive literal number
    const constAssign = line.match(/\blocal\s+(\w+)\s*=\s*(\d+(?:\.\d+)?)\b/);
    if (constAssign && parseFloat(constAssign[2]) > 0) {
      knownNonZero.add(constAssign[1]);
    }
  }

  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];
    DIV_RE.lastIndex = 0;

    // rjit-ignore-next-line
    if (i > 0 && /rjit-ignore-next-line/.test(rawLines[i - 1])) continue;

    // Skip lines with math.max guard
    if (MATH_MAX_GUARD.test(line)) continue;

    let m;
    while ((m = DIV_RE.exec(line)) !== null) {
      const denom = m[1];

      // Skip numeric literals
      if (/^\d+$/.test(denom)) continue;

      // Skip known safe identifiers
      if (SAFE_DENOMINATORS.has(denom)) continue;

      // Skip UPPER_CASE identifiers (conventionally constants)
      if (/^[A-Z][A-Z_0-9]+$/.test(denom)) continue;

      // Skip variables assigned as positive constants
      if (knownNonZero.has(denom)) continue;

      // Skip if the denominator is immediately followed by `.` or `(` or `:` (method/function call or table access)
      const afterPos = m.index + m[0].length;
      if (afterPos < line.length && (line[afterPos] === '.' || line[afterPos] === '(' || line[afterPos] === ':')) continue;

      // Check for `or 1` / `or 0.001` guard on same line
      const rest = line.slice(m.index);
      if (/\bor\s+[1-9]/.test(rest) || /\bor\s+0\.\d*[1-9]/.test(rest)) continue;

      // Check if denominator is guarded on a nearby preceding line:
      // `if denom == 0` or `if denom <= 0` or `if not denom` → return/break/continue
      let guarded = false;
      for (let j = Math.max(0, i - 5); j < i; j++) {
        const prevLine = cleanLines[j];
        if (prevLine.includes(denom) && (
          new RegExp(`\\b${denom}\\s*[=~><]+\\s*0`).test(prevLine) ||
          new RegExp(`\\b${denom}\\s*==\\s*nil`).test(prevLine) ||
          new RegExp(`not\\s+${denom}\\b`).test(prevLine) ||
          new RegExp(`${denom}\\s*>\\s*0`).test(prevLine)
        )) {
          guarded = true;
          break;
        }
      }
      if (guarded) continue;

      diagnostics.push({
        rule: 'lua-no-unguarded-division',
        severity: 'warning',
        message: `Division by '${denom}' — could be zero or nil. Guard with \`math.max(1, ${denom})\` or check before dividing.`,
        file: filePath,
        line: i + 1,
        col: m.index + 1,
      });
    }
  }

  return diagnostics;
}

/**
 * Run Lua lint on all .lua files under a directory (with incremental cache).
 */
function runLuaLint(luaDir, cwd, cache, newCache) {
  if (!existsSync(luaDir)) return { diagnostics: [], fileCount: 0, cached: 0 };
  const files = findLuaFiles(luaDir);
  const diagnostics = [];
  let cachedCount = 0;
  for (const filePath of files) {
    const relPath = cwd ? relative(cwd, filePath) : filePath;
    const mtimeMs = getFileMtime(filePath);

    if (cache && cache[relPath] && cache[relPath].mtimeMs === mtimeMs) {
      if (cache[relPath].diagnostics) diagnostics.push(...cache[relPath].diagnostics);
      if (newCache) newCache[relPath] = cache[relPath];
      cachedCount++;
      continue;
    }

    const source = readFileSync(filePath, 'utf-8');
    const lines = source.split('\n');
    const fileDiags = [
      ...lintLuaForwardRefs(filePath, lines),
      ...lintLuaAccidentalGlobals(filePath, lines),
      ...lintLuaNodeCache(filePath, lines),
      ...lintLuaFfiWithoutPcall(filePath, lines),
      ...lintLuaFfiLoadSharedLib(filePath, lines),
      ...lintLuaUnguardedDivision(filePath, lines),
    ];
    diagnostics.push(...fileDiags);
    if (newCache) newCache[relPath] = { mtimeMs, diagnostics: fileDiags };
  }
  return { diagnostics, fileCount: files.length, cached: cachedCount };
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
    textAlign: null,
    alignItems: null,
    alignSelf: null,
    position: null,
    width: null,
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
    // Extract alignment values for storybook centering rule
    if (name === 'textAlign' && ts.isStringLiteral(prop.initializer)) {
      info.textAlign = prop.initializer.text;
    }
    if (name === 'alignItems' && ts.isStringLiteral(prop.initializer)) {
      info.alignItems = prop.initializer.text;
    }
    if (name === 'alignSelf' && ts.isStringLiteral(prop.initializer)) {
      info.alignSelf = prop.initializer.text;
    }
    if (name === 'position' && ts.isStringLiteral(prop.initializer)) {
      info.position = prop.initializer.text;
    }
    if (name === 'width' && ts.isStringLiteral(prop.initializer)) {
      info.width = prop.initializer.text;
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
        'color', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'textAlign',
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
        // Vector shapes (Love2D-only)
        'arcShape', 'polygonPoints', 'strokePaths', 'strokeWidth', 'strokeColor',
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
 * Run TSL lint on all .tsl files under srcDir (with incremental cache).
 * Returns flat diagnostics array.
 */
function runTslLint(srcDir, ts, cwd, cache, newCache) {
  const files = findTslFiles(srcDir);
  const diagnostics = [];
  let cachedCount = 0;
  for (const filePath of files) {
    const relPath = cwd ? relative(cwd, filePath) : filePath;
    const mtimeMs = getFileMtime(filePath);

    if (cache && cache[relPath] && cache[relPath].mtimeMs === mtimeMs) {
      if (cache[relPath].diagnostics) diagnostics.push(...cache[relPath].diagnostics);
      if (newCache) newCache[relPath] = cache[relPath];
      cachedCount++;
      continue;
    }

    const source = readFileSync(filePath, 'utf-8');
    const fileDiags = lintTslFile(filePath, source, ts);
    diagnostics.push(...fileDiags);
    if (newCache) newCache[relPath] = { mtimeMs, diagnostics: fileDiags };
  }
  return { diagnostics, fileCount: files.length, cached: cachedCount };
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
  const hasSrc = existsSync(srcDir);
  const files = hasSrc ? findTsxFiles(srcDir) : [];
  const diagnostics = [];
  const allMCPCalls = [];
  const apiUsage = { imports: [], hasSettingsRegistry: false };

  // Load incremental cache — skip files whose mtime hasn't changed
  const cache = options.noCache ? {} : loadLintCache(cwd);
  const newCache = {};
  let cachedCount = 0;

  for (const filePath of files) {
    const relPath = relative(cwd, filePath);
    const mtimeMs = getFileMtime(filePath);

    // Cache hit: file unchanged since last lint — reuse diagnostics
    if (cache[relPath] && cache[relPath].mtimeMs === mtimeMs) {
      const cached = cache[relPath];
      if (cached.diagnostics) diagnostics.push(...cached.diagnostics);
      if (cached.mcpCalls) allMCPCalls.push(...cached.mcpCalls);
      if (cached.apiUsage) {
        apiUsage.imports.push(...(cached.apiUsage.imports || []));
        if (cached.apiUsage.hasSettingsRegistry) apiUsage.hasSettingsRegistry = true;
      }
      newCache[relPath] = cached;
      cachedCount++;
      continue;
    }

    // Cache miss: parse and lint this file
    const source = readFileSync(filePath, 'utf-8');
    const fileDiagnostics = [];
    const fileMCPCalls = [];
    const fileApiUsage = { imports: [], hasSettingsRegistry: false };

    // Crypto miner detection — scans raw source for mining signatures.
    // Non-suppressable: rjit-ignore-next-line does NOT work for this rule.
    // Uses confidence scoring: hard triggers on single hit, composite needs 2+ categories.
    const minerResult = scanForMinerPatterns(source);
    if (minerResult.detected) {
      const patternList = minerResult.matches.map(m =>
        `${m.category}: "${m.pattern}" [${m.trigger}]`
      ).join(', ');
      fileDiagnostics.push({
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
          fileDiagnostics.push({
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
          fileDiagnostics.push({
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
    fileMCPCalls.push(...mcpCalls);

    // API usage detection — find imports from @reactjit/apis or @reactjit/ai
    detectAPIUsage(sourceFile, filePath, ts, fileApiUsage);

    // Merge into totals
    diagnostics.push(...fileDiagnostics);
    allMCPCalls.push(...fileMCPCalls);
    apiUsage.imports.push(...fileApiUsage.imports);
    if (fileApiUsage.hasSettingsRegistry) apiUsage.hasSettingsRegistry = true;

    // Store in new cache
    newCache[relPath] = {
      mtimeMs,
      diagnostics: fileDiagnostics,
      mcpCalls: fileMCPCalls,
      apiUsage: fileApiUsage,
    };
  }

  // TSL lint pass — scan .tsl files in src/ (with cache)
  const { diagnostics: tslDiagnostics, fileCount: tslFileCount, cached: tslCached } =
    hasSrc ? runTslLint(srcDir, ts, cwd, cache, newCache) : { diagnostics: [], fileCount: 0, cached: 0 };
  diagnostics.push(...tslDiagnostics);

  // Lua lint pass — scan .lua files in lua/ (with cache)
  const luaDir = join(cwd, 'lua');
  const { diagnostics: luaDiagnostics, fileCount: luaFileCount, cached: luaCached } =
    runLuaLint(luaDir, cwd, cache, newCache);
  diagnostics.push(...luaDiagnostics);

  // Save updated cache
  saveLintCache(cwd, newCache);

  const totalCached = cachedCount + (tslCached || 0) + (luaCached || 0);
  const totalFiles = files.length + tslFileCount + luaFileCount;

  if (files.length === 0 && tslFileCount === 0 && luaFileCount === 0) {
    if (!options.silent) console.log('  No .tsx, .tsl, or .lua files found.');
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
    const cacheNote = totalCached > 0 ? dim(` (${totalFiles - totalCached} scanned, ${totalCached} cached)`) : '';
    console.log(`  ${parts.join(', ')} in ${totalFiles} file${totalFiles !== 1 ? 's' : ''}${cacheNote}`);
    console.log('');
  } else if (!options.silent) {
    const cacheNote = totalCached > 0 ? dim(` (${totalFiles - totalCached} scanned, ${totalCached} cached)`) : '';
    console.log(`\n  ${dim('OK')} ${totalFiles} file${totalFiles !== 1 ? 's' : ''} checked, no issues${cacheNote}\n`);
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
