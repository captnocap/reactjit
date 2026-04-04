// Mod expression transpiler — extracted from mod.js

function modTranspileType(ts) {
  const t = ts.trim();
  // Type? → optional (suffix form used by intent syntax)
  if (t.endsWith('?')) return '?' + modTranspileType(t.slice(0, -1));
  if (t === 'int') return 'i64';
  if (t === 'i32') return 'i32';
  if (t === 'i64') return 'i64';
  if (t === 'u8') return 'u8';
  if (t === 'u16') return 'u16';
  if (t === 'u32') return 'u32';
  if (t === 'u64') return 'u64';
  if (t === 'usize') return 'usize';
  if (t === 'f32') return 'f32';
  if (t === 'f64') return 'f64';
  if (t === 'float') return 'f32';
  if (t === 'number') return 'i64';
  if (t === 'bool' || t === 'boolean') return 'bool';
  if (t === 'string') return '[]const u8';
  if (t === 'void') return 'void';
  if (t.startsWith('fn(') || t.startsWith('fn (')) return modTranspileFnType(t);
  // ?Type → optional
  if (t.startsWith('?')) return '?' + modTranspileType(t.slice(1));
  // !Type → error union
  if (t.startsWith('!')) return '!' + modTranspileType(t.slice(1));
  // TypeName[N] → [N]TypeName (fixed array)
  const arrMatch = t.match(/^(\w+)\[([A-Za-z_]\w*|\d+)\]$/);
  if (arrMatch) return '[' + arrMatch[2] + ']' + modTranspileType(arrMatch[1]);
  // Type[] → slice — []Type
  if (t.endsWith('[]')) return '[]' + modTranspileType(t.slice(0, -2));
  // Pass through (user-defined types, Zig types)
  return t;
}

function modTranspileFnType(ts) {
  const m = ts.trim().match(/^fn\s*\((.*)\)\s*->\s*(.+)$/);
  if (!m) return ts.trim();
  return '*const fn (' + modTranspileParams(m[1].trim()) + ') ' + modTranspileType(m[2].trim());
}

