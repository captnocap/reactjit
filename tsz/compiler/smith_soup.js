// ── Soup-Smith ─────────────────────────────────────────────────────────────
// Compiler lane for web React soup sources (s##a tier).
// Completely self-contained — never called from non-soup paths.
//
// Accepts broken HTML-React patterns, infers intent, warns, never crashes.
// Output: valid .zig using QJS script lane for all handler dispatch.

// ── Detection ────────────────────────────────────────────────────────────────

function isSoupSource(source, file) {
  var fname = (file || '').split('/').pop();
  if (/^s\d+a_/.test(fname)) return true;
  if (source.indexOf('import React') >= 0 &&
      /[<](div|span|h[1-6]|p[\s>\/]|button|ul|li|form|input|canvas)/.test(source))
    return true;
  return false;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Tables defined in rules.js: soupTags, soupFonts, soupColors
var _STAG = soupTags;
var _SFONT = soupFonts;
var _SC = soupColors;

var _sShCtr = 0;
var _sInlineHandlers = [];

// ── State parser ──────────────────────────────────────────────────────────────

function soupParseState(source, warns) {
  var re = /const\s+\[(\w+)\s*,\s*(\w+)\]\s*=\s*(?:React\.)?useState\(([\s\S]*?)\)\s*;/g;
  var m;
  while ((m = re.exec(source)) !== null) {
    var g = m[1], setter = m[2], raw = m[3].trim();
    // NOTE: emitOutput expects 'int' not 'number' for integer state
    var type = 'int', init = '0';
    if (raw === 'true' || raw === 'false') {
      type = 'boolean'; init = raw;
    } else if (/^['"`]/.test(raw)) {
      type = 'string'; init = raw.replace(/^['"`]|['"`]$/g, '');
    } else if (/^-?\d+$/.test(raw)) {
      type = 'int'; init = raw;
    } else if (/^-?\d+\.\d+$/.test(raw)) {
      type = 'float'; init = raw;
    } else if (raw === 'null' || raw === 'undefined') {
      type = 'string'; init = '';
    } else if (raw.charAt(0) === '[') {
      warns.push('[W] array state "' + g + '" → stubbed as int 0');
      type = 'int'; init = '0';
    } else if (raw.charAt(0) === '{') {
      warns.push('[W] object state "' + g + '" → stubbed as int 0');
      type = 'int'; init = '0';
    } else {
      warns.push('[W] unrecognized useState init for "' + g + '" → int 0');
      type = 'int'; init = '0';
    }
    ctx.stateSlots.push({ getter: g, setter: setter, initial: init, type: type });
  }
}

// ── Handler collector ─────────────────────────────────────────────────────────

function soupCollectHandlers(source, warns) {
  var handlers = [];
  var re = /const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*\{/g;
  var m;
  while ((m = re.exec(source)) !== null) {
    var name = m[1];
    if (name.charAt(0) >= 'A' && name.charAt(0) <= 'Z') continue;
    var openBrace = m.index + m[0].length - 1;
    var body = soupBlock(source, openBrace);
    handlers.push({ name: name, jsBody: body.trim() });
  }
  return handlers;
}

function soupBlock(src, pos) {
  var depth = 0, i = pos;
  while (i < src.length) {
    var ch = src.charAt(i);
    if (ch === "'" || ch === '"' || ch === '`') {
      var q = ch; i++;
      while (i < src.length && src.charAt(i) !== q) { if (src.charAt(i) === '\\') i++; i++; }
    } else if (ch === '{') { depth++; }
    else if (ch === '}') { depth--; if (depth === 0) return src.slice(pos + 1, i); }
    i++;
  }
  return src.slice(pos + 1);
}

// ── JSX extractor ─────────────────────────────────────────────────────────────

function soupExtractReturn(source) {
  var idx = source.lastIndexOf('return (');
  if (idx >= 0) {
    var start = idx + 8, depth = 1, i = start;
    while (i < source.length && depth > 0) {
      if (source.charAt(i) === '(') depth++;
      else if (source.charAt(i) === ')') depth--;
      if (depth > 0) i++; else break;
    }
    return source.slice(start, i).trim();
  }
  var idx2 = source.search(/return\s+</);
  if (idx2 >= 0) return source.slice(source.indexOf('<', idx2)).trim();
  return null;
}

// ── JSX tokenizer ─────────────────────────────────────────────────────────────

function soupTokenize(jsx) {
  var tokens = [], i = 0;
  while (i < jsx.length) {
    var ch = jsx.charAt(i);
    if (ch === '{' && jsx.slice(i, i + 4) === '{/*') {
      var end = jsx.indexOf('*/}', i + 3); i = end >= 0 ? end + 3 : jsx.length; continue;
    }
    if (ch === '<' && jsx.slice(i, i + 4) === '<!--') {
      var end = jsx.indexOf('-->', i + 4); i = end >= 0 ? end + 3 : jsx.length; continue;
    }
    if (ch === '/' && jsx.charAt(i + 1) === '/') {
      var end = jsx.indexOf('\n', i + 2); i = end >= 0 ? end + 1 : jsx.length; continue;
    }
    if (ch === '<') {
      if (jsx.charAt(i + 1) === '/') {
        var end = jsx.indexOf('>', i + 2);
        tokens.push({ type: 'close', name: jsx.slice(i + 2, end >= 0 ? end : jsx.length).trim().toLowerCase() });
        i = end >= 0 ? end + 1 : jsx.length;
      } else {
        var t = soupParseTag(jsx, i); tokens.push(t.token); i = t.end;
      }
      continue;
    }
    if (ch === '{') {
      var r = soupBalanced(jsx, i);
      var expr = r.text.trim();
      if (expr) tokens.push({ type: 'expr', expr: expr });
      i = r.end; continue;
    }
    var start = i;
    while (i < jsx.length && jsx.charAt(i) !== '<' && jsx.charAt(i) !== '{') i++;
    var text = jsx.slice(start, i).replace(/\s+/g, ' ').trim();
    if (text) tokens.push({ type: 'text', text: text });
  }
  return tokens;
}

function soupBalanced(src, start) {
  var depth = 0, i = start;
  while (i < src.length) {
    var ch = src.charAt(i);
    if (ch === "'" || ch === '"' || ch === '`') {
      var q = ch; i++;
      while (i < src.length && src.charAt(i) !== q) { if (src.charAt(i) === '\\') i++; i++; }
    } else if (ch === '{') { depth++; }
    else if (ch === '}') { depth--; if (depth === 0) return { text: src.slice(start + 1, i), end: i + 1 }; }
    i++;
  }
  return { text: src.slice(start + 1), end: src.length };
}

function soupParseTag(jsx, start) {
  var i = start + 1, name = '';
  while (i < jsx.length && /[a-zA-Z0-9_\-]/.test(jsx.charAt(i))) name += jsx.charAt(i++);
  name = name.toLowerCase();
  var attrs = {}, selfClose = false;
  while (i < jsx.length) {
    while (i < jsx.length && /\s/.test(jsx.charAt(i))) i++;
    if (jsx.charAt(i) === '>') { i++; break; }
    if (jsx.charAt(i) === '/' && jsx.charAt(i + 1) === '>') { selfClose = true; i += 2; break; }
    var aname = '';
    while (i < jsx.length && jsx.charAt(i) !== '=' && !/[\s>\/]/.test(jsx.charAt(i))) aname += jsx.charAt(i++);
    if (!aname) { i++; continue; }
    if (jsx.charAt(i) !== '=') { attrs[aname.toLowerCase()] = true; continue; }
    i++;
    var ch = jsx.charAt(i);
    if (ch === '"' || ch === "'") {
      i++; var val = '';
      while (i < jsx.length && jsx.charAt(i) !== ch) val += jsx.charAt(i++);
      i++; attrs[aname.toLowerCase()] = val;
    } else if (ch === '{') {
      var r = soupBalanced(jsx, i); attrs[aname.toLowerCase()] = { expr: r.text.trim() }; i = r.end;
    } else {
      var val = '';
      while (i < jsx.length && !/[\s>]/.test(jsx.charAt(i))) val += jsx.charAt(i++);
      attrs[aname.toLowerCase()] = val;
    }
  }
  return { token: { type: selfClose ? 'selfclose' : 'open', name: name, attrs: attrs }, end: i };
}

// ── Tree builder ──────────────────────────────────────────────────────────────

function soupBuildTree(tokens) {
  var stack = [{ type: 'root', children: [] }];
  for (var i = 0; i < tokens.length; i++) {
    var t = tokens[i], top = stack[stack.length - 1];
    if (t.type === 'open') {
      var node = { type: 'element', tag: t.name, attrs: t.attrs, children: [] };
      top.children.push(node); stack.push(node);
    } else if (t.type === 'selfclose') {
      top.children.push({ type: 'element', tag: t.name, attrs: t.attrs, children: [] });
    } else if (t.type === 'close') {
      if (stack.length > 1) stack.pop();
    } else if (t.type === 'text') {
      top.children.push({ type: 'text', text: t.text });
    } else if (t.type === 'expr') {
      top.children.push({ type: 'expr', expr: t.expr });
    }
  }
  return stack[0].children.length > 0 ? stack[0].children[0] : null;
}

// ── Inline handler extractor ──────────────────────────────────────────────────

function soupExtractInlineHandlers(node, warns) {
  if (!node || node.type !== 'element') return;
  var evtKeys = ['onclick', 'onpress', 'onchange', 'onsubmit'];
  for (var ei = 0; ei < evtKeys.length; ei++) {
    var key = evtKeys[ei];
    if (!(key in node.attrs)) continue;
    var v = node.attrs[key];
    if (v && typeof v === 'object' && v.expr) {
      var expr = v.expr.trim();
      if (/^\(/.test(expr) && expr.indexOf('=>') >= 0) {
        var name = '_sh_' + _sShCtr++;
        var arrowIdx = expr.indexOf('=>');
        var body = expr.slice(arrowIdx + 2).trim();
        if (body.charAt(0) === '{' && body.charAt(body.length - 1) === '}')
          body = body.slice(1, -1).trim();
        _sInlineHandlers.push({ name: name, jsBody: body });
        node.attrs[key] = { expr: name };
      }
    }
  }
  for (var ci = 0; ci < node.children.length; ci++)
    soupExtractInlineHandlers(node.children[ci], warns);
}

// ── Zig node builder ──────────────────────────────────────────────────────────
// Every function returns { str: "...", dynBufId: -1 }
// dynBufId >= 0 means this node is a dynText placeholder that needs wiring.

function soupToZig(node, warns, inPressable) {
  if (!node) return { str: '', dynBufId: -1 };

  if (node.type === 'text') {
    var esc = node.text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    var tc = inPressable ? _SC.textWhite : _SC.textP;
    return { str: '.{ .text = "' + esc + '", .text_color = Color.rgb(' + tc + ') }', dynBufId: -1 };
  }

  if (node.type === 'expr') {
    return soupExprToZig(node.expr, warns, inPressable);
  }

  if (node.type !== 'element') return { str: '', dynBufId: -1 };

  var kind = _STAG[node.tag] || 'box';
  if (kind === 'void') return { str: '', dynBufId: -1 };

  // React fragments (<>...</>) — transparent wrapper, just emit children as a box
  if (node.tag === '' || node.tag === 'react.fragment' || node.tag === 'fragment') {
    kind = 'box';
  }

  if (kind === 'stub') {
    warns.push('[W] <' + node.tag + '> unsupported → stub');
    return { str: '.{ .style = .{ .width = 60, .height = 30, .background_color = Color.rgb(' + _SC.stubBg + '), .border_radius = 4 } }', dynBufId: -1 };
  }

  var attrs = node.attrs;
  var styleFields = [];
  var handlerRef = null;

  // className → drop + warn
  var cn = attrs['classname'] || attrs['class'];
  if (cn !== undefined) {
    if (typeof cn === 'object') warns.push('[W] dynamic className dropped');
    else warns.push('[W] className="' + String(cn).substring(0, 40) + '" dropped');
  }

  // style={{ ... }}
  var styleAttr = attrs['style'];
  if (styleAttr && typeof styleAttr === 'object' && styleAttr.expr)
    styleFields = soupParseStyle(styleAttr.expr, warns);

  // Handler
  var hKeys = ['onclick', 'onpress', 'onchange'];
  for (var hi = 0; hi < hKeys.length; hi++) {
    if (hKeys[hi] in attrs) {
      var hv = attrs[hKeys[hi]];
      if (hv && typeof hv === 'object' && hv.expr) {
        var ref = hv.expr.trim();
        if (ref.charAt(0) === '{') ref = ref.slice(1, ref.length - 1).trim();
        if (ref) handlerRef = ref;
      }
      break;
    }
  }

  // ── text-kind tags (p, h1-h6, etc.) ──
  if (kind === 'text') {
    var fs = _SFONT[node.tag] || 14;
    var tc = _SC.textH;
    if (node.tag === 'p' || node.tag === 'label') tc = _SC.textP;
    if (node.tag === 'span' || node.tag === 'small') tc = _SC.textDim;
    if (inPressable) tc = _SC.textWhite;

    if (styleAttr && typeof styleAttr === 'object' && styleAttr.expr) {
      var textStyle = soupParseTextStyle(styleAttr.expr);
      if (textStyle.fontSize !== null) fs = textStyle.fontSize;
      if (textStyle.textColor) tc = textStyle.textColor;
    }

    // Check children: could be text, expr, or mixed
    var textContent = '';
    var exprChild = null;
    for (var ci = 0; ci < node.children.length; ci++) {
      if (node.children[ci].type === 'text') textContent += node.children[ci].text;
      if (node.children[ci].type === 'expr') exprChild = node.children[ci];
    }

    // Expr child (e.g. <p>{count}</p>) → dynText
    if (exprChild) {
      var exResult = soupExprToZig(exprChild.expr, warns, false);
      if (exResult.dynBufId >= 0) {
        // Return a text node placeholder — the parent will wire the dynText
        return { str: '.{ .text = "", .font_size = ' + fs + ', .text_color = Color.rgb(' + tc + ') }', dynBufId: exResult.dynBufId };
      }
    }

    // Static text
    var esc = textContent.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return { str: '.{ .text = "' + esc + '", .font_size = ' + fs + ', .text_color = Color.rgb(' + tc + ') }', dynBufId: -1 };
  }

  // ── Build children ──
  var childResults = [];
  for (var ci = 0; ci < node.children.length; ci++) {
    var child = node.children[ci];
    // .map() expressions are handled by soupExprToZig → soupHandleMap
    var cr = soupToZig(child, warns, kind === 'pressable');
    if (cr.str) childResults.push(cr);
  }

  // ── Pressable (button) ──
  if (kind === 'pressable') {
    var parts = [];
    var btnStyleFields = styleFields.slice();
    if (btnStyleFields.every(function(f) { return f.indexOf('background_color') < 0; })) {
      // Preserve the old soup heuristic only when no explicit button color exists.
      var btnColor = _SC.btnBlue;
      var btnText = '';
      for (var ci = 0; ci < node.children.length; ci++) {
        if (node.children[ci].type === 'text') btnText += node.children[ci].text.toLowerCase();
      }
      if (btnText.indexOf('red') >= 0 || btnText.indexOf('delete') >= 0 || btnText.indexOf('remove') >= 0)
        btnColor = _SC.btnRed;
      else if (btnText.indexOf('reset') >= 0 || btnText.indexOf('cancel') >= 0 || btnText.indexOf('gray') >= 0)
        btnColor = _SC.btnGray;
      btnStyleFields.push('.background_color = Color.rgb(' + btnColor + ')');
    }
    if (btnStyleFields.every(function(f) { return f.indexOf('.padding') < 0; }))
      btnStyleFields.push('.padding = 10');
    if (btnStyleFields.every(function(f) { return f.indexOf('border_radius') < 0; }))
      btnStyleFields.push('.border_radius = 6');
    if (btnStyleFields.every(function(f) { return f.indexOf('align_items') < 0; }))
      btnStyleFields.push('.align_items = .center');
    if (btnStyleFields.every(function(f) { return f.indexOf('justify_content') < 0; }))
      btnStyleFields.push('.justify_content = .center');

    parts.push('.style = .{ ' + btnStyleFields.join(', ') + ' }');
    if (handlerRef) parts.push('.handlers = .{ .js_on_press = "' + handlerRef + '()" }');

    if (childResults.length > 0) {
      var aname = '_arr_' + ctx.arrayCounter++;
      var strs = [];
      for (var ri = 0; ri < childResults.length; ri++) strs.push(childResults[ri].str);
      ctx.arrayDecls.push('var ' + aname + ' = [_]Node{ ' + strs.join(', ') + ' };');
      soupWireDynTextsInArray(aname, childResults);
      parts.push('.children = &' + aname);
    }
    return { str: '.{ ' + parts.join(', ') + ' }', dynBufId: -1 };
  }

  // ── Box (div, span, ul, etc.) ──
  var parts = [];

  // Add flex_direction: column for block containers
  var blockTags = { div:1, section:1, main:1, header:1, footer:1, nav:1, aside:1, ul:1, ol:1, form:1 };
  if (blockTags[node.tag]) {
    if (styleFields.every(function(f) { return f.indexOf('flex_direction') < 0; }))
      styleFields.push('.flex_direction = .column');
    if (styleFields.every(function(f) { return f.indexOf('.gap') < 0; }))
      styleFields.push('.gap = 8');
  }

  // If this box has a click handler, give it clickable appearance
  if (handlerRef) {
    if (styleFields.every(function(f) { return f.indexOf('background_color') < 0; }))
      styleFields.push('.background_color = Color.rgb(' + _SC.btnGray + ')');
    if (styleFields.every(function(f) { return f.indexOf('.padding') < 0; }))
      styleFields.push('.padding = 8');
    if (styleFields.every(function(f) { return f.indexOf('border_radius') < 0; }))
      styleFields.push('.border_radius = 4');
  }

  if (styleFields.length > 0) parts.push('.style = .{ ' + styleFields.join(', ') + ' }');
  if (handlerRef) parts.push('.handlers = .{ .js_on_press = "' + handlerRef + '()" }');

  if (childResults.length > 0) {
    var aname = '_arr_' + ctx.arrayCounter++;
    var strs = [];
    for (var ri = 0; ri < childResults.length; ri++) strs.push(childResults[ri].str);
    ctx.arrayDecls.push('var ' + aname + ' = [_]Node{ ' + strs.join(', ') + ' };');
    soupWireDynTextsInArray(aname, childResults);
    parts.push('.children = &' + aname);
  }

  if (parts.length === 0) parts.push('.style = .{}');
  return { str: '.{ ' + parts.join(', ') + ' }', dynBufId: -1 };
}

// Wire dynText entries to their positions in a newly-created array
function soupWireDynTextsInArray(arrName, childResults) {
  for (var i = 0; i < childResults.length; i++) {
    if (childResults[i].dynBufId >= 0) {
      for (var di = 0; di < ctx.dynTexts.length; di++) {
        if (ctx.dynTexts[di].bufId === childResults[i].dynBufId) {
          ctx.dynTexts[di].arrName = arrName;
          ctx.dynTexts[di].arrIndex = i;
          break;
        }
      }
    }
  }
}

// ── .map() static template renderer ───────────────────────────────────────────
// Renders ONE static copy of the .map() template with field names as placeholders.
// arrayName.map((item) => ( <JSX with {item.field}> ))  →  one rendered card

function soupHandleMap(expr, warns, inPressable) {
  // Extract: arrayName.map((itemParam) => ...body...)
  var mapMatch = expr.match(/^(\w+)(?:\.\w+)*\.map\(\s*\((\w+)(?:\s*,\s*\w+)?\)\s*=>/);
  if (!mapMatch) {
    // Try filtered: array.filter(...).map(...)
    mapMatch = expr.match(/\.map\(\s*\((\w+)(?:\s*,\s*\w+)?\)\s*=>/);
    if (mapMatch) {
      mapMatch = [mapMatch[0], 'filtered', mapMatch[1]];
    } else {
      warns.push('[W] unrecognized .map() pattern — skipped');
      return { str: '', dynBufId: -1 };
    }
  }
  var arrayName = mapMatch[1];
  var itemParam = mapMatch[2];

  // Find the => that belongs to the OUTER .map()'s callback.
  // Use indexOf (first .map), not lastIndexOf (which finds inner nested .map)
  var mapPos = expr.indexOf('.map(');
  var arrowIdx = expr.indexOf('=>', mapPos);
  var afterArrow = expr.slice(arrowIdx + 2).trim();
  var jsxBody = '';

  if (afterArrow.charAt(0) === '(') {
    // () => ( ... )  — extract balanced parens
    var depth = 0, i = 0;
    while (i < afterArrow.length) {
      if (afterArrow.charAt(i) === '(') depth++;
      else if (afterArrow.charAt(i) === ')') { depth--; if (depth === 0) { jsxBody = afterArrow.slice(1, i); break; } }
      i++;
    }
  } else if (afterArrow.charAt(0) === '{') {
    // () => { ... return (...) }  or  () => { ... return <tag>...</tag>; }
    var block = soupBlock(afterArrow, 0);
    var retIdx = block.lastIndexOf('return');
    if (retIdx >= 0) {
      var afterRet = block.slice(retIdx + 6).trim();
      if (afterRet.charAt(0) === '(') {
        // return ( ... )
        var depth = 0, i = 0;
        while (i < afterRet.length) {
          if (afterRet.charAt(i) === '(') depth++;
          else if (afterRet.charAt(i) === ')') { depth--; if (depth === 0) { jsxBody = afterRet.slice(1, i); break; } }
          i++;
        }
      } else if (afterRet.charAt(0) === '<') {
        // return <tag>...</tag>;  — extract JSX directly
        jsxBody = afterRet.replace(/;\s*$/, '');
      }
    }
    if (!jsxBody) {
      warns.push('[W] .map() body has no extractable JSX for "' + arrayName + '" — skipped');
      return { str: '', dynBufId: -1 };
    }
  } else if (afterArrow.charAt(0) === '<') {
    // () => <Tag>...</Tag>  — direct JSX
    jsxBody = afterArrow.replace(/\)\s*\)\s*$/, '');
  }

  if (!jsxBody || jsxBody.trim().length === 0) {
    warns.push('[W] .map() body extraction failed for "' + arrayName + '" — skipped');
    return { str: '', dynBufId: -1 };
  }

  // Replace {itemParam.field} references with static placeholder text
  var itemRe = new RegExp('\\{\\s*' + itemParam + '\\.(\\w+)\\s*\\}', 'g');
  jsxBody = jsxBody.replace(itemRe, '[$1]');

  // Complex expressions like {item.field.includes(...)} are left for the
  // tokenizer to handle via soupBalanced (which tracks nesting correctly).
  // Do NOT use [^}]* regex here — it can't handle nested braces.

  // Drop key={...} attributes (simple non-nested values only)
  // soupBalanced in the tag parser handles nested key values correctly,
  // so we only strip trivial key=... here for cleanliness.
  jsxBody = jsxBody.replace(/\s+key=\{[^{}]*\}/g, '');

  // Parse the cleaned template through normal soup pipeline
  var tokens = soupTokenize(jsxBody.trim());
  var tree = soupBuildTree(tokens);
  if (!tree) {
    warns.push('[W] .map() template parse failed for "' + arrayName + '" — skipped');
    return { str: '', dynBufId: -1 };
  }

  // Extract inline handlers from the map template tree
  soupExtractInlineHandlers(tree, warns);

  // Render the static template
  var result = soupToZig(tree, warns, inPressable);
  warns.push('[W] .map("' + arrayName + '") → rendered 1 static template');
  return result;
}

// ── Top-level token finders (skip nested parens/braces/strings) ───────────────

function soupFindTopLevelAnd(expr) {
  var depth = 0, i = 0;
  while (i < expr.length - 1) {
    var ch = expr.charAt(i);
    if (ch === "'" || ch === '"' || ch === '`') {
      var q = ch; i++;
      while (i < expr.length && expr.charAt(i) !== q) { if (expr.charAt(i) === '\\') i++; i++; }
    } else if (ch === '(' || ch === '{' || ch === '[') { depth++; }
    else if (ch === ')' || ch === '}' || ch === ']') { depth--; }
    else if (depth === 0 && ch === '&' && expr.charAt(i + 1) === '&') { return i; }
    i++;
  }
  return -1;
}

function soupFindTopLevelChar(expr, target) {
  var depth = 0, i = 0;
  while (i < expr.length) {
    var ch = expr.charAt(i);
    if (ch === "'" || ch === '"' || ch === '`') {
      var q = ch; i++;
      while (i < expr.length && expr.charAt(i) !== q) { if (expr.charAt(i) === '\\') i++; i++; }
    } else if (ch === '(' || ch === '{' || ch === '[') { depth++; }
    else if (ch === ')' || ch === '}' || ch === ']') { depth--; }
    else if (depth === 0 && ch === target) { return i; }
    i++;
  }
  return -1;
}

function soupPushJsDynText(jsExpr, inPressable) {
  var slotIdx = ctx.stateSlots.length;
  ctx.stateSlots.push({ getter: '__jsExpr_' + slotIdx, setter: '__setJsExpr_' + slotIdx, initial: '', type: 'string' });

  var bufId = ctx.dynCount++;
  ctx.dynTexts.push({
    bufId: bufId,
    fmtString: '{s}',
    fmtArgs: 'state.getSlotString(' + slotIdx + ')',
    arrName: '',
    arrIndex: 0,
    bufSize: 256,
  });
  ctx._jsDynTexts.push({ slotIdx: slotIdx, jsExpr: jsExpr.replace(/\bexact\b/g, '===') });

  var tc = inPressable ? _SC.textWhite : _SC.textP;
  return { str: '.{ .text = "", .text_color = Color.rgb(' + tc + ') }', dynBufId: bufId };
}

// ── Expression → Zig ──────────────────────────────────────────────────────────

function soupExprToZig(expr, warns, inPressable) {
  expr = expr.trim();

  // Simple state getter: {count}
  if (/^\w+$/.test(expr)) {
    for (var si = 0; si < ctx.stateSlots.length; si++) {
      var slot = ctx.stateSlots[si];
      if (slot.getter === expr) {
        var bufId = ctx.dynCount++;
        var fmt, fmtArgs, bufSize;
        if (slot.type === 'string') {
          fmt = '{s}'; fmtArgs = 'state.getSlotString(' + si + ')'; bufSize = 128;
        } else if (slot.type === 'boolean') {
          fmt = '{s}'; fmtArgs = 'if (state.getSlotBool(' + si + ')) @as([]const u8, "true") else @as([]const u8, "false")'; bufSize = 8;
        } else if (slot.type === 'float') {
          fmt = '{d:.2}'; fmtArgs = 'state.getSlotFloat(' + si + ')'; bufSize = 64;
        } else {
          fmt = '{d}'; fmtArgs = '@as(i64, state.getSlot(' + si + '))'; bufSize = 64;
        }
        ctx.dynTexts.push({
          bufId: bufId, fmtString: fmt, fmtArgs: fmtArgs,
          arrName: '', arrIndex: 0, bufSize: bufSize,
        });
        var tc = inPressable ? _SC.textWhite : _SC.textP;
        return { str: '.{ .text = "", .text_color = Color.rgb(' + tc + ') }', dynBufId: bufId };
      }
    }
  }

  // Template literal: {`text ${expr}`}
  if (expr.charAt(0) === '`') {
    warns.push('[W] template literal dropped: ' + expr.substring(0, 50));
    return { str: '', dynBufId: -1 };
  }

  // Conditional render: {condition && (<JSX/>)} — MUST check before .map()
  // because the whole expr can contain .map() nested inside the JSX body.
  if (expr.indexOf('&&') >= 0) {
    var andIdx = soupFindTopLevelAnd(expr);
    if (andIdx >= 0) {
      var jsxPart = expr.slice(andIdx + 2).trim();
      // Strip wrapping parens: (\n<div>...</div>\n) → <div>...</div>
      if (jsxPart.charAt(0) === '(') {
        var depth = 0, i = 0;
        while (i < jsxPart.length) {
          if (jsxPart.charAt(i) === '(') depth++;
          else if (jsxPart.charAt(i) === ')') { depth--; if (depth === 0) { jsxPart = jsxPart.slice(1, i); break; } }
          i++;
        }
      }
      jsxPart = jsxPart.trim();
      if (jsxPart.charAt(0) === '<') {
        // Parse the JSX and render it
        var tokens = soupTokenize(jsxPart);
        var tree = soupBuildTree(tokens);
        if (tree) {
          soupExtractInlineHandlers(tree, warns);
          warns.push('[W] conditional render (&&) rendered unconditionally');
          return soupToZig(tree, warns, inPressable);
        }
      }
    }
    // No top-level && found — the && is nested (e.g. inside .filter()).
    // Fall through to other checks (ternary, .map(), etc.)
  }

  // Ternary: {cond ? <A/> : <B/>} — render the true branch
  if (expr.indexOf('?') >= 0) {
    var qIdx = soupFindTopLevelChar(expr, '?');
    if (qIdx >= 0) {
      var afterQ = expr.slice(qIdx + 1).trim();
      // Check if true branch starts with JSX or a string
      if (afterQ.charAt(0) === '<' || afterQ.charAt(0) === '(') {
        var trueBranch = afterQ;
        if (trueBranch.charAt(0) === '(') {
          var depth = 0, i = 0;
          while (i < trueBranch.length) {
            if (trueBranch.charAt(i) === '(') depth++;
            else if (trueBranch.charAt(i) === ')') { depth--; if (depth === 0) { trueBranch = trueBranch.slice(1, i); break; } }
            i++;
          }
        }
        trueBranch = trueBranch.trim();
        if (trueBranch.charAt(0) === '<') {
          var tokens = soupTokenize(trueBranch);
          var tree = soupBuildTree(tokens);
          if (tree) {
            soupExtractInlineHandlers(tree, warns);
            warns.push('[W] ternary rendered true branch only');
            return soupToZig(tree, warns, inPressable);
          }
        }
      }
      // String ternary: {cond ? "text" : "other"} → static text
      var strMatch = afterQ.match(/^["']([^"']*)["']/);
      if (strMatch) {
        return soupPushJsDynText(expr, inPressable);
      }
    }
    // No top-level ? found — the ? is nested (e.g. inside className={}).
    // Fall through to other checks (.map(), etc.)
  }

  if (expr.indexOf('&&') >= 0 || expr.indexOf('||') >= 0 ||
      expr.indexOf('===') >= 0 || expr.indexOf('!==') >= 0 ||
      expr.indexOf('==') >= 0 || expr.indexOf('!=') >= 0 ||
      expr.indexOf('>') >= 0 || expr.indexOf('<') >= 0) {
    return soupPushJsDynText(expr, inPressable);
  }

  // .map() — checked AFTER && and ? so conditional wrappers are handled first
  if (expr.indexOf('.map(') >= 0) {
    return soupHandleMap(expr, warns, inPressable);
  }

  warns.push('[W] expr dropped: {' + expr.substring(0, 50) + '}');
  return { str: '', dynBufId: -1 };
}

// ── Style parser ──────────────────────────────────────────────────────────────

function soupParseStyle(expr, warns) {
  var fields = [];
  var bgM = /backgroundColor\s*:\s*(?:'([^']+)'|"([^"]+)"|(\w+))/.exec(expr);
  if (bgM) {
    var bg = bgM[1] || bgM[2] || bgM[3] || '';
    var c = soupStyleColorToRgb(bg);
    if (c) fields.push('.background_color = Color.rgb(' + c + ')');
    // Dynamic bg (variable ref) → skip with warning
    else if (/^\w+$/.test(bg)) warns.push('[W] dynamic backgroundColor=' + bg + ' dropped');
  }
  var wM = /\bwidth\s*:\s*(?:'([^']+)'|"([^"]+)"|(\d+))/.exec(expr);
  if (wM) { var wv = wM[1]||wM[2]||wM[3]||''; if (wv==='100%') fields.push('.width = -1'); else if (/^\d+$/.test(wv)) fields.push('.width = '+wv); }
  var hM = /\bheight\s*:\s*(?:'([^']+)'|"([^"]+)"|(\d+))/.exec(expr);
  if (hM) { var hv = hM[1]||hM[2]||hM[3]||''; if (hv==='100%') fields.push('.height = -1'); else if (/^\d+$/.test(hv)) fields.push('.height = '+hv); }
  var minWM = /\bminWidth\s*:\s*(\d+)/.exec(expr);
  if (minWM) fields.push('.min_width = ' + minWM[1]);
  var pM = /\bpadding\s*:\s*(\d+)/.exec(expr);
  if (pM) fields.push('.padding = ' + pM[1]);
  var gM = /\bgap\s*:\s*(\d+)/.exec(expr);
  if (gM) fields.push('.gap = ' + gM[1]);
  var brM = /\bborderRadius\s*:\s*(\d+)/.exec(expr);
  if (brM) fields.push('.border_radius = ' + brM[1]);
  var fdM = /flexDirection\s*:\s*(?:'([^']+)'|"([^"]+)")/.exec(expr);
  if (fdM) {
    var fd = (fdM[1] || fdM[2] || '').toLowerCase();
    if (fd === 'row') fields.push('.flex_direction = .row');
    else if (fd === 'column') fields.push('.flex_direction = .column');
  }
  var aiM = /alignItems\s*:\s*(?:'([^']+)'|"([^"]+)")/.exec(expr);
  if (aiM) {
    var ai = aiM[1] || aiM[2] || '';
    if (ai === 'center') fields.push('.align_items = .center');
    else if (ai === 'start' || ai === 'flex-start' || ai === 'flexStart') fields.push('.align_items = .start');
    else if (ai === 'end' || ai === 'flex-end' || ai === 'flexEnd') fields.push('.align_items = .end');
  }
  var jcM = /justifyContent\s*:\s*(?:'([^']+)'|"([^"]+)")/.exec(expr);
  if (jcM) {
    var jc = jcM[1] || jcM[2] || '';
    if (jc === 'center') fields.push('.justify_content = .center');
    else if (jc === 'start' || jc === 'flex-start' || jc === 'flexStart') fields.push('.justify_content = .start');
    else if (jc === 'end' || jc === 'flex-end' || jc === 'flexEnd') fields.push('.justify_content = .end');
    else if (jc === 'space-between' || jc === 'spaceBetween') fields.push('.justify_content = .space_between');
  }
  var ovM = /overflow\s*:\s*(?:'([^']+)'|"([^"]+)")/.exec(expr);
  if (ovM) {
    var ov = ovM[1] || ovM[2] || '';
    if (ov === 'hidden') fields.push('.overflow = .hidden');
  }
  return fields;
}

