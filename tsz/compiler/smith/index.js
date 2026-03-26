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
    text()      { return this.source.slice(this.starts[this.pos], this.ends[this.pos]); },
    textAt(i)   { return this.source.slice(this.starts[i], this.ends[i]); },
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
    handlers: [],         // [{name, body}]  body = zig source
    handlerCount: 0,
    dynTexts: [],         // [{bufId, fmtString, fmtArgs, arrName, arrIndex}]
    dynCount: 0,
    arrayCounter: 0,
    arrayDecls: [],       // ["var _arr_N = [_]Node{ ... };"]
  };
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
              ctx.stateSlots.push({ getter, setter, initial, type });
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
        if (val.type === 'string' && val.value.endsWith('%')) {
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
    // Block body — not yet supported, skip
    let depth = 1; c.advance();
    while (depth > 0 && c.kind() !== TK.eof) {
      if (c.kind() === TK.lbrace) depth++;
      if (c.kind() === TK.rbrace) depth--;
      if (depth > 0) c.advance();
    }
    if (c.kind() === TK.rbrace) c.advance();
    return '// block handler not yet ported\n';
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
    c.advance();
    const children = parseChildren(c);
    if (c.kind() === TK.lt_slash) { c.advance(); if (c.kind() === TK.gt) c.advance(); }
    return buildNode('Box', [], children);
  }

  const rawTag = c.text();
  const tag = resolveTag(rawTag);
  c.advance();

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
          // color="#hex" or color={expr} → .text_color = Color.rgb(...)
          if (c.kind() === TK.string) {
            const val = c.text().slice(1, -1);
            nodeFields.push(`.text_color = ${parseColor(val)}`);
            c.advance();
          } else if (c.kind() === TK.lbrace) { skipBraces(c); }
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
    return buildNode(tag, styleFields, [], handlerRef, nodeFields);
  }
  if (c.kind() === TK.gt) c.advance();

  const children = parseChildren(c);

  // </Tag>
  if (c.kind() === TK.lt_slash) {
    c.advance();
    if (c.kind() === TK.identifier) c.advance();
    if (c.kind() === TK.gt) c.advance();
  }

  return buildNode(tag, styleFields, children, handlerRef, nodeFields);
}

function parseChildren(c) {
  const children = [];
  while (c.kind() !== TK.lt_slash && c.kind() !== TK.eof) {
    if (c.kind() === TK.lt) {
      children.push(parseJSXElement(c));
    } else if (c.kind() === TK.lbrace) {
      // {expr} — check if it's a state getter for dynamic text
      c.advance();
      if (c.kind() === TK.identifier && isGetter(c.text())) {
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
      // Text content — collect anything that isn't JSX or braces
      let text = '';
      while (c.kind() !== TK.lt && c.kind() !== TK.lt_slash && c.kind() !== TK.lbrace && c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
        text += c.text();
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

function buildNode(tag, styleFields, children, handlerRef, nodeFields) {
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
    ctx.arrayDecls.push(`var ${arrName} = [_]Node{ ${childExprs} };`);
    // Bind dynamic texts to this array
    for (let i = 0; i < children.length; i++) {
      if (children[i].dynBufId !== undefined) {
        const dt = ctx.dynTexts.find(d => d.bufId === children[i].dynBufId);
        if (dt) { dt.arrName = arrName; dt.arrIndex = i; }
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
  // Header
  out += `//! Generated by Forge+Smith\n//!\n//! Source: ${basename}\n\n`;
  out += `const std = @import("std");\n`;
  out += `const builtin = @import("builtin");\n`;
  out += `const build_options = @import("build_options");\n`;
  out += `const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;\n\n`;
  out += `const layout = @import("${prefix}layout.zig");\n`;
  out += `const Node = layout.Node;\nconst Style = layout.Style;\nconst Color = layout.Color;\n`;
  if (hasState) out += `const state = @import("${prefix}state.zig");\n`;
  out += `const engine = if (IS_LIB) struct {} else if (builtin.os.tag == .emscripten) @import("${prefix}engine_web.zig") else @import("${prefix}engine.zig");\n\n`;

  // State manifest
  if (hasState) {
    out += `// ── State manifest ──────────────────────────────────────────────\n`;
    ctx.stateSlots.forEach((s, i) => { out += `// slot ${i}: ${s.getter} (${s.type})\n`; });
    out += `comptime { if (${ctx.stateSlots.length} != ${ctx.stateSlots.length}) @compileError("state slot count mismatch"); }\n\n`;
  }

  // Node tree
  out += `// ── Generated node tree ─────────────────────────────────────────\n`;
  for (const decl of ctx.arrayDecls) out += decl + '\n';
  const nodeInit = rootExpr.startsWith('.') ? rootExpr.slice(1) : rootExpr;
  out += `var _root = Node${nodeInit};\n\n`;

  // Dynamic text buffers
  if (hasDynText) {
    out += `// ── Dynamic text buffers ─────────────────────────────────────────\n`;
    for (let i = 0; i < ctx.dynCount; i++) {
      const bs = ctx.dynTexts[i].bufSize || 64;
      out += `var _dyn_buf_${i}: [${bs}]u8 = undefined;\n`;
      out += `var _dyn_text_${i}: []const u8 = "";\n`;
    }
    out += '\n';
  }

  // Handlers
  if (ctx.handlers.length > 0) {
    out += `// ── Event handlers ──────────────────────────────────────────────\n`;
    for (const h of ctx.handlers) {
      out += `fn ${h.name}() void {\n${h.body}}\n\n`;
    }
  }

  // JS/Lua logic
  out += `const JS_LOGIC =\n    \\\\\n;\n`;
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
  out += `}\n\n`;

  // _appInit
  out += `fn _appInit() void {\n    _initState();\n`;
  if (hasDynText) out += `    _updateDynamicTexts();\n`;
  out += `}\n\n`;

  // _appTick
  out += `fn _appTick(now: u32) void {\n    _ = now;\n`;
  if (hasState) out += `    if (state.isDirty()) { _updateDynamicTexts(); state.clearDirty(); }\n`;
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
  out += `\npub fn main() !void {\n`;
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

  // Phase 1: Collect state
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
