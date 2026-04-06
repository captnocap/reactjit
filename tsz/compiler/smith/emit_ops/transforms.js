// ── JS/Lua syntax transforms ──
// Extracted from emit_split.js per FUNCTIONS_MANIFEST.
// luaTransform, jsTransform

// ── JS→Lua method/syntax transforms ──
// Applied to handler luaBody and LUA_LOGIC script content.
// Ported from love2d/cli/lib/tsl.mjs method call transforms.
function luaTransform(code) {
  if (!code) return code;
  let s = code;
  // Operators: !== → ~=, === → ==, != → ~=, || → or, && → and, ! → not
  s = s.replace(/!==/g, '~=');
  s = s.replace(/===/g, '==');
  s = s.replace(/!=/g, '~=');
  s = s.replace(/\|\|/g, ' or ');
  s = s.replace(/&&/g, ' and ');
  // !expr → not expr (but not != which is already handled)
  s = s.replace(/!(?!=|=)/g, 'not ');
  // Ternary: a ? b : c → (a) and (b) or (c)
  // Find ? at any depth, then find : at the same depth
  var _tDep = 0, _qPos = -1, _qDep = -1;
  for (var ti = 0; ti < s.length; ti++) {
    if (s[ti] === '(' || s[ti] === '[') _tDep++;
    else if (s[ti] === ')' || s[ti] === ']') _tDep--;
    else if (s[ti] === '?' && s[ti + 1] !== '?' && s[ti + 1] !== '.') { _qPos = ti; _qDep = _tDep; break; }
  }
  if (_qPos > 0) {
    var _cPos = -1;
    _tDep = _qDep;
    for (var ci = _qPos + 1; ci < s.length; ci++) {
      if (s[ci] === '(' || s[ci] === '[') _tDep++;
      else if (s[ci] === ')' || s[ci] === ']') _tDep--;
      else if (s[ci] === ':' && _tDep === _qDep) { _cPos = ci; break; }
    }
    if (_cPos > 0) {
      var tCond = s.substring(0, _qPos).trim();
      var tTrue = s.substring(_qPos + 1, _cPos).trim();
      var tFalse = s.substring(_cPos + 1).trim();
      s = tCond + ' and ' + tTrue + ' or ' + tFalse;
    }
  }
  // Control flow: if/else/elseif/while/for → Lua equivalents
  // } else if (cond) { → elseif cond then (must come before } else {)
  s = s.replace(/\}\s*else\s+if\s*\(([^)]+)\)\s*\{/g, ' elseif $1 then ');
  // } else { → else
  s = s.replace(/\}\s*else\s*\{/g, ' else ');
  // if (cond) { → if cond then
  s = s.replace(/\bif\s*\(([^)]+)\)\s*\{/g, 'if $1 then ');
  // while (cond) { → while cond do
  s = s.replace(/\bwhile\s*\(([^)]+)\)\s*\{/g, 'while $1 do ');
  // for (const/let x of arr) { → for _, x in ipairs(arr) do
  s = s.replace(/\bfor\s*\(\s*(?:const|let|var)\s+(\w+)\s+of\s+(\w+)\)\s*\{/g, 'for _, $1 in ipairs($2) do ');
  // for (const/let x in obj) { → for x, _ in pairs(obj) do
  s = s.replace(/\bfor\s*\(\s*(?:const|let|var)\s+(\w+)\s+in\s+(\w+)\)\s*\{/g, 'for $1, _ in pairs($2) do ');
  // Standalone } → end (block closers)
  s = s.replace(/;\s*\}/g, '; end ');
  s = s.replace(/\}\s*$/g, ' end');
  s = s.replace(/\bthen\s+end\b/g, 'then'); // undo false "end" after empty then
  // const/let/var → local
  s = s.replace(/\b(const|let|var)\s+/g, 'local ');
  // null/undefined → nil
  s = s.replace(/\bnull\b/g, 'nil');
  s = s.replace(/\bundefined\b/g, 'nil');
  // .length → #
  s = s.replace(/(\w+)\.length\b/g, '#$1');
  // console.log(...) → print(...)
  s = s.replace(/console\.(log|warn|error)\(/g, 'print(');
  // Math methods
  s = s.replace(/Math\.floor\(/g, 'math.floor(');
  s = s.replace(/Math\.ceil\(/g, 'math.ceil(');
  s = s.replace(/Math\.round\(([^)]+)\)/g, 'math.floor($1 + 0.5)');
  s = s.replace(/Math\.abs\(/g, 'math.abs(');
  s = s.replace(/Math\.sqrt\(/g, 'math.sqrt(');
  s = s.replace(/Math\.min\(/g, 'math.min(');
  s = s.replace(/Math\.max\(/g, 'math.max(');
  s = s.replace(/Math\.sin\(/g, 'math.sin(');
  s = s.replace(/Math\.cos\(/g, 'math.cos(');
  s = s.replace(/Math\.pow\(/g, 'math.pow(');
  s = s.replace(/Math\.random\(\)/g, 'math.random()');
  s = s.replace(/Math\.PI\b/g, 'math.pi');
  // parseInt/parseFloat → tonumber
  s = s.replace(/parseInt\(/g, 'tonumber(');
  s = s.replace(/parseFloat\(/g, 'tonumber(');
  s = s.replace(/Number\(/g, 'tonumber(');
  // String methods
  s = s.replace(/(\w+)\.toUpperCase\(\)/g, 'string.upper($1)');
  s = s.replace(/(\w+)\.toLowerCase\(\)/g, 'string.lower($1)');
  s = s.replace(/(\w+)\.trim\(\)/g, '$1:match("^%s*(.-)%s*$")');
  s = s.replace(/(\w+)\.startsWith\(([^)]+)\)/g, '(string.sub($1, 1, #$2) == $2)');
  s = s.replace(/(\w+)\.endsWith\(([^)]+)\)/g, '(string.sub($1, -#$2) == $2)');
  s = s.replace(/(\w+)\.includes\(([^)]+)\)/g, '(string.find($1, $2, 1, true) ~= nil)');
  s = s.replace(/(\w+)\.indexOf\(([^)]+)\)/g, '(string.find($1, $2, 1, true) or 0)');
  s = s.replace(/(\w+)\.replace\(([^,]+),\s*([^)]+)\)/g, 'string.gsub($1, $2, $3)');
  s = s.replace(/(\w+)\.split\(([^)]+)\)/g, '__split($1, $2)');
  s = s.replace(/(\w+)\.join\(([^)]*)\)/g, 'table.concat($1, $2)');
  s = s.replace(/(\w+)\.toString\(\)/g, 'tostring($1)');
  // Array methods
  s = s.replace(/(\w+)\.push\(([^)]+)\)/g, 'table.insert($1, $2)');
  s = s.replace(/(\w+)\.pop\(\)/g, 'table.remove($1)');
  s = s.replace(/(\w+)\.shift\(\)/g, 'table.remove($1, 1)');
  s = s.replace(/(\w+)\.unshift\(([^)]+)\)/g, 'table.insert($1, 1, $2)');
  s = s.replace(/(\w+)\.sort\(\)/g, 'table.sort($1)');
  s = s.replace(/(\w+)\.reverse\(\)/g, '__reverse($1)');
  // JSON
  s = s.replace(/JSON\.stringify\(/g, '__jsonEncode(');
  s = s.replace(/JSON\.parse\(/g, '__jsonDecode(');
  // typeof → type()
  s = s.replace(/typeof\s+(\w+)/g, 'type($1)');
  // Template literals `...${expr}...` → "..." .. expr .. "..."
  s = s.replace(/`([^`]*)`/g, function(_, content) {
    var parts = [];
    var last = 0;
    var re = /\$\{([^}]+)\}/g;
    var m;
    while ((m = re.exec(content)) !== null) {
      if (m.index > last) parts.push('"' + content.slice(last, m.index) + '"');
      parts.push(m[1]);
      last = m.index + m[0].length;
    }
    if (last < content.length) parts.push('"' + content.slice(last) + '"');
    return parts.join(' .. ') || '""';
  });
  return s;
}

// Transform JS handler/script code for QuickJS (lighter — just fix operators)
function jsTransform(code) {
  if (!code) return code;
  var s = code;
  // Lua operators that leaked into JS bodies → convert back
  s = s.replace(/\band\b/g, '&&');
  s = s.replace(/\bor\b/g, '||');
  s = s.replace(/~=/g, '!=');
  s = s.replace(/\bnot\b/g, '!');
  s = s.replace(/ \.\. /g, ' + ');
  return s;
}
