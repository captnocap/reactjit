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

function _smithTraceShort(value, maxLen) {
  var limit = maxLen || 96;
  if (value === null || value === undefined) return '';
  var out = String(value).replace(/\s+/g, ' ').trim();
  if (out.length > limit) out = out.slice(0, limit - 3) + '...';
  return out;
}

function _smithTraceLineCol(source, offset) {
  var line = 1;
  var col = 1;
  if (!source || offset === undefined || offset === null || offset < 0) return { line: 0, col: 0 };
  for (var i = 0; i < offset && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line: line, col: col };
}

function smithTraceSpanFromOffsets(start, end) {
  var source = (ctx && ctx._source) || globalThis.__source || '';
  if (start === undefined || start === null) return null;
  var finish = end === undefined || end === null ? start : end;
  var beginLC = _smithTraceLineCol(source, start);
  var endLC = _smithTraceLineCol(source, finish);
  return {
    start: start,
    end: finish,
    line: beginLC.line,
    col: beginLC.col,
    endLine: endLC.line,
    endCol: endLC.col,
  };
}

function _smithTraceActiveSpan() {
  if (!ctx || !ctx._mutationTrace || !ctx._mutationTrace.cursor) return null;
  var c = ctx._mutationTrace.cursor;
  if (!c || !c.starts || c.count <= 0) return null;
  var pos = c.pos;
  if (pos >= c.count) pos = c.count - 1;
  if (pos < 0) pos = 0;
  var start = c.starts[pos];
  var end = c.ends && c.ends[pos] !== undefined ? c.ends[pos] : start;
  if (start === undefined && pos > 0) {
    start = c.starts[pos - 1];
    end = c.ends && c.ends[pos - 1] !== undefined ? c.ends[pos - 1] : start;
  }
  if (start === undefined) return null;
  return smithTraceSpanFromOffsets(start, end);
}

function _smithTraceNormalizeData(data) {
  if (!data || typeof data !== 'object') return data || null;
  var out = {};
  var keys = Object.keys(data);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = data[key];
    if (value === undefined || typeof value === 'function') continue;
    if (typeof value === 'string') out[key] = _smithTraceShort(value, 140);
    else if (value && typeof value === 'object') out[key] = _smithTraceShort(JSON.stringify(value), 140);
    else out[key] = value;
  }
  return out;
}

function _smithTraceNextId(trace, kind) {
  if (!trace.counters[kind]) trace.counters[kind] = 0;
  trace.counters[kind]++;
  return trace.counters[kind];
}

function _smithTraceLabelFor(kind, item) {
  if (!item || typeof item !== 'object') return kind;
  if (kind === 'state_slot') return item.getter || item.setter || kind;
  if (kind === 'object_array') return item.getter || ('oa' + item.oaIdx);
  if (kind === 'component') return item.name || kind;
  if (kind === 'handler') return item.name || kind;
  if (kind === 'dyn_text') return 'buf' + (item.bufId !== undefined ? item.bufId : '?');
  if (kind === 'map') {
    var oaName = item.oa && item.oa.getter ? item.oa.getter : 'map';
    return oaName + '.map';
  }
  if (kind === 'conditional') return 'cond' + (item.condIdx !== undefined ? item.condIdx : '');
  if (kind === 'dyn_style') return item.field || kind;
  if (kind === 'dyn_color') return item.field || 'text_color';
  if (kind === 'variant_binding') return item.clsName || kind;
  if (kind === 'node') return item.tag || item.srcTag || 'Node';
  return kind;
}

