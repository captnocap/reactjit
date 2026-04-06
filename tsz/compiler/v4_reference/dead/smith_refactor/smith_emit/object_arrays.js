// Emit object-array infrastructure and QJS bridge

function emitObjectArrayInfrastructure(ctx, meta) {
  if (ctx.objectArrays.length === 0) return '';

  let out = '';
  if (meta.fastBuild) {
    out += `const qjs = @cImport({ @cDefine("_GNU_SOURCE", "1"); @cDefine("QUICKJS_NG_BUILD", "1"); @cInclude("quickjs.h"); });\n`;
  } else {
    out += `const qjs = if (IS_LIB) struct {
    pub const JSValue = extern struct { tag: i64 = 3, u: extern union { int32: i32, float64: f64, ptr: ?*anyopaque } = .{ .int32 = 0 } };
    pub const JSContext = opaque {};
    pub fn JS_GetPropertyStr(_: ?*const @This().JSContext, _: @This().JSValue, _: [*:0]const u8) @This().JSValue { return .{}; }
    pub fn JS_GetPropertyUint32(_: ?*const @This().JSContext, _: @This().JSValue, _: u32) @This().JSValue { return .{}; }
    pub fn JS_ToInt32(_: ?*const @This().JSContext, _: *i32, _: @This().JSValue) i32 { return 0; }
    pub fn JS_ToInt64(_: ?*const @This().JSContext, _: *i64, _: @This().JSValue) i32 { return 0; }
    pub fn JS_ToFloat64(_: ?*const @This().JSContext, _: *f64, _: @This().JSValue) i32 { return 0; }
    pub fn JS_FreeValue(_: ?*const @This().JSContext, _: @This().JSValue) void {}
    pub fn JS_ToCString(_: ?*const @This().JSContext, _: @This().JSValue) ?[*:0]const u8 { return null; }
    pub fn JS_FreeCString(_: ?*const @This().JSContext, _: ?[*:0]const u8) void {}
    pub fn JS_NewFloat64(_: ?*const @This().JSContext, _: f64) @This().JSValue { return .{}; }
} else @cImport({ @cDefine("_GNU_SOURCE", "1"); @cDefine("QUICKJS_NG_BUILD", "1"); @cInclude("quickjs.h"); });\n`;
  }
  out += `const QJS_UNDEFINED = qjs.JSValue{ .u = .{ .int32 = 0 }, .tag = 3 };\n\n`;

  out += `// ── Object arrays ───────────────────────────────────────────────
const _oa_alloc = std.heap.page_allocator;

fn _oaDupString(src: []const u8) []const u8 {
    if (src.len == 0) return &[_]u8{};
    return _oa_alloc.dupe(u8, src) catch &[_]u8{};
}

fn _oaFreeString(slot: *[]const u8, len_slot: *usize) void {
    if (len_slot.* > 0) _oa_alloc.free(@constCast(slot.*));
    slot.* = &[_]u8{};
    len_slot.* = 0;
}\n\n`;

  for (const oa of ctx.objectArrays) {
    if (oa.isNested) continue;
    const idx = oa.oaIdx;
    const flatFields = oa.fields.filter(function(f) { return f.type !== 'nested_array'; });

    if (oa.isConst) {
      const len = oa.constLen;
      for (const f of flatFields) {
        if (f.type === 'string') {
          const vals = oa.constData.map(function(item) { return `"${(item[f.name] || '').replace(/"/g, '\\"')}"`; });
          out += `var _oa${idx}_${f.name} = [_][]const u8{ ${vals.join(', ')} };\n`;
          out += `var _oa${idx}_${f.name}_lens = [_]usize{ ${oa.constData.map(function(item) { return (item[f.name] || '').length; }).join(', ')} };\n`;
        } else {
          const vals = oa.constData.map(function(item) { return item[f.name] !== undefined ? item[f.name] : 0; });
          out += `var _oa${idx}_${f.name} = [_]i64{ ${vals.join(', ')} };\n`;
        }
      }
      out += `var _oa${idx}_len: usize = ${len};\n`;
      out += `var _oa${idx}_dirty: bool = false;\n\n`;
      continue;
    }

    for (const f of flatFields) {
      if (f.type === 'string') {
        out += `var _oa${idx}_${f.name}: [][]const u8 = &[_][]const u8{};\n`;
        out += `var _oa${idx}_${f.name}_lens: []usize = &[_]usize{};\n`;
        out += `var _oa${idx}_${f.name}_cap: usize = 0;\n`;
      } else {
        out += `var _oa${idx}_${f.name}: []i64 = &[_]i64{};\n`;
        out += `var _oa${idx}_${f.name}_cap: usize = 0;\n`;
      }
    }
    out += `var _oa${idx}_len: usize = 0;\n`;
    out += `var _oa${idx}_dirty: bool = false;\n\n`;

    const nestedFields = oa.fields.filter(function(f) { return f.type === 'nested_array'; });
    for (const nf of nestedFields) {
      const childOa = ctx.objectArrays.find(function(o) { return o.oaIdx === nf.nestedOaIdx; });
      if (!childOa) continue;
      const cidx = childOa.oaIdx;
      for (const cf of childOa.fields) {
        if (cf.type === 'string') {
          out += `var _oa${cidx}_${cf.name}: [][]const u8 = &[_][]const u8{};\n`;
          out += `var _oa${cidx}_${cf.name}_lens: []usize = &[_]usize{};\n`;
          out += `var _oa${cidx}_${cf.name}_cap: usize = 0;\n`;
        } else {
          out += `var _oa${cidx}_${cf.name}: []i64 = &[_]i64{};\n`;
          out += `var _oa${cidx}_${cf.name}_cap: usize = 0;\n`;
        }
      }
      out += `var _oa${cidx}_len: usize = 0;\n`;
      out += `var _oa${cidx}_parentIdx: []usize = &[_]usize{};\n`;
      out += `var _oa${cidx}_parentIdx_cap: usize = 0;\n`;
      out += `var _oa${cidx}_dirty: bool = false;\n\n`;
    }

    out += `fn _oa${idx}_ensureCapacity(needed: usize) void {\n`;
    const firstField = flatFields[0];
    if (!firstField) {
      out += `    _ = needed;\n}\n\n`;
      continue;
    }
    out += `    if (needed <= _oa${idx}_${firstField.name}_cap) return;\n`;
    out += `    const new_cap = @max(needed, if (_oa${idx}_${firstField.name}_cap == 0) @as(usize, 64) else _oa${idx}_${firstField.name}_cap * 2);\n`;
    for (const f of flatFields) {
      if (f.type === 'string') {
        out += `    if (_oa${idx}_${f.name}_cap == 0) {\n`;
        out += `        _oa${idx}_${f.name} = _oa_alloc.alloc([]const u8, new_cap) catch return;\n`;
        out += `        _oa${idx}_${f.name}_lens = _oa_alloc.alloc(usize, new_cap) catch return;\n`;
        out += `        for (0..new_cap) |_j| _oa${idx}_${f.name}[_j] = &[_]u8{};\n`;
        out += `        @memset(_oa${idx}_${f.name}_lens, 0);\n`;
        out += `    } else {\n`;
        out += `        const _old_cap = _oa${idx}_${f.name}_cap;\n`;
        out += `        _oa${idx}_${f.name} = _oa_alloc.realloc(_oa${idx}_${f.name}.ptr[0.._old_cap], new_cap) catch return;\n`;
        out += `        _oa${idx}_${f.name}_lens = _oa_alloc.realloc(_oa${idx}_${f.name}_lens.ptr[0.._old_cap], new_cap) catch return;\n`;
        out += `        for (_old_cap..new_cap) |_j| _oa${idx}_${f.name}[_j] = &[_]u8{};\n`;
        out += `        @memset(_oa${idx}_${f.name}_lens[_old_cap..new_cap], 0);\n`;
        out += `    }\n`;
        out += `    _oa${idx}_${f.name}_cap = new_cap;\n`;
      } else {
        out += `    if (_oa${idx}_${f.name}_cap == 0) {\n`;
        out += `        _oa${idx}_${f.name} = _oa_alloc.alloc(i64, new_cap) catch return;\n`;
        out += `        @memset(_oa${idx}_${f.name}, 0);\n`;
        out += `    } else {\n`;
        out += `        _oa${idx}_${f.name} = _oa_alloc.realloc(_oa${idx}_${f.name}.ptr[0.._oa${idx}_${f.name}_cap], new_cap) catch return;\n`;
        out += `        @memset(_oa${idx}_${f.name}[_oa${idx}_${f.name}_cap..new_cap], 0);\n`;
        out += `    }\n`;
        out += `    _oa${idx}_${f.name}_cap = new_cap;\n`;
      }
    }
    out += `}\n\n`;

    for (const nf of nestedFields) {
      const childOa = ctx.objectArrays.find(function(o) { return o.oaIdx === nf.nestedOaIdx; });
      if (!childOa) continue;
      const cidx = childOa.oaIdx;
      const cFirstField = childOa.fields[0];
      out += `fn _oa${cidx}_ensureCapacity(needed: usize) void {\n`;
      out += `    if (needed <= _oa${cidx}_${cFirstField.name}_cap) return;\n`;
      out += `    const new_cap = @max(needed, if (_oa${cidx}_${cFirstField.name}_cap == 0) @as(usize, 256) else _oa${cidx}_${cFirstField.name}_cap * 2);\n`;
      for (const cf of childOa.fields) {
        if (cf.type === 'string') {
          out += `    if (_oa${cidx}_${cf.name}_cap == 0) {\n`;
          out += `        _oa${cidx}_${cf.name} = _oa_alloc.alloc([]const u8, new_cap) catch return;\n`;
          out += `        _oa${cidx}_${cf.name}_lens = _oa_alloc.alloc(usize, new_cap) catch return;\n`;
          out += `        for (0..new_cap) |_jj| _oa${cidx}_${cf.name}[_jj] = &[_]u8{};\n`;
          out += `        @memset(_oa${cidx}_${cf.name}_lens, 0);\n`;
          out += `    } else {\n`;
          out += `        const _old_cap = _oa${cidx}_${cf.name}_cap;\n`;
          out += `        _oa${cidx}_${cf.name} = _oa_alloc.realloc(_oa${cidx}_${cf.name}.ptr[0.._old_cap], new_cap) catch return;\n`;
          out += `        _oa${cidx}_${cf.name}_lens = _oa_alloc.realloc(_oa${cidx}_${cf.name}_lens.ptr[0.._old_cap], new_cap) catch return;\n`;
          out += `        for (_old_cap..new_cap) |_jj| _oa${cidx}_${cf.name}[_jj] = &[_]u8{};\n`;
          out += `        @memset(_oa${cidx}_${cf.name}_lens[_old_cap..new_cap], 0);\n`;
          out += `    }\n`;
          out += `    _oa${cidx}_${cf.name}_cap = new_cap;\n`;
        } else {
          out += `    if (_oa${cidx}_${cf.name}_cap == 0) {\n`;
          out += `        _oa${cidx}_${cf.name} = _oa_alloc.alloc(i64, new_cap) catch return;\n`;
          out += `        @memset(_oa${cidx}_${cf.name}, 0);\n`;
          out += `    } else {\n`;
          out += `        _oa${cidx}_${cf.name} = _oa_alloc.realloc(_oa${cidx}_${cf.name}.ptr[0.._oa${cidx}_${cf.name}_cap], new_cap) catch return;\n`;
          out += `        @memset(_oa${cidx}_${cf.name}[_oa${cidx}_${cf.name}_cap..new_cap], 0);\n`;
          out += `    }\n`;
          out += `    _oa${cidx}_${cf.name}_cap = new_cap;\n`;
        }
      }
      out += `    if (_oa${cidx}_parentIdx_cap == 0) {\n`;
      out += `        _oa${cidx}_parentIdx = _oa_alloc.alloc(usize, new_cap) catch return;\n`;
      out += `        @memset(_oa${cidx}_parentIdx, 0);\n`;
      out += `    } else {\n`;
      out += `        _oa${cidx}_parentIdx = _oa_alloc.realloc(_oa${cidx}_parentIdx.ptr[0.._oa${cidx}_parentIdx_cap], new_cap) catch return;\n`;
      out += `        @memset(_oa${cidx}_parentIdx[_oa${cidx}_parentIdx_cap..new_cap], 0);\n`;
      out += `    }\n`;
      out += `    _oa${cidx}_parentIdx_cap = new_cap;\n`;
      out += `}\n\n`;
    }

    out += `fn _oa${idx}_unpack(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {\n`;
    out += `    const c2 = ctx orelse return QJS_UNDEFINED;\n`;
    out += `    const arr = argv[0];\n`;
    out += `    const len_val = qjs.JS_GetPropertyStr(c2, arr, "length");\n`;
    out += `    var arr_len: i32 = 0;\n`;
    out += `    _ = qjs.JS_ToInt32(c2, &arr_len, len_val);\n`;
    out += `    qjs.JS_FreeValue(c2, len_val);\n`;
    out += `    const count: usize = @intCast(@max(0, arr_len));\n`;
    out += `    _oa${idx}_ensureCapacity(count);\n`;
    for (const nf of nestedFields) {
      const cidx = nf.nestedOaIdx;
      out += `    var _nested_total_${cidx}: usize = 0;\n`;
    }
    out += `    for (0..count) |_i| {\n`;
    out += `        const elem = qjs.JS_GetPropertyUint32(c2, arr, @intCast(_i));\n`;
    if (oa.isSimpleArray) {
      out += `        { const _s = qjs.JS_ToCString(c2, elem);\n`;
      out += `        _oaFreeString(&_oa${idx}__v[_i], &_oa${idx}__v_lens[_i]);\n`;
      out += `        if (_s) |ss| { const sl = std.mem.span(ss); _oa${idx}__v[_i] = _oaDupString(sl); _oa${idx}__v_lens[_i] = _oa${idx}__v[_i].len; qjs.JS_FreeCString(c2, _s); }\n`;
      out += `        }\n`;
    } else for (const f of oa.fields) {
      if (f.type === 'nested_array') {
        const cidx = f.nestedOaIdx;
        const childOa = ctx.objectArrays.find(function(o) { return o.oaIdx === cidx; });
        if (!childOa) continue;
        out += `        { const _nested_arr = qjs.JS_GetPropertyStr(c2, elem, "${f.name}");\n`;
        out += `        const _nested_len_val = qjs.JS_GetPropertyStr(c2, _nested_arr, "length");\n`;
        out += `        var _nested_len: i32 = 0;\n`;
        out += `        _ = qjs.JS_ToInt32(c2, &_nested_len, _nested_len_val);\n`;
        out += `        qjs.JS_FreeValue(c2, _nested_len_val);\n`;
        out += `        const _ncount: usize = @intCast(@max(0, _nested_len));\n`;
        out += `        _oa${cidx}_ensureCapacity(_nested_total_${cidx} + _ncount);\n`;
        out += `        for (0.._ncount) |_j| {\n`;
        out += `            const _nelem = qjs.JS_GetPropertyUint32(c2, _nested_arr, @intCast(_j));\n`;
        out += `            const _flat = _nested_total_${cidx};\n`;
        for (const cf of childOa.fields) {
          if (cf.type === 'string') {
            out += `            { const _v = qjs.JS_GetPropertyStr(c2, _nelem, "${cf.name}");\n`;
            out += `            const _s = qjs.JS_ToCString(c2, _v);\n`;
            out += `            qjs.JS_FreeValue(c2, _v);\n`;
            out += `            _oaFreeString(&_oa${cidx}_${cf.name}[_flat], &_oa${cidx}_${cf.name}_lens[_flat]);\n`;
            out += `            if (_s) |ss| { const sl = std.mem.span(ss); _oa${cidx}_${cf.name}[_flat] = _oaDupString(sl); _oa${cidx}_${cf.name}_lens[_flat] = _oa${cidx}_${cf.name}[_flat].len; qjs.JS_FreeCString(c2, _s); }\n`;
            out += `            }\n`;
          } else {
            out += `            { const _v = qjs.JS_GetPropertyStr(c2, _nelem, "${cf.name}");\n`;
            out += `            var _n: i64 = 0; _ = qjs.JS_ToInt64(c2, &_n, _v);\n`;
            out += `            qjs.JS_FreeValue(c2, _v); _oa${cidx}_${cf.name}[_flat] = _n;\n`;
            out += `            }\n`;
          }
        }
        out += `            _oa${cidx}_parentIdx[_flat] = _i;\n`;
        out += `            _nested_total_${cidx} += 1;\n`;
        out += `            qjs.JS_FreeValue(c2, _nelem);\n`;
        out += `        }\n`;
        out += `        qjs.JS_FreeValue(c2, _nested_arr);\n`;
        out += `        }\n`;
      } else if (f.jsPath && f.jsPath.length > 1) {
        out += `        {\n`;
        let parent = 'elem';
        for (let pi = 0; pi < f.jsPath.length - 1; pi++) {
          out += `        const _obj_${pi} = qjs.JS_GetPropertyStr(c2, ${parent}, "${f.jsPath[pi]}");\n`;
          parent = `_obj_${pi}`;
        }
        const leaf = f.jsPath[f.jsPath.length - 1];
        out += `        const _v = qjs.JS_GetPropertyStr(c2, ${parent}, "${leaf}");\n`;
        if (f.type === 'string') {
          out += `        const _s = qjs.JS_ToCString(c2, _v);\n`;
          out += `        qjs.JS_FreeValue(c2, _v);\n`;
          out += `        _oaFreeString(&_oa${idx}_${f.name}[_i], &_oa${idx}_${f.name}_lens[_i]);\n`;
          out += `        if (_s) |ss| { const sl = std.mem.span(ss); _oa${idx}_${f.name}[_i] = _oaDupString(sl); _oa${idx}_${f.name}_lens[_i] = _oa${idx}_${f.name}[_i].len; qjs.JS_FreeCString(c2, _s); }\n`;
        } else {
          out += `        var _n: i64 = 0; _ = qjs.JS_ToInt64(c2, &_n, _v);\n`;
          out += `        qjs.JS_FreeValue(c2, _v); _oa${idx}_${f.name}[_i] = _n;\n`;
        }
        for (let pi = f.jsPath.length - 2; pi >= 0; pi--) {
          out += `        qjs.JS_FreeValue(c2, _obj_${pi});\n`;
        }
        out += `        }\n`;
      } else if (f.type === 'string') {
        out += `        { const _v = qjs.JS_GetPropertyStr(c2, elem, "${f.name}");\n`;
        out += `        const _s = qjs.JS_ToCString(c2, _v);\n`;
        out += `        qjs.JS_FreeValue(c2, _v);\n`;
        out += `        _oaFreeString(&_oa${idx}_${f.name}[_i], &_oa${idx}_${f.name}_lens[_i]);\n`;
        out += `        if (_s) |ss| { const sl = std.mem.span(ss); _oa${idx}_${f.name}[_i] = _oaDupString(sl); _oa${idx}_${f.name}_lens[_i] = _oa${idx}_${f.name}[_i].len; qjs.JS_FreeCString(c2, _s); }\n`;
        out += `        }\n`;
      } else {
        out += `        { const _v = qjs.JS_GetPropertyStr(c2, elem, "${f.name}");\n`;
        out += `        var _n: i64 = 0; _ = qjs.JS_ToInt64(c2, &_n, _v);\n`;
        out += `        qjs.JS_FreeValue(c2, _v); _oa${idx}_${f.name}[_i] = _n;\n`;
        out += `        }\n`;
      }
    }
    out += `        qjs.JS_FreeValue(c2, elem);\n`;
    out += `    }\n`;
    for (const nf of nestedFields) {
      const cidx = nf.nestedOaIdx;
      out += `    _oa${cidx}_len = _nested_total_${cidx};\n`;
      out += `    _oa${cidx}_dirty = true;\n`;
    }
    const strFields = flatFields.filter(function(f) { return f.type === 'string'; });
    if (strFields.length > 0) {
      out += `    if (count < _oa${idx}_len) {\n`;
      if (strFields.length === 1) {
        out += `        for (count.._oa${idx}_len) |_trim_i| _oaFreeString(&_oa${idx}_${strFields[0].name}[_trim_i], &_oa${idx}_${strFields[0].name}_lens[_trim_i]);\n`;
      } else {
        out += `        for (count.._oa${idx}_len) |_trim_i| {\n`;
        for (const f of strFields) {
          out += `            _oaFreeString(&_oa${idx}_${f.name}[_trim_i], &_oa${idx}_${f.name}_lens[_trim_i]);\n`;
        }
        out += `        }\n`;
      }
      out += `    }\n`;
    }
    out += `    _oa${idx}_len = count;\n`;
    out += `    _oa${idx}_dirty = true;\n`;
    out += `    state.markDirty();\n`;
    out += `    return QJS_UNDEFINED;\n`;
    out += `}\n\n`;
  }

  if (ctx.variantBindings && ctx.variantBindings.length > 0) {
    out += `fn _setVariantHost(_: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {\n`;
    out += `    if (argc >= 1) {\n`;
    out += `        var v: i64 = 0;\n`;
    out += `        _ = qjs.JS_ToInt64(null, &v, argv[0]);\n`;
    if (meta.fastBuild) {
      out += `        @import("${meta.prefix}api.zig").theme.rjit_theme_set_variant(@intCast(@max(0, v)));\n`;
    } else {
      out += `        @import("${meta.prefix}theme.zig").setVariant(@intCast(@max(0, v)));\n`;
    }
    out += `    }\n`;
    out += `    return QJS_UNDEFINED;\n`;
    out += `}\n\n`;
  }

  return out;
}
