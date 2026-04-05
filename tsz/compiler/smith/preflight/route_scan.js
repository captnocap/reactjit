// ── Route Scanner ───────────────────────────────────────────────
//
// Runs AFTER collect but BEFORE parse. Scans source text and the
// partially-populated ctx (state slots, components, script blocks,
// classifiers from collect phase) to build an immutable route plan.
//
// The route plan predicts:
//   - Which feature flags are active (maps, OAs, handlers, etc.)
//   - Which emit atoms will fire
//   - Map backend targets (zig_oa vs lua_runtime)
//   - Expression resolution mode (resolved vs needs_qjs)
//   - Ambiguous constructs that will cause a hard stop
//
// Parse and emit read the plan. Flight check verifies output matches it.

function routeScan(ctx, source) {
  var plan = {
    lane: ctx._sourceTier || 'mixed',
    features: {},
    predictedAtoms: [],
    mapRoutes: [],
    ambiguous: [],
    expressionStats: { resolved: 0, needs_qjs: 0 },
    summary: '',
  };

  // ── Feature detection from ctx (populated by collect phase) ──

  var f = plan.features;

  // State
  f.has_state = ctx.stateSlots && ctx.stateSlots.length > 0;

  // Node arrays — always true for any source with JSX
  f.has_node_arrays = true;
  f.has_root_expr = true;

  // Dynamic text — scan source for template literals and brace expressions in JSX
  f.has_dyn_texts = scanForDynTexts(source);

  // Handlers — scan for onPress, onClick, onChange, onSubmit patterns
  f.has_handlers = scanForHandlers(source);

  // Effects
  f.has_effects = scanForEffects(source);

  // Object arrays — from collect or source scan
  f.has_object_arrays = ctx.objectArrays && ctx.objectArrays.length > 0;
  if (f.has_object_arrays) {
    f.has_const_oa = ctx.objectArrays.some(function(oa) { return oa.isConst; });
    f.has_dynamic_oa = ctx.objectArrays.some(function(oa) { return !oa.isConst && !oa.isNested; });
    f.has_nested_oa = ctx.objectArrays.some(function(oa) {
      if (!oa.fields) return false;
      return oa.fields.some(function(field) { return field.type === 'nested_array'; });
    });
  }

  // Variants — scan for type variant syntax
  f.has_variants = scanForVariants(source);

  // Maps — scan source for .map( patterns and <For> blocks
  var mapScan = scanForMaps(source, ctx);
  f.has_maps = mapScan.total > 0;
  f.has_flat_maps = mapScan.flat > 0;
  f.has_nested_maps = mapScan.nested > 0;
  f.has_inline_maps = mapScan.inline > 0;
  f.has_map_arrays = f.has_maps;  // conservative: any map might have arrays
  f.has_map_dyn_texts = f.has_maps && f.has_dyn_texts;
  f.has_map_handlers = f.has_maps && f.has_handlers;
  plan.mapRoutes = mapScan.routes;

  // Lua maps — detected from collect phase or source scan
  f.has_lua_maps = (ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0) ||
                   scanForLuaMaps(source);

  // Conditionals — scan for ternary in JSX or <if>/<else> blocks
  f.has_conditionals = scanForConditionals(source);

  // Runtime tick — state OR object arrays OR lua maps
  f.has_runtime_tick = f.has_state || f.has_object_arrays || f.has_lua_maps;

  // Split output
  f.has_split_output = globalThis.__splitOutput == 1;

  // ── Predict atom set ──
  plan.predictedAtoms = predictAtomSet(f);

  // ── Expression resolution stats ──
  var exprStats = scanExpressionResolution(source, ctx);
  plan.expressionStats = exprStats;

  // ╔════════════════════════════════════════════════════════════════════╗
  // ║  .map() CONTENT ALWAYS GOES TO LUA. ALWAYS. NO EXCEPTIONS.       ║
  // ║                                                                    ║
  // ║  Zig cannot handle dynamic mapped JSX. It can do static maps but  ║
  // ║  even that is more than it needs to. LuaJIT handles all map       ║
  // ║  content — nested maps, conditionals in maps, JSX templates,      ║
  // ║  everything. lua_maps.js emitLuaRebuildList() does the work.      ║
  // ║                                                                    ║
  // ║  If you are reading this and thinking "maybe I can route map       ║
  // ║  content to Zig" — NO. You will eat shit. Every time it has been  ║
  // ║  tried it has failed. Lua handles maps. That is final.            ║
  // ╚════════════════════════════════════════════════════════════════════╝

  // ── Build summary ──
  var activeFeatures = [];
  for (var key in f) {
    if (f[key]) activeFeatures.push(key);
  }
  plan.summary = 'lane=' + plan.lane +
    ' features=' + activeFeatures.length +
    ' atoms=' + plan.predictedAtoms.length +
    ' maps=' + mapScan.total +
    '(zig:' + (mapScan.total - mapScan.lua) + ',lua:' + mapScan.lua + ')' +
    ' expr=' + exprStats.resolved + 'r/' + exprStats.needs_qjs + 'q';

  return plan;
}

