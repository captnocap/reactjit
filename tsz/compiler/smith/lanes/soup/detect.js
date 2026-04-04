// ── Soup Detection ──────────────────────────────────────────────────────────
// Migrated from soup.js — detection gate for soup-tier sources.

function isSoupSource(source, file) {
  var fname = (file || '').split('/').pop();
  if (/^s\d+a_/.test(fname)) return true;
  if (source.indexOf('import React') >= 0 &&
      /[<](div|span|h[1-6]|p[\s>\/]|button|ul|li|form|input|canvas)/.test(source))
    return true;
  return false;
}
