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
    dynColors: [],        // [{dcId, arrName, arrIndex, colorExpr}] — color prop runtime assignments
    arrayComments: [],    // ["// tsz:file:line — <Tag>"] per array decl
    dynCount: 0,
    arrayCounter: 0,
    arrayDecls: [],       // ["var _arr_N = [_]Node{ ... };"]
    slotRemap: {},        // {getter/setter name → slot index} — active during component inlining
    objectArrays: [],     // [{fields: [{name, type}], getter, setter}]
    maps: [],             // [{arrayName, itemParam, indexParam, innerNodes, parentArr, childIdx, textsInMap}]
    scriptBlock: null,     // raw JS from <script>...</script>
    scriptFuncs: [],       // function names defined in <script>
    classifiers: {},       // {Name: {type, style, fontSize, color, ...}} from .cls imports
    renderLocals: {},      // {varName: resolvedValue} — variables between function App() and return
    _debugLines: [],       // debug output lines (emitted as Zig comments)
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

      // Scan component body: collect useState + find return JSX position
      let bodyPos = -1;
      let braceDepth = 0;
      const compStateSlots = [];
      while (c.pos < c.count) {
        if (c.kind() === TK.lbrace) braceDepth++;
        if (c.kind() === TK.rbrace) { braceDepth--; if (braceDepth <= 0) break; }
        // Collect useState inside component body (depth 1 = direct body)
        if (braceDepth === 1 && (c.isIdent('const') || c.isIdent('let'))) {
          const sp = c.pos; c.advance();
          if (c.kind() === TK.lbracket) {
            c.advance();
            if (c.kind() === TK.identifier) {
              const sg = c.text(); c.advance();
              if (c.kind() === TK.comma) c.advance();
              if (c.kind() === TK.identifier) {
                const ss = c.text(); c.advance();
                if (c.kind() === TK.rbracket) c.advance();
                if (c.kind() === TK.equals) c.advance();
                if (c.isIdent('useState')) {
                  c.advance();
                  if (c.kind() === TK.lparen) {
                    c.advance();
                    let init = 0; let type = 'int';
                    if (c.kind() === TK.number) { const n = c.text(); init = n.includes('.') ? parseFloat(n) : parseInt(n); type = n.includes('.') ? 'float' : 'int'; c.advance(); }
                    else if (c.isIdent('true')) { init = true; type = 'boolean'; c.advance(); }
                    else if (c.isIdent('false')) { init = false; type = 'boolean'; c.advance(); }
                    else if (c.kind() === TK.string) { init = c.text().slice(1,-1); type = 'string'; c.advance(); }
                    compStateSlots.push({ getter: sg, setter: ss, initial: init, type });
                  }
                }
              }
            }
          }
          continue;
        }
        if (c.isIdent('return')) {
          c.advance();
          if (c.kind() === TK.lparen) c.advance();
          if (c.kind() === TK.lt) { bodyPos = c.pos; break; }
          // Check for map return: return ( identifier.map(
          if (c.kind() === TK.identifier) {
            const mapArr = c.text();
            if (c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot &&
                c.kindAt(c.pos + 2) === TK.identifier && c.textAt(c.pos + 2) === 'map') {
              bodyPos = c.pos;
              break;
            }
          }
        }
        c.advance();
      }

      if (bodyPos >= 0) {
        ctx.components.push({ name, propNames, bodyPos, stateSlots: compStateSlots });
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
  // Collect ALL <script> blocks (merged source may have multiple from imported components)
  const scriptParts = [];
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
      const block = c._byteSlice(startOff, endOff).trim();
      if (block.length > 0) scriptParts.push(block);
    }
    c.advance();
  }
  // Concatenate all script blocks
  if (scriptParts.length > 0) {
    ctx.scriptBlock = scriptParts.join('\n\n');
    // Scan for function names in the combined script
    const funcRegex = /function\s+(\w+)/g;
    let match;
    while ((match = funcRegex.exec(ctx.scriptBlock)) !== null) {
      ctx.scriptFuncs.push(match[1]);
    }
  }
  c.restore(saved);
  // Also scan imported script content for function names
  if (globalThis.__scriptContent) {
    const funcRegex2 = /function\s+(\w+)/g;
    let match2;
    while ((match2 = funcRegex2.exec(globalThis.__scriptContent)) !== null) {
      if (!ctx.scriptFuncs.includes(match2[1])) {
        ctx.scriptFuncs.push(match2[1]);
      }
    }
  }
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
                      else if (c.kind() === TK.lbracket) {
                        // Nested array field: items: [{ label: '', value: 0 }]
                        // Create a child OA for the nested array
                        c.advance(); // skip [
                        if (c.kind() === TK.lbrace) {
                          const nestedFields = [];
                          c.advance(); // skip {
                          while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
                            if (c.kind() === TK.identifier) {
                              const nfname = c.text(); c.advance();
                              if (c.kind() === TK.colon) c.advance();
                              let nftype = 'int';
                              if (c.kind() === TK.string) { nftype = 'string'; c.advance(); }
                              else if (c.kind() === TK.number) {
                                const nnv = c.text();
                                nftype = nnv.startsWith('0x') ? 'int' : (nnv.includes('.') ? 'float' : 'int');
                                c.advance();
                              }
                              else if (c.isIdent('true') || c.isIdent('false')) { nftype = 'boolean'; c.advance(); }
                              nestedFields.push({ name: nfname, type: nftype });
                            }
                            if (c.kind() === TK.comma) c.advance();
                            else if (c.kind() !== TK.rbrace) c.advance();
                          }
                          // Skip }]
                          if (c.kind() === TK.rbrace) c.advance();
                          if (c.kind() === TK.rbracket) c.advance();
                          const childOaIdx = ctx.objectArrays.length;
                          // Reserve the child OA slot — will be pushed after parent
                          ftype = 'nested_array';
                          // Store nested OA info on the field for later
                          fields.push({ name: fname, type: ftype, nestedOaIdx: childOaIdx, nestedFields });
                          // Don't push child OA yet — push after parent is done
                          continue; // skip the normal fields.push below
                        } else {
                          // Bare array (not objects) — skip to ]
                          let bd = 1;
                          while (bd > 0 && c.kind() !== TK.eof) {
                            if (c.kind() === TK.lbracket) bd++;
                            if (c.kind() === TK.rbracket) bd--;
                            if (bd > 0) c.advance();
                          }
                          if (c.kind() === TK.rbracket) c.advance();
                        }
                      }
                      fields.push({ name: fname, type: ftype });
                    }
                    if (c.kind() === TK.comma) c.advance();
                    else if (c.kind() !== TK.rbrace) c.advance();
                  }
                  const parentOaIdx = ctx.objectArrays.length;
                  ctx.objectArrays.push({ fields, getter, setter, oaIdx: parentOaIdx });
                  // Now push child OAs for any nested_array fields
                  for (const f of fields) {
                    if (f.type === 'nested_array' && f.nestedFields) {
                      const childOaIdx = ctx.objectArrays.length;
                      f.nestedOaIdx = childOaIdx; // update with actual index
                      ctx.objectArrays.push({
                        fields: f.nestedFields,
                        getter: f.name, setter: 'set' + f.name[0].toUpperCase() + f.name.slice(1),
                        oaIdx: childOaIdx,
                        parentOaIdx: parentOaIdx, parentField: f.name,
                        isNested: true,
                      });
                    }
                  }
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


// ── Collection: const arrays ──

