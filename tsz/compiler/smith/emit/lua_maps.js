// ── Lua map emission ────────────────────────────────────────────────
// When a .map() source isn't a registered OA, Smith emits a Lua
// rebuildList function instead of a Zig _rebuildMap. LuaJIT iterates
// the array and calls __declareChildren to stamp Zig Nodes.
//
// Ported from love2d/scripts/tslx_compile.mjs listItemEntryToLua.

function hexToLuaColor(hex) {
  // "#58a6ff" → 0x58a6ff
  if (hex.charAt(0) === '#') return '0x' + hex.slice(1);
  return '0x000000';
}

// Convert JS ternary expr to Lua: cond ? a : b → (cond) and (a) or (b)
// Also converts color hex strings to Lua hex numbers.
function _jsExprToLua(expr, itemParam) {
  // Replace item param references
  expr = expr.replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
  // Convert === to ==, !== to ~=
  expr = expr.replace(/===/g, '==').replace(/!==/g, '~=');
  // Handle ternary: cond ? trueVal : falseVal
  var qIdx = expr.indexOf(' ? ');
  if (qIdx >= 0) {
    var cond = expr.slice(0, qIdx).trim();
    var rest = expr.slice(qIdx + 3);
    // Find the matching : (handle nested ternaries by tracking ? depth)
    var depth = 0;
    var cIdx = -1;
    for (var ci = 0; ci < rest.length; ci++) {
      if (rest[ci] === '?' && rest[ci + 1] === ' ') depth++;
      else if (rest[ci] === ':' && rest[ci - 1] === ' ' && rest[ci + 1] === ' ') {
        if (depth === 0) { cIdx = ci; break; }
        depth--;
      }
    }
    if (cIdx >= 0) {
      var trueVal = rest.slice(0, cIdx).trim();
      var falseVal = rest.slice(cIdx + 1).trim();
      // Recursively convert nested ternaries
      trueVal = _jsExprToLua(trueVal, '_item');
      falseVal = _jsExprToLua(falseVal, '_item');
      // Convert color string literals to hex
      trueVal = _luaColorOrPassthrough(trueVal);
      falseVal = _luaColorOrPassthrough(falseVal);
      return '(' + cond + ') and (' + trueVal + ') or (' + falseVal + ')';
    }
  }
  return _luaColorOrPassthrough(expr);
}

