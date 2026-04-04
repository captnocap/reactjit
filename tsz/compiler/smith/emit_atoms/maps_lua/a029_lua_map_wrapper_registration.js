// ── Emit Atom 029: Lua map wrapper registration ────────────────
// Index: 29
// Group: maps_lua
// Target: zig
// Status: complete
// Current owner: emit/entrypoints.js
//
// Trigger: ctx._luaMapRebuilders.length > 0.
// Output target: luajit_runtime.setMapWrapper() pointer registration
//                inside _appInit().
//
// Scans ctx.arrayDecls for __lmwN tags to find the wrapper node
// for each Lua map rebuilder, then emits a setMapWrapper call
// with a pointer to that node element.

function _a029_applies(ctx) {
  return ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0;
}

function _a029_emit(ctx) {
  var out = '';
  for (var lmi = 0; lmi < ctx._luaMapRebuilders.length; lmi++) {
    // Scan arrayDecls to find the wrapper node by __lmw tag
    for (var ai = 0; ai < ctx.arrayDecls.length; ai++) {
      var decl = ctx.arrayDecls[ai];
      var tag = '__lmw' + lmi;
      var tagIdx = decl.indexOf(tag);
      if (tagIdx >= 0) {
        var arrMatch = decl.match(/^(?:pub )?var (_arr_\d+)/);
        if (arrMatch) {
          // Count which element in the array contains the tag
          var before = decl.substring(0, tagIdx);
          var elemIdx = (before.match(/\.{/g) || []).length - 1;
          out += `    luajit_runtime.setMapWrapper(${lmi}, @ptrCast(&nodes.${arrMatch[1]}[${elemIdx}]));\n`;
        }
        break;
      }
    }
  }
  return out;
}

_emitAtoms[29] = {
  id: 29,
  name: 'lua_map_wrapper_registration',
  group: 'maps_lua',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/entrypoints.js',
  applies: _a029_applies,
  emit: _a029_emit,
};
