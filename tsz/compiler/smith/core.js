// ── Smith core primitives ──────────────────────────────────────────

const ZIG_KEYWORDS = ['error', 'type', 'test', 'return', 'break', 'continue', 'resume', 'cancel', 'suspend', 'align', 'async', 'await', 'catch', 'try', 'undefined', 'null', 'inline', 'comptime', 'volatile', 'extern', 'export', 'pub', 'fn', 'var', 'const', 'struct', 'enum', 'union', 'opaque', 'unreachable'];

function zigEscape(name) {
  if (ZIG_KEYWORDS.indexOf(name) !== -1) return '@"' + name + '"';
  return name;
}

function leftFoldExpr(expr) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === '(') depth++;
    else if (expr[i] === ')') depth--;
    else if (expr[i] === '+' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += expr[i];
  }
  parts.push(cur.trim());
  if (parts.length <= 1) return expr;
  let result = parts[0];
  for (let i = 1; i < parts.length; i++) result = `(${result} + ${parts[i]})`;
  return result;
}

function utf8ByteLen(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) n++;
    else if (c < 0x800) n += 2;
    else if (c >= 0xD800 && c <= 0xDBFF) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

function indentLines(text, prefix) {
  const pad = prefix === undefined ? '    ' : prefix;
  return String(text).split('\n').map(function(line) {
    return line.length > 0 ? pad + line : line;
  }).join('\n');
}

function zigStringLiteral(value) {
  return '"' + String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/"/g, '\\"') + '"';
}

function zigEscapeFormatText(value) {
  return String(value).replace(/\{/g, '{{').replace(/\}/g, '}}');
}

function mkCursor(raw, source) {
  const lines = raw.trim().split('\n');
  const count = lines.length;
  const kinds = new Array(count);
  const starts = new Array(count);
  const ends = new Array(count);
  for (let i = 0; i < count; i++) {
    const p = lines[i].split(' ');
    kinds[i] = parseInt(p[0]);
    starts[i] = parseInt(p[1]);
    ends[i] = parseInt(p[2]);
  }
  return {
    kinds, starts, ends, count, source, pos: 0,
    kind()      { return this.kinds[this.pos]; },
    text()      { return this._byteSlice(this.starts[this.pos], this.ends[this.pos]); },
    textAt(i)   { return this._byteSlice(this.starts[i], this.ends[i]); },
    _byteSlice(start, end) {
      if (this._isAscii === undefined) {
        this._isAscii = true;
        for (let i = 0; i < this.source.length; i++) {
          if (this.source.charCodeAt(i) > 127) {
            this._isAscii = false;
            break;
          }
        }
        if (!this._isAscii) {
          this._b2c = [];
          let byteIdx = 0;
          for (let ci = 0; ci < this.source.length; ci++) {
            this._b2c[byteIdx] = ci;
            const code = this.source.charCodeAt(ci);
            if (code < 0x80) byteIdx += 1;
            else if (code < 0x800) byteIdx += 2;
            else if (code >= 0xD800 && code <= 0xDBFF) {
              byteIdx += 4;
              ci++;
            } else byteIdx += 3;
          }
          this._b2c[byteIdx] = this.source.length;
        }
      }
      if (this._isAscii) return this.source.slice(start, end);
      const cs = this._b2c[start] !== undefined ? this._b2c[start] : start;
      const ce = this._b2c[end] !== undefined ? this._b2c[end] : end;
      return this.source.slice(cs, ce);
    },
    kindAt(i)   { return this.kinds[i]; },
    advance()   { if (this.pos < this.count) this.pos++; },
    isIdent(n)  { return this.kind() === TK.identifier && this.text() === n; },
    save()      { return this.pos; },
    restore(p)  { this.pos = p; },
  };
}

let ctx = {};
function resetCtx() {
  ctx = {
    stateSlots: [],
    components: [],
    propStack: {},
    inlineComponent: null,
    componentChildren: null,
    handlers: [],
    handlerCount: 0,
    conditionals: [],
    dynTexts: [],
    dynColors: [],
    arrayComments: [],
    dynCount: 0,
    arrayCounter: 0,
    arrayDecls: [],
    slotRemap: {},
    objectArrays: [],
    maps: [],
    scriptBlock: null,
    luaBlock: null,
    scriptFuncs: [],
    classifiers: {},
    variantNames: [],
    variantBindings: [],
    _sourceTier: null,
    renderLocals: {},
    propsObjectName: null,
    _needsRuntimeLog: false,
    _runtimeLogCounter: 0,
    _debugLines: [],
    _unresolvedClassifiers: [],
    _droppedExpressions: [],
    _unknownSubsystemTags: [],
    _ignoredModuleBlocks: [],
    _undefinedJSCalls: [],
    _duplicateJSVars: [],
    _jsDynTexts: [],
    _luaDynTexts: [],
    _glyphLog: [],
    _literalTextMode: false,
  };
}

