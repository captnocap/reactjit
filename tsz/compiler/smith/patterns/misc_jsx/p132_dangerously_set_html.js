// ── Pattern 132: dangerouslySetInnerHTML ───────────────────────
// Index: 132
// Group: misc_jsx
// Status: not_applicable
//
// Soup syntax (copy-paste React):
//   <div dangerouslySetInnerHTML={{ __html: rawHtml }} />
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // N/A in the current runtime.
//   // Would require an HTML parser + rich text / DOM surface, not a plain
//   // Node tree assignment.
//
// Notes:
//   There is no HTML DOM in the generated runtime, and no existing attr
//   parser path for raw HTML injection. In parse/element/attrs_dispatch.js
//   unknown attrs with brace values fall through to skipBraces(c), so the
//   object literal is consumed and ignored.
//
//   This is intentionally unsupported. Content needs to be compiled into
//   native nodes, not injected as an HTML string.

function match(c, ctx) {
  // Value-side shape: {{ __html: ... }}
  if (c.kind() !== TK.lbrace) return false;
  if (c.pos + 2 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.lbrace;
}

function compile(c, ctx) {
  // Intentionally not compiled in this runtime model.
  return null;
}
