# Dev Mode

Hot-reload development with `tsz dev`.

## Overview

`tsz dev` provides a 63x faster iteration loop compared to `tsz build`. Instead of producing a full static binary, it compiles the `.tsz` app to a shared library (`.so`) and loads it into a persistent dev shell that supports hot-reload on file changes.

```
tsz dev myapp.tsz
  → compile .tsz → generated_app.zig
  → zig build app-lib → libmyapp-lib.so
  → launch tsz-dev shell (or reuse existing)
  → watch for .tsz changes → recompile → hot-reload (~186ms)
```

## Usage

```bash
# Start dev mode
bin/tsz dev carts/path/to/app.tsz

# The shell stays open. Edit any .tsz file in the cart directory.
# Changes are auto-detected → recompile → hot-reload.
# State (counters, form values, etc.) survives reloads.
```

## How It Works

### Step-by-step

1. **Compile**: `tsz` compiles `.tsz` → `generated_app.zig` (same as `tsz build`)
2. **Build .so**: Runs `zig build app-lib` — produces a shared library instead of a full binary. This is pure Zig with no native deps linked, making it much faster to build
3. **Build dev shell**: On first run, builds `tsz-dev` (the dev shell binary). This is cached — subsequent runs skip this step
4. **Single-instance check**: Checks `/tmp/tsz-dev.pid` for an existing running shell
   - If shell is already running: rebuilds the .so and exits (the running shell auto-reloads)
   - If no shell: launches a new one
5. **Watch loop**: Polls all `.tsz` files in the cart directory every 500ms for mtime changes. On change, recompiles and rebuilds the .so

### Hot-Reload Mechanism

The dev shell uses `dlopen`/`dlsym` to load the cartridge `.so`. When the `.so` file changes on disk:

1. Shell detects the mtime change
2. Calls `dlclose` on the old library
3. Calls `dlopen` on the new library
4. Re-resolves the ABI symbols (`app_get_root`, `app_get_init`, `app_get_tick`, etc.)
5. Calls `app_get_init` to reinitialize the node tree

State slots survive because they live in the shell, not the cartridge.

### Single Instance

A PID file at `/tmp/tsz-dev.pid` prevents duplicate windows:

```
First run:  tsz dev app.tsz  → builds .so, launches shell, writes PID file
Second run: tsz dev app.tsz  → builds .so, sees shell running, exits
                               (running shell auto-reloads the new .so)
```

## CartridgeOS (Multi-App)

The dev shell can host multiple cartridges in a tabbed interface:

```bash
tsz-dev app1.so app2.so app3.so
```

Each cartridge has independent:
- State slots
- Event handlers
- Node tree
- Lifecycle (init/tick)

Cartridges hot-reload independently.

## Build Targets

| Target | Output | Use case |
|--------|--------|----------|
| `zig build app` | Full binary | Production (links everything — slow) |
| `zig build app-lib` | `.so` shared library | Dev mode (pure Zig — fast) |
| `zig build dev-shell` | `tsz-dev` binary | Dev shell (built once, cached) |
| `zig build cart` | Custom `.so` | Zig cartridge for embedding |

## Cartridge ABI

Any `.so` that exports these 6 C functions can be loaded as a cartridge:

| Export | Signature | Purpose |
|--------|-----------|---------|
| `app_get_root` | `() -> *Node` | Returns the root node tree |
| `app_get_init` | `() -> fn()` | Returns the init callback |
| `app_get_tick` | `() -> fn()` | Returns the per-frame tick callback |
| `app_get_title` | `() -> [*:0]const u8` | Returns the app title string |
| `app_state_count` | `() -> u32` | Returns number of state slots |
| `app_state_*` | varies | State slot accessors |

Any language that can produce a `.so` with C exports works: Zig, Rust, C, Go.

## `<Cartridge>` Component

Embed a `.so` inline as a UI component:

```tsx
<Cartridge src="sidebar.so" style={{ width: 250 }} />
<Cartridge src="editor.so" style={{ flexGrow: 1 }} />
```

## Known Limitations

- Watch loop polls every 500ms — changes faster than that may be batched
- State survives hot-reload but the node tree is rebuilt from scratch
- Dev shell must be built with the full feature set to load any cartridge
- PID file at `/tmp/tsz-dev.pid` is per-machine, not per-project
- Linux only (uses `dlopen`/`dlsym`, POSIX signals)
