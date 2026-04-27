# V8 CLI Init

Last updated: 2026-04-26.

`scripts/init.js` scaffolds ReactJIT carts through the V8 CLI. It is intentionally
small and positional: there are no flags, and the one-argument form creates the
basic starter.

## Usage

```sh
tools/v8cli scripts/init.js <directory>
tools/v8cli scripts/init.js <directory> <template>
tools/v8cli scripts/init.js <template> <directory>
```

Examples:

```sh
tools/v8cli scripts/init.js hello
tools/v8cli scripts/init.js hello dashboard
tools/v8cli scripts/init.js stdlib hello-stdlib
```

Rules:

- A bare directory name creates `cart/<name>/`.
- A relative or absolute path creates that exact target directory.
- The target directory must not already exist.
- Arguments starting with `-` are rejected. Init does not support flags.
- When no template is provided, init uses `basic`.

After creating a cart under `cart/`, run it with:

```sh
./scripts/dev <name>
```

Ship it with:

```sh
./scripts/ship <name>
```

## Templates

Current templates:

| Template | Purpose |
| --- | --- |
| `basic` | Minimal routed starter using lowercase `<router>`, `<route>`, `<box>`, and `<text>`. |
| `routes` | Small routed shell using `runtime/router` plus classifier/theme styles. |
| `dashboard` | Metric/dashboard starter using classifier/theme styles. |
| `taskboard` | Stateful task list starter with `TextInput` and classifier/theme styles. |
| `canvas` | Canvas-focused starter with `Canvas.Path` and `Canvas.Node`. |
| `stdlib` | ReactJIT stdlib showcase with base icons, `<video>`, `<canvas>`, and `<graph>`. |

## Generated Files

Every template creates:

```text
cart/<name>/
  index.tsx
  cart.json
  README.md
```

Non-basic templates also create:

```text
cart/<name>/
  style_cls.tsx
  theme.ts
```

The `stdlib` template additionally creates:

```text
cart/<name>/
  media/README.md
```

`cart.json` includes the generated name, description, window size, and
`customChrome: true`.

## Basic Template

The basic template stays deliberately small. It demonstrates the create-react-app
style entry point and the lowercase intrinsics that init originally introduced:

```tsx
export default function App() {
  return (
    <router initialPath="/">
      <box>
        <text>Hello</text>
        <route path="/">
          <text>Home route</text>
        </route>
      </box>
    </router>
  );
}
```

Those lowercase tags are resolved by `runtime/jsx_shim.ts` during bundling:

- `<router>` -> `runtime/router.Router`
- `<route>` -> `runtime/router.Route`
- `<box>` -> `runtime/primitives.Box`
- `<text>` -> `runtime/primitives.Text`

The shim also maps lowercase `<video>`, `<canvas>`, and `<graph>` to their
runtime primitive wrappers for the stdlib example.

## Classifier Templates

Every template beyond `basic` uses the theme classifier system:

- `theme.ts` exports `APP_COLORS` and `APP_STYLES`.
- `style_cls.tsx` registers reusable classifier components with `classifier()`.
- `index.tsx` wraps the app in `ThemeProvider`.

The generated classifier styles use `theme:` tokens such as:

```ts
backgroundColor: 'theme:surface'
borderRadius: 'theme:radiusLg'
fontSize: 'theme:fontMd'
```

At runtime, `ThemeProvider` resolves those tokens against the active color and
style palettes from `runtime/theme`.

## ReactJIT Stdlib

Generated carts refer to `runtime/` as the ReactJIT stdlib. The scaffold imports
from stdlib modules directly instead of depending on another cart.

Common imports:

```ts
import { Canvas, Graph } from '../../runtime/primitives';
import { Route, Router, useNavigate } from '../../runtime/router';
import { ThemeProvider } from '../../runtime/theme';
import { classifier, classifiers as C } from '../../runtime/classifier';
```

The import path is generated relative to the scaffold target directory. For a
normal cart under `cart/<name>/`, that path is `../../runtime/...`.

## Base Icons

Only the base icon pack belongs in runtime:

```text
runtime/icons/icons.ts
runtime/icons/registry.ts
runtime/icons/Icon.tsx
```

`runtime/icons/icons.ts` contains generated Lucide path data. It is not
auto-registered as a full catalog because that would retain the entire icon pack
in every bundle.

The `stdlib` template demonstrates the preferred tree-shakable form:

```tsx
import { Icon } from '../../runtime/icons/Icon';
import { Activity, ChartLine } from '../../runtime/icons/icons';

<Icon icon={Activity} size={18} color="#ffd166" />
<Icon icon={ChartLine} size={18} color="#ffd166" />
```

Use `registerIcons()` from `runtime/icons/registry` only when a cart needs
string-name lookup:

```ts
import { registerIcons } from '../../runtime/icons/registry';
import { Activity } from '../../runtime/icons/icons';

registerIcons({ Activity });
```

Then the registered icon can be rendered by name:

```tsx
<Icon name="Activity" />
```

## Media And Graph Primitives

The `stdlib` template demonstrates the runtime media and spatial primitives:

```tsx
<video src="./media/sample.mp4" />

<canvas>
  <Canvas.Path d="M 40 120 C 140 20 260 220 360 70" />
  <Canvas.Node gx={52} gy={48} gw={120} gh={72} />
</canvas>

<graph>
  <Graph.Path d="M -150 60 L -90 -20 L -30 20" />
  <Graph.Node gx={-90} gy={-20} gw={84} gh={44} />
</graph>
```

`<video>` routes through the `Video` primitive wrapper so `src` becomes the
host-side `videoSrc` field. The generated template expects a local file at
`media/sample.mp4`; replace the path or add that file.

`<canvas>` is the pan/zoomable surface. `Canvas.Node` positions regular
ReactJIT UI in graph space, and `Canvas.Path` paints SVG path data.

`<graph>` is the static-viewport graph surface. It uses the same path/node idea
without the canvas pan/zoom behavior.

## Verification

A quick smoke test for the script:

```sh
tmp=/tmp/reactjit-init-smoke
tools/v8cli scripts/init.js "$tmp" stdlib

ROOT=$(pwd)
tools/esbuild runtime/index.tsx \
  --bundle \
  --outfile=/tmp/reactjit-init-smoke.bundle.js \
  --format=iife \
  --jsx-factory=__jsx \
  --jsx-fragment=Fragment \
  --inject:$ROOT/runtime/jsx_shim.ts \
  --inject:$ROOT/framework/ambient.ts \
  --inject:$ROOT/framework/ambient_primitives.ts \
  --alias:@reactjit/core=$ROOT/runtime/core_stub.ts \
  --alias:@cart-entry=$tmp/index.tsx \
  --alias:react=$ROOT/vendor/react \
  --alias:react-reconciler=$ROOT/vendor/react-reconciler \
  --alias:scheduler=$ROOT/vendor/scheduler \
  --alias:loose-envify=$ROOT/vendor/loose-envify \
  --alias:js-tokens=$ROOT/vendor/js-tokens \
  --external:path \
  --external:typescript
```
