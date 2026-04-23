# Plugin System — Spec

> Status: draft, unresolved questions at the end.
> Single-file design doc. Not implementation.
> Grounded in what already exists on disk:
> `cart/sweatshop/plugin/{types,context,loader,index}.ts`,
> `cart/sweatshop/panel-registry.ts`, `framework/v8_bindings_*.zig`.

---

## 1. Motivation

Sweatshop already has a first-party panel system. `cart/sweatshop/panels/*.panel.ts`
calls `register()` from `panel-registry.ts` at import time; the require chain
near the bottom of `panel-registry.ts` pulls every built-in panel into the
registry at cart boot. That's the *in-tree* extension point — add a new file,
append one `require` line, rebuild the wrapped binary, ship.

So what can't a panel already do?

1. **Live under `~/.sweatshop/plugins/` instead of under `cart/sweatshop/`.**
   Panels ship with the binary. They can't be distributed, dropped into a
   user's machine, and picked up without another full `scripts/ship`
   invocation. That closes off the class of workflow where a user wants to
   install someone else's tool without recompiling sweatshop.

2. **Add behaviour to other panels.** A panel is a self-contained surface.
   Cross-cutting concerns (a new command-palette entry, a toast-on-focus
   hook, a code-action handler that shows up in *both* the Inspector and the
   LLM Studio chat) don't have a clean home in the panel model. They need a
   subscription model that can fan out.

3. **Expose a trust boundary.** Today every panel is trusted — it runs in
   the same V8 context as the rest of the cart, it can `require` anything
   the bundle ships with, it can call every host FFI. Plugins will not all
   be trusted. We need a place to say "this plugin can show a panel and a
   notification but it cannot `__exec`."

4. **Survive breakage in one plugin without killing the session.** A
   third-party plugin hitting a null dereference shouldn't bring down the
   cart. A panel registered directly through `panel-registry` doesn't get
   error-boundaried at a useful boundary today — the cart crashes.

The plugin system exists to cover (1) through (4). Points (2) and (3) are the
hard parts; (1) is mostly a loader; (4) is a wrapper error boundary plus an
owned ErrLog slot.

---

## 2. Plugin Surface

A plugin is a JavaScript file (not JSX, not TypeScript) with a header
manifest comment and an `activate(ctx)` entry function. The shape is already
prototyped in `cart/sweatshop/plugin/types.ts` and `context.ts` — the spec
below formalises it and describes the pieces not yet implemented.

### 2.1 File header

The loader parses two comments from the top of the file:

```js
// @plugin name My Plugin Display Name
// @plugin version 1.0.0
```

`parseManifest()` in `plugin/loader.ts:47` already reads these. Plugins
without a header get `name: 'unnamed'` and `version: '0.0.1'`.

### 2.2 Entry / lifecycle

Each plugin file runs once inside a wrapping IIFE:

```js
(function(ctx, React, exports) {
  /* plugin code */
  return exports;
})
```

Three lifecycle hooks, exposed on `exports`:

| Hook | When it fires | Notes |
|---|---|---|
| `activate(ctx)` | Loader finishes wrapping and calls `exports.activate(ctx)` with the fresh context. Plugin does all its registration here. | Required if the plugin wants any behaviour. |
| `tick(dt)` | Optional. Called once per cart frame (≈ every 16 ms) with `dt` in seconds since the last tick. | Not yet implemented in the prototype loader. |
| `deactivate()` | Called on plugin unload (manual unload, hot-reload, cart shutdown). | Plugin releases long-lived handles here — websocket sockets, intervals, etc. |

`tick(dt)` is deliberately optional. Most plugins don't need per-frame
callbacks and shouldn't pay the tick cost if they don't. When present, the
host must call it from the same frame loop the cart already drives.

### 2.3 Plugin context (`PluginContext`)

`PluginContext` is the single object a plugin uses to reach the host. The
prototype shape lives at `cart/sweatshop/plugin/types.ts`:

