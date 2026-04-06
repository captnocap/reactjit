function buildNode(tag, styleFields, children, handlerRef, nodeFields, srcTag, srcOffset) {
  // Auto-overflow: any Box with constrained height gets overflow:auto (clips + scrolls when content exceeds)
  // Triggers on explicit height OR flexGrow (height comes from flex distribution, not content).
  // This makes <ScrollView> unnecessary at the authoring level — constrained containers just work.
  // Full-window containers (width:100% + height:100%) get overflow:hidden (clip, don't scroll).
  const _hasConstrainedH = styleFields.some(f => f.startsWith('.height') || f.startsWith('.flex_grow'));
  const _isFullWindow = styleFields.some(f => f === '.height = -1') && styleFields.some(f => f === '.width = -1');
  if (tag === 'Box' && children.length > 0 && !styleFields.some(f => f.startsWith('.overflow')) && _hasConstrainedH) {
    styleFields.push(_isFullWindow ? '.overflow = .hidden' : '.overflow = .auto');
  }
  const parts = [];
  if (styleFields.length > 0) parts.push(`.style = .{ ${styleFields.join(', ')} }`);

  // For Text nodes: if ANY child has a dynamic text, hoist it to the Text node
  // and drop all static text siblings (matches reference compiler behavior)
  if (tag === 'Text') {
    const dynChild = children.find(ch => ch.dynBufId !== undefined);
    const hasGlyphsWithDyn = dynChild && children.some(ch => ch.isGlyph);

    if (hasGlyphsWithDyn) {
      // Split: glyph children become a static text node, dynamic gets its own node.
      // Both sit side-by-side in a row container that inherits the Text styling.
      let glyphText = '';
      const glyphExprs = [];
      for (const ch of children) {
        if (ch.isGlyph) {
          glyphText += '\\x01';
          glyphExprs.push(ch.glyphExpr);
        } else if (!ch.dynBufId && ch.nodeExpr) {
          const m = ch.nodeExpr.match(/\.text = "(.*)"/);
          if (m) glyphText += m[1];
        }
      }
      // Build glyph text node
      var glyphNodeParts = [`.text = "${glyphText}"`];
      glyphNodeParts.push(`.inline_glyphs = &[_]layout.InlineGlyph{ ${glyphExprs.join(', ')} }`);
      if (nodeFields) for (const nf of nodeFields) glyphNodeParts.push(nf);
      var glyphNode = `.{ ${glyphNodeParts.join(', ')} }`;

      // Build dynamic text node
      var dynNodeParts = [dynChild.inMap ? `.text = "__mt${dynChild.dynBufId}__"` : `.text = ""`];
      if (nodeFields) for (const nf of nodeFields) dynNodeParts.push(nf);
      var dynNode = `.{ ${dynNodeParts.join(', ')} }`;

      // Row container with both siblings
      parts.push('.style = .{ .flex_direction = .row, .gap = 0 }');
      const rowExpr = `.{ ${parts.join(', ')}, .children = &[_]Node{ ${glyphNode}, ${dynNode} } }`;
      const result = { nodeExpr: rowExpr, dynBufId: dynChild.dynBufId };
      if (dynChild.inMap) result.inMap = true;
      if (nodeFields && nodeFields._dynColorId !== undefined) result.dynColorId = nodeFields._dynColorId;
      if (nodeFields && nodeFields._dynStyleIds) result.dynStyleIds = nodeFields._dynStyleIds;
      if (nodeFields && nodeFields._dynStyleId !== undefined) result.dynStyleId = nodeFields._dynStyleId;
      if (styleFields._dynStyleIds) result.dynStyleIds = [...(result.dynStyleIds || []), ...styleFields._dynStyleIds];
      if (styleFields._dynStyleId !== undefined) result.dynStyleId = result.dynStyleId || styleFields._dynStyleId;
      return result;
    }

    if (dynChild) {
      parts.push(dynChild.inMap ? `.text = "__mt${dynChild.dynBufId}__"` : `.text = ""`);
      if (nodeFields) for (const nf of nodeFields) parts.push(nf);
      children = [];
      const expr = `.{ ${parts.join(', ')} }`;
      const result = { nodeExpr: expr, dynBufId: dynChild.dynBufId };
      if (dynChild.inMap) result.inMap = true;
      if (nodeFields && nodeFields._dynColorId !== undefined) result.dynColorId = nodeFields._dynColorId;
      if (nodeFields && nodeFields._dynStyleIds) result.dynStyleIds = nodeFields._dynStyleIds;
      if (nodeFields && nodeFields._dynStyleId !== undefined) result.dynStyleId = nodeFields._dynStyleId;
      if (styleFields._dynStyleIds) result.dynStyleIds = [...(result.dynStyleIds || []), ...styleFields._dynStyleIds];
      if (styleFields._dynStyleId !== undefined) result.dynStyleId = result.dynStyleId || styleFields._dynStyleId;
      return result;
    }
    // Single static text child — hoist to .text field
    if (children.length === 1 && !children[0].isGlyph && children[0].nodeExpr && children[0].nodeExpr.includes('.text =')) {
      const m = children[0].nodeExpr.match(/\.text = "(.*)"/);
      if (m) {
        parts.push(`.text = "${m[1]}"`);
        children = [];
      }
    }
    // Inline glyphs: Text with mixed text + <Glyph> children
    const hasGlyphs = children.some(ch => ch.isGlyph);
    if (hasGlyphs && children.length > 0) {
      // Build combined text with \x01 sentinels at glyph positions
      let combinedText = '';
      const glyphExprs = [];
      for (const ch of children) {
        if (ch.isGlyph) {
          combinedText += '\\x01';
          glyphExprs.push(ch.glyphExpr);
        } else if (ch.nodeExpr) {
          const m = ch.nodeExpr.match(/\.text = "(.*)"/);
          if (m) combinedText += m[1];
        }
      }
      parts.push(`.text = "${combinedText}"`);
      parts.push(`.inline_glyphs = &[_]layout.InlineGlyph{ ${glyphExprs.join(', ')} }`);
      children = [];
    }
  }

  // Node-level fields (font_size, text_color, canvas_node, scene3d, etc.)
  if (nodeFields && nodeFields.length > 0) {
    for (const nf of nodeFields) parts.push(nf);
  }

  if (handlerRef) {
    const handler = ctx.handlers.find(h => h.name === handlerRef);
    if (handler && handler.luaBody) {
      // Route decision: js_on_press vs lua_on_press
      // If the app has JS script functions (scriptBlock or scriptContent),
      // ALL handlers use js_on_press to keep JS variables in sync.
      // Otherwise, detect if handler calls non-setter functions → js_on_press.
      // Default: lua_on_press (state setters exist in both runtimes).
      var _useJs = !!(ctx.scriptBlock || globalThis.__scriptContent);
      if (!_useJs) {
        var _luaBodyCalls = handler.luaBody.match(/\b([a-zA-Z_]\w*)\s*\(/g) || [];
        for (var _ci = 0; _ci < _luaBodyCalls.length; _ci++) {
          var _fname = _luaBodyCalls[_ci].replace(/\s*\($/, '');
          var _isLuaAvail = false;
          if (ctx.stateSlots) {
            for (var _si = 0; _si < ctx.stateSlots.length; _si++) {
              if (ctx.stateSlots[_si].setter === _fname) { _isLuaAvail = true; break; }
            }
          }
          if (!_isLuaAvail && ctx.objectArrays) {
            for (var _oi = 0; _oi < ctx.objectArrays.length; _oi++) {
              if (ctx.objectArrays[_oi].setter === _fname) { _isLuaAvail = true; break; }
            }
          }
          if (!_isLuaAvail && /^(print|tostring|tonumber|pcall|setVariant)$/.test(_fname)) _isLuaAvail = true;
          if (!_isLuaAvail) { _useJs = true; break; }
        }
      }
      if (_useJs && handler.jsBody) {
        const jsEscaped = handler.jsBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        parts.push(`.handlers = .{ .js_on_press = "${jsEscaped}" }`);
      } else {
        const escaped = luaTransform(handler.luaBody).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        parts.push(`.handlers = .{ .lua_on_press = "${escaped}" }`);
      }
    } else {
      parts.push(`.handlers = .{ .on_press = handlers.${handlerRef} }`);
    }
  }

  if (children.length > 0) {
    const arrName = `_arr_${ctx.arrayCounter}`;
    ctx.arrayCounter++;
    // Transfer parent layout style fields to map placeholder children
    const layoutFields = styleFields.filter(f =>
      f.startsWith('.gap') || f.startsWith('.flex_direction') || f.startsWith('.flex_wrap') ||
      f.startsWith('.align_items') || f.startsWith('.justify_content'));
    for (let ci = 0; ci < children.length; ci++) {
      if (children[ci].mapIdx !== undefined && layoutFields.length > 0 && children[ci].nodeExpr === '.{}') {
        children[ci].nodeExpr = `.{ .style = .{ ${layoutFields.join(', ')} } }`;
      }
    }
    // Expand subChildren: conditional wrappers that contain spliced children
    for (let sci = 0; sci < children.length; sci++) {
      if (children[sci].subChildren && children[sci].subChildren.length > 0) {
        const subArrName = `_arr_${ctx.arrayCounter}`;
        ctx.arrayCounter++;
        const subExprs = children[sci].subChildren.map(sch => sch.nodeExpr || sch).join(', ');
        ctx.arrayComments.push('');
        ctx.arrayDecls.push(`var ${subArrName} = [_]Node{ ${subExprs} };`);
        // Bind sub-children dynTexts, maps, conditionals to the sub-array
        for (let sj = 0; sj < children[sci].subChildren.length; sj++) {
          const sch = children[sci].subChildren[sj];
          if (sch.dynBufId !== undefined) {
            const dt = ctx.dynTexts.find(d => d.bufId === sch.dynBufId && !!d.inMap === !!sch.inMap);
            if (dt && !dt.arrName) { dt.arrName = subArrName; dt.arrIndex = sj; }
          }
          if (sch.mapIdx !== undefined) {
            const m = ctx.maps[sch.mapIdx];
            if (m) { m.parentArr = subArrName; m.childIdx = sj; }
          }
          if (sch.condIdx !== undefined) {
            const cond = ctx.conditionals[sch.condIdx];
            if (cond) { cond.arrName = subArrName; cond.trueIdx = sj; }
          }
        }
        // Update the wrapper node to include .children
        const wrapperParts = children[sci].nodeExpr.replace(/ \}$/, `, .children = &${subArrName} }`);
        children[sci] = { nodeExpr: wrapperParts, condIdx: children[sci].condIdx, dynBufId: children[sci].dynBufId };
      }
    }
    const childExprs = children.map(ch => ch.nodeExpr || ch).join(', ');
    // Source breadcrumb comment
    if (srcTag && srcOffset !== undefined) {
      const line = offsetToLine(globalThis.__source, srcOffset);
      const fname = (globalThis.__file || '').split('/').pop();
      const tagDisplay = srcTag === '>' ? '<>' : `<${srcTag}>`;
      ctx.arrayComments.push(`// tsz:${fname}:${line} — ${tagDisplay}`);
    } else {
      ctx.arrayComments.push('');
    }
    // Component name comment — on ALL arrays created during inlining
    let compSuffix = '';
    if (ctx.inlineComponent) {
      compSuffix = ` // ${ctx.inlineComponent}`;
    }
    ctx.arrayDecls.push(`var ${arrName} = [_]Node{ ${childExprs} };${compSuffix}`);
    // Bind dynamic texts and conditionals to this array
    for (let i = 0; i < children.length; i++) {
      if (children[i].dynBufId !== undefined) {
        const dt = ctx.dynTexts.find(d => d.bufId === children[i].dynBufId && !!d.inMap === !!children[i].inMap);
        if (dt && !dt.arrName) {
          dt.arrName = arrName;
          dt.arrIndex = i;
        }
      }
      if (children[i].mapIdx !== undefined) {
        const m = ctx.maps[children[i].mapIdx];
        if (m) {
          m.parentArr = arrName;
          m.childIdx = i;
        }
      }
      if (children[i].condIdx !== undefined) {
        const cond = ctx.conditionals[children[i].condIdx];
        if (cond) {
          cond.arrName = arrName;
          cond.trueIdx = i;
        }
      }
      if (children[i].dynColorId !== undefined) {
        const dc = ctx.dynColors[children[i].dynColorId];
        if (dc && !dc.arrName) {
          dc.arrName = arrName;
          dc.arrIndex = i;
        }
      }
      if (children[i].dynStyleId !== undefined) {
        const ds = ctx.dynStyles[children[i].dynStyleId];
        if (ds && !ds.arrName) {
          ds.arrName = arrName;
          ds.arrIndex = i;
        }
      }
      if (children[i].dynStyleIds) {
        for (const dsId of children[i].dynStyleIds) {
          const ds = ctx.dynStyles[dsId];
          if (ds && !ds.arrName) {
            ds.arrName = arrName;
            ds.arrIndex = i;
          }
        }
      }
      if (children[i].ternaryCondIdx !== undefined) {
        const tc = ctx.conditionals[children[i].ternaryCondIdx];
        if (tc) {
          tc.arrName = arrName;
          if (children[i].ternaryBranch === 'true') tc.trueIdx = i;
          else tc.falseIdx = i;
        }
      }
      if (children[i].variantBindingId !== undefined) {
        const vb = ctx.variantBindings[children[i].variantBindingId];
        if (vb && !vb.arrName) {
          vb.arrName = arrName;
          vb.arrIndex = i;
        }
      }
    }
    parts.push(`.children = &${arrName}`);
  }

  const nodeResult = { nodeExpr: `.{ ${parts.join(', ')} }` };
  if (nodeFields && nodeFields._dynColorId !== undefined) nodeResult.dynColorId = nodeFields._dynColorId;
  if (styleFields._dynStyleId !== undefined) nodeResult.dynStyleId = styleFields._dynStyleId;
  // Merge dynStyleIds from both style block and node field ternaries
  const allDynIds = [...(styleFields._dynStyleIds || []), ...((nodeFields && nodeFields._dynStyleIds) || [])];
  if (allDynIds.length > 0) nodeResult.dynStyleIds = allDynIds;
  if (styleFields._variantBindingId !== undefined) nodeResult.variantBindingId = styleFields._variantBindingId;

  // ── Lua node: structured data for lua map emit atoms ──────────────
  // When inside a map context, attach a luaNode so a030 can emit Lua
  // from the parsed tree instead of re-walking tokens.
  if (ctx.currentMap) {
    var _ln = {};
    // Style: parse Zig style fields back to key/value pairs
    if (styleFields.length > 0) {
      _ln.style = {};
      for (var _si = 0; _si < styleFields.length; _si++) {
        var _sf = styleFields[_si];
        // ".key = value" → key, value
        var _eqIdx = _sf.indexOf(' = ');
        if (_eqIdx < 0) continue;
        var _sk = _sf.slice(1, _eqIdx); // strip leading .
        var _sv = _sf.slice(_eqIdx + 3);
        // Color.rgb(r,g,b) → keep as-is for lua_map_style to handle
        // .enum_value → strip leading dot
        if (_sv.charAt(0) === '.') _sv = _sv.slice(1);
        _ln.style[_sk] = _sv;
      }
    }
    // Text: extract from nodeFields or children
    if (nodeFields) {
      for (var _ni = 0; _ni < nodeFields.length; _ni++) {
        var _nf = nodeFields[_ni];
        if (typeof _nf === 'string') {
          if (_nf.startsWith('.font_size = ')) _ln.fontSize = _nf.slice(13);
          if (_nf.startsWith('.text_color = ')) _ln.color = _nf.slice(14);
          if (_nf.startsWith('.text = ')) _ln.text = _nf.slice(8).replace(/^"/, '').replace(/"$/, '');
        }
      }
    }
    // Handler
    if (handlerRef) {
      var _handler = ctx.handlers.find(function(h) { return h.name === handlerRef; });
      if (_handler && _handler.luaBody) _ln.handler = _handler.luaBody;
    }
    // Children: collect luaNodes from child results
    if (children.length > 0) {
      _ln.children = [];
      for (var _ci = 0; _ci < children.length; _ci++) {
        var _ch = children[_ci];
        if (_ch.luaNode) {
          // Conditionals
          if (_ch.condIdx !== undefined && ctx.conditionals[_ch.condIdx]) {
            _ln.children.push({ condition: ctx.conditionals[_ch.condIdx].condExpr, node: _ch.luaNode });
          } else if (_ch.ternaryCondIdx !== undefined && ctx.conditionals[_ch.ternaryCondIdx]) {
            var _tc = ctx.conditionals[_ch.ternaryCondIdx];
            if (_ch.ternaryBranch === 'true') {
              _ln.children.push({ ternaryCondition: _tc.condExpr, trueNode: _ch.luaNode, falseNode: null });
            }
            // false branch gets merged into existing ternary entry
          } else {
            _ln.children.push(_ch.luaNode);
          }
        } else if (_ch.mapIdx !== undefined) {
          // Nested map
          var _m = ctx.maps[_ch.mapIdx];
          if (_m) {
            _ln.children.push({ nestedMap: { field: _m.oa ? _m.oa.getter : '', itemParam: _m.itemParam, indexParam: _m.indexParam, bodyNode: _m._luaBodyNode || null } });
          }
        }
      }
    }
    nodeResult.luaNode = _ln;
  }

  return nodeResult;
}
