---
title: CLI Reference
description: All tsz subcommands, build targets, project registry, GUI dashboard, and system tray.
category: CLI
keywords: tsz, cli, build, run, dev, gui, tray, init, add, compile-runtime, project registry
related: Getting Started, Architecture, Runtime
difficulty: beginner
---

## Overview

The `tsz` binary is the entire toolchain: compiler, project manager, GUI dashboard, and system tray in one executable. It compiles `.tsz` source to native binaries, tracks registered projects, and provides a graphical dashboard for running actions without a terminal. There is no Node.js, no npm, no separate build server — one binary does everything.

## Building the Compiler

All build commands run from the **repo root** (where `build.zig` lives), not from the `tsz/` subdirectory.

```bash
zig build tsz-compiler                          # Debug build (default)
zig build tsz-compiler -Doptimize=ReleaseSmall  # Optimized, smallest binary
zig build tsz-compiler -Doptimize=ReleaseFast   # Optimized, fastest binary
```

Output: `zig-out/bin/tsz`

On first run after building, `tsz` offers to install a symlink at `~/.local/bin/tsz` so it's reachable from anywhere. Answer Y (or press Enter) to accept.

## Subcommands

### `tsz build <file.tsz>`

Compile a `.tsz` file to a native binary. Writes `tsz/runtime/generated_app.zig`, runs `zig build engine-app`, then copies the result to `zig-out/bin/tsz-<stem>`.

```bash
tsz build app.tsz           # → zig-out/bin/tsz-app
tsz build counter.tsz       # → zig-out/bin/tsz-counter
tsz build --debug app.tsz   # Debug build (no -Doptimize=ReleaseSmall)
```

By default builds with `-Doptimize=ReleaseSmall`. Pass `--debug` anywhere in the argument list to build in debug mode.

If the project is registered (via `tsz add` or `tsz init`), the build status (`pass`/`fail`) is recorded in the registry and shown in `tsz ls` and the GUI.

### `tsz run <file.tsz>`

Compile and run. Kills any existing process for this project, rebuilds, then spawns the binary and waits for it to exit.

```bash
tsz run app.tsz
tsz run --debug app.tsz   # Debug build + run
```

Kills the previous instance by project name before building, so it's safe to re-run repeatedly without leftover processes.

### `tsz dev <file.tsz>`

Watch mode. Compiles, launches the app, then polls the `.tsz` file every 500ms. On change: recompiles, kills the running instance, and relaunches. Ctrl+C to stop.

```bash
tsz dev app.tsz
```

If the initial build fails, `tsz dev` still starts watching — fix the source and save to trigger a rebuild. If the app exits on its own (crash, clean exit), `tsz dev` keeps watching and relaunches on the next save.

### `tsz test <file.tsz>`

Smoke-test pipeline: compile → verify source reference in `generated_app.zig` → run binary with `TSZ_TEST=1`. Waits up to 10 seconds for the binary to exit. If the binary contains test harness hooks (printing lines starting with `TEST `), their results appear in output. Otherwise reports `PASS (smoke)` if the binary exits cleanly.

```bash
tsz test app.tsz
```

Exit codes: 0 on pass, 1 on compile failure or timeout.

### `tsz init <name>`

Scaffold a new project. Creates `<name>/app.tsz` with a working counter example and auto-registers the project. Skips `app.tsz` creation if it already exists.

```bash
tsz init myapp
```

After init:

```bash
tsz build myapp/app.tsz   # Compile
tsz run myapp/app.tsz     # Compile and run
tsz dev myapp/app.tsz     # Watch mode
tsz gui                   # Open dashboard
```

The generated `app.tsz` is a minimal but complete counter with increment and decrement buttons — a working starting point, not pseudocode.

### `tsz add [dir|file.tsz]`

Register a `.tsz` project with the project registry.

```bash
tsz add app.tsz           # Register a specific file
tsz add .                 # Register all .tsz files in current directory
tsz add /path/to/project  # Register all .tsz files in a directory
```

When given a directory, scans for all `.tsz` files and registers each one. When given a `.tsz` file directly, registers that file only. Resolves to absolute paths internally — registration is portable across working directories.

Registered projects appear in `tsz ls` and the GUI dashboard.

### `tsz ls`

