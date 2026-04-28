import type { RecipeDocument } from "./recipe-document";

export const recipe: RecipeDocument = {
  slug: "sre-incident-response-agent",
  title: "The SRE Incident Response Agent (ReactJIT port)",
  sourcePath: "cart/app/recipes/sre-incident-response-agent.md",
  instructions:
    "Adapt Anthropic's SRE incident response agent to ReactJIT — single in-process Zig session driving the claude CLI, no MCP, with built-in Bash/Read/Edit tools scoped by allowed_tools and the session's cwd.",
  sections: [
    {
      kind: "paragraph",
      title: "Premise",
      text:
        "The original recipe is a Python notebook talking to a 12-tool MCP server. We are dropping MCP. The agent runs in-process: framework/claude_sdk/ spawns one claude CLI subprocess in stream-json mode, the cart polls it once per frame via the four __claude_* host functions, and the agent acts through Claude Code's built-in tools (Bash, Read, Edit, Grep) confined to the session's cwd.",
    },
    {
      kind: "bullet-list",
      title: "What's preserved from the original",
      items: [
        "Workflow shape: investigate → diagnose → remediate → write post-mortem.",
        "Demo fault: misconfigured DB_POOL_SIZE causes connection-pool exhaustion.",
        "Separation of phases: read-only investigation first, writes only after confirmation.",
        "Safety lives at the tool boundary, not in prose instructions.",
      ],
    },
    {
      kind: "bullet-list",
      title: "What's dropped or replaced",
      items: [
        "MCP server subprocess — gone. Built-in Claude Code tools cover the entire SRE surface.",
        "Custom tool descriptions — gone. Bash/Read/Edit ship with their own.",
        "PreToolUse shell hooks — not yet wired in our SDK; flagged as a gap.",
        "Python claude-agent-sdk async loop — replaced by Session.poll() called per frame.",
      ],
    },
    {
      kind: "code-block",
      title: "Concept-to-code mapping",
      language: "text",
      code: `Anthropic recipe                        ReactJIT
─────────────────────────────────────   ─────────────────────────────────────────
claude-agent-sdk (Python)               framework/claude_sdk/ (Zig)
query() async generator                 claude_sdk.Session.poll() per frame
ClaudeAgentOptions                      claude_sdk.SessionOptions
mcp_servers={...}                       (dropped)
allowed_tools=["mcp__sre__..."]         allowed_tools = &.{ "Bash", "Read", "Edit", "Grep" }
permission_mode="acceptEdits"           permission_mode = .accept_edits
system_prompt / model                   same field names
PreToolUse hooks                        not yet wired (gap)
Python notebook driver                  cart index.tsx with __claude_init/_send/_poll
AssistantMessage.content[]              ContentBlock union: text | thinking | tool_use`,
    },
    {
      kind: "bullet-list",
      title: "What lives where in the repo",
      items: [
        "framework/claude_sdk/mod.zig — public surface (Session, SessionOptions, Message, ContentBlock, OwnedMessage, PermissionMode).",
        "framework/claude_sdk/session.zig — non-blocking subprocess; init() / send() / interrupt() / poll() / close() / deinit().",
        "framework/claude_sdk/options.zig — typed config: cwd, model, system_prompt, allowed_tools, disallowed_tools, permission_mode, max_turns, resume_session, add_dirs.",
        "framework/claude_sdk/argv.zig — emits CLI flags. --mcp-config is intentionally absent.",
        "framework/claude_sdk/types.zig — Message union (system | assistant | user | result), ContentBlock variants, Usage, ResultMsg with cost/duration.",
        "framework/v8_bindings_sdk.zig — JS bridge: __claude_init(cwd, model?, resumeId?), __claude_send(text), __claude_poll(), __claude_close(). Single global session.",
        "cart/cockpit/index.tsx and cart/sweatshop/index.tsx — existing carts that already drive this pattern. Copy from them.",
      ],
    },
    {
      kind: "code-block",
      title: "Step 0: workspace layout (the agent's cwd)",
      language: "text",
      code: `~/sre-workspace/
├── config/
│   ├── api-server.env        # contains DB_POOL_SIZE
│   └── docker-compose.yml
├── services/
│   └── api_server.py
└── scripts/
    └── traffic_generator.py`,
    },
    {
      kind: "paragraph",
      text:
        "The agent's filesystem reach is bounded by SessionOptions.cwd. Anything outside is reachable only via add_dirs. This is the first line of defense — pick the directory carefully.",
    },
    {
      kind: "code-block",
      title: "Step 1: scope the tools",
      language: "text",
      code: `// Zig (framework/claude_sdk/options.zig fields)
const allowed:    []const []const u8 = &.{ "Bash", "Read", "Edit", "Grep" };
const disallowed: []const []const u8 = &.{ "Write", "WebFetch", "WebSearch" };`,
    },
    {
      kind: "bullet-list",
      title: "Why these four tools cover the SRE loop",
      items: [
        "Bash: curl Prometheus (http://localhost:9090/api/v1/query), docker-compose logs, docker-compose up -d <svc>.",
        "Read: config/api-server.env, config/docker-compose.yml, app log files.",
        "Edit: change DB_POOL_SIZE=1 → DB_POOL_SIZE=20 in api-server.env.",
        "Grep: scan logs for error patterns the agent forms hypotheses about.",
        "No Write means the agent cannot create new files — useful guardrail; post-mortems get appended to an existing file.",
      ],
    },
    {
      kind: "code-block",
      title: "Step 2: SRE system prompt",
      language: "text",
      code: `// Zig multi-line literal — passed verbatim as opts.system_prompt.
const SYSTEM_PROMPT =
    \\\\You are an SRE incident response bot.
    \\\\
    \\\\Investigation methodology:
    \\\\1. Probe service health (curl Prometheus's /api/v1/query for error rate, latency, db_connections_active).
    \\\\2. Drill into error rates per service.
    \\\\3. Check latency — high latency often precedes errors.
    \\\\4. Inspect resources — DB connections, CPU, memory.
    \\\\5. docker-compose logs for the suspect container.
    \\\\6. Read config files for misconfigurations.
    \\\\7. Correlate symptoms to root cause.
    \\\\
    \\\\Baseline noise: api-server has ~0.1–0.2 errors/sec normally. Focus on significant spikes.
    \\\\Be thorough but efficient. Always explain your reasoning.
;`,
    },
    {
      kind: "code-block",
      title: "Step 3: drive a session from Zig",
      language: "text",
      code: `// One-shot Zig driver — for a flight-check binary or a dev-shell sub-command.
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
        \\\\Reports of API errors and timeouts. Investigate thoroughly:
        \\\\- service health and error rates (Prometheus on localhost:9090)
        \\\\- DB connections and latency
        \\\\- container logs for errors
        \\\\- config files for misconfigurations
        \\\\Identify the root cause. Do NOT apply any fixes yet.
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
                .text => |t| std.debug.print("\\n{s}\\n", .{t.text}),
                .tool_use => |tu| std.debug.print("\\n[Tool] {s}\\n", .{tu.name}),
                .thinking => {},
            },
            .result => |r| {
                std.debug.print("\\n[done] turns={d} cost=\${d:.4} {d}ms\\n",
                    .{ r.num_turns, r.total_cost_usd, r.duration_ms });
                return;
            },
            else => {},
        }
    }
}`,
    },
    {
      kind: "paragraph",
      text:
        "Investigation is one send(). Remediation is a second send() on the same session — no re-init, the conversation continues.",
    },
    {
      kind: "code-block",
      title: "Step 4: drive a session from a cart",
      language: "tsx",
      code: `// Mirrors cart/cockpit/index.tsx and cart/sweatshop/index.tsx.
const claude_init  = (host as any).__claude_init  as (cwd: string, model?: string, resumeId?: string) => boolean;
const claude_send  = (host as any).__claude_send  as (text: string) => boolean;
const claude_poll  = (host as any).__claude_poll  as () => null | ClaudeMessage;
const claude_close = (host as any).__claude_close as () => void;

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; id: string; name: string; input_json: string };

type ClaudeMessage =
  | { type: "system";    session_id: string; tools?: string[] }
  | { type: "assistant"; content: ContentBlock[] }
  | { type: "user";      content_json: string }
  | { type: "result";    is_error: boolean; total_cost_usd: number; num_turns: number };

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
          if (block.type === "tool_use") setLog(l => [...l, \`[\${block.name}]\`]);
        }
      } else if (msg.type === "result") {
        setLog(l => [...l, \`done — $\${msg.total_cost_usd.toFixed(4)}, \${msg.num_turns} turns\`]);
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
}`,
    },
    {
      kind: "bullet-list",
      title: "Cart-side notes",
      items: [
        "useFrame is whatever per-frame primitive the cart uses (setInterval, the frame-effect hook, etc.). Polling drains up to ~8 events/frame; tune for streaming responsiveness vs reconcile cost.",
        "Batch setLog updates if streaming text triggers one reconcile per token.",
        "system_prompt and allowed_tools are NOT yet exposed by __claude_init — the JS bridge only takes (cwd, model?, resumeId?). For full SRE config from a cart today, drive Zig directly. See Gaps.",
      ],
    },
    {
      kind: "code-block",
      title: "Step 5: trigger the incident from a shell",
      language: "bash",
      code: `# Inject the fault.
sed -i 's/DB_POOL_SIZE=20/DB_POOL_SIZE=1/' ~/sre-workspace/config/api-server.env
docker-compose -f ~/sre-workspace/config/docker-compose.yml up -d api-server

# Wait ~30s for Prometheus to scrape and for the spike to register.
# Confirm at http://localhost:9090 :
#   rate(http_requests_total{status="500"}[1m])`,
    },
    {
      kind: "code-block",
      title: "Step 6: investigation prompt (read-only)",
      language: "text",
      code: `We're getting reports of API errors and timeouts.
Something is wrong with the api-server. Investigate thoroughly:
- check service health and error rates via Prometheus on localhost:9090
- look at DB connections and latency
- check container logs for errors
- look at the config files for any misconfigurations
- identify the root cause

Report your findings but do NOT apply any fixes yet.`,
    },
    {
      kind: "paragraph",
      text:
        "Expect the agent to chain Bash (curl Prometheus), Bash (docker-compose logs api-server), Read (config/api-server.env), and explain that DB_POOL_SIZE=1 is the misconfiguration causing pool exhaustion.",
    },
    {
      kind: "code-block",
      title: "Step 7: remediation prompt (writes)",
      language: "text",
      code: `Based on your investigation, the root cause is DB_POOL_SIZE=1 in config/api-server.env.
1. Edit config/api-server.env to set DB_POOL_SIZE back to 20
2. Redeploy with docker-compose
3. Wait, then verify with another Prometheus query
4. Append a short post-mortem to postmortems/<timestamp>.md describing what happened, the root cause, and the fix.`,
    },
    {
      kind: "paragraph",
      text:
        "permission_mode = .accept_edits keeps the Edit tool from prompting interactively. Without it the CLI would block waiting for human approval — fine in cockpit/sweatshop, fatal in a headless run.",
    },
    {
      kind: "bullet-list",
      title: "Gaps in framework/claude_sdk/ relative to the original recipe",
      items: [
        "No PreToolUse hooks. SessionOptions has no hooks field; argv.zig emits no --settings flag. Today the only guardrails are cwd, allowed_tools, disallowed_tools.",
        "Single-session JS bridge. v8_bindings_sdk.zig holds one g_claude_session global. Two simultaneous incident agents need a session map.",
        "__claude_init takes only (cwd, model?, resumeId?). To set system_prompt or allowed_tools from a cart, extend the bridge or drive Zig directly.",
        "ToolUseBlock.input_json is opaque on the JS side — cart code calls JSON.parse to inspect arguments.",
        "No in-process custom tools. We don't need them for the SRE flow (built-ins suffice). If we add them later, do it as a callback registry the parser hands tool_use blocks to before the next turn — still no MCP.",
      ],
    },
    {
      kind: "bullet-list",
      title: "What to take from this",
      items: [
        "MCP was a workaround for missing built-ins. We have Bash/Read/Edit/Grep — they cover the SRE workflow without a tool server.",
        "Safety = cwd + allowed_tools + disallowed_tools + permission_mode, all already in framework/claude_sdk/options.zig.",
        "The agentic loop is the per-frame poll(), exactly the pattern in cart/cockpit and cart/sweatshop.",
        "Investigation methodology lives in the system prompt. Tool descriptions are inherited from the CLI.",
        "Next pass: extend the JS bridge so a cart can declare the full SRE configuration without dropping to Zig.",
      ],
    },
  ],
};
