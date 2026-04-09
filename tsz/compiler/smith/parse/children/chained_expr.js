// ── Child parsing: chained method expressions ────────────────────
// Handles bare identifier.method() chains that appear outside braces.
// e.g. items.filter().sort().map() where the { was consumed upstream.
//
// This is an EXPLICIT dispatcher, not a fallback. It fires in
// parseChildren between tryParseBraceChild and tryParseTextChild.
// tryParseTextChild NEVER re-dispatches to other parsers.

function tryParseChainedExpr(c, children) {
  // Must start with identifier followed by dot — that's a chain, not text
  if (c.kind() !== TK.identifier) return false;
  if (c.pos + 1 >= c.count || c.kindAt(c.pos + 1) !== TK.dot) return false;

  // Check if this is a known map chain (items.filter().map())
  if (typeof _identifierStartsMapCall === 'function' && _identifierStartsMapCall(c)) {
    if (typeof _tryParseIdentifierMapExpression === 'function') {
      return _tryParseIdentifierMapExpression(c, children, false);
    }
  }

  // Check if this is a state getter or known variable followed by .method()
  // e.g. answers.length, items.filter(), etc.
  var name = c.text();
  var isKnown = isGetter(name) ||
    (ctx.renderLocals && ctx.renderLocals[name] !== undefined) ||
    (ctx.objectArrays && ctx.objectArrays.some(function(o) { return o.getter === name; }));

  if (!isKnown) return false;

  // Collect the full chained expression up to the next JSX boundary
  var saved = c.save();
  var tokens = [];
  var depth = 0;
  while (c.kind() !== TK.eof) {
    // Stop at JSX boundaries
    if (depth === 0 && (c.kind() === TK.lt || c.kind() === TK.lt_slash || c.kind() === TK.lbrace || c.kind() === TK.rbrace)) break;
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) { depth--; if (depth < 0) break; }
    tokens.push(c.text());
    c.advance();
  }
  // Consume trailing } if we're inside a brace expression
  if (c.kind() === TK.rbrace) c.advance();

  if (tokens.length === 0) {
    c.restore(saved);
    return false;
  }

  var expr = tokens.join('');
  _pushLuaRawDynText(children, _normalizeJoinedJsExpr(expr));
  return true;
}
