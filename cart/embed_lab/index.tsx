// embed_lab — build + query a local embedding index, end-to-end.
//
// What it validates:
//   1. useEmbed loads a Qwen3-Embedding .gguf into VRAM (framework/embed.zig)
//   2. usePostgres / the framework's auto-spawned embedded postgres
//   3. embedBatch + Store.upsert as the live ingest path
//   4. searchTopNFiltered round-trips back into the cart
//
// Lifecycle:
//   idle → user fills in path + batch size → click Build →
//   ingesting (live progress bar) → done → query box appears.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Row, Col, Text, Pressable, ScrollView, TextInput } from '@reactjit/runtime/primitives';
import { useEmbed } from '@reactjit/runtime/hooks/useEmbed';
import * as fs from '@reactjit/runtime/hooks/fs';

// ── defaults ───────────────────────────────────────────────────────────

const DEFAULT_MODEL =
  '/home/siah/.lmstudio/models/Qwen/Qwen3-Embedding-0.6B-GGUF/Qwen3-Embedding-0.6B-Q8_0.gguf';
const DEFAULT_SLUG = 'qwen3-embedding-0-6b-q8_0';
const DEFAULT_PATH = '/home/siah/.claude/projects/-home-siah-creative-reactjit';
const DEFAULT_BATCH = 16;

// File extensions we'll embed. Anything else is skipped during the walk.
const EMBEDDABLE_EXT = ['.jsonl', '.md', '.ts', '.tsx', '.js', '.jsx', '.zig', '.lua', '.py'];
// Skip known noise dirs without recursing.
const SKIP_DIRS = new Set([
  'node_modules', 'zig-out', 'zig-cache', 'dist', 'target', 'build',
  '.git', '.cache', 'vendor', 'editor', 'reactjit',
]);

// Chunking knobs. Mirrors the embed-bench code-chunk shape: ~200 lines per
// chunk with 50-line overlap. Small enough to fit in n_ctx=8192 with batch=16.
const CHUNK_LINES = 200;
const CHUNK_OVERLAP = 50;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const PREVIEW_CHARS = 160;

// ── helpers ────────────────────────────────────────────────────────────

function isEmbeddable(name: string): boolean {
  return EMBEDDABLE_EXT.some((ext) => name.endsWith(ext));
}

function detectLang(path: string): string {
  if (path.endsWith('.tsx')) return 'tsx';
  if (path.endsWith('.ts')) return 'typescript';
  if (path.endsWith('.jsx')) return 'jsx';
  if (path.endsWith('.js')) return 'javascript';
  if (path.endsWith('.zig')) return 'zig';
  if (path.endsWith('.lua')) return 'lua';
  if (path.endsWith('.py')) return 'python';
  if (path.endsWith('.md')) return 'markdown';
  if (path.endsWith('.jsonl')) return 'jsonl';
  return 'text';
}

/**
 * Recursively walk `root` and return absolute paths of files we want to
 * embed. Synchronous (host fs is sync). Don't run on giant trees without
 * a cap — for the cart we trust the user's input.
 */
function walkFiles(root: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    const names = fs.listDir(dir);
    for (const name of names) {
      if (SKIP_DIRS.has(name)) continue;
      if (name.startsWith('.')) continue;
      const full = `${dir}/${name}`;
      const st = fs.stat(full);
      if (!st) continue;
      if (st.isDir) {
        stack.push(full);
        continue;
      }
      if (st.size > MAX_FILE_BYTES) continue;
      if (!isEmbeddable(name)) continue;
      out.push(full);
    }
  }
  out.sort();
  return out;
}

/**
 * Cheap hash for chunk IDs. Not cryptographic — we only need a stable
 * 16-hex-char identifier per (file, chunk_index, model). djb2 over UTF-8
 * code units, then 64-bit fold to hex.
 */
