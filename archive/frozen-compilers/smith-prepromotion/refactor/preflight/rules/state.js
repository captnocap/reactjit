// ── Preflight state rules ────────────────────────────────────────

function warnOnUnreadStateSlots(ctx, scan, warnings) {
  for (var si = 0; si < ctx.stateSlots.length; si++) {
    var slot = ctx.stateSlots[si];
    var getterUsed = false;
    for (var hi = 0; hi < ctx.handlers.length && !getterUsed; hi++) {
      var hb = ctx.handlers[hi].body || '';
      if (hb.indexOf('getSlot(' + si + ')') >= 0 || hb.indexOf('getSlotString(' + si + ')') >= 0 ||
          hb.indexOf('getSlotFloat(' + si + ')') >= 0 || hb.indexOf('getSlotBool(' + si + ')') >= 0) {
        getterUsed = true;
      }
    }
    for (var di = 0; di < ctx.dynTexts.length && !getterUsed; di++) {
      var dt = ctx.dynTexts[di];
      if (dt.fmtArgs && dt.fmtArgs.indexOf('getSlot') >= 0 && dt.fmtArgs.indexOf(String(si)) >= 0) {
        getterUsed = true;
      }
    }
    if (ctx.dynStyles) {
      for (var dsi = 0; dsi < ctx.dynStyles.length && !getterUsed; dsi++) {
        if (ctx.dynStyles[dsi].expression && ctx.dynStyles[dsi].expression.indexOf('getSlot') >= 0) {
          getterUsed = true;
        }
      }
    }
    for (var ai = 0; ai < scan.allDecls.length && !getterUsed; ai++) {
      if (scan.allDecls[ai].indexOf('getSlot(' + si + ')') >= 0 || scan.allDecls[ai].indexOf('getSlotString(' + si + ')') >= 0 ||
          scan.allDecls[ai].indexOf('getSlotFloat(' + si + ')') >= 0 || scan.allDecls[ai].indexOf('getSlotBool(' + si + ')') >= 0) {
        getterUsed = true;
      }
    }
    if (!getterUsed) {
      warnings.push('W3: state slot ' + si + ' (' + slot.getter + '/' + slot.setter + ') declared but getter never read');
    }
  }
}
