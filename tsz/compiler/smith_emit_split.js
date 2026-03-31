// ── Emit ──
// Debug flags — set to true to enable (output goes to generated .zig comments)
// globalThis.__SMITH_DEBUG_MAP_TEXT = true;
// globalThis.__SMITH_DEBUG_MAP_DETECT = true;
// globalThis.__SMITH_DEBUG_MAP_PTRS = true;

// Transpile JS effect onRender body to Zig
// Handles: for loops, const/let/var decls, e.method() calls, arithmetic, nested expressions
function transpileEffectBody(jsBody, param) {
  let out = '';
  const lines = jsBody.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const p = param || 'e'; // effect context param name
  const indent = (n) => '    '.repeat(n);
  let depth = 1; // start at 1 for function body indent

  for (let li = 0; li < lines.length; li++) {
    let line = lines[li];
    // Skip pure braces
    if (line === '{') { depth++; continue; }
    if (line === '}') { depth--; out += indent(depth) + '}\n'; continue; }
    if (line === '};') { depth--; out += indent(depth) + '}\n'; continue; }
    // } else if (...) { — handle BEFORE generic } stripping
    const bElseIf = line.match(/^}\s*else\s+if\s*\((.+)\)\s*\{?\s*$/);
    if (bElseIf) {
      depth--;
      out += indent(depth) + `} else if (${transpileExpr(bElseIf[1], p)}) {\n`;
      depth++;
      continue;
    }
    // } else { — handle BEFORE generic } stripping
    if (/^}\s*else\s*\{?\s*$/.test(line)) {
      depth--;
      out += indent(depth) + '} else {\n';
      depth++;
      continue;
    }
    // Close brace with content after
    if (line.startsWith('}')) { depth--; out += indent(depth) + '}\n'; line = line.slice(1).trim(); if (!line) continue; }

    // for (let v = start; v < end; v++) → var v: i32 = start; while (v < end) : (v += 1) {
    const forMatch = line.match(/^for\s*\(\s*(?:let|var|const)\s+(\w+)\s*=\s*([^;]+);\s*(\w+)\s*(<|<=|>|>=)\s*([^;]+);\s*(\w+)\+\+\s*\)\s*\{?\s*$/);
    if (forMatch) {
      const [, vname, init, , op, bound] = forMatch;
      const zigInit = /^\d+$/.test(init.trim()) ? init.trim() + '.0' : transpileExpr(init, p);
      const zigBound = transpileExpr(bound, p);
      out += indent(depth) + `{\n`;
      depth++;
      out += indent(depth) + `var ${vname}: f32 = ${zigInit};\n`;
      out += indent(depth) + `while (${vname} ${op} ${zigBound}) : (${vname} += 1.0) {\n`;
      depth++;
      continue;
    }

    // const/let/var declaration
    const declMatch = line.match(/^(?:const|let|var)\s+(\w+)\s*=\s*(.+?);?\s*$/);
    if (declMatch) {
      const [, vname, expr] = declMatch;
      const zigExpr = transpileExpr(expr, p);
      // Detect hsv/hsl return type → [3]f32 instead of f32
      const isColorArray = new RegExp(`\\b${p}\\.(hsv|hsl)\\(`).test(expr);
      const zigType = isColorArray ? '[3]f32' : 'f32';
      out += indent(depth) + `const ${vname}: ${zigType} = ${zigExpr};\n`;
      continue;
    }

    // if statement (standalone — } else if/else handled above before } stripping)
    const ifMatch = line.match(/^if\s*\((.+)\)\s*\{?\s*$/);
    if (ifMatch) {
      const zigCond = transpileExpr(ifMatch[1], p);
      out += indent(depth) + `if (${zigCond}) {\n`;
      depth++;
      continue;
    }

    // e.setPixel(x, y, r, g, b, a); → ctx_e.setPixel(x, y, r, g, b, a);
    const callMatch = line.match(new RegExp(`^${p}\\.(\\w+)\\((.*)\\);?\\s*$`));
    if (callMatch) {
      const [, method, argsStr] = callMatch;
      const args = splitArgs(argsStr).map(a => transpileExpr(a.trim(), p));
      if (method === 'setPixel') {
        // setPixel(x, y, r, g, b, a) — all f32 (loop vars are f32)
        out += indent(depth) + `ctx_e.setPixel(${args[0]}, ${args[1]}, ${args[2]}, ${args[3]}, ${args[4]}, ${args[5]});\n`;
      } else if (method === 'clear') {
        out += indent(depth) + `ctx_e.clear();\n`;
      } else if (method === 'fade') {
        out += indent(depth) + `ctx_e.fade(${args[0]});\n`;
      } else {
        out += indent(depth) + `ctx_e.${method}(${args.join(', ')});\n`;
      }
      continue;
    }

    // Fallback — emit as comment
    out += indent(depth) + `// TODO: ${line}\n`;
  }
  // Close any remaining open blocks
  while (depth > 1) { depth--; out += indent(depth) + '}\n'; }
  return out;
}

// Transpile a JS expression to Zig, replacing e.method() calls with ctx_e equivalents
function transpileExpr(expr, p) {
  if (!expr) return '0';
  let e = expr.trim();
  // e.time → ctx_e.time
  e = e.replace(new RegExp(`\\b${p}\\.time\\b`, 'g'), 'ctx_e.time');
  // e.width / e.height → ctx_e.width / ctx_e.height (as f32)
  e = e.replace(new RegExp(`\\b${p}\\.width\\b`, 'g'), '@as(f32, @floatFromInt(ctx_e.width))');
  e = e.replace(new RegExp(`\\b${p}\\.height\\b`, 'g'), '@as(f32, @floatFromInt(ctx_e.height))');
  // e.hsv(h, s, v) → effect_ctx.EffectContext.hsvToRgb(h, s, v) — returns [3]f32
  e = e.replace(new RegExp(`\\b${p}\\.hsv\\(`, 'g'), 'effect_ctx.EffectContext.hsvToRgb(');
  // e.hsl(h, s, l) → effect_ctx.EffectContext.hslToRgb(h, s, l) — returns [3]f32
  e = e.replace(new RegExp(`\\b${p}\\.hsl\\(`, 'g'), 'effect_ctx.EffectContext.hslToRgb(');
  // e.sin(x) → @sin(x), e.sqrt(x) → @sqrt(x) — Zig builtins, not methods
  e = e.replace(new RegExp(`\\b${p}\\.(sin|cos|sqrt|abs|floor|ceil)\\(`, 'g'), '@$1(');
  e = e.replace(new RegExp(`\\b${p}\\.pow\\(`, 'g'), 'std.math.pow(f32, ');
  e = e.replace(new RegExp(`\\b${p}\\.fmod\\(`, 'g'), '@mod(');
  // array[0] → array[0] (already valid Zig for [3]f32)
  // No automatic int-to-float conversion — loop vars are f32 (see for loop transpilation)
  return e;
}

// Split function arguments respecting nested parens
function splitArgs(s) {
  const args = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    if (s[i] === ')') depth--;
    if (s[i] === ',' && depth === 0) { args.push(s.slice(start, i)); start = i + 1; }
  }
  args.push(s.slice(start));
  return args;
}


// ── Split monolithic .zig output into per-concern files ──────────────
// Takes the monolith from emitOutput() and splits it into:
//   nodes.zig, handlers.zig, state.zig, maps.zig, logic.zig, app.zig
// Returns encoded multi-file string: __SPLIT_OUTPUT__\n__FILE:name__\ncontent...
function splitOutput(monolith, file) {
  var basename = file.split('/').pop();
  var appName = basename.replace(/\.tsz$/, '');
  var fastBuild = globalThis.__fastBuild === 1;
  var fwPrefix = 'framework/';

  // ── 1. Find section boundaries via existing markers + fn signatures ──
  var B = [];
  var patterns = [
    ['state_manifest', /^\/\/ ── State manifest/m],
    ['nodes',          /^\/\/ ── Generated node tree/m],
    ['dyntxt',         /^\/\/ ── Dynamic text buffers/m],
    ['handlers',       /^\/\/ ── Event handlers/m],
    ['effects',        /^\/\/ ── Effect render functions/m],
    ['oa',             /^const qjs = /m],
    ['maps',           /^\/\/ ── Map pools/m],
    ['jslogic',        /^\/\/ ── Embedded JS logic/m],
    ['lualogic',       /^\/\/ ── Embedded Lua logic/m],
    ['initstate',      /^fn _initState\(/m],
    ['updatedyn',      /^fn _updateDynamicTexts\(/m],
    ['updatecond',     /^fn _updateConditionals\(/m],
    ['updatevariants', /^fn _updateVariants\(/m],
    ['appinit',        /^fn _appInit\(/m],
    ['apptick',        /^fn _appTick\(/m],
    ['exports',        /^export fn app_get_root\(/m],
    ['stateexports',   /^export fn app_state_count\(/m],
    ['mainfn',         /^(?:pub fn main|export fn main_cart)\(/m],
    ['debug',          /^\/\/ ── SMITH DEBUG/m],
  ];
  for (var pi = 0; pi < patterns.length; pi++) {
    var pname = patterns[pi][0], pre = patterns[pi][1];
    var pm = pre.exec(monolith);
    if (pm) B.push({ name: pname, pos: pm.index });
  }
  B.sort(function(a, b) { return a.pos - b.pos; });

  // ── 2. Extract text between consecutive boundaries ──
  var sec = {};
  for (var i = 0; i < B.length; i++) {
    var end = i + 1 < B.length ? B[i + 1].pos : monolith.length;
    sec[B[i].name] = monolith.substring(B[i].pos, end);
  }

  // ── 3. Group sections into target files ──
  var F = {};
  F['nodes.zig']    = sec.nodes || '';
  F['handlers.zig'] = (sec.handlers || '') + (sec.effects || '');
  F['state.zig']    = (sec.state_manifest || '') + (sec.dyntxt || '') +
                      (sec.oa || '') + (sec.initstate || '');
  F['maps.zig']     = sec.maps || '';
  F['logic.zig']    = (sec.jslogic || '') + (sec.lualogic || '');
  F['app.zig']      = (sec.updatedyn || '') + (sec.updatecond || '') +
                      (sec.updatevariants || '') +
                      (sec.appinit || '') + (sec.apptick || '') +
                      (sec.exports || '') + (sec.stateexports || '') +
                      (sec.mainfn || '') + (sec.debug || '');

  // ── 4. Add pub to declarations so other files can @import them ──
  var pubFiles = ['nodes.zig', 'handlers.zig', 'state.zig', 'maps.zig', 'logic.zig'];
  for (var pfi = 0; pfi < pubFiles.length; pfi++) {
    var pfn = pubFiles[pfi];
    var c = F[pfn];
    if (!c) continue;
    c = c.replace(/^(var _)/gm, 'pub $1');
    c = c.replace(/^(const _)/gm, 'pub $1');
    c = c.replace(/^(const MAX_)/gm, 'pub $1');
    c = c.replace(/^(const QJS_)/gm, 'pub $1');
    c = c.replace(/^(const qjs )/gm, 'pub $1');
    c = c.replace(/^(const JS_LOGIC)/gm, 'pub $1');
    c = c.replace(/^(const LUA_LOGIC)/gm, 'pub $1');
    c = c.replace(/^(fn _)/gm, 'pub $1');
    F[pfn] = c;
  }

  // ── 5. Framework import paths stay as "framework/" ──
  // Forge creates a framework → ../framework symlink in the output directory.
  var allFnames = ['nodes.zig', 'handlers.zig', 'state.zig', 'maps.zig', 'logic.zig', 'app.zig'];

  // ── 6. Cross-reference namespace prefixes ──
  // Helper: collect locally declared _arr_ names in a file's content
  function localArrs(content) {
    var s = new Set();
    var re = /(?:pub )?var (_arr_\d+)\b/g, dm;
    while ((dm = re.exec(content)) !== null) s.add(dm[1]);
    return s;
  }
  // Helper: replace _arr_ refs that are NOT locally declared
  function prefixArrRefs(content, prefix) {
    var local = localArrs(content);
    return content.replace(/\b(_arr_\d+)\b/g, function(m, name) {
      return local.has(name) ? name : prefix + name;
    });
  }

  // nodes.zig: handler function refs → handlers.X
  if (F['nodes.zig']) {
    F['nodes.zig'] = F['nodes.zig'].replace(/= (_handler_\w+)/g, '= handlers.$1');
    F['nodes.zig'] = F['nodes.zig'].replace(/= (_effect_render_\w+)/g, '= handlers.$1');
  }

  // maps.zig: node refs → nodes.X, OA refs → st.X
  if (F['maps.zig']) {
    var mc = F['maps.zig'];
    mc = prefixArrRefs(mc, 'nodes.');
    mc = mc.replace(/\b(_root)\b/g, 'nodes.$1');
    mc = mc.replace(/\b(_oa\d+_\w+)\b/g, 'st.$1');
    mc = mc.replace(/\b(_dyn_(?:buf|text)_\d+)\b/g, 'st.$1');
    F['maps.zig'] = mc;
  }

  // app.zig: all cross-module refs
  if (F['app.zig']) {
    var ac = F['app.zig'];
    ac = prefixArrRefs(ac, 'nodes.');
    ac = ac.replace(/\b(_root)\b/g, 'nodes.$1');
    ac = ac.replace(/\b(_dyn_(?:buf|text)_\d+)\b/g, 'st.$1');
    ac = ac.replace(/\b(_oa\d+_\w+)\b/g, 'st.$1');
    ac = ac.replace(/\b(_setVariantHost)\b/g, 'st.$1');
    ac = ac.replace(/\b_initState\b/g, 'st._initState');
    ac = ac.replace(/\b(_pool_arena)\b/g, 'maps.$1');
    ac = ac.replace(/\b(_rebuildMap\d+)\b/g, 'maps.$1');
    ac = ac.replace(/\b(_map_count_\d+)\b/g, 'maps.$1');
    ac = ac.replace(/\b(_map_pool_\d+)\b/g, 'maps.$1');
    ac = ac.replace(/\b(_initMapLuaPtrs\d+_\d+)\b/g, 'maps.$1');
    ac = ac.replace(/\bJS_LOGIC\b/g, 'logic.JS_LOGIC');
    ac = ac.replace(/\bLUA_LOGIC\b/g, 'logic.LUA_LOGIC');
    F['app.zig'] = ac;
  }

  // ── 7. Build per-file import headers ──
  function mkHeader(fname) {
    var h = '//! Generated by tsz compiler \u2014 ' + appName + ' [' + fname + ']\n';
    h += '//! Source: ' + basename + '\n\n';

    if (fname !== 'logic.zig') h += 'const std = @import("std");\n';

    if (!fastBuild && fname !== 'logic.zig') {
      h += 'const build_options = @import("build_options");\n';
      h += 'const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;\n\n';
    }

    // Layout types
    if (fname === 'nodes.zig' || fname === 'maps.zig' || fname === 'app.zig') {
      if (fastBuild) {
        h += 'const api = @import("' + fwPrefix + 'api.zig");\n';
        h += 'const layout = api;\n';
        h += 'const Node = api.Node;\nconst Style = api.Style;\nconst Color = api.Color;\n';
      } else {
        h += 'const layout = @import("' + fwPrefix + 'layout.zig");\n';
        h += 'const Node = layout.Node;\nconst Style = layout.Style;\nconst Color = layout.Color;\n';
      }
    }

    // Framework state module
    var needsState = F[fname] && F[fname].indexOf('state.') >= 0;
    if (needsState || fname === 'state.zig' || fname === 'app.zig') {
      if (fastBuild) {
        if (h.indexOf('const api =') < 0) h += 'const api = @import("' + fwPrefix + 'api.zig");\n';
        if (h.indexOf('const state =') < 0) h += 'const state = api.state;\n';
      } else {
        if (h.indexOf('const state =') < 0) h += 'const state = @import("' + fwPrefix + 'state.zig");\n';
      }
    }

    // Engine (app.zig only)
    if (fname === 'app.zig') {
      if (fastBuild) {
        if (h.indexOf('const api =') < 0) h += 'const api = @import("' + fwPrefix + 'api.zig");\n';
        h += 'const engine = api.engine;\n';
      } else {
        h += 'const engine = if (IS_LIB) struct {} else @import("' + fwPrefix + 'engine.zig");\n';
      }
    }

    // qjs_runtime
    if (F[fname] && F[fname].indexOf('qjs_runtime.') >= 0) {
      if (fastBuild) {
        if (h.indexOf('const api =') < 0) h += 'const api = @import("' + fwPrefix + 'api.zig");\n';
        h += 'const qjs_runtime = api.qjs_runtime;\n';
      } else {
        h += 'const qjs_runtime = if (IS_LIB) struct {\n';
        h += '    pub fn callGlobal(_: []const u8) void {}\n';
        h += '    pub fn callGlobalStr(_: []const u8, _: []const u8) void {}\n';
        h += '    pub fn callGlobalInt(_: []const u8, _: i64) void {}\n';
        h += '    pub fn registerHostFn(_: []const u8, _: ?*const anyopaque, _: u8) void {}\n';
        h += '    pub fn evalExpr(_: []const u8) void {}\n';
        h += '} else @import("' + fwPrefix + 'qjs_runtime.zig");\n';
      }
    }

    // Cross-module imports
    if (fname === 'nodes.zig' && F['nodes.zig'] && F['nodes.zig'].indexOf('handlers.') >= 0) {
      h += 'const handlers = @import("handlers.zig");\n';
    }
    if (fname === 'maps.zig') {
      if (F['maps.zig'] && F['maps.zig'].indexOf('nodes.') >= 0)
        h += 'const nodes = @import("nodes.zig");\n';
      if (F['maps.zig'] && F['maps.zig'].indexOf('st.') >= 0)
        h += 'const st = @import("state.zig");\n';
    }
    if (fname === 'app.zig') {
      h += 'const nodes = @import("nodes.zig");\n';
      h += 'const st = @import("state.zig");\n';
      if (F['maps.zig'] && F['maps.zig'].trim())
        h += 'const maps = @import("maps.zig");\n';
      if (F['handlers.zig'] && F['handlers.zig'].trim())
        h += 'const handlers = @import("handlers.zig");\n';
      h += 'const logic = @import("logic.zig");\n';
    }

    h += '\n';
    return h;
  }

  // ── 8. Add origin tags ──
  for (var oi = 0; oi < allFnames.length; oi++) {
    var ofn = allFnames[oi];
    if (!F[ofn]) continue;
    var oc = F[ofn];
    // Tag section headers
    oc = oc.replace(
      /^(\/\/ ── [^\n]+ ──[─]+)$/gm,
      '// [origin:' + appName + ':' + ofn.replace('.zig', '') + ']\n$1'
    );
    // Tag handler functions
    oc = oc.replace(
      /^((?:pub )?fn (_handler_\w+)\()/gm,
      '// [origin:' + appName + ':handler:$2]\n$1'
    );
    // Tag rebuild functions
    oc = oc.replace(
      /^((?:pub )?fn (_rebuildMap\d+)\()/gm,
      '// [origin:' + appName + ':map:$2]\n$1'
    );
    // Tag OA unpack
    oc = oc.replace(
      /^((?:pub )?fn (_oa\d+_unpack)\()/gm,
      '// [origin:' + appName + ':oa:$2]\n$1'
    );
    // Tag root node
    oc = oc.replace(
      /^((?:pub )?var _root )/gm,
      '// [origin:' + appName + ':root]\n$1'
    );
    F[ofn] = oc;
  }

  // ── 9. Assemble final files ──
  var result = {};
  for (var ri = 0; ri < allFnames.length; ri++) {
    var rfn = allFnames[ri];
    if (!F[rfn] || !F[rfn].trim()) {
      result[rfn] = '//! Generated by tsz compiler \u2014 ' + appName + ' [' + rfn + ']\n//! (no content for this cart)\n';
      continue;
    }
    result[rfn] = mkHeader(rfn) + F[rfn];
  }

  // ── 10. Encode as multi-file output ──
  var encoded = '__SPLIT_OUTPUT__\n';
  for (var ei = 0; ei < allFnames.length; ei++) {
    encoded += '__FILE:' + allFnames[ei] + '__\n';
    encoded += result[allFnames[ei]];
  }
  return encoded;
}


// ── JS_LOGIC + LUA_LOGIC generation ──
function emitLogicBlocks(ctx) {
  var out = '';
    // JS/Lua logic — with section dividers matching reference
    out += `\n// \u2500\u2500 Embedded JS logic \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
    out += `const JS_LOGIC =\n`;
    // Generate JS logic: object array setters + script block + state setter rewrites
    const jsLines = [];
    // Object array JS var declarations + setters
    // For page mode (scriptBlock): var declarations here, setter functions AFTER scriptBlock
    //   so they override page.js setters that lack __setObjArr calls.
    // For non-page mode: both var + setter here (no conflict).
    var oaInitCalls = [];
    for (const oa of ctx.objectArrays) {
      if (oa.isNested || oa.isConst) continue; // nested OAs unpacked by parent, const OAs are static
      jsLines.push(`var ${oa.getter} = [];`);
      if (!ctx.scriptBlock && !globalThis.__scriptContent) {
        jsLines.push(`function ${oa.setter}(v) { ${oa.getter} = v; __setObjArr${oa.oaIdx}(v); }`);
      }
      // Reconstruct initial data from tokens and schedule setter call
      if (oa.initDataStartPos !== undefined && oa.initDataEndPos !== undefined && oa.setter) {
        var initParts = [];
        for (var ti = oa.initDataStartPos; ti < oa.initDataEndPos; ti++) {
          var tk = globalThis.__cursor.textAt(ti);
          // Convert single-quoted strings to double-quoted for consistent JS
          if (tk.length >= 2 && tk[0] === "'" && tk[tk.length - 1] === "'") {
            var inner = tk.slice(1, -1).replace(/"/g, '\\"');
            tk = '"' + inner + '"';
          }
          initParts.push(tk);
        }
        var initText = initParts.join(' ');
        // Strip outer () from useState( [...] )
        initText = initText.replace(/^\(\s*/, '').replace(/\s*\)\s*$/, '');
        if (initText.length > 2 && initText[0] === '[') {
          oaInitCalls.push(`${oa.setter}(${initText});`);
        }
      }
    }
    // Emit OA init calls after setter definitions are available
    if (oaInitCalls.length > 0) {
      jsLines.push('// OA initial data');
      for (var ii = 0; ii < oaInitCalls.length; ii++) jsLines.push(oaInitCalls[ii]);
    }
    // Script file imports — content passed via __scriptContent
    if (globalThis.__scriptContent) {
      // Emit state variable declarations (same as inline <script> path)
      for (const s of ctx.stateSlots) {
        const idx = ctx.stateSlots.indexOf(s);
        jsLines.push(`var ${s.getter} = ${s.type === 'string' ? `'${s.initial}'` : s.initial};`);
        const jsSetter = s.type === 'string' ? '__setStateString' : '__setState';
        jsLines.push(`function ${s.setter}(v) { ${s.getter} = v; ${jsSetter}(${idx}, v); }`);
      }
      // No setter rewriting needed — declared setter functions handle state updates
      // Strip <script>/<\/script> tags and 'export' keywords — file imports include them raw
      // QuickJS eval doesn't support ES module syntax, so 'export' must be removed
      const scriptLines = globalThis.__scriptContent.split('\n')
        .filter(l => !/^\s*<\/?script>\s*$/.test(l))
        .filter(l => !/^\s*declare\s+/.test(l))
        .map(l => l.replace(/^export\s+/, ''))
        .map(l => l.replace(/:\s*(any|void|string|number|boolean)\b/g, ''));
      for (const line of scriptLines) jsLines.push(line);
      jsLines.push('');  // trailing blank line
    }
    // Script block (inline <script>) or script file import — also emit state var declarations
    if (ctx.scriptBlock || globalThis.__scriptContent) {
      if (ctx.scriptBlock) {
        for (const s of ctx.stateSlots) {
          const idx = ctx.stateSlots.indexOf(s);
          jsLines.push(`var ${s.getter} = ${s.type === 'string' ? `'${s.initial}'` : s.initial};`);
          const jsSetter = s.type === 'string' ? '__setStateString' : '__setState';
          jsLines.push(`function ${s.setter}(v) { ${s.getter} = v; ${jsSetter}(${idx}, v); }`);
        }
        for (const line of ctx.scriptBlock.split('\n')) jsLines.push(line);
      }
      // OA setter functions — AFTER scriptBlock so they override any page.js setters
      for (const oa of ctx.objectArrays) {
        if (oa.isNested || oa.isConst) continue;
        jsLines.push(`function ${oa.setter}(v) { ${oa.getter} = v; __setObjArr${oa.oaIdx}(v); }`);
      }
      // Auto-call init(stateProxy) if script exports an init function
      // Convention: export function init(state) { state.arrayName = [...]; state.slotName = val; }
      // The proxy routes state.X = val to setX(val) for both OA setters and state setters.
      if (globalThis.__scriptContent && globalThis.__scriptContent.indexOf('function init(') >= 0) {
        var proxyProps = [];
        for (const oa of ctx.objectArrays) {
          if (oa.isNested || oa.isConst) continue;
          proxyProps.push(`set ${oa.getter}(v) { ${oa.setter}(v); }`);
        }
        for (const s of ctx.stateSlots) {
          proxyProps.push(`set ${s.getter}(v) { ${s.setter}(v); }`);
        }
        if (proxyProps.length > 0) {
          jsLines.push(`if (typeof init === 'function') init({ ${proxyProps.join(', ')} });`);
        }
      }
      // Auto-push initial OA data to Zig side — script block may have set initial values
      // that need to flow through __setObjArr to be visible in the node tree.
      // Without this, data defined in <script> stays in JS-land and maps render empty.
      for (const oa of ctx.objectArrays) {
        if (oa.isNested || oa.isConst) continue;
        jsLines.push(`if (${oa.getter} && ${oa.getter}.length > 0) ${oa.setter}(${oa.getter});`);
      }
      // useEffect bodies — mount-time init code from App body
      if (ctx._useEffectBodies && ctx._useEffectBodies.length > 0) {
        for (const body of ctx._useEffectBodies) {
          jsLines.push(body);
        }
      }
      // setVariant JS wrapper — bridges JS handler calls to Zig theme.setVariant
      if (ctx.variantBindings && ctx.variantBindings.length > 0) {
        jsLines.push(`function setVariant(v) { __setVariant(v); }`);
      }
      // Emit JS wrapper functions for prop-forwarded handler closures
      // These are handlers created from closure props (e.g., onSelect={(next) => { selectTab(next) }})
      // that get called with arguments from inside inlined components (e.g., onSelect(0))
      for (const h of ctx.handlers) {
        if (h.inMap) continue; // map handlers have their own __mapPress wrappers
        if (!h.luaBody) continue;
        if (!h.closureParams || h.closureParams.length === 0) continue;
        // Check if this handler name is referenced in any other handler's luaBody or in node js_on_press strings
        const hName = h.name;
        const isReferenced = ctx.handlers.some(function(h2) { return h2 !== h && h2.luaBody && h2.luaBody.indexOf(hName + '(') >= 0; });
        if (!isReferenced) continue;
        const params = h.closureParams.join(', ');
        let jsBody = h.luaBody || '';
        if (jsBody) jsBody = jsTransform(jsBody);
        jsLines.push(`function ${hName}(${params}) { ${jsBody}; }`);
      }
      // Add __mapPress_N handlers to JS_LOGIC so map handlers dispatch through QuickJS
      for (let mi = 0; mi < ctx.maps.length; mi++) {
        const m = ctx.maps[mi];
        const mapHandlers = ctx.handlers.filter(h => h.inMap && h.mapIdx === mi);
        for (let hi = 0; hi < mapHandlers.length; hi++) {
          const mh = mapHandlers[hi];
          // Build JS handler body from luaBody or Zig body
          let jsHandlerBody = mh.luaBody || '';
          // Convert Lua operators to JS in map handler bodies
          if (jsHandlerBody) jsHandlerBody = jsTransform(jsHandlerBody);
          if (!jsHandlerBody) {
            // Extract callGlobal("func") → func()
            const calls = (mh.body || '').match(/qjs_runtime\.callGlobal\("(\w+)"\)/g);
            if (calls) jsHandlerBody = calls.map(c => { const m2 = c.match(/"(\w+)"/); return m2 ? m2[1] + '()' : ''; }).filter(Boolean).join('; ');
            // Extract setSlot(N, expr) → setterName(expr)
            const sets = (mh.body || '').match(/state\.setSlot\((\d+),\s*([^)]+)\)/g);
            if (sets) {
              const setParts = sets.map(s => { const m2 = s.match(/state\.setSlot\((\d+),\s*([^)]+)\)/); if (!m2) return ''; const ss = ctx.stateSlots[parseInt(m2[1])]; return ss ? ss.setter + '(' + m2[2].replace(/state\.getSlot\((\d+)\)/g, (_, si) => { const s2 = ctx.stateSlots[parseInt(si)]; return s2 ? s2.getter : '__getState(' + si + ')'; }) + ')' : ''; }).filter(Boolean);
              jsHandlerBody = (jsHandlerBody ? jsHandlerBody + '; ' : '') + setParts.join('; ');
            }
          }
          if (jsHandlerBody) {
            jsLines.push(`function __mapPress_${mi}_${hi}(idx) {`);
            if (m.oa) {
              jsLines.push(`  var ${m.itemParam} = ${m.oa.getter}[idx];`);
              jsLines.push(`  var ${m.indexParam} = idx;`);
              // Extract component props that map to item fields (e.g., label → item.label)
              for (const f of m.oa.fields) {
                if (f.type === 'nested_array') continue;
                const pat = new RegExp(`\\b${f.name}\\b`);
                if (pat.test(jsHandlerBody) && f.name !== m.itemParam && f.name !== m.indexParam) {
                  jsLines.push(`  var ${f.name} = ${m.itemParam}.${f.name};`);
                }
              }
            }
            // Declare JS variables for component props that were Zig expressions
            // (luaParseHandler emitted the prop name; now we need to bind it to a JS value)
            if (mh.zigProps) {
              for (const [propName, zigVal] of Object.entries(mh.zigProps)) {
                const propPat = new RegExp(`\\b${propName}\\b`);
                if (!propPat.test(jsHandlerBody)) continue;
                // Already declared as OA field or map param — skip
                if (m.oa && m.oa.fields.some(f => f.name === propName)) continue;
                if (propName === (m && m.itemParam) || propName === (m && m.indexParam)) continue;
                // Convert Zig expression to JS equivalent
                let jsVal = zigVal;
                // @as(i64, @intCast(_i)) or @as(i64, @intCast(_j)) → idx (map index)
                if (/^@as\(i64,\s*@intCast\(_[ij]\)\)$/.test(zigVal)) {
                  jsVal = 'idx';
                }
                // _oaN_field[_i] → item.field (OA field access from current or parent map)
                else if (/^_oa(\d+)_(\w+)\[_i\]$/.test(zigVal)) {
                  const oaMatch = zigVal.match(/^_oa(\d+)_(\w+)\[_i\]$/);
                  if (oaMatch) {
                    const oaIdx = parseInt(oaMatch[1]);
                    const field = oaMatch[2];
                    // Find which OA this belongs to and use its getter
                    const srcOa = ctx.objectArrays.find(o => o.oaIdx === oaIdx);
                    if (srcOa) jsVal = `${srcOa.getter}[idx].${field}`;
                    else jsVal = `idx`;
                  }
                }
                // _oaN_field[_i][0.._oaN_field_lens[_i]] → item.field (string OA field)
                else if (/^_oa(\d+)_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]$/.test(zigVal)) {
                  const oaMatch = zigVal.match(/^_oa(\d+)_(\w+)\[_i\]/);
                  if (oaMatch) {
                    const oaIdx = parseInt(oaMatch[1]);
                    const field = oaMatch[2];
                    const srcOa = ctx.objectArrays.find(o => o.oaIdx === oaIdx);
                    if (srcOa) jsVal = `${srcOa.getter}[idx].${field}`;
                    else jsVal = `idx`;
                  }
                }
                // state.getSlot(N) → getter name
                else if (/^state\.getSlot\((\d+)\)$/.test(zigVal)) {
                  const slotMatch = zigVal.match(/^state\.getSlot\((\d+)\)$/);
                  if (slotMatch) {
                    const ss = ctx.stateSlots[parseInt(slotMatch[1])];
                    jsVal = ss ? ss.getter : zigVal;
                  }
                }
                jsLines.push(`  var ${propName} = ${jsVal};`);
              }
            }
            jsLines.push(`  ${jsHandlerBody};`);
            jsLines.push(`}`);
            mh._emittedInJS = true;
          }
        }
      }
    }
    // Append __evalDynTexts for JS-evaluated dynamic text expressions (e.g., {fmtTime()})
    if (ctx._jsDynTexts && ctx._jsDynTexts.length > 0) {
      jsLines.push('function __evalDynTexts() {');
      for (var jdi = 0; jdi < ctx._jsDynTexts.length; jdi++) {
        var jdt = ctx._jsDynTexts[jdi];
        jsLines.push('  try { __setStateString(' + jdt.slotIdx + ', String(' + jdt.jsExpr + ')); } catch(e) {}');
      }
      jsLines.push('}');
      jsLines.push('__evalDynTexts();');
      jsLines.push('setInterval(__evalDynTexts, 16);');
    }
    for (const line of jsLines) {
      out += `    \\\\${line}\n`;
    }
    out += `    \\\\\n;\n`;
    out += `\n// \u2500\u2500 Embedded Lua logic \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
    out += `const LUA_LOGIC =\n`;
    // Generate Lua state variable declarations + setter functions
    const luaLines = [];
    const hasLuaHandlers = ctx.handlers.some(h => h.luaBody);
    if (hasLuaHandlers || ctx.stateSlots.length > 0) {
      luaLines.push('-- State variables (mirroring Zig state slots)');
      for (let si = 0; si < ctx.stateSlots.length; si++) {
        const s = ctx.stateSlots[si];
        const luaInit = s.type === 'string' ? `'${s.initial}'` : (s.type === 'boolean' ? (s.initial ? 'true' : 'false') : s.initial);
        luaLines.push(`${s.getter} = ${luaInit}`);
      }
      luaLines.push('');
      // Setter functions: update local + push to Zig state slot
      for (let si = 0; si < ctx.stateSlots.length; si++) {
        const s = ctx.stateSlots[si];
        if (s.type === 'string') {
          luaLines.push(`function ${s.setter}(v) ${s.getter} = v; __setStateString(${si}, v) end`);
        } else {
          luaLines.push(`function ${s.setter}(v) ${s.getter} = v; __setState(${si}, v) end`);
        }
      }
      luaLines.push('');
    }
    // Object array data loading via Lua
    for (const oa of ctx.objectArrays) {
      if (oa.isNested || oa.isConst) continue; // nested OAs unpacked by parent, const OAs are static
      luaLines.push(`local ${oa.getter} = {}`);
      luaLines.push(`function ${oa.setter}(v) ${oa.getter} = v; __setObjArr${oa.oaIdx}(v) end`);
    }
    // Map handler functions in Lua — MUST come before script content
    // (script may call OA setters that fail in Lua, aborting the rest of the script)
    // (script may call OA setters that fail in Lua, aborting the rest of the script)
    for (let mi = 0; mi < ctx.maps.length; mi++) {
      const mapHandlers = ctx.handlers.filter(h => h.inMap && h.mapIdx === mi);
      for (let hi = 0; hi < mapHandlers.length; hi++) {
        const mh = mapHandlers[hi];
        if (mh.luaBody && !mh._emittedInJS) {
          const m = ctx.maps[mi];
          if (m.isNested && m.parentMap) {
            // Nested map handler receives (parent_idx, item_idx)
            const outerIdxParam = m.parentMap.indexParam || 'gi';
            const innerIdxParam = m.indexParam || 'ii';
            luaLines.push(`function __mapPress_${mi}_${hi}(${outerIdxParam}, ${innerIdxParam})`);
            luaLines.push(`  ${luaTransform(mh.luaBody)}`);
            luaLines.push(`end`);
          } else {
            // Top-level map handler — scan for item.field refs and pass as args
            const oa = m.oa;
            const ip = m.itemParam;
            const fieldRefs = [];
            if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
              ctx._debugLines.push('[MAP_HANDLER_SCAN] mi=' + mi + ' hi=' + hi + ' ip=' + ip + ' luaBody=' + (mh.luaBody || '').substring(0, 120) + ' oa=' + (oa ? 'yes fields=' + oa.fields.map(f => f.name).join(',') : 'null'));
            }
            if (oa) {
              for (const f of oa.fields) {
                if (f.type === 'nested_array') continue;
                const pat = new RegExp(`\\b${ip}\\.${f.name}\\b`);
                const matched = pat.test(mh.luaBody);
                if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
                  ctx._debugLines.push('[MAP_HANDLER_SCAN]   field=' + f.name + ' pat=' + pat + ' match=' + matched);
                }
                if (matched) fieldRefs.push(f);
              }
            }
            const params = ['idx', ...fieldRefs.map(f => `_f_${f.name}`)];
            luaLines.push(`function __mapPress_${mi}_${hi}(${params.join(', ')})`);
            if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
              const printArgs = params.map(p => `tostring(${p})`).join(' .. "," .. ');
              luaLines.push(`  print("[MAP_PRESS_DEBUG] __mapPress_${mi}_${hi} args=" .. ${printArgs})`);
            }
            luaLines.push(`  local ${m.indexParam} = idx`);
            let body = luaTransform(mh.luaBody);
            for (const f of fieldRefs) {
              body = body.replace(new RegExp(`\\b${ip}\\.${f.name}\\b`, 'g'), `_f_${f.name}`);
            }
            luaLines.push(`  ${body}`);
            luaLines.push(`end`);
            // Store field refs for Zig ptr building (per-handler)
            if (!m._handlerFieldRefsMap) m._handlerFieldRefsMap = {};
            m._handlerFieldRefsMap[hi] = fieldRefs;
            m._handlerFieldRefs = fieldRefs; // keep for backward compat
          }
          luaLines.push('');
        }
      }
    }
    // Script file imports — NOT included in LUA_LOGIC.
    // QuickJS runs the script content via JS_LOGIC. Including it in Lua
    // causes syntax errors (JS for loops, .push(), etc.) that abort the
    // entire Lua chunk, killing setter/handler definitions above it.
    // Inline script block — NOT included in LUA_LOGIC.
    // Script content goes into JS_LOGIC only. Including it in Lua causes syntax errors
    // (JS arrays, for loops, ===, etc.) that abort the entire Lua chunk.
    // Emit Lua lines as Zig multiline string
    if (luaLines.length > 0) {
      for (const line of luaLines) {
        out += `    \\\\${line}\n`;
      }
    }
    out += `    \\\\\n;\n\n`;
  return out;
}

// ── JS→Lua method/syntax transforms ──
// Applied to handler luaBody and LUA_LOGIC script content.
// Ported from love2d/cli/lib/tsl.mjs method call transforms.
function luaTransform(code) {
  if (!code) return code;
  let s = code;
  // Operators: !== → ~=, === → ==, != → ~=, || → or, && → and, ! → not
  s = s.replace(/!==/g, '~=');
  s = s.replace(/===/g, '==');
  s = s.replace(/!=/g, '~=');
  s = s.replace(/\|\|/g, ' or ');
  s = s.replace(/&&/g, ' and ');
  // !expr → not expr (but not != which is already handled)
  s = s.replace(/!(?!=|=)/g, 'not ');
  // Control flow: if/else/elseif/while/for → Lua equivalents
  // } else if (cond) { → elseif cond then (must come before } else {)
  s = s.replace(/\}\s*else\s+if\s*\(([^)]+)\)\s*\{/g, ' elseif $1 then ');
  // } else { → else
  s = s.replace(/\}\s*else\s*\{/g, ' else ');
  // if (cond) { → if cond then
  s = s.replace(/\bif\s*\(([^)]+)\)\s*\{/g, 'if $1 then ');
  // while (cond) { → while cond do
  s = s.replace(/\bwhile\s*\(([^)]+)\)\s*\{/g, 'while $1 do ');
  // for (const/let x of arr) { → for _, x in ipairs(arr) do
  s = s.replace(/\bfor\s*\(\s*(?:const|let|var)\s+(\w+)\s+of\s+(\w+)\)\s*\{/g, 'for _, $1 in ipairs($2) do ');
  // for (const/let x in obj) { → for x, _ in pairs(obj) do
  s = s.replace(/\bfor\s*\(\s*(?:const|let|var)\s+(\w+)\s+in\s+(\w+)\)\s*\{/g, 'for $1, _ in pairs($2) do ');
  // Standalone } → end (block closers)
  s = s.replace(/;\s*\}/g, '; end ');
  s = s.replace(/\}\s*$/g, ' end');
  s = s.replace(/\bthen\s+end\b/g, 'then'); // undo false "end" after empty then
  // const/let/var → local
  s = s.replace(/\b(const|let|var)\s+/g, 'local ');
  // null/undefined → nil
  s = s.replace(/\bnull\b/g, 'nil');
  s = s.replace(/\bundefined\b/g, 'nil');
  // .length → #
  s = s.replace(/(\w+)\.length\b/g, '#$1');
  // console.log(...) → print(...)
  s = s.replace(/console\.(log|warn|error)\(/g, 'print(');
  // Math methods
  s = s.replace(/Math\.floor\(/g, 'math.floor(');
  s = s.replace(/Math\.ceil\(/g, 'math.ceil(');
  s = s.replace(/Math\.round\(([^)]+)\)/g, 'math.floor($1 + 0.5)');
  s = s.replace(/Math\.abs\(/g, 'math.abs(');
  s = s.replace(/Math\.sqrt\(/g, 'math.sqrt(');
  s = s.replace(/Math\.min\(/g, 'math.min(');
  s = s.replace(/Math\.max\(/g, 'math.max(');
  s = s.replace(/Math\.sin\(/g, 'math.sin(');
  s = s.replace(/Math\.cos\(/g, 'math.cos(');
  s = s.replace(/Math\.pow\(/g, 'math.pow(');
  s = s.replace(/Math\.random\(\)/g, 'math.random()');
  s = s.replace(/Math\.PI\b/g, 'math.pi');
  // parseInt/parseFloat → tonumber
  s = s.replace(/parseInt\(/g, 'tonumber(');
  s = s.replace(/parseFloat\(/g, 'tonumber(');
  s = s.replace(/Number\(/g, 'tonumber(');
  // String methods
  s = s.replace(/(\w+)\.toUpperCase\(\)/g, 'string.upper($1)');
  s = s.replace(/(\w+)\.toLowerCase\(\)/g, 'string.lower($1)');
  s = s.replace(/(\w+)\.trim\(\)/g, '$1:match("^%s*(.-)%s*$")');
  s = s.replace(/(\w+)\.startsWith\(([^)]+)\)/g, '(string.sub($1, 1, #$2) == $2)');
  s = s.replace(/(\w+)\.endsWith\(([^)]+)\)/g, '(string.sub($1, -#$2) == $2)');
  s = s.replace(/(\w+)\.includes\(([^)]+)\)/g, '(string.find($1, $2, 1, true) ~= nil)');
  s = s.replace(/(\w+)\.indexOf\(([^)]+)\)/g, '(string.find($1, $2, 1, true) or 0)');
  s = s.replace(/(\w+)\.replace\(([^,]+),\s*([^)]+)\)/g, 'string.gsub($1, $2, $3)');
  s = s.replace(/(\w+)\.split\(([^)]+)\)/g, '__split($1, $2)');
  s = s.replace(/(\w+)\.join\(([^)]*)\)/g, 'table.concat($1, $2)');
  s = s.replace(/(\w+)\.toString\(\)/g, 'tostring($1)');
  // Array methods
  s = s.replace(/(\w+)\.push\(([^)]+)\)/g, 'table.insert($1, $2)');
  s = s.replace(/(\w+)\.pop\(\)/g, 'table.remove($1)');
  s = s.replace(/(\w+)\.shift\(\)/g, 'table.remove($1, 1)');
  s = s.replace(/(\w+)\.unshift\(([^)]+)\)/g, 'table.insert($1, 1, $2)');
  s = s.replace(/(\w+)\.sort\(\)/g, 'table.sort($1)');
  s = s.replace(/(\w+)\.reverse\(\)/g, '__reverse($1)');
  // JSON
  s = s.replace(/JSON\.stringify\(/g, '__jsonEncode(');
  s = s.replace(/JSON\.parse\(/g, '__jsonDecode(');
  // typeof → type()
  s = s.replace(/typeof\s+(\w+)/g, 'type($1)');
  // Template literals `...${expr}...` → "..." .. expr .. "..."
  s = s.replace(/`([^`]*)`/g, function(_, content) {
    var parts = [];
    var last = 0;
    var re = /\$\{([^}]+)\}/g;
    var m;
    while ((m = re.exec(content)) !== null) {
      if (m.index > last) parts.push('"' + content.slice(last, m.index) + '"');
      parts.push(m[1]);
      last = m.index + m[0].length;
    }
    if (last < content.length) parts.push('"' + content.slice(last) + '"');
    return parts.join(' .. ') || '""';
  });
  return s;
}

// Transform JS handler/script code for QuickJS (lighter — just fix operators)
function jsTransform(code) {
  if (!code) return code;
  var s = code;
  // Lua operators that leaked into JS bodies → convert back
  s = s.replace(/\band\b/g, '&&');
  s = s.replace(/\bor\b/g, '||');
  s = s.replace(/~=/g, '!=');
  s = s.replace(/\bnot\b/g, '!');
  s = s.replace(/ \.\. /g, ' + ');
  return s;
}
