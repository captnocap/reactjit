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
    fields.push('text_color = ' + _hexToLua(node.color));
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
      } else {
        childLua.push(_nodeToLua(child, itemParam, indexParam, indent + '  '));
      }
    }
    fields.push('children = {\n' + childLua.map(function(ch) { return indent + '  ' + ch; }).join(',\n') + '\n' + indent + '}');
  }

  return '{ ' + fields.join(', ') + ' }';
}
