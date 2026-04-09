// ── Emit Atom 043: Split section extraction ─────────────────────
// Index: 43
// Group: split_finalize
// Target: split
// Status: complete
// Current owner: emit_split.js
//
// Trigger: __splitOutput == 1.
// Output target: monolith-to-section slicing for
//   nodes/handlers/state/maps/logic/app.
//
// Takes the monolithic .zig output from emitOutput() and finds
// section boundaries via regex markers (// ── State manifest,
// // ── Generated node tree, fn _initState, fn _appInit, etc).
// Sorts by position, extracts text between consecutive boundaries,
// then groups sections into six target files:
//   nodes.zig    ← node tree
//   handlers.zig ← event handlers + effect renderers
//   state.zig    ← state manifest + dyn text buffers + OA bridge + initState
//   maps.zig     ← map pools
//   logic.zig    ← JS_LOGIC + LUA_LOGIC
//   app.zig      ← update fns + init/tick + exports + main + debug

function _a043_applies() {
  // Disabled — split is handled by emit/split.js via finalizeEmitOutput().
  // This atom cannot work in runEmitAtoms because it needs the accumulated
  // output string, but receives (ctx, meta) instead.
  return false;
}

function _a043_emit(monolith) {
  // ── Find section boundaries via markers + fn signatures ──
  var B = [];
  var patterns = [
    ['state_manifest', /^\/\/ ── State manifest/m],
    ['nodes',          /^\/\/ ── Generated node tree/m],
    ['dyntxt',         /^\/\/ ── Dynamic text buffers/m],
    ['handlers',       /^\/\/ ── Event handlers/m],
    ['effects',        /^\/\/ ── Effect render functions/m],
    ['oa',             /^const qjs = /m],
    ['maps',           /^\/\/ ── Map pools/m],
    ['jslogic',        /^\/\/ ── Embedded JS logic/m],
    ['lualogic',       /^\/\/ ── Embedded Lua logic/m],
    ['initstate',      /^fn _initState\(/m],
    ['updatedyn',      /^fn _updateDynamicTexts\(/m],
    ['updatecond',     /^fn _updateConditionals\(/m],
    ['updatevariants', /^fn _updateVariants\(/m],
    ['appinit',        /^fn _appInit\(/m],
    ['apptick',        /^fn _appTick\(/m],
    ['exports',        /^export fn app_get_root\(/m],
    ['stateexports',   /^export fn app_state_count\(/m],
    ['mainfn',         /^(?:pub fn main|export fn main_cart)\(/m],
    ['debug',          /^\/\/ ── SMITH DEBUG/m],
  ];
  for (var pi = 0; pi < patterns.length; pi++) {
    var pname = patterns[pi][0], pre = patterns[pi][1];
    var pm = pre.exec(monolith);
    if (pm) B.push({ name: pname, pos: pm.index });
  }
  B.sort(function(a, b) { return a.pos - b.pos; });

  // ── Extract text between consecutive boundaries ──
  var sec = {};
  for (var i = 0; i < B.length; i++) {
    var end = i + 1 < B.length ? B[i + 1].pos : monolith.length;
    sec[B[i].name] = monolith.substring(B[i].pos, end);
  }

  // ── Group sections into target files ──
  var F = {};
  F['nodes.zig']    = sec.nodes || '';
  F['handlers.zig'] = (sec.handlers || '') + (sec.effects || '');
  F['state.zig']    = (sec.state_manifest || '') + (sec.dyntxt || '') +
                      (sec.oa || '') + (sec.initstate || '');
  F['maps.zig']     = sec.maps || '';
  F['logic.zig']    = (sec.jslogic || '') + (sec.lualogic || '');
  F['app.zig']      = (sec.updatedyn || '') + (sec.updatecond || '') +
                      (sec.updatevariants || '') +
                      (sec.appinit || '') + (sec.apptick || '') +
                      (sec.exports || '') + (sec.stateexports || '') +
                      (sec.mainfn || '') + (sec.debug || '');
  return F;
}

_emitAtoms[43] = {
  id: 43,
  name: 'split_section_extraction',
  group: 'split_finalize',
  target: 'split',
  status: 'complete',
  currentOwner: 'emit_split.js',
  applies: _a043_applies,
  emit: _a043_emit,
};