function _smithTraceMetaFor(kind, item, collectionName) {
  if (!item || typeof item !== 'object') return {};
  if (kind === 'state_slot') {
    return { getter: item.getter || '', setter: item.setter || '', type: item.type || '', collection: collectionName };
  }
  if (kind === 'object_array') {
    return { getter: item.getter || '', setter: item.setter || '', oaIdx: item.oaIdx, fields: item.fields ? item.fields.length : 0, collection: collectionName };
  }
  if (kind === 'component') {
    return { name: item.name || '', props: item.propNames ? item.propNames.length : 0, collection: collectionName };
  }
  if (kind === 'handler') {
    return { name: item.name || '', inMap: !!item.inMap, mapIdx: item.mapIdx, collection: collectionName };
  }
  if (kind === 'dyn_text') {
    return {
      bufId: item.bufId,
      fmt: item.fmtString || '',
      inMap: !!item.inMap,
      mapIdx: item.mapIdx,
      targetField: item.targetField || 'text',
      collection: collectionName,
    };
  }
  if (kind === 'map') {
    return {
      mapIdx: item.mapIdx,
      oaIdx: item.oaIdx,
      oa: item.oa && item.oa.getter ? item.oa.getter : '',
      nested: !!item.isNested,
      inline: !!item.isInline,
      collection: collectionName,
    };
  }
  if (kind === 'conditional') return { inMap: !!item.inMap, arrName: item.arrName || '', collection: collectionName };
  if (kind === 'dyn_style') return { field: item.field || '', expression: item.expression || '', collection: collectionName };
  if (kind === 'dyn_color') return { field: item.field || 'text_color', expression: item.expression || item.colorExpr || '', collection: collectionName };
  if (kind === 'variant_binding') return { clsName: item.clsName || '', inMap: !!item.inMap, collection: collectionName };
  return { collection: collectionName };
}

function smithTraceEnsureEntity(target, kind, meta) {
  if (!ctx || !ctx._mutationTrace || !ctx._mutationTrace.enabled) return target;
  if (!target || typeof target !== 'object') return target;
  meta = meta || {};
  if (!target._traceId) {
    var trace = ctx._mutationTrace;
    target._traceKind = kind || target._traceKind || 'entity';
    target._traceId = target._traceKind + '#' + _smithTraceNextId(trace, target._traceKind);
    target._traceLabel = meta.label || _smithTraceLabelFor(target._traceKind, target);
    target._traceSpan = meta.span || _smithTraceActiveSpan();
    trace.entities[target._traceId] = {
      id: target._traceId,
      kind: target._traceKind,
      label: target._traceLabel || target._traceKind,
      span: target._traceSpan || null,
      meta: _smithTraceNormalizeData(meta.meta) || {},
      events: [],
    };
    trace.order.push(target._traceId);
  } else if (meta.label || meta.span || meta.meta) {
    var rec = ctx._mutationTrace.entities[target._traceId];
    if (rec) {
      if (meta.label && !rec.label) rec.label = meta.label;
      if (meta.span && !rec.span) rec.span = meta.span;
      if (meta.meta) {
        var norm = _smithTraceNormalizeData(meta.meta);
        var keys = Object.keys(norm || {});
        for (var i = 0; i < keys.length; i++) {
          if (rec.meta[keys[i]] === undefined) rec.meta[keys[i]] = norm[keys[i]];
        }
      }
    }
  }
  return target;
}

function _smithTraceRelatedIds(related) {
  if (!related) return [];
  var items = Array.isArray(related) ? related : [related];
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (!item) continue;
    if (typeof item === 'string') out.push(item);
    else if (item._traceId) out.push(item._traceId);
  }
  return out;
}

function smithTraceMutation(target, op, detail, extra) {
  if (!ctx || !ctx._mutationTrace || !ctx._mutationTrace.enabled) return;
  extra = extra || {};
  var entity = target;
  if (entity && typeof entity === 'object') {
    smithTraceEnsureEntity(entity, extra.kind || entity._traceKind || 'entity', extra);
    entity = entity._traceId;
  }
  if (!entity || !ctx._mutationTrace.entities[entity]) return;
  var rec = ctx._mutationTrace.entities[entity];
  if (!rec.span && extra.span) rec.span = extra.span;
  if (!rec.label && extra.label) rec.label = extra.label;
  rec.events.push({
    phase: ctx._mutationTrace.phase || 'unknown',
    op: op,
    detail: _smithTraceShort(detail || '', 160),
    related: _smithTraceRelatedIds(extra.related),
    data: _smithTraceNormalizeData(extra.data) || {},
  });
}