function findSlot(name) {
  if (ctx.slotRemap && name in ctx.slotRemap) return ctx.slotRemap[name];
  for (let i = 0; i < ctx.stateSlots.length; i++) {
    if (ctx.stateSlots[i].getter === name || ctx.stateSlots[i].setter === name) return i;
  }
  return -1;
}

function isGetter(name) {
  if (ctx.slotRemap && name in ctx.slotRemap) return true;
  return ctx.stateSlots.some(s => s.getter === name);
}

function isSetter(name) {
  if (ctx.slotRemap && name in ctx.slotRemap) return true;
  return ctx.stateSlots.some(s => s.setter === name);
}

function slotGet(name) {
  const i = findSlot(name);
  if (i < 0) return name;
  const s = ctx.stateSlots[i];
  if (s.type === 'string') return `state.getSlotString(${i})`;
  if (s.type === 'float') return `state.getSlotFloat(${i})`;
  if (s.type === 'boolean') return `state.getSlotBool(${i})`;
  return `state.getSlot(${i})`;
}

// Resolve object state field access: cursorPosition.line → state.getSlot(N)
// Advances cursor past name.field if matched. Returns Zig expr or null.
function tryResolveObjectStateAccess(c) {
  if (c.kind() !== TK.identifier) return null;
  if (!ctx._objectStateShapes) return null;
  var name = c.text();
  var shape = ctx._objectStateShapes[name];
  if (!shape) return null;
  if (c.pos + 2 >= c.count || c.kindAt(c.pos + 1) !== TK.dot || c.kindAt(c.pos + 2) !== TK.identifier) return null;
  var field = c.textAt(c.pos + 2);
  var flatGetter = name + '_' + field;
  var slotIdx = findSlot(flatGetter);
  if (slotIdx < 0) return null;
  c.advance(); c.advance(); c.advance(); // skip name . field
  return slotGet(flatGetter);
}

function peekPropsAccess(c) {
  if (!ctx.propsObjectName || c.kind() !== TK.identifier || c.text() !== ctx.propsObjectName) return null;
  if (c.pos + 2 >= c.count) return null;
  if (c.kindAt(c.pos + 1) !== TK.dot || c.kindAt(c.pos + 2) !== TK.identifier) return null;
  const field = c.textAt(c.pos + 2);
  if (ctx.propStack && ctx.propStack[field] !== undefined) return { field: field, value: ctx.propStack[field] };
  return null;
}

function skipPropsAccess(c) {
  c.advance();
  c.advance();
  c.advance();
}

function markRuntimeLogNeeded() {
  if (!ctx || typeof ctx !== 'object') return;
  ctx._needsRuntimeLog = true;
  if (typeof ctx._runtimeLogCounter !== 'number') ctx._runtimeLogCounter = 0;
}

function nextRuntimeLogId() {
  markRuntimeLogNeeded();
  ctx._runtimeLogCounter += 1;
  return ctx._runtimeLogCounter;
}

function zigLogCall(message, opts) {
  const o = opts || {};
  const level = o.level || 'info';
  const category = o.category || 'tick';
  const fmt = o.fmt || zigEscapeFormatText(message);
  const args = o.args || '.{}';
  markRuntimeLogNeeded();
  return `smith_log.${level}(.${category}, ${zigStringLiteral(fmt)}, ${args});`;
}

// Runtime-only wrappers for generated Zig. Do not use these inside top-level
// static initializers; the log call must land in a function/body context.
function zigLogStmt(label, body, opts) {
  const o = opts || {};
  const lines = [];
  if (o.enter !== false) {
    lines.push(zigLogCall(o.enterMessage || label, {
      level: o.level,
      category: o.category,
      fmt: o.enterFmt,
      args: o.enterArgs,
    }));
  }
  if (body) lines.push(String(body).replace(/\s+$/, ''));
  if (o.exit) {
    lines.push(zigLogCall(o.exitMessage || (label + ' done'), {
      level: o.exitLevel || o.level,
      category: o.exitCategory || o.category,
      fmt: o.exitFmt,
      args: o.exitArgs,
    }));
  }
  return `{\n${indentLines(lines.join('\n'), '    ')}\n}`;
}

