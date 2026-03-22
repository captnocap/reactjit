# `tsz tools` — Unified Dev Tooling App

**One binary, one .tsz app, five modes. Written in .tsz, not Zig. Dogfooding the framework.**

## Entry point

`carts/tools/Tools.app.tsz` — single cart that compiles to `tsz-tools` binary.

## Modes (tabs/views within the app)

### 1. Dashboard (default view)

- Lists registered .tsz projects (reads from `~/.tsz/registry.json`)
- Per-project action buttons: build, run, dev, test, clean
- Live build output log panel (scrollable, selectable)
- Process status indicators (running/stopped/crashed)
- "Add project" via file picker or path input

### 2. Inspector (attach mode)

- Lists all running .tsz app processes (discovered via IPC broadcast or PID scan)
- Click to attach — connects to app's debug IPC server
- Element tree, style panel, perf profiler, constraint graph
- Highlight tool sends selection commands back to the target app
- Can tab between multiple attached apps
- Live telemetry graphs (FPS, layout time, paint time, visible nodes, bridge calls/s)

### 3. BSOD Viewer (crash reports)

- Reads crash reports from `~/.tsz/crashes/` (apps write here on crash)
- List view of recent crashes with app name, timestamp, reason
- Click to see full detail: stack trace, watchdog snapshot, memory stats
- Copy to clipboard, reboot app buttons

### 4. Test Runner (scripted testing)

- Script editor panel — write test sequences in .script.tsz
- Record mode — click around the attached app, it records interactions as a test script
- Playback — replay scripts against the running app via debug.simulate.*
- Assertions — add checkpoints (screenshot diff, tree match, style check)
- Results panel — pass/fail with visual diffs
- No Playwright, no browser, no Node — all native IPC within the stack

### 5. System Tray (background)

- Sits in notification area when tools window is closed
- Right-click menu: recent projects, quick build, open tools
- Shows status of running apps (green dot / red dot)
- Click to raise tools window

## IPC Debug Protocol (inspector ↔ app)

Apps embed a thin debug server (~200 lines in framework). The debug server is the full observability + control channel.

### Tree & State

- `debug.tree` — returns full element tree as JSON
- `debug.node(id)` — returns props/styles/layout for a node
- `debug.select(id)` — tells app to highlight that node
- `debug.state` — returns current state values

### Telemetry

- `debug.telemetry.stream` — live telemetry feed pushed every frame (FPS, layout time, paint time, visible nodes, bridge calls/s)
- `debug.telemetry.history` — last N seconds of telemetry for graphing
- `debug.perf` — returns telemetry snapshot (point-in-time)

### Simulation (test runner)

- `debug.script(code)` — execute arbitrary .script.tsz code in the app's QuickJS runtime
- `debug.simulate.press(id)` — simulate press event on a node
- `debug.simulate.type(id, text)` — simulate text input
- `debug.simulate.scroll(id, delta)` — simulate scroll

### Assertions (test runner)

- `debug.snapshot()` — capture current render as image
- `debug.assert.tree(selector, expected)` — assert element tree matches expected structure
- `debug.assert.style(id, prop, value)` — assert a node has a specific style value

## Security

### Comptime Debug Elimination

The debug server is compiled OUT of distribution builds — not disabled, not gated by env var, literally not in the binary.

- **Dev builds** (`zig build`): `HAS_DEBUG_SERVER = true`, debug server compiles in, activated by `TSZ_DEBUG=1`
- **Dist builds** (`zig build dist` / `--release` / `--no-debug`): `HAS_DEBUG_SERVER = false`, entire module is dead code eliminated
- Same pattern as `HAS_QUICKJS`, `HAS_CRYPTO` — comptime flag, zero runtime cost when off

No distribution binary should ever have a TCP listener someone can connect to.

### Session Discovery

Apps advertise themselves for tools to find. This is **discovery only, not authentication**.

- App starts debug server → writes `~/.tsz/sessions/<pid>.json` containing:
  - `pid` — process ID
  - `port` — TCP port the debug server is listening on
  - `app_pubkey` — X25519 public key for this session
  - `app` — cart name / binary name
  - `started` — ISO timestamp
- `tsz tools` discovers running apps by scanning `~/.tsz/sessions/*.json`
- App cleans up session file on exit (tools garbage-collects stale PIDs on scan)

The session file tells tools **where** the app is and **how to start a handshake**. It grants zero access on its own — reading this file does not authenticate you. All authentication happens through the pairing flow below.

### Connection & Pairing (the real gate)

One auth path. No bearer tokens, no shortcuts. Encrypted key exchange + visual confirmation.

**First-time pairing:**

1. tsz-tools reads session file, opens TCP connection to the app's port
2. Tools generates an ephemeral X25519 keypair, sends its public key as the first message
3. App receives the key, generates a 6-digit pairing code, displays a **modal overlay**:
   - Header: **"tsz tools on PID {tools_pid} wants to pair. Is this you?"**
   - Body: the 6-digit pairing code in large text
   - Buttons: **Approve** / **Deny**
4. The code is **display-only** — never sent over the wire
5. User reads the code from the app window, types it into tsz-tools
6. tsz-tools sends the code back, app verifies
7. Both sides perform X25519 Diffie-Hellman, derive shared key via HKDF-SHA256
8. All subsequent messages encrypted + authenticated with XChaCha20-Poly1305
9. Modal dismisses, encrypted channel is live

**No unencrypted commands are ever accepted. No token-only fallback. The key exchange + visual pairing is the single gate.**

### Persistent Pairing

Two distinct primitives. Do not conflate them.