function _smithTraceWrapArray(ctxObj, field, kind) {
  var arr = ctxObj[field];
  if (!arr || arr.__smithTraceWrapped) return;
  arr.push = function() {
    for (var i = 0; i < arguments.length; i++) {
      var item = arguments[i];
      smithTraceEnsureEntity(item, kind, {
        label: _smithTraceLabelFor(kind, item),
        meta: _smithTraceMetaFor(kind, item, field),
      });
      smithTraceMutation(item, 'create', field, {
        data: _smithTraceMetaFor(kind, item, field),
      });
      Array.prototype.push.call(this, item);
    }
    return this.length;
  };
  arr.__smithTraceWrapped = true;
}

function _smithTraceWrapCtxCollections(ctxObj) {
  if (!ctxObj || !ctxObj._mutationTrace || !ctxObj._mutationTrace.enabled) return;
  _smithTraceWrapArray(ctxObj, 'stateSlots', 'state_slot');
  _smithTraceWrapArray(ctxObj, 'components', 'component');
  _smithTraceWrapArray(ctxObj, 'handlers', 'handler');
  _smithTraceWrapArray(ctxObj, 'dynTexts', 'dyn_text');
  _smithTraceWrapArray(ctxObj, 'dynColors', 'dyn_color');
  _smithTraceWrapArray(ctxObj, 'dynStyles', 'dyn_style');
  _smithTraceWrapArray(ctxObj, 'conditionals', 'conditional');
  _smithTraceWrapArray(ctxObj, 'objectArrays', 'object_array');
  _smithTraceWrapArray(ctxObj, 'maps', 'map');
  _smithTraceWrapArray(ctxObj, 'variantBindings', 'variant_binding');
}

function smithTraceSetPhase(phase) {
  if (!ctx || !ctx._mutationTrace || !ctx._mutationTrace.enabled) return;
  ctx._mutationTrace.phase = phase;
}

function smithTraceSetCursor(cursor) {
  if (!ctx || !ctx._mutationTrace || !ctx._mutationTrace.enabled) return;
  ctx._mutationTrace.cursor = cursor || null;
}

function _smithTraceMatchesLine(rec, lineFilter) {
  if (!lineFilter || lineFilter <= 0) return true;
  if (!rec || !rec.span) return false;
  var start = rec.span.line || 0;
  var finish = rec.span.endLine || start;
  return lineFilter >= start && lineFilter <= finish;
}

function smithTraceFinalizeEmit(nodeExpr, zigOut) {
  if (!ctx || !ctx._mutationTrace || !ctx._mutationTrace.enabled) return;
  if (ctx._mutationTrace.emitFinalized) return;
  ctx._mutationTrace.emitFinalized = true;
  if (ctx._traceRootNode) {
    smithTraceMutation(ctx._traceRootNode, 'emit.root', _smithTraceShort(nodeExpr || '', 120), {
      data: {
        output: (typeof zigOut === 'string' && zigOut.indexOf('__SPLIT_OUTPUT__') === 0) ? 'split' : 'single',
        bytes: zigOut ? zigOut.length : 0,
      },
    });
  }
  if (ctx.dynTexts) {
    for (var di = 0; di < ctx.dynTexts.length; di++) {
      var dt = ctx.dynTexts[di];
      var target = dt.arrName ? (dt.arrName + '[' + dt.arrIndex + '].' + (dt.targetField || 'text')) :
        (dt.inMap ? ('map#' + dt.mapIdx + '::__mt' + dt.bufId + '__') : ('buf' + dt.bufId));
      smithTraceMutation(dt, 'emit.dynamic_target', target, {
        data: { fmt: dt.fmtString || '', inMap: !!dt.inMap, mapIdx: dt.mapIdx },
      });
    }
  }
  if (ctx.maps) {
    for (var mi = 0; mi < ctx.maps.length; mi++) {
      var mapInfo = ctx.maps[mi];
      var mapTarget = mapInfo.parentArr ?
        (mapInfo.parentArr + '[' + mapInfo.childIdx + '].children <- _map_pool_' + mapInfo.mapIdx) :
        ('_map_pool_' + mapInfo.mapIdx);
      smithTraceMutation(mapInfo, 'emit.map_target', mapTarget, {
        data: {
          nested: !!mapInfo.isNested,
          inline: !!mapInfo.isInline,
          oa: mapInfo.oa && mapInfo.oa.getter ? mapInfo.oa.getter : '',
        },
      });
    }
  }
  if (ctx.handlers) {
    for (var hi = 0; hi < ctx.handlers.length; hi++) {
      var handler = ctx.handlers[hi];
      if (handler._traceLastRoute) {
        smithTraceMutation(handler, 'emit.handler_route', handler._traceLastRoute, {
          data: { inMap: !!handler.inMap, mapIdx: handler.mapIdx },
        });
      }
    }
  }
}

