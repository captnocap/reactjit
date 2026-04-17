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

function _findWidgetCtx(value) {
  if (typeof value !== 'string') return -1;
  return value.indexOf('widget');
}

function escapeDoubleQuotedString(value) {
  var idx = _findWidgetCtx(value);
  if (idx >= 0) {
    var lo = Math.max(0, idx - 30);
    var hi = Math.min(value.length, idx + 30);
    print('[ESC_TRACE] in[' + idx + ']: ' + JSON.stringify(value.slice(lo, hi)));
  }
  var out = String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/"/g, '\\"');
  var idx2 = _findWidgetCtx(out);
  if (idx >= 0) {
    var lo2 = Math.max(0, idx2 - 30);
    var hi2 = Math.min(out.length, idx2 + 30);
    print('[ESC_TRACE] out[' + idx2 + ']: ' + JSON.stringify(out.slice(lo2, hi2)));
  }
  return out;
}

function zigStringLiteral(value) {
  var idx = _findWidgetCtx(value);
  if (idx >= 0) {
    var lo = Math.max(0, idx - 30);
    var hi = Math.min(value.length, idx + 30);
    print('[ZSL_TRACE] in[' + idx + ']: ' + JSON.stringify(value.slice(lo, hi)));
  }
  var out = '"' + escapeDoubleQuotedString(value) + '"';
  var idx2 = _findWidgetCtx(out);
  if (idx >= 0) {
    var lo2 = Math.max(0, idx2 - 30);
    var hi2 = Math.min(out.length, idx2 + 30);
    print('[ZSL_TRACE] out[' + idx2 + ']: ' + JSON.stringify(out.slice(lo2, hi2)));
  }
  return out;
}

function luaStringLiteral(value) {
  return '"' + escapeDoubleQuotedString(value) + '"';
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
    text()      { return this._normStr(this.pos, this._byteSlice(this.starts[this.pos], this.ends[this.pos])); },
    textAt(i)   { return this._normStr(i, this._byteSlice(this.starts[i], this.ends[i])); },
    // Normalize single-quoted JS strings to double-quoted for Zig output.
    // 'hello' → "hello", 'it\'s' → "it's", 'say "hi"' → "say \"hi\""
    _normStr(i, raw) {
      if (this.kinds[i] !== TK.string || raw.length < 2 || raw[0] !== "'") return raw;
      var inner = raw.slice(1, -1);
      inner = inner.replace(/\\'/g, "'");       // unescape \'  → '
      inner = inner.replace(/"/g, '\\"');        // escape   "   → \"
      return '"' + inner + '"';
    },
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
    nativeFuncs: [],
    functionEntries: [],
    functionBackends: null,
    nativePlan: null,
    classifiers: {},
    variantNames: [],
    variantBindings: [],
    _sourceTier: null,
    renderLocals: {},
    _renderLocalRaw: {},
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
    _computedMapCounter: 0,
    _glyphLog: [],
    _literalTextMode: false,
    // Pattern trace — records every pattern match for diagnostics
    _patternTrace: [],
    _patternDepth: 0,
    _patternTraceEnabled: !!globalThis.__DBG_COMPILER,
    // Route plan — built by preflight route scan, read by emit + routing check
    _source: null,
    _inputPatterns: null,
    _routePlan: null,
    // Monotonic id for Lua-tree ScrollView scroll offset persistence (_scrollY[id])
    nextScrollPersistSlot: 0,
  };
}

// Record a pattern match in the trace
function tracePattern(patternId, name, detail) {
  if (!ctx._patternTraceEnabled) return;
  var indent = '';
  for (var i = 0; i < ctx._patternDepth; i++) indent += '  ';
  ctx._patternTrace.push(indent + 'p' + String(patternId).padStart(3, '0') + ' ' + name + (detail ? ' (' + detail + ')' : ''));
}

// Record a pattern failure / unknown
function tracePatternFail(tokenText, pos, context) {
  if (!ctx._patternTraceEnabled) return;
  var indent = '';
  for (var i = 0; i < ctx._patternDepth; i++) indent += '  ';
  ctx._patternTrace.push(indent + '??? UNKNOWN at "' + (tokenText || '').substring(0, 40) + '" pos=' + pos + (context ? ' in=' + context : ''));
}

// Increase/decrease trace depth for nesting
function traceEnter() { if (ctx._patternTraceEnabled) ctx._patternDepth++; }
function traceExit() { if (ctx._patternTraceEnabled && ctx._patternDepth > 0) ctx._patternDepth--; }

// Export trace to global for forge to read
function dumpPatternTrace() {
  if (ctx._patternTrace.length === 0) return;
  var out = '[PATTERN TRACE] ' + ctx._patternTrace.length + ' steps:\n';
  for (var i = 0; i < ctx._patternTrace.length; i++) {
    out += '  ' + ctx._patternTrace[i] + '\n';
  }
  globalThis.__patternTrace = out;
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

// tryResolveObjectStateAccess — moved to resolve/state_access.js

function peekPropsAccess(c) {
  if (!ctx.propsObjectName || c.kind() !== TK.identifier || c.text() !== ctx.propsObjectName) return null;
  if (c.pos + 2 >= c.count) return null;
  if (c.kindAt(c.pos + 1) !== TK.dot || c.kindAt(c.pos + 2) !== TK.identifier) return null;
  const field = c.textAt(c.pos + 2);
  if (ctx.propStack && ctx.propStack[field] !== undefined) {
    var pv = ctx.propStack[field];
    // OA item ref marker (\x02OA_ITEM:oaIdx:iterVar) — resolve props.item.field to OA field access
    if (typeof pv === 'string' && pv.charCodeAt(0) === 2) {
      if (c.pos + 4 < c.count && c.kindAt(c.pos + 3) === TK.dot && c.kindAt(c.pos + 4) === TK.identifier) {
        var subField = c.textAt(c.pos + 4);
        var parts = pv.substring(9).split(':'); // skip '\x02OA_ITEM:'
        var oaIdx = parseInt(parts[0]);
        var iterVar = parts[1] || '_i';
        var oa = null;
        for (var _oi = 0; _oi < ctx.objectArrays.length; _oi++) {
          if (ctx.objectArrays[_oi].oaIdx === oaIdx) { oa = ctx.objectArrays[_oi]; break; }
        }
        var fieldInfo = oa ? oa.fields.find(function(f) { return f.name === subField; }) : null;
        if (oa && fieldInfo && fieldInfo.type === 'string') {
          return { field: field, value: '_oa' + oaIdx + '_' + subField + '[' + iterVar + '][0.._oa' + oaIdx + '_' + subField + '_lens[' + iterVar + ']]', skip: 5 };
        } else if (oa) {
          return { field: field, value: '_oa' + oaIdx + '_' + subField + '[' + iterVar + ']', skip: 5 };
        }
      }
      // OA item ref without .field — return the item param name
      // so render-local aliasing works: var tab = props.tab → renderLocals['tab'] = 'tab'
      // which matches ctx.currentMap.itemParam and triggers OA field resolution downstream
      var _itemParts = pv.substring(9).split(':');
      var _itemParam = _itemParts[2] || _itemParts[0];
      return { field: field, value: _itemParam };
    }
    return { field: field, value: pv };
  }
  return null;
}

function skipPropsAccess(c, peekResult) {
  var n = (peekResult && peekResult.skip) ? peekResult.skip : 3;
  for (var _si = 0; _si < n; _si++) c.advance();
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

// resolveConstOaAccess, resolveConstOaFieldFromRef — moved to resolve/const_oa.js
