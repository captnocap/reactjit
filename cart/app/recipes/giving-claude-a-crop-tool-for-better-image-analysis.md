Giving Claude a Crop Tool for Better Image Analysis

When Claude analyzes images, it sees the entire image at once. For detailed tasks — reading small text, comparing similar values in a chart, examining fine details — that's limiting.

The fix: let Claude "zoom in" by cropping regions of interest. In our stack we don't define a custom `crop_image` tool over MCP. We drive Claude Code as a subprocess and lean on the built-in `Read` + `Bash` tools. Claude reads the source image, shells out to `python3` + PIL (or `convert`) to write a cropped PNG, then reads that file.

## When is a crop tool useful?

- Charts and graphs: comparing bars/lines that are close in value, reading axis labels.
- Documents: reading small text, examining signatures or stamps.
- Technical diagrams: tracing wires, reading component labels.
- Dense images: any image where details are small relative to the whole.

## Architecture (this repo)

```text
.tsx cart  ── globals ──>  framework/v8_bindings_sdk.zig
                            │
                            └─ framework/claude_sdk/Session
                                  └─ subprocess: `claude --input-format stream-json`
```

The cart speaks to V8 globals only. The bindings own one `g_claude_session` (single global session) and convert each stream-json message into a plain JS object.

## The four globals

`framework/v8_bindings_sdk.zig` exposes:

```typescript
declare global {
  // Returns true if the session was created (or already exists).
  function __claude_init(cwd: string, model?: string, resumeSession?: string): boolean;

  // Queue a user turn. Returns true if queued.
  function __claude_send(text: string): boolean;

  // Drain at most one parsed event from the subprocess. Returns undefined if
  // nothing is ready. Call once per frame from the GUI loop.
  function __claude_poll(): ClaudeMessage | undefined;

  // Tear the session down. Idempotent.
  function __claude_close(): void;
}
```

Hardcoded defaults inside `hostClaudeInit` (`framework/v8_bindings_sdk.zig:932`):

- `permission_mode = bypass_permissions` — no prompts, all tools auto-approved.
- `verbose = true`, `inherit_stderr = true`.
- `allowed_tools` is **not** plumbed through yet. The session inherits Claude Code's default tool set (Read, Bash, Edit, Glob, Grep, etc.). For now you sandbox by choice of `cwd`, not by tool whitelisting.

## Message shape from `__claude_poll`

```typescript
type ClaudeMessage =
  | { type: 'system'; session_id: string; model?: string; cwd?: string; tools: string[] }
  | {
      type: 'assistant';
      id?: string; session_id?: string; stop_reason?: string;
      input_tokens: number; output_tokens: number;
      content: Array<
        | { type: 'text'; text: string }
        | { type: 'thinking'; thinking: string }
        | { type: 'tool_use'; id: string; name: string; input_json: string }
      >;
      text?: string;        // joined text blocks for convenience
      thinking?: string;    // joined thinking blocks
    }
  | { type: 'user'; session_id?: string; content_json: string }
  | {
      type: 'result';
      subtype: string; session_id: string; result?: string;
      total_cost_usd: number; duration_ms: number;
      num_turns: number; is_error: boolean;
    };
```

Note `tool_use.input_json` is a **string** — the bindings don't pre-parse tool input. Use `JSON.parse` if you need fields.

## Cart-side FFI shims

Match the canonical pattern from `cart/sweatshop/index.tsx:4`:

```typescript
const host: any = globalThis;
const claude_init  = typeof host.__claude_init  === 'function'
  ? host.__claude_init
  : (_a: string, _b: string, _c?: string) => 0;
const claude_send  = typeof host.__claude_send  === 'function'
  ? host.__claude_send
  : (_: string) => 0;
const claude_poll  = typeof host.__claude_poll  === 'function'
  ? host.__claude_poll
  : () => null;
const claude_close = typeof host.__claude_close === 'function'
  ? host.__claude_close
  : () => {};
```

The fallbacks let the cart compile and run under a host that hasn't wired the bindings (e.g. the dev playground without a real `claude` binary on PATH).

## Stage the chart on disk

Claude needs a file path it can `Read`. Use `runtime/host` writeFile (or your local equivalent) to drop the source PNG into a workspace directory; then init the session with that directory as cwd:

```typescript
import { writeFile } from './host';

async function stageImage(workspace: string, pngBytes: Uint8Array): Promise<string> {
  const path = `${workspace}/chart.png`;
  await writeFile(path, pngBytes);
  return path;
}
```

## Build the prompt

Coordinate convention is prompt-side, not tool-side — there's no schema to validate. Spell it out clearly:

```typescript
function buildPrompt(question: string): string {
  return `Answer the following question about ./chart.png.

Question: ${question}

How to inspect the image:
1. First, use Read on ./chart.png so you can see it.
2. If you need a closer look at a region, use Bash to write a cropped PNG, then Read the crop.

Crop with python3 + PIL. Use normalized 0-1 coordinates so you don't have to know the source dims:

  python3 - <<'PY'
  from PIL import Image
  im = Image.open("chart.png")
  w, h = im.size
  x1, y1, x2, y2 = 0.0, 0.0, 0.4, 0.35   # legend region, top-left
  im.crop((int(x1*w), int(y1*h), int(x2*w), int(y2*h))).save("crop.png")
  PY

Then Read ./crop.png. Overwrite crop.png each time you zoom into a new region.

When you have an answer, state it clearly with a one-line conclusion.`;
}
```

Three things this prompt does:

