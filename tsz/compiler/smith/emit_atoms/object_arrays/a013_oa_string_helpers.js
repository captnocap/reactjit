// ── Emit Atom 013: OA string helpers ────────────────────────────
// Index: 13
// Group: object_arrays
// Target: zig
// Status: complete
// Current owner: emit/object_arrays.js
//
// Trigger: ctx.objectArrays.length > 0
// Output target: _oa_alloc, _oaDupString(), _oaFreeString().

function _a013_applies(ctx, meta) {
  void meta;
  return ctx.objectArrays && ctx.objectArrays.length > 0;
}

function _a013_emit(ctx, meta) {
  void ctx; void meta;
  var out = '';
  out += '// ── Object arrays ───────────────────────────────────────────────\n';
  out += 'const _oa_alloc = std.heap.page_allocator;\n\n';
  out += 'fn _oaDupString(src: []const u8) []const u8 {\n';
  out += '    if (src.len == 0) return &[_]u8{};\n';
  out += '    return _oa_alloc.dupe(u8, src) catch &[_]u8{};\n';
  out += '}\n\n';
  out += 'fn _oaFreeString(slot: *[]const u8, len_slot: *usize) void {\n';
  out += '    if (len_slot.* > 0) _oa_alloc.free(@constCast(slot.*));\n';
  out += '    slot.* = &[_]u8{};\n';
  out += '    len_slot.* = 0;\n';
  out += '}\n\n';
  return out;
}

_emitAtoms[13] = {
  id: 13,
  name: 'oa_string_helpers',
  group: 'object_arrays',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/object_arrays.js',
  applies: _a013_applies,
  emit: _a013_emit,
};
