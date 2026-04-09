(function() {
// ── Pattern 052: Callback prop ──────────────────────────────────
// Index: 52
// Group: props
// Status: complete
//
// Matches: onPress={handleClick} — cursor at { with single identifier
//          that is an on* handler name reference
// Compile: registers handler, returns handler reference name
//
// React:   <Button onClick={handleClick} />
// Zig:     propValues["onPress"] = "_handler_press_N"
//
// Mirrors tryParseComponentHandlerProp() for simple identifier references.
// The handler is bound via bindPressHandlerExpression.

function match(c, ctx) {
  if (c.kind() !== TK.lbrace) return false;
  var next = c.pos + 1;
  if (next >= c.count) return false;
  if (c.kindAt(next) !== TK.identifier) return false;
  // Simple identifier followed by }
  var afterIdent = next + 1;
  return afterIdent < c.count && c.kindAt(afterIdent) === TK.rbrace;
}

function compile(c, ctx, attr) {
  c.advance(); // skip {

  // If this is an on* handler attr, bind the handler
  if (attr && typeof isPressLikeComponentAttr === 'function' && isPressLikeComponentAttr(attr)) {
    var handlerName = '_handler_press_' + ctx.handlerCount;
    if (typeof bindPressHandlerExpression === 'function') {
      var bound = bindPressHandlerExpression(c, handlerName);
      if (bound === handlerName) ctx.handlerCount++;
      if (c.kind() === TK.rbrace) c.advance();
      return bound;
    }
  }

  // Non-handler: just resolve the identifier
  var ident = c.text();
  c.advance();
  if (c.kind() === TK.rbrace) c.advance();

  // Try resolving against known sources
  if (typeof isGetter === 'function' && isGetter(ident)) return slotGet(ident);
  if (ctx.renderLocals && ctx.renderLocals[ident] !== undefined) return String(ctx.renderLocals[ident]);
  if (ctx.propStack && ctx.propStack[ident] !== undefined) return String(ctx.propStack[ident]);
  return ident;
}

_patterns[52] = { id: 52, group: 'props', name: 'callback_prop', match: match, compile: compile };

})();
