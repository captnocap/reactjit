# TODO: Storybook Style Page Restructure

## The Problem

The Style page is the first thing the storybook opens to. It currently reads as "hey guys we have Tailwind BAKED IN THIS SHIT." That is the opposite of this framework's identity.

ReactJIT started as "fuck Tailwind, fuck div soup." The Tailwind compatibility layer exists solely because people have bad habits and muscle memory, and rather than fighting them, we parse their garbage and make it work. It is a mercy feature, not a headline feature. The current Style page treats it as the headline.

**What a newcomer sees right now:** They open the storybook. The first thing on screen is a massive 12-row Tailwind color swatch grid taking 80% of the viewport. Every single demo element has a tooltip proudly listing `tw()` as a co-equal syntax. There's a literal "equivalence proof" section at the bottom showing tw() and style={} side by side as if they're peers. The whole page screams "this is a Tailwind framework that also supports style objects."

**What actually happened (git archaeology):** Before commit `eb3b25c`, the storybook had separate, honestly-labeled stories: Box, Layout, Grid System, Tailwind, HTML Compat. A parallel Claude session created an 882-line StyleStory.tsx that merged ALL of those into one mega-page, deleted the originals from the nav, and put it first in the story list. The intent was "show all style syntaxes in one place with tooltips" but the execution accidentally rebranded the framework.

## The Goal

Every style property the framework accepts should be demonstrable with a tooltip showing every syntax we accept for it. Zero elements without tooltips. But the HIERARCHY matters — the framework's own design language leads, and Tailwind/HTML compat is quarantined in its own corner.

This is NOT a cool way to show off a Tailwind compatibility layer. Tailwind compatibility is an afterthought that exists so we don't have to deal with disgruntled people who want to write unreadable incantations instead of clean style objects. It makes sense to include, but it lives in the timeout corner, not the shop window.

## What Core Should Look Like (the framework's real identity)

The Core section nav should teach the framework's primitives in natural learning order:

1. **Box** — "Here is a rectangle." The most primitive visual element. Background color, border radius, padding, shadow. This is the atom everything else is built from. (The old `BoxBasicStory` that was deleted — restore it or write a proper one.)

2. **Text** — Typography. Font size scale, weight, decoration, alignment, letter spacing, line height, color. The current TextStory is a thin wrapper around TextEffectsStory — it needs to actually be a proper typography reference.

3. **Layout** — Flex layout. Direction, justifyContent, alignItems, gap, wrap, flexGrow, sizing, aspectRatio. How things sit next to each other. (The old `FlexRowStory` that was deleted.)

4. **Grid** — Row/Col responsive grid system. Spans (numeric and semantic), responsive breakpoints, nesting. (The old `GridStory` that was deleted, currently buried as section 11 in StyleStory.)

5. **Style** — Everything else visual: gradients, borders & radius, shadows & opacity, transforms (rotate/scale/translate), position & overflow, transitions/animations. All with tooltips showing `style={}` and shorthand prop syntax. **No tw() in these tooltips.** The tooltip "ways" on Core pages should only show the framework's own syntaxes.

6. The rest of Core (Image, Video, Composition, Input, Search, Icons, Navigation, Data) stays as-is.

## New Section: "Compat" (or "Bad Habits" — your call on the name)

Add a new `StorySection` type. Suggested names (pick one):
- "Compat" — neutral, boring, clear
- "Bad Habits" — honest, funny, on-brand
- "Training Wheels" — implies they should grow out of it

This section contains:

1. **Tailwind** — "You wrote `className='bg-blue-500'`? We parse it." This is where the Tailwind color swatch grid lives. This is where tw() gets its spotlight. Show the full class coverage, show the parsing, show it works. But it lives HERE, not on the landing page.

2. **HTML Elements** — "You wrote `<div>`? We remap it to View. You wrote `<h1>`? We remap it to Text with fontSize 32 and bold. You're welcome." The div soup compatibility demo.

3. **Merge Precedence** — "When you mix tw() classes with shorthand props with style={}, here's who wins: className < shorthand < style={}." This section only matters if you're using tw(), so it belongs here with the compat stuff. The "equivalence proof" and spring transition demo can stay here too.

## Implementation Notes

- The `StyleDemo` tooltip component (`_shared/StyleDemo.tsx`) is good — keep it. It's the right mechanism for showing multiple syntaxes per property.
- The old stories (BoxBasic, FlexRow, GridStory, TailwindStory, HtmlCompatStory) still exist in git at commit `4bcc6e0`. You can restore them or use them as reference. They didn't have StyleDemo tooltips though, so they'll need those added.
- The `StorySection` type in `index.ts` currently allows: `'Core' | 'Packages' | 'Demos' | 'Stress Test' | 'Dev'`. You'll need to add the new compat section type.
- The storybook sidebar/nav renderer will need to handle the new section. Check `storybook/src/App.tsx` for how sections are rendered.
- StyleStory.tsx is 882 lines. Most of that content is good — it just needs to be carved up and rehomed into the right stories, not rewritten from scratch.
- After restructuring, Box should be the first item in Core (the first thing the storybook opens to). Not Style, and definitely not a Tailwind color grid.

## Carving Guide (what goes where from current StyleStory.tsx)

| Current StyleStory Section | Move To |
|---|---|
| 1. Background Color (the basic demo, not the tw grid) | Box story |
| 1. Background Color (the 12-row Tailwind color families grid) | Compat > Tailwind |
| 2. Gradients | Style story |
| 3. Spacing (padding, gap, margin) | Layout story |
| 4. Flex Layout (direction, justify, align, wrap) | Layout story |
| 5. Sizing (width/height, fill/grow, aspectRatio) | Layout story |
| 6. Typography (fontSize, fontWeight, decoration, spacing) | Text story |
| 7. Borders and Radius | Style story |
| 8. Shadows and Opacity | Style story (shadows also good for Box) |
| 9. Transforms | Style story |
| 10. Position and Overflow | Style story |
| 11. Responsive Grid | Grid story |
| 12. HTML Elements | Compat > HTML Elements |
| 13. Merge Precedence | Compat > Merge Precedence |
| 13. Spring transition demo | Style story (transitions section) |

## Tooltip Rules

- **Core pages:** Tooltips show `style={}`, shorthand props, theme tokens only. These are the framework's native syntaxes.
- **Compat pages:** Tooltips show `tw()`, `className`, HTML element mappings. This is where Tailwind syntax gets documented.
- **Every demo element must have a tooltip.** Zero naked demos. That was the original goal and it's a good one.
