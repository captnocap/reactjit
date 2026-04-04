// ── Emit Atom 015: OA dynamic storage ───────────────────────────
// Index: 15
// Group: object_arrays
// Target: zig
// Status: complete
// Current owner: emit/object_arrays.js
//
// Trigger: OA entries that are not const (dynamic/runtime payloads).
// Output target: field buffers, capacities, nested child storage,
//   ensureCapacity helpers for parent and child OAs.

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

function _a015_applies(ctx, meta) {
  void meta;
  if (!ctx.objectArrays || ctx.objectArrays.length === 0) return false;
  var oas = _mergeOas(ctx);
  for (var i = 0; i < oas.length; i++) {
    if (!oas[i].isConst) return true;
  }
  return false;
}

function _emitEnsureCapacity(idx, flatFields, nestedFields) {
  var out = '';
  out += 'fn _oa' + idx + '_ensureCapacity(needed: usize) void {\n';
  var firstField = flatFields[0];
  if (!firstField) {
    out += '    _ = needed;\n}\n\n';
    return out;
  }
  out += '    if (needed <= _oa' + idx + '_' + firstField.name + '_cap) return;\n';
  out += '    const new_cap = @max(needed, if (_oa' + idx + '_' + firstField.name + '_cap == 0) @as(usize, 64) else _oa' + idx + '_' + firstField.name + '_cap * 2);\n';
  for (var fi = 0; fi < flatFields.length; fi++) {
    var f = flatFields[fi];
    if (f.type === 'string') {
      out += '    if (_oa' + idx + '_' + f.name + '_cap == 0) {\n';
      out += '        _oa' + idx + '_' + f.name + ' = _oa_alloc.alloc([]const u8, new_cap) catch return;\n';
      out += '        _oa' + idx + '_' + f.name + '_lens = _oa_alloc.alloc(usize, new_cap) catch return;\n';
      out += '        for (0..new_cap) |_j| _oa' + idx + '_' + f.name + '[_j] = &[_]u8{};\n';
      out += '        @memset(_oa' + idx + '_' + f.name + '_lens, 0);\n';
      out += '    } else {\n';
      out += '        const _old_cap = _oa' + idx + '_' + f.name + '_cap;\n';
      out += '        _oa' + idx + '_' + f.name + ' = _oa_alloc.realloc(_oa' + idx + '_' + f.name + '.ptr[0.._old_cap], new_cap) catch return;\n';
      out += '        _oa' + idx + '_' + f.name + '_lens = _oa_alloc.realloc(_oa' + idx + '_' + f.name + '_lens.ptr[0.._old_cap], new_cap) catch return;\n';
      out += '        for (_old_cap..new_cap) |_j| _oa' + idx + '_' + f.name + '[_j] = &[_]u8{};\n';
      out += '        @memset(_oa' + idx + '_' + f.name + '_lens[_old_cap..new_cap], 0);\n';
      out += '    }\n';
      out += '    _oa' + idx + '_' + f.name + '_cap = new_cap;\n';
    } else {
      out += '    if (_oa' + idx + '_' + f.name + '_cap == 0) {\n';
      out += '        _oa' + idx + '_' + f.name + ' = _oa_alloc.alloc(i64, new_cap) catch return;\n';
      out += '        @memset(_oa' + idx + '_' + f.name + ', 0);\n';
      out += '    } else {\n';
      out += '        _oa' + idx + '_' + f.name + ' = _oa_alloc.realloc(_oa' + idx + '_' + f.name + '.ptr[0.._oa' + idx + '_' + f.name + '_cap], new_cap) catch return;\n';
      out += '        @memset(_oa' + idx + '_' + f.name + '[_oa' + idx + '_' + f.name + '_cap..new_cap], 0);\n';
      out += '    }\n';
      out += '    _oa' + idx + '_' + f.name + '_cap = new_cap;\n';
    }
  }
  for (var ni = 0; ni < nestedFields.length; ni++) {
    var nf = nestedFields[ni];
    out += '    if (_oa' + idx + '_' + nf.name + '_cap == 0) {\n';
    out += '        _oa' + idx + '_' + nf.name + ' = _oa_alloc.alloc(i64, new_cap) catch return;\n';
    out += '        @memset(_oa' + idx + '_' + nf.name + ', 0);\n';
    out += '    } else {\n';
    out += '        _oa' + idx + '_' + nf.name + ' = _oa_alloc.realloc(_oa' + idx + '_' + nf.name + '.ptr[0.._oa' + idx + '_' + nf.name + '_cap], new_cap) catch return;\n';
    out += '        @memset(_oa' + idx + '_' + nf.name + '[_oa' + idx + '_' + nf.name + '_cap..new_cap], 0);\n';
    out += '    }\n';
    out += '    _oa' + idx + '_' + nf.name + '_cap = new_cap;\n';
  }
  out += '}\n\n';
  return out;
}

