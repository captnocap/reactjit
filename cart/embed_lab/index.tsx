// embed_lab — build + query a local embedding index, end-to-end.
//
// What it validates:
//   1. useEmbed loads a Qwen3-Embedding .gguf into VRAM (framework/embed.zig)
//   2. usePostgres / the framework's auto-spawned embedded postgres
//   3. The MULTI-WORKER ingest pool: N zig threads, each holding their
//      own llama context against one shared model in VRAM, pulling files
//      off a JobQueue and writing chunks to pgvector concurrently.
//   4. searchTopNFiltered round-trips back into the cart for query.
//
// Lifecycle:
//   idle → user fills in path + agent count → click Build →
//   ingesting (live progress polled from zig every 200ms) →
//   done → query box appears.

import { useEffect, useState } from 'react';
import { Box, Row, Col, Text, Pressable, ScrollView, TextInput } from '@reactjit/runtime/primitives';
import { useEmbed } from '@reactjit/runtime/hooks/useEmbed';

// ── defaults ───────────────────────────────────────────────────────────

const DEFAULT_MODEL =
  '/home/siah/.lmstudio/models/Qwen/Qwen3-Embedding-0.6B-GGUF/Qwen3-Embedding-0.6B-Q8_0.gguf';
const DEFAULT_SLUG = 'qwen3-embedding-0-6b-q8_0';
const DEFAULT_PATH = '/home/siah/.claude/projects/-home-siah-creative-reactjit';
// 2 is a safe default on a display-driving GPU. Each agent costs ~900 MB
// KV + ~1.3 GB compute scratch on top of the shared model. Push higher
// if your GPU is not also driving displays.
const DEFAULT_WORKERS = 2;

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

// ── shared UI bits ─────────────────────────────────────────────────────

function Field({
  label, value, onChange, hint,
}: { label: string; value: string; onChange: (s: string) => void; hint?: string }) {
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
  label, onPress, disabled, variant,
}: { label: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'ghost' }) {
  const bg = disabled ? C.surface : variant === 'ghost' ? C.surface2 : C.accent;
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

// ── main ───────────────────────────────────────────────────────────────

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
  const [agents, setAgents] = useState(String(DEFAULT_WORKERS));
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<QueryHit[]>([]);
  const [queryMs, setQueryMs] = useState(0);
  const [startedAt, setStartedAt] = useState(0);

  const e = useEmbed({ model, storeSlug: slug });
  const ingest = e.ingest;

  // Phase derived from ingest state instead of explicit setState. Keeps the
  // hook's state and the UI in lock-step without manual flipping.
  const phase: 'idle' | 'ingesting' | 'done' =
    ingest.done || (!ingest.running && ingest.files_total > 0)
      ? 'done'
      : ingest.running
      ? 'ingesting'
      : 'idle';

  function handleBuild() {
    const n = parseInt(agents, 10);
    const nWorkers = Number.isFinite(n) && n > 0 ? Math.min(16, n) : DEFAULT_WORKERS;
    setStartedAt(Date.now());
    e.startIngest(indexPath.replace(/\/+$/, ''), nWorkers, 'code-chunk');
  }

  function runQuery() {
    if (!e.ready || !query.trim()) {
      setHits([]);
      return;
    }
    const t0 = Date.now();
    const out = e.query(query, { k: 10, sourceType: 'code-chunk' });
    const t1 = Date.now();
    setHits(out as QueryHit[]);
    setQueryMs(t1 - t0);
  }

  // Auto-run query on debounce after ingest completes. Every keystroke
  // resets the 250ms timer; only the latest fires.
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
      <Header phase={phase} ready={e.ready} error={e.error} />

      <Box style={{ flexGrow: 1, padding: 24, gap: 16 } as any}>
        <BuildPanel
          model={model}
          setModel={setModel}
          slug={slug}
          setSlug={setSlug}
          indexPath={indexPath}
          setIndexPath={setIndexPath}
          agents={agents}
          setAgents={setAgents}
          phase={phase}
          ready={e.ready}
          onBuild={handleBuild}
          onCancel={() => e.cancelIngest()}
        />

        {phase !== 'idle' ? (
          <IngestPanel ingest={ingest} startedAt={startedAt} phase={phase} />
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
          local Qwen3 + pgvector · multi-worker ingest in zig
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
  model, setModel, slug, setSlug, indexPath, setIndexPath, agents, setAgents,
  phase, ready, onBuild, onCancel,
}: {
  model: string;
  setModel: (s: string) => void;
  slug: string;
  setSlug: (s: string) => void;
  indexPath: string;
  setIndexPath: (s: string) => void;
  agents: string;
  setAgents: (s: string) => void;
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
        hint="Loaded into VRAM on mount + reused across all worker threads."
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
        hint="Directory walked recursively in zig. .ts/.tsx/.zig/.md/.jsonl/.lua/.py are embedded."
      />
      <Field
        label="Agents (worker threads)"
        value={agents}
        onChange={setAgents}
        hint="OS threads in the zig pool. Each gets its own llama context (KV cache); 1–16."
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
  ingest, startedAt, phase,
}: {
  ingest: ReturnType<typeof useEmbed>['ingest'];
  startedAt: number;
  phase: string;
}) {
  const pct = ingest.files_total > 0 ? ingest.files_done / ingest.files_total : 0;
  const elapsed = startedAt > 0 ? (Date.now() - startedAt) / 1000 : 0;
  const rate = elapsed > 0 ? ingest.chunks_done / elapsed : 0;
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
          {ingest.files_done}/{ingest.files_total} files · {ingest.chunks_done} chunks ·{' '}
          {rate.toFixed(1)} chunks/s · embed-sum {(ingest.embed_ms_sum / 1000).toFixed(1)}s
        </Text>
      </Row>
      <ProgressBar value={pct} />
      {ingest.current_file ? (
        <Text style={{ color: C.dim, fontSize: 11 } as any} numberOfLines={1}>
          {ingest.current_file}
        </Text>
      ) : null}
      {ingest.error ? (
        <Text style={{ color: C.err, fontSize: 12 } as any}>{ingest.error}</Text>
      ) : null}
      {ingest.cancelled ? (
        <Text style={{ color: C.warn, fontSize: 12 } as any}>cancelled</Text>
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