```ts
interface PluginContext {
  readonly pluginId: string;
  readonly pluginName: string;

  registerCommand(id, label, callback): void;
  unregisterCommand(id): void;

  registerPanel(id, label, component): void;
  unregisterPanel(id): void;

  on(event, handler): () => void;   // subscribe; returns unsubscribe
  emit(event, ...args): void;

  readSetting<T>(key, fallback?): T;  // plugin-scoped, backed by __store_*
  writeSetting<T>(key, value): void;

  showNotification(message, type?): void;

  exec(command): string;             // current prototype exposes this;
                                     // see §4 for why that's a problem.
  readFile(path): string;
  writeFile(path, content): boolean;
  fileExists(path): boolean;
  listDir(path): string[];
}
```

The prototype also passes `React` and `primitives` into the IIFE so plugins
can build UI without their own bundler. Spec keeps that shape.

### 2.4 Panel registration

Plugin-registered panels flow into the same `panel-registry` list built-in
panels live in. `ctx.registerPanel(id, label, component)` wraps into a
`PanelRegistration` and calls `register(...)` with:

- `id`: the plugin-scoped id, namespaced to avoid collision — concretely
  `plugin:${pluginId}/${id}`.
- `title`: `label`.
- `defaultSlot`: always `'center'` for a plugin-supplied panel. A plugin
  cannot claim the sidebar's `'left'` slot (reserved for the file tree) or
  the bottom-dock `'bottom'` slot (reserved for terminal + log tail).
  Enforced by the wrapper, not by the plugin.
- `icon`: a fixed "plugin" glyph. Plugin-authored icons are post-1.0.
- `component`: the React component the plugin returned, wrapped in an error
  boundary so a render crash inside the plugin doesn't sink the cart.
- `userVisible: true`, `defaultOpen: false`.

### 2.5 Command registration

`ctx.registerCommand(id, label, callback)` makes the entry show up in the
sweatshop command palette (`cart/sweatshop/components/commandpalette.tsx`).
Same namespacing as panels: the palette shows `plugin:hello → Say Hi`.

### 2.6 Event bus

`ctx.on(event, handler)` / `ctx.emit(event, ...args)` is a shared string-
keyed publish-subscribe bus. Scope is cart-global — any plugin can subscribe
to any event name. Events used by the cart proper are documented under
`sweatshop.*` namespace (e.g. `sweatshop.file.opened`, `sweatshop.agent.
complete`); plugins should publish under their own `plugin:${id}.*`
namespace.

### 2.7 Host-binding access

This is the key trust question (§4). Short version for this section: a
plugin gets a curated subset of host bindings through `ctx`, not direct
access to `globalThis.__*`. The prototype does give direct `exec`,
`readFile`, `writeFile`. Spec tightens that down — see §4.

---

## 3. Loading Model

### 3.1 Where plugins live

```
~/.sweatshop/plugins/
  hello.js
  git-auto-stash.js
  my-experimental/
    (ignored — loader only reads *.js at the top level)
```

The prototype `PLUGIN_DIR` at `plugin/loader.ts:6` already points here
(`$HOME/.sweatshop/plugins`). The loader creates the directory on first run
via `__fs_mkdir` if it doesn't exist.

We deliberately do **not** use `~/.cache/reactjit/plugins/`:
- `~/.cache/` is the XDG "safely deletable" tree. The ship-pipeline
  self-extract cache is under `~/.cache/reactjit-<name>/`, which gets
  rebuilt per-binary-signature. Plugins there would be wiped on upgrade.
- `~/.sweatshop/` groups user-owned sweatshop state (plugins, future
  keystore, future project history) under one directory the user can
  back up cleanly.

We also do **not** bundle user plugins inside the binary. First-party
panels live inside the binary because they're compiled together and ship
together. A plugin the user chose themselves is user data, not app code.

### 3.2 Discovery

At cart boot, **after** `panel-registry.ts` has run its built-in `require`
chain, the plugin loader scans `PLUGIN_DIR`:

1. `fsList(PLUGIN_DIR)` lists all entries.
2. Filter to top-level `.js` files. Subdirectories ignored in v1 — if
   multi-file plugins land later, they'll be `plugin.json`-rooted trees.
3. For each `.js` file:
   - `fsRead` the contents.
   - `parseManifest` to pull name + version from the header comments.
   - Build a `PluginContext` with `createPluginContext(pluginId, name,
     React, primitives)`.
   - `eval` the wrapped IIFE, call `activate(ctx)` if present.
   - Harvest `ctx.__commands` and `ctx.__panels` into the registries.

