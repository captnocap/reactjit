# Frontend Aesthetics: A Prompting Guide

Claude can produce great frontends but tends toward generic, conservative defaults when not steered. This recipe is a single prompt blob you wrap your turn with so the output rejects the "AI slop" aesthetic and commits to a specific design direction.

In our stack the prompt rides on the user message — `framework/v8_bindings_sdk.zig:932` (`hostClaudeInit`) does not expose `system_prompt` to the cart yet. Until that opens up, prepend the aesthetics block to every turn that asks Claude to generate UI.

## When to use this

- Any time you ask Claude to produce a TSX cart, page, component, or themed UI.
- Code generation for HTML/CSS demos.
- Style passes on existing components ("redo this in the spirit of …").

Skip it for backend code, docs, refactors, or anything non-visual.

## The prompt block

```typescript
export const FRONTEND_AESTHETICS_PROMPT = `<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend
design, this creates what users call the "AI slop" aesthetic. Avoid this:
make creative, distinctive frontends that surprise and delight. Focus on:

Typography: Choose fonts that are beautiful, unique, and interesting. Avoid
generic fonts like Arial and Inter; opt instead for distinctive choices that
elevate the frontend's aesthetics.

Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for
consistency. Dominant colors with sharp accents outperform timid,
evenly-distributed palettes. Draw from IDE themes and cultural aesthetics
for inspiration.

Motion: Use animations for effects and micro-interactions. Prioritize
CSS-only solutions for HTML. Use Motion library for React when available.
Focus on high-impact moments: one well-orchestrated page load with
staggered reveals (animation-delay) creates more delight than scattered
micro-interactions.

Backgrounds: Create atmosphere and depth rather than defaulting to solid
colors. Layer CSS gradients, use geometric patterns, or add contextual
effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely
designed for the context. Vary between light and dark themes, different
fonts, different aesthetics. You still tend to converge on common choices
(Space Grotesk, for example) across generations. Avoid this: it is critical
that you think outside the box!
</frontend_aesthetics>`;
```

## Sending it through the v8 bindings

```typescript
const host: any = globalThis;
const claude_init = typeof host.__claude_init === 'function'
  ? host.__claude_init : (_a: string, _b: string, _c?: string) => 0;
const claude_send = typeof host.__claude_send === 'function'
  ? host.__claude_send : (_: string) => 0;

function askForFrontend(workspace: string, model: string, request: string): boolean {
  if (!claude_init(workspace, model)) return false;

  // No system_prompt override from the cart yet — concatenate.
  const prompt = `${FRONTEND_AESTHETICS_PROMPT}\n\n${request}`;
  return claude_send(prompt);
}
```

`request` is the actual ask: "build me a settings panel for…", "redesign this card with…". The aesthetics block reframes how Claude approaches it.

## Subset prompts for narrow control

The full block is broad. When you only care about one dimension, send the relevant slice — short prompts steer better than long ones the model has to weight.

```typescript
export const TYPOGRAPHY_PROMPT = `<typography>
Choose fonts that elevate the design. Avoid Inter, Roboto, Arial, and
system-ui defaults. Pair a distinctive display font with a comfortable
text font. Specify weights and sizes explicitly.
</typography>`;

export const MOTION_PROMPT = `<motion>
One orchestrated page-load reveal beats scattered micro-interactions.
Stagger appearance with animation-delay. Prefer CSS-only motion. Use the
Motion library for React when CSS won't reach.
</motion>`;

export const COLOR_PROMPT = `<color>
Commit to a cohesive palette. Use CSS variables. Dominant colors plus
sharp accents — not timid, evenly-distributed palettes. No purple
gradients on white. Draw from IDE themes and cultural aesthetics.
</color>`;
```

Use one or two of these instead of the full bundle when you're doing a focused style pass.

## Validation

Generate two variants of the same component, one with the prompt and one without. The non-prompted version usually picks Inter, a near-monochrome palette, and zero motion. The prompted version commits to a direction. If the prompted variant still feels generic, narrow the prompt to typography or color alone.

## Caveats and TODOs against the v8 bindings

- **No `system_prompt` from the cart.** `framework/claude_sdk/options.zig:35` already has the field; `framework/v8_bindings_sdk.zig:932` (`hostClaudeInit`) doesn't pass it through. Today we concatenate into the user message. When that's wired, move this prompt onto the system slot so it doesn't eat the turn budget.
- **No turn-history persistence in the cart yet.** Each new `__claude_init` is a fresh subprocess. The aesthetics block has to be re-sent every time you start a new session, until we surface `resume_session` cleanly.

## Pattern summary

1. Keep the aesthetics block as a TS string export so it's a one-liner to import anywhere.
2. Concatenate `${AESTHETICS}\n\n${request}` and pass that to `__claude_send`.
3. For narrow tasks, send a slice (typography / motion / color) instead of the full bundle.
4. When `system_prompt` opens up in the bindings, move the block onto the system slot.
