// ── JSX component call inlining ───────────────────────────────────

function parseComponentCallChildren(c) {
  let compChildren = null;
  if (c.kind() === TK.slash_gt) {
    c.advance();
  } else if (c.kind() === TK.gt) {
    c.advance();
    compChildren = parseChildren(c);
    if (c.kind() === TK.lt_slash) {
      c.advance();
      if (c.kind() === TK.identifier) c.advance();
      if (c.kind() === TK.gt) c.advance();
    }
  }
  return compChildren;
}

function inlineComponentCall(c, comp, rawTag, propValues, compChildren) {
  const savedPos = c.save();
  const savedProps = ctx.propStack;
  const savedInline = ctx.inlineComponent;
  const savedChildren = ctx.componentChildren;
  const savedMapCtx = ctx.currentMap;
  const savedArrayDecls = ctx.arrayDecls;
  const savedArrayComments = ctx.arrayComments;

  ctx.propStack = propValues;
  ctx.inlineComponent = rawTag;
  ctx.componentChildren = compChildren;

  // Set propsObjectName for bare-param components: function Comp(props) { ... props.X ... }
  const savedPropsObjectName = ctx.propsObjectName;
  if (comp.isBareParams && comp.propNames.length === 1) {
    ctx.propsObjectName = comp.propNames[0];
  } else {
    ctx.propsObjectName = null;
  }

  const savedSlotRemap = ctx.slotRemap || {};
  const savedNameRemap = ctx.nameRemap || {};
  const instanceSlotRemap = {};
  const instanceNameRemap = {};
  for (const cs of (comp.stateSlots || [])) {
    const newIdx = ctx.stateSlots.length;
    const uniqueGetter = cs.getter + '_' + newIdx;
    const uniqueSetter = cs.setter + '_' + newIdx;
    ctx.stateSlots.push({ getter: uniqueGetter, setter: uniqueSetter, initial: cs.initial, type: cs.type });
    instanceSlotRemap[cs.getter] = newIdx;
    instanceSlotRemap[cs.setter] = newIdx;
    instanceNameRemap[cs.getter] = uniqueGetter;
    instanceNameRemap[cs.setter] = uniqueSetter;
  }
  ctx.slotRemap = Object.assign({}, savedSlotRemap, instanceSlotRemap);
  ctx.nameRemap = Object.assign({}, savedNameRemap, instanceNameRemap);

  // Collect render locals for inlined component body (between funcBodyPos and bodyPos)
  // Handles patterns like: const isActive = props.active === 1;
  const savedRenderLocals = Object.assign({}, ctx.renderLocals);
  if (comp.funcBodyPos >= 0 && comp.bodyPos > comp.funcBodyPos) {
    const rlSaved = c.save();
    c.pos = comp.funcBodyPos;
    if (c.kind() === TK.lbrace) c.advance();
    while (c.pos < comp.bodyPos) {
      if (c.isIdent('return')) break;
      if (c.isIdent('const') || c.isIdent('let') || c.isIdent('var')) {
        c.advance();
        if (c.kind() === TK.lbracket) {
          let bd = 1; c.advance();
          while (c.pos < c.count && bd > 0) {
            if (c.kind() === TK.lbracket) bd++;
            if (c.kind() === TK.rbracket) bd--;
            c.advance();
          }
          while (c.pos < c.count && c.kind() !== TK.rparen && !c.isIdent('const') && !c.isIdent('let') && !c.isIdent('var') && !c.isIdent('return')) c.advance();
          if (c.kind() === TK.rparen) c.advance();
          continue;
        }
        if (c.kind() === TK.identifier) {
          const varName = c.text(); c.advance();
          if (c.kind() === TK.equals) {
            c.advance();
            let valParts = [];
            let depth = 0;
            while (c.pos < c.count) {
              if (c.kind() === TK.semicolon && depth === 0) { c.advance(); break; }
              if (depth === 0 && c.kind() === TK.identifier && (c.text() === 'const' || c.text() === 'let' || c.text() === 'var' || c.text() === 'return' || c.text() === 'function')) break;
              if (c.kind() === TK.lparen || c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
              if (c.kind() === TK.rparen || c.kind() === TK.rbracket || c.kind() === TK.rbrace) { depth--; if (depth < 0) break; }
              const pa = peekPropsAccess(c);
              if (pa) {
                let pv = typeof pa.value === 'string' ? pa.value : String(pa.value);
                // Wrap if-expressions in parens so Zig operator precedence works
                if (pv.includes('if (') && pv.includes(' else ')) pv = '(' + pv + ')';
                valParts.push(pv);
                skipPropsAccess(c);
                continue;
              }
              // Const OA bracket access: nodes[0] or nodes[0].field
              var _coaResult = resolveConstOaAccess(c);
              if (_coaResult) {
                valParts.push(_coaResult.value);
                for (var _csk = 1; _csk < _coaResult.skip; _csk++) c.advance();
                c.advance();
                continue;
              }
              if (c.kind() === TK.identifier && ctx.renderLocals[c.text()] !== undefined) {
                const rlv = ctx.renderLocals[c.text()];
                // Const OA row ref with .field access
                if (typeof rlv === 'string' && rlv.charCodeAt(0) === 1 &&
                    c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
                  var _fv = resolveConstOaFieldFromRef(rlv, c.textAt(c.pos + 2));
                  if (_fv !== null) {
                    valParts.push(_fv);
                    c.advance(); c.advance(); // skip name and dot; field advanced by loop
                  } else {
                    valParts.push(rlv);
                  }
                // If renderLocal resolves to map itemParam and next is .field, resolve to OA field
                } else if (ctx.currentMap && rlv === ctx.currentMap.itemParam &&
                    c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
                  c.advance(); // skip name
                  c.advance(); // skip .
                  const rlField = c.text();
                  const mapOa = ctx.currentMap.oa;
                  const rlFieldInfo = mapOa ? mapOa.fields.find(function(f) { return f.name === rlField; }) : null;
                  if (mapOa && rlFieldInfo && rlFieldInfo.type === 'string') {
                    valParts.push(`_oa${mapOa.oaIdx}_${rlField}[${ctx.currentMap.iterVar || '_i'}][0.._oa${mapOa.oaIdx}_${rlField}_lens[${ctx.currentMap.iterVar || '_i'}]]`);
                  } else if (mapOa) {
                    valParts.push(`_oa${mapOa.oaIdx}_${rlField}[${ctx.currentMap.iterVar || '_i'}]`);
                  } else {
                    valParts.push(rlv + '.' + rlField);
                  }
                } else {
                  valParts.push(rlv);
                }
              } else if (c.kind() === TK.identifier && isGetter(c.text())) {
                valParts.push(slotGet(c.text()));
              } else if (c.kind() === TK.eq_eq) {
                valParts.push(' == ');
                c.advance();
                if (c.kind() === TK.equals) c.advance();
                continue;
              } else if (c.kind() === TK.not_eq) {
                valParts.push(' != ');
                c.advance();
                if (c.kind() === TK.equals) c.advance();
                continue;
              } else if (c.kind() === TK.star || c.kind() === TK.plus || c.kind() === TK.minus || c.kind() === TK.slash || c.kind() === TK.percent ||
                         c.kind() === TK.gt || c.kind() === TK.lt || c.kind() === TK.gt_eq || c.kind() === TK.lt_eq) {
                valParts.push(' ' + c.text() + ' ');
              } else {
                // Convert .length to .len for Zig slice compatibility
                if (c.kind() === TK.identifier && c.text() === 'length' && valParts.length > 0 && valParts[valParts.length - 1] === '.') {
                  valParts.pop();
                  valParts.push('.len');
                } else {
                  valParts.push(c.text());
                }
              }
              c.advance();
            }
            const valStr = valParts.join('');
            if (!valStr.includes('useState')) {
              // Skip if this variable is a registered const OA
              var _isConstOa2 = false;
              for (var _coi2 = 0; _coi2 < ctx.objectArrays.length; _coi2++) {
                if (ctx.objectArrays[_coi2].getter === varName && ctx.objectArrays[_coi2].isConst) { _isConstOa2 = true; break; }
              }
              if (!_isConstOa2) {
                ctx.renderLocals[varName] = valStr;
              }
            }
          }
        }
        continue;
      }
      c.advance();
    }
    c.restore(rlSaved);
  }

  c.pos = comp.bodyPos;
  // -> PROBE INJECTED HERE
  print('[INLINE PROBE] Inlining component: ' + comp.name + ' bodyPos: ' + comp.bodyPos + ' token: ' + c.text() + ' kind: ' + c.kind());
  
  let result;
  if (c.kind() === TK.identifier) {
    const maybeArr = c.text();
    const oa = ctx.objectArrays.find(o => o.getter === maybeArr);
    if (oa) {
      result = tryParseMap(c, oa);
      while (c.kind() === TK.rparen || c.kind() === TK.semicolon) c.advance();
    }
    if (!result) result = { nodeExpr: '.{}' };
  } else {
    result = parseJSXElement(c);
  }

  ctx.propStack = savedProps;
  ctx.inlineComponent = savedInline;
  ctx.componentChildren = savedChildren;
  ctx.currentMap = savedMapCtx;
  ctx.arrayDecls = savedArrayDecls;
  ctx.arrayComments = savedArrayComments;
  ctx.slotRemap = savedSlotRemap;
  ctx.nameRemap = savedNameRemap;
  ctx.propsObjectName = savedPropsObjectName;
  ctx.renderLocals = savedRenderLocals;
  c.restore(savedPos);
  return result;
}