function soupStyleColorToRgb(raw) {
  if (!raw) return null;
  if (raw.charAt(0) === '#') return soupHexRgb(raw);
  var key = raw.toLowerCase();
  if (typeof namedColors !== 'undefined' && namedColors[key]) {
    var c = namedColors[key];
    return c[0] + ', ' + c[1] + ', ' + c[2];
  }
  if (key === 'blue') return '59, 130, 246';
  if (key === 'red') return '220, 38, 38';
  if (key === 'black') return '0, 0, 0';
  if (key === 'white') return '255, 255, 255';
  return null;
}

function soupParseTextStyle(expr) {
  var result = { fontSize: null, textColor: null };
  var fsM = /\bfontSize\s*:\s*(\d+)/.exec(expr);
  if (fsM) result.fontSize = parseInt(fsM[1], 10);
  var colorM = /\bcolor\s*:\s*(?:'([^']+)'|"([^"]+)"|(\w+))/.exec(expr);
  if (colorM) {
    var raw = colorM[1] || colorM[2] || colorM[3] || '';
    var rgb = soupStyleColorToRgb(raw);
    if (rgb) result.textColor = rgb;
  }
  return result;
}

function soupHexRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  if (hex.length !== 6) return null;
  return parseInt(hex.slice(0,2),16)+', '+parseInt(hex.slice(2,4),16)+', '+parseInt(hex.slice(4,6),16);
}

