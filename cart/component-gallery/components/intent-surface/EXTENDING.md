# Extending the Intent Chat Surface

The Intent surface is the vocabulary a model emits inside `[ ... ]` to render an
interactive chat reply. This doc covers how to add a new tag, where every piece
lives, and what to read first.

---

## What this surface is

A tiny tree-shaped IR the model emits and the renderer interprets:

```
[<Col>
  <Title>Pick one</Title>
  <Btn reply="A">A</Btn>
  <Btn reply="B">B</Btn>
</Col>]
```

The model authors *both* the layout and the reply payload that gets sent back
when the user clicks. There is no glue code per turn. See `types.ts` for the
canonical tag list and the model-facing contract.

---

## File map

The vocabulary spans four places. To add or change a tag you touch all four.

| Concern             | File                                                                     |
|---------------------|--------------------------------------------------------------------------|
| Parser allowlist    | `runtime/intent/parser.ts` — `NodeKind`, `ALLOWED`, `normalizeName()`    |
| Component (visual)  | `cart/component-gallery/components/intent-surface/Intent<Tag>.tsx`        |
| AST → component     | `cart/component-gallery/components/intent-surface/IntentSurface.tsx`      |
| Vocabulary contract | `cart/component-gallery/components/intent-surface/types.ts` — `IntentTag` |
| Gallery story       | `cart/component-gallery/stories/intent-surface.story.tsx`                 |
| Model instructions  | `cart/chat-loom.tsx` — `SYSTEM_PROMPT`                                    |

The runtime entry `runtime/intent/render.tsx` is a thin re-export of
`IntentSurface` — leave it alone unless the public API changes.

---

## Adding a new tag — recipe

Worked example: adding `<Pill color="...">label</Pill>`, a small inline status
chip.

### 1. Write the component

`cart/component-gallery/components/intent-surface/IntentPill.tsx`:

```tsx
import { Box, Text } from '../../../../runtime/primitives';

export function IntentPill({ color, children }: { color?: string; children?: any }) {
  return (
    <Box style={{
      paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2,
      backgroundColor: color ?? '#475569',
      borderRadius: 999,
      alignSelf: 'flex-start',
    }}>
      <Text style={{ fontSize: 12, color: '#f8fafc' }}>{children}</Text>
    </Box>
  );
}
```

Components live next to the existing atoms; one file per tag. Keep them small
and compositional. Real layout primitives come from `runtime/primitives`
(`Box`, `Col`, `Row`, `Text`, `Pressable`, `TextInput`, `ScrollView`).

### 2. Register the tag in the parser

`runtime/intent/parser.ts`:

```ts
export type NodeKind =
  | 'Row' | 'Col' | 'Card' | 'Title' | 'Text' | 'List' | 'Btn'
  | 'Form' | 'Field' | 'Submit'
  | 'Pill'                                      // <— new
  | 'text';

const ALLOWED = new Set<NodeKind>([
  'Row', 'Col', 'Card', 'Title', 'Text', 'List', 'Btn',
  'Form', 'Field', 'Submit',
  'Pill',                                       // <— new
]);

// in normalizeName():
const map: Record<string, NodeKind> = {
  // ...existing...
  pill: 'Pill', chip: 'Pill', badge: 'Pill',    // <— new aliases
};
```

Alias lowercase variants and synonyms so small models don't have to be precise.
Anything outside `ALLOWED` falls back to plain text — that's how unknown tags
fail soft instead of crashing.

### 3. Hook it up in the dispatcher

`cart/component-gallery/components/intent-surface/IntentSurface.tsx`:

```ts
import { IntentPill } from './IntentPill';

// in the switch:
case 'Pill': {
  const color = stringAttr(node.attrs.color);
  return <IntentPill color={color}>{flatText(node)}</IntentPill>;
}
```

`stringAttr` and `flatText` are already in the file. Use `stringAttr` for any
attribute (it filters out the `bare-key === true` case). Use `flatText` to
collapse children to a string when the tag is leaf-shaped.

### 4. Update the contract

`cart/component-gallery/components/intent-surface/types.ts`:

```ts
export type IntentTag =
  | 'Title' | 'Text' | 'Card' | 'Row' | 'Col' | 'List'
  | 'Btn'
  | 'Form' | 'Field' | 'Submit'
  | 'Pill';                                     // <— new
```

This is the source-of-truth list. If a tag isn't here, it isn't supported.

### 5. Add a gallery variant

`cart/component-gallery/stories/intent-surface.story.tsx`, in the `atoms` story
variants:

```tsx
{
  id: 'pill',
  name: '<Pill>',
  render: () => <IntentPill color="#16a34a">ready</IntentPill>,
},
```

Optionally add a composed example showing the tag inside a realistic surface.

### 6. Teach the model

`cart/chat-loom.tsx`, inside `SYSTEM_PROMPT`, add the tag to the listed
vocabulary with a one-line description and at least one example. The system
prompt is where the model learns the syntax — without an entry here, it won't
emit the tag.

```
  <Pill color="...">label</Pill>
```

That's it. The watcher rebuilds and the next reply can use the new tag.

