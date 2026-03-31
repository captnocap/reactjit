// ── JSX parser ──

function resolveTag(name) { return htmlTags[name] || name; }

function parseJSXElement(c) {
  if (c.kind() !== TK.lt) return { nodeExpr: '.{}' };
  c.advance(); // <

  const fragmentNode = tryParseFragmentElement(c);
  if (fragmentNode) return fragmentNode;

  let rawTag = c.text();
  c.advance();
  // Handle <3D...> — lexer tokenizes "3" (number) + "D" (identifier)
  if (rawTag === '3' && c.kind() === TK.identifier && c.text() === 'D') {
    rawTag = '3D';
    c.advance();
  }

  if (rawTag === 'script') return skipScriptElement(c);

  const normalizedTag = normalizeRawTag(c, rawTag);
  rawTag = normalizedTag.rawTag;
  let clsDef = normalizedTag.clsDef;
  let clsName = normalizedTag.clsName;

  // Check if this is a component call
  const comp = findComponent(rawTag);
  if (globalThis.__SMITH_DEBUG_INLINE && comp) {
    globalThis.__dbg = globalThis.__dbg || [];
    globalThis.__dbg.push('[INLINE] component=' + rawTag + ' bodyPos=' + comp.bodyPos + ' cursorPos=' + c.pos);
    if (rawTag === 'SourcePage' && !globalThis.__sourcePageDumped) {
      globalThis.__sourcePageDumped = true;
      for (let di = comp.bodyPos; di < Math.min(comp.bodyPos + 15, c.count); di++) {
        globalThis.__dbg.push('[SP_TOK@' + di + '] kind=' + c.kindAt(di) + ' text="' + c.textAt(di).substring(0, 40) + '"');
      }
    }
  }
  if (comp) {
    const propValues = collectComponentPropValues(c);
    const compChildren = parseComponentCallChildren(c);
    return inlineComponentCall(c, comp, rawTag, propValues, compChildren);
  }

  const tag = resolveTag(rawTag);
  // Track source position for breadcrumb comments
  const tagSrcOffset = c.starts[c.pos > 0 ? c.pos - 1 : 0];

  let elementState = initElementParseState(rawTag, tag);
  const attrState = {
    styleFields: elementState.styleFields,
    nodeFields: elementState.nodeFields,
    ascriptScript: elementState.ascriptScript,
    ascriptOnResult: elementState.ascriptOnResult,
    handlerRef: elementState.handlerRef,
  };
  const effectiveTag = elementState.effectiveTag;

  while (c.kind() !== TK.gt && c.kind() !== TK.slash_gt && c.kind() !== TK.eof) {
    if (c.kind() === TK.identifier) {
      const attr = c.text();
      c.advance();
      if (c.kind() === TK.equals) {
        c.advance();
        parseElementAttr(c, attr, rawTag, attrState);
      }
    } else { c.advance(); }
  }

  let styleFields = attrState.styleFields;
  let nodeFields = attrState.nodeFields;
  let ascriptScript = attrState.ascriptScript;
  let ascriptOnResult = attrState.ascriptOnResult;
  let handlerRef = attrState.handlerRef;

  // Canvas: set drift_active when drift attrs present (enables auto-stacker + drift animation)
  if (rawTag === 'Canvas') {
    const hasDrift = nodeFields.some(f => f.includes('canvas_drift_x') || f.includes('canvas_drift_y'));
    if (hasDrift) nodeFields.push('.canvas_drift_active = true');
    // view_set is already emitted by viewZoom handler — only add if missing
    const hasView = nodeFields.some(f => f.includes('canvas_view_x') || f.includes('canvas_view_y') || f.includes('canvas_view_zoom'));
    if (hasView && !nodeFields.some(f => f.includes('canvas_view_set'))) nodeFields.push('.canvas_view_set = true');
  }

  // Merge classifier defaults (inline attrs win)
  if (clsDef) {
    styleFields = mergeFields(clsStyleFields(clsDef), styleFields);
    nodeFields = mergeFields(clsNodeFields(clsDef), nodeFields);
  }

  // Variant/bp binding — track nodes that need runtime style switching
  if (clsDef && (clsDef.variants || clsDef.bp)) {
    // Build style arrays for each variant: [base, variant1, variant2, ...]
    // Base style is what's already merged into styleFields (cls defaults + inline overrides)
    var vStyles = [styleFields.filter(function(f) { return !f.startsWith('._'); }).join(', ')];
    var vNodeFields = [nodeFields.filter(function(f) { return !f.startsWith('._'); }).join(', ')];
    for (var vi = 0; vi < ctx.variantNames.length; vi++) {
      var vname = ctx.variantNames[vi];
      var vdef = clsDef.variants && clsDef.variants[vname];
      if (vdef) {
        // Merge: variant style base + inline overrides (inline still wins)
        var vFields = mergeFields(clsStyleFields(vdef), styleFields.filter(function(f) {
          // only keep truly inline fields (not from base classifier)
          return !clsStyleFields(clsDef).some(function(cf) { return cf.split('=')[0].trim() === f.split('=')[0].trim(); });
        }));
        vStyles.push(vFields.filter(function(f) { return !f.startsWith('._'); }).join(', '));
        var vnf = mergeFields(clsNodeFields(vdef), nodeFields.filter(function(f) {
          return !clsNodeFields(clsDef).some(function(cf) { return cf.split('=')[0].trim() === f.split('=')[0].trim(); });
        }));
        vNodeFields.push(vnf.filter(function(f) { return !f.startsWith('._'); }).join(', '));
      } else {
        // This classifier entry doesn't define this variant — use base
        vStyles.push(vStyles[0]);
        vNodeFields.push(vNodeFields[0]);
      }
    }
    // Breakpoint overrides: {sm: styleStr, md: styleStr}
    var bpStyles = null;
    if (clsDef.bp) {
      bpStyles = {};
      var bpTiers = ['sm', 'md'];
      for (var bi = 0; bi < bpTiers.length; bi++) {
        var bpDef = clsDef.bp[bpTiers[bi]];
        if (bpDef) {
          var bpFields = mergeFields(clsStyleFields(bpDef), []);
          bpStyles[bpTiers[bi]] = bpFields.filter(function(f) { return !f.startsWith('._'); }).join(', ');
        }
      }
    }
    var vbId = ctx.variantBindings.length;
    ctx.variantBindings.push({
      id: vbId, clsName: clsName || '',
      styles: vStyles,         // [baseStr, v1Str, v2Str, ...]
      nodeFieldStrs: vNodeFields,
      bpStyles: bpStyles,      // {sm: str, md: str} or null
      arrName: '', arrIndex: -1,
      inMap: !!ctx.currentMap,
      inComponent: !!ctx.inlineComponent,
    });
    // Attach binding ID to styleFields so it propagates to node result
    styleFields._variantBindingId = vbId;
  }

  // <ascript> auto-handler: generates a press handler that runs AppleScript
  if (rawTag === 'ascript' && ascriptScript && !handlerRef) {
    const handlerName = `_handler_press_${ctx.handlerCount}`;
    const escaped = ascriptScript.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    let targetSlot = 0;
    if (ascriptOnResult) {
      const si = findSlot(ascriptOnResult);
      if (si >= 0) targetSlot = si;
    }
    // Async: spawns background thread, result delivered via pollResult() in tick
    const body = `    @import("framework/applescript.zig").run("${escaped}", ${targetSlot});\n`;
    ctx.handlers.push({ name: handlerName, body, luaBody: `__applescript("${escaped}")` });
    handlerRef = handlerName;
    ctx.handlerCount++;
    // Mark that this app uses applescript (for tick polling)
    if (!ctx.usesApplescript) ctx.usesApplescript = true;
  }

  return finishParsedElement(c, rawTag, effectiveTag, styleFields, null, handlerRef, nodeFields, clsDef, tagSrcOffset);
}

