import type { RecipeDocument } from "./recipe-document";

export const recipe: RecipeDocument = {
  slug: "context-management-for-long-running-agents",
  title: "Context Management for Long-Running Agents",
  sourcePath: "cart/app/recipes/context-management-for-long-running-agents.md",
  instructions:
    "Manage context for long-running agents in our v8-bindings stack. The original recipe relies on Messages API features (compact_20260112, clear_tool_uses_20250919, memory_20250818) that we don't expose — Claude Code runs its own auto-compaction inside the subprocess. Levers we have: cwd-as-memory, cart-driven session reset, cart-side user-message trimming.",
  sections: [
    {
      kind: "paragraph",
      text:
        "Long-running agents accumulate context: user messages, tool outputs, model reasoning. Before any hard limit is reached, context rot sets in — recall quality drops. The original recipe uses three Messages API knobs (compaction, tool-result clearing, memory tool) that don't exist in our subprocess pathway. This recipe is half-aspirational: concepts apply, levers differ.",
    },
    {
      kind: "code-block",
      title: "Strategy availability matrix",
      language: "text",
      code: `Strategy             API surface                        Status in our stack
───────────────────  ─────────────────────────────────  ─────────────────────────────────
Compaction           compact_20260112                   not exposed; Claude Code auto-compacts
Tool-result clearing clear_tool_uses_20250919           not exposed
Memory tool          memory_20250818                    cwd + Read/Edit/Write is the analog`,
    },
    {
      kind: "bullet-list",
      title: "What we can do today",
      items: [
        "Use cwd as a memory store — same shape as the shopper recipe.",
        "End a session and start a new one with __claude_close() + __claude_init() when context feels heavy. Carry state forward via files.",
        "Trim our own user-message bloat before __claude_send. Everything to the left of the binding is ours to shape.",
      ],
    },
    {
      kind: "bullet-list",
      title: "What we can't do today",
      items: [
        "Mid-session compaction triggered by token thresholds.",
        "Selective tool-result clearing while preserving tool_use records.",
        "Server-side context-management telemetry (applied_edits, cleared_input_tokens).",
      ],
    },
    {
      kind: "code-block",
      title: "Architecture: where context management actually lives",
      language: "text",
      code: `.tsx cart  ── __claude_send ──>  framework/v8_bindings_sdk.zig
                                  │
                                  └─ framework/claude_sdk/Session
                                        └─ subprocess: \`claude --input-format stream-json\`
                                              └─ Claude Code's own context manager
                                                    (auto-compaction, /clear, /compact)
                                                    └─ Messages API
                                                          (compact_20260112, clear_tool_uses_20250919)
                                                                ↑
                                              not visible from the cart`,
    },
    {
      kind: "code-block",
      title: "Strategy 1: cart-side memory via cwd + notes.md",
      language: "typescript",
      code: `const NOTES_INSTRUCTION = \`You are a research analyst. Treat ./notes.md as your durable scratchpad.

At the start of every conversation:
1. Read ./notes.md if it exists.
2. When you reach a meaningful conclusion, append it to ./notes.md with a short header.
3. When something supersedes a prior note, Edit the relevant section in place.

Keep entries short, dated when relevant, and skimmable.\`;

const host: any = globalThis;
const claude_init  = typeof host.__claude_init  === 'function' ? host.__claude_init  : (_a:string,_b:string,_c?:string)=>0;
const claude_send  = typeof host.__claude_send  === 'function' ? host.__claude_send  : (_:string)=>0;
const claude_poll  = typeof host.__claude_poll  === 'function' ? host.__claude_poll  : ()=>null;
const claude_close = typeof host.__claude_close === 'function' ? host.__claude_close : ()=>{};`,
    },
    {
      kind: "code-block",
      title: "Strategy 2: cart-driven session reset",
      language: "typescript",
      code: `// Closest analog to compaction we have: drop the session, start fresh.
// The new session has zero conversation history. Anything important must
// already be in notes.md.

function resetSession(cwd: string, model: string) {
  claude_close();
  claude_init(cwd, model);
}`,
    },
    {
      kind: "code-block",
      title: "Strategy 2a: ask Claude to summarize before close",
      language: "typescript",
      code: `async function summarizeAndClose(cwd: string): Promise<void> {
  await askOnce(cwd, model,
    "Before we wrap, write a 5-bullet summary of what you've learned this " +
    "session into ./notes.md under a new dated heading. Then say 'done'.");
  claude_close();
}`,
    },
    {
      kind: "code-block",
      title: "Strategy 2b: cart owns the rolling summary",
      language: "typescript",
      code: `// Cheaper and predictable. We accumulate assistant text turn by turn,
// keep a rolling summary in JS state, prepend to next session's first user
// message. No Claude involvement at the boundary.

let runningSummary = '';

function nextPrompt(userMsg: string): string {
  return runningSummary
    ? \`Prior context summary:\\n\${runningSummary}\\n\\nUser: \${userMsg}\`
    : userMsg;
}`,
    },
    {
      kind: "code-block",
      title: "Strategy 3: trim user-message bloat in the cart",
      language: "typescript",
      code: `interface CartTurn {
  role: 'user' | 'assistant';
  text: string;
  toolOutputs: Array<{ name: string; output: string }>;
  ts: number;
}

// Closest thing to "tool-result clearing" we have. We control what goes
// into the session, not what gets evicted from it.
function trimForSend(history: CartTurn[], keepRecent = 4): string {
  const recent = history.slice(-keepRecent);
  const lines: string[] = [];
  for (const t of recent) {
    lines.push(\`[\${t.role}] \${t.text}\`);
    for (const tool of t.toolOutputs) {
      lines.push(\`  [tool \${tool.name}] \${tool.output.slice(0, 400)}\`);
    }
  }
  return lines.join('\\n');
}`,
    },
    {
      kind: "code-block",
      title: "Observability — what __claude_poll surfaces",
      language: "typescript",
      code: `type ResultMsg = {
  type: 'result';
  subtype: string;             // 'success' | 'error_max_turns' | etc.
  session_id: string;
  result?: string;
  total_cost_usd: number;
  duration_ms: number;
  num_turns: number;
  is_error: boolean;
};

// num_turns and total_cost_usd are our proxies for "session is getting long /
// expensive". Reset when they cross a workload-specific threshold.`,
    },
    {
      kind: "bullet-list",
      title: "Caveats and TODOs against the v8 bindings",
      items: [
        "No betas plumbing. framework/claude_sdk/argv.zig:31 doesn't pass --beta flags. compact_20260112 / clear_tool_uses_20250919 live on client.beta.messages.create — we don't call that.",
        "No mid-session context_management config. Messages API takes context_management.edits per request; Claude Code applies its own policy and hides the knobs.",
        "No slash-command path. framework/v8_bindings_sdk.zig:968 (hostClaudeSend) sends raw user text. If we route a leading '/' into Claude Code's slash-command surface, /clear and /compact become cart-driven primitives.",
        "No cache_read_input_tokens / cache_creation_input_tokens telemetry. Add to claudeMessageToJs (framework/v8_bindings_sdk.zig:277) when token-trajectory plots become useful.",
      ],
    },
    {
      kind: "bullet-list",
      title: "Pattern summary",
      items: [
        "Treat cwd + a known notes file as your memory tool.",
        "Reset (close + init) when num_turns or total_cost_usd crosses a threshold; carry state via files.",
        "Optionally have Claude write a summary into notes.md before close so the next session starts informed.",
        "Trim cart-side history before __claude_send to control what enters the session.",
        "Treat Claude Code's own auto-compaction as opaque until we plumb the Messages API or slash commands.",
      ],
    },
  ],
};
