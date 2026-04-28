# Build agents that remember your users

Most agents start every conversation from scratch. A customer tells your shopping assistant their size, budget, and which materials they avoid, and the next time they return, the agent has forgotten everything.

The original Anthropic recipe solves this with the **Claude Managed Agents** beta — a cloud-hosted runtime where you create a `memory_store`, attach it to a `session`, and the agent reads/writes through `/mnt/memory/{store}`. We don't have that. `framework/claude_sdk/` drives the local `claude` CLI. The closest analog: **the session's `cwd` is the memory store.** Claude Code already has Read/Edit/Write/Glob, and a directory persists between session inits.

This recipe rebuilds the shopping-assistant pattern around that reality.

## What you'll build

- A per-customer workspace directory that holds preference notes.
- A first-visit turn that captures preferences into `preferences.md`.
- A second-visit turn that re-uses the same directory and recalls them.
- A read-only path for your app code to inspect or seed the file.

## Architecture

```text
.tsx cart  ── globals ──>  framework/v8_bindings_sdk.zig
                            │
                            └─ framework/claude_sdk/Session  (cwd = workspace/<customer-id>/)
                                  └─ subprocess: `claude --input-format stream-json`

workspace/
└── <customer-id>/
    ├── preferences.md       ← Claude reads/edits this
    └── purchase-history.md  ← optionally seeded by your app
```

Every customer gets their own directory. That directory is the memory store.

## Per-customer workspace

```typescript
import { writeFile, mkdir } from './host';

async function workspaceFor(customerId: string): Promise<string> {
  const dir = `${WORKSPACE_ROOT}/${customerId}`;
  await mkdir(dir, { recursive: true });
  return dir;
}
```

Pick a stable id from your app's user model. Don't reuse the same dir across customers — Claude will conflate preferences.

## The memory contract

Pin Claude to one filename and one shape so the file stays useful across visits:

```typescript
export const MEMORY_INSTRUCTION = `You are a personal shopping assistant.

This workspace holds one customer's preferences. Treat it as long-term memory.

At the start of every conversation:
1. Read ./preferences.md if it exists. If not, that's fine.
2. Use whatever you find to tailor recommendations.

Whenever you learn something durable about the customer (size, materials,
brands they like or hate, budget, style words they use), update
./preferences.md with the new fact. Use Edit, not Write — preserve existing
sections.

The file is plain markdown with these sections (create them lazily):

  # Sizes
  # Style
  # Budget
  # Materials to avoid
  # Favorite brands
  # Other notes

Keep entries short and dated when relevant.`;
```

This instruction goes in front of every user turn (no `system_prompt` slot from the cart yet — see TODOs).

## First visit: capture

```typescript
const host: any = globalThis;
const claude_init  = typeof host.__claude_init  === 'function'
  ? host.__claude_init  : (_a: string, _b: string, _c?: string) => 0;
const claude_send  = typeof host.__claude_send  === 'function'
  ? host.__claude_send  : (_: string) => 0;
const claude_poll  = typeof host.__claude_poll  === 'function'
  ? host.__claude_poll  : () => null;
const claude_close = typeof host.__claude_close === 'function'
  ? host.__claude_close : () => {};

function askShopper(cwd: string, userMsg: string,
                    onUpdate: (text: string, done: boolean) => void): () => void {
  if (!claude_init(cwd, 'claude-sonnet-4-6')) {
    onUpdate('[error] failed to start session', true);
    return () => {};
  }
  const prompt = `${MEMORY_INSTRUCTION}\n\nCustomer: ${userMsg}`;
  if (!claude_send(prompt)) {
    claude_close();
    onUpdate('[error] failed to send', true);
    return () => {};
  }

  let text = '';
  const handle = setInterval(() => {
    const msg = claude_poll();
    if (!msg) return;
    if (msg.type === 'assistant' && msg.text) {
      text += msg.text;
      onUpdate(text, false);
    } else if (msg.type === 'result') {
      onUpdate(text, true);
      clearInterval(handle);
      claude_close();
    }
  }, 50);

  return () => { clearInterval(handle); claude_close(); };
}
```

Run a first turn:

