(function() {
// ── Pattern 053: Callback with args ─────────────────────────────
// Index: 53
// Group: props
// Status: complete
//
// Matches: onPress={() => doThing(id)} or onPress={function(e) { ... }}
//          cursor at { with arrow function or function keyword inside
// Compile: registers inline press handler, returns handler name
//
// React:   <Button onClick={() => setCount(count + 1)} />
//          <Item onPress={(e) => handlePress(e, item.id)} />
// Zig:     propValues["onPress"] = "_handler_press_N"
//
// Mirrors tryParseComponentHandlerProp() for inline arrow/function handlers.

function match(c, ctx) {
  if (c.kind() !== TK.lbrace) return false;
  var next = c.pos + 1;
  if (next >= c.count) return false;
  var nk = c.kindAt(next);
  // Arrow: {(params) => ...} or {() => ...}
  if (nk === TK.lparen) {
    // Look ahead for => after the parens
    var look = next + 1;
    var pd = 1;
    while (look < c.count && pd > 0) {
      if (c.kindAt(look) === TK.lparen) pd++;
      if (c.kindAt(look) === TK.rparen) pd--;
      look++;
    }
    return look < c.count && c.kindAt(look) === TK.arrow;
  }
  // function keyword: {function(params) { ... }}
  if (nk === TK.identifier && c.textAt(next) === 'function') return true;
  return false;
}

function compile(c, ctx, attr) {
  c.advance(); // skip {

  // Skip 'function' keyword so pushInlinePressHandler sees (params)
  if (c.kind() === TK.identifier && c.text() === 'function') c.advance();

  var handlerName = '_handler_press_' + ctx.handlerCount;

  if (typeof pushInlinePressHandler === 'function') {
    pushInlinePressHandler(c, handlerName);
    ctx.handlerCount++;
  } else {
    // Fallback: skip to closing brace
    var depth = 0;
    while (c.kind() !== TK.eof) {
      if (c.kind() === TK.lbrace) depth++;
      if (c.kind() === TK.rbrace) {
        if (depth === 0) break;
        depth--;
      }
      c.advance();
    }
  }

  if (c.kind() === TK.rbrace) c.advance();
  return handlerName;
}

_patterns[53] = { id: 53, group: 'props', name: 'callback_with_args', match: match, compile: compile };

})();
