# Smith Preflight System — Master Plan

Synthesized from 5 independent proposals (Opus max/low, Sonnet high/low, Haiku),
reviewed by 3 external models (Gemini, GPT, Claude). This is the agreed architecture.

## Core Thesis

Smith currently relies on bash greps against generated Zig to catch bugs. This is
fundamentally flawed because it throws away the rich semantic context gathered during
parse. Preflight reverses this: a read-only validation layer between parse and emit
that catches both compile crashes (Class A) and silent wrong-output bugs (Class B)
before a single line of Zig is written.

**Class B is the actual justification.** These are bugs where Zig compiles, runs, and
renders garbage — no grep pattern exists because the output is syntactically valid but
semantically wrong. Only ctx-level inspection can find these.

## Architecture

```
parse → ctx fully populated
  ↓
preflight(ctx) → { ok, errors, warnings, lane, intents }
  ↓
if !ok → emit @compileError Zig with readable diagnostics
if ok  → emit normal Zig (warnings as comments)
```

- `preflight.js` is a pure read-only function (~200-250 lines)
- Receives fully-populated ctx, validates it, returns diagnostics
- Writes NOTHING to ctx
- Lives at: tsz/compiler/smith/preflight.js

## Intent Derivation

Derive intents from existing ctx fields. Do NOT scatter ctx.intents.add() through
parse.js. Exception: ~6 lines recording outcomes that can't be reconstructed post-parse
(e.g., "was this Color{} backed by a dynStyle entry?", "was this template literal resolved?").

```javascript
const intents = {
    has_maps: ctx.maps.length > 0,
    has_map_handlers: ctx.handlers.some(h => h.inMap),
    has_state: ctx.stateSlots.length > 0,
    has_script_block: ctx.scriptBlock !== null,
    has_script_import: ctx.imports.length > 0,
    // derived from node tree, not explicit tracking
};
```

## FATAL Checks (Block Compilation)

| ID | Check | Bug Class | What It Catches |
|----|-------|-----------|-----------------|
| F1 | Empty handler body (no Zig body AND no luaBody) | A | Dead buttons, no error |
| F2 | Handler references unresolvable setter/slot | A | Handler ref but no fn |
| F3 | Map handler without lua/js dispatch path | A | String-literal-in-map |
| F4 | Color{} with no dynStyle entry | **B** | Invisible element, no error |
| F5 | OA field access on nonexistent field | **B** | Empty string or Zig crash |
| F6 | Unresolved template literal | **B** | Literal ${expr} shown to user |
| F7 | Duplicate handler names | A | Second overwrites first |
| F8 | Map over non-OA identifier | A | Broken .zig |
| F9 | Script function called but not declared | **B** | QuickJS returns undefined silently |
| F10 | JS syntax leaked into Lua body | A | Kills entire Lua init chunk |

## WARN Checks (Compiles, Flags User)

| ID | Check |
|----|-------|
| W1 | Color{} count (ones with dynStyle but worth flagging) |
| W2 | Map lua_ptrs allocated but not wired into pool nodes |
| W3 | Unused state slot (declared, never read) |
| W4 | Prop passed to component but never consumed |

## Error Format

Human-readable strings with specific identifiers:
```
"F3: map handler _handler_press_2 (map 0) has no lua dispatch — map items can't have per-item handlers"
```

On FATAL, emit valid Zig that @compileErrors with the preflight message:
```zig
//! PREFLIGHT BLOCKED: tsz compiler detected errors
//! FATAL: F3: map handler _handler_press_2 (map 0) has no lua dispatch
comptime { @compileError("Smith preflight failed. See logs above."); }
```

## Compile Lanes

```javascript
function determineLane(intents) {
    if (intents.has('script_block') || intents.has('script_import')) return 'soup';
    if (intents.has('html_tags') || intents.has('ternary_styles')) return 'mixed';
    return 'chad';
}
```

Lanes are Phase 3 — initially just log the lane as a comment in generated .zig.
Don't gate emit paths on it until lane detection proves stable across conformance.

## Bash Migration

Keep single-quoted string leak check in bash (pure output artifact, not derivable
from ctx). Everything else migrates to preflight. Run both in parallel for one
conformance cycle, then remove bash checks one by one.

## Implementation Order

1. Create preflight.js (~200-250 lines). F1, F3, F7 first.
2. Wire into compile() — 15 lines in index.js. On FATAL, return @compileError.
3. Run against d01-d104. False positive = preflight bug.
4. Add Class B checks (F4, F5, F6, F9).
5. Parallel-run with bash lint. Confirm equivalent catches.
6. Remove superseded bash checks one by one.
7. Add lane detection — log only.
8. Future: Lane-optimized emit paths.

## File Budget

- preflight.js: ~200-250 lines
- parse.js / attrs.js changes: ~6 lines (outcome recording)
- index.js changes: ~15 lines
- scripts/build removals: ~80 lines (phased)

## Explicitly Rejected

- 40+ intent enum scattered through parse.js (too granular, most derivable from ctx)
- Capability table with everything set to true (dead code)
- Running preflight before parse (wrong — needs fully populated ctx)
- Preflight writing to ctx (must stay read-only)
