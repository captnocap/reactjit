(function() {
// ── Pattern 009: Variable interpolation in JSX ─────────────────
// Index: 9
// Group: primitives
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Text>{username}</Text>
//   <Text>{count}</Text>
//
// Mixed syntax (hybrid):
//   <Text>{username}</Text>
//   // Mixed: same as soup for this pattern
//
// Zig output target (state slot — string):
//   .{ .text = "" }
//   // + dynamic text buffer: fmt="{s}", args=state.getSlotString(N)
//
// Zig output target (state slot — int):
//   .{ .text = "" }
//   // + dynamic text buffer: fmt="{d}", args=state.getSlot(N)
//
// Zig output target (prop passthrough):
//   .{ .text = "" }
//   // + dynamic text buffer with resolved prop value
//
// Notes:
//   A bare identifier inside braces in JSX text position. The compiler
//   resolves the identifier through this priority chain:
//     1. State slot getter → slotGet() → dynamic text buffer
//     2. Prop from propStack → inlined value or dynamic text
//     3. Render local → stored compiled result
//     4. Map item param → OA field access
//     5. Component children reference
//     6. Unknown → dropped expression warning
//
//   The existing compiler handles this in parse/children/brace.js
//   starting around line 525. The variable's type determines the
//   format specifier ({s} for strings, {d} for ints, {d:.2} for floats).

function match(c, ctx) {
  // Single identifier followed by } (bare variable reference)
  if (c.kind() !== TK.identifier) return false;
  var text = c.text();
  // Exclude swallowed values — those are handled by p003/p004/p005
  if (text === 'true' || text === 'false' || text === 'null' || text === 'undefined') return false;
  var saved = c.save();
  c.advance();
  // Bare variable: just identifier then }
  var isMatch = c.kind() === TK.rbrace;
  c.restore(saved);
  return isMatch;
}

function compile(c, ctx) {
  var name = c.text();
  c.advance(); // consume identifier

  // Check: is it a state slot?
  var slotIdx = findSlot(name);
  if (slotIdx >= 0) {
    var slot = ctx.stateSlots[slotIdx];
    var fmt = slot.type === 'string' ? '{s}' : slot.type === 'float' ? '{d:.2}' : '{d}';
    var bufSize = slot.type === 'string' ? 128 : 64;
    var args = slotGet(name);
    var bufId = ctx.dynCount;
    ctx.dynTexts.push({ bufId: bufId, fmtString: fmt, fmtArgs: args, arrName: '', arrIndex: 0, bufSize: bufSize });
    ctx.dynCount++;
    if (c.kind() === TK.rbrace) c.advance();
    return { nodeExpr: '.{ .text = "" }', dynBufId: bufId };
  }

  // Check: is it a prop?
  if (ctx.propStack && ctx.propStack[name] !== undefined) {
    var pv = ctx.propStack[name];
    if (typeof pv === 'string' && (pv.includes('state.get') || pv.includes('getSlot'))) {
      var isStr = pv.includes('getSlotString') || pv.includes('..');
      var pfmt = isStr ? '{s}' : '{d}';
      var pbufSize = isStr ? 128 : 64;
      var pbufId = ctx.dynCount;
      ctx.dynTexts.push({ bufId: pbufId, fmtString: pfmt, fmtArgs: pv, arrName: '', arrIndex: 0, bufSize: pbufSize });
      ctx.dynCount++;
      if (c.kind() === TK.rbrace) c.advance();
      return { nodeExpr: '.{ .text = "" }', dynBufId: pbufId };
    }
    // Static prop value — inline as text
    if (c.kind() === TK.rbrace) c.advance();
    return { nodeExpr: '.{ .text = "' + String(pv).replace(/"/g, '\\"') + '" }' };
  }

  // Check: render local
  if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
    var rlVal = ctx.renderLocals[name];
    if (c.kind() === TK.rbrace) c.advance();
    if (rlVal && typeof rlVal === 'object' && rlVal.__jsxSlot) {
      return rlVal.result;
    }
    return { nodeExpr: '.{ .text = "' + String(rlVal).replace(/"/g, '\\"') + '" }' };
  }

  // Check: component children
  if (name === 'children' && ctx.componentChildren) {
    if (c.kind() === TK.rbrace) c.advance();
    // Return children array — caller handles multi-child case
    return { children: ctx.componentChildren };
  }

  // Fallback — unknown variable, emit empty text placeholder
  ctx._droppedExpressions.push({ expr: name, line: 0 });
  if (c.kind() === TK.rbrace) c.advance();
  return { nodeExpr: '.{ .text = "" }' };
}

_patterns[9] = { id: 9, match: match, compile: compile };

})();
