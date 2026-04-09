(function() {
// ── Pattern 054: Spread props ───────────────────────────────────
// Index: 54
// Group: props
// Status: complete
//
// Matches: {...obj} — cursor at { with spread operator inside
// Compile: resolves spread source against map OA fields, copies all
//          fields into propValues. Mirrors tryParseComponentPropSpread().
//
// React:   <Card {...cardProps} />
// Zig:     for each field in OA: propValues[field] = _oaN_field[_i]

function match(c, ctx) {
  if (c.kind() !== TK.lbrace) return false;
  var next = c.pos + 1;
  return next < c.count && c.kindAt(next) === TK.spread;
}

function compile(c, ctx) {
  c.advance(); // skip {
  c.advance(); // skip ...
  var spreadName = c.text();
  c.advance(); // skip identifier
  if (c.kind() === TK.rbrace) c.advance();

  var result = {};

  // If spreading a map item, expand all OA fields
  if (ctx.currentMap && spreadName === ctx.currentMap.itemParam) {
    var oa = ctx.currentMap.oa;
    if (oa && oa.fields) {
      for (var i = 0; i < oa.fields.length; i++) {
        var field = oa.fields[i];
        if (field.type === 'nested_array') continue;
        if (field.type === 'string') {
          result[field.name] = '_oa' + oa.oaIdx + '_' + field.name + '[_i][0.._oa' + oa.oaIdx + '_' + field.name + '_lens[_i]]';
        } else {
          result[field.name] = '_oa' + oa.oaIdx + '_' + field.name + '[_i]';
        }
      }
    }
  }

  return { __spread: true, fields: result };
}

_patterns[54] = { id: 54, group: 'props', name: 'spread_props', match: match, compile: compile };

})();