function collectConstArrays(c) {
  const saved = c.save();
  c.pos = 0;
  while (c.pos < c.count) {
    // const name = [{ field: val, ... }, ...]
    if (c.isIdent('const') && c.pos + 3 < c.count) {
      const declPos = c.pos;
      c.advance();
      if (c.kind() === TK.identifier) {
        const name = c.text();
        c.advance();
        if (c.kind() === TK.equals) {
          c.advance();
          if (c.kind() === TK.lbracket) {
            // Check it's not already a state var (useState was already collected)
            const isStateVar = ctx.stateSlots.some(s => s.getter === name) ||
                               ctx.objectArrays.some(o => o.getter === name);
            if (!isStateVar) {
              c.advance(); // skip [
              if (c.kind() === TK.lbrace) {
                // Parse all items: [{...}, {...}, ...]
                const items = [];
                let fields = null;
                while (c.kind() === TK.lbrace && c.kind() !== TK.eof) {
                  c.advance(); // skip {
                  const item = {};
                  const itemFields = [];
                  while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
                    if (c.kind() === TK.identifier) {
                      const fname = c.text(); c.advance();
                      if (c.kind() === TK.colon) c.advance();
                      let fval = null;
                      let ftype = 'int';
                      if (c.kind() === TK.string) {
                        fval = c.text().slice(1, -1); // strip quotes
                        ftype = 'string';
                        c.advance();
                      } else if (c.kind() === TK.number) {
                        const nv = c.text();
                        fval = nv.startsWith('0x') ? parseInt(nv, 16) : (nv.includes('.') ? parseFloat(nv) : parseInt(nv));
                        ftype = nv.startsWith('0x') ? 'int' : (nv.includes('.') ? 'float' : 'int');
                        c.advance();
                      } else if (c.isIdent('true')) { fval = 1; ftype = 'int'; c.advance(); }
                      else if (c.isIdent('false')) { fval = 0; ftype = 'int'; c.advance(); }
                      else if (c.kind() === TK.minus) {
                        c.advance();
                        if (c.kind() === TK.number) { fval = -parseInt(c.text()); c.advance(); }
                        else fval = 0;
                      } else {
                        fval = 0; c.advance(); // skip unknown
                      }
                      item[fname] = fval;
                      itemFields.push({ name: fname, type: ftype });
                    }
                    if (c.kind() === TK.comma) c.advance();
                    else if (c.kind() !== TK.rbrace) c.advance();
                  }
                  if (c.kind() === TK.rbrace) c.advance(); // skip }
                  if (!fields) fields = itemFields; // schema from first item
                  items.push(item);
                  if (c.kind() === TK.comma) c.advance();
                }
                // skip ]
                if (c.kind() === TK.rbracket) c.advance();
                if (fields && fields.length > 0 && items.length > 0) {
                  const oaIdx = ctx.objectArrays.length;
                  ctx.objectArrays.push({
                    fields, getter: name, setter: null,
                    oaIdx, isConst: true,
                    constData: items, constLen: items.length,
                  });
                  if (globalThis.__SMITH_DEBUG_MAP_DETECT) {
                    if (!globalThis.__dbg) globalThis.__dbg = [];
                    globalThis.__dbg.push(`CONST_ARRAY name="${name}" fields=[${fields.map(f=>f.name)}] items=${items.length}`);
                  }
                }
              } else {
                // Not an object array — skip
              }
            }
          }
        }
      }
      continue;
    }
    c.advance();
  }
  c.restore(saved);
}

// ── Classifier support ──

function collectClassifiers() {
  ctx.classifiers = {};
  const clsText = globalThis.__clsContent;
  if (!clsText) return;
  try {
    let merged = {};
    const classifier = function(obj) { for (const k in obj) merged[k] = obj[k]; };
    eval(clsText); // direct eval — sees local 'classifier' binding
    ctx.classifiers = merged;
  } catch(e) {}
}

// Convert a classifier definition's style object → Zig styleFields array
function clsStyleFields(def) {
  if (!def || !def.style) return [];
  const fields = [];
  const style = def.style;
  for (const key of Object.keys(style)) {
    const val = style[key];
    if (colorKeys[key]) {
      fields.push(`.${colorKeys[key]} = ${parseColor(String(val))}`);
    } else if (enumKeys[key]) {
      const em = enumKeys[key];
      const mapped = em.values[val];
      if (mapped) fields.push(`.${em.field} = ${mapped}`);
    } else if (styleKeys[key]) {
      if (typeof val === 'string' && val.endsWith('%')) {
        const pct = parseFloat(val);
        fields.push(`.${styleKeys[key]} = ${pct === 100 ? -1 : pct / 100}`);
      } else if (typeof val === 'string' && val === 'auto') {
        // 'auto' not supported as a numeric style value — skip (uses default)
      } else {
        fields.push(`.${styleKeys[key]} = ${val}`);
      }
    }
  }
  return fields;
}

// Convert classifier fontSize/color → Zig nodeFields array
function clsNodeFields(def) {
  if (!def) return [];
  const fields = [];
  if (def.fontSize !== undefined) fields.push(`.font_size = ${def.fontSize}`);
  if (def.color !== undefined) fields.push(`.text_color = ${parseColor(String(def.color))}`);
  return fields;
}

// Merge classifier default fields with inline-specified fields (inline wins)
function mergeFields(clsFields, inlineFields) {
  const result = [...inlineFields];
  for (const cf of clsFields) {
    const key = cf.split('=')[0].trim();
    if (!result.some(f => f.split('=')[0].trim() === key)) {
      result.unshift(cf);
    }
  }
  return result;
}

// ── Entry point ──

// Stamp generated output with integrity header.
// Body hash is filled in by forge (Zig-side sha256) after Smith returns.
// The placeholder BODYHASH gets replaced with the real hash.
function stampIntegrity(out) {
  const stamp = `//! integrity: body=BODYHASH\n//! DO NOT EDIT — generated by Smith. Edit the .tsz source and recompile.\n`;
  return stamp + out;
}

