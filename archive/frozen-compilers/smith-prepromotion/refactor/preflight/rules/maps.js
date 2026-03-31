// ── Preflight map rules ──────────────────────────────────────────

function checkMapObjectArrays(ctx, errors) {
  for (var mi = 0; mi < ctx.maps.length; mi++) {
    var mapInfo = ctx.maps[mi];
    var oaFound = false;
    for (var oi = 0; oi < ctx.objectArrays.length; oi++) {
      if (ctx.objectArrays[oi].oaIdx === mapInfo.oaIdx) {
        oaFound = true;
        break;
      }
    }
    if (!oaFound) {
      errors.push('F8: map ' + mi + ' references oaIdx ' + mapInfo.oaIdx + ' but no such objectArray exists');
    }
  }
}