function _emitChildEnsureCapacity(childOa) {
  var cidx = childOa.oaIdx;
  var cFirstField = childOa.fields[0];
  var out = '';
  out += 'fn _oa' + cidx + '_ensureCapacity(needed: usize) void {\n';
  out += '    if (needed <= _oa' + cidx + '_' + cFirstField.name + '_cap) return;\n';
  out += '    const new_cap = @max(needed, if (_oa' + cidx + '_' + cFirstField.name + '_cap == 0) @as(usize, 256) else _oa' + cidx + '_' + cFirstField.name + '_cap * 2);\n';
  for (var cfi = 0; cfi < childOa.fields.length; cfi++) {
    var cf = childOa.fields[cfi];
    if (cf.type === 'string') {
      out += '    if (_oa' + cidx + '_' + cf.name + '_cap == 0) {\n';
      out += '        _oa' + cidx + '_' + cf.name + ' = _oa_alloc.alloc([]const u8, new_cap) catch return;\n';
      out += '        _oa' + cidx + '_' + cf.name + '_lens = _oa_alloc.alloc(usize, new_cap) catch return;\n';
      out += '        for (0..new_cap) |_jj| _oa' + cidx + '_' + cf.name + '[_jj] = &[_]u8{};\n';
      out += '        @memset(_oa' + cidx + '_' + cf.name + '_lens, 0);\n';
      out += '    } else {\n';
      out += '        const _old_cap = _oa' + cidx + '_' + cf.name + '_cap;\n';
      out += '        _oa' + cidx + '_' + cf.name + ' = _oa_alloc.realloc(_oa' + cidx + '_' + cf.name + '.ptr[0.._old_cap], new_cap) catch return;\n';
      out += '        _oa' + cidx + '_' + cf.name + '_lens = _oa_alloc.realloc(_oa' + cidx + '_' + cf.name + '_lens.ptr[0.._old_cap], new_cap) catch return;\n';
      out += '        for (_old_cap..new_cap) |_jj| _oa' + cidx + '_' + cf.name + '[_jj] = &[_]u8{};\n';
      out += '        @memset(_oa' + cidx + '_' + cf.name + '_lens[_old_cap..new_cap], 0);\n';
      out += '    }\n';
      out += '    _oa' + cidx + '_' + cf.name + '_cap = new_cap;\n';
    } else {
      out += '    if (_oa' + cidx + '_' + cf.name + '_cap == 0) {\n';
      out += '        _oa' + cidx + '_' + cf.name + ' = _oa_alloc.alloc(i64, new_cap) catch return;\n';
      out += '        @memset(_oa' + cidx + '_' + cf.name + ', 0);\n';
      out += '    } else {\n';
      out += '        _oa' + cidx + '_' + cf.name + ' = _oa_alloc.realloc(_oa' + cidx + '_' + cf.name + '.ptr[0.._oa' + cidx + '_' + cf.name + '_cap], new_cap) catch return;\n';
      out += '        @memset(_oa' + cidx + '_' + cf.name + '[_oa' + cidx + '_' + cf.name + '_cap..new_cap], 0);\n';
      out += '    }\n';
      out += '    _oa' + cidx + '_' + cf.name + '_cap = new_cap;\n';
    }
  }
  out += '    if (_oa' + cidx + '_parentIdx_cap == 0) {\n';
  out += '        _oa' + cidx + '_parentIdx = _oa_alloc.alloc(usize, new_cap) catch return;\n';
  out += '        @memset(_oa' + cidx + '_parentIdx, 0);\n';
  out += '    } else {\n';
  out += '        _oa' + cidx + '_parentIdx = _oa_alloc.realloc(_oa' + cidx + '_parentIdx.ptr[0.._oa' + cidx + '_parentIdx_cap], new_cap) catch return;\n';
  out += '        @memset(_oa' + cidx + '_parentIdx[_oa' + cidx + '_parentIdx_cap..new_cap], 0);\n';
  out += '    }\n';
  out += '    _oa' + cidx + '_parentIdx_cap = new_cap;\n';
  out += '}\n\n';
  return out;
}

