// onboarding-first-impression
//
// Doc + stamp co-authored in one file. Turns the cart/app onboarding
// hand-off (name from step 1, traits from step 3, goal from step 5,
// model picked at step 2) into a 2-turn flow that produces a
// first_impression.md the cart loads as the user's welcome state.
//
// Shape: clarify-then-write. Turn 1, the model asks the user 3 short
// clarifying questions about their goal that the onboarding fields
// alone don't answer. Turn 2, with the answers in hand, it writes
// the profile.
//
// Why this shape, not one-shot or enhance-rewrite: a 4-variant probe
// (V1 raw / V2 enhance-once / V3 clarify-loop / V4 clarify+enhance,
// see the companion .md) ran the same fixed onboarding sample twice
// through `bench/claude_runner` (a Zig CLI around
// framework/claude_sdk). V3 was the only variant that reproducibly
// produced a meta-observation about HOW the user answered (the
// "answered sideways" insight). V1 was a solid baseline; V2 was
// high-variance and occasionally fabricated facts; V4 reliably
// laundered voice into a clinical report and was 1.5–2× the cost
// of V3.

import type { RecipeDocument } from "./recipe-document";
import {
  Action,
  Arming,
  Composition,
  CompositionSourceKind,
  EventHook,
  PromptFragment,
  Recipe,
  Slot,
  Source,
} from "./_stamp";

// ── The two-turn contract ─────────────────────────────────────────────────

const CLARIFY_INSTRUCTION = `You are about to write a first_impression.md profile of a new user, but first you need a little more signal than the bare onboarding gave you.

Before writing anything, ask the user 3 short clarifying questions about their goal and how they work — questions you genuinely cannot answer from the onboarding fields alone.

Output format on this turn ONLY:
Q1: ...
Q2: ...
Q3: ...

Do not write the profile yet. Do not call any tools yet. Just emit the three questions on three lines.`;

const WRITE_AFTER_CLARIFY_INSTRUCTION = `You now have onboarding context AND the user's answers to your clarifying questions. Write a markdown profile of this user using the Write tool, at the path the cart wired into your system prompt.

Cover:
- Who they seem to be (synthesizing onboarding + answers)
- Their goal restated charitably in your own words
- The 3 things you'd still want to learn next (NEW ones, not the ones you already asked)
- Where you would want to be careful — what assumptions might still be wrong
- An opening message you'd send them (2-3 sentences) when they first open the app

Use the Write tool exactly once. Be specific. Don't hedge. Sign the file '— Claude (first impression)'.`;

// ── Doc form ──────────────────────────────────────────────────────────────

export const recipe: RecipeDocument = {
  slug: "onboarding-first-impression",
  title: "Onboarding first-impression — clarify, then write",
  sourcePath: "cart/app/recipes/onboarding-first-impression.md",
  instructions:
    "After the 5-step onboarding lands (name, provider, traits, config, goal), spawn a 2-turn session against the model the user picked. Turn 1: ask 3 clarifying questions. Turn 2: write first_impression.md given the answers. The profile becomes the cart's welcome state.",
  sections: [
    {
      kind: "paragraph",
      text:
        "The onboarding has 5 steps but only 3 carry signal forward — name (step 1), traits (step 3), and goal (step 5). Steps 2 and 4 pick the model and the working directory. The first-impression recipe takes that signal and generates a personalized welcome by spawning the picked model twice: once to ask the user three short questions the onboarding fields cannot answer, then once again — with the answers in hand — to write a profile to disk that the cart reads on app entry.",
    },
    {
      kind: "bullet-list",
      title: "Why two turns instead of one",
      items: [
        "Empirically tested against a fixed onboarding sample twice (Maya, 6 traits, an ambitious goal). The clarify-loop reproducibly produced a meta-observation the one-shot variant missed: noticing that the user answered logistical questions with feelings, working-style, and values rather than the literal data the questions asked for.",
        "Single-shot prompts produce competent profiles but miss the texture you only get from interaction. A prompt-enhancer pass adds variance without consistent quality gain — and stacked enhancers (clarify + enhance every input) reliably launder voice into a clinical report.",
        "Two-turn cost is roughly the same as one-turn ($0.11 against Claude Sonnet 4.6 in our runs); the clarifying-question turn is small.",
      ],
    },
    {
      kind: "paragraph",
      title: "What's wired below",
      text:
        "The default JSX export stamps: a new src_onboarding-signal source kind that bundles step 1+3+5, a 'who' composition pinning the signal as identity context, two prompt fragments for turn-1-clarify and turn-2-write, a prompt composition whose system slot uses first-match to swap between the fragments based on whether answers are present, an event hook on system:claude:write for first_impression.md (the cart swaps from the onboarding shell to the welcome surface when it fires), and arming recommendations for two pathologies the recipe historically tripped: scope-collapse at T1 (locks onto a stereotype on the thin first read) and premature-commitment at T2 (the model wants to skip the clarifying turn).",
    },
  ],
};

