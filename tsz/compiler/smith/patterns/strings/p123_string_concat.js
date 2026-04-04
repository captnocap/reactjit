// ── Pattern 123: String concatenation ───────────────────────────
// Index: 123
// Group: strings
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Text>{"Hello " + name}</Text>
//   <Text>{firstName + " " + lastName}</Text>
//   <Text>{"Total: " + (count * price)}</Text>
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // String + state getter → dynText with concat format:
//   .{ .text = "" }  // dynText: fmtString="Hello {s}", fmtArgs="state.getSlotString(0)"
//
//   // String + string → static text (could be folded at compile time):
//   .{ .text = "Hello World" }
//
//   // Complex expressions → QuickJS eval:
//   .{ .text = "" }  // dynText: fmtString="{s}", fmtArgs="qjs_runtime.evalToString(...)"
//
// Notes:
//   String concatenation with + is NOT directly handled by Smith as a
//   distinct pattern. When the brace parser encounters {expr}, it tries
//   to resolve the expression. The + operator between strings/variables
//   is treated as a general expression.
//
//   If the expression involves only state getters and literals, the
//   conditional/expression resolution in brace.js can sometimes pick it
//   apart. More often, the entire expression falls through to QuickJS eval:
//   qjs_runtime.evalToString("Hello " + name, &_eval_buf_N)
//
//   This works correctly but is slower than the template literal path
//   (p121) which resolves expressions at compile time to std.fmt.bufPrint.
//
//   Recommendation: rewrite "Hello " + name as `Hello ${name}` — template
//   literals get full compile-time resolution while concat falls to eval.
//
//   Implementation plan for native concat support:
//   1. Detect pattern: string_literal + identifier (or + string_literal)
//   2. Rewrite internally as template literal format string
//   3. Use the same fmtString/fmtArgs machinery as p121

function match(c, ctx) {
  // Detect: "string" + identifier or identifier + "string" in brace context
  // This is hard to detect without consuming tokens — the + could be
  // arithmetic. Would need type inference to distinguish string + from number +.
  if (c.kind() !== TK.string) return false;
  var saved = c.save();
  c.advance();
  var result = c.kind() === TK.plus;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // String concatenation: "str" + expr + "str" + ...
  // Rewrite internally as a template literal format string using the same
  // fmtString/fmtArgs machinery as p121 (template literals).
  var fmt = '';
  var args = [];
  var allStatic = true;
  var staticResult = '';

  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.string) {
      var sv = c.text().slice(1, -1);
      fmt += sv.replace(/"/g, '\\"');
      staticResult += sv;
      c.advance();
    } else if (c.kind() === TK.plus) {
      c.advance(); // skip +
      continue;
    } else if (c.kind() === TK.identifier) {
      var name = c.text();
      allStatic = false;

      if (isGetter(name)) {
        var slotIdx = findSlot(name);
        var slot = slotIdx >= 0 ? ctx.stateSlots[slotIdx] : null;
        if (slot && slot.type === 'string') {
          fmt += '{s}';
          args.push(slotGet(name));
        } else {
          fmt += '{d}';
          args.push(slotGet(name));
        }
        c.advance();
      } else if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
        var rlVal = ctx.renderLocals[name];
        if (isEval(rlVal)) {
          fmt += '{s}';
          args.push(rlVal);
        } else {
          fmt += '{s}';
          args.push('"' + String(rlVal).replace(/"/g, '\\"') + '"');
        }
        c.advance();
      } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
        var pv = ctx.propStack[name];
        var isZig = typeof pv === 'string' && (pv.includes('state.get') || pv.includes('getSlot') || pv.includes('_oa'));
        if (isZig) {
          var isStr = pv.includes('String') || pv.includes('..');
          fmt += isStr ? '{s}' : '{d}';
          args.push(pv);
        } else {
          fmt += String(pv).replace(/"/g, '\\"');
        }
        c.advance();
      } else {
        // Unresolvable identifier — collect rest and route through eval
        var remaining = [name];
        c.advance();
        while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
          remaining.push(c.text());
          c.advance();
        }
        // Reconstruct the full expression for eval
        var fullParts = [];
        if (fmt.length > 0) fullParts.push('"' + fmt + '"');
        fullParts.push(remaining.join(' '));
        if (c.kind() === TK.rbrace) c.advance();
        return { value: buildEval(fullParts.join(' + '), ctx) };
      }
    } else if (c.kind() === TK.number) {
      allStatic = false;
      fmt += '{d}';
      args.push(c.text());
      c.advance();
    } else if (c.kind() === TK.lparen) {
      // Parenthesized sub-expression — collect and route through eval
      allStatic = false;
      var parenParts = [];
      var depth = 0;
      while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
        if (c.kind() === TK.lparen) depth++;
        if (c.kind() === TK.rparen) { depth--; if (depth < 0) break; }
        parenParts.push(c.text());
        c.advance();
      }
      if (c.kind() === TK.rparen) { parenParts.push(')'); c.advance(); }
      fmt += '{s}';
      args.push(buildEval(parenParts.join(' '), ctx));
    } else {
      c.advance();
    }
  }

  if (c.kind() === TK.rbrace) c.advance();

  // If all parts were static string literals, fold at compile time
  if (allStatic) {
    return { value: '"' + staticResult.replace(/"/g, '\\"') + '"' };
  }

  return { fmtString: fmt, fmtArgs: args.join(', ') };
}
