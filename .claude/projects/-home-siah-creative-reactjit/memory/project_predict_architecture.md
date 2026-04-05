---
name: Predict architecture — preflight is step 0, not a build step
description: Preflight/route scan must run BEFORE build, as a standalone tool. Language server model — predict compile path from source inspection alone.
type: project
---

Preflight is step 0 — not a build step. The vision:

1. `forge check` (or `forge predict`) runs from a cart directory with no arguments
2. Scans entry .tsz, follows imports, runs collect + route scan + pattern atoms
3. Outputs: predicted lane, state slots, maps, handlers, data flow, which atoms will fire, predicted output files, and any blocking issues
4. **Never calls parse, emit, or zig build.** Pure source inspection.
5. This is the foundation for a language server — editor saves file, predict runs, diagnostics appear instantly

The existing route_scan.js, pattern_atoms.js, and collect/ already do this work. They're just trapped inside the build pipeline at step 4 (after collect, before parse). They need to be extractable as a standalone path.

**Why:** User gives a session that said "how is this going to resolve" — the answer is "you cant tell me to find out, you have to know now." Three times today a "everything is done" report was wrong. Predict-before-build catches that.

**How to apply:** The current `preflight.js` (post-parse validation, step 6) is misnamed — it's really `validate.js` or `postparse_lint.js`. The real preflight is the route scan at step 4. Rename accordingly during decomposition. The standalone `forge check` command is the delivery mechanism.

Current pipeline naming problem:
- Step 4 "route scan" = the REAL preflight (source-level prediction)
- Step 6 "preflight.js" = post-parse validation (NOT preflight, runs too late)
- Step 8 "flight_check.js" = post-emit self-test (correctly named)
