// Atom 24: Variant/classifier style patches — emitVariantPatch
// Extracted from emit/runtime_updates.js lines 101-266
// This is the _updateVariants() block from emitRuntimeSupportSections.
// The variant patch logic: for each variantBinding, emit if/else chains
// that set style fields based on active variant index.
// Depends on: styleAssignments (atom 25)

function emitVariantPatch(ctx, meta) {
  var promotedToPerItem = meta.promotedToPerItem;
  var prefix = meta.prefix;
  var fastBuild = meta.fastBuild;

  var out = '';
  var hasVariants = ctx.variantBindings && ctx.variantBindings.length > 0;
  if (!hasVariants) return { out: '', hasVariants: false };

  out += 'fn _updateVariants() void {\n';
  var hasBp = ctx.variantBindings.some(function(vb) { return vb.bpStyles; });
  if (fastBuild) {
    if (hasBp) {
      out += '    const _bp_tier = @as(u8, api.breakpoint.rjit_breakpoint_current());\n';
    }
    out += '    const _v = @as(usize, api.theme.rjit_theme_active_variant());\n';
  } else {
    out += '    const _theme = @import("' + prefix + 'theme.zig");\n';
    if (hasBp) {
      out += '    const _bp = @import("' + prefix + 'breakpoint.zig");\n';
      out += '    const _bp_tier = @intFromEnum(_bp.current());\n';
    }
    out += '    const _v = @as(usize, _theme.activeVariant());\n';
  }

  for (var _vi = 0; _vi < ctx.variantBindings.length; _vi++) {
    var vb = ctx.variantBindings[_vi];
    if (vb.inMap) continue;
    if (vb.arrName && promotedToPerItem.has(vb.arrName)) continue;
    if (!vb.arrName && vb.inComponent) continue;
    var target = vb.arrName ? vb.arrName + '[' + vb.arrIndex + ']' : '_root';
    if (vb.bpStyles) {
      var bpBlock = '';
      if (vb.bpStyles.sm) {
        bpBlock += '    if (_bp_tier == 0) {\n' + styleAssignments(target, vb.bpStyles.sm, '        ') + '    }\n';
      }
      if (vb.bpStyles.md) {
        var bpPrefix = vb.bpStyles.sm ? '    else ' : '    ';
        bpBlock += bpPrefix + 'if (_bp_tier == 1) {\n' + styleAssignments(target, vb.bpStyles.md, '        ') + '    }\n';
      }
      var elsePrefix = (vb.bpStyles.sm || vb.bpStyles.md) ? '    else ' : '    ';
      bpBlock += elsePrefix + '{\n';
      for (var vi = 0; vi < vb.styles.length; vi++) {
        if (vi === 0) {
          bpBlock += '        if (_v == 0) {\n' + styleAssignments(target, vb.styles[0], '            ') + '        }\n';
        } else {
          bpBlock += '        else if (_v == ' + vi + ') {\n' + styleAssignments(target, vb.styles[vi], '            ') + '        }\n';
        }
      }
      bpBlock += '    }\n';
      out += bpBlock;
    } else {
      for (var vi = 0; vi < vb.styles.length; vi++) {
        if (vi === 0) {
          out += '    if (_v == 0) {\n' + styleAssignments(target, vb.styles[0], '        ') + '    }\n';
        } else {
          out += '    else if (_v == ' + vi + ') {\n' + styleAssignments(target, vb.styles[vi], '        ') + '    }\n';
        }
      }
    }
    if (vb.bpStyles) {
      var smIsCol = vb.bpStyles.sm && vb.bpStyles.sm.includes('.column');
      if (smIsCol) {
        var parentDecl = ctx.arrayDecls.find(function(decl) {
          return decl.includes('var ' + vb.arrName + ' =');
        });
        if (parentDecl) {
          var allChildRefs = [];
          var re = /\.children\s*=\s*&(_arr_\d+)/g;
          var match;
          while ((match = re.exec(parentDecl)) !== null) allChildRefs.push(match[1]);
          var childArr = allChildRefs[vb.arrIndex];
          if (childArr) {
            var childDecl = ctx.arrayDecls.find(function(decl) {
              return decl.includes('var ' + childArr + ' =');
            });
            if (childDecl) {
              var nodeStr = childDecl.slice(childDecl.indexOf('[_]Node{') + 8);
              var idx = 0;
              var depth = 0;
              var nodeStart = 0;
              for (var ci = 0; ci < nodeStr.length; ci++) {
                if (nodeStr[ci] === '{') depth++;
                if (nodeStr[ci] === '}') {
                  depth--;
                  if (depth === 0) {
                    var nodeChunk = nodeStr.slice(nodeStart, ci + 1).trim();
                    if (/^\.{\s*\.style\s*=\s*\.{\s*\.flex_grow\s*=\s*1\s*}\s*}$/.test(nodeChunk)) {
                      out += '    if (_bp_tier == 0) { ' + childArr + '[' + idx + '].style.flex_grow = 0; }\n';
                      out += '    else { ' + childArr + '[' + idx + '].style.flex_grow = 1; }\n';
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
      for (var vi = 0; vi < vb.nodeFieldStrs.length; vi++) {
        if (!vb.nodeFieldStrs[vi]) continue;
        var nfParts = vb.nodeFieldStrs[vi].split(/,\s*(?=\.)/).filter(function(part) {
          return part.trim().startsWith('.');
        });
        for (var _nfi = 0; _nfi < nfParts.length; _nfi++) {
          var nf = nfParts[_nfi];
          var eqIdx = nf.indexOf('=');
          if (eqIdx < 0) continue;
          var field = nf.slice(1, eqIdx).trim();
          var value = nf.slice(eqIdx + 1).trim();
          if (vi === 0) {
            out += '    if (_v == 0) { ' + target + '.' + field + ' = ' + value + '; }\n';
          } else {
            out += '    else if (_v == ' + vi + ') { ' + target + '.' + field + ' = ' + value + '; }\n';
          }
        }
      }
    }
  }

  // Map variant patches (skipped — emitted inside _rebuildMap)
  for (var _vi = 0; _vi < ctx.variantBindings.length; _vi++) {
    var vb = ctx.variantBindings[_vi];
    if (!vb.inMap) continue;
    continue;
  }
  out += '}\n\n';

  return { out: out, hasVariants: true };
}
