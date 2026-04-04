// ── Pattern 116: Bound method reference ─────────────────────────
// Index: 116
// Group: events
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Pressable onPress={handleClick}>
//   <Pressable onPress={toggleMode}>
//
// Mixed syntax (hybrid):
//   <Pressable onPress={handleClick}>
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Handler registered as a named function calling the script function:
//   //   fn _handler_press_0() void {
//   //       qjs_runtime.callGlobal("handleClick");
//   //   }
//   //
//   // Node references handler:
//   //   .{ .style = ..., .cb_press = _handler_press_0 }
//
// Notes:
//   A bare identifier passed as an event handler — no arrow function.
//   The identifier must resolve to a <script> function or a state setter.
//   Detection flow:
//   1. parseElementPressAttr sees identifier without dot-access after it
//   2. Checks isScriptFunc(name) or isSetter(name)
//   3. If valid: pushBarePressHandler → qjs_runtime.callGlobal("name")
//
//   This is simpler than p115 (inline arrow) because there are no args
//   to parse — the function is called with no arguments.
//   If the identifier is NOT a known script function or setter, the
//   handler is skipped (no-op).
//   Full implementation: parse/handlers/press.js → pushBarePressHandler()

function match(c, ctx) {
  // Inside an attribute value after onPress/etc.
  // A bare identifier (not followed by arrow, not a paren group).
  var saved = c.save();
  if (c.kind() === TK.lbrace) c.advance();
  if (c.kind() === TK.identifier) {
    var name = c.text();
    c.advance();
    // Must not be followed by ( — that would be a call expression (different pattern)
    // Must not be followed by => — that would be an arrow function
    var isSimple = c.kind() !== TK.lparen && c.kind() !== TK.arrow;
    c.restore(saved);
    return isSimple && (isScriptFunc(name) || isSetter(name));
  }
  c.restore(saved);
  return false;
}

function compile(c, children, ctx) {
  // Delegates to parseElementPressAttr which detects bare identifier,
  // calls pushBarePressHandler, and returns the handler ref.
  if (c.kind() === TK.lbrace) c.advance();
  var fname = c.text();
  c.advance();
  var handlerRef = '_handler_press_' + ctx.handlerCount;
  pushBarePressHandler(handlerRef, fname);
  ctx.handlerCount++;
  if (c.kind() === TK.rbrace) c.advance();
  return { handlerRef: handlerRef };
}
