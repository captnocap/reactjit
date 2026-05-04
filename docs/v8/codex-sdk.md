# Codex SDK Pipeline (V8 Runtime)

The Codex path in this repository is currently a Zig-native SDK for
`codex app-server --listen stdio://`, plus a worker-event normalization layer.
Unlike Claude and local llama.cpp chat, there is no public V8 hook and no
registered `__codex_*` host function today.

That boundary matters:

- `framework/codex_sdk.zig` can spawn and speak JSON-RPC to the Codex app
  server.
- `framework/worker_contract.zig` can ingest Codex app-server notifications and
  normalize them into backend-agnostic worker/session events.
- `cart/app/gallery/data/codex-raw-event.ts` documents a separate
  OpenAI-compatible SSE shape used by the gallery adapter model, not the native
  app-server SDK.
- `v8_app.zig` and `framework/v8_bindings_sdk.zig` do not expose Codex to JS
  yet.

## Current Public Surface

There is no TS import equivalent to:

```ts
import { useCodexChat } from '@reactjit/runtime/hooks/useCodexChat';
```

and no registered host functions such as:

```ts
__codex_init(...);
__codex_send(...);
__codex_poll(...);
__codex_close(...);
```

The current usable API is native Zig:

```zig
const codex_sdk = @import("codex_sdk.zig");

var codex = try codex_sdk.Codex.init(allocator, .{
    .cwd = "/home/me/project",
});
defer codex.deinit();

var thread = try codex.threadStart(.{
    .model = "gpt-5.4",
});
defer thread.deinit();

var result = try thread.run(.{
    .text = "Say hello in one sentence.",
}, .{});
defer result.deinit();

if (result.final_response) |text| {
    std.debug.print("{s}\n", .{text});
}
```

## Native Types

### `AppServerConfig`

Configuration for the app-server child process:

```zig
pub const AppServerConfig = struct {
    codex_bin: ?[]const u8 = null,          // default "codex"
    launch_args_override: ?[]const []const u8 = null,
    config_overrides: []const []const u8 = &.{},
    cwd: ?[]const u8 = null,
    client_name: []const u8 = "reactjit_codex_sdk",
    client_title: []const u8 = "ReactJIT Codex SDK",
    client_version: []const u8 = VERSION,
    experimental_api: bool = true,
    inherit_stderr: bool = true,
    max_line_bytes: usize = 8 * 1024 * 1024,
};
```

Default spawn command:

```text
codex app-server --listen stdio://
```

When `config_overrides` is non-empty, each entry becomes:

```text
--config <entry>
```

When `launch_args_override` is set, it replaces the whole argv.

### Thread Options

`ThreadStartOptions`, `ThreadResumeOptions`, and `ThreadForkOptions` cover the
thread-level app-server knobs:

```zig
approval_policy: ?[]const u8
approvals_reviewer: ?[]const u8
base_instructions: ?[]const u8
config_json: ?[]const u8
cwd: ?[]const u8
developer_instructions: ?[]const u8
ephemeral: ?bool
model: ?[]const u8
model_provider: ?[]const u8
personality: ?[]const u8
sandbox: ?[]const u8
service_tier: ?[]const u8
```

`ThreadResumeOptions` omits `ephemeral`. `ThreadForkOptions` omits
`personality` but otherwise follows the same pattern.

`ThreadListOptions` supports:

```zig
archived: ?bool
cursor: ?[]const u8
cwd: ?[]const u8
limit: ?usize
model_providers: []const []const u8
search_term: ?[]const u8
sort_key: ?[]const u8
source_kinds: []const []const u8
```

### Turn Options

Per-turn options:

```zig
pub const TurnOptions = struct {
    approval_policy: ?[]const u8 = null,
    approvals_reviewer: ?[]const u8 = null,
    cwd: ?[]const u8 = null,
    effort: ?[]const u8 = null,
    model: ?[]const u8 = null,
    output_schema_json: ?[]const u8 = null,
    personality: ?[]const u8 = null,
    sandbox_policy_json: ?[]const u8 = null,
    service_tier: ?[]const u8 = null,
    summary: ?[]const u8 = null,
};
```

The SDK intentionally keeps structured request fields such as `config`,
`output_schema`, and `sandbox_policy` as raw JSON strings. That avoids baking
fast-moving app-server schemas into this repo.

### Input Items

Turn input is an array of app-server input items:

```zig
pub const InputItem = union(enum) {
    text: []const u8,
    image: []const u8,       // url
    local_image: []const u8, // filesystem path
    skill: NamedPath,
    mention: NamedPath,
};

pub const Input = union(enum) {
    text: []const u8,
    item: InputItem,
    items: []const InputItem,
};
```

Wire encoding:

```json
[
  { "type": "text", "text": "..." },
  { "type": "image", "url": "..." },
  { "type": "localImage", "path": "..." },
  { "type": "skill", "name": "...", "path": "..." },
  { "type": "mention", "name": "...", "path": "..." }
]
```

### Results And Notifications

`InitializeResponse` owns app-server metadata:

```zig
user_agent
server_name
server_version
platform_family?
platform_os?
```

