(function() {
// ── Pattern 052: Callback prop ──────────────────────────────────
// Index: 52
// Group: props
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Button onClick={() => doThing()} />
//   <Modal onClose={() => setVisible(false)} />
//   <Form onSubmit={handleSubmit} />
//
// Mixed syntax (hybrid):
//   <Button onPress={() => doThing()} />
//   <Modal onClose={() => setVisible(false)} />
//
// Zig output target:
//   // Arrow handler becomes a named handler function reference:
//   nodes._arr_0[0] = .{ .on_press = _handler_press_0 };
//   // Handler body compiled separately:
//   fn _handler_press_0() void {
//     // state setter calls, QuickJS eval, etc.
//   }
//   // Bare function reference (no arrow):
//   nodes._arr_0[0] = .{ .on_press = _handler_press_0 };
//
// Notes:
//   Implemented across two files:
//     - parse/element/attrs_handlers.js → tryParseElementHandlerAttr() for native elements
//     - parse/element/component_handlers.js → tryParseComponentHandlerProp() for components
//
//   Detection: any attribute starting with "on" + uppercase letter (onPress, onToggle,
//   onSelectItem, onChange, etc.) is treated as an event handler.
//   See isPressLikeComponentAttr(): attr[0]='o', attr[1]='n', attr[2]='A'-'Z'.
//
//   For native elements (Box, Text, Pressable):
//     - Bare identifier: if isScriptFunc or isSetter → pushBarePressHandler()
//     - Brace expression: bindPressHandlerExpression() → _handler_press_N
//
//   For components:
//     - Brace + arrow function: pushInlinePressHandler() → _handler_press_N
//     - Brace + non-arrow: bindPressHandlerExpression() → _handler_press_N
//
//   Handler body compilation supports:
//     - State setter calls (setCount, setVisible, etc.)
//     - Script function calls (via QuickJS eval)
//     - Multiple statements in handler body
//
//   Partial because:
//     - Only on* pattern detected; arbitrary callback props (e.g., `render`, `compute`)
//       not recognized as callbacks
//     - Handler body limited to setter/script function patterns
//     - No support for async handlers
//     - No event parameter forwarding (see p117_event_param for that)

function match(c, ctx) {
  // Callback prop = on+Uppercase attr name, then either:
  //   - bare identifier (function reference)
  //   - { arrow function }
  //   - { function expression }
  if (c.kind() !== TK.lbrace && c.kind() !== TK.identifier) return false;

  // Check that we're in an attribute position with an on* name
  // (The attr name is resolved by the caller, not by us)
  // This match function checks the VALUE side:
  if (c.kind() === TK.lbrace) {
    var saved = c.save();
    c.advance();
    // Arrow function: (params) => ...
    if (c.kind() === TK.lparen) {
      var la = c.pos, pd = 1; la++;
      while (la < c.count && pd > 0) {
        if (c.kindAt(la) === TK.lparen) pd++;
        if (c.kindAt(la) === TK.rparen) pd--;
        la++;
      }
      if (la < c.count && c.kindAt(la) === TK.arrow) { c.restore(saved); return true; }
    }
    // function keyword
    if (c.kind() === TK.identifier && c.text() === 'function') { c.restore(saved); return true; }
    c.restore(saved);
  }
  // Bare identifier reference: onPress={handleClick}
  if (c.kind() === TK.identifier) return true;
  return false;
}

function compile(c, ctx) {
  // Callback prop: bare identifier ref or { arrow/function expression }
  // Mirrors tryParseComponentHandlerProp() from component_handlers.js.

  // Bare identifier: handleClick → look up as script func or setter
  if (c.kind() === TK.identifier && c.kindAt(c.pos + 1) !== TK.dot) {
    var name = c.text();
    c.advance();
    if (isScriptFunc(name) || isSetter(name)) {
      var handlerName = '_handler_press_' + ctx.handlerCount;
      ctx.handlerCount++;
      return { value: handlerName, handler: true, body: name };
    }
    return { value: name, handler: true };
  }

  // Brace expression: { () => ... } or { function() { ... } }
  if (c.kind() === TK.lbrace) {
    c.advance(); // skip {

    // Collect the handler body tokens as raw text for handler compilation
    var parts = [];
    var bd = 0;
    while (c.kind() !== TK.eof) {
      if (c.kind() === TK.rbrace && bd === 0) break;
      if (c.kind() === TK.lbrace) bd++;
      if (c.kind() === TK.rbrace) bd--;
      parts.push(c.text());
      c.advance();
    }
    if (c.kind() === TK.rbrace) c.advance();

    var handlerName = '_handler_press_' + ctx.handlerCount;
    ctx.handlerCount++;
    return { value: handlerName, handler: true, rawBody: parts.join(' ') };
  }

  return null;
}

_patterns[52] = { id: 52, match: match, compile: compile };

})();
