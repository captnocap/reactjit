// ── Nested map parsing ────────────────────────────────────────────

// Nested map: cursor is on field name (e.g. "items" in group.items.map(...))
function tryParseNestedMap(c, nestedOa, fieldName) {
  const header = tryParseMapHeader(c, '_item', '_j');
  if (!header) return null;

  const savedMapCtx = ctx.currentMap;
  const mapInfo = createMapInfo({
    oa: nestedOa,
    itemParam: header.itemParam,
    indexParam: header.indexParam,
    parentMap: savedMapCtx,
    iterVar: '_j',
  }, {
    isNested: true,
    parentMapIdx: savedMapCtx ? ctx.maps.indexOf(savedMapCtx) : -1,
    parentOaIdx: savedMapCtx ? savedMapCtx.oaIdx : -1,
    nestedField: fieldName,
  });
  const mapScope = enterMapContext(mapInfo);

  const templateNode = parseJSXElement(c);

  exitMapContext(mapScope);
  consumeMapClose(c);

  return finalizeMapNode(mapInfo, templateNode);
}
