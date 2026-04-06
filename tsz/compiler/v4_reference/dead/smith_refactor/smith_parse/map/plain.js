// ── Plain .map() parsing ──────────────────────────────────────────

function tryParsePlainMap(c, oa) {
  const header = tryParseMapHeader(c, '_item', '_i');
  if (!header) return null;

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
  });
  const mapScope = enterMapContext(mapInfo);

  const templateNode = parseJSXElement(c);

  exitMapContext(mapScope);
  consumeMapClose(c);

  return finalizeMapNode(mapInfo, templateNode);
}
