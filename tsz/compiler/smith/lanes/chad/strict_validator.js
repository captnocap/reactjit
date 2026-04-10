// ── Chad strict syntax validator ─────────────────────────────────────
//
// Dictionary authority:
//   tsz/docs/INTENT_DICTIONARY.md
//
// This validator runs before chad lane parse/emit and hard-fails on known
// drift patterns that are explicitly forbidden in the intent dictionary.

function _chadStrictLineNumber(source, index) {
  var line = 1;
  for (var i = 0; i < index && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) line++;
  }
  return line;
}

function _chadStrictLineText(source, index) {
  var start = source.lastIndexOf('\n', index);
  var end = source.indexOf('\n', index);
  if (start < 0) start = 0;
  else start += 1;
  if (end < 0) end = source.length;
  return source.slice(start, end).trim();
}

function _chadStrictPushViolation(violations, seen, source, index, code, message, hint) {
  var line = _chadStrictLineNumber(source, index);
  var snippet = _chadStrictLineText(source, index);
  if (snippet.indexOf('//') === 0) return;
  var key = code + '|' + line + '|' + snippet;
  if (seen[key]) return;
  seen[key] = true;
  violations.push({
    code: code,
    line: line,
    message: message,
    hint: hint || '',
    snippet: snippet,
  });
}

function _chadStrictScanRegex(source, range, re, onMatch) {
  var start = range && range.start >= 0 ? range.start : 0;
  var end = range && range.end >= 0 ? range.end : source.length;
  var slice = source.slice(start, end);
  re.lastIndex = 0;
  var match;
  while ((match = re.exec(slice)) !== null) {
    onMatch(match, start + match.index);
    if (match[0] === '') re.lastIndex++;
  }
}

function _chadStrictScanLegacyPatterns(source, range, violations, seen) {
  _chadStrictScanRegex(source, range, /<\s*for\b[^>]*\beach\s*=/ig, function(match, index) {
    void match;
    _chadStrictPushViolation(
      violations,
      seen,
      source,
      index,
      'legacy-jsx-for-each',
      'legacy JSX loop syntax `<For each=...>` is not allowed in chad.',
      'Use dictionary form `<for items>` or `<for items as item>`.'
    );
  });

  _chadStrictScanRegex(source, range, /<\s*state\b[^>]*>/ig, function(match, index) {
    void match;
    _chadStrictPushViolation(
      violations,
      seen,
      source,
      index,
      'legacy-state-block',
      '`<state>` block is not allowed in chad.',
      'Declare reactive vars directly in `<var>` using `set_` prefix.'
    );
  });

  _chadStrictScanRegex(source, range, /<\s*timer\b[^>]*>/ig, function(match, index) {
    void match;
    _chadStrictPushViolation(
      violations,
      seen,
      source,
      index,
      'legacy-timer-block',
      '`<timer>` block is not allowed in chad.',
      'Use `name every N:` inside `<functions>`.'
    );
  });
}

function _chadStrictScanUppercaseIntentTags(source, range, violations, seen) {
  var reserved = {
    app: 1, page: 1, widget: 1, component: 1, lib: 1, module: 1, effect: 1, glyph: 1,
    var: 1, functions: 1, props: 1, types: 1, uses: 1, ffi: 1, semantics: 1,
    if: 1, else: 1, for: 1, while: 1, during: 1, switch: 1, case: 1,
    script: 1, lscript: 1, zscript: 1, jscript: 1, ascript: 1,
    state: 1, timer: 1,
  };

  _chadStrictScanRegex(source, range, /<\s*\/?\s*([A-Za-z][A-Za-z0-9_.-]*)\b[^>]*>/g, function(match, index) {
    var rawName = match[1] || '';
    var lower = rawName.toLowerCase();
    if (!reserved[lower]) return;
    if (rawName === lower) return;
    _chadStrictPushViolation(
      violations,
      seen,
      source,
      index,
      'uppercase-intent-tag',
      'intent tag `' + rawName + '` must be lowercase in chad.',
      'Use `' + lower + '`.'
    );
  });
}

