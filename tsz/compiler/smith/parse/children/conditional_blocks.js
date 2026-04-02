// ── JSX conditional block parsing ─────────────────────────────────
// Handles <if>, <else if>, <else>, and <during> blocks in JSX.
// These compile to the same conditional show/hide infrastructure
// that {expr && <JSX>} and ternaries use.
//
// Dictionary syntax:
//   <if count above 0>         → show_hide conditional
//     <C.Hint>Positive</C.Hint>
//   </if>
//   <else>                     → negated previous condition
//     <C.Hint>Zero</C.Hint>
//   </else>
//
//   <during loading>           → same as <if> for rendering
//     <C.Spinner />
//   </during>

// ── Computed function field resolver ──
// Resolves func.field where func is a scriptFunc returning arrayName[indexVar].
// e.g., currentTrack.id → _oa0_id[@intCast(state.getSlot(0))]
function _resolveComputedFieldAccess(funcName, field) {
  if (!ctx.scriptBlock) return null;
  // Match: function funcName() { return arrayName[indexVar]; }
  var re = new RegExp('function\\s+' + funcName + '\\([^)]*\\)\\s*\\{\\s*return\\s+(\\w+)\\[(\\w+)\\]');
  var m = ctx.scriptBlock.match(re);
  if (!m) return null;
  var arrayName = m[1];
  var indexVar = m[2];
  // Find the OA for arrayName
  var oa = null;
  for (var i = 0; i < ctx.objectArrays.length; i++) {
    if (ctx.objectArrays[i].getter === arrayName) { oa = ctx.objectArrays[i]; break; }
  }
  if (!oa) return null;
  // Find the state slot for indexVar
  var slotIdx = findSlot(indexVar);
  if (slotIdx < 0) return null;
  return '_oa' + oa.oaIdx + '_' + field + '[@intCast(state.getSlot(' + slotIdx + '))]';
}

// ── Condition expression parser ──
// Reads tokens from cursor until > and builds a Zig condition expression.
// Handles dictionary word operators: exact, not exact, above, below, etc.

