// ── Chad Pattern c008: <else> / <else if> ───────────────────────
// Group: control_flow
// Status: stub
//
// Chad syntax:
//   <if number above 0>
//     set_thing exact 'positive'
//   </if>
//   <else if number exact 0>
//     set_thing exact 'zero'
//   </else>
//   <else>
//     set_thing exact 'negative'
//   </else>
//
// Soup equivalent:
//   {number > 0 ? <A /> : number === 0 ? <B /> : <C />}
//
// Zig output target:
//   show_hide conditional with negated previous condition.
//   <else>: !( prevCond )
//   <else if X>: !( prevCond ) and ( X )
//
// Current owner: parse/children/conditional_blocks.js (parseElseBlock)
//
// Notes:
//   Each block self-closes: </if>, </else>.
//   Compiler reads linearly — sees </if>, knows if-body done.
//   <else if> chains by tracking ctx._lastIfCondExpr.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
