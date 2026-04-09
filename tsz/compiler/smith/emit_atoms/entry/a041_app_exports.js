// ── Emit Atom 041: App exports ──────────────────────────────────
// Index: 41
// Group: entry
// Target: zig
// Status: complete
// Current owner: emit/entrypoints.js
//
// Trigger: every app emit.
// Output target: app_get_* exports and state ABI exports.

function _a041_applies(ctx, meta) {
  void ctx; void meta;
  return true;
}

function _a041_emit(ctx, meta) {
  var out = '';
  // Direct function pointer exports — _appInit and _appTick are emitted
  // by atoms a039 and a040 respectively.
  out += 'export fn app_get_init() ?*const fn () void { return _appInit; }\n';
  out += 'export fn app_get_tick() ?*const fn (u32) void { return _appTick; }\n';
  out += 'export fn app_get_root() *Node { return &_root; }\n';
  out += 'export fn app_get_lua_logic() [*]const u8 { return LUA_LOGIC.ptr; }\n';
  out += 'export fn app_get_lua_logic_len() usize { return LUA_LOGIC.len; }\n';
  out += 'export fn app_get_js_logic() [*]const u8 { return JS_LOGIC.ptr; }\n';
  out += 'export fn app_get_js_logic_len() usize { return JS_LOGIC.len; }\n';
  out += 'export fn app_get_title() [*]const u8 { return "' + meta.appName + '"; }\n';
  out += 'export fn app_get_title_len() usize { return ' + meta.appName.length + '; }\n\n';

  out += 'export fn app_state_count() usize { return ' + ctx.stateSlots.length + '; }\n';

  if (meta.hasState && !globalThis.__parityMode) {
    var types = ctx.stateSlots.map(function(s) {
      return ({ int: 0, float: 1, boolean: 2, string: 3 }[s.type] || 0);
    });
    out += 'const _slot_types = [_]u8{ ' + types.join(', ') + ' };\n';
    out += 'export fn app_state_slot_type(id: usize) u8 { if (id < _slot_types.len) return _slot_types[id]; return 0; }\n';
    out += 'export fn app_state_get_int(id: usize) i64 { return state.getSlot(id); }\n';
    out += 'export fn app_state_set_int(id: usize, val: i64) void { state.setSlot(id, val); }\n';
    out += 'export fn app_state_get_float(id: usize) f64 { return state.getSlotFloat(id); }\n';
    out += 'export fn app_state_set_float(id: usize, val: f64) void { state.setSlotFloat(id, val); }\n';
    out += 'export fn app_state_get_bool(id: usize) u8 { return if (state.getSlotBool(id)) 1 else 0; }\n';
    out += 'export fn app_state_set_bool(id: usize, val: u8) void { state.setSlotBool(id, val != 0); }\n';
    out += 'export fn app_state_get_string_ptr(id: usize) [*]const u8 { return state.getSlotString(id).ptr; }\n';
    out += 'export fn app_state_get_string_len(id: usize) usize { return state.getSlotString(id).len; }\n';
    out += 'export fn app_state_set_string(id: usize, ptr: [*]const u8, len: usize) void { state.setSlotString(id, ptr[0..len]); }\n';
    out += 'export fn app_state_mark_dirty() void { state.markDirty(); }\n';
  }

  return out;
}

_emitAtoms[41] = {
  id: 41,
  name: 'app_exports',
  group: 'entry',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/entrypoints.js',
  applies: _a041_applies,
  emit: _a041_emit,
};
