// ── Atom 27: emit_oa_bridge.js ──────────────────────────────────
// Object array host function registration (__setObjArrN etc).
// One function: emitOABridge(ctx, target) where target is 'qjs' or 'luajit'.
//
// Source: entrypoints.js lines 7-8 (registerHostFn calls in _appInit).
//
// Emits the runtime registration calls that expose __setObjArrN as callable
// host functions from QuickJS or LuaJIT, bridging JS/Lua OA setters to the
// Zig-side _oaN_unpack functions.
//
// NOTE: LuaJIT registration IS present in the current entrypoints.js (line 8),
// but the Lua-side OA setter functions in logic_blocks.js may not always emit
// the matching __setObjArrN call in LUA_LOGIC. This atom exposes the gap:
// registration happens, but the Lua function body may be missing for some paths.

function emitOABridge(ctx, target) {
  var lines = [];
  for (var i = 0; i < ctx.objectArrays.length; i++) {
    var oa = ctx.objectArrays[i];
    if (oa.isNested || oa.isConst) continue;
    if (target === 'qjs') {
      lines.push('    qjs_runtime.registerHostFn("__setObjArr' + oa.oaIdx + '", @ptrCast(&_oa' + oa.oaIdx + '_unpack), 1);');
    } else if (target === 'luajit') {
      lines.push('    luajit_runtime.registerHostFn("__setObjArr' + oa.oaIdx + '", @ptrCast(&_oa' + oa.oaIdx + '_unpack), 1);');
    }
  }
  return lines;
}
