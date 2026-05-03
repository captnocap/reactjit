# Sweatshop (cart/sweatshop_new)

> **The sequencer is build-time. The plan is runtime. The prose is the seam.**

A from-scratch sweatshop cart, built against the docs in
`cart/app/docs/02-canvas-and-substrates.md` and
`cart/app/docs/03-sequencer-plan-trace.md`. The old `cart/sweatshop/`
remains for reference but its opinions conflict with the current plan;
nothing here imports from it.

## Shape

Four surfaces in one cart:

- **`/` Start** — the welcome surface. Feels like opening an IDE:
  New project / Add project / Recent projects. A persistent agent
  text input sits at the bottom of the surface — the user can ask
  questions, resume projects, or kick off new ones from there. The
  recents list reads from the `Workspace` collection (namespace
  `app`); a returning user sees their actual onboarded workspace.

- **`/canvas` Composer** — the canvas. Open scene with three palette
  tiers (capability / domain nodes / rules & effects). The Goal node
  is pinned — it pulls the user's actual goal from the persisted
  onboarding graph (`goal:*` rows, latest user-origin).

- **`/run` Sequencer** — 2D toggle grid. Each cell is something armed
  for this run; columns are passes, not time. Pressing **Sweep**
  emits the plan (currently a synchronous `planFromGrid` preview;
  the real version animates the playhead and serializes pass-by-pass).

- **`/trace` Trace** — score after the music. Empty-state for now;
  fills once runs leave records.

## Data continuity

Sweatshop does not own any collection. It reads from the same persisted
graph the onboarding flow writes (`cart/app/onboarding/state.jsx`):

| Surface read | Source |
|---|---|
| `displayName` | `User.user_local.displayName` |
| latest goal text | `Goal` rows where `originActor='user'`, ordered by `createdAt` desc |
| active connection | `Settings.settings_default.defaultConnectionId` → `Connection.<id>` |
| workspace root | `Workspace.ws_local.root` |

Selectors live in `data.ts`. Each surface reads what it needs; no
prop-drilling.

## File map

- `cart.json` — entry manifest. `customChrome: true` (sweatshop owns its top strip).
- `index.tsx` — chrome + Router with four routes.
- `data.ts` — read-side selectors over the persisted graph.
- `start/page.tsx` — Start surface (default landing).
- `page.tsx` — Composer surface (route `/canvas`).
- `run/page.tsx` — Sequencer surface.
- `trace/page.tsx` — Trace surface.

## Deliberately not yet here

- The actual canvas substrate (Composition + useIFTTT). Composer
  renders a single Goal node and tier hints; the rest is hint text.
- The playhead sweep animation. `Sweep` is wired but does not yet
  animate or commit a plan record.
- Plan persistence. `planFromGrid` derives prose from the in-memory
  grid; nothing is written to a `Plan` collection (which doesn't
  exist yet).
- Trace records. The trace surface shows empty-state.
- A theme separate from cart/app. We import `applyGalleryTheme`
  exactly as the app cart does; the chrome reuses `S.AppChrome*`.
- Onboarding/tour banners. Sweatshop assumes the user is already
  onboarded via cart/app — if `user_local` is missing, surfaces show
  "(no goal set)" / "(empty)" instead of redirecting.

## Open threads

- **Plan emission.** Decide whether `Plan` is a stored collection or
  derived-each-time from a `Run` record + grid snapshot. Doc 03 says
  the structural form is canonical; the prose is rendered. Same
  question for ergonomics: when do we *save*?
- **Cell catalog.** Rows in the grid are hard-coded
  (`pin / plan / explore / write / review / commit`). Real cells are
  configurable per docs/04. Where does the catalog live?
- **Live trace overlay.** Doc 03 mentions a live trace painted over
  the grid as the run proceeds — Composer or Sequencer surface, or
  both?