function parseBlockCondition(c) {
  var parts = [];

  while (c.kind() !== TK.gt && c.kind() !== TK.slash_gt && c.kind() !== TK.eof) {
    if (c.kind() === TK.identifier) {
      var word = c.text();

      // ── Word operators (must check before identifier resolution) ──

      // 'exact or above' / 'exact or below' (3-word ops, check first)
      if (word === 'exact' && c.pos + 2 < c.count &&
          c.kindAt(c.pos + 1) === TK.identifier && c.textAt(c.pos + 1) === 'or' &&
          c.kindAt(c.pos + 2) === TK.identifier) {
        var orTarget = c.textAt(c.pos + 2);
        if (orTarget === 'above') { parts.push(' >= '); c.advance(); c.advance(); c.advance(); continue; }
        if (orTarget === 'below') { parts.push(' <= '); c.advance(); c.advance(); c.advance(); continue; }
      }

      // 'not exact' (2-word op)
      if (word === 'not' && c.pos + 1 < c.count &&
          c.kindAt(c.pos + 1) === TK.identifier && c.textAt(c.pos + 1) === 'exact') {
        parts.push(' != ');
        c.advance(); c.advance();
        continue;
      }

      if (word === 'exact') { parts.push(' == '); c.advance(); continue; }
      if (word === 'above') { parts.push(' > '); c.advance(); continue; }
      if (word === 'below') { parts.push(' < '); c.advance(); continue; }
      if (word === 'and')   { parts.push(' and '); c.advance(); continue; }
      if (word === 'or')    { parts.push(' or '); c.advance(); continue; }

      // 'not' as prefix negation (bare 'not varname')
      if (word === 'not') {
        c.advance();
        if (c.kind() === TK.identifier) {
          var negName = c.text();
          if (isGetter(negName)) {
            var negSlotIdx = findSlot(negName);
            var negSlot = negSlotIdx >= 0 ? ctx.stateSlots[negSlotIdx] : null;
            if (negSlot && negSlot.type === 'boolean') {
              parts.push('!' + slotGet(negName));
            } else {
              parts.push('(' + slotGet(negName) + ' == 0)');
            }
          } else {
            parts.push('(!' + negName + ')');
          }
          c.advance();
        }
        continue;
      }

      // ── Identifier resolution ──

      // State getter
      if (isGetter(word)) {
        parts.push(slotGet(word));
        c.advance();
        continue;
      }

      // Object array .length
      var oa = null;
      for (var _oai = 0; _oai < ctx.objectArrays.length; _oai++) {
        if (ctx.objectArrays[_oai].getter === word) { oa = ctx.objectArrays[_oai]; break; }
      }
      if (oa && c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot &&
          c.kindAt(c.pos + 2) === TK.identifier && c.textAt(c.pos + 2) === 'length') {
        parts.push('_oa' + oa.oaIdx + '_len');
        c.advance(); c.advance(); c.advance();
        continue;
      }

      // Prop access
      if (ctx.propStack && ctx.propStack[word] !== undefined) {
        parts.push(_condPropValue(ctx.propStack[word]));
        c.advance();
        continue;
      }

      // Render local
      if (ctx.renderLocals && ctx.renderLocals[word] !== undefined) {
        parts.push(ctx.renderLocals[word]);
        c.advance();
        continue;
      }

      // Map item field: item.field
      if (ctx.currentMap && word === ctx.currentMap.itemParam) {
        c.advance();
        if (c.kind() === TK.dot && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
          c.advance(); // skip .
          var field = c.text();
          c.advance(); // skip field
          var mapOa = ctx.currentMap.oa;
          if (mapOa) {
            var fieldInfo = null;
            for (var _fi = 0; _fi < mapOa.fields.length; _fi++) {
              if (mapOa.fields[_fi].name === field) { fieldInfo = mapOa.fields[_fi]; break; }
            }
            var iv = ctx.currentMap.iterVar || '_i';
            if (fieldInfo && fieldInfo.type === 'string') {
              parts.push('_oa' + mapOa.oaIdx + '_' + field + '[' + iv + '][0.._oa' + mapOa.oaIdx + '_' + field + '_lens[' + iv + ']]');
            } else {
              parts.push('_oa' + mapOa.oaIdx + '_' + field + '[' + iv + ']');
            }
          } else {
            parts.push('0');
          }
          continue;
        }
        // Bare item reference — for simple string arrays, resolve to string value
        var bareOa = ctx.currentMap.oa;
        var bareIv = ctx.currentMap.iterVar || '_i';
        if (bareOa && bareOa.isSimpleArray) {
          parts.push('_oa' + bareOa.oaIdx + '__v[' + bareIv + '][0.._oa' + bareOa.oaIdx + '__v_lens[' + bareIv + ']]');
        } else {
          parts.push('@as(i64, @intCast(' + bareIv + '))');
        }
        continue;
      }

      // Map index
      if (ctx.currentMap && word === ctx.currentMap.indexParam) {
        parts.push('@as(i64, @intCast(' + (ctx.currentMap.iterVar || '_i') + '))');
        c.advance();
        continue;
      }

      // Script function with .field access: currentTrack.id → resolve to OA field
      if (ctx.scriptFuncs && ctx.scriptFuncs.indexOf(word) >= 0 &&
          c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.dot &&
          c.pos + 2 < c.count && c.kindAt(c.pos + 2) === TK.identifier) {
        c.advance(); // skip word
        c.advance(); // skip .
        var accessField = c.text();
        c.advance(); // skip field
        var cfResolved = _resolveComputedFieldAccess(word, accessField);
        if (cfResolved) {
          parts.push(cfResolved);
        } else {
          parts.push(word + '_' + accessField);
        }
        continue;
      }

      // Unknown identifier — pass through (may be a script function result)
      parts.push(word);
      c.advance();
      continue;
    }

    // ── Non-identifier tokens ──

    if (c.kind() === TK.number) {
      parts.push(c.text());
      c.advance();
      continue;
    }

    if (c.kind() === TK.string) {
      var sv = c.text().slice(1, -1);
      var lastPart = parts.length > 0 ? parts[parts.length - 1] : '';
      if (lastPart === ' == ' || lastPart === ' != ') {
        // String comparison → std.mem.eql
        parts.pop();
        var lhs = parts.join('');
        parts.length = 0;
        var eql = 'std.mem.eql(u8, ' + lhs + ', "' + sv + '")';
        parts.push(lastPart === ' == ' ? eql : '!' + eql);
      } else {
        parts.push('"' + sv + '"');
      }
      c.advance();
      continue;
    }

    // JS operators that might leak through lexer
    if (c.kind() === TK.eq_eq)  { parts.push(' == '); c.advance(); if (c.kind() === TK.equals) c.advance(); continue; }
    if (c.kind() === TK.not_eq) { parts.push(' != '); c.advance(); if (c.kind() === TK.equals) c.advance(); continue; }
    if (c.kind() === TK.gt_eq)  { parts.push(' >= '); c.advance(); continue; }
    if (c.kind() === TK.lt_eq)  { parts.push(' <= '); c.advance(); continue; }
    if (c.kind() === TK.bang)   { parts.push('!');    c.advance(); continue; }

    // Skip anything else
    c.advance();
  }

  if (c.kind() === TK.gt) c.advance();

  var expr = parts.join('');

  // Post-process: fix runtime string == string comparisons.
  // In Zig, slices can't use == — need std.mem.eql.
  // Detect: anything with [0.. or getSlotString on either side of == or !=
  var eqMatch = expr.match(/^(.+?)\s*(==|!=)\s*(.+)$/);
  if (eqMatch) {
    var eLhs = eqMatch[1].trim();
    var eOp = eqMatch[2];
    var eRhs = eqMatch[3].trim();
    var lhsIsStr = eLhs.includes('[0..') || eLhs.includes('getSlotString');
    var rhsIsStr = eRhs.includes('[0..') || eRhs.includes('getSlotString');
    if (lhsIsStr || rhsIsStr) {
      var memEql = 'std.mem.eql(u8, ' + eLhs + ', ' + eRhs + ')';
      expr = eOp === '==' ? memEql : '!' + memEql;
    }
  }

  // Bare boolean: if the expression is just a slot access with no operator,
  // and it's a boolean slot, use directly. Otherwise wrap with != 0.
  if (expr && !expr.includes('==') && !expr.includes('!=') &&
      !expr.includes('>') && !expr.includes('<') &&
      !expr.includes(' and ') && !expr.includes(' or ') &&
      !expr.includes('std.mem.eql') && !expr.startsWith('!')) {
    if (expr.includes('getSlotBool')) {
      // Already boolean — use directly
    } else if (expr.includes('getSlot') || expr.includes('getSlotFloat')) {
      expr = '(' + expr + ' != 0)';
    }
  }

  return expr;
}

