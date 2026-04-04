// ── Smith Pattern Registry ───────────────────────────────────────
//
// Global registry for all patterns. Each pattern file wraps itself
// in an IIFE and registers into _patterns[N] when loaded.
// This file declares the registry and must be loaded FIRST.
//
// Pattern dispatch: consumers call tryPatternMatch(c, ctx) to check
// if any registered pattern matches the current cursor position.

var _patterns = {};

// Try all registered patterns against the current cursor.
// Returns the compile() result if a pattern matches, null otherwise.
function tryPatternMatch(c, ctx) {
  for (var key in _patterns) {
    var p = _patterns[key];
    if (p && typeof p.match === 'function') {
      var saved = c.save();
      if (p.match(c, ctx)) {
        c.restore(saved);
        var result = p.compile(c, ctx);
        if (result !== null) return result;
      }
      c.restore(saved);
    }
  }
  return null;
}
