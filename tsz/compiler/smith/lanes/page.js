function isPageLaneSource(source) {
  return source.indexOf('<page') !== -1 && source.match(/<page\s+route=/);
}

function isChadBlockSource(source) {
  // Match <name widget>, <name page>, <name app>, <name component>
  return /<\w+\s+(widget|page|app|component)\s*>/.test(source);
}

function compilePageLane(source, tokens, file) {
  var c = mkCursor(tokens, source);
  resetCtx();
  assignSurfaceTier(source, file);
  return compilePage(source, c, file);
}
