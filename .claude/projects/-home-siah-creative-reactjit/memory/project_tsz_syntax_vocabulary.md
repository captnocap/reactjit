---
name: TSZ syntax vocabulary rules
description: Canonical operator and naming rules for .tsz DSL — is/exact/to/set_, camelCase vs snake_case, <For> tags, implicit returns, no Zig leakage
type: project
---

Canonical syntax vocabulary for .tsz files, derived from manifest/s00c_manifest.tsz.

## Operators
- **`is`** — assignment / default value (replaces `=`)
- **`exact`** — equality comparison (replaces `==`)
- **`to`** — setter target: `set_X to value`
- **`? stop : go`** — guard (bail or continue)
- **`? go : skip`** — conditional within loops
- **`+`** — function composition: `submit: addLog + saveSnapshot`
- **`and`** / **`or`** — boolean operators (never `&&` / `||`)

## Naming
- **camelCase** — all identities: variable names, function names, parameters
- **snake_case** — mutation ONLY: `set_count`, `set_record.status`
- If there's an underscore, it's a setter. No exceptions.
- Full words always: `priority` not `p`, `record` not `r`, `target` not `t`, `delta` not `dt`

## Blocks
- **`<var>`** — all declarations (ambients, constants, containers, initial values). One block, nothing hidden.
- **`<state>`** — just `set_` names. A state is a var + a setter. Not all vars are state.
- **`<functions>`** — mutations go through `set_X to value`. No direct `field = value`.
- **`<For each X in Y>`** — full iteration (replaces `for Y[range] as X:`)
- **`<For X in Y where condition>`** — filtered lookup (replaces `switch` + array indexing)
- **`<types>`** — struct/enum/union definitions. Field defaults use `is`.

## Implicit returns
- If a function declares a local accumulator (`total is 0`), that's the return. No `return` needed.
- Explicit `return` only for early exits (mid-loop bail) or when there are multiple possible return values.

## Ambient values
- `time.delta` — always available in tick functions, no parameter needed
- `sys.*`, `device.*`, `input.*`, `locale.*`, `privacy.*`, `time.*` — runtime-provided, declared in `<var>` as reads

## Anti-patterns
- No `=` or `==` anywhere — use `is` and `exact`
- No single-letter variables — spell it out
- No type annotations on function parameters — compiler infers
- No `switch` blocks — use `<For where>` with condition chains + `else`
- No `[0..count]` slice notation — `<For each>` handles bounds
- No snake_case on anything except setters

**Why:** The DSL should read like English, not like Zig/C wearing a costume. Every syntax decision that made the stress test more readable also made it shorter.

**How to apply:** When writing or reviewing any .tsz file — page, module, or component — enforce these rules. Reference m99_stress.mod.tsz as the canonical module example and s00c_manifest.tsz as the canonical page example.
