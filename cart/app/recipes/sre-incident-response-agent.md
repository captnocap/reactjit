# The SRE Incident Response Agent (ReactJIT port)

## What this is

The original Anthropic recipe builds an SRE agent in Python with the `claude-agent-sdk`, talking to an external MCP tool server. We are adapting it to ReactJIT, where:

- **No MCP.** Everything runs inside the same cart process.
- **No Python.** Zig drives the `claude` CLI subprocess via `framework/claude_sdk/`.
- **No external tool server.** Claude Code's built-in tools (`Bash`, `Read`, `Edit`, `Grep`, `Glob`) are scoped via `allowed_tools` and confined by the session's `cwd`.
- **No notebook loop.** The cart drives the agent with `__claude_init` / `__claude_send` / `__claude_poll`, polled once per frame from the React reconciler.

The SRE incident pattern (investigate → diagnose → remediate → write post-mortem) is preserved. The plumbing changes.

## Mapping the original recipe onto ReactJIT

| Anthropic recipe | ReactJIT equivalent |
|---|---|
| `claude-agent-sdk` (Python) | `framework/claude_sdk/` (Zig, stream-json subprocess) |
| `query()` async generator | `Session.poll()` non-blocking, called per frame |
| `ClaudeAgentOptions` | `claude_sdk.SessionOptions` (`framework/claude_sdk/options.zig`) |
| `mcp_servers={...}` | **Dropped.** Built-in tools only, scoped by `allowed_tools` |
| `allowed_tools=["mcp__sre__..."]` | `allowed_tools = &.{ "Bash", "Read", "Edit", "Grep" }` |
| `permission_mode="acceptEdits"` | `permission_mode = .accept_edits` |
| `system_prompt="..."` | `system_prompt = "..."` (same name, same role) |
| `model="claude-opus-4-6"` | `model = "claude-opus-4-6"` |
| PreToolUse hooks | Not implemented in this SDK yet — gap, see §Gaps |
| Python notebook driver | Cart `index.tsx` polling loop |
| Anthropic Python SDK message types | `claude_sdk.Message` union: `system` / `assistant` / `user` / `result` |
| `AssistantMessage.content[]` blocks | `ContentBlock` union: `text` / `thinking` / `tool_use` |

## What sits where in this repo

- `framework/claude_sdk/mod.zig` — public surface: `Session`, `SessionOptions`, `Message`, `ContentBlock`, `OwnedMessage`, `PermissionMode`.
- `framework/claude_sdk/session.zig` — `init()` spawns `claude --input-format stream-json --output-format stream-json --verbose`. `send()` writes a user-turn NDJSON line to stdin. `poll()` does a non-blocking `posix.read` from the O_NONBLOCK stdout, drains complete JSON lines through the parser, returns one `OwnedMessage` per call (or `null` if no line is ready).
- `framework/claude_sdk/options.zig` — the typed config. The fields the SRE recipe needs are already there: `system_prompt`, `allowed_tools`, `disallowed_tools`, `permission_mode`, `model`, `max_turns`, `cwd`, `add_dirs`.
- `framework/claude_sdk/argv.zig` — translates options to CLI flags: `--system-prompt`, `--allowedTools`, `--permission-mode`, `--dangerously-skip-permissions`, `--max-turns`, `--resume`, `--add-dir`. The `--mcp-config` flag is **not** wired (MCP was deferred).
- `framework/claude_sdk/types.zig` — `Message`, `ContentBlock` (text / thinking / tool_use), `Usage`, `ResultMsg` with cost and duration.
- `framework/v8_bindings_sdk.zig` — exposes the session to JS as four host functions: `__claude_init(cwd, model?, resumeId?)`, `__claude_send(text)`, `__claude_poll() → message | undefined`, `__claude_close()`. There is exactly one `g_claude_session` global; the bridge is single-session.
- `cart/cockpit/index.tsx` and `cart/sweatshop/index.tsx` — existing carts that drive the polling pattern. Copy from them.

## Step 0: pick a workspace cwd

The agent's filesystem reach is bounded by `cwd`. For the SRE recipe, point it at a workspace that contains the things you want it to inspect and edit — typically a clone of your infrastructure repo or, for the demo, a `~/sre-workspace` with a `config/` directory and a `docker-compose.yml`.

```text
~/sre-workspace/
├── config/
│   ├── api-server.env        # contains DB_POOL_SIZE
│   └── docker-compose.yml
├── services/
│   └── api_server.py
└── scripts/
    └── traffic_generator.py
```

This is the Zig session's `cwd`. Anything outside it is reachable only via `add_dirs`.

## Step 1: scope the tools

Drop MCP. Use the four built-in Claude Code tools the SRE workflow actually needs:

