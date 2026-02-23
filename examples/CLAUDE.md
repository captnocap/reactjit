# CLAUDE.md — examples/

Each directory here is a self-contained ReactJIT application: its own `package.json`,
its own `src/`, its own Lua entry point (if needed), and its own local copies of the
framework runtime (via `reactjit update`). These are **consumer projects**, not the
framework itself. Editing framework code inside an example directory is always wrong.

## The One Rule Before You Touch Anything

You are in `examples/`. The source of truth for all framework code lives at the
**monorepo root**: `lua/`, `packages/core/`, `packages/native/`. If something is
broken in `<project>/lua/` or `<project>/reactjit/`, you fix it at the root and
propagate. You never patch the local copy.

If you need to change framework behavior to fix an example:
1. Fix it in `lua/` or `packages/*/src/`
2. `make cli-setup`
3. `cd examples/<project> && reactjit update && reactjit build dist:sdl2`

## Structure of a Well-formed Example

```
examples/<name>/
  src/
    main.tsx          ← entry point, boots bridge + renderer
    App.tsx           ← root component (or a Router if multi-screen)
    screens/          ← one file per screen (multi-screen apps only)
    <domain>/         ← context, types, helpers for a domain (e.g. wallet/, dvd/)
  lua/                ← local copy of framework Lua (from reactjit update)
  reactjit/           ← local copy of TS runtime (from reactjit update)
  package.json
```

`main.tsx` is thin — it boots `NativeBridge`, creates the renderer root, wraps with
providers, and renders `<App />`. The application logic is nowhere near `main.tsx`.

## Color Palette Pattern (always do this)

Every example defines its color palette in ONE place, at the top of the file where it
is first needed. Not scattered. Not inline. One `const C = { ... }` (or `const P = { ... }`)
object with semantic names.

```tsx
const C = {
  bg:      '#11111b',
  surface: '#1e1e2e',
  text:    '#cdd6f4',
  dim:     '#585b70',
  accent:  '#89b4fa',
};
```

Every color reference in the file is `C.bg`, `C.accent`, etc. Never a naked hex string
in a style prop (except 'transparent', 'white', 'black'). If you need a one-off
slightly-different shade, hardcode it with a comment explaining what it is — don't add
it to `C` unless it's reused 3+ times.

## Layout Rules That Actually Get Broken

These are the things that look right in your head and fail in the renderer:

**Root is always `width: '100%', height: '100%'`.**
The proportional fallback doesn't apply at the root. If you forget this, the whole app
renders as a small box in the corner.

**Every `<Text>` must have explicit `fontSize`.**
The linter enforces this. Don't suppress the lint error — add the `fontSize`.

**`justifyContent` on a row requires explicit width.**
A `flexDirection: 'row'` Box without `width: '100%'` (or a fixed width) ignores
`justifyContent: 'center'` entirely. The row collapses to its content width.

**`flexGrow: 1` not hardcoded heights.**
If a panel contains a header + scrollable content + footer, the scrollable content gets
`flexGrow: 1`. It doesn't get `height: 400`. The hardcoded height breaks at every
window size except the one you tested at.

**`ScrollView` needs explicit height.**
Not proportional-fallback eligible. Give it `flexGrow: 1` or a fixed height, or it
renders at zero.

**Spacers are empty `<Box style={{ flexGrow: 1 }} />`.**
Not `<Box style={{ height: 100 }} />`. The flexGrow spacer adapts to any window size.
The hardcoded one leaves dead air or clips content.

**No Unicode symbols in `<Text>`.**
`▶ ⏸ ● ✓ █` and everything like them will not render. Build shapes from `<Box>`
geometry or use the `usePixelArt` hook to convert bitmap art strings to pixel grids
(see neofetch heart for the pixel grid pattern).

## Multi-screen App Pattern

When an app has multiple screens, the pattern is always the same:

```tsx
// context.tsx — domain state + actions + navigation
// App.tsx — wraps with Provider, renders a Router
// Router — switch(state.screen) → one component per case
// screens/ — one file per screen, reads state from context
```

`navigate()` is a context action (`actions.navigate('dashboard')`). Screens never
import each other. The Router is the only place that knows all screen names. Context
types the valid screen values — TypeScript catches typos at the Router switch.

See: `wallet/`, `dvd/` for clean examples of this pattern.

## Pressable hover/press styling

Interactive elements use the function form of `style` to respond to interaction state:

```tsx
<Pressable
  onPress={handler}
  style={(s) => ({
    backgroundColor: s.pressed ? '#darker' : s.hovered ? '#medium' : C.surface,
    borderRadius: 8,
    paddingLeft: 14, paddingRight: 14,
    paddingTop: 8, paddingBottom: 8,
  })}
>
```

Three states: default → hovered → pressed. Pick your three colors. The pressed color
is darker than hovered. Hovered is slightly different from default. Don't add
transition effects — there are none. The color just snaps.

Disabled states don't use the function form — they hardcode a single muted color and
pass `onPress={undefined}` or omit the handler.

## Pixel spacing conventions

Padding on interactive chips: `paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6`
— never shorthand `padding: 8` for asymmetric paddings.

Gap between sibling elements: use `gap` on the parent Box, not `marginTop`/`marginLeft`
on children. Consistent 4 / 6 / 8 / 12 / 16 / 24 grid. Not 7, not 11, not 15.

Borders: `borderWidth: 1, borderColor: C.border` — always 1px, always the palette
border color. Status/accent borders can use `borderColor: C.accent`.

Status dots: `width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor`
— always 8×8 perfect circles via border-radius half.

## Section separators in complex layouts

For visual section breaks inside a component:
```tsx
<Box style={{ height: 1, backgroundColor: C.dim }} />   {/* solid rule */}
<Box style={{ height: 8 }} />                           {/* spacer */}
```

Not `marginTop`, not `paddingTop` on the section below. An explicit 1px Box for the
rule, an explicit height-only Box for breathing room.

## Building and Verifying

After editing any component in this directory:

```bash
cd examples/<project>
reactjit lint                           # catch layout errors before building
reactjit build dist:sdl2                # or: reactjit dev sdl2
reactjit screenshot --output /tmp/preview.png
```

The lint step is not optional. `no-explicit-font-size`, `no-unicode-symbol-in-text`,
and layout anti-pattern rules are enforced here. Fix the lint errors; don't suppress
them.

## What NOT to do in this directory

- Do not `npm run build` from the monorepo root to build a single example. Use the CLI.
- Do not edit `<project>/lua/*.lua` or `<project>/reactjit/**` directly. They are
  disposable copies. Your changes will be overwritten by the next `reactjit update`.
- Do not create a new example by copying files manually. Use `reactjit init <name>`.
- Do not hardcode pixel heights to fill a known window size. Use `flexGrow: 1`.
- Do not add a new example without adding a storybook story for the capability it
  demonstrates. Examples prove it works; the storybook makes it permanent.
- Do not leave uncommitted changes. You own the git history in this repo.
