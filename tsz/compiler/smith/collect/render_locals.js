// ── Render-local collection ──────────────────────────────────────

function skipRenderLocalDestructure(c) {
  var depth = 1;
  c.advance();
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lbracket) depth++;
    if (c.kind() === TK.rbracket) depth--;
    c.advance();
  }
  while (c.pos < c.count &&
         c.kind() !== TK.rparen &&
         !c.isIdent('const') &&
         !c.isIdent('let') &&
         !c.isIdent('return')) {
    c.advance();
  }
  if (c.kind() === TK.rparen) c.advance();
}

function appendRenderLocalToken(c, valParts) {
  // Resolve identifiers via identity layer
  if (c.kind() === TK.identifier) {
    var _ri = resolveIdentity(c.text(), ctx);
    if (_ri.kind === 'render_local') {
      valParts.push(_ri.zigExpr);
      return true;
    }
    if (_ri.kind === 'slot') {
      valParts.push(_ri.zigExpr);
      return true;
    }
  }
  // Resolve === / !== comparisons via comparison layer
  if (c.kind() === TK.eq_eq) {
    c.advance();
    if (c.kind() === TK.equals) c.advance();
    if (c.kind() === TK.string) {
      var lhs = valParts.join('');
      var rhs = '"' + c.text().slice(1, -1) + '"';
      valParts.length = 0;
      valParts.push(resolveComparison(lhs, '==', rhs, ctx));
    } else {
      valParts.push(' == ');
      return false;
    }
    return true;
  }
  if (c.kind() === TK.not_eq) {
    c.advance();
    if (c.kind() === TK.equals) c.advance();
    if (c.kind() === TK.string) {
      var lhs2 = valParts.join('');
      var rhs2 = '"' + c.text().slice(1, -1) + '"';
      valParts.length = 0;
      valParts.push(resolveComparison(lhs2, '!=', rhs2, ctx));
    } else {
      valParts.push(' != ');
      return false;
    }
    return true;
  }
  if (c.kind() === TK.star || c.kind() === TK.plus || c.kind() === TK.minus || c.kind() === TK.slash || c.kind() === TK.percent) {
    valParts.push(' ' + c.text() + ' ');
    return true;
  }
  if (c.kind() === TK.string) {
    valParts.push('"' + c.text().slice(1, -1) + '"');
    return true;
  }
  valParts.push(c.text());
  return true;
}

function readRawJsExpression(c) {
  var parts = [];
  var depth = 0;
  while (c.pos < c.count) {
    if (c.kind() === TK.semicolon && depth === 0) { c.advance(); break; }
    if (depth === 0 && c.kind() === TK.identifier &&
        (c.text() === 'const' || c.text() === 'let' || c.text() === 'return' || c.text() === 'function')) break;
    if (c.kind() === TK.lparen || c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rparen || c.kind() === TK.rbracket || c.kind() === TK.rbrace) {
      depth--;
      if (depth < 0) break;
    }
    parts.push(c.text());
    c.advance();
  }
  return parts.join(' ');
}

function readRenderLocalValue(c) {
  var valParts = [];
  var depth = 0;
  while (c.pos < c.count) {
    if (c.kind() === TK.semicolon && depth === 0) {
      c.advance();
      break;
    }
    if (depth === 0 &&
        c.kind() === TK.identifier &&
        (c.text() === 'const' || c.text() === 'let' || c.text() === 'return' || c.text() === 'function')) {
      break;
    }
    if (c.kind() === TK.lparen || c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rparen || c.kind() === TK.rbracket || c.kind() === TK.rbrace) {
      depth--;
      if (depth < 0) break;
    }
    if (!appendRenderLocalToken(c, valParts)) continue;
    c.advance();
  }
  return valParts.join('');
}

function shouldEvalRenderLocal(rawJs) {
  if (!rawJs || rawJs.length === 0) return false;
  if (/<\/?[A-Za-z]/.test(rawJs)) return false;
  if (/\b[A-Za-z_]\w*\s*\.\s*[A-Za-z_]\w*/.test(rawJs)) return true;
  return rawJs.indexOf('=>') >= 0 ||
    rawJs.indexOf('.map(') >= 0 ||
    rawJs.indexOf('.filter(') >= 0 ||
    rawJs.indexOf('.some(') >= 0 ||
    rawJs.indexOf('.every(') >= 0 ||
    rawJs.indexOf('.reduce(') >= 0 ||
    rawJs.indexOf('.sort(') >= 0 ||
    rawJs.indexOf('.slice(') >= 0 ||
    rawJs.indexOf('&&') >= 0 ||
    rawJs.indexOf('||') >= 0 ||
    rawJs.indexOf('?') >= 0 ||
    rawJs.indexOf('Object.') >= 0 ||
    rawJs.indexOf('Array.') >= 0 ||
    rawJs.indexOf('new Map') >= 0 ||
    rawJs.indexOf('new Set') >= 0 ||
    rawJs.indexOf('.indexOf(') >= 0;
}

