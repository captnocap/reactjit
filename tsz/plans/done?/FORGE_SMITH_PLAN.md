# Forge + Smith — Compiler Architecture Plan

## What This Is

Split the tsz compiler into two parts:

- **Forge** — small Zig binary. Lexer, QuickJS bridge, file I/O. Build once, rarely changes.
- **Smith** — JS codebase. All compiler intelligence. Runs inside Forge via QuickJS. Edit freely without rebuilding Forge.

Forge makes Smith run. Smith makes apps. Once Smith works, you forget Forge exists.

## Data Flow

```
app.tsz
  → [Forge: lex]
  → tokens (flat arrays: kinds[], starts[], ends[])
  → [Forge: call QuickJS]
  → [Smith: JS codegen — parse, collect, emit]
  → .zig source string
  → [Forge: write file]
  → [zig build-exe]
  → native binary
```

## Forge (Zig, ~300 lines)

```zig
// forge.zig — the entire Zig kernel
const std = @import("std");
const Lexer = @import("lexer.zig").Lexer;
const qjs = @import("framework/qjs_runtime.zig");

pub fn main() !void {
    const input_path = parseArgs();
    const source = readFile(input_path);

    // 1. Lex (stays Zig — fast, proven, 484 lines)
    var lexer = Lexer.init(source);
    lexer.tokenize();

    // 2. Bridge tokens to JS as typed arrays
    //    kinds:  Uint8Array  (token enum as u8)
    //    starts: Uint32Array (byte offset)
    //    ends:   Uint32Array (byte offset)
    //    source: string
    passTokensToJS(lexer, source);

    // 3. Call Smith
    const zig_output = qjs.callGlobalStr("compile", input_path);

    // 4. Write .zig + invoke zig build
    writeFile(output_path, zig_output);
    execZigBuild(output_path);
}
```

Forge keeps:
- `lexer.zig` (484 lines) — unchanged, proven, fast
- `forge.zig` (~150 lines) — main, args, file I/O, QuickJS bridge
- `cli.zig` (~200 lines) — stripped down CLI (build/dev/serve commands)
- QuickJS runtime link

Forge does NOT know about: styles, JSX, components, state, handlers, emit patterns.

## Smith (JS, ~3,000 lines estimated)

```
compiler/smith/
  index.js          — entry: exports compile(inputPath)
  tokenizer.js      — wraps Forge's token arrays into a cursor API
  rules.js          — all lookup tables (style keys, colors, enums, HTML tags, etc.)
  collect.js        — phases 1-7.5: scan tokens, build compiler state
  validate.js       — phase 7.9: catch bad tags/props/idents
  parse-jsx.js      — phase 8: recursive descent JSX → node expressions
  parse-expr.js     — expression codegen with operator precedence
  parse-stmt.js     — statement patterns (const/let/if/for/return)
  components.js     — component inlining
  handlers.js       — handler body emission
  emit.js           — phase 9: assemble final .zig source (template literals)
  lint.js           — pre-compilation lint checks
  typegen.js        — TS type → Zig type declarations
```

### Token Cursor API (tokenizer.js)

Smith sees tokens through a cursor, same mental model as Generator today:

```javascript
class TokenCursor {
  constructor(kinds, starts, ends, source) {
    this.kinds = kinds;   // Uint8Array from Forge
    this.starts = starts; // Uint32Array from Forge
    this.ends = ends;     // Uint32Array from Forge
    this.source = source; // full source string
    this.pos = 0;
  }

  kind()    { return this.kinds[this.pos]; }
  text()    { return this.source.slice(this.starts[this.pos], this.ends[this.pos]); }
  advance() { this.pos++; }
  save()    { return this.pos; }
  restore(p){ this.pos = p; }
}
```

### Rules (rules.js)

Pure data. No logic. The part AI and humans edit most:

```javascript
export const styleKeys = {
  width: 'width', height: 'height',
  minWidth: 'min_width', maxWidth: 'max_width',
  padding: 'padding', paddingLeft: 'padding_left',
  // ...
};

export const colorKeys = {
  backgroundColor: 'background_color',
  borderColor: 'border_color',
  shadowColor: 'shadow_color',
};

export const namedColors = {
  black: [0,0,0], white: [255,255,255], red: [255,0,0],
  // ...
};

export const htmlTags = {
  div: 'Box', section: 'Box', span: 'Text', p: 'Text',
  button: 'Pressable', input: 'TextInput', img: 'Image',
  // ...
};

export const enumKeys = {
  flexDirection:  { field: 'flex_direction', values: { row: '.row', column: '.column' }},
  justifyContent: { field: 'justify_content', values: { start: '.start', center: '.center', end: '.end', 'space-between': '.space_between' }},
  // ...
};
```

### Emit (emit.js)

Template literals. The big readability win:

