# Spreadsheet Roadmap

This package has a working single-sheet grid, Lua-backed formula runtime, and basic viewport virtualization.
The next work should tighten three things in parallel: responsive layout, interaction depth, and test coverage.

## Phase 1: Responsive Foundation

Status: in progress

- Add fit-to-viewport column sizing for embedded layouts.
- Keep horizontal scrolling as the fallback when minimum widths prevent a full fit.
- Expand automated coverage for:
  - TS address helpers
  - Lua address parity
  - viewport-fit layout math
  - Lua formula contracts

Definition of done:
- Mini and medium embeds fill their container cleanly.
- Layout helpers have direct node tests.
- Lua-backed address behavior has a parity-checked counterpart harness.

## Phase 2: Spreadsheet Interaction Core

Status: planned

- Keyboard navigation: arrows, tab, enter, shift+enter, escape.
- Inline cell editing without forcing all edits through the formula bar.
- Sticky header row and frozen first column.
- Undo and redo for cell edits and column resize actions.

Definition of done:
- Keyboard workflows work without pointer input.
- Header row remains visible while scrolling vertically.
- First column can stay pinned for dense operational sheets.

## Phase 3: Range Workflows

Status: planned

- Multi-cell selection.
- Copy and paste rectangular ranges.
- Fill handle / drag-copy behavior.
- Bulk clear and bulk set operations.

Definition of done:
- Range actions are deterministic and covered by integration tests.
- Bulk operations preserve formula references correctly.

## Phase 4: Data Operations

Status: planned

- Sort and filter controls.
- Hidden rows and columns.
- Validation rules and typed cell formatting.
- Import and export for CSV/TSV.

Definition of done:
- Operational datasets can be cleaned and reviewed in-app without leaving the runtime.

## Phase 5: Formula Runtime Expansion

Status: in progress

- Absolute and mixed references (`$A$1`, `A$1`, `$A1`).
- Named ranges.
- Error helpers such as `IFERROR`.
- Lookup and reference functions.
- Date/time formulas where they fit the runtime cleanly.

Definition of done:
- Formula authoring covers the common spreadsheet contracts used in real app workflows.

## Test Strategy

- `nodeOnly`: pure TS layout math and non-runtime UI helpers.
- `luaBacked`: anything mirrored in `lua/capabilities/data.lua`.
- Every new formula/runtime feature should add or expand a Lua harness.
- UI-only layout behavior should be factored into testable helper functions instead of living only inside the component body.
