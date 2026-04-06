// ── Atom 26: emit_state_setters.js ──────────────────────────────
// State getter/setter emission for JS_LOGIC and LUA_LOGIC.
// One function: emitStateSetters(ctx, target) where target is 'lua' or 'js'.
//
// Source: logic_blocks.js lines 50-61 (JS non-script state), 100-109 (JS scriptContent state),
//   127-141 (JS scriptBlock state), 213-221 (JS delegated state), 286-302 (Lua state).
//
// Emits var declarations and setter functions for state slots.
// JS: `var X = init; function setX(v) { X = v; __setState(idx, v); }`
// Lua: `X = init` + `function setX(v) X = v; __setState(idx, v) end`

function emitStateSetters(ctx, target) {
  var lines = [];
  if (target === 'js') {
    for (var si = 0; si < ctx.stateSlots.length; si++) {
      var s = ctx.stateSlots[si];
      var init = s.type === 'string' ? "'" + s.initial + "'" : s.initial;
      lines.push('var ' + s.getter + ' = ' + init + ';');
      var jsSetter = s.type === 'string' ? '__setStateString' : '__setState';
      lines.push('function ' + s.setter + '(v) { ' + s.getter + ' = v; ' + jsSetter + '(' + si + ', v); }');
      // Opaque alias (e.g., state.X → X with a forwarding setter)
      if (s._opaqueFor && s._opaqueSetter) {
        lines.push('var ' + s._opaqueFor + ' = ' + init + ';');
        lines.push('function ' + s._opaqueSetter + '(v) { ' + s._opaqueFor + ' = v; ' + s.setter + '(v); }');
      }
    }
  } else if (target === 'lua') {
    lines.push('-- State variables (mirroring Zig state slots)');
    for (var si = 0; si < ctx.stateSlots.length; si++) {
      var s = ctx.stateSlots[si];
      var luaInit = s.type === 'string' ? "'" + s.initial + "'"
        : (s.type === 'boolean' ? (s.initial ? 'true' : 'false') : s.initial);
      lines.push(s.getter + ' = ' + luaInit);
    }
    lines.push('');
    // Setter functions: update local + push to Zig state slot
    for (var si = 0; si < ctx.stateSlots.length; si++) {
      var s = ctx.stateSlots[si];
      if (s.type === 'string') {
        lines.push('function ' + s.setter + '(v) ' + s.getter + ' = v; __setStateString(' + si + ', v) end');
      } else {
        lines.push('function ' + s.setter + '(v) ' + s.getter + ' = v; __setState(' + si + ', v) end');
      }
    }
    lines.push('');
  }
  return lines;
}
