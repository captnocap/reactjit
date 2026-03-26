// Smith — compiler intelligence in JS.
//
// Globals set by Forge:
//   __source  — .tsz source text
//   __tokens  — "kind start end\n..." flat token data
//   __file    — input file path


// ── Token cursor ──

function mkCursor(raw, source) {
  const lines = raw.trim().split('\n');
  const count = lines.length;
  const kinds = new Array(count);
  const starts = new Array(count);
  const ends = new Array(count);
  for (let i = 0; i < count; i++) {
    const p = lines[i].split(' ');
    kinds[i] = parseInt(p[0]); starts[i] = parseInt(p[1]); ends[i] = parseInt(p[2]);
  }
  return {
    kinds, starts, ends, count, source, pos: 0,
    kind()      { return this.kinds[this.pos]; },
    text()      { return this._byteSlice(this.starts[this.pos], this.ends[this.pos]); },
    textAt(i)   { return this._byteSlice(this.starts[i], this.ends[i]); },
    // Byte-based text access — Zig lexer uses byte offsets, but JS strings
    // index by char. For ASCII-only sources they match; for multi-byte we map.
    _byteSlice(start, end) {
      if (this._isAscii === undefined) {
        this._isAscii = true;
        for (let i = 0; i < this.source.length; i++) {
          if (this.source.charCodeAt(i) > 127) { this._isAscii = false; break; }
        }
        if (!this._isAscii) {
          // Build byte→char offset map
          this._b2c = [];
          let byteIdx = 0;
          for (let ci = 0; ci < this.source.length; ci++) {
            this._b2c[byteIdx] = ci;
            const code = this.source.charCodeAt(ci);
            if (code < 0x80) byteIdx += 1;
            else if (code < 0x800) byteIdx += 2;
            else if (code >= 0xD800 && code <= 0xDBFF) { byteIdx += 4; ci++; }
            else byteIdx += 3;
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

// ── Compiler state ──

let ctx = {};
function resetCtx() {
  ctx = {
    stateSlots: [],       // [{getter, setter, initial, type}]
    components: [],       // [{name, propNames, bodyPos}]
    propStack: {},        // {propName: value} — active during component inlining
    inlineComponent: null, // name of component being inlined (for array comments)
    componentChildren: null, // children nodes passed to current inlined component
    handlers: [],         // [{name, body}]  body = zig source
    handlerCount: 0,
    conditionals: [],     // [{condExpr, kind, arrName, arrIndex, trueIdx, falseIdx}]
    dynTexts: [],         // [{bufId, fmtString, fmtArgs, arrName, arrIndex, bufSize}]
    arrayComments: [],    // ["// tsz:file:line — <Tag>"] per array decl
    dynCount: 0,
    arrayCounter: 0,
    arrayDecls: [],       // ["var _arr_N = [_]Node{ ... };"]
    objectArrays: [],     // [{fields: [{name, type}], getter, setter}]
    maps: [],             // [{arrayName, itemParam, indexParam, innerNodes, parentArr, childIdx, textsInMap}]
    scriptBlock: null,     // raw JS from <script>...</script>
    scriptFuncs: [],       // function names defined in <script>
  };
}

// ── Collection: components ──

function collectComponents(c) {
  const saved = c.save();
  c.pos = 0;
  while (c.pos < c.count - 3) {
    // function Name({props}) { ... return (...) }
    if (c.isIdent('function') && c.kindAt(c.pos + 1) === TK.identifier) {
      const namePos = c.pos + 1;
      const name = c.textAt(namePos);
      // Skip 'App' — that's the entry point, not a component
      if (name === 'App' || !(name[0] >= 'A' && name[0] <= 'Z')) { c.advance(); continue; }

      c.pos = namePos + 1;
      // Parse props: ({prop1, prop2}) or (prop1, prop2, prop3)
      const propNames = [];
      let isBareParams = false;
      if (c.kind() === TK.lparen) {
        c.advance();
        if (c.kind() === TK.lbrace) {
          // Destructured: ({prop1, prop2})
          c.advance();
          while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
            if (c.kind() === TK.identifier) { propNames.push(c.text()); }
            c.advance();
          }
          if (c.kind() === TK.rbrace) c.advance();
        } else if (c.kind() === TK.identifier) {
          // Bare params: (label, value, color)
          isBareParams = true;
          while (c.kind() !== TK.rparen && c.kind() !== TK.eof) {
            if (c.kind() === TK.identifier) { propNames.push(c.text()); }
            if (c.kind() === TK.comma) c.advance();
            else c.advance();
          }
        }
        if (c.kind() === TK.rparen) c.advance();
      }

      // Find the return statement's JSX position
      // Scan for 'return' '(' '<'
      let bodyPos = -1;
      let braceDepth = 0;
      while (c.pos < c.count) {
        if (c.kind() === TK.lbrace) braceDepth++;
        if (c.kind() === TK.rbrace) { braceDepth--; if (braceDepth < 0) break; }
        if (c.isIdent('return')) {
          c.advance();
          if (c.kind() === TK.lparen) c.advance();
          if (c.kind() === TK.lt) { bodyPos = c.pos; break; }
        }
        c.advance();
      }

      if (bodyPos >= 0) {
        ctx.components.push({ name, propNames, bodyPos });
      }
    }
    c.advance();
  }
  c.restore(saved);
}

function findComponent(name) {
  return ctx.components.find(comp => comp.name === name);
}

// ── Collection: <script> blocks ──

function collectScript(c) {
  const saved = c.save();
  c.pos = 0;
  while (c.pos < c.count) {
    // <script> ... </script>
    if (c.kind() === TK.lt && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier && c.textAt(c.pos + 1) === 'script') {
      c.advance(); c.advance(); // skip < script
      if (c.kind() === TK.gt) c.advance(); // skip >
      // Collect everything until </script>
      const startOff = c.starts[c.pos];
      let endOff = startOff;
      while (c.pos < c.count) {
        if (c.kind() === TK.lt_slash && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier && c.textAt(c.pos + 1) === 'script') {
          endOff = c.starts[c.pos];
          c.advance(); c.advance(); // skip </ script
          if (c.kind() === TK.gt) c.advance(); // skip >
          break;
        }
        c.advance();
      }
      // Use byte-based slice for the raw JS content
      ctx.scriptBlock = c._byteSlice(startOff, endOff).trim();
      // Scan for function names in the script
      const funcRegex = /function\s+(\w+)/g;
      let match;
      while ((match = funcRegex.exec(ctx.scriptBlock)) !== null) {
        ctx.scriptFuncs.push(match[1]);
      }
      break;
    }
    c.advance();
  }
  c.restore(saved);
}

function isScriptFunc(name) {
  return ctx.scriptFuncs.includes(name);
}

// ── Collection: useState ──

function collectState(c) {
  const saved = c.save();
  c.pos = 0;
  while (c.pos < c.count) {
    // const [getter, setter] = useState(initial)
    if (c.isIdent('const') || c.isIdent('let')) {
      const declPos = c.pos;
      c.advance();
      if (c.kind() === TK.lbracket) {
        c.advance();
        if (c.kind() === TK.identifier) {
          const getter = c.text(); c.advance();
          if (c.kind() === TK.comma) c.advance();
          if (c.kind() === TK.identifier) {
            const setter = c.text(); c.advance();
            if (c.kind() === TK.rbracket) c.advance();
            if (c.kind() === TK.equals) c.advance();
            // useState( or React.useState(
            let isUseState = false;
            if (c.isIdent('useState')) { isUseState = true; c.advance(); }
            else if (c.isIdent('React')) {
              c.advance();
              if (c.kind() === TK.dot) c.advance();
              if (c.isIdent('useState')) { isUseState = true; c.advance(); }
            }
            if (isUseState && c.kind() === TK.lparen) {
              c.advance();
              let initial = 0;
              let type = 'int';
              if (c.kind() === TK.number) {
                const num = c.text();
                initial = num.includes('.') ? parseFloat(num) : parseInt(num);
                type = num.includes('.') ? 'float' : 'int';
                c.advance();
              } else if (c.kind() === TK.minus) {
                c.advance();
                if (c.kind() === TK.number) {
                  initial = -parseInt(c.text());
                  c.advance();
                }
              } else if (c.isIdent('true')) { initial = true; type = 'boolean'; c.advance(); }
              else if (c.isIdent('false')) { initial = false; type = 'boolean'; c.advance(); }
              else if (c.kind() === TK.string) {
                initial = c.text().slice(1, -1);
                type = 'string'; c.advance();
              }
              else if (c.kind() === TK.lbracket) {
                // Object array: useState([{ field: val, ... }])
                c.advance();
                if (c.kind() === TK.lbrace) {
                  const fields = [];
                  c.advance();
                  while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
                    if (c.kind() === TK.identifier) {
                      const fname = c.text(); c.advance();
                      if (c.kind() === TK.colon) c.advance();
                      let ftype = 'int';
                      if (c.kind() === TK.string) { ftype = 'string'; c.advance(); }
                      else if (c.kind() === TK.number) {
                        const nv = c.text();
                        ftype = nv.startsWith('0x') ? 'int' : (nv.includes('.') ? 'float' : 'int');
                        c.advance();
                      }
                      else if (c.isIdent('true') || c.isIdent('false')) { ftype = 'boolean'; c.advance(); }
                      fields.push({ name: fname, type: ftype });
                    }
                    if (c.kind() === TK.comma) c.advance();
                    else if (c.kind() !== TK.rbrace) c.advance();
                  }
                  ctx.objectArrays.push({ fields, getter, setter, oaIdx: ctx.objectArrays.length });
                  type = 'object_array';
                  // Skip to closing ])
                  let depth = 2; // already inside [{
                  while (depth > 0 && c.kind() !== TK.eof) {
                    if (c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
                    if (c.kind() === TK.rbracket || c.kind() === TK.rbrace) depth--;
                    c.advance();
                  }
                }
              }
              if (type !== 'object_array') ctx.stateSlots.push({ getter, setter, initial, type });
            }
          }
        }
      }
    }
    c.advance();
  }
  c.restore(saved);
}


// ── Entry point ──

function compile() {
  const source = globalThis.__source;
  const tokens = globalThis.__tokens;
  const file = globalThis.__file || 'unknown.tsz';
  const c = mkCursor(tokens, source);

  resetCtx();

  // Phase 1: Collect script, components, and state
  collectScript(c);
  collectComponents(c);
  collectState(c);

  // Find App function
  let appStart = -1;
  for (let i = 0; i < c.count - 2; i++) {
    if (c.kindAt(i) === TK.identifier && c.textAt(i) === 'function' &&
        c.kindAt(i+1) === TK.identifier && c.kindAt(i+2) === TK.lparen) {
      const name = c.textAt(i+1);
      if (name[0] >= 'A' && name[0] <= 'Z') appStart = i;
    }
  }
  if (appStart < 0) return '// Smith error: no App function found\n';

  // Find return
  c.pos = appStart;
  while (c.pos < c.count) {
    if (c.isIdent('return')) { c.advance(); if (c.kind() === TK.lparen) c.advance(); break; }
    c.advance();
  }

  // Parse JSX
  const root = parseJSXElement(c);

  return emitOutput(root.nodeExpr, file);
}
