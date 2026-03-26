// Smith — compiler intelligence in JS.
//
// Globals set by Forge:
//   __source  — .tsz source text
//   __tokens  — "kind start end\n..." flat token data
//   __file    — input file path

// ── Token kinds (must match lexer.zig TokenKind enum order) ──
const TK = {
  identifier: 0, number: 1, string: 2, template_literal: 3,
  lparen: 4, rparen: 5, lbrace: 6, rbrace: 7, lbracket: 8, rbracket: 9,
  comma: 10, colon: 11, semicolon: 12, dot: 13, spread: 14, equals: 15,
  arrow: 16, plus: 17, minus: 18, star: 19, slash: 20, percent: 21, bang: 22,
  eq_eq: 23, not_eq: 24, gt_eq: 25, lt_eq: 26,
  ampersand: 27, pipe: 28, caret: 29, tilde: 30, shift_left: 31, shift_right: 32,
  wrap_mul: 33, wrap_add: 34, wrap_sub: 35, caret_eq: 36,
  amp_amp: 37, pipe_pipe: 38,
  question: 39, question_question: 40,
  lt: 41, gt: 42, slash_gt: 43, lt_slash: 44,
  ffi_pragma: 45, comment: 46, builtin: 47, eof: 48,
};

// ── Rules ──

const styleKeys = {
  width: 'width', height: 'height', minWidth: 'min_width', maxWidth: 'max_width',
  minHeight: 'min_height', maxHeight: 'max_height',
  flexGrow: 'flex_grow', flexShrink: 'flex_shrink', flexBasis: 'flex_basis',
  gap: 'gap', order: 'order',
  padding: 'padding', paddingLeft: 'padding_left', paddingRight: 'padding_right',
  paddingTop: 'padding_top', paddingBottom: 'padding_bottom',
  margin: 'margin', marginLeft: 'margin_left', marginRight: 'margin_right',
  marginTop: 'margin_top', marginBottom: 'margin_bottom',
  borderRadius: 'border_radius', opacity: 'opacity', borderWidth: 'border_width',
  borderLeftWidth: 'border_left_width', borderRightWidth: 'border_right_width',
  borderTopWidth: 'border_top_width', borderBottomWidth: 'border_bottom_width',
  shadowOffsetX: 'shadow_offset_x', shadowOffsetY: 'shadow_offset_y', shadowBlur: 'shadow_blur',
  top: 'top', left: 'left', right: 'right', bottom: 'bottom',
  aspectRatio: 'aspect_ratio', rotation: 'rotation', scaleX: 'scale_x', scaleY: 'scale_y',
};

const colorKeys = {
  backgroundColor: 'background_color', borderColor: 'border_color',
  shadowColor: 'shadow_color', gradientColorEnd: 'gradient_color_end',
};

const enumKeys = {
  flexDirection:     { field: 'flex_direction', values: { row: '.row', column: '.column' }},
  justifyContent:    { field: 'justify_content', values: { start: '.start', center: '.center', end: '.end', 'space-between': '.space_between', spaceBetween: '.space_between', 'space-around': '.space_around', 'flex-start': '.start', 'flex-end': '.end' }},
  alignItems:        { field: 'align_items', values: { start: '.start', center: '.center', end: '.end', stretch: '.stretch', 'flex-start': '.start', 'flex-end': '.end' }},
  alignSelf:         { field: 'align_self', values: { auto: '.auto', start: '.start', center: '.center', end: '.end', stretch: '.stretch' }},
  flexWrap:          { field: 'flex_wrap', values: { nowrap: '.no_wrap', noWrap: '.no_wrap', wrap: '.wrap' }},
  position:          { field: 'position', values: { relative: '.relative', absolute: '.absolute' }},
  display:           { field: 'display', values: { flex: '.flex', none: '.none' }},
  textAlign:         { field: 'text_align', values: { left: '.left', center: '.center', right: '.right' }},
  overflow:          { field: 'overflow', values: { visible: '.visible', hidden: '.hidden', scroll: '.scroll' }},
  gradientDirection: { field: 'gradient_direction', values: { vertical: '.vertical', horizontal: '.horizontal', none: '.none' }},
};

const htmlTags = {
  div: 'Box', section: 'Box', article: 'Box', main: 'Box', aside: 'Box',
  header: 'Box', footer: 'Box', nav: 'Box', form: 'Box', fieldset: 'Box',
  ul: 'Box', ol: 'Box', li: 'Box', table: 'Box', tr: 'Box', td: 'Box',
  span: 'Text', p: 'Text', label: 'Text', h1: 'Text', h2: 'Text',
  h3: 'Text', h4: 'Text', h5: 'Text', h6: 'Text', strong: 'Text',
  button: 'Pressable', a: 'Pressable',
  input: 'TextInput', textarea: 'TextArea', img: 'Image',
};

const namedColors = {
  black: [0,0,0], white: [255,255,255], red: [255,0,0], green: [0,128,0],
  blue: [0,0,255], yellow: [255,255,0], cyan: [0,255,255], magenta: [255,0,255],
  gray: [128,128,128], grey: [128,128,128], silver: [192,192,192],
  orange: [255,165,0], transparent: [0,0,0],
};

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

// ── Color parser ──

function parseColor(hex) {
  if (namedColors[hex]) {
    const [r,g,b] = namedColors[hex];
    return `Color.rgb(${r}, ${g}, ${b})`;
  }
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 6) {
    return `Color.rgb(${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)})`;
  }
  if (h.length === 3) {
    return `Color.rgb(${parseInt(h[0],16)*17}, ${parseInt(h[1],16)*17}, ${parseInt(h[2],16)*17})`;
  }
  return 'Color.rgb(255, 255, 255)';
}

// ── Style parser ──

function parseStyleValue(c) {
  if (c.kind() === TK.string) {
    const raw = c.text(); c.advance();
    return { type: 'string', value: raw.slice(1, -1) };
  }
  if (c.kind() === TK.number) {
    const val = c.text(); c.advance();
    return { type: 'number', value: val };
  }
  if (c.kind() === TK.minus && c.pos + 1 < c.count && c.kindAt(c.pos+1) === TK.number) {
    c.advance(); const val = '-' + c.text(); c.advance();
    return { type: 'number', value: val };
  }
  if (c.kind() === TK.identifier) {
    const name = c.text();
    if (isGetter(name)) {
      c.advance();
      return { type: 'state', value: name, zigExpr: slotGet(name) };
    }
    // Prop reference
    if (ctx.propStack[name] !== undefined) {
      c.advance();
      return { type: 'number', value: ctx.propStack[name] };
    }
  }
  c.advance();
  return { type: 'unknown', value: '' };
}