### 3.3 Boot-order contract

Plugin load happens **after** every first-party panel has registered.
Rationale: a plugin might want to reference a first-party panel by id
(e.g. to inject a command that toggles it), and that requires the
registry to already contain the target. Reverse order would create a
race.

### 3.4 What about load order between plugins?

Alphabetical by filename. This is a real constraint plugin authors can
observe by filename-prefixing. If `0-core-setup.js` needs to run before
`zz-consumer.js`, the author lexicographic-sorts. No dependency graph in
v1.

---

## 4. Sandbox / Trust

Three realities shape this section:

- V8 has no process isolation. Everything runs in one isolate, shares the
  same heap, sees the same `globalThis`.
- The cart already exposes a broad host FFI (`__fs_*`, `__exec`, `__exec_
  async`, `__fetch`, `__http_*`, `__claude_*`, `__db_query`, ...). A
  plugin that can reach `globalThis` can already call all of them.
- We do not currently mark any function in `globalThis` as non-
  configurable. `delete globalThis.__exec` succeeds from plugin code today.

So "sandbox" in v1 is honest-by-convention, not honest-by-enforcement.
The spec lays out the intended contract and names the enforcement steps
needed to make it real.

### 4.1 Capability tiers

Three tiers. A plugin declares which tier it wants in its header:

```js
// @plugin name Timer Block
// @plugin version 1.0.0
// @plugin capabilities ui
```

| Tier | What the plugin can do |
|---|---|
| `ui` (default) | Register commands, register panels, subscribe to events, read/write plugin-scoped settings, show notifications. No filesystem, no subprocess, no network. |
| `workspace` | Everything in `ui` + read-only access to files under the open project directory via `ctx.readFile`. Still no subprocess, no outbound network, no writes. |
| `trusted` | Everything in `workspace` + write-file, `exec`, outbound HTTP. Installing a `trusted` plugin shows a one-time confirmation dialog listing the capabilities. |

### 4.2 Contrast: Electron's contextBridge

Electron ships `contextBridge.exposeInMainWorld('api', { ... })`. The
preload script gets to pick exactly which functions cross from main to
renderer. The renderer sees `window.api.*` and literally cannot see the
main-world Node APIs even if it tries — V8 is partitioned via separate
contexts + context isolation.

We can approximate part of that:

- **Do**: build `PluginContext` in a factory that captures only the
  bindings we intend to expose at that tier. Make `ctx.exec` throw if
  the tier is `ui` or `workspace`.
- **Do**: freeze the context with `Object.freeze(ctx)` after construction
  so a plugin can't stash extra methods on it.