function parseChildren(c) {
  const children = [];
  while (c.kind() !== TK.lt_slash && c.kind() !== TK.eof) {
    if (tryParseElementChild(c, children)) continue;
    if (tryParseBraceChild(c, children)) continue;
    if (tryParseTextChild(c, children)) continue;
  }
  return children;
}



// Parse <Glyph d="..." fill="#color" fillEffect="name" /> inside <Text>
// Returns a glyph marker child node or null
function parseInlineGlyph(c) {
  if (c.kind() !== TK.lt) return null;
  c.advance(); // skip <
  if (c.text() !== 'Glyph') return null;
  c.advance(); // skip Glyph
  let d = '', fill = '#ffffff', fillEffect = '', stroke = '', strokeWidth = '0', scale = '1.0';
  while (c.kind() === TK.identifier && c.kind() !== TK.eof) {
    const aname = c.text(); c.advance();
    if (c.kind() !== TK.equals) continue;
    c.advance(); // skip =
    let aval = '';
    if (c.kind() === TK.string) { aval = c.text().slice(1, -1); c.advance(); }
    else if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.identifier || c.kind() === TK.number) { aval = c.text(); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
    else { aval = c.text(); c.advance(); }
    if (aname === 'd') d = aval;
    else if (aname === 'fill') fill = aval;
    else if (aname === 'fillEffect') fillEffect = aval;
    else if (aname === 'stroke') stroke = aval;
    else if (aname === 'strokeWidth') strokeWidth = aval;
    else if (aname === 'scale') scale = aval;
  }
  // Skip /> or >
  if (c.kind() === TK.slash_gt) c.advance();
  else if (c.kind() === TK.gt) c.advance();
  const fillColor = fill.startsWith('#') ? parseColor(fill) : 'Color.rgb(255, 255, 255)';
  const strokeColor = stroke ? (stroke.startsWith('#') ? parseColor(stroke) : 'Color.rgba(0, 0, 0, 0)') : 'Color.rgba(0, 0, 0, 0)';
  const fillEffectStr = fillEffect ? `, .fill_effect = "${fillEffect}"` : '';
  const glyphExpr = `.{ .d = "${d}", .fill = ${fillColor}, .stroke = ${strokeColor}, .stroke_width = ${strokeWidth}, .scale = ${scale}${fillEffectStr} }`;
  return { nodeExpr: '.{ .text = "\\x01" }', isGlyph: true, glyphExpr };
}
