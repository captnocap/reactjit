// ── JSX canvas and graph attr helpers ────────────────────────────

function tryParseCanvasAttr(c, attr, rawTag, nodeFields) {
  if (attr === 'd' && (rawTag === 'Graph.Path' || rawTag === 'Canvas.Path')) {
    parseCanvasPathDataAttr(c, nodeFields);
    return true;
  }

  if (attr === 'fill' && (rawTag === 'Graph.Path' || rawTag === 'Canvas.Path')) {
    parseCanvasColorAttr(c, nodeFields, 'canvas_fill_color');
    return true;
  }

  if (attr === 'stroke' && (rawTag === 'Graph.Path' || rawTag === 'Canvas.Path')) {
    parseCanvasColorAttr(c, nodeFields, 'text_color');
    return true;
  }

  if (attr === 'strokeWidth' && (rawTag === 'Graph.Path' || rawTag === 'Canvas.Path')) {
    const value = parseNumericAttrValue(c, false);
    if (value !== null) nodeFields.push(`.canvas_stroke_width = ${value}`);
    return true;
  }

  if (attr === 'flowSpeed' && (rawTag === 'Graph.Path' || rawTag === 'Canvas.Path')) {
    const value = parseNumericAttrValue(c, true);
    if (value !== null) nodeFields.push(`.canvas_flow_speed = ${value}`);
    return true;
  }

  if (attr === 'fillEffect' && (rawTag === 'Graph.Path' || rawTag === 'Canvas.Path')) {
    if (c.kind() === TK.string) {
      nodeFields.push(`.canvas_fill_effect = "${c.text().slice(1, -1)}"`);
      c.advance();
    } else if (c.kind() === TK.lbrace) {
      skipBraces(c);
    }
    return true;
  }

  if (attr === 'viewZoom') {
    const value = parseNumericAttrValue(c, false);
    if (value !== null) {
      nodeFields.push(`.canvas_view_zoom = ${value}`);
      nodeFields.push('.canvas_view_set = true');
    }
    return true;
  }

  if (attr === 'viewX') {
    const value = parseNumericAttrValue(c, true);
    if (value !== null) nodeFields.push(`.canvas_view_x = ${value}`);
    return true;
  }

  if (attr === 'viewY') {
    const value = parseNumericAttrValue(c, true);
    if (value !== null) nodeFields.push(`.canvas_view_y = ${value}`);
    return true;
  }

  if (attr === 'driftX' && rawTag === 'Canvas') {
    const value = parseNumericAttrValue(c, true);
    if (value !== null) nodeFields.push(`.canvas_drift_x = ${value}`);
    return true;
  }

  if (attr === 'driftY' && rawTag === 'Canvas') {
    const value = parseNumericAttrValue(c, true);
    if (value !== null) nodeFields.push(`.canvas_drift_y = ${value}`);
    return true;
  }

  if ((attr === 'x' || attr === 'gx') && (rawTag === 'Canvas.Node' || rawTag === 'Graph.Node')) {
    parseCanvasNodeAxisAttr(c, nodeFields, 'canvas_gx');
    return true;
  }

  if ((attr === 'y' || attr === 'gy') && (rawTag === 'Canvas.Node' || rawTag === 'Graph.Node')) {
    parseCanvasNodeAxisAttr(c, nodeFields, 'canvas_gy');
    return true;
  }

  if ((attr === 'w' || attr === 'gw') && (rawTag === 'Canvas.Node' || rawTag === 'Graph.Node')) {
    const value = parseNumericAttrValue(c, false);
    if (value !== null) nodeFields.push(`.canvas_gw = ${value}`);
    return true;
  }

  if ((attr === 'h' || attr === 'gh') && (rawTag === 'Canvas.Node' || rawTag === 'Graph.Node')) {
    const value = parseNumericAttrValue(c, false);
    if (value !== null) nodeFields.push(`.canvas_gh = ${value}`);
    return true;
  }

  if (attr === 'gx' && rawTag === 'Canvas.Node') {
    parseLegacyCanvasNodeAxisAttr(c, nodeFields, 'canvas_gx');
    return true;
  }

  if (attr === 'gy' && rawTag === 'Canvas.Node') {
    parseLegacyCanvasNodeAxisAttr(c, nodeFields, 'canvas_gy');
    return true;
  }

  if (attr === 'gw' && rawTag === 'Canvas.Node') {
    const value = parseNumericAttrValue(c, false);
    if (value !== null) nodeFields.push(`.canvas_gw = ${value}`);
    return true;
  }

  if (attr === 'gh' && rawTag === 'Canvas.Node') {
    const value = parseNumericAttrValue(c, false);
    if (value !== null) nodeFields.push(`.canvas_gh = ${value}`);
    return true;
  }

  return false;
}

