# Context Management for Long-Running Agents (Part 2): On a 200K-token Window

Part 1 (`context-management-for-long-running-agents`) covered the three context strategies — compaction, tool-result clearing, memory — and the gap between the original Anthropic recipe (Messages API) and what our v8 bindings expose (Claude Code subprocess). Part 2 narrows the lens to a 200K-token window and asks: what changes when you can't comfortably overrun?

## The failure mode shifts

On a 1M model, context bloat shows up as **rot**: older facts get harder to retrieve, prefill cost grows, latency creeps up. The session keeps running.

On a 200K model, it shows up as a **hard stop**: the next request is rejected, the agent halts mid-task. There is no graceful degradation.

Our v8 bindings don't see either failure directly — both happen inside the `claude` subprocess. What we *do* see is the `result` event with `is_error: true` when something goes wrong:

```typescript
// framework/v8_bindings_sdk.zig:336
type ResultMsg = {
  type: 'result';
  subtype: string;       // 'success' | 'error_max_turns' | etc.
  session_id: string;
  result?: string;       // human-readable error if applicable
  total_cost_usd: number;
  duration_ms: number;
  num_turns: number;
  is_error: boolean;
};
```

`subtype` is the closest thing to a structured cause. Watch for it.

## Strategy: defensive resets before the wall

Without `context_management.edits` we can't trigger compaction on a token threshold. We can do the next-best thing: **reset the session before context grows past a turn budget we've measured for our workload.**

```typescript
const MAX_TURNS_BEFORE_RESET = 8;
const MAX_COST_BEFORE_RESET  = 0.50; // USD

let turnsThisSession = 0;
let costThisSession = 0;

function shouldReset(): boolean {
  return turnsThisSession >= MAX_TURNS_BEFORE_RESET
      || costThisSession   >= MAX_COST_BEFORE_RESET;
}

function onResult(msg: ResultMsg) {
  costThisSession = msg.total_cost_usd;
  turnsThisSession = msg.num_turns;
  if (shouldReset()) {
    askForSessionSummary().then(() => {
      claude_close();
      // Next user turn will __claude_init() fresh.
      turnsThisSession = 0;
      costThisSession  = 0;
    });
  }
}
```

The numbers are workload-specific. Run a few sessions with `MAX_TURNS_BEFORE_RESET = 999` and watch when `is_error: true` first appears. Set the threshold to ~70% of that.

## Strategy: cart-driven compaction at boundaries

Before resetting, ask Claude to compress the session into `notes.md`. This is the only "compaction" our stack supports today — Claude doing it explicitly via Edit/Write at our request, *outside* the Messages API.

```typescript
async function askForSessionSummary() {
  const prompt = `Before we wrap this session, write a compact summary into ./notes.md under a new dated heading.

Include:
- Key decisions and conclusions reached this session.
- Facts learned that we'll need next time (numbers, names, dates).
- Open threads that should be picked up later.

Be concise. Skip verbose tool outputs. Reply 'done' when the file is updated.`;
  await sendAndWait(prompt);
}
```

`sendAndWait` is the same `askOnce`-style helper from the knowledge-graph recipe — it sends one prompt, drains `__claude_poll` until the `result` event, returns.

Then on the next user turn, the cart prepends the summary on its own:

```typescript
import { readFile } from './host';

async function startNewSessionWithRecall(cwd: string, model: string, userMsg: string) {
  let summary = '';
  try { summary = await readFile(`${cwd}/notes.md`, 'utf8'); } catch {}
  const prompt = summary
    ? `Prior session notes:\n${summary}\n\nUser: ${userMsg}`
    : userMsg;
  claude_init(cwd, model);
  claude_send(prompt);
}
```

You're paying the prefill cost of the summary every fresh session. That's still cheaper than carrying the entire prior transcript.

## Strategy: trim user-message bloat ourselves

Same as Part 1, with a tighter discipline. Anything we send via `__claude_send` is ours to shape. On a 200K window, we can't afford to re-feed history defensively.