`OwnedJson` wraps arbitrary JSON response values in an arena.

`Notification` wraps app-server notifications:

```zig
method: []const u8
params: std.json.Value
```

Convenience accessors on `Notification`:

```zig
deltaText()
turnId()
itemValue()
tokenUsageValue()
completedStatus()
completedErrorMessage()
```

`RunResult` is the high-level turn result:

```zig
turn_id: []const u8
status: ?[]const u8
error_message: ?[]const u8
final_response: ?[]const u8
items: []const ThreadItem
usage_json: ?[]const u8
```

`final_response` is derived from completed thread items. It prefers the last
`agentMessage` item whose `phase` is `final_answer`, and otherwise falls back to
the last assistant text the SDK can extract.

## End-To-End App-Server Pipeline

1. Native code creates `Codex`.

   `Codex.init(allocator, config)` creates `AppServerClient`, starts the child
   process, sends app-server initialization, and stores returned metadata.

2. `AppServerClient.start` spawns the child.

   Default argv:

   ```text
   codex app-server --listen stdio://
   ```

   With config overrides:

   ```text
   codex --config <entry> ... app-server --listen stdio://
   ```

   Child settings:

   - `cwd = config.cwd`
   - `stdin_behavior = .Pipe`
   - `stdout_behavior = .Pipe`
   - `stderr_behavior = .Inherit` when `inherit_stderr` is true

3. The client initializes the protocol.

   `initialize()` builds params:

   ```json
   {
     "clientInfo": {
       "name": "reactjit_codex_sdk",
       "title": "ReactJIT Codex SDK",
       "version": "0.1.0"
     },
     "capabilities": {
       "experimentalApi": true
     }
   }
   ```

   It sends a JSON-RPC request:

   ```json
   {"id":1,"method":"initialize","params":{...}}
   ```

   Then it sends the notification:

   ```json
   {"method":"initialized","params":{}}
   ```

4. Requests and notifications share one stdio stream.

   `requestJson(method, params_json)` writes one JSON-RPC envelope per line and
   then reads newline-delimited JSON messages until it finds the matching
   response id.

   While waiting, it may receive:

   - server notifications with `method` and no `id`; these are queued in
     `pending_notifications`
   - server requests with both `method` and `id`; these are answered by
     `respondToServerRequest`
   - unrelated responses; these are ignored

5. Approval requests are auto-accepted.

   `respondToServerRequest` answers known approval methods with:

   ```json
   {"decision":"accept"}
   ```

   Accepted methods:

   - any method ending in `/requestApproval`
   - `item/commandExecution/requestApproval`
   - `item/fileChange/requestApproval`

   Unknown server requests get `{}`.

6. Code starts or attaches a thread.

   The high-level `Codex` wrapper exposes:

   ```zig
   threadStart(options)       // thread/start
   threadResume(thread_id, options)
   threadFork(thread_id, options)
   threadUnarchive(thread_id)
   threadArchive(thread_id)
   threadList(options)
   models(include_hidden)     // model/list
   ```

   `threadStart`, `threadResume`, `threadFork`, and `threadUnarchive` parse
   `result.thread.id` and return a `Thread`.

7. Code starts a turn.

   `Thread.turn(input, options)` sends:

   ```text
   turn/start
   ```

   with:

   ```json
   {
     "threadId": "...",
     "input": [ ... ],
     "...turn options...": "..."
   }
   ```

   It parses `result.turn.id` and returns a `TurnHandle`.

8. Code consumes turn notifications.

   `TurnHandle.next()` enforces one consumer per turn by calling
   `AppServerClient.acquireTurnConsumer(turn_id)`. A second consumer for a
   different turn gets `error.ConcurrentTurnConsumer`.

   It then drains notifications with `client.nextNotification()`. When it sees
   a `turn/completed` notification for the handle's turn id, it marks the handle
   completed and releases the consumer.

9. `Thread.run` collects a complete turn.

   `Thread.run(input, options)` is a convenience wrapper:

   ```zig
   var handle = try thread.turn(input, options);
   defer handle.deinit();
   return handle.run();
   ```

   `TurnHandle.run()` loops over `next()` until completion and collects:

   - completed items from `item/completed`
   - token usage from `thread/tokenUsageUpdated`
   - final status and error text from `turn/completed`

   It then builds `RunResult`.

10. Interrupt and steer are available natively.

   `TurnHandle.interrupt()` sends:

   ```text
   turn/interrupt
   ```

   with `threadId` and `turnId`.

   `TurnHandle.steer(input)` sends:

   ```text
   turn/steer
   ```

   with `threadId`, `expectedTurnId`, and a new input item array.

## Notification Methods

The SDK and worker normalizer explicitly understand these app-server
notification methods:

```text
turn/started
item/agentMessage/delta
reasoning/textDelta
reasoning/summaryTextDelta
item/completed
thread/tokenUsageUpdated
turn/completed
item/commandExecution/outputDelta
item/fileChange/outputDelta
mcpToolCall/progress
```

Unknown methods are preserved as raw events by the worker contract.

## Worker Contract Pipeline

