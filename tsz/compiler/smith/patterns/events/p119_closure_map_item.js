(function() {
// ── Pattern 119: Closure over map item ──────────────────────────
// Index: 119
// Group: events
// Status: complete
//
// Soup syntax (copy-paste React):
//   {items.map(item => (
//     <Pressable onPress={() => select(item.id)}>
//       <Text>{item.name}</Text>
//     </Pressable>
//   ))}
//
// Mixed syntax (hybrid):
//   {items.map(item => (
//     <Pressable onPress={() => select(item.id)}>
//       <Text>{item.name}</Text>
//     </Pressable>
//   ))}
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Handler registered with inMap: true, referencing OA field data:
//   //   fn _handler_press_0() void {
//   //       // Handler body uses item field from OA at current index
//   //       qjs_runtime.evalExpr("select(item.id)");
//   //   }
//   //
//   // Map handler dispatch resolves item.field → OA field access:
//   //   The Lua body captures item.id as the OA field reference.
//   //   At dispatch time, the framework passes _oa0_id[pressed_index]
//   //   to the JS handler function.
//   //
//   // Per-item handler node:
//   //   _map0_pool[_i] = .{ .cb_press = _handler_press_0, ... };
//
// Notes:
//   Inside a .map() callback, event handlers close over the iteration
//   variable (item, index). The compiler handles this by:
//   1. pushInlinePressHandler detects ctx.currentMap is active
//   2. Sets handler.inMap = true, handler.mapIdx = current map index
//   3. luaParseHandler resolves item.field references in the handler body
//   4. The Lua body preserves item.field as-is (Lua-side rebuild provides it)
//   5. collectHandlerZigProps captures any prop values that are Zig-compiled
//   6. ensureMapHandlerFieldRefs (map_pools.js) scans handler bodies for
//      OA field references and tracks which fields are needed
//   7. Emit phase generates per-item handler dispatch that passes the
//      correct OA field values for the pressed item's index
//
//   The index parameter (i) is also available:
//     onPress={() => remove(i)} → handler receives iteration index
//
//   Conformance tests: d53_compound_conditionals.tsz, d17_map_conditional_card.tsz
//   Full implementation: parse/handlers/press.js → pushInlinePressHandler(),
//   emit/map_pools.js → ensureMapHandlerFieldRefs()

function match(c, ctx) {
  // Must be inside a map context AND have an arrow function handler.
  if (!ctx.currentMap) return false;
  var saved = c.save();
  if (c.kind() === TK.lbrace) c.advance();
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
  // Same path as p115 (inline arrow) but ctx.currentMap is active.
  // pushInlinePressHandler automatically tags the handler with
  // inMap: true and mapIdx, enabling the map-aware emit path.
  var handlerRef = '_handler_press_' + ctx.handlerCount;
  var result = bindPressHandlerExpression(c, handlerRef);
  if (result === handlerRef) ctx.handlerCount++;
  return { handlerRef: result };
}

_patterns[119] = { id: 119, match: match, compile: compile };

})();
