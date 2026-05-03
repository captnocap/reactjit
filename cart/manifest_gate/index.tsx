// manifest_gate — Round-2 of the line-manifest benchmark.
//
// Loads target.py + manifest.md from experiments/manifest_check/, parses
// each "| line | claim |" row from the manifest, and asks the local model
// (loaded into VRAM through framework/local_ai_runtime.zig) to verdict
// each claim TRUE or FALSE against the file's actual line content.
// Verdicts stream into the UI; the preamble is written to disk for use as
// a prefix to a Claude prompt.
//
// All theme-touching styling lives in cart/component-gallery/components.cls.ts
// — the cart only picks classifiers (active/inactive) and supplies inline
// `style={{...}}` for animation values (opacity / translateY) per the
// app.md "Animation principles" section. List-mount uses the spring shape
// for newly-entering rows; the in-flight verdict row gets the continuous
// border-flow trace (the GenericCardShell pattern from list_lab "border"
// scene) via the ManifestGateVerdictRowActive classifier.

// Side-effect import: registers every ManifestGate* + App* classifier on
// the global registry that `classifiers as S` reads from. Without this
// the JSX `<S.ManifestGate*>` references resolve to undefined and React
// throws "Element type is invalid".
import '../app/gallery/components.cls';

import { useEffect, useState } from 'react';
import {
  Box,
  Row,
  Col,
  Text,
  Pressable,
  ScrollView,
} from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import { useLocalChat } from '@reactjit/runtime/hooks/useLocalChat';
import * as fs from '@reactjit/runtime/hooks/fs';
import { useAnimationTimeline } from '../app/anim.js';

// Triggers has-embed at ship-time so libllama_ffi.so gets bundled. The
// metafile-gate gates on import presence; useLocalChat is also a trigger
// (sdk/dependency-registry.json) but the explicit useEmbed import keeps
// the gate stable even if the registry entry is touched.
import '@reactjit/runtime/hooks/useEmbed';

const MODEL =
  '/home/siah/.lmstudio/models/HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive/' +
  'Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-Q8_0.gguf';

const ROOT = '/home/siah/creative/reactjit/experiments/manifest_check';
const TARGET_PATH = `${ROOT}/target.py`;
const MANIFEST_PATH = `${ROOT}/manifest.md`;
const RESULTS_PATH = `${ROOT}/results/round2_preamble.txt`;

const SYSTEM_PROMPT =
  'You are a strict line-checker. The user gives you a source file with ' +
  'line numbers and a claim about ONE specific line. Reply with exactly ' +
  'one word: TRUE or FALSE. No punctuation, no explanation.';

type Verdict = 'TRUE' | 'FALSE' | 'UNCLEAR' | 'PENDING' | 'IDLE';

interface Claim {
  line: number;
  claim: string;
}

interface Row_ {
  line: number;
  claim: string;
  verdict: Verdict;
  raw?: string;
}

type Phase = 'init' | 'loading' | 'loaded' | 'generating' | 'idle' | 'failed';

const CLAIM_RE = /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*$/;

function parseManifest(text: string): Claim[] {
  const out: Claim[] = [];
  for (const line of text.split('\n')) {
    const m = CLAIM_RE.exec(line);
    if (!m) continue;
    out.push({ line: parseInt(m[1], 10), claim: m[2] });
  }
  return out;
}

function numberedSource(text: string): string {
  return text
    .split('\n')
    .map((ln, i) => `${String(i + 1).padStart(4)}: ${ln}`)
    .join('\n');
}

function formatPrompt(numbered: string, line: number, claim: string): string {
  return (
    `FILE (line-numbered):\n\`\`\`\n${numbered}\n\`\`\`\n\n` +
    `CLAIM: line ${line} of the file matches this description:\n` +
    `  "${claim}"\n\n` +
    `Look at line ${line} EXACTLY (not nearby lines). Does the actual ` +
    `content of that exact line match the claim?\n` +
    `Answer with one word: TRUE or FALSE.`
  );
}

