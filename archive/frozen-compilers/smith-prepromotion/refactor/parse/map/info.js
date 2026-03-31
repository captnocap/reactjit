// ── Shared map info construction ──────────────────────────────────

function createMapInfo(base, extras) {
  var mapInfo = {
    oaIdx: base.oa.oaIdx,
    itemParam: base.itemParam,
    indexParam: base.indexParam,
    oa: base.oa,
    textsInMap: [],
    innerCount: 0,
    parentArr: '',
    childIdx: 0,
    mapArrayDecls: [],
    mapArrayComments: [],
    parentMap: base.parentMap || null,
    iterVar: base.iterVar || '_i',
  };

  if (extras) {
    for (var key in extras) mapInfo[key] = extras[key];
  }

  return mapInfo;
}
