# Classifier, Theme Tokens, And `classify.js`

Last updated: 2026-04-26.

The classifier system is the ReactJIT style registry. It turns repeated
primitive prop/style shapes into named components, then resolves `theme:` tokens
through the active theme store at render time.

`scripts/classify.js` is the V8 CLI tool that helps build and maintain those
classifier sheets. It scans TSX with the vendored TypeScript parser, finds
static JSX style patterns, writes `.cls.ts` files, suggests theme tokens, and
can migrate inline JSX to classifier usage.

## Runtime Pieces

Core files:

```text
runtime/classifier.tsx
runtime/theme.tsx
runtime/theme_presets.ts
runtime/core_stub.ts
scripts/classify.js
scripts/classify
```

`@reactjit/core` is an esbuild alias for `runtime/core_stub.ts`. Today that
stub exports:

```ts
export { tw } from './tw';
export { classifier, classifiers } from './classifier';
```

Generated classifier files usually import from `@reactjit/core` so they bundle
correctly through the normal V8 path.

## Runtime API

A classifier sheet registers named wrappers:

```ts
import { classifier } from '@reactjit/core';

classifier({
  Card: {
    type: 'Box',
    style: {
      padding: 'theme:spacingMd',
      borderRadius: 'theme:radiusLg',
      backgroundColor: 'theme:surface',
      borderWidth: 'theme:borderThin',
      borderColor: 'theme:border',
    },
    hoverStyle: { borderColor: 'theme:borderFocus' },
  },
  Title: {
    type: 'Text',
    fontSize: 'theme:fontLg',
    color: 'theme:text',
    fontWeight: 'bold',
  },
});
```

Use the registry in TSX:

```tsx
import './app.cls';
import { classifiers as S } from '@reactjit/core';

export default function App() {
  return (
    <S.Card>
      <S.Title>Hello</S.Title>
    </S.Card>
  );
}
```

The registry is global in the JS bundle. A classifier name can only be
registered once.

## Supported Runtime Primitives

`runtime/classifier.tsx` currently accepts these `type` values:

```text
Box
Text
Image
Pressable
ScrollView
TextInput
Canvas
Graph
Native
```

`Row` and `Col` are JSX sugar over `Box`; they are not classifier primitive
types. Use `type: 'Box'` and put `flexDirection: 'row'` in `style` when needed.

Current caveat: `scripts/classify.js` knows about a few tags that the runtime
classifier does not currently accept as `type` values, including `TextArea` and
`TextEditor`. Do not commit generated classifiers with unsupported runtime
types until `runtime/classifier.tsx` is extended to include them.

## Style Sets

Classifier entries can contain these style-bearing keys:

```text
style
hoverStyle
activeStyle
focusStyle
textStyle
contentContainerStyle
```

Any other non-reserved property is treated as a default prop and passed through
to the primitive. Reserved keys are:

```text
type
use
variants
bp
```

Style merge behavior:

- Style keys are shallow-merged.
- Non-style default props overwrite by later layer.
- User props at the call site override classifier defaults.
- User `style` shallow-merges over classifier `style`.

Runtime precedence, from lowest to highest:

```text
base
bp[current]
variants[active]
bp[current].variants[active]
user props
use() hook props
```

## Theme Tokens

Any string beginning with `theme:` is a token:

```ts
{
  color: 'theme:text',
  backgroundColor: 'theme:surface',
  borderRadius: 'theme:radiusMd',
}
```

`runtime/theme.tsx` resolves tokens against two palettes:

- `ThemeColors`: string color tokens.
- `StylePalette`: numeric style tokens.

Standard color tokens from `runtime/theme_presets.ts`:

```text
bg
bgAlt
bgElevated
surface
surfaceHover
border
borderFocus
text
textSecondary
textDim
primary
primaryHover
primaryPressed
accent
error
warning
success
info
```

Standard style tokens:

```text
radiusSm
radiusMd
radiusLg
spacingSm
spacingMd
spacingLg
borderThin
borderMedium
fontSm
fontMd
fontLg
```

Both palette types allow additional cart-specific keys. Unknown `theme:` tokens
pass through unchanged, which lets carts use broader token sets when their theme
provides them.

Seed tokens with `ThemeProvider`:

```tsx
import { ThemeProvider } from '../../runtime/theme';

export default function App() {
  return (
    <ThemeProvider
      colors={{ surface: '#182432', text: '#eef5ff' }}
      styles={{ radiusMd: 8, spacingMd: 14 }}
    >
      <AppBody />
    </ThemeProvider>
  );
}
```

`ThemeProvider` merges partial colors/styles into the module-level theme store.
Classifiers subscribe to that store only when they contain tokens, variants, or
breakpoints.

## Variants And Breakpoints

Variants let one classifier define named layout/style modes:

```ts
classifier({
  Card: {
    type: 'Box',
    style: { padding: 12, backgroundColor: 'theme:surface' },
    variants: {
      dense: { style: { padding: 6 } },
      hero: { style: { padding: 24, borderRadius: 'theme:radiusLg' } },
    },
  },
});
```

Set the active variant:

