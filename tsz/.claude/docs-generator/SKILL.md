---
name: docs-generator
description: Generate and maintain comprehensive documentation for the tsz native stack — the .tsz compiler, Zig runtime, layout engine, and all native capabilities. Use when the user asks to "generate docs", "update documentation", "document tsz", "write docs", "docs mode", "documentation mode", "refresh docs", "document [component/feature]", or any request to create or update content in `tsz/docs/`. Also triggers on "/docs" when working in the tsz directory.
---

# tsz Documentation Generator

Multi-phase pipeline that audits the tsz native stack for documentable surface area, then writes structured markdown content files into `tsz/docs/`.

## Core Architectural Insight (READ FIRST)

tsz is a **code generator**, not a compiler in the traditional sense. It transforms `.tsz` syntax (which looks like React/TSX) into Zig source code. The Zig compiler then compiles that source code into a native binary. There is no runtime, no interpreter, no VM, no JIT.

```
.tsz source → [tsz codegen] → .zig source → [zig compiler] → native binary
```

The `.tsz` file ceases to exist at runtime. Every `<Box>`, every `useState`, every `onPress` becomes a Zig struct literal, a state slot index, a function pointer — all resolved at compile time. Zero abstraction overhead.

### The Two Modes

**1. Full App Build (`tsz build app.tsz`)**
Generates a complete `generated_app.zig` with `pub fn main()`, SDL window creation, event loop, the whole thing. Output is a standalone binary. This is for apps.

**2. Pre-compile (`tsz compile-runtime Panel.tsz`)**
Generates a `.gen.zig` fragment — a Zig module with a public API (init, tick, getRoot, named accessors) but no main function. It's designed to be `@import`ed by the runtime. This is for framework internals.

The runtime has a fixed architecture: one main loop, one compositor, one layout engine. Panels, devtools, and state modules plug into this architecture. They don't need their own main loop — they need to expose a predictable API that the runtime calls.

Pre-compiled fragments are Zig source checked into the repo. When you `zig build engine`, the Zig compiler sees:
```zig
const devtools_panel = @import("compiled/framework/devtoolspanel.gen.zig");
```
To Zig, this is just another module. It optimizes it identically to hand-written code. Inlining, dead code elimination, everything. The fact that it was generated from 7 `.tsz` files is invisible.

### What This Means

There is no "framework runtime cost." In a web framework, React ships a reconciler, a virtual DOM, a diff algorithm — all running in the browser at 60fps. In tsz, there is no React. The compiler resolves component composition, prop passing, conditional rendering, and state binding into flat Zig at pre-compile time. The `.gen.zig` is what a senior Zig developer would write by hand — just generated mechanically.

The `.tsz` file is a **design artifact**, not a runtime dependency. You could delete every `.tsz` file after pre-compiling and the binary would be identical. The `.tsz` exists for humans to read and maintain. The `.gen.zig` exists for Zig to compile. They're different representations of the same thing at different stages of the pipeline.

Pre-compile vs full build is **scope, not capability**. Both use the exact same codegen. The difference is what gets emitted around the node tree:
- **Full build:** wraps it in `main()` + SDL event loop + compositor
- **Pre-compile:** wraps it in `init`/`tick`/`getRoot` + named accessors

The node tree, state slots, handlers, dynamic text, conditionals — all identical between modes.

### Contrast With the Love2D Stack

The Love2D stack (`love2d/`) works completely differently:
```
.tslx source → [esbuild plugin] → Lua source → [QuickJS interprets JS] → [Lua bridge] → Love2D
```
Three languages at runtime: JavaScript (QuickJS), Lua (LuaJIT), and C (Love2D/OpenGL). Every frame, the JS reconciler diffs the virtual tree, marshals changes across the FFI bridge, and Lua applies them. This is the overhead that tsz eliminates entirely.

In tsz, there's **one language at runtime: Zig.** The state system is 100 lines of Zig. The layout engine is a Zig port. The painter is Zig calling SDL/wgpu. The generated app code is Zig. No bridges, no marshaling, no interpretation.

## Content Format

Read [references/content-format.md](references/content-format.md) for the markdown file format specification, section numbering, file naming, and structure.

## Pipeline

### Phase 1: Discovery (4 parallel haiku agents)

Spawn 4 haiku agents with identical instructions. Each independently crawls the tsz codebase and produces a flat list of everything that should be documented. The redundancy is intentional — different agents notice different things.

**Agent prompt template:**

