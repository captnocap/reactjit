// Smith — compiler intelligence in JS.
//
// Globals set by Forge:
//   __source  — .tsz source text
//   __tokens  — "kind start end\n..." flat token data
//   __file    — input file path


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

      // Record the function body start (opening {)
      const funcBodyPos = c.pos;

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
        ctx.components.push({ name, propNames, isBareParams, funcBodyPos, bodyPos, stateSlots: compStateSlots });
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

// Resolve props.X dot-access: if current token is the component's bare param name
// (e.g., 'props') and next tokens are .fieldName, check if fieldName is in propStack.
// Returns { field, value } if resolved, null otherwise. Does NOT advance cursor.
function peekPropsAccess(c) {
  if (!ctx.propsObjectName || c.kind() !== TK.identifier || c.text() !== ctx.propsObjectName) return null;
  if (c.pos + 2 >= c.count) return null;
  if (c.kindAt(c.pos + 1) !== TK.dot || c.kindAt(c.pos + 2) !== TK.identifier) return null;
  const field = c.textAt(c.pos + 2);
  if (ctx.propStack && ctx.propStack[field] !== undefined) return { field: field, value: ctx.propStack[field] };
  return null;
}

// Skip past props.X tokens (3 tokens: identifier, dot, identifier)
function skipPropsAccess(c) {
  c.advance(); c.advance(); c.advance();
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
                      else if (c.kind() === TK.lbrace) {
                        // Nested object field: config: { theme: { primary: 0x000000 } }
                        // Recursively collect leaf fields with flattened names (e.g., config_theme_primary)
                        // Stores explicit jsPath for JS property access chain
                        const flatFields = [];
                        const collectFlat = function(prefix, pathSoFar) {
                          c.advance(); // skip {
                          while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
                            if (c.kind() === TK.identifier) {
                              const nf = c.text(); c.advance();
                              if (c.kind() === TK.colon) c.advance();
                              const fullName = prefix + '_' + nf;
                              const fullPath = pathSoFar.concat([nf]);
                              if (c.kind() === TK.lbrace) {
                                collectFlat(fullName, fullPath);
                              } else {
                                let nft = 'int';
                                if (c.kind() === TK.string) { nft = 'string'; c.advance(); }
                                else if (c.kind() === TK.number) { const nv = c.text(); nft = nv.startsWith('0x') ? 'int' : (nv.includes('.') ? 'float' : 'int'); c.advance(); }
                                else if (c.isIdent('true') || c.isIdent('false')) { nft = 'boolean'; c.advance(); }
                                flatFields.push({ name: fullName, type: nft, jsPath: fullPath });
                              }
                            }
                            if (c.kind() === TK.comma) c.advance();
                            else if (c.kind() !== TK.rbrace) c.advance();
                          }
                          if (c.kind() === TK.rbrace) c.advance();
                        };
                        collectFlat(fname, [fname]);
                        for (const ff of flatFields) fields.push(ff);
                        if (c.kind() === TK.comma) c.advance();
                        continue;
                      }
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

var _activeTheme = {};  // resolved theme tokens (from first theme() call = default)

function collectClassifiers() {
  ctx.classifiers = {};
  const clsText = globalThis.__clsContent;
  if (!clsText) return;
  try {
    let merged = {};
    let themeCollected = false;
    const classifier = function(obj) { for (const k in obj) merged[k] = obj[k]; };
    // effects/glyphs defined as no-ops so eval doesn't throw
    const effects = function() {};
    const glyphs = function() {};
    // theme() collects the first (default) theme for token resolution
    const theme = function(name, obj) {
      if (!themeCollected) { _activeTheme = obj; themeCollected = true; }
    };
    const variants = function() {};
    // Strip 'from' import lines — they're not valid JS (already resolved by forge)
    const cleanText = clsText.split('\n').filter(function(l) { return !l.trim().match(/^from\s+['"]/); }).join('\n');
    eval(cleanText); // direct eval — sees local bindings
    ctx.classifiers = merged;
  } catch(e) {
    if (!ctx._debugLines) ctx._debugLines = [];
    ctx._debugLines.push('collectClassifiers eval failed: ' + String(e));
  }
}

// Default style token values (matches theme.zig rounded_airy preset)
var _defaultStyleTokens = {
  radiusSm: 4, radiusMd: 8, radiusLg: 16,
  spacingSm: 8, spacingMd: 16, spacingLg: 24,
  borderThin: 1, borderMedium: 2,
  fontSm: 10, fontMd: 13, fontLg: 18,
};

// Resolve 'theme-*' string to its value from the active theme
function resolveThemeToken(val) {
  if (typeof val !== 'string') return val;
  if (!val.startsWith('theme-')) return val;
  const token = val.slice(6); // strip 'theme-'
  if (_activeTheme[token] !== undefined) return _activeTheme[token];
  if (_defaultStyleTokens[token] !== undefined) return _defaultStyleTokens[token];
  return val; // unresolved — pass through
}

// Convert a classifier definition's style object → Zig styleFields array
function clsStyleFields(def) {
  if (!def || !def.style) return [];
  const fields = [];
  const style = def.style;
  for (const key of Object.keys(style)) {
    const raw = style[key];
    const val = resolveThemeToken(raw);
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
  if (def.fontSize !== undefined) fields.push(`.font_size = ${resolveThemeToken(def.fontSize)}`);
  if (def.color !== undefined) fields.push(`.text_color = ${parseColor(String(resolveThemeToken(def.color)))}`);
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

  // Page mode: <page route=name> declarative syntax
  if (source.indexOf('<page') !== -1 && source.match(/<page\s+route=/)) {
    return compilePage(source, c, file);
  }

  // Phase 1: Collect script, components, state, and classifiers
  collectScript(c);
  collectComponents(c);
  collectState(c);
  collectConstArrays(c);
  collectClassifiers();

  // Extract variant names from classifiers (ordered, deduplicated)
  for (var clsKey in ctx.classifiers) {
    var def = ctx.classifiers[clsKey];
    if (def.variants) {
      for (var vn of Object.keys(def.variants)) {
        if (ctx.variantNames.indexOf(vn) === -1) ctx.variantNames.push(vn);
      }
    }
  }

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