function parseCanvasPathDataAttr(c, nodeFields) {
  if (c.kind() === TK.string) {
    nodeFields.push(`.canvas_path_d = "${c.text().slice(1, -1)}"`);
    c.advance();
    return;
  }

  if (c.kind() !== TK.lbrace) return;

  c.advance();
  if (c.kind() === TK.identifier && ctx.currentMap && c.text() === ctx.currentMap.itemParam) {
    c.advance();
    if (c.kind() === TK.dot) {
      c.advance();
      const fieldName = c.text();
      c.advance();
      if (!ctx.currentMap._deferredCanvasAttrs) ctx.currentMap._deferredCanvasAttrs = [];
      ctx.currentMap._deferredCanvasAttrs.push({ zigField: 'canvas_path_d', oaField: fieldName, type: 'string' });
    }
  } else {
    const dTokens = [];
    let dDepth = 0;
    while (c.kind() !== TK.eof) {
      if (c.kind() === TK.lbrace) dDepth++;
      if (c.kind() === TK.rbrace) {
        if (dDepth === 0) break;
        dDepth--;
      }
      dTokens.push(c.text());
      c.advance();
    }
    if (dTokens.length > 0) {
      const jsExpr = dTokens.join(' ').replace(/\bexact\b/g, '===');
      const slotIdx = ctx.stateSlots.length;
      ctx.stateSlots.push({ getter: '__jsExpr_' + slotIdx, setter: '__setJsExpr_' + slotIdx, initial: '', type: 'string' });
      const bufId = ctx.dynCount;
      ctx.dynTexts.push({ bufId, fmtString: '{s}', fmtArgs: 'state.getSlotString(' + slotIdx + ')', arrName: '', arrIndex: 0, bufSize: 256, targetField: 'canvas_path_d' });
      ctx.dynCount++;
      ctx._jsDynTexts.push({ slotIdx, jsExpr });
    }
  }

  if (c.kind() === TK.rbrace) c.advance();
}

function parseCanvasColorAttr(c, nodeFields, zigField) {
  if (c.kind() === TK.string) {
    nodeFields.push(`.${zigField} = ${parseColor(c.text().slice(1, -1))}`);
    c.advance();
  } else if (c.kind() === TK.lbrace) {
    skipBraces(c);
  }
}

function parseCanvasNodeAxisAttr(c, nodeFields, zigField) {
  if (c.kind() === TK.lbrace) {
    c.advance();
    const numberValue = parseSignedNumberToken(c);
    if (numberValue !== null) {
      nodeFields.push(`.${zigField} = ${numberValue}`);
    } else if (c.kind() === TK.identifier) {
      // Const OA bracket access: nodes[0].field
      var _canvOa = resolveConstOaAccess(c);
      if (_canvOa) {
        nodeFields.push('.' + zigField + ' = ' + _canvOa.value);
        for (var _cski = 1; _cski < _canvOa.skip; _cski++) c.advance();
      } else {
        const valueName = c.text();
        // Render local with .field (const OA row ref)
        if (ctx.renderLocals && ctx.renderLocals[valueName] !== undefined &&
            typeof ctx.renderLocals[valueName] === 'string' && ctx.renderLocals[valueName].charCodeAt(0) === 1 &&
            c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
          var _cvFld = resolveConstOaFieldFromRef(ctx.renderLocals[valueName], c.textAt(c.pos + 2));
          if (_cvFld !== null) {
            nodeFields.push('.' + zigField + ' = ' + _cvFld);
            c.advance(); c.advance(); // skip name and dot
          }
        } else {
          c.advance();
          const slotIdx = ctx.stateSlots.findIndex(function(s) { return s.getter === valueName; });
          if (slotIdx >= 0) {
            ctx._dynStyles.push({ arrIdx: -1, childIdx: -1, field: zigField, slotIdx, isTernary: false });
          } else if (ctx.renderLocals && ctx.renderLocals[valueName] !== undefined) {
            // Plain render local (numeric value)
            nodeFields.push('.' + zigField + ' = ' + ctx.renderLocals[valueName]);
          }
        }
      }
    }
    if (c.kind() === TK.rbrace) c.advance();
    return;
  }

  if (c.kind() === TK.number) {
    nodeFields.push(`.${zigField} = ${c.text()}`);
    c.advance();
  }
}

function parseLegacyCanvasNodeAxisAttr(c, nodeFields, zigField) {
  if (c.kind() === TK.lbrace) {
    c.advance();
    const numberValue = parseSignedNumberToken(c);
    if (numberValue !== null) {
      nodeFields.push(`.${zigField} = ${numberValue}`);
    } else if (c.kind() === TK.identifier && ctx.currentMap && c.text() === ctx.currentMap.itemParam) {
      c.advance();
      if (c.kind() === TK.dot) {
        c.advance();
        const fieldName = c.text();
        c.advance();
        if (!ctx.currentMap._deferredCanvasAttrs) ctx.currentMap._deferredCanvasAttrs = [];
        ctx.currentMap._deferredCanvasAttrs.push({ zigField, oaField: fieldName });
      }
    }
    if (c.kind() === TK.rbrace) c.advance();
    return;
  }

  if (c.kind() === TK.number) {
    nodeFields.push(`.${zigField} = ${c.text()}`);
    c.advance();
  }
}