```typescript
const cwd = await workspaceFor('cust_42');
askShopper(
  cwd,
  "Hi! I'm looking for a new jacket. I wear a size medium, only buy vegan " +
  "leather (no animal leather please), my budget is usually under $200, and " +
  "I love earth tones. What would you suggest?",
  (text, done) => render(text, done),
);
```

Expected behavior:
1. Claude calls `Read({"file_path":"./preferences.md"})` — file doesn't exist yet, gets a not-found.
2. Claude makes recommendations using the constraints from the user message.
3. Claude calls `Edit` (creating the file via `Write` if Edit fails) to record sizes / materials / budget / style.

## Inspect what got stored

```typescript
import { readFile } from './host';

async function dumpMemory(cwd: string) {
  const text = await readFile(`${cwd}/preferences.md`, 'utf8');
  console.log(text);
}
```

Typical output after the first turn:

```markdown
# Sizes
- Tops/Jackets: Medium

# Style
- Earth tones (browns, tans, olive, terracotta, camel, rust)
- Looking for: jacket

# Budget
- Usually under $200

# Materials to avoid
- Animal leather (vegan leather only)

# Favorite brands
- (none yet)

# Other notes
- First visit; preferences collected 2026-04-28
```

## Second visit: recall

```typescript
const cwd = await workspaceFor('cust_42');  // same directory
askShopper(
  cwd,
  "Hey, I'm back! I need a bag for work. Any recommendations?",
  (text, done) => render(text, done),
);
```

This time Claude's first tool call is `Read({"file_path":"./preferences.md"})` and the recommendations are size-medium, vegan, earth-toned, sub-$200 right out of the gate — without the customer repeating themselves.

## Seeding from your app

Anything your CRM already knows about the customer goes straight into the workspace before the first turn:

```typescript
async function seedMemory(cwd: string) {
  await writeFile(`${cwd}/purchase-history.md`, `# Recent purchases
- Canvas tote, olive, $89 (Jan 2026)
- Wool beanie, rust, $34 (Dec 2025)
`);
}
```

Tell Claude about the file in the instruction:

```typescript
const MEMORY_INSTRUCTION_WITH_HISTORY = `${MEMORY_INSTRUCTION}

If ./purchase-history.md exists, Read it for context on past orders. Don't
edit purchase-history.md — it's owned by the application.`;
```

## Mixing per-customer + shared stores

The original recipe layered a per-customer store with a shared catalog store. Same pattern here:

```text
workspace/
├── <customer-id>/preferences.md          ← per-customer, read+write
└── _shared/catalog-notes.md              ← shared across customers, read-only
```

Use the `add_dirs` field in `SessionOptions` to expose `_shared/` to a session whose `cwd` is the customer dir. **Today this isn't plumbed through `hostClaudeInit`** — see TODOs.

## Caveats and TODOs against the v8 bindings

- **No `system_prompt` from the cart.** Memory instructions ride on every user message. When `framework/v8_bindings_sdk.zig:932` learns to pass `system_prompt`, move `MEMORY_INSTRUCTION` there.
- **No `add_dirs` from the cart.** Cross-store layering (shared catalog + per-customer prefs) needs `add_dirs` plumbed into `hostClaudeInit`. Until then, copy the shared file into each customer's cwd at session start.
- **One session at a time.** `g_claude_session` is a single global (`framework/v8_bindings_sdk.zig:24`). Two customers can't be served concurrently — queue or serialize.
- **No "memory store" abstraction.** There's no API to list memories, version them, or get a typed view. You're working with files. If you need an audit trail, snapshot the cwd to git after each session.
- **Claude Code default permission_mode is `bypass_permissions` (`framework/v8_bindings_sdk.zig:960`).** Edits to `preferences.md` happen without a prompt. That's fine for a memory file scoped to the customer's own dir, but don't widen the cwd to anything sensitive.

## Pattern summary

1. One directory per customer; pass it as `cwd` to `__claude_init`.
2. Pin Claude to a known filename (`preferences.md`) and a known schema in the prompt.
3. First turn: Claude finds nothing, makes recommendations, writes the file.
4. Second turn: same `cwd`, Claude reads the file first, recommendations land pre-personalized.
5. Seed extra knowledge by writing files into `cwd` before the session starts.
6. Inspect / migrate / export memory by reading those files from your app.

The "memory store" is just a workspace. The persistence layer is `cwd` + the filesystem.
