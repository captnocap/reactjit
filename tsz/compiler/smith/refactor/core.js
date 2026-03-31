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
    scriptFuncs: [],
    classifiers: {},
    variantNames: [],
    variantBindings: [],
    renderLocals: {},
    _debugLines: [],
    _unresolvedClassifiers: [],
    _droppedExpressions: [],
    _unknownSubsystemTags: [],
    _ignoredModuleBlocks: [],
    _undefinedJSCalls: [],
    _duplicateJSVars: [],
    _jsDynTexts: [],
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
