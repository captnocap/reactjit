// ── Pattern 051: Expression prop ────────────────────────────────
// Index: 51
// Group: props
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Counter value={a + b} />
//   <Progress percent={score / total * 100} />
//   <Label text={firstName + " " + lastName} />
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // state getter: propValues["value"] = slotGet("a") + slotGet("b")
//   // → inlined at component call site:
//   nodes._arr_0[0] = .{ .text = state.getSlotString(0) };
//   // render-local arithmetic:
//   const _rl_pct = @divTrunc(score * 100, total);
//   // map item field:
//   _oa0_value[_i]
//   // QuickJS fallback for unresolvable:
//   qjs_runtime.evalToString("String(complexExpr())", &_eval_buf_0)
//
// Notes:
//   Implemented in parse/element/component_brace_values.js → parseComponentBraceValue().
//   Resolution order:
//     1. Script function calls → QuickJS eval (entire expression)
//     2. State getters (isGetter) → slotGet()
//     3. Render-locals (ctx.renderLocals) → pre-resolved Zig expression
//     4. Prop stack (ctx.propStack) → pre-resolved value from parent
//     5. Map item param (ctx.currentMap.itemParam) → OA field reference
//     6. Map index param → @as(i64, @intCast(_i))
//     7. Arithmetic between tokens collected as raw text
//   Template literals inside braces handled by resolveComponentTemplateLiteralValue().
//   Ternary expressions normalized by normalizeComponentTernaryValue().
//   Comparison operators === → == and !== → != automatically.
//   String comparisons detected and rewritten to std.mem.eql().
//   QuickJS eval truthiness: (expr)?'T':'' → .len > 0 for conditionals.
//
//   Partial because:
//     - Complex multi-operator expressions (a + b * c) collected as raw token text,
//       no operator precedence parsing
//     - No parenthesization of sub-expressions
//     - Bitwise operators not handled

function match(c, ctx) {
  // Expression prop = attr name followed by = then { ... }
  // where the brace content is NOT:
  //   - a string literal (p047)
  //   - a number literal (p048)
  //   - a boolean (p050)
  //   - an arrow function (p052)
  //   - a JSX element (p059)
  //   - an object literal (p057)
  //   - an array literal (p058)
  // i.e., it contains operators or function calls
  if (c.kind() !== TK.lbrace) return false;
  var saved = c.save();
  c.advance();
  // Not JSX
  if (c.kind() === TK.lt) { c.restore(saved); return false; }
  // Not object literal (double brace)
  if (c.kind() === TK.lbrace) { c.restore(saved); return false; }
  // Not array literal
  if (c.kind() === TK.lbracket) { c.restore(saved); return false; }
  // Not arrow function
  if (c.kind() === TK.lparen) {
    var la = c.pos, pd = 1; la++;
    while (la < c.count && pd > 0) {
      if (c.kindAt(la) === TK.lparen) pd++;
      if (c.kindAt(la) === TK.rparen) pd--;
      la++;
    }
    if (la < c.count && c.kindAt(la) === TK.arrow) { c.restore(saved); return false; }
  }
  // Must contain at least one operator or function call to be an expression
  var depth = 0;
  var hasOperator = false;
  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rbrace) { if (depth === 0) break; depth--; }
    if (c.kind() === TK.plus || c.kind() === TK.minus || c.kind() === TK.star ||
        c.kind() === TK.slash || c.kind() === TK.mod || c.kind() === TK.question ||
        c.kind() === TK.eq_eq || c.kind() === TK.not_eq ||
        c.kind() === TK.gt || c.kind() === TK.lt ||
        c.kind() === TK.lparen) {
      hasOperator = true;
      break;
    }
    c.advance();
  }
  c.restore(saved);
  return hasOperator;
}

function compile(c, ctx) {
  // Expression prop: { expr } — delegates to parseComponentBraceValue() resolution.
  // Consume opening brace, then resolve tokens using the same priority chain:
  //   script func calls → state getters → render locals → prop stack → map params
  c.advance(); // skip {

  // Script function call: unresolvable identifier followed by (
  if ((ctx.scriptBlock || globalThis.__scriptContent) &&
      c.kind() === TK.identifier && !isGetter(c.text()) &&
      !(ctx.renderLocals && ctx.renderLocals[c.text()] !== undefined) &&
      !(ctx.propStack && ctx.propStack[c.text()] !== undefined) &&
      c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
    var rawParts = [];
    var bd = 0;
    while (c.kind() !== TK.eof) {
      if (c.kind() === TK.rbrace && bd === 0) break;
      if (c.kind() === TK.lbrace) bd++;
      if (c.kind() === TK.rbrace) bd--;
      rawParts.push(c.text());
      c.advance();
    }
    if (c.kind() === TK.rbrace) c.advance();
    var rawExpr = rawParts.join(' ').replace(/\s*\.\s*/g, '.').replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')').replace(/\s*,\s*/g, ', ');
    return { value: buildEval(rawExpr, ctx) };
  }

  // General expression: collect tokens, resolving identifiers along the way
  var val = '';
  var depth = 0;
  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rbrace) {
      if (depth === 0) break;
      depth--;
    }

    if (c.kind() === TK.identifier && isGetter(c.text())) {
      val += slotGet(c.text());
    } else if (c.kind() === TK.identifier && ctx.renderLocals && ctx.renderLocals[c.text()] !== undefined) {
      val += ctx.renderLocals[c.text()];
    } else if (c.kind() === TK.identifier && ctx.propStack && ctx.propStack[c.text()] !== undefined) {
      val += ctx.propStack[c.text()];
    } else if (c.kind() === TK.identifier && ctx.currentMap && c.text() === ctx.currentMap.indexParam) {
      val += '@as(i64, @intCast(' + (ctx.currentMap.iterVar || '_i') + '))';
    } else if (c.kind() === TK.identifier && ctx.currentMap && c.text() === ctx.currentMap.itemParam) {
      // Map item param .field access
      if (c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
        c.advance(); // skip item name
        c.advance(); // skip dot
        var mf = c.text();
        var moa = ctx.currentMap.oa;
        var mfi = moa ? moa.fields.find(function(f) { return f.name === mf; }) : null;
        var miv = ctx.currentMap.iterVar || '_i';
        if (moa && mfi && mfi.type === 'string') {
          val += '_oa' + moa.oaIdx + '_' + mf + '[' + miv + '][0.._oa' + moa.oaIdx + '_' + mf + '_lens[' + miv + ']]';
        } else if (moa) {
          val += '_oa' + moa.oaIdx + '_' + mf + '[' + miv + ']';
        } else {
          val += '0';
        }
      } else {
        val += '@as(i64, @intCast(' + (ctx.currentMap.iterVar || '_i') + '))';
      }
    } else if (c.kind() === TK.eq_eq || c.kind() === TK.not_eq) {
      val += c.text();
      c.advance();
      if (c.kind() === TK.equals) c.advance(); // skip 3rd = of ===
      continue;
    } else {
      val += c.text();
    }
    c.advance();
  }

  if (c.kind() === TK.rbrace) c.advance();
  return { value: val };
}