function modTranspileDefault(val, zigType, typeNames) {
  const v = val.trim();
  // Boolean
  if (v === 'true' || v === 'false') return v;
  // Null
  if (v === 'null') return 'null';
  if (v === 'none' && zigType && zigType.startsWith('?')) return 'null';
  // Numeric
  if (/^-?\d+(\.\d+)?$/.test(v)) return v;
  // String literal
  if (v.startsWith('"') || v.startsWith("'")) return v.replace(/'/g, '"');
  // Enum variant — identifier (any case) that isn't a type name → prefix with .
  if (/^\w+$/.test(v) && typeNames.indexOf(v) === -1) return '.' + v;
  // Struct init
  if (v === '{}') return '.{}';
  return v;
}

function modTranspileForExpr(expr, baseArr, itemVar) {
  // Replace item.field with baseArr[_i].field
  let e = expr.replace(new RegExp('\\b' + itemVar + '\\.', 'g'), baseArr + '[_i].');
  // Replace bare item with baseArr[_i]
  e = e.replace(new RegExp('\\b' + itemVar + '\\b', 'g'), baseArr + '[_i]');
  return modTranspileExpr(e);
}

function modTranspileExpr(expr, ctx) {
  let e = expr.trim();
  // exact → ==
  e = e.replace(/\bexact\b/g, '==');
  // Prefix known enum variants with . when used as values (after = or ==)
  // Do NOT prefix when used as LHS of comparison (e.g. paused == true where paused is a var)
  if (_modEnumVariants && _modEnumVariants.length > 0) {
    const localNames = (ctx && ctx.localNames) || [];
    for (let v = 0; v < _modEnumVariants.length; v++) {
      var vname = _modEnumVariants[v];
      if (localNames.indexOf(vname) !== -1) continue;
      // Match after = (assignment or comparison RHS), comma, semicolon, open paren
      // Use capture group instead of variable-length lookbehind for QuickJS compat
      e = e.replace(new RegExp('([=,;(] ?)' + vname + '(?=[\\s;,)=]|$)', 'g'), '$1.' + vname);
      // Also match after == with space
      e = e.replace(new RegExp('(== ?)' + vname + '(?=[\\s;,)=]|$)', 'g'), '$1.' + vname);
      // Bare variant as entire expression
      if (e === vname) e = '.' + vname;
    }
  }
  // and / or
  e = e.replace(/\band\b/g, 'and');
  e = e.replace(/\bor\b/g, 'or');
  // !== and === → != and ==
  e = e.replace(/===/g, '==');
  e = e.replace(/!==/g, '!=');
  // || → or, && → and
  e = e.replace(/\s*\|\|\s*/g, ' or ');
  e = e.replace(/\s*&&\s*/g, ' and ');
  // ?? → orelse
  e = e.replace(/\s*\?\?\s*/g, ' orelse ');
  const ternaryExpr = rewriteExpressionTernary(e, ctx);
  if (ternaryExpr) e = ternaryExpr;
  // ── Stdlib method mapping ──
  // Pattern: match complex LHS (words, dots, brackets) before method call
  // x.indexOf(str) → std.mem.indexOf(u8, x, str) orelse x.len
  e = e.replace(/([\w\[\]_.]+)\.indexOf\(([^)]+)\)/g, function(_, obj, arg) {
    var a = arg.trim().replace(/'/g, '"');
    return 'std.mem.indexOf(u8, ' + obj + ', ' + a + ') orelse ' + obj + '.len';
  });
  // x.indexOfChar(c) → std.mem.indexOfScalar(u8, x, c) orelse x.len
  e = e.replace(/([\w\[\]_.]+)\.indexOfChar\(([^)]+)\)/g, function(_, obj, arg) {
    return 'std.mem.indexOfScalar(u8, ' + obj + ', ' + arg.trim() + ') orelse ' + obj + '.len';
  });
  // a.eql(b) → std.mem.eql(u8, a, b)
  e = e.replace(/([\w\[\]_.]+)\.eql\(([^)]+)\)/g, function(_, obj, arg) {
    return 'std.mem.eql(u8, ' + obj + ', ' + arg.trim() + ')';
  });
  // parseInt(str) → std.fmt.parseInt(i32, str, 10) catch 0
  e = e.replace(/parseInt\(([^)]+)\)/g, function(_, arg) {
    return 'std.fmt.parseInt(i32, ' + arg.trim() + ', 10) catch 0';
  });
  // ── FFI call prefixing ──
  if (_modFfiSymbols) {
    for (var sym in _modFfiSymbols) {
      var info = _modFfiSymbols[sym];
      e = e.replace(new RegExp('(?<!\\w\\.)\\b' + sym + '\\(', 'g'), info.prefix + '.' + info.fn + '(');
    }
  }
  // ── Posix constant mapping ──
  // AF_INET → posix.AF.INET, SOCK_STREAM → posix.SOCK.STREAM, O_RDONLY → posix.O.RDONLY, etc.
  if (_modFfiSymbols) {
    // Check if any FFI import is from std.posix
    var hasPosix = false;
    for (var s in _modFfiSymbols) { if (_modFfiSymbols[s].prefix === 'posix') hasPosix = true; }
    if (hasPosix) {
      // Map UPPER_CASE constants: PREFIX_REST → posix.PREFIX.REST
      e = e.replace(/\b(AF|SOCK|IPPROTO|O|POLL|MSG|SO|SOL|SHUT|F|FD|SEEK|MAP|PROT|CLOCK|SIG|SA|S_I|EPOLL|IN)_([A-Z0-9_]+)\b/g, function(_, prefix, rest) {
        return 'posix.' + prefix + '.' + rest;
      });
    }
  }
  // ── String concatenation → std.fmt.bufPrint ──
  // Only trigger when expression contains a string literal with +
  if (e.indexOf(" + ") !== -1 && e.indexOf("'") !== -1) {
    var bufPrint = transpileStringConcat(e);
    if (bufPrint) return bufPrint;
  }
  return rewriteKnownFunctionCalls(e, ctx);
}

