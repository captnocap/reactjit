# Local RAG over your Claude Code chat logs

Most RAG examples assume a cloud vector DB and a hosted embedding API. This recipe stays entirely on-device: a Qwen3-Embedding-0.6B model loaded into VRAM, an embedded Postgres + pgvector spawned by the framework on first launch, and a cross-encoder reranker that runs on the same GPU. No keys, no network, no quota.

The example corpus is the one you almost certainly already have: every conversation Claude Code has had with you. The same pipeline works for codex, kimi, the source code in this repo, and the memory `.md` files Claude writes alongside each project. We start with chat logs because they're the densest signal of "what you've been working on."

## What you'll build

- A first-run ingest of `~/.claude/projects/*/*.jsonl` into a local pgvector store.
- A live query box that returns the top-5 chunks for any free-text question in ~20 ms.
- An optional rerank step that turns a 7-of-10 dense top-1 into 9-of-10 with a cross-encoder.

## Architecture

```text
.tsx cart
  ├── useEmbed({ model, reranker, storeSlug })   ← runtime/hooks/useEmbed.ts
  │     ├── framework/v8_bindings_embed.zig      (loads .gguf into Vulkan/CUDA)
  │     └── framework/embed.zig                   (llama.cpp + pgvector glue)
  └── usePostgres()                              ← runtime/hooks/usePostgres.ts
        └── framework/pg.zig                      (pg.zig + auto-spawned embedded postgres)

~/.cache/reactjit-embed/
  ├── embed-pg/                                   ← initdb data dir
  └── embed-pg-sock/.s.PGSQL.5432                 ← unix socket

corpus on disk:
~/.claude/projects/-home-siah-creative-reactjit/*.jsonl
```

The framework spawns the postgres process on first connect; you never run `apt install postgresql`. The store schema is one table per model — `chunks_qwen3_embedding_0_6b_q8_0` for the default — so you can mix multiple embedding models in the same database.

## Pick a model

Qwen3-Embedding ships at three sizes (0.6B / 4B / 8B). On a 7900 XTX with the Q8_0 quant, the 0.6B model embeds at ~40 chunks/sec batched and produces top-1 retrieval that the cross-encoder fixes to ~90% accuracy. The 4B and 8B models trade ~3× the latency for marginal quality gains; start with 0.6B unless you've measured a specific failure mode.

```typescript
const MODEL = '/home/you/.lmstudio/models/Qwen/Qwen3-Embedding-0.6B-GGUF/Qwen3-Embedding-0.6B-Q8_0.gguf';
const RERANKER = '/home/you/.lmstudio/models/DevQuasar/Qwen.Qwen3-Reranker-0.6B-GGUF/Qwen.Qwen3-Reranker-0.6B.Q8_0.gguf';
const SLUG = 'qwen3-embedding-0-6b-q8_0';
```

The `slug` controls the table name (`chunks_<slug>`). Different quants of the same model live in different vector spaces, so they need different tables.

## Mount the hook

```tsx
import { useEmbed } from 'runtime/hooks/useEmbed';

function ChatLogSearch() {
  const { ready, query } = useEmbed({
    model: MODEL,
    reranker: RERANKER,
    storeSlug: SLUG,
  });

  const [q, setQ] = React.useState('');
  const hits = ready && q ? query(q, { k: 5, topn: 30, sourceType: 'chat-log-chunk' }) : [];

  return (
    <Col>
      <TextInput value={q} onChange={setQ} placeholder="ask anything..." />
      {hits.map((h) => (
        <Box key={h.id}>
          <Text>{h.source_id} #{h.chunk_index}</Text>
          <Text size="sm" color="muted">{h.text_preview}</Text>
        </Box>
      ))}
    </Col>
  );
}
```

`useEmbed` loads the model into VRAM on mount, opens the store, and frees both on unmount. `query` runs synchronously — embed (10 ms) + dense search (10 ms) + rerank if `topn > k` (~3 sec for 30 candidates). The first call after mount waits for `ready`; subsequent calls reuse the warm handle.

## Ingest your chat logs

Ingest happens once (then incrementally on each new session). For Claude Code's local logs, walk `~/.claude/projects/<slug>/*.jsonl` and feed each session into `embedBatch` in groups of 16:

