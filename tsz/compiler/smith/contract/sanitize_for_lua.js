// ── Sanitizer: JS → Lua expression conversion ──────────────────
// Sits between parse and contract. Walks the entire luaNode tree
// and converts every JS expression to valid Lua BEFORE emit sees it.
//
// After this runs, emit atoms never need to ask "is this JS or Lua?"
// They just concatenate strings.
//
// Called from: lanes/app.js, right after parseJSXElement()

// ── Core JS → Lua expression converter ─────────────────────────
// This is THE ONLY PLACE that converts JS operators to Lua.
// No emit atom should ever do this conversion.

function _jsToLua(expr) {
  if (!expr || typeof expr !== 'string') return expr;

  // Resolve simple props.field references when the prop value is already known.
  if (typeof ctx !== 'undefined' && ctx && ctx.propStack) {
    expr = expr.replace(/\bprops\.(\w+)\b/g, function(_, field) {
      if (ctx.propStack[field] === undefined) return 'props.' + field;
      var pv = ctx.propStack[field];
      if (pv && typeof pv === 'object' && pv.expr) return _jsToLua(String(pv.expr));
      return _jsToLua(String(pv));
    });
  }

  // Protect __eval("...") blocks — they stay as JS inside the quotes
  var evalBlocks = [];
  expr = expr.replace(/__eval\(([^)]+)\)/g, function(m) {
    evalBlocks.push(m);
    return '__EVAL_PROTECT_' + (evalBlocks.length - 1) + '__';
  });

  // 1. JS comments → Lua comments
  expr = expr.replace(/\/\/(.*)$/gm, '--$1');

  // 2. Zig builtins
  expr = expr.replace(/@divTrunc\(([^,]+),\s*([^)]+)\)/g, 'math.floor($1 / $2)');
  expr = expr.replace(/@mod\(([^,]+),\s*([^)]+)\)/g, '($1 % $2)');
  for (var zi = 0; zi < 3; zi++) {
    expr = expr.replace(/@as\(\[\]const u8,\s*("[^"]*")\)/g, '$1');
    expr = expr.replace(/@as\([^,]+,\s*([^)]+)\)/g, '$1');
    expr = expr.replace(/@intCast\(([^)]+)\)/g, '$1');
    expr = expr.replace(/@floatFromInt\(([^)]+)\)/g, '$1');
  }

  // 3. Zig std.mem.eql → Lua comparison
  expr = expr.replace(/!std\.mem\.eql\(u8,\s*([^,]+),\s*([^)]+)\)/g, '($1 ~= $2)');
  expr = expr.replace(/std\.mem\.eql\(u8,\s*([^,]+),\s*([^)]+)\)/g, '($1 == $2)');
  // Broken contract shapes from chained string comparisons in map conditions.
  expr = expr.replace(
    /std\.mem\.eql\(u8,\s*\(([^,]+),\s*("[^"]+")\)\s*or\s*std\.mem\.eql\(u8,\s*\1,\s*("[^"]+")\)\)/g,
    '(($1 == $2) or ($1 == $3))'
  );
  expr = expr.replace(
    /std\.mem\.eql\(u8,\s*\(([^,]+),\s*("[^"]+")\)\s*or\s*([^)]+)\)/g,
    '(($1 == $2) or ($3))'
  );

  // 4. JS ternary → Lua and/or (iterate for nested)
  for (var ti = 0; ti < 8; ti++) {
    var next = expr.replace(
      /\(([^()?:]+(?:\s+(?:and|or)\s+[^()?:]+)*)\s*\?\s*("[^"]*"|'[^']*'|\d+)\s*:\s*("[^"]*"|'[^']*'|\d+)\)/g,
      '(($1) and $2 or $3)'
    );
    next = next.replace(
      /(^|[=(,]\s*)([^?:()]+?)\s*\?\s*([^:]+?)\s*:\s*([^)=,]+)(?=$|[),])/g,
      function(_, prefix, cond, whenTrue, whenFalse) {
        return prefix + '((' + cond.trim() + ') and (' + whenTrue.trim() + ') or (' + whenFalse.trim() + '))';
      }
    );
    if (next === expr) break;
    expr = next;
  }

  // 5. Zig if/else → Lua and/or
  for (var ifIter = 0; ifIter < 10; ifIter++) {
    var ifPos = expr.indexOf('if (');
    if (ifPos < 0) break;
    var depth = 0, ci = ifPos + 3;
    for (; ci < expr.length; ci++) {
      if (expr[ci] === '(') depth++;
      if (expr[ci] === ')') { depth--; if (depth === 0) break; }
    }
    if (depth !== 0) break;
    var cond = expr.substring(ifPos + 4, ci);
    var after = expr.substring(ci + 1).trim();
    var elseIdx = after.indexOf(' else ');
    if (elseIdx < 0) break;
    var trueVal = after.substring(0, elseIdx).trim();
    var prefix = expr.substring(0, ifPos);
    var suffix = after.substring(elseIdx + 6).trim();
    expr = prefix + '(' + cond + ') and ' + trueVal + ' or ' + suffix;
  }

  // 6. String concat: + between string operands → ..
  //    Only convert when at least one side is clearly a string (quoted or concat chain)
  expr = _convertStringConcat(expr);

  // 7. .length → # (Lua length operator)
  expr = expr.replace(/([A-Za-z_]\w*(?:\.[A-Za-z_]\w+)*)\.length\b/g, '#$1');
  expr = expr.replace(/([A-Za-z_]\w*(?:\.[A-Za-z_]\w+)*)\.len\b/g, '#$1');
  // OA helper arrays captured in contract mode
  expr = expr.replace(/(_oa\d+_\w+)_length\[_i\]/g, '#($1[_i])');
  expr = expr.replace(/(_oa\d+_\w+)_length\[_j\]/g, '#($1[_j])');
  expr = expr.replace(/(_oa\d+_\w+)_indexOf\[_i\]\(([^)]+)\)\s*>=\s*0/g, '(string.find($1[_i], $2, 1, true) ~= nil)');
  expr = expr.replace(/(_oa\d+_\w+)_indexOf\[_i\]\(([^)]+)\)\s*<\s*0/g, '(string.find($1[_i], $2, 1, true) == nil)');
  expr = expr.replace(/(_oa\d+_\w+)_indexOf\[_i\]\(([^)]+)\)\s*==\s*0/g, '(string.find($1[_i], $2, 1, true) == 1)');
  expr = expr.replace(/(_oa\d+_\w+)_indexOf\[_j\]\(([^)]+)\)\s*>=\s*0/g, '(string.find($1[_j], $2, 1, true) ~= nil)');
  expr = expr.replace(/(_oa\d+_\w+)_indexOf\[_j\]\(([^)]+)\)\s*<\s*0/g, '(string.find($1[_j], $2, 1, true) == nil)');
  expr = expr.replace(/(_oa\d+_\w+)_indexOf\[_j\]\(([^)]+)\)\s*==\s*0/g, '(string.find($1[_j], $2, 1, true) == 1)');

  // 8. Comparison operators (MUST be before && || to avoid mangling)
  expr = expr.replace(/!==/g, '~=');
  expr = expr.replace(/===/g, '==');
  expr = expr.replace(/!=/g, '~=');

  // 9. Logical operators
  expr = expr.replace(/\|\|/g, ' or ');
  expr = expr.replace(/&&/g, ' and ');

  // 9b. JS empty-array literal `[]` → lua empty-table `{}`. Catches expressions
  // like `(props.X || [])` that get inlined into lua source via prop chains
  // without going through __eval. Lua doesn't understand `[]`.
  expr = expr.replace(/\[\s*\]/g, '{}');

  // 10. Negation: !expr → not expr (but not != which is already handled)
  expr = expr.replace(/!([A-Za-z_(])/g, 'not $1');

  // 11. Bitwise → LuaJIT bit library
  if (expr.indexOf('&') >= 0 || expr.indexOf('|') >= 0 || expr.indexOf('^') >= 0 ||
      expr.indexOf('>>') >= 0 || expr.indexOf('<<') >= 0) {
    for (var bp = 0; bp < 5; bp++) {
      var prev = expr;
      expr = expr.replace(/(\w+)\s*>>\s*(\w+)/g, 'bit.rshift($1, $2)');
      expr = expr.replace(/(\w+)\s*<<\s*(\w+)/g, 'bit.lshift($1, $2)');
      expr = expr.replace(/(\w+)\s*&\s*(\w+)/g, 'bit.band($1, $2)');
      expr = expr.replace(/(\w+)\s*\|\s*(\w+)/g, 'bit.bor($1, $2)');
      expr = expr.replace(/(\w+)\s*\^\s*(\w+)/g, 'bit.bxor($1, $2)');
      if (expr === prev) break;
    }
  }

  // 12. Color conversion — all formats → Lua 0xRRGGBB
  // JSX: "#ff0000", '#ff0000' → 0xff0000
  expr = expr.replace(/'#([0-9a-fA-F]{3,8})'/g, '0x$1');
  expr = expr.replace(/"#([0-9a-fA-F]{3,8})"/g, '0x$1');
  // Bare #hex in expressions
  expr = expr.replace(/\B#([0-9a-fA-F]{6})\b/g, '0x$1');
  // Zig: Color.rgb(R,G,B) → 0xRRGGBB
  expr = expr.replace(/Color\.rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*\d+)?\)/g, function(_, r, g, b) {
    return '0x' + ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, '0');
  });
  // Dynamic packed color ints already stored as 0xRRGGBB-compatible numbers.
  expr = expr.replace(
    /Color\.rgb\(@intCast\(\(([^)]+)\s*>>\s*16\)\s*&\s*0xFF\),\s*@intCast\(\(([^)]+)\s*>>\s*8\)\s*&\s*0xFF\),\s*@intCast\(([^)]+)\s*&\s*0xFF\)\)/g,
    function(_, hi, mid, lo) {
      if (hi.trim() === mid.trim() && mid.trim() === lo.trim()) return hi.trim();
      return 'Color.rgb(@intCast((' + hi + ' >> 16) & 0xFF), @intCast((' + mid + ' >> 8) & 0xFF), @intCast(' + lo + ' & 0xFF))';
    }
  );
  // Zig: Color{} placeholder → 0x000000
  expr = expr.replace(/\bColor\{\}/g, '0x000000');

  // 13. Zig enum literals → quoted strings (.row → "row")
  expr = expr.replace(/(^|[\s(,=])\.(\w+)(?=[\s),=]|$)/g, function(_, pre, name) {
    return pre + '"' + name + '"';
  });

  // Restore __eval blocks
  for (var ei = 0; ei < evalBlocks.length; ei++) {
    expr = expr.replace('__EVAL_PROTECT_' + ei + '__', evalBlocks[ei]);
  }

  // Collapse redundant parens
  for (var pi = 0; pi < 4; pi++) {
    var pnext = expr.replace(/\(\s*\(([^()]+)\)\s*\)/g, '($1)');
    if (pnext === expr) break;
    expr = pnext;
  }

  return expr;
}

