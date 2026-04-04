(function() {
// ── Pattern 054: Spread props ───────────────────────────────────
// Index: 54
// Group: props
// Status: complete
//
// Soup syntax (copy-paste React):
//   <UserCard {...user} />
//   <Input {...inputProps} />
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // When spreading a map item (the only supported case):
//   // {...item} inside items.map(item => ...) expands all OA fields:
//   // propValues["name"]  = _oa0_name[_i][0.._oa0_name_lens[_i]]
//   // propValues["age"]   = _oa0_age[_i]
//   // propValues["email"] = _oa0_email[_i][0.._oa0_email_lens[_i]]
//   // → these get inlined at the component's call site
//
// Notes:
//   Implemented in parse/element/component_spread.js → tryParseComponentPropSpread().
//
//   Detection: { ... identifier } token sequence:
//     TK.lbrace + TK.spread + TK.identifier + TK.rbrace
//
//   Only works when the spread target is a map item parameter:
//     - ctx.currentMap must exist
//     - The identifier must equal ctx.currentMap.itemParam
//     - Expands ALL OA fields (except nested_array type) into propValues
//     - String fields get the [0..lens] slice form
//     - Numeric fields get direct array access
//
//   NOT supported:
//     - Spreading a plain object variable (no OA backing)
//     - Spreading props from parent ({...props})
//     - Spreading state objects
//     - Spreading imported objects
//     - Computed spread targets ({...getProps()})
//
//   Partial because only map-item spread is implemented. General object
//   spread would require runtime object introspection (QuickJS) or
//   compile-time type information.

function match(c, ctx) {
  // { ... identifier }
  if (c.kind() !== TK.lbrace) return false;
  if (c.pos + 3 >= c.count) return false;
  if (c.kindAt(c.pos + 1) !== TK.spread) return false;
  if (c.kindAt(c.pos + 2) !== TK.identifier) return false;
  return true;
}

function compile(c, ctx) {
  // Spread: { ...name } — mirrors tryParseComponentPropSpread().
  // Only map item spreads are supported (spreadName === currentMap.itemParam).
  c.advance(); // skip {
  c.advance(); // skip ...
  var spreadName = c.text();
  c.advance(); // skip identifier
  if (c.kind() === TK.rbrace) c.advance();

  // Expand OA fields into propValues when spreading a map item
  if (ctx.currentMap && spreadName === ctx.currentMap.itemParam) {
    var oa = ctx.currentMap.oa;
    var expanded = {};
    for (var i = 0; i < oa.fields.length; i++) {
      var field = oa.fields[i];
      if (field.type === 'nested_array') continue;
      if (field.type === 'string') {
        expanded[field.name] = '_oa' + oa.oaIdx + '_' + field.name + '[_i][0.._oa' + oa.oaIdx + '_' + field.name + '_lens[_i]]';
      } else {
        expanded[field.name] = '_oa' + oa.oaIdx + '_' + field.name + '[_i]';
      }
    }
    return { spread: true, fields: expanded };
  }

  return { spread: true, name: spreadName };
}

_patterns[54] = { id: 54, match: match, compile: compile };

})();
