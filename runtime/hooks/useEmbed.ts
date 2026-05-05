/**
 * useEmbed — local embedding + retrieval as a one-liner.
 *
 * Wraps `runtime/hooks/embed.ts` with React state so a cart can do:
 *
 *   const { ready, query, embed } = useEmbed({
 *     model: '~/Models/Qwen3-Embedding-0.6B-Q8_0.gguf',
 *     reranker: '~/Models/Qwen3-Reranker-0.6B-Q8_0.gguf',  // optional
 *     storeSlug: 'qwen3-embedding-0-6b-q8_0',
 *   });
 *
 *   const hits = await query('how does the layout engine handle flexbox?', {
 *     k: 5, sourceType: 'code-chunk', topn: 30,
 *   });
 *
 * `ready` flips true once the model is loaded into VRAM. The model handle
 * is owned by the hook — unmounting frees it.
 *
 * Retrieval pipeline when `topn > k` and a reranker is configured:
 *   1. embed(query)                     ~10ms
 *   2. dense top-N from pgvector        ~10ms (HNSW)
 *   3. cross-encoder rerank N pairs     ~100ms × N
 *   4. sort by rerank, return top-K
 *
 * Without rerank, we skip step 3 and return dense top-K directly.
 *
 * The corresponding ingest path lives in `embed.ts` (loadModel, embedBatch,
 * upsert). Most carts use the live one — the framework writes chunks while
 * the user works — but offline ingest is also fine; pg supports concurrent
 * read+write so a query mid-ingest just sees fewer rows.
 */

import { useEffect, useRef, useState } from 'react';
import * as embed from './embed';

export interface UseEmbedOpts {
  /** Path to a `.gguf` embedding model. Loaded into VRAM on mount. */
  model: string;
  /** Optional path to a `.gguf` reranker. Loaded lazily on first rerank. */
  reranker?: string;
  /**
   * Sanitized model slug — controls the per-model table (chunks_<slug>).
   * For the canonical Qwen3-Embedding-0.6B-Q8_0 ingest this is
   * 'qwen3-embedding-0-6b-q8_0'.
   */
  storeSlug: string;
}

export interface QueryOpts {
  /** How many hits to return after the full pipeline. Default 5. */
  k?: number;
  /**
   * How many candidates to fetch from dense search. When a reranker is set
   * and `topn > k`, the reranker scores all `topn` and we keep top-`k`.
   * Default = `k` (no rerank stage).
   */
  topn?: number;
  /**
   * Filter by chunk kind. Empty string = unfiltered. Common values:
   * 'code-chunk', 'chat-log-chunk', 'document-chunk'.
   */
  sourceType?: string;
}

export type EmbedHit = embed.SearchHit;

export function useEmbed(opts: UseEmbedOpts) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modelRef = useRef<embed.EmbedHandle>(0);
  const storeRef = useRef<embed.StoreHandle>(0);
  const dimRef = useRef<number>(0);

  useEffect(() => {
    if (!embed.isAvailable()) {
      setError('embed host bindings not registered (framework/v8_bindings_embed.zig)');
      return;
    }
    const m = embed.loadModel(opts.model);
    if (m === 0) {
      setError(`failed to load embedding model: ${opts.model}`);
      return;
    }
    modelRef.current = m;
    dimRef.current = embed.nDim(m);
    const s = embed.openStore(opts.storeSlug, dimRef.current);
    if (s === 0) {
      embed.freeModel(m);
      modelRef.current = 0;
      setError(`failed to open store for slug: ${opts.storeSlug}`);
      return;
    }
    storeRef.current = s;
    setReady(true);
    return () => {
      if (storeRef.current) embed.closeStore(storeRef.current);
      if (modelRef.current) embed.freeModel(modelRef.current);
      storeRef.current = 0;
      modelRef.current = 0;
      setReady(false);
    };
  }, [opts.model, opts.storeSlug]);

  /** Embed an arbitrary text. Returns an L2-normalized vector. */
  function embedOne(text: string): number[] | null {
    if (!modelRef.current) return null;
    return embed.embedText(modelRef.current, text);
  }

  /** Embed N texts in a single GPU dispatch. Order preserved. */
  function embedMany(texts: string[]): number[][] {
    if (!modelRef.current) return [];
    return embed.embedBatch(modelRef.current, texts);
  }

  /**
   * Run a retrieval query. Returns hits sorted by rerank score when a
   * reranker is configured and `topn > k`, else by dense score.
   */
  function runQuery(text: string, qopts: QueryOpts = {}): EmbedHit[] {
    if (!modelRef.current || !storeRef.current) return [];
    const k = qopts.k ?? 5;
    const sourceType = qopts.sourceType ?? '';
    const topn = qopts.topn ?? k;
    const qvec = embed.embedText(modelRef.current, text);
    if (!qvec) return [];
    const fetchN = opts.reranker && topn > k ? topn : k;
    const hits = embed.search(storeRef.current, qvec, fetchN, sourceType);
    if (!opts.reranker || topn <= k || hits.length === 0) return hits.slice(0, k);
    const cands = hits.map((h) => h.display_text);
    const scores = embed.rerank(opts.reranker, text, cands);
    for (let i = 0; i < hits.length; i++) hits[i].rerank_score = scores[i] ?? 0;
    hits.sort((a, b) => (b.rerank_score ?? 0) - (a.rerank_score ?? 0));
    return hits.slice(0, k);
  }

  /** Insert or replace a chunk row. Use during live ingest. */
  function upsert(row: embed.ChunkRow): boolean {
    if (!storeRef.current) return false;
    return embed.upsert(storeRef.current, row);
  }

  // ── Multi-worker ingest ─────────────────────────────────────────────
  //
  // The pool runs N OS threads on the zig side, sharing one model in VRAM.
  // The cart kicks it off, polls progress every 200ms, and stops polling
  // when the pool reports `done`. The render path stays free during ingest.

  const EMPTY: embed.IngestProgress = {
    running: false,
    files_total: 0,
    files_done: 0,
    chunks_done: 0,
    embed_ms_sum: 0,
    current_file: '',
    done: false,
    cancelled: false,
    error: '',
  };
  const [ingest, setIngest] = useState<embed.IngestProgress>(EMPTY);
  const pollingRef = useRef<any>(null);

  function startIngest(rootPath: string, nWorkers: number = 4, kind: embed.EmbedKind = 'code'): boolean {
    const ok = embed.ingestStart(rootPath, {
      modelPath: opts.model,
      slug: opts.storeSlug,
      kind,
      nWorkers,
    });
    if (!ok) return false;
    setIngest({ ...EMPTY, running: true });
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => {
      const snap = embed.ingestProgress();
      setIngest(snap);
      if (snap.done || !snap.running) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }, 200);
    return true;
  }

  function cancelIngest(): boolean {
    return embed.ingestCancel();
  }

  useEffect(() => () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
  }, []);

  return {
    ready,
    error,
    /** Vector dimension exposed by the model (e.g. 1024 for Qwen3-0.6B). */
    nDim: () => dimRef.current,
    embed: embedOne,
    embedBatch: embedMany,
    query: runQuery,
    upsert,
    /** Live snapshot of the active ingest (or empty when idle). */
    ingest,
    /** Kick off a multi-worker ingest. Returns false if one is already running. */
    startIngest,
    /** Flip the cancel flag — workers exit after their current batch. */
    cancelIngest,
  };
}
