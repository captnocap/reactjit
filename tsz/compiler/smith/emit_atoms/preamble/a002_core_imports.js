// ── Emit Atom 002: Core imports ─────────────────────────────────
// Index: 2
// Group: preamble
// Target: zig
// Status: complete
// Current owner: emit/preamble.js
//
// Trigger: every emitOutput() call.
// Output target: std/build_options/IS_LIB/layout/Node/Style/Color/core imports.

function _a002_applies(ctx, meta) {
  void ctx;
  return typeof meta.prefix === 'string';
}

function _a002_emit(ctx, meta) {
  void ctx;
  var out = 'const std = @import("std");\n';
  if (meta.fastBuild) {
    out += 'const api = @import("' + meta.prefix + 'api.zig");\n';
    out += 'const layout = api;\n';
    out += 'const Node = api.Node;\nconst Style = api.Style;\nconst Color = api.Color;\n';
  } else {
    out += 'const build_options = @import("build_options");\n';
    out += 'const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;\n\n';
    out += 'const layout = @import("' + meta.prefix + 'layout.zig");\n';
    out += 'const Node = layout.Node;\nconst Style = layout.Style;\nconst Color = layout.Color;\n';
    // Ensure core.zig export symbols (rjit_state_*) are in the link unit for monolithic builds
    out += 'comptime { _ = @import("' + meta.prefix + 'core.zig"); }\n';
  }
  return out;
}

_emitAtoms[2] = {
  id: 2,
  name: 'core_imports',
  group: 'preamble',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/preamble.js',
  applies: _a002_applies,
  emit: _a002_emit,
};
