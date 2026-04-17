(function() {
// ── Pattern 010: Expression interpolation in JSX ───────────────
// Index: 10
// Group: primitives
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Text>{a + b}</Text>
//   <Text>{items.length}</Text>
//   <Text>{user.name.toUpperCase()}</Text>
//
// Mixed syntax (hybrid):
//   <Text>{a + b}</Text>
//   // Mixed: same as soup for this pattern
//
// Zig output target (state expression):
//   .{ .text = "" }
//   // + dynamic text buffer with computed format args
//
// Zig output target (script runtime):
//   .{ .text = "" }
//   // + JS/Lua eval slot for runtime computation
//
// Notes:
//   Any expression inside braces that isn't a single literal, variable,
//   ternary, map, or logical operator. This is the catch-all for
//   computed values in JSX text position. The compiler tries to:
//     1. Resolve to state slot arithmetic (count + 1 → getSlot + 1)
//     2. Resolve field access (user.name → OA field or prop chain)
//     3. Fall back to QuickJS/Lua eval for complex expressions
//
//   The existing compiler handles this across multiple paths in
//   parse/children/brace.js. When a <script> or <lscript> block exists,
//   expressions route to JS/Lua eval slots. Without script runtime,
//   the compiler attempts static resolution or drops the expression
//   with a warning.
//
//   This pattern is intentionally broad — it matches anything inside
//   braces that the more specific patterns (p002-p005, p009, ternary,
//   map, logical) don't claim first.

function match(c, ctx) {
  // Expression: any brace content that isn't a single token (literal,
  // variable, null/true/false/undefined) or a recognized compound
  // pattern (ternary, map, logical). The caller should try more specific
  // patterns first; this is the fallback.
  if (c.kind() === TK.eof || c.kind() === TK.rbrace) return false;

  // If it's a single identifier + }, that's p003/p004/p005/p009
  if (c.kind() === TK.identifier) {
    var saved = c.save();
    c.advance();
    var singleIdent = c.kind() === TK.rbrace;
    c.restore(saved);
    if (singleIdent) return false;
  }

  // If it's a single number + }, that's p002
  if (c.kind() === TK.number) {
    var saved2 = c.save();
    c.advance();
    var singleNum = c.kind() === TK.rbrace;
    c.restore(saved2);
    if (singleNum) return false;
  }

  // If it's a single string + }, that's a string literal in braces
  if (c.kind() === TK.string) {
    var saved3 = c.save();
    c.advance();
    var singleStr = c.kind() === TK.rbrace;
    c.restore(saved3);
    if (singleStr) return false;
  }

  // Anything else with tokens before } is an expression
  return true;
}

function compile(c, children, ctx) {
  // Collect all tokens until matching }
  var parts = [];
  var braceDepth = 0;
  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.lbrace) braceDepth++;
    if (c.kind() === TK.rbrace) {
      if (braceDepth === 0) break;
      braceDepth--;
    }
    parts.push(c.text());
    c.advance();
  }
  if (c.kind() === TK.rbrace) c.advance();

  var expr = parts.join(' ');

  // Try to resolve as state slot expression
  // Look for identifiers that are state getters
  var hasStateRef = false;
  var fmtParts = [];
  var fmtArgs = [];
  for (var i = 0; i < parts.length; i++) {
    var slotIdx = findSlot(parts[i]);
    if (slotIdx >= 0) {
      hasStateRef = true;
      var slot = ctx.stateSlots[slotIdx];
      if (slot.type === 'string') {
        fmtParts.push('{s}');
        fmtArgs.push(slotGet(parts[i]));
      } else {
        fmtParts.push('{d}');
        fmtArgs.push(slotGet(parts[i]));
      }
    } else if (parts[i] === '+' || parts[i] === '-' || parts[i] === '*' || parts[i] === '/') {
      // Arithmetic operators pass through to Zig fmt args
      if (fmtArgs.length > 0) {
        fmtArgs[fmtArgs.length - 1] += ' ' + parts[i];
      }
    } else if (/^\d+$/.test(parts[i])) {
      if (fmtArgs.length > 0) {
        fmtArgs[fmtArgs.length - 1] += ' ' + parts[i];
      } else {
        fmtParts.push(parts[i]);
      }
    }
  }

  if (hasStateRef && fmtArgs.length > 0) {
    var bufId = ctx.dynCount;
    var fmt = fmtParts.join('');
    ctx.dynTexts.push({ bufId: bufId, fmtString: fmt, fmtArgs: fmtArgs.join(', '), arrName: '', arrIndex: 0, bufSize: 64 });
    ctx.dynCount++;
    return { nodeExpr: '.{ .text = "" }', dynBufId: bufId };
  }

  // Script runtime fallback — route to QuickJS/Lua eval
  if (ctx.scriptBlock || ctx.luaBlock) {
    var jsSlotIdx = ctx.stateSlots.length;
    ctx.stateSlots.push({ getter: '__jsExpr_' + jsSlotIdx, setter: '__setJsExpr_' + jsSlotIdx, initial: '', type: 'string' });
    var jsBufId = ctx.dynCount;
    ctx.dynTexts.push({ bufId: jsBufId, fmtString: '{s}', fmtArgs: 'state.getSlotString(' + jsSlotIdx + ')', arrName: '', arrIndex: 0, bufSize: 256 });
    ctx.dynCount++;
    if (ctx.scriptBlock) {
      ctx._jsDynTexts.push({ slotIdx: jsSlotIdx, jsExpr: expr });
    } else if (ctx.luaBlock) {
      var luaExpr = expr.replace(/\|\|/g, ' or ').replace(/&&/g, ' and ').replace(/===/g, '==').replace(/!==/g, '~=');
      ctx._luaDynTexts.push({ slotIdx: jsSlotIdx, luaExpr: luaExpr });
    }
    return { nodeExpr: '.{ .text = "" }', dynBufId: jsBufId };
  }

  // No runtime — drop expression with warning
  ctx._droppedExpressions.push({ expr: expr, line: 0 });
  return { nodeExpr: '.{ .text = "" }' };
}

_patterns[10] = { id: 10, match: match, compile: compile };

})();
