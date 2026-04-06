// ── Lua map node emit ───────────────────────────────────────────
// Turns a parsed JSX node into a Lua table literal. Recursive.
// Uses _styleToLua from lua_map_style.js.
// Uses _textToLua from lua_map_text.js.
// Uses _handlerToLua from lua_map_handler.js.
// Uses _hexToLua, _jsExprToLua from lua_map_subs.js.

function _nodeToLua(node, itemParam, indexParam, indent) {
  if (!node) return '{}';
  if (!indent) indent = '      ';
  var fields = [];

  if (node.style) {
    fields.push('style = ' + _styleToLua(node.style, itemParam, indexParam));
  }

  if (node.text !== undefined && node.text !== null) {
    fields.push('text = ' + _textToLua(node.text, itemParam, indexParam));
  }

  if (node.fontSize) {
    fields.push('font_size = ' + node.fontSize);
  }

  if (node.color) {
    var _cv = node.color;
    // Complex Zig expression → __eval
    if (typeof _cv === 'string' && (_cv.indexOf('if ') === 0 || _cv.indexOf('@') >= 0 || _cv.indexOf('state.get') >= 0)) {
      // OA ref in color → _item.field
      var _oaColor = _cv.match(/_oa\d+_(\w+)\[_i\]/);
      if (_oaColor) {
        fields.push('text_color = _item.' + _oaColor[1]);
      } else {
        // Clean up and send to __eval
        var _jsColor = _cv.replace(/^if\s+\((.+?)\)\s+/, '$1 ? ').replace(/\s+else\s+/, ' : ');
        _jsColor = _jsColor.replace(/Color\.rgb\((\d+),\s*(\d+),\s*(\d+)\)/g, function(_, r, g, b) {
          return '0x' + ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, '0');
        });
        _jsColor = _jsColor.replace(/@as\([^,]+,\s*/g, '').replace(/@intCast\(/g, '(');
        fields.push('text_color = __eval("' + _jsColor.replace(/"/g, '\\"') + '")');
      }
    } else {
      var _colorLua = _zigColorToLuaHex(_cv) || _hexToLua(_cv);
      fields.push('text_color = ' + _colorLua);
    }
  }

  if (node.handler) {
    fields.push('lua_on_press = ' + _handlerToLua(node.handler, itemParam, indexParam));
  }

  if (node.children && node.children.length > 0) {
    var childLua = [];
    for (var ci = 0; ci < node.children.length; ci++) {
      var child = node.children[ci];
      if (child.condition) {
        var cond = _jsExprToLua(child.condition, itemParam, indexParam);
        var body = _nodeToLua(child.node, itemParam, indexParam, indent + '  ');
        childLua.push('(' + cond + ') and ' + body + ' or nil');
      } else if (child.ternaryCondition) {
        var tcond = _jsExprToLua(child.ternaryCondition, itemParam, indexParam);
        var trueBranch = _nodeToLua(child.trueNode, itemParam, indexParam, indent + '  ');
        var falseBranch = _nodeToLua(child.falseNode, itemParam, indexParam, indent + '  ');
        childLua.push('(' + tcond + ') and ' + trueBranch + ' or nil');
        childLua.push('(not (' + tcond + ')) and ' + falseBranch + ' or nil');
      } else if (child.nestedMap) {
        var nm = child.nestedMap;
        var innerBody = _nodeToLua(nm.bodyNode, nm.itemParam || '_nitem', nm.indexParam, indent + '  ');
        childLua.push('__luaNestedMap(_item.' + nm.field + ', function(_nitem, _ni)\n' +
          indent + '    return ' + innerBody + '\n' +
          indent + '  end)');
      } else if (child.luaMapLoop) {
        // Inline map loop — emits as a Lua function call that returns children
        var ml = child.luaMapLoop;
        var loopBody = ml.bodyNode ? _nodeToLua(ml.bodyNode, ml.itemParam, ml.indexParam, indent + '    ') : '{}';
        childLua.push('unpack((function()\n' +
          indent + '    local _r = {}\n' +
          indent + '    for _i, _item in ipairs(' + ml.dataVar + ') do\n' +
          indent + '      _r[#_r + 1] = ' + loopBody + '\n' +
          indent + '    end\n' +
          indent + '    return _r\n' +
          indent + '  end)())');
      } else {
        childLua.push(_nodeToLua(child, itemParam, indexParam, indent + '  '));
      }
    }
    fields.push('children = {\n' + childLua.map(function(ch) { return indent + '  ' + ch; }).join(',\n') + '\n' + indent + '}');
  }

  return '{ ' + fields.join(', ') + ' }';
}
