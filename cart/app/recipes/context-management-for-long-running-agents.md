# Context Management for Long-Running Agents

Long-running agents accumulate context: user messages, tool outputs, model reasoning. Before any hard limit is reached, **context rot** sets in — recall quality drops as old material buries new material. This recipe covers three context strategies and which ones we can actually drive from our v8 bindings today.

The original recipe uses three Anthropic API features:

| Strategy | API surface | Status in our stack |
|---|---|---|
| **Compaction** — summarize and replace transcript | `compact_20260112` in `context_management.edits` | Not exposed. Claude Code has its own auto-compaction we don't currently configure. |
| **Tool-result clearing** — keep recent tool_result, drop older payloads | `clear_tool_uses_20250919` | Not exposed. |
| **Memory tool** — durable cross-session notes via filesystem | `memory_20250818` | We have the *filesystem* (cwd + Read/Edit/Write). The *tool name* is a Claude Code built-in (`Memory`-style behavior emerges from the cwd pattern). |

We drive Claude Code via `framework/claude_sdk/` over stream-json. The Messages API knobs above live one layer below that — we don't see them, we don't control them. So this recipe ends up half-aspirational: the *concepts* still apply, but the levers we have are different.

## What we can do today

- Use `cwd` as a memory store. Same as `build-agents-that-remember-your-users`: stash durable notes in `notes.md` and let Claude Read/Edit it.
- End a session and start a new one when context feels heavy. `__claude_close()` + a fresh `__claude_init` gives you a clean slate; carry forward any state via files.
- Trim our own user-message bloat before sending. We control everything to the left of `__claude_send` — strip stale tool outputs, compress prior transcript ourselves.

## What we can't do today

- Mid-session compaction triggered by token thresholds.
- Selective tool-result clearing while keeping tool_use records.
- Server-side context-management telemetry (`applied_edits`, `cleared_input_tokens`).

These need either (a) bypassing Claude Code and calling the Messages API directly from a new Zig binding, or (b) plumbing Claude Code's own `/clear` and `/compact` slash commands through `__claude_send`. Both are out of scope here; both are flagged in TODOs.

## Architecture

```text
.tsx cart  ── __claude_send ──>  framework/v8_bindings_sdk.zig
                                  │
                                  └─ framework/claude_sdk/Session
                                        └─ subprocess: `claude --input-format stream-json`
                                              └─ Claude Code's own context manager
                                                    (auto-compaction, /clear, /compact)
                                                    └─ Messages API
                                                          (compact_20260112, clear_tool_uses_20250919)
                                                                ↑
                                              not visible from the cart
```

## Strategy 1: cart-side memory via cwd

Use the same pattern as the shopper recipe — pin Claude to a `notes.md` file:

```typescript
const NOTES_INSTRUCTION = `You are a research analyst. Treat ./notes.md as your durable scratchpad.

At the start of every conversation:
1. Read ./notes.md if it exists.
2. When you reach a meaningful conclusion, append it to ./notes.md with a short header.
3. When something supersedes a prior note, Edit the relevant section in place.

Keep entries short, dated when relevant, and skimmable.`;
```

Send this in front of every turn. Across sessions you get something close to the original recipe's memory tool — the "tool" is just Claude Code's built-in Edit/Write on a known file.

```typescript
const host: any = globalThis;
const claude_init  = typeof host.__claude_init  === 'function' ? host.__claude_init  : (_a:string,_b:string,_c?:string)=>0;
const claude_send  = typeof host.__claude_send  === 'function' ? host.__claude_send  : (_:string)=>0;
const claude_poll  = typeof host.__claude_poll  === 'function' ? host.__claude_poll  : ()=>null;
const claude_close = typeof host.__claude_close === 'function' ? host.__claude_close : ()=>{};
```

## Strategy 2: cart-driven session reset

When a turn is wrapping up and you want to start fresh on the next user message, drop the session and re-init:

```typescript
function resetSession(cwd: string, model: string) {
  claude_close();
  claude_init(cwd, model);
}
```

This is the closest analog we have to compaction: the *new* session has zero conversation history. Anything important must already be in `notes.md` or wherever you stashed it. Effectively, your durable state is what's on disk.

