// ── <For each=X> loop lowering ────────────────────────────────────

function parseForEachName(c) {
  var arrayName = '';
  while (c.kind() !== TK.gt && c.kind() !== TK.slash_gt && c.kind() !== TK.eof) {
    if (c.kind() === TK.identifier && c.text() === 'each') {
      c.advance();
      if (c.kind() === TK.equals) c.advance();
      if (c.kind() === TK.identifier) {
        arrayName = c.text();
        c.advance();
      } else if (c.kind() === TK.string) {
        arrayName = c.text().slice(1, -1);
        c.advance();
      } else if (c.kind() === TK.lbrace) {
        c.advance();
        if (c.kind() === TK.identifier) {
          arrayName = c.text();
          c.advance();
        }
        var braceDepth = 1;
        while (braceDepth > 0 && c.kind() !== TK.eof) {
          if (c.kind() === TK.lbrace) braceDepth++;
          if (c.kind() === TK.rbrace) {
            braceDepth--;
            if (braceDepth === 0) break;
          }
          c.advance();
        }
        if (c.kind() === TK.rbrace) c.advance();
      }
    } else {
      c.advance();
    }
  }
  if (c.kind() === TK.gt) c.advance();
  return arrayName;
}

function resolveForLoopOa(c, arrayName) {
  var oa = ctx.objectArrays.find(function(o) { return o.getter === arrayName; });
  if (!oa) oa = inferOaFromSource(c, arrayName);
  if (!oa && ctx.scriptBlock) {
    for (var oi = 0; oi < ctx.objectArrays.length; oi++) {
      var candidate = ctx.objectArrays[oi];
      if (candidate.isNested || candidate.isConst) continue;
      var fnRe = new RegExp('function\\s+' + arrayName + '\\b[^}]*\\b' + candidate.getter + '\\b');
      if (fnRe.test(ctx.scriptBlock)) {
        oa = candidate;
        break;
      }
    }
  }
  if (!oa) {
    var oaIdx = ctx.objectArrays.length;
    oa = {
      fields: [{ name: '_v', type: 'string' }],
      getter: arrayName,
      setter: 'set_' + arrayName,
      oaIdx: oaIdx,
      isSimpleArray: true,
    };
    ctx.objectArrays.push(oa);
  }
  return oa;
}

function attachForTemplateChildren(templateChildren) {
  var parts = [];
  if (templateChildren.length === 0) return parts;

  var arrName = '_arr_' + ctx.arrayCounter++;
  var childDecls = [];
  for (var ti = 0; ti < templateChildren.length; ti++) {
    childDecls.push(templateChildren[ti].nodeExpr);
    if (templateChildren[ti].condIdx !== undefined) {
      var tc = ctx.conditionals[templateChildren[ti].condIdx];
      if (tc) {
        tc.arrName = arrName;
        tc.trueIdx = ti;
      }
    }
    if (templateChildren[ti].ternaryCondIdx !== undefined) {
      var tc2 = ctx.conditionals[templateChildren[ti].ternaryCondIdx];
      if (tc2) {
        tc2.arrName = arrName;
        if (templateChildren[ti].ternaryBranch === 'true') tc2.trueIdx = ti;
        else tc2.falseIdx = ti;
      }
    }
    if (templateChildren[ti].dynBufId !== undefined) {
      var dt = ctx.dynTexts.find(function(d) { return d.bufId === templateChildren[ti].dynBufId; });
      if (dt && !dt.arrName) {
        dt.arrName = arrName;
        dt.arrIndex = ti;
      }
    }
  }
  ctx.arrayDecls.push('var ' + arrName + ' = [_]Node{ ' + childDecls.join(', ') + ' };');
  parts.push('.children = &' + arrName);
  return parts;
}

function parseForTemplateNode(c) {
  if (c.kind() === TK.lbrace) {
    var templateChildren = parseChildren(c);
    return { nodeExpr: '.{ ' + attachForTemplateChildren(templateChildren).join(', ') + ' }' };
  }
  return parseJSXElement(c);
}

function consumeForClose(c) {
  if (c.kind() === TK.lt_slash) {
    c.advance();
    if (c.kind() === TK.identifier && c.text() === 'For') c.advance();
    if (c.kind() === TK.gt) c.advance();
  }
}

function parseForLoop(c) {
  c.advance();
  c.advance();

  var arrayName = parseForEachName(c);
  if (!arrayName) return null;

  var oa = resolveForLoopOa(c, arrayName);
  var savedMapCtx = ctx.currentMap;
  var isInline = !!(savedMapCtx && savedMapCtx.oaIdx !== oa.oaIdx);
  var mapInfo = createMapInfo({
    oa: oa,
    itemParam: 'item',
    indexParam: 'index',
    parentMap: savedMapCtx,
    iterVar: isInline ? '_j' : '_i',
  }, {
    isInline: isInline,
    isSimpleArray: !!oa.isSimpleArray,
  });

  var mapScope = enterMapContext(mapInfo);
  var templateNode = parseForTemplateNode(c);
  exitMapContext(mapScope);
  consumeForClose(c);

  return finalizeMapNode(mapInfo, templateNode);
}