- **Can't, without more work**: stop a plugin from reading `globalThis.__
  exec` directly. In-isolate JavaScript, there's no wall between plugin
  code and cart code. `contextBridge`'s real power comes from V8 separate
  contexts; we'd need to start plugin scripts in a fresh `Context` and
  have the host expose FFI only inside that context's global. That's a
  host-side change to `framework/v8_runtime.zig` and is explicitly
  future work.

In v1 we document the contract, we enforce it through `ctx` (method
removal + freeze), and we accept that a hostile plugin can cheat by
reading `globalThis`. The accepted rule: **running a plugin is a trust
decision equivalent to running a shell script from the same author.**

### 4.3 Enforcement path we will build

Ordered by cost, not priority:

1. **Name-gate**: `createPluginContext` takes a tier argument. UI tier
   builds a `ctx` whose `exec`, `readFile`, `writeFile` methods throw
   `Error('capability not granted')`. Free. Lands with the first real
   implementation.
2. **Install manifest**: installing a plugin (via a future `Settings →
   Plugins` UI) shows the tier the header claims and requires the user
   to click through before the loader trusts it on subsequent boots.
   Cheap. Single modal.
3. **V8 separate context**: spawn each plugin's script into its own V8
   `Context`, expose only the `ctx` object on that context's global.
   Expensive — needs host-side work in `framework/v8_runtime.zig` +
   `framework/v8_bindings_core.zig`. This is the step that closes the
   "plugin reads globalThis" loophole.

### 4.4 What a plugin cannot do regardless of tier

- Mutate the cart's own panel list directly (must go through
  `ctx.registerPanel`).
- Access another plugin's settings (the `__store_*` key is namespaced as
  `plugin:${pluginId}.*`).
- Throw uncaught errors that crash the cart — the wrapper error boundary
  catches in `activate`, in `tick`, and in any React render from a
  plugin-registered panel. Failures log to the ErrLog and mark the
  plugin "quarantined" until next boot.

---

## 5. Hot-reload Story

### 5.1 What we want

Editing `~/.sweatshop/plugins/hello.js` and saving should cause sweatshop
to re-evaluate the plugin without restarting the cart. Active panels
registered by the plugin should unmount and re-mount with the new
component. Commands should be unregistered and re-registered. Settings
persist (they're in `__store_*`, survive the re-eval).

### 5.2 What the prototype does

Nothing. `plugin/loader.ts` has a `reload()` method on `PluginRegistry`
(`loader.ts:61`) that's never wired to file changes.

### 5.3 What we need

Two pieces:

1. **File-watch via `__fs_*`**: the host already exposes `__fs_stat_json`;
   a plugin-watcher service can poll every 500–1000ms, hash each plugin
   file's mtime, and trigger reload when it sees a change. This mirrors
   how `cart/sweatshop/components/hotpanel.tsx` already watches TSX files.
2. **Reload procedure**: for each changed file:
   - Call the plugin's `deactivate()` if present.
   - Iterate `ctx.__commands` and `ctx.__panels`, call `unregisterCommand`
     / `unregisterPanel` for every id the plugin owns.
   - Rebuild the `PluginContext`.
   - `eval` the new file contents.
   - Call the new `activate(ctx)`.
   - Tell React to re-render any surface listing commands or panels.

Breakage case: a plugin that throws during `activate` on reload leaves
the cart in the state just before the reload — the old plugin's
unregistered panels stay gone; the new plugin's panels never register.
The ErrLog records the fault with the file path + stack.

### 5.4 Fallback

If hot-reload ever goes wrong, restart the cart. Plugins will be
re-scanned from scratch. No persistent plugin state exists outside of
`__store_*` (which is file-backed, survives restart).

---

## 6. Versioning

Two axes of versioning:

### 6.1 Plugin API version

The `ctx` object carries a string:

```ts
ctx.apiVersion === '1.0.0'
```

When we ship a breaking change to the plugin API, the major digit bumps.
Plugins can short-circuit on `ctx.apiVersion` before doing anything:

```js
if (ctx.apiVersion.split('.')[0] !== '1') {
  ctx.showNotification('hello plugin needs API v1', 'error');
  return;
}
```

Breaking = removed method on `ctx`, removed event name in the cart's
emit set, removed `globalThis.__*` FFI that a plugin was permitted to
depend on through `ctx`, changed shape of a panel registration.

Non-breaking (minor digit bump): added method on `ctx`, added event name,
added optional field on a registration.

Bugfix (patch digit bump): behaviour of an existing method changes to
match its documented contract.

### 6.2 Sweatshop version

Separate from the plugin API version. Captured in the cart binary's
build info. A plugin can read it via `ctx.hostVersion` if it needs to
gate behaviour to a specific sweatshop release.

### 6.3 Deprecation policy

- Removing a method: first, deprecation warning for at least one
  sweatshop release cycle — `ctx.oldMethod()` works, logs a warning
  to the ErrLog, tells the plugin which method to migrate to.
- Renaming a method: add the new name alongside, deprecate the old.
- Changing shape: additive only during a major version. New fields
  optional with sensible defaults.

No API in this spec is stable yet. Everything in §2 is the v0 proposal.
v1.0 fires when we've shipped one real third-party plugin and lived
with the interface for ≥ 4 weeks.

---

## 7. Example Plugin — `HelloPlugin`

Walkthrough: a plugin that registers a panel, renders "hello", and adds
a menubar entry.

### 7.1 File on disk

`~/.sweatshop/plugins/hello.js`:

```js
// @plugin name Hello Plugin
// @plugin version 1.0.0
// @plugin capabilities ui