function parseStyleBlock(c) {
  const fields = [];
  if (c.kind() === TK.lbrace) c.advance();
  if (c.kind() === TK.lbrace) c.advance();
  while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
    if (c.kind() === TK.identifier || c.kind() === TK.string) {
      let key = c.text();
      if (c.kind() === TK.string) key = key.slice(1, -1);
      c.advance();
      if (c.kind() === TK.colon) c.advance();
      const val = parseStyleValue(c);
      if (colorKeys[key] && val.type === 'string') {
        fields.push(`.${colorKeys[key]} = ${parseColor(val.value)}`);
      } else if (styleKeys[key]) {
        if (val.type === 'state') {
          // Dynamic style — placeholder 0, update at runtime
          fields.push(`.${styleKeys[key]} = 0`);
          if (!ctx.dynStyles) ctx.dynStyles = [];
          ctx.dynStyles.push({ field: styleKeys[key], expression: `@floatFromInt(${val.zigExpr})` });
        } else if (val.type === 'string' && val.value.endsWith('%')) {
          const pct = parseFloat(val.value);
          fields.push(`.${styleKeys[key]} = ${pct === 100 ? -1 : pct / 100}`);
        } else if (val.type === 'number') {
          fields.push(`.${styleKeys[key]} = ${val.value}`);
        }
      } else if (enumKeys[key]) {
        const e = enumKeys[key];
        if (val.type === 'string' && e.values[val.value]) {
          fields.push(`.${e.field} = ${e.values[val.value]}`);
        }
      }
      if (c.kind() === TK.comma) c.advance();
    } else { c.advance(); }
  }
  if (c.kind() === TK.rbrace) c.advance();
  if (c.kind() === TK.rbrace) c.advance();
  return fields;
}

// ── Handler parser ──

function findSlot(name) {
  for (let i = 0; i < ctx.stateSlots.length; i++) {
    if (ctx.stateSlots[i].getter === name || ctx.stateSlots[i].setter === name) return i;
  }
  return -1;
}

function isGetter(name) {
  return ctx.stateSlots.some(s => s.getter === name);
}

function isSetter(name) {
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

function slotSet(slotIdx) {
  const s = ctx.stateSlots[slotIdx];
  if (s.type === 'float') return `state.setSlotFloat`;
  if (s.type === 'boolean') return `state.setSlotBool`;
  return `state.setSlot`;
}

// Parse a handler expression: () => setCount(expr)
// Returns the Zig body as a string
function parseHandler(c) {
  // Skip () =>
  if (c.kind() === TK.lparen) c.advance();
  if (c.kind() === TK.rparen) c.advance();
  if (c.kind() === TK.arrow) c.advance();

  // Parse body — could be { stmts } or single expression
  let body = '';
  if (c.kind() === TK.lbrace) {
    // Block body: { stmt; stmt; stmt; }
    c.advance();
    let body = '';
    while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
      if (c.kind() === TK.identifier && isSetter(c.text())) {
        const setter = c.text();
        const slotIdx = findSlot(setter);
        c.advance();
        if (c.kind() === TK.lparen) {
          c.advance();
          const valExpr = parseValueExpr(c);
          const needsParens = valExpr.includes(' + ') || valExpr.includes(' - ') || valExpr.includes(' * ') || valExpr.includes(' / ') || valExpr.includes(' ? ');
          const wrapped = needsParens ? `(${valExpr})` : valExpr;
          body += `    ${slotSet(slotIdx)}(${slotIdx}, ${wrapped});\n`;
          if (c.kind() === TK.rparen) c.advance();
        }
      }
      if (c.kind() === TK.semicolon) c.advance();
      else if (c.kind() !== TK.rbrace) c.advance();
    }
    if (c.kind() === TK.rbrace) c.advance();
    return body;
  }

  // Single expression: setCount(expr)
  if (c.kind() === TK.identifier && isSetter(c.text())) {
    const setter = c.text();
    const slotIdx = findSlot(setter);
    c.advance();
    if (c.kind() === TK.lparen) {
      c.advance();
      // Parse the value expression until matching )
      const valExpr = parseValueExpr(c);
      // Only wrap in parens if expression has operators
      const needsParens = valExpr.includes(' + ') || valExpr.includes(' - ') || valExpr.includes(' * ') || valExpr.includes(' / ');
      const wrapped = needsParens ? `(${valExpr})` : valExpr;
      body = `    ${slotSet(slotIdx)}(${slotIdx}, ${wrapped});\n`;
      if (c.kind() === TK.rparen) c.advance();
    }
  }
  return body;
}

// Parse a value expression (inside setter call) until ) at depth 0
function parseValueExpr(c) {
  let parts = [];
  let depth = 0;
  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.lparen) { depth++; parts.push('('); c.advance(); continue; }
    if (c.kind() === TK.rparen) {
      if (depth === 0) break;
      depth--; parts.push(')'); c.advance(); continue;
    }
    if (c.kind() === TK.identifier) {
      const name = c.text();
      if (isGetter(name)) {
        parts.push(slotGet(name));
      } else {
        parts.push(name);
      }
      c.advance(); continue;
    }
    if (c.kind() === TK.number) { parts.push(c.text()); c.advance(); continue; }
    if (c.kind() === TK.plus) { parts.push(' + '); c.advance(); continue; }
    if (c.kind() === TK.minus) { parts.push(' - '); c.advance(); continue; }
    if (c.kind() === TK.star) { parts.push(' * '); c.advance(); continue; }
    if (c.kind() === TK.slash) { parts.push(' / '); c.advance(); continue; }
    if (c.kind() === TK.percent) { parts.push(' % '); c.advance(); continue; }
    if (c.kind() === TK.eq_eq) { parts.push(' == '); c.advance(); continue; }
    if (c.kind() === TK.not_eq) { parts.push(' != '); c.advance(); continue; }
    if (c.kind() === TK.question) {
      // Ternary: cond ? trueVal : falseVal → if (cond) @as(i32, trueVal) else @as(i32, falseVal)
      c.advance();
      const trueVal = parseValueExpr(c); // reads until : at depth 0
      // : already consumed by parseValueExpr stopping, or we need to skip it
      if (c.kind() === TK.colon) c.advance();
      const falseVal = parseValueExpr(c); // reads until ) at depth 0
      const cond = parts.join('');
      parts.length = 0;
      parts.push(`if ((${cond})) @as(i32, ${trueVal}) else @as(i32, ${falseVal})`);
      continue;
    }
    if (c.kind() === TK.colon) break; // stop for ternary false branch
    if (c.kind() === TK.string) {
      const s = c.text(); c.advance();
      parts.push(s); continue;
    }
    // Default: skip
    parts.push(c.text());
    c.advance();
  }
  return parts.join('');
}

// ── JSX parser ──

function resolveTag(name) { return htmlTags[name] || name; }

