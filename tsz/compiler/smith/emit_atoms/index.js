// ── Smith Emit Atom Registry ────────────────────────────────────
//
// Global registry for emit atoms. Each atom file registers itself
// into _emitAtoms[N] when loaded. This file declares the registry
// and provides the runAtoms() entry point.
//
// Individual atom files are loaded via smith_LOAD_ORDER.txt BEFORE
// this file, so _emitAtoms is populated by the time runAtoms() is
// callable.

var _emitAtoms = {};

// Run all applicable emit atoms in order, returning concatenated output.
function runEmitAtoms(ctx, meta) {
  var out = '';
  for (var i = 1; i <= 46; i++) {
    var atom = _emitAtoms[i];
    if (atom && atom.applies(ctx, meta)) {
      out += atom.emit(ctx, meta);
    }
  }
  return out;
}
