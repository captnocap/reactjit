(function() {
// ── Pattern 115: Inline arrow handler ───────────────────────────
// Index: 115
// Group: events
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Pressable onPress={() => setCount(count + 1)}>
//   <Pressable onPress={() => { setMode(1); reset() }}>
//
// Mixed syntax (hybrid):
//   <Pressable onPress={() => setCount(count + 1)}>
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Handler registered as a named function:
//   //   fn _handler_press_0() void {
//   //       qjs_runtime.callGlobal("setCount");  // simple setter
//   //   }
//   //   // or for expressions with args:
//   //   fn _handler_press_0() void {
//   //       qjs_runtime.evalExpr("setCount(count + 1)");
//   //   }
//   //
//   // Node references handler:
//   //   .{ .style = ..., .cb_press = _handler_press_0 }
//
// Notes:
//   The most common event handler pattern. The compiler:
//   1. Detects onPress/onTap/onToggle/onSelect/onChange attr names
//      (attrs_handlers.js → tryParseElementHandlerAttr)
//   2. Opens the {  } value expression
//   3. Calls bindPressHandlerExpression → pushInlinePressHandler
//   4. pushInlinePressHandler calls BOTH:
//      - parseHandler(c) → Zig body (setter calls → qjs_runtime.*)
//      - luaParseHandler(c) → Lua body (for JS-side handler wrapper)
//   5. Handler registered in ctx.handlers with name, body, luaBody
//   6. Emit phase (emit/handlers.js) writes the fn _handler_press_N
//
//   Setter calls in handler bodies are delegated to JS (qjs_runtime)
//   to keep the JS variable and Zig slot in sync. Direct Zig slot writes
//   would desync from JS state. Three compilation paths:
//     - No args: qjs_runtime.callGlobal("setter")
//     - String arg: qjs_runtime.callGlobalStr("setter", "value")
//     - Integer arg: qjs_runtime.callGlobalInt("setter", N)
//     - Complex expr: qjs_runtime.evalExpr("setter(expr)")
//
//   Script functions (<script> block) follow the same paths.
//   Block bodies ({ stmt; stmt; }) compile each statement independently.
//   Full implementation: parse/handlers/press.js, attrs.js → parseHandler()

function match(c, ctx) {
  // Inside an attribute value after onPress/onTap/etc.
  // Look for arrow function: () => or (params) =>
  var saved = c.save();
  if (c.kind() === TK.lbrace) c.advance();
  // Check for ( ... ) =>
  if (c.kind() === TK.lparen) {
    var depth = 1;
    c.advance();
    while (depth > 0 && c.kind() !== TK.eof) {
      if (c.kind() === TK.lparen) depth++;
      if (c.kind() === TK.rparen) depth--;
      if (depth > 0) c.advance();
    }
    if (c.kind() === TK.rparen) c.advance();
    var isArrow = c.kind() === TK.arrow;
    c.restore(saved);
    return isArrow;
  }
  c.restore(saved);
  return false;
}

function compile(c, children, ctx) {
  // Delegates to bindPressHandlerExpression which detects arrow syntax,
  // calls pushInlinePressHandler, and returns the handler reference name.
  // The handler ref is attached to the node via .cb_press field.
  var handlerRef = '_handler_press_' + ctx.handlerCount;
  var result = bindPressHandlerExpression(c, handlerRef);
  if (result === handlerRef) ctx.handlerCount++;
  return { handlerRef: result };
}

_patterns[115] = { id: 115, match: match, compile: compile };

})();