function compile() {
  const source = globalThis.__source;
  const tokens = globalThis.__tokens;
  const file = globalThis.__file || 'unknown.tsz';
  // Debug mode disabled — enable manually when debugging component inlining
  // if (file.includes('Tools.app')) globalThis.__SMITH_DEBUG_INLINE = 1;

  // Soup lane: web React soup sources (s##a tier) — completely separate path
  if (isSoupSource(source, file)) {
    return compileSoup(source, file);
  }

  // Module mode: transpile TS → target lang (no JSX, no app scaffolding)
  if (globalThis.__modBuild === 1) {
    const target = globalThis.__modTarget || 'zig';
    if (target === 'lua') return compileModLua(source, file);
    if (target === 'js') return compileModJS(source, file);
    return stampIntegrity(compileMod(source, file));
  }

  const c = mkCursor(tokens, source);

  resetCtx();

  // Phase 1: Collect script, components, state, and classifiers
  collectScript(c);
  collectComponents(c);
  collectState(c);
  collectConstArrays(c);
  collectClassifiers();

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

  // Collect render-local variables between function body and return statement.
  // Uses save/restore to avoid disturbing the cursor for the main parse.
  // Love2D reference: tslx_compile.mjs:196-206 (renderLocals substitution)
  ctx.renderLocals = {};
  {
    const rlSaved = c.save();
    c.pos = appStart;
    // Skip function signature: function Name(...) {
    while (c.pos < c.count && c.kind() !== TK.lbrace) c.advance();
    if (c.kind() === TK.lbrace) c.advance();
    // Scan statements until 'return' — collect simple const/let assignments
    while (c.pos < c.count) {
      if (c.isIdent('return')) break;
      if (c.isIdent('const') || c.isIdent('let')) {
        c.advance();
        // Skip destructured: [getter, setter] = useState(...)
        if (c.kind() === TK.lbracket) {
          let bd = 1; c.advance();
          while (c.pos < c.count && bd > 0) {
            if (c.kind() === TK.lbracket) bd++;
            if (c.kind() === TK.rbracket) bd--;
            c.advance();
          }
          // Skip past = useState(...)
          while (c.pos < c.count && c.kind() !== TK.rparen && !c.isIdent('const') && !c.isIdent('let') && !c.isIdent('return')) c.advance();
          if (c.kind() === TK.rparen) c.advance();
          continue;
        }
        if (c.kind() === TK.identifier) {
          const varName = c.text();
          c.advance();
          if (c.kind() === TK.equals) {
            c.advance();
            let valParts = [];
            let depth = 0;
            while (c.pos < c.count) {
              if (c.kind() === TK.semicolon && depth === 0) { c.advance(); break; }
              // Stop at statement boundaries (no semicolons in .tsz)
              if (depth === 0 && c.kind() === TK.identifier && (c.text() === 'const' || c.text() === 'let' || c.text() === 'return' || c.text() === 'function')) break;
              if (c.kind() === TK.lparen || c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
              if (c.kind() === TK.rparen || c.kind() === TK.rbracket || c.kind() === TK.rbrace) {
                depth--;
                if (depth < 0) break;
              }
              // Resolve state getters, earlier render locals, and add spacing around operators
              if (c.kind() === TK.identifier && ctx.renderLocals[c.text()] !== undefined) {
                valParts.push(ctx.renderLocals[c.text()]);
              } else if (c.kind() === TK.identifier && isGetter(c.text())) {
                valParts.push(slotGet(c.text()));
              } else if (c.kind() === TK.star || c.kind() === TK.plus || c.kind() === TK.minus || c.kind() === TK.slash || c.kind() === TK.percent) {
                valParts.push(' ' + c.text() + ' ');
              } else {
                valParts.push(c.text());
              }
              c.advance();
            }
            const valStr = valParts.join('');
            if (!valStr.includes('useState')) {
              ctx.renderLocals[varName] = valStr;
            }
          }
        }
        continue;
      }
      c.advance();
    }
    c.restore(rlSaved);
  }

  // Find return (original path — cursor starts fresh from appStart)
  c.pos = appStart;
  while (c.pos < c.count) {
    if (c.isIdent('return')) { c.advance(); if (c.kind() === TK.lparen) c.advance(); break; }
    c.advance();
  }

  // Parse JSX
  const root = parseJSXElement(c);

  // Dump inline debug log into _debugLines (emitted as Zig comments)
  if (globalThis.__SMITH_DEBUG_INLINE && globalThis.__dbg && globalThis.__dbg.length > 0) {
    for (let di = 0; di < globalThis.__dbg.length; di++) ctx._debugLines.push(globalThis.__dbg[di]);
  }

  // Log parse results
  LOG_EMIT('L002', { count: ctx.components.length, maps: ctx.maps.length });

  // Preflight validation — catch Class A + B bugs before wasting Zig build time
  const pf = preflight(ctx);
  LOG_EMIT('L092', { lane: pf.lane, summary: Object.keys(pf.intents).filter(function(k) { return pf.intents[k]; }).join(',') });
  for (let i = 0; i < pf.warnings.length; i++) LOG_EMIT('L091', { id: 'WARN', msg: pf.warnings[i] });
  for (let i = 0; i < pf.errors.length; i++) LOG_EMIT('L090', { id: 'FATAL', msg: pf.errors[i] });
  // Legacy debug output (active when --logs or __SMITH_DEBUG set directly)
  if (globalThis.__SMITH_DEBUG) {
    for (let i = 0; i < pf.warnings.length; i++) print('[preflight] WARN: ' + pf.warnings[i]);
    for (let i = 0; i < pf.errors.length; i++) print('[preflight] FATAL: ' + pf.errors[i]);
    print('[preflight] lane=' + pf.lane + ' ok=' + pf.ok);
  }
  if (!pf.ok) {
    return stampIntegrity(preflightErrorZig(pf, file));
  }

  // Store preflight result for emit to access (lane comment, warnings)
  ctx._preflight = pf;

  var zigOut = emitOutput(root.nodeExpr, file);
  LOG_EMIT('L003', { bytes: zigOut.length });
  LOG_EMIT('L004', { file: file });
  // Split mode returns its own encoding (no integrity stamp needed)
  if (typeof zigOut === 'string' && zigOut.indexOf('__SPLIT_OUTPUT__') === 0)
    return zigOut;
  return stampIntegrity(zigOut);
}

// ── Module compilation: .mod.tsz → .zig ─────────────────────────────
// Transpiles TypeScript-like imperative code to Zig.
// No JSX, no components, no app scaffolding.
function compileMod(source, file) {
  // Block-based module syntax: <module name> ... </module>
  if (source.indexOf('<module') !== -1) {
    return compileModBlock(source, file);
  }

  const basename = file.split('/').pop();
  let out = '//! Generated by Smith (mod mode) — do not edit\n//!\n//! Source: ' + basename + '\n\n';
  let hasStdImport = false;

  // Line-by-line transpilation
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === '') { out += '\n'; continue; }

    // Comments: // stays as //
    if (trimmed.startsWith('//')) { out += line + '\n'; continue; }

    // import X from @c("h1.h", "h2.h") → const X = @cImport({ @cInclude("h1.h"); ... })
    const cImportMatch = trimmed.match(/^import\s+(\w+)\s+from\s+@c\(([^)]+)\);?$/);
    if (cImportMatch) {
      const varName = cImportMatch[1];
      const headers = cImportMatch[2].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      out += 'const ' + varName + ' = @cImport({\n';
      for (const h of headers) {
        out += '    @cInclude("' + h + '");\n';
      }
      out += '});\n';
      continue;
    }

    // import X from "Y" → const X = @import("Y")
    const importMatch = trimmed.match(/^import\s+(\w+)\s+from\s+["']([^"']+)["'];?$/);
    if (importMatch) {
      if (importMatch[1] === 'std') hasStdImport = true;
      out += 'const ' + importMatch[1] + ' = @import("' + importMatch[2] + '");\n';
      continue;
    }

    // import { A, B } from "Y" → const A = @import("Y").A; etc
    const namedImport = trimmed.match(/^import\s*\{\s*([^}]+)\}\s*from\s+["']([^"']+)["'];?$/);
    if (namedImport) {
      const names = namedImport[1].split(',').map(n => n.trim());
      for (const name of names) {
        out += 'const ' + name + ' = @import("' + namedImport[2] + '").' + name + ';\n';
      }
      continue;
    }

    // extern("c") function name(args): RetType → fn name(args) callconv(.c) RetType
    const externFn = trimmed.match(/^(?:(export)\s+)?extern\("(\w+)"\)\s+function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(.+?))?\s*\{$/);
    if (externFn) {
      const [, exp, cc, name, params, ret] = externFn;
      const zigParams = transpileParams(params);
      const zigRet = ret ? transpileType(ret) : 'void';
      const pub = exp ? 'pub ' : '';
      out += pub + 'fn ' + name + '(' + zigParams + ') callconv(.' + cc + ') ' + zigRet + ' {\n';
      continue;
    }

    // export function name(args): RetType → pub fn name(args) RetType
    const exportFn = trimmed.match(/^export\s+function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(.+?))?\s*\{$/);
    if (exportFn) {
      const [, name, params, ret] = exportFn;
      const zigParams = transpileParams(params);
      const zigRet = ret ? transpileType(ret) : 'void';
      out += 'pub fn ' + name + '(' + zigParams + ') ' + zigRet + ' {\n';
      continue;
    }

    // function name(args): RetType → fn name(args) RetType
    const fnMatch = trimmed.match(/^function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(.+?))?\s*\{$/);
    if (fnMatch) {
      const [, name, params, ret] = fnMatch;
      const zigParams = transpileParams(params);
      const zigRet = ret ? transpileType(ret) : 'void';
      out += 'fn ' + name + '(' + zigParams + ') ' + zigRet + ' {\n';
      continue;
    }

    // const X = enum/struct/union { → passthrough (Zig type definitions)
    if (/^(const|pub const)\s+\w+\s*=\s*(enum|struct|union)\s*\{/.test(trimmed)) {
      out += line + '\n';
      continue;
    }

    // export let x: Type = expr → pub var x: Type = expr
    // export const x: Type = expr → pub const x: Type = expr
    // const x: Type = expr → const x: Type = expr
    // let x: Type = expr → var x: Type = expr
    const varMatch = trimmed.match(/^(export\s+)?(const|let|var)\s+(\w+)\s*(?::\s*([^=]+?))?\s*=\s*(.+);?$/);
    if (varMatch && !varMatch[5].trimEnd().replace(/;$/, '').endsWith('{')) {
      const [, exp, kind, name, type, expr] = varMatch;
      const pub = exp ? 'pub ' : '';
      const zigKind = (kind === 'let' || kind === 'var') ? 'var' : 'const';
      const typeAnnot = type ? ': ' + transpileType(type.trim()) : '';
      const indent = line.match(/^(\s*)/)[1];
      out += indent + pub + zigKind + ' ' + name + typeAnnot + ' = ' + transpileModExpr(expr.replace(/;$/, '')) + ';\n';
      continue;
    }

    // if (cond) { → if (cond) {
    if (trimmed.startsWith('if ') || trimmed.startsWith('if(')) {
      out += line.replace(/\bif\s*\(/, 'if (') + '\n';
      continue;
    }

    // while (cond) { → while (cond) {
    if (trimmed.startsWith('while ') || trimmed.startsWith('while(')) {
      out += line + '\n';
      continue;
    }

    // return expr; → return expr;
    if (trimmed.startsWith('return ')) {
      out += line + '\n';
      continue;
    }

    // Closing braces, bare statements
    out += line + '\n';
  }

  return out;
}