// ── Wrap children in a conditional node ──
// Single child: attach condIdx directly. Multiple children: wrap in container.

function wrapConditionalChildren(blockChildren, condIdx, children) {
  if (blockChildren.length === 0) return;

  if (blockChildren.length === 1) {
    children.push({
      nodeExpr: blockChildren[0].nodeExpr,
      condIdx: condIdx,
      dynBufId: blockChildren[0].dynBufId,
    });
    return;
  }

  // Inside a map context: push each child individually with condIdx.
  // Don't create static array declarations — they inflate ctx.arrayCounter
  // but get consumed by the map pool, causing misaligned references.
  if (ctx.currentMap) {
    for (var mi = 0; mi < blockChildren.length; mi++) {
      children.push({
        nodeExpr: blockChildren[mi].nodeExpr,
        condIdx: condIdx,
        dynBufId: blockChildren[mi].dynBufId,
      });
    }
    return;
  }

  // Outside maps: wrap in a flex-column container with static array
  var arrName = '_arr_' + ctx.arrayCounter++;
  var childExprs = [];
  for (var i = 0; i < blockChildren.length; i++) {
    childExprs.push(blockChildren[i].nodeExpr);
  }
  ctx.arrayDecls.push('var ' + arrName + ' = [_]Node{ ' + childExprs.join(', ') + ' };');
  children.push({
    nodeExpr: '.{ .style = .{ .flex_direction = .column }, .children = &' + arrName + ' }',
    condIdx: condIdx,
  });
}

