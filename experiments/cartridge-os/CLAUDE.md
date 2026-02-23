# CLAUDE.md — CartridgeOS

CartridgeOS is a minimal Linux OS that runs ReactJIT directly on KMS/DRM.
No X11. No Wayland. No display server.
Just: kernel → SDL2 (kmsdrm) → OpenGL → LuaJIT → React.

This file tells you how to think when you are working in here.

---

## What This Is

CartridgeOS boots a static musl PID 1 (`init.c`), verifies a `.cart` payload
with Ed25519 + SHA-512, extracts it into a fresh tmpfs, and launches LuaJIT
inside a capability-gated namespace cage. The application (`main.lua`) draws
directly to a KMS/DRM framebuffer via SDL2 and OpenGL 2.1.

The stack has three distinct layers. Each has its own trust model and its own
rules. Never confuse them.

---

## The Three Layers

### Layer 1 — The OS (PID 1, C, `init.c`)

- Runs as PID 1, static musl binary. Never restarts. Never errors silently.
- Trust anchor: `OS_PUBKEY` baked at compile time. Carts must be signed with
  the matching secret key.
- Verification is **verify-first, extract-never-on-failure**. The order is
  non-negotiable: read header → verify Ed25519 → verify manifest SHA-512 →
  verify payload SHA-512 → *then* extract. Reversing or skipping steps breaks
  the trust chain.
- The signature covers **the 160-byte header only** (which contains the
  hashes). This makes verification constant-time regardless of cart size.
- `write_boot_facts()` runs *before* launch. Boot facts are written to
  `/run/boot-facts` (read-only, mode 0444) and passed via FD 3 as a binary
  verdict struct — not a string, not JSON. 17 bytes. No ambiguity.
- FD 3 is the **verdict pipe**. The child reads it once at startup. Never
  expose the read end to userspace beyond `sandbox.lua`'s raw FFI read.
- `sandbox.lua` lives at `/os/sandbox.lua`, **not** `/app/sandbox.lua`. The
  cart cannot replace the jailer. If you ever see a path that suggests
  otherwise, that is a bug, not a feature.
- Namespace isolation is **additive by default**: if a capability is NOT in the
  manifest, the corresponding namespace IS applied. Granting a capability
  removes a cage, not adds one.

### Layer 2 — The Sandbox (LuaJIT, `sandbox.lua`)

- Runs first, before `main.lua`. Saves real API references as `real_*`
  upvalues, then replaces `_G` with capability-gated wrappers. Cart code only
  ever sees the wrappers.
- **The enforcement functions use `real_*` upvalues, not `_G` lookups.** This
  is intentional. A cart replacing `_G.io` defeats only itself — our `path_allowed`
  still calls `real_io`. Never rewrite enforcement to use `_G.*`.
- Protected tables: `sandboxed_ffi`, `_G.io`, `_G.os`, `CART_BOOT`, `_G`
  itself. `rawget`/`rawset`/`setmetatable` are blocked on all of them.
- `ffi.C` is blocked. `ffi.cast` with an integer source is blocked (prevents
  arbitrary memory access via integer-to-pointer forgery).
- `ffi.load` whitelist: `SDL2`, `GL`, `libGL.so.1`, plus bare `.so` names
  and paths under `/app/`. Anything else raises a sandbox error.
- `loadstring`, `loadfile`, `load`, `debug`, `dofile`, `package`,
  `getfenv`, `setfenv`, `newproxy`, `module`, `collectgarbage` — all nil'd.
  The `_G.__newindex` guard re-blocks them if a cart tries to reintroduce them.
- `CART_BOOT.eval` is the only code-eval escape hatch (for the console REPL).
  It runs under the already-sandboxed `_G`, so it obeys all sandbox rules.
  Never expose `real_loadstring` or `real_dofile` through any other path.
- String metatable is locked (`__metatable = false` + frozen meta-metatable).

### Layer 3 — The Application (LuaJIT, `main.lua` + modules)

- Runs under the sandbox. Has access to `ffi` (sandboxed), `io` (gated),
  `os` (gated), `require` (path-locked to `/app/`).
- `CART_BOOT` is a read-only global injected by `sandbox.lua`. Contains
  `facts`, `verdict`, `verdictCode`, `verdictKeyId`, `manifest`, `caps`,
  `has()`, `eval()`. Never recreate or shadow it.
- The boot flow is a state machine: `"boot"` → `"running"` | `"denied"`.
  Events in the wrong phase are silently dropped. The console overlay is
  always alive regardless of phase (including denied).
- The console uses backtick (scancode 53) as its toggle. It **always fires**,
  regardless of appPhase. This is intentional — the debug surface must survive
  app crashes.

---

## The `.cart` Format

Defined in `cart.h`. Do not deviate from this without updating all three
consumers: `init.c` (verifier), `cartridge-pack.py` (packer), and
`sandbox.lua` (FD 3 reader).

```
HEADER (160 bytes) | MANIFEST (canonical JSON) | PAYLOAD (cpio) | SIGNATURE (64 bytes)
```

