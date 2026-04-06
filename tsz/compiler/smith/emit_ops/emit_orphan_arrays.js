// ── Atom 29: emit_orphan_arrays.js ──────────────────────────────
// Catches map arrays that didn't get attached to any parent and
// appends their declarations so the Zig build doesn't fail on
// undefined references.
//
// Source: map_pools.js lines 1198-1251 (appendOrphanedMapArrays).
//
// One function: emitOrphanArrays(out, ctx)
// Takes the current output string and ctx, returns modified output
// with any missing _arr_N declarations appended.

function emitOrphanArrays(out, ctx) {
  // Phase 1: find _arr_N names that are referenced (&_arr_N) but not declared (var _arr_N)
  var declared = new Set();
  var declMatches = out.matchAll(/^var (_arr_\d+)/gm);
  for (var match of declMatches) declared.add(match[1]);

  var poolMatches = out.matchAll(/var _map_(_arr_\d+)_\d+/g);
  for (var match of poolMatches) declared.add(match[1]);

  var refMatches = out.matchAll(/&(_arr_\d+)\b/g);
  var missing = new Set();
  for (var match of refMatches) {
    if (!declared.has(match[1])) missing.add(match[1]);
  }

  // Phase 2: find declarations from ctx and append them
  if (missing.size > 0) {
    var allDecls = [].concat(ctx.arrayDecls);
    for (var mi = 0; mi < ctx.maps.length; mi++) {
      var map = ctx.maps[mi];
      if (map.mapArrayDecls) allDecls.push.apply(allDecls, map.mapArrayDecls);
      if (map._mapPerItemDecls) {
        for (var pi = 0; pi < map._mapPerItemDecls.length; pi++) {
          allDecls.push(map._mapPerItemDecls[pi].decl);
        }
      }
    }
    for (var di = 0; di < allDecls.length; di++) {
      var decl = allDecls[di];
      var m = decl.match(/^var (_arr_\d+)/);
      if (m && missing.has(m[1])) {
        out += decl + '\n';
        missing.delete(m[1]);
      }
    }
    // Stub any still-missing arrays
    for (var name of missing) {
      out += 'var ' + name + ' = [_]Node{ .{} }; // orphan stub\n';
    }
  }

  // Phase 3: scan for any remaining unreferenced _arr_N and insert stubs before _root
  var allRefs = [];
  for (var match of out.matchAll(/(?:&|\b)(_arr_\d+)\b/g)) allRefs.push(match[1]);
  var allDeclared = new Set();
  for (var match of out.matchAll(/^var (_arr_\d+)/gm)) allDeclared.add(match[1]);
  var stubs = [];
  for (var ri = 0; ri < allRefs.length; ri++) {
    var ref = allRefs[ri];
    if (!allDeclared.has(ref)) {
      stubs.push('var ' + ref + ' = [_]Node{ .{} };\n');
      allDeclared.add(ref);
    }
  }
  if (stubs.length > 0) {
    var insertPoint = out.indexOf('var _root =');
    if (insertPoint >= 0) {
      out = out.slice(0, insertPoint) + stubs.join('') + out.slice(insertPoint);
    }
  }

  return out;
}
