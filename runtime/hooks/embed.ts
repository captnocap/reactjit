/**
 * embed — local embedding + retrieval, backed by framework/embed.zig
 * (which links libllama_ffi for the model and pgvector for the store).
 *
 * One-process, on-device, no network. Mirrors the API surface that
 * experiments/embed-bench shipped: a shared model loaded into VRAM once,
 * worker contexts that can embed single texts or batched groups, and a
 * cosine-search store keyed by `source_type` so different content kinds
 * (chat-log-chunk, code-chunk, document-chunk, …) coexist in one table.
 *
 * Registration (Zig side, see framework/v8_bindings_embed.zig):
 *
 *   __embed_load_model(modelPath)                 → handle | 0
 *   __embed_free_model(handle)                    → void
 *   __embed_n_dim(handle)                         → integer (n_embd)
 *   __embed_text(handle, text)                    → number[] | null
 *   __embed_batch(handle, textsJson)              → number[][] | null
 *   __embed_rerank(rerankPath, query, candsJson)  → number[]   per-pair scores
 *   __embed_store_open(slug, dim)                 → handle | 0
 *   __embed_store_close(handle)                   → void
 *   __embed_store_upsert(handle, rowJson)         → bool
 *   __embed_store_search_json(handle, qvecJson, n, sourceTypeOrEmpty) → SearchHit[]
 *
 * The slug controls the per-model table name (chunks_<slug>) so multiple
 * models can share one database. `dim` is the vector dimension; the store
 * verifies it on open. See experiments/embed-bench/src/main.zig for the
 * canonical schema (id text PK, source_type, source_id, chunk_index,
 * display_text, text_preview, metadata_json, model, embedded_at, text_sha,
 * vector vector(N)).
 *
 * The embedding is ALWAYS L2-normalized on the Zig side. Cosine == dot.
 *
 * For source-type filtering to be fast, the Zig side expects a matching
 * partial HNSW index per source_type you intend to filter on, e.g.
 *   CREATE INDEX chunks_<slug>_code_hnsw
 *     ON chunks_<slug> USING hnsw (vector vector_cosine_ops)
 *     WHERE source_type = 'code-chunk';
 * The store auto-creates the canonical kinds on first open.
 */

import { callHost, callHostJson, hasHost } from '../ffi';

// ── Types ──────────────────────────────────────────────────────────

export type EmbedHandle = number;
export type StoreHandle = number;

export interface ChunkRow {
  /** stable id (typically sha1 of source_id#chunk_index#model) */
  id: string;
  /** chat-log-chunk | code-chunk | document-chunk | … */
  source_type: string;
  /** source identifier within its kind (e.g. session id, repo path) */
  source_id: string;
  chunk_index: number;
  display_text: string;
  text_preview: string;
  /** stringified JSON, free-form per source_type */
  metadata_json: string;
  /** filename of the .gguf used to embed this row */
  model: string;
  /** sha1 of display_text — for change detection on re-ingest */
  text_sha: string;
  /** L2-normalized vector, length == n_embd */
  vector: number[];
}

export interface SearchHit {
  id: string;
  source_id: string;
  chunk_index: number;
  display_text: string;
  text_preview: string;
  /** cosine similarity in [-1, 1]; 1 = identical */
  dense_score: number;
  /** populated only when rerankWith() is called */
  rerank_score?: number;
}

// ── Availability ───────────────────────────────────────────────────

/** True when framework/v8_bindings_embed.zig is wired into this build. */
export function isAvailable(): boolean {
  return hasHost('__embed_load_model');
}

// ── Model lifecycle ────────────────────────────────────────────────

/**
 * Load a `.gguf` embedding model into VRAM. Returns a handle, or 0 on failure
 * (model file missing, GPU OOM, etc). Loading is synchronous and can take
 * several seconds for the first call — cache the handle and reuse it.
 */
export function loadModel(ggufPath: string): EmbedHandle {
  return callHost<number>('__embed_load_model', 0, ggufPath);
}

export function freeModel(handle: EmbedHandle): void {
  callHost<void>('__embed_free_model', undefined as any, handle);
}

/** Embedding dimension exposed by the model (e.g. 1024 for Qwen3-0.6B). */
export function nDim(handle: EmbedHandle): number {
  return callHost<number>('__embed_n_dim', 0, handle);
}

// ── Single + batched embedding ─────────────────────────────────────

/**
 * Embed one text. The returned vector is L2-normalized (length 1).
 * Returns null if the model rejected the input (empty / un-tokenizable).
 */
export function embedText(handle: EmbedHandle, text: string): number[] | null {
  const v = callHostJson<number[] | null>('__embed_text', null, handle, text);
  return v && v.length > 0 ? v : null;
}

/**
 * Embed N texts in a single GPU dispatch. Returns one vector per input,
 * preserving order. Empty / oversize inputs come back as zero-vectors.
 *
 * Batch size 8–16 is the sweet spot on a 7900 XTX with Qwen3-0.6B-Q8_0.
 * Larger batches saturate KV cache; smaller ones don't amortize matmul setup.
 */
export function embedBatch(handle: EmbedHandle, texts: string[]): number[][] {
  if (texts.length === 0) return [];
  return callHostJson<number[][]>('__embed_batch', [], handle, JSON.stringify(texts));
}

// ── Reranker ───────────────────────────────────────────────────────

/**
 * Cross-encoder rerank. Loads the reranker model lazily on first call.
 * Returns one score per candidate, in input order.
 *
 * Rerank turns a 7/10 dense top-1 into ~9/10 in our internal benchmark.
 * Cost: ~100ms per (query, candidate) pair on the 7900 XTX with the
 * Qwen3-Reranker-0.6B-Q8_0. Use it on dense top-30 → keep top-5.
 */
export function rerank(rerankerGgufPath: string, query: string, candidates: string[]): number[] {
  if (candidates.length === 0) return [];
  return callHostJson<number[]>(
    '__embed_rerank',
    [],
    rerankerGgufPath,
    query,
    JSON.stringify(candidates),
  );
}

// ── Vector store (pgvector) ────────────────────────────────────────

/**
 * Open the per-model store. `slug` controls the table name; pass the same
 * sanitized slug you used at ingest time. `dim` must match the model's n_embd.
 *
 * Embedded postgres is started by the framework on first open and shared
 * across all stores in this process. See framework/pg.zig for the spawn flow.
 */
export function openStore(slug: string, dim: number): StoreHandle {
  return callHost<number>('__embed_store_open', 0, slug, dim);
}

export function closeStore(handle: StoreHandle): void {
  callHost<void>('__embed_store_close', undefined as any, handle);
}

/** Insert or replace a chunk by `id` (the primary key). */
export function upsert(handle: StoreHandle, row: ChunkRow): boolean {
  return callHost<boolean>('__embed_store_upsert', false, handle, JSON.stringify(row));
}

/**
 * Cosine top-N search. Pass `sourceType=''` for unfiltered (default), or a
 * specific kind ('code-chunk', 'chat-log-chunk', …) to use the partial HNSW
 * index for that kind. Wall time on a warm pool: ~10ms for top-50 over 100k.
 */
export function search(
  handle: StoreHandle,
  qvec: number[],
  n: number,
  sourceType: string = '',
): SearchHit[] {
  return callHostJson<SearchHit[]>(
    '__embed_store_search_json',
    [],
    handle,
    JSON.stringify(qvec),
    n,
    sourceType,
  );
}
