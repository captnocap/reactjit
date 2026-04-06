// ── Map pool declarations + rebuilds ──
// All dynamic map content goes to Lua. Zig pools only hold
// wrapper node placeholders for LuaJIT to stamp into.

function emitMapPoolDeclarations(ctx, promotedToPerItem) {
  var out = '';
  var mapMeta = {};
  var mapOrder = [];

  if (!ctx.maps || ctx.maps.length === 0) {
    return { out: out, mapMeta: mapMeta, mapOrder: mapOrder };
  }

  for (var mi = 0; mi < ctx.maps.length; mi++) {
    var m = ctx.maps[mi];
    if (m.isNested || m.isInline) continue;
    mapOrder.push(mi);
    mapMeta[mi] = { mapIdx: mi, isNested: false, isInline: false };
  }

  return { out: out, mapMeta: mapMeta, mapOrder: mapOrder };
}

function emitMapPoolRebuilds(ctx, opts) {
  // All map rebuilds happen in Lua via __rebuildLuaMapN()
  return '';
}

function appendOrphanedMapArrays(out, ctx) {
  // Emit any array decls that weren't attached to a parent during parse
  if (ctx._orphanedArrayDecls) {
    for (var i = 0; i < ctx._orphanedArrayDecls.length; i++) {
      out += ctx._orphanedArrayDecls[i] + '\n';
    }
  }
  return out;
}
