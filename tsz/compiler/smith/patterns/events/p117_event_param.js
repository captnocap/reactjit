(function() {
// ── Pattern 117: Event parameter ────────────────────────────────
// Index: 117
// Group: events
// Status: complete
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

function compile(c, ctx) {
  // Event parameter handlers are attribute-context patterns, not child-context.
  // They are dispatched by tryParseElementHandlerAttr() in attrs_handlers.js
  // during element attribute parsing.
  //
  // For TextInput onChange/onSubmit: parseTextInputHandlerAttr captures the
  // full arrow function body as JS and stores it in _inputChangeHandlers or
  // _inputSubmitHandlers. The event param (e) is available in the JS context,
  // with e.target.value rewritten to getInputText(N) by the soup lane.
  //
  // For Pressable/Box onPress: parseElementPressAttr captures the handler
  // body. The event param is parsed but not forwarded — native handlers
  // don't construct DOM-style event objects.
  //
  // This pattern's compile() cannot self-contain because handler registration
  // requires element context (tag name, handler index, input ID). The actual
  // work happens in attrs_handlers.js dispatch during parseJSXElement.
  //
  // Returning null signals that the caller's attribute parsing path handles it.
  return null;
}

_patterns[117] = { id: 117, match: match, compile: compile };

})();
