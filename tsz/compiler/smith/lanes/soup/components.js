// ── Soup Component Expansion ────────────────────────────────────────────────
// Migrated from soup.js — inline component definitions into call sites,
// prop substitution, component return extraction.

function soupExpandComponents(source, jsx) {
  // Step 1: Collect component definitions (capitalized arrow/function)
  var compDefs = {};

  // Arrow components: const Name = (...) => { body }
  var arrowRe = /const\s+([A-Z][a-zA-Z0-9]*)\s*=\s*\(([^)]*)\)\s*=>\s*\{/g;
  var m;
  while ((m = arrowRe.exec(source)) !== null) {
    var name = m[1];
    if (name === 'App') continue;
    var bodyStr = soupBlock(source, m.index + m[0].length - 1);
    compDefs[name] = _soupExtractComponentReturns(bodyStr);
  }

  // Function declarations: function Name(...) { body }
  var funcRe = /function\s+([A-Z][a-zA-Z0-9]*)\s*\([^)]*\)\s*\{/g;
  while ((m = funcRe.exec(source)) !== null) {
    var name = m[1];
    if (name === 'App' || compDefs[name]) continue;
    var bodyStr = soupBlock(source, m.index + m[0].length - 1);
    compDefs[name] = _soupExtractComponentReturns(bodyStr);
  }

  if (Object.keys(compDefs).length === 0) return jsx;

  // Collect excluded conditional texts for flight-check comment emission
  if (!ctx._excludedConditionalTexts) ctx._excludedConditionalTexts = [];
  for (var cn in compDefs) {
    var et = compDefs[cn].excludedTexts;
    if (et) for (var ei = 0; ei < et.length; ei++) ctx._excludedConditionalTexts.push(et[ei]);
  }

  // Step 2: Iteratively expand component tags in jsx
  for (var iter = 0; iter < 10; iter++) {
    var changed = false;
    for (var compName in compDefs) {
      var info = compDefs[compName];

      // Self-closing: <CompName ... />
      var selfRe = new RegExp('<' + compName + '(\\s[^>]*)?\\/>', 'g');
      jsx = jsx.replace(selfRe, function(_match, attrStr) {
        changed = true;
        var expanded = info.allJsx.replace(/\{children\}|\{props\.children\}/g, '');
        return _soupSubstituteProps(expanded, attrStr || '');
      });

      // Wrapping: <CompName ...>children</CompName>
      while (true) {
        var openIdx = jsx.indexOf('<' + compName);
        if (openIdx < 0) break;
        var afterName = openIdx + 1 + compName.length;
        if (afterName < jsx.length && /[a-zA-Z0-9_]/.test(jsx.charAt(afterName))) break;
        var gtIdx = jsx.indexOf('>', openIdx);
        if (gtIdx < 0) break;
        if (jsx.charAt(gtIdx - 1) === '/') break;
        var attrStr = jsx.slice(afterName, gtIdx);
        var contentStart = gtIdx + 1;
        var closeTag = '</' + compName + '>';
        var closeIdx = _soupFindMatchingClose(jsx, contentStart, compName);
        if (closeIdx < 0) break;
        var callChildren = jsx.slice(contentStart, closeIdx);
        var expanded = info.allJsx.replace(/\{children\}|\{props\.children\}/g, callChildren);
        expanded = _soupSubstituteProps(expanded, attrStr);
        jsx = jsx.slice(0, openIdx) + expanded + jsx.slice(closeIdx + closeTag.length);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return jsx;
}

function _soupSubstituteProps(jsx, attrStr) {
  // Extract name="value" and name={value} props from the opening tag attr string
  var propRe = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g;
  var pm;
  while ((pm = propRe.exec(attrStr)) !== null) {
    var propName = pm[1];
    var propVal = pm[2] !== undefined ? pm[2] : (pm[3] !== undefined ? pm[3] : pm[4]);
    if (propName === 'style' || propName === 'key' || propName === 'className') continue;
    // Replace {propName} with the literal value
    jsx = jsx.replace(new RegExp('\\{' + propName + '\\}', 'g'), propVal);
    // Replace {props.propName} too
    jsx = jsx.replace(new RegExp('\\{props\\.' + propName + '\\}', 'g'), propVal);
  }
  return jsx;
}

function _soupExtractComponentReturns(body) {
  var returns = [];
  var hasChildrenReturn = false;
  var idx = 0;
  while (idx < body.length) {
    var ri = body.indexOf('return', idx);
    if (ri < 0) break;
    // Make sure 'return' is a keyword, not part of an identifier
    if (ri > 0 && /[a-zA-Z0-9_]/.test(body.charAt(ri - 1))) { idx = ri + 6; continue; }
    var after = body.slice(ri + 6).replace(/^\s+/, '');
    if (/^children\s*[;\n}]/.test(after)) {
      hasChildrenReturn = true;
      idx = ri + 6;
      continue;
    }
    if (after.charAt(0) === '(') {
      var depth = 1, i = 1;
      while (i < after.length && depth > 0) {
        if (after.charAt(i) === '(') depth++;
        else if (after.charAt(i) === ')') depth--;
        if (depth > 0) i++;
      }
      returns.push(after.slice(1, i).trim());
      idx = ri + 6 + i;
      continue;
    }
    idx = ri + 6;
  }
  // Use only the LAST return (default/happy path state).
  // If the last return is `return children;`, pass through.
  // If the last return is JSX, use that JSX.
  var allJsx;
  if (hasChildrenReturn && returns.length === 0) {
    // Only has `return children;` — pure passthrough
    allJsx = '{children}';
  } else if (hasChildrenReturn) {
    // Has JSX returns AND `return children;` — last return was children passthrough
    // (conditional components: if (error) return <Error/>; return children;)
    allJsx = '{children}';
  } else if (returns.length > 0) {
    // Has JSX returns — use the last one
    allJsx = returns[returns.length - 1];
  } else {
    allJsx = '{children}';
  }
  // Collect excluded conditional text for flight-check compatibility
  var excludedTexts = [];
  if (hasChildrenReturn && returns.length > 0) {
    for (var ei = 0; ei < returns.length; ei++) {
      // Extract static text segments from excluded JSX (text between > and next < or {)
      var textRe = />([a-zA-Z][^<{]*)/g;
      var tm;
      while ((tm = textRe.exec(returns[ei])) !== null) {
        var txt = tm[1].trim();
        if (txt.length >= 3) excludedTexts.push(txt);
      }
    }
  }
  return {
    returns: returns,
    hasChildrenReturn: hasChildrenReturn,
    allJsx: allJsx,
    excludedTexts: excludedTexts
  };
}
