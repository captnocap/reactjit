// ── Plain .map() parsing ──────────────────────────────────────────

function _attachMapRenderLocalAliases(mapInfo, oa, header) {
  if (!header || !header.renderLocalAliases) return;
  const iv = mapInfo.iterVar || '_i';
  mapInfo.renderLocalAliases = {};
  for (const alias of Object.keys(header.renderLocalAliases)) {
    const fieldName = header.renderLocalAliases[alias];
    const fieldInfo = oa.fields.find(function(f) { return f.name === fieldName; });
    if (!fieldInfo) continue;
    if (fieldInfo.type === 'string') {
      mapInfo.renderLocalAliases[alias] = `_oa${oa.oaIdx}_${fieldName}[${iv}][0.._oa${oa.oaIdx}_${fieldName}_lens[${iv}]]`;
    } else {
      mapInfo.renderLocalAliases[alias] = `_oa${oa.oaIdx}_${fieldName}[${iv}]`;
    }
  }
}

function tryParsePlainMap(c, oa, headerOverride) {
  const parsedHeader = tryParseMapHeader(c, '_item', '_i');
  if (!parsedHeader) return null;
  const header = headerOverride || parsedHeader;

  const savedMapCtx = ctx.currentMap;
  const isInline = !!(savedMapCtx && savedMapCtx.oaIdx !== oa.oaIdx);
  const mapInfo = createMapInfo({
    oa,
    itemParam: header.itemParam,
    indexParam: header.indexParam,
    parentMap: savedMapCtx,
    iterVar: isInline ? '_j' : '_i',
  }, {
    isInline,
    filterConditions: header.filterConditions.length > 0 ? header.filterConditions : undefined,
  });
  _attachMapRenderLocalAliases(mapInfo, oa, header);
  const mapScope = enterMapContext(mapInfo);

  const templateNode = parseJSXElement(c);

  exitMapContext(mapScope);
  consumeMapClose(c);

  return finalizeMapNode(mapInfo, templateNode);
}

function tryParsePlainMapFromMethod(c, oa, headerOverride) {
  const parsedHeader = tryParseMapHeaderFromMethod(c, '_item', '_i');
  if (!parsedHeader) return null;
  const header = headerOverride || parsedHeader;

  const savedMapCtx = ctx.currentMap;
  const isInline = !!(savedMapCtx && savedMapCtx.oaIdx !== oa.oaIdx);
  const mapInfo = createMapInfo({
    oa,
    itemParam: header.itemParam,
    indexParam: header.indexParam,
    parentMap: savedMapCtx,
    iterVar: isInline ? '_j' : '_i',
  }, {
    isInline,
    filterConditions: header.filterConditions.length > 0 ? header.filterConditions : undefined,
  });
  _attachMapRenderLocalAliases(mapInfo, oa, header);
  const mapScope = enterMapContext(mapInfo);

  const templateNode = parseJSXElement(c);

  exitMapContext(mapScope);
  consumeMapClose(c);

  return finalizeMapNode(mapInfo, templateNode);
}
