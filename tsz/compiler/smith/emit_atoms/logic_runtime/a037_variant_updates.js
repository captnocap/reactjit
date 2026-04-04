// ── Emit Atom 037: Variant updates ──────────────────────────────
// Index: 37
// Group: logic_runtime
// Target: zig
// Status: complete
// Current owner: emit/runtime_updates.js
//
// Trigger: ctx.variantBindings && ctx.variantBindings.length > 0.
// Output target: fn _updateVariants() void { ... }
//
// Notes:
//   Emits a Zig function that applies theme variant + breakpoint
//   responsive style patches to nodes at runtime.
//
//   Three patch modes:
//     1. Breakpoint-responsive (vb.bpStyles): sm/md/lg tiers via _bp_tier,
//        with variant styles nested inside the else (large) branch.
//     2. Variant-only: if (_v == 0) { ... } else if (_v == 1) { ... }
//        style field assignments per variant index.
//     3. Node field strings (vb.nodeFieldStrs): non-style node fields
//        (text, text_color, etc.) patched per variant.
//
//   Breakpoint column layout detection: when sm tier switches to .column,
//   child flex_grow spacers are zeroed to prevent layout blowout.
//
//   Map variant patches (vb.inMap) are skipped — they're emitted
//   inside _rebuildMapN() where per-item locals are in scope.
//
//   Imports _theme (or api.theme for fastBuild) and optionally
//   _bp (breakpoint) at function scope.

function _a037_applies(ctx, meta) {
  void meta;
  return ctx.variantBindings && ctx.variantBindings.length > 0;
}

function _a037_emit(ctx, meta) {
  var promotedToPerItem = meta.promotedToPerItem || new Set();
  var prefix = meta.prefix;
  var fastBuild = meta.fastBuild;

  var out = 'fn _updateVariants() void {\n';
  var hasBp = ctx.variantBindings.some(function(vb) { return vb.bpStyles; });
  if (fastBuild) {
    if (hasBp) out += '    const _bp_tier = @as(u8, api.breakpoint.rjit_breakpoint_current());\n';
    out += '    const _v = @as(usize, api.theme.rjit_theme_active_variant());\n';
  } else {
    out += '    const _theme = @import("' + prefix + 'theme.zig");\n';
    if (hasBp) {
      out += '    const _bp = @import("' + prefix + 'breakpoint.zig");\n';
      out += '    const _bp_tier = @intFromEnum(_bp.current());\n';
    }
    out += '    const _v = @as(usize, _theme.activeVariant());\n';
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
      return indent + target + '.style.' + styleField + ' = ' + value + ';\n';
    }).join('');
  }

  for (var vi = 0; vi < ctx.variantBindings.length; vi++) {
    var vb = ctx.variantBindings[vi];
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
      for (var si = 0; si < vb.styles.length; si++) {
        if (si === 0) {
          bpBlock += '        if (_v == 0) {\n' + styleAssignments(target, vb.styles[0], '            ') + '        }\n';
        } else {
          bpBlock += '        else if (_v == ' + si + ') {\n' + styleAssignments(target, vb.styles[si], '            ') + '        }\n';
        }
      }
      bpBlock += '    }\n';
      out += bpBlock;
    } else {
      for (var si2 = 0; si2 < vb.styles.length; si2++) {
        if (si2 === 0) {
          out += '    if (_v == 0) {\n' + styleAssignments(target, vb.styles[0], '        ') + '    }\n';
        } else {
          out += '    else if (_v == ' + si2 + ') {\n' + styleAssignments(target, vb.styles[si2], '        ') + '    }\n';
        }
      }
    }
    // Breakpoint column layout: zero child flex_grow spacers on sm
    if (vb.bpStyles) {
      var smIsCol = vb.bpStyles.sm && vb.bpStyles.sm.includes('.column');
      if (smIsCol) {
        var parentDecl = ctx.arrayDecls.find(function(decl) { return decl.includes('var ' + vb.arrName + ' ='); });
        if (parentDecl) {
          var allChildRefs = [];
          var re = /\.children\s*=\s*&(_arr_\d+)/g;
          var match;
          while ((match = re.exec(parentDecl)) !== null) allChildRefs.push(match[1]);
          var childArr = allChildRefs[vb.arrIndex];
          if (childArr) {
            var childDecl = ctx.arrayDecls.find(function(decl) { return decl.includes('var ' + childArr + ' ='); });
            if (childDecl) {
              var nodeStr = childDecl.slice(childDecl.indexOf('[_]Node{') + 8);
              var idx = 0, depth = 0, nodeStart = 0;
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
    // Node field strings (non-style fields like text, text_color)
    if (vb.nodeFieldStrs && vb.nodeFieldStrs.some(function(nf) { return nf.length > 0; })) {
      for (var nfi = 0; nfi < vb.nodeFieldStrs.length; nfi++) {
        if (!vb.nodeFieldStrs[nfi]) continue;
        var nfParts = vb.nodeFieldStrs[nfi].split(/,\s*(?=\.)/).filter(function(part) { return part.trim().startsWith('.'); });
        for (var npi = 0; npi < nfParts.length; npi++) {
          var nf = nfParts[npi];
          var eqIdx = nf.indexOf('=');
          if (eqIdx < 0) continue;
          var field = nf.slice(1, eqIdx).trim();
          var value = nf.slice(eqIdx + 1).trim();
          if (nfi === 0) {
            out += '    if (_v == 0) { ' + target + '.' + field + ' = ' + value + '; }\n';
          } else {
            out += '    else if (_v == ' + nfi + ') { ' + target + '.' + field + ' = ' + value + '; }\n';
          }
        }
      }
    }
  }

  // Map variant patches — skipped, emitted inside _rebuildMapN()
  out += '}\n\n';
  return out;
}

_emitAtoms[37] = {
  id: 37,
  name: 'variant_updates',
  group: 'logic_runtime',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/runtime_updates.js',
  applies: _a037_applies,
  emit: _a037_emit,
};
