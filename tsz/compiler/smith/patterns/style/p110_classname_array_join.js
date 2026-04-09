(function() {
// ── Pattern 110: className array join ───────────────────────────
// Index: 110
// Group: style
// Status: complete
//
// Soup syntax (copy-paste React):
//   <div className={['btn', size, active && 'active'].filter(Boolean).join(' ')} />
//   <Box className={[base, modifier].join(' ')} />
//
// Mixed syntax (hybrid):
//   Not applicable — use inline styles or classifiers.
//
// Zig output target:
//   // className is DROPPED with a warning.
//   // Warning: [W] dynamic className dropped
//
// Notes:
//   Same handling as p107/p108/p109 — all className values are dropped.
//   Array-based className construction is a dynamic className and gets
//   the "[W] dynamic className dropped" warning.
//
//   The equivalent in Smith for conditional style composition is either:
//     1. Computed inline styles with ternary (p106):
//        style={{opacity: active ? 1 : 0.5, padding: size === 'lg' ? 16 : 8}}
//     2. Classifiers (.cls.tsz files) in chad tier:
//        Compile-time style presets that can be conditionally applied.
//
//   Status is "complete" because dropping with a warning is correct.

function match(c, ctx) {
  // className={[...].join(' ')}
  if (c.kind() !== TK.identifier) return false;
  var t = c.text();
  if (t !== 'className' && t !== 'class') return false;
  if (c.pos + 3 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.equals &&
         c.kindAt(c.pos + 2) === TK.lbrace &&
         c.kindAt(c.pos + 3) === TK.lbracket;
}

function compile(c, ctx) {
  void ctx;
  var attr = c.text();
  c.advance();
  if (c.kind() === TK.equals) c.advance();
  if (c.kind() === TK.lbrace) skipBraces(c);
  return {
    kind: 'dropped_classname',
    attr: attr,
    dynamic: true,
    warning: '[W] dynamic className dropped',
  };
}

_patterns[110] = { id: 110, match: match, compile: compile };

})();