function djb2Hex(input: string): string {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = (h1 * 33) ^ c;
    h2 = (h2 * 33) ^ c;
  }
  // Mix to widen collision resistance vs single 32-bit djb2.
  const a = (h1 >>> 0).toString(16).padStart(8, '0');
  const b = (h2 >>> 0).toString(16).padStart(8, '0');
  return a + b;
}

/**
 * Split text into overlapping line-windows. Returns the chunk bodies.
 * For .jsonl files, prepend a per-event marker so each chunk is
 * semantically self-contained instead of a random byte slice.
 */
function chunkText(content: string, relPath: string): string[] {
  const lang = detectLang(relPath);
  const lines = content.split('\n');
  if (lines.length === 0) return [];
  const out: string[] = [];
  const stride = Math.max(1, CHUNK_LINES - CHUNK_OVERLAP);
  for (let i = 0; i < lines.length; i += stride) {
    const end = Math.min(i + CHUNK_LINES, lines.length);
    const header = `// File: ${relPath}\n// Lang: ${lang}\n// Lines: ${i + 1}-${end}\n\n`;
    const body = lines.slice(i, end).join('\n');
    out.push(header + body);
    if (end === lines.length) break;
  }
  return out;
}

function relTo(path: string, root: string): string {
  if (path.startsWith(root + '/')) return path.slice(root.length + 1);
  return path;
}

// Hand off to the event loop so React can paint the latest state. The cart
// runtime polls setState through the reconciler, so progress is visible
// between every batch.
function yieldToFrame(): Promise<void> {
  return new Promise((res) => setTimeout(res, 0));
}

// ── UI ─────────────────────────────────────────────────────────────────

const C = {
  bg: '#0d1117',
  surface: '#161b22',
  surface2: '#21262d',
  border: '#30363d',
  text: '#e6edf3',
  dim: '#7d8590',
  accent: '#2f81f7',
  good: '#3fb950',
  warn: '#d29922',
  err: '#f85149',
};

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  hint?: string;
}) {
  return (
    <Col style={{ gap: 4 } as any}>
      <Text style={{ fontSize: 12, color: C.dim }}>{label}</Text>
      <TextInput
        value={value}
        onChange={onChange}
        style={{
          backgroundColor: C.surface2,
          color: C.text,
          borderWidth: 1,
          borderColor: C.border,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 6,
          paddingBottom: 6,
          fontSize: 13,
          height: 32,
        } as any}
      />
      {hint ? <Text style={{ fontSize: 11, color: C.dim }}>{hint}</Text> : null}
    </Col>
  );
}

function Button({
  label,
  onPress,
  disabled,
  variant,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
}) {
  const bg = disabled
    ? C.surface
    : variant === 'ghost'
    ? C.surface2
    : C.accent;
  const fg = disabled ? C.dim : variant === 'ghost' ? C.text : '#fff';
  return (
    <Pressable
      onPress={() => { if (!disabled) onPress(); }}
      style={{
        backgroundColor: bg,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 8,
        paddingBottom: 8,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
      } as any}
    >
      <Text style={{ color: fg, fontSize: 13, fontWeight: 600 } as any}>{label}</Text>
    </Pressable>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <Box
      style={{
        width: '100%',
        height: 8,
        backgroundColor: C.surface2,
        borderRadius: 4,
        overflow: 'hidden',
      } as any}
    >
      <Box
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          backgroundColor: C.accent,
        } as any}
      />
    </Box>
  );
}

// ── ingest pipeline ────────────────────────────────────────────────────

interface IngestState {
  filesTotal: number;
  filesDone: number;
  chunksDone: number;
  currentFile: string;
  startedAt: number;
  errorText: string;
  lastBatchMs: number;
}

const INITIAL_INGEST: IngestState = {
  filesTotal: 0,
  filesDone: 0,
  chunksDone: 0,
  currentFile: '',
  startedAt: 0,
  errorText: '',
  lastBatchMs: 0,
};

