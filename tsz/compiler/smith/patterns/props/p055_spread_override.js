(function() {
// ── Pattern 055: Spread + override ──────────────────────────────
// Index: 55
// Group: props
// Status: complete
//
// Soup syntax (copy-paste React):
//   <UserCard {...user} role="admin" />
//   <Input {...inputProps} disabled={true} />
//   <Box {...baseStyles} color="red" />
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Spread expands all OA fields first:
//   // propValues["name"]  = _oa0_name[_i][0.._oa0_name_lens[_i]]
//   // propValues["role"]  = _oa0_role[_i][0.._oa0_role_lens[_i]]
//   //
//   // Then explicit prop overwrites:
//   // propValues["role"]  = "admin"  ← replaces the spread value
//   //
//   // At call site, the override wins:
//   // .text = "admin"   (not the OA field)
//
// Notes:
//   This is a composition of p054 (spread) + normal prop assignment.
//   The prop parsing loop processes attributes left-to-right:
//     1. tryParseComponentPropSpread() runs first, fills propValues with OA fields
//     2. Subsequent explicit props overwrite matching keys in propValues
//
//   No special implementation needed — it's the natural result of the
//   left-to-right attribute parsing order in the main element parse loop.
//
//   Same limitations as p054:
//     - Only map-item spread is supported
//     - The override prop must be a supported type (string, number, expression, etc.)
//
//   Partial because the underlying spread (p054) is partial.

function match(c, ctx) {
  // Detected as a spread (p054) followed by more attributes.
  // The spread detection is the same: { ... identifier }
  // Override is detected by the normal attribute parsing that follows.
  // This pattern matches when we see spread AND there are more tokens
  // after the closing brace that look like attr names.
  if (c.kind() !== TK.lbrace) return false;
  if (c.pos + 3 >= c.count) return false;
  if (c.kindAt(c.pos + 1) !== TK.spread) return false;
  if (c.kindAt(c.pos + 2) !== TK.identifier) return false;
  // Check that after {...name} there's another attribute (not > or />)
  var afterSpread = c.pos + 4; // past { ... name }
  if (afterSpread >= c.count) return false;
  var nextKind = c.kindAt(afterSpread);
  // If next token is an identifier (another prop name), this is spread+override
  return nextKind === TK.identifier;
}

function compile(c, ctx) {
  // Spread + override is handled by left-to-right attribute parsing:
  // 1. p054 (spread) runs first, fills propValues with OA fields
  // 2. Subsequent explicit props overwrite matching keys
  // No special compile step needed — this is a composition of p054 + normal props.
  // The caller's attribute loop handles the override semantics naturally.
  // Delegate to p054 for the spread part.
  c.advance(); // skip {
  c.advance(); // skip ...
  var spreadName = c.text();
  c.advance(); // skip identifier
  if (c.kind() === TK.rbrace) c.advance();

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
    return { spread: true, fields: expanded, hasOverrides: true };
  }

  return { spread: true, name: spreadName, hasOverrides: true };
}

_patterns[55] = { id: 55, match: match, compile: compile };

})();
