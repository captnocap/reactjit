// ── Emit Atom 014: OA const storage ─────────────────────────────
// Index: 14
// Group: object_arrays
// Target: zig
// Status: complete
// Current owner: emit/object_arrays.js
//
// Trigger: OA entries with isConst === true.
// Output target: static OA field arrays with const data, len, dirty flag.

function _mergeOas(ctx) {
  var merged = {};
  for (var i = 0; i < ctx.objectArrays.length; i++) {
    var oa = ctx.objectArrays[i];
    if (oa.isNested) continue;
    var idx = oa.oaIdx;
    if (!merged[idx]) {
      merged[idx] = Object.assign({}, oa, { fields: oa.fields.slice() });
    } else {
      for (var fi = 0; fi < oa.fields.length; fi++) {
        var f = oa.fields[fi];
        if (!merged[idx].fields.some(function(ef) { return ef.name === f.name; })) {
          merged[idx].fields.push(f);
        }
      }
    }
  }
  var result = [];
  for (var k in merged) result.push(merged[k]);
  return result;
}

function _a014_applies(ctx, meta) {
  void meta;
  if (!ctx.objectArrays || ctx.objectArrays.length === 0) return false;
  var oas = _mergeOas(ctx);
  for (var i = 0; i < oas.length; i++) {
    if (oas[i].isConst) return true;
  }
  return false;
}

function _a014_emit(ctx, meta) {
  void meta;
  var oas = _mergeOas(ctx);
  var out = '';
  for (var i = 0; i < oas.length; i++) {
    var oa = oas[i];
    if (!oa.isConst) continue;
    var idx = oa.oaIdx;
    var len = oa.constLen;
    var flatFields = oa.fields.filter(function(f) { return f.type !== 'nested_array'; });
    for (var fi = 0; fi < flatFields.length; fi++) {
      var f = flatFields[fi];
      if (f.type === 'string') {
        var vals = oa.constData.map(function(item) { return '"' + (item[f.name] || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; });
        out += 'var _oa' + idx + '_' + f.name + ' = [_][]const u8{ ' + vals.join(', ') + ' };\n';
        out += 'var _oa' + idx + '_' + f.name + '_lens = [_]usize{ ' + oa.constData.map(function(item) { return (item[f.name] || '').length; }).join(', ') + ' };\n';
      } else {
        var vals2 = oa.constData.map(function(item) { return item[f.name] !== undefined ? item[f.name] : 0; });
        out += 'var _oa' + idx + '_' + f.name + ' = [_]i64{ ' + vals2.join(', ') + ' };\n';
      }
    }
    out += 'var _oa' + idx + '_len: usize = ' + len + ';\n';
    out += 'var _oa' + idx + '_dirty: bool = false;\n\n';
  }
  return out;
}

_emitAtoms[14] = {
  id: 14,
  name: 'oa_const_storage',
  group: 'object_arrays',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/object_arrays.js',
  applies: _a014_applies,
  emit: _a014_emit,
};
