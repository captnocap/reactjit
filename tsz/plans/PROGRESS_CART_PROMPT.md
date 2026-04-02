# Progress Cart — Build Prompt

## What You're Building

A developer dashboard cart called `progress` that visualizes the project's evolution and provides a fast human verification workflow for the conformance suite.

It has **two modes**: a timeline/charts view (main window) and a test runner view (second window via IPC).

---

## Part 1: Timeline & Charts (Main Window)

The main window shows 4 panels, switchable via tabs or sidebar:

### 1. Commit Timeline
- Read `git log --oneline --format="%H|%ci|%s" -200` from the tsz/ directory
- Render as a vertical timeline with dots, dates, and commit messages
- Color-code by conventional commit prefix: `fix()` = red, `feat()` = green, `refactor()` = blue, `docs()` = gray
- Show commit density per day as a mini heatmap row at the top

### 2. File Creation Timeline
- Read `git log --diff-filter=A --format="%ci" --name-only` to get file creation dates
- Group by directory (compiler/, framework/, carts/, etc.)
- Render as a stacked area chart or swimlane showing when each area of the codebase grew
- Highlight conformance test additions specifically

### 3. Conformance Suite Report
- Read from `conformance.db` (SQLite) — schema is:
  - `builds` table: `id, test_name, lane, built_at, status, binary_sha, binary_size, error_log, verified_at, source_sha`
  - `verified_sources` table: `test_name, source_sha, verified_at, source_path, verified_build_id`
- Show pass rate over time (each build creates a row, plot status by date)
- Per-lane breakdown: mixed, chad, soup, wpt-flex, lscript (bar chart or table)
- Current snapshot: compiled count, failed count, verified count, untested count
- Failure categories: preflight_blocked, flight_fail, zig_fail (pie or bar)

### 4. Verification Runner (control panel for Part 2)
- List all conformance tests from disk: `find carts/conformance -name "*.tsz"` (exclude non-entry extensions)
- Show status from db: compiled/failed/verified/untested
- Arrow keys to navigate the list
- Enter to load the selected test into the second window (see Part 2)
- Show verified timestamp if exists, source hash, lane
- Quick-verify button: after visual inspection, mark as verified (writes to db via `./scripts/conformance-report --verify <name>`)

---

## Part 2: Test Runner Window (Second Process via IPC)

This is the key architectural piece. The main progress cart does NOT render the test itself. Instead:

### Architecture

```
[Progress Cart]  ──IPC──>  [Dev Shell Process]
   main window                second window
   controls which              loads .so files
   test to show                via hot-reload
```

### How It Works

1. **The progress cart spawns a dev-shell process** as a second window. The dev-shell is the same binary used by `tsz dev` — it's a host that can dynamically load `.so` cartridges at runtime.

2. **Communication is via IPC** (Unix domain socket or named pipe). The progress cart sends commands:
   - `LOAD <path-to-so>` — load a compiled test .so into the dev shell
   - `UNLOAD` — clear the current cartridge
   - `PING` — health check

3. **When the user navigates tests in the progress cart** (arrow keys in the verification panel), the cart:
   - Builds the selected test: `./scripts/build carts/conformance/<lane>/<test>.tsz`
   - Finds the output .so (or uses the binary directly)
   - Sends `LOAD <path>` via IPC to the dev shell
   - The dev shell hot-reloads the new .so — the second window now shows that test

4. **The user visually inspects** the test in the second window, then presses a key in the progress cart to mark it verified or flag it.

### Implementation Notes

- The dev shell already supports hot-reload of .so files — that's what `tsz dev` does. The progress cart just needs to control which .so is loaded.
- Use `<window>` in the progress cart source to declare intent for a second window, but the actual implementation is `std.process.Child` spawning the dev-shell binary.
- The IPC channel should be a Unix domain socket at `/tmp/tsz-progress-ipc.sock`. Simple line protocol: one command per line, response on next line.
- The dev shell needs a small IPC listener mode. Check if `tsz dev --ipc` or similar exists. If not, the simplest path is: the progress cart writes the .so path to a known file (`/tmp/tsz-progress-current.so`), and the dev shell watches that file for changes (inotify or poll).

### Fallback (Simpler)

If full IPC is too complex for v1: the progress cart just runs `./scripts/build <test>.tsz` and then launches the resulting binary as a child process. Kill the old child before launching the new one. No hot-reload, just process cycling. Still gets the job done for verification.

---

## Build & File Structure

```
carts/tools/progress/
  Progress.tsz              — main app (tabs, charts, verification panel)
  progress.script.tsz       — JS logic: git parsing, db queries, IPC
  progress.cls.tsz           — classifiers for the UI
  ipc.script.tsz            — IPC client (send commands to dev shell)
```

Build: `./scripts/build carts/tools/progress/Progress.tsz`

The cart uses `<script>` blocks for:
- `__exec('git log ...')` to read git history
- SQLite queries against `conformance.db` (via the sqlite lib or `__exec('sqlite3 conformance.db "..."')`)
- IPC socket communication
- File system reads for test discovery

---

## Reference Files

Before writing code, read these:
- `tsz/CLAUDE.md` — build commands, compiler pipeline
- `tsz/scripts/build` — how builds work, conformance db schema
- `tsz/scripts/conformance-report` — how reports are generated, db queries
- `tsz/framework/windows.zig` — multi-window support (check `.independent` mode)
- `tsz/carts/hotreload-test/` — example of hot-reload cart
- `tsz/carts/supervisor-dashboard/` — example of a complex multi-panel dashboard cart
- `tsz/carts/tools/Tools.tsz` — example of a tools app with tabs

---

## Design

Dark theme. Dense but readable. The target user is the developer (me) who wants to:
1. See project momentum at a glance (timelines, charts)
2. Rapidly cycle through conformance tests to verify them visually
3. Never leave the app to verify — the test renders live in window 2

No scroll for the main view — use tabs/panels. The verification list can scroll. Keep it functional, not pretty.