```ts
import { setVariant } from '../../runtime/theme';

setVariant('dense');
setVariant(null);
```

Breakpoints are `sm`, `md`, `lg`, and `xl`. The store starts at width `1280`,
which is `lg` by default. Update it with:

```ts
import { setViewportWidth } from '../../runtime/theme';

setViewportWidth(900);
```

Classifier breakpoint overrides use `bp`:

```ts
classifier({
  Shell: {
    type: 'Box',
    style: { flexDirection: 'row', gap: 'theme:spacingMd' },
    bp: {
      sm: { style: { flexDirection: 'column', gap: 'theme:spacingSm' } },
    },
  },
});
```

Breakpoint entries can also override a specific variant:

```ts
bp: {
  sm: {
    variants: {
      dense: { style: { gap: 2 } },
    },
  },
}
```

## `scripts/classify` Launcher

Use the wrapper from the repo root:

```sh
scripts/classify
```

It runs:

```sh
tools/v8cli scripts/classify.js "$@"
```

The scanner defaults to `cart/` when it exists, otherwise `src/`.

Most commands accept:

```text
--dir <path>
--dry-run
```

Use `tools/v8cli scripts/classify.js ...` directly only when you need to bypass
the launcher.

## Default Scan

Default mode finds repeated exact JSX primitive patterns and writes a classifier
sheet.

```sh
scripts/classify
scripts/classify --dir cart/my-cart --output cart/my-cart/app.cls.ts
scripts/classify --min 3 --prefix App --dry-run
```

What it scans:

- TSX and TS files.
- JSX primitives and common HTML aliases.
- Inline `style={{ ... }}` object literals.
- Static literal JSX props.
- Theme property reads like `c.text` and `colors.surface`.

What it skips:

- Style spreads.
- Dynamic style values.
- Dynamic JSX props.
- Bare primitives with no static style or static props.
- Files ending in `.cls.ts`.

The default output file is `app.cls.ts`. Without `--dry-run`, default mode writes
that file after printing the report.

## Exact Pattern Matching

`classify.js` builds a stable signature from:

```text
primitive type
sorted static style properties
sorted static JSX props
```

For example, these two elements have the same signature:

```tsx
<Box style={{ padding: 8, gap: 4 }} />
<Box style={{ gap: 4, padding: 8 }} />
```

This element does not, because it has one extra property:

```tsx
<Box style={{ padding: 8, gap: 4, borderRadius: 6 }} />
```

Use `partial` or `add` when you want to extract shared subsets across elements
that are not exact matches.

## Tag Mapping In `classify.js`

The scanner maps source tags to classifier primitive types before hashing.

Important mappings:

```text
Box, View, view, div -> Box
Row, FlexRow -> Box + style.flexDirection = 'row'
Col, FlexColumn -> Box
Text, text, span, p -> Text
Image, image, img -> Image
Pressable, button -> Pressable
TextInput, Input, input -> TextInput
Canvas -> Canvas
Graph -> Graph
Native -> Native
```

`Row` injects `flexDirection: 'row'` if the style did not already provide it.
`Col` does not inject anything because column is the default View direction.

Current caveat: lowercase `<canvas>` and `<graph>` work through the JSX shim, but
the scanner currently recognizes `Canvas` and `Graph`, not the lowercase forms.

## Generated Names

The script names patterns from structural traits:

- Text: size, boldness, color, text alignment, fixed width.
- Image: exact pixel size.
- Box-like primitives: root/full-size, dot, divider, header/footer bar, panel,
  card, chip, badge, row/inline, stack, padding, fill.

Collisions are deduplicated with suffixes based on differing traits such as
padding, gap, width, height, color, or prop count.

Use `rename` after generation when the heuristic name is not domain-specific
enough.

## Text Shorthand

Generated Text classifiers promote common style properties:

```tsx
<Text style={{ fontSize: 12, fontWeight: 'bold', color: '#fff' }} />
```

becomes:

```ts
Caption: {
  type: 'Text',
  size: 12,
  bold: true,
  color: '#fff',
}
```

The runtime `Text` primitive supports `size` and `bold` shorthand. If you prefer
plain host-style names in classifier sheets, use `fontSize` and `fontWeight`
directly; both are passed through as props.

## Theme Mining

`theme` mode is read-only unless `--emit` is provided. It scans repeated literal
style values and suggests palette entries.

```sh
scripts/classify theme
scripts/classify theme --dir cart/my-cart --min 4
scripts/classify theme --emit cart/my-cart/theme_tokens.ts
scripts/classify theme --emit cart/my-cart/theme_tokens.ts --dry-run
```

It buckets literal values into:

```text
color
radius
spacing
border
font
```

It ignores values already written as `theme:` tokens. The emitted snippet looks
like:

```ts
export const suggestedColors = { ... };
export const suggestedStyles = { ... };
```

Those objects are starting points. Move useful keys into the cart's real
`ThemeProvider` colors/styles or a `ThemePreset`.

## Partial Pattern Mining

`partial` mode finds common property subsets that recur across different exact
patterns.

```sh
scripts/classify partial
scripts/classify partial --dir cart/my-cart --min 12 --max-size 6 --top 20
```

