(function() {
// ── Pattern 118: preventDefault ─────────────────────────────────
// Index: 118
// Group: events
// Status: complete
//
// Soup syntax (copy-paste React):
//   <form onSubmit={(e) => { e.preventDefault(); submitForm() }}>
//   <a onClick={(e) => { e.preventDefault(); navigate(href) }}>
//
// Mixed syntax (hybrid):
//   // Not directly applicable — native UI has no default browser behavior
//   // to prevent. The pattern is accepted but preventDefault() is a no-op.
//
// Zig output target:
//   // preventDefault() has no Zig equivalent — native elements don't have
//   // default behaviors (no form submission, no link navigation).
//   // The REST of the handler body compiles normally:
//   //   fn _handler_press_0() void {
//   //       qjs_runtime.callGlobal("submitForm");
//   //   }
//   // e.preventDefault() is stripped or ignored during handler parsing.
//
// Notes:
//   preventDefault() is a DOM concept — it cancels the browser's default
//   action for an event (form submission, link navigation, etc.).
//   In the native framework:
//     - There are no default behaviors to prevent
//     - Form elements don't auto-submit
//     - Links don't auto-navigate
//     - Text selection doesn't have browser defaults
//   When encountered in a handler body:
//     - For TextInput onSubmit: parseTextInputHandlerAttr captures the
//       full body as JS. The e.preventDefault() call is harmless.
//     - For other elements: parseHandler processes statements sequentially.
//       e.preventDefault() would be treated as an unknown expression and
//       either skipped or passed to qjs_runtime.evalExpr.
//   The pattern is "partial" because: it compiles without error but
//   the preventDefault call has no effect. The rest of the handler
//   works correctly. Users don't need to remove it for porting.

function match(c, ctx) {
  // Look for e.preventDefault() or event.preventDefault() in a handler body.
  var saved = c.save();
  if (c.kind() === TK.lbrace) c.advance();
  if (c.kind() === TK.lparen) {
    c.advance();
    while (c.kind() !== TK.rparen && c.kind() !== TK.eof) c.advance();
    if (c.kind() === TK.rparen) c.advance();
  }
  if (c.kind() === TK.arrow) c.advance();
  if (c.kind() === TK.lbrace) c.advance();
  // Look for identifier.preventDefault
  while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
    if (c.kind() === TK.identifier) {
      c.advance();
      if (c.kind() === TK.dot) {
        c.advance();
        if (c.kind() === TK.identifier && c.text() === 'preventDefault') {
          c.restore(saved);
          return true;
        }
      }
      continue;
    }
    c.advance();
  }
  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  // preventDefault() is a DOM concept with no native equivalent.
  // In this framework there are no default behaviors to prevent:
  //   - No form auto-submission
  //   - No link auto-navigation
  //   - No browser default actions
  //
  // This pattern is handled by the attribute handler dispatch in
  // attrs_handlers.js. When the handler body contains e.preventDefault():
  //
  //   For TextInput onSubmit/onChange: parseTextInputHandlerAttr captures
  //   the full body as JS. The preventDefault() call is harmless in the
  //   QuickJS context — it calls a no-op on the event param.
  //
  //   For Pressable/Box onPress: the handler body is processed by
  //   parseElementPressAttr → bindPressHandlerExpression. The
  //   e.preventDefault() statement is either:
  //     a) Skipped as an unrecognized expression during statement parsing
  //     b) Passed through in the JS eval body where it's harmless
  //
  // The rest of the handler (the actual logic after preventDefault())
  // compiles normally through the standard handler path.
  //
  // Cannot self-contain: requires element attribute context.
  return null;
}

_patterns[118] = { id: 118, match: match, compile: compile };

})();