// ── String concat conversion ───────────────────────────────────
// JS: "hello " + name + "!"  →  Lua: "hello " .. name .. "!"
// Only converts + to .. when at least one operand is a string literal.
// Does NOT convert numeric addition (a + b where both are numbers).

function _convertStringConcat(expr) {
  if (expr.indexOf('+') < 0) return expr;
  // If there's a quoted string anywhere near a +, convert all + to ..
  // This is safe because Lua .. works on numbers too (auto-coerces)
  if (/["'][^"']*["']\s*\+|\+\s*["'][^"']*["']/.test(expr)) {
    // Protect + inside function args: tostring(x+1) should stay
    // Simple approach: split on + only outside parens
    return _concatOutsideParens(expr);
  }
  // Also convert: tostring(x) + " text" patterns
  if (/tostring\([^)]+\)\s*\+|\+\s*tostring\([^)]+\)/.test(expr)) {
    return _concatOutsideParens(expr);
  }
  return expr;
}

function _concatOutsideParens(expr) {
  var result = '';
  var depth = 0;
  for (var i = 0; i < expr.length; i++) {
    var ch = expr[i];
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === '+' && depth === 0) {
      result += ' .. ';
    } else {
      result += ch;
    }
  }
  return result;
}

// ── Tree walker ────────────────────────────────────────────────
// Walks the luaNode tree, converting all expressions in-place.

