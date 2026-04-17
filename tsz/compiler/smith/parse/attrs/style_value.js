// ── Style value parser (from attrs.js) ──

function parseStyleValue(c) {
  if (c.kind() === TK.string) {
    const raw = c.text(); c.advance();
    return { type: 'string', value: raw.slice(1, -1) };
  }
  if (c.kind() === TK.number) {
    const val = c.text(); c.advance();
    return { type: 'number', value: val };
  }
  if (c.kind() === TK.minus && c.pos + 1 < c.count && c.kindAt(c.pos+1) === TK.number) {
    c.advance(); const val = '-' + c.text(); c.advance();
    return { type: 'number', value: val };
  }
  if (c.kind() === TK.identifier) {
    const name = c.text();
    // OA getter followed by [mapIndex].field → resolve to OA field access
    const _svOa = ctx.objectArrays ? ctx.objectArrays.find(o => o.getter === name) : null;
    if (_svOa && c.pos + 4 < c.count && c.kindAt(c.pos + 1) === TK.lbracket) {
      const saved = c.save();
      c.advance(); // skip name
      c.advance(); // skip [
      // Check if bracket contains map index param or a prop that resolves to map index
      let isMapIdx = false;
      if (c.kind() === TK.identifier) {
        const bracketName = c.text();
        isMapIdx = (ctx.currentMap && bracketName === ctx.currentMap.indexParam) ||
                   (ctx.propStack && ctx.propStack[bracketName] !== undefined &&
                    typeof ctx.propStack[bracketName] === 'string' &&
                    ctx.propStack[bracketName].includes('@intCast('));
      }
      if (isMapIdx && c.pos + 3 < c.count) {
        c.advance(); // skip index identifier
        if (c.kind() === TK.rbracket) {
          c.advance(); // skip ]
          if (c.kind() === TK.dot) {
            c.advance(); // skip .
            if (c.kind() === TK.identifier) {
              const field = c.text(); c.advance();
              const iterVar = (ctx.currentMap && ctx.currentMap.iterVar) || '_i';
              const fi = _svOa.fields.find(f => f.name === field);
              if (fi && fi.type === 'string') {
                return { type: 'map_field', value: `_oa${_svOa.oaIdx}_${field}[${iterVar}]`, zigExpr: `_oa${_svOa.oaIdx}_${field}[${iterVar}][0.._oa${_svOa.oaIdx}_${field}_lens[${iterVar}]]`, fieldType: 'string' };
              }
              return { type: 'map_field', value: `_oa${_svOa.oaIdx}_${field}[${iterVar}]`, zigExpr: `_oa${_svOa.oaIdx}_${field}[${iterVar}]`, fieldType: fi ? fi.type : 'int' };
            }
          }
        }
      }
      c.restore(saved);
    }
    if (isGetter(name)) {
      var slotType = null;
      if (ctx && ctx.stateSlots) {
        const slot = ctx.stateSlots.find(s => s.getter === name);
        if (slot && slot.type) slotType = slot.type;
      }
      c.advance();
      return { type: 'state', value: name, zigExpr: slotGet(name), exprType: slotType || 'number' };
    }
    // Map item member access: tag.field (supports multi-level: tag.config.theme.bg)
    if (ctx.currentMap && name === ctx.currentMap.itemParam) {
      c.advance(); // skip item name
      if (c.kind() === TK.dot) {
        c.advance(); // skip .
        if (c.kind() === TK.identifier) {
          let field = c.text(); c.advance();
          // Multi-level dot access: item.config.theme.bg → config_theme_bg
          while (c.kind() === TK.dot && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
            c.advance(); field += '_' + c.text(); c.advance();
          }
          const oa = ctx.currentMap.oa;
          const fi = oa.fields.find(f => f.name === field);
          if (fi) {
            const oaIdx = oa.oaIdx;
            const zigExpr = fi.type === 'string' ? `_oa${oaIdx}_${field}[_i][0.._oa${oaIdx}_${field}_lens[_i]]` : `_oa${oaIdx}_${field}[_i]`;
            return { type: 'map_field', value: `_oa${oaIdx}_${field}[_i]`, zigExpr, fieldType: fi.type };
          } else {
            // Field exists but wasn't in schema — emit anyway
            const oaIdx = oa.oaIdx;
            return { type: 'map_field', value: `_oa${oaIdx}_${field}[_i]`, zigExpr: `_oa${oaIdx}_${field}[_i]`, fieldType: 'int' };
          }
        }
      }
      return { type: 'unknown', value: '' };
    }
    // Map index param (i, idx, etc.) — supports ternary/modulo in style blocks
    if (ctx.currentMap && name === ctx.currentMap.indexParam) {
      c.advance();
      return { type: 'map_index', value: name, zigExpr: `@as(i64, @intCast(_i))` };
    }
    // Render-local variable reference
    if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
      c.advance();
      const resolved = _legacyStyleValueFromResolved(_resolveStyleIdentifierValue(name));
      if (resolved) return resolved;
      const rlv = ctx.renderLocals[name];
      if (/^-?\d+(\.\d+)?$/.test(rlv)) return { type: 'number', value: rlv };
      if (rlv.startsWith('#') || namedColors[rlv]) return { type: 'string', value: rlv };
      const isZigExpr = rlv.includes('state.get') || rlv.includes('getSlot') || rlv.includes('_oa') || rlv.includes('@as');
      if (isZigExpr) return { type: 'state', value: name, zigExpr: rlv, exprType: 'number' };
      return { type: 'number', value: rlv };
    }
    // Prop reference — detect type from prop value
    if (ctx.propStack[name] !== undefined) {
      c.advance();
      const resolved = _legacyStyleValueFromResolved(_resolveStyleIdentifierValue(name));
      if (resolved) return resolved;
      const pv = ctx.propStack[name];
      if (pv.startsWith('#') || namedColors[pv]) return { type: 'string', value: pv };
      // Detect OA field references passed through props (e.g., proj.color → _oa0_color[_i])
      const oaMatch = pv.match(/^_oa(\d+)_(\w+)\[/);
      if (oaMatch) {
        // Determine field type from the OA schema
        const oaIdx = parseInt(oaMatch[1]);
        const fieldName = oaMatch[2];
        const srcOa = ctx.objectArrays ? ctx.objectArrays.find(o => o.oaIdx === oaIdx) : null;
        const fi = srcOa ? srcOa.fields.find(f => f.name === fieldName) : null;
        const fieldType = fi ? fi.type : 'int';
        return { type: 'map_field', value: pv, zigExpr: pv, fieldType };
      }
      // Check for arithmetic after prop: prop * N, prop / N
      if (/^-?\d+(\.\d+)?$/.test(pv) && (c.kind() === TK.star || c.kind() === TK.slash || c.kind() === TK.plus || c.kind() === TK.minus)) {
        const op = c.kind(); c.advance();
        if (c.kind() === TK.number) {
          const rhs = parseFloat(c.text()); c.advance();
          const lhs = parseFloat(pv);
          const result = op === TK.star ? lhs * rhs : op === TK.slash ? lhs / rhs : op === TK.plus ? lhs + rhs : lhs - rhs;
          return { type: 'number', value: String(Math.round(result)) };
        }
      }
      // Check if prop value is a Zig expression that needs zigExpr for ternary resolution
      const isZigExpr = typeof pv === 'string' && (pv.includes('state.get') || pv.includes('getSlot') || pv.includes('_oa') || pv.includes('@as') || pv.includes('if ('));
      if (isZigExpr) {
        // Wrap if-expressions in parens so they compose safely in further comparisons
        const zigExpr = pv.startsWith('if (') ? '(' + pv + ')' : pv;
        return { type: 'state', value: name, zigExpr, exprType: 'number' };
      }
      // Ensure numeric props have zigExpr so ternary resolution works (prop == N ? A : B)
      return { type: 'number', value: pv, zigExpr: pv };
    }
  }
  c.advance();
  return { type: 'unknown', value: '' };
}

function _legacyStyleValueFromResolved(spec) {
  if (!spec) return null;
  if (spec.kind === 'literal') {
    if (spec.type === 'bool') {
      return {
        type: 'number',
        value: spec.value === 'true' ? '1' : '0',
        zigExpr: spec.value,
        exprType: 'bool',
      };
    }
    return { type: spec.type === 'string' ? 'string' : 'number', value: spec.value };
  }
  if (spec.kind === 'expr') {
    return {
      type: 'state',
      value: spec.expr,
      zigExpr: spec.expr,
      exprType: spec.type || 'number',
    };
  }
  return null;
}