function _chadStrictIsIntentBodyLine(trimmed) {
  if (!trimmed) return true;
  if (trimmed.indexOf('//') === 0) return true;
  if (trimmed.charAt(0) === '<' && trimmed.charAt(trimmed.length - 1) === '>') return true;
  if (/^(set_[A-Za-z_]\w*)\s+is\s+.+$/.test(trimmed)) return true;
  if (/^([A-Za-z_][\w.\[\]]*)\s+is\s+.+$/.test(trimmed)) return true;
  if (/^(stop|skip)$/.test(trimmed)) return true;
  if (/^[A-Za-z_]\w*(?:\([^)]*\))?(?:\s+(?:every\s+[^:]+|cleanup|requires\s+[^:]+))*\s*:\s*$/.test(trimmed)) return true;
  if (/^[A-Za-z_]\w*(?:\([^)]*\))?(?:\s*\+\s*[A-Za-z_]\w*(?:\([^)]*\))?)+\s*$/.test(trimmed)) return true;
  return false;
}

function _chadStrictLooksLikeRawBackendLine(trimmed) {
  if (!trimmed) return false;
  if (trimmed.indexOf('//') === 0) return false;

  var jsRaw = /=>|===|!==|&&|\|\||\b(?:const|let|var)\s+[A-Za-z_]\w*|\bfunction\s+[A-Za-z_]\w*\s*\([^)]*\)\s*\{|\bif\s*\(|\bfor\s*\(|\bwhile\s*\(/.test(trimmed);
  var luaRaw = /\blocal\s+[A-Za-z_]\w*|\belseif\b|\bthen\b|\bend\b|\bdo\b|~=|ffi\.cdef|require\s*\(|\bfunction\s+[A-Za-z_]\w*\s*\(/.test(trimmed);
  var zigRaw = /\b(?:pub\s+)?fn\s+[A-Za-z_]\w*\s*\(|@\w+\s*\(|\bcomptime\b|\borelse\b|\bcatch\b|\btry\b/.test(trimmed);

  return jsRaw || luaRaw || zigRaw;
}

function _chadStrictScanHatchBackendLeakage(source, range, violations, seen) {
  var start = range && range.start >= 0 ? range.start : 0;
  var end = range && range.end >= 0 ? range.end : source.length;
  var slice = source.slice(start, end);
  var lines = slice.split('\n');
  var offset = start;
  var hatch = '';

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();

    var openMatch = trimmed.match(/^<\s*(script|lscript|zscript|jscript)\s*>$/i);
    if (openMatch) {
      hatch = openMatch[1].toLowerCase();
      offset += line.length + 1;
      continue;
    }

    var closeMatch = trimmed.match(/^<\s*\/\s*(script|lscript|zscript|jscript)\s*>$/i);
    if (closeMatch) {
      hatch = '';
      offset += line.length + 1;
      continue;
    }

    if (hatch) {
      if (!_chadStrictIsIntentBodyLine(trimmed) && _chadStrictLooksLikeRawBackendLine(trimmed)) {
        _chadStrictPushViolation(
          violations,
          seen,
          source,
          offset,
          'hatched-backend-leakage',
          'raw backend syntax detected inside <' + hatch + '> hatch.',
          'Keep hatched blocks in intent syntax (`<if>`, `<for>`, `is`, `every`, etc.).'
        );
      }
    }

    offset += line.length + 1;
  }
}

function validateChadStrictSyntax(source, block, range) {
  void block;
  var violations = [];
  var seen = {};

  _chadStrictScanLegacyPatterns(source, range, violations, seen);
  _chadStrictScanUppercaseIntentTags(source, range, violations, seen);
  _chadStrictScanHatchBackendLeakage(source, range, violations, seen);

  return {
    ok: violations.length === 0,
    violations: violations,
  };
}

function _chadStrictEscapeCompileMsg(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function renderChadStrictValidationError(report) {
  if (!report || !report.violations || report.violations.length === 0) {
    return '';
  }

  var lines = [];
  lines.push('// Smith error: chad strict validation failed (' + report.violations.length + ' issue(s))');

  var maxNotes = report.violations.length < 8 ? report.violations.length : 8;
  for (var i = 0; i < maxNotes; i++) {
    var v = report.violations[i];
    lines.push('//  - L' + v.line + ' [' + v.code + '] ' + v.message);
    if (v.hint) lines.push('//    hint: ' + v.hint);
    if (v.snippet) lines.push('//    src: ' + v.snippet);
  }

  var first = report.violations[0];
  var msg = 'L' + first.line + ' ' + first.message;
  lines.push('comptime { @compileError("Chad strict: ' + _chadStrictEscapeCompileMsg(msg) + '"); }');
  lines.push('');
  return lines.join('\n');
}
