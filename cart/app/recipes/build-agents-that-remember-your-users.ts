import type { RecipeDocument } from "./recipe-document";

export const recipe: RecipeDocument = {
  slug: "build-agents-that-remember-your-users",
  title: "Build agents that remember your users",
  sourcePath: "cart/app/recipes/build-agents-that-remember-your-users.md",
  instructions:
    "Persist customer preferences across sessions by treating the session's cwd as a memory store. Per-customer workspace directory + a pinned notes file (preferences.md) Claude reads at session start and edits when it learns something new. The original 'memory_store' beta from Claude Managed Agents has no analog in framework/claude_sdk/; cwd + Read/Edit is the closest local equivalent.",
  sections: [
    {
      kind: "paragraph",
      text:
        "Most agents start every conversation from scratch. The original Anthropic recipe solves this with the Claude Managed Agents memory_store beta — cloud-hosted, mounted at /mnt/memory/{store}. We don't have that. framework/claude_sdk/ drives the local claude CLI; the closest analog is the session's cwd. Each customer gets their own directory; Claude reads/edits preferences.md inside it.",
    },
    {
      kind: "bullet-list",
      title: "What you'll build",
      items: [
        "A per-customer workspace directory holding preference notes.",
        "A first-visit turn that captures preferences into preferences.md.",
        "A second-visit turn that re-uses the same directory and recalls them.",
        "A read-only path for your app to inspect or seed the file.",
      ],
    },
    {
      kind: "code-block",
      title: "Architecture",
      language: "text",
      code: `.tsx cart  ── globals ──>  framework/v8_bindings_sdk.zig
                            │
                            └─ framework/claude_sdk/Session  (cwd = workspace/<customer-id>/)
                                  └─ subprocess: \`claude --input-format stream-json\`

workspace/
└── <customer-id>/
    ├── preferences.md       ← Claude reads/edits this
    └── purchase-history.md  ← optionally seeded by your app`,
    },
    {
      kind: "code-block",
      title: "Per-customer workspace",
      language: "typescript",
      code: `import { writeFile, mkdir } from './host';

async function workspaceFor(customerId: string): Promise<string> {
  const dir = \`\${WORKSPACE_ROOT}/\${customerId}\`;
  await mkdir(dir, { recursive: true });
  return dir;
}`,
    },
    {
      kind: "code-block",
      title: "The memory contract — pin Claude to one filename and one schema",
      language: "typescript",
      code: `export const MEMORY_INSTRUCTION = \`You are a personal shopping assistant.

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

Keep entries short and dated when relevant.\`;`,
    },
    {
      kind: "code-block",
      title: "First visit: capture preferences",
      language: "typescript",
      code: `const host: any = globalThis;
const claude_init  = typeof host.__claude_init  === 'function' ? host.__claude_init  : (_a:string,_b:string,_c?:string)=>0;
const claude_send  = typeof host.__claude_send  === 'function' ? host.__claude_send  : (_:string)=>0;
const claude_poll  = typeof host.__claude_poll  === 'function' ? host.__claude_poll  : ()=>null;
const claude_close = typeof host.__claude_close === 'function' ? host.__claude_close : ()=>{};

function askShopper(cwd: string, userMsg: string,
                    onUpdate: (text: string, done: boolean) => void): () => void {
  if (!claude_init(cwd, 'claude-sonnet-4-6')) {
    onUpdate('[error] failed to start session', true);
    return () => {};
  }
  const prompt = \`\${MEMORY_INSTRUCTION}\\n\\nCustomer: \${userMsg}\`;
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
}`,
    },
    {
      kind: "code-block",
      title: "Run a first turn",
      language: "typescript",
      code: `const cwd = await workspaceFor('cust_42');
askShopper(
  cwd,
  "Hi! I'm looking for a new jacket. I wear a size medium, only buy vegan " +
  "leather (no animal leather please), my budget is usually under $200, and " +
  "I love earth tones. What would you suggest?",
  (text, done) => render(text, done),
);`,
    },
    {
      kind: "bullet-list",
      title: "Expected behavior",
      items: [
        "Claude calls Read({\"file_path\":\"./preferences.md\"}) — file doesn't exist yet, gets a not-found.",
        "Claude makes recommendations using the constraints from the user message.",
        "Claude calls Edit (or Write to create) to record sizes, materials, budget, style.",
      ],
    },
    {
      kind: "code-block",
      title: "Inspect what got stored",
      language: "typescript",
      code: `import { readFile } from './host';

async function dumpMemory(cwd: string) {
  const text = await readFile(\`\${cwd}/preferences.md\`, 'utf8');
  console.log(text);
}`,
    },
    {
      kind: "code-block",
      title: "Typical preferences.md after the first turn",
      language: "markdown",
      code: `# Sizes
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
- First visit; preferences collected 2026-04-28`,
    },
    {
      kind: "code-block",
      title: "Second visit: same cwd, automatic recall",
      language: "typescript",
      code: `const cwd = await workspaceFor('cust_42');  // same directory
askShopper(
  cwd,
  "Hey, I'm back! I need a bag for work. Any recommendations?",
  (text, done) => render(text, done),
);`,
    },
    {
      kind: "paragraph",
      text:
        "Claude's first tool call is Read({\"file_path\":\"./preferences.md\"}); recommendations land size-medium, vegan, earth-toned, sub-$200 without the customer repeating themselves.",
    },
    {
      kind: "code-block",
      title: "Seeding from your app's CRM",
      language: "typescript",
      code: `async function seedMemory(cwd: string) {
  await writeFile(\`\${cwd}/purchase-history.md\`, \`# Recent purchases
- Canvas tote, olive, $89 (Jan 2026)
- Wool beanie, rust, $34 (Dec 2025)
\`);
}

const MEMORY_INSTRUCTION_WITH_HISTORY = \`\${MEMORY_INSTRUCTION}

If ./purchase-history.md exists, Read it for context on past orders. Don't
edit purchase-history.md — it's owned by the application.\`;`,
    },
    {
      kind: "code-block",
      title: "Mixing per-customer + shared stores (deferred)",
      language: "text",
      code: `workspace/
├── <customer-id>/preferences.md          ← per-customer, read+write
└── _shared/catalog-notes.md              ← shared across customers, read-only

# Layering needs add_dirs plumbed into hostClaudeInit (currently absent).
# Workaround until then: copy the shared file into each customer's cwd at session start.`,
    },
    {
      kind: "bullet-list",
      title: "Caveats and TODOs against the v8 bindings",
      items: [
        "No system_prompt from the cart. Memory instruction rides on every user message; move to the system slot when framework/v8_bindings_sdk.zig:932 grows the field.",
        "No add_dirs from the cart. Cross-store layering (shared catalog + per-customer) needs add_dirs plumbed; copy files into cwd as a workaround.",
        "One session at a time. g_claude_session is a single global (framework/v8_bindings_sdk.zig:24); two customers can't be served concurrently — queue or serialize.",
        "No 'memory store' abstraction. No API to list/version/audit memories — you have files. Snapshot cwd to git after each session if you need an audit trail.",
        "permission_mode is hardcoded to bypass_permissions. Edits to preferences.md happen without prompt — fine inside the customer dir, do not widen cwd.",
      ],
    },
    {
      kind: "bullet-list",
      title: "Pattern summary",
      items: [
        "One directory per customer; pass it as cwd to __claude_init.",
        "Pin Claude to a known filename (preferences.md) and a known schema in the prompt.",
        "First turn: Claude finds nothing, makes recommendations, writes the file.",
        "Second turn: same cwd, Claude reads first, recommendations land pre-personalized.",
        "Seed extra knowledge by writing files into cwd before the session starts.",
        "Inspect / migrate / export by reading those files from your app.",
      ],
    },
  ],
};
