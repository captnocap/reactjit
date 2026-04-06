// ── Child parsing: text/comment fallthrough ───────────────────────

// Fuzzy match: find closest glyph name for typo hints
function _fuzzyGlyphMatch(name) {
  if (!ctx._glyphRegistry) return null;
  var best = null, bestDist = 3; // max edit distance threshold
  var keys = Object.keys(ctx._glyphRegistry);
  for (var ki = 0; ki < keys.length; ki++) {
    var d = _editDistance(name, keys[ki]);
    if (d < bestDist) { bestDist = d; best = keys[ki]; }
  }
  return best;
}

function _editDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  var matrix = [];
  for (var i = 0; i <= b.length; i++) matrix[i] = [i];
  for (var j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (var i = 1; i <= b.length; i++) {
    for (var j = 1; j <= a.length; j++) {
      var cost = a.charAt(j - 1) === b.charAt(i - 1) ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[b.length][a.length];
}

// Resolve :name: glyph shortcodes in text content.
// Splits "Status :check: ok" into [text "Status ", glyph check, text " ok"]
function _resolveGlyphShortcodes(text, children) {
  var re = /:([a-zA-Z]\w*)(?:\[(\w+)\])?:/g;
  var lastIdx = 0;
  var match;
  while ((match = re.exec(text)) !== null) {
    var glyphName = match[1];
    var effectOverride = match[2] || '';
    var glyph = ctx._glyphRegistry ? ctx._glyphRegistry[glyphName] : null;
    if (!glyph) {
      // Not a known glyph — report and suggest
      var hint = _fuzzyGlyphMatch(glyphName);
      var msg = '[glyph] :' + glyphName + ': → no match, rendered as text';
      if (hint) msg += ' (did you mean :' + hint + ':?)';
      ctx._glyphLog.push(msg);
      continue;
    }
    // Report resolution
    ctx._glyphLog.push('[glyph] :' + glyphName + ': → resolved to <' + glyphName + '> glyph');
    // Emit text before the glyph
    var before = text.slice(lastIdx, match.index);
    if (before) {
      children.push({ nodeExpr: '.{ .text = "' + before.replace(/"/g, '\\"') + '" }' });
    }
    // Emit glyph node
    var fillColor = glyph.fill.startsWith('#') ? parseColor(glyph.fill) : 'Color.rgb(255, 255, 255)';
    var fillEffectStr = effectOverride ? ', .fill_effect = "' + effectOverride + '"' : '';
    var glyphExpr = '.{ .d = "' + glyph.d + '", .fill = ' + fillColor + ', .stroke = Color.rgba(0, 0, 0, 0), .stroke_width = 0, .scale = 1.0' + fillEffectStr + ' }';
    children.push({ nodeExpr: '.{ .text = "\\x01" }', isGlyph: true, glyphExpr: glyphExpr });
    lastIdx = match.index + match[0].length;
  }
  // Emit remaining text after last glyph
  var after = text.slice(lastIdx);
  if (after) {
    children.push({ nodeExpr: '.{ .text = "' + after.replace(/"/g, '\\"') + '" }' });
  }
  // If no glyphs were resolved (all were unknown), push original text
  if (lastIdx === 0) {
    children.push({ nodeExpr: '.{ .text = "' + text.replace(/"/g, '\\"') + '" }' });
  }
}

function tryParseTextChild(c, children) {
  if (c.kind() === TK.lt || c.kind() === TK.lbrace) return false;

  if (c.kind() === TK.comment) {
    c.advance();
    return true;
  }

  if (c.kind() !== TK.rbrace) {
    const textStart = c.starts[c.pos];
    let textEnd = textStart;
    while (c.kind() !== TK.lt && c.kind() !== TK.lt_slash && c.kind() !== TK.lbrace && c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
      textEnd = c.ends[c.pos];
      c.advance();
    }
    const text = c._byteSlice(textStart, textEnd).trim();
    if (text.trim()) {
      if (globalThis.__SMITH_DEBUG_INLINE && (text.includes('import') || text.includes('function ') || text.includes('setMyPid'))) {
        globalThis.__dbg = globalThis.__dbg || [];
        globalThis.__dbg.push('[TEXT_LEAK] text="' + text.substring(0, 80) + '" pos=' + c.pos + ' inline=' + (ctx.inlineComponent || 'none'));
        for (let di = Math.max(0, c.pos - 5); di < Math.min(c.count, c.pos + 5); di++) {
          globalThis.__dbg.push('[TOK@' + di + '] kind=' + c.kindAt(di) + ' text="' + c.textAt(di).substring(0, 40) + '"');
        }
        if (!globalThis.__firstLeakDumped) {
          globalThis.__firstLeakDumped = true;
          globalThis.__dbg.push('[CONTEXT] SourcePage bodyPos check: components=' + ctx.components.map(function(cc) { return cc.name + '@' + cc.bodyPos; }).join(', '));
        }
      }
      // Resolve :name: glyph shortcodes in text (unless `l` prop = literal mode)
      var trimText = text.trim();
      if (!ctx._literalTextMode && ctx._glyphRegistry && Object.keys(ctx._glyphRegistry).length > 0 && /:([a-zA-Z]\w*):/.test(trimText)) {
        _resolveGlyphShortcodes(trimText, children);
      } else {
        children.push({ nodeExpr: `.{ .text = "${trimText.replace(/"/g, '\\"')}" }` });
      }
    }
    return true;
  }

  c.advance();
  return true;
}