// ── <if condition> ... </if> ──

function parseIfBlock(c, children) {
  c.advance(); // skip <
  c.advance(); // skip 'if'

  var condExpr = parseBlockCondition(c); // reads tokens, advances past >

  var ifChildren = parseChildren(c); // stops at </if>

  // Consume </if>
  if (c.kind() === TK.lt_slash) {
    c.advance(); // skip </
    if (c.kind() === TK.identifier && c.text() === 'if') c.advance();
    if (c.kind() === TK.gt) c.advance();
  }

  var condIdx = ctx.conditionals.length;
  ctx.conditionals.push({ condExpr: condExpr, kind: 'show_hide', inMap: !!ctx.currentMap });

  wrapConditionalChildren(ifChildren, condIdx, children);

  // Store for subsequent <else if> / <else> blocks
  ctx._lastIfCondExpr = condExpr;

  return true;
}

// ── <else if condition> ... </else> or <else> ... </else> ──

function parseElseBlock(c, children) {
  c.advance(); // skip <
  c.advance(); // skip 'else'

  var isElseIf = false;
  var condExpr;

  // Check for <else if ...>
  if (c.kind() === TK.identifier && c.text() === 'if') {
    isElseIf = true;
    c.advance(); // skip 'if'
    condExpr = parseBlockCondition(c);
  } else {
    // Bare <else>
    if (c.kind() === TK.gt) c.advance();
    condExpr = null;
  }

  var elseChildren = parseChildren(c); // stops at </else>

  // Consume </else>
  if (c.kind() === TK.lt_slash) {
    c.advance(); // skip </
    if (c.kind() === TK.identifier && c.text() === 'else') c.advance();
    if (c.kind() === TK.gt) c.advance();
  }

  // Build condition from previous <if> context
  var finalCond;
  var prevCond = ctx._lastIfCondExpr || 'true';
  if (isElseIf) {
    finalCond = '!(' + prevCond + ') and (' + condExpr + ')';
    ctx._lastIfCondExpr = condExpr; // chain for further else-if
  } else {
    finalCond = '!(' + prevCond + ')';
  }

  var condIdx = ctx.conditionals.length;
  ctx.conditionals.push({ condExpr: finalCond, kind: 'show_hide', inMap: !!ctx.currentMap });

  wrapConditionalChildren(elseChildren, condIdx, children);

  return true;
}

// ── <during condition> ... </during> ──
// For rendering purposes, identical to <if> — shows children when condition is true.
// Semantic difference: <during> implies reactive lifecycle (re-checks on state change).
// The runtime already re-evaluates conditionals on state change, so the behavior is the same.

function parseDuringBlock(c, children) {
  c.advance(); // skip <
  c.advance(); // skip 'during'

  var condExpr = parseBlockCondition(c);

  var duringChildren = parseChildren(c); // stops at </during>

  // Consume </during>
  if (c.kind() === TK.lt_slash) {
    c.advance(); // skip </
    if (c.kind() === TK.identifier && c.text() === 'during') c.advance();
    if (c.kind() === TK.gt) c.advance();
  }

  var condIdx = ctx.conditionals.length;
  ctx.conditionals.push({ condExpr: condExpr, kind: 'show_hide', inMap: !!ctx.currentMap });

  wrapConditionalChildren(duringChildren, condIdx, children);

  return true;
}
