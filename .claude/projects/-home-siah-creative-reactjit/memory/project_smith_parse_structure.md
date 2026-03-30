---
name: Smith parser file structure — parse_ext.js is dead code
description: parse_ext.js functions are ALL overridden by parse.js (loads last in forge.zig). Any parser changes must go in parse.js.
type: project
---

parse_ext.js was removed from forge.zig embed list (commit 87749ee6). All 14 functions it defined are duplicated in parse.js, which loads after it and overrides every one.

**Why:** parse_ext.js was created as a split but parse.js was never updated to remove the duplicates. Since forge concatenates JS files in order (rules→logs→index→attrs→parse→preflight→emit_ext→emit→soup_smith), the last definition wins.

**How to apply:** When editing parseChildren, parseTemplateLiteral, tryParseConditional, tryParseTernaryJSX, tryParseTernaryText, leftFoldExpr, tryParseMap, tryParseNestedMap, or any other parser function — edit parse.js, not parse_ext.js. The file on disk is kept for reference only.

QuickJS in forge has no `print()` function. Debug output must go through `globalThis.__dbg` array (appears as Zig comments in generated output). Never use bare `globalThis.__dbg.push()` without first checking `if (!globalThis.__dbg) globalThis.__dbg = []`.
