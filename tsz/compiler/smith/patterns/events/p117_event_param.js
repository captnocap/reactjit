// ── Pattern 117: Event parameter ────────────────────────────────
// Index: 117
// Group: events
// Status: partial
//
// Soup syntax (copy-paste React):
//   <TextInput onChange={(e) => setText(e.target.value)} />
//   <Box onPress={(event) => handleEvent(event)} />
//
// Mixed syntax (hybrid):
//   <TextInput onChange={(e) => setText(e.target.value)} />
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // For TextInput onChange — rewritten to input text handler:
//   //   In _inputChangeHandlers: jsBody = "setText(e.target.value)"
//   //   The framework calls the JS body with the input's current text.
//   //
//   // For generic elements — event param is mostly unused:
//   //   fn _handler_press_0() void {
//   //       qjs_runtime.callGlobal("handleEvent");
//   //   }
//   //   // The event object itself is not forwarded — native events
//   //   // don't have DOM-style event objects.
//
// Notes:
//   React event handlers receive a SyntheticEvent object with properties
//   like target.value, preventDefault(), stopPropagation(), etc.
//   In the native framework, there is no SyntheticEvent:
//     - TextInput: onChange/onChangeText is handled specially by
//       parseTextInputHandlerAttr (attrs_handlers.js line ~85).
//       The handler body is captured as raw JS and executed via QuickJS
//       when the input text changes. e.target.value is rewritten to
//       getInputText(N) by the soup lane (soup.js line ~577).
//     - Other elements: the event param (e, event, etc.) is parsed
//       during luaParseHandler (captured in _closureParams) but the
//       native event system doesn't pass an event object to handlers.
//       The param is essentially ignored.
//   To fully support event params, the framework would need to construct
//   a native event object with relevant properties (position, target, etc.)
//   and pass it through the handler dispatch chain.
//   Full implementation: parse/element/attrs_handlers.js → parseTextInputHandlerAttr()
//   Soup rewrite: soup.js line ~577 (e.target.value → getInputText)

function match(c, ctx) {
  // Arrow function with a named parameter (not empty parens).
  var saved = c.save();
  if (c.kind() === TK.lbrace) c.advance();
  if (c.kind() === TK.lparen) {
    c.advance();
    if (c.kind() === TK.identifier) {
      var paramName = c.text();
      c.advance();
      // Skip optional comma and more params
      while (c.kind() !== TK.rparen && c.kind() !== TK.eof) c.advance();
      if (c.kind() === TK.rparen) c.advance();
      var isArrow = c.kind() === TK.arrow;
      c.restore(saved);
      return isArrow && paramName !== '_';
    }
  }
  c.restore(saved);
  return false;
}

function compile(c, children, ctx) {
  // For TextInput: delegates to parseTextInputHandlerAttr which captures
  // the handler body as JS to be eval'd when input changes.
  // For other elements: delegates to pushInlinePressHandler which
  // captures params via luaParseHandler._closureParams but the event
  // param itself is not forwarded in the native handler dispatch.
  return null; // Handled by attrs_handlers.js dispatch
}
