// ── Lua text emit: Plain strings ─────────────────────────────────
// Simple literal strings with no dynamic content.
// No semantic reparsing — direct Lua string emission.

function _luaTextPlain(text) {
  return luaStringLiteral(text);
}

function _luaTextFieldRef(fieldName) {
  return 'tostring(_item.' + fieldName + ')';
}