```typescript
interface CartTurn {
  role: 'user' | 'assistant';
  text: string;
  toolOutputs: Array<{ name: string; output: string }>;
}

function trimForSend(history: CartTurn[], keepRecent = 3, headBudget = 600): string {
  const recent = history.slice(-keepRecent);
  const lines: string[] = [];
  for (const t of recent) {
    lines.push(`[${t.role}] ${t.text}`);
    for (const tool of t.toolOutputs) {
      const head = tool.output.slice(0, headBudget);
      const truncated = tool.output.length > headBudget ? '… [truncated]' : '';
      lines.push(`  [tool ${tool.name}] ${head}${truncated}`);
    }
  }
  return lines.join('\n');
}
```

Three knobs: `keepRecent` (how many recent turns), `headBudget` (how much of each tool output survives), and your own threshold for re-sending history at all.

## Decision rubric on a 200K window

- **Skip cart-driven compaction** if the workload is single-question / single-answer; let each session live and die on one turn. Reset every time.
- **Skip the notes file** for sessions that must remain isolated (compliance, eval, sandboxing). Use a per-session tempdir.
- **Always** trim history before `__claude_send`. The cost-per-turn cliff hits hard near the limit.

## Strategy comparison

| Strategy | Lever in our stack | Cost | Best for |
|---|---|---|---|
| Cart-side reset | `__claude_close` + `__claude_init` | Re-init latency (~tens of ms) | Bounded-budget runs |
| Cart-side summary into `notes.md` | `__claude_send` "summarize and stop" | One extra Claude turn | Research that must continue |
| User-message trimming | Cart-side string slicing | Free | Every workload, always |
| Server-side compaction | (not exposed) | — | Out of scope until plumbed |
| Server-side tool-result clearing | (not exposed) | — | Out of scope until plumbed |

## Telemetry we have vs. what we want

| Telemetry | Available | Source |
|---|---|---|
| `num_turns` | yes | `result.num_turns` |
| `total_cost_usd` | yes | `result.total_cost_usd` |
| `duration_ms` | yes | `result.duration_ms` |
| `input_tokens` per turn | partial | `assistant.input_tokens` (final turn only) |
| `cache_read_input_tokens` | no | not in `claudeMessageToJs` (`framework/v8_bindings_sdk.zig:277`) |
| `cache_creation_input_tokens` | no | same |
| `applied_edits` (compaction) | no | server-side, hidden |
| `cleared_input_tokens` | no | server-side, hidden |

Plot whatever you have. Start with `num_turns` over wall-clock and watch where the bend happens before failure.

## Caveats and TODOs against the v8 bindings

- **No `betas` plumbing.** `framework/claude_sdk/argv.zig` doesn't pass `--beta` flags. Mid-session compaction (`compact_20260112`) and clearing (`clear_tool_uses_20250919`) live on `client.beta.messages.create`, which we don't call.
- **No slash-command path.** `framework/v8_bindings_sdk.zig:968` sends raw user text. If we route a leading `/` into Claude Code's slash-command surface, `/clear` and `/compact` become cart-driven primitives. Open a small ticket here when this is needed.
- **No usage breakdown beyond input/output.** Add `cache_read_input_tokens` and `cache_creation_input_tokens` to `claudeMessageToJs` so the cart can plot real token trajectories.
- **`subtype` enum drift.** `result.subtype` is a string — we don't enumerate values. Capture them as you see them and add typed handling for `error_max_turns`, `error_during_execution`, etc.

## Pattern summary

1. Pick a turn / cost budget below your observed wall.
2. On `result`, decide: continue, reset, or summarize-and-reset.
3. Summarize via `__claude_send`-driven Edit on `notes.md`; reload it as the prefix of the next session's first user message.
4. Trim cart-side history aggressively before sending — there's no server-side eviction to fall back on.
5. Treat Claude Code's own auto-compaction as opaque; instrument resets, not edits.

The 200K window doesn't change the strategies, only the urgency. Same levers as Part 1, applied earlier and more often.
