// ── OA inference fallback ─────────────────────────────────────────
// If collectState missed an array, re-scan source to find and register it.

function inferOaFromSource(c, name) {
  const saved = c.save();
  c.pos = 0;
  const setter = 'set' + name[0].toUpperCase() + name.slice(1);

  // Strategy 1: find a literal [{field: value, ...}] initialization
  while (c.pos < c.count) {
    if (c.kind() === TK.identifier && c.text() === name) {
      c.advance();
      // Scan forward (max 20 tokens) looking for [{
      let limit = 20;
      while (limit-- > 0 && c.pos < c.count) {
        if (c.kind() === TK.lbracket) {
          c.advance();
          if (c.kind() === TK.lbrace) {
            c.advance(); // skip {
            const fields = [];
            while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
              if (c.kind() === TK.identifier) {
                const fname = c.text();
                c.advance();
                if (c.kind() === TK.colon) c.advance();
                let ftype = 'int';
                if (c.kind() === TK.string) {
                  ftype = 'string';
                  c.advance();
                } else if (c.kind() === TK.number) {
                  const nv = c.text();
                  ftype = nv.startsWith('0x') ? 'int' : (nv.includes('.') ? 'float' : 'int');
                  c.advance();
                } else if (c.isIdent('true') || c.isIdent('false')) {
                  ftype = 'boolean';
                  c.advance();
                } else if (c.kind() === TK.template_literal) {
                  ftype = 'string';
                  c.advance();
                } else if (c.kind() === TK.identifier && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
                  // Function call — assume string return (most common for display values)
                  ftype = 'string';
                }
                fields.push({ name: fname, type: ftype });
              }
              if (c.kind() === TK.comma) c.advance();
              else if (c.kind() !== TK.rbrace) c.advance();
            }
            if (fields.length > 0) {
              const oaIdx = ctx.objectArrays.length;
              const oa = { fields, getter: name, setter, oaIdx };
              ctx.objectArrays.push(oa);
              c.restore(saved);
              return oa;
            }
          }
          break;
        }
        c.advance();
      }
    }
    c.advance();
  }

  // Strategy 2: infer fields from .map() callback bodies.
  // Scan ALL name.map() calls and merge param.field accesses from all of them.
  // This handles arrays populated at runtime (script/FFI) where no literal exists.
  var allFields = {};
  c.pos = 0;
  while (c.pos < c.count - 4) {
    if (c.kind() === TK.identifier && c.text() === name &&
        c.kindAt(c.pos + 1) === TK.dot) {
      // Skip chained methods: name.slice(...).filter(...).map(
      var chainPos = c.pos + 2;
      while (chainPos + 1 < c.count) {
        var chainMethod = c.kindAt(chainPos) === TK.identifier ? c.textAt(chainPos) : '';
        if (chainMethod === 'map' && c.kindAt(chainPos + 1) === TK.lparen) break;
        // Skip known chain methods: .slice(...), .filter(...), .sort(...), .reverse()
        if ((chainMethod === 'slice' || chainMethod === 'filter' || chainMethod === 'sort' ||
             chainMethod === 'reverse' || chainMethod === 'flat' || chainMethod === 'concat') &&
            c.kindAt(chainPos + 1) === TK.lparen) {
          chainPos += 2; // skip method (
          var cd = 1;
          while (chainPos < c.count && cd > 0) {
            if (c.kindAt(chainPos) === TK.lparen) cd++;
            if (c.kindAt(chainPos) === TK.rparen) cd--;
            chainPos++;
          }
          // After ) expect .next_method
          if (chainPos < c.count && c.kindAt(chainPos) === TK.dot) { chainPos++; continue; }
          break;
        }
        break;
      }
      if (chainPos + 1 >= c.count || c.textAt(chainPos) !== 'map' || c.kindAt(chainPos + 1) !== TK.lparen) {
        c.advance(); continue;
      }
      c.pos = chainPos + 2; // skip map (
      // `.map(function(w, i) => ...)` — skip the `function` keyword + opening `(`
      // so itemParam binds to the actual param name, not the literal text
      // "function" (see d162_inlined_component_prop_fields).
      if (c.isIdent('function')) {
        c.advance();
        if (c.kind() === TK.lparen) c.advance();
      }
      if (c.kind() === TK.lparen) c.advance();
      if (c.kind() !== TK.identifier) { c.advance(); continue; }
      var itemParam = c.text();
      c.advance();
      var bodyStart = -1;
      var scanLimit = 20;
      while (scanLimit-- > 0 && c.pos < c.count) {
        if (c.kind() === TK.arrow) { c.advance(); bodyStart = c.pos; break; }
        c.advance();
      }
      if (bodyStart < 0) continue;
      var mapBodyStart = c.pos;
      var parenDepth = 1;
      var mapBodyEnd = c.pos;
      while (c.pos < c.count && parenDepth > 0) {
        if (c.kind() === TK.lparen) parenDepth++;
        if (c.kind() === TK.rparen) { parenDepth--; if (parenDepth === 0) { mapBodyEnd = c.pos; break; } }
        c.advance();
      }
      // Collect all itemParam.field from this callback body.
      // Two sources: (1) token-level identifier.dot.identifier patterns,
      // (2) template literals containing ${itemParam.field} expressions.
      //
      // Template literals are single tokens — the lexer doesn't split them.
      // Use regex to extract field refs from inside template strings.
      for (var si = mapBodyStart; si < mapBodyEnd; si++) {
        if (c.kindAt(si) === TK.template_literal) {
          var tmplText = c.textAt(si);
          var fieldRe = new RegExp('\\$\\{' + itemParam + '\\.([A-Za-z_]\\w*)', 'g');
          var fm;
          while ((fm = fieldRe.exec(tmplText)) !== null) {
            if (!allFields[fm[1]]) allFields[fm[1]] = _syntheticFieldType(fm[1]);
          }
        }
      }
      for (var si = mapBodyStart; si < mapBodyEnd - 1; si++) {
        if (c.kindAt(si) === TK.identifier && c.textAt(si) === itemParam &&
            c.kindAt(si + 1) === TK.dot &&
            c.kindAt(si + 2) === TK.identifier) {
          var fieldName = c.textAt(si + 2);
          // Register field if new — use _syntheticFieldType as starting heuristic
          if (!allFields[fieldName]) allFields[fieldName] = _syntheticFieldType(fieldName);
          // Promote to int if used in numeric context (any occurrence wins)
          // Context: comparison (> < >= <=)
          if (si + 3 < mapBodyEnd) {
            var nk = c.kindAt(si + 3);
            if (nk === TK.gt || nk === TK.lt || nk === TK.gte || nk === TK.lte) allFields[fieldName] = 'int';
            // Arithmetic: field - x, field + x, field * x
            if (nk === TK.minus || nk === TK.plus || nk === TK.star || nk === TK.slash) allFields[fieldName] = 'int';
          }
          // Context: used as value for a numeric style prop (flexGrow, width, etc.)
          if (si >= 2 && c.kindAt(si - 1) === TK.colon) {
            var sp = c.textAt(si - 2);
            if (sp === 'flexGrow' || sp === 'flex_grow' || sp === 'width' || sp === 'height' ||
                sp === 'padding' || sp === 'gap' || sp === 'margin' || sp === 'opacity' ||
                sp === 'borderWidth' || sp === 'borderRadius' || sp === 'fontSize') {
              allFields[fieldName] = 'int';
            }
          }
          // Context: arithmetic on the left side (x - field, x + field)
          if (si >= 3 && (c.kindAt(si - 1) === TK.minus || c.kindAt(si - 1) === TK.plus)) {
            allFields[fieldName] = 'int';
          }
        }
      }
    }
    c.advance();
  }

  var allFieldNames = Object.keys(allFields);
  if (allFieldNames.length > 0) {
    var fields = [];
    for (var fi = 0; fi < allFieldNames.length; fi++) {
      fields.push({ name: allFieldNames[fi], type: allFields[allFieldNames[fi]] });
    }
    var oaIdx = ctx.objectArrays.length;
    var oa = { fields: fields, getter: name, setter: setter, oaIdx: oaIdx };
    ctx.objectArrays.push(oa);
    c.restore(saved);
    return oa;
  }

  c.restore(saved);
  return null;
}
