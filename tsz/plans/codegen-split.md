# Split codegen.zig — 3,777 Lines → 8 Files

## The Problem

`codegen.zig` is a god file. Agents can't even read it in one shot. Every plan that
touches codegen risks merge conflicts with every other agent. It needs to split along
natural boundaries.

## The Split

All files remain methods on `Generator` — Zig supports splitting a struct's methods
across files via `@import` and `usingnamespace`, or more practically, the Generator
struct stays in `codegen.zig` and calls into focused modules that receive `*Generator`.

### File 1: `codegen.zig` — Core & Orchestration (~400 lines)
**What stays:** Generator struct definition, `init()`, `generate()` pipeline, token
helpers (`cur`, `curText`, `curKind`, `advance_token`, `expect`), state/FFI/component
lookup helpers (`isState`, `isSetter`, `isFFIFunc`, `findClassifier`, `findComponent`).

```
Lines: 1-620 (struct + helpers + generate pipeline)
Functions: init, cur, curText, curKind, advance_token, expect, expectIdent,
  isIdent, isState, isSetter, stateType, stateTypeById, isFFIFunc, isArrayState,
  isAnimVar, findClassifier, isClassifierTag, isPanelImport, isLocalVar,
  generate (the orchestrator)
```

### File 2: `collect.zig` — Collection Passes (~600 lines)
**What moves:** All `collect*` functions that scan the token stream to gather metadata.

```
Functions: collectClassifiers, collectFFIPragmas, collectPanelImports,
  collectDeclaredFunctions, findAppFunction, collectStateHooks,
  collectEffects, collectAnimHooks, collectComponents, collectLocalVars,
  scanForPtyUsage, scanForInspectorUsage, findReturnStatement
```

### File 3: `jsx.zig` — JSX Parsing (~1,000 lines)
**What moves:** `parseJSXElement` (the 900+ line monster) and all JSX-related
parsing: conditional rendering, .map(), routes, windows, overlays.

```
Functions: parseJSXElement, collectTextContent, isTernaryAhead,
  isLogicalAndAhead, parseTernaryJSX, parseLogicalAndJSX, isMapAhead,
  parseMapExpression, parseMapTemplate, parseMapTemplateChild,
  parseRouteElement, emitWindowElement, emitOverlayElement,
  inlineComponent, findProp, findPropHandler, resolveHandlerProp
```

### File 4: `expressions.zig` — Expression Parser (~400 lines)
**What moves:** The recursive descent expression parser and handler body emission.

```
Functions: emitStateExpr, emitTernary, emitLogicalOr, emitLogicalAnd,
  emitEquality, emitComparison, emitAdditive, emitMultiplicative,
  emitUnary, emitStateAtom, emitHandlerBody, emitHandlerExpr,
  emitEffectBody, inferExprType
```

### File 5: `styles.zig` — Style Parsing (~300 lines)
**What moves:** Style attribute parsing, CSS normalization, color parsing,
Tailwind/Bootstrap integration.

```
Functions: parseStyleAttr, skipStyleValue, parseStringAttr,
  parseStringAttrInline, parseExprAttr, skipAttrValue, skipBalanced,
  parseColorValue, isStateDependentStyleValue
```

Also moves the standalone functions: `mapStyleKey`, `mapEnumKey`,
`mapEnumValue`, `kebabToCamel`, `parseCSSValue`

### File 6: `template.zig` — Template Literals (~200 lines)
**What moves:** Template literal parsing with state interpolation.

```
Functions: parseTemplateLiteral
Types: TemplateResult
```

### File 7: `emit.zig` — Zig Source Emission (~800 lines)
**What moves:** `emitZigSource` and `emitRuntimeFragment` — the final output
generation that assembles all collected data into Zig source code.

```
Functions: emitZigSource, emitRuntimeFragment, rewriteSlotRefs
```

### File 8: `crypto_helpers.zig` — Crypto Built-in Helpers (~50 lines)
**What moves:** Crypto-specific lookup functions.

```
Functions: cryptoHexSize, cryptoZigFn, cryptoArgCount
```

## How Zig Handles This

Zig doesn't have partial structs, but Generator methods can call into other files:

**Option A: Free functions that take `*Generator`**

Each split file exports functions that take a `*Generator` pointer:

```zig
// jsx.zig
const Generator = @import("codegen.zig").Generator;

pub fn parseJSXElement(gen: *Generator) ![]const u8 {
    // ... all JSX parsing logic
    // can call gen.curText(), gen.advance_token(), etc.
}
```

```zig
// codegen.zig
const jsx = @import("jsx.zig");

// In Generator method:
fn parseJSXElement(self: *Generator) ![]const u8 {
    return jsx.parseJSXElement(self);
}
```

**Option B: Direct calls without wrapper**

Skip the Generator method wrapper entirely. Call `jsx.parseJSXElement(&gen)`
directly from `generate()`. Simpler, fewer indirections.

**Recommendation: Option A** for the top-level API (keep `self.parseJSXElement()`
call sites unchanged), but the implementation lives in the split file. This means
existing call sites don't change — only the function body moves.

## Migration Strategy

**Do NOT rewrite. Move code mechanically.**

1. Create the new file
2. Cut functions from codegen.zig
3. Paste into new file
4. Add `const Generator = @import("codegen.zig").Generator;` at top
5. Change `fn foo(self: *Generator)` to `pub fn foo(gen: *Generator)` (rename self → gen)
6. In codegen.zig, add thin wrapper: `fn foo(self: *Generator) { return new_file.foo(self); }`
7. Build. Fix any missing imports.
8. Repeat for next file.

**No logic changes. No refactoring. Just moving functions to new homes.**

## Files After Split

```
tsz/compiler/
  codegen.zig          (~400 lines) — struct, helpers, orchestration
  collect.zig          (~600 lines) — collection passes
  jsx.zig              (~1,000 lines) — JSX element parsing
  expressions.zig      (~400 lines) — recursive descent + handlers
  styles.zig           (~300 lines) — style/color/CSS parsing
  template.zig         (~200 lines) — template literal parsing
  emit.zig             (~800 lines) — Zig source output generation
  crypto_helpers.zig   (~50 lines) — crypto built-in lookups
  lexer.zig            (unchanged)
  main.zig             (unchanged)
  tailwind.zig         (unchanged)
  bootstrap.zig        (unchanged)
```

## Verification

```bash
zig build tsz-compiler 2>&1  # must compile
./zig-out/bin/tsz build tsz/examples/counter.tsz  # basic app
./zig-out/bin/tsz build tsz/examples/conditional-test.tsz  # conditionals
./zig-out/bin/tsz build tsz/examples/effect-test.tsz  # effects
./zig-out/bin/tsz build tsz/examples/map-test.tsz  # .map()
# ALL existing examples must still compile and run identically
```

**Zero behavior change. Pure mechanical split.**

## Why This Matters

- Agents can read one file at a time instead of failing on 3,777 lines
- Parallel agents can work on different aspects (styles vs JSX vs expressions) with no merge conflicts
- New features go to the right file: adding a hook → `collect.zig`, new JSX tag → `jsx.zig`, new expression op → `expressions.zig`
- The god file pattern already caused 3 agents to collide in the first round
