// ── Preflight classifier/tag leak rules ──────────────────────────

function checkTagLeakTextNodes(scan, errors) {
  for (var di = 0; di < scan.allDecls.length; di++) {
    var textMatch = scan.allDecls[di].match(/\.text = "([^"]*[A-Z]\w*>)"/);
    if (textMatch && /C\.\w+>/.test(textMatch[1])) {
      errors.push('F19: tag name leaked as text: "' + textMatch[1] + '" — ternary or conditional JSX parse failed');
    }
  }
  for (var di2 = 0; di2 < scan.allDecls.length; di2++) {
    if (/\{ \.text = ":" \}/.test(scan.allDecls[di2])) {
      errors.push('F19: bare ":" leaked as text node — ternary colon not consumed by parser');
    }
  }
}

function checkJSSyntaxLeaks(scan, errors) {
  for (var di = 0; di < scan.allDecls.length; di++) {
    var decl = scan.allDecls[di];
    if (/'\w{2,}'/.test(decl) && decl.indexOf('.text =') >= 0) {
      var leaked = decl.match(/\.text = "([^"]*'[^"]*)"/) || decl.match(/\.text = "([^"]*exact[^"]*)"/);
      if (leaked) {
        errors.push('F18: JS syntax leaked into Zig text node: "' + leaked[1].substring(0, 60) + '"');
      }
    }
    if (/\bexact\b/.test(decl) && decl.indexOf('Node{') >= 0) {
      errors.push('F18: unresolved "exact" keyword in Zig declaration (JS ternary not fully parsed)');
    }
  }
}

function checkUnresolvedClassifierComponents(ctx, errors) {
  if (!(ctx._unresolvedClassifiers && ctx._unresolvedClassifiers.length > 0)) return;
  var clsNames = {};
  for (var ci = 0; ci < ctx._unresolvedClassifiers.length; ci++) {
    clsNames[ctx._unresolvedClassifiers[ci].name] = true;
  }
  var uniqueNames = Object.keys(clsNames);
  errors.push('F11: ' + ctx._unresolvedClassifiers.length + ' unresolved classifier component(s): C.' + uniqueNames.join(', C.') + ' — all styling dropped (check .cls.tsz import)');
}

function checkDroppedExpressions(ctx, errors) {
  if (!(ctx._droppedExpressions && ctx._droppedExpressions.length > 0)) return;
  for (var dei = 0; dei < ctx._droppedExpressions.length; dei++) {
    var de = ctx._droppedExpressions[dei];
    var snippet = de.expr.length > 60 ? de.expr.substring(0, 60) + '...' : de.expr;
    errors.push('F12: dropped expression {' + snippet + '} — not a getter, prop, template, map, or conditional');
  }
}

function warnOnUnknownSubsystemTags(ctx, warnings) {
  if (!(ctx._unknownSubsystemTags && ctx._unknownSubsystemTags.length > 0)) return;
  var tagNames = {};
  for (var sti = 0; sti < ctx._unknownSubsystemTags.length; sti++) {
    tagNames[ctx._unknownSubsystemTags[sti].tag] = true;
  }
  var uniqueTags = Object.keys(tagNames);
  warnings.push('F13: ' + ctx._unknownSubsystemTags.length + ' unsupported subsystem tag(s): <' + uniqueTags.join('>, <') + '> — no runtime support, rendered as empty boxes');
}
