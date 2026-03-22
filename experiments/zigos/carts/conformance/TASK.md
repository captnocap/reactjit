# Conformance Test Suite — Worker Task

## Objective

Make every conformance test compile, build, and **run correctly**. The test files are SHA256-locked. You cannot modify them. Fix the compiler.

## Rules

1. **The test files are immutable.** `CHECKSUMS.sha256` locks every `.tsz` file. If `sha256sum -c` fails, you modified a test file. Undo it immediately. Fix the compiler, not the tests.

2. **"It compiles" is not done.** Each cart must:
   - Pass `zigos-compiler build` without errors or warnings
   - Build the resulting Zig without errors (`zig build app`)
   - **Run and render correctly** — launch the binary, visually confirm the UI works
   - Take a screenshot or describe what you see to prove it

3. **Runtime verification is mandatory.** After building, run the binary:
   ```bash
   ./zig-out/bin/<CartName>
   ```
   If UI elements are missing, wrongly positioned, or the app crashes at runtime — it's not passing. If state changes (pressing buttons, toggling tabs) don't work — it's not passing.

4. **Significant compiler changes are expected.** These tests exercise patterns the compiler may not fully support yet. Refactoring emit.zig, jsx.zig, collect.zig, etc. is the point. That's the goal.

5. **If you believe a test is truly impossible** (requires a language feature that fundamentally doesn't exist and can't be added), stop. Write your reasoning in `PROGRESS.md` and take off the loop. Do not silently skip tests or hack around them.

6. **Keep the loop running.** You are on a monitoring loop. Keep working through the tests in order. Only remove yourself from the loop if you are genuinely stuck and need human guidance.

## Fix `check` segfault

`zigos-compiler check` segfaults on any non-trivial cart — including known-working ones like the Inspector. This is a pre-existing bug, not caused by the conformance tests. It must be fixed as part of this task.

The `check` command runs the codegen + preflight pipeline and is supposed to validate without doing a full Zig build. It currently crashes (exit code 139 / segfault) on anything with multiple components, maps, or module imports. Example:

```
$ timeout 30 ./zig-out/bin/zigos-compiler check carts/inspector/Inspector.mod.tsz
PREFLIGHT:DEP:carts/inspector/Inspector.mod.tsz
PREFLIGHT:DEP:carts/inspector/./style_clsmod.tsz
... (loads deps fine, then segfaults)
Segmentation fault
```

Fix this. `check` should work on every conformance test AND the existing Inspector/Storybook carts without crashing.

## Known issue: MAP_POOL 4096 hangs Zig compiler

`emit.zig` currently sets `MAX_MAP_N = 4096`. This generates `[4096]Node` stack arrays that cause the Zig compiler to hang at ReleaseFast. Some conformance tests will timeout because of this. You need to fix this — either revert to 256, use heap allocation, or use `@memset` instead of the compile-time `** 4096` splat.

## How to run

```bash
cd experiments/zigos
bash carts/conformance/run_conformance.sh
```