- `Bash` — shell out to `curl http://localhost:9090/api/v1/query?...` for Prometheus, `docker-compose logs ...`, `docker-compose up -d api-server` for redeploys.
- `Read` — read `config/api-server.env`, `config/docker-compose.yml`, log files.
- `Edit` — apply config changes (e.g. `DB_POOL_SIZE=1` → `DB_POOL_SIZE=20`).
- `Grep` — scan logs for error patterns.

That is the entire tool surface. No `Write` (creates new files), no `WebFetch`, no MCP.

```zig
const allowed: []const []const u8 = &.{ "Bash", "Read", "Edit", "Grep" };
const disallowed: []const []const u8 = &.{ "Write", "WebFetch", "WebSearch" };
```

## Step 2: write the system prompt

Same shape as the original. The cart pattern is one prompt, no skills.

```zig
const SYSTEM_PROMPT =
    \\You are an SRE incident response bot.
    \\
    \\Investigation methodology:
    \\1. Probe service health (curl Prometheus's /api/v1/query for error rate, latency, db_connections_active).
    \\2. Drill into error rates per service.
    \\3. Check latency — high latency often precedes errors.
    \\4. Inspect resources — DB connections, CPU, memory.
    \\5. docker-compose logs for the suspect container.
    \\6. Read config files for misconfigurations.
    \\7. Correlate symptoms to root cause.
    \\
    \\Baseline noise: the api-server has ~0.1–0.2 errors/sec normally. Focus on significant spikes.
    \\Be thorough but efficient. Always explain your reasoning.
;
```

Investigation methodology lives in the system prompt. Tool descriptions for `Bash` / `Read` / `Edit` are the CLI's built-in ones — we don't need to author them.

## Step 3: drive a session from Zig

For a one-shot binary (e.g. a flight-check tool, or the dev-shell sub-command), call `claude_sdk.Session` directly. Same shape as `cart/sweatshop` but without the React polling — a tight `while (try sess.poll()) |*owned|` loop.

```zig
const std = @import("std");
const claude_sdk = @import("framework/claude_sdk/mod.zig");

pub fn runIncident(allocator: std.mem.Allocator) !void {
    var sess = try claude_sdk.Session.init(allocator, .{
        .cwd = "/home/you/sre-workspace",
        .model = "claude-opus-4-6",
        .system_prompt = SYSTEM_PROMPT,
        .allowed_tools = &.{ "Bash", "Read", "Edit", "Grep" },
        .disallowed_tools = &.{ "Write", "WebFetch", "WebSearch" },
        .permission_mode = .accept_edits,
        .verbose = true,
        .inherit_stderr = true,
    });
    defer sess.deinit();

    try sess.send(
        \\Reports of API errors and timeouts. Investigate thoroughly:
        \\- service health and error rates (Prometheus on localhost:9090)
        \\- DB connections and latency
        \\- container logs for errors
        \\- config files for misconfigurations
        \\Identify the root cause. Do NOT apply any fixes yet.
    );

    while (true) {
        var maybe_msg = try sess.poll();
        if (maybe_msg == null) {
            std.time.sleep(50 * std.time.ns_per_ms);
            continue;
        }
        var owned = maybe_msg.?;
        defer owned.deinit();

        switch (owned.msg) {
            .assistant => |a| for (a.content) |block| switch (block) {
                .text => |t| std.debug.print("\n{s}\n", .{t.text}),
                .tool_use => |tu| std.debug.print("\n[Tool] {s}\n", .{tu.name}),
                .thinking => {},
            },
            .result => |r| {
                std.debug.print(
                    "\n[done] turns={d} cost=${d:.4} {d}ms\n",
                    .{ r.num_turns, r.total_cost_usd, r.duration_ms },
                );
                return;
            },
            else => {},
        }
    }
}
```

A second `sess.send(...)` after the result message kicks off the remediation phase — same session, no re-init.

## Step 4: drive a session from a cart

Carts don't open a `claude_sdk.Session` directly; they go through the four host functions in `framework/v8_bindings_sdk.zig`. Pattern lifted from `cart/cockpit/index.tsx`.

```tsx
const claude_init  = (host as any).__claude_init  as (cwd: string, model?: string, resumeId?: string) => boolean;
const claude_send  = (host as any).__claude_send  as (text: string) => boolean;
const claude_poll  = (host as any).__claude_poll  as () => null | ClaudeMessage;
const claude_close = (host as any).__claude_close as () => void;

type ClaudeMessage =
  | { type: "system";    session_id: string; tools?: string[] }
  | { type: "assistant"; content: ContentBlock[] }
  | { type: "user";      content_json: string }
  | { type: "result";    is_error: boolean; total_cost_usd: number; num_turns: number };

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; id: string; name: string; input_json: string };

function SreCart() {
  const [log, setLog] = useState<string[]>([]);
  const initedRef = useRef(false);

  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;
    claude_init("/home/you/sre-workspace", "claude-opus-4-6");
    return () => claude_close();
  }, []);

  useFrame(() => {
    let drained = 0;
    while (drained++ < 8) {
      const msg = claude_poll();
      if (!msg) break;
      if (msg.type === "assistant") {
        for (const block of msg.content) {
          if (block.type === "text") setLog(l => [...l, block.text]);
          if (block.type === "tool_use") setLog(l => [...l, `[${block.name}]`]);
        }
      } else if (msg.type === "result") {
        setLog(l => [...l, `done — $${msg.total_cost_usd.toFixed(4)}, ${msg.num_turns} turns`]);
      }
    }
  });

  return (
    <Col>
      <Pressable onPress={() => claude_send(INCIDENT_PROMPT)}>
        <Text>Investigate</Text>
      </Pressable>
      <ScrollView>
        {log.map((line, i) => <Text key={i}>{line}</Text>)}
      </ScrollView>
    </Col>
  );
}
```

