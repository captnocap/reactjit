// ── Chad Pattern c007: <if> conditional block ──────────────────
// Group: control_flow
// Status: stub
//
// Chad syntax:
//   <if count above 0>
//     <C.Hint>Positive</C.Hint>
//   </if>
//
//   <if status exact 'active'>
//     <C.Badge>Active</C.Badge>
//   </if>
//
//   <if count exact or above max>
//     stop
//   </if>
//
//   <if not loading>
//     <C.Content>Ready</C.Content>
//   </if>
//
//   <if active and count above 0>
//     <C.Status>Go</C.Status>
//   </if>
//
//   // Conditional binding:
//   <if db.read('SELECT ...') as rows>
//     <for rows as row> ... </for>
//   </if>
//
// Soup equivalent:
//   {count > 0 && <Text>Positive</Text>}
//   {status === 'active' && <Badge>Active</Badge>}
//
// Zig output target:
//   show_hide conditional: ctx.conditionals entry with condExpr.
//   Numeric: (state.getSlot(N) > 0)
//   String: std.mem.eql(u8, ..., "active")
//   Boolean: state.getSlotBool(N)
//
// Current owner: parse/children/conditional_blocks.js (parseIfBlock, parseBlockCondition)
//
// Notes:
//   Word operators: exact (==), not exact (!=), above (>), below (<),
//   exact or above (>=), exact or below (<=), and, or, not.
//   No sigils — eliminates < ambiguity with block open.
//   `as` binds the result for conditional unwrapping.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