---

## Reference material

### `tsz/docs/INTENT_DICTIONARY.md`

The canonical Intent DSL spec from the Smith-era compiler. This is *the*
reference for the surface vocabulary — way deeper than the chat subset we
implement here. When in doubt about how a construct should look, read the
matching section. Specifically useful:

- Tag shapes and binding rules (`is` / `exact` / bare)
- Attribute conventions
- `<for>`, `<if>`, `<during>` semantics — useful when extending the surface
  toward conditional/iterative content from the model
- Effects and glyphs vocabulary (`:check:`, `:warning:`, etc.) for when we
  want inline shortcodes

The dictionary is read-only reference, *not* something we compile or run. Our
surface is a chat-relevant subset, regenerated as plain TSX.

### `tsz/archive/intent-parser-2026-04-12/`

Resurrected snapshot of the Smith parser modules — 366 `.mod.fart` files that
ran against the same vocabulary. Each file documents one slice of the parser
(attribute parsing, conditional blocks, for-loops, classifiers, handlers,
glyphs). Useful when our parser meets an edge case and we need to know what
Smith did. Specifically:

- `parse_attrs_basic.mod.fart` — attribute-value tokenizing
- `parse_handlers_press.mod.fart` — bare-word handler resolution
- `parse_for_loop.mod.fart` — `<for items as item>` shape
- `parse_conditional_blocks.mod.fart` — `<if> / <else if> / <else>` shape
- `parse_inline_glyph.mod.fart` — `:name:` and `:name[effect]:` parsing
- `intent_strict_validator.mod.fart` — error-mode rules

Read these as spec, not as code to port mechanically.

### Existing component-gallery sections

The gallery already has well-shaped atoms for visual idioms we'll reuse. When
adding a tag, see if a gallery component already does what you want before
inventing a new visual:

- `cart/component-gallery/components/basic-tooltip/` — hover affordance
- `cart/component-gallery/components/controls-specimen/StatusBadge.tsx` — pill/badge precedent
- `cart/component-gallery/components/grid-spinners/` — loading affordance
- `cart/component-gallery/components/area-chart/`, `bar-chart/`, etc. — when
  adding `<Chart kind=... data=...>`, these are the implementations to wrap

---

## Design rules

A tag earns its place by satisfying these:

1. **The model can emit it from the system prompt alone.** If teaching the tag
   takes more than a paragraph and one example, simplify it.
2. **It composes with the others.** A Pill should work inside a Row, a Card,
   inside a Btn label. New tags should not have placement restrictions beyond
   the ones already in `IntentSurface.tsx` (e.g. Field/Submit need a Form
   parent).
3. **The reply payload is explicit.** Any tag that triggers an action carries a
   `reply=` attribute the model authored. No magic — the model writes the
   exact string sent back.
4. **It maps to a single component.** No invisible state, no global registry,
   no side effects beyond rendering and calling `onAction`.
5. **It fails soft.** If parsing or props are wrong, render fenced text
   showing the bad payload — never crash the surface.

---

## Testing changes

### Gallery story

Open `component-gallery` in the dev host and select **Intent Chat Surface**
under **Compositions**. The atoms story renders each tag in isolation; click
the variant picker to step through them. The composed stories render full
multi-tag trees.

This is where you verify the *visual* contract: does the new tag look right,
does it sit inside Card/Row/Col cleanly, do interactive bits fire? Check the
console for the `[intent-surface story]` logs — clicking a Btn or Submit
should print the reply payload there.

### chat-loom cart

Open `chat-loom` against your local LM Studio endpoint. Ask the model to use
the new tag explicitly:

> "show me a status with three pills: ready, blocked, in-progress"

If the model emits the tag and it renders, you've completed the loop. If the
model doesn't reach for the tag, the system prompt needs more guidance for
when to pick it.

---

## Common pitfalls

- **Stale closure in handlers.** Pressable / TextInput callbacks freeze at
  first commit. Always read live state through refs (e.g. `valuesRef.current`)
  inside handlers, not the captured variable. See
  `runtime/primitives.tsx:97` for context.

- **Quote escaping in attributes.** Small models occasionally emit
  `<Btn reply="he said "hi"">` and the parser mis-tokenizes. The guideline in
  the system prompt is *"never put a `"` inside an attribute value; paraphrase
  if needed"*. If we need to harden the parser, end attribute values at
  whitespace-or-`>` when no closing quote is found.

- **Putting visual props on primitives.** Per the Intent Dictionary, primitives
  like `Box` and `Text` should not carry `fontSize` / `color` directly — those
  belong on classifiers. Our chat surface leans on inline `style={...}` for
  speed, but if the surface ever gets themed, this is the migration point.

- **Adding a tag without updating the system prompt.** The parser will accept
  it but the model will never reach for it. Always update `SYSTEM_PROMPT` in
  `cart/chat-loom.tsx` when extending the vocabulary.

- **Tags that need parent context.** `<Field>` and `<Submit>` only work inside
  `<Form>`. If you add a similarly context-bound tag, follow the React
  Context pattern in `IntentForm.tsx` rather than inventing a new mechanism.
