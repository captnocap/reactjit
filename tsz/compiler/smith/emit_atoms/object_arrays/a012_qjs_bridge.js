// ── Emit Atom 012: QJS bridge ───────────────────────────────────
// Index: 12
// Group: object_arrays
// Target: zig
// Status: complete
// Current owner: emit/object_arrays.js
//
// Trigger: ctx.objectArrays.length > 0
// Output target: qjs import shims and QJS_UNDEFINED sentinel.

function _a012_applies(ctx, meta) {
  void meta;
  return ctx.objectArrays && ctx.objectArrays.length > 0;
}

function _a012_emit(ctx, meta) {
  void ctx;
  var out = '';
  if (meta.fastBuild) {
    out += 'const qjs = @cImport({ @cDefine("_GNU_SOURCE", "1"); @cDefine("QUICKJS_NG_BUILD", "1"); @cInclude("quickjs.h"); });\n';
  } else {
    out += 'const qjs = if (IS_LIB) struct {\n';
    out += '    pub const JSValue = extern struct { tag: i64 = 3, u: extern union { int32: i32, float64: f64, ptr: ?*anyopaque } = .{ .int32 = 0 } };\n';
    out += '    pub const JSContext = opaque {};\n';
    out += '    pub fn JS_GetPropertyStr(_: ?*const @This().JSContext, _: @This().JSValue, _: [*:0]const u8) @This().JSValue { return .{}; }\n';
    out += '    pub fn JS_GetPropertyUint32(_: ?*const @This().JSContext, _: @This().JSValue, _: u32) @This().JSValue { return .{}; }\n';
    out += '    pub fn JS_ToInt32(_: ?*const @This().JSContext, _: *i32, _: @This().JSValue) i32 { return 0; }\n';
    out += '    pub fn JS_ToInt64(_: ?*const @This().JSContext, _: *i64, _: @This().JSValue) i32 { return 0; }\n';
    out += '    pub fn JS_ToFloat64(_: ?*const @This().JSContext, _: *f64, _: @This().JSValue) i32 { return 0; }\n';
    out += '    pub fn JS_FreeValue(_: ?*const @This().JSContext, _: @This().JSValue) void {}\n';
    out += '    pub fn JS_ToCString(_: ?*const @This().JSContext, _: @This().JSValue) ?[*:0]const u8 { return null; }\n';
    out += '    pub fn JS_FreeCString(_: ?*const @This().JSContext, _: ?[*:0]const u8) void {}\n';
    out += '    pub fn JS_NewFloat64(_: ?*const @This().JSContext, _: f64) @This().JSValue { return .{}; }\n';
    out += '} else @cImport({ @cDefine("_GNU_SOURCE", "1"); @cDefine("QUICKJS_NG_BUILD", "1"); @cInclude("quickjs.h"); });\n';
  }
  out += 'const QJS_UNDEFINED = qjs.JSValue{ .u = .{ .int32 = 0 }, .tag = 3 };\n\n';
  return out;
}

_emitAtoms[12] = {
  id: 12,
  name: 'qjs_bridge',
  group: 'object_arrays',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/object_arrays.js',
  applies: _a012_applies,
  emit: _a012_emit,
};
