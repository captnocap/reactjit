# Rename Catalog: `cursor-ide` / `cursor` / `Cursor` -> `sweatshop` / `Sweatshop`

Catalog source:
- Repo-wide `rg -n 'cursor-ide|cursor_ide|cursorIde|Cursor IDE|cursor\\.ide'`
- Repo-wide `rg -in 'cursor'`

Notes:
- This is a prep-only catalog. No rename steps have been executed.
- The generic `cursor` search is very noisy. Bucket `g` below separates caret/loop-variable hits from actual app rename targets.
- `package.json` does not appear to contain any cursor-related package/app name entries; the repo root `package.json:2` is unrelated (`hermes-stack`).

## Bucket A. Directory path name references
These are path literals or file references that point at the current cart directory and will need to move with the directory rename.

- `cart/cursor-ide/index.tsx:339-379,473-474,499`
- `cart/cursor-ide/data.ts:121-130`
- `cart/cursor-ide/components/landing.tsx:44`
- `cart/cursor-ide/components/cockpit/WorkerCanvas.tsx:16,18,283`
- `cart/load_via_hook.tsx:20`
- `cart/load_via_react.tsx:18`
- `cart/cursor-ide/theme.ts:15-29`
- `STATUS_TSLX.md:133,135`
- `INVESTIGATION_REPORT.md:34,40,57,68,154,175`
- `INVESTIGATION_REPORT_2.md:199-200`
- `framework/lua/jsrt/TARGET.md:150-152`

Also present in frozen / reference lanes:
- `tsz/docs/INDEX.json:4-14`
- `tsz/plans/fix.md:5,13,32,51,138,141,149,217,276`
- `tsz/carts/conformance/mixed/cursor-ide/cursor-ide.tsz`
- `tsz/carts/conformance/mixed/cursor-ide/cursor.script.tsz`
- `tsz/carts/conformance/mixed/cursor-ide/*` companion component files
- `tsz/carts/conformance/mixed/sweatshop/*` references to the future name already exist

## Bucket B. Build / script references
These affect `zig build`, `scripts/ship`, `scripts/dev`, generated bundle names, and app-name checks.

- `build.zig:5-16`
- `scripts/ship:71,108`
- `scripts/dev:66`
- `qjs_app.zig:9,35,38,42,45-46,87-88`
- `v8_app.zig:9,34,37,40,43-44,73-74`
- `jsrt_app.zig:4,25-26,32-33`
- `framework/lua/jsrt/test/run_targets.sh:32`
- `STATUS_TSLX.md:111,114-115`
- `AGENTS.md:128,218`
- `framework/lua/jsrt/docs/click_latency_plan.md:3`
- `framework/input.zig:20`
- `framework/text.zig:1038`

## Bucket C. User-visible text / UI labels
These are labels or copy the user sees in the app, dialogs, settings, chips, or docs-as-UI surfaces.

- `cart/cursor-ide/index.tsx:473-474`
- `cart/cursor-ide/index.tsx:653`
- `cart/cursor-ide/index.tsx:1350`
- `cart/cursor-ide/index.tsx:1396-1411`
- `cart/cursor-ide/components/settings.tsx:1519,1615`
- `cart/cursor-ide/components/icons.tsx:289`
- `cart/cursor-ide/components/cockpit/WorkerCanvas.tsx:283`
- `cart/cursor-ide/components/landing.tsx:44`
- `cart/cursor-ide/FEATURES.md:1,19,36,95-104`
- `cart/cursor-ide/T3CODE_AUDIT.md:1,24`
- `STATUS_TSLX.md:76,111,114-115,133,135`
- `INVESTIGATION_REPORT.md:1,5,34,40,57,68,154,175`
- `INVESTIGATION_REPORT_2.md:1,198-200`

## Bucket D. package.json-style names
No cursor-related package-name entries were found in `package.json`.

- `package.json:2` is `hermes-stack` and is unrelated to the rename.

## Bucket E. Internal symbols / identifiers
These are storage keys, React symbols, internal constants, or function/component identifiers that encode the current product name.

App / state identifiers:
- `cart/cursor-ide/index.tsx:104`
- `cart/cursor-ide/index.tsx:146-212`
- `cart/cursor-ide/index.tsx:261`

