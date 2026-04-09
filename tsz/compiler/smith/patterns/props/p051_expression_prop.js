(function() {
// ── Pattern 051: Expression prop ────────────────────────────────
// Index: 51
// Group: props
// Status: complete
//
// Matches: attr={expr} — cursor at { with arbitrary expression inside
//          (catch-all for brace props that aren't boolean, number, JSX,
//          callback, spread, or object literal)
// Compile: collects tokens between { }, resolves identifiers against
//          state getters, render locals, prop stack, and map params,
//          then returns the resolved expression string.
//
// React:   <Bar width={items.length * 20} />
//          <Label text={`Hello ${name}`} />
//          <Card active={isSelected} />
// Zig:     propValues["width"] = resolved expression
//
// This mirrors parseComponentBraceValue() in component_brace_values.js

function match(c, ctx) {
  if (c.kind() !== TK.lbrace) return false;
  // Exclude patterns handled by more specific matchers:
  // p050 (boolean), p048 (number), p052/p053 (callbacks), p054 (spread), p057 (object), p059 (jsx)
  var next = c.pos + 1;
  if (next >= c.count) return false;
  var nk = c.kindAt(next);
  // Spread: {...x}
  if (nk === TK.spread) return false;
  // JSX slot: {<Element/>}
  if (nk === TK.lt) return false;
  // Object literal: {{ key: val }}
  if (nk === TK.lbrace) return false;
  return true;
}

function compile(c, ctx) {
  c.advance(); // skip {
  var val = '';
  var depth = 0;

  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rbrace) {
      if (depth === 0) break;
      depth--;
    }

    // Resolve state getters
    if (c.kind() === TK.identifier && typeof isGetter === 'function' && isGetter(c.text())) {
      val += slotGet(c.text());
      c.advance();
      continue;
    }

    // Resolve render locals
    if (c.kind() === TK.identifier && ctx.renderLocals && ctx.renderLocals[c.text()] !== undefined) {
      var rlVal = ctx.renderLocals[c.text()];
      val += (typeof rlVal === 'string') ? rlVal : String(rlVal);
      c.advance();
      continue;
    }

    // Resolve prop stack
    if (c.kind() === TK.identifier && ctx.propStack && ctx.propStack[c.text()] !== undefined) {
      var psVal = ctx.propStack[c.text()];
      val += (typeof psVal === 'string') ? psVal : String(psVal);
      c.advance();
      continue;
    }

    // Resolve map index param
    if (c.kind() === TK.identifier && ctx.currentMap && c.text() === ctx.currentMap.indexParam) {
      val += '@as(i64, @intCast(' + (ctx.currentMap.iterVar || '_i') + '))';
      c.advance();
      continue;
    }

    // Resolve map item.field access
    if (c.kind() === TK.identifier && ctx.currentMap && c.text() === ctx.currentMap.itemParam) {
      c.advance();
      if (c.kind() === TK.dot) {
        c.advance();
        if (c.kind() === TK.identifier && ctx.currentMap.oa) {
          var field = c.text();
          var oa = ctx.currentMap.oa;
          var fi = oa.fields ? oa.fields.find(function(f) { return f.name === field; }) : null;
          var iv = ctx.currentMap.iterVar || '_i';
          if (fi && fi.type === 'string') {
            val += '_oa' + oa.oaIdx + '_' + field + '[' + iv + '][0.._oa' + oa.oaIdx + '_' + field + '_lens[' + iv + ']]';
          } else if (oa) {
            val += '_oa' + oa.oaIdx + '_' + field + '[' + iv + ']';
          }
          c.advance();
          continue;
        }
      }
      val += '@as(i64, @intCast(' + (ctx.currentMap.iterVar || '_i') + '))';
      continue;
    }

    // Template literals
    if (c.kind() === TK.template_literal) {
      val += c.text();
      c.advance();
      continue;
    }

    // JS equality → Zig equality
    if (c.kind() === TK.eq_eq || c.kind() === TK.not_eq) {
      val += c.text();
      c.advance();
      if (c.kind() === TK.equals) c.advance(); // skip 3rd = of ===
      continue;
    }

    val += c.text();
    c.advance();
  }

  if (c.kind() === TK.rbrace) c.advance();
  return val;
}

_patterns[51] = { id: 51, group: 'props', name: 'expression_prop', match: match, compile: compile };

})();
