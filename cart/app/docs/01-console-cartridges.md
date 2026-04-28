# The Console Model

`cart/app/` is the **console shell** — PlayStation/Xbox-style.
Minimal, persistent, hosts everything else. Chrome, onboarding,
cartridge selector, cartridge runtime. Surface logic lives in
cartridges, not in the shell.

## Cartridges

A cartridge is a `.so` shared library loaded by the shell via the
`<Cartridge src="…" />` primitive at `runtime/primitives.tsx:156`.
The manager lives at `framework/cartridge.zig`.

Each cartridge exports the standard ABI:
- `app_get_root` — root layout node.
- `app_get_init` — optional one-shot init.
- `app_get_tick` — optional per-frame tick.
- `app_get_title` — display title.
- State preservation: `app_state_count`, `app_state_get_int`,
  `app_state_set_int`, `app_state_get_float`,
  `app_state_set_float`, `app_state_get_bool`, `app_state_set_bool`,
  `app_state_get_str`, `app_state_set_str`, `mark_dirty`. Slots
  persist across hot reloads.

The manager:
- Loads `.so` files dynamically (`MAX_CARTRIDGES = 16`).
- Ticks all loaded cartridges per frame.
- Watches `.so` mtime and hot-reloads on change. State snapshot is
  preserved across reload via the state-slot ABI.
- Crash-isolates each cartridge via `sigsetjmp` / `siglongjmp`. A
  cartridge that segfaults is marked faulted and skipped; the rest
  continue running. Reload clears the fault.
- Provides cross-cartridge state access for cartridges that want to
  cooperate (`framework/cartridge.zig:387` and forward).

## Cartridges that ship under `cart/app/`

- **Sweatshop** (`sweatshop.so`) — the canvas / sequencer / cockpit.
  The agentic authoring + run + trace surface. This corpus is its
  design.
- **Component gallery** (`gallery.so`) — the storybook of typed
  shapes. Browseable in-app, same shell, same chrome.
- **Chatbot** (planned) — non-agentic chat for users who don't want
  to author contracts.

Each ships independently. Each can be hot-reloaded without affecting
the others.

## Why the gallery is a cartridge

Two birds, one stone:

- **The "merge the gallery into the app" problem disappears.** Both
  ship as cartridges loaded by the same shell. There is nothing to
  merge.
- **The fence is structural.** The cartridge ABI is the fence.
  Workers cannot smear gallery conventions into sweatshop code or
  vice versa, because they cannot reach across the ABI without going
  through narrow, explicit inter-cartridge state access.
- **The gallery becomes browseable inside the running app.** Same
  shell, same chrome, same onboarding context. No separate launch.
- **Per-cartridge crash + hot-reload is free.** A typo in one
  cartridge does not take down the others.
- **The shell stays minimal.** Anything that is not chrome /
  onboarding / selector / cartridge runtime belongs in a cartridge.

## How the sweatshop ships

The current `cart/app/` is monolithic. The planned move:

1. Extract sweatshop surface code into a library (canvas, sequencer,
   cockpit, supervision vocabulary, recipes, M3A memory views — the
   contents of this corpus).
2. Build that library as a `.so` cartridge with the standard ABI.
3. Shell loads it via `<Cartridge src="sweatshop.so" />` from the
   cartridge selector or as the default.
4. Gallery follows the same path: existing `cart/component-gallery/`
   becomes `gallery.so`.
5. Inter-cartridge state access lets cartridges cooperate (chatbot
   transcript → sweatshop refinement; gallery deep-link → fresh
   canvas; sweatshop pulls seed data from gallery).

Until that split lands, treat the rest of this corpus as **the spec
for what the sweatshop cartridge contains**, separable from the shell.

## What the shell owns

- `cart/app/index.tsx` — chrome, router, onboarding provider wrap.
- `cart/app/onboarding/` — onboarding flow. Captures user identity,
  provider/connection, traits, config path, first Goal. Shell-level
  because it precedes any specific cartridge.
- `cart/app/page.jsx` — `/` route. Today a placeholder; in the
  console model, this is the cartridge selector (or auto-load to the
  user's default cartridge).
- `cart/app/about/` — shell-level metadata.

The shell never owns surface logic for any specific cartridge.

## Cross-references

- Canvas + substrates inside the sweatshop cartridge:
  `02-canvas-and-substrates.md`.
- Recipes (which migrate into the sweatshop cartridge when the split
  happens): `08-recipes.md`.