function sanitizeLuaNodeTree(node) {
  if (!node || typeof node !== 'object') return;

  // Style values
  if (node.style && typeof node.style === 'object') {
    for (var key in node.style) {
      var val = node.style[key];
      if (typeof val === 'string') {
        node.style[key] = _jsToLua(val);
      }
    }
  }

  // Text contracts
  if (node.text) {
    if (typeof node.text === 'string') {
      // Plain string text — might have embedded expressions
      node.text = _jsToLua(node.text);
    } else if (typeof node.text === 'object') {
      if (node.text.type === 'luaExpr' && node.text.expr) {
        node.text.expr = _jsToLua(node.text.expr);
      }
      if (node.text.type === 'stateVar' && node.text.name) {
        node.text.name = _jsToLua(node.text.name);
      }
      if (node.text.type === 'ternary') {
        if (node.text.condition) node.text.condition = _jsToLua(node.text.condition);
        if (node.text.whenTrue) node.text.whenTrue = _jsToLua(node.text.whenTrue);
        if (node.text.whenFalse) node.text.whenFalse = _jsToLua(node.text.whenFalse);
      }
      if (node.text.type === 'template' && node.text.parts) {
        for (var pi = 0; pi < node.text.parts.length; pi++) {
          var part = node.text.parts[pi];
          if (part.expr) part.expr = _jsToLua(part.expr);
        }
      }
    }
  }

  // Handler expressions
  if (node.handler && typeof node.handler === 'string') {
    node.handler = _jsToLua(node.handler);
  }
  if (node.handler && typeof node.handler === 'object') {
    if (node.handler.jsBody) node.handler.jsBody = _jsToLua(node.handler.jsBody);
    if (node.handler.luaBody) node.handler.luaBody = _jsToLua(node.handler.luaBody);
    if (node.handler.body) node.handler.body = _jsToLua(node.handler.body);
  }

  // Conditional expressions
  if (node.condition && typeof node.condition === 'string') {
    node.condition = _jsToLua(node.condition);
  }
  if (node.ternaryCondition && typeof node.ternaryCondition === 'string') {
    node.ternaryCondition = _jsToLua(node.ternaryCondition);
  }

  // Variant styles
  if (node._variantStyles && Array.isArray(node._variantStyles)) {
    for (var vi = 0; vi < node._variantStyles.length; vi++) {
      var vs = node._variantStyles[vi];
      if (vs && typeof vs === 'object') {
        for (var vk in vs) {
          if (typeof vs[vk] === 'string') vs[vk] = _jsToLua(vs[vk]);
        }
      }
    }
  }

  // Recurse into children
  if (node.children && Array.isArray(node.children)) {
    for (var ci = 0; ci < node.children.length; ci++) {
      var child = node.children[ci];
      if (!child) continue;
      // Direct node child
      if (child.tag) sanitizeLuaNodeTree(child);
      // Wrapped node types
      if (child.node) sanitizeLuaNodeTree(child.node);
      if (child.trueNode) sanitizeLuaNodeTree(child.trueNode);
      if (child.falseNode) sanitizeLuaNodeTree(child.falseNode);
      // Conditional child
      if (child.condition && typeof child.condition === 'string') {
        child.condition = _jsToLua(child.condition);
      }
      if (child.ternaryCondition && typeof child.ternaryCondition === 'string') {
        child.ternaryCondition = _jsToLua(child.ternaryCondition);
      }
      // Map loop children
      if (child.type === 'mapLoop' || child.luaMapLoop) {
        var ml = child.luaMapLoop || child;
        if (ml.bodyNode) sanitizeLuaNodeTree(ml.bodyNode);
        if (ml.filterConditions) {
          for (var fi = 0; fi < ml.filterConditions.length; fi++) {
            if (typeof ml.filterConditions[fi] === 'string') {
              ml.filterConditions[fi] = _jsToLua(ml.filterConditions[fi]);
            }
            if (ml.filterConditions[fi] && ml.filterConditions[fi].expr) {
              ml.filterConditions[fi].expr = _jsToLua(ml.filterConditions[fi].expr);
            }
          }
        }
      }
      // Nested map
      if (child.nestedMap) {
        if (child.nestedMap.bodyNode) sanitizeLuaNodeTree(child.nestedMap.bodyNode);
      }
    }
  }
}