function parseVerdict(raw: string): Verdict {
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const words = cleaned.replace(/[^A-Z]+/g, ' ').trim().split(/\s+/);
  if (words.includes('TRUE')) return 'TRUE';
  if (words.includes('FALSE')) return 'FALSE';
  return 'UNCLEAR';
}

// Phase → status-dot classifier. JSX picks; no inline color logic.
function dotForPhase(phase: Phase, error: string | null): any {
  if (error || phase === 'failed') return S.ManifestGateStatusDotFailed;
  if (phase === 'loaded' || phase === 'idle') return S.ManifestGateStatusDotLoaded;
  if (phase === 'generating') return S.ManifestGateStatusDotGenerating;
  if (phase === 'loading') return S.ManifestGateStatusDotLoading;
  return S.ManifestGateStatusDotIdle;
}

function phaseText(phase: Phase, error: string | null, running: boolean): string {
  if (phase === 'failed') return `model load failed${error ? ': ' + error : ''}`;
  if (error) return `error: ${error}`;
  if (phase === 'init') return 'host bindings loading…';
  if (phase === 'loading') return 'loading model into VRAM…';
  if (phase === 'loaded') return running ? 'running gate…' : 'model ready · click Run';
  if (phase === 'generating') return 'generating…';
  if (phase === 'idle') return running ? 'running gate…' : 'idle';
  return String(phase);
}

// Verdict → badge classifier (one per state, JSX picks).
function badgeForVerdict(v: Verdict): any {
  if (v === 'TRUE') return S.ManifestGateBadgeTrue;
  if (v === 'FALSE') return S.ManifestGateBadgeFalse;
  if (v === 'PENDING') return S.ManifestGateBadgePending;
  if (v === 'UNCLEAR') return S.ManifestGateBadgeUnclear;
  return S.ManifestGateBadgeIdle;
}

// Verdict count → which count classifier to render.
function countClassifier(kind: 'true' | 'false' | 'unclear'): any {
  if (kind === 'true') return S.ManifestGateCountTrue;
  if (kind === 'false') return S.ManifestGateCountFalse;
  return S.ManifestGateCountUnclear;
}

// ── component ────────────────────────────────────────────────────────

export default function ManifestGate() {
  const { phase, error, lastStatus, pulse, streaming, ready, ask } = useLocalChat({
    model: MODEL,
    nCtx: 4096,
  });

  const [target, setTarget] = useState('');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [rows, setRows] = useState<Row_[]>([]);
  const [running, setRunning] = useState(false);
  const [tStart, setTStart] = useState(0);
  const [tElapsed, setTElapsed] = useState(0);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [rowsMountKey, setRowsMountKey] = useState(0);

  // List-mount timeline. Re-arms each time the row set is re-baselined
  // (file load + run() restart) so the spring fires from t=0 on those
  // events. The hook itself runs one master RAF clock per component;
  // `range()` queries return clamped + eased 0→1 within [a, b].
  const tl = useAnimationTimeline({ skip: false });

  useEffect(() => {
    const t = fs.readFile(TARGET_PATH);
    const m = fs.readFile(MANIFEST_PATH);
    if (t === null || m === null) return;
    setTarget(t);
    const cs = parseManifest(m);
    setClaims(cs);
    setRows(cs.map((c) => ({ line: c.line, claim: c.claim, verdict: 'IDLE' })));
    setRowsMountKey((k) => k + 1);
  }, []);

  async function run() {
    if (!ready || running || claims.length === 0 || target.length === 0) return;
    setRunning(true);
    setTStart(Date.now());
    setTElapsed(0);
    const numbered = numberedSource(target);
    setRows(claims.map((c) => ({ line: c.line, claim: c.claim, verdict: 'PENDING' })));
    setRowsMountKey((k) => k + 1);

    const verdicts: Row_[] = [];
    for (let i = 0; i < claims.length; i++) {
      const c = claims[i];
      setActiveIdx(i);
      const prompt = formatPrompt(numbered, c.line, c.claim);
      let v: Verdict = 'UNCLEAR';
      let raw = '';
      try {
        raw = await ask(prompt);
        v = parseVerdict(raw);
      } catch (e: any) {
        raw = `error: ${e?.message || e}`;
        v = 'UNCLEAR';
      }
      verdicts.push({ line: c.line, claim: c.claim, verdict: v, raw });
      setRows((prev) => {
        const next = prev.slice();
        next[i] = { line: c.line, claim: c.claim, verdict: v, raw };
        return next;
      });
      setTElapsed(Date.now() - tStart);
    }

    const preamble = buildPreamble(verdicts);
    fs.writeFile?.(RESULTS_PATH, preamble);
    setActiveIdx(-1);
    setRunning(false);
    setTElapsed(Date.now() - tStart);
  }

  const counts = countVerdicts(rows);

  return (
    <S.ManifestGateRoot>
      <Header
        phase={phase}
        error={error}
        lastStatus={lastStatus}
        pulse={pulse}
        running={running}
      />
      <S.ManifestGateBody>
        <ConfigPanel
          claims={claims.length}
          target={target}
          counts={counts}
          tElapsed={tElapsed}
          ready={ready}
          running={running}
          onRun={run}
        />
        <StreamPanel
          phase={phase}
          activeIdx={activeIdx}
          claims={claims}
          streaming={streaming}
          pulse={pulse}
        />
        <ResultsPanel
          rows={rows}
          activeIdx={activeIdx}
          tl={tl}
          mountKey={rowsMountKey}
        />
      </S.ManifestGateBody>
    </S.ManifestGateRoot>
  );
}