The runner auto-discovers entry points (any `.tsz` that isn't `_cls`, `.script`, `_c`, `_cmod`, `_clsmod`, or `.mod`). It verifies SHA256 checksums first, then builds each one with a 30s timeout.

## Test inventory (16 entry points, 31 files total)

### Real-world app ports (from GitHub React projects)

These are direct ports of real open-source React apps. `div`→`Box`, `p`/`span`→`Text`, `button`→`Pressable`, `className`→inline styles. The patterns are what real developers actually write.

| # | File | Source repo | Key patterns |
|---|------|-------------|-------------|
| 01 | `01_ecommerce_dashboard.tsz` | adrianhajdin/project_syncfusion_dashboard | 3 object arrays (`earningData`, `recentTransactions`, `weeklyStats`), 3 `.map()` calls, `flexWrap`, deeply nested layout (6+ levels), template literals with interpolation, script import for data population |
| 02 | `02_admin_sidebar.tsz` | safak/youtube2022 react-admin | Sidebar with 12 nav items via component reuse, datatable via `.map()` with conditional status badges (`user.status == 1`), section switching (`activeSection == 0`, `== 1`), widget components with props, dark mode toggle, nested conditional blocks |
| 03 | `03_jira_board.tsz` | oldboyxx/jira_clone | 4 separate object arrays (backlog/selected/inProgress/done), 4 parallel `.map()` calls in kanban columns, issue detail overlay panel (`detailOpen == 1`), components with 4+ props, `PriorityIcon`/`TypeIcon` components with 3-way conditional, filter toggles (`myOnly`, `recentOnly`), status/priority selectors in detail view |

### Destructive pattern tests (designed to break the compiler)

These target specific patterns that are normal in React but likely unsupported or broken in the compiler.

| # | File | What it breaks |
|---|------|---------------|
| d01 | `d01_nested_maps.tsz` | **Map inside map.** `groups.map((group) => ... group.items.map((item) => ...))`. Requires nested object arrays (array-of-objects where a field is itself an array-of-objects) and correct scope rewriting so inner closure captures both `group` and `item`. |
| d02 | `d02_component_returning_map.tsz` | **Component whose return value IS a map.** `function TagList() { return tags.map(...) }` — no wrapping Box. The map expression is the entire component body. |
| d03 | `d03_conditional_wrapping_map.tsz` | **Conditional around a map.** `{showList == 1 && items.map((item) => (...))}` — the `.map()` call is inside a conditional expression. Compiler must handle the interaction between conditional codegen and map codegen. |
| d04 | `d04_map_handler_captures.tsz` | **onPress inside map captures outer state.** `onPress={() => { setSelected(index); setTotal(total + item.value) }}` — handler inside map template reads/writes state vars from the outer scope while also referencing `item` fields and `index`. |
| d05 | `d05_dynamic_style_in_map.tsz` | **Style properties computed from item fields.** `backgroundColor: item.color` — a style property's value comes from the map item, not a literal. Requires the style system to handle dynamic values from the map scope. |
| d06 | `d06_ternary_jsx_branches.tsz` | **Ternary returning different JSX.** `{count > 5 ? <Box>...</Box> : <Box>...</Box>}` — true ternary with JSX on both branches, not just `{x && <Y/>}`. |
| d07 | `d07_sibling_maps_shared_state.tsz` | **Two maps side by side sharing state.** Both `.map()` calls read the same state vars, and `onPress` handlers in both maps write to shared state. Tests that multiple map pools coexist and state updates from one map are visible to the other. |
| d08 | `d08_map_classifier_components.tsz` | **Component invocation inside map.** `cards.map((card) => <Badge kind={card.kind} value={card.value} />)` — a user component is called from within the map template, with item fields forwarded as props. The component itself has 3-way conditionals on the prop values. |
| d09 | `d09_nested_template_scope.tsz` | **Template literal scope rewriting.** Template literals inside maps that reference item fields, index, outer state, AND arithmetic on all three: `` {`[${ri}] ${row.label}: sum=${row.x + row.y + ri + offset}`} ``. If scope rewriting mishandles template literal interpolation, this produces wrong output or crashes. |
| d10 | `d10_handler_triple_capture.tsz` | **Handler captures item + index + outer state in one closure.** Single `onPress` reads `entry.weight`, `idx`, AND `multiplier`/`accumulator`/`clickLog`, then writes to 4 state vars using all of them: `setAccumulator(accumulator + entry.weight * multiplier + idx)`. Three scopes captured simultaneously. |
| d11 | `d11_map_component_map.tsz` | **Map → Component → Map.** Outer map iterates departments. Each renders `EmployeeList` component. That component contains an inner map iterating a *different* array filtered by `emp.deptIdx == deptIdx`. Parser must track map scope, exit into component scope, re-enter a new map scope with different item/index bindings. |
| d12 | `d12_kanban_evil.tsz` | **The Evil Kanban.** `columns.map()` → `tasks.map()` filtered by `colIdx` + `filterPriority` + `showDone` → `TaskTags` component with `tags.map()` filtered by `taskIdx` → tag rendering branches on `selectedTask` (deepest scope sees global state). Sparse rendering: tasks that don't match filters produce empty boxes. `CardWrapper` forwarding component adds indirection. Edit branch swaps entire card for inline form. Handler in edit form captures task + column + global state and writes 4 vars. Derived text mixes `col.title`, `colIdx`, `taskIdx`, `cardIndex`, `totalMoves`. No dead state — every var pressures rendering or handlers. |
| d13 | `d13_schema_form.tsz` | **Schema-driven form.** `sections.map()` → `fields.map()` filtered by `sectionIdx` → 4-way widget switch per `field.type`. `FieldRow` wrapper forwards props (indirection layer). `sectionIdx` used in derived status text and nested conditional under type 3 (`activeSection == sectionIdx && formDirty == 1`). Type 0 has nested conditional: validation warning only when `formDirty == 1 && lastEdited == fieldIdx`. Section header has derived text mixing `sec.label`, `si`, `editCount`, `formDirty`. No decorative organs. |

## Baseline results (before any work)

Not yet run with all 16 tests. Previous partial run (12 tests):

```
01_ecommerce_dashboard                  FAIL (timeout)
02_admin_sidebar                        PASS (compile only — not runtime verified)
03_jira_board                           PASS (compile only — not runtime verified)
d01_nested_maps                         FAIL (timeout)
d02_component_returning_map             PASS (compile only — not runtime verified)
d03_conditional_wrapping_map            PASS (compile only — not runtime verified)
d04_map_handler_captures                PASS (compile only — not runtime verified)
d05_dynamic_style_in_map                FAIL (timeout)
d06_ternary_jsx_branches                PASS (compile only — not runtime verified)
d07_sibling_maps_shared_state           PASS (compile only — not runtime verified)
d08_map_classifier_components           PASS (compile only — not runtime verified)
d09_nested_template_scope               PASS (compile only — not runtime verified)
d10_handler_triple_capture              (not yet tested)
d11_map_component_map                   (not yet tested)
d12_kanban_evil                         (not yet tested)
d13_schema_form                         (not yet tested)
```

"PASS" only means the Zig compiled — the app may crash or render garbage at runtime. None are runtime verified.

## Phase 2: HTML tag support + WPT flex conformance

After all 16 tests pass, the next task is adding HTML element support to the compiler and porting W3C Web Platform Tests for flexbox.

### Step 1: Add HTML tag support to the compiler

The compiler must accept HTML tags and map them to primitives automatically:

```
div, section, article, main, aside, header, footer, nav, form, ul, ol, li, table, tr, td → Box
span, p, h1-h6, label, strong, em, code, pre, a → Text
button → Pressable
img → Image
input, textarea → TextInput
```

This mapping already exists in two places in the love2d stack:
- `compiler/lint.zig:218-239` — the warning table that says "use Box instead of div"
- `love2d/cli/commands/convert.mjs:34-60` — the full `rjit convert` element map

The lint warning is already there. The compiler just needs to actually accept these tags instead of rejecting them. This is likely a small change in the JSX parser where it resolves tag names to node types.

**The WPT flex tests will use `<div>` not `<Box>`.** This is intentional — the tests are checksummed. The compiler must handle HTML tags natively.

### Step 2: Port WPT flexbox tests

The W3C Web Platform Tests have 1301 HTML flexbox test cases at `github.com/web-platform-tests/wpt/tree/master/css/css-flexbox`. These test every flex property combination.

Each WPT test is a simple HTML file with a flex container, child divs with specific CSS, and expected layout results. Example:

```html
<div style="display:flex; width:300px; height:100px; align-content:center; flex-wrap:wrap">
  <div style="width:150px; height:26px"></div>
  <div style="width:150px; height:26px"></div>
</div>
```

This becomes a `.tsz` file:

```tsx
<div style={{ width: 300, height: 100, alignContent: "center", flexWrap: "wrap" }}>
  <div style={{ width: 150, height: 26 }} />
  <div style={{ width: 150, height: 26 }} />
</div>
```

Priority categories to port (in order):
1. `flex-direction` (row/column)
2. `justify-content` (start/center/end/space-between/space-around/space-evenly)
3. `align-items` (start/center/end/stretch)
4. `flex-grow` / `flex-shrink`
5. `flex-wrap`
6. `gap`
7. `align-self`
8. `align-content`
9. Padding / margin interactions
10. min/max width/height constraints

The goal is a score: "X/Y WPT flex tests pass." This tells us exactly where the layout engine stands vs the spec.

## Work order

1. Fix the MAP_POOL 4096 hang (unblocks 01, d01, d05, and likely d12/d13)
2. Fix the `check` segfault
3. Go through each test in order — compile, build, run, verify visually
4. Update `PROGRESS.md` after each test
5. (Phase 2) Add HTML tag support to the compiler
6. (Phase 2) Port WPT flex tests using `<div>` tags, get a score
