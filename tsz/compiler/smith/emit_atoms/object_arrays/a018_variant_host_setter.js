// ── Emit Atom 018: Variant host setter ──────────────────────────
// Index: 18
// Group: object_arrays
// Target: zig
// Status: complete
// Current owner: emit/object_arrays.js
//
// Trigger: ctx.variantBindings has entries.
// Output target: _setVariantHost() QJS callback for runtime theme variants.

function _a018_applies(ctx, meta) {
  void meta;
  return ctx.variantBindings && ctx.variantBindings.length > 0;
}

function _a018_emit(ctx, meta) {
  void ctx;
  var out = '';
  out += 'fn _setVariantHost(_: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {\n';
  out += '    if (argc >= 1) {\n';
  out += '        var v: i64 = 0;\n';
  out += '        _ = qjs.JS_ToInt64(null, &v, argv[0]);\n';
  if (meta.fastBuild) {
    out += '        @import("' + meta.prefix + 'api.zig").theme.rjit_theme_set_variant(@intCast(@max(0, v)));\n';
  } else {
    out += '        @import("' + meta.prefix + 'theme.zig").setVariant(@intCast(@max(0, v)));\n';
  }
  out += '    }\n';
  out += '    return QJS_UNDEFINED;\n';
  out += '}\n\n';
  return out;
}

_emitAtoms[18] = {
  id: 18,
  name: 'variant_host_setter',
  group: 'object_arrays',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/object_arrays.js',
  applies: _a018_applies,
  emit: _a018_emit,
};
