// ── Pattern 112: CSS module ─────────────────────────────────────
// Index: 112
// Group: style
// Status: stub
//
// Soup syntax (copy-paste React):
//   import styles from './Header.module.css';
//   <Box className={styles.header} />
//
// Mixed syntax (hybrid):
//   // Not applicable — CSS modules are a web bundler feature.
//   // Mixed: use inline style objects directly.
//
// Zig output target:
//   // N/A — CSS modules require a bundler (webpack/vite) to resolve
//   // .module.css imports into scoped class names. The Zig target has
//   // no CSS runtime — all styling is compile-time style structs.
//
// Notes:
//   CSS modules are a web-specific pattern where CSS files are imported
//   as JavaScript objects with scoped class name properties.
//   ReactJIT has no CSS pipeline — styles are Zig struct fields.
//   Like p111 (classnames), className is dropped with a warning by soup.js.
//   The import statement itself would be ignored/stripped during compilation.
//   Users should convert CSS module styles to inline style objects:
//     Before: className={styles.header}
//     After:  style={{ backgroundColor: "#1a1a2e", padding: 16 }}
//   See p105_inline_object.js for the supported inline style pattern.

function match(c, ctx) {
  return false;
}

function compile(c, children, ctx) {
  return null;
}