function _luaColorOrPassthrough(val) {
  // '#rrggbb' or "#rrggbb" → 0xrrggbb
  var m = val.match(/^['"]#([0-9a-fA-F]{3,8})['"]$/);
  if (m) return '0x' + m[1];
  return val;
}

function emitLuaStyle(c, itemParam) {
  // Cursor is at {{ — skip to inner object, collect key:value pairs
  var parts = [];
  if (c.kind() !== TK.lbrace) return '{}';
  c.advance(); // skip outer {
  if (c.kind() !== TK.lbrace) return '{}';
  c.advance(); // skip inner {
  var _styleLastPos = -1;
  while (c.pos < c.count) {
    if (c.pos === _styleLastPos) { c.advance(); continue; }
    _styleLastPos = c.pos;
    if (c.kind() === TK.rbrace) { c.advance(); break; }
    if (c.kind() === TK.comma) { c.advance(); continue; }
    if (c.kind() === TK.identifier) {
      var key = c.text();
      c.advance();
      if (c.kind() === TK.colon) c.advance();
      // Map camelCase to snake_case for Zig Node.Style fields
      var zigKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      // Value
      if (c.kind() === TK.number) {
        parts.push(zigKey + ' = ' + c.text());
        c.advance();
      } else if (c.kind() === TK.string) {
        var sv = c.text().slice(1, -1);
        if (sv.charAt(0) === '#') {
          parts.push(zigKey + ' = ' + hexToLuaColor(sv));
        } else if (sv === 'row') {
          parts.push(zigKey + ' = "row"');
        } else if (sv === 'none') {
          parts.push(zigKey + ' = "none"');
        } else if (sv.endsWith('%')) {
          // percentage — skip for now
        } else {
          parts.push(zigKey + ' = "' + sv + '"');
        }
        c.advance();
      } else if (c.kind() === TK.lbrace) {
        // Dynamic value: { item.field } or { expr }
        c.advance();
        var exprParts = [];
        var depth = 0;
        while (c.pos < c.count && !(c.kind() === TK.rbrace && depth === 0)) {
          if (c.kind() === TK.lbrace) depth++;
          if (c.kind() === TK.rbrace) depth--;
          exprParts.push(c.text());
          c.advance();
        }
        if (c.kind() === TK.rbrace) c.advance();
        var expr = exprParts.join(' ');
        // Convert JS expressions (ternaries, comparisons, colors) to Lua
        expr = _jsExprToLua(expr, itemParam);
        parts.push(zigKey + ' = ' + expr);
      } else if (c.kind() === TK.identifier) {
        // Bare expression value: ident ? trueVal : falseVal (ternary), or ident
        var exprParts = [];
        var depth = 0;
        while (c.pos < c.count) {
          // Stop at comma (next property) or closing brace (end of style)
          if (depth === 0 && (c.kind() === TK.comma || c.kind() === TK.rbrace)) break;
          if (c.kind() === TK.lparen || c.kind() === TK.lbrace || c.kind() === TK.lbracket) depth++;
          if (c.kind() === TK.rparen || c.kind() === TK.rbrace || c.kind() === TK.rbracket) depth--;
          exprParts.push(c.text());
          c.advance();
        }
        var expr = exprParts.join(' ');
        expr = _jsExprToLua(expr, itemParam);
        parts.push(zigKey + ' = ' + expr);
      }
    } else {
      c.advance();
    }
  }
  if (c.kind() === TK.rbrace) c.advance(); // skip outer }
  return '{ ' + parts.join(', ') + ' }';
}

function emitLuaTextContent(c, itemParam) {
  // Collect text content until closing tag
  // Handles: plain text, {item.field}, {`template ${item.field}`}
  var parts = [];
  var _tcLastPos = -1;
  while (c.pos < c.count) {
    if (c.pos === _tcLastPos) { c.advance(); continue; }
    _tcLastPos = c.pos;
    if (c.kind() === TK.lt || c.kind() === TK.lt_slash) break; // closing tag
    if (c.kind() === TK.lbrace) {
      c.advance();
      if (c.kind() === TK.template_literal) {
        var raw = c.text().slice(1, -1);
        // Convert template literal to Lua concatenation
        var luaParts = [];
        var i = 0;
        while (i < raw.length) {
          if (raw[i] === '$' && i + 1 < raw.length && raw[i + 1] === '{') {
            var j = i + 2;
            var depth = 1;
            while (j < raw.length && depth > 0) {
              if (raw[j] === '{') depth++;
              if (raw[j] === '}') depth--;
              j++;
            }
            var expr = raw.slice(i + 2, j - 1).trim();
            expr = expr.replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
            luaParts.push('tostring(' + expr + ')');
            i = j;
          } else {
            var start = i;
            while (i < raw.length && !(raw[i] === '$' && i + 1 < raw.length && raw[i + 1] === '{')) i++;
            var literal = raw.slice(start, i).replace(/"/g, '\\"');
            if (literal.length > 0) luaParts.push('"' + literal + '"');
          }
        }
        parts.push(luaParts.join(' .. '));
        c.advance();
      } else {
        // Brace expression: {item.field}
        var exprParts = [];
        var depth = 0;
        while (c.pos < c.count && !(c.kind() === TK.rbrace && depth === 0)) {
          if (c.kind() === TK.lbrace) depth++;
          if (c.kind() === TK.rbrace) depth--;
          exprParts.push(c.text());
          c.advance();
        }
        var expr = exprParts.join(' ');
        expr = expr.replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
        parts.push('tostring(' + expr + ')');
      }
      if (c.kind() === TK.rbrace) c.advance();
    } else if (c.kind() === TK.string) {
      parts.push('"' + c.text().slice(1, -1) + '"');
      c.advance();
    } else if (c.kind() === TK.identifier || c.kind() === TK.number) {
      parts.push('"' + c.text() + '"');
      c.advance();
    } else {
      c.advance();
    }
  }
  if (parts.length === 0) return '""';
  return parts.join(' .. ');
}

var _luaEmitDepth = 0;
var _luaEmitIter = 0;
var _LUA_EMIT_MAX_ITER = 5000; // hard cap — prevents machine freeze

function emitLuaElement(c, itemParam, indent) {
  _luaEmitDepth++;
  if (_luaEmitDepth > 20 || _luaEmitIter > _LUA_EMIT_MAX_ITER) {
    _luaEmitDepth--;
    // Skip to closing tag or end
    while (c.pos < c.count && _luaEmitIter < _LUA_EMIT_MAX_ITER + 500) {
      _luaEmitIter++;
      if (c.kind() === TK.lt_slash) {
        c.advance(); // </
        if (c.kind() === TK.identifier) c.advance();
        if (c.kind() === TK.gt) c.advance();
        break;
      }
      c.advance();
    }
    return '{ text = "..." }';
  }
  // Must be at < (JSX opening tag) — if not, bail immediately
  if (c.kind() !== TK.lt) {
    _luaEmitDepth--;
    // Skip block body: consume tokens until we find < or run out
    while (c.pos < c.count && c.kind() !== TK.lt && _luaEmitIter < _LUA_EMIT_MAX_ITER) {
      _luaEmitIter++;
      // If we hit a closing paren at depth 0, the map body is done
      if (c.kind() === TK.rparen || c.kind() === TK.rbrace) break;
      c.advance();
    }
    if (c.kind() === TK.lt) {
      // Found JSX after block prefix — retry
      _luaEmitDepth++;
    } else {
      return '{ text = "..." }';
    }
  }
  // Cursor at < (opening tag)
  _luaEmitIter++;
  c.advance(); // skip <
  var tagName = c.text();
  c.advance(); // skip tag name

  var node = { style: null, fontSize: null, color: null, children: [], text: null, handler: null };

  // Parse attributes
  var _attrLastPos = -1;
  while (c.pos < c.count && c.kind() !== TK.gt && c.kind() !== TK.slash && c.kind() !== TK.slash_gt && _luaEmitIter < _LUA_EMIT_MAX_ITER) {
    _luaEmitIter++;
    if (c.pos === _attrLastPos) { c.advance(); continue; }
    _attrLastPos = c.pos;
    if (c.kind() === TK.identifier) {
      var attrName = c.text();
      c.advance();
      if (c.kind() === TK.equals) {
        c.advance();
        if (attrName === 'style') {
          node.style = emitLuaStyle(c, itemParam);
        } else if (attrName === 'fontSize') {
          if (c.kind() === TK.lbrace) { c.advance(); node.fontSize = c.text(); c.advance(); if (c.kind() === TK.rbrace) c.advance(); }
          else { node.fontSize = c.text(); c.advance(); }
        } else if (attrName === 'color') {
          if (c.kind() === TK.string) { node.color = hexToLuaColor(c.text().slice(1, -1)); c.advance(); }
          else if (c.kind() === TK.lbrace) {
            c.advance();
            var colorExpr = [];
            while (c.kind() !== TK.rbrace && c.pos < c.count) { colorExpr.push(c.text()); c.advance(); }
            if (c.kind() === TK.rbrace) c.advance();
            var ce = colorExpr.join(' ');
            node.color = _jsExprToLua(ce, itemParam);
          }
        } else if (attrName === 'key') {
          // Skip key attribute
          if (c.kind() === TK.lbrace) { c.advance(); var kd = 0; while (c.pos < c.count && !(c.kind() === TK.rbrace && kd === 0)) { if (c.kind() === TK.lbrace) kd++; if (c.kind() === TK.rbrace) kd--; c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.string) c.advance();
        } else if (/^on(Press|Click)$/.test(attrName)) {
          // Handler: onPress={() => { body }} → capture body as Lua expression
          if (c.kind() === TK.lbrace) {
            c.advance(); // skip outer {
            // Skip arrow prefix: () => or (params) =>
            while (c.pos < c.count && c.kind() !== TK.arrow && c.kind() !== TK.rbrace) c.advance();
            if (c.kind() === TK.arrow) c.advance();
            if (c.kind() === TK.lbrace) c.advance(); // skip block {
            // Collect handler body tokens
            var _hParts = [];
            var _hd = 0;
            while (c.pos < c.count) {
              if (c.kind() === TK.lbrace) _hd++;
              if (c.kind() === TK.rbrace) { if (_hd === 0) break; _hd--; }
              _hParts.push(c.text());
              c.advance();
            }
            if (c.kind() === TK.rbrace) c.advance(); // skip block }
            if (c.kind() === TK.rbrace) c.advance(); // skip outer }
            var _hBody = _hParts.join(' ').replace(/\s*;\s*$/, '').trim();
            _hBody = _hBody.replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
            // Convert === to ==, !== to ~=
            _hBody = _hBody.replace(/===/g, '==').replace(/!==/g, '~=');
            node.handler = _hBody || true;
          }
        } else {
          // Skip unknown attribute value
          if (c.kind() === TK.string) c.advance();
          else if (c.kind() === TK.lbrace) { c.advance(); var ud = 0; while (c.pos < c.count && !(c.kind() === TK.rbrace && ud === 0)) { if (c.kind() === TK.lbrace) ud++; if (c.kind() === TK.rbrace) ud--; c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.number) c.advance();
        }
      }
    } else {
      c.advance();
    }
  }

  // Self-closing: /> (lexer emits as single TK.slash_gt token OR TK.slash + TK.gt)
  var selfClosing = false;
  if (c.kind() === TK.slash_gt) { c.advance(); selfClosing = true; }
  else if (c.kind() === TK.slash) { c.advance(); selfClosing = true; if (c.kind() === TK.gt) c.advance(); }
  else if (c.kind() === TK.gt) { c.advance(); }

  if (!selfClosing) {
    if (tagName === 'Text') {
      // Text element: collect text content
      node.text = emitLuaTextContent(c, itemParam);
    } else {
      // Container: collect children
      node.children = emitLuaChildren(c, itemParam, indent + '  ');
    }
    // Skip closing tag </TagName> — lexer emits </ as single TK.lt_slash token
    if (c.kind() === TK.lt_slash) {
      c.advance(); // </
      if (c.kind() === TK.identifier) c.advance(); // TagName
      if (c.kind() === TK.gt) c.advance(); // >
    }
  }

  // Build Lua table
  var fields = [];
  if (node.style) fields.push('style = ' + node.style);
  if (node.text) fields.push('text = ' + node.text);
  if (node.fontSize) fields.push('font_size = ' + node.fontSize);
  if (node.color) fields.push('text_color = ' + node.color);
  if (node.handler) {
    var _hp = typeof node.handler === 'string' ? node.handler : '__luaMapPress(" .. _i .. ")';
    fields.push('lua_on_press = "' + _hp.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"');
  }
  if (node.children.length > 0) {
    fields.push('children = {\n' + node.children.map(function(ch) { return indent + '  ' + ch; }).join(',\n') + '\n' + indent + '}');
  }
  _luaEmitDepth--;
  return '{ ' + fields.join(', ') + ' }';
}

function emitLuaChildren(c, itemParam, indent) {
  var children = [];
  var _chLastPos = -1;
  while (c.pos < c.count && _luaEmitIter < _LUA_EMIT_MAX_ITER) {
    _luaEmitIter++;
    if (c.pos === _chLastPos) { c.advance(); continue; }
    _chLastPos = c.pos;
    // Stop at closing tag — lexer emits </ as single TK.lt_slash token
    if (c.kind() === TK.lt_slash) break;

    // Child element
    if (c.kind() === TK.lt && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
      children.push(emitLuaElement(c, itemParam, indent));
      continue;
    }

    // Brace expression child
    if (c.kind() === TK.lbrace) {
      c.advance();

      // Conditional: cond && <Element/>
      if (c.kind() === TK.identifier) {
        var saved = c.save();
        var condParts = [];
        // Collect tokens until && or until we know it's not a conditional
        while (c.pos < c.count && c.kind() !== TK.amp_amp && c.kind() !== TK.rbrace && c.kind() !== TK.lt) {
          condParts.push(c.text());
          c.advance();
        }
        if (c.kind() === TK.amp_amp) {
          c.advance(); // skip &&
          var condExpr = condParts.join(' ').replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
          // Handle chained &&: a && b && c && <JSX> → (a) and (b) and (c) and element
          while (c.kind() !== TK.lt && c.kind() !== TK.lparen && c.kind() !== TK.rbrace && c.pos < c.count) {
            var chainParts = [];
            while (c.pos < c.count && c.kind() !== TK.amp_amp && c.kind() !== TK.rbrace && c.kind() !== TK.lt && c.kind() !== TK.lparen) {
              chainParts.push(c.text());
              c.advance();
            }
            if (c.kind() === TK.amp_amp) {
              c.advance();
              var chainExpr = chainParts.join(' ').replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
              condExpr = '(' + condExpr + ') and (' + chainExpr + ')';
            } else {
              // Not another &&, push parts back conceptually — we're at < or ) or }
              if (chainParts.length > 0) {
                var chainExpr2 = chainParts.join(' ').replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
                condExpr = '(' + condExpr + ') and (' + chainExpr2 + ')';
              }
              break;
            }
          }
          // Check if next is JSX
          if (c.kind() === TK.lt || c.kind() === TK.lparen) {
            if (c.kind() === TK.lparen) c.advance(); // skip optional (
            var innerEl = emitLuaElement(c, itemParam, indent);
            if (c.kind() === TK.rparen) c.advance();
            children.push('(' + condExpr + ') and ' + innerEl + ' or nil');
            if (c.kind() === TK.rbrace) c.advance();
            continue;
          }
          // Check if next is a conditional nested map: cond && expr.map(...)
          // e.g. {state.plugins && state.plugins.map((p) => (<Box>...</Box>))}
          if (c.kind() === TK.identifier) {
            // Scan ahead for .map( — skip balanced parens for chained calls
            var _cmSaved = c.save();
            var _cmFound = false;
            var _cmDepth = 0;
            while (c.pos < c.count && c.kind() !== TK.rbrace) {
              if (c.kind() === TK.identifier && c.text() === 'map' && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
                _cmFound = true;
                break;
              }
              if (c.kind() === TK.lparen) _cmDepth++;
              if (c.kind() === TK.rparen) { if (_cmDepth > 0) _cmDepth--; else break; }
              c.advance();
            }
            if (_cmFound) {
              // Position at 'map' — skip to the callback body
              c.advance(); // skip 'map'
              if (c.kind() === TK.lparen) c.advance(); // (
              if (c.kind() === TK.lparen) c.advance(); // inner (
              var _cmParam = c.text();
              c.advance(); // param name
              if (c.kind() === TK.rparen) c.advance(); // )
              if (c.kind() === TK.arrow) c.advance(); // =>
              if (c.kind() === TK.lparen) c.advance(); // (
              var _cmChild = emitLuaElement(c, _cmParam, indent + '  ');
              // Consume closing parens/braces
              while (c.kind() === TK.rparen) c.advance();
              if (c.kind() === TK.rbrace) c.advance();
              // Emit as conditional nested map
              children.push('(' + condExpr + ') and __luaNestedMap(' + condExpr + ', function(' + _cmParam + ') return ' + _cmChild + ' end) or nil');
              continue;
            }
            c.restore(_cmSaved);
          }
        }
        // Not a conditional — restore and skip
        c.restore(saved);
      }

      // Nested .map(): item.children.map((child) => (...))
      if (c.kind() === TK.identifier) {
        var saved2 = c.save();
        var src = c.text();
        c.advance();
        if (c.kind() === TK.dot && c.pos + 1 < c.count) {
          c.advance(); // .
          var field = c.text();
          c.advance(); // field
          if (c.kind() === TK.dot && c.pos + 1 < c.count && c.textAt(c.pos + 1) === 'map') {
            // item.field.map(...)
            c.advance(); c.advance(); // . map
            if (c.kind() === TK.lparen) {
              c.advance(); // (
              if (c.kind() === TK.lparen) c.advance(); // inner (
              var innerParam = c.text();
              c.advance(); // param name
              if (c.kind() === TK.rparen) c.advance(); // )
              if (c.kind() === TK.arrow) c.advance(); // =>
              if (c.kind() === TK.lparen) c.advance(); // (
              var innerChild = emitLuaElement(c, innerParam, indent + '  ');
              if (c.kind() === TK.rparen) c.advance();
              if (c.kind() === TK.rparen) c.advance();
              if (c.kind() === TK.rparen) c.advance();
              if (c.kind() === TK.rbrace) c.advance();
              // Emit nested for loop as inline Lua
              var srcExpr = src === itemParam ? '_item' : src;
              children.push('__luaNestedMap(' + srcExpr + '.' + field + ', function(' + innerParam + ') return ' + innerChild + ' end)');
              continue;
            }
          }
        }
        c.restore(saved2);
      }

      // Skip unknown brace expression
      var bd = 0;
      while (c.pos < c.count && !(c.kind() === TK.rbrace && bd === 0)) {
        if (c.kind() === TK.lbrace) bd++;
        if (c.kind() === TK.rbrace) bd--;
        c.advance();
      }
      if (c.kind() === TK.rbrace) c.advance();
      continue;
    }

    c.advance();
  }
  return children;
}

// Main entry: emit a complete Lua rebuildList function for a map
function emitLuaRebuildList(mapIdx, c, itemParam, wrapperTag) {
  // c is positioned at the first child of the map body (after the arrow)
  // Walk the JSX and emit Lua
  _luaEmitIter = 0; // reset iteration counter per map

  // Skip optional ( wrapper
  if (c.kind() === TK.lparen) c.advance();

  var bodyLua = emitLuaElement(c, itemParam, '      ');

  // Skip optional ) and ))
  while (c.kind() === TK.rparen) c.advance();

  var fn = '';
  fn += 'function __rebuildLuaMap' + mapIdx + '()\n';
  fn += '  __clearLuaNodes()\n';
  fn += '  local wrapper = __mw' + mapIdx + '\n';
  fn += '  if not wrapper then return end\n';
  fn += '  local items = __luaMapData' + mapIdx + '\n';
  fn += '  if not items or #items == 0 then\n';
  fn += '    __declareChildren(wrapper, {})\n';
  fn += '    return\n';
  fn += '  end\n';
  fn += '  local tmpl = {}\n';
  fn += '  for _i, _item in ipairs(items) do\n';
  fn += '    tmpl[#tmpl + 1] = ' + bodyLua + '\n';
  fn += '  end\n';
  fn += '  __declareChildren(wrapper, tmpl)\n';
  fn += 'end\n';
  fn += '\n';
  fn += '-- Nested map helper\n';
  fn += 'function __luaNestedMap(arr, fn)\n';
  fn += '  if not arr then return nil end\n';
  fn += '  local result = {}\n';
  fn += '  for _, v in ipairs(arr) do\n';
  fn += '    result[#result + 1] = fn(v)\n';
  fn += '  end\n';
  fn += '  return { children = result }\n';
  fn += 'end\n';

  return fn;
}

// ── Parsed-result Lua rebuilder ────────────────────────────────────
// Instead of walking raw tokens (which breaks on block bodies, destructuring,
// nested maps), this takes the PARSED node result from Smith's normal parser
// and converts the Zig nodeExpr to a Lua template.
// The parser already handles all edge cases — we just translate the output.

function _zigNodeExprToLua(nodeExpr) {
  if (!nodeExpr || typeof nodeExpr !== 'string') return '{}';
  // Convert Zig struct literal to Lua table:
  // .{ .field = value, ... } → { field = value, ... }
  var lua = nodeExpr;
  // Strip leading .{ and trailing }
  lua = lua.replace(/^\.{\s*/, '{ ').replace(/\s*}$/, ' }');
  // .field = → field =
  lua = lua.replace(/\.(\w+)\s*=/g, '$1 =');
  // .{ → { (nested structs)
  lua = lua.replace(/\.\{/g, '{');
  // .enum_value → "enum_value" (Zig enum → Lua string)
  lua = lua.replace(/=\s*\.(\w+)/g, '= "$1"');
  // Color.rgb(r,g,b) → simplified hex (or pass through)
  lua = lua.replace(/Color\.rgb\((\d+),\s*(\d+),\s*(\d+)\)/g, function(_, r, g, b) {
    return '0x' + ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, '0');
  });
  // &_arr_N references → nil (array refs don't translate to Lua)
  lua = lua.replace(/&_arr_\d+/g, 'nil');
  // OA field refs: _oaN_field[_i][0.._oaN_field_lens[_i]] → _item.field
  lua = lua.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, 'tostring(_item.$1)');
  lua = lua.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
  // std.fmt.bufPrint refs → tostring(_item.field)
  lua = lua.replace(/std\.fmt\.bufPrint\([^)]+\)/g, '"..."');
  // Clean up: children = nil → remove
  lua = lua.replace(/,?\s*children\s*=\s*nil/g, '');
  return lua;
}

function _nodeResultToLuaRebuilder(mapIdx, nodeResult, oa) {
  // templateNodeExpr has the actual parsed JSX template — nodeExpr is always '.{}'
  // because finalizeMapNode stubs the wrapper node. Use the real template.
  var templateLua = _zigNodeExprToLua(nodeResult.templateNodeExpr || nodeResult.nodeExpr || '.{}');
  var fn = '';
  fn += 'function __rebuildLuaMap' + mapIdx + '()\n';
  fn += '  __clearLuaNodes()\n';
  fn += '  local wrapper = __mw' + mapIdx + '\n';
  fn += '  if not wrapper then return end\n';
  fn += '  local items = __luaMapData' + mapIdx + '\n';
  fn += '  if not items or #items == 0 then\n';
  fn += '    __declareChildren(wrapper, {})\n';
  fn += '    return\n';
  fn += '  end\n';
  fn += '  local tmpl = {}\n';
  fn += '  for _i, _item in ipairs(items) do\n';
  fn += '    tmpl[#tmpl + 1] = ' + templateLua + '\n';
  fn += '  end\n';
  fn += '  __declareChildren(wrapper, tmpl)\n';
  fn += 'end\n';
  return fn;
}
