// ── JSX element post-attr finalize helpers ───────────────────────

function finalizeElementAttrState(rawTag, clsDef, clsName, state) {
  applyCanvasDerivedFields(rawTag, state.nodeFields);
  applyClassifierDefaults(clsDef, state);
  bindVariantState(clsDef, clsName, state);
  ensureAscriptAutoHandler(rawTag, state);
}

function applyCanvasDerivedFields(rawTag, nodeFields) {
  if (rawTag !== 'Canvas') return;

  const hasDrift = nodeFields.some(f => f.includes('canvas_drift_x') || f.includes('canvas_drift_y'));
  if (hasDrift) nodeFields.push('.canvas_drift_active = true');

  const hasView = nodeFields.some(f => f.includes('canvas_view_x') || f.includes('canvas_view_y') || f.includes('canvas_view_zoom'));
  if (hasView && !nodeFields.some(f => f.includes('canvas_view_set'))) nodeFields.push('.canvas_view_set = true');
}

function applyClassifierDefaults(clsDef, state) {
  if (!clsDef) return;

  state.styleFields = mergeFields(clsStyleFields(clsDef), state.styleFields);
  state.nodeFields = mergeFields(clsNodeFields(clsDef), state.nodeFields);
}

function bindVariantState(clsDef, clsName, state) {
  if (!clsDef || (!clsDef.variants && !clsDef.bp)) return;

  var vStyles = [state.styleFields.filter(function(f) { return !f.startsWith('._'); }).join(', ')];
  var vNodeFields = [state.nodeFields.filter(function(f) { return !f.startsWith('._'); }).join(', ')];
  for (var vi = 0; vi < ctx.variantNames.length; vi++) {
    var vname = ctx.variantNames[vi];
    var vdef = clsDef.variants && clsDef.variants[vname];
    if (vdef) {
      var vFields = mergeFields(clsStyleFields(vdef), state.styleFields.filter(function(f) {
        return !clsStyleFields(clsDef).some(function(cf) { return cf.split('=')[0].trim() === f.split('=')[0].trim(); });
      }));
      vStyles.push(vFields.filter(function(f) { return !f.startsWith('._'); }).join(', '));
      var vnf = mergeFields(clsNodeFields(vdef), state.nodeFields.filter(function(f) {
        return !clsNodeFields(clsDef).some(function(cf) { return cf.split('=')[0].trim() === f.split('=')[0].trim(); });
      }));
      vNodeFields.push(vnf.filter(function(f) { return !f.startsWith('._'); }).join(', '));
    } else {
      vStyles.push(vStyles[0]);
      vNodeFields.push(vNodeFields[0]);
    }
  }

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
    id: vbId,
    clsName: clsName || '',
    styles: vStyles,
    nodeFieldStrs: vNodeFields,
    bpStyles: bpStyles,
    arrName: '',
    arrIndex: -1,
    inMap: !!ctx.currentMap,
    inComponent: !!ctx.inlineComponent,
  });
  state.styleFields._variantBindingId = vbId;
}

function ensureAscriptAutoHandler(rawTag, state) {
  if (rawTag !== 'ascript' || !state.ascriptScript || state.handlerRef) return;

  const handlerName = `_handler_press_${ctx.handlerCount}`;
  const escaped = state.ascriptScript.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  let targetSlot = 0;
  if (state.ascriptOnResult) {
    const slotIndex = findSlot(state.ascriptOnResult);
    if (slotIndex >= 0) targetSlot = slotIndex;
  }

  const body = `    @import("framework/applescript.zig").run("${escaped}", ${targetSlot});\n`;
  ctx.handlers.push({ name: handlerName, body, luaBody: `__applescript("${escaped}")` });
  state.handlerRef = handlerName;
  ctx.handlerCount++;
  if (!ctx.usesApplescript) ctx.usesApplescript = true;
}
