// ── Map context helpers ───────────────────────────────────────────

function enterMapContext(mapInfo) {
  const scope = {
    currentMap: ctx.currentMap,
    arrayDecls: ctx.arrayDecls,
    arrayComments: ctx.arrayComments,
    renderLocals: ctx.renderLocals,
  };

  // Reserve a stable map slot before template parsing so nested maps get
  // higher indices without shifting the current map.
  mapInfo.mapIdx = ctx.maps.length;
  ctx.maps.push(mapInfo);
  ctx.currentMap = mapInfo;

  mapInfo._topArrayDecls = scope.arrayDecls;
  mapInfo._topArrayComments = scope.arrayComments;
  ctx.arrayDecls = mapInfo.mapArrayDecls;
  ctx.arrayComments = mapInfo.mapArrayComments;
  if (mapInfo.renderLocalAliases && Object.keys(mapInfo.renderLocalAliases).length > 0) {
    ctx.renderLocals = Object.assign({}, ctx.renderLocals, mapInfo.renderLocalAliases);
  }

  return scope;
}

function exitMapContext(scope) {
  ctx.arrayDecls = scope.arrayDecls;
  ctx.arrayComments = scope.arrayComments;
  ctx.renderLocals = scope.renderLocals;
  ctx.currentMap = scope.currentMap;
}

function consumeMapClose(c) {
  if (c.kind() === TK.rparen) c.advance(); // close paren around JSX or return(...)
  if (c.kind() === TK.semicolon) c.advance(); // optional ; after return
  if (c.kind() === TK.rbrace) c.advance(); // close function body }
  if (c.kind() === TK.rparen) c.advance(); // close .map(...)
}

function finalizeMapNode(mapInfo, templateNode) {
  mapInfo.templateExpr = templateNode.nodeExpr;
  if (templateNode.luaNode) mapInfo._luaBodyNode = templateNode.luaNode;
  return { nodeExpr: '.{}', mapIdx: mapInfo.mapIdx, templateNodeExpr: templateNode.nodeExpr, luaNode: templateNode.luaNode || null };
}
