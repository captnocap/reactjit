// ── Emit Atom 003: Runtime imports ──────────────────────────────
// Index: 3
// Group: preamble
// Target: zig
// Status: complete
// Current owner: emit/preamble.js
//
// Trigger: state, script runtime, LuaJIT maps, or fast-build APIs.
// Output target: state/engine/qjs_runtime/luajit_runtime imports.

function _a003_applies(ctx, meta) {
  void ctx;
  return meta.hasState || meta.hasDynamicOA || meta.hasScriptRuntime || meta.hasLuaMaps || true;
}

function _a003_emit(ctx, meta) {
  void ctx;
  var out = '';
  if (meta.fastBuild) {
    if (meta.hasState || meta.hasDynamicOA) out += 'const state = api.state;\n';
    out += 'const engine = api.engine;\n';
    if (meta.hasScriptRuntime) out += 'const qjs_runtime = api.qjs_runtime;\n';
    if (meta.hasLuaMaps) out += 'const luajit_runtime = api.luajit_runtime;\n';
  } else {
    if (meta.hasState || meta.hasDynamicOA) out += 'const state = @import("' + meta.prefix + 'state.zig");\n';
    out += 'const engine = if (IS_LIB) struct {} else @import("' + meta.prefix + 'engine.zig");\n';
    if (meta.hasScriptRuntime) {
      out += 'const qjs_runtime = if (IS_LIB) struct {\n';
      out += '    pub fn callGlobal(_: []const u8) void {}\n';
      out += '    pub fn callGlobalStr(_: []const u8, _: []const u8) void {}\n';
      out += '    pub fn callGlobalInt(_: []const u8, _: i64) void {}\n';
      out += '    pub fn registerHostFn(_: []const u8, _: ?*const anyopaque, _: u8) void {}\n';
      out += '    pub fn evalExpr(_: []const u8) void {}\n';
      out += '} else @import("' + meta.prefix + 'qjs_runtime.zig");\n';
    }
    if (meta.hasLuaMaps) {
      out += 'const luajit_runtime = if (IS_LIB) struct {\n';
      out += '    pub fn callGlobal(_: [*:0]const u8) void {}\n';
      out += '    pub fn setMapWrapper(_: usize, _: *anyopaque) void {}\n';
      out += '} else @import("' + meta.prefix + 'luajit_runtime.zig");\n';
    }
  }
  out += '\n';
  return out;
}

_emitAtoms[3] = {
  id: 3,
  name: 'runtime_imports',
  group: 'preamble',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/preamble.js',
  applies: _a003_applies,
  emit: _a003_emit,
};