List all registered projects with their current status.

```bash
tsz ls
```

Output columns:

| Column | Values | Description |
|--------|--------|-------------|
| NAME | string | Project name (derived from filename stem) |
| STATUS | running / stopped / stale | Process state |
| BUILD | pass / FAIL / — | Last build result |
| PATH | absolute path | Path to the `.tsz` file |

`stale` means a PID file exists but the process is no longer running. Stale entries are cleaned automatically on `tsz ls`.

Aliases: `tsz list` maps to `tsz ls`.

### `tsz rm <name>`

Unregister a project. Kills the running process if active, then removes the entry from the registry.

```bash
tsz rm myapp
tsz rm counter
```

Alias: `tsz remove <name>` maps to `tsz rm`.

### `tsz gui`

Open the GUI dashboard window. Lists all registered projects with Build, Run, Dev, Test, and Remove buttons for each. Shows live output from running actions in a detail panel. The system tray (Linux) shows the dashboard and can trigger actions from the taskbar.

```bash
tsz gui
```

The GUI auto-populates from `actions.zig` — any action with `show_in_gui = true` appears as a button on every project row without any GUI-specific code.

Sending `SIGUSR2` to the `tsz gui` process raises an existing window to the foreground (used by the system tray's "Show Dashboard" menu item).

### `tsz compile-runtime <file.tsz>`

Compile a `.tsz` file to a runtime fragment (`.gen.zig`) instead of a standalone binary. Used for framework internals — devtools panels, crash screens, overlay components — that plug into the runtime's architecture without their own `main()`.

```bash
tsz compile-runtime Panel.tsz                  # → tsz/runtime/compiled/user/panel.gen.zig
tsz compile-runtime --framework Panel.tsz      # → tsz/runtime/compiled/framework/panel.gen.zig
```

Output naming: filename stem converted to lowercase snake_case with `.gen.zig` extension.

| Flag | Effect |
|------|--------|
| *(none)* | Output to `tsz/runtime/compiled/user/` |
| `--framework` | Output to `tsz/runtime/compiled/framework/` |

The output is a Zig module with a public API (`init`, `tick`, `getRoot`, named accessors) designed to be `@import`ed by the runtime. It has no `main()` and no SDL event loop. See [Two Output Modes](#two-output-modes) below.

## Two Output Modes

Every `.tsz` file compiles through the same codegen pipeline. The difference between `tsz build` and `tsz compile-runtime` is what gets emitted around the node tree:

**Full app (`tsz build`):**
- Writes `tsz/runtime/generated_app.zig` with `pub fn main()`, SDL window creation, and the full event loop
- Runs `zig build engine-app` to produce a standalone binary
- Output: `zig-out/bin/tsz-<name>`

**Runtime fragment (`tsz compile-runtime`):**
- Emits a `.gen.zig` module with `init`/`tick`/`getRoot` and named accessors
- No `main()`, no event loop — designed to be imported by the runtime
- Output: `tsz/runtime/compiled/{user,framework}/<name>.gen.zig`

The node tree, state slots, event handlers, dynamic text, and conditionals are identical between both modes. The wrapper is the only difference. Generated `.gen.zig` files are Zig source checked into the repo and compiled by `zig build engine` along with hand-written runtime code.

**Never edit `.gen.zig` files by hand.** Fix the `.tsz` source and recompile.

## Build Targets (zig build)

All targets run from the repo root:

| Target | Command | Output | Description |
|--------|---------|--------|-------------|
| `tsz-compiler` | `zig build tsz-compiler` | `zig-out/bin/tsz` | The compiler + project manager + GUI |
| `engine-app` | `zig build engine-app` | `zig-out/bin/tsz-app` | A compiled `.tsz` app (invoked by `tsz build` internally) |
| `engine` | `zig build engine` | `zig-out/bin/rjit-engine` | Standalone runtime without a compiled app |
| `run-engine` | `zig build run-engine` | *(runs directly)* | Build and run the standalone runtime |
| `run-tsz` | `zig build run-tsz -- <args>` | *(runs directly)* | Build and run the tsz compiler with arguments |

`engine-app` reads from `tsz/runtime/generated_app.zig` and `tsz/runtime/ffi_libs.txt`. The tsz compiler writes both files before invoking `zig build engine-app`. Do not invoke `zig build engine-app` directly unless `generated_app.zig` is already up to date.

## Project Registry

The registry persists to `~/.config/tsz/projects.json` (Linux/macOS) or `%APPDATA%\tsz\projects.json` (Windows). It is a flat JSON file with project name, absolute path, last build status, and last build timestamp.

```json
{
  "projects": [
    { "name": "counter", "path": "/home/user/apps/counter/app.tsz", "last_build": "pass", "last_build_time": 1741824000 },
    { "name": "myapp",   "path": "/home/user/apps/myapp/app.tsz",   "last_build": "fail", "last_build_time": 1741820000 }
  ]
}
```

Up to 64 projects can be registered. Re-adding a project that already exists by name updates its path without creating a duplicate.

Process state (running/stopped) is tracked via PID files in `~/.config/tsz/pids/`. Stale PID files (process no longer alive) are cleaned automatically when `tsz ls` or the GUI refreshes.

## GUI Dashboard

The dashboard window (`tsz gui`) provides a visual interface over the same registry and actions as the CLI.

**Layout:**
- Header with `tsz` title and project count
- One row per registered project showing name, status badge, last build result, and action buttons
- Detail panel below showing live output from the most recent action

**Action buttons per project row:** Build, Run, Dev, Test, Remove

Actions run as child processes with captured stdout/stderr piped into the detail panel. The GUI polls pipes non-blocking each frame, filters GPA leak traces and stack frame noise, and prepends timestamps to each output line.

The action table in `actions.zig` is the single source of truth — adding an action there with `show_in_gui = true` automatically surfaces it in both the CLI help text and every GUI project row.

## System Tray (Linux)

On Linux, `tsz gui` also installs a system tray indicator via `libayatana-appindicator3` + GTK3. The tray is a no-op on macOS and Windows (compiles away entirely).

**Tray menu:**
- Show Dashboard — raises the GUI window (`SIGUSR2` to the process)
- One entry per registered project, labeled with name and running state
- Clicking a project entry triggers the default action (Run if stopped, Build if running)
- Quit

The tray menu rebuilds from the registry whenever the GUI refreshes. GTK events are pumped non-blocking from the SDL event loop (up to 4 events per frame) to avoid stalling rendering.

## Common Workflows

### First project

```bash
zig build tsz-compiler
tsz init myapp
tsz dev myapp/app.tsz
```

### Add an existing project

```bash
tsz add /path/to/my-project/app.tsz
tsz gui
```

### Framework pre-compile

```bash
# Compile a devtools panel into a runtime fragment
tsz compile-runtime --framework tsz/devtools/DevtoolsPanel.tsz
# → tsz/runtime/compiled/framework/devtoolspanel.gen.zig

# Now zig build engine picks it up automatically
zig build engine
```

### Release build

```bash
tsz build app.tsz   # ReleaseSmall by default
# → zig-out/bin/tsz-app (~65KB stripped)
```

### Debug build

```bash
tsz build --debug app.tsz   # Full debug symbols, safety checks
tsz run --debug app.tsz     # Build debug + run
```

## Gotchas

- Run all `zig build` commands from the **repo root**, not from `tsz/`. The compiler changes directory to the repo root on startup, so `tsz build` works from anywhere — but bare `zig build` targets require the repo root.
- `tsz build` always outputs to `zig-out/bin/tsz-app` first (the fixed `engine-app` output name), then copies to `zig-out/bin/tsz-<stem>`. Both exist after a build.
- Multi-file `.tsz` apps (using `import`) are merged into a single source string before codegen. Import resolution is relative to the importing file's directory, up to 32 imports deep.
- `.gen.zig` files are generated — never edit them by hand. Fix the `.tsz` source and re-run `tsz compile-runtime`.
- The system tray only appears when `tsz gui` is running. It exits with the GUI window.
- Project names are derived from the `.tsz` file stem (`counter.tsz` → project name `counter`). Registering two files with the same stem in different directories causes a name collision — only the last one is stored.

## See Also

- [Getting Started](../01-getting-started/index.md)
- [Architecture: Two Output Modes](../02-architecture/index.md)
- [Runtime](../10-runtime/index.md)