Key invariants:
- Header is exactly 160 bytes (`_Static_assert` enforces this).
- `cart_verdict` is exactly 17 bytes (`_Static_assert` enforces this).
- Manifest must be **canonical JSON** (sorted keys, no whitespace) — `cartridge-pack.py`'s `canonicalize_json()` does this. If you write manifest bytes by hand, match that format exactly.
- SHA-512 is used for content integrity (not SHA-256 — don't substitute).
- Ed25519 via TweetNaCl (`tweetnacl.c`). `randombytes` is a fatal stub in PID 1 — key generation never happens at runtime.
- `key_id` = first 8 bytes of SHA-512(pubkey). Both `init.c` and `cartridge-pack.py` must agree on this derivation.
- The signature covers the raw 160-byte header, not the manifest or payload directly. The hashes in the header bind them.

---

## The Build (build.sh)

The build is **surgical**: Alpine is a parts bin, not a rootfs. We install
packages into a throwaway `dist/parts/` tree, cherry-pick exactly what we
need into `dist/staging/`, then pack an initramfs and ISO.

Rules to hold in mind:
- **LLVM is stubbed.** `libgallium` has DT_NEEDED for libLLVM, but virgl sends
  shaders to the host — LLVM is never called at runtime. The stub exports every
  symbol with the correct version tag. Do not replace the stub with the real
  154MB library.
- **SDL2 is binary-patched**: ARGB8888 → XRGB8888. virtio-gpu's scanout only
  supports XRGB8888. The patch is applied in-place after copying. If you update
  the SDL2 version, the patch must be re-verified.
- **`sandbox.lua` goes to `/os/`, not `/app/`**. The build script makes this
  explicit. Never let the cart overwrite the jailer.
- Kernel modules are extracted by parsing `modules.dep` to get virtio-gpu's
  full dependency tree. Input modules are added separately. Never hardcode
  module paths — derive them from the kernel version in the parts bin.
- Soname symlinks are created after library copying. `ffi.load("SDL2")`
  requires `libSDL2.so` — the SDL2 special case in the build handles this.
- The `.cart` is packed at build time if `dev-key.secret` exists. Without it,
  the build still succeeds — the system boots in `cart_dev=1` unsigned mode.

---

## Capability Model

Capabilities live in `manifest.json` under `"capabilities"`. They are the
contract between the cart and the OS.

```json
{
  "capabilities": {
    "gpu":        true,
    "keyboard":   true,
    "mouse":      true,
    "network":    false,
    "filesystem": false
  }
}
```

- **init.c** reads the manifest to decide which kernel modules to load (input,
  USB) and which namespaces to apply (`CLONE_NEWNET`, `CLONE_NEWNS`,
  `CLONE_NEWPID`).
- **sandbox.lua** reads `caps` to gate `io.open`, `io.popen`, `os.execute`.
- **bootscreen.lua** reads caps to display risk-classified capability rows to
  the user, who must explicitly confirm or deny launch.

The risk classification in `bootscreen.lua` is intentional:
- `browse`, `sysmon`, `process: true` → danger (red)
- `usb`, scoped `process` → caution (yellow)
- `gpu`, `keyboard`, `mouse`, `storage` → safe (green)
- Not requested → denied (gray, dimmed)

**Never silently grant a capability that wasn't declared.** Never upgrade a
scoped permission to a wildcard without the user seeing it on the boot screen.

---

## EventBus

`eventbus.lua` is the structured log / event backbone. Channels: `os`, `input`,
`gpu`, `route`, `app`, `usb`, `console`, `debug`.

- `EventBus.emit(channel, summary, detail)` — structured, not `print()`.
  Use this for everything observable. The console displays it.
- Circular history buffer (200 events). Subscribers via `EventBus.subscribe`.
- `debug` channel is hidden by default. Use it for noisy internal events.
  Don't promote debug noise to `os` channel.

---

## What Breaks Everything

1. **Editing `/os/sandbox.lua` location.** The jailer must live outside `/app/`.
   `init.c` hardcodes `execv("/usr/bin/luajit", "/os/sandbox.lua")`. If you
   move it, every cart runs unsandboxed.

2. **Changing the verdict pipe protocol.** `cart_verdict` is 17 bytes: 1 code +
   8 key_id + 8 boot_time. `sandbox.lua` reads exactly 17 bytes from FD 3.
   If you add fields, both sides must change atomically.

3. **Touching the `real_*` upvalues from cart code.** The sandbox design
   depends on `real_io`, `real_os`, etc. being captured before `_G` is
   modified and never exposed. If a function leaks a `real_*` reference into
   cart-accessible scope, the sandbox is bypassed.

4. **Running cart code before verdict is established.** `CART_BOOT` must be
   set before `real_dofile("/app/main.lua")`. Never reorder this.

5. **Breaking the boot-phase state machine.** The phases `"boot"`, `"running"`,
   `"denied"` are sequential and one-way. Don't add transitions that can go
   backwards or skip `"boot"`. The user's launch/deny decision is the gate.

6. **Changing `cart_header` without updating `_Static_assert`.** The assert
   is there to catch you. If you add a field, the assert fires. Fix the size,
   don't remove the assert.

---

## Debugging

- Boot logs are written eagerly with `io.flush()` after every meaningful step.
  If the system hangs, the last flushed line tells you where.
- The console (backtick) is always available, including during crash state
  and denied state. It runs `CART_BOOT.eval()` for REPL.
- `verify` console command: shows verdict, code, key_id, hashes, cart_path.
- `manifest` console command: shows name, version, build, signature status.
- `permit` console command: shows all capability grants with their status.
- Hardware cursor detection: checks `/sys/class/drm/card0-cursor`. If absent,
  falls back to GL software cursor. The fallback is silent — don't remove it.
- The LLVM stub is a known intentional omission. If Mesa tries to call an LLVM
  symbol at runtime, it will get a function returning NULL, not a crash. If
  that causes a visible bug, the issue is not the stub — it means Mesa is
  actually invoking LLVM, which it shouldn't with virgl.

---

## One Rule

The cart cannot trust itself. The OS does not trust the cart. The user sees
the capability manifest and decides. Every design decision here follows from
that.

If you are adding a feature that bypasses user visibility, that is not a
feature — it is a hole. Make it visible. Make it deniable.
