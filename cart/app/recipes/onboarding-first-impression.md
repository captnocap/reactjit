# Onboarding first-impression — clarify, then write

A 2-turn recipe that takes the cart/app onboarding hand-off and
produces a `first_impression.md` profile the cart loads as the
user's welcome state.

## Inputs

The 5-step onboarding (`cart/app/onboarding/`) carries forward
three fields:

- `name` (step 1)
- `traits` (step 3 personality multi-select)
- `goal` (step 5 first-goal text)

Step 2 picks the provider and step 4 picks the working
directory. The first-impression recipe spawns against the model
chosen in step 2 (V8 / Claude / local — for now we test the
Claude path).

## The two turns

**Turn 1 — clarify (chat-loom Form).** The model receives the
3 onboarding fields and a system-prompt instruction to emit a
chat-loom UI tree (see `cart/chat-loom.tsx` for the canonical
tagset reference) — specifically a single `<Form>` with three
`<Field>`s named `q1` / `q2` / `q3` and a `<Submit>` whose
`reply` template is `"A1: {q1}\nA2: {q2}\nA3: {q3}"`. The cart
parses with `runtime/intent/parser.parseIntent`, renders with
`runtime/intent/render.RenderIntent`, and the user answers all
three at once. On submit, the interpolated reply string ("A1:
... / A2: ... / A3: ...") becomes the user-turn message of
turn 2 — no custom Q&A surface to design, the model decides
the labels and placeholders.

**Turn 2 — write.** With the interpolated answers in hand, the
model calls `Write` once to produce
`<config_dir>/first_impression.md`. The cart's `useIFTTT` hook
on `system:claude:write` for that filename swaps the
onboarding shell out and the welcome surface in.

## Why two turns and not one (and not three)

A 4-variant probe was run twice against a fixed onboarding
sample. The harness lives at `/tmp/first_impressions/run.py`;
it drives `bench/claude_runner` (a standalone Zig binary
around `framework/claude_sdk/`) one session per spawn.

| variant | shape | run-1 / run-2 cost | reproducibility |
| --- | --- | --- | --- |
| V1 raw | one shot | $0.10 / $0.10 | Stable, solid baseline |
| V2 enhance-once | enhancer rewrites prompt → end model | $0.10 / $0.11 | High variance — fabricated a dollar range in one run, fine in another |
| **V3 clarify-loop** | ask 3 questions, then write | **$0.11 / $0.11** | **Stable, best output** |
| V4 clarify + enhance every input | enhance every user turn | $0.13 / $0.20 | Stable cold/clinical voice; **unstable cost** (1.5–2×) |

V3 was the only variant that **reproducibly** produced a
meta-observation about the user — noticing that Maya answered
logistical questions with feelings, working-style, and values
rather than the literal data the questions asked for. That
observation only emerges because there is something to
observe: actual answers given to actual questions.

V1 is a fine baseline; V3 is meaningfully better for the same
order of magnitude in cost. V2 is high-variance and not
worth the second spawn unless input is genuinely thin
(Maya's wasn't). V4 is reliably the wrong shape *and*
reliably the most expensive — retired.

## What the .tsx stamp deposits

Drop `<OnboardingFirstImpression />` on the canvas and you get:

- **One source kind** — `src_onboarding-signal` bundles the
  step 1 + 3 + 5 fields. `refKind: "computed"` because the
  cart resolves it at turn-assembly time from
  `OnboardingProvider`.
- **One `who` composition** — pins the signal as identity
  context.
- **Two prompt fragments** — the turn-1 clarify instruction
  and the turn-2 write instruction.
- **One `prompt` composition** — system slot with
  `composer: "first-match"`, with the write fragment ahead of
  the clarify fragment so turn 2 wins when its inputs are
  present.
- **One event hook** — `system:claude:write` filtered to
  `first_impression.md`, emits
  `onboarding:first-impression-ready` and marks
  `onboarding:complete`.
- **Two arming recommendations** — `scope-collapse` at T1
  (don't lock onto a stereotype on the thin first read) and
  `premature-commitment` at T2 (don't skip the clarifying
  turn).

## Validation

Tested end-to-end against the live `claude` CLI through
`bench/claude_runner` (the Zig binary that wraps
`framework/claude_sdk/`). Two full runs of the harness against
the same fixed sample; both runs produced V3 outputs of
comparable size and shape, both containing the
"answered-sideways" meta-observation. The other three variants
were retained in the harness for documentation but not as
recipes.

The harness and the per-variant outputs are not checked in
(workspace lives at `/tmp/first_impressions_*`). To
reproduce: build `bench/claude_runner` via
`bench/build_claude_runner.sh`, then run
`python3 /tmp/first_impressions/run.py`.

**Caveat — chat-loom shape not yet end-to-end tested.** The
variance probe ran turn 1 with plain-text `Q1: / Q2: / Q3:`
output. The recipe's current turn-1 fragment asks for the
chat-loom Form wrapper instead — same logical clarify-loop,
just rendered as a real UI surface. The wrapper change should
not affect output quality (the model still asks 3 questions,
the user still answers, the same string format reaches turn
2), but a re-run of the harness in the chat-loom shape would
confirm it. Worth doing once the cart-side render path is
wired into the home shell.
