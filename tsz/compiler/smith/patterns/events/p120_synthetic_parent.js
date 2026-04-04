(function() {
// ── Pattern 120: Pass handler to parent ─────────────────────────
// Index: 120
// Group: events
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Pressable onPress={() => props.onSelect(item)}>
//   // or in a component that receives a handler prop:
//   function Card({ onPress }) {
//     return <Pressable onPress={onPress}><Text>Click</Text></Pressable>
//   }
//
// Mixed syntax (hybrid):
//   <Pressable onPress={() => props.onSelect(item)}>
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Case 1: Forwarded handler reference (component prop is handler ref)
//   //   The prop resolves to _handler_press_N from the parent.
//   //   No new handler created — the node directly references the parent's:
//   //   .{ .cb_press = _handler_press_0 }  // same ref as parent passed
//   //
//   // Case 2: Wrapped call (props.onSelect(item))
//   //   A new handler is created that delegates to the prop's handler:
//   //   fn _handler_press_1() void {
//   //       qjs_runtime.evalExpr("props.onSelect(item)");
//   //   }
//
// Notes:
//   When a component receives a handler prop (onPress, onSelect, etc.)
//   and passes it to a child Pressable, the compiler can either:
//
//   A) Forward the reference directly:
//      tryConsumeForwardedPressHandler (press.js line ~77) detects when
//      the attribute value resolves to a _handler_press_N reference via
//      peekPropsAccess. If so, no new handler is created — the child
//      node uses the same handler ref as the parent. Zero overhead.
//
//   B) Wrap in a new handler:
//      If the handler call includes arguments (props.onSelect(item)),
//      a new handler is created via pushInlinePressHandler that calls
//      the parent's function with the specified args.
//
//   The forwarding optimization is important for component composition:
//   deeply nested handler props don't create handler chains — they
//   resolve to the original handler at the top.
//
//   Full implementation:
//   parse/handlers/press.js → tryConsumeForwardedPressHandler()
//   parse/handlers/press.js → bindPressHandlerExpression() (fallback)

function match(c, ctx) {
  // Check if the value resolves to a forwarded handler ref via props.
  var saved = c.save();
  if (c.kind() === TK.lbrace) c.advance();
  // Case A: bare prop name that resolves to handler ref
  if (c.kind() === TK.identifier && ctx.propStack) {
    var pv = ctx.propStack[c.text()];
    if (typeof pv === 'string' && pv.indexOf('_handler_press_') === 0) {
      c.restore(saved);
      return true;
    }
  }
  // Case A: props.onXxx dot-access
  var pa = peekPropsAccess(c);
  if (pa && typeof pa.value === 'string' && pa.value.indexOf('_handler_press_') === 0) {
    c.restore(saved);
    return true;
  }
  // Case B: () => props.onSelect(item) — arrow with props access in body
  // This is detected during compile, not match. Falls through to p115.
  c.restore(saved);
  return false;
}

function compile(c, children, ctx) {
  // tryConsumeForwardedPressHandler checks for direct handler ref forwarding.
  // If found, returns the parent's handler ref directly (no new handler).
  // Otherwise falls through to bindPressHandlerExpression (p115 path).
  if (c.kind() === TK.lbrace) c.advance();
  var forwarded = tryConsumeForwardedPressHandler(c);
  if (forwarded) {
    return { handlerRef: forwarded };
  }
  // Not a direct forward — delegate to inline arrow handler path
  var handlerRef = '_handler_press_' + ctx.handlerCount;
  var result = bindPressHandlerExpression(c, handlerRef);
  if (result === handlerRef) ctx.handlerCount++;
  return { handlerRef: result };
}

_patterns[120] = { id: 120, match: match, compile: compile };

})();