// ── Block-based module compiler ─────────────────────────────────────
// Handles <module name> with <types>, <ffi>, <state>, <functions> blocks.
// Each block tag is parsed independently — no ambiguity, no lookahead.

// Module-level state for the current compilation (set by compileModBlock)
var _modEnumVariants = [];
var _modFfiSymbols = {}; // symbol → prefix (e.g. 'socket' → 'posix')

const ZIG_KEYWORDS = ['error', 'type', 'test', 'return', 'break', 'continue', 'resume', 'cancel', 'suspend', 'align', 'async', 'await', 'catch', 'try', 'undefined', 'null', 'inline', 'comptime', 'volatile', 'extern', 'export', 'pub', 'fn', 'var', 'const', 'struct', 'enum', 'union', 'opaque', 'unreachable'];

function zigEscape(name) {
  if (ZIG_KEYWORDS.indexOf(name) !== -1) return '@"' + name + '"';
  return name;
}

function modTranspileType(ts) {
  const t = ts.trim();
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
  // ?Type → optional
  if (t.startsWith('?')) return '?' + modTranspileType(t.slice(1));
  // TypeName[N] → [N]TypeName (fixed array)
  const arrMatch = t.match(/^(\w+)\[(\d+)\]$/);
  if (arrMatch) return '[' + arrMatch[2] + ']' + modTranspileType(arrMatch[1]);
  // Type[] → slice — []Type
  if (t.endsWith('[]')) return '[]' + modTranspileType(t.slice(0, -2));
  // Pass through (user-defined types, Zig types)
  return t;
}

function compileModBlock(source, file) {
  const basename = file.split('/').pop();

  // Extract module name
  const moduleMatch = source.match(/<module\s+(\w+)>/);
  const moduleName = moduleMatch ? moduleMatch[1] : 'unknown';

  let out = '//! Generated by Smith (mod mode) — do not edit\n';
  out += '//! Source: ' + basename + '\n';
  out += '//! Module: ' + moduleName + '\n\n';
  out += 'const std = @import("std");\n';

  // Collect known type and enum variant names for context-aware codegen
  const typeNames = [];
  const enumVariants = {}; // typeName → [variant1, variant2, ...]
  const allVariants = []; // flat list of all enum variant names

  // Extract <ffi> block → import declarations
  const ffiMatch = source.match(/<ffi>([\s\S]*?)<\/ffi>/);
  if (ffiMatch) {
    out += emitFfiBlock(ffiMatch[1]);
  }

  // Extract <types> block
  const typesMatch = source.match(/<types>([\s\S]*?)<\/types>/);
  if (typesMatch) {
    out += emitTypesBlock(typesMatch[1], typeNames, enumVariants, allVariants);
  } else {
    out += '\n'; // blank line after imports when no types block
  }
  // Set module-level enum variants for expression transpiling
  _modEnumVariants = allVariants;

  // Extract <state> block
  const stateMatch = source.match(/<state>([\s\S]*?)<\/state>/);
  if (stateMatch) {
    out += emitStateBlock(stateMatch[1], typeNames);
  }

  // Extract <functions> block
  const fnMatch = source.match(/<functions>([\s\S]*?)<\/functions>/);
  if (fnMatch) {
    out += emitFunctionsBlock(fnMatch[1], typeNames, allVariants);
  }

  // Trim trailing whitespace but keep final newline
  return out.replace(/\n+$/, '\n');
}

function emitFfiBlock(content) {
  let out = '';
  _modFfiSymbols = {};
  const lines = content.split('\n');
  const imports = {}; // lib → prefix
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('//')) continue;
    const m = line.match(/^(\w+)\s+@\("([^"]+)"(?:\s*,\s*"([^"]+)")?\)/);
    if (m) {
      const symbol = m[1];
      const lib = m[2];
      const actualFn = m[3] || symbol;
      // Determine prefix from lib
      var prefix;
      if (lib.startsWith('std.')) {
        const parts = lib.split('.');
        prefix = parts[parts.length - 1];
      } else {
        prefix = lib.replace(/[^a-zA-Z0-9]/g, '_');
      }
      if (!imports[lib]) imports[lib] = prefix;
      _modFfiSymbols[symbol] = { prefix: prefix, fn: actualFn };
    }
  }
  for (const lib in imports) {
    if (lib.startsWith('std.')) {
      const parts = lib.split('.');
      out += 'const ' + parts[parts.length - 1] + ' = std.' + parts.slice(1).join('.') + ';\n';
    } else {
      out += 'const ' + imports[lib] + ' = @cImport({ @cInclude("' + lib + '"); });\n';
    }
  }
  return out;
}

function emitTypesBlock(content, typeNames, enumVariants, allVariants) {
  if (!enumVariants) enumVariants = {};
  if (!allVariants) allVariants = [];
  let out = '\n';
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('//')) { i++; continue; }

    // Type declaration: Name: ...
    const declMatch = line.match(/^([A-Z]\w*):\s*(.*)$/);
    if (!declMatch) { i++; continue; }

    const name = declMatch[1];
    const rest = declMatch[2].trim();
    typeNames.push(name);

    // Tagged union: Name: union { ... }
    if (rest.startsWith('union')) {
      const bodyLines = [];
      const hasOpenBrace = rest.includes('{');
      if (hasOpenBrace) {
        const after = rest.replace(/^union\s*\{\s*/, '').trim();
        if (after && after !== '}') bodyLines.push(after);
      }
      i++;
      while (i < lines.length) {
        const l = lines[i].trim();
        if (l === '}' || l === '};') break;
        if (l) bodyLines.push(l);
        i++;
      }
      i++; // skip closing }
      out += emitUnionDecl(name, bodyLines, typeNames);
      continue;
    }

    // Struct: Name: { ... }
    if (rest.startsWith('{')) {
      const bodyLines = [];
      const after = rest.slice(1).trim();
      if (after && after !== '}') bodyLines.push(after);
      i++;
      while (i < lines.length) {
        const l = lines[i].trim();
        if (l === '}' || l === '};') break;
        if (l) bodyLines.push(l);
        i++;
      }
      i++; // skip closing }
      out += emitStructDecl(name, bodyLines, typeNames);
      continue;
    }

    // Enum: Name: val1 | val2 | val3
    if (rest.includes('|')) {
      out += emitEnumDecl(name, rest, allVariants);
      i++;
      continue;
    }

    i++;
  }

  return out;
}

function emitEnumDecl(name, rest, allVariants) {
  const variants = rest.split('|').map(function(v) { return v.trim(); }).filter(Boolean);
  if (allVariants) { for (let v = 0; v < variants.length; v++) allVariants.push(variants[v]); }
  let out = 'pub const ' + name + ' = enum {\n';
  for (let v = 0; v < variants.length; v++) {
    out += '    ' + zigEscape(variants[v]) + ',\n';
  }
  out += '};\n\n';
  return out;
}

function emitStructDecl(name, bodyLines, typeNames) {
  let out = 'pub const ' + name + ' = struct {\n';
  for (let b = 0; b < bodyLines.length; b++) {
    const field = bodyLines[b].replace(/,\s*$/, '').trim();
    const fm = field.match(/^(\w+):\s*([^=]+?)(?:\s*=\s*(.+))?$/);
    if (!fm) continue;
    const fname = fm[1];
    const rawType = fm[2].trim();
    const ftype = modTranspileType(rawType);
    let fdefault = fm[3] ? fm[3].trim() : null;

    if (fdefault !== null) {
      fdefault = modTranspileDefault(fdefault, ftype, typeNames);
    } else {
      // Infer defaults for fields without explicit default
      fdefault = inferDefault(rawType, ftype, typeNames);
    }

    out += '    ' + fname + ': ' + ftype;
    if (fdefault !== null) out += ' = ' + fdefault;
    out += ',\n';
  }
  out += '};\n\n';
  return out;
}