function normalizeRenderLocalJs(rawJs) {
  return String(rawJs)
    .replace(/!\s*=\s*=/g, '!==')
    .replace(/=\s*=\s*=/g, '===')
    .replace(/!\s*=(?!=)/g, '!=')
    .replace(/=\s*=(?!=)/g, '==')
    .replace(/>\s*=/g, '>=')
    .replace(/<\s*=/g, '<=')
    .replace(/&\s*&/g, '&&')
    .replace(/\|\s*\|/g, '||')
    // Postfix `++`/`--` split by the lexer into two plus/minus tokens and
    // space-joined by the render-local collector. The terminator-based guard
    // only matches unambiguous postfix positions (never merges into a unary
    // `+b` binary-plus construct).
    .replace(/(\w)\s*\+\s*\+(\s*[);,}\]])/g, '$1++$2')
    .replace(/(\w)\s*-\s*-(\s*[);,}\]])/g, '$1--$2')
    .replace(/\bexact\b/g, '===');
}

function expandRenderLocalRawExpr(rawJs, skipName) {
  let out = normalizeRenderLocalJs(rawJs);
  if (!ctx._renderLocalRaw) return out;
  const names = Object.keys(ctx._renderLocalRaw).sort((a, b) => b.length - a.length);
  // Multiple passes to handle transitive expansion (totalTokens → modelEntries → Object.entries(...))
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const name of names) {
      if (skipName && name === skipName) continue;
      const raw = ctx._renderLocalRaw[name];
      if (!raw || raw === rawJs) continue;
      const before = out;
      out = out.replace(new RegExp(`\\b${name}\\b`, 'g'), function(match, offset, full) {
        let prev = offset - 1;
        while (prev >= 0 && /\s/.test(full[prev])) prev--;
        if (prev >= 0 && full[prev] === '.') return match;
        return `(${normalizeRenderLocalJs(raw)})`;
      });
      if (out !== before) changed = true;
    }
    if (!changed) break;
  }
  return out;
}

