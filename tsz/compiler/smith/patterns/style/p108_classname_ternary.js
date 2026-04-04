// ── Pattern 108: className ternary ──────────────────────────────
// Index: 108
// Group: style
// Status: complete
//
// Soup syntax (copy-paste React):
//   <div className={active ? 'on' : 'off'} />
//   <Box className={isError ? 'error-box' : 'normal-box'} />
//
// Mixed syntax (hybrid):
//   Not applicable — use computed inline styles instead:
//   <Box style={{backgroundColor: active ? 'red' : 'blue'}} />
//
// Zig output target:
//   // className is DROPPED with a warning, regardless of value type.
//   // Warning: [W] dynamic className dropped
//
// Notes:
//   Same handling as p107 — className is dropped in all forms.
//   Dynamic className values (ternary, template literal, function call)
//   produce the warning "[W] dynamic className dropped" (soup.js:514).
//
//   The equivalent in Smith is a computed inline style (p106):
//     style={{backgroundColor: isActive ? 'theme-error' : 'theme-bg'}}
//   which compiles to a Zig conditional Color expression.
//
//   Status is "complete" because dropping with a warning is correct.

function match(c, ctx) {
  return false; // Handled by the skip + warn in soup.js
}

function compile(c, ctx) {
  return null;
}