interface QueryHit {
  source_id: string;
  chunk_index: number;
  text_preview: string;
  dense_score: number;
}

export default function EmbedLab() {
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [slug, setSlug] = useState(DEFAULT_SLUG);
  const [indexPath, setIndexPath] = useState(DEFAULT_PATH);
  const [batchSize, setBatchSize] = useState(String(DEFAULT_BATCH));
  const [phase, setPhase] = useState<'idle' | 'ingesting' | 'done'>('idle');
  const [ingest, setIngest] = useState<IngestState>(INITIAL_INGEST);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<QueryHit[]>([]);
  const [queryMs, setQueryMs] = useState(0);

  const cancelRef = useRef(false);

  const embed = useEmbed({ model, storeSlug: slug });

  const batchN = useMemo(() => {
    const n = parseInt(batchSize, 10);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_BATCH;
    return Math.min(64, Math.max(1, n));
  }, [batchSize]);

  async function runIngest() {
    cancelRef.current = false;
    setPhase('ingesting');
    setIngest({ ...INITIAL_INGEST, startedAt: Date.now() });

    const root = indexPath.replace(/\/+$/, '');
    let files: string[] = [];
    try {
      files = walkFiles(root);
    } catch (e: any) {
      setIngest((s) => ({ ...s, errorText: 'walk failed: ' + (e?.message ?? String(e)) }));
      setPhase('done');
      return;
    }

    if (files.length === 0) {
      setIngest((s) => ({ ...s, errorText: 'no embeddable files under ' + root, filesTotal: 0 }));
      setPhase('done');
      return;
    }

    setIngest((s) => ({ ...s, filesTotal: files.length }));
    await yieldToFrame();

    const modelName = model.split('/').pop() ?? model;
    let chunksDone = 0;

    for (let fi = 0; fi < files.length; fi++) {
      if (cancelRef.current) break;
      const path = files[fi];
      const rel = relTo(path, root);

      setIngest((s) => ({ ...s, currentFile: rel, filesDone: fi }));
      await yieldToFrame();

      const content = fs.readFile(path);
      if (content === null) continue;

      const chunks = chunkText(content, rel);
      if (chunks.length === 0) continue;

      const sourceId = `code/${rel}`;
      let cstart = 0;
      while (cstart < chunks.length) {
        if (cancelRef.current) break;
        const cend = Math.min(cstart + batchN, chunks.length);
        const slice = chunks.slice(cstart, cend);

        const t0 = Date.now();
        const vectors = embed.embedBatch(slice);
        const t1 = Date.now();

        for (let j = 0; j < slice.length; j++) {
          const text = slice[j];
          const vec = vectors[j];
          if (!vec || vec.length === 0) continue;
          const ci = cstart + j;
          const id = djb2Hex(`${sourceId}#${ci}#${modelName}`);
          embed.upsert({
            id,
            source_type: 'code-chunk',
            source_id: sourceId,
            chunk_index: ci,
            display_text: text,
            text_preview: text.slice(0, PREVIEW_CHARS),
            metadata_json: '{}',
            model: modelName,
            text_sha: djb2Hex(text),
            vector: vec,
          });
          chunksDone += 1;
        }

        setIngest((s) => ({ ...s, chunksDone, lastBatchMs: t1 - t0 }));
        await yieldToFrame();
        cstart = cend;
      }
    }

    setIngest((s) => ({ ...s, filesDone: files.length, currentFile: '' }));
    setPhase('done');
  }

  function runQuery() {
    if (!embed.ready || !query.trim()) {
      setHits([]);
      return;
    }
    const t0 = Date.now();
    const out = embed.query(query, { k: 10, sourceType: 'code-chunk' });
    const t1 = Date.now();
    setHits(out as QueryHit[]);
    setQueryMs(t1 - t0);
  }

  // Auto-run query on enter / change after ingest is done. Debounced via
  // useEffect — every keystroke just kicks the latest one.
  useEffect(() => {
    if (phase !== 'done') return;
    const id = setTimeout(runQuery, 250);
    return () => clearTimeout(id);
  }, [query, phase]);

  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: C.bg,
        flexDirection: 'column',
      } as any}
    >
      <Header phase={phase} ready={embed.ready} error={embed.error} />

      <Box style={{ flexGrow: 1, padding: 24, gap: 16 } as any}>
        <BuildPanel
          model={model}
          setModel={setModel}
          slug={slug}
          setSlug={setSlug}
          indexPath={indexPath}
          setIndexPath={setIndexPath}
          batchSize={batchSize}
          setBatchSize={setBatchSize}
          phase={phase}
          ready={embed.ready}
          onBuild={runIngest}
          onCancel={() => { cancelRef.current = true; }}
        />

        {phase !== 'idle' ? (
          <IngestPanel ingest={ingest} batchN={batchN} phase={phase} />
        ) : null}

        {phase === 'done' ? (
          <QueryPanel
            query={query}
            setQuery={setQuery}
            hits={hits}
            queryMs={queryMs}
            onSubmit={runQuery}
          />
        ) : null}
      </Box>
    </Box>
  );
}