// ── header ───────────────────────────────────────────────────────────

function Header({
  phase, error, lastStatus, pulse, running,
}: {
  phase: Phase;
  error: string | null;
  lastStatus: string;
  pulse: number;
  running: boolean;
}) {
  // Pulse the dot via inline style override — the classifier owns the
  // color (one per phase); the cart owns the per-render size oscillation
  // so the heartbeat remains visible during long silent prefill stretches.
  const Dot = dotForPhase(phase, error);
  const beatBig = (pulse % 2) === 0;
  const dotSize = beatBig ? 12 : 8;
  return (
    <S.ManifestGateChrome>
      <Col>
        <S.ManifestGateChromeTitle>Manifest Gate</S.ManifestGateChromeTitle>
        <S.ManifestGateChromeSubtitle>
          Round-2 line-checker · framework/local_ai_runtime.zig (Vulkan)
        </S.ManifestGateChromeSubtitle>
      </Col>
      <S.ManifestGateChromeStatusRow>
        <Dot style={{ width: dotSize, height: dotSize } as any} />
        <S.ManifestGateChromeStatusCol>
          <S.ManifestGatePhaseLabel>
            {phaseText(phase, error, running)}
          </S.ManifestGatePhaseLabel>
          <S.ManifestGatePhaseMeta>
            phase={phase} · pulse={pulse}
            {lastStatus ? ` · ${lastStatus.slice(0, 60)}` : ''}
          </S.ManifestGatePhaseMeta>
        </S.ManifestGateChromeStatusCol>
      </S.ManifestGateChromeStatusRow>
    </S.ManifestGateChrome>
  );
}

// ── config panel (inputs + run button) ───────────────────────────────