The original recipe's compaction *preserves* the conversation by replacing it with a summary. We can mimic that one of two ways:

```typescript
// (a) Ask Claude to summarize before we close.
async function summarizeAndClose(cwd: string): Promise<void> {
  await askOnce(cwd, model,
    "Before we wrap, write a 5-bullet summary of what you've learned this " +
    "session into ./notes.md under a new dated heading. Then say 'done'.");
  claude_close();
}
```

```typescript
// (b) The cart owns the summary. We accumulate assistant text turn by turn,
// keep a rolling summary string in JS state, and prepend it to the next session's
// first user message. No Claude involvement at boundary.
let runningSummary = '';
function nextPrompt(userMsg: string): string {
  return runningSummary
    ? `Prior context summary:\n${runningSummary}\n\nUser: ${userMsg}`
    : userMsg;
}
```

(b) is cheaper and predictable; (a) lets Claude pick what's worth keeping. Pick based on whether the session was research-heavy (favor a) or task-heavy (favor b).

## Strategy 3: trim our own user-message bloat

Anything we send via `__claude_send` is ours to shape. If the cart has been collecting prior turns into a transcript and re-feeding them, trim *before* sending — drop oldest tool outputs, keep recent assistant text and the user's question.

```typescript
interface CartTurn {
  role: 'user' | 'assistant';
  text: string;
  toolOutputs: Array<{ name: string; output: string }>;
  ts: number;
}

function trimForSend(history: CartTurn[], keepRecent = 4): string {
  const recent = history.slice(-keepRecent);
  const lines: string[] = [];
  for (const t of recent) {
    lines.push(`[${t.role}] ${t.text}`);
    for (const tool of t.toolOutputs) {
      lines.push(`  [tool ${tool.name}] ${tool.output.slice(0, 400)}`);
    }
  }
  return lines.join('\n');
}
```

This is the closest thing to "tool-result clearing" we have. We're managing what goes *into* the session, not what gets evicted *from* it. Claude Code on the other side has its own context manager that we just have to trust on hard limits.

## Observability

We don't get `applied_edits` or `cleared_input_tokens`. We do get this in `__claude_poll`'s `result` event:

```typescript
type ResultMsg = {
  type: 'result';
  subtype: string;
  session_id: string;
  result?: string;
  total_cost_usd: number;
  duration_ms: number;
  num_turns: number;
  is_error: boolean;
};
```

`num_turns` and `total_cost_usd` are your proxies for "is this session getting long / expensive." When they cross a threshold, reset.

## Caveats and TODOs against the v8 bindings

- **No `betas` plumbing.** `framework/claude_sdk/argv.zig:31` doesn't pass `--beta`-style flags through. The compaction / clearing recipes rely on `betas=["context-management-2025-06-27", "compact-2026-01-12"]` — those land on `client.beta.messages.create`, not Claude Code.
- **No mid-session context_management config.** The Messages API takes `context_management={"edits": [...]}` per request. Claude Code applies its own policy and doesn't expose configuration knobs to wrapped clients.
- **No slash-command path.** `framework/v8_bindings_sdk.zig:968` (`hostClaudeSend`) sends user text as-is. There's no API for `/clear` / `/compact`. If we ever add one, mid-session compaction becomes a one-liner from the cart.
- **No `cache_read_input_tokens` telemetry.** The original notebook tracks token trajectories with cached vs uncached input. Our `result` only carries `total_cost_usd` and `num_turns`. Add `usage` breakdown to `claudeMessageToJs` (`framework/v8_bindings_sdk.zig:277`) when this matters.

## Pattern summary

1. Treat `cwd` + a known notes file as your memory tool.
2. Reset the session (`__claude_close` + `__claude_init`) when `num_turns` or `total_cost_usd` crosses a threshold; carry state forward via files.
3. Optionally have Claude write a summary into `notes.md` *before* the close so the next session starts informed.
4. Trim cart-side history before `__claude_send` to control what enters the session in the first place.
5. Server-side compaction and clearing happen inside Claude Code; treat them as opaque until we plumb the Messages API or slash commands.

This recipe is a half-port. Part 2 (`context-management-on-a-200k-token-window`) covers the same trade-offs on a tighter context window — same gaps apply, same workarounds work.
