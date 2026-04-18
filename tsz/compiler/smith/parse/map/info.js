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

  smithTraceEnsureEntity(mapInfo, 'map', {
    label: (mapInfo.oa && mapInfo.oa.getter ? mapInfo.oa.getter : 'map') + '.map',
    meta: {
      oa: mapInfo.oa && mapInfo.oa.getter ? mapInfo.oa.getter : '',
      oaIdx: mapInfo.oaIdx,
      itemParam: mapInfo.itemParam,
      indexParam: mapInfo.indexParam,
      nested: !!mapInfo.isNested,
      inline: !!mapInfo.isInline,
    },
  });
  smithTraceMutation(mapInfo, 'parse.create_map', (mapInfo.oa && mapInfo.oa.getter ? mapInfo.oa.getter : 'map') + '.map', {
    data: {
      itemParam: mapInfo.itemParam,
      indexParam: mapInfo.indexParam,
      nested: !!mapInfo.isNested,
      inline: !!mapInfo.isInline,
    },
  });
  return mapInfo;
}