`framework/worker_contract.zig` is the normalization layer for multi-backend
agent panes. It is not a V8 host binding by itself, but it is the shape Codex
notifications are intended to feed.

Core backend enum:

```zig
pub const Backend = enum {
    claude_code,
    codex_app_server,
    kimi_cli_wire,
};
```

Core event kinds:

```zig
lifecycle
context_switch
status
user_message
assistant_message
reasoning
tool_call
tool_output
usage
completion
error_
raw
```

`WorkerStore.bindCodexThread(thread_id, model, reason_started)` creates or
updates the active `.codex_app_server` session. It stores the app-server thread
id on the session.

`WorkerStore.ingestCodexNotification(notification)` maps Codex notifications to
normalized events:

- `turn/started` -> `lifecycle`, phase `turn_started`
- `item/agentMessage/delta` -> `assistant_message`, phase `delta`
- `reasoning/textDelta` and `reasoning/summaryTextDelta` -> `reasoning`
- `item/completed` -> normalized item event
- `thread/tokenUsageUpdated` -> `usage`
- `turn/completed` -> `completion` or `error_`
- command/file/MCP progress -> `tool_output`
- unknown methods -> `raw`

Completed item normalization:

- `agentMessage` -> `assistant_message`, or `reasoning` when phase contains
  `"reason"`
- `message` -> `user_message`, `assistant_message`, or tool/internal based on
  role, with text joined from `output_text`, `input_text`, or `text` blocks
- `commandExecution`, `fileChange`, `mcpToolCall` -> `tool_output`
- unknown item types -> `raw`

Usage extraction expects app-server token fields:

```text
tokenUsage.inputTokens
tokenUsage.outputTokens
tokenUsage.cacheCreationInputTokens
tokenUsage.cacheReadInputTokens
```

The resulting `WorkerSnapshot` and `TranscriptEntry` types are backend-agnostic,
so UI code can render a worker timeline without knowing whether the source was
Claude Code, Codex app-server, or Kimi wire.

## Gallery Raw Event Model

`cart/app/gallery/data/codex-raw-event.ts` documents an OpenAI-compatible SSE
stream shape:

```ts
type CodexRawEvent = CodexChunk | { done: true };
```

That shape is different from `framework/codex_sdk.zig`:

- Gallery `CodexRawEvent` models HTTP SSE `chat.completion.chunk` frames.
- Native `codex_sdk.zig` models JSON-RPC app-server messages over stdio.

The gallery adapter is still useful design context. It shows why the worker
contract needs incremental `assistant_part` / `assistant_message` events and
why tool-call arguments may need accumulation before they are valid JSON. But
it is not the current native app-server wire format.

## Build And V8 Status

There is no `has-codex` build flag, no SDK registry trigger for Codex, and no
`registerCodex` ingredient in `v8_app.zig`.

Current status:

- `framework/codex_sdk.zig` is Zig-native and can be imported by other Zig
  modules.
- `framework/worker_contract.zig` imports `codex_sdk.zig` and has tests that
  normalize synthetic Codex notifications.
- No runtime hook under `runtime/hooks/` exposes Codex.
- No `framework/v8_bindings_codex.zig` exists.
- `framework/v8_bindings_sdk.zig` registers Claude, Kimi, local AI, HTTP,
  browser-page, IPC, media, and semantic-tree bindings, but not Codex.

To expose this to carts, the missing layer would be a V8 binding and TS hook
that decide:

- one global app-server client or one per cart/session
- how to surface `thread/start`, `turn/start`, `turn/steer`, and
  `turn/interrupt`
- whether to return raw app-server notifications, normalized `WorkerEvent`
  records, or a `useClaudeChat`-style `{ phase, streaming, ask }` facade
- how to handle approval requests instead of auto-accepting everything
- what build gate should own the `codex` CLI dependency

## Important Constraints

- The app-server transport is blocking line reads, unlike the Claude SDK's
  non-blocking polling. It is suitable for native worker threads or synchronous
  native calls, but a V8 binding would need to avoid blocking the render thread.
- Approval requests are currently auto-accepted in native code.
- `AppServerClient` allows one active turn notification consumer at a time.
- `OwnedJson`, `Notification`, and `RunResult` use arena ownership. Call
  `deinit()` when done.
- Large app-server lines are capped by `AppServerConfig.max_line_bytes`, default
  8 MiB.
- `launch_args_override` replaces the full app-server command; callers become
  responsible for including `app-server --listen stdio://`.
- The SDK does not search PATH itself beyond letting `std.process.Child` execute
  `codex` through the platform. `codex_bin` defaults to the literal `"codex"`.

## Related Files

- `framework/codex_sdk.zig`
- `framework/worker_contract.zig`
- `cart/app/gallery/data/codex-raw-event.ts`
- `cart/app/gallery/data/event-adapter.ts`
- `cart/app/gallery/data/worker-event.ts`
- `cart/app/gallery/data/worker-session.ts`
- `cart/app/gallery/data/worker.ts`
- `cart/app/docs/10-current-substrate.md`
- `runtime/hooks/README.md`