1. Tells Claude where the image is.
2. Hands over the exact crop one-liner so it doesn't burn turns inventing PIL syntax.
3. Sets a normalized coordinate convention without any schema enforcement.

## The polling loop

Drive `__claude_poll()` from a `setInterval` (or `requestAnimationFrame` if your host has one). For each event, route by `type`:

```typescript
type Turn = {
  text: string;
  thinking: string;
  toolCalls: Array<{ name: string; input: unknown }>;
  done: boolean;
  cost: number;
};

function runTurn(workspace: string, model: string, prompt: string,
                 onUpdate: (t: Turn) => void): () => void {
  if (!claude_init(workspace, model)) {
    onUpdate({ text: '[error] failed to start session', thinking: '',
               toolCalls: [], done: true, cost: 0 });
    return () => {};
  }
  if (!claude_send(prompt)) {
    onUpdate({ text: '[error] failed to send', thinking: '',
               toolCalls: [], done: true, cost: 0 });
    claude_close();
    return () => {};
  }

  const turn: Turn = { text: '', thinking: '', toolCalls: [], done: false, cost: 0 };
  const handle = setInterval(() => {
    const msg = claude_poll();
    if (!msg) return;

    if (msg.type === 'assistant') {
      if (msg.text) turn.text += msg.text;
      if (msg.thinking) turn.thinking += msg.thinking;
      for (const block of msg.content ?? []) {
        if (block.type === 'tool_use') {
          let parsed: unknown = block.input_json;
          try { parsed = JSON.parse(block.input_json); } catch {}
          turn.toolCalls.push({ name: block.name, input: parsed });
        }
      }
      onUpdate({ ...turn });
    } else if (msg.type === 'result') {
      turn.done = true;
      turn.cost = msg.total_cost_usd ?? 0;
      onUpdate({ ...turn });
      clearInterval(handle);
      claude_close();
    }
    // 'system' and 'user' events: ignore for this recipe.
  }, 50);

  return () => { clearInterval(handle); claude_close(); };
}
```

Why `setInterval` and not blocking: `__claude_poll` is non-blocking by design (`framework/claude_sdk/mod.zig:1`). A 50ms tick keeps the UI responsive without flooding the bindings.

## Putting it together in a cart

```tsx
import { useEffect, useState } from 'react';
import { Box, Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';

export default function CropDemo({ workspace, chartPng, question }: Props) {
  const [turn, setTurn] = useState<Turn>({
    text: '', thinking: '', toolCalls: [], done: false, cost: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    try {
      await stageImage(workspace, chartPng);
      const stop = runTurn(workspace, 'claude-opus-4-6',
                           buildPrompt(question), setTurn);
      return stop;
    } catch (err) {
      setError(String(err));
      return () => {};
    }
  };

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    start().then(stop => { cleanup = stop; });
    return () => { cleanup?.(); };
  }, []);

  return (
    <Col className="p-4 gap-3">
      <Text className="font-semibold">Q: {question}</Text>
      {error && <Text className="text-red-400">{error}</Text>}
      {turn.toolCalls.map((t, i) => (
        <Box key={i} className="px-2 py-1 bg-zinc-900 rounded">
          <Text className="text-xs text-cyan-300">[{t.name}] {JSON.stringify(t.input)}</Text>
        </Box>
      ))}
      <Text>{turn.text}</Text>
      {turn.done && <Text className="text-xs text-zinc-500">${turn.cost.toFixed(4)}</Text>}
    </Col>
  );
}
```

## Demo: chart analysis

Feed it a FigureQA-style question against a stored chart:

```text
Q: Is Cyan the minimum?

[Read] {"file_path":"chart.png"}
[Bash] {"command":"python3 - <<'PY'\nfrom PIL import Image\nim=Image.open('chart.png')\nw,h=im.size\nx1,y1,x2,y2=0.4,0.6,0.7,0.9\nim.crop((int(x1*w),int(y1*h),int(x2*w),int(y2*h))).save('crop.png')\nPY"}
[Read] {"file_path":"crop.png"}

Yes — Cyan is the smallest slice in the pie chart, well under the next-smallest Light Slate.

$0.0182
```

Each `[name]` line is a `tool_use` event surfaced from `__claude_poll`. The text body is the joined `assistant.text` from successive turns.

## Caveats and TODOs

- **One session at a time.** `g_claude_session` is a module-level global in the bindings (`framework/v8_bindings_sdk.zig:24`). A second `__claude_init` while one is live no-ops and returns true; you'll multiplex the wrong cart's events.
- **No `allowed_tools` from the cart.** Today the session inherits the default Claude Code toolset. Sandbox by choosing a cwd you're comfortable with the agent rooting around in. Add an opts struct to `hostClaudeInit` when this matters.
- **No system-prompt override from the cart.** Anything system-prompty has to ride on the user message.
- **Image input is via filesystem only.** No base64 image content blocks — Claude reads files. Always stage to `cwd` first.
- **Tool input is a JSON string.** `tool_use.input_json` is unparsed. `JSON.parse` it before destructuring.

## Pattern summary

1. Stage the source image to a workspace dir.
2. `__claude_init(cwd, model)` → start the subprocess.
3. `__claude_send(prompt)` with the question + a "use Read+Bash to crop, then Read the crop" instruction.
4. Drain `__claude_poll()` from a 50ms tick; route `assistant` text/tool_use to UI, stop on `result`.
5. `__claude_close()` when done.

This works because Claude can see the full image first, identify regions that need closer inspection, and iteratively zoom in — all using built-ins, no custom tool registration, no MCP.