function ConfigPanel({
  claims, target, counts, tElapsed, ready, running, onRun,
}: {
  claims: number;
  target: string;
  counts: { t: number; f: number; u: number; pending: number };
  tElapsed: number;
  ready: boolean;
  running: boolean;
  onRun: () => void;
}) {
  const sec = (tElapsed / 1000).toFixed(1);
  const tgtLines = target ? target.split('\n').length : 0;
  const enabled = ready && !running;
  const Btn = enabled ? S.ManifestGateRunBtn : S.ManifestGateRunBtnDisabled;
  const BtnLabel = enabled ? S.ManifestGateRunBtnLabel : S.ManifestGateRunBtnLabelDisabled;
  const TrueCount = countClassifier('true');
  const FalseCount = countClassifier('false');
  const UnclearCount = countClassifier('unclear');
  return (
    <S.ManifestGatePanel>
      <S.ManifestGatePanelHeader>
        <Col style={{ gap: 2 } as any}>
          <S.ManifestGatePanelTitle>Inputs</S.ManifestGatePanelTitle>
          <S.ManifestGatePanelHint>
            target.py: {tgtLines} lines · manifest.md: {claims} claims
          </S.ManifestGatePanelHint>
        </Col>
        <Col style={{ gap: 2, alignItems: 'flex-end' } as any}>
          <S.ManifestGatePanelTitle>Verdicts</S.ManifestGatePanelTitle>
          <Row style={{ gap: 8 } as any}>
            <TrueCount>{counts.t} TRUE</TrueCount>
            <FalseCount>{counts.f} FALSE</FalseCount>
            <UnclearCount>{counts.u} unclear</UnclearCount>
            <S.ManifestGateCountElapsed>· {sec}s</S.ManifestGateCountElapsed>
          </Row>
        </Col>
      </S.ManifestGatePanelHeader>
      <Row style={{ gap: 8 } as any}>
        <Btn onPress={() => { if (enabled) onRun(); }}>
          <BtnLabel>{running ? 'Running…' : 'Run gate'}</BtnLabel>
        </Btn>
      </Row>
    </S.ManifestGatePanel>
  );
}

// ── stream panel ─────────────────────────────────────────────────────

function StreamPanel({
  phase, activeIdx, claims, streaming, pulse,
}: {
  phase: Phase;
  activeIdx: number;
  claims: Claim[];
  streaming: string;
  pulse: number;
}) {
  // Pulse-driven heartbeat sparkline. Cell on/off comes from the pulse
  // counter so the loop is visible even when the model emits no tokens.
  const cellOnFlags = [0, 1, 2, 3].map((i) => ((pulse + i) % 4) === 0);
  const active = activeIdx >= 0 && activeIdx < claims.length ? claims[activeIdx] : null;
  const subtitle =
    phase === 'loading'
      ? 'weights → VRAM (no tokens until first system event)'
      : phase === 'generating' && active
      ? `claim ${activeIdx + 1}/${claims.length} · L${active.line}`
      : phase === 'idle' || phase === 'loaded'
      ? 'waiting for next request'
      : 'initializing';
  return (
    <S.ManifestGatePanel>
      <S.ManifestGatePanelHeader>
        <Col style={{ gap: 2 } as any}>
          <S.ManifestGatePanelTitle>Stream</S.ManifestGatePanelTitle>
          <S.ManifestGateStreamSubtitle>{subtitle}</S.ManifestGateStreamSubtitle>
        </Col>
        <S.ManifestGateStreamCells>
          {cellOnFlags.map((on, i) => {
            const Cell = on ? S.ManifestGateStreamCellOn : S.ManifestGateStreamCellOff;
            return <Cell key={i} />;
          })}
        </S.ManifestGateStreamCells>
      </S.ManifestGatePanelHeader>
      {active ? (
        <S.ManifestGateStreamClaim numberOfLines={1}>
          {active.claim}
        </S.ManifestGateStreamClaim>
      ) : null}
      <S.ManifestGateStreamBox>
        {streaming ? (
          <S.ManifestGateStreamText numberOfLines={2}>
            {streaming}
          </S.ManifestGateStreamText>
        ) : (
          <S.ManifestGateStreamPlaceholder>
            {phase === 'loading' ? '· · ·' : ''}
          </S.ManifestGateStreamPlaceholder>
        )}
      </S.ManifestGateStreamBox>
    </S.ManifestGatePanel>
  );
}

// ── results (verdict list) ───────────────────────────────────────────

