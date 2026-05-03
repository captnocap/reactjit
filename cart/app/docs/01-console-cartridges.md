# The Console Model

`cart/app/` is the app — one cart, one bundle, one ship target. Every
surface (composer, gallery, settings, character, onboarding, …) lives
under it as a sub-folder, and the rail at the top of `index.tsx`
routes between them with `<Route>` blocks.

```
cart/app/
  index.tsx          shell — Chrome + ROUTES + ShellBody + morph timelines
  page.tsx           "/"   — home
  about/             "/about" — also hosts the Isolated Tests panel
  settings/          "/settings"
  character/         "/character"
  sweatshop/         "/activity/sweatshop" (composer + start/run/trace pages)
  gallery/           the storybook of typed shapes (still wired in as a
                     library — components.cls + gallery-theme are imported
                     by the shell at boot)
  onboarding/        runs before any route is reachable
  chat/              assistant-chat plumbing
  recipes/           authoring/inspection helpers
  isolated_tests/    18 verified surfaces, each its own bundle (see below)
  docs/              this corpus
```

Nothing under `cart/app/` is loaded across an ABI boundary. There is
no `<Cartridge src="something.so">` for app surfaces, no
`framework/cartridge.zig` ABI, no per-surface state-slot serialization
across hot reloads, no cross-cartridge state access. Everything lives
in the same React tree and the same V8 context, the way a normal app
does.

The earlier "console + cartridges" plan (sweatshop.so / gallery.so /
chatbot.so loaded by a thin shell, crash-isolated and hot-reloadable)
was tried and rolled back. The fence the ABI promised never produced
real isolation in practice — cartridges shared a host process and
shared a single V8, so a thrown exception or a global mutation in one
cartridge could still take its neighbors down. The cost (an extra
build target per surface, state-slot ABI for hot reload, distinct
entry points, manual inter-cartridge wiring) bought nothing against a
single bundle. The single bundle won.

## Where cartridges still exist

The JS-bundle cartridge model survives, but in a much narrower role:
verify-and-throw-away test windows.

`runtime/cartridge_loader.ts` reads a pre-built `.cart.js` off disk,
runs it through indirect `eval`, and the bundle's entry stashes its
component into a slot the loader returns. `<Cartridge src="…" />` in
`runtime/primitives.tsx` mounts that returned component as part of the
host's React tree — same React, same reconciler, same renderer (via
`runtime/cart_externs/*.cjs` aliasing). What you get from each
`<Cartridge>` mount is a **fresh module graph**: a separate IIFE in
the same V8 isolate, so the guest's `<TooltipRoot>`, its `<Router>`,
its module-level side effects, its installed shims, and any stale
globals stay in their own scope and do not smear into the app shell.

This is exactly the right shape for the Isolated Tests panel
(`cart/app/about/tests.tsx`):

- 18 surfaces under `cart/app/isolated_tests/`, each pre-bundled by
  `scripts/build-isolated-tests` into `.cache/isolated_tests/<id>.cart.js`.
- The panel lists them as toggleable buttons. Click → mount the
  cartridge. Toggle off → React unmounts the subtree, the bytes stay
  cached in V8 until `evictCartridge()` runs.
- The eventual target is `<Window><Cartridge src="…" /></Window>` so
  each test runs in its own native window. Until the `<Window>`
  primitive's open-time crash is sorted, the panel mounts cartridges
  inline — see the `BIGDICKWINDOWHERE` marker in `tests.tsx` for the
  spot to wrap them once `<Window>` is fixed.

The fragility that killed cartridges as an *app architecture* is
fine — even desirable — for a verify-and-close test surface. If a
test cartridge throws on mount, you close the panel entry; the cached
bytes evict on the next file mtime change.

## Adding a new isolated test

1. Drop a default-export component into
   `cart/app/isolated_tests/<name>.tsx` (or
   `cart/app/isolated_tests/<name>/index.tsx` for multi-file).
2. Run `scripts/build-isolated-tests`.
3. Append `{ id: '<name>', label: '<Label>' }` to the `TESTS` array in
   `cart/app/about/tests.tsx`.

## Cross-references

- The composer and the substrates inside the sweatshop sub-folder:
  `02-canvas-and-substrates.md`.
- Recipes (sweatshop sub-folder): `08-recipes.md`.
