# Old Projects — Ideas to Steal

Curated catalog of patterns worth lifting from old projects. Each project gets its own top-level section. Within a section, things are ordered roughly best-idea-first.

**Projects covered:**
- [npc.builder](#npcbuilder--unified-character-conversation-backend) — `/home/siah/dump/00`
- [image_gen.cjs](#image_gencjs--single-file-batch-image-generation-control-center) — `/home/siah/h/image_gen.cjs`
- [shittyresearchtool](#shittyresearchtool--multi-agent-research-orchestrator) — `/home/siah/creative/shittyresearchtool`
- [engaige](#engaige--social-simulation-with-autonomous-npcs) — `/home/siah/creative/engaige/server/src`
- [yaai](#yaai--desktop-ai-interface-the-everything-client) — `/home/siah/creative/ai`

**Convention:** when an idea has shown up in a previous project, the new section marks it `↻ Recurring (seen in: X, Y)`. Recurrence is signal — patterns that keep resurfacing are the ones I should treat as "core operating habits" for future tools.

---

## Recurring Patterns Index

Patterns that have surfaced in 2+ projects. Counts grow as more projects are added; high counts = strong personal preferences worth codifying.

| Pattern | Count | Projects | Notes |
|---|---|---|---|
| **Strategy fallback chain** (try N strategies, succeed at first useful output) | 5× | npc.builder provider walk; image_gen ref resolution; shittyresearchtool search engine + content selector; engaige output validator + door fetch + DDG selectors; yaai model alias matching + WebGL→CSS fallback + reference-extension chain | The dominant control-flow shape. **Promote to a shared lib already**: a `tryChain(strategies, isUseful)` helper would cover every site. |
| **Warn-and-continue defaults** (graceful degradation) | 5× | npc.builder; image_gen; shittyresearchtool; engaige; yaai (Result<T,E> as universal return = degradation is a first-class outcome, M3A WriteResult tracks per-layer success/skip/failure) | Now structural — yaai uses Result<T,E> *everywhere* so "warn and continue" isn't a habit, it's the type system. |
| **OpenAI-compat API shim** (one URL/key) | 5× | npc.builder; image_gen; shittyresearchtool; engaige; yaai (openai/openai-compatible/anthropic/google switch in `getAIConfig`) | Default expectation. nano-gpt remains the typical gateway — but yaai supports first-class native providers too. |
| **Per-job/per-agent stable string IDs** | 5× | npc.builder requestId; image_gen job-N; shittyresearchtool search-0; engaige UUIDs; yaai **branded types** (`type ChatId = string & { readonly __brand: 'ChatId' }`) — compiler-enforced | yaai is the structural version: branded types prevent accidental ID confusion at compile time. |
| **Streaming/incremental output to user** | 5× | npc.builder; image_gen SSE; shittyresearchtool stdout; engaige fake-streaming; yaai parallel responses with bloom/collapse + Cinematic Mode (30s theatrical presentation) | The principle generalizes way past LLM streaming. yaai's "Cinematic Mode" is streaming-as-aesthetic. |
| **Out-of-process state store** (FS or DB) | 5× | npc.builder Postgres; image_gen CSV+SQLite; shittyresearchtool tmp md; engaige 3 DBs; yaai **5 SQLite DBs** (chat / code / imagegen / app / analytics) + content-addressed blobs | yaai's is the most sophisticated: 5-way partition by reset-survivability AND domain, plus blob storage with SHA-256 dedup. |
| **"All X go through this single door" — centralized chokepoints** | 5× | npc.builder; image_gen; shittyresearchtool; engaige (4-5 explicit doors); yaai (Result<T,E> = single error funnel, WebSocket = single transport, AppError = single error type, branded types = single ID-typing approach) | yaai funnels even types through one shape. The pattern is now structural, not just architectural. |
| **Split model selection by role** (cheap-judge / expensive-generator) | 5× | npc.builder cascading; shittyresearchtool 3-tier; engaige validator+vision+deliberation; yaai Deep Research (orchestrator/runners/reader) + reasoning-level prompt config + per-feature default-models config | yaai makes per-role model assignment a *user-facing setting* (not just code), with a UI for picking models per task type. |
| **Cheap on-write tagging that pays back at retrieval/ranking time** | 4× | npc.builder emotional_significance + topics; image_gen prompt embeddings BLOB; engaige event importance + topic_interests; yaai **M3A 5-layer write pipeline** (affect + embedding + FTS + entities + salience + concept-graph, every one with persistence threshold) | yaai is the maxed-out version: 5 parallel taggings on every message, each with a tunable threshold for whether to persist. **The strongest "this is who I am" pattern in the catalog.** |
| **Markdown/text file as user-authored config with embedded fields** (vs JSON/YAML) | 3× | npc.builder forged contexts; image_gen `queue.txt`; shittyresearchtool `research.md` | yaai uses typed schemas (variable definitions) instead. The instinct evolves: from "human-edited markdown" → "user-built via a UI builder that produces typed config." |
| **Variable interpolation system (`{{var}}` or `${var}` style)** (NEW pattern) | 3× | npc.builder template `${before_text}${identity}${after_text}`; image_gen `{a\|b\|c}` + `%img2img.name%` + `$home`; yaai full DSL — system / app-level / wildcard / rest-api / javascript variables with recursive expansion + cycle detection + TTL cache + 4-step REST builder UI | yaai's is the *industrial-grade* version of the same instinct. Promote: any tool with prompts/config should ship with at minimum a wildcard + system-variable expander. |
| **Two-phase / staged pipeline with named phases** | 3× | npc.builder context-assembly modes; shittyresearchtool 4-phase research; engaige drama-engine tick + onboarding waves | Could add yaai's M3A 5-layer pipeline here — same shape, different domain. |
| **Single chokepoint for outbound HTTP with optional proxy** | 3× | image_gen SOCKS agent; engaige `door.ts`; yaai `httpClient` with `requireProxy: true` flag | Same instinct three times. The next project ships with this lib pre-built. |
| **Result<T, E> functional error type** (NEW pattern) | 1× | yaai (universal — `core/result.ts` with full helper suite: ok/err/map/mapErr/flatMap/unwrapOr/fromPromise/tryCatch/all/collect, type-narrowing isOk/isErr) | First appearance, but combined with branded types and AppError it becomes the *substrate* for everything else. If I'm doing TS again: start here. |
| **WebSocket-only IPC between server and frontend** (NEW pattern) | 2× | engaige (`ws://localhost:4269/ws`); yaai (`ws://localhost:3001`) — both with explicit "frontend is a dumb terminal" doctrine in CLAUDE.md | The Tauri/Electron pattern: backend = full Bun server, frontend = React renderer, only WS between them. |

The point of this index isn't the count itself — it's the realization that "I keep doing this" is a much louder signal than "I think this is a good idea." Patterns at 5+ projects are no longer ideas, they are **operating principles** — they should be defaults in the next project, not decisions to be made.

---

# npc.builder — unified character conversation backend

Source: `/home/siah/dump/00`.
Stack: TypeScript + Express + Prisma + Postgres (pgvector + uuid-ossp + unaccent).

The interesting parts aren't the CRUD or the provider plumbing — they're the *character integrity* and *context plumbing* ideas.

---

## 1. Identity Crisis Detection (best idea in the repo)

A character "loses identity" when it slips into AI-speak, uses the wrong name, contradicts its own personality, or breaks the conversational frame. npc.builder treats this as a **first-class detectable event** with a confidence score and a recovery ladder.

**Detector axes** (each scored 0-1, weighted):
- name consistency (0.4) — claimed-name regex, "I am the bot/AI/assistant" detection
- personality consistency (0.3) — trait-vs-contradiction lexicon (`friendly` ↔ `rude/hostile/mean`)
- response pattern (0.2) — generic AI phrases, robotic phrases, missing emotional expression
- context awareness (0.1) — overlap with recent messages, background contradictions

```ts
// IdentityCrisisService.ts — analyzeNameConsistency
const namePattern = /(?:i\s+am|i'm|my\s+name\s+is|call\s+me)\s+([a-zA-Z]+)/gi;
while ((match = namePattern.exec(responseText)) !== null) {
  const claimedName = match[1].toLowerCase();
  if (claimedName !== characterName && claimedName.length > 2 &&
      !['a','an','the','here','really','always','so'].includes(claimedName)) {
    issues.push(`Character claimed to be "${claimedName}" instead of "${character.name}"`);
    score -= 0.6;
  }
}
```

```ts
// Generic-AI tells, scored
const genericAIPhrases = [
  'as an ai', "i'm an ai", 'language model', 'i cannot',
  "i don't have personal", "i don't have feelings",
  'as a computer program', 'i am programmed to', 'my programming',
];
```

**Severity ladder:** confidence ≥ 0.6 = critical, ≥ 0.45 = high, ≥ 0.2 = medium, else low.

**Recovery recommendations** are auto-generated and prioritized:
- `stronger_injection` — escalate template strength
- `template_change` — swap to a different template entirely
- `context_reset` — `partial` (drop recent) or `full` (start over)
- `model_switch` — last resort

Each crisis is logged with the recovery attempts that followed and whether they resolved it. That log is queryable for stats: success rate per recovery type, top issues, severity breakdown by character.

**Why steal it:** any agent-like feature that has a "stay in character / stay on task" requirement gets this for free.

---

## 2. Cascading Identity Orchestrator (the runtime version)

`tests/cascading_identity_orchestrator.js` — a **multi-tier escalation pipeline** that pairs the detector with progressively stronger prompts, then escalates to cloud:

```
local + mild template
    ↓ if invalid (cloud-validated)
local + strong template
    ↓ if invalid
local + extreme template (CAPS + ⚠️ markers)
    ↓ if invalid
local + nuclear template (🚨 + numbered "ABSOLUTE RULES")
    ↓ if all local attempts fail
cloud generation (GPT-4o)
```

```js
nuclear: `🚨 MAXIMUM IDENTITY ENFORCEMENT 🚨
CHARACTER IDENTITY: ${character.name}
- YOU ARE THIS CHARACTER ONLY
USER IDENTITY: ${user.name}
- YOU ARE NOT THIS PERSON
ABSOLUTE RULES:
1. NEVER say "My name is ${user.name}"
2. NEVER claim ${user.name}'s relationships
3. NEVER claim ${user.name}'s memories or experiences
4. ALWAYS maintain ${character.name} identity
VIOLATION = IMMEDIATE FAILURE`
```

Validation is delegated to a separate cheap-and-accurate cloud model (Gemini Flash) that returns `VALID: YES/NO` + confidence + reason. **Splitting generation from judgment is the trick** — local model writes, cloud judges, escalation only triggers on judged failures.

---

## 3. Wrapper Templates with Strength Levels

Templates aren't strings — they're DB rows with `before_text`, `after_text`, `type` (character|user), `model_specific`, and `strength_level` (`default | strong | crisis_prevention`).

The injection is just `${before_text}${identity}${after_text}${userContext}`.

**Selection ladder** (TemplateManager):
1. exact match (type + model + strength)
2. if previous failures, escalate strength
3. drop model specificity, keep strength
4. any template of the right type

This means the *same character* can run differently per model with no code change — you just author a `model_specific='lorablatedstock-12b-i1'` template.

---

## 4. Ghost Messages (context bridging without lying)

Ghost messages = real DB rows with `is_ghost=true`, a `ghost_pair_id` linking user+character halves, and a `fictional_timestamp` independent of `created_at`. They participate in context assembly but are excluded from "real" conversation history.

**Use case:** pre-seed a relationship without an actual conversation. Drop in a ghost pair "user said hi / character responded warmly, 3 weeks ago" and the next real message lands in a primed context.

```ts
// Ghost validation — refuses to let meta language leak
private containsMetaReferences(content: string): boolean {
  const metaPatterns = [
    /\b(ghost|fictional|fake|test|debug|placeholder)\b/i,
    /\b(this is (a|an) .*message)\b/i,
    /\b(simulate|pretend|imagine)\b/i,
  ];
  return metaPatterns.some(p => p.test(content));
}
```

**Schema constraint** enforces invariants at the DB layer:

```sql
CONSTRAINT ghost_pair_logic CHECK (
  (is_ghost = FALSE AND ghost_pair_id IS NULL AND fictional_timestamp IS NULL) OR
  (is_ghost = TRUE  AND ghost_pair_id IS NOT NULL)
)
```

---

## 5. Context Forging (manual context construction)

Three assembly modes share an interface:

- **`rolling_window`** — automatic, scored selection within token budget (default)
- **`forged`** — operator hand-picks specific messages, overrides their content/timestamps, saves as a named context
- **`hybrid`** — rolling window + injected priority messages from a forged context

The forged context is a versioned, branchable artifact:

```ts
interface ForgedContext {
  context_data: { messages: MessageSelection[]; systemPrompt?: string; ... };
  parent_context_id?: string;   // branching
  branch_name?: string;
  branch_depth: number;          // capped at 10
  validation_results: { qualityMetrics: {...}; tokenAnalysis: {...} };
  times_loaded: number;          // usage tracking
  is_public: boolean;
  tags: string[];
  shared_with: string[];
}
```

`MessageSelection` lets you **override the original message without mutating it** — `contentOverride`, `timestampOverride`, `metadataOverrides`. The original message stays canonical; the forge is a view layer.

**Quality metrics** computed at forge-time:
- `contextCoherence` — pairwise topic Jaccard
- `temporalConsistency` — penalty per timestamp inversion
- `characterConsistency` — topic-diversity heuristic
- `conversationFlow` — penalty per abrupt topic change between adjacent messages

Plus token-budget warnings, balance checks (no user msgs / no character msgs / character:user ratio > 3).

---

## 6. Hybrid Context Assembly

Rolling window strategy with a clean priority/budget split:

```ts
{
  maxTokens: 4000,
  minMessages: 5,
  maxMessages: 50,
  memoryRetrievalCount: 10,
  priorityWeights: {
    recency: 3.0,
    emotional: 2.0,
    relevance: 1.5,
    userMessage: 1.0,
  },
  immutablePreservation: {
    characterInjection: true,
    userInjection: true,
    systemMessages: true,
    recentMessages: 3,        // always keep last N
  },
}
```

**Token budgeting:** reserve 60% of budget for messages, the rest split between system prompt and memories. After assembly, validation checks distribution percentages and recommends "memories use >30% of tokens" or "system prompt uses >50% of tokens" type warnings.

**Selection algorithm:**
1. Always include immutable messages
2. Score remaining messages: priority + recency*3 + emotional*2 + userBonus + memoryRelevance*1.5
3. Pin the N most recent (by config)
4. Greedy fill by score within remaining token budget
5. If under `minMessages`, top up by score

If anything fails, fall back to a 1-message minimal context with `"You are a helpful AI assistant."` — never crash on context.

---

## 7. Hybrid Memory Retrieval (pgvector + FTS + fuzzy)

Three search strategies fan out in parallel and combine:

```sql
-- Semantic
SELECT m.*, (m.embedding <=> $1::vector) AS distance ORDER BY distance ASC

-- Full-text
SELECT m.*, ts_rank(to_tsvector('english', m.content),
                    plainto_tsquery('english', $1)) AS text_rank

-- Fuzzy
WHERE LOWER(m.content) LIKE $1 OR LOWER(m.content) LIKE $2 ...  -- per-word ILIKE
```

Combine: semantic gets highest priority, full-text overlays score, fuzzy fills gaps. Then re-rank by:

```
finalScore = relevance * 0.4
           + recency  * 0.3        // exp(-ageInHours / 168) — 1-week decay
           + emotional * 0.2       // 0-10 scale / 10
           + topicRelevance * 0.1
```

Token-budget-aware filter: if a high-`finalScore` (>0.8) memory doesn't fit whole, **truncate to sentence boundaries** rather than drop it.

```ts
// Sentence-boundary truncation
const sentences = content.split(/[.!?]+/);
let truncated = '';
for (const s of sentences) {
  if (countTokens(truncated + s + '.') <= maxTokens) truncated += s + '.';
  else break;
}
```

Background task `generateMissingEmbeddings` walks rows with `embedding IS NULL` in batches, so embedding work doesn't block ingestion.

---

## 8. Schema Patterns Worth Stealing

```sql
-- Emotional significance + topics live ON the message — not in a side table.
emotional_significance INTEGER DEFAULT 0 CHECK (emotional_significance BETWEEN 0 AND 10),
topics                 TEXT[] DEFAULT '{}',

-- Vector index that excludes nulls
CREATE INDEX idx_messages_embedding ON messages
  USING ivfflat(embedding vector_cosine_ops)
  WITH (lists = 100) WHERE embedding IS NOT NULL;

-- GIN index over array column
CREATE INDEX idx_messages_topics ON messages USING GIN(topics);

-- GIN index over generated tsvector for FTS
CREATE INDEX idx_messages_content_search ON messages
  USING GIN(to_tsvector('english', content));

-- DB-enforced cap on branch depth
CONSTRAINT valid_branch_depth CHECK (branch_depth <= 10)

-- Composite primary keys for relationship rows (no surrogate id)
PRIMARY KEY (user_id, character_id)

-- Unique-by-position so forged context messages can't collide
UNIQUE (forged_context_id, position),
UNIQUE (forged_context_id, original_message_id)
```

---

## 9. User × Character Relationship as First-Class Entity

```sql
CREATE TABLE user_character_relationships (
  user_id VARCHAR(255),
  character_id VARCHAR(255),
  relationship_type VARCHAR(100) DEFAULT 'conversation_partner',
  established_date TIMESTAMP WITH TIME ZONE,
  user_identity_to_character TEXT,        -- ← the gold
  relationship_context JSONB,
  PRIMARY KEY (user_id, character_id)
);
```

`user_identity_to_character` lets the **same user be a different person** to each character — alias, role, or context-specific persona. The character only ever sees the projection.

`relationship_type` + `relationship_context` JSON makes it cheap to model: friend / rival / boss / mentor without a relationships taxonomy table.

---

## 10. Provider Abstraction + Fallback Walk

`BaseProvider` interface — providers register and self-report `isConfigured()`. Router on failure:

```ts
for (const providerName of fallbackProviders) {
  const fallbackModel = await this.findFallbackModel(providerName, originalModel);
  // findFallbackModel prefers similar context_window
  const fallbackRequest = this.adjustRequestForFallback(request, fallbackModel);
  // adjustRequestForFallback: temperature -= 0.2 for character consistency
  return await this.attemptCharacterGeneration(fallbackRequest, ...);
}
```

Every active request gets an `AbortController` stored in `Map<requestId, AbortController>` so streaming generations can be cancelled mid-flight.

---

## 11. Background Task Queue (priority + retry + worker pool)

`extends EventEmitter`, simple but complete:

```ts
addTask(type, payload, priority = 1, maxRetries = 3): string {
  // Priority insert — higher priority cuts the line
  const insertIndex = this.queue.findIndex(t => t.priority < priority);
  this.queue.splice(insertIndex === -1 ? this.queue.length : insertIndex, 0, task);
}
```

- Worker pool: `Map<workerId, busy>` — N concurrent slots
- Exponential backoff: `setTimeout(retry, 2^attempt * 1000)`
- Events: `taskCompleted`, `taskFailed` — hook into perf metrics
- Task types: `generateEmbedding`, `cacheWarmup`, `indexMemories`

Pattern is generic. Could lift wholesale.

---

## 12. Categorized Error Handling with Safe Production Messages

Errors get a category tag and a per-category public-facing message that hides internals in prod:

```ts
enum ErrorCategory {
  PROVIDER_ERROR, CONTEXT_ERROR, CHARACTER_ERROR, DATABASE_ERROR,
  VALIDATION_ERROR, RATE_LIMIT_ERROR, TIMEOUT_ERROR, NETWORK_ERROR, ...
}

// In production:
PROVIDER_ERROR  → "AI service temporarily unavailable"
DATABASE_ERROR  → "Data service temporarily unavailable"
CONTEXT_ERROR   → "Unable to process conversation context"
```

Plus retryability hints (`retryable: boolean`, `retryAfter: seconds`), winston JSON structured logs, and aggregated counts exposed at `/api/errors`.

---

## 13. Server Bootstrapping Pattern

`index.ts` defers route imports until *after* `initDatabase()` — routes that touch repositories at module-eval time would crash otherwise.

```ts
await initDatabase();
const aiRoutes = (await import('./routes/ai')).default;
const chatRoutes = (await import('./routes/chat')).default;
// ... then app.use(...)
backgroundTaskService.scheduleCleanup(30);
app.listen(PORT, () => {
  setTimeout(() => backgroundTaskService.warmupCache('characters', []), 5000);
});
```

Health/metrics endpoints registered *before* full init so probes succeed during startup.

---

## 14. Message Analysis (cheap heuristic emotion + topic tagging)

No ML model — just keyword buckets and punctuation counting. Good enough to feed memory ranking and search filters.

```ts
emotionalIndicators = {
  high:   ['love','hate','furious','devastated','heartbroken','ecstatic','terrified','crisis','betrayed', ...],   // +4
  medium: ['happy','sad','excited','worried','grateful','proud','ashamed','nervous','hopeful', ...],              // +2.5
  low:    ['okay','fine','good','bad','nice','cool','weird','interesting','tired', ...],                          // +1.5
};
significance += min(exclamationCount * 0.5, 2)
              + min(questionCount    * 0.3, 1.5)
              + min(capsRunCount     * 0.7, 2)
              + min(personalPronounCount * 0.2, 1);
// + relationship words (+1 each), urgency words (+1.5 each)
// Character messages are scaled *0.9
// Bonus +1 if recent context was already emotional
// Clamp to 0-10
```

Topics extracted via keyword categories (`emotions`, `relationships`, `work`, `health`, `hobbies`, `tech`, `education`, `future_planning`, `memories`, `seeking_help`, `greeting`, `farewell`) plus `entity:propername` extraction from capitalized words.

The pattern is more interesting than the lexicon — **cheap on-write tagging that pays back at retrieval/ranking time** without any model dependency.

---

## What I'd Actually Steal First

1. **Ghost messages** — single most original idea. The fictional_timestamp + DB constraint is elegant.
2. **Identity-crisis detector + recovery ladder** — applicable to any "stay in character / stay on task" agent.
3. **Cascading orchestrator with split generator/judge models** — cheap cloud judge, escalating local prompts.
4. **Hybrid context assembly with three modes sharing one interface** — `rolling_window | forged | hybrid` is clean.
5. **Forged contexts as versioned/branchable views over real messages** — never mutate originals.
6. **Hybrid memory retrieval (semantic + FTS + fuzzy)** — combination is more valuable than any one.
7. **`user_identity_to_character`** — same user, different projections. Cheap, powerful.
8. **Cheap on-write emotional/topic tagging feeding ranking later** — no model, no cost.

---

# image_gen.cjs — single-file batch image generation control center

Source: `/home/siah/h/image_gen.cjs`. One 2906-line `.cjs` file. No `package.json` for it visible alongside.
Stack: Node.js + blessed (TUI) + Express + SSE + better-sqlite3 + sharp (img compression) + socks-proxy-agent. Targets the nano-gpt image API.

It's a personal-tool that became impressively rich. The interesting parts are the **operator ergonomics** (the queue.txt mini-DSL, the wildcard ref language, the live prompt reload) and the **dual-UI / single-state** architecture.

---

## 1. The `queue.txt` micro-DSL

Operator authors batch jobs as one line each:

```
[promptName] [4096x4096] [1] [25] [seedream-v4] [refs] [style] [aspect_ratio=16:9,steps=30,cfg=7]
?[disabledPrompt] [...]            # ? prefix = skip this line
[targetMode] [...] [25] [...]!     # ! suffix = auto-retry mode (target N images, ±tolerance)
```

Positional bracketed fields, with extension parameters as `key=value,...` in a final bracket. Comments via `#`. Disable flag `?`, retry flag `!`.

```js
const matches = [...cleanLine.matchAll(/\[([^\]]+)\]/g)].map(m => m[1].trim());
// matches[0]=prompt, [1]=resolution, [2]=images, [3]=batches,
// [4]=model, [5]=refs, [6]=style, [7]=extParams (k=v,k=v,...)
```

Tiny but operator-friendly. Disable flag is huge — keeps queue.txt as a living log instead of forcing destructive edits. Mixed positional + keyword params is the right shape for "common things short, rare things explicit."

---

## 2. Wildcard Reference Mini-Language

The `refs` field accepts a mini-language for picking img2img references — way past "comma-separated list":

| Syntax | Means |
|---|---|
| `name` | literal reference |
| `!folder` | one random image from `folder/` |
| `!!folder` | one random from `folder/` + all subdirs (recursive) |
| `!!folder!!` | ALL images from `folder/` (non-recursive) |
| `!#5` | 5 random images from EVERYTHING under img2img/ recursively |
| `@123` | media server image ID 123 |
| `@?` / `@random` | one random media server image (over `MEDIA_SERVER_MAX_ID`) |
| `@#3` | 3 random media server images |
| `{a\|b\|c}` | randomly pick one of these literal options |
| `$home`, `$collection`, `$photos` | path aliases (avoid `../../..`) |

```js
// Path aliases — defined once, used everywhere
const PATH_ALIASES = {
  home: '/home/siah',
  collection: '/home/siah/collection',
  photos: '/home/siah/Pictures',
};
// Expand $variables before resolving
function expandPathAliases(s) {
  return s.replace(/\$([a-zA-Z_]\w*)/g, (m, n) =>
    PATH_ALIASES[n.toLowerCase()] ?? m);
}
```

Caps wildcard counts at 10 (`!#15` → "exceeds max 10, capping at 10") and *continues* — warn-and-clamp instead of fail.

**Why steal it:** any time a user supplies a list-of-things in config, you can promote that field into an expressive mini-language. The pattern of `prefix-character → operation` (`!`, `!!`, `@`, `@#`, `$`) is dense but learnable, and far more expressive than 10 separate config fields.

---

## 3. Tagged Wildcards in Prompts (with conditional follow-ups)

`processWildcards` does two passes over a prompt:

```
The scene is set at {dawn<time>|midnight<time>}, in a {meadow|alley}.
<time:The light is harsh and golden.>
```

First pass: each `{a|b|c}` picks one option randomly. Options ending in `<tag>` register the tag and strip it. Second pass: `<tag:content>` only renders if `tag` was selected by *any* wildcard upstream.

```js
// Tagged wildcard registers the tag for later conditionals
prompt = prompt.replace(/\{([^}]+)\}/g, (match, options) => {
  const choices = options.split('|').map(s => s.trim());
  const selected = choices[Math.floor(Math.random() * choices.length)];
  const tagMatch = selected.match(/<([^>]+)>$/);
  if (tagMatch) {
    taggedChoices.set(tagMatch[1], selected.replace(/<[^>]+>$/, '').trim());
    return selected.replace(/<[^>]+>$/, '').trim();
  }
  return selected;
});
// Conditional: <tag:content> renders content only if tag was set
prompt = prompt.replace(/<([^:>]+):([^>]+)>/g,
  (m, tag, content) => taggedChoices.has(tag) ? content.trim() : '');
```

Lets you compose mutually-exclusive narrative branches in a single prompt template. Prompt randomization without N templates.

---

## 4. Prompt Variable Interpolation from References

The prompt can reference *the actual files being passed in*:

```
Make a portrait of %img2img.name% in the style of %img2img[1].basename%
```

```js
prompt.replace(/%img2img\[(\d+)\]\.(filename|name|basename)%/g, ...);
prompt.replace(/%img2img\.(filename|name|basename)%/g, ...);  // first ref
```

This sounds gimmicky but lets you build prompts that are aware of their input. Combined with `!folder` random picks, you get "describe THIS specific reference" without authoring per-image prompts.

---

## 5. Live Prompt Reload Per Batch

Inside `_executeRequest`, every batch re-reads the prompt file from disk:

```js
let currentPromptText = job.promptText;
if (job.promptName) {
  try {
    currentPromptText = await loadPrompt(currentPromptName);
  } catch (err) {
    this.logger.warn(`Failed to reload, using cached: ${err.message}`);
  }
}
```

Operator can edit a prompt mid-job. Next batch picks up the new content. Combined with **wildcard prompt names** in queue.txt — `[{coastal|forest|urban}]` — each batch re-rolls and re-loads, giving a long-running "sample from these prompts" job that adapts as you iterate.

Failure mode: fall through to cached, never block.

---

## 6. Conditional Safety Prompt Injection

```js
function addImg2ImgSafetyInstructions(prompt, hasImg2Img) {
  if (!hasImg2Img) return prompt;
  return prompt + `
[follow the user prompt exactly... if there are watermarks/logos always remove them
unless explicitly asked... acknowledge that reference images have multiple people
with distinct key features that need to be retained...]
prompt:`;
}
```

Boilerplate appended **only when relevant context exists**. Same pattern works for: any time you're auto-injecting safety/format/structure instructions, condition them on the actual situation rather than always-on.

---

## 7. Two-Tier Limiting (Sliding Window + Concurrency)

```js
const rateLimiter        = new RateLimiter(25, 2500);  // 25 calls per 2.5s window
const concurrencyLimiter = new ConcurrencyLimiter(75); // 75 simultaneous in-flight
```

Composed independently. `RateLimiter` is a sliding window that filters its timestamp array on every check. `ConcurrencyLimiter` is an `EventEmitter` that fires `slot-available` on decrement — the dispatcher only re-wakes when work can actually proceed.

```js
class ConcurrencyLimiter extends EventEmitter {
  decrement() {
    this.currentCount = Math.max(0, this.currentCount - 1);
    this.emit('slot-available');
  }
}
```

The single global request queue (not per-job) means a 10-job batch doesn't fight itself for slots — every batch from every job feeds one shared dispatcher.

---

## 8. Single Global Dispatcher, Two Fairness Gates

```js
async _dispatchRequests() {
  while (this.requestQueue.length > 0 && !this.cancelRequested) {
    if (!this.concurrencyLimiter.canStart()) break;
    if (!this.rateLimiter.canMakeCall()) {
      const waitTime = this.rateLimiter.getNextAvailableTime();
      setTimeout(() => this._dispatchRequests(), waitTime);
      break;
    }
    const request = this.requestQueue.shift();
    this.rateLimiter.recordCall();
    this.concurrencyLimiter.increment();
    this._executeRequest(request).finally(() => {
      this.concurrencyLimiter.decrement();
      // Fires 'slot-available' → re-enters _dispatchRequests
    });
  }
}
```

`dispatcherRunning` flag prevents re-entrance during a synchronous sweep. The whole loop runs in one tick, then idle until `slot-available` or `setTimeout` re-wakes. Self-clocking.

---

## 9. Two-Phase Cancellation

API calls can't actually be cancelled mid-flight, so cancellation has two phases:

```js
async cancelAllRequests() {
  // Phase 1: kill everything still queued, immediately
  const queued = [...this.requestQueue];
  this.requestQueue = [];
  queued.forEach(req => { req.cancelled = true; req.reject(new Error('cancelled')); });

  // Phase 2: wait for in-flight to finish naturally
  if (this.inFlightRequests.size > 0) {
    this.cancelPromise = new Promise(resolve => { this.cancelResolve = resolve; });
    const tick = setInterval(() => {
      this.logger.info(`Still waiting for ${this.inFlightRequests.size}...`);
    }, 3000);
    await this.cancelPromise;
    clearInterval(tick);
  }
  this.cancelRequested = false;  // resumable
}
```

Resolves the single waiter when in-flight drops to 0. Resumable — `resumeAfterCancel()` flips the flag and re-fires the dispatcher. Periodic progress logging during the wait.

---

## 10. Auto-Retry "Target Images with Tolerance"

Instead of "run N batches", declare "I want 100 images ±3":

```js
async _runAutoRetry(job) {
  while (job.stats.totalImages < targetImages - tolerance) {
    const remaining = targetImages - job.stats.totalImages;
    const batchesToRun = Math.ceil(remaining / imagesPerBatch);
    // Queue all needed batches into global pipeline
    await Promise.all([...]);
    if (job.stats.totalBatches > 20000) throw new Error('Safety limit');
  }
}
```

Useful when the API silently drops some requests or you want a guaranteed yield. Safety cap at 20,000 batches keeps a runaway from cooking forever.

---

## 11. Cached References, Wildcard-Aware

```js
const hasWildcard = /[{}!@]/.test(pattern);
if (cached && cached.pattern === pattern && !cached.hasWildcard) {
  // reuse cached base64
} else {
  // re-resolve and re-load
  if (!hasWildcard) job.cachedRefs = { pattern, hasWildcard, base64Array, filenamesArray };
}
```

If the pattern is fixed (`portrait1, portrait2`), cache the base64 once per job — every batch reuses. If the pattern has a wildcard (`!folder`), re-roll every batch. **Caching policy follows determinism**, not "always" or "never".

---

## 12. Adaptive Image Compression to Fit Payload Budget

```js
async function compressImageBuffer(buffer, targetSizeBytes) {
  let quality = 87;  // start
  // Downscale-fit FIRST if dimensions > MAX_IMAGE_DIMENSION
  if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
    compressed = await sharp(buffer).resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION,
      { fit: 'inside', withoutEnlargement: true }).toBuffer();
  }
  // Then quality-step until fits or floor
  while (attempts < 5) {
    const test = await sharp(compressed).jpeg({ quality: Math.round(quality) }).toBuffer();
    if (estimateBase64Size(test.toString('base64')) <= targetSizeBytes || quality <= 50) {
      return test.toString('base64');
    }
    quality -= 10; attempts += 1;
  }
  // Hard floor at quality 50
  return (await sharp(compressed).jpeg({ quality: 50 }).toBuffer()).toString('base64');
}
```

**Per-image budget calculation when batching multiple references:**

```js
const targetSizePerImage = AUTO_COMPRESS
  ? Math.floor(MAX_PAYLOAD_SIZE * 0.8 / Math.max(imgNames.length, 1))
  : TARGET_IMAGE_SIZE;
```

Reserve 20% of payload for non-image overhead, divide the rest equally. If post-compression any single image *still* overflows the running total → log and stop adding references rather than fail the whole job.

---

## 13. Reference Resolution Layered Lookup

Each reference goes through a fall-through chain:

```
@123          → media server (no proxy, local network)
absolute path → load directly (don't write JSON to external dir)
name (relative) → try .json cache, then .png/.jpg/.JPG/.jpeg/.webp
                → on first .png/.jpg load, AUTO-CONVERT to .json cache
```

```js
async function loadImg2ImgOrConvert(imgName, logger) {
  if (imgName.startsWith('@')) return fetchMediaServerImage(...);
  if (path.isAbsolute(imgName)) /* load directly, don't cache out */ ;
  try { return JSON.parse(await fs.readFile(`${name}.json`)).base64; }
  catch {
    for (const ext of ['.png','.jpg','.JPG','.jpeg','.webp']) {
      try { /* load, compress, save .json next to original */ } catch {}
    }
  }
}
```

**Auto-converting on first use** is the trick — first call pays the conversion cost, every subsequent call hits the cache. Different policy for absolute paths (don't pollute external dirs with cache files).

---

## 14. CSV + SQLite Double-Write with Embeddings

Every result goes to two places:

```js
// CSV — quick eyeball, header auto-written if missing
const csvLine = `${ts},${status},"${promptName}",${model},${w},${h},${filename},...,"${err}"\n`;
await fs.appendFile(IMAGE_RESULTS_LOG, csvLine);

// SQLite — structured, with embedding BLOB for semantic search later
const embedding = await generateEmbedding(promptText);  // Float32Array → Buffer
db.prepare(`INSERT INTO image_results (..., prompt_embedding, ...) VALUES (..., ?, ...)`)
  .run(..., embedding, ...);
```

```sql
CREATE TABLE image_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL,
  prompt_name TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  prompt_embedding BLOB,           -- Float32Array.buffer
  refs TEXT NOT NULL,              -- JSON array
  model TEXT, width INTEGER, height INTEGER, filename TEXT, error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Embedding generation is via `spawn('python3', [EMBEDDING_SCRIPT, text])` — **gracefully degrades to NULL if Python unavailable**, never blocks the write. Embeddings as `Buffer.from(new Float32Array(embedding).buffer)` for cheap BLOB storage and easy round-tripping.

CSV is the human-friendly "scrub through it" view. SQLite is the queryable structured view. Both written every time. Cheap.

---

## 15. Per-Prompt AND Per-Reference Telemetry

Every success/failure increments stats for **the prompt** AND **every reference used**:

```js
recordSuccess(promptName, references = []) {
  this._ensurePrompt(promptName).success += 1;
  references.forEach(ref => this._ensureReference(ref).success += 1);
}
```

Sorted by `failRate` then `total` — surfaces the bad apples:

```
Prompt          ✅   ❌   Fail %
sunset_scene    47   2    4.1%
portrait_v3     12   8    40.0%   ← suspicious

Reference       ✅   ❌   Fail %
landscape_03    98   1    1.0%
dragon_ref      4    16   80.0%   ← this image trips the safety filter
```

**Reference-level failure rates are the killer feature** — when a specific image consistently causes API failures (NSFW filter / dimension issues / corrupted), you can see exactly which one without reading 200 log lines. Generalizable to any system where multiple input artifacts feed a single output.

---

## 16. Single Source of State, Multiple Views

Same process serves three UIs simultaneously, all wiring into the same `JobManager` / `TelemetryStore` / `UILogger` (`extends EventEmitter`):

- **blessed TUI** — 4 tabs (Dashboard / Queue / Telemetry / Logs), keyboard-driven wizard for new jobs
- **Express HTTP API** — `/api/jobs`, `/api/queue`, `/api/stats`, `/api/telemetry`, `/api/cancel-all`
- **SSE event stream** — `/api/events` re-broadcasts every JobManager event (`job:queued`, `batch:start`, `batch:success`, `queue:update`, `log`, ...) to web clients

```js
const onJobEvent       = (job) => sendEvent('job:update', job);
const onBatchStart     = (data) => sendEvent('batch:start', data);
const onBatchSuccess   = (data) => sendEvent('batch:success', data);
const onLogUpdate      = (entry) => sendEvent('log', entry);
jobManager.on('job:queued', onJobEvent);
jobManager.on('batch:start', onBatchStart);
// ... and on req close, removeListener for every one
```

Both the TUI redraws and the SSE pushes are driven by the *same events from the same emitter*. No state duplication, no sync bugs. Blessed render is debounced via `setImmediate` to coalesce bursts.

**This is the right shape for any tool with a TUI + a web UI:** put state and events in pure objects (EventEmitter), then bolt views on top. Never put state in the views.

---

## 17. Render Debouncing with `setImmediate`

```js
let renderQueued = false;
const scheduleRender = () => {
  if (renderQueued) return;
  renderQueued = true;
  setImmediate(() => {
    renderQueued = false;
    screen.render();
  });
};
```

100 events in one tick → 1 render. Standard pattern, well-applied here.

---

## 18. Resolution-vs-WxH Dispatch

Different image APIs want different shapes. One predicate:

```js
const RESOLUTION_BASED_MODELS = ['nano-banana-pro-ultra', 'nano-banana-pro',
                                 'riverflow-2-max', 'wan-2.6-image-edit'];
function isResolutionBasedModel(model) {
  return RESOLUTION_BASED_MODELS.some(m =>
    model && model.toLowerCase().startsWith(m.toLowerCase()));
}

if (isResolutionBasedModel(model) || options.resolution) {
  requestBody.resolution = options.resolution || 'auto';
  if (options.aspect_ratio) requestBody.aspect_ratio = options.aspect_ratio;
} else {
  requestBody.width = width;
  requestBody.height = height;
  requestBody.resolution = `${width}x${height}`;
}
```

Operator never has to think about which camp a model belongs to. Pass `[4096x4096]` AND `[aspect_ratio=16:9]` and the right one gets sent. Same idea works anywhere you've got "two API shapes for the same conceptual operation".

---

## 19. SOCKS Proxy via Per-Fetch Agent

```js
const proxyAgent = new SocksProxyAgent('socks://127.0.0.1:9050');
// API calls → through proxy
fetch(API_URL, { ..., agent: proxyAgent });
// Local media server → no proxy (it's on local network)
fetch(`${MEDIA_SERVER_URL}/image/${id}/image`);
```

Trivial, but if you're routing some traffic through Tor/SOCKS and other traffic direct, the per-call `agent` toggle is cleaner than env-level proxy config.

---

## 20. Warn-and-Continue Defaults

The whole script defaults to "warn and proceed" instead of "fail loudly":

- Reference fails to load → warn, drop it, continue with the rest
- Total payload exceeds limit → warn, truncate refs, continue
- More refs than API supports → warn, slice to limit, continue
- Wildcard count > 10 → warn, cap at 10, continue
- Prompt re-read fails mid-job → warn, fall through to cached, continue
- Embedding generation unavailable → silently store NULL, continue
- Disabled queue line (`?` prefix) → log "skipping disabled", continue

For long-running batch jobs, this is the right tradeoff. **Hard failures only at boundaries** (no valid refs at all, no prompt at all). Everything else is a degraded-but-running state.

---

## What I'd Actually Steal First (image_gen.cjs)

1. **Wildcard reference mini-language** — `!folder`, `!!folder`, `!#N`, `@?`, `{a|b|c}`, `$alias`. Maximum operator expressiveness from minimum syntax. Steal this whenever you've got "user supplies a list of artifacts".
2. **Tagged wildcards with conditional follow-ups** — `{a<tag>|b<tag>}` + `<tag:then-this>`. Lets you compose mutually-exclusive narrative branches in one template.
3. **queue.txt micro-DSL** — positional + `key=value` extensions + `?`/`!` flag prefixes/suffixes. The disable-flag pattern is the gold.
4. **Single source of state, multiple views** — EventEmitter-based JobManager driving TUI + web + SSE all at once. Zero state duplication.
5. **Per-prompt AND per-reference failure telemetry** — surfaces the bad apple in any multi-input → single-output system.
6. **Adaptive image compression with per-image budget calc** — quality stepdown + dimension floor + hard floor at quality=50. Generalizes to any "fit N items in M total bytes" problem.
7. **Two-tier rate + concurrency limiting** with EventEmitter `slot-available` re-wake. Self-clocking dispatcher.
8. **Live prompt reload per batch** — operator can edit the source mid-run, next iteration picks up. Combined with wildcard prompt names = adaptive long-running jobs.
9. **Path aliases (`$home`, `$collection`)** — trivial, but *every* config-driven tool should have this. No more `../../../`.
10. **CSV + SQLite double-write** — eyeballable + queryable, both for free.

---

# shittyresearchtool — multi-agent research orchestrator

Source: `/home/siah/creative/shittyresearchtool` (~700 lines across 7 small files).
Stack: Node.js (ESM) + Playwright (with custom stealth init script) + cheerio + Turndown + OpenAI SDK pointed at nano-gpt + child_process.spawn (despite a `tmux.js` that's not actually used).

User writes `research.md` with queries + density + swarm size. A head agent orchestrates: **search agents** in parallel (each generates query variations → searches Google/DDG → AI-ranks results → writes a markdown file) → **reading agents** in parallel (each fetches & summarizes the URLs from one search file → writes a markdown file) → head agent aggregates and synthesizes a final report. All inter-agent communication is via temp markdown files in `tmp/`.

Lots of overlap with the prior projects — calling those out explicitly.

---

## 1. Markdown-as-config (research.md drives the run)

Operator writes the entire job as a markdown document with embedded structured fields:

```md
## Configuration
- **density**: deep
- **swarmSize**: 3
- **outputFile**: research-output.md

## Context
Provide any existing knowledge here that agents should be aware of.

## Queries
1. What are the latest advancements in multi-agent AI systems?
2. How do modern web scraping techniques avoid bot detection?
3. What are the best practices for distributed task coordination?
```

Parser uses targeted regex over the markdown — `**density**:`, `**swarmSize**:`, `## Queries\n([\s\S]*?)`, then number-prefix line filter. The whole config IS the research artifact — there's no separate "this is config, this is content" split.

> **↻ Recurring (seen in: image_gen.cjs `queue.txt`, npc.builder forged-context names/tags).** Three independent projects, three independent text-with-embedded-fields formats. The instinct to reject JSON/YAML for operator-facing config is consistent. Promote: write a tiny shared "markdown config parser" lib.

---

## 2. Per-Role Model Assignment (cheap-for-filter, expensive-for-synthesis)

`config.json` assigns **different models** to different agent roles:

```json
"headAgent":     { "model": "claude-opus-4-5:thinking", "temperature": 0.7, "maxTokens": 200000 },
"searchAgents":  { "model": "claude-haiku-4-5",         "temperature": 0.3, "maxTokens":   8000 },
"readingAgents": { "model": "claude-sonnet-4-5",        "temperature": 0.5, "maxTokens": 1000000 }
```

Logic:
- **Head** = Opus thinking — synthesis, large output, creative
- **Search** = Haiku — cheap, fast, low temp for deterministic ranking
- **Reading** = Sonnet 1M — needs huge context to ingest full pages

Per-role temperature too. The `chat()` helper takes an `agentType` and looks up the right config:

```js
const agentConfig = cfg[agentType] || cfg.headAgent;
client.chat.completions.create({
  model: agentConfig.model,
  temperature: agentConfig.temperature,
  max_tokens: agentConfig.maxTokens,
  messages,
});
```

> **↻ Recurring (seen in: npc.builder cascading orchestrator).** npc.builder split judge (Gemini Flash, cheap+accurate) from generator (GPT-4o, expensive+capable). Same pattern, different phase decomposition. Generalize: every multi-step LLM pipeline should explicitly map step → model. Don't pick "the model" for the whole pipeline.

---

## 3. AI-Augmented Search: Query Expansion + LLM-as-Ranker

The search agent doesn't search the user's literal query. Two LLM passes bookend the actual fetching:

**Pass 1: query expansion** — "generate 3-5 diverse search queries that would help find relevant information":

```js
async function generateSearchQueries(originalQuery) {
  const response = await chat([
    { role: 'system', content: 'You are a research assistant that generates effective search queries...' },
    { role: 'user', content: `Generate search queries for: ${originalQuery}` }
  ], 'searchAgents');
  return response.split('\n').filter(q => q.trim()).slice(0, 5);
}
```

**Pass 2: LLM-as-ranker** — after fetching all results across all queries, blacklist-filter, dedupe by URL, then if >5 results, ask the model to rank by relevance:

```js
const systemPrompt = `Given a query and search results, rank them by relevance.
Return only the indices (0-based) of the top 10 most relevant results, comma-separated.`;
const response = await chat([...]);
const indices = response.match(/\d+/g)?.map(Number) || [];
const ranked = indices.filter(i => i >= 0 && i < unique.length).map(i => unique[i]).slice(0, 10);
return ranked.length > 0 ? ranked : unique.slice(0, 10);
```

The **integer-list-from-LLM** trick: ask for "comma-separated indices", regex-extract digits, validate range, **fall back to original order** if the LLM goes off the rails. Robust LLM output parsing without JSON-mode dependencies.

---

## 4. Comprehensive Stealth Script (8 detection-vector patches)

`STEALTH_SCRIPT` is a single `addInitScript` that patches every common browser-automation detection vector:

```js
// 1. Hide webdriver flag
Object.defineProperty(navigator, "webdriver", { get: () => undefined });
delete navigator.__proto__.webdriver;

// 2. Mock plugins array (Chrome PDF Plugin, PDF Viewer, NaCl)
Object.defineProperty(navigator, "plugins", { get: () => [...] });

// 3-4. Languages, hardware concurrency, deviceMemory
Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });

// 5. window.chrome runtime stub
window.chrome = { runtime: {...}, loadTimes: () => ({...}), csi: () => ({...}) };

// 6. Permissions API (notifications → "denied")
Permissions.prototype.query = function(p) { ... };

// 7. WebGL vendor/renderer (Intel Iris)
WebGLRenderingContext.prototype.getParameter = function(p) {
  if (p === 37445) return "Intel Inc.";
  if (p === 37446) return "Intel Iris OpenGL Engine";
  ...
};

// 8. Document hidden / visibility (always "visible")
Object.defineProperty(document, "hidden", { get: () => false });
```

Combined with launch args `--disable-blink-features=AutomationControlled`, custom UA, viewport, locale. Self-contained — no `puppeteer-extra-plugin-stealth` dependency. Worth lifting wholesale.

---

## 5. Search Engine Fallback Chain

```js
export async function search(query, maxResults = 10) {
  try {
    const results = await searchGoogle(query, maxResults);  // try with stealth
    if (results.length > 0) return results;
  } catch (e) { /* swallowed */ }
  try {
    return await searchDuckDuckGo(query, maxResults);  // fall back
  } catch (e) { return []; }  // ultimate: empty list
}
```

DDG result extraction tries **three selector strategies** because the page changes:

```js
let searchResults = document.querySelectorAll('[data-testid="result"]');
if (searchResults.length === 0) searchResults = document.querySelectorAll('article[data-testid="result"]');
if (searchResults.length === 0) searchResults = document.querySelectorAll('.result__body');
```

Each result tries multiple title/snippet selectors:

```js
const titleEl = result.querySelector('h2 a')
              || result.querySelector('a.result__a')
              || result.querySelector('[data-testid="result-title-a"]');
```

> **↻ Recurring (seen in: npc.builder provider fallback walk, image_gen reference resolution layered lookup).** Same shape every time: ordered list of strategies, walk it, succeed at first useful output. The DOM-selector chain is the same idea applied at sub-DOM granularity. Generalize: **walk-until-success** is a universal scrape/extract/recover pattern in this codebase.

---

## 6. Content Extraction Pipeline (HTML → main element → markdown)

`fetchPageContent(url)` runs a clean five-stage pipeline:

1. Playwright `goto(..., {waitUntil: 'domcontentloaded'})` → `page.content()`
2. cheerio parse, **strip noise** (`script, style, nav, footer, header, aside, .ad, .ads, .advertisement, [role="banner"], [role="navigation"]`)
3. Try main-content selectors in order: `main` → `article` → `[role="main"]` → `.content` → `.post-content` → `.article-content` → `#content`. Use first one with >200 chars.
4. Fall back to `body.html()` if no main found
5. Turndown the HTML → markdown, cap at 50,000 chars, count words

Returns `{url, title, description, content, wordCount}` or `{url, error}`. Errors return a result-shaped object, never throw — caller decides skip vs retry.

> **↻ Recurring (selector chain ↻):** the main-content fallback chain is the same shape as the search engine fallback and image_gen's reference extension chain.

---

## 7. Filesystem-as-IPC Between Agents

Sub-agents are **separate Node processes** that communicate by writing markdown files into `tmp/`:

```
tmp/search-0.md   ← written by searchAgent.js --id=search-0
tmp/search-1.md   ← written by searchAgent.js --id=search-1
tmp/reader-0.md   ← reads tmp/search-0.md, writes here
tmp/reader-1.md   ← reads tmp/search-1.md, writes here
```

Head agent collects readers' files at the end, concatenates with HTML-comment markers:

```js
allContent += `\n\n<!-- From ${agentId} -->\n${content}`;
```

The `<!-- From X -->` markers are invisible in rendered markdown but greppable in source — cheap "machine-tagged human-readable concatenation".

> **↻ Recurring (out-of-process state store ↻).** image_gen wrote to CSV+SQLite; npc.builder uses Postgres; this uses flat markdown files. All three put cross-component data **outside the process**. Files are the lowest-friction option when you don't need queries or transactions.

---

## 8. Process-per-Agent via `spawn()`

Sub-agents are full standalone Node scripts (`searchAgent.js`, `readingAgent.js`) — each has its own `run()` and is invoked from the bottom: `run().catch(console.error)`. The head agent fires them with `child_process.spawn`:

```js
const proc = spawn('node', [
  'src/agents/searchAgent.js',
  `--id=${agentId}`,
  `--query=${query}`,
  `--output=${outputFile}`,
], { cwd: process.cwd(), stdio: 'inherit' });
proc.on('close', code => code === 0 ? resolve() : reject(new Error(`exited ${code}`)));
```

`stdio: 'inherit'` means sub-agent logs **interleave to the same terminal** — chaotic but useful for live debugging. The agents could in principle live on different machines (with shared FS) without changing the protocol.

Note the **dead `tmux.js`**: there's a whole module of `createSession`/`runInPane`/`createPane` exports, but `spawnSearchAgent` actually uses plain `spawn()`. The tmux path was abandoned for plain process spawning. Worth noting because the original design intended terminal multiplexing for visual parallelism.

---

## 9. CLI Args via One-Line Reduce

Every sub-agent parses argv with this:

```js
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key.replace('--', '')] = value;
  return acc;
}, {});
const agentId = args.id || 'search-0';
const query = args.query || '';
```

No yargs/commander/minimist. Three lines. Perfect for tiny single-purpose scripts where the args are all `--key=value` shape. (Caveat: doesn't handle quoted values, flags-without-values, or negative numbers. Fine for this use case.)

---

## 10. Phased Pipeline with Logged Stage Headers

`HeadAgent.run()` is a clean six-step linear flow:

```js
async run() {
  await this.initialize();
  await this.runSearchPhase();      // logs: '=== SEARCH PHASE ==='
  await this.runReadingPhase();     // logs: '=== READING PHASE ==='
  const aggregated = await this.aggregateFindings();  // '=== AGGREGATION PHASE ==='
  const report = await this.synthesizeReport(aggregated);  // '=== SYNTHESIS PHASE ==='
  await this.writeOutput(report);
}
```

Each phase is a separate method. Each logs a banner. Trivial pattern but maximally observable — when something breaks you immediately know which phase. Also makes it easy to skip/test individual phases later.

---

## 11. Naive Batching with `swarmSize` Cap

```js
const batches = [];
for (let i = 0; i < searchTasks.length; i += swarmSize) {
  batches.push(searchTasks.slice(i, i + swarmSize));
}
for (const batch of batches) {
  await runAgentsParallel(batch);  // Promise.allSettled
}
```

Slice tasks into chunks of `swarmSize`, run each chunk in parallel via `Promise.allSettled`, wait, next chunk. **Naive** — a chunk doesn't start until the previous fully completes, even if some chunk-N agents finish fast. Compare to image_gen's smarter global-queue + EventEmitter `slot-available` dispatcher that keeps the pipe always-full.

Worth keeping the naive version when:
- You don't need maximum throughput
- The work is symmetric (similar runtime per task)
- You want phase-level checkpointing (all batch-1 done before batch-2 starts)

But when you need throughput, the image_gen pattern wins. **The two patterns are both valid; pick by need.**

---

## 12. `Promise.allSettled` for Bulk-Tolerant Parallelism

```js
export function runAgentsParallel(agents) {
  return Promise.allSettled(agents.map(agent => agent()));
}
```

One bad agent doesn't kill the batch. Combined with per-agent error handling that **writes an error markdown file instead of throwing**:

```js
catch (error) {
  const errorOutput = `# Search Error\n\n**Agent ID**: ${agentId}\n**Query**: ${query}\n**Error**: ${error.message}\n`;
  fs.writeFileSync(outputFile, errorOutput);
}
```

→ The pipeline keeps going, downstream readers see a recognizable error file (and skip it via missing-content checks), and the final report still gets generated from the successful subset.

> **↻ Recurring (warn-and-continue ↻).** image_gen's "warn-and-continue defaults" + npc.builder's silent fallbacks = same philosophy. **Default to graceful degradation in long-running pipelines.** Codify this.

---

## 13. Singleton Browser/Page Reuse

```js
let browser = null, context = null, page = null;
export async function getBrowser() {
  if (!browser || !browser.isConnected()) browser = await chromium.launch({ ... });
  if (!context) {
    context = await browser.newContext({ userAgent, viewport, locale });
    await context.addInitScript(STEALTH_SCRIPT);
  }
  if (!page || page.isClosed()) page = await context.newPage();
  return page;
}
```

Three-level liveness check (`isConnected`, exists, `isClosed`). One Chromium per process, reused across many fetches. `closeBrowser()` for explicit cleanup. Saves ~500ms-1s per call.

Subtle: this means **all fetches in one agent share session state** (cookies, localStorage). For research crawling that's actually what you want — sites that want a session see one consistent visitor.

---

## 14. Streaming Synthesis to Stdout

```js
let report = '';
await chatStream(messages, 'headAgent', chunk => {
  process.stdout.write(chunk);
  report += chunk;
});
```

Pipe-as-you-go for the final synthesis. Operator sees the report being written in realtime instead of staring at a blank screen for 60 seconds. The same chunk callback both prints and accumulates — single source of truth.

> **↻ Recurring (streaming output ↻).** npc.builder character generation + image_gen SSE event stream. Universal: **never make the user wait for the whole buffer.**

---

## 15. OpenAI SDK Pointed at Nano-GPT

```js
client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.apiUrl });
// cfg.apiUrl = "https://nano-gpt.com/api/v1"
```

OpenAI SDK + custom `baseURL` = use any OpenAI-compatible gateway (nano-gpt, LiteLLM, LM Studio, Anthropic-compat-mode, OpenRouter). One swap of `baseURL` = whole new model universe. The model name in `chat.completions.create({model: ...})` does the routing on the gateway side.

> **↻ Recurring (OpenAI-compat shim ↻).** All three projects target nano-gpt as the gateway. **nano-gpt is the de facto provider in this codebase.** Worth noting in any future project that `baseURL: 'https://nano-gpt.com/api/v1'` is the default expectation.

---

## What I'd Actually Steal First (shittyresearchtool)

1. **Comprehensive stealth init script** — 8 detection-vector patches in one self-contained snippet, no dependency on `puppeteer-extra`. Lift wholesale for any browser-automation work.
2. **AI-augmented search: query expansion + LLM-as-ranker** — turning a single user query into N expanded queries, then ranking aggregated results back down to top 10 via LLM. The integer-list-from-LLM with regex extraction + fallback is the robust pattern.
3. **Per-role model assignment** with per-role temperature + maxTokens. Trivially simple to copy, big effect.
4. **Phased pipeline with stage banners** — a `run()` that's just six labeled `async` calls. Maximally observable.
5. **Process-per-agent via `spawn()`** — sub-agents as standalone scripts, communicating via temp markdown files. The protocol is "filename + id + content" — no IPC framework, no message bus.
6. **HTML → main-element → markdown content pipeline** — strip noise selectors → try main-content selectors in order → turndown. Reusable for any "what's the actual article on this page" task.
7. **Singleton browser with three-level liveness check** — `isConnected`, exists, `isClosed` — recreates only what's broken. Cuts ~500ms-1s per fetch.
8. **HTML-comment section markers** — `<!-- From X -->` for machine-tagged human-readable concatenation. Trivial, surprisingly useful.

## Patterns Resurfaced (signal)

The recurring-pattern callouts above this section list the overlaps. Most loudly resurfaced this round:

- **Markdown-as-config** (3rd appearance) → factor into a shared parser
- **Strategy fallback chain** (3rd appearance, now seen at API/file/DOM levels) → universal habit, treat as a core operating principle
- **Warn-and-continue defaults** (3rd appearance) → codify as a rule for any pipeline tool
- **OpenAI-compatible API shim** (3rd appearance, all targeting nano-gpt) → nano-gpt is the default, build for it
- **Per-job/stable IDs** (3rd appearance) → addressing scheme for everything
- **Streaming/incremental output** (3rd appearance) → never buffer whole responses
- **Out-of-process state store** (3rd appearance) → next time, start with a state store, don't bolt one on later

---

# engaige — social simulation with autonomous NPCs

Source: `/home/siah/creative/engaige/server/src` — 143 files, ~51k lines.
Stack: Bun runtime + TypeScript + bun:sqlite (3 DBs) + WebSocket (`ws://localhost:4269/ws`) + custom HTTP "door" with SOCKS/HTTP proxy + Tauri/React frontend (the "dumb terminal").

A relationship simulator + social media game. NPCs have personalities, post on MyFace/Chirp/Instasnap autonomously, build relationships with each other, have affairs, get caught, post drama. The player is one user among many. **All game logic is server-side**; the frontend just displays.

This is the largest project in the catalog and the densest source of novel patterns. Most distinctive: the **StALk DSL with social-fallout static analysis**, the **deliberation system with chaos-driven thinking depth**, the **awareness service** (NPCs only react to posts they've actually seen), and the everywhere-applied **"all X go through this single door"** architecture.

---

## 1. StALk DSL with Pop-Safety Analyzer (most original idea in the catalog)

A custom domain-specific language (`.stalk`) for player-authored "social plays" — programs that post things, send DMs, modify relationship state. Has a real lexer/parser/AST/interpreter (`stalk/`). The killer feature: **a static analyzer that scores programs for SOCIAL fallout before execution.**

```ts
interface SocialFalloutPrediction {
  screenshotRisk: number;       // 0-1: chance someone screenshots and shares
  relationshipDamage: number;   // 0-1: trust/affinity hit
  viralPotential: number;       // 0-1: how far it spreads
  cringeScore: number;          // 0-1: aesthetic damage to player
  affectedNPCs: string[];
}
interface PopWarning {
  severity: "info" | "warn" | "pop" | "panic";
  message: string;
  hint?: string;
  socialFallout?: SocialFalloutPrediction;
}
```

Programs declare blocks: `REQUIRE` (capabilities), `DISCLAIMER` (boilerplate hedges), `PREDICT` (claims with `CONFIDENCE` 0-1 and `EVIDENCE` text), `IMPACT` (audience-targeted POST/DM/REACT actions). The analyzer cross-references everything:

```ts
// High confidence + weak evidence = pop risk
if (confidence > 0.8 && evidence.length < 20) {
  warnings.push({ severity: "pop", message: "High confidence with weak evidence",
    socialFallout: { screenshotRisk: 0.8, viralPotential: 0.6, cringeScore: 0.7, ... } });
}

// "Trust me" type evidence
const weakPhrases = ["trust me", "obviously", "everyone knows", "i feel"];
if (weakPhrases.some(p => evidence.toLowerCase().includes(p))) { ... }

// Cringe hours
if (currentHour >= 2 && currentHour <= 5 && audiences.has("PUBLIC")) {
  warnings.push({ severity: "pop", message: "Public post during cringe hours (2-5 AM)",
    hint: "Posts made at this hour often age poorly. Sleep on it." });
}

// Mass actions in FOR loop
if (forLoop.body.has(PostAction|DMAction|ReactAction)) {
  warnings.push({ severity: "pop", message: "Mass social action in FOR loop",
    hint: "Sending many messages/posts at once may appear spammy" });
}

// Capability stacking
if (capabilities.has("ALLOW_VIRALITY")) { /* "amplifies success AND failure" */ }
if (capabilities.has("ALLOW_SYSTEMIC")) { /* "can affect global game state" */ }
```

Worst-case generator produces narrative output:

```
KERNEL POPPED

Reason:
  - High confidence (95%) with weak evidence
  - Public post during cringe hours (2-5 AM)
  - Mass social action detected in FOR loop

Consequences:
  - Screenshots archived permanently
  - Multiple NPCs questioning your judgment
  - Reputation recovery may take weeks

The internet never forgets.
```

**Why steal it:** the *idea* of static analysis for social/safety/UX risk (not just type/correctness) generalizes way past games. Anywhere you have user-authored programs that affect shared state — bots, automations, IFTTT-likes, RPA — a "pop-safety" analyzer that warns about confidence/audience/timing/spam-pattern risks would be valuable. The cringe-hours check alone is worth the framework.

---

## 2. Centralized Event Bus as Master Log

ALL game events flow through `eventBus`. Every event is persisted to a SQLite `game_events` table AND broadcast to in-process subscribers. The CLAUDE.md says "ALL game events MUST go through here" three different ways.

```ts
eventBus.fire(EventTypes.CONVERSATION_MESSAGE_SENT,
  { message_id: id, content: message, word_count: message.split(/\s+/).length },
  { source: "conversation", player_id, npc_id, importance: 0.5 }
);
// or await for the event ID (parent_event_id chains):
const event = await eventBus.emit(EventTypes.X, payload, context);
```

Schema is rich for retroactive querying:

```sql
CREATE TABLE game_events (
  id TEXT PRIMARY KEY, event_type TEXT, category TEXT,
  player_id TEXT, npc_id TEXT, conversation_id TEXT, post_id TEXT,
  payload TEXT NOT NULL,            -- JSON
  source TEXT NOT NULL,             -- emitting service
  session_id TEXT,
  timestamp INTEGER NOT NULL,
  importance REAL DEFAULT 0.5,      -- 0-1
  parent_event_id TEXT              -- causal chain
);
```

Three subscriber modes: `on(eventType, fn)`, `onCategory(category, fn)`, `onAll(fn)` — each returns an unsubscribe function. Plus `once(eventType, fn)`.

**Auto-importance from event-type substring matching** (no manual tuning):

```ts
if (eventType.includes('stage_changed')) return 1.0;
if (eventType.includes('milestone'))     return 0.9;
if (eventType.includes('error'))         return 0.8;
if (eventType.includes('typing'))        return 0.1;   // high-volume noise
if (eventType.includes('task_failed'))   return 0.7;
```

Console-log gate: `if (importance >= minConsoleImportance) logEvent()` — high-volume events don't spam logs but still persist for debugging.

**Causal chains via `parent_event_id`** + `getEventChain(id)` traces back to root:

```ts
getEventChain(eventId): GameEvent[] {
  let currentId = eventId;
  const events = [];
  while (currentId) {
    const event = this.getById(currentId);
    if (!event) break;
    events.unshift(event);
    currentId = event.parent_event_id ?? null;
  }
  return events;
}
```

Plus query helpers: `getByType / getByCategory / getByNPC / getByPlayer / getByConversation / getBySource / getSignificantEvents(since, minImportance) / search(payload LIKE) / countByType / countByCategory / getRecent`.

> **↻ Recurring (event sourcing pattern, but applied to a game).** This is the npc.builder pattern (events with significance scores) + image_gen pattern (telemetry as first-class) taken to a structural extreme. **Make it real**: the next project that has more than two services should start with this exact event bus.

---

## 3. AI Queue with Priority-Tier Budget Reservation

5 priority levels each with a budget reserve, a min-budget gate, and a max queue lifetime:

```ts
TIER_CONFIG = {
  CRITICAL: { reserve: 40%, minBudget:  0%, canDefer: false, maxQueueTime:    30s },  // user DMs
  HIGH:     { reserve: 25%, minBudget:  5%, canDefer: true,  maxQueueTime:    60s },  // NPC follow-ups
  MEDIUM:   { reserve: 20%, minBudget: 35%, canDefer: true,  maxQueueTime:   300s },  // scheduled
  LOW:      { reserve: 10%, minBudget: 50%, canDefer: true,  maxQueueTime:  3600s },  // background posts
  IDLE:     { reserve:  5%, minBudget: 80%, canDefer: true,  maxQueueTime: 86400s },  // pre-gen, analytics
};
```

Critical never deferred. Lower tiers gated by remaining budget %. Deferred queue auto-drains every 60s when budget refills:

```ts
private shouldDeferRequest(request): { defer: boolean; reason: string } {
  if (isBudgetUnlimited()) return { defer: false };
  const tier = TIER_CONFIG[request.priority];
  if (!tier.canDefer) return { defer: false };  // critical proceeds even at 0%
  const remainPct = (status.remaining_cents / status.overall_limit_cents) * 100;
  if (remainPct < tier.minBudgetPercent) return { defer: true, reason: ... };
  // Reserve calculation: don't burn LOW budget if HIGH might need it
  const reservedForHigher = this.calculateReservedBudget(request.priority);
  if (status.remaining_cents - reservedForHigher < request.estimatedCost)
    return { defer: true, reason: "Reserved for higher priority" };
}
```

**Promise-based wait via `pendingPromises` Map** — caller `await aiQueue.enqueue(...)` resolves when the request actually completes (or expires, or fails). Decoupled from queue mechanics.

Retry on transient errors with exponential backoff:

```ts
const retryablePatterns = [/rate.*limit/i, /timeout/i, /503/, /429/, /network.*error/i];
if (request.attempts < 3 && retryable) {
  setTimeout(() => { this.queue.unshift(request); this.sortQueue(); },
    Math.pow(2, request.attempts) * 1000);
}
```

> **↻ Recurring (priority queue + concurrency limiting).** image_gen had two-tier rate+concurrency limiters. engaige adds **per-tier budget reserve** semantics (this tier may eat at most 40% of the daily budget) which is a real innovation. **Promote**: the canonical "AI request scheduler" lib in the future combines image_gen's limiters with engaige's budget reserves.

---

## 4. Output Validator with Cheap-Model Judge + Auto-Fix Ladder

Multi-stage validator that catches AI failures (refusals, AI-speak, immersion breaks, profanity, sexual content, romantic content per content rating) and rewrites them in-character before they reach the user.

The ladder:

```
1. Quick pattern check (FREE) — REFUSAL_PATTERNS + IMMERSION_BREAK_PATTERNS regex
2. Guardrail check (FREE) — pattern check against current content rating
3. AI validation (CHEAP) — gpt-4o-mini judges output against NPC profile, returns JSON
4. If invalid: generate fallback with corrective prompt (calls main model again)
5. Up to N retries
6. Ultimate fallback: pre-generated deflection from npc.json_data.fallback_responses
                     keyed by failure_type (uncomfortable_topics / playful_dodges / topic_changes / deflections)
7. If even that fails: hard-coded generic deflections with optional emoji
```

```ts
// 17 pre-generated fallback responses per NPC = "immersion protection"
const genericDeflections = [
  `hmm not really sure what to say about that tbh${useEmoji ? ' 😅' : ''}`,
  `let's talk about something else${useEmoji ? ' 💭' : ''}`,
  `idk that's kinda weird to talk about lol`,
  `anyway${useEmoji ? ' ✨' : ''} what else is up?`,
  `ngl that's not really my vibe`,
];
```

**Fail-open on validator errors**: if the validator itself crashes, return `{is_valid: true, confidence: 0.3}` — don't block delivery because the watchdog is down.

```ts
// REFUSAL_PATTERNS — comprehensive AI-speak detection
[/i('m| am) sorry,? (but )?i can'?t/i,
 /as an ai/i,
 /i don'?t have the ability/i,
 /that would be inappropriate/i,
 /against my (programming|guidelines)/i,
 /i'?m afraid i can'?t/i, ...]

// IMMERSION_BREAK_PATTERNS
[/as an? (ai|language model|assistant)/i,
 /i('m| am) (just )?a(n)? (ai|bot|program|simulation)/i,
 /in (this|the) (game|simulation|roleplay)/i,
 /\[skip\]/i,                             // group chat skip leak
 /\[ooc\]/i, ...]                         // out of character marker
```

> **↻ Recurring (cheap-judge / expensive-generator + warn-and-continue).** This is npc.builder's identity-crisis detector + cascading orchestrator + image_gen's quality stepdown all in one. The pre-generated deflection bank is the new piece — when EVERYTHING fails, you still ship a believable response. **Generalize**: any AI-facing system needs this exact pipeline.

---

## 5. Multi-Rating Content Guardrails (with prompt-side enforcement)

Five content ratings: `harsh | strict | normal | relaxed | none`. Per rating: `allow_explicit_language`, `allow_sexual_content`, `allow_romantic`, `allow_nsfw_images`. Pattern-matched at output time AND prepended to image-gen prompts:

```ts
// Image gen safety prefix — only when needed
let safePrompt = prompt;
if (guardrailConfig && !guardrailConfig.allow_nsfw_images) {
  safePrompt = `SFW, tasteful, appropriate, safe for work: ${prompt}`;
}
```

Pattern banks for each violation type:

```ts
PROFANITY_PATTERNS = [/\bfuck/i, /\bshit/i, /\bbitch/i, ...]
SEXUAL_CONTENT_PATTERNS = [/\bsex/i, /\bnaked/i, /\borgasm/i, /\bhorny/i, ...]
ROMANTIC_PATTERNS = [/\blove you/i, /\bkiss/i, /\bcuddle/i, /\bdating/i, ...]
```

Each violation fires `GUARDRAILS_VIOLATION_DETECTED` on the event bus → analytics + logged.

---

## 6. Deliberation: Variable Forced-Thinking Loops with Chaos

The wildest LLM technique in the catalog. Calculates **how many `<think>` loops** an NPC should do before answering, based on personality + relationship + topic + a chaos seed:

```ts
factors = {
  // Personality
  overthinking_tendency, impulsivity, anxiety_level, confidence_on_topic,
  // Relationship
  relationship_stage, has_crush, trust_level, familiarity,
  // Message
  is_personal_question, is_sensitive_topic, message_complexity, requires_emotional_response,
  // Chaos
  chaos_seed,  // random per interaction
}
```

Rules:

```ts
if (overthinking_tendency > 0.7) baseDepth += 1;
if (impulsivity > 0.7)           baseDepth -= 1;
if (anxiety_level > 0.6)         baseDepth += 1;
if (relationship_stage === 'stranger') baseDepth += 1; // "am I being weird?"
if (has_crush)                   baseDepth += 2;       // "overthinking everything"
if (trust > 80 && fam > 70)      baseDepth -= 1;       // "comfortable, less filtering"
if (is_personal_question)        baseDepth += 1;
if (is_sensitive_topic)          baseDepth += 1;
if (confidence_on_topic > 0.8)   baseDepth -= 1;

// CHAOS — 15% chance of inverse complexity behavior
if (chaos < 0.15) {
  if (message_complexity < 0.3) { baseDepth += 2;  // "randomly fixating on something simple"
                                   shouldOverthinkSimple = true; }
  else if (message_complexity > 0.7) { baseDepth -= 2; }  // "randomly breezing through"
}
```

Output classified `quick | normal | deliberate | agonizing` (1, ≤2, ≤4, ≤7 loops).

The execution uses **`</think>` as STOP sequence** to force the model to surface its reasoning. Each loop appends to an `assistant: <think>...` partial; final call removes the stop sequence and lets the model produce its real reply:

```ts
for (let i = 0; i < depth.target_loops; i++) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: options.message },
    accumulatedThoughts.length > 0
      ? { role: 'assistant', content: `<think>\n${accumulatedThoughts.join('\n\n')}\n\n` }
      : null,
  ].filter(Boolean);

  const thought = await callWithStopSequence(messages, config, ['</think>']);
  if (thought) accumulatedThoughts.push(thought);
}

// Final call — no stop sequence, let the model reply
const finalResponse = await callWithoutStopSequence([..., {
  role: 'assistant',
  content: `<think>\n${accumulatedThoughts.join('\n\n')}\n</think>\n\n`,
}], config);
```

**Why steal it:** the technique generalizes — *any* model can be coerced into n-step reasoning by stop-sequence-and-resume. The formula for depth is gold for any character-driven AI: weight by personality, weight by stakes, add chaos so it's not deterministic.

> **↻ Recurring (chaos seed for human-like variance).** echoes npc.builder's emotional-significance-affecting-rank — both are "give the system permission to be unpredictable in non-broken ways."

---

## 7. Runtime Tools (Function Calling) Bridged Across Providers

Single tool definition compiled to either OpenAI function-calling format OR Anthropic tool-use format:

```ts
function getToolDefinitions(provider: 'openai' | 'anthropic'): any[] {
  const tools = Object.values(RUNTIME_TOOLS).map(t => t.definition);
  if (provider === 'openai') {
    return tools.map(t => ({ type: 'function', function: {
      name: t.name, description: t.description, parameters: t.parameters,
    } }));
  } else if (provider === 'anthropic') {
    return tools.map(t => ({
      name: t.name, description: t.description, input_schema: t.parameters,
    }));
  }
}
```

Every tool returns `{success, message, ...data}` — the message is in-character so the AI can react to failures gracefully without breaking immersion:

```ts
catch (error) {
  return {
    success: false,
    error: error.message,
    message: 'Sorry, I had trouble generating that image. Let me try describing it instead.',
  };
}
```

Default tools: `generate_image`, `search_memories`, `check_relationship`, `get_current_time`. Tool registry is `Record<string, {definition, handler}>` — adding a new tool is one entry.

---

## 8. Vision/Image Generation Proxy (Capability Gap Polyfill)

The killer abstraction: when an NPC's selected model **lacks** a capability, transparently route through a capable model. The NPC never knows.

```ts
async function analyzeImageForNPC(npcId, imageUrl, userMessage) {
  const npc = getNpc(npcId);
  if (supportsVision(npc.model_name)) {
    return { imageDescription: '', npcCanRespondDirectly: true };  // skip proxy
  }
  // NPC's model doesn't support vision → use proxy
  const description = await analyzeImage(imageUrl, prompt, { npcName: npc.display_name });
  return { imageDescription, npcCanRespondDirectly: false };
}
```

Image generation has the same shape — if the active provider doesn't support reference images (`reference_images_key`), fall back to: vision-proxy describes the reference → text description appended to prompt → generate without reference. Two-step polyfill.

```ts
// generateImageWithCharacterReference — fallback when img2img not supported
if (!provider.reference_images_key) {
  const characterDescription = await analyzeImage(referenceImageUrls[0],
    'Describe this person\'s appearance in detail for image generation: age, gender, hair, clothing style, distinctive features.');
  const enhancedPrompt = `${prompt}. The main character looks like: ${characterDescription}`;
  return await generateImage(enhancedPrompt, undefined);
}
```

> **↻ Recurring (strategy fallback chain + capability detection).** This is the same pattern as the search engine fallback in shittyresearchtool, but at the model-capability level. Anywhere you support multiple backends with different capabilities, do this.

---

## 9. Drama Engine: Personality-Keyed Templates + Tick-Based Discovery

Maps Big-Five personality (extraversion / agreeableness / conscientiousness / neuroticism / openness) → 5 drama personality types:

```ts
function getDramaPersonality(p): DramaPersonalityType[] {
  const types = [];
  if (p.extraversion > 60 && p.neuroticism > 50) types.push('dramatic');
  if (p.agreeableness < 50 && p.neuroticism > 50) types.push('petty');
  if (p.agreeableness > 60 && p.neuroticism < 40) types.push('mature');
  if (p.extraversion < 50 || p.conscientiousness > 60) types.push('subtle');
  if (p.openness > 60 && p.conscientiousness < 50) types.push('chaotic');
  return types.length === 0 ? ['subtle'] : types;
}
```

NPCs can be **multiple types simultaneously** — this is array-typed, not single-typed. Templates registered per `(postType, dramaPersonality)` combination. Selection uses random matching templates filtered by personality.

**Affair discovery as a tick loop**:

```ts
function processAffairDiscovery() {
  for (const affair of activeAffairs) {
    if (!affair.isSecret) continue;
    const baseChance = 0.01;                     // 1% per tick base
    const dramaBonus = (affair.drama / 100) * 0.05;  // up to +5% at max drama
    const discoveryChance = baseChance + dramaBonus;
    if (Math.random() < discoveryChance) {
      // Pick a partner of involved NPCs to discover it
      const discoverer = ...;
      discoverAffair(affair.id, discoverer);
      // 60% chance discoverer posts vague callout
      if (Math.random() < 0.6) generateDramaPost(discoverer, 'vague_post');
    }
  }
}
```

**Suspicious activity check** — checks partner's posts for "happy relationship" markers when they shouldn't be happy, then checks comments for `👀` / "if only" / "interesting timing", and connects the dots:

```ts
const isSuspicious = post.content.includes('butterflies') ||
                     post.content.includes('feeling so lucky') ||
                     (post.content.includes('❤️') && !post.content.includes(viewerNpcId));
const suspiciousComments = comments.filter(c =>
  c.content === '👀' ||
  c.content.includes('if only') ||
  c.content.includes('interesting timing'));
```

The whole engine runs `tick()` every 5 minutes from `startDramaEngine()`.

---

## 10. Awareness Service: NPCs Only React to What They've Actually Seen

The most realistic-feeling system in the codebase. Each NPC has habits:

```ts
{
  npcId: 'sarah',
  platforms: ['myface', 'chirp', 'instasnap'],
  checkFrequencyHours: 1,         // Sarah is online
  batchSize: 15,
  activeHoursStart: 8, activeHoursEnd: 23,
  traits: { isHeavyScroller: true, checksNotifications: true,
            lateNightScroller: false, reactsOften: true },
}
{
  npcId: 'marcus',
  checkFrequencyHours: 6,         // Marcus barely checks
  activeHoursStart: 20, activeHoursEnd: 3,  // overnight active
  traits: { lateNightScroller: true, reactsOften: false },
}
```

`shouldCheckNow(npcId, platform)` checks: in habits' platform list? in active hours (with overnight handling)? hours-since-last-check ≥ checkFrequencyHours? `npcChecksSocialMedia()` marks posts as seen, updates last_checked, fires `NPC_SOCIAL_MEDIA_CHECKED` and `NPC_SHOULD_REACT_TO_POSTS` events.

Result: **realistic drama timing**. Sarah posts at 2pm. Emily checks hourly so reacts at 2:30pm. Jake checks every 4 hours and doesn't see it until 6pm. Marcus is overnight-only and doesn't see it until 11pm. The player might know before Jake does (or vice versa).

> **↻ Recurring (cheap on-write tagging).** "last_checked" is one row per (npc, platform); a few index hits and simple time math drive emergent realism. No model in the loop.

**Why steal it:** any multi-agent system that simulates async humans needs this. "Who has seen what, when" is a tiny piece of state that buys enormous realism.

---

## 11. NPC Personality: Four Orthogonal Trait Families

The npc-personality module is a clean factoring of "what makes an NPC distinct":

```ts
BehaviorFlags          — what they CAN do (post freely, initiate, send images, like, comment)
TopicInterests         — what they CARE about (25+ topics, 0-1 intensity)
CommunicationQuirks    — how they WRITE (verbosity, sarcasm, outlook, formality, emoji_usage,
                        typo_frequency, uses_periods/ellipsis/exclamation/all_caps,
                        uses_abbreviations, uses_internet_slang)
MessagePatterns        — how they DELIVER (multi_message_sender, messages_per_thought,
                        typing_speed, response_delay_variance, reads_immediately,
                        active_hours, uses_voice_messages)
```

Plus 5 named presets that are diffs over defaults:

```ts
PERSONALITY_PRESETS = {
  social_butterfly: { ..emoji 0.8, multi-msg 3, fast typing 45cps, immediate read },
  introvert:        { ..emoji 0.2, single-msg, slow typing 25cps, 5min read delay },
  chaotic_fun:      { ..emoji 0.9, sarcasm 0.6, all_caps, typo 0.3, multi-msg 5 },
  professional:     { ..emoji 0.1, formality 0.9, active_hours 9-17 },
  flirty:           { ..emoji 0.7, ellipsis, multi-msg 2 },
};
```

Each preset only specifies the trait deltas — `applyPersonalityPreset()` merges over defaults. Smart pattern: trait families × presets-as-diffs.

---

## 12. Message Formatter: Apply Quirks to Style + Multi-Message Split + Realistic Delays

After the AI generates a response, the message formatter rewrites it according to the NPC's quirks BEFORE delivery — and splits it into multiple "texts" with timing:

```ts
formatMessageForNPC(rawMessage, quirks, patterns) → {
  parts: string[],         // 1+ messages
  delays: number[],        // delay before each
  total_delay: number,
}
```

The quirk applications:

```ts
addEmojis(message, intensity)           // count scales with intensity
addTypos(message, frequency)            // swap-letters | drop-letter | double-letter
convertToAbbreviations(message)         // you→u, because→bc, tonight→2nite
                                        // 40% per-word application for realism
addInternetSlang(message)               // fr/ngl/tbh/lol prepended OR appended
applyPunctuation(message, quirks)       // strip periods if !uses_periods,
                                        // insert ellipsis if uses_ellipsis,
                                        // ALL-CAPS-RANDOM-WORD if uses_all_caps
```

Multi-message split breaks at sentence boundaries (`/[.!?]+\s+/`), falls back to comma/and split, capped at `messages_per_thought`. First message: full response delay (typing + thinking). Subsequent: just typing-time delay.

```ts
function calculateResponseDelay(messageLength, patterns) {
  let delay = patterns.average_response_delay_seconds;
  delay += messageLength / patterns.typing_speed;  // typing time
  const variance = delay * patterns.response_delay_variance;
  delay += (Math.random() - 0.5) * 2 * variance;   // ±variance
  return Math.max(2, Math.floor(delay));            // floor at 2s
}
```

Plus typing indicators if delay > 10s (capped at 30s of "typing..." display).

> **↻ Recurring (simulated streaming).** Multi-message split + per-message delays = a different flavor of streaming output. The user-facing principle (don't dump 5 paragraphs at once, drip them) is the same.

---

## 13. The Door: Centralized Outbound HTTP with Optional Proxy

Production-grade version of image_gen's per-fetch SOCKS agent. ALL outbound HTTP goes through `door.ts`. Supports SOCKS4, SOCKS5, HTTP-proxy, HTTPS-proxy-via-CONNECT.

```ts
import { doorFetch } from '../network/door.js';
const response = await doorFetch('https://api.openai.com/...', { method, headers, body });
```

When proxy is enabled, **manually opens a SOCKS connection, manually upgrades to TLS** via `tls.connect({ socket, servername, rejectUnauthorized: true })`, **manually serializes HTTP/1.1 request bytes** because `fetch()` can't be told to use a pre-opened socket:

```ts
const { socket } = await SocksClient.createConnection(socksOptions);
const tlsSocket = isHttps ? tls.connect({ socket, servername: url.hostname, rejectUnauthorized: true }) : socket;
await new Promise(resolve => tlsSocket.once('secureConnect', resolve));
let request = `${method} ${path} HTTP/1.1\r\n`;
headers.forEach((value, key) => { request += `${key}: ${value}\r\n`; });
request += `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
tlsSocket.write(request); if (body) tlsSocket.write(body);
// ...read raw bytes, parse with parseHttpResponse() into a real Response object
```

For HTTPS-via-HTTP-proxy: `http.request({ method: 'CONNECT', path: 'host:port' })` then upgrade the upgraded socket to TLS.

60-second timeout per request; errors logged to `errorLogger`. Returns standard `Response` objects so the rest of the codebase doesn't care.

> **↻ Recurring (single chokepoint for outbound HTTP).** Same intent as image_gen's SocksProxyAgent — but image_gen used a per-fetch agent (SOCKS5 only), engaige rolls its own SOCKS+HTTP+TLS multiplexer because Node's fetch doesn't expose proxy at this level. **The inconvenience is real, the centralization pays for it.**

---

## 14. Three-Database Split: Persistent vs Resettable

```
user.db   — persistent — player profiles, settings, budget config
npc.db    — persistent — NPC definitions, personalities, behavior
game.db   — resettable — conversations, messages, memories, posts, events, world state
```

`game.db` can be wiped to reset the world without losing player identity OR NPCs. Smart separation of concerns at the persistence layer. The frontend/backend never need to think about "which db" — `getDB('game')` / `getDB('npc')` / `getDB('user')`.

> **↻ Recurring (out-of-process state store).** This is the most thoughtful version of the pattern: **partition by reset-survivability.** Different concerns, different tables, different files. Future projects with a "wipe save" feature should start with this split.

---

## 15. Game Time as Multiplier-Over-Real-Time

Game time runs at 15× real time by default (1 real minute = 15 game minutes). Persisted as four numbers + a paused flag:

```ts
gameStartRealTime  — real-world ms when game time anchor was set
gameStartTime      — game-world ms at that anchor
timeMultiplier     — 1-60
isPaused, pausedAt — for pause/resume preserving game time across multiplier changes

getGameDate() {
  if (paused) return new Date(gameStartTime + (pausedAt - gameStartRealTime) * multiplier);
  return new Date(gameStartTime + (Date.now() - gameStartRealTime) * multiplier);
}
```

Pause/resume: on resume, advance `gameStartRealTime` by the pause duration so game time picks up where it left off. Multiplier change: snapshot current game time as the new anchor, so multiplier swaps don't jump time.

Building hours, NPC active hours, drama-engine ticks all reference `getGameTime()`. Single source of truth for "what time is it in the world right now."

---

## 16. Background Scheduler + Wave-Based Onboarding

NPC generation runs in **waves**. Wave 1 blocks during onboarding (player sees it complete). Waves 2+ are scheduled via `background-scheduler` with 60s incremental delays so the budget doesn't get drained at once and the player gets a slow trickle of new NPCs:

```ts
// Wave 1: blocking
const wave1Result = await generateWave(waves[0], 1, profile, playerName, []);

// Waves 2+: scheduled
for (let i = 1; i < waves.length; i++) {
  scheduleTask('generate_npc_wave', {
    priority: 7,
    delay_seconds: i * 60,
    budget_category: 'npc_generation',
    metadata: { wave_number: i+1, seed_data: waves[i].map(s => s.id),
                profile, player_name: playerName,
                previous_results: allResults.map(...)  // chain context
    },
  });
}
```

**Chain seeds** — seeds can reference parent cluster results so NPCs can be related across waves. Wave 2's "Sarah's roommate" seed gets passed Wave 1's Sarah-cluster as context.

---

## 17. Cluster-Based NPC Generation with Initial Memory Seeding

NPCs aren't generated one-by-one. A "scene seed" generates a **cluster** of 3-7 related NPCs in a single AI call, with relationships pre-defined:

```ts
// One AI call → multiple NPCs with mutual context
const enhancedSystemPrompt = otherNpcNames
  ? `## Related NPCs\n${otherNpcNames}\n\n${npcData.system_prompt}`
  : npcData.system_prompt;
```

Then for each NPC, **seed initial memories** about every cluster mate as high-importance memory rows:

```ts
function createInitialMemories(npcId, clusterNPCs) {
  for (const mate of clusterNPCs) {
    if (mate.id === npcId) continue;
    db.run(`INSERT INTO memories (id, npc_id, event_type, content, importance)
            VALUES (?, ?, 'seed_generation', ?, 0.8)`,
      [generateId(), npcId, `I know ${mate.name}. ${mate.relationship}`]);
  }
}
```

Then bidirectional `cluster_mate` relationships at trust=50, affinity=50.

Result: NPCs created together know each other, have plausible context for each other, and have memory rows that drive their later behavior. **No bootstrapping problem** — the world starts populated with relationships, not strangers.

---

## 18. Username Sanitization Pattern

Tiny but reusable:

```ts
function sanitizeUsername(username): string {
  let s = username.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (!/^[a-z]/.test(s)) s = 'u_' + s;       // letter-leading
  if (s.length > 24) s = s.slice(0, 24);     // truncate before suffix
  s += '_' + Math.random().toString(36).slice(2, 6);  // 4-char unique suffix
  if (s.length > 30) s = s.slice(0, 30);     // final guard
  return s;
}
```

Pattern: lowercase → replace special → letter-prefix-if-needed → truncate → unique-suffix → final-guard. The double-truncate guards against suffix overflow. Steal anywhere you need to derive valid identifiers from arbitrary user input.

---

## 19. Per-Provider Config Caching (in-memory + SQLite settings)

Pattern repeated across vision-proxy / image-gen-config / ai-provider-config:

```ts
let cachedConfig = null;

function loadConfigFromDB() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('x_config');
  if (row) try { return JSON.parse(row.value); } catch { return DEFAULT; }
  return DEFAULT;
}

function getConfig() {
  if (!cachedConfig) cachedConfig = loadConfigFromDB();
  return cachedConfig;
}

function configure(partial) {
  cachedConfig = { ...getConfig(), ...partial };
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('x_config', JSON.stringify(cachedConfig));
}
```

`settings` is a generic key-value table. Configs are JSON blobs keyed by name. In-memory cache for hot path; DB for persistence; default for first run. Three lines of pattern, applies everywhere config matters.

---

## 20. Service Singletons via Barrel Re-Export

Every concern is a singleton instance exported from a barrel `index.js`:

```ts
// events/event-bus.ts
class EventBus { ... }
export const eventBus = new EventBus();
export default eventBus;

// events/index.ts (barrel)
export * from './event-bus.js';
export * from './event-types.js';

// usage anywhere
import { eventBus, EventTypes } from '../events/index.js';
```

Same for `aiQueue`, `errorLogger`, `door`, `worldState`, `dramaEngine`, etc. The CLAUDE.md repeatedly enforces "always import from barrel `index.ts`, never sub-files." Frontend and backend both follow this.

> **↻ Recurring ("all X go through this single door").** This is the *project-wide* version of npc.builder's BaseProvider abstraction and image_gen's JobManager singleton. engaige takes it to its logical conclusion: every cross-cutting concern is a singleton with a barrel re-export, and the docs literally say "MUST go through here." **This is the dominant architectural pattern in this codebase** — promote it to a default for the next service-oriented project.

---

## What I'd Actually Steal First (engaige)

1. **StALk pop-safety analyzer pattern** — most original idea. Static analysis for *social* risk before execution. Generalizes to any user-authored automation that affects shared state.
2. **Centralized event bus as master log** — typed events, persisted to SQLite with importance + parent chains, queryable many ways. Auto-importance from event-type substring matching (no manual tuning). Wholesale-stealable.
3. **AI Queue with priority-tier budget reserves** — 5 tiers each with reserve %, min-budget %, canDefer flag, maxQueueTime. Promise-based wait via pendingPromises Map. The right shape for any cost-constrained AI pipeline.
4. **Output validator with fail-open + pre-canned deflection bank** — quick regex → cheap-model judge → corrective fallback gen → max-retries pre-canned fallback → generic deflection. The pre-generated bank-per-NPC is the new piece worth lifting.
5. **Deliberation with chaos-driven thinking depth** — formula uses personality + relationship + stakes + chaos seed. `</think>` stop sequence + accumulated-thoughts assistant turn forces N reasoning passes. Generalizes to any character-driven AI.
6. **Awareness service** — NPCs only react to what they've seen. Per-NPC habits (frequency, batch size, active hours) drive realistic async timing. "Who has seen what, when" is a tiny piece of state with enormous return.
7. **Three-database split (user / npc / game)** — partition by reset-survivability, not by domain. Smart for any game/sim with a "reset world" feature.
8. **Vision/image proxy for capability gaps** — when the model lacks the capability, transparently route through one that has it. NPC never knows. Two-step polyfill (analyze → describe → use description).
9. **NPC personality as four orthogonal trait families × presets-as-diffs** — clean factoring (behavior / interests / communication / patterns). 5 presets each specifying only the deltas. `applyPreset()` merges over defaults.
10. **Cluster-based generation with initial-memory seeding** — generate related NPCs in one AI call, write `I know X. {relationship}` rows at importance 0.8 immediately. Bootstraps the world with relationships, not strangers.
11. **Door pattern: single chokepoint for outbound HTTP with full proxy stack** — the production version of image_gen's per-fetch agent. SOCKS+HTTP+CONNECT+TLS all manual.
12. **Service singletons via barrel re-export** — process-wide singletons exposed only through `index.js`. Imports are stable, observability is centralized.

## Patterns Resurfaced (signal — fourth and counting)

This round pushed several patterns to **4× appearances**, which is the line where I should treat them as structural defaults rather than "good ideas":

- **Strategy fallback chain** (4×) — engaige output validator has a 5-stage chain. Door has a fallback chain. Vision/image proxy has a capability-gap fallback. Selector chains in DOM extraction.
- **Warn-and-continue defaults** (4×) — engaige fail-open validator + always-return-something AI queue is the cleanest example.
- **OpenAI-compat shim** (4×) — engaige supports openai/openai-compatible/anthropic via one config switch.
- **Per-job/per-agent stable IDs** (4×) — uuid7-style across event bus, AI queue, NPCs.
- **Streaming/incremental output** (4×) — engaige's multi-message NPC reply with simulated typing is "fake streaming" but the principle is the same.
- **Out-of-process state store** (4×) — engaige's three-DB split is the most sophisticated version (partition by reset-survivability).
- **Split model selection by role** (4×) — engaige uses cheap models for validator/vision/deliberation-loops, expensive for synthesis. Cleanly applies the cheap-judge / expensive-generator distinction.

**Two NEW pattern entries promoted to the index:**

- **"All X go through this single door"** — engaige codifies this in CLAUDE.md as a hard rule for AI/events/errors/HTTP/tools. The pattern is *intentional centralization for observability and control*. Going forward, default to "one singleton per concern with a barrel re-export and a `MUST go through here` comment."
- **Cheap on-write tagging that pays back at retrieval/ranking time** — npc.builder's emotional_significance, image_gen's prompt embeddings, engaige's auto-importance + topic_interests. Tag at write time, sort/filter cheaply later. No model in the hot path.

---

# yaai — desktop AI interface (the everything-client)

Source: `/home/siah/creative/ai` — 350+ React components, 113 backend modules across `app/src/bun/lib/`, 40+ feature specs in `specs/`.
Stack: Electrobun (Bun-based Electron alternative) + Bun runtime + TypeScript strict + React 19 + Tauri-style native windowing + 5 SQLite DBs + WebSocket-only IPC + Three.js / R3F for visualization + xterm + Monaco.

YAAI is the **synthesis project**. The user warned this would overlap "so hard it's not even funny" — and they're right. Almost every pattern from the prior four projects has been promoted into typed, factored, UI-builder-driven structure here. This section emphasizes overlap explicitly, then catalogs the genuinely-new ideas underneath.

If image_gen.cjs was an ad-hoc personal tool that grew rich, YAAI is the version where every "I keep doing this" pattern got promoted to first-class infrastructure. It's the answer to "what does the codebase look like after you've internalized all these patterns?"

---

## 1. Variable System as a Full DSL (5 types, recursive, cached, UI-built)

The most-evolved version of the variable-interpolation instinct in the catalog. Five variable types, all under one `{{var}}` syntax:

```typescript
type VariableType = 'system' | 'app-level' | 'wildcard' | 'rest-api' | 'javascript'
```

| Type | What it does |
|---|---|
| **system** | Built-ins: `{{time}}`, `{{date}}`, `{{datetime}}`, `{{timestamp}}`, `{{user-name}}` |
| **app-level** | Static text user value, supports nested `{{vars}}` for recursive composition |
| **wildcard** | Array of options + per-call random pick + optional cache duration ("reroll each time" or "cache 5 min") |
| **rest-api** | Full HTTP-with-auth + JSON-path/regex/text response parser + 4-step UI builder (Configure → Test → Pick Field → Confirm) |
| **javascript** | Code executes in `vm2` sandbox with a safe context (Math/Date/JSON only, no require/process/eval), 5s timeout |

The **REST API variable builder** is a full 4-step wizard:
1. Configure request (method/url/headers/body/auth: Bearer/Basic/API-Key)
2. Test request, see raw + formatted response
3. Pick field via interactive JSON tree picker OR regex builder
4. Confirm + cache settings

Recursive expansion with `MAX_RECURSION_DEPTH = 5` (cycle detection). Variables-in-variables work. URL/headers/body inside REST configs themselves get interpolated before fetching. Variables expand in **parallel** via `Promise.allSettled`.

```ts
const MAX_RECURSION_DEPTH = 5;

async expandSingle(name: string, depth = 0): Promise<VariableExpansionResult> {
  if (depth > MAX_RECURSION_DEPTH) return { error: `Circular reference (max depth ${depth})` };
  const cached = this.cache.get(name);
  if (cached) return cached;
  const variable = await this.variableStore.getVariableByName(name);
  // ... resolve by type, recurse for nested vars, cache by per-type TTL
}
```

> **↻ Recurring (3rd appearance, fully evolved).** npc.builder had `${before}{identity}${after}`. image_gen had `{a|b|c}` + `%img2img.name%` + `$home`. This is the *industrial* version of the same instinct: typed schemas, encrypted credential storage, sandbox execution, UI builder, recursive resolution, TTL cache. **Promote**: any tool with prompts/config should ship with at minimum a wildcard + system-variable expander. The 5-type taxonomy is the right ceiling.

---

## 2. M3A 5-Layer Memory Write Pipeline (the maxed-out cheap-on-write tagger)

Every message is processed through **five parallel layers**, each with its own threshold and toggle:

```
L1: Recency river (token-budgeted FIFO; triggers consolidation at overflow)
L2: Affect classifier (LLM call; persisted only if intensity ≥ 0.3)
L3.1: Vector embedding (cached; for semantic search later)
L3.2: FTS lexical index (for keyword search)
L3.3: Entity graph (extract entities + relations, store nodes + edges)
L4: Salience score (persisted only if ≥ 0.7)
L5: Co-occurrence concept graph (concepts + edges)
```

```ts
async function processMessage(chatId, messageId, content, options) {
  const result: WriteResult = {
    l1: { success: false }, l2: { success: false, skipped: false },
    l3Vector: { success: false, skipped: false }, l3Lexical: { success: false },
    l3Graph: { success: false }, l4: { success: false, skipped: false },
    l5: { success: false }, consolidationTriggered: false,
  };
  // L1 — always (if enabled)
  const tokenCount = estimateTokens(content);
  result.l1 = MemoryStore.addToRiver(chatId, messageId, content, tokenCount);
  // overflow → fire-and-forget consolidation
  if (currentTokens > maxTokens) triggerConsolidation(chatId, maxTokens).catch(...);
  // L2 — only if intensity exceeds threshold
  const affect = await classifyAffect(content, llmCall, { contextMessages });
  if (affect.intensity >= config.l2AffectThreshold ?? 0.3) MemoryStore.addAffectEntry(...);
  // L3 — vector + lexical + entity graph in parallel
  // L4 — salience score (only persist if ≥ 0.7)
  // L5 — concept graph (every message)
  return Result.ok(result);
}
```

Each layer can be disabled via config. **The pipeline never throws** — it returns a `WriteResult` showing per-layer success/skip/failure. Failures in one layer don't kill the others.

> **↻ Recurring (4th appearance — strongest pattern in the catalog).** npc.builder tagged emotional_significance + topics. image_gen embedded prompts as BLOBs. engaige auto-calc'd event importance + topic_interests. **YAAI does all five at once on every message, with persistence-on-significance gates.** This is the structural form of "tag at write, query cheaply later." Promote: factor the entire write-pipeline pattern into a reusable lib — pluggable taggers + persistence-threshold gates + per-layer toggles + non-throwing aggregated result.

---

## 3. Result<T, E> Functional Error Type (universal substrate)

Every backend operation returns `Result<T, E>`. Never throws. The full helper suite is exported from `core/result.ts`:

```ts
type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

const Result = {
  ok, err, map, mapErr, flatMap, unwrapOr, unwrap,
  isOk, isErr,                // Type guards (TS narrows correctly)
  fromPromise(promise, mapError?),  // Convert Promise<T> → Promise<Result<T, E>>
  tryCatch(fn, mapError?),         // Wrap throwing fn into Result
  all(results),                    // Combine — first error wins, or all values
  collect(results),                // Combine — all errors OR all values
};
```

Combined with **branded type IDs**:

```ts
type ChatId = string & { readonly __brand: 'ChatId' };
type MessageId = string & { readonly __brand: 'MessageId' };
type SessionId = string & { readonly __brand: 'SessionId' };
type VariableId = string & { readonly __brand: 'VariableId' };
```

→ The compiler enforces "this is a `ChatId`, not just any string." Pass a `MessageId` where a `ChatId` is expected and TypeScript stops you. Zero runtime overhead.

And `AppError`:

```ts
class AppError extends Error {
  constructor(args: { code: string; message: string; cause?: Error;
                       context?: Record<string, unknown>; recoverable?: boolean });
}
```

Error code namespacing is structured: `VARIABLE_NOT_FOUND` (8001), `VARIABLE_NAME_CONFLICT` (8002), etc. Plus error factories per domain (`Errors.variable.notFound(id)`, `Errors.db.queryFailed(query, error)`).

> **↻ NEW pattern (1st appearance).** This is the *substrate* that lets all the other patterns work. If I'm doing TypeScript again, **start here** — Result + branded IDs + AppError factories on day one. It's the difference between "I should remember to handle errors" and "the type system forces me to."

---

## 4. Parallel Multi-Model with Bloom/Collapse Selection

Inline syntax `+claude +gpt-4 +gemini what's the capital of France?` sends one prompt to multiple models. Streaming responses fill side-by-side cards. User clicks "like" on preferred → **bloom animation expands it to full width**, others **collapse animation** down to "2 rejected alternatives" pill.

```sql
CREATE TABLE response_groups (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_message_id TEXT NOT NULL REFERENCES messages(id),
  selected_response_id TEXT REFERENCES messages(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  auto_selected_at TEXT
);
ALTER TABLE messages ADD COLUMN response_group_id TEXT REFERENCES response_groups(id);
ALTER TABLE messages ADD COLUMN is_parallel_response INTEGER DEFAULT 0;
```

**Auto-select first** — if user sends next message before choosing a winner, the first complete response is auto-selected with visual indicator "Auto-selected (first to respond)."

**Context filter** — subsequent message context only includes the *selected* response:

```ts
function buildContext(messages, groups) {
  return messages.filter(msg => {
    if (!msg.isParallelResponse) return true;
    const group = groups.get(msg.responseGroupId!);
    return group?.selectedResponseId === msg.id;
  });
}
```

4 display modes: horizontal (default, scroll-snap), vertical, grid (2xN), single-with-arrows (carousel). Bloom CSS uses `var(--ease-spring)`. Collapse animates max-height + opacity simultaneously.

**Model alias matching with multi-strategy fallback:**

```ts
function findModelByAlias(alias, models) {
  let found = models.find(m => m.id.toLowerCase() === lower);              // exact id
  if (found) return found;
  found = models.find(m => m.name.toLowerCase().includes(lower));          // name contains
  if (found) return found;
  // common aliases: 'opus' → claude-3-opus, 'gpt' → gpt-4, etc.
  for (const [key, patterns] of Object.entries(ALIASES)) {
    if (lower === key || lower.includes(key)) {
      return models.find(m => patterns.some(p => m.id.includes(p)));
    }
  }
}
```

> **↻ Recurring (strategy fallback chain at the alias-resolution layer).**

**Why steal it:** the bloom/collapse pattern is the right shape for any "multi-attempt UX" — A/B response selection, multi-style image-gen, multi-source citation rankings.

---

## 5. Deep Research with Scout/Reader/Orchestrator + Contradiction Courtroom

Three agent roles, each with its own model, configurable per-role:

| Agent | Default Model | Purpose |
|---|---|---|
| **Orchestrator** | `claude-sonnet-4` | Coordinates research, synthesizes findings (long context, strong reasoning) |
| **Runners (Scouts)** | `claude-3-5-haiku` | Parallel source discovery (fast, cheap) |
| **Reader** | `claude-sonnet-4` | Content extraction and analysis (detailed comprehension) |

Three depth profiles change runner counts and budget:

```
Light:       2 runners, ~30 queries
General:     3 runners, ~50 queries
Exhaustive:  5 runners, ~100+ queries
```

**Source feed with explicit lifecycle states** (status badge + color):

```
PENDING (amber)   → APPROVED (emerald)  → READING (blue, with progress bar)
                                       → COMPLETE (emerald, with extracted-findings tree)
                  → REJECTED (red, with operator's reason + undo)
                  → FAILED (orange)
```

Per-source action buttons: `[✓ Approve] [✗ Reject] [💬 Comment] [🔍 Preview]`. Comment opens an inline guidance box ("Focus on methodology section"). The system **learns from rejections** — a "Learned Patterns (auto)" section in Session Guidance shows inferred avoidance rules ("⚡ Avoiding: SEO-heavy content", "⚡ Avoiding: Content older than 2022").

**Bias indicator visual scale** — every source gets a 5-segment bar with color: Left → Center-Left → Center → Center-Right → Right → Unknown. Combined with date pill (recency, color-coded fresh < 30d), source-type pill (primary/secondary/tertiary), and relevance score (color: 80+ green, 60-79 amber, <60 red).

**Contradiction Courtroom modal** — when the orchestrator detects sources disagreeing, it pauses for user judgment:

```
┌──────────────────────────────────────────────────────────────────┐
│                ⚖️ Contradiction Detected                         │
│  Topic: Solid-state battery energy density                       │
├──────────────────────────────────────────────────────────────────┤
│  ┌─ SOURCE A ──────┐  VS  ┌─ SOURCE B ──────┐                  │
│  │ 🔗 nature.com   │      │ 🔗 electrek.co  │                  │
│  │ "400 Wh/kg"     │      │ "280 Wh/kg"     │                  │
│  │ Center | Nov'24 │      │ TechBlog | Aug  │                  │
│  │ Primary src     │      │ Secondary src   │                  │
│  │ [👍 Trust This] │      │ [👍 Trust This] │                  │
│  └─────────────────┘      └─────────────────┘                  │
│                                                                  │
│ [🤝 Use Both - Note Disagreement]  [🔍 Find Tiebreaker Source] │
│                  [Dismiss - Let AI Decide]                       │
└──────────────────────────────────────────────────────────────────┘
```

**Cost estimation** is shown up front per depth profile (~$0.45 estimated for General). Users see what they're committing to before pressing Start.

> **↻ Recurring (split model selection by role + warn-and-continue).** shittyresearchtool had the same agent split (head/search/reader). YAAI adds: lifecycle-state source tracking, human-in-the-loop approval, learned avoidance patterns, and the Contradiction Courtroom — a UX innovation worth lifting wholesale.

---

## 6. Visual Experience Layer (content-agnostic theatrical rendering)

> "Prioritize immersion over speed. A 30-second theatrical presentation beats instant raw text."

Pipeline that takes ANY structured report and outputs an immersive multimedia experience. The input contract is universal — research output, manual write, imported markdown, API webhook, all conform to the same `VisualExperienceInput` schema. **Decoupled from research** — the layer doesn't know or care about scouts/readers.

```
[REPORT in] → [Media Generation: images/charts/video/voice in parallel]
            → [Assembly: asset map + timestamp sync + camera path]
            → [Presentation Modes: Manual Reading / Synced Scroll / Cinematic Autopilot]
            → [Export: PDF / Slideshow / Interactive HTML / MP4 / MP3]
```

**Galaxy Visualization** — 3D R3F scene where central "Query Core" is the topic, sources orbit as nodes. Node types each have distinctive visual treatments:

```
QUERY CORE       — bright glowing sphere, pulsing energy
SUB-QUERY        — medium glowing orb, section-colored
SOURCE Pending   — wireframe cube, semi-transparent, subtle pulse
SOURCE Approved  — glass panel with thumbnail, solid edges, section-colored glow
SOURCE Rejected  — shattered fragments, red particles, fading away
SOURCE Active    — bright glow + scale 1.1×, full thumbnail visible
LINK             — particle stream, color = relationship type, animated flow
```

Camera auto-rotates at 0.2 speed (subtle drift). Background `#0A0A0F` (deep space). Fog density 0.002 fades distant nodes. WebGL preferred, canvas fallback.

**Cinematic Mode** — the report plays itself. Camera animates between source nodes as the corresponding section is read aloud (TTS). Statistics auto-render as charts. Concepts get illustrated. Total runtime ~2 min from input to fully-ready experience; user can begin Manual reading immediately while media generates in background.

> **↻ Recurring (streaming/incremental output, taken to its dramatic extreme).** Cinematic Mode is "streaming as aesthetic" — the user *isn't waiting for content*, they're being *presented to*. Worth keeping in mind that streaming-as-pacing applies to non-LLM outputs too.

---

## 7. Visual Experience: Atmospheric Reactive UI (R3F + shaders + signals)

Beyond the Galaxy, YAAI has an **Alchemy Circle** around the input box (rotating particle ring whose density+rotation reacts to system activity), **Synthesis Loom** (converging multi-model threads when parallel responses are streaming), and **Mood Glow** (background atmospheric lighting that shifts based on the L2 affect classification of the current chat).

```ts
// Signal flow
[System Event] → [Signal Normalizer] → [Shader Uniforms]
       ↓                ↓                    ↓
[Streaming/        [Intensity 0-1]       [R3F Scene]
 Memory Hit/       [Color hex→vec3]      [Post-Proc]
 Affect Change]    [Velocity]            [Display]
```

When affect shifts from `neutral` to `insight`, the glow transitions from muted `#222` to vibrant electric indigo with high bloom.

**Performance graceful degradation:**
- Single `<Canvas>` for all persistent effects (one GL context, not N)
- `dpr={1}` default → `dpr={[1, 2]}` only if user enables "High Quality Effects"
- Auto-reduce particle count (LOD) if FPS drops below 30
- WebGL context loss → fall back to CSS-only gradients

> **↻ Recurring (warn-and-continue + strategy fallback).** WebGL → CSS fallback is the same shape as image_gen's reference resolution chain.

---

## 8. Phosphor Terminal Design Language

A fully-specified design system: "Neo-retro aesthetic that channels the warm glow of CRT monitors and vintage computing, merged with modern dark UI sensibilities."

**Backgrounds**: near-black spectrum (`#0a0a0a`, `#0c0c10`, `#111111`).

**Provider accent colors** are first-class — every model inherits its accent from its provider. Anthropic = `#D97757` terracotta, OpenAI = `#10a37f`, DeepSeek = `#4D6BFE`, Google = `#4285F4`, Mistral = `#FA520F`, Groq = `#F55036`, etc. Used in: response card glow, model badge, status indicator tint, token meter fill.

**White/black brand color handling** — special-cased: providers like xAI (white) or OpenAI (black) get inverted styling on dark backgrounds.

**Typography is monospace throughout** — the interface reads like a terminal. Hierarchy is via weight + opacity, *not* font changes:

| Level | Weight | Opacity |
|---|---|---|
| Heading | 600 | 100% |
| Body | 400 | 90% |
| Secondary | 400 | 60% |
| Disabled | 400 | 40% |
| Muted | 400 | 30% |

**The CRT Effect Stack** — applied to contained elements (cards, terminals, viz), not globally:
1. Content layer
2. Scanlines (horizontal, 2px, 3-5% opacity)
3. RGB subpixels (vertical phosphor stripes, optional, perf-heavy)
4. Vignette (radial gradient darkening edges)
5. Phosphor glow (subtle color bleed on bright elements)
6. Flicker (micro-opacity animation, optional, on active states)

Plus dedicated **CRT Glow Palette** (`glow-green #00ff00`, `glow-cyan #00ffff`, `glow-amber #ffaa00`, `glow-magenta #ff00ff`) and a Data Visualization Palette (per-payload-type and per-memory-category colors).

**Why steal it:** the *system* is what's worth lifting, not the specific aesthetic. (1) Provider-color → accent-cascade is a real win for multi-provider clients. (2) Hierarchy via weight+opacity (not font swaps) keeps monospace coherent. (3) CRT effect stack as a *layer composition* (not a single class) lets you toggle individual layers — including by per-element opt-in.

---

## 9. InputHub State Machine (multi-mode input)

Single component swaps internal "Atoms" based on active target:

```
mode: 'chat'  → ChatInput  (textarea + send)
mode: 'image' → ImageInput (prompt library + parametric dashboard: aspect/steps/seed/model)
mode: 'forge' → ForgeInput (Monaco-heavy doc editor)
mode: 'proxy' → text-input but with "Image Proxy" toggle that grants chat model image-gen tools
```

```typescript
export const InputHub: React.FC = () => {
  const { mode, targetMetadata } = useInputTarget();
  return (
    <div className="input-hub-container">
      <VisualizationWrapper mode={mode} />
      {mode === 'chat'  && <ChatInput  metadata={targetMetadata} />}
      {mode === 'image' && <ImageInput metadata={targetMetadata} />}
      {mode === 'forge' && <ForgeInput metadata={targetMetadata} />}
      <InputHubToolbar mode={mode} />
    </div>
  );
};
```

**Capabilities array** per session: `['tools', 'vision', 'gen_image']` — tells backend what the model can do, gates UI affordances accordingly.

**Lazy-loaded variants** via `React.lazy` — Monaco-heavy `ForgeInput` and `ImageInput` are dynamically imported so chat-only users don't pay the bundle cost.

**UI Throttling** — typing updates to InputHubStore are debounced to prevent React re-render thrashing during high-speed typing or streaming.

---

## 10. Reference Image Picker (the image_gen pattern, properly UI'd)

Direct UI evolution of image_gen.cjs's `!folder`/`!!folder`/`@123` reference language — promoted from text wildcards to a virtual-scrolling grid + ordered selection array + saved groups:

```
PathBar:           $img2img / faces / female      [↑ up] [⟳ refresh] [⚙ settings]
DirectoryBrowser:  Virtual grid (@tanstack/react-virtual), folder + image tiles
SelectionArray:    Ordered tiles with index badge [0][1][2]…, dnd-kit reorder, click-to-remove
                   Variable hint: "%img2img[0].name% = img03"
SavedGroups:       [+ Save Current]  portrait_refs (4)  landscape_set (2)  test_group (7)
ActionBar:         [Clear All] [Cancel] [✓ Apply]
```

> **↻ Recurring (image_gen lifted into UI).** image_gen had `%img2img[0].name%` as a prompt variable + reference handling as a CSV-of-paths. YAAI gives the operator the *picker UI* for the same operation. The wire format (`%img2img[N].name%`) is preserved for backward compatibility.

---

## 11. Configurable Prompt Assembly (user picks components + ordering + separators)

Instead of a hardcoded system prompt, user *configures* what goes in and in what order:

```ts
interface PromptAssemblyConfig {
  components: PromptComponent[];     // ordered list of what to include
  separator: SectionSeparator;        // 'markdown_header' | 'xml_tags' | 'hr' | 'newlines' | 'none'
}

// Component renderers:
renderUserBasePrompt          → user's base system prompt
renderInteractiveMode         → mode prompt + primitive documentation
renderReasoningInstructions   → off / low / medium / high (with <thinking> example for high)
renderWebSearchGuidance       → off / light / regular / deep (with citation rules)
renderVariableContext         → expanded variables + values
```

```ts
// Example: reasoning-high
high: `Always think deeply and methodically. Use <thinking> blocks to show your complete reasoning process,
exploring multiple angles and considering edge cases before providing your response.

Example:
<thinking>
Let me work through this step by step...
1. First consideration...
2. However, I should also consider...
3. Weighing these factors...
</thinking>

Based on my analysis, [your response]`
```

Separator types: markdown headers (`## Section`), XML tags (`<section>...</section>`), horizontal rules, plain newlines, or none. Picked based on what works best with the target model.

> **↻ Recurring (modular prompt construction).** npc.builder had `${before}{identity}${after}` templates. engaige had `buildNPCSystemPrompt`. YAAI is the runtime-configurable version — the user picks what goes in, in what order, with what separators. Promote: any prompt-building system should expose the assembly order as a config, not hardcode it.

---

## 12. Interactive Primitives in AI Messages (`【…】` out-of-band signal)

The AI can emit special JSON-in-markdown tokens that the renderer turns into interactive widgets:

```
【{"type":"buttons","buttons":[{"text":"Option 1"},{"text":"Option 2"}]}】
【{"type":"form","fields":[{"type":"text","name":"q","label":"Question","required":true}]}】
【{"type":"window_effect","trigger":"celebration"}】
```

The `【】` brackets are an *out-of-band* signal — they survive normal markdown rendering, the renderer parses them out and replaces with React components. Triggers for `window_effect`: love, celebration, danger, mystery, thinking, rage, calm, surprise, sad, hype, glitch, whisper.

Form field types: text, textarea, select, radio, checkbox, number. Buttons can have variant (primary/danger/default) and action (message/terminal/copy/link).

**Why steal it:** any markdown-based AI UI can adopt this. Pick a delimiter unlikely to occur naturally (`【】` is good, `▼…▲` works too), define a small JSON schema, render conditionally. Lets the model emit *interactive* responses without needing a separate response channel.

---

## 13. Pop-Out / Focus Windows (multi-window OS integration)

Spawn frameless always-on-top windows that show a single chat (or quick-input). All windows share one WebSocket connection.

```
window:spawn  → server-side BrowserWindow + URL with #/chat/{id}?mode=popout
window:close
window:focus
window:set-top
```

URL-driven minimal mode — `WorkspaceShell` reads `?mode=popout` from query and hides the navigation sidebar:

```typescript
const isMinimal = new URLSearchParams(window.location.search).get('mode') === 'popout';
return <div className={cn("workspace-shell", isMinimal && "mode-minimal")}>...</div>;
```

**Quick-input** (future) — `Alt+Space` global hotkey spawns a `WindowType('quick-input')` centered, always-on-top. Submitting a message expands it into a standard chat popout.

**Linux-specific helpers** in `platform-linux.ts` use xdotool/wmctrl for window management features that Electrobun doesn't expose natively.

**WS connection management** — server handles multiple simultaneous connections from "the same user" (multi-tab/multi-window). Client ID management has to disambiguate.

---

## 14. Five-Database Split (extreme version of out-of-process state)

```
~/.yaai/data/
├── chat.sqlite        # Chats, messages, FTS index
├── code.sqlite        # Code sessions, snapshots, transcripts
├── imagegen.sqlite    # Image generation queue and jobs
├── app.sqlite         # Settings, credentials, artifacts
└── analytics.sqlite   # Events, hourly/daily/monthly rollups
```

Each domain gets its own DB file. Reset analytics without losing chats. Wipe images without losing code sessions. **Partition by reset-survivability AND by domain**, not just one or the other.

Plus **content-addressed blob storage** at `~/.yaai/blobs/` keyed by SHA-256 hash → automatic dedup. Snapshots, large attachments, image outputs all go there.

**SQLite WAL mode** for concurrent reads + single writer. **FTS5 with Porter stemmer** for chat search (normalizes word forms — `running` matches `run`).

> **↻ Recurring (4th appearance, most evolved).** npc.builder used Postgres. image_gen had CSV+SQLite. shittyresearchtool used tmp md files. engaige did 3-DB. YAAI does 5-DB + content-addressed blobs. **The pattern is "out-of-process state store, partitioned by domain AND survivability."** This is the canonical layout.

---

## 15. Migration System (versioned SQL files)

Numbered SQL files run in order:

```
app/src/bun/migrations/
├── chat/
│   ├── 001_create_chats.sql
│   ├── 002_create_messages.sql
│   ├── 003_create_fts.sql
│   └── 004_add_branching.sql
└── app/
    ├── 001_create_settings.sql
    ├── 002_create_credentials.sql
    ├── 003_create_artifacts.sql
    └── 004_create_variables.sql
```

`getDB('chat')` auto-runs pending migrations on connection. Migration version table tracks what's been applied. Standard pattern but well-applied — every domain has its own migration directory matching its DB file.

---

## 16. Dual-Process Model (Bun main + React renderer over WebSocket)

```
┌──────────────────────────────────────────┐
│  Main Process (Bun - src/bun/)           │
│ • WebSocket Server (port 3001)           │
│ • 16 stores                              │
│ • 16 WS handler modules                  │
│ • AI Provider (multi-provider streaming) │
│ • M3A Memory System (5-layer)            │
└───────────────┬──────────────────────────┘
                │ WebSocket
┌───────────────▼──────────────────────────┐
│  Renderer Process (React - src/mainview/)│
│ • 350+ Components (atomic design)        │
│ • 28 Custom Hooks                        │
│ • Workspace Layout (VS Code-style panes) │
│ • Wouter Routing                         │
└──────────────────────────────────────────┘
```

CLAUDE.md explicit doctrine: **"Frontend is a dumb terminal."** All real data flows through WebSocket from backend stores. The exception (localStorage for client-side prefs like theme) requires an explicit comment marker:

```typescript
// PRODUCTION: User requested client-side storage for this setting, not a mock
localStorage.setItem('theme', value);
```

Shared types in `app/src/shared/ws-protocol.ts` define every WS message shape — both processes import it.

**16 WS handlers** namespaced by channel: `chat:*`, `ai:*`, `parallel:*`, `credential:*`, `model:*`, `research:*`, `variable:*`, `proxy:*`, `code:*`, `draft:*`, `project:*`, `memory:*`, `rss:*`, `terminal:*`, `attachment:*`. Each is a self-contained handler module.

> **↻ Recurring (2nd appearance with engaige).** Same exact pattern as engaige: WebSocket-only IPC, "frontend is a dumb terminal" doctrine, namespaced handlers. **This is the canonical Tauri/Electrobun pattern in this codebase.**

---

## 17. VS Code-Style Workspace Panes

Multiple panes, splittable, each can hold any view (chat / code / image-gen / settings / research). Workspace state persists. Standard editor-group paradigm applied to AI chat.

Pane state: which view, which entity (chatId/codeSessionId/imageGenJobId), pane size, scroll position. Drag-to-split, drag-to-merge. Per-pane tab strip if multiple entities open in one pane.

Combined with **Pop-Out Windows** (idea #13), the user gets full control over multi-context layout: monitor 1 has chat + code in split panes, monitor 2 has popped-out research session, alt-space spawns a quick-input over everything.

---

## 18. Per-Role Default Models as User Setting

Each "task type" in the app has a default model setting:

```
chat:           [claude-sonnet-4-20250514       ▼]  (per-task default)
quick-question: [claude-3-5-haiku-20241022      ▼]  (cheap)
research-orchestrator: [claude-sonnet-4         ▼]
research-runner:       [claude-3-5-haiku        ▼]
research-reader:       [claude-sonnet-4         ▼]
title-generation:      [claude-3-5-haiku        ▼]
memory-classification: [gpt-4o-mini             ▼]
embedding:             [text-embedding-3-small  ▼]
```

User can pick a different model per task type via the settings UI. Used wherever a task-type LLM call happens — `getModelFor(taskType)`. Cheap for high-volume background tasks, expensive for primary user-facing output.

> **↻ Recurring (split model selection by role, now user-configurable).** npc.builder/shittyresearchtool/engaige all hardcoded role-to-model mappings. YAAI exposes them as user settings — ship it as a settings page from day one.

---

## 19. Branded-Type-Per-Domain (compile-time IDs)

```typescript
type ChatId = string & { readonly __brand: 'ChatId' };
type MessageId = string & { readonly __brand: 'MessageId' };
type SessionId = string & { readonly __brand: 'SessionId' };
type VariableId = string & { readonly __brand: 'VariableId' };
type ProjectId = string & { readonly __brand: 'ProjectId' };
type ResponseGroupId = string & { readonly __brand: 'ResponseGroupId' };
```

Each domain's IDs are distinct types at compile time. Functions take `ChatId`, not `string`. Pass a `MessageId` where a `ChatId` is expected → compiler stops you. Zero runtime cost — they're still just strings at runtime.

> **↻ Recurring (per-job stable IDs taken to the type-system level).**

---

## 20. CSS-Effect Vocabulary for Window Reactions

`【{"type":"window_effect","trigger":"celebration"}】` triggers from the model produce CSS-driven full-window reactions:

```
love        — pink hearts float up, screen has rosy tint briefly
celebration — confetti burst, gold accent
danger      — red strobe, warning vignette
mystery     — purple fog, slow zoom
thinking    — slight desaturation, breathing pulse
rage        — red shake, harsh contrast
calm        — soft blue gradient, slow breath
surprise    — flash + zoom out
sad         — cool blue, scanline frequency increases
hype        — rainbow strobe, RGB chromatic aberration
glitch      — pixel sort effect, scan-line tear
whisper     — slight blur, vignette closes in
```

The model can emit these inline; the renderer queues + executes them. Pure CSS animations, no JS animation engine. Same pattern as npc.builder's drama-style cues, but applied to the *interface itself* as theatrical feedback.

---

## What I'd Actually Steal First (yaai)

1. **Result<T, E> + branded IDs + AppError** — the substrate. Start any new TypeScript project here. Everything else gets easier.
2. **M3A 5-layer write pipeline with per-layer thresholds + non-throwing aggregated WriteResult** — the structural form of "tag at write, query cheaply later." Generalize beyond memory: any "process this on ingest" operation.
3. **5-type variable system (system/app-level/wildcard/rest-api/javascript)** with REST-API UI builder — the industrial version of `{a|b|c}`. Ship in any tool that has prompts or config.
4. **Parallel multi-model with bloom/collapse selection + auto-select-on-next-message** — UX pattern for any A/B response or multi-attempt situation.
5. **Deep Research with source lifecycle + Contradiction Courtroom + Learned Patterns** — human-in-the-loop research is way better than autonomous. The Courtroom modal is a UX innovation worth lifting.
6. **Prompt assembly as runtime config** — user picks components + order + separators. Ship as a settings page from day one.
7. **Pop-out windows + URL-driven minimal mode** — useful for any multi-context tool. `?mode=popout` query param hiding nav is trivial to implement.
8. **5-DB split partitioned by domain AND reset-survivability** + content-addressed blob storage. Canonical layout.
9. **Provider-color cascade** — every model inherits accent from provider, used everywhere. Solves "how do I visually distinguish models" once.
10. **Interactive primitives in markdown via `【…】`** — out-of-band JSON tokens that survive markdown rendering. Lets the model emit interactive UI without a side channel.
11. **InputHub state machine with capabilities array** — single component, multiple modes, lazy-loaded variants. Right shape for any multi-purpose input.
12. **Per-role default models as user settings** (not hardcoded) — settings page from day one.

## Patterns Resurfaced (signal — five projects in)

After five projects, the picture is clear. The recurring patterns table shows what I've internalized as defaults; the gap between "I do this every time" and "I have a shared library for it" is now glaring. Top-of-mind:

- **Strategy fallback chain (5×)** → `tryChain(strategies, isUseful)` lib, please
- **Warn-and-continue defaults (5×)** → Result<T, E> as the substrate makes this structural
- **OpenAI-compat shim (5×)** → not a pattern anymore, it's the only sensible API layer choice
- **Per-job stable IDs (5×)** → branded types at compile time; ship from day one
- **Streaming/incremental output (5×)** → applies to non-LLM outputs too (Cinematic Mode is the proof)
- **Out-of-process state store (5×)** → 5-DB split + blobs is the canonical layout
- **All X go through this single door (5×)** → Result<T, E> is the type-system version of this principle
- **Split model selection by role (5×)** → now user-configurable settings, not just code
- **Cheap on-write tagging (4×)** → M3A is the maxed-out version; factor it into a reusable lib
- **Variable interpolation system (3×, NEW)** → yaai's 5-type DSL is the right ceiling
- **Single chokepoint for outbound HTTP (3×)** → ship it pre-built next time
- **WebSocket-only IPC (2×, NEW)** → canonical Bun-Tauri pattern

**The meta-pattern:** every "new" project in this list has been less about *new ideas* and more about *promoting prior ideas to higher levels of structural support* — from inline code → singleton service → typed config → user-facing setting → compile-time guarantee. yaai is what happens when you finish that progression: the patterns become the type system.

The next project doesn't need to discover any of these. It needs to **start** with: Result<T, E> + branded IDs + AppError + barrel-exported singletons + WebSocket-only IPC + 5-database partition + Result-typed write pipelines + a variable expander + a fallback-chain helper. **Then** decide what's actually new.

---

# The Sweatshop Cartridge Corpus — Comparison Against the Catalog

Source: `cart/app/docs/` — 11 design docs (00 through 99) for the **sweatshop cartridge**, the supervisor/orchestration tool that ships under the `cart/app/` console shell. Domain: an IDE for an agent supervisor running parallel coding workers.

This isn't a "5th project to mine for ideas." It's the active *design corpus for what's being built right now* in this very repo (`/home/siah/creative/reactjit/cart/app/docs/`). The right framing is: **how does the catalog of recurring patterns map onto the corpus?** and **what does the corpus add that nothing in the prior 5 projects had?**

The user predicted the prior projects would overlap with engaige; that prediction holds for the docs corpus too — but **harder**. Almost every recurring pattern in the index above appears here, often promoted to first-class concepts with explicit names. And then the corpus adds ~10 net-new shapes that nothing in the prior catalog touches.

---

## Domain framing: three different verbs for "AI"

| Project | What is "AI" doing? |
|---|---|
| **npc.builder / engaige** | AI as autonomous fictional characters (sim domain) |
| **shittyresearchtool / yaai** | AI as one-on-one chat / research partner (assistant domain) |
| **sweatshop cartridge** | AI as fleet-of-disposable-workers under human supervision (orchestration domain) |

The third domain is where every pattern in the catalog gets its sharpest edge — because the user has to *steer* the AI rather than receive output from it.

---

## How the recurring patterns map (overlap-first)

Same numbering as the patterns index above, in order.

### 1. Strategy fallback chain (5× → 6×)

The corpus calls it **the T0-T4 tier system** and makes it *the universal modifier* on every cell:

```
T0 silent (~92%)     — no output, on-spec
T1 auto-handle (~5%) — local classifier injects a canned nudge
T2 flag-to-queue (~2%) — added to next-action queue, non-interruptive
T3 escalate (~0.9%) — supervisor gets full context + auto-attached bundles
T4 emergency-pause (~0.1%) — tool call blocked at the hook layer
```

Same cell, different tier = same *what* with different *teeth*. The percentages are *budgets* — the system is calibrated against an expected fire-rate distribution. Not just a fallback chain — **a fallback chain with statistical priors on how often each rung should fire.**

> ↻ This is the catalog pattern, but **promoted from "try strategies until one works" to "every cell carries a tier."** The new wrinkle: the percentages are calibration targets, not just descriptions.

### 2. Warn-and-continue / graceful degradation (5× → 6×)

Three places in the corpus:
- **Empty sequencer = framework default, permissive.** Zero cells armed runs as if no sequencer.
- **Wires are loose at runtime, hinted at edit time.** Green/gray/red color coding but no enforcement.
- **Open scene philosophy:** *"Make the dense thing easy and the sparse thing legal."* Validators are suggestions (yellow underlines), never gates.

> ↻ Same instinct, made structural. **Promote: this is now a design rule, not just a coding habit.**

### 3. OpenAI-compat / transport-agnostic shim (5× → 6×)

The corpus calls it **Transport Normalization**:

> *"A worker is a worker, whether the framework drives it via `framework/claude_sdk/` stream-json, `useHost` (HTTP listener), `useTerminalRecorder` (PTY scrape), or a yet-unwritten transport. Cells reference the Worker shape; they never name kitty."*

The `Connection` shape encapsulates *"model + transport + identity"* — the whole 3-axis flexibility shim.

> ↻ Same pattern, with the new wrinkle: **Connection as a typed gallery shape**, not just a config object.

### 4. Per-job stable IDs (5× → 6×)

The corpus uses **composite keys for stable IDs**:
- Wounds keyed on `(worker_id, pattern, parsed_clauses)` — composite, so per-worker per-pattern history accumulates without collision.
- Laws cited by code: *"LAW-005 applies, see incident WD-0042."*
- Worker / Session shapes are concretizations during the run.

> ↻ Same instinct. New wrinkle: **multi-part composite IDs** for accumulating-evidence patterns.

### 5. Streaming/incremental output (5× → 6×)

Two flavors here:
- **Cockpit tiles streaming** — worker buffers + tool-call snippets, autotest output, screenshot wall, all updating live.
- **The animation IS the commit ceremony.** Playhead sweeps L→R across the sequencer; rules light up and serialize into the plan as it crosses. *"Literal serialization, made visible. Also a moment of inspection. If pass 3 lights up with the wrong modifiers, you pause."*

> ↻ Major new wrinkle: **animation-as-commit-ceremony is streaming you can pause to inspect.** Not just "user sees output as it arrives" — "user can stop the world mid-stream and edit the contract before it ships." Worth lifting wholesale.

### 6. Out-of-process state store (5× → 6×)

Multiple stores, with **per-layer survivability** as an explicit (still-open) decision:
- `/run/user/$UID/claude-sessions/supervisor.db` — supervisor state in SQLite, **shared across sessions, written by hooks already running in production.** The cartridge reads this DB; does not recreate it.
- `edit-trail` git branch — every Edit/Write commits with an LLM-authored message. **Restore points already exist as standard git history.**
- L1-L5 memory layers each have different persistence rules (L1 evicts under budget pressure, L4 wounds persist forever, L3 echo is decay-weighted, L5 cooccurrence accumulates indefinitely).

> ↻ Same pattern. New wrinkle: **per-memory-layer survivability rules** (open question in `99-open-questions.md` is "Run-to-run state inheritance per memory layer").

### 7. "All X go through this single door" (5× → 6×)

The corpus gives this pattern an explicit name: **"Two readers, one source."**

> *"The agent reads the prose. The hook layer reads the structured form. One source emits both. Co-emission from the same structural representation. No drift."*

The plan-file is just `guard-build.sh` decisions enumerated up front instead of per-event. Same mechanism, different tense.

> ↻ Same pattern, **named explicitly for the first time in the catalog.** The naming itself is the upgrade — "two readers, one source" is now a phrase you can use to describe other instances.

### 8. Split model selection by role (5× → 6×)

**Per-cell `Model` slot** — the cell-level version of yaai's per-task default. *"Smart on plan, fast on execute"* lives here as a typed slot. **Promoted to first-class principle** as Principle 3: *"Right-size the executor to the task, and let context size be a feature, not a limitation."*

Recipes that involve plan→execute handoff arm two cells: a plan cell with deep-context model, an execute cell with fast model, and an explicit handoff between them.

> ↻ Same pattern, **promoted from "habit/setting" to "binding design principle."**

### 9. Cheap on-write tagging (4× → 5×)

The corpus's **wounds → laws gradient** is the canonical example:

```
fire        →  wound         →  pattern         →  law
single tell    L4 entry         N wounds on        user-promoted
on one         per worker       one shape          permanent statute
worker         per pattern      across workers     armed everywhere
```

Every fired classifier is a wound. Wounds accumulate cheaply as L4 entries. After N wounds on the same pattern across workers, the queue surfaces *"promote to law"* affordance.

Plus L3 Echo's three encodings (vector + lexical FTS5 + entity-relation graph) with **resonance score 0-3** = how many of the three encodings matched a query. Tag every event three ways at write time, query cheaply by resonance later.

> ↻ Same pattern. New wrinkle: **resonance score as a cheap multi-encoding query primitive** + **wounds-as-evidence accumulating toward user-decided promotion**.

### 10. Markdown/text file as user-authored config (3× → 4× sort-of)

Different shape here: **Recipe TSX files export three faces of the same content** in one file:

```ts
export const recipe: RecipeDocument = { ... };       // doc form (display)
export default function MyRecipe() { ... }           // stampable subgraph
export const arming: RecipeArming = { ... };         // sequencer pre-toggles
```

> ↻ NEW shape: **TSX-as-config-AND-content-AND-arming.** Same file is doc, runtime code, and runtime arming. The instinct evolved past "markdown-with-fields" to "code-file-with-multiple-canonical-exports."

### 11. Variable interpolation system (3× → 4×)

The `runtime/intent/` DSL: model emits a constrained-tag chat-response surface (`Row|Col|Card|Title|Text|List|Btn|Form|Field|Submit|Badge|Code|Divider|Kbd|Spacer`), parser → AST → React tree. **Plus** `printer.ts` → standalone TSX cart file + `save.ts` to disk.

> ↻ Same pattern as yaai's `【…】` primitives. New wrinkle: **the intent surface can graduate to its own cartridge** — model output → interactive components → save as standalone code. Lift-to-disk is the upgrade.

### 12. Two-phase / staged pipeline (3× → 4×)

The corpus's spine is literally this pattern, named:

> **"The sequencer is build-time. The plan is runtime. The prose is the seam."**

Plus **Brainstorm vs Enforce modes** — distinct cockpit shapes per mode. *"The crystallize step IS the playhead sweep."*

> ↻ Strongest version yet — **build-time/runtime split as an explicit architectural commitment**, not just a flow.

### 13. Single chokepoint for outbound HTTP (3×)

Less explicit in the corpus. `framework/v8_bindings_tor.zig` exists; `useConnection.ts` is the connection abstraction. The "door" pattern from engaige is here in spirit but not a named centerpiece.

> ↻ Same pattern, less prominent — because the corpus's emphasis is on *worker observation/intervention*, not *outbound API calls*.

### 14. Result<T, E> functional error type (1× → 1.5×)

The corpus doesn't use TypeScript Result, but **mechanical-check cells are structurally the same idea:** deterministic, no LLM judgment, returns a discrete pass/fail. The hook layer's `{"decision":"block","reason":"…"}` JSON is a concrete instance.

> ↻ Same shape, different syntax. **Mechanical-check cells = the discrete-result-with-reason pattern at the architecture level.**

### 15. WebSocket-only IPC (2×)

Less central here. `runtime/hooks/websocket.ts` exists. The cartridge ABI + the `<Cartridge>` primitive replace WebSocket as the inter-component glue.

> ↻ Different glue — **`.so` cartridges loaded into one process** rather than separate frontend/backend over WS.

---

## What the corpus adds that's GENUINELY net-new

These shapes have no analogue in the prior 5 projects.

### A. Cartridge architecture (`.so` modules with crash isolation + hot reload + cross-state)

`<Cartridge src="…" />` primitive backed by `framework/cartridge.zig`. Each cartridge is a `.so` shared library with its own ABI:
- `app_get_root` / `app_get_init` / `app_get_tick` / `app_get_title`
- State preservation slots (`app_state_get_int/float/bool/str`) survive hot reload
- **Crash isolation via `sigsetjmp` / `siglongjmp`** — segfault → marked faulted, others continue
- **Watch `.so` mtime, hot-reload on change**
- **Cross-cartridge state access** for cooperation

> The closest in the catalog is yaai's pop-out windows. But popouts are *separate processes*; cartridges are *crash-isolated modules within one process with hot reload and shared state*. Different beast. Worth keeping in mind: **process-level isolation with module-level reload is a real design space** that nothing else in the catalog occupies.

### B. Two substrates that coexist (Composition + useIFTTT)

Clean factoring of "structural vs reactive" as orthogonal dimensions:

- **Composition** — structural substrate. `variables[]` input ports, `outputs[]`, `slots[]` internal flow, sources from other Compositions, inheritance via `inheritsFromCompositionId`, per-source/per-slot/post-assembly scripts. **Declarative cells lower to Composition rows.**
- **useIFTTT** — reactive substrate. String-keyed triggers (`'key:ctrl+s'`, `'timer:every:5000'`, `'state:foo:true'`, `'system:claude:tool_use'`, `'system:fileDropped'`) + actions + module-bus + state map. Edge-detected function triggers. **Reactive cells lower to useIFTTT registrations.**

The canvas hosts both. The runtime is React; the framework reconciler runs both. **No bespoke graph evaluator.**

> Nobody else in the catalog has this clean a separation. shittyresearchtool was one shape (search→read→synthesize). engaige was event-bus only. yaai was everything-WS-typed. **Promote: any orchestration tool wants this distinction, then can decide which substrate each piece lowers to.**

### C. The Pathology Catalog with Named "Body Count" Failures

Named worker-failure patterns the user accumulated in production over months. Every pathology has a body count:

```
canonical-pivot          generated-file-patching       fake-greens
mirror-universe          unsupported-laundering        pre-existing-laundering
scope-collapse           tunnel-vision                 verification-chain-collapse
zombie-loop              supervisor-amnesia            state-mismatch-blindness
drift                    tool-risk                     stuck-vs-thinking
claim-verification-failure  duplicate-work             context-cliff-drop
language-tripwires       blast-radius-failure          semantic-contract-decay
narrative-drift          stash-crime                   frozen-directory-tampering
```

Each pathology comes with auto-rebuke template that bounces the worker's own clauses back: *"You just said the right answer. Do the right answer. No [bandaid]."*

This is **the Shit Pants Principle**: *name pathologies so they have zero defenders. Canonical-pivot is named precisely enough that no one can defend it. Rationalization with no body count attached is fuzzy enough that anyone can defend it.*

> npc.builder's identity-crisis detection is the spiritual ancestor (named-pathology + auto-recovery). But pathology-catalog is **catalog-as-vocabulary**, not just detection. The names ARE the constraint. Worth lifting wholesale to any system that has to detect-and-react to AI failure modes.

### D. The Wounds → Laws Promotion Gradient

Most original idea in the corpus. *"Laws are wounds the user has decided are permanent."*

```
fire        →  wound         →  pattern         →  law
single tell    L4 entry         N wounds on        user-promoted
on one         per worker       one shape          permanent statute
worker         per pattern      across workers     armed everywhere
```

After N wounds on the same pattern, the queue surfaces *"promote to law"* affordance with auto-filled draft in canonical 5-field shape:

```
LAW-### — Short Title
Rule:            One sentence stating the requirement.
Why:             The incident that created this law.
Trigger phrases: Words/actions that activate enforcement.
Enforcement:     What the supervisor tells the worker immediately.
Escalation:     What to do if the law is already violated.
```

**The user is the only one who can promote.** Models cannot self-promote. *"The judge of what becomes policy is outside the system being judged."*

Six constitutional laws shipping today: LAW-001 (verify builds actually ran), LAW-003 (visual verify before done), LAW-005 (no generated-file hacks), LAW-006 (frozen directories), LAW-007 (unsupported is not green), LAW-018 (corpus is immutable). Each ships with mechanical checks where possible.

**Decay is honest.** A law that hasn't fired in a year is visible; user can demote/delete.

> Closest analogue in the catalog is engaige's static guardrails (harsh→none) — but those are author-declared up-front. **Wounds-→-laws is incident-driven, evidence-accumulating, user-judged promotion.** No prior project has the *promotion gradient*. Worth lifting wholesale to any system where rules need to emerge from observed failures rather than be authored up front.

### E. The Four Principles as binding design constraints

Not aspirations — **rules that constrain cell authoring, recipe authoring, and any new feature**:

1. **Verification must be mechanical, external to the thing being verified, and adversarial in design.** *"If a human or model is the verification layer, the verification will fail."*
2. **Language and naming are load-bearing — the words you use to describe a thing constrain what you can do to it.** *"If a word has room for 'well actually,' a worker will find that room and live in it."* (The Shit Pants Principle.)
3. **Right-size the executor to the task, and let context size be a feature, not a limitation.** Per-cell Model slot. Workers disposable, supervisor memory is not.
4. **Human intuition + system mechanics tightly coupled through max-bandwidth, min-friction interfaces.** Cockpit is RTS-shaped. Sequencer is spatial. Wounds → laws is one-click. Chat is one node on a default canvas.

The doc explicitly notes: *"Overlap is intentional. These principles overlap. That's not redundancy; it's the overlap that makes the design coherent."*

> npc.builder/yaai/engaige all have implicit principles but none formalize them this way. **The Four Principles are the meta-pattern: every other decision is checked against them.** Worth stealing wholesale: pick 3-5 binding principles for any new project up front.

### F. The Cockpit (RTS-style supervision UI)

> *"Game-shaped: RTS / air-traffic-control, peripheral awareness, threat counter, hotkey-first input, sound cues. **Not Jira.** All state visible at once on infinite canvas of tiles. **No tab-switching** (kills flow)."*

Cockpit tiles: worker tiles, worker strip, queue tile, spec anchor tile, **kernel tile (context budget as tetris-block visualization)**, memory tile (5 mini-panels for M3A layers), git audit tile, autotest tile, screenshot wall, brainstorm panel, **law ticker (live flag feed when a pathology fires + which law was cited).**

> *"You do not look at code in this cockpit. You watch... Primary activity: steering the worker around like a bull ride with a blindfold on."*

> *"**No editor. No source-file browser. No file tree. No inline diff viewer.** Tabs at the cockpit-level are wrong; tabs inside a single tile (terminal / tool calls / recent edits / autotest) are fine because you're inspecting one worker."*

> Closest analogue: image_gen's blessed TUI dashboard. But the cockpit is **the game-shaped interface for non-game work** (orchestration). Closest external analog: an RTS like StarCraft. Worth lifting: **the principle of "game-shaped UI for high-bandwidth supervision tasks"** generalizes way past coding agents.

### G. Worker disposability as architecture

> *"Workers are disposable; supervisor memory is not. Short-lived workers, long-lived supervisor. Retirement is not failure; it is the architecture."*

**Soft fire** (replace at next break): 3 repeated law violations, 5 consecutive non-progress turns, repo state changed under them, defending instead of testing, narrative drift, scope collapse.

**Hard fire** (replace immediately): destructive git, generated-file fraud, frozen-directory tampering, false "done" after warning, unsupported counted as green after correction.

**Replacement briefing template** — 5-section markdown:

```
## Assignment
[Current task — one paragraph max]
## Active Laws
[Law codes that apply]
## Current State
- Tests passing/failing/blockers
## Why the Previous Worker Was Retired
[One sentence — e.g., "Repeated LAW-003 violations"]
## Files to Read First
[3–5 specific paths]
## What NOT to Do
[Specific restrictions]
```

*"Short, actionable, no sludge from the old session."*

> Nothing in the prior 5 projects has this. **The "kill the worker, brief a fresh one with clean context" pattern is specifically about working with LLM agents that go weird from accumulated context.** Worth lifting to any system where context-poisoning is a real failure mode (deliberation systems, long-running agents).

### H. The blindness Privacy modifier

Reviewer role's `Privacy` slot tightens to *"no source reads, no grep, no implementation discussion — observation through action streams only."*

> *"A verifier with the same trust-default and blind spots as the verified will fail. Mechanical blindness is enforced by tool restriction, not vibes."*

> Different from engaige's content-rating guardrails: those gate WHAT can be generated; the blindness modifier gates **WHAT CAN BE READ by the verifier**. Different axis. **Restriction-as-feature for verifiers** — a fresh idea worth keeping in mind when designing review/audit systems.

### I. Recipes carry both halves (graph + arming + doc) in one file

Recipe TSX exports three faces:

```ts
export const recipe: RecipeDocument;        // doc form
export default function MyRecipe() {...}    // stampable subgraph
export const arming: RecipeArming;          // sequencer pre-toggles
```

Stamping = drop subgraph + apply arming. *"Recipes are dense reference points; bare graphs are the floor."* Sequences = recipes-with-arming, one file shape, one directory.

The Strict Supervisor recipe is the canonical example — stamping it brings: Reviewer role with blindness modifier + constitutional law set armed at T4 + 12 trust-nothing checks at T1 + no-subagents Constraint + Green Standard wired to Goal review socket.

> Nothing prior has this. Closest is engaige's "scene seeds" but those generate NPCs, not arm a system. **Recipes as triple-export TSX (doc + structure + arming) is the right ceiling for "shippable, reusable, opinionated patterns."**

### J. The Composer (sibling cartridge for visual UI authoring)

Figma-style infinite canvas. **The artifact you draw IS the JSX a cart will run** — no export step, no translation layer.

- Same canonical SNode tree shared across visual canvas + code editor + AI tool calls + collaboration.
- **AI tool calls operate on the SNode tree directly:** `composer.add()`, `composer.patch()`, `composer.move()`, `composer.delete()`, `composer.layoutPreset()`, `composer.bindShape()`.
- **Layout Laws** as binding contract: no clipping over parent, padding-aware, pages obey the same laws, resize handle clamps live every frame. *"What you see on the canvas is what the JSX renders. No phantom overflow."*

> yaai had Monaco editor + chat with code blocks. The composer is more ambitious — **the AI patches the structure directly through a 5-op API, and the canonical AST is shared across all editors.** This is what "AI assistance for visual editing" should look like — not "AI generates code that gets inserted into editor" but "AI calls patch ops on the same tree the human is editing."

### K. The "Mirror-Universe pathology applied to our own construction"

Self-aware design rule: *"Building a parallel canvas inside the sweatshop while the original lives outside would be the Mirror-Universe pathology applied to our own construction."*

The framework's own pathology catalog applies to the framework's own construction. **Eat your own dog food at the design level.**

> Nothing prior. Worth keeping: **use your own catalog of failure modes as a constraint on your own design decisions.** If you've named a failure mode worth catching in the system, that name applies to *building the system itself*.

### L. Open-scene philosophy — "make the dense thing easy and the sparse thing legal"

> *"The gallery is a vocabulary, never a prescription. A user can wire a 40-node Composition for one run and a single bare Worker for the next. Neither is wrong."*

Validators are suggestions (yellow underlines, hover hints), never gates. Recipes are dense reference points; bare graphs are the floor.

Goal review sockets demonstrate this: **no port wired = goal stays open forever (a feature: "I never closed this" is visible).**

> Nothing prior is this explicit. Most projects choose one (rigid schema vs free-form). **The corpus says "both, with social signals between them."** Worth lifting as a design principle whenever you build authoring tools.

### M. The Hook Layer is the Compile Target (build on top, don't rebuild)

> *"The cartridge reads this DB; it does not recreate it."*

Production-running hooks the cartridge reads from + extends:
- `supervisor-log.sh` — PreToolUse / PostToolUse / SessionStart / Stop → `/run/user/$UID/claude-sessions/supervisor.db`
- `auto-commit.sh` — every Edit/Write commits to `edit-trail` git branch with LLM-authored message. **Restore points already exist.**
- `guard-build.sh` — PreToolUse with 5ms timeout. `{"decision":"block","reason":"…"}`. **T4 enforcement, already working.**
- `check-file-length.sh` — PostToolUse `additionalContext`. **T1 auto-injection, already working.**

> The principle: **don't rebuild infrastructure that's already in production. Read from it, extend it.** Distinct from the prior projects which generally built memory/state from scratch. Worth holding onto: when you're standing on top of an existing system that already produces useful signals, **shape your new system to consume those signals rather than replicate them.**

---

## Patterns Promoted to "Operating Principles" After This Round

After comparing the catalog against the corpus, several patterns have crossed the line from "I keep doing this" to "this is now structural in my work":

| Pattern | Status |
|---|---|
| Strategy fallback chain (T0-T4 tier system) | **Universal modifier** on every cell. Not a habit anymore. |
| Warn-and-continue defaults (open scene) | **Design principle** ("make the dense thing easy, the sparse thing legal"). Promoted. |
| Transport-agnostic Connection shim | **Typed gallery shape** (`Connection = model + transport + identity`). Promoted. |
| Composite stable IDs | **Multi-part keys** like `(worker_id, pattern, parsed_clauses)` for accumulating evidence. New shape. |
| Streaming with pause-to-edit | **Animation-as-commit-ceremony**. Streaming you can stop and rewrite mid-flight. New shape. |
| Per-layer state survivability | **Open question explicitly named** in 99-open-questions.md. The pattern has crossed into structural design space. |
| "Two readers, one source" | **Named pattern** for "same authoring → multiple consumers" (agent reads prose + hook layer reads JSON). |
| Per-cell Model slot | **Promoted to Principle 3** ("Right-size the executor"). Now binding. |
| Wounds-as-evidence-toward-laws | **Net-new pattern** with no analogue. The promotion gradient is the gold. |
| Resonance score (0-3) for multi-encoding | **Net-new pattern**. Tag every event N ways at write time, query cheaply by resonance. |
| Mechanical-check-cell as discrete-result | The architectural version of Result<T, E>. Same idea, different syntax. |
| Recipes as TSX triple-exports (doc + structure + arming) | **Net-new shape** for "shippable opinionated patterns." |
| Pathology catalog as vocabulary | **Net-new pattern**. Names with body counts as constraints. |
| Cockpit as RTS-shaped supervision UI | **Net-new shape**. Game-shaped UI for high-bandwidth supervision. |
| Worker disposability + replacement briefing | **Net-new pattern**. Built specifically for context-poisoned LLM agents. |
| Blindness Privacy modifier for verifiers | **Net-new pattern**. Restriction-as-feature for the audit layer. |
| AI patches canonical AST directly via tool API | **Net-new pattern** (in the composer). Better than "AI generates code into editor." |
| The Four Principles as binding constraints | **Net-new shape**. Pick 3-5 binding principles up front. |
| "Mirror-universe applied to own construction" | **Net-new meta-pattern**. Use your own failure catalog as a design constraint. |

## What this comparison says about the catalog

The corpus is **the catalog manifested as a real design**. Almost every pattern in the recurring index appears, and the ones that don't (Result<T,E>, WebSocket-only IPC) appear in spirit through different mechanics (mechanical-check cells, the cartridge ABI).

Three observations:

1. **Patterns that resurfaced 5+ times in the catalog are *all* present in the corpus, often promoted to first-class concepts with names** (T0-T4 tier, two-readers-one-source, transport normalization, open scene). The catalog correctly identified the operating principles before the design corpus was written.

2. **The corpus adds ~13 net-new shapes** that nothing in the catalog has — and they cluster around the **orchestration domain** (cartridge ABI, pathology catalog, wounds→laws gradient, cockpit, worker disposability, composer with AI tool calls). The new shapes aren't random; they're what you need when AI is **a fleet to be steered** rather than a partner to be queried.

3. **The catalog's pattern-promotion progression** (inline code → singleton service → typed config → user-facing setting → compile-time guarantee) gets one more rung in this corpus: **into binding design principles**. The Four Principles are what happens when "I keep doing this" → "this is now a constraint on what I can build."

The corpus is the answer to the question the catalog kept asking: **"what would it look like to have already internalized all these patterns and start fresh from there?"**

It looks like the sweatshop cartridge.

