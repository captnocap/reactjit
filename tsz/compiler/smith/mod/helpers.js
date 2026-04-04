// Mod helpers — extracted from mod.js

function localIsReassigned(name, lines, lineIdx) {
  const pat = new RegExp('^' + name + '\\s*=');
  for (let i = lineIdx + 1; i < lines.length; i++) {
    const text = (lines[i].text || '').trim();
    if (!text) continue;
    if (pat.test(text)) return true;
    if (text.indexOf('? ') !== -1 || text.startsWith('? ') || text.startsWith(': ')) {
      const bare = text.replace(/^[?:]\s*/, '').trim();
      if (pat.test(bare)) return true;
      const parts = bare.split(';').map(function(s) { return s.trim(); }).filter(Boolean);
      for (let p = 0; p < parts.length; p++) {
        if (pat.test(parts[p])) return true;
      }
    }
  }
  return false;
}

function parseForExprSpec(expr) {
  let raw = expr.trim();
  let reverse = false;
  if (raw.endsWith('.reverse()')) {
    reverse = true;
    raw = raw.slice(0, -'.reverse()'.length).trim();
  }
  const rangeMatch = raw.match(/^(.+)\[(.+)\.\.(.+)\]$/);
  if (rangeMatch) {
    return {
      baseExpr: rangeMatch[1].trim(),
      startExpr: rangeMatch[2].trim(),
      endExpr: rangeMatch[3].trim(),
      reverse: reverse,
    };
  }
  return {
    baseExpr: raw,
    startExpr: '0',
    endExpr: raw + '.len',
    reverse: reverse,
  };
}

function buildReverseIndexExpr(startExpr, endExpr, iterVar) {
  if (startExpr === '0') return '(' + endExpr + ' - 1 - ' + iterVar + ')';
  return '(' + endExpr + ' - 1 - (' + iterVar + ' - (' + startExpr + ')))';
}

function substituteForLoopVars(text, itemVar, itemAccessExpr, indexVar, indexExpr) {
  let out = text;
  out = out.replace(new RegExp('\\b' + itemVar + '\\.', 'g'), itemAccessExpr + '.');
  out = out.replace(new RegExp('\\b' + itemVar + '\\b', 'g'), itemAccessExpr);
  if (indexVar && indexExpr) {
    out = out.replace(new RegExp('\\b' + indexVar + '\\b', 'g'), indexExpr);
  }
  return out;
}

function extendModCtx(ctx, extra) {
  const next = {
    knownVars: (ctx && ctx.knownVars) ? ctx.knownVars : [],
    localNames: (ctx && ctx.localNames) ? ctx.localNames : [],
    ptrVars: (ctx && ctx.ptrVars) ? ctx.ptrVars.slice() : [],
    narrowedVars: (ctx && ctx.narrowedVars) ? ctx.narrowedVars.slice() : [],
    inLoop: !!(ctx && ctx.inLoop),
  };
  if (!extra) return next;
  if (extra.knownVars) next.knownVars = extra.knownVars;
  if (extra.localNames) next.localNames = extra.localNames;
  if (extra.ptrVars) next.ptrVars = extra.ptrVars;
  if (extra.narrowedVars) next.narrowedVars = extra.narrowedVars;
  if (Object.prototype.hasOwnProperty.call(extra, 'inLoop')) next.inLoop = extra.inLoop;
  return next;
}

function extractNullGuardedVars(cond) {
  return extractNullComparedVars(cond, '==');
}

function extractNonNullVars(cond) {
  if (/\bor\b|\|\|/.test(cond)) return [];
  return extractNullComparedVars(cond, '!=');
}

function extractNullComparedVars(cond, op) {
  const vars = [];
  const re = new RegExp('([A-Za-z_]\\w*(?:\\.[A-Za-z_]\\w*)*)\\s*' + op.replace(/[!=]/g, '\\$&') + '\\s*null', 'g');
  let m;
  while ((m = re.exec(cond)) !== null) {
    if (m[1]) vars.push(m[1]);
  }
  return addUniqueVars([], vars);
}

function addUniqueVars(base, extra) {
  const out = (base || []).slice();
  for (let i = 0; i < (extra || []).length; i++) {
    if (out.indexOf(extra[i]) === -1) out.push(extra[i]);
  }
  return out;
}

function isEarlyExitBranch(expr) {
  const parts = expr.split(';').map(function(s) { return s.trim(); }).filter(Boolean);
  if (parts.length === 0) return false;
  for (let i = 0; i < parts.length; i++) {
    if (!(parts[i].startsWith('return ') || parts[i] === 'return' || parts[i] === 'stop' || parts[i] === 'continue')) return false;
  }
  return true;
}

function applyOptionalUnwraps(text, vars) {
  let out = text;
  const list = (vars || []).slice().sort(function(a, b) { return b.length - a.length; });
  for (let i = 0; i < list.length; i++) {
    out = replaceVarDotAccessWithUnwrap(out, list[i]);
    out = replaceExactVarWithUnwrap(out, list[i]);
    out = out.replace(new RegExp(escapeRegExp(list[i]) + '\\.\\?\\.\\?', 'g'), list[i] + '.?');
    out = out.replace(new RegExp(escapeRegExp(list[i]) + '\\.\\?\\s*=\\s*null', 'g'), list[i] + ' = null');
  }
  return out.replace(/\.\?\.\?/g, '.?');
}