function parseJSXElement(c) {
  if (c.kind() !== TK.lt) return { nodeExpr: '.{}' };
  c.advance(); // <

  // Fragment: <>
  if (c.kind() === TK.gt) {
    const fragOffset = c.starts[c.pos > 0 ? c.pos - 1 : 0];
    c.advance();
    const children = parseChildren(c);
    if (c.kind() === TK.lt_slash) { c.advance(); if (c.kind() === TK.gt) c.advance(); }
    return buildNode('Box', [], children, null, null, '>', fragOffset);
  }

  const rawTag = c.text();
  c.advance();

  // Check if this is a component call
  const comp = findComponent(rawTag);
  if (comp) {
    // Collect prop values from call site attributes
    const propValues = {};
    while (c.kind() !== TK.gt && c.kind() !== TK.slash_gt && c.kind() !== TK.eof) {
      if (c.kind() === TK.identifier) {
        const attr = c.text(); c.advance();
        if (c.kind() === TK.equals) {
          c.advance();
          if (c.kind() === TK.string) {
            propValues[attr] = c.text().slice(1, -1); // strip quotes
            c.advance();
          } else if (c.kind() === TK.lbrace) {
            // {expr} prop value — collect tokens as string
            c.advance();
            let val = '';
            let depth = 0;
            while (c.kind() !== TK.eof) {
              if (c.kind() === TK.lbrace) depth++;
              if (c.kind() === TK.rbrace) { if (depth === 0) break; depth--; }
              val += c.text();
              c.advance();
            }
            if (c.kind() === TK.rbrace) c.advance();
            propValues[attr] = val;
          }
        }
      } else { c.advance(); }
    }
    // Skip /> or >...</Tag>
    if (c.kind() === TK.slash_gt) c.advance();
    else if (c.kind() === TK.gt) {
      c.advance();
      // Skip children (component children not yet supported)
      let depth = 1;
      while (depth > 0 && c.kind() !== TK.eof) {
        if (c.kind() === TK.lt && c.kindAt(c.pos + 1) === TK.identifier) depth++;
        if (c.kind() === TK.lt_slash) depth--;
        if (depth > 0) c.advance();
      }
      if (c.kind() === TK.lt_slash) { c.advance(); if (c.kind() === TK.identifier) c.advance(); if (c.kind() === TK.gt) c.advance(); }
    }

    // Inline: save state, jump to component body, parse with prop substitution
    const savedPos = c.save();
    const savedProps = ctx.propStack;
    const savedInline = ctx.inlineComponent;
    ctx.propStack = propValues;
    ctx.inlineComponent = rawTag;
    c.pos = comp.bodyPos;
    const result = parseJSXElement(c);
    ctx.propStack = savedProps;
    ctx.inlineComponent = savedInline;
    c.restore(savedPos);
    return result;
  }

  const tag = resolveTag(rawTag);
  // Track source position for breadcrumb comments
  const tagSrcOffset = c.starts[c.pos > 0 ? c.pos - 1 : 0];

  // Parse attributes
  let styleFields = [];
  let nodeFields = []; // direct node fields (font_size, text_color, etc.)
  let handlerRef = null;

  while (c.kind() !== TK.gt && c.kind() !== TK.slash_gt && c.kind() !== TK.eof) {
    if (c.kind() === TK.identifier) {
      const attr = c.text();
      c.advance();
      if (c.kind() === TK.equals) {
        c.advance();
        if (attr === 'style') {
          styleFields = parseStyleBlock(c);
        } else if (attr === 'onPress') {
          if (c.kind() === TK.lbrace) {
            c.advance(); // {
            const handlerName = `_handler_press_${ctx.handlerCount}`;
            const body = parseHandler(c);
            ctx.handlers.push({ name: handlerName, body });
            handlerRef = handlerName;
            ctx.handlerCount++;
            if (c.kind() === TK.rbrace) c.advance(); // }
          }
        } else if (attr === 'fontSize') {
          // fontSize={N} or fontSize="N" → .font_size = N
          if (c.kind() === TK.lbrace) {
            c.advance();
            if (c.kind() === TK.number) { nodeFields.push(`.font_size = ${c.text()}`); c.advance(); }
            if (c.kind() === TK.rbrace) c.advance();
          } else if (c.kind() === TK.number) { nodeFields.push(`.font_size = ${c.text()}`); c.advance(); }
          else if (c.kind() === TK.string) { nodeFields.push(`.font_size = ${c.text().slice(1,-1)}`); c.advance(); }
        } else if (attr === 'color') {
          // color="#hex" or color={propName} → .text_color = Color.rgb(...)
          if (c.kind() === TK.string) {
            const val = c.text().slice(1, -1);
            nodeFields.push(`.text_color = ${parseColor(val)}`);
            c.advance();
          } else if (c.kind() === TK.lbrace) {
            c.advance();
            // color={expr} — in component context, prop color values don't resolve
            // (reference compiler behavior: brace-expr color defaults to black)
            if (c.kind() === TK.identifier) {
              nodeFields.push(`.text_color = Color.rgb(0, 0, 0)`);
              c.advance();
            }
            if (c.kind() === TK.rbrace) c.advance();
          }
        } else {
          // Skip unknown attributes
          if (c.kind() === TK.string) c.advance();
          else if (c.kind() === TK.lbrace) { skipBraces(c); }
        }
      }
    } else { c.advance(); }
  }

  // Self-closing: />
  if (c.kind() === TK.slash_gt) {
    c.advance();
    return buildNode(tag, styleFields, [], handlerRef, nodeFields, rawTag, tagSrcOffset);
  }
  if (c.kind() === TK.gt) c.advance();

  const children = parseChildren(c);

  // </Tag>
  if (c.kind() === TK.lt_slash) {
    c.advance();
    if (c.kind() === TK.identifier) c.advance();
    if (c.kind() === TK.gt) c.advance();
  }

  return buildNode(tag, styleFields, children, handlerRef, nodeFields, rawTag, tagSrcOffset);
}

// ── Map parser ──

function tryParseMap(c, oa) {
  const saved = c.save();
  c.advance(); // skip array name
  if (c.kind() !== TK.dot) { c.restore(saved); return null; }
  c.advance(); // skip .
  if (!c.isIdent('map')) { c.restore(saved); return null; }
  c.advance(); // skip 'map'
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance(); // skip (

  // Parse params: (item, i) => or (item) =>
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance(); // skip (
  let itemParam = '_item';
  let indexParam = '_i';
  if (c.kind() === TK.identifier) { itemParam = c.text(); c.advance(); }
  if (c.kind() === TK.comma) { c.advance(); if (c.kind() === TK.identifier) { indexParam = c.text(); c.advance(); } }
  if (c.kind() === TK.rparen) c.advance(); // skip )
  if (c.kind() === TK.arrow) c.advance(); // skip =>
  if (c.kind() === TK.lparen) c.advance(); // skip ( before JSX

  // Push map item context — so {item.label} resolves to _oa0_label[_i]
  const savedMapCtx = ctx.currentMap;
  const mapIdx = ctx.maps.length;
  const mapInfo = {
    oaIdx: oa.oaIdx, itemParam, indexParam,
    oa, textsInMap: [], innerCount: 0, parentArr: '', childIdx: 0,
  };
  ctx.currentMap = mapInfo;

  // Parse the map template JSX
  const templateNode = parseJSXElement(c);

  ctx.currentMap = savedMapCtx;

  // Skip closing ))}
  if (c.kind() === TK.rparen) c.advance(); // )
  if (c.kind() === TK.rparen) c.advance(); // )

  // Register the map
  mapInfo.templateExpr = templateNode.nodeExpr;
  ctx.maps.push(mapInfo);

  // Return a placeholder node — the parent array slot that gets .children set by _rebuildMap
  return { nodeExpr: `.{ .style = .{ .gap = 8, .width = -1, .height = -1 } }`, mapIdx };
}

// Check if an identifier is a map item member access (item.field)
function isMapItemAccess(name) {
  if (!ctx.currentMap) return null;
  if (name === ctx.currentMap.itemParam) return ctx.currentMap;
  return null;
}

// ── Template literal parser ──

function parseTemplateLiteral(raw) {
  // Split "text ${expr} more ${expr2}" into fmt string + args
  let fmt = '';
  const args = [];
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === '$' && i + 1 < raw.length && raw[i + 1] === '{') {
      // Find matching }
      let j = i + 2;
      let depth = 1;
      while (j < raw.length && depth > 0) {
        if (raw[j] === '{') depth++;
        if (raw[j] === '}') depth--;
        j++;
      }
      const expr = raw.slice(i + 2, j - 1).trim();
      // Determine format specifier based on expression type
      const slotIdx = findSlot(expr);
      if (slotIdx >= 0) {
        const slot = ctx.stateSlots[slotIdx];
        fmt += slot.type === 'string' ? '{s}' : '{d}';
        args.push(slotGet(expr));
      } else {
        // Unknown expression — treat as integer
        fmt += '{d}';
        // Resolve state getters in the expression
        const resolved = expr.replace(/\b(\w+)\b/g, (m) => isGetter(m) ? slotGet(m) : m);
        args.push(resolved);
      }
      i = j;
    } else {
      fmt += raw[i];
      i++;
    }
  }
  return { fmt, args };
}

