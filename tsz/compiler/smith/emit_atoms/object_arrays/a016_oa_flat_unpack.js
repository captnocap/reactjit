// ── Emit Atom 016: OA flat unpack ───────────────────────────────
// Index: 16
// Group: object_arrays
// Target: zig
// Status: complete
// Current owner: emit/object_arrays.js
//
// Trigger: dynamic OAs (non-const) exist.
// Output target: _oaN_unpack() QJS callback for flat/simple/primitive rows.
//   Handles: primitive arrays, simple string arrays, object rows with
//   flat fields (string, i64), deep jsPath traversal, string trim on shrink.
//   Nested array fields are handled by a017.

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

function _a016_applies(ctx, meta) {
  void meta;
  if (!ctx.objectArrays || ctx.objectArrays.length === 0) return false;
  var oas = _mergeOas(ctx);
  for (var i = 0; i < oas.length; i++) {
    if (!oas[i].isConst) return true;
  }
  return false;
}

function _emitFieldExtract(oa, idx, f) {
  var out = '';
  if (f.jsPath && f.jsPath.length > 1) {
    out += '        {\n';
    var parent = 'elem';
    for (var pi = 0; pi < f.jsPath.length - 1; pi++) {
      out += '        const _obj_' + pi + ' = qjs.JS_GetPropertyStr(c2, ' + parent + ', "' + f.jsPath[pi] + '");\n';
      parent = '_obj_' + pi;
    }
    var leaf = f.jsPath[f.jsPath.length - 1];
    out += '        const _v = qjs.JS_GetPropertyStr(c2, ' + parent + ', "' + leaf + '");\n';
    if (f.type === 'string') {
      out += '        const _s = qjs.JS_ToCString(c2, _v);\n';
      out += '        qjs.JS_FreeValue(c2, _v);\n';
      out += '        _oaFreeString(&_oa' + idx + '_' + f.name + '[_i], &_oa' + idx + '_' + f.name + '_lens[_i]);\n';
      out += '        if (_s) |ss| { const sl = std.mem.span(ss); _oa' + idx + '_' + f.name + '[_i] = _oaDupString(sl); _oa' + idx + '_' + f.name + '_lens[_i] = _oa' + idx + '_' + f.name + '[_i].len; qjs.JS_FreeCString(c2, _s); }\n';
    } else {
      out += '        var _n: i64 = 0; _ = qjs.JS_ToInt64(c2, &_n, _v);\n';
      out += '        qjs.JS_FreeValue(c2, _v); _oa' + idx + '_' + f.name + '[_i] = _n;\n';
    }
    for (var pi2 = f.jsPath.length - 2; pi2 >= 0; pi2--) {
      out += '        qjs.JS_FreeValue(c2, _obj_' + pi2 + ');\n';
    }
    out += '        }\n';
  } else if (f.type === 'string') {
    out += '        { const _v = qjs.JS_GetPropertyStr(c2, elem, "' + f.name + '");\n';
    out += '        const _s = qjs.JS_ToCString(c2, _v);\n';
    out += '        qjs.JS_FreeValue(c2, _v);\n';
    out += '        _oaFreeString(&_oa' + idx + '_' + f.name + '[_i], &_oa' + idx + '_' + f.name + '_lens[_i]);\n';
    out += '        if (_s) |ss| { const sl = std.mem.span(ss); _oa' + idx + '_' + f.name + '[_i] = _oaDupString(sl); _oa' + idx + '_' + f.name + '_lens[_i] = _oa' + idx + '_' + f.name + '[_i].len; qjs.JS_FreeCString(c2, _s); }\n';
    out += '        }\n';
  } else {
    out += '        { const _v = qjs.JS_GetPropertyStr(c2, elem, "' + f.name + '");\n';
    out += '        var _n: i64 = 0; _ = qjs.JS_ToInt64(c2, &_n, _v);\n';
    out += '        qjs.JS_FreeValue(c2, _v); _oa' + idx + '_' + f.name + '[_i] = _n;\n';
    out += '        }\n';
  }
  return out;
}