function replaceVarDotAccessWithUnwrap(text, name) {
  const needle = name + '.';
  const replacement = name + '.?.';
  let out = '';
  for (let i = 0; i < text.length;) {
    if (text.slice(i, i + replacement.length) === replacement) {
      out += replacement;
      i += replacement.length;
      continue;
    }
    if (text.slice(i, i + needle.length) === needle) {
      const before = i === 0 ? '' : text[i - 1];
      const beforeOk = !before || !isModIdentChar(before);
      if (beforeOk) {
        out += replacement;
        i += needle.length;
        continue;
      }
    }
    out += text[i];
    i++;
  }
  return out;
}

function replaceExactVarWithUnwrap(text, name) {
  return replaceNeedleWithBoundary(text, name, name + '.?');
}

function replaceNeedleWithBoundary(text, needle, replacement) {
  let out = '';
  for (let i = 0; i < text.length;) {
    if (text.slice(i, i + needle.length) === needle) {
      const before = i === 0 ? '' : text[i - 1];
      const after = i + needle.length >= text.length ? '' : text[i + needle.length];
      const beforeOk = !before || !isModIdentChar(before);
      const afterOk = !after || !isModIdentChar(after);
      if (beforeOk && afterOk) {
        out += replacement;
        i += needle.length;
        continue;
      }
    }
    out += text[i];
    i++;
  }
  return out;
}

function isModIdentChar(ch) {
  return /[A-Za-z0-9_.]/.test(ch);
}

function rewriteKnownFunctionCalls(expr, ctx) {
  const ptrVars = (ctx && ctx.ptrVars) || [];
  let out = '';
  for (let i = 0; i < expr.length;) {
    if (/[A-Za-z_]/.test(expr[i])) {
      let j = i + 1;
      while (j < expr.length && /[A-Za-z0-9_]/.test(expr[j])) j++;
      const name = expr.slice(i, j);
      if (_modFnPtrParams[name] && expr[j] === '(') {
        const end = findMatchingParen(expr, j);
        if (end !== -1) {
          const args = splitCallArgs(expr.slice(j + 1, end)).map(function(arg, idx) {
            const rewritten = rewriteKnownFunctionCalls(arg.trim(), ctx);
            if (_modFnPtrParams[name][idx] && !argIsPointerLike(rewritten, ptrVars)) return '&' + rewritten;
            return rewritten;
          });
          out += name + '(' + args.join(', ') + ')';
          i = end + 1;
          continue;
        }
      }
    }
    out += expr[i];
    i++;
  }
  return out;
}

function findMatchingParen(text, openIdx) {
  let depth = 0;
  let quote = null;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitCallArgs(text) {
  const args = [];
  let cur = '';
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      cur += ch;
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(') paren++;
    if (ch === ')') paren--;
    if (ch === '{') brace++;
    if (ch === '}') brace--;
    if (ch === '[') bracket++;
    if (ch === ']') bracket--;
    if (ch === ',' && paren === 0 && brace === 0 && bracket === 0) {
      args.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim() || text.trim() === '') args.push(cur);
  return args.length === 1 && args[0] === '' ? [] : args;
}

function argIsPointerLike(arg, ptrVars) {
  const trimmed = arg.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('&')) return true;
  if (ptrVars.indexOf(trimmed) !== -1) return true;
  return false;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rewriteExpressionTernary(expr, ctx) {
  const parts = splitTopLevelTernary(expr);
  if (!parts) return null;
  return 'if (' + modTranspileExpr(parts.cond, ctx) + ') ' + modTranspileExpr(parts.thenExpr, ctx) + ' else ' + modTranspileExpr(parts.elseExpr, ctx);
}

function splitTopLevelTernary(expr) {
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let quote = null;
  let qIndex = -1;
  let nestedTernary = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (quote) {
      if (ch === quote && expr[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(') { paren++; continue; }
    if (ch === ')') { paren--; continue; }
    if (ch === '{') { brace++; continue; }
    if (ch === '}') { brace--; continue; }
    if (ch === '[') { bracket++; continue; }
    if (ch === ']') { bracket--; continue; }
    if (paren !== 0 || brace !== 0 || bracket !== 0) continue;
    if (ch === '?') {
      if (expr[i + 1] === '?') { i++; continue; }
      if (qIndex === -1) qIndex = i;
      else nestedTernary++;
      continue;
    }
    if (ch === ':' && qIndex !== -1) {
      if (nestedTernary > 0) {
        nestedTernary--;
        continue;
      }
      return {
        cond: expr.slice(0, qIndex).trim(),
        thenExpr: expr.slice(qIndex + 1, i).trim(),
        elseExpr: expr.slice(i + 1).trim(),
      };
    }
  }
  return null;
}
