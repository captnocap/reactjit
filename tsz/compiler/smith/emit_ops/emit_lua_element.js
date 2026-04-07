// Atom 17: Lua element emission — emitLuaElement + emitLuaChildren
// Extracted from emit/lua_maps.js lines 208-632
// Depends on: emitLuaStyle (atom 22), emitLuaTextContent (atom 23),
//             hexToLuaColor (atom 19), _jsExprToLua (atom 18)
// These are two mutually recursive functions — they must live in the same atom.

var _luaEmitDepth = 0;
var _luaEmitIter = 0;
var _LUA_EMIT_MAX_ITER = 5000; // hard cap — prevents machine freeze

function emitLuaElement(c, itemParam, indent, indexParam) {
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

  // Component inlining: if tag is a user-defined component, collect its props,
  // then walk the component's JSX body with prop values substituted.
  var _primitives = { Box: 1, Text: 1, Pressable: 1, ScrollView: 1, Image: 1, TextInput: 1, Cartridge: 1, Effect: 1, Glyph: 1, Graph: 1 };
  if (!_primitives[tagName] && ctx && ctx.components) {
    var _comp = null;
    for (var _ci = 0; _ci < ctx.components.length; _ci++) {
      if (ctx.components[_ci].name === tagName) { _comp = ctx.components[_ci]; break; }
    }
    if (_comp && _comp.bodyPos >= 0) {
      // component inlining active
      // Collect props from the component call: <Comp prop1={expr} prop2={expr} />
      var _compProps = {};
      while (c.pos < c.count && c.kind() !== TK.gt && c.kind() !== TK.slash && c.kind() !== TK.slash_gt) {
        if (c.kind() === TK.identifier) {
          var _pName = c.text(); c.advance();
          if (c.kind() === TK.equals) {
            c.advance();
            var _pParts = [];
            if (c.kind() === TK.lbrace) {
              c.advance();
              var _pd = 0;
              while (c.pos < c.count && !(_pd === 0 && c.kind() === TK.rbrace)) {
                if (c.kind() === TK.lbrace) _pd++;
                if (c.kind() === TK.rbrace) _pd--;
                _pParts.push(c.text());
                c.advance();
              }
              if (c.kind() === TK.rbrace) c.advance();
            } else if (c.kind() === TK.string) {
              _pParts.push(c.text()); c.advance();
            } else if (c.kind() === TK.number) {
              _pParts.push(c.text()); c.advance();
            }
            _compProps[_pName] = _pParts.join(' ').replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
          }
        } else { c.advance(); }
      }
      // Skip past closing > or />
      if (c.kind() === TK.slash_gt) { c.advance(); }
      else if (c.kind() === TK.slash) { c.advance(); if (c.kind() === TK.gt) c.advance(); }
      else if (c.kind() === TK.gt) {
        c.advance();
        // Save children cursor position for {children} prop substitution
        var _childrenStart = c.save();
        // Skip to closing tag </CompName>
        var _skipD = 1;
        while (c.pos < c.count && _skipD > 0) {
          if (c.kind() === TK.lt_slash) {
            _skipD--;
            if (_skipD === 0) { c.advance(); if (c.kind() === TK.identifier) c.advance(); if (c.kind() === TK.gt) c.advance(); break; }
          } else if (c.kind() === TK.lt && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
            _skipD++;
          }
          c.advance();
        }
        _compProps['__childrenPos'] = _childrenStart;
      }
      // Walk the component's JSX body with prop substitution
      // Store children cursor pos so {children} in the body can walk the call-site children
      var _prevChildrenPos = ctx._compChildrenPos;
      ctx._compChildrenPos = _compProps['__childrenPos'] || null;
      var _compSaved = c.save();
      c.restore(_comp.bodyPos);
      var _compResult = emitLuaElement(c, itemParam, indent);
      c.restore(_compSaved);
      ctx._compChildrenPos = _prevChildrenPos;
      // Substitute prop references in the emitted Lua
      for (var _pk in _compProps) {
        _compResult = _compResult.replace(new RegExp('_item\\.' + _pk + '\\b', 'g'), _compProps[_pk]);
        // Also replace bare prop names for bare-param components
        if (_comp.isBareParams) {
          _compResult = _compResult.replace(new RegExp('\\b' + _pk + '\\b', 'g'), _compProps[_pk]);
        }
      }
      _luaEmitDepth--;
      return _compResult;
    }
  }

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
  // Token-walker Lua emit: same scroll persistence as _nodeToLua (root ScrollView only).
  if (tagName === 'ScrollView' && !itemParam && ctx && ctx.nextScrollPersistSlot !== undefined) {
    ctx.nextScrollPersistSlot += 1;
    var _sid2 = ctx.nextScrollPersistSlot;
    fields.push('scroll_y = ((_scrollY and _scrollY[' + _sid2 + ']) or 0)');
    fields.push('scroll_persist_slot = ' + _sid2);
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

      // {children} prop: walk call-site children JSX
      if (c.kind() === TK.identifier && c.text() === 'children' &&
          c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.rbrace &&
          ctx._compChildrenPos) {
        c.advance(); // skip 'children'
        if (c.kind() === TK.rbrace) c.advance(); // skip }
        var _chSaved = c.save();
        c.restore(ctx._compChildrenPos);
        var _chResult = emitLuaChildren(c, itemParam, indent);
        c.restore(_chSaved);
        for (var _chi = 0; _chi < _chResult.length; _chi++) children.push(_chResult[_chi]);
        continue;
      }

      // Conditional: cond && <Element/> or ternary: cond ? <A/> : <B/>
      if (c.kind() === TK.identifier) {
        var saved = c.save();
        var condParts = [];
        // Collect tokens until &&, ?, or until we know it's not a conditional
        while (c.pos < c.count && c.kind() !== TK.amp_amp && c.kind() !== TK.question && c.kind() !== TK.rbrace && c.kind() !== TK.lt) {
          condParts.push(c.text());
          c.advance();
        }
        // Ternary JSX: cond ? <TrueJSX> : <FalseJSX>
        if (c.kind() === TK.question) {
          c.advance(); // skip ?
          var _ternCond = condParts.join(' ').replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
          // Convert === to ==, !== to ~=
          _ternCond = _ternCond.replace(/===/g, '==').replace(/!==/g, '~=');
          // Parse true branch
          if (c.kind() === TK.lparen) c.advance();
          var _trueBranch = '';
          if (c.kind() === TK.lt) {
            _trueBranch = emitLuaElement(c, itemParam, indent);
          }
          if (c.kind() === TK.rparen) c.advance();
          // Skip : (colon token)
          if (c.kind() === TK.colon) c.advance();
          // Parse false branch
          if (c.kind() === TK.lparen) c.advance();
          var _falseBranch = '';
          if (c.kind() === TK.lt) {
            _falseBranch = emitLuaElement(c, itemParam, indent);
          }
          if (c.kind() === TK.rparen) c.advance();
          // Emit both branches with conditions (love2d pattern)
          if (_trueBranch) children.push('(' + _ternCond + ') and ' + _trueBranch + ' or nil');
          if (_falseBranch) children.push('(not (' + _ternCond + ')) and ' + _falseBranch + ' or nil');
          if (c.kind() === TK.rbrace) c.advance();
          continue;
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