It uses frequent itemset mining. Output columns:

```text
Props   number of properties in the subset
Hits    elements containing the subset
Spread  distinct full signatures containing the subset
Files   source files containing the subset
```

At the bottom it prints quick-add commands:

```sh
scripts/classify add SurfaceCard '{"type":"Box","style":{"backgroundColor":"theme:surface","borderWidth":1}}'
```

Use this mode to find primitives like shared cards, rows, labels, badges, and
panels that have extra local style in each usage.

## Add

`add` appends one classifier definition and, by default, runs partial migration.

```sh
scripts/classify add SurfaceCard '{"type":"Box","style":{"backgroundColor":"theme:surface","borderWidth":1,"borderColor":"theme:border"}}'
scripts/classify add MutedCaption '{"type":"Text","size":9,"color":"theme:textDim"}'
scripts/classify add InlineG4 '{"type":"Box","style":{"flexDirection":"row","gap":4,"alignItems":"center"}}'
```

Options:

```text
--dir <path>
--cls <path>
--no-migrate
--dry-run
```

If no `.cls.ts` file exists, `add` creates `app.cls.ts`. If a matching inline
style has extra properties, partial migration keeps those extra properties in a
remaining `style={{ ... }}` prop on the classifier usage.

## Migrate

`migrate` rewrites matching inline JSX to classifier references.

```sh
scripts/classify migrate --dir cart/my-cart --cls cart/my-cart/app.cls.ts
scripts/classify migrate --dir cart/my-cart --partial
scripts/classify migrate --dry-run
```

Exact migration removes style/props fully covered by the classifier:

```tsx
<Box style={{ padding: 8, gap: 4 }}>...</Box>
```

becomes:

```tsx
<S.Stack4>...</S.Stack4>
```

Partial migration preserves uncovered style properties:

```tsx
<Box style={{ padding: 8, gap: 4, marginTop: 12 }}>...</Box>
```

can become:

```tsx
<S.Stack4 style={{ marginTop: 12 }}>...</S.Stack4>
```

The migration step normalizes the classifier alias to `S`:

```ts
import { classifiers as S } from '@reactjit/core';
```

## Rename

`rename` updates classifier definition keys and references across `.cls.ts` and
TSX files.

```sh
scripts/classify rename OldName NewName --dir cart/my-cart
scripts/classify rename OldName NewName --dry-run
```

The new name must be PascalCase.

## Pick Mode

`pick` exists in the older Bun/Node script, but it is currently unavailable in
the V8 CLI version because v8cli does not expose the required interactive stdin
readline bridge.

```sh
scripts/classify pick
```

Under v8cli, use non-interactive commands instead:

```text
theme
partial
add
migrate
rename
```

## Theme Detection In The Scanner

During AST extraction, `classify.js` recognizes property access on common theme
variables:

```text
c
colors
theme
themeColors
```

Known properties are converted into standard `theme:` tokens before hashing:

```tsx
<Text style={{ color: colors.textDim }} />
```

is treated as:

```tsx
<Text style={{ color: 'theme:textDim' }} />
```

The standard property map includes tokens such as `bg`, `bgAlt`, `surface`,
`border`, `text`, `textSecondary`, `textDim`, `primary`, `accent`, `error`,
`warning`, `success`, and `info`.

When `migrate` parses an existing `.cls.ts`, it resolves some `theme:` values to
literal values for signature matching. That resolver currently includes a
hard-coded cockpit token map for legacy/gallery migration. Standard generated
templates should prefer the runtime token names from `theme_presets.ts`.

## Recommended Workflow

For a new or messy cart:

```sh
scripts/classify theme --dir cart/my-cart --emit cart/my-cart/theme_suggestions.ts --dry-run
scripts/classify partial --dir cart/my-cart --min 8 --top 20
scripts/classify --dir cart/my-cart --output cart/my-cart/app.cls.ts --dry-run
scripts/classify --dir cart/my-cart --output cart/my-cart/app.cls.ts
scripts/classify migrate --dir cart/my-cart --cls cart/my-cart/app.cls.ts --dry-run
scripts/classify migrate --dir cart/my-cart --cls cart/my-cart/app.cls.ts
```

Then review:

- classifier names
- unsupported primitive types
- hard-coded literals that should become `theme:` tokens
- partial migrations that left residual inline styles
- import aliases normalized to `S`

Finally, import the classifier sheet once near the app entry:

```ts
import './app.cls';
```

and render with:

```ts
import { classifiers as S } from '@reactjit/core';
```

## Current Limitations

- Only static object-literal styles are analyzed.
- Style spreads are skipped.
- Dynamic values are skipped.
- Lowercase `<canvas>` and `<graph>` are runtime-valid through the JSX shim but
  are not currently recognized by the classifier scanner.
- `Video` is a runtime primitive wrapper but is not currently supported by the
  runtime classifier registry.
- The V8 CLI `pick` command is intentionally disabled until v8cli has an
  interactive stdin bridge.
- The generated `.cls.ts` file should be reviewed before migration. The naming
  heuristics are useful, not authoritative.