// ── Main entry ────────────────────────────────────────────────────────────────

function compileSoup(source, file) {
  var warns = [];
  _sShCtr = 0;
  _sInlineHandlers = [];

  resetCtx();
  assignSurfaceTier(source, file);

  // Phase 1: State
  soupParseState(source, warns);

  // Phase 2: Named handlers
  var namedHandlers = soupCollectHandlers(source, warns);

  // Phase 3: JSX
  var jsx = soupExtractReturn(source);
  if (!jsx) return '// soup-smith: no JSX return in ' + file + '\n';

  // Phase 4-5: Tokenize, tree, extract inline handlers
  var tokens = soupTokenize(jsx);
  var tree = soupBuildTree(tokens);
  if (!tree) return '// soup-smith: empty JSX tree in ' + file + '\n';
  soupExtractInlineHandlers(tree, warns);

  // Phase 6: Build Zig tree
  ctx.arrayCounter = 0;
  ctx.arrayDecls = [];
  var rootResult = soupToZig(tree, warns, false);
  var rootExpr = rootResult.str;
  if (!rootExpr) rootExpr = '.{ .style = .{ .width = -1, .height = -1 } }';

  // Ensure root has fullscreen + dark theme
  if (rootExpr.indexOf('.width') < 0 && rootExpr.indexOf('.style = .{') >= 0) {
    rootExpr = rootExpr.replace('.style = .{', '.style = .{ .width = -1, .height = -1, .background_color = Color.rgb(' + _SC.rootBg + '), .padding = 16, ');
  } else if (rootExpr.indexOf('.width') < 0) {
    rootExpr = rootExpr.replace('.{ ', '.{ .style = .{ .width = -1, .height = -1, .background_color = Color.rgb(' + _SC.rootBg + '), .padding = 16, .flex_direction = .column, .gap = 12 }, ');
  } else {
    // Has width already — just ensure background
    if (rootExpr.indexOf('background_color') < 0 && rootExpr.indexOf('.style = .{') >= 0) {
      rootExpr = rootExpr.replace('.style = .{', '.style = .{ .background_color = Color.rgb(' + _SC.rootBg + '), .padding = 16, ');
    }
  }

  // Phase 7: Script block
  var allHandlers = namedHandlers.concat(_sInlineHandlers);
  if (allHandlers.length > 0) {
    var jsLines = [];
    for (var hi = 0; hi < allHandlers.length; hi++) {
      var h = allHandlers[hi];
      jsLines.push('function ' + h.name + '() {');
      jsLines.push('  ' + h.jsBody);
      jsLines.push('}');
    }
    ctx.scriptBlock = jsLines.join('\n');
  }

  // Phase 8: Preflight bypass
  ctx._preflight = {
    ok: true, lane: ctx._sourceTier || 'soup', warnings: warns, errors: [],
    intents: {
      has_state: ctx.stateSlots.length > 0,
      has_script_block: !!ctx.scriptBlock,
      has_dynTexts: ctx.dynCount > 0,
      has_dynColors: false, has_dynStyles: false,
      has_classifiers: false, has_components: false,
      has_maps: false, has_object_arrays: false, has_map_handlers: false,
    },
  };

  return stampIntegrity(emitOutput(rootExpr, file));
}