// Try to parse {expr && <JSX>} conditional — returns true if consumed
function tryParseConditional(c, children) {
  // Look ahead: identifier (op identifier/number)* && <
  const saved = c.save();
  let condParts = [];
  // Collect condition expression until && or }
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.amp_amp) {
      c.advance();
      // Check if next is JSX
      if (c.kind() === TK.lt) {
        const condExpr = condParts.join('');
        const jsxNode = parseJSXElement(c);
        if (c.kind() === TK.rbrace) c.advance();
        // Register as conditional
        const condIdx = ctx.conditionals.length;
        ctx.conditionals.push({ condExpr, kind: 'show_hide' });
        children.push({ nodeExpr: jsxNode.nodeExpr, condIdx, dynBufId: jsxNode.dynBufId });
        return true;
      }
      // Not JSX after && — might be chained condition, put && back
      condParts.push(' and ');
      continue;
    }
    // Build condition expression with Zig-compatible ops
    if (c.kind() === TK.identifier) {
      const name = c.text();
      condParts.push(isGetter(name) ? slotGet(name) : name);
    } else if (c.kind() === TK.number) {
      condParts.push(c.text());
    } else if (c.kind() === TK.eq_eq) {
      condParts.push(' == ');
    } else if (c.kind() === TK.not_eq) {
      condParts.push(' != ');
    } else if (c.kind() === TK.gt_eq) {
      condParts.push(' >= ');
    } else if (c.kind() === TK.lt_eq) {
      condParts.push(' <= ');
    } else if (c.kind() === TK.gt) {
      condParts.push(' > ');
    } else if (c.kind() === TK.lt) {
      // Could be < operator or start of JSX — if no && seen yet, it's not a conditional
      break;
    } else if (c.kind() === TK.question) {
      // Ternary — not a conditional, bail
      break;
    } else {
      condParts.push(c.text());
    }
    c.advance();
  }
  // Didn't find && <JSX> pattern — restore and return false
  c.restore(saved);
  return false;
}

// Try to parse {expr == val ? "a" : "b"} ternary text
function tryParseTernaryText(c, children) {
  // Look ahead for ? ... : pattern
  const saved = c.save();
  // Skip to ? while collecting condition
  let condParts = [];
  let foundQuestion = false;
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.question) { foundQuestion = true; c.advance(); break; }
    if (c.kind() === TK.identifier) {
      const name = c.text();
      condParts.push(isGetter(name) ? slotGet(name) : name);
    } else if (c.kind() === TK.eq_eq) { condParts.push(' == '); }
    else if (c.kind() === TK.not_eq) { condParts.push(' != '); }
    else if (c.kind() === TK.number) { condParts.push(c.text()); }
    else if (c.kind() === TK.gt) { condParts.push(' > '); }
    else { condParts.push(c.text()); }
    c.advance();
  }
  if (!foundQuestion) { c.restore(saved); return false; }
  // Get true branch value
  let trueVal = '';
  if (c.kind() === TK.string) { trueVal = c.text().slice(1, -1); c.advance(); }
  else { c.restore(saved); return false; }
  // Expect :
  if (c.kind() !== TK.colon) { c.restore(saved); return false; }
  c.advance();
  // Get false branch value
  let falseVal = '';
  if (c.kind() === TK.string) { falseVal = c.text().slice(1, -1); c.advance(); }
  else { c.restore(saved); return false; }
  if (c.kind() === TK.rbrace) c.advance();
  // Ternary text: create dynamic text with conditional format
  const condExpr = condParts.join('');
  const isComparison = condExpr.includes('==') || condExpr.includes('!=') ||
    condExpr.includes('>=') || condExpr.includes('<=') ||
    condExpr.includes(' > ') || condExpr.includes(' < ');
  const zigCond = isComparison ? `(${condExpr})` : `((${condExpr}) != 0)`;
  const bufId = ctx.dynCount;
  // Use Zig if/else to select the string at runtime
  const fmtArgs = `if ${zigCond} @as([]const u8, "${trueVal}") else @as([]const u8, "${falseVal}")`;
  ctx.dynTexts.push({ bufId, fmtString: '{s}', fmtArgs, arrName: '', arrIndex: 0, bufSize: 64 });
  ctx.dynCount++;
  children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: bufId });
  return true;
}

function parseChildren(c) {
  const children = [];
  while (c.kind() !== TK.lt_slash && c.kind() !== TK.eof) {
    if (c.kind() === TK.lt) {
      children.push(parseJSXElement(c));
    } else if (c.kind() === TK.lbrace) {
      c.advance();
      // Try conditional: {expr && <JSX>} or {expr != val && <JSX>}
      const condResult = tryParseConditional(c, children);
      if (condResult) continue;
      // Try ternary text: {expr == val ? "a" : "b"}
      const ternResult = tryParseTernaryText(c, children);
      if (ternResult) continue;
      // Map: {items.map((item, i) => (...))}
      if (c.kind() === TK.identifier) {
        const maybeArr = c.text();
        const oa = ctx.objectArrays.find(o => o.getter === maybeArr);
        if (oa && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.dot) {
          const mapResult = tryParseMap(c, oa);
          if (mapResult) {
            children.push(mapResult);
            if (c.kind() === TK.rbrace) c.advance();
            continue;
          }
        }
      }
      // Template literal: {`text ${expr}`}
      if (c.kind() === TK.template_literal) {
        const raw = c.text().slice(1, -1); // strip backticks
        c.advance();
        if (c.kind() === TK.rbrace) c.advance();
        // Parse template: split on ${...} and build fmt string + args
        const { fmt, args } = parseTemplateLiteral(raw);
        if (args.length > 0) {
          const bufId = ctx.dynCount;
          // Buffer size: static text length + 64 per interpolation + padding (match reference)
          const bufSize = fmt.length + 64 * args.length + 14;
          ctx.dynTexts.push({ bufId, fmtString: fmt, fmtArgs: args.join(', '), arrName: '', arrIndex: 0, bufSize });
          ctx.dynCount++;
          children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: bufId });
        } else {
          children.push({ nodeExpr: `.{ .text = "${fmt}" }` });
        }
        continue;
      }
      // Map item access: {item.field} inside a .map()
      if (c.kind() === TK.identifier && ctx.currentMap && c.text() === ctx.currentMap.itemParam) {
        c.advance();
        if (c.kind() === TK.dot) {
          c.advance();
          if (c.kind() === TK.identifier) {
            const field = c.text();
            const oa = ctx.currentMap.oa;
            const oaIdx = oa.oaIdx;
            const fieldInfo = oa.fields.find(f => f.name === field);
            c.advance();
            if (c.kind() === TK.rbrace) c.advance();
            // Create dynamic text for this map item field
            const bufId = ctx.dynCount;
            const fmt = fieldInfo && fieldInfo.type === 'string' ? '{s}' : '{d}';
            let args;
            if (fieldInfo && fieldInfo.type === 'string') {
              args = `_oa${oaIdx}_${field}[_i][0.._oa${oaIdx}_${field}_lens[_i]]`;
            } else {
              args = `_oa${oaIdx}_${field}[_i]`;
            }
            ctx.dynTexts.push({ bufId, fmtString: fmt, fmtArgs: args, arrName: '', arrIndex: 0, bufSize: 256, inMap: true, mapIdx: ctx.maps.length });
            ctx.dynCount++;
            children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: bufId, inMap: true });
            continue;
          }
        }
      }
      // {expr} — check props first, then state getters
      if (c.kind() === TK.identifier && ctx.propStack[c.text()] !== undefined) {
        // Prop substitution — replace {propName} with the prop value as static text
        const propVal = ctx.propStack[c.text()];
        c.advance();
        if (c.kind() === TK.rbrace) c.advance();
        children.push({ nodeExpr: `.{ .text = "${propVal}" }` });
      } else if (c.kind() === TK.identifier && isGetter(c.text())) {
        const getter = c.text();
        const slotIdx = findSlot(getter);
        const bufId = ctx.dynCount;
        const slot = ctx.stateSlots[slotIdx];
        const fmt = slot.type === 'string' ? '{s}' : slot.type === 'float' ? '{d:.2}' : '{d}';
        const bufSize = slot.type === 'string' ? 128 : 64;
        const args = slotGet(getter);
        ctx.dynTexts.push({ bufId, fmtString: fmt, fmtArgs: args, arrName: '', arrIndex: 0, bufSize });
        ctx.dynCount++;
        c.advance();
        if (c.kind() === TK.rbrace) c.advance();
        // Placeholder node — text will be set by _updateDynamicTexts
        children.push({ nodeExpr: '.{ .text = "" }', dynBufId: bufId });
      } else {
        // Skip unknown expression
        let depth = 1;
        while (depth > 0 && c.kind() !== TK.eof) {
          if (c.kind() === TK.lbrace) depth++;
          if (c.kind() === TK.rbrace) depth--;
          if (depth > 0) c.advance();
        }
        if (c.kind() === TK.rbrace) c.advance();
      }
    } else if (c.kind() !== TK.rbrace) {
      // Text content — collect anything that isn't JSX or braces, preserve spaces
      let text = '';
      let lastEnd = 0;
      while (c.kind() !== TK.lt && c.kind() !== TK.lt_slash && c.kind() !== TK.lbrace && c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
        // Add space if there was whitespace between tokens in source
        if (text.length > 0 && c.starts[c.pos] > lastEnd) text += ' ';
        text += c.text();
        lastEnd = c.ends[c.pos];
        c.advance();
      }
      if (text.trim()) children.push({ nodeExpr: `.{ .text = "${text.trim()}" }` });
    } else { c.advance(); }
  }
  return children;
}