function _a016_emit(ctx, meta) {
  void meta;
  var oas = _mergeOas(ctx);
  var out = '';
  for (var i = 0; i < oas.length; i++) {
    var oa = oas[i];
    if (oa.isConst) continue;
    var idx = oa.oaIdx;
    var flatFields = oa.fields.filter(function(f) { return f.type !== 'nested_array'; });
    var nestedFields = oa.fields.filter(function(f) { return f.type === 'nested_array'; });

    // Unpack function header
    out += 'fn _oa' + idx + '_unpack(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {\n';
    out += '    const c2 = ctx orelse return QJS_UNDEFINED;\n';
    out += '    const arr = argv[0];\n';
    out += '    const len_val = qjs.JS_GetPropertyStr(c2, arr, "length");\n';
    out += '    var arr_len: i32 = 0;\n';
    out += '    _ = qjs.JS_ToInt32(c2, &arr_len, len_val);\n';
    out += '    qjs.JS_FreeValue(c2, len_val);\n';
    out += '    const count: usize = @intCast(@max(0, arr_len));\n';
    out += '    _oa' + idx + '_ensureCapacity(count);\n';

    // Nested total counters (emitted here, used by a017 logic inline)
    for (var ni = 0; ni < nestedFields.length; ni++) {
      var cidx = nestedFields[ni].nestedOaIdx;
      out += '    var _nested_total_' + cidx + ': usize = 0;\n';
    }

    out += '    for (0..count) |_i| {\n';
    out += '        const elem = qjs.JS_GetPropertyUint32(c2, arr, @intCast(_i));\n';

    if (oa.isPrimitiveArray) {
      out += '        { var _n: i64 = 0; _ = qjs.JS_ToInt64(c2, &_n, elem);\n';
      out += '        _oa' + idx + '_value[_i] = _n;\n';
      out += '        }\n';
    } else if (oa.isSimpleArray) {
      out += '        { const _s = qjs.JS_ToCString(c2, elem);\n';
      out += '        _oaFreeString(&_oa' + idx + '__v[_i], &_oa' + idx + '__v_lens[_i]);\n';
      out += '        if (_s) |ss| { const sl = std.mem.span(ss); _oa' + idx + '__v[_i] = _oaDupString(sl); _oa' + idx + '__v_lens[_i] = _oa' + idx + '__v[_i].len; qjs.JS_FreeCString(c2, _s); }\n';
      out += '        }\n';
    } else {
      for (var fi = 0; fi < oa.fields.length; fi++) {
        var f = oa.fields[fi];
        if (f.type === 'nested_array') {
          // Nested array field — emitted by a017
          out += _emitNestedFieldUnpack(ctx, idx, f);
        } else {
          out += _emitFieldExtract(oa, idx, f);
        }
      }
    }

    out += '        qjs.JS_FreeValue(c2, elem);\n';
    out += '    }\n';

    // Nested totals finalization
    for (var ni2 = 0; ni2 < nestedFields.length; ni2++) {
      var cidx2 = nestedFields[ni2].nestedOaIdx;
      out += '    _oa' + cidx2 + '_len = _nested_total_' + cidx2 + ';\n';
      out += '    _oa' + cidx2 + '_dirty = true;\n';
    }

    // String trim on shrink
    var strFields = flatFields.filter(function(f) { return f.type === 'string'; });
    if (strFields.length > 0) {
      out += '    if (count < _oa' + idx + '_len) {\n';
      if (strFields.length === 1) {
        out += '        for (count.._oa' + idx + '_len) |_trim_i| _oaFreeString(&_oa' + idx + '_' + strFields[0].name + '[_trim_i], &_oa' + idx + '_' + strFields[0].name + '_lens[_trim_i]);\n';
      } else {
        out += '        for (count.._oa' + idx + '_len) |_trim_i| {\n';
        for (var si = 0; si < strFields.length; si++) {
          out += '            _oaFreeString(&_oa' + idx + '_' + strFields[si].name + '[_trim_i], &_oa' + idx + '_' + strFields[si].name + '_lens[_trim_i]);\n';
        }
        out += '        }\n';
      }
      out += '    }\n';
    }

    out += '    _oa' + idx + '_len = count;\n';
    out += '    _oa' + idx + '_dirty = true;\n';
    out += '    state.markDirty();\n';
    out += '    return QJS_UNDEFINED;\n';
    out += '}\n\n';
  }
  return out;
}

