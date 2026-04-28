import type { RecipeDocument } from "./recipe-document";

export const recipe: RecipeDocument = {
  slug: "giving-claude-a-crop-tool-for-better-image-analysis",
  title: "Giving Claude a Crop Tool for Better Image Analysis",
  sourcePath:
    "cart/app/recipes/giving-claude-a-crop-tool-for-better-image-analysis.md",
  instructions:
    "Let Claude zoom into images by driving framework/v8_bindings_sdk.zig's __claude_* globals: stage the image to a workspace dir, send a prompt that instructs Read+Bash crops via PIL, and drain assistant/tool_use/result events from __claude_poll().",
  sections: [
    {
      kind: "paragraph",
      text:
        "Claude sees the entire image at once. For tasks that need fine detail — close bar values, small text, dense diagrams — that's limiting. In our stack we don't define a custom crop_image tool over MCP; we drive Claude Code as a subprocess and lean on built-in Read + Bash. Claude reads the source PNG, shells out to python3+PIL (or ImageMagick) to write a cropped file, then reads that file.",
    },
    {
      kind: "bullet-list",
      title: "When a crop tool helps",
      items: [
        "Charts and graphs: comparing close values, reading axis labels and legends.",
        "Documents: reading small text, examining signatures or stamps.",
        "Technical diagrams: tracing wires, reading component labels.",
        "Dense images: any frame where details are small relative to the whole.",
      ],
    },
    {
      kind: "code-block",
      title: "Architecture in this repo",
      language: "text",
      code: `.tsx cart  ── globals ──>  framework/v8_bindings_sdk.zig
                            │
                            └─ framework/claude_sdk/Session
                                  └─ subprocess: \`claude --input-format stream-json\``,
    },
    {
      kind: "code-block",
      title: "The four globals exposed by v8_bindings_sdk",
      language: "typescript",
      code: `declare global {
  // Returns true if the session was created (or already exists).
  function __claude_init(cwd: string, model?: string, resumeSession?: string): boolean;

  // Queue a user turn. Returns true if queued.
  function __claude_send(text: string): boolean;

  // Drain at most one parsed event from the subprocess. Returns undefined if
  // nothing is ready. Call once per frame from the GUI loop.
  function __claude_poll(): ClaudeMessage | undefined;

  // Tear the session down. Idempotent.
  function __claude_close(): void;
}`,
    },
    {
      kind: "bullet-list",
      title: "What hostClaudeInit hardcodes (framework/v8_bindings_sdk.zig:932)",
      items: [
        "permission_mode = bypass_permissions — no prompts, all tools auto-approved.",
        "verbose = true, inherit_stderr = true.",
        "allowed_tools is NOT plumbed through yet — the session inherits Claude Code's default toolset (Read, Bash, Edit, Glob, Grep, ...). Sandbox by choice of cwd.",
        "No system_prompt override from the cart. Anything system-prompty rides on the user message.",
      ],
    },
    {
      kind: "code-block",
      title: "Message shape returned from __claude_poll",
      language: "typescript",
      code: `type ClaudeMessage =
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

// Note: tool_use.input_json is a STRING, not pre-parsed. JSON.parse before destructuring.`,
    },
    {
      kind: "code-block",
      title: "Cart-side FFI shims (matches cart/sweatshop/index.tsx:4)",
      language: "typescript",
      code: `const host: any = globalThis;
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
  : () => {};`,
    },
    {
      kind: "code-block",
      title: "Stage the chart to disk so Claude can Read it",
      language: "typescript",
      code: `import { writeFile } from './host';

async function stageImage(workspace: string, pngBytes: Uint8Array): Promise<string> {
  const path = \`\${workspace}/chart.png\`;
  await writeFile(path, pngBytes);
  return path;
}`,
    },
    {
      kind: "code-block",
      title: "Build the prompt — coordinate convention lives here",
      language: "typescript",
      code: `function buildPrompt(question: string): string {
  return \`Answer the following question about ./chart.png.

Question: \${question}

How to inspect the image:
1. First, use Read on ./chart.png so you can see it.
2. If you need a closer look at a region, use Bash to write a cropped PNG, then Read the crop.

Crop with python3 + PIL using normalized 0-1 coordinates:

  python3 - <<'PY'
  from PIL import Image
  im = Image.open("chart.png")
  w, h = im.size
  x1, y1, x2, y2 = 0.0, 0.0, 0.4, 0.35   # legend region, top-left
  im.crop((int(x1*w), int(y1*h), int(x2*w), int(y2*h))).save("crop.png")
  PY

Then Read ./crop.png. Overwrite crop.png each time you zoom into a new region.

When you have an answer, state it clearly with a one-line conclusion.\`;
}`,
    },
    {
      kind: "bullet-list",
      title: "Why this prompt shape",
      items: [
        "Tells Claude exactly where the image is on disk.",
        "Hands over the PIL one-liner so it doesn't burn turns inventing crop syntax.",
        "Establishes the normalized 0-1 coordinate convention without any schema.",
        "Asks for a one-line conclusion so the cart UI has something definitive to render.",
      ],
    },
    {
      kind: "code-block",
      title: "Polling loop: drain __claude_poll on a 50ms tick",
      language: "typescript",
      code: `type Turn = {
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
}`,
    },
    {
      kind: "code-block",
      title: "Wiring it into a cart component",
      language: "tsx",
      code: `import { useEffect, useState } from 'react';
import { Box, Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';

export default function CropDemo({ workspace, chartPng, question }: Props) {
  const [turn, setTurn] = useState<Turn>({
    text: '', thinking: '', toolCalls: [], done: false, cost: 0,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        await stageImage(workspace, chartPng);
        cleanup = runTurn(workspace, 'claude-opus-4-6',
                          buildPrompt(question), setTurn);
      } catch (err) {
        setError(String(err));
      }
    })();
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
      {turn.done && <Text className="text-xs text-zinc-500">\${turn.cost.toFixed(4)}</Text>}
    </Col>
  );
}`,
    },
    {
      kind: "code-block",
      title: "What the run looks like in practice",
      language: "text",
      code: `Q: Is Cyan the minimum?

[Read] {"file_path":"chart.png"}
[Bash] {"command":"python3 - <<'PY'\\nfrom PIL import Image\\nim=Image.open('chart.png')\\nw,h=im.size\\nx1,y1,x2,y2=0.4,0.6,0.7,0.9\\nim.crop((int(x1*w),int(y1*h),int(x2*w),int(y2*h))).save('crop.png')\\nPY"}
[Read] {"file_path":"crop.png"}

Yes — Cyan is the smallest slice in the pie chart, well under the next-smallest Light Slate.

$0.0182`,
    },
    {
      kind: "bullet-list",
      title: "Caveats and TODOs against the current bindings",
      items: [
        "One session at a time. g_claude_session is module-level (framework/v8_bindings_sdk.zig:24); a second __claude_init while one is live no-ops and returns true — events would multiplex into the wrong cart.",
        "No allowed_tools from the cart yet. Sandbox by cwd today; add an opts struct to hostClaudeInit when this matters.",
        "No system_prompt override from the cart. Anything system-prompty rides on the user message.",
        "Image input is filesystem-only. No base64 image content blocks — Claude reads files. Always stage to cwd first.",
        "tool_use.input_json is an unparsed string. JSON.parse it before destructuring.",
      ],
    },
    {
      kind: "bullet-list",
      title: "Pattern summary",
      items: [
        "Stage the source image to a workspace dir.",
        "__claude_init(cwd, model) → start the subprocess.",
        "__claude_send(prompt) with the question + a 'use Read+Bash to crop, then Read the crop' instruction.",
        "Drain __claude_poll() from a 50ms tick; route assistant text/tool_use to UI, stop on result.",
        "__claude_close() when done.",
      ],
    },
  ],
};
