function isPageLaneSource(source) {
  return source.indexOf('<page') !== -1 && source.match(/<page\s+route=/);
}

function isChadBlockSource(source) {
  // Match <name widget>, <name page>, <name app>, <name component>,
  // <name lib>, <name effect>, <name glyph>
  return /<\w+\s+(widget|page|app|component|lib|effect|glyph)\s*>/.test(source);
}

function compilePageLane(source, tokens, file) {
  var c = mkCursor(tokens, source);
  resetCtx();
  assignSurfaceTier(source, file);
  return compilePage(source, c, file);
}