function inferDefault(rawType, zigType, typeNames) {
  // string → ""
  if (rawType === 'string') return '""';
  // ?Type → null
  if (rawType.startsWith('?')) return 'null';
  // Type[N] where Type is a known struct → [_]Type{.{}} ** N
  const arrMatch = rawType.match(/^(\w+)\[(\d+)\]$/);
  if (arrMatch) {
    const elemType = arrMatch[1];
    const count = arrMatch[2];
    if (typeNames.indexOf(elemType) !== -1) return '[_]' + modTranspileType(elemType) + '{.{}} ** ' + count;
    // Primitive array like u8[65536] → undefined
    return 'undefined';
  }
  // Known struct type → .{}
  if (typeNames.indexOf(rawType) !== -1) return '.{}';
  return null;
}

function emitUnionDecl(name, bodyLines, typeNames) {
  let out = 'pub const ' + name + ' = union(enum) {\n';
  for (let b = 0; b < bodyLines.length; b++) {
    const field = bodyLines[b].replace(/,\s*$/, '').trim();
    const fm = field.match(/^(\w+):\s*(.+)$/);
    if (!fm) continue;
    out += '    ' + zigEscape(fm[1]) + ': ' + modTranspileType(fm[2].trim()) + ',\n';
  }
  out += '};\n\n';
  return out;
}

function modTranspileDefault(val, zigType, typeNames) {
  const v = val.trim();
  // Boolean
  if (v === 'true' || v === 'false') return v;
  // Null
  if (v === 'null' || v === 'none') return 'null';
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

function emitStateBlock(content, typeNames) {
  let out = '';
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('//')) continue;
    // name: Type[N] = default  OR  name: Type = default  OR  name: Type
    const m = line.match(/^(\w+):\s*([^=]+?)(?:\s*=\s*(.+))?$/);
    if (!m) continue;
    const vname = m[1];
    const rawType = m[2].trim();
    const vdefault = m[3] ? m[3].trim() : null;
    const zigType = modTranspileType(rawType);

    out += 'var ' + vname + ': ' + zigType;
    // Array types get zero-init
    const arrM = rawType.match(/^(\w+)\[(\d+)\]$/);
    if (arrM) {
      if (typeNames.indexOf(arrM[1]) !== -1) {
        out += ' = [_]' + modTranspileType(arrM[1]) + '{.{}} ** ' + arrM[2];
      } else {
        out += ' = undefined';
      }
    } else if (vdefault !== null) {
      out += ' = ' + modTranspileDefault(vdefault, zigType, typeNames);
    } else {
      out += ' = .{}';
    }
    out += ';\n';
  }
  return out;
}

function emitFunctionsBlock(content, typeNames, allVariants) {
  let out = '\n';
  // Split into individual functions by detecting sigs at base indent
  const lines = content.split('\n');
  const funcs = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]; const trimmed = raw.trim();
    if (!trimmed) { if (current) { funcs.push(current); current = null; } continue; }
    if (trimmed.startsWith('//')) {
      const indent = raw.match(/^(\s*)/)[1].length;
      if (indent <= 4 && current) { funcs.push(current); current = null; }
      continue;
    }
    if (!current && trimmed.match(/^\w+\(/)) { current = { sig: trimmed, body: [] }; continue; }
    if (current) { current.body.push(raw); continue; }
  }
  if (current) funcs.push(current);
  for (let f = 0; f < funcs.length; f++) out += emitOneFunction(funcs[f].sig, funcs[f].body, typeNames, allVariants);
  return out;
}
function emitOneFunction(sig, rawBodyLines, typeNames, allVariants) {
  const fnMatch = sig.match(/^(\w+)\(([^)]*)\)\s*(?::\s*(\S+))?\s*$/);
  if (!fnMatch) return '';
  const fname = fnMatch[1]; const params = fnMatch[2]; const ret = fnMatch[3] || 'void';
  const zigParams = modTranspileParams(params); const zigRet = modTranspileType(ret);
  const bodyLines = [];
  for (let i = 0; i < rawBodyLines.length; i++) {
    const raw = rawBodyLines[i]; const trimmed = raw.trim();
    if (!trimmed) continue;
    bodyLines.push({ indent: raw.match(/^(\s*)/)[1].length, text: trimmed });
  }
  if (bodyLines.length === 1 && bodyLines[0].text.match(/return .+\.map\(/)) {
    return emitMapFunction(fname, zigParams, zigRet, bodyLines[0].text, typeNames);
  }
  let out = 'pub fn ' + fname + '(' + zigParams + ') ' + zigRet + ' {\n';
  out += emitModBody(bodyLines, 0, typeNames, 1, allVariants);
  out += '}\n\n';
  return out;
}
function _unusedOldFunctionsBlock(content, typeNames) {
  let out = '\n';
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) { i++; continue; }

    // Function signature: name(params): RetType
    const fnMatch = trimmed.match(/^(\w+)\(([^)]*)\)\s*(?::\s*(\S+))?\s*$/);
    if (fnMatch) {
      const fname = fnMatch[1];
      const params = fnMatch[2];
      const ret = fnMatch[3] || 'void';
      const zigParams = modTranspileParams(params);
      const zigRet = modTranspileType(ret);

      out += 'pub fn ' + fname + '(' + zigParams + ') ' + zigRet + ' {\n';

      // Collect indented body lines
      i++;
      const bodyLines = [];
      while (i < lines.length) {
        const bl = lines[i];
        // Body lines are indented (at least 2 more spaces than the function sig)
        // or empty. Stop at next function sig or end.
        if (bl.trim() === '') { bodyLines.push(''); i++; continue; }
        const indent = bl.match(/^(\s*)/)[1].length;
        if (indent < 4 && bl.trim().match(/^\w+\(/)) break; // next function
        if (indent < 4 && !bl.trim().startsWith('//')) break;
        bodyLines.push(bl.trim());
        i++;
      }

      out += emitFunctionBody(bodyLines, typeNames, 1);
      out += '}\n\n';
      continue;
    }

    i++;
  }
  return out;
}

function modTranspileParams(params) {
  if (!params.trim()) return '';
  return params.split(',').map(function(p) {
    const m = p.trim().match(/^(\w+):\s*(.+)$/);
    if (m) return m[1] + ': ' + modTranspileType(m[2].trim());
    return p.trim();
  }).join(', ');
}

function emitFunctionBody(lines, typeNames, depth) {
  let out = '';
  const indent = '    '.repeat(depth);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) { i++; continue; }

    // Guard: cond ? stop : go → if (cond) return ...;
    const guardMatch = line.match(/^(.+)\s+\?\s+stop\s*:\s*go$/);
    if (guardMatch) {
      out += indent + 'if (' + modTranspileExpr(guardMatch[1]) + ') return ' + modGuardReturn(depth) + ';\n';
      i++;
      continue;
    }

    // Return
    if (line.startsWith('return ')) {
      out += indent + 'return ' + modTranspileExpr(line.slice(7)) + ';\n';
      i++;
      continue;
    }

    // Switch: switch name:
    const switchMatch = line.match(/^switch\s+(\w+):$/);
    if (switchMatch) {
      const switchVar = switchMatch[1];
      out += indent + 'switch (' + switchVar + ') {\n';
      i++;
      // Collect arms until de-indent
      while (i < lines.length && lines[i]) {
        const arm = lines[i];
        // Arm: variant:
        const armMatch = arm.match(/^(\w+):$/);
        if (armMatch) {
          out += indent + '    .' + armMatch[1] + ' => {\n';
          i++;
          // Collect arm body
          const armBody = [];
          while (i < lines.length && lines[i] && !lines[i].match(/^\w+:$/) && !lines[i].startsWith('return ')) {
            armBody.push(lines[i]);
            i++;
          }
          // Check if next line is return (belongs to outer scope, not arm)
          out += emitArmBody(armBody, typeNames, depth + 2);
          out += indent + '    },\n';
          continue;
        }
        break;
      }
      out += indent + '}\n';
      continue;
    }

    // For loop: for array as item:
    const forMatch = line.match(/^for\s+(.+?)\s+as\s+(\w+):$/);
    if (forMatch) {
      const arrExpr = forMatch[1];
      const itemVar = forMatch[2];
      out += indent + 'var _i: usize = 0;\n';
      // Determine the count expression
      const rangeMatch = arrExpr.match(/^(\w+)\[(\d+)\.\.(\w+)\]$/);
      if (rangeMatch) {
        out += indent + 'while (_i < ' + rangeMatch[3] + ') : (_i += 1) {\n';
      } else {
        out += indent + 'while (_i < ' + arrExpr + '.len) : (_i += 1) {\n';
      }
      i++;
      // Collect body
      const forBody = [];
      while (i < lines.length && lines[i] && !lines[i].match(/^\w+\(/) && !lines[i].match(/^return /)) {
        forBody.push(lines[i]);
        i++;
      }
      out += emitForBody(forBody, arrExpr, itemVar, typeNames, depth + 1);
      out += indent + '}\n';
      continue;
    }

    // Assignment: target = { ... } → struct init
    const structAssign = line.match(/^(.+?)\s*=\s*\{(.+)\}\s*$/);
    if (structAssign) {
      const target = modTranspileExpr(structAssign[1]);
      const fields = structAssign[2].split(',').map(function(f) {
        const kv = f.trim().match(/^(\w+):\s*(.+)$/);
        if (kv) return '.' + kv[1] + ' = ' + modTranspileExpr(kv[2].trim());
        return f.trim();
      }).join(', ');
      out += indent + target + ' = .{ ' + fields + ' };\n';
      i++;
      continue;
    }

    // Assignment: target = expr
    const assignMatch = line.match(/^(.+?)\s*=\s*(.+)$/);
    if (assignMatch && !assignMatch[1].includes('(')) {
      const target = modTranspileExpr(assignMatch[1]);
      const val = modTranspileExpr(assignMatch[2]);
      out += indent + target + ' = ' + val + ';\n';
      i++;
      continue;
    }

    // Bare expression / statement
    out += indent + modTranspileExpr(line) + ';\n';
    i++;
  }

  return out;
}

