import type { RecipeDocument } from "./recipe-document";

export const recipe: RecipeDocument = {
  slug: "frontend-aesthetics-prompting-guide",
  title: "Frontend Aesthetics: A Prompting Guide",
  sourcePath: "cart/app/recipes/frontend-aesthetics-prompting-guide.md",
  instructions:
    "A prompt blob that pushes Claude away from generic 'AI slop' frontend defaults. In our stack it rides on the user message — framework/v8_bindings_sdk.zig:932 (hostClaudeInit) doesn't expose system_prompt to the cart yet — so prepend it to every UI-generation turn.",
  sections: [
    {
      kind: "paragraph",
      text:
        "Claude can produce great frontends but tends toward generic, conservative defaults when not steered. This recipe is a single prompt blob you wrap your turn with so the output rejects the 'AI slop' aesthetic and commits to a specific design direction.",
    },
    {
      kind: "bullet-list",
      title: "When to use this",
      items: [
        "Any time you ask Claude to produce a TSX cart, page, component, or themed UI.",
        "Code generation for HTML/CSS demos.",
        "Style passes on existing components ('redo this in the spirit of …').",
        "Skip it for backend code, docs, refactors, or anything non-visual.",
      ],
    },
    {
      kind: "code-block",
      title: "The full aesthetics prompt block",
      language: "typescript",
      code: `export const FRONTEND_AESTHETICS_PROMPT = \`<frontend_aesthetics>
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
</frontend_aesthetics>\`;`,
    },
    {
      kind: "code-block",
      title: "Sending it through the v8 bindings",
      language: "typescript",
      code: `const host: any = globalThis;
const claude_init = typeof host.__claude_init === 'function'
  ? host.__claude_init : (_a: string, _b: string, _c?: string) => 0;
const claude_send = typeof host.__claude_send === 'function'
  ? host.__claude_send : (_: string) => 0;

function askForFrontend(workspace: string, model: string, request: string): boolean {
  if (!claude_init(workspace, model)) return false;

  // No system_prompt override from the cart yet — concatenate.
  const prompt = \`\${FRONTEND_AESTHETICS_PROMPT}\\n\\n\${request}\`;
  return claude_send(prompt);
}`,
    },
    {
      kind: "code-block",
      title: "Subset prompts for narrow control",
      language: "typescript",
      code: `export const TYPOGRAPHY_PROMPT = \`<typography>
Choose fonts that elevate the design. Avoid Inter, Roboto, Arial, and
system-ui defaults. Pair a distinctive display font with a comfortable
text font. Specify weights and sizes explicitly.
</typography>\`;

export const MOTION_PROMPT = \`<motion>
One orchestrated page-load reveal beats scattered micro-interactions.
Stagger appearance with animation-delay. Prefer CSS-only motion. Use the
Motion library for React when CSS won't reach.
</motion>\`;

export const COLOR_PROMPT = \`<color>
Commit to a cohesive palette. Use CSS variables. Dominant colors plus
sharp accents — not timid, evenly-distributed palettes. No purple
gradients on white. Draw from IDE themes and cultural aesthetics.
</color>\`;`,
    },
    {
      kind: "paragraph",
      title: "Validation",
      text:
        "Generate two variants of the same component, one with the prompt and one without. The non-prompted version usually picks Inter, a near-monochrome palette, and zero motion. The prompted version commits to a direction. If the prompted variant still feels generic, narrow the prompt to typography or color alone.",
    },
    {
      kind: "bullet-list",
      title: "Caveats and TODOs against the v8 bindings",
      items: [
        "No system_prompt from the cart. framework/claude_sdk/options.zig:35 has the field; framework/v8_bindings_sdk.zig:932 doesn't pass it through. Concatenate into the user message today; move to the system slot when wired.",
        "No turn-history persistence. Each new __claude_init is a fresh subprocess. Re-send the aesthetics block per session until resume_session is exposed cleanly.",
      ],
    },
    {
      kind: "bullet-list",
      title: "Pattern summary",
      items: [
        "Keep the aesthetics block as a TS string export so it's a one-liner to import anywhere.",
        "Concatenate ${AESTHETICS}\\n\\n${request} and pass that to __claude_send.",
        "For narrow tasks, send a slice (typography / motion / color) instead of the full bundle.",
        "When system_prompt opens up in the bindings, move the block onto the system slot.",
      ],
    },
  ],
};
