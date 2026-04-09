// ── Expression → Lua converter ──────────────────────────────────
// Ported from love2d/scripts/tslx_compile.mjs exprToLua().
// Takes a cursor positioned at a brace expression and produces
// the Lua string directly. No Zig detour.
//
// Handles: identifiers, numbers, strings, property access,
// binary ops (==, !=, &&, ||, +, -, *, /, %, <, >, <=, >=),
// ternary (? :), unary (!), template literals, function calls.

function _exprTokensToLua(c, stopAt) {
  // Collect tokens until stopAt token kind (usually TK.rbrace)
  // Convert each token/pattern to Lua inline
  var parts = [];
  var depth = 0;

  while (c.pos < c.count) {
    // Stop conditions
    if (depth === 0 && stopAt && c.kind() === stopAt) break;
    if (depth === 0 && c.kind() === TK.rbrace) break;

    // Track depth for balanced parens/braces
    if (c.kind() === TK.lparen || c.kind() === TK.lbrace || c.kind() === TK.lbracket) depth++;
    if (c.kind() === TK.rparen || c.kind() === TK.rbrace || c.kind() === TK.rbracket) {
      if (depth === 0) break;
      depth--;
    }

    // === → ==
    if (c.kind() === TK.eq_eq) {
      parts.push('==');
      c.advance();
      // Skip extra = from ===
      if (c.kind() === TK.equals) c.advance();
      continue;
    }

    // !== → ~=
    if (c.kind() === TK.not_eq) {
      parts.push('~=');
      c.advance();
      if (c.kind() === TK.equals) c.advance();
      continue;
    }

    // && → and
    if (c.kind() === TK.amp_amp) {
      parts.push('and');
      c.advance();
      continue;
    }

    // || → or
    if (c.kind() === TK.pipe_pipe) {
      parts.push('or');
      c.advance();
      continue;
    }

    // ! → not (prefix unary)
    if (c.kind() === TK.bang) {
      parts.push('not');
      c.advance();
      continue;
    }

    // Ternary: already collected cond, now at ?
    if (c.kind() === TK.question) {
      // Everything before ? is the condition
      var condStr = parts.join(' ');
      parts = [];
      c.advance(); // skip ?

      // Collect true branch until :
      var trueParts = [];
      var tDepth = 0;
      while (c.pos < c.count) {
        if (c.kind() === TK.lparen) tDepth++;
        if (c.kind() === TK.rparen) tDepth--;
        if (tDepth === 0 && c.kind() === TK.colon) break;
        trueParts.push(_singleTokenToLua(c));
        c.advance();
      }
      if (c.kind() === TK.colon) c.advance(); // skip :

      // Collect false branch until stop
      var falseParts = [];
      var fDepth = 0;
      while (c.pos < c.count) {
        if (c.kind() === TK.lparen || c.kind() === TK.lbrace) fDepth++;
        if (c.kind() === TK.rparen || c.kind() === TK.rbrace) {
          if (fDepth === 0) break;
          fDepth--;
        }
        if (fDepth === 0 && stopAt && c.kind() === stopAt) break;
        falseParts.push(_singleTokenToLua(c));
        c.advance();
      }

      parts.push('(' + condStr + ') and (' + trueParts.join(' ') + ') or (' + falseParts.join(' ') + ')');
      continue;
    }

    // Template literal
    if (c.kind() === TK.template_literal) {
      parts.push(_templateToLua(c.text().slice(1, -1)));
      c.advance();
      continue;
    }

    // String → Lua string, convert hex colors
    if (c.kind() === TK.string) {
      var sv = c.text().slice(1, -1);
      if (sv.charAt(0) === '#' && /^#[0-9a-fA-F]{3,8}$/.test(sv)) {
        parts.push('0x' + sv.slice(1));
      } else {
        parts.push(luaStringLiteral(sv));
      }
      c.advance();
      continue;
    }

    // Default: pass through
    parts.push(_singleTokenToLua(c));
    c.advance();
  }

  return parts.join(' ');
}

function _singleTokenToLua(c) {
  if (c.kind() === TK.string) {
    var sv = c.text().slice(1, -1);
    if (sv.charAt(0) === '#' && /^#[0-9a-fA-F]{3,8}$/.test(sv)) return '0x' + sv.slice(1);
    return luaStringLiteral(sv);
  }
  return c.text();
}

function _templateToLua(raw) {
  var parts = [];
  var i = 0;
  while (i < raw.length) {
    if (raw[i] === '$' && i + 1 < raw.length && raw[i + 1] === '{') {
      var j = i + 2;
      var d = 1;
      while (j < raw.length && d > 0) {
        if (raw[j] === '{') d++;
        if (raw[j] === '}') d--;
        j++;
      }
      var expr = raw.slice(i + 2, j - 1).trim();
      // Apply basic substitutions to the expression
      expr = expr.replace(/===/g, '==').replace(/!==/g, '~=').replace(/&&/g, 'and').replace(/\|\|/g, 'or');
      parts.push('tostring(' + expr + ')');
      i = j;
    } else {
      var start = i;
      while (i < raw.length && !(raw[i] === '$' && i + 1 < raw.length && raw[i + 1] === '{')) i++;
      var lit = raw.slice(start, i);
      if (lit.length > 0) parts.push(luaStringLiteral(lit));
    }
  }
  return parts.join(' .. ') || '""';
}

// ── Convenience: read a brace expression and return Lua ─────────
// Call when cursor is INSIDE the braces (after the opening {).
// Returns the Lua expression string. Cursor ends at the closing }.
function readBraceExprAsLua(c) {
  return _exprTokensToLua(c, TK.rbrace);
}