```typescript
import { useEmbed } from 'runtime/hooks/useEmbed';
import * as fs from 'runtime/hooks/fs';

const WINDOW = 4;       // events per chunk
const OVERLAP = 2;      // sliding window stride

function chunkSession(eventsJsonl: string): string[] {
  const events = eventsJsonl.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const out: string[] = [];
  for (let i = 0; i < events.length; i += (WINDOW - OVERLAP)) {
    const window = events.slice(i, i + WINDOW);
    if (window.length === 0) break;
    out.push(window.map(eventToText).join('\n\n'));
  }
  return out;
}

async function ingestSession(path: string, embed: ReturnType<typeof useEmbed>) {
  const sessionId = path.split('/').pop()!.replace('.jsonl', '');
  const raw = await fs.readText(path);
  const chunks = chunkSession(raw);
  // Batch in 16s — sweet spot for KV cache vs matmul amortization.
  for (let i = 0; i < chunks.length; i += 16) {
    const batch = chunks.slice(i, i + 16);
    const vectors = embed.embedBatch(batch);
    for (let j = 0; j < batch.length; j++) {
      embed.upsert({
        id: shaOf(`${sessionId}#${i + j}#${MODEL}`),
        source_type: 'chat-log-chunk',
        source_id: sessionId,
        chunk_index: i + j,
        display_text: batch[j],
        text_preview: batch[j].slice(0, 160),
        metadata_json: '{}',
        model: MODEL.split('/').pop()!,
        text_sha: shaOf(batch[j]),
        vector: vectors[j],
      });
    }
  }
}
```

`embed.embedBatch(batch)` packs all 16 sequences into a single GPU dispatch. We measured 1.5× wall-clock speedup over single-sequence embedding on the 7900 XTX with 4 worker contexts; the win is bigger on smaller GPUs where matmul setup dominates.

## Source-type partial indexes

The store mixes chunk kinds (`chat-log-chunk`, `code-chunk`, `document-chunk`) in one table to keep the schema simple. pgvector 0.5.1 does post-filter HNSW, which means a `WHERE source_type='code-chunk'` query against a table that's 90 % chat-log will frequently return zero hits — the index returned its top-K as chat-log, then the WHERE filter dropped them all.

Fix: a partial HNSW index per kind you intend to filter on. The framework creates these automatically the first time you upsert a row of a new kind, but you can also seed them up front:

```sql
CREATE INDEX chunks_qwen3_embedding_0_6b_q8_0_code_hnsw
  ON chunks_qwen3_embedding_0_6b_q8_0
  USING hnsw (vector vector_cosine_ops)
  WHERE source_type = 'code-chunk';
```

With that index in place, filtered queries route through the per-kind HNSW and return in ~10 ms regardless of the dominant slice.

## What the queries look like

Sample queries we ran against a 105k-chunk Claude-log corpus (qwen3-0.6B-Q8_0, no rerank):

| Query | Top hit | Latency |
|---|---|---|
| "where is the layout engine" | `framework/engine.zig` | 17 ms |
| "tailwind className parser" | `runtime/tw.ts` | 18 ms |
| "voice VAD wake word" | `cart/voice_lab.tsx` | 18 ms |
| "esbuild bundle cart tsx" | `scripts/cart-bundle.js` | 17 ms |

All four returned the canonical file as #1 with no rerank. The remaining 30 % of queries (where dense top-1 is a near-miss) get fixed when you add `topn: 30` and let the cross-encoder rerank pick the winner.

## Going further

- **Code corpus.** Same pipeline, `sourceType: 'code-chunk'`, walker on `framework/`, `runtime/`, `cart/` instead of `~/.claude/projects/`. Skip the bundled subdirs — `lua/`, `reactjit/`, `node_modules/` — by extending the walker's skip list.
- **Live ingest.** Watch `~/.claude/projects/` with the framework's fs-watch hook and call `ingestSession` on each modified `.jsonl`. Concurrent reads + writes are first-class in pg — queries running during ingest just see fewer rows.
- **Multi-model.** Open two `useEmbed` calls with different `model` + `storeSlug`, query both, fuse with reciprocal rank. Costs 2× the VRAM but the ensemble usually wins on hard queries.
- **Hybrid search.** Add a `tsvector` column on `display_text` for keyword search; blend dense + lexical with reciprocal rank fusion. Helpful when the user types a literal identifier the embedder doesn't recognize as semantically meaningful.