function zigLogExpr(label, expr, opts) {
  const o = opts || {};
  const id = nextRuntimeLogId();
  const blockLabel = `_smith_log_${id}`;
  const tempName = `_smith_log_value_${id}`;
  const sourceExpr = String(expr).trim().replace(/;$/, '');
  const fmt = o.fmt || (zigEscapeFormatText(label) + ' = {any}');
  return `${blockLabel}: {\n${indentLines(`const ${tempName} = ${sourceExpr};\n${zigLogCall(label, {
    level: o.level,
    category: o.category,
    fmt: fmt,
    args: o.args || `.{ ${tempName} }`,
  })}\nbreak :${blockLabel} ${tempName};`, '    ')}\n}`;
}

function zigPrintStmt(label, body, opts) {
  return zigLogStmt(label, body, opts);
}

function zigPrintExpr(label, expr, opts) {
  return zigLogExpr(label, expr, opts);
}

// ── Const OA resolution helpers ──────────────────────────────────

// Detect identifier[number] or identifier[number].field where identifier is a const OA.
// Returns { value, skip, isRowRef? } or null.
function resolveConstOaAccess(c) {
  if (c.kind() !== TK.identifier) return null;
  var name = c.text();
  var oa = null;
  for (var _oi = 0; _oi < ctx.objectArrays.length; _oi++) {
    if (ctx.objectArrays[_oi].getter === name && ctx.objectArrays[_oi].isConst && ctx.objectArrays[_oi].constData) {
      oa = ctx.objectArrays[_oi];
      break;
    }
  }
  if (!oa) return null;

  // Check for [index] pattern: identifier [ number ]
  if (c.pos + 3 >= c.count) return null;
  if (c.kindAt(c.pos + 1) !== TK.lbracket) return null;
  if (c.kindAt(c.pos + 2) !== TK.number) return null;
  if (c.kindAt(c.pos + 3) !== TK.rbracket) return null;

  var rowIdx = parseInt(c.textAt(c.pos + 2));
  if (rowIdx >= oa.constData.length) return null;

  // Check for .field after [index]: identifier [ number ] . field
  if (c.pos + 5 < c.count && c.kindAt(c.pos + 4) === TK.dot && c.kindAt(c.pos + 5) === TK.identifier) {
    var field = c.textAt(c.pos + 5);
    var data = oa.constData[rowIdx][field];
    if (data === undefined) return null;
    var fieldInfo = null;
    for (var _fi = 0; _fi < oa.fields.length; _fi++) {
      if (oa.fields[_fi].name === field) { fieldInfo = oa.fields[_fi]; break; }
    }
    var val = (fieldInfo && fieldInfo.type === 'string') ? '"' + data + '"' : String(data);
    return { value: val, skip: 6 };
  }

  // Just [index] — return a const OA row reference marker
  return { value: '\x01CONST_OA:' + oa.oaIdx + ':' + rowIdx, skip: 4, isRowRef: true };
}

// Resolve .field access on a const OA row reference marker string.
// Returns resolved value string or null.
function resolveConstOaFieldFromRef(refValue, field) {
  if (typeof refValue !== 'string' || refValue.charCodeAt(0) !== 1) return null;
  var parts = refValue.substring(1).split(':');
  if (parts[0] !== 'CONST_OA') return null;
  var oaIdx = parseInt(parts[1]);
  var rowIdx = parseInt(parts[2]);
  var oa = ctx.objectArrays[oaIdx];
  if (!oa || !oa.constData || !oa.constData[rowIdx]) return null;
  var data = oa.constData[rowIdx][field];
  if (data === undefined) return null;
  var fieldInfo = null;
  for (var _fi = 0; _fi < oa.fields.length; _fi++) {
    if (oa.fields[_fi].name === field) { fieldInfo = oa.fields[_fi]; break; }
  }
  return (fieldInfo && fieldInfo.type === 'string') ? '"' + data + '"' : String(data);
}
