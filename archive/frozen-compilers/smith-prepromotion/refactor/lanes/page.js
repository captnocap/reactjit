function isPageLaneSource(source) {
  return source.indexOf('<page') !== -1 && source.match(/<page\s+route=/);
}

function compilePageLane(source, tokens, file) {
  var c = mkCursor(tokens, source);
  resetCtx();
  assignSurfaceTier(source, file);
  return compilePage(source, c, file);
}