function emitArmBody(lines, typeNames, depth) {
  let out = '';
  const indent = '    '.repeat(depth);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    // Ternary assignment: cond ? target = val1 : target = val2
    const ternAssign = line.match(/^(.+?)\s+and\s+(.+)$/);
    // cond\n  ? expr1\n  : expr2 — check for multi-line ternary
    const condAssign = line.match(/^(.+)\s*\?\s*(.+?)\s*:\s*(.+)$/);
    if (condAssign) {
      const cond = modTranspileExpr(condAssign[1]);
      const ifTrue = condAssign[2].trim();
      const ifFalse = condAssign[3].trim();
      // Both sides are assignments
      const trueAssign = ifTrue.match(/^(.+?)\s*=\s*(.+)$/);
      const falseAssign = ifFalse.match(/^(.+?)\s*=\s*(.+)$/);
      if (trueAssign && falseAssign) {
        out += indent + 'if (' + cond + ') {\n';
        out += indent + '    ' + modTranspileExpr(trueAssign[1]) + ' = ' + modTranspileExpr(trueAssign[2]) + ';\n';
        out += indent + '} else {\n';
        out += indent + '    ' + modTranspileExpr(falseAssign[1]) + ' = ' + modTranspileExpr(falseAssign[2]) + ';\n';
        out += indent + '}\n';
        continue;
      }
    }
    // Fallback: assignment or expression
    const assignMatch = line.match(/^(.+?)\s*=\s*(.+)$/);
    if (assignMatch && !assignMatch[1].includes('(')) {
      out += indent + modTranspileExpr(assignMatch[1]) + ' = ' + modTranspileExpr(assignMatch[2]) + ';\n';
    } else {
      out += indent + modTranspileExpr(line) + ';\n';
    }
  }
  return out;
}

function emitForBody(lines, arrExpr, itemVar, typeNames, depth) {
  let out = '';
  const indent = '    '.repeat(depth);
  // Determine the array access pattern
  const rangeMatch = arrExpr.match(/^(\w+)\[(\d+)\.\.(\w+)\]$/);
  const baseArr = rangeMatch ? rangeMatch[1] : arrExpr;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    // cond ? action; return : continue
    const condMatch = line.match(/^(.+?)\s*\?\s*(.+?)\s*;\s*return\s*:\s*continue$/);
    if (condMatch) {
      out += indent + 'if (' + modTranspileForExpr(condMatch[1], baseArr, itemVar) + ') {\n';
      // Parse the action part (may be multiple semicoloned statements)
      const actions = condMatch[2].split(';').map(function(a) { return a.trim(); }).filter(Boolean);
      for (let a = 0; a < actions.length; a++) {
        const am = actions[a].match(/^(.+?)\s*=\s*(.+)$/);
        if (am) {
          out += indent + '    ' + modTranspileForExpr(am[1], baseArr, itemVar) + ' = ' + modTranspileForExpr(am[2], baseArr, itemVar) + ';\n';
        } else if (actions[a].startsWith('return')) {
          out += indent + '    return ' + modTranspileForExpr(actions[a].slice(7), baseArr, itemVar) + ';\n';
        } else {
          out += indent + '    ' + modTranspileForExpr(actions[a], baseArr, itemVar) + ';\n';
        }
      }
      out += indent + '}\n';
      continue;
    }
    // Regular line
    const assignMatch = line.match(/^(.+?)\s*=\s*(.+)$/);
    if (assignMatch) {
      out += indent + modTranspileForExpr(assignMatch[1], baseArr, itemVar) + ' = ' + modTranspileForExpr(assignMatch[2], baseArr, itemVar) + ';\n';
    } else {
      out += indent + modTranspileForExpr(line, baseArr, itemVar) + ';\n';
    }
  }
  return out;
}

function modTranspileForExpr(expr, baseArr, itemVar) {
  // Replace item.field with baseArr[_i].field
  let e = expr.replace(new RegExp('\\b' + itemVar + '\\.', 'g'), baseArr + '[_i].');
  // Replace bare item with baseArr[_i]
  e = e.replace(new RegExp('\\b' + itemVar + '\\b', 'g'), baseArr + '[_i]');
  return modTranspileExpr(e);
}

function modTranspileExpr(expr) {
  let e = expr.trim();
  // exact → ==
  e = e.replace(/\bexact\b/g, '==');
  // Prefix known enum variants with . (but not if already prefixed or part of a dotted access)
  if (_modEnumVariants && _modEnumVariants.length > 0) {
    for (let v = 0; v < _modEnumVariants.length; v++) {
      var vname = _modEnumVariants[v];
      // Match standalone enum variant (not preceded by . or followed by . or ()
      // Must be after = or == or space, not part of a.b.variant
      e = e.replace(new RegExp('(?<=[=\\s,;(])' + vname + '(?=[\\s;,)=]|$)', 'g'), '.' + vname);
      // Also handle at start of expression
      if (e === vname || e.startsWith(vname + ' ') || e.startsWith(vname + ';')) {
        e = '.' + e;
      }
    }
  }
  // and / or
  e = e.replace(/\band\b/g, 'and');
  e = e.replace(/\bor\b/g, 'or');
  // !== and === → != and ==
  e = e.replace(/===/g, '==');
  e = e.replace(/!==/g, '!=');
  // || → or, && → and
  e = e.replace(/\|\|/g, ' or ');
  e = e.replace(/&&/g, ' and ');
  // ?? → orelse
  e = e.replace(/\?\?/g, ' orelse ');
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
  // ── String concatenation → std.fmt.bufPrint ──
  // Only trigger when expression contains a string literal with +
  if (e.indexOf(" + ") !== -1 && e.indexOf("'") !== -1) {
    var bufPrint = transpileStringConcat(e);
    if (bufPrint) return bufPrint;
  }
  return e;
}