function transpileStringConcat(expr) {
  // Split on + but respect quoted strings
  var parts = [];
  var cur = '';
  var inStr = false;
  for (var c = 0; c < expr.length; c++) {
    if (expr[c] === "'" && !inStr) { inStr = true; cur += expr[c]; continue; }
    if (expr[c] === "'" && inStr) { inStr = false; cur += expr[c]; continue; }
    if (!inStr && expr[c] === '+' && (c === 0 || expr[c - 1] === ' ') && (c + 1 >= expr.length || expr[c + 1] === ' ')) {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += expr[c];
  }
  if (cur.trim()) parts.push(cur.trim());
  if (parts.length < 2) return null;
  // Build format string and args
  var fmt = '';
  var args = [];
  for (var p = 0; p < parts.length; p++) {
    var part = parts[p];
    if (part.startsWith("'") && part.endsWith("'")) {
      // String literal — inline into format
      fmt += part.slice(1, -1);
    } else {
      // Variable — determine format specifier
      // If it looks numeric (or is a .len or bare int var), use {d}
      if (part.match(/\.len$/) || part.match(/^-?\d/) || part === 'code' || part.match(/count|size|len|num|idx|id$/i)) {
        fmt += '{d}';
      } else {
        fmt += '{s}';
      }
      args.push(part);
    }
  }
  var argStr = args.length === 1 ? args[0] : ' ' + args.join(', ') + ' ';
  if (args.length === 1) argStr = args[0];
  else argStr = ' ' + args.join(', ') + ' ';
  return 'std.fmt.bufPrint(&buf, "' + fmt + '", .{' + argStr + '}) catch ""';
}

function isComparison(lhs) {
  const t = lhs.trim();
  return t.endsWith('>') || t.endsWith('<') || t.endsWith('!') || t.endsWith('=');
}

function inferTypeFromValue(val) {
  const v = val.trim();
  if (v === '0' || /^-?\d+$/.test(v)) return 'i32';
  if (/^-?\d+\.\d+$/.test(v)) return 'f32';
  if (v === 'true' || v === 'false') return 'bool';
  if (v.startsWith('"') || v.startsWith("'")) return '[]const u8';
  return null; // can't infer — don't declare as var
}

// Split struct literal fields respecting brace nesting, then transpile each
function transpileStructLiteral(inner) {
  // Split by commas that aren't inside nested { }
  const fields = [];
  let depth = 0; let cur = '';
  for (let c = 0; c < inner.length; c++) {
    if (inner[c] === '{') depth++;
    if (inner[c] === '}') depth--;
    if (inner[c] === ',' && depth === 0) { fields.push(cur.trim()); cur = ''; continue; }
    cur += inner[c];
  }
  if (cur.trim()) fields.push(cur.trim());
  // Transpile each field: key: value → .key = value
  const zigFields = fields.map(function(f) {
    const kv = f.match(/^(\w+):\s*(.+)$/);
    if (!kv) return f;
    const val = kv[2].trim();
    // Check if value is a nested struct literal { ... }
    const nestedMatch = val.match(/^\{(.+)\}$/);
    if (nestedMatch) return '.' + kv[1] + ' = ' + transpileStructLiteral(nestedMatch[1]);
    return '.' + kv[1] + ' = ' + modTranspileExpr(val);
  });
  return '.{ ' + zigFields.join(', ') + ' }';
}

function modTranspileValue(expr, ctx) {
  const t = expr.trim();
  const structMatch = t.match(/^\{([\s\S]*)\}$/);
  if (structMatch) return transpileStructLiteral(structMatch[1]);
  return modTranspileExpr(t, ctx);
}

function modTranspileForExprV2(expr, baseArr, itemVar, ctx) {
  let e = expr;
  e = e.replace(new RegExp('\\b' + itemVar + '\\.', 'g'), baseArr + '[_i].');
  e = e.replace(new RegExp('\\b' + itemVar + '\\b', 'g'), baseArr + '[_i]');
  return modTranspileExpr(applyOptionalUnwraps(e, (ctx && ctx.narrowedVars) || []), ctx);
}