// ── Source scanners ─────────────────────────────────────────────
// These are fast regex/string scans on the raw source. They don't
// parse — they detect. Conservative: false positives are OK (the
// atom fires but produces empty output), false negatives are bugs
// (atom doesn't fire when needed).

function scanForDynTexts(source) {
  // Template literals in JSX: {`...${...}...`}
  if (/\{`[^`]*\$\{/.test(source)) return true;
  // Brace expressions that aren't handlers: {varName} or {expr}
  // But not onClick={...} style — those are handlers
  if (/>\s*\{[^}]+\}\s*</.test(source)) return true;
  // Chad dynamic text: text binding in expressions
  if (/\btext\s*=/.test(source) && /\{/.test(source)) return true;
  return false;
}

function scanForHandlers(source) {
  // Standard React event handlers
  if (/\bon(?:Press|Click|Change|Submit|Focus|Blur|Key|Mouse|Touch|Scroll|Drag)\s*=/.test(source)) return true;
  // Chad function references in handlers
  if (/\bdo\s*=/.test(source)) return true;
  return false;
}

function scanForEffects(source) {
  if (/<Effect\b/.test(source)) return true;
  if (/\bonRender\s*=/.test(source)) return true;
  return false;
}

function scanForVariants(source) {
  // Type variant blocks
  if (/<types>/.test(source)) return true;
  // Variant binding syntax: is "value"
  if (/\bis\s+"[^"]+"\s*\?/.test(source)) return true;
  return false;
}

function scanForMaps(source, ctx) {
  var result = { total: 0, flat: 0, nested: 0, inline: 0, lua: 0, routes: [] };

  // .map( patterns
  var mapRe = /(\w+)\.map\s*\(\s*(?:function\s*\(|(?:\(?\s*\w+(?:\s*,\s*\w+)?\s*\)?\s*=>))/g;
  var match;
  while ((match = mapRe.exec(source)) !== null) {
    var sourceVar = match[1];
    var route = {
      pos: match.index,
      sourceVar: sourceVar,
      type: 'flat',
      target: 'zig_oa',
    };

    // Detect nested: .map inside .map
    var preceding = source.slice(Math.max(0, match.index - 200), match.index);
    if (/\.map\s*\(/.test(preceding) && !/\)\s*$/.test(preceding)) {
      route.type = 'nested';
      result.nested++;
    } else {
      result.flat++;
    }

    // Predict backend: if source var is a known OA getter → zig_oa, else lua_runtime
    if (ctx.objectArrays) {
      var isOA = false;
      for (var oi = 0; oi < ctx.objectArrays.length; oi++) {
        if (ctx.objectArrays[oi].getter === sourceVar) { isOA = true; break; }
      }
      if (!isOA) {
        route.target = 'lua_runtime';
        result.lua++;
      }
    }

    // Extract map body content expectations
    route.content = scanMapBody(source, match.index + match[0].length);

    result.routes.push(route);
    result.total++;
  }

  // <For> blocks (chad syntax)
  var forRe = /<For\s+each\s*=\s*["'{]/g;
  while ((match = forRe.exec(source)) !== null) {
    result.routes.push({
      pos: match.index,
      sourceVar: null,
      type: 'flat',
      target: 'zig_oa',
    });
    result.flat++;
    result.total++;
  }

  // Inline maps: .map inside a prop value (not a standalone expression)
  // This is a rough heuristic — parse will refine it
  var inlineRe = /=\s*\{[^}]*\.map\s*\(/g;
  while ((match = inlineRe.exec(source)) !== null) {
    // Don't double-count with the main map scan
    result.inline++;
  }

  return result;
}

function scanForLuaMaps(source) {
  // Lua map rebuilder patterns
  if (/\b__rebuildLuaMap\b/.test(source)) return true;
  // Render-local sources that will become lua maps
  if (/\bconst\s+\w+\s*=\s*\w+\.filter\s*\(/.test(source)) return true;
  return false;
}

function scanForConditionals(source) {
  // Ternary in JSX
  if (/\{[^}]*\?[^}]*:[^}]*\}/.test(source)) return true;
  // <if>/<else> blocks
  if (/<if\b/.test(source)) return true;
  // && short-circuit rendering
  if (/\{[^}]*&&\s*</.test(source)) return true;
  return false;
}

function scanExpressionResolution(source, ctx) {
  var resolved = 0;
  var needs_qjs = 0;

  // Count brace expressions in JSX that will need runtime eval
  var braceRe = /\{([^{}]+)\}/g;
  var match;
  while ((match = braceRe.exec(source)) !== null) {
    var expr = match[1].trim();
    // Skip handler assignments
    if (/^(?:on\w+|do)\s*$/.test(expr)) continue;
    // Skip style objects
    if (expr.indexOf('{') >= 0) continue;

    // Resolvable at compile time: simple state reads, literals, string concat
    if (/^[a-zA-Z_]\w*$/.test(expr)) {
      // Simple variable — resolved if it's a state slot or const
      var isState = false;
      if (ctx.stateSlots) {
        for (var si = 0; si < ctx.stateSlots.length; si++) {
          if (ctx.stateSlots[si].getter === expr) { isState = true; break; }
        }
      }
      if (isState) resolved++;
      else needs_qjs++;
    } else if (/^`[^`]*`$/.test(expr)) {
      // Template literal — needs runtime for interpolation
      needs_qjs++;
    } else if (/^['"][^'"]*['"]$/.test(expr)) {
      // String literal — resolved
      resolved++;
    } else if (/^\d+$/.test(expr)) {
      // Number literal — resolved
      resolved++;
    } else {
      // Complex expression — needs QJS
      needs_qjs++;
    }
  }

  return { resolved: resolved, needs_qjs: needs_qjs };
}

// Extract map callback body and scan for content that must survive emit.
// startPos is right after the .map( callback opening.
function scanMapBody(source, startPos) {
  var content = { colors: [], jsxElements: 0, line: 0 };

  // Find the line number
  var before = source.slice(0, startPos);
  content.line = before.split('\n').length;

  // Walk forward from startPos, tracking parens to find the map callback body.
  // We need balanced parens to find the closing ) of .map(...)
  var depth = 1; // we're already inside the (
  var end = startPos;
  for (var i = startPos; i < source.length && depth > 0; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')') depth--;
    end = i;
  }

  var body = source.slice(startPos, end);

  // Scan for color hex literals
  var colorRe = /#[0-9a-fA-F]{3,8}\b/g;
  var cm;
  var seen = {};
  while ((cm = colorRe.exec(body)) !== null) {
    if (!seen[cm[0]]) {
      content.colors.push(cm[0]);
      seen[cm[0]] = true;
    }
  }

  // Count JSX elements in the body
  var jsxRe = /<[A-Z]\w*/g;
  while (jsxRe.exec(body) !== null) {
    content.jsxElements++;
  }

  return content;
}

function scanForZigUnsafeStrings(source) {
  var hits = [];
  // Single-quoted multi-char strings: valid JS, invalid Zig.
  // Zig only allows single quotes for single characters ('a').
  // Match 'xx' or longer — skip escaped quotes and single-char.
  var sqRe = /'([^'\\]{2,}|[^']*\\.[^']*)'/g;
  var match;
  while ((match = sqRe.exec(source)) !== null) {
    // Find which line this is on
    var before = source.slice(0, match.index);
    var line = before.split('\n').length;
    hits.push('L' + line + ': JS single-quoted string \'' + match[1] + '\' will leak into Zig (use double quotes)');
  }
  return hits;
}
