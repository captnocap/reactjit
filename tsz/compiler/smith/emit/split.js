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
    // Dedup duplicate var declarations in state.zig (component inlining can re-register OAs)
    if (pfn === 'state.zig') {
      var seenVars = {};
      c = c.split('\n').filter(function(line) {
        var m = line.match(/^pub (var|const) (_oa\d+_\w+)\b/);
        if (m) {
          if (seenVars[m[2]]) return false;
          seenVars[m[2]] = true;
        }
        return true;
      }).join('\n');
    }
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
    F['nodes.zig'] = F['nodes.zig'].replace(/= (_effect_shader_\w+)/g, '= handlers.$1');
  }

  // maps.zig: node refs → nodes.X, OA refs → st.X
  if (F['maps.zig']) {
    var mc = F['maps.zig'];
    mc = prefixArrRefs(mc, 'nodes.');
    mc = mc.replace(/\b(_root)\b/g, 'nodes.$1');
    mc = mc.replace(/\b(_oa\d+_\w+)\b/g, 'st.$1');
    mc = mc.replace(/\b(_dyn_(?:buf|text)_\d+)\b/g, 'st.$1');
    mc = mc.replace(/\b(_eval_buf_\d+)\b/g, 'st.$1');
    F['maps.zig'] = mc;
  }

  // app.zig: all cross-module refs
  if (F['app.zig']) {
    var ac = F['app.zig'];
    ac = prefixArrRefs(ac, 'nodes.');
    ac = ac.replace(/\b(_root)\b/g, 'nodes.$1');
    ac = ac.replace(/&(_effect_render_\d+)\b/g, '&handlers.$1');
    ac = ac.replace(/&(_effect_shader_\d+)\b/g, '&handlers.$1');
    ac = ac.replace(/\b(_dyn_(?:buf|text)_\d+)\b/g, 'st.$1');
    ac = ac.replace(/\b(_eval_buf_\d+)\b/g, 'st.$1');
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
        // Ensure core.zig export symbols are in the link unit for monolithic builds
        h += 'comptime { if (!IS_LIB) _ = @import("' + fwPrefix + 'core.zig"); }\n';
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

    // luajit_runtime
    if (F[fname] && F[fname].indexOf('luajit_runtime.') >= 0) {
      if (fastBuild) {
        if (h.indexOf('const api =') < 0) h += 'const api = @import("' + fwPrefix + 'api.zig");\n';
        h += 'const luajit_runtime = api.luajit_runtime;\n';
      } else {
        h += 'const luajit_runtime = if (IS_LIB) struct {\n';
        h += '    pub fn callGlobal(_: [*:0]const u8) void {}\n';
        h += '    pub fn setMapWrapper(_: usize, _: *anyopaque) void {}\n';
        h += '    pub fn registerHostFn(_: [*:0]const u8, _: ?*const anyopaque, _: c_int) void {}\n';
        h += '} else @import("' + fwPrefix + 'luajit_runtime.zig");\n';
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
      if (F['maps.zig'] && F['maps.zig'].indexOf('handlers.') >= 0)
        h += 'const handlers = @import("handlers.zig");\n';
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

  // ── 11. Children manifest — structural metadata for flight check ──
  if (ctx._childrenManifest && ctx._childrenManifest.length > 0) {
    encoded += '__FILE:children_manifest.json__\n';
    encoded += JSON.stringify({ blocks: ctx._childrenManifest }) + '\n';
  }

  return encoded;
}