function collectRenderLocals(c, appStart) {
  ctx.renderLocals = {};
  ctx._renderLocalRaw = {};
  ctx._renderLocalSpan = {};
  const saved = c.save();
  c.pos = appStart;
  while (c.pos < c.count && c.kind() !== TK.lbrace) c.advance();
  if (c.kind() === TK.lbrace) c.advance();
  // Capture the full render body start position (for __computeRenderBody)
  var _renderBodyStart = c.pos;
  let appDepth = 1;
  if (!ctx._useEffectBodies) ctx._useEffectBodies = [];
  while (c.pos < c.count && appDepth > 0) {
    if (c.kind() === TK.lbrace) {
      appDepth++;
      c.advance();
      continue;
    }
    if (c.kind() === TK.rbrace) {
      appDepth--;
      if (appDepth <= 0) break;
      c.advance();
      continue;
    }
    if (appDepth === 1 && c.isIdent('return')) break;
    // useEffect(() => { ... }) — collect body as init-time JS
    if (appDepth === 1 && c.isIdent('useEffect')) {
      c.advance();
      if (c.kind() === TK.lparen) {
        c.advance();
        // Skip () =>
        if (c.kind() === TK.lparen) { c.advance(); if (c.kind() === TK.rparen) c.advance(); }
        if (c.kind() === TK.arrow) c.advance();
        if (c.kind() === TK.lbrace) {
          c.advance();
          var parts = [];
          var depth = 0;
          while (c.kind() !== TK.eof) {
            if (c.kind() === TK.rbrace && depth === 0) { c.advance(); break; }
            if (c.kind() === TK.lbrace) depth++;
            if (c.kind() === TK.rbrace) depth--;
            parts.push(c.text());
            if (c.kind() === TK.semicolon) parts.push(' ');
            c.advance();
          }
          if (parts.length > 0) ctx._useEffectBodies.push(parts.join(''));
        }
        // Skip closing )
        if (c.kind() === TK.rparen) c.advance();
        // Skip optional ;
        if (c.kind() === TK.semicolon) c.advance();
      }
      continue;
    }
    if (appDepth === 1 && (c.isIdent('const') || c.isIdent('let') || c.isIdent('var'))) {
      c.advance();
      if (c.kind() === TK.lbracket) {
        skipRenderLocalDestructure(c);
        continue;
      }
      if (c.kind() === TK.identifier) {
        const varName = c.text();
        c.advance();
        if (c.kind() === TK.equals) {
          c.advance();
          const rhsStart = c.save();
          const rawExpr = readRawJsExpression(c);
          const rhsEnd = c.save();
          ctx._renderLocalRaw[varName] = rawExpr;
          ctx._renderLocalSpan[varName] = { start: rhsStart, end: rhsEnd };
          c.restore(rhsStart);
          // Skip if this is a registered const OA (handled by object array system)
          var _isConstOa = false;
          for (var _coi = 0; _coi < ctx.objectArrays.length; _coi++) {
            if (ctx.objectArrays[_coi].getter === varName && ctx.objectArrays[_coi].isConst) { _isConstOa = true; break; }
          }
            if (!_isConstOa) {
              if (shouldEvalRenderLocal(rawExpr)) {
                var expandedRaw = expandRenderLocalRawExpr(rawExpr, varName);
                ctx.renderLocals[varName] = buildEval(expandedRaw, ctx);
            // Check if value is a JS function call — route through QJS eval
            } else if (c.kind() === TK.identifier && !isGetter(c.text()) && !isSetter(c.text()) &&
                !(ctx.renderLocals[c.text()] !== undefined) &&
                c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
              var rawJs = readRawJsExpression(c);
              var expandedRawJs = expandRenderLocalRawExpr(rawJs, varName);
              ctx.renderLocals[varName] = buildEval(expandedRawJs, ctx);
            } else {
              const valStr = readRenderLocalValue(c);
              if (!valStr.includes('useState')) ctx.renderLocals[varName] = valStr;
            }
          }
        }
      }
      continue;
    }
    // Detect: if (cond) { ... varName = expr; } — reassignment of a known let render local
    if (appDepth === 1 && c.isIdent('if')) {
      const ifSaved = c.save();
      c.advance(); // skip 'if'
      if (c.kind() === TK.lparen) {
        var condParts = [];
        c.advance(); // skip (
        var condDepth = 1;
        while (c.pos < c.count && condDepth > 0) {
          if (c.kind() === TK.lparen) condDepth++;
          if (c.kind() === TK.rparen) { condDepth--; if (condDepth === 0) break; }
          condParts.push(c.text());
          c.advance();
        }
        if (c.kind() === TK.rparen) c.advance(); // skip )
        var condRaw = condParts.join(' ');
        if (c.kind() === TK.lbrace) {
          c.advance(); // skip {
          var bodyParts = [];
          var bodyDepth = 1;
          var reassignedVar = null;
          while (c.pos < c.count && bodyDepth > 0) {
            if (c.kind() === TK.lbrace) bodyDepth++;
            if (c.kind() === TK.rbrace) { bodyDepth--; if (bodyDepth === 0) break; }
            // Check for reassignment: knownVar = (not ==)
            if (bodyDepth === 1 && c.kind() === TK.identifier && ctx._renderLocalRaw[c.text()] !== undefined &&
                c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.equals &&
                (c.pos + 2 >= c.count || c.kindAt(c.pos + 2) !== TK.equals)) {
              reassignedVar = c.text();
            }
            bodyParts.push(c.text());
            c.advance();
          }
          if (c.kind() === TK.rbrace) c.advance(); // skip }
          if (reassignedVar) {
            var initRaw = ctx._renderLocalRaw[reassignedVar] || 'null';
            var bodyRaw = bodyParts.join(' ');
            // Use mangled name inside IIFE to prevent expandRenderLocalRawExpr from re-expanding
            var iifeVar = '_rl_' + reassignedVar;
            var mangledBody = bodyRaw.replace(new RegExp('\\b' + reassignedVar + '\\b', 'g'), iifeVar);
            var iife = '(function(){ var ' + iifeVar + ' = ' + initRaw + '; if (' + condRaw + ') { ' + mangledBody + ' } return ' + iifeVar + '; })()';
            if (condRaw && condRaw.indexOf('widget') >= 0) {
              print('[RL_TRACE] var=' + reassignedVar + ' condRaw=' + JSON.stringify(condRaw.slice(0, 120)));
            }
            var expandedIife = expandRenderLocalRawExpr(iife, reassignedVar);
            if (expandedIife && expandedIife.indexOf('widget') >= 0) {
              var widx = expandedIife.indexOf('widget');
              print('[RL_TRACE] iife around widget: ' + JSON.stringify(expandedIife.slice(Math.max(0,widx-30), widx+30)));
            }
            // Store the EXPANDED IIFE so further expansions don't re-expand shotStatsData → nested IIFEs
            ctx._renderLocalRaw[reassignedVar] = expandedIife;
            ctx.renderLocals[reassignedVar] = buildEval(expandedIife, ctx);
            continue;
          }
        }
      }
      c.restore(ifSaved);
    }
    c.advance();
  }
  // Capture the full render body as raw token text (for __computeRenderBody)
  var _renderBodyEnd = c.pos;
  var _renderBodyParts = [];
  for (var _rbi = _renderBodyStart; _rbi < _renderBodyEnd; _rbi++) {
    _renderBodyParts.push(c.textAt(_rbi));
  }
  ctx._renderBodyRaw = normalizeRenderLocalJs(_renderBodyParts.join(' '));
  c.restore(saved);
}