`useFrame` is a per-frame hook (cart code uses `setInterval` or the frame-effect primitive depending on cart). Eight events drained per frame keeps the loop responsive without starving the React reconciler. For a real cart, batch the `setLog` updates so streaming text doesn't trigger one reconcile per token.

The `system_prompt` and `allowed_tools` are not yet exposed through the JS bridge — see §Gaps.

## Step 5: the incident — DB pool exhaustion

The fault model from the original recipe transfers verbatim. From a shell, edit `config/api-server.env` to set `DB_POOL_SIZE=1`, then `docker-compose -f config/docker-compose.yml up -d api-server`. Within ~30 seconds Prometheus shows the spike.

Then send the agent the investigation prompt:

```text
We're getting reports of API errors and timeouts.
Something is wrong with the api-server. Investigate thoroughly:
- check service health and error rates via Prometheus on localhost:9090
- look at DB connections and latency
- check container logs for errors
- look at the config files for any misconfigurations
- identify the root cause

Report your findings but do NOT apply any fixes yet.
```

The agent will autonomously chain `Bash` (curl Prometheus), `Bash` (docker-compose logs), `Read` (`config/api-server.env`), and explain the chain that leads to `DB_POOL_SIZE=1`.

## Step 6: remediate

Same session, second `send()`:

```text
Based on your investigation, the root cause is DB_POOL_SIZE=1 in config/api-server.env.
1. Edit config/api-server.env to set DB_POOL_SIZE back to 20
2. Redeploy with docker-compose
3. Wait, then verify with another Prometheus query
4. Append a short post-mortem to postmortems/<timestamp>.md describing what happened, the root cause, and the fix.
```

`permission_mode = .accept_edits` lets the `Edit` tool fire without an interactive prompt. Without it, the CLI would ask the user to confirm — fine for an interactive cart, fatal for a headless run.

## Gaps in `framework/claude_sdk/` relative to the original recipe

These are deliberate omissions to keep MCP out, but they are also real gaps if/when we want to push the recipe further:

1. **No PreToolUse hooks.** The Python recipe blocks unsafe `DB_POOL_SIZE` values via a shell hook. We'd need to add a `hooks` field to `SessionOptions` and emit `--settings <json>` in `argv.zig`. Today the only guardrails are `cwd`, `allowed_tools`, and `disallowed_tools`.
2. **Single-session JS bridge.** `framework/v8_bindings_sdk.zig` keeps one `g_claude_session`. Two simultaneous incident agents would require a session map.
3. **No `system_prompt` / `allowed_tools` over the bridge.** `__claude_init` only takes `cwd` / `model` / `resumeId`. To match the recipe from a cart we either (a) extend `__claude_init` to accept the full `SessionOptions`, or (b) drive sessions from Zig and surface an FFI for cart UIs that's higher-level than raw poll.
4. **Tool input is opaque on the JS side.** `ToolUseBlock.input_json` is the raw JSON string; the cart has to `JSON.parse` it. Acceptable, but a parsed shape would be friendlier.
5. **No structured "tool result back to model" path from cart code.** The agent's `Bash` / `Read` / `Edit` already round-trip through the CLI, so for the SRE flow this is fine. It only matters if we want to add custom in-cart tools later — at which point we'd resurrect a slim, in-process tool dispatch (still no MCP, just a callback registry the parser hands `tool_use` blocks to before the next turn).

These are all small wires. The runtime pass we promised in the original handoff is where they get filled in.

## What to take from this

- The original SRE recipe is a 12-tool MCP contraption because Python didn't give it built-ins; ours doesn't need that — Claude Code already ships `Bash`/`Read`/`Edit`/`Grep`, and they are enough for the SRE loop.
- Safety = `cwd` + `allowed_tools` + `disallowed_tools` + `permission_mode`, all already in `framework/claude_sdk/options.zig`.
- The agentic loop = `Session.poll()` per frame from the cart, exactly the existing `cart/cockpit` pattern.
- Investigation methodology lives in the system prompt; tool descriptions don't need to be rewritten because we're using the built-ins.

Next pass: extend the JS bridge and `SessionOptions` so a cart can declare the full SRE configuration without dropping to Zig.
