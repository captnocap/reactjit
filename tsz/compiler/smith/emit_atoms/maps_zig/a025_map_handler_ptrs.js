// ── Emit Atom 025: Map handler ptrs ────────────────���────────────
// Index: 25
// Group: maps_zig
// Target: zig
// Status: complete
// Current owner: emit/map_pools.js
//
// Trigger: maps with event handlers (on_press inside .map()).
// Output target: _map_lua_bufs_N_H and _map_lua_ptrs_N_H arrays,
//   plus _initMapLuaPtrsN_H() functions for simple flat map handlers.
//
// Notes:
//   Each handler in a map gets a per-item buffer for building the
//   Lua callback string ("__mapPress_N_H(idx)"). Flat maps without
//   field refs get a pre-init function. Handlers with field refs
//   build ptrs inline during rebuild (not here).
//   Inline maps get 3D arrays [outer][inner][bufSize]u8.

function applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.handlers.some(function(h) { return h.inMap; });
}

function emit(ctx, meta) {
  var mapOrder = meta._mapOrder;
  if (!mapOrder) return '';

  var out = '';
  for (var oi = 0; oi < mapOrder.length; oi++) {
    var mi = mapOrder[oi];
    var map = ctx.maps[mi];

    var mapHandlers = ctx.handlers.filter(function(handler) {
      return handler.inMap && handler.mapIdx === mi;
    });
    if (mapHandlers.length === 0) {
      if (meta._perMap && meta._perMap[mi]) meta._perMap[mi].mapHandlers = [];
      continue;
    }

    var luaSizeConst = map.isNested ? 'MAX_FLAT_' + mi : 'MAX_MAP_' + mi;
    for (var hi = 0; hi < mapHandlers.length; hi++) {
      var refsMap = map._handlerFieldRefsMap || {};
      var hasFieldRefs = refsMap[hi] && refsMap[hi].length > 0;
      var bufSize = hasFieldRefs ? 128 : 48;
      if (map.isInline) {
        out += 'var _map_lua_bufs_' + mi + '_' + hi + ': [MAX_INLINE_OUTER_' + mi + '][MAX_MAP_' + mi + '][' + bufSize + ']u8 = undefined;\n';
        out += 'var _map_lua_ptrs_' + mi + '_' + hi + ': [MAX_INLINE_OUTER_' + mi + '][MAX_MAP_' + mi + ']?[*:0]const u8 = undefined;\n';
      } else {
        out += 'var _map_lua_bufs_' + mi + '_' + hi + ': [' + luaSizeConst + '][' + bufSize + ']u8 = undefined;\n';
        out += 'var _map_lua_ptrs_' + mi + '_' + hi + ': [' + luaSizeConst + ']?[*:0]const u8 = .{null} ** ' + luaSizeConst + ';\n';
      }
      if (!map.isNested && !map.isInline && !hasFieldRefs) {
        out += 'fn _initMapLuaPtrs' + mi + '_' + hi + '() void {\n';
        out += '    for (0..' + luaSizeConst + ') |_i| {\n';
        out += '        const n = std.fmt.bufPrint(_map_lua_bufs_' + mi + '_' + hi + '[_i][0..' + (bufSize - 1) + '], "__mapPress_' + mi + '_' + hi + '({d})", .{_i}) catch continue;\n';
        out += '        _map_lua_bufs_' + mi + '_' + hi + '[_i][n.len] = 0;\n';
        out += '        _map_lua_ptrs_' + mi + '_' + hi + '[_i] = @ptrCast(_map_lua_bufs_' + mi + '_' + hi + '[_i][0..n.len :0]);\n';
        out += '    }\n';
        out += '}\n';
      }
    }

    // Stash mapHandlers on per-map meta
    if (meta._perMap && meta._perMap[mi]) {
      meta._perMap[mi].mapHandlers = mapHandlers;
    }
  }

  return out;
}

module.exports = {
  id: 25,
  name: 'map_handler_ptrs',
  group: 'maps_zig',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/map_pools.js',
  applies: applies,
  emit: emit,
};
