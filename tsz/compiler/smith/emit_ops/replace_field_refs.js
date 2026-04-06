// ── Atom 2: replace_field_refs.js — Rewrite OA field references ─
// One function that replaces _oaX_field[fromVar] -> _oaX_field[toVar]
// in any template string. Handles regular fields, string fields
// (slice syntax with _lens), and bare iteration refs.
//
// Source: map_pools.js lines 568-579 (nested), 730-733 (inline),
//         766-768 (inline inner), 797-798 (inline pool)

function replaceFieldRefs(template, oaFields, oaIdx, fromVar, toVar) {
  var result = template;
  for (var fi = 0; fi < oaFields.length; fi++) {
    var f = oaFields[fi];
    if (f.type === 'string') {
      // String fields use slice syntax: _oaX_name[fromVar][0.._oaX_name_lens[fromVar]]
      result = result.replace(
        new RegExp('_oa' + oaIdx + '_' + f.name + '\\[' + fromVar + '\\]\\[0\\.\\._{1}oa' + oaIdx + '_' + f.name + '_lens\\[' + fromVar + '\\]\\]', 'g'),
        '_oa' + oaIdx + '_' + f.name + '[' + toVar + '][0.._oa' + oaIdx + '_' + f.name + '_lens[' + toVar + ']]'
      );
    }
    // Regular fields: _oaX_name[fromVar] -> _oaX_name[toVar]
    result = result.replace(
      new RegExp('_oa' + oaIdx + '_' + f.name + '\\[' + fromVar + '\\]', 'g'),
      '_oa' + oaIdx + '_' + f.name + '[' + toVar + ']'
    );
  }
  return result;
}