function Header({ phase, ready, error }: { phase: string; ready: boolean; error: string | null }) {
  const status = error
    ? `error: ${error}`
    : ready
    ? `model loaded · phase=${phase}`
    : 'loading model into VRAM…';
  const color = error ? C.err : ready ? C.good : C.warn;
  return (
    <Row
      style={{
        backgroundColor: C.surface,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'space-between',
      } as any}
    >
      <Col>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: 600 } as any}>Embed Lab</Text>
        <Text style={{ color: C.dim, fontSize: 12 } as any}>
          local Qwen3 + pgvector · validates runtime/hooks/useEmbed end-to-end
        </Text>
      </Col>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 } as any}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color } as any} />
        <Text style={{ color: C.dim, fontSize: 12 } as any}>{status}</Text>
      </Box>
    </Row>
  );
}

function BuildPanel({
  model, setModel, slug, setSlug, indexPath, setIndexPath, batchSize, setBatchSize,
  phase, ready, onBuild, onCancel,
}: {
  model: string;
  setModel: (s: string) => void;
  slug: string;
  setSlug: (s: string) => void;
  indexPath: string;
  setIndexPath: (s: string) => void;
  batchSize: string;
  setBatchSize: (s: string) => void;
  phase: string;
  ready: boolean;
  onBuild: () => void;
  onCancel: () => void;
}) {
  const ingesting = phase === 'ingesting';
  return (
    <Col
      style={{
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 8,
        padding: 16,
        gap: 12,
      } as any}
    >
      <Text style={{ color: C.text, fontSize: 13, fontWeight: 600 } as any}>Build an index</Text>

      <Field
        label="Model (.gguf)"
        value={model}
        onChange={setModel}
        hint="Loaded into VRAM on mount. Default is Qwen3-Embedding-0.6B-Q8_0."
      />
      <Field
        label="Slug"
        value={slug}
        onChange={setSlug}
        hint="Per-model table is chunks_<slug>. Different quants need different slugs."
      />
      <Field
        label="Index path"
        value={indexPath}
        onChange={setIndexPath}
        hint="Directory walked recursively. .ts/.tsx/.zig/.md/.jsonl/.lua/.py are embedded."
      />
      <Field
        label="Agents (batch size)"
        value={batchSize}
        onChange={setBatchSize}
        hint="Sequences per GPU dispatch. 16 amortises matmul setup; 1 is single-seq path."
      />

      <Row style={{ gap: 8 } as any}>
        <Button
          label={ingesting ? 'Building…' : 'Build index'}
          onPress={onBuild}
          disabled={!ready || ingesting}
        />
        {ingesting ? <Button label="Cancel" variant="ghost" onPress={onCancel} /> : null}
      </Row>
    </Col>
  );
}