exports.activate = function (ctx) {
  const { Box, Col, Text, Pressable } = React.primitives;

  // Register a panel the user can toggle from Window → Hello.
  ctx.registerPanel('hello-surface', 'Hello', function HelloSurface() {
    const [count, setCount] = React.useState(0);
    return React.createElement(Col, { style: { padding: 20, gap: 8 } }, [
      React.createElement(Text, { key: 't', fontSize: 18 }, 'hello from a plugin'),
      React.createElement(Text, { key: 'c', fontSize: 14, color: '#888' }, 'clicked ' + count),
      React.createElement(Pressable, {
        key: 'b',
        onPress: () => setCount((n) => n + 1),
        style: { padding: 8, backgroundColor: '#4aa3ff', borderRadius: 4 },
      }, React.createElement(Text, null, 'click me')),
    ]);
  });

  // Register a command the user can invoke from the command palette.
  ctx.registerCommand('hello.greet', 'Hello: greet', function () {
    ctx.showNotification('hello from the plugin', 'success');
  });

  // Subscribe to an event from elsewhere.
  const off = ctx.on('sweatshop.agent.complete', function () {
    ctx.showNotification('agent finished', 'info');
  });

  // Return a deactivate hook so reload/unload cleans up.
  exports.deactivate = function () { off(); };
};
```

### 7.2 What happens at boot

1. `panel-registry.ts` runs its built-in `require` chain. All first-party
   panels register.
2. Plugin loader scans `~/.sweatshop/plugins/`, finds `hello.js`.
3. Loader parses header: name = `Hello Plugin`, version = `1.0.0`,
   capabilities = `ui`.
4. Loader builds a `ui`-tier `PluginContext` — `ctx.exec` etc. throw on
   use.
5. Loader wraps the plugin body in the IIFE and evals.
6. `exports.activate(ctx)` runs:
   - `registerPanel` adds `plugin:hello/hello-surface` to the registry
     with the wrapped React component.
   - `registerCommand` adds `plugin:hello/hello.greet` to the command
     palette.
   - `on('sweatshop.agent.complete', fn)` subscribes.
7. User opens Window → Hello. The HelloSurface component mounts, renders,
   accepts clicks.

### 7.3 What happens on reload

User edits `hello.js`, saves.

1. Plugin watcher notices the mtime change.
2. `deactivate()` fires, `off()` unsubscribes the event handler.
3. `unregisterCommand('plugin:hello/hello.greet')`.
4. `unregisterPanel('plugin:hello/hello-surface')` — if the panel is
   currently mounted, it unmounts.
5. Loader re-reads the file, re-evals, re-activates.
6. If the panel was mounted, the panel system re-mounts it with the new
   component.

Panel local state (the `count` from `useState`) resets. Persistent state
the plugin had written via `ctx.writeSetting` survives.

### 7.4 What happens on error

Suppose the user saves a version of `hello.js` with a syntax error.

1. Watcher notices the change.
2. `deactivate()` fires cleanly.
3. Loader tries to `eval` the new code, throws.
4. ErrLog records `plugin:hello — SyntaxError: ...`.
5. Plugin is marked quarantined — registry has no entries for it, next
   scan tick will retry once, then stop until the file changes again.
6. User fixes the syntax error, saves. Retry succeeds; the plugin
   re-registers.

---

## 8. Open Questions

These are things I do not yet have an answer for. Notes are the state
of my thinking, not decisions. None of these block writing the v0
implementation; they shape what v1 looks like.

### 8.1 Where does `tick(dt)` run?

The cart already has a frame loop inside the host. Calling into V8 once
per frame for every installed plugin adds overhead on a tight loop. Three
options on the table:

- Call `tick` only when the plugin has explicitly subscribed to the
  tick (opt-in inside `activate`), and even then only at the cadence
  the plugin asks for (e.g. `ctx.onTick(60, handler)` for 60 Hz,
  `ctx.onTick(1, handler)` for per-second).
- Don't ship `tick` in v1. Plugins that need per-frame work use
  `setTimeout`/`setInterval` on V8 and accept that coalescing.
- Ship `tick` but batch — the cart's frame loop emits a single `tick`
  event on the plugin event bus once per frame, plugins subscribe.
  Doesn't match the prototype shape but is cheap.

Unresolved. Leaning toward option 2 until we see a plugin that actually
needs it.

### 8.2 How does a plugin ship assets?

A single `.js` file has no sibling files. A plugin that needs an icon,
a preset palette, a template file, or a shader has nowhere to put it.

Options:

- Require `.js` only; plugins embed small assets as base64 strings.
  Terrible for anything larger than a kilobyte.
- Support a directory-rooted plugin: `~/.sweatshop/plugins/hello/
  plugin.json` + `plugin.js` + any siblings. `plugin.json` declares
  entry + metadata. The loader reads `plugin.json` instead of the
  header comments.
- Both — keep the single-file form for simple plugins, add the
  directory form for asset-bearing ones.

Directory form is the likely winner but not committed.

### 8.3 How do plugins install dependencies?

A plugin that wants to import `marked` or `lodash` has no module
resolver. Sweatshop doesn't ship npm at runtime.

Two approaches:

- Pre-bundle: the author bundles their dependencies into the single
  `.js` file with esbuild before shipping. The loader just evals what's
  there. Simple; plugin files get fat.
- Plugin registry: we ship a small curated set of permitted utilities
  (e.g. `ctx.util.debounce`, `ctx.util.jsonpath`) and plugins import
  from `ctx.util` only.

Both likely. Curated on `ctx.util` as a starter library, bundling for
anything the plugin author wants beyond it.

### 8.4 Should plugins be able to contribute host FFI?

A plugin in `trusted` tier with access to `__exec` can wrap that into a
new API shape it re-exports through `ctx.emit`. But a plugin can't
register a new `globalThis.__my_binding` that other plugins can see.

Open question: do plugins need to compose with other plugins at the
FFI layer, or is the event bus + `emit`/`on` enough? My guess is the
event bus covers 99% of cross-plugin needs; revisit if we see pressure.

### 8.5 Should the built-in panel `register` API and the plugin panel
registration merge?

Today `panel-registry.register()` and `ctx.registerPanel()` are
different shapes. First-party panels declare `defaultSlot`, `icon`,
`userVisible`, `defaultOpen`; plugin panels get all of that defaulted by
the context factory.

Option A: keep them separate. Plugin panels can't claim left/right/
bottom slots, can't set icons. That's a feature — user-installed code
shouldn't be able to hijack the sidebar.

Option B: merge. Plugin panels get the full `PanelRegistration`, the
capability tier gates whether they can claim premium slots.

A is what the spec above describes. Revisit if a legitimate plugin
wants the bottom dock (likely a log-tail plugin). Not today.

### 8.6 Install / uninstall UX

The spec is silent on how plugins get installed beyond "drop a file in
the plugins dir." No marketplace, no `sweatshop install <name>` CLI,
no sandbox preview before first activation. Those are v2 concerns. v1
is "hand-edit files, restart or hot-reload, own the trust decision."

### 8.7 Multi-plugin conflict resolution

Two plugins register a command under the same id. Today the registry
is a `Map` keyed by id, so the second write wins. First plugin's
command becomes invisible.

Options:
- First-registered wins, later registrations log a conflict and no-op.
- Second-registered wins (current behaviour).
- Both appear, prefixed with plugin id.

No strong opinion yet. Probably "first wins + conflict log" — plugin
authors can detect collision and rename.

### 8.8 Native code

Can a plugin link into `framework/ffi/*.c` or expose a Zig module?

No. v1 plugins are JS only. A plugin that needs native code is asking
for the wrong thing — native bindings are sweatshop-core concerns,
go through `framework/v8_bindings_*.zig`, and ship with the binary.
If a user wants native, they're not writing a plugin, they're
contributing to sweatshop.

### 8.9 Testing

How does a plugin author test their plugin? No answer yet. Probably
starts with "run sweatshop in dev mode, iterate via hot-reload, look
at the ErrLog." An eventual `sweatshop plugin-test <file>` harness
that runs the plugin inside a headless cart is plausible but not
scoped here.

---

## Status

This spec doc is a snapshot. The prototype at `cart/sweatshop/plugin/`
implements roughly §2 (weak version — no capability tiers), §3 (loader
exists but isn't wired into cart boot), and the happy path of §7. It
does not implement §4 (trust), §5 (hot reload), §6 (versioning), or
most of §8 (still open).

Next concrete step is wiring the existing `plugin/loader.ts` into
`cart/sweatshop/index.tsx` boot, right after the panel-registry require
chain completes. That turns the dormant prototype into a live surface
and lets us drop a real plugin in and feel what's missing.
