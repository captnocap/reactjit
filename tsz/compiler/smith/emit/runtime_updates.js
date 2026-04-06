// ── Runtime support sections ──
// Dynamic text updates, conditional display toggles, variant patches, dirty tick.

function emitRuntimeSupportSections(ctx, opts) {
  var out = '';
  var promotedToPerItem = opts.promotedToPerItem || new Set();
  var rootExpr = opts.rootExpr || '.{}';
  var prefix = opts.prefix || 'framework/';
  var fastBuild = opts.fastBuild || false;

  var hasConds = ctx.conditionals && ctx.conditionals.length > 0;
  var hasVariants = ctx.variantBindings && ctx.variantBindings.length > 0;
  var hasDynStyles = ctx.dynStyles && ctx.dynStyles.length > 0;
  var hasDynColors = ctx.dynColors && ctx.dynColors.length > 0;
  var hasFlatMaps = ctx.maps && ctx.maps.some(function(m) { return !m.isNested && !m.isInline; });
  var hasLuaMaps = ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0;

  // Dynamic text update function
  if (ctx.dynCount > 0 || (ctx.maps && ctx.maps.some(function(m) { return m._mapDynTexts && m._mapDynTexts.length > 0; }))) {
    out += 'fn _updateDynamicText() void {\n';
    for (var di = 0; di < ctx.dynTexts.length; di++) {
      var dt = ctx.dynTexts[di];
      if (dt.inMap) continue;
      if (!dt.arrName) continue;
      out += '    ' + dt.arrName + '[' + dt.arrIndex + '].text = std.fmt.bufPrint(&_text_buf_' + dt.bufId + ', "' + dt.fmtString + '", .{ ' + dt.fmtArgs + ' }) catch "";\n';
    }
    out += '}\n\n';
  }

  // Conditional display toggles
  if (hasConds) {
    out += 'fn _updateConditionals() void {\n';
    for (var ci = 0; ci < ctx.conditionals.length; ci++) {
      var cond = ctx.conditionals[ci];
      if (!cond.arrName) continue;
      var condExpr = cond.condExpr || 'true';
      if (cond.trueIdx !== undefined) {
        out += '    ' + cond.arrName + '[' + cond.trueIdx + '].style.display = if (' + condExpr + ') .flex else .none;\n';
      }
      if (cond.falseIdx !== undefined) {
        out += '    ' + cond.arrName + '[' + cond.falseIdx + '].style.display = if (!(' + condExpr + ')) .flex else .none;\n';
      }
    }
    out += '}\n\n';
  }

  // Dynamic styles
  if (hasDynStyles) {
    out += 'fn _updateDynamicStyles() void {\n';
    for (var dsi = 0; dsi < ctx.dynStyles.length; dsi++) {
      var ds = ctx.dynStyles[dsi];
      if (!ds.arrName) continue;
      if (ds.isColor) {
        out += '    ' + ds.arrName + '[' + ds.arrIndex + '].style.' + ds.field + ' = ' + ds.expression + ';\n';
      }
    }
    out += '}\n\n';
  }

  // Dynamic colors
  if (hasDynColors) {
    out += 'fn _updateDynamicColors() void {\n';
    for (var dci = 0; dci < ctx.dynColors.length; dci++) {
      var dc = ctx.dynColors[dci];
      if (!dc.arrName) continue;
      out += '    ' + dc.arrName + '[' + dc.arrIndex + '].' + dc.field + ' = ' + dc.expression + ';\n';
    }
    out += '}\n\n';
  }

  // Variant patches
  if (hasVariants) {
    out += emitVariantPatch(ctx, { promotedToPerItem: promotedToPerItem });
  }

  // Dirty tick
  out += 'fn _dirtyTick() void {\n';
  if (ctx.dynCount > 0) out += '    _updateDynamicText();\n';
  if (hasConds) out += '    _updateConditionals();\n';
  if (hasDynStyles) out += '    _updateDynamicStyles();\n';
  if (hasDynColors) out += '    _updateDynamicColors();\n';
  if (hasVariants) out += '    _updateVariants();\n';
  if (hasFlatMaps) {
    out += '    _ = _pool_arena.reset(.retain_capacity);\n';
    for (var mi = 0; mi < ctx.maps.length; mi++) {
      if (ctx.maps[mi].isNested || ctx.maps[mi].isInline) continue;
      out += '    _rebuildMap' + mi + '();\n';
    }
  }
  if (hasLuaMaps) {
    // Re-evaluate data sources, then rebuild all Lua maps
    for (var ldi = 0; ldi < ctx._luaMapRebuilders.length; ldi++) {
      if (ctx._luaMapRebuilders[ldi].isNested) continue;
      var ldSrc = (ctx._luaMapRebuilders[ldi].rawSource || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      out += '    qjs_runtime.evalLuaMapData(' + ldi + ', "' + ldSrc + '");\n';
    }
    out += '    luajit_runtime.callGlobal("__rebuildLuaMaps");\n';
  }
  out += '}\n\n';

  return { out: out, hasConds: hasConds, hasVariants: hasVariants, hasDynStyles: hasDynStyles || hasDynColors, hasFlatMaps: hasFlatMaps };
}