function IngestPanel({
  ingest, batchN, phase,
}: {
  ingest: IngestState;
  batchN: number;
  phase: string;
}) {
  const pct = ingest.filesTotal > 0 ? ingest.filesDone / ingest.filesTotal : 0;
  const elapsed = ingest.startedAt > 0 ? (Date.now() - ingest.startedAt) / 1000 : 0;
  const rate = elapsed > 0 ? ingest.chunksDone / elapsed : 0;
  return (
    <Col
      style={{
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 8,
        padding: 16,
        gap: 12,
      } as any}
    >
      <Row style={{ justifyContent: 'space-between' } as any}>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: 600 } as any}>
          {phase === 'ingesting' ? 'Ingesting…' : phase === 'done' ? 'Done' : ''}
        </Text>
        <Text style={{ color: C.dim, fontSize: 12 } as any}>
          {ingest.filesDone}/{ingest.filesTotal} files · {ingest.chunksDone} chunks ·{' '}
          {rate.toFixed(1)} chunks/s · batch={batchN} · {ingest.lastBatchMs}ms last batch
        </Text>
      </Row>
      <ProgressBar value={pct} />
      {ingest.currentFile ? (
        <Text style={{ color: C.dim, fontSize: 11 } as any} numberOfLines={1}>
          {ingest.currentFile}
        </Text>
      ) : null}
      {ingest.errorText ? (
        <Text style={{ color: C.err, fontSize: 12 } as any}>{ingest.errorText}</Text>
      ) : null}
    </Col>
  );
}

function QueryPanel({
  query, setQuery, hits, queryMs, onSubmit,
}: {
  query: string;
  setQuery: (s: string) => void;
  hits: QueryHit[];
  queryMs: number;
  onSubmit: () => void;
}) {
  return (
    <Col
      style={{
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 8,
        padding: 16,
        gap: 12,
        flexGrow: 1,
        minHeight: 0,
      } as any}
    >
      <Row style={{ justifyContent: 'space-between' } as any}>
        <Text style={{ color: C.text, fontSize: 13, fontWeight: 600 } as any}>Query</Text>
        <Text style={{ color: C.dim, fontSize: 12 } as any}>
          {hits.length} hits · {queryMs}ms
        </Text>
      </Row>
      <Row style={{ gap: 8 } as any}>
        <Box style={{ flexGrow: 1 } as any}>
          <Field label="" value={query} onChange={setQuery} />
        </Box>
        <Button label="Run" onPress={onSubmit} />
      </Row>
      <ScrollView style={{ flexGrow: 1, minHeight: 0 } as any}>
        <Col style={{ gap: 8 } as any}>
          {hits.map((h, i) => (
            <HitRow key={`${h.source_id}#${h.chunk_index}`} hit={h} rank={i + 1} />
          ))}
          {hits.length === 0 ? (
            <Text style={{ color: C.dim, fontSize: 12 } as any}>
              {query ? 'no results yet' : 'type a query…'}
            </Text>
          ) : null}
        </Col>
      </ScrollView>
    </Col>
  );
}

function HitRow({ hit, rank }: { hit: QueryHit; rank: number }) {
  return (
    <Box
      style={{
        backgroundColor: C.surface2,
        borderRadius: 4,
        padding: 8,
        flexDirection: 'column',
        gap: 4,
      } as any}
    >
      <Row style={{ justifyContent: 'space-between' } as any}>
        <Text style={{ color: C.accent, fontSize: 12, fontWeight: 600 } as any}>
          {rank}. {hit.source_id}#{hit.chunk_index}
        </Text>
        <Text style={{ color: C.dim, fontSize: 11 } as any}>
          {hit.dense_score.toFixed(4)}
        </Text>
      </Row>
      <Text style={{ color: C.dim, fontSize: 11 } as any} numberOfLines={3}>
        {hit.text_preview}
      </Text>
    </Box>
  );
}
