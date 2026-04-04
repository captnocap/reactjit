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
        // Replace item param references
        expr = expr.replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
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
    if (c.kind() === TK.lt) break; // closing tag
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

function emitLuaElement(c, itemParam, indent) {
  _luaEmitDepth++;
  if (_luaEmitDepth > 20) {
    // Bail out — too deep, skip remaining tokens until we're back at a sane point
    _luaEmitDepth--;
    var _bailDepth = 0;
    while (c.pos < c.count) {
      if (c.kind() === TK.lt && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.slash) {
        c.advance(); c.advance(); // </
        if (c.kind() === TK.identifier) c.advance();
        if (c.kind() === TK.gt) c.advance();
        break;
      }
      c.advance();
    }
    return '{ text = "..." }';
  }
  // Cursor at < (opening tag)
  c.advance(); // skip <
  var tagName = c.text();
  c.advance(); // skip tag name

  var node = { style: null, fontSize: null, color: null, children: [], text: null };

  // Parse attributes
  var _attrLastPos = -1;
  while (c.pos < c.count && c.kind() !== TK.gt && c.kind() !== TK.slash) {
    if (c.pos === _attrLastPos) { c.advance(); continue; } // safety: skip stuck token
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
            var ce = colorExpr.join(' ').replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
            node.color = ce;
          }
        } else if (attrName === 'key') {
          // Skip key attribute
          if (c.kind() === TK.lbrace) { c.advance(); var kd = 0; while (c.pos < c.count && !(c.kind() === TK.rbrace && kd === 0)) { if (c.kind() === TK.lbrace) kd++; if (c.kind() === TK.rbrace) kd--; c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
          else if (c.kind() === TK.string) c.advance();
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

  // Self-closing: />
  var selfClosing = false;
  if (c.kind() === TK.slash) { c.advance(); selfClosing = true; }
  if (c.kind() === TK.gt) c.advance();

  if (!selfClosing) {
    if (tagName === 'Text') {
      // Text element: collect text content
      node.text = emitLuaTextContent(c, itemParam);
    } else {
      // Container: collect children
      node.children = emitLuaChildren(c, itemParam, indent + '  ');
    }
    // Skip closing tag </TagName>
    if (c.kind() === TK.lt && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.slash) {
      c.advance(); c.advance(); // < /
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
  if (node.children.length > 0) {
    fields.push('children = {\n' + node.children.map(function(ch) { return indent + '  ' + ch; }).join(',\n') + '\n' + indent + '}');
  }
  _luaEmitDepth--;
  return '{ ' + fields.join(', ') + ' }';
}

function emitLuaChildren(c, itemParam, indent) {
  var children = [];
  var _chLastPos = -1;
  while (c.pos < c.count) {
    if (c.pos === _chLastPos) { c.advance(); continue; }
    _chLastPos = c.pos;
    // Stop at closing tag
    if (c.kind() === TK.lt && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.slash) break;

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
          // Check if next is JSX
          if (c.kind() === TK.lt || c.kind() === TK.lparen) {
            if (c.kind() === TK.lparen) c.advance(); // skip optional (
            var innerEl = emitLuaElement(c, itemParam, indent);
            if (c.kind() === TK.rparen) c.advance();
            children.push('(' + condExpr + ') and ' + innerEl + ' or nil');
            if (c.kind() === TK.rbrace) c.advance();
            continue;
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