// ── Script block sanitizer ─────────────────────────────────────
// Script blocks are raw JS that runs in QuickJS at runtime.
// BUT when the emit path is Lua-tree, the script block vars
// are also mirrored into Lua state. The script block itself
// stays as JS (it runs in QJS), but any expressions that get
// embedded into LUA_LOGIC need conversion.
//
// This function converts a JS expression (from a script block
// or handler) to Lua for embedding in LUA_LOGIC.

function sanitizeJsExprForLua(expr) {
  return _jsToLua(expr);
}

// ── Contract Validator ─────────────────────────────────────────
// Walks the luaNode tree AFTER sanitization and checks for broken
// contract data. If this fails, the build stops — no Zig, no link.
//
// Returns an array of error strings. Empty = clean.

function validateContract(node) {
  var errors = [];
  _validateNode(node, 'root', errors);
  return errors;
}

function _looksLikeJsxTag(str) {
  return typeof str === 'string' && /<\/?[A-Za-z]/.test(str);
}

function _isSupportedPackedColorExpr(str) {
  return typeof str === 'string' &&
    /^Color\.rgb\(@intCast\(\((.+)\s*>>\s*16\)\s*&\s*0xFF\),\s*@intCast\(\((.+)\s*>>\s*8\)\s*&\s*0xFF\),\s*@intCast\((.+)\s*&\s*0xFF\)\)$/.test(str);
}