function _smithTraceBuildSnapshot(file) {
  if (!ctx || !ctx._mutationTrace || !ctx._mutationTrace.enabled) return null;
  var trace = ctx._mutationTrace;
  var entities = [];
  for (var i = 0; i < trace.order.length; i++) {
    var id = trace.order[i];
    var rec = trace.entities[id];
    if (!rec) continue;
    if (!_smithTraceMatchesLine(rec, trace.lineFilter)) continue;
    entities.push(rec);
  }
  return {
    version: 'smith-mutations-v1',
    file: file || trace.file || (globalThis.__file || 'unknown.tsz'),
    lineFilter: trace.lineFilter || 0,
    entityCount: entities.length,
    entities: entities,
  };
}

function _smithTraceFormatText(snapshot) {
  if (!snapshot) return '';
  var lines = [];
  var basename = (snapshot.file || 'unknown.tsz').split('/').pop();
  lines.push('=== Smith mutations: ' + basename + ' ===');
  if (snapshot.lineFilter) lines.push('line filter: ' + snapshot.lineFilter);
  lines.push('entities: ' + snapshot.entityCount);
  for (var i = 0; i < snapshot.entities.length; i++) {
    var rec = snapshot.entities[i];
    var loc = rec.span && rec.span.line ? ('L' + rec.span.line + (rec.span.col ? ':' + rec.span.col : '')) : 'L?';
    lines.push('');
    lines.push(rec.id + ' [' + rec.kind + '] ' + (rec.label || rec.kind) + ' @ ' + loc);
    for (var ei = 0; ei < rec.events.length; ei++) {
      var evt = rec.events[ei];
      var line = '  ' + (ei + 1) + '. [' + evt.phase + '] ' + evt.op;
      if (evt.detail) line += ' -> ' + evt.detail;
      if (evt.related && evt.related.length > 0) line += ' | related: ' + evt.related.join(', ');
      var keys = Object.keys(evt.data || {});
      if (keys.length > 0) {
        var parts = [];
        for (var ki = 0; ki < keys.length; ki++) parts.push(keys[ki] + '=' + evt.data[keys[ki]]);
        line += ' | ' + parts.join(' ');
      }
      lines.push(line);
    }
  }
  if (snapshot.entities.length === 0) lines.push('', 'No matching mutation entities.');
  return lines.join('\n');
}

function smithTracePublish(file) {
  if (!ctx || !ctx._mutationTrace || !ctx._mutationTrace.enabled) return;
  var snapshot = _smithTraceBuildSnapshot(file);
  globalThis.__mutationTraceJSON = JSON.stringify(snapshot, null, 2);
  globalThis.__mutationTraceText = _smithTraceFormatText(snapshot);
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
    _traceRootNode: null,
    _mutationTrace: {
      enabled: globalThis.__TRACE_MUTATIONS === 1,
      lineFilter: globalThis.__TRACE_LINE || 0,
      phase: 'reset',
      cursor: null,
      counters: {},
      entities: {},
      order: [],
      file: globalThis.__file || 'unknown.tsz',
      emitFinalized: false,
    },
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
  _smithTraceWrapCtxCollections(ctx);
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
