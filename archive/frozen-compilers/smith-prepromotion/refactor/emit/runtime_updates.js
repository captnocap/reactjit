// Emit runtime update/support functions that are consumed by runtime entrypoints

function emitRuntimeSupportSections(ctx, meta) {
  const promotedToPerItem = meta.promotedToPerItem;
  const rootExpr = meta.rootExpr;
  const prefix = meta.prefix;
  const fastBuild = meta.fastBuild;

  let out = '';

  const mapPoolArrayNames = new Set();
  for (const map of ctx.maps) {
    if (!map._mapPerItemDecls) continue;
    for (const perItemDecl of map._mapPerItemDecls) mapPoolArrayNames.add(perItemDecl.name);
  }

  out += `fn _updateDynamicTexts() void {\n`;
  for (const dt of ctx.dynTexts) {
    if (dt.inMap) continue;
    if (dt.arrName && mapPoolArrayNames.has(dt.arrName)) continue;
    out += `    _dyn_text_${dt.bufId} = std.fmt.bufPrint(&_dyn_buf_${dt.bufId}, "${dt.fmtString}", .{ ${dt.fmtArgs} }) catch "";\n`;
    const dtField = dt.targetField || 'text';
    if (dt.arrName) {
      out += `    ${dt.arrName}[${dt.arrIndex}].${dtField} = _dyn_text_${dt.bufId};\n`;
    } else {
      out += `    _root.${dtField} = _dyn_text_${dt.bufId};\n`;
    }
  }

  const dynUpdates = [];
  for (const dc of ctx.dynColors) {
    if (dc.arrName && promotedToPerItem.has(dc.arrName)) continue;
    if (dc.arrName && dc.arrIndex >= 0) {
      const arrNum = parseInt(dc.arrName.replace('_arr_', ''));
      dynUpdates.push({ arrNum: arrNum, arrIndex: dc.arrIndex, line: `    ${dc.arrName}[${dc.arrIndex}].text_color = ${dc.colorExpr};\n` });
    }
  }
  if (ctx.dynStyles && ctx.dynStyles.length > 0) {
    for (const ds of ctx.dynStyles) {
      if (ds.expression && (ds.expression.includes('_i)') || ds.expression.includes('_i]') || ds.expression.includes('(_i'))) continue;
      if (ds.arrName && promotedToPerItem.has(ds.arrName)) continue;
      if (ds.arrName && ds.arrIndex >= 0) {
        const arrNum = parseInt(ds.arrName.replace('_arr_', ''));
        const nodeFields = ['text_color', 'font_size', 'text'];
        const fieldPrefix = nodeFields.includes(ds.field) ? '' : 'style.';
        dynUpdates.push({ arrNum: arrNum, arrIndex: ds.arrIndex, line: `    ${ds.arrName}[${ds.arrIndex}].${fieldPrefix}${ds.field} = ${ds.expression};\n` });
      } else {
        const zigField = ds.field.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (rootExpr.includes(zigField) || rootExpr.includes(ds.field)) {
          const nodeFields = ['text_color', 'font_size', 'text'];
          const fieldPrefix = nodeFields.includes(ds.field) ? '' : 'style.';
          dynUpdates.push({ arrNum: 99998, arrIndex: 0, line: `    _root.${fieldPrefix}${ds.field} = ${ds.expression};\n` });
        }
      }
    }
  }
  dynUpdates.sort(function(a, b) {
    return a.arrNum - b.arrNum || a.arrIndex - b.arrIndex;
  });
  for (const update of dynUpdates) out += update.line;
  out += `}\n\n`;

  const hasConds = ctx.conditionals.length > 0;
  if (hasConds) {
    out += `fn _updateConditionals() void {\n`;
    for (const cond of ctx.conditionals) {
      if (!cond.arrName) continue;
      if (cond.inMap) continue;
      if (mapPoolArrayNames.has(cond.arrName)) continue;
      if (cond.condExpr.includes('[_i]') || cond.condExpr.includes('(_i)') || cond.condExpr.includes('task.') || cond.condExpr.includes('tag.') || cond.condExpr.includes(' ci') || cond.condExpr.includes(' ti')) continue;
      const isComparison = cond.condExpr.includes('==') || cond.condExpr.includes('!=') ||
        cond.condExpr.includes('>=') || cond.condExpr.includes('<=') ||
        cond.condExpr.includes(' > ') || cond.condExpr.includes(' < ') ||
        cond.condExpr.includes('getBool') || cond.condExpr.includes('getSlotBool') || cond.condExpr.includes('std.mem.eql');
      const wrapped = isComparison ? `((${cond.condExpr}))` : `((${cond.condExpr}) != 0)`;
      if (cond.kind === 'show_hide') {
        out += `    ${cond.arrName}[${cond.trueIdx}].style.display = if ${wrapped} .flex else .none;\n`;
      } else if (cond.kind === 'ternary_jsx') {
        out += `    ${cond.arrName}[${cond.trueIdx}].style.display = if ${wrapped} .flex else .none;\n`;
        out += `    ${cond.arrName}[${cond.falseIdx}].style.display = if ${wrapped} .none else .flex;\n`;
      }
    }
    out += `}\n\n`;
  }

  out += `\n`;

  const hasVariants = ctx.variantBindings && ctx.variantBindings.length > 0;
  if (hasVariants) {
    out += `fn _updateVariants() void {\n`;
    const hasBp = ctx.variantBindings.some(function(vb) { return vb.bpStyles; });
    if (fastBuild) {
      if (hasBp) {
        out += `    const _bp_tier = @as(u8, api.breakpoint.rjit_breakpoint_current());\n`;
      }
      out += `    const _v = @as(usize, api.theme.rjit_theme_active_variant());\n`;
    } else {
      out += `    const _theme = @import("${prefix}theme.zig");\n`;
      if (hasBp) {
        out += `    const _bp = @import("${prefix}breakpoint.zig");\n`;
        out += `    const _bp_tier = @intFromEnum(_bp.current());\n`;
      }
      out += `    const _v = @as(usize, _theme.activeVariant());\n`;
    }

    function styleAssignments(target, styleStr, indent) {
      if (!styleStr) return '';
      return styleStr.split(/,\s*(?=\.)/).map(function(field) {
        field = field.trim();
        if (!field.startsWith('.')) return '';
        var eqIdx = field.indexOf('=');
        if (eqIdx < 0) return '';
        var styleField = field.slice(1, eqIdx).trim();
        var value = field.slice(eqIdx + 1).trim();
        return `${indent}${target}.style.${styleField} = ${value};\n`;
      }).join('');
    }

    for (const vb of ctx.variantBindings) {
      if (vb.inMap) continue;
      if (vb.arrName && promotedToPerItem.has(vb.arrName)) continue;
      if (!vb.arrName && vb.inComponent) continue;
      const target = vb.arrName ? `${vb.arrName}[${vb.arrIndex}]` : '_root';
      if (vb.bpStyles) {
        let bpBlock = '';
        if (vb.bpStyles.sm) {
          bpBlock += `    if (_bp_tier == 0) {\n${styleAssignments(target, vb.bpStyles.sm, '        ')}    }\n`;
        }
        if (vb.bpStyles.md) {
          const bpPrefix = vb.bpStyles.sm ? '    else ' : '    ';
          bpBlock += `${bpPrefix}if (_bp_tier == 1) {\n${styleAssignments(target, vb.bpStyles.md, '        ')}    }\n`;
        }
        const elsePrefix = (vb.bpStyles.sm || vb.bpStyles.md) ? '    else ' : '    ';
        bpBlock += `${elsePrefix}{\n`;
        for (let vi = 0; vi < vb.styles.length; vi++) {
          if (vi === 0) {
            bpBlock += `        if (_v == 0) {\n${styleAssignments(target, vb.styles[0], '            ')}        }\n`;
          } else {
            bpBlock += `        else if (_v == ${vi}) {\n${styleAssignments(target, vb.styles[vi], '            ')}        }\n`;
          }
        }
        bpBlock += `    }\n`;
        out += bpBlock;
      } else {
        for (let vi = 0; vi < vb.styles.length; vi++) {
          if (vi === 0) {
            out += `    if (_v == 0) {\n${styleAssignments(target, vb.styles[0], '        ')}    }\n`;
          } else {
            out += `    else if (_v == ${vi}) {\n${styleAssignments(target, vb.styles[vi], '        ')}    }\n`;
          }
        }
      }
      if (vb.bpStyles) {
        const smIsCol = vb.bpStyles.sm && vb.bpStyles.sm.includes('.column');
        if (smIsCol) {
          const parentDecl = ctx.arrayDecls.find(function(decl) {
            return decl.includes(`var ${vb.arrName} =`);
          });
          if (parentDecl) {
            const allChildRefs = [];
            const re = /\.children\s*=\s*&(_arr_\d+)/g;
            let match;
            while ((match = re.exec(parentDecl)) !== null) allChildRefs.push(match[1]);
            const childArr = allChildRefs[vb.arrIndex];
            if (childArr) {
              const childDecl = ctx.arrayDecls.find(function(decl) {
                return decl.includes(`var ${childArr} =`);
              });
              if (childDecl) {
                const nodeStr = childDecl.slice(childDecl.indexOf('[_]Node{') + 8);
                let idx = 0;
                let depth = 0;
                let nodeStart = 0;
                for (let ci = 0; ci < nodeStr.length; ci++) {
                  if (nodeStr[ci] === '{') depth++;
                  if (nodeStr[ci] === '}') {
                    depth--;
                    if (depth === 0) {
                      const nodeChunk = nodeStr.slice(nodeStart, ci + 1).trim();
                      if (/^\.{\s*\.style\s*=\s*\.{\s*\.flex_grow\s*=\s*1\s*}\s*}$/.test(nodeChunk)) {
                        out += `    if (_bp_tier == 0) { ${childArr}[${idx}].style.flex_grow = 0; }\n`;
                        out += `    else { ${childArr}[${idx}].style.flex_grow = 1; }\n`;
                      }
                      idx++;
                      nodeStart = ci + 1;
                      while (nodeStart < nodeStr.length && (nodeStr[nodeStart] === ',' || nodeStr[nodeStart] === ' ')) nodeStart++;
                    }
                  }
                }
              }
            }
          }
        }
      }
      if (vb.nodeFieldStrs && vb.nodeFieldStrs.some(function(nf) { return nf.length > 0; })) {
        for (let vi = 0; vi < vb.nodeFieldStrs.length; vi++) {
          if (!vb.nodeFieldStrs[vi]) continue;
          const nfParts = vb.nodeFieldStrs[vi].split(/,\s*(?=\.)/).filter(function(part) {
            return part.trim().startsWith('.');
          });
          for (const nf of nfParts) {
            const eqIdx = nf.indexOf('=');
            if (eqIdx < 0) continue;
            const field = nf.slice(1, eqIdx).trim();
            const value = nf.slice(eqIdx + 1).trim();
            if (vi === 0) {
              out += `    if (_v == 0) { ${target}.${field} = ${value}; }\n`;
            } else {
              out += `    else if (_v == ${vi}) { ${target}.${field} = ${value}; }\n`;
            }
          }
        }
      }
    }

    for (const vb of ctx.variantBindings) {
      if (!vb.inMap) continue;
      const mapIdx = ctx.maps.findIndex(function(map) {
        return !map.isNested && !map.isInline;
      });
      if (mapIdx < 0) continue;
      const hasAnyStyleFields = vb.styles.some(function(styleStr) {
        return styleStr && styleStr.split(/,\s*(?=\.)/).some(function(field) {
          return field.trim().startsWith('.');
        });
      });
      if (!hasAnyStyleFields) continue;
      out += `    // Map variant patch: ${vb.clsName}\n`;
      out += `    for (0.._map_count_${mapIdx}) |_mi| {\n`;
      for (let vi = 0; vi < vb.styles.length; vi++) {
        if (!vb.styles[vi]) continue;
        const fields = vb.styles[vi].split(/,\s*(?=\.)/).filter(function(field) {
          return field.trim().startsWith('.');
        });
        const assignments = fields.map(function(field) {
          const eqIdx = field.indexOf('=');
          if (eqIdx < 0) return '';
          const styleField = field.trim().slice(1, eqIdx).trim();
          const value = field.slice(eqIdx + 1).trim();
          return `            _map_pool_${mapIdx}[_mi].style.${styleField} = ${value};\n`;
        }).join('');
        if (vi === 0) {
          out += `        if (_v == 0) {\n${assignments}        }\n`;
        } else {
          out += `        else if (_v == ${vi}) {\n${assignments}        }\n`;
        }
      }
      out += `    }\n`;
    }
    out += `}\n\n`;
  }

  if (ctx._inputSubmitHandlers) {
    for (const h of ctx._inputSubmitHandlers) {
      out += `fn _inputSubmit${h.inputId}() void {\n`;
      out += `    qjs_runtime.evalExpr("${h.jsBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}");\n`;
      out += `}\n`;
    }
  }
  if (ctx._inputChangeHandlers) {
    for (const h of ctx._inputChangeHandlers) {
      out += `fn _inputChange${h.inputId}() void {\n`;
      out += `    qjs_runtime.evalExpr("${h.jsBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}");\n`;
      out += `}\n`;
    }
  }

  return {
    out: out,
    hasConds: hasConds,
    hasVariants: hasVariants,
    hasDynStyles: ctx.dynStyles && ctx.dynStyles.length > 0,
    hasFlatMaps: ctx.maps.some(function(map) { return !map.isNested && !map.isInline; }),
  };
}