function skipBraces(c) {
  let depth = 1; c.advance();
  while (depth > 0 && c.kind() !== TK.eof) {
    if (c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rbrace) depth--;
    if (depth > 0) c.advance();
  }
  if (c.kind() === TK.rbrace) c.advance();
}

function offsetToLine(source, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

function buildNode(tag, styleFields, children, handlerRef, nodeFields, srcTag, srcOffset) {
  const parts = [];
  if (styleFields.length > 0) parts.push(`.style = .{ ${styleFields.join(', ')} }`);

  // For Text nodes: if ANY child has a dynamic text, hoist it to the Text node
  // and drop all static text siblings (matches reference compiler behavior)
  if (tag === 'Text') {
    const dynChild = children.find(ch => ch.dynBufId !== undefined);
    if (dynChild) {
      parts.push(`.text = ""`);
      if (nodeFields) for (const nf of nodeFields) parts.push(nf);
      children = [];
      const expr = `.{ ${parts.join(', ')} }`;
      return { nodeExpr: expr, dynBufId: dynChild.dynBufId };
    }
    // Single static text child — hoist to .text field
    if (children.length === 1 && children[0].nodeExpr && children[0].nodeExpr.includes('.text =')) {
      const m = children[0].nodeExpr.match(/\.text = "(.*)"/);
      if (m) { parts.push(`.text = "${m[1]}"`); children = []; }
    }
  }

  // Node-level fields (font_size, text_color) — after text for correct field order
  if (nodeFields && nodeFields.length > 0) {
    for (const nf of nodeFields) parts.push(nf);
  }

  if (handlerRef) parts.push(`.handlers = .{ .on_press = ${handlerRef} }`);

  if (children.length > 0) {
    const arrName = `_arr_${ctx.arrayCounter}`;
    ctx.arrayCounter++;
    const childExprs = children.map(ch => ch.nodeExpr || ch).join(', ');
    // Source breadcrumb comment
    if (srcTag && srcOffset !== undefined) {
      const line = offsetToLine(globalThis.__source, srcOffset);
      const fname = (globalThis.__file || '').split('/').pop();
      const tagDisplay = srcTag === '>' ? '<>' : `<${srcTag}>`;
      ctx.arrayComments.push(`// tsz:${fname}:${line} \u2014 ${tagDisplay}`);
    } else {
      ctx.arrayComments.push('');
    }
    const compSuffix = ctx.inlineComponent ? ` // ${ctx.inlineComponent}` : '';
    ctx.arrayDecls.push(`var ${arrName} = [_]Node{ ${childExprs} };${compSuffix}`);
    // Bind dynamic texts and conditionals to this array
    for (let i = 0; i < children.length; i++) {
      if (children[i].dynBufId !== undefined) {
        const dt = ctx.dynTexts.find(d => d.bufId === children[i].dynBufId);
        if (dt) { dt.arrName = arrName; dt.arrIndex = i; }
      }
      if (children[i].mapIdx !== undefined) {
        const m = ctx.maps[children[i].mapIdx];
        if (m) { m.parentArr = arrName; m.childIdx = i; }
      }
      if (children[i].condIdx !== undefined) {
        const cond = ctx.conditionals[children[i].condIdx];
        if (cond) { cond.arrName = arrName; cond.trueIdx = i; }
      }
    }
    parts.push(`.children = &${arrName}`);
  }

  return { nodeExpr: `.{ ${parts.join(', ')} }` };
}

// ── Emit ──

function emitOutput(rootExpr, file) {
  const basename = file.split('/').pop();
  const appName = basename.replace(/\.tsz$/, '');
  const hasState = ctx.stateSlots.length > 0;
  const hasDynText = ctx.dynCount > 0;
  const prefix = 'framework/';

  let out = '';
  // Header — match reference compiler format exactly
  out += `//! Generated by tsz compiler (Zig) \u2014 do not edit\n//!\n//! Source: ${basename}\n\n`;
  out += `const std = @import("std");\n`;
  out += `const builtin = @import("builtin");\n`;
  out += `const build_options = @import("build_options");\n`;
  out += `const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;\n\n`;
  out += `const layout = @import("${prefix}layout.zig");\n`;
  out += `const Node = layout.Node;\nconst Style = layout.Style;\nconst Color = layout.Color;\n`;
  if (hasState || ctx.objectArrays.length > 0) out += `const state = @import("${prefix}state.zig");\n`;
  out += `const engine = if (IS_LIB) struct {} else if (builtin.os.tag == .emscripten) @import("${prefix}engine_web.zig") else @import("${prefix}engine.zig");\n`;
  if (ctx.objectArrays.length > 0) {
    out += `const qjs_runtime = if (IS_LIB) struct {\n`;
    out += `    pub fn callGlobal(_: []const u8) void {}\n`;
    out += `    pub fn callGlobalStr(_: []const u8, _: []const u8) void {}\n`;
    out += `    pub fn callGlobalInt(_: []const u8, _: i64) void {}\n`;
    out += `    pub fn registerHostFn(_: []const u8, _: ?*const anyopaque, _: u8) void {}\n`;
    out += `    pub fn evalExpr(_: []const u8) void {}\n`;
    out += `} else @import("${prefix}qjs_runtime.zig");\n`;
  }
  out += '\n';

  // State manifest
  if (hasState) {
    out += `// ── State manifest ──────────────────────────────────────────────\n`;
    ctx.stateSlots.forEach((s, i) => {
      const typeLabel = s.type === 'boolean' ? 'bool' : s.type;
      out += `// slot ${i}: ${s.getter} (${typeLabel})\n`;
    });
    out += `comptime { if (${ctx.stateSlots.length} != ${ctx.stateSlots.length}) @compileError("state slot count mismatch"); }\n\n`;
  }

  // Node tree
  out += `// ── Generated node tree ─────────────────────────────────────────\n`;
  for (let i = 0; i < ctx.arrayDecls.length; i++) {
    if (ctx.arrayComments[i]) out += ctx.arrayComments[i] + '\n';
    out += ctx.arrayDecls[i] + '\n';
  }
  const nodeInit = rootExpr.startsWith('.') ? rootExpr.slice(1) : rootExpr;
  out += `var _root = Node${nodeInit};\n`;

  // Object array infrastructure
  if (ctx.objectArrays.length > 0) {
    // QJS stubs
    out += `const qjs = if (IS_LIB) struct {
    pub const JSValue = extern struct { tag: i64 = 3, u: extern union { int32: i32, float64: f64, ptr: ?*anyopaque } = .{ .int32 = 0 } };
    pub const JSContext = opaque {};
    pub fn JS_GetPropertyStr(_: ?*const @This().JSContext, _: @This().JSValue, _: [*:0]const u8) @This().JSValue { return .{}; }
    pub fn JS_GetPropertyUint32(_: ?*const @This().JSContext, _: @This().JSValue, _: u32) @This().JSValue { return .{}; }
    pub fn JS_ToInt32(_: ?*const @This().JSContext, _: *i32, _: @This().JSValue) i32 { return 0; }
    pub fn JS_ToInt64(_: ?*const @This().JSContext, _: *i64, _: @This().JSValue) i32 { return 0; }
    pub fn JS_ToFloat64(_: ?*const @This().JSContext, _: *f64, _: @This().JSValue) i32 { return 0; }
    pub fn JS_FreeValue(_: ?*const @This().JSContext, _: @This().JSValue) void {}
    pub fn JS_ToCString(_: ?*const @This().JSContext, _: @This().JSValue) ?[*:0]const u8 { return null; }
    pub fn JS_FreeCString(_: ?*const @This().JSContext, _: ?[*:0]const u8) void {}
    pub fn JS_NewFloat64(_: ?*const @This().JSContext, _: f64) @This().JSValue { return .{}; }
} else @cImport({ @cDefine("_GNU_SOURCE", "1"); @cDefine("QUICKJS_NG_BUILD", "1"); @cInclude("quickjs.h"); });
const QJS_UNDEFINED = qjs.JSValue{ .u = .{ .int32 = 0 }, .tag = 3 };\n\n`;

    // Object array helpers
    out += `// ── Object arrays ───────────────────────────────────────────────
const _oa_alloc = std.heap.page_allocator;

fn _oaDupString(src: []const u8) []const u8 {
    if (src.len == 0) return &[_]u8{};
    return _oa_alloc.dupe(u8, src) catch &[_]u8{};
}

fn _oaFreeString(slot: *[]const u8, len_slot: *usize) void {
    if (len_slot.* > 0) _oa_alloc.free(@constCast(slot.*));
    slot.* = &[_]u8{};
    len_slot.* = 0;
}\n\n`;

    // Per-object-array storage + unpack
    for (const oa of ctx.objectArrays) {
      const idx = oa.oaIdx;
      for (const f of oa.fields) {
        if (f.type === 'string') {
          out += `var _oa${idx}_${f.name}: [][]const u8 = &[_][]const u8{};\n`;
          out += `var _oa${idx}_${f.name}_lens: []usize = &[_]usize{};\n`;
          out += `var _oa${idx}_${f.name}_cap: usize = 0;\n`;
        } else {
          out += `var _oa${idx}_${f.name}: []i64 = &[_]i64{};\n`;
          out += `var _oa${idx}_${f.name}_cap: usize = 0;\n`;
        }
      }
      out += `var _oa${idx}_len: usize = 0;\n`;
      out += `var _oa${idx}_dirty: bool = false;\n\n`;

      // ensureCapacity
      out += `fn _oa${idx}_ensureCapacity(needed: usize) void {\n`;
      const firstField = oa.fields[0];
      out += `    if (needed <= _oa${idx}_${firstField.name}_cap) return;\n`;
      out += `    const new_cap = @max(needed, if (_oa${idx}_${firstField.name}_cap == 0) @as(usize, 64) else _oa${idx}_${firstField.name}_cap * 2);\n`;
      for (const f of oa.fields) {
        if (f.type === 'string') {
          out += `    if (_oa${idx}_${f.name}_cap == 0) {\n`;
          out += `        _oa${idx}_${f.name} = _oa_alloc.alloc([]const u8, new_cap) catch return;\n`;
          out += `        _oa${idx}_${f.name}_lens = _oa_alloc.alloc(usize, new_cap) catch return;\n`;
          out += `        for (0..new_cap) |_j| _oa${idx}_${f.name}[_j] = &[_]u8{};\n`;
          out += `        @memset(_oa${idx}_${f.name}_lens, 0);\n`;
          out += `    } else {\n`;
          out += `        const _old_cap = _oa${idx}_${f.name}_cap;\n`;
          out += `        _oa${idx}_${f.name} = _oa_alloc.realloc(_oa${idx}_${f.name}.ptr[0.._old_cap], new_cap) catch return;\n`;
          out += `        _oa${idx}_${f.name}_lens = _oa_alloc.realloc(_oa${idx}_${f.name}_lens.ptr[0.._old_cap], new_cap) catch return;\n`;
          out += `        for (_old_cap..new_cap) |_j| _oa${idx}_${f.name}[_j] = &[_]u8{};\n`;
          out += `        @memset(_oa${idx}_${f.name}_lens[_old_cap..new_cap], 0);\n`;
          out += `    }\n`;
          out += `    _oa${idx}_${f.name}_cap = new_cap;\n`;
        } else {
          out += `    if (_oa${idx}_${f.name}_cap == 0) {\n`;
          out += `        _oa${idx}_${f.name} = _oa_alloc.alloc(i64, new_cap) catch return;\n`;
          out += `        @memset(_oa${idx}_${f.name}, 0);\n`;
          out += `    } else {\n`;
          out += `        _oa${idx}_${f.name} = _oa_alloc.realloc(_oa${idx}_${f.name}.ptr[0.._oa${idx}_${f.name}_cap], new_cap) catch return;\n`;
          out += `        @memset(_oa${idx}_${f.name}[_oa${idx}_${f.name}_cap..new_cap], 0);\n`;
          out += `    }\n`;
          out += `    _oa${idx}_${f.name}_cap = new_cap;\n`;
        }
      }
      out += `}\n\n`;

      // unpack function
      out += `fn _oa${idx}_unpack(ctx_qjs: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {\n`;
      out += `    const c2 = ctx_qjs orelse return QJS_UNDEFINED;\n`;
      out += `    const arr = argv[0];\n`;
      out += `    const len_val = qjs.JS_GetPropertyStr(c2, arr, "length");\n`;
      out += `    var arr_len: i32 = 0;\n`;
      out += `    _ = qjs.JS_ToInt32(c2, &arr_len, len_val);\n`;
      out += `    qjs.JS_FreeValue(c2, len_val);\n`;
      out += `    const count: usize = @intCast(@max(0, arr_len));\n`;
      out += `    _oa${idx}_ensureCapacity(count);\n`;
      out += `    for (0..count) |_i| {\n`;
      out += `        const elem = qjs.JS_GetPropertyUint32(c2, arr, @intCast(_i));\n`;
      for (const f of oa.fields) {
        if (f.type === 'string') {
          out += `        { const _v = qjs.JS_GetPropertyStr(c2, elem, "${f.name}");\n`;
          out += `        const _s = qjs.JS_ToCString(c2, _v);\n`;
          out += `        qjs.JS_FreeValue(c2, _v);\n`;
          out += `        _oaFreeString(&_oa${idx}_${f.name}[_i], &_oa${idx}_${f.name}_lens[_i]);\n`;
          out += `        if (_s) |ss| { const sl = std.mem.span(ss); _oa${idx}_${f.name}[_i] = _oaDupString(sl); _oa${idx}_${f.name}_lens[_i] = _oa${idx}_${f.name}[_i].len; qjs.JS_FreeCString(c2, _s); }\n`;
          out += `        }\n`;
        } else {
          out += `        { const _v = qjs.JS_GetPropertyStr(c2, elem, "${f.name}");\n`;
          out += `        var _n: i64 = 0; _ = qjs.JS_ToInt64(c2, &_n, _v);\n`;
          out += `        qjs.JS_FreeValue(c2, _v); _oa${idx}_${f.name}[_i] = _n;\n`;
          out += `        }\n`;
        }
      }
      out += `        qjs.JS_FreeValue(c2, elem);\n`;
      out += `    }\n`;
      // Trim old strings
      const strFields = oa.fields.filter(f => f.type === 'string');
      if (strFields.length > 0) {
        out += `    for (count.._oa${idx}_len) |_trim_i|`;
        for (const f of strFields) {
          out += ` _oaFreeString(&_oa${idx}_${f.name}[_trim_i], &_oa${idx}_${f.name}_lens[_trim_i]);`;
        }
        out += `\n`;
      }
      out += `    _oa${idx}_len = count;\n`;
      out += `    _oa${idx}_dirty = true;\n`;
      out += `    state.markDirty();\n`;
      out += `    return QJS_UNDEFINED;\n`;
      out += `}\n\n`;
    }
  }

  // Map pools
  if (ctx.maps.length > 0) {
    out += `\n// ── Map pools ───────────────────────────────────────────────────\n`;
    for (let mi = 0; mi < ctx.maps.length; mi++) {
      const m = ctx.maps[mi];
      out += `const MAX_MAP_${mi}: usize = 4096;\n`;
      out += `var _map_pool_${mi}: [MAX_MAP_${mi}]Node = undefined;\n`;
      out += `var _map_count_${mi}: usize = 0;\n`;

      // Count inner nodes from template
      const innerMatch = m.templateExpr.match(/\.children = &_arr_(\d+)/);
      const innerArr = innerMatch ? `_arr_${innerMatch[1]}` : null;
      // Find inner array size by checking arrayDecls
      let innerCount = 0;
      if (innerArr) {
        const decl = ctx.arrayDecls.find(d => d.startsWith(`var ${innerArr}`));
        if (decl) {
          innerCount = (decl.match(/\.{/g) || []).length;
        }
      }
      if (innerCount > 0) {
        out += `var _map_inner_${mi}: [MAX_MAP_${mi}][${innerCount}]Node = undefined;\n`;
      }

      // Per-item text buffers for dynamic texts inside the map
      const mapDynTexts = ctx.dynTexts.filter(dt => dt.inMap);
      let textBufIdx = 0;
      for (const dt of mapDynTexts) {
        out += `var _map_text_bufs_${mi}_${textBufIdx}: [MAX_MAP_${mi}][256]u8 = undefined;\n`;
        out += `var _map_texts_${mi}_${textBufIdx}: [MAX_MAP_${mi}][]const u8 = undefined;\n`;
        textBufIdx++;
      }

      // Rebuild function
      out += `fn _rebuildMap${mi}() void {\n`;
      out += `    _map_count_${mi} = @min(_oa${m.oaIdx}_len, MAX_MAP_${mi});\n`;
      out += `    for (0.._map_count_${mi}) |_i| {\n`;

      // Emit per-item text formatting
      textBufIdx = 0;
      for (const dt of mapDynTexts) {
        out += `        _map_texts_${mi}_${textBufIdx}[_i] = std.fmt.bufPrint(&_map_text_bufs_${mi}_${textBufIdx}[_i], "${dt.fmtString}", .{ ${dt.fmtArgs} }) catch "";\n`;
        textBufIdx++;
      }

      // Emit inner array + pool node
      if (innerCount > 0) {
        // Build inner array items, replacing dynamic text refs
        let innerItems = [];
        if (innerArr) {
          const decl = ctx.arrayDecls.find(d => d.startsWith(`var ${innerArr}`));
          if (decl) {
            // Replace _dyn_text references with _map_texts
            let inner = decl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
            let ti = 0;
            for (const dt of mapDynTexts) {
              inner = inner.replace('.text = ""', `.text = _map_texts_${mi}_${ti}[_i]`);
              ti++;
            }
            out += `        _map_inner_${mi}[_i] = [${innerCount}]Node{ ${inner} };\n`;
          }
        }
        // Build pool node from template, replacing children ref
        let poolNode = m.templateExpr;
        if (innerArr) {
          poolNode = poolNode.replace(`&${innerArr}`, `&_map_inner_${mi}[_i]`);
        }
        out += `        _map_pool_${mi}[_i] = ${poolNode};\n`;
      } else {
        out += `        _map_pool_${mi}[_i] = ${m.templateExpr};\n`;
      }

      out += `    }\n`;
      // Bind pool to parent array
      if (m.parentArr) {
        out += `    ${m.parentArr}[${m.childIdx}].children = _map_pool_${mi}[0.._map_count_${mi}];\n`;
      }
      out += `}\n\n`;
    }
  }

  out += '\n';

  // Dynamic text buffers
  if (hasDynText) {
    out += `// ── Dynamic text buffers ─────────────────────────────────────────\n`;
    for (let i = 0; i < ctx.dynCount; i++) {
      const bs = ctx.dynTexts[i].bufSize || 64;
      out += `var _dyn_buf_${i}: [${bs}]u8 = undefined;\n`;
      out += `var _dyn_text_${i}: []const u8 = "";\n`;
    }
    if (ctx.handlers.length > 0) out += '\n';
  }

  // Handlers
  if (ctx.handlers.length > 0) {
    out += `// ── Event handlers ──────────────────────────────────────────────\n`;
    for (const h of ctx.handlers) {
      out += `fn ${h.name}() void {\n${h.body}}\n\n`;
    }
  }

  // JS/Lua logic — with section dividers matching reference
  out += `\n// \u2500\u2500 Embedded JS logic \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
  out += `const JS_LOGIC =\n`;
  // Generate JS logic with object array setters
  if (ctx.objectArrays.length > 0) {
    for (const oa of ctx.objectArrays) {
      out += `    \\\\var ${oa.getter} = [];\n`;
      out += `    \\\\function ${oa.setter}(v) { ${oa.getter} = v; __setObjArr${oa.oaIdx}(v); }\n`;
    }
  }
  out += `    \\\\\n;\n`;
  out += `\n// \u2500\u2500 Embedded Lua logic \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n`;
  out += `const LUA_LOGIC =\n    \\\\\n;\n\n`;

  // _initState
  out += `fn _initState() void {\n`;
  for (const s of ctx.stateSlots) {
    if (s.type === 'int') out += `    _ = state.createSlot(${s.initial});\n`;
    else if (s.type === 'float') out += `    _ = state.createSlotFloat(${s.initial});\n`;
    else if (s.type === 'boolean') out += `    _ = state.createSlotBool(${s.initial});\n`;
    else if (s.type === 'string') out += `    _ = state.createSlotString("${s.initial}");\n`;
  }
  out += `}\n\n`;

  // _updateDynamicTexts
  out += `fn _updateDynamicTexts() void {\n`;
  for (const dt of ctx.dynTexts) {
    out += `    _dyn_text_${dt.bufId} = std.fmt.bufPrint(&_dyn_buf_${dt.bufId}, "${dt.fmtString}", .{ ${dt.fmtArgs} }) catch "";\n`;
    if (dt.arrName) {
      out += `    ${dt.arrName}[${dt.arrIndex}].text = _dyn_text_${dt.bufId};\n`;
    } else {
      out += `    _root.text = _dyn_text_${dt.bufId};\n`;
    }
  }
  // Dynamic style updates
  if (ctx.dynStyles && ctx.dynStyles.length > 0) {
    for (const ds of ctx.dynStyles) {
      // TODO: bind to correct array/index — for now update root
      out += `    _root.style.${ds.field} = ${ds.expression};\n`;
    }
  }
  out += `}\n\n`;

  const hasConds = ctx.conditionals.length > 0;

  // _updateConditionals
  if (hasConds) {
    out += `\nfn _updateConditionals() void {\n`;
    for (const cond of ctx.conditionals) {
      if (!cond.arrName) continue;
      // Wrap condition — if it's already a comparison, use parens; else add != 0
      const isComparison = cond.condExpr.includes('==') || cond.condExpr.includes('!=') ||
        cond.condExpr.includes('>=') || cond.condExpr.includes('<=') ||
        cond.condExpr.includes(' > ') || cond.condExpr.includes(' < ') ||
        cond.condExpr.includes('getBool');
      const wrapped = isComparison ? `(${cond.condExpr})` : `((${cond.condExpr}) != 0)`;
      if (cond.kind === 'show_hide') {
        out += `    ${cond.arrName}[${cond.trueIdx}].style.display = if ${wrapped} .flex else .none;\n`;
      }
    }
    out += `}\n\n`;
  }

  out += `\n`;

  // _appInit
  out += `fn _appInit() void {\n    _initState();\n`;
  for (const oa of ctx.objectArrays) {
    out += `    qjs_runtime.registerHostFn("__setObjArr${oa.oaIdx}", @ptrCast(&_oa${oa.oaIdx}_unpack), 1);\n`;
  }
  if (hasDynText) out += `    _updateDynamicTexts();\n`;
  if (hasConds) out += `    _updateConditionals();\n`;
  for (let mi = 0; mi < ctx.maps.length; mi++) {
    out += `    _rebuildMap${mi}();\n`;
  }
  out += `}\n\n`;

  // _appTick
  out += `fn _appTick(now: u32) void {\n    _ = now;\n`;
  if (hasState || ctx.objectArrays.length > 0) {
    if (ctx.maps.length > 0) {
      out += `    if (state.isDirty()) { _updateDynamicTexts();\n`;
      for (let mi = 0; mi < ctx.maps.length; mi++) {
        out += `        _rebuildMap${mi}();\n`;
      }
      if (hasConds) out += `        _updateConditionals();\n`;
      out += ` state.clearDirty(); }\n`;
    } else {
      out += `    if (state.isDirty()) {`;
      out += ` _updateDynamicTexts();`;
      if (hasConds) out += ` _updateConditionals();`;
      out += ` state.clearDirty(); }\n`;
    }
  }
  out += `}\n\n`;

  // Exports
  out += `export fn app_get_root() *Node { return &_root; }\n`;
  out += `export fn app_get_init() ?*const fn () void { return _appInit; }\n`;
  out += `export fn app_get_tick() ?*const fn (u32) void { return _appTick; }\n`;
  out += `export fn app_get_js_logic() [*]const u8 { return JS_LOGIC.ptr; }\n`;
  out += `export fn app_get_js_logic_len() usize { return JS_LOGIC.len; }\n`;
  out += `export fn app_get_lua_logic() [*]const u8 { return LUA_LOGIC.ptr; }\n`;
  out += `export fn app_get_lua_logic_len() usize { return LUA_LOGIC.len; }\n`;
  out += `export fn app_get_title() [*:0]const u8 { return "${appName}"; }\n\n`;

  // State exports
  out += `export fn app_state_count() usize { return ${ctx.stateSlots.length}; }\n`;
  if (hasState) {
    const types = ctx.stateSlots.map(s => ({ int: 0, float: 1, boolean: 2, string: 3 }[s.type] || 0));
    out += `const _slot_types = [_]u8{ ${types.join(', ')} };\n`;
    out += `export fn app_state_slot_type(id: usize) u8 { if (id < _slot_types.len) return _slot_types[id]; return 0; }\n`;
    out += `export fn app_state_get_int(id: usize) i64 { return state.getSlot(id); }\n`;
    out += `export fn app_state_set_int(id: usize, val: i64) void { state.setSlot(id, val); }\n`;
    out += `export fn app_state_get_float(id: usize) f64 { return state.getSlotFloat(id); }\n`;
    out += `export fn app_state_set_float(id: usize, val: f64) void { state.setSlotFloat(id, val); }\n`;
    out += `export fn app_state_get_bool(id: usize) u8 { return if (state.getSlotBool(id)) 1 else 0; }\n`;
    out += `export fn app_state_set_bool(id: usize, val: u8) void { state.setSlotBool(id, val != 0); }\n`;
    out += `export fn app_state_get_string_ptr(id: usize) [*]const u8 { return state.getSlotString(id).ptr; }\n`;
    out += `export fn app_state_get_string_len(id: usize) usize { return state.getSlotString(id).len; }\n`;
    out += `export fn app_state_set_string(id: usize, ptr: [*]const u8, len: usize) void { state.setSlotString(id, ptr[0..len]); }\n`;
    out += `export fn app_state_mark_dirty() void { state.markDirty(); }\n`;
  }

  // Main
  out += `\n// Standalone mode \u2014 when compiled as an executable directly (skipped in .so builds)\npub fn main() !void {\n`;
  out += `    if (IS_LIB) return;\n`;
  out += `    try engine.run(.{\n`;
  out += `        .title = "${appName}",\n`;
  out += `        .root = &_root,\n`;
  out += `        .js_logic = JS_LOGIC,\n`;
  out += `        .lua_logic = LUA_LOGIC,\n`;
  out += `        .init = _appInit,\n`;
  out += `        .tick = _appTick,\n`;
  out += `    });\n}\n`;

  return out;
}

// ── Entry point ──

function compile() {
  const source = globalThis.__source;
  const tokens = globalThis.__tokens;
  const file = globalThis.__file || 'unknown.tsz';
  const c = mkCursor(tokens, source);

  resetCtx();

  // Phase 1: Collect components and state
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