function _a015_emit(ctx, meta) {
  void meta;
  var oas = _mergeOas(ctx);
  var out = '';
  for (var i = 0; i < oas.length; i++) {
    var oa = oas[i];
    if (oa.isConst) continue;
    var idx = oa.oaIdx;
    var flatFields = oa.fields.filter(function(f) { return f.type !== 'nested_array'; });
    var nestedFields = oa.fields.filter(function(f) { return f.type === 'nested_array'; });

    // Dynamic field buffers
    for (var fi = 0; fi < flatFields.length; fi++) {
      var f = flatFields[fi];
      if (f.type === 'string') {
        out += 'var _oa' + idx + '_' + f.name + ': [][]const u8 = &[_][]const u8{};\n';
        out += 'var _oa' + idx + '_' + f.name + '_lens: []usize = &[_]usize{};\n';
        out += 'var _oa' + idx + '_' + f.name + '_cap: usize = 0;\n';
      } else {
        out += 'var _oa' + idx + '_' + f.name + ': []i64 = &[_]i64{};\n';
        out += 'var _oa' + idx + '_' + f.name + '_cap: usize = 0;\n';
      }
    }
    // Nested field count buffers
    for (var ni = 0; ni < nestedFields.length; ni++) {
      var nf = nestedFields[ni];
      out += 'var _oa' + idx + '_' + nf.name + ': []i64 = &[_]i64{};\n';
      out += 'var _oa' + idx + '_' + nf.name + '_cap: usize = 0;\n';
    }
    out += 'var _oa' + idx + '_len: usize = 0;\n';
    out += 'var _oa' + idx + '_dirty: bool = false;\n\n';

    // Nested child OA storage
    for (var ni2 = 0; ni2 < nestedFields.length; ni2++) {
      var nf2 = nestedFields[ni2];
      var childOa = ctx.objectArrays.find(function(o) { return o.oaIdx === nf2.nestedOaIdx; });
      if (!childOa) continue;
      var cidx = childOa.oaIdx;
      for (var cfi = 0; cfi < childOa.fields.length; cfi++) {
        var cf = childOa.fields[cfi];
        if (cf.type === 'string') {
          out += 'var _oa' + cidx + '_' + cf.name + ': [][]const u8 = &[_][]const u8{};\n';
          out += 'var _oa' + cidx + '_' + cf.name + '_lens: []usize = &[_]usize{};\n';
          out += 'var _oa' + cidx + '_' + cf.name + '_cap: usize = 0;\n';
        } else {
          out += 'var _oa' + cidx + '_' + cf.name + ': []i64 = &[_]i64{};\n';
          out += 'var _oa' + cidx + '_' + cf.name + '_cap: usize = 0;\n';
        }
      }
      out += 'var _oa' + cidx + '_len: usize = 0;\n';
      out += 'var _oa' + cidx + '_parentIdx: []usize = &[_]usize{};\n';
      out += 'var _oa' + cidx + '_parentIdx_cap: usize = 0;\n';
      out += 'var _oa' + cidx + '_dirty: bool = false;\n\n';
    }

    // Parent ensureCapacity
    out += _emitEnsureCapacity(idx, flatFields, nestedFields);

    // Child ensureCapacity
    for (var ni3 = 0; ni3 < nestedFields.length; ni3++) {
      var nf3 = nestedFields[ni3];
      var childOa2 = ctx.objectArrays.find(function(o) { return o.oaIdx === nf3.nestedOaIdx; });
      if (!childOa2) continue;
      out += _emitChildEnsureCapacity(childOa2);
    }
  }
  return out;
}

_emitAtoms[15] = {
  id: 15,
  name: 'oa_dynamic_storage',
  group: 'object_arrays',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/object_arrays.js',
  applies: _a015_applies,
  emit: _a015_emit,
};