> Crawl the `tsz/` directory and produce a complete list of everything that needs documentation. For each item, output one line: `CATEGORY | name | one-line description | source file(s)`.
>
> Categories: Primitive, Compiler Feature, Runtime Module, Layout Concept, State API, Event Type, FFI Feature, CLI Command, Architecture Concept, Style Property, Built-in Function.
>
> Search strategy — examine ALL of these:
> - `tsz/compiler/` — all compiler modules (lexer, parser, codegen, tailwind, engine, gui, tray, runner, registry, actions, process)
> - `tsz/runtime/` — all runtime modules (layout, text, image, events, input, state, windows, watchdog, bsod, mpv, gpu, vterm, mouse)
> - `tsz/runtime/framework/` — framework-level modules (inspector, overlay, etc.)
> - `tsz/runtime/compiled/` — compiled framework and user artifacts
> - `tsz/examples/` — .tsz demo apps showing features
> - `tsz/devtools/` — devtools .tsz sources
> - `tsz/CLAUDE.md` — documented capabilities and build commands
> - `build.zig` (root) — build targets related to tsz
>
> Be exhaustive. Include every primitive, every style property, every hook, every FFI pattern, every CLI subcommand, every runtime behavior that a user or AI agent would need to understand.

Collect all 4 lists. Merge and deduplicate into a master inventory.

### Phase 2: Coverage Audit

Compare the master inventory against existing files in `tsz/docs/`:

```
tsz/docs/**/*.md
```

Produce three lists:
1. **Missing** — items in the inventory with no corresponding `.md` file
2. **Stale** — existing `.md` files whose source code has diverged (new props, changed API, renamed functions)
3. **Complete** — existing files that are up to date

For staleness detection: read both the `.md` file and the source code it documents, compare API signatures, supported props, and examples against actual Zig source.

Present the coverage report to the user. Ask which items to prioritize, or whether to proceed with everything.

### Phase 3: Writing (parallel sonnet agents)

For each missing or stale item, spawn a sonnet agent to write or update the `.md` file. Batch into groups of 4-6 parallel agents to avoid overwhelming context.

**Agent prompt template:**

> Write documentation for `{name}` in the tsz native stack.
>
> Read the source code at `{source_files}` to understand the full API.
> Read `tsz/.claude/docs-generator/references/content-format.md` for the exact markdown format to follow.
> {If updating: Read the existing file at `tsz/docs/{section}/{filename}.md` and preserve any correct content.}
>
> Output a complete markdown file following the format specification. Requirements:
> - Frontmatter with all required fields
> - OVERVIEW: 2-4 sentences explaining what it is, when to use it, and how it fits in the stack
> - API / SYNTAX: full prop/parameter table from actual source code, .tsz usage examples
> - EXAMPLES: 2-4 practical .tsz code examples
> - INTERNALS (optional): how it maps to Zig — useful for contributors, skip for pure user docs
> - GOTCHAS: common mistakes, things that silently break
> - SEE ALSO: related primitives/features/concepts
>
> Write the file to `tsz/docs/{section}/{filename}.md`.

After each batch completes, spot-check 2-3 files for accuracy against the source.

### Phase 4: Final Review

1. Verify all files exist and are well-formed:
   ```bash
   find tsz/docs -name '*.md' | wc -l
   find tsz/docs -name '*.md' -empty
   ```

2. Spot-check 3-5 generated files for accuracy against Zig source.

3. Report results:
   - How many files were created/updated
   - Any accuracy concerns
   - Total coverage percentage (documented items / inventory items)

## Scoped Runs

The full pipeline is for comprehensive documentation passes. For targeted work:

**Single item:** Skip phases 1-2. Read the source, read the format spec, write the `.md` file.

**Single section:** Run phase 1 scoped to one area (e.g. only `tsz/runtime/`), then phases 3-4 for that section only.

**Staleness check only:** Run phases 1-2, report results, stop. Useful for auditing without writing.

## Key Paths

| What | Path |
|------|------|
| Documentation source of truth | `tsz/docs/**/*.md` |
| Content format spec | `tsz/.claude/docs-generator/references/content-format.md` |
| Compiler source | `tsz/compiler/` |
| Runtime source | `tsz/runtime/` |
| Example .tsz apps | `tsz/examples/` |
| Devtools .tsz sources | `tsz/devtools/` |
| Build targets | `build.zig` (repo root) |
| Stack overview | `tsz/CLAUDE.md` |