Storage keys / localstore keys:
- `cart/cursor-ide/chat-hooks.ts:112`
- `cart/cursor-ide/chat-export.ts:70,82-85`
- `cart/cursor-ide/plan.ts:10-11`
- `cart/cursor-ide/default-models.ts:66`
- `cart/cursor-ide/variables.ts:92-93`
- `cart/cursor-ide/indexer.ts:7-8,310`
- `cart/cursor-ide/local-endpoint.ts:25`
- `cart/cursor-ide/checkpoint.ts:19`
- `cart/cursor-ide/proxy.ts:30-32`
- `cart/cursor-ide/api-keys.ts:10,65`
- `cart/cursor-ide/components/commandpalette.tsx:14`
- `cart/cursor-ide/components/terminal.tsx:19`
- `cart/cursor-ide/plugin/loader.ts:6`

UI state / caret identifiers that may need a rename but are not brand text:
- `cart/cursor-ide/components/editor.tsx:85,135-148`
- `cart/cursor-ide/components/statusbar.tsx:188-191`
- `cart/cursor-ide/hooks/useCursorPosition.ts:28-47`
- `cart/cursor-ide/index.tsx:1499,1777-1778`

## Bucket F. Docs / comments
These are narrative references, comments, and planning docs that mention the current name.

- `AGENTS.md:59,218`
- `CLAUDE.md:97`
- `STATUS_TSLX.md:76,111-115,133,135`
- `INVESTIGATION_REPORT.md:1,5,34,40,57,68,154,175`
- `INVESTIGATION_REPORT_2.md:1,198-200`
- `cart/cursor-ide/theme.ts:1,15-29`
- `cart/cursor-ide/themes.ts:1`
- `cart/cursor-ide/T3CODE_AUDIT.md:1,24`
- `cart/cursor-ide/FEATURES.md:1,19,36,95-104`
- `cart/cursor-ide/components/settings.tsx:1724`
- `cart/cursor-ide/components/icons.tsx:289`
- `framework/lua/jsrt/TARGET.md:150-152`
- `framework/lua/jsrt/docs/click_latency_plan.md:3`
- `renderer/hostConfig.ts:364,462`
- `framework/input.zig:20`
- `framework/text.zig:1038`

Legacy / frozen reference docs:
- `tsz/docs/INDEX.json:4-14`
- `tsz/plans/fix.md:5,13,32,51,138,141,149,217,276`
- `tsz/carts/conformance/mixed/cursor-ide/*`
- `tsz/carts/conformance/mixed/sweatshop/*`

## Bucket G. False positives
These are plain `cursor` hits that refer to caret position, scanning cursors, or loop variables. They are not app-name rename targets.

- `cart/cursor-ide/mermaid/parser.ts:153-226`
- `cart/cursor-ide/mermaid/layout.ts:208-217`
- `cart/cursor-ide/components/terminal.tsx:130-139,556`
- `cart/cursor-ide/components/editor.tsx:85`
- `cart/cursor-ide/components/statusbar.tsx:188-191`
- `cart/cursor-ide/hooks/useCursorPosition.ts:28-47`
- `cart/cursor-ide/index.tsx:261`
- `runtime/tw.ts:251-253`
- `runtime/host.zig:290-304`
- `v8_app.zig:1455,1555`
- `qjs_app.zig:1547,1647`
- `mermaid` / `runtime` / `terminal` / `editor` cursor variables in general are caret/scan cursors, not the product name.

## Order of operations
For the actual rename, keep the operations in this order:

1. `git mv cart/cursor-ide cart/sweatshop` in one atomic move.
2. Fix imports and direct path references that now point at the moved directory.
3. Fix build and script references (`build.zig`, `scripts/ship`, `scripts/dev`, app-name checks, generated bundle naming, test harnesses).
4. Fix user-visible UI labels and docs/comments.
5. Remove old compatibility aliases and stale references only after the build is green.

## Practical rename targets
The highest-value direct targets are:

- The `cart/cursor-ide` directory tree itself.
- `scripts/ship`, `scripts/dev`, and `build.zig`.
- App-name checks in `qjs_app.zig`, `v8_app.zig`, and `jsrt_app.zig`.
- Persistent storage keys under `cart/cursor-ide/*`.
- Docs and UI labels that still say `cursor-ide` or `Cursor IDE`.
