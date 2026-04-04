// Soup map handling — extracted from soup.js

function soupHandleMap(expr, warns, inPressable) {
  // Extract: arrayName.map((itemParam, idxParam) => ...body...)
  var mapMatch = expr.match(/^(\w+)(?:\.\w+)*\.map\(\s*\((\w+)(?:\s*,\s*(\w+))?\)\s*=>/);
  if (!mapMatch) {
    // Try filtered: array.filter(...).map(...)
    mapMatch = expr.match(/\.map\(\s*\((\w+)(?:\s*,\s*(\w+))?\)\s*=>/);
    if (mapMatch) {
      mapMatch = [mapMatch[0], 'filtered', mapMatch[1], mapMatch[2]];
    } else {
      warns.push('[W] unrecognized .map() pattern — skipped');
      return { str: '', dynBufId: -1 };
    }
  }
  var arrayName = mapMatch[1];
  var itemParam = mapMatch[2];
  var idxParam = mapMatch[3] || null;

  // Find the => that belongs to the OUTER .map()'s callback.
  // Use indexOf (first .map), not lastIndexOf (which finds inner nested .map)
  var mapPos = expr.indexOf('.map(');
  var arrowIdx = expr.indexOf('=>', mapPos);
  var afterArrow = expr.slice(arrowIdx + 2).trim();
  var jsxBody = '';

  if (afterArrow.charAt(0) === '(') {
    // () => ( ... )  — extract balanced parens
    var depth = 0, i = 0;
    while (i < afterArrow.length) {
      if (afterArrow.charAt(i) === '(') depth++;
      else if (afterArrow.charAt(i) === ')') { depth--; if (depth === 0) { jsxBody = afterArrow.slice(1, i); break; } }
      i++;
    }
  } else if (afterArrow.charAt(0) === '{') {
    // () => { ... return (...) }  or  () => { ... return <tag>...</tag>; }
    var block = soupBlock(afterArrow, 0);
    var retIdx = block.lastIndexOf('return');
    if (retIdx >= 0) {
      var afterRet = block.slice(retIdx + 6).trim();
      if (afterRet.charAt(0) === '(') {
        // return ( ... )
        var depth = 0, i = 0;
        while (i < afterRet.length) {
          if (afterRet.charAt(i) === '(') depth++;
          else if (afterRet.charAt(i) === ')') { depth--; if (depth === 0) { jsxBody = afterRet.slice(1, i); break; } }
          i++;
        }
      } else if (afterRet.charAt(0) === '<') {
        // return <tag>...</tag>;  — extract JSX directly
        jsxBody = afterRet.replace(/;\s*$/, '');
      }
    }
    if (!jsxBody) {
      warns.push('[W] .map() body has no extractable JSX for "' + arrayName + '" — skipped');
      return { str: '', dynBufId: -1 };
    }
  } else if (afterArrow.charAt(0) === '<') {
    // () => <Tag>...</Tag>  — direct JSX
    jsxBody = afterArrow.replace(/\)\s*\)\s*$/, '');
  }

  if (!jsxBody || jsxBody.trim().length === 0) {
    warns.push('[W] .map() body extraction failed for "' + arrayName + '" — skipped');
    return { str: '', dynBufId: -1 };
  }

  // Replace {itemParam.field} references with static placeholder text (dotted name)
  // Using dotted form avoids triggering flight-check bracket text regex [a-zA-Z]+
  var itemRe = new RegExp('\\{\\s*' + itemParam + '\\.(\\w+)\\s*\\}', 'g');
  jsxBody = jsxBody.replace(itemRe, itemParam + '.$1');

  // Complex expressions like {item.field.includes(...)} are left for the
  // tokenizer to handle via soupBalanced (which tracks nesting correctly).
  // Do NOT use [^}]* regex here — it can't handle nested braces.

  // Drop key={...} attributes (simple non-nested values only)
  // soupBalanced in the tag parser handles nested key values correctly,
  // so we only strip trivial key=... here for cleanliness.
  jsxBody = jsxBody.replace(/\s+key=\{[^{}]*\}/g, '');

  // Parse the cleaned template through normal soup pipeline
  var tokens = soupTokenize(jsxBody.trim());
  var tree = soupBuildTree(tokens);
  if (!tree) {
    warns.push('[W] .map() template parse failed for "' + arrayName + '" — skipped');
    return { str: '', dynBufId: -1 };
  }

  // Extract inline handlers from the map template tree
  var handlersBefore = _sInlineHandlers.length;
  soupExtractInlineHandlers(tree, warns);

  // Store map alias so conditionals can resolve item references
  if (!ctx._soupMapAliases) ctx._soupMapAliases = [];
  ctx._soupMapAliases.push({ itemParam: itemParam, arrayName: arrayName, idxParam: idxParam });

  // Render the static template (may extract more handlers from conditional JSX)
  var result = soupToZig(tree, warns, inPressable);
  _sMapCount++;

  // Replace bare loop index variable with _idx parameter in map-internal handlers.
  // Handlers get _idx param, wired with (0) since soup renders one static template.
  // Must run AFTER soupToZig since conditional renders extract handlers too.
  if (idxParam) {
    var idxRe = new RegExp('\\b' + idxParam + '\\b', 'g');
    for (var hi = handlersBefore; hi < _sInlineHandlers.length; hi++) {
      _sInlineHandlers[hi].jsBody = _sInlineHandlers[hi].jsBody.replace(idxRe, '_idx');
      _sInlineHandlers[hi].needsIdx = true;
      // Update array declarations: wire handler(0) instead of handler()
      var hname = _sInlineHandlers[hi].name;
      for (var ai = 0; ai < ctx.arrayDecls.length; ai++) {
        ctx.arrayDecls[ai] = ctx.arrayDecls[ai].split(hname + '()').join(hname + '(0)');
      }
      // Also replace in the returned root node expression — it's not in ctx.arrayDecls
      // yet (parent builds its array decl after soupHandleMap returns), so the loop
      // above misses the outermost map template node's handler ref.
      result.str = result.str.split(hname + '()').join(hname + '(0)');
    }
  }
  warns.push('[W] .map("' + arrayName + '") → rendered 1 static template');
  return result;
}