function _isDefinitelyFalse(cond) {
  if (typeof cond !== 'string') return false;
  var c = cond.replace(/\s+/g, ' ').trim();
  return c === '0' || c === 'false' || c === '(0)' || c === '(false)' ||
    c === '0 ~= 1 and 0' || c === '(0 ~= 1 and 0)' ||
    /(^| )and 0$/.test(c);
}

function _validateNode(node, path, errors) {
  if (!node || typeof node !== 'object') return;

  // JSX contamination — close tags in any string field
  for (var key in node) {
    var val = node[key];
    if (typeof val === 'string' && (val.indexOf('</Text') >= 0 || val.indexOf('</Box') >= 0 ||
        val.indexOf('</Pressable') >= 0 || val.indexOf('</ScrollView') >= 0 || val.indexOf('</Image') >= 0)) {
      errors.push(path + '.' + key + ': JSX close tag in contract value');
    }
  }

  // Condition field should not contain JSX
  if (_looksLikeJsxTag(node.condition)) {
    errors.push(path + '.condition: contains "<" — likely unparsed JSX');
  }

  // Text should not be raw JS operators
  if (typeof node.text === 'string') {
    if (node.text.indexOf('||') >= 0) errors.push(path + '.text: contains JS "||" operator');
    if (node.text.indexOf('&&') >= 0) errors.push(path + '.text: contains JS "&&" operator');
    if (node.text.indexOf('!==') >= 0) errors.push(path + '.text: contains JS "!==" operator');
    if (node.text.indexOf('props.') >= 0 && node.text.indexOf('props.') === 0) errors.push(path + '.text: unresolved props reference');
  }

  // Handler should not have Zig builtins
  if (typeof node.handler === 'string') {
    if (node.handler.indexOf('@intCast') >= 0) errors.push(path + '.handler: contains Zig @intCast');
    if (node.handler.indexOf('@as(') >= 0) errors.push(path + '.handler: contains Zig @as()');
    if (node.handler.indexOf('state.getSlot') >= 0) errors.push(path + '.handler: unresolved state.getSlot');
  }

  // Style values should not have raw Zig
  if (node.style && typeof node.style === 'object') {
    for (var sk in node.style) {
      var sv = node.style[sk];
      if (typeof sv === 'string' && sv.indexOf('@intCast') >= 0 && !_isSupportedPackedColorExpr(sv)) {
        errors.push(path + '.style.' + sk + ': contains Zig @intCast');
      }
    }
  }

  // Recurse children
  if (node.children && Array.isArray(node.children)) {
    for (var ci = 0; ci < node.children.length; ci++) {
      var child = node.children[ci];
      if (!child) continue;
      var cp = path + '.children[' + ci + ']';
      var childDefinitelyFalse = _isDefinitelyFalse(child.condition);
      if (child.tag || child.style || child.text !== undefined) _validateNode(child, cp, errors);
      if (!childDefinitelyFalse && child.node) _validateNode(child.node, cp + '.node', errors);
      if (!childDefinitelyFalse && child.trueNode) _validateNode(child.trueNode, cp + '.trueNode', errors);
      if (!childDefinitelyFalse && child.falseNode) _validateNode(child.falseNode, cp + '.falseNode', errors);
      if (_looksLikeJsxTag(child.condition)) {
        errors.push(cp + '.condition: contains "<" — likely unparsed JSX');
      }
      // Map loop body
      var ml = child.luaMapLoop || child;
      if (!childDefinitelyFalse && ml.bodyNode) _validateNode(ml.bodyNode, cp + '.bodyNode', errors);
      if (child.nestedMap && child.nestedMap.bodyNode) {
        _validateNode(child.nestedMap.bodyNode, cp + '.nestedMap.bodyNode', errors);
      }
    }
  }
}