**Identity primitive: pairing hash (pinned keys)**

The pairing hash answers: **"is this the same trusted tools instance?"**

- On successful pairing, **both sides** compute `SHA256(app_pubkey || tools_pubkey)` — the **pairing hash**
- App stores it in `~/.tsz/paired/<app_name>.json`, tools stores it locally
- On reconnect, both sides recompute the hash from the keys presented and compare to the pinned hash
- Mismatch = key was substituted = **reject immediately + force fresh re-pair**
- The pairing hash is the **identity anchor**. It never expires. It is only invalidated by key mismatch or manual revocation.

**Freshness primitive: last_active timestamp**

The timestamp answers: **"is this trust still warm enough to resume without bothering the user?"**

- `last_active` is updated on **meaningful authenticated traffic only** — messages that have passed auth/validation on the established channel. Not raw bytes, not half-open connections, not junk traffic.
- If no authenticated interaction in **15 minutes**, the app force-disconnects and the session goes stale.

**Reconnect rule:**

Silent reconnect is allowed **only if all three conditions are met:**
1. Same pinned identity — pairing hash matches
2. Not stale — `last_active` is within the 15-minute grace window
3. Reconnect is happening within that grace window

If identity matches but freshness is stale → require fresh visual pairing (the keys are still trusted, but the user needs to confirm they're actively working)
If identity doesn't match → reject, full stop, regardless of freshness

**Pairing file** (`~/.tsz/paired/<app_name>.json`):
- `pairing_hash` — SHA256 of both public keys from first pairing (identity)
- `tools_key_fingerprint` — fingerprint of the tools public key (identity)
- `last_active` — unix timestamp of last authenticated message (freshness)

**Hierarchy: identity > freshness. The pairing hash is the anchor. The timestamp is the leash.**

- Tools side auto-reconnects when it detects the app's PID changed (reboot), shows "Reconnecting..." indicator
- User can revoke pairings from tsz-tools settings or by deleting the file

This means: pair once, pin both sides, iterate freely while actively working. Walk away for 15 min and the leash expires — identity stays, freshness doesn't.

This is the final gate — even with session file access and the public key, you need physical visibility of the app window to approve the connection. Prevents:
- Automated scripts silently attaching to your app
- Another user on the same machine connecting without your knowledge
- Any connection you didn't explicitly approve

### PTY Isolation

The debug protocol **must never allow control of PTY nodes**. Hard rule, no exceptions.

- `debug.simulate.type(id, text)` — **REJECTED** if target node is a PTY/terminal surface
- `debug.simulate.press(id)` — **REJECTED** if target is inside a terminal component
- `debug.script(code)` — **BLOCKED** from spawning shells, accessing `process.spawn`, or interacting with PTY file descriptors
- `debug.tree` / `debug.node(id)` — **READ-ONLY** for terminal nodes (can see it exists, can see telemetry, cannot send input)

The debug channel is for UI inspection and testing, not remote shell access. Even with an encrypted authenticated connection, a compromised tools instance should not be able to type commands into a running terminal.

### FFI Restriction

`debug.script(code)` runs in a restricted QuickJS context:

- **NO** loading new FFI bindings — only pre-compiled FFI that shipped with the binary
- **NO** `dlopen`, `dlsym`, or dynamic native code loading
- **NO** `process.spawn`, `child_process`, or equivalent
- **NO** filesystem access — no reads, no writes, no stat, no directory listing. Zero fs surface.
- Scripts can query state, call existing app functions, trigger UI interactions — but cannot escape the sandbox

The debug channel can observe and poke the UI, not extend the binary's capabilities at runtime.

## Architecture

### What lives where

| Component | Location | Written in |
|-----------|----------|------------|
| Tools app | `carts/tools/` | .tsz |
| Debug server (thin) | `framework/debug_server.zig` | Zig (framework module) |
| Crash writer | `framework/crashreport.zig` | Zig (framework module) |
| Test scripts | `*.test.tsz` per cart | .tsz |
| Project registry | `~/.tsz/registry.json` | JSON |
| Crash dumps | `~/.tsz/crashes/` | JSON |

### What changes in apps

- Full inspector UI code no longer emitted in codegen
- Only `debug_server` hook + highlight overlay remain in app binaries
- Apps auto-start debug server when `TSZ_DEBUG=1` or when tools attaches
- Crash writer hooks into panic/watchdog handlers, dumps to `~/.tsz/crashes/`

### Highlight/selection split

- **App side (thin)**: highlight overlay + selection tool + debug IPC server. Few hundred lines.
- **Inspector side (fat)**: element tree view, style panel, perf profiler, constraint graph, test runner — all the UI.

## CLI integration

```bash
tsz tools            # launches the GUI (dashboard view)
tsz tools inspect    # launches straight to inspector tab
tsz tools crashes    # launches straight to crash viewer
tsz tools test       # launches straight to test runner
```

## Prior art (in archive)

- `archive/tsz-gen/compiler/gui.zig` — SDL2 dashboard with project registry, action buttons, log viewer
- `archive/tsz-gen/compiler/tray.zig` — System tray with GTK/appindicator
- `archive/tsz-gen/compiler/actions.zig` — CLI actions table
- `archive/tsz-gen/compiler/registry.zig` — Project registry
- `archive/tsz-gen/compiler/runner.zig` / `process.zig` — Process management
- `archive/tsz-v1/runtime/devtools/` — Full devtools panel in .tsz (ElementsTab, PerfTab, TabBar, StatusBar, etc.)
- `archive/tsz-v1/runtime/devtools/bsod.tsz` — Crash screen in .tsz
