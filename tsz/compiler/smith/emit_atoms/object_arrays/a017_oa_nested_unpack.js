// ── Emit Atom 017: OA nested unpack ─────────────────────────────
// Index: 17
// Group: object_arrays
// Target: zig
// Status: complete
// Current owner: emit/object_arrays.js
//
// Trigger: OA fields containing nested_array children.
// Output target: nested child flattening and parentIdx wiring.
//
// NOTE: The nested unpack logic is emitted inline within a016's _oaN_unpack()
// function body (it's a branch inside the per-element loop). This atom exists
// as documentation and for the applies() check — the actual nested emit code
// lives in a016's _emitNestedFieldUnpack() helper because the nested extraction
// is structurally part of the unpack function, not a standalone block.
//
// If nested unpack ever becomes a standalone function (e.g. a separate
// _oaN_unpackNested() callback), migrate the logic here.

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

function _a017_applies(ctx, meta) {
  void meta;
  if (!ctx.objectArrays || ctx.objectArrays.length === 0) return false;
  var oas = _mergeOas(ctx);
  for (var i = 0; i < oas.length; i++) {
    if (oas[i].isConst) continue;
    var nestedFields = oas[i].fields.filter(function(f) { return f.type === 'nested_array'; });
    if (nestedFields.length > 0) return true;
  }
  return false;
}

function _a017_emit(ctx, meta) {
  // Nested unpack is emitted inline by a016. This atom is a no-op.
  // See header comment for rationale.
  void ctx; void meta;
  return '';
}

_emitAtoms[17] = {
  id: 17,
  name: 'oa_nested_unpack',
  group: 'object_arrays',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/object_arrays.js',
  applies: _a017_applies,
  emit: _a017_emit,
};