// ── Stamp form ────────────────────────────────────────────────────────────

export default function OnboardingFirstImpression() {
  return (
    <Recipe slug="onboarding-first-impression">
      <PromptFragment
        id="frag_onboarding_clarify"
        label="Turn 1 — ask 3 clarifying questions"
        body={CLARIFY_INSTRUCTION}
      />

      <PromptFragment
        id="frag_onboarding_write"
        label="Turn 2 — write first_impression.md given the answers"
        body={WRITE_AFTER_CLARIFY_INSTRUCTION}
      />

      <CompositionSourceKind
        id="src_onboarding-signal"
        label="onboarding signal"
        description="Bundles the three carrying-fields from cart/app/onboarding state.jsx — name (step 1), traits (step 3), goal (step 5) — formatted for the system prompt. Resolved at turn-assembly time by reading the OnboardingProvider context."
        applicableTo={["who", "context"]}
        refKind="computed"
      />

      <Composition
        id="comp_first_impression_who"
        kind="who"
        label="Onboarding signal pinned as identity"
        description="Extends the default 'who' composition with the 3 onboarding fields the user just gave, formatted as Name / Traits / Goal. Drives turn-1 question selection and turn-2 synthesis."
        inheritsFrom="comp_who_default"
      >
        <Slot
          name="identity"
          composer="concat"
          maxTokens={400}
          emptyBehavior="omit"
        >
          <Source kind="src_onboarding-signal" weight={1.0} />
        </Slot>
      </Composition>

      <Composition
        id="comp_first_impression_prompt"
        kind="prompt"
        label="Two-turn clarify-then-write — system slot"
        description="System slot resolves at turn-assembly time. Turn 1 (no scripted answers yet on the wire) selects the clarify fragment. Turn 2 (answers present) selects the write fragment. first-match composer with the write fragment ahead of the clarify fragment so turn 2 wins when its inputs are present."
        inheritsFrom="comp_prompt_default"
      >
        <Slot name="system" composer="first-match" emptyBehavior="fail">
          <Source kind="src_prompt-fragment" ref="frag_onboarding_write" />
          <Source kind="src_prompt-fragment" ref="frag_onboarding_clarify" />
        </Slot>
      </Composition>

      <EventHook
        match="system:claude:write"
        filter={{ filePathEndsWith: "first_impression.md" }}
        label="First-impression ready — swap cart from onboarding to welcome"
      >
        <Action
          kind="emit-event"
          message="onboarding:first-impression-ready"
          spec={{ surface: "app-shell" }}
        />
        <Action
          kind="mark-status"
          message="onboarding:complete"
          spec={{ persist: true }}
        />
      </EventHook>

      <Arming
        pattern="scope-collapse"
        tier="T1"
        reason="The onboarding signal is thin (3 fields). Without arming, the model locks onto a stereotype reading on turn 1 and the clarifying questions become generic. T1 keeps the model widening the read until the answers come in."
      />
      <Arming
        pattern="premature-commitment"
        tier="T2"
        reason="The model wants to skip the clarifying turn and write immediately. T2 keeps the two-turn split intact so the meta-observation (how the user answered, not just what) makes it into the profile."
      />
    </Recipe>
  );
}