function ResultsPanel({
  rows, activeIdx, tl, mountKey,
}: {
  rows: Row_[];
  activeIdx: number;
  tl: ReturnType<typeof useAnimationTimeline>;
  mountKey: number;
}) {
  return (
    <S.ManifestGatePanelGrow>
      <S.ManifestGatePanelTitle>Per-claim verdicts</S.ManifestGatePanelTitle>
      <ScrollView style={{ flexGrow: 1, minHeight: 0 } as any}>
        <Col style={{ gap: 4 } as any}>
          {rows.length === 0 ? (
            <S.ManifestGateEmpty>no manifest loaded</S.ManifestGateEmpty>
          ) : (
            rows.map((r, i) => (
              <VerdictRow
                key={`${mountKey}:${r.line}`}
                row={r}
                active={i === activeIdx}
                index={i}
                tl={tl}
              />
            ))
          )}
        </Col>
      </ScrollView>
    </S.ManifestGatePanelGrow>
  );
}

function VerdictRow({
  row, active, index, tl,
}: {
  row: Row_;
  active: boolean;
  index: number;
  tl: ReturnType<typeof useAnimationTimeline>;
}) {
  // List-building principle (app.md "List building"):
  //   - Newly-entering items SPRING in (easeOutBack overshoot on translateY,
  //     plain ease on opacity) staggered 60ms by index.
  //   - Per-item entry duration ~380ms.
  // The classifier owns layout + colors; the cart owns the spring values
  // it injects via inline style (the only place per-render numbers should
  // appear in cart code).
  const startMs = index * 60;
  const endMs = startMs + 380;
  const opacity = tl.range(startMs, endMs, 'easeOutCubic');
  const yEase = tl.range(startMs, endMs, 'easeOutBack');
  const translateY = (1 - yEase) * 12;

  const Frame = active ? S.ManifestGateVerdictRowActive : S.ManifestGateVerdictRow;
  const Badge = badgeForVerdict(row.verdict);
  return (
    <Frame style={{ opacity, marginTop: translateY } as any}>
      <S.ManifestGateBadgeSlot>
        <Badge>{row.verdict}</Badge>
      </S.ManifestGateBadgeSlot>
      <S.ManifestGateLineSlot>
        <S.ManifestGateLineLabel>L{row.line}</S.ManifestGateLineLabel>
      </S.ManifestGateLineSlot>
      <S.ManifestGateClaimSlot>
        <S.ManifestGateClaimText numberOfLines={1}>
          {row.claim}
        </S.ManifestGateClaimText>
      </S.ManifestGateClaimSlot>
    </Frame>
  );
}

// ── helpers ──────────────────────────────────────────────────────────

function countVerdicts(rows: Row_[]): { t: number; f: number; u: number; pending: number } {
  let t = 0, f = 0, u = 0, pending = 0;
  for (const r of rows) {
    if (r.verdict === 'TRUE') t++;
    else if (r.verdict === 'FALSE') f++;
    else if (r.verdict === 'UNCLEAR') u++;
    else if (r.verdict === 'PENDING') pending++;
  }
  return { t, f, u, pending };
}

function buildPreamble(verdicts: Row_[]): string {
  const t = verdicts.filter((v) => v.verdict === 'TRUE').length;
  const f = verdicts.filter((v) => v.verdict === 'FALSE').length;
  const u = verdicts.filter((v) => v.verdict === 'UNCLEAR').length;
  const lines: string[] = [];
  lines.push('=== GEMMA LINE-NUMBER GATE PREAMBLE ===');
  lines.push(`verdicts: ${t} TRUE, ${f} FALSE, ${u} unclear (total ${verdicts.length})`);
  lines.push('');
  lines.push('per-claim verdict (line N of target.py vs manifest claim):');
  for (const v of verdicts) {
    lines.push(`  [${v.verdict}] line ${v.line}: ${v.claim}`);
  }
  lines.push('=== END PREAMBLE ===');
  return lines.join('\n') + '\n';
}

// SYSTEM_PROMPT is currently dropped on the floor — the Zig-side
// __localai_init signature only takes (cwd, model, sessionId, n_ctx),
// and SubmitOptions.system_prompt isn't plumbed through __localai_send.
// Every per-claim user prompt embeds the same TRUE/FALSE instruction so
// the system prompt being absent is benign here. Kept as a const so a
// future binding extension has a single place to lift it from.
void SYSTEM_PROMPT;