```javascript
export function emitImports(ctx) {
  let out = `const std = @import("std");\n`;
  out += `const builtin = @import("builtin");\n`;

  if (!ctx.isEmbedded) {
    out += `const build_options = @import("build_options");\n`;
    out += `const IS_LIB = if (@hasDecl(build_options, "is_lib")) build_options.is_lib else false;\n\n`;
  }

  out += `const layout = @import("${ctx.prefix}layout.zig");\n`;
  out += `const Node = layout.Node;\nconst Style = layout.Style;\nconst Color = layout.Color;\n`;

  if (ctx.hasState) out += `const state = @import("${ctx.stateMod}");\n`;
  if (ctx.hasTheme) out += `const Theme = @import("${ctx.prefix}theme.zig");\n`;

  if (!ctx.isEmbedded) {
    out += `const engine = if (IS_LIB) struct {} else if (builtin.os.tag == .emscripten) ` +
           `@import("${ctx.prefix}engine_web.zig") else @import("${ctx.prefix}engine.zig");\n`;
  }

  if (ctx.hasQjs) {
    out += `const qjs_runtime = if (IS_LIB) struct {
    pub fn callGlobal(_: []const u8) void {}
    pub fn callGlobalStr(_: []const u8, _: []const u8) void {}
    pub fn callGlobalInt(_: []const u8, _: i64) void {}
    pub fn registerHostFn(_: []const u8, _: ?*const anyopaque, _: u8) void {}
    pub fn evalExpr(_: []const u8) void {}
} else @import("${ctx.prefix}qjs_runtime.zig");\n`;
  }

  // ... rest of conditional imports

  return out;
}

export function emitMain(appName) {
  return `
pub fn main() !void {
    if (IS_LIB) return;
    try engine.run(.{
        .title = "${appName}",
        .root = &_root,
        .js_logic = JS_LOGIC,
        .lua_logic = LUA_LOGIC,
        .init = _appInit,
        .tick = _appTick,
    });
}
`;
}
```

### Compile Entry (index.js)

```javascript
import { TokenCursor } from './tokenizer.js';
import { collect } from './collect.js';
import { validate } from './validate.js';
import { parseJSX } from './parse-jsx.js';
import { emit } from './emit.js';
import { lint } from './lint.js';

export function compile(inputPath, source, kinds, starts, ends) {
  const tokens = new TokenCursor(kinds, starts, ends, source);

  // Lint
  const diagnostics = lint(tokens);
  tokens.pos = 0;

  // Collect (phases 1-7.5)
  const ctx = collect(tokens);

  // Validate (phase 7.9)
  validate(ctx, tokens);

  // Parse JSX (phase 8)
  const rootExpr = parseJSX(ctx, tokens);

  // Emit (phase 9)
  return emit(ctx, rootExpr, inputPath);
}
```

## Bridge Design

Forge passes data to Smith via QuickJS globals:

```zig
// In forge.zig — set up globals before calling compile()
qjs.setGlobalString("__source", source);
qjs.setGlobalTypedArray("__kinds", lexer.kinds_as_u8_slice());
qjs.setGlobalTypedArray("__starts", lexer.starts_as_bytes());
qjs.setGlobalTypedArray("__ends", lexer.ends_as_bytes());
const result = qjs.callGlobalStr("compile", input_path);
```

Smith reads them:

```javascript
// In index.js
const source = globalThis.__source;
const kinds = new Uint8Array(globalThis.__kinds);
const starts = new Uint32Array(globalThis.__starts);
const ends = new Uint32Array(globalThis.__ends);
```

Return value is a string (the .zig source). Forge reads it back via `qjs.getGlobalString("__result")`.

## Migration Path

Phase 1 — Prove the bridge works:
1. Build forge.zig with lexer + QuickJS
2. Write a minimal smith index.js that receives tokens and returns a hardcoded .zig string
3. Verify: `forge build test.tsz` produces a valid binary
4. This proves the data flow works end-to-end

Phase 2 — Port rules.js:
1. Move all lookup tables to rules.js (style keys, colors, enums, HTML tags)
2. These are already identified from the Phase 1 extraction work
3. Trivial — just JSON objects

Phase 3 — Port collect.js:
1. Port the collection phases (scan tokens, build ctx state)
2. These are the simplest to port — they just scan and populate arrays
3. Test: compare ctx output against current Generator state for each conformance cart

Phase 4 — Port parse-jsx.js + handlers.js + components.js:
1. Port the JSX parser (recursive descent — JS handles this naturally)
2. Port handler body emission and expression chain
3. Port component inlining
4. Test: compare generated node tree expressions against current output

Phase 5 — Port emit.js:
1. Port all emit functions using template literals
2. This is where the biggest readability gain lands
3. Test: byte-identical .zig output for every conformance cart

Phase 6 — Port remaining (lint, validate, typegen, stmtgen, exprgen, modulegen):
1. These can be ported in any order
2. Each one replaces a .zig file with a .js file

## Verification

Same as before: byte-identical conformance suite output.

After each phase, compile every conformance cart with both the old compiler and Forge+Smith. Diff the .zig output. Zero diff = correct.

## Line Count Projection

| Component | Current (Zig) | After (Zig) | After (JS) |
|-----------|--------------|-------------|------------|
| Lexer | 484 | 484 | 0 |
| Forge (CLI + bridge) | ~1,456 (cli.zig) | ~300 | 0 |
| Rules/tables | ~1,900 | 0 | ~200 |
| Collection | ~2,421 | 0 | ~800 |
| JSX/parse | ~5,500 | 0 | ~1,500 |
| Emit | ~3,000 | 0 | ~800 |
| Handlers/expr/stmt | ~4,700 | 0 | ~1,200 |
| Other (lint/validate/type) | ~3,400 | 0 | ~600 |
| **Total** | **~25,500** | **~800** | **~5,100** |

25,500 lines of Zig → 800 lines of Zig + 5,100 lines of JS.
The JS is more readable, more authorable, more AI-friendly.

## What Stays in Zig

1. Lexer (484 lines) — performance-critical, proven, no reason to port
2. Forge main (150 lines) — CLI parsing, file I/O, QuickJS bootstrap
3. QuickJS bridge (~150 lines) — typed array passing, string exchange
4. Build orchestration — invoking zig build on the generated .zig

Everything else moves to Smith.
