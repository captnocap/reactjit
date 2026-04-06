// ── Preflight dynText/dynStyle rules ─────────────────────────────

function checkColorPlaceholders(ctx, scan, errors, warnings) {
  var orphanColors = ctx._orphanColors ? ctx._orphanColors.length : 0;
  if (orphanColors > 0) {
    var details = ctx._orphanColors.slice(0, 3).map(function(o) { return o.field + '=' + o.value; }).join(', ');
    errors.push('F4: ' + orphanColors + ' Color{} placeholder(s) with no dynStyle/dynColor runtime fix (' + details + ')');
  }

  var backedColorCount = 0;
  for (var di = 0; di < scan.allDecls.length; di++) {
    var idx = 0;
    while (true) {
      var pos = scan.allDecls[di].indexOf('Color{}', idx);
      if (pos < 0) break;
      backedColorCount++;
      idx = pos + 7;
    }
  }
  backedColorCount = backedColorCount - orphanColors;
  if (backedColorCount > 0) {
    warnings.push('W1: ' + backedColorCount + ' Color{} placeholder(s) (all resolved via dynStyle/dynColor)');
  }
}

function checkObjectArrayFieldReferences(ctx, scan, warnings) {
  for (var di = 0; di < scan.allDecls.length; di++) {
    var oaRefs = scan.allDecls[di].match(/_oa(\d+)_(\w+)/g);
    if (!oaRefs) continue;
    for (var ri = 0; ri < oaRefs.length; ri++) {
      var refMatch = oaRefs[ri].match(/_oa(\d+)_(\w+)/);
      if (!refMatch) continue;
      var oaIdx = parseInt(refMatch[1]);
      var fieldName = refMatch[2];
      if (fieldName === 'len' || fieldName.endsWith('_lens')) continue;
      var oa = null;
      for (var oi = 0; oi < ctx.objectArrays.length; oi++) {
        if (ctx.objectArrays[oi].oaIdx === oaIdx) {
          oa = ctx.objectArrays[oi];
          break;
        }
      }
      if (oa && !oa.fields.some(function(f) { return f.name === fieldName; })) {
        oa.fields.push({ name: fieldName, type: 'int' });
        warnings.push('F5: auto-added field "' + fieldName + '" to OA[' + oaIdx + '] (referenced in template but missing from useState schema)');
      }
    }
  }
}

function checkUnresolvedDynTexts(ctx, errors) {
  for (var di = 0; di < ctx.dynTexts.length; di++) {
    var dt = ctx.dynTexts[di];
    if (!dt.fmtString) continue;
    var unresolvedMatch = dt.fmtString.match(/\$\{[a-zA-Z_]\w+\}/);
    if (unresolvedMatch) {
      errors.push('F6: dynText buf ' + dt.bufId + ' has unresolved template literal: "' + dt.fmtString.substring(0, 60) + '"');
    }
  }
}

function checkItemReferenceLeaks(ctx, scan, errors, warnings) {
  for (var dti = 0; dti < ctx.dynTexts.length; dti++) {
    var dt = ctx.dynTexts[dti];
    if (dt.inMap) continue;
    var args = dt.fmtArgs || '';
    if (args.indexOf('item.') >= 0 || args.indexOf('item)') >= 0) {
      errors.push('F17: dynText buf ' + dt.bufId + ' references "item" outside of a map — will fail with undeclared identifier');
    }
  }

  for (var ci2 = 0; ci2 < ctx.conditionals.length; ci2++) {
    var cond = ctx.conditionals[ci2];
    if (cond.condExpr && cond.condExpr.indexOf('item.') >= 0) {
      errors.push('F17: conditional references unresolved "item.' + (cond.condExpr.match(/item\.(\w+)/) || ['','?'])[1] + '" — should be OA field accessor');
    }
  }

  for (var adi = 0; adi < scan.allDecls.length; adi++) {
    if (/\bitem\.\w+/.test(scan.allDecls[adi]) && !/\\\\/.test(scan.allDecls[adi])) {
      var itemField = scan.allDecls[adi].match(/\bitem\.(\w+)/);
      warnings.push('F17: array decl references unresolved "item.' + (itemField ? itemField[1] : '?') + '" — Zig has no "item" variable (may be JS handler body)');
    }
  }
}
