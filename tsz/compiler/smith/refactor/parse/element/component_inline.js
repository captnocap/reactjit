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
      if (c.isIdent('const') || c.isIdent('let')) {
        c.advance();
        if (c.kind() === TK.lbracket) {
          let bd = 1; c.advance();
          while (c.pos < c.count && bd > 0) {
            if (c.kind() === TK.lbracket) bd++;
            if (c.kind() === TK.rbracket) bd--;
            c.advance();
          }
          while (c.pos < c.count && c.kind() !== TK.rparen && !c.isIdent('const') && !c.isIdent('let') && !c.isIdent('return')) c.advance();
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
              if (depth === 0 && c.kind() === TK.identifier && (c.text() === 'const' || c.text() === 'let' || c.text() === 'return' || c.text() === 'function')) break;
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
              if (c.kind() === TK.identifier && ctx.renderLocals[c.text()] !== undefined) {
                valParts.push(ctx.renderLocals[c.text()]);
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
              } else if (c.kind() === TK.star || c.kind() === TK.plus || c.kind() === TK.minus || c.kind() === TK.slash || c.kind() === TK.percent) {
                valParts.push(' ' + c.text() + ' ');
              } else {
                valParts.push(c.text());
              }
              c.advance();
            }
            const valStr = valParts.join('');
            if (!valStr.includes('useState')) {
              ctx.renderLocals[varName] = valStr;
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