function transpileStringConcat(expr) {
  // Split on + but respect quoted strings
  var parts = [];
  var cur = '';
  var inStr = false;
  for (var c = 0; c < expr.length; c++) {
    if (expr[c] === "'" && !inStr) { inStr = true; cur += expr[c]; continue; }
    if (expr[c] === "'" && inStr) { inStr = false; cur += expr[c]; continue; }
    if (!inStr && expr[c] === '+' && (c === 0 || expr[c-1] === ' ') && (c + 1 >= expr.length || expr[c+1] === ' ')) {
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

function emitModBody(lines, startIdx, typeNames, depth) {
  let out = '';
  const ind = '    '.repeat(depth);
  let i = startIdx;
  while (i < lines.length) {
    const L = lines[i]; const text = L.text;
    // Guard: cond ? stop : go
    const guardMatch = text.match(/^(.+?)\s+\?\s+stop\s*:\s*go$/);
    if (guardMatch) { out += ind + 'if (' + modTranspileExpr(guardMatch[1]) + ') return count;\n'; i++; continue; }
    // Return
    if (text.startsWith('return ')) { out += ind + 'return ' + modTranspileExpr(text.slice(7)) + ';\n'; i++; continue; }
    // Switch
    const switchMatch = text.match(/^switch\s+(\w+):$/);
    if (switchMatch) {
      out += ind + 'switch (' + switchMatch[1] + ') {\n'; i++;
      while (i < lines.length) {
        const armMatch = lines[i].text.match(/^(\w+):$/);
        if (!armMatch) break;
        const armIndent = lines[i].indent;
        out += ind + '    .' + armMatch[1] + ' => {\n'; i++;
        const armBody = [];
        while (i < lines.length && !lines[i].text.match(/^\w+:$/) && lines[i].indent > armIndent) { armBody.push(lines[i]); i++; }
        out += emitArmBodyV2(armBody, typeNames, depth + 2);
        out += ind + '    },\n';
      }
      out += ind + '}\n'; continue;
    }
    // For loop
    const forMatch = text.match(/^for\s+(.+?)\s+as\s+(\w+):$/);
    if (forMatch) {
      const forIndent = L.indent; i++;
      const forBody = [];
      while (i < lines.length && lines[i].indent > forIndent) { forBody.push(lines[i]); i++; }
      out += emitForLoopV2(forMatch[1], forMatch[2], forBody, typeNames, depth); continue;
    }
    // Struct init: target = { field: val }
    const structAssign = text.match(/^(.+?)\s*=\s*\{(.+)\}\s*$/);
    if (structAssign && !isComparison(structAssign[1])) {
      const target = modTranspileExpr(structAssign[1]);
      out += ind + target + ' = ' + transpileStructLiteral(structAssign[2]) + ';\n'; i++; continue;
    }
    // Assignment: target = expr (not >= <= == !=)
    const assignMatch = text.match(/^([^=!<>]+?)\s*=\s*([^=].*)$/);
    if (assignMatch && !assignMatch[1].includes('(') && !isComparison(assignMatch[1])) {
      const target = modTranspileExpr(assignMatch[1].trim());
      const val = modTranspileExpr(assignMatch[2].trim());
      // Local variable declaration: bare identifier = expr → var name[: Type] = val
      const rawTarget = assignMatch[1].trim();
      if (/^\w+$/.test(rawTarget) && !rawTarget.includes('.') && !rawTarget.includes('[')) {
        const inferredType = inferTypeFromValue(assignMatch[2].trim());
        if (inferredType) {
          out += ind + 'var ' + target + ': ' + inferredType + ' = ' + val + ';\n'; i++; continue;
        }
        // Function call: result = fn(...) — emit var (Zig infers type)
        if (/\w+\(/.test(assignMatch[2].trim())) {
          out += ind + 'const ' + target + ' = ' + val + ';\n'; i++; continue;
        }
      }
      const esc = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const incMatch = val.match(new RegExp('^' + esc + '\\s*\\+\\s*(.+)$'));
      if (incMatch) { out += ind + target + ' += ' + incMatch[1] + ';\n'; }
      else {
        const decMatch = val.match(new RegExp('^' + esc + '\\s*-\\s*(.+)$'));
        if (decMatch) { out += ind + target + ' -= ' + decMatch[1] + ';\n'; }
        else { out += ind + target + ' = ' + val + ';\n'; }
      }
      i++; continue;
    }
    out += ind + modTranspileExpr(text) + ';\n'; i++;
  }
  return out;
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
function emitArmBodyV2(lines, typeNames, depth) {
  let out = ''; const ind = '    '.repeat(depth);
  // Multi-line ternary: condition \n ? true-expr \n : false-expr
  if (lines.length >= 3 && lines[1].text.startsWith('? ') && lines[2].text.startsWith(': ')) {
    const cond = modTranspileExpr(lines[0].text);
    const trueExpr = lines[1].text.slice(2).trim();
    const falseExpr = lines[2].text.slice(2).trim();
    const ta = trueExpr.match(/^([^=!<>]+?)\s*=\s*([^=].*)$/);
    const fa = falseExpr.match(/^([^=!<>]+?)\s*=\s*([^=].*)$/);
    if (ta && fa) {
      out += ind + 'if (' + cond + ') {\n';
      out += ind + '    ' + modTranspileExpr(ta[1].trim()) + ' = ' + modTranspileExpr(ta[2].trim()) + ';\n';
      out += ind + '} else {\n';
      out += ind + '    ' + modTranspileExpr(fa[1].trim()) + ' = ' + modTranspileExpr(fa[2].trim()) + ';\n';
      out += ind + '}\n';
      return out;
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].text;
    const am = text.match(/^([^=!<>]+?)\s*=\s*([^=].*)$/);
    if (am) { out += ind + modTranspileExpr(am[1].trim()) + ' = ' + modTranspileExpr(am[2].trim()) + ';\n'; }
    else { out += ind + modTranspileExpr(text) + ';\n'; }
  }
  return out;
}
function emitForLoopV2(arrExpr, itemVar, bodyLines, typeNames, depth) {
  let out = ''; const ind = '    '.repeat(depth);
  const rangeMatch = arrExpr.match(/^(\w+)\[(\d+)\.\.(\w+)\]$/);
  const baseArr = rangeMatch ? rangeMatch[1] : arrExpr;
  const countExpr = rangeMatch ? rangeMatch[3] : arrExpr + '.len';
  out += ind + 'var _i: usize = 0;\n';
  out += ind + 'while (_i < ' + countExpr + ') : (_i += 1) {\n';
  let i = 0;
  while (i < bodyLines.length) {
    const text = bodyLines[i].text;
    // Multi-line ternary: cond \n ? action \n : continue
    if (i + 2 < bodyLines.length && bodyLines[i+1].text.startsWith('? ') && bodyLines[i+2].text.startsWith(': ')) {
      const cond = modTranspileForExprV2(text, baseArr, itemVar);
      const trueExpr = modTranspileForExprV2(bodyLines[i+1].text.slice(2).trim(), baseArr, itemVar);
      const falseExpr = bodyLines[i+2].text.slice(2).trim();
      out += ind + '    if (' + cond + ') {\n';
      // True branch: may have multiple statements separated by ;
      const stmts = trueExpr.split(';').map(function(s) { return s.trim(); }).filter(Boolean);
      for (let s = 0; s < stmts.length; s++) {
        const stmt = stmts[s];
        if (stmt.startsWith('return ')) {
          out += ind + '        ' + stmt + ';\n';
        } else {
          const ta = stmt.match(/^([^=!<>]+?)\s*=\s*([^=].*)$/);
          if (ta) {
            const target = ta[1].trim(); const val = ta[2].trim();
            const esc = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const inc = val.match(new RegExp('^' + esc + '\\s*\\+\\s*(.+)$'));
            const dec = !inc ? val.match(new RegExp('^' + esc + '\\s*-\\s*(.+)$')) : null;
            if (inc) { out += ind + '        ' + target + ' += ' + inc[1] + ';\n'; }
            else if (dec) { out += ind + '        ' + target + ' -= ' + dec[1] + ';\n'; }
            else { out += ind + '        ' + target + ' = ' + val + ';\n'; }
          } else {
            out += ind + '        ' + stmt + ';\n';
          }
        }
      }
      out += ind + '    }\n';
      i += 3; continue;
    }
    // Single line
    const processed = modTranspileForExprV2(text, baseArr, itemVar);
    const am = processed.match(/^([^=!<>]+?)\s*=\s*([^=].*)$/);
    if (am) { out += ind + '    ' + am[1].trim() + ' = ' + am[2].trim() + ';\n'; }
    else { out += ind + '    ' + processed + ';\n'; }
    i++;
  }
  out += ind + '}\n';
  return out;
}
function emitMapFunction(fname, zigParams, zigRet, bodyText, typeNames) {
  const mapMatch = bodyText.match(/return\s+(\w+)\[(\d+)\.\.(\w+)\]\.map\((\w+)\s*=>\s*(\w+)\.(\w+)\)/);
  if (mapMatch) {
    const arr = mapMatch[1]; const end = mapMatch[3]; const field = mapMatch[6];
    let out = 'pub fn ' + fname + '(buf: []i64) []i64 {\n';
    out += '    var i: usize = 0;\n';
    out += '    while (i < ' + end + ') : (i += 1) {\n';
    out += '        buf[i] = ' + arr + '[i].' + field + ';\n';
    out += '    }\n';
    out += '    return buf[0..' + end + '];\n';
    out += '}\n\n';
    return out;
  }
  return 'pub fn ' + fname + '(' + zigParams + ') ' + zigRet + ' {\n    // TODO: map\n}\n\n';
}
function modTranspileForExprV2(expr, baseArr, itemVar) {
  let e = expr;
  e = e.replace(new RegExp('\\b' + itemVar + '\\.', 'g'), baseArr + '[_i].');
  e = e.replace(new RegExp('\\b' + itemVar + '\\b', 'g'), baseArr + '[_i]');
  return modTranspileExpr(e);
}

// Transpile TS type annotations to Zig types
function transpileType(ts) {
  const t = ts.trim();
  if (t === 'number') return 'i64';
  if (t === 'float' || t === 'f32') return 'f32';
  if (t === 'f64') return 'f64';
  if (t === 'boolean' || t === 'bool') return 'bool';
  if (t === 'string') return '[]const u8';
  if (t === 'void') return 'void';
  if (t === 'any') return 'anytype';
  if (t.startsWith('!')) return '!' + transpileType(t.slice(1));
  // Pass through Zig types unchanged
  return t;
}

// Transpile function parameters
function transpileParams(params) {
  if (!params.trim()) return '';
  return params.split(',').map(p => {
    const m = p.trim().match(/^(\w+)\s*:\s*(.+)$/);
    if (m) return m[1] + ': ' + transpileType(m[2]);
    return p.trim();
  }).join(', ');
}

// Transpile expressions for --mod mode (ported from love2d tsl.mjs patterns)
function transpileModExpr(expr) {
  let e = expr.trim();
  // null/undefined → null
  e = e.replace(/\bundefined\b/g, 'null');
  // !== and != → != (Zig uses !=, same)
  // === and == → == (Zig uses ==, same)
  e = e.replace(/===/g, '==');
  e = e.replace(/!==/g, '!=');
  // || → or (Zig uses 'or' for optional/boolean)
  e = e.replace(/\|\|/g, ' or ');
  // && → and
  e = e.replace(/&&/g, ' and ');
  // !expr → !expr (same in Zig)
  // x ?? y → x orelse y
  e = e.replace(/\?\?/g, ' orelse ');
  return e;
}

// ── Module compilation: .mod.tsz → .lua ──────────────────────────────
// Transpiles TypeScript-like imperative code to Lua.
function compileModLua(source, file) {
  const basename = file.split('/').pop();
  let out = '-- Generated by Smith (mod mode, target=lua) — do not edit\n-- Source: ' + basename + '\n\n';

  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.match(/^(\s*)/)[1];

    if (trimmed === '') { out += '\n'; continue; }
    if (trimmed.startsWith('//')) { out += indent + '--' + trimmed.slice(2) + '\n'; continue; }

    // import X from "Y" → local X = require("Y")
    const importMatch = trimmed.match(/^import\s+(\w+)\s+from\s+["']([^"']+)["'];?$/);
    if (importMatch) {
      out += indent + 'local ' + importMatch[1] + ' = require("' + importMatch[2] + '")\n';
      continue;
    }

    // import { A, B } from "Y" → local A, B = require("Y").A, require("Y").B
    const namedImport = trimmed.match(/^import\s*\{\s*([^}]+)\}\s*from\s+["']([^"']+)["'];?$/);
    if (namedImport) {
      const names = namedImport[1].split(',').map(n => n.trim());
      for (const name of names) {
        out += indent + 'local ' + name + ' = require("' + namedImport[2] + '").' + name + '\n';
      }
      continue;
    }

    // export function name(args): RetType → function name(args)
    const exportFn = trimmed.match(/^export\s+function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*\S+)?\s*\{$/);
    if (exportFn) {
      const params = exportFn[2].split(',').map(p => p.trim().replace(/\s*:.*$/, '')).filter(Boolean).join(', ');
      out += indent + 'function ' + exportFn[1] + '(' + params + ')\n';
      continue;
    }

    // function name(args): RetType → local function name(args)
    const fnMatch = trimmed.match(/^function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*\S+)?\s*\{$/);
    if (fnMatch) {
      const params = fnMatch[2].split(',').map(p => p.trim().replace(/\s*:.*$/, '')).filter(Boolean).join(', ');
      out += indent + 'local function ' + fnMatch[1] + '(' + params + ')\n';
      continue;
    }

    // const/let/var → local
    const varMatch = trimmed.match(/^(const|let|var)\s+(\w+)\s*(?::\s*[^=]+?)?\s*=\s*(.+);?$/);
    if (varMatch) {
      out += indent + 'local ' + varMatch[2] + ' = ' + varMatch[3].replace(/;$/, '') + '\n';
      continue;
    }

    // } → end
    if (trimmed === '}') { out += indent + 'end\n'; continue; }

    // if (cond) { → if cond then
    const ifMatch = trimmed.match(/^if\s*\((.+)\)\s*\{$/);
    if (ifMatch) { out += indent + 'if ' + ifMatch[1] + ' then\n'; continue; }

    // } else if (cond) { → elseif cond then
    const elseifMatch = trimmed.match(/^\}\s*else\s+if\s*\((.+)\)\s*\{$/);
    if (elseifMatch) { out += indent + 'elseif ' + elseifMatch[1] + ' then\n'; continue; }

    // } else { → else
    if (trimmed === '} else {') { out += indent + 'else\n'; continue; }

    // while (cond) { → while cond do
    const whileMatch = trimmed.match(/^while\s*\((.+)\)\s*\{$/);
    if (whileMatch) { out += indent + 'while ' + whileMatch[1] + ' do\n'; continue; }

    // for (const x of arr) { → for _, x in ipairs(arr) do
    const forOfMatch = trimmed.match(/^for\s*\(\s*(?:const|let|var)\s+(\w+)\s+of\s+(.+)\)\s*\{$/);
    if (forOfMatch) { out += indent + 'for _, ' + forOfMatch[1] + ' in ipairs(' + forOfMatch[2] + ') do\n'; continue; }

    // return expr; → return expr
    if (trimmed.startsWith('return ')) { out += indent + trimmed.replace(/;$/, '') + '\n'; continue; }

    // Bare statement — strip trailing semicolons
    out += indent + trimmed.replace(/;$/, '') + '\n';
  }

  return out;
}

// ── Module compilation: .mod.tsz → .js ───────────────────────────────
// Transpiles TypeScript-like code to JavaScript (strip type annotations).
function compileModJS(source, file) {
  const basename = file.split('/').pop();
  let out = '// Generated by Smith (mod mode, target=js) — do not edit\n// Source: ' + basename + '\n\n';

  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.match(/^(\s*)/)[1];

    if (trimmed === '') { out += '\n'; continue; }
    if (trimmed.startsWith('//')) { out += line + '\n'; continue; }

    // import X from "Y" → stays as-is (JS module)
    if (trimmed.startsWith('import ')) { out += line + '\n'; continue; }

    // export function name(args): RetType → export function name(args) {
    const exportFn = trimmed.match(/^export\s+function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*\S+)?\s*\{$/);
    if (exportFn) {
      const params = exportFn[2].split(',').map(p => p.trim().replace(/\s*:\s*\S+$/, '')).filter(Boolean).join(', ');
      out += indent + 'export function ' + exportFn[1] + '(' + params + ') {\n';
      continue;
    }

    // function name(args): RetType → function name(args) {
    const fnMatch = trimmed.match(/^function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*\S+)?\s*\{$/);
    if (fnMatch) {
      const params = fnMatch[2].split(',').map(p => p.trim().replace(/\s*:\s*\S+$/, '')).filter(Boolean).join(', ');
      out += indent + 'function ' + fnMatch[1] + '(' + params + ') {\n';
      continue;
    }

    // const/let/var with type annotations → strip type
    const varMatch = trimmed.match(/^(const|let|var)\s+(\w+)\s*:\s*[^=]+?=\s*(.+)$/);
    if (varMatch) {
      out += indent + varMatch[1] + ' ' + varMatch[2] + ' = ' + varMatch[3] + '\n';
      continue;
    }

    // Everything else passes through (JS is close to TS without types)
    out += line + '\n';
  }

  return out;
}