// Nested array field unpack — inline within the per-element loop.
// This is the a017 logic but emitted inline since it's part of the unpack body.
function _emitNestedFieldUnpack(ctx, idx, f) {
  var cidx = f.nestedOaIdx;
  var childOa = ctx.objectArrays.find(function(o) { return o.oaIdx === cidx; });
  if (!childOa) return '';
  var out = '';
  out += '        { const _nested_arr = qjs.JS_GetPropertyStr(c2, elem, "' + f.name + '");\n';
  out += '        const _nested_len_val = qjs.JS_GetPropertyStr(c2, _nested_arr, "length");\n';
  out += '        var _nested_len: i32 = 0;\n';
  out += '        _ = qjs.JS_ToInt32(c2, &_nested_len, _nested_len_val);\n';
  out += '        qjs.JS_FreeValue(c2, _nested_len_val);\n';
  out += '        const _ncount: usize = @intCast(@max(0, _nested_len));\n';
  out += '        _oa' + idx + '_' + f.name + '[_i] = @intCast(_ncount);\n';
  out += '        _oa' + cidx + '_ensureCapacity(_nested_total_' + cidx + ' + _ncount);\n';
  out += '        for (0.._ncount) |_j| {\n';
  out += '            const _nelem = qjs.JS_GetPropertyUint32(c2, _nested_arr, @intCast(_j));\n';
  out += '            const _flat = _nested_total_' + cidx + ';\n';
  for (var cfi = 0; cfi < childOa.fields.length; cfi++) {
    var cf = childOa.fields[cfi];
    if (cf.type === 'string') {
      out += '            { const _v = qjs.JS_GetPropertyStr(c2, _nelem, "' + cf.name + '");\n';
      out += '            const _s = qjs.JS_ToCString(c2, _v);\n';
      out += '            qjs.JS_FreeValue(c2, _v);\n';
      out += '            _oaFreeString(&_oa' + cidx + '_' + cf.name + '[_flat], &_oa' + cidx + '_' + cf.name + '_lens[_flat]);\n';
      out += '            if (_s) |ss| { const sl = std.mem.span(ss); _oa' + cidx + '_' + cf.name + '[_flat] = _oaDupString(sl); _oa' + cidx + '_' + cf.name + '_lens[_flat] = _oa' + cidx + '_' + cf.name + '[_flat].len; qjs.JS_FreeCString(c2, _s); }\n';
      out += '            }\n';
    } else {
      out += '            { const _v = qjs.JS_GetPropertyStr(c2, _nelem, "' + cf.name + '");\n';
      out += '            var _n: i64 = 0; _ = qjs.JS_ToInt64(c2, &_n, _v);\n';
      out += '            qjs.JS_FreeValue(c2, _v); _oa' + cidx + '_' + cf.name + '[_flat] = _n;\n';
      out += '            }\n';
    }
  }
  out += '            _oa' + cidx + '_parentIdx[_flat] = _i;\n';
  out += '            _nested_total_' + cidx + ' += 1;\n';
  out += '            qjs.JS_FreeValue(c2, _nelem);\n';
  out += '        }\n';
  out += '        qjs.JS_FreeValue(c2, _nested_arr);\n';
  out += '        }\n';
  return out;
}

_emitAtoms[16] = {
  id: 16,
  name: 'oa_flat_unpack',
  group: 'object_arrays',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/object_arrays.js',
  applies: _a016_applies,
  emit: _a016_emit,
};
