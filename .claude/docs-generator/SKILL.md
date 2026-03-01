---
name: docs-generator
description: Generate and maintain comprehensive documentation for the ReactJIT framework using a multi-agent pipeline. Use when the user asks to "generate docs", "update documentation", "document the framework", "write docs", "docs mode", "documentation mode", "refresh docs", "document [component/hook/feature]", or any request to create or update content in `content/sections/`. Also triggers on "/docs" or when the user wants to ensure documentation coverage is complete.
---

# Documentation Generator

Multi-phase pipeline that audits the ReactJIT codebase for documentable surface area, then writes structured `.txt` content files that compile into `dist/llms/*.txt` and the storybook docs viewer.

## Content Format

Read [references/content-format.md](references/content-format.md) for the `.txt` file format specification, section numbering, file naming, and build commands.

## Pipeline

### Phase 1: Discovery (4 parallel haiku agents)

Spawn 4 haiku agents with identical instructions. Each independently crawls the codebase and produces a flat list of everything that should be documented. The redundancy is intentional — different agents notice different things.

**Agent prompt template:**

> Crawl the ReactJIT codebase and produce a complete list of everything that needs documentation. For each item, output one line: `CATEGORY | name | one-line description | source file(s)`.
>
> Categories: Component, Hook, Lua Module, CLI Command, Layout Concept, Animation API, Event Type, Target, Architecture Concept, Type/Interface, Utility.
>
> Search strategy — examine ALL of these:
> - `packages/shared/src/` — all exported components, hooks, types
> - `packages/native/src/` — reconciler, event dispatcher, host config
> - `packages/web/src/` — web renderer exports
> - `packages/grid/src/` — grid layout engine
> - `packages/terminal/src/`, `packages/cc/src/`, `packages/nvim/src/`, `packages/hs/src/`, `packages/awesome/src/` — target-specific code
> - `packages/components/src/` — compound components (Card, Badge, FlexRow, etc.)
> - `lua/` — layout.lua, painter.lua, bridge_quickjs.lua, init.lua, and all other Lua modules
> - `cli/commands/` — CLI commands
> - `cli/targets.mjs` — build targets
> - `storybook/src/stories/` — features demonstrated in stories but possibly undocumented
>
> Be exhaustive. Include internal APIs that advanced users would need for custom targets. Include every prop type, every hook, every Lua function that touches the public surface.

Collect all 4 lists. Merge and deduplicate into a master inventory.

### Phase 2: Coverage Audit

Compare the master inventory against existing files in `content/sections/`:

```
content/sections/**/*.txt
```

Produce three lists:
1. **Missing** — items in the inventory with no corresponding `.txt` file
2. **Stale** — existing `.txt` files whose source code has diverged (new props, changed API, renamed functions)
3. **Complete** — existing files that are up to date

For staleness detection: read both the `.txt` file and the source code it documents, compare prop tables, API signatures, and examples against actual exports.

Present the coverage report to the user. Ask which items to prioritize, or whether to proceed with everything.

### Phase 3: Writing (parallel sonnet agents)

For each missing or stale item, spawn a sonnet agent to write or update the `.txt` file. Batch into groups of 4-6 parallel agents to avoid overwhelming context.

**Agent prompt template:**

> Write documentation for `{name}` in the ReactJIT framework.
>
> Read the source code at `{source_files}` to understand the full API.
> Read [references/content-format.md] for the exact `.txt` format to follow.
> {If updating: Read the existing file at `content/sections/{section}/{filename}.txt` and preserve any correct content.}
>
> Output a complete `.txt` file following the format specification. Requirements:
> - METADATA section with all required fields
> - OVERVIEW: 2-4 sentences explaining what it is, when to use it, and how it fits in the framework
> - API / SYNTAX: import statement, full prop/parameter table from actual source code, type signatures
> - EXAMPLES: 2-4 practical examples with code blocks, each tagged with platforms
> - PLATFORM NOTES: only if behavior differs across targets
> - CRITICAL RULES: gotchas, common mistakes, things the linter catches
> - SEE ALSO: related components/hooks/concepts
>
> Write the file to `content/sections/{section}/{filename}.txt`.

After each batch completes, verify the files parse correctly:

```bash
npm run validate:docs
```

Fix any validation errors before proceeding to the next batch.

### Phase 4: Final Build & Supervision

1. Run the full build:
   ```bash
   npm run build:docs
   ```

2. Verify outputs exist and are reasonable:
   - `dist/llms/llms.txt` should contain all documented items
   - `storybook/src/generated/content.json` should be valid JSON
   - Spot-check 3-5 generated `.txt` files for accuracy

3. Report results:
   - How many files were created/updated
   - Any validation warnings remaining
   - Total coverage percentage (documented items / inventory items)

## Scoped Runs

The full pipeline is for comprehensive documentation passes. For targeted work:

**Single item:** Skip phases 1-2. Read the source, read the format spec, write the `.txt` file, validate, build.

**Single section:** Run phase 1 scoped to one package (e.g. only `packages/shared/src/hooks/`), then phases 3-4 for that section only.

**Staleness check only:** Run phases 1-2, report results, stop. Useful for auditing without writing.

## Key Paths

| What | Path |
|------|------|
| Content source of truth | `content/sections/**/*.txt` |
| Build script | `scripts/docs/build.ts` |
| Parser | `scripts/docs/parser.ts` |
| Validator | `scripts/docs/validate.ts` |
| Plaintext renderer | `scripts/docs/plaintext-renderer.ts` |
| Generated LLM docs | `dist/llms/*.txt` |
| Generated storybook data | `storybook/src/generated/content.json` |
| Storybook docs viewer | `storybook/src/docs/*.tsx` |
| Architecture docs | `docs/DOCS_CONTENT_FIRST_ARCHITECTURE.md` |
| LLM strategy | `docs/LLMS_TXT_STRATEGY.md` |
