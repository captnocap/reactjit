// ── Lua map text emit ───────────────────────────────────────────
// Thin dispatcher for text content → Lua string expression.
// Consumes normalized contract from pattern phase; delegates to
// specialized emit helpers for each text category.
//
// Architecture:
//   - patterns/*        : Syntax recognition only (template literals, ternaries, etc.)
//   - contract          : Normalized semantic data (passed as `text` param here)
//   - emit_atoms/*      : This file + helpers — final Lua assembly only
//
// Dependencies:
//   - lua_map_subs.js   : _jsExprToLua (sole source of JS→Lua translations)
//   - lua_text_plain.js : Plain string emit
//   - lua_text_template.js : Template literal with ${expr} interpolation
//   - lua_text_ternary.js : Ternary expression emit
//   - lua_text_eval.js  : __eval fallback for complex JS expressions

function _textToLua(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  if (!text) return '""';

  // Contract: { field: "name" } → map item field reference
  if (typeof text === 'object' && text.field) {
    return _luaTextFieldRef(text.field);
  }

  // Contract: { stateVar: "expr" } → state variable expression
  if (typeof text === 'object' && text.stateVar) {
    return _luaTextStateVar(text.stateVar, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  }

  // Contract: { luaExpr: "..." } → pre-translated Lua expression
  if (typeof text === 'object' && text.luaExpr) {
    return _luaTextLuaExpr(text.luaExpr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  }

  // Contract: { parts: [...] } → template literal parts array
  if (typeof text === 'object' && text.parts) {
    return _luaTextTemplateParts(text.parts, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  }

  // String input: dispatch by pattern category
  if (typeof text === 'string') {
    return _luaTextString(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  }

  // Fallback: coerce to string
  return luaStringLiteral(text);
}

// Dispatch string text by detected pattern
function _luaTextString(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  // Category: Template literal with ${...} interpolation
  if (text.indexOf('${') >= 0) {
    return _luaTextTemplateString(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  }

  // Category: Ternary expression (cond ? a : b)
  if (text.indexOf('?') >= 0 && text.indexOf(':') >= 0) {
    var ternaryResult = _luaTextTernaryString(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    if (ternaryResult) return ternaryResult;
  }

  // Category: Label/value pattern "label: expr"
  if (/^\w+:\s+/.test(text) && (text.indexOf('_item') >= 0 || text.indexOf('[') >= 0 || text.indexOf('.') >= 0)) {
    return _luaTextLabelValue(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  }

  // Category: Expression followed by literal suffix (e.g. "field:")
  if (/[\].\w]\:$/.test(text)) {
    return _luaTextSuffixExpr(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  }

  // Category: Plain string (no dynamic refs)
  if (text.indexOf(itemParam) < 0 && (!indexParam || text.indexOf(indexParam) < 0)) {
    return _luaTextPlain(text);
  }

  // Category: Expression with dynamic refs
  return _luaTextDynamicExpr(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
}
