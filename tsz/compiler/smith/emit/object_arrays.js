// ── Object array infrastructure ──
// OA declarations, QJS bridge, unpack functions.

function emitObjectArrayInfrastructure(ctx, opts) {
  var out = '';
  if (!ctx.objectArrays || ctx.objectArrays.length === 0) return out;
  var prefix = opts.prefix || 'framework/';
  var fastBuild = opts.fastBuild || false;

  // OA field arrays — per-field storage for each object array
  for (var oi = 0; oi < ctx.objectArrays.length; oi++) {
    var oa = ctx.objectArrays[oi];
    if (!oa.fields || oa.fields.length === 0) continue;
    var maxItems = oa.maxItems || 4096;
    for (var fi = 0; fi < oa.fields.length; fi++) {
      var f = oa.fields[fi];
      if (f.type === 'string') {
        out += 'var _oa' + oa.oaIdx + '_' + f.name + ': [' + maxItems + '][256]u8 = undefined;\n';
        out += 'var _oa' + oa.oaIdx + '_' + f.name + '_lens: [' + maxItems + ']usize = undefined;\n';
      } else if (f.type === 'number' || f.type === 'int') {
        out += 'var _oa' + oa.oaIdx + '_' + f.name + ': [' + maxItems + ']i64 = undefined;\n';
      } else if (f.type === 'float') {
        out += 'var _oa' + oa.oaIdx + '_' + f.name + ': [' + maxItems + ']f64 = undefined;\n';
      } else if (f.type === 'bool') {
        out += 'var _oa' + oa.oaIdx + '_' + f.name + ': [' + maxItems + ']bool = undefined;\n';
      }
    }
    out += 'var _oa' + oa.oaIdx + '_count: usize = 0;\n';
    out += '\n';
  }

  // QJS bridge: register host functions for OA data push
  out += emitOABridge(ctx, 'zig');

  return out;
}
