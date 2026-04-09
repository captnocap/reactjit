// ── Emit Atom 044: Split namespace prefixing ────────────────────
// Index: 44
// Group: split_finalize
// Target: split
// Status: complete
// Current owner: emit_split.js
//
// Trigger: split output sections with cross-file symbol references.
// Output target: namespace prefixes for nodes/st/maps/handlers refs.
//
// When monolithic output is split into per-concern files, symbols
// that were local now live in separate compilation units. This atom
// handles three transforms:
//
// 1. pub promotion — var/const/fn declarations in non-app files
//    get `pub` so other files can @import them.
//
// 2. Dedup — state.zig deduplicates OA declarations that component
//    inlining may have registered twice.
//
// 3. Cross-reference prefixing:
//    - nodes.zig: handler/effect refs → handlers.X
//    - maps.zig:  _arr_ refs → nodes.X, _oa → st.X, _dyn → st.X
//    - app.zig:   all cross-module refs (nodes/st/maps/logic)

function _a044_applies() {
  // Disabled — split is handled by emit/split.js via finalizeEmitOutput().
  return false;
}

function _a044_emit(F) {
  // ── pub promotion ──
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
    // Dedup duplicate var declarations in state.zig
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

  // ── Helpers for _arr_ cross-referencing ──
  function localArrs(content) {
    var s = new Set();
    var re = /(?:pub )?var (_arr_\d+)\b/g, dm;
    while ((dm = re.exec(content)) !== null) s.add(dm[1]);
    return s;
  }
  function prefixArrRefs(content, prefix) {
    var local = localArrs(content);
    return content.replace(/\b(_arr_\d+)\b/g, function(m, name) {
      return local.has(name) ? name : prefix + name;
    });
  }

  // ── nodes.zig: handler function refs → handlers.X ──
  if (F['nodes.zig']) {
    F['nodes.zig'] = F['nodes.zig'].replace(/= (_handler_\w+)/g, '= handlers.$1');
    F['nodes.zig'] = F['nodes.zig'].replace(/= (_effect_render_\w+)/g, '= handlers.$1');
    F['nodes.zig'] = F['nodes.zig'].replace(/= (_effect_shader_\w+)/g, '= handlers.$1');
  }

  // ── maps.zig: node refs → nodes.X, OA refs → st.X ──
  if (F['maps.zig']) {
    var mc = F['maps.zig'];
    mc = prefixArrRefs(mc, 'nodes.');
    mc = mc.replace(/\b(_root)\b/g, 'nodes.$1');
    mc = mc.replace(/\b(_oa\d+_\w+)\b/g, 'st.$1');
    mc = mc.replace(/\b(_dyn_(?:buf|text)_\d+)\b/g, 'st.$1');
    mc = mc.replace(/\b(_eval_buf_\d+)\b/g, 'st.$1');
    F['maps.zig'] = mc;
  }

  // ── app.zig: all cross-module refs ──
  if (F['app.zig']) {
    var ac = F['app.zig'];
    ac = prefixArrRefs(ac, 'nodes.');
    ac = ac.replace(/\b(_root)\b/g, 'nodes.$1');
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

  return F;
}

_emitAtoms[44] = {
  id: 44,
  name: 'split_namespace_prefixing',
  group: 'split_finalize',
  target: 'split',
  status: 'complete',
  currentOwner: 'emit_split.js',
  applies: _a044_applies,
  emit: _a044_emit,
};
