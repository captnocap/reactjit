// Models route — unified registry across all providers and modalities.
//
// Fetch flow (see lib/fetch.ts):
//   1. fetchModelsFor(conn) → live list from provider
//   2. upsertRows(store, rows) → create new, refresh lastSeen on existing
//      while preserving user-edited favorite + displayName.
//
// The route never deletes a model row that disappeared from a provider's
// list (could be a temporary outage). Stale rows just stop getting their
// lastSeenIso bumped — the UI shows that age so the user can decide.
//
// Schema (option A — materialized):
//   id:           '<connectionId>:<remoteId>'
//   connectionId: string
//   remoteId:     string
//   displayName:  string                 // user-overridable
//   modality:     'text'|'embed'|'voice'|'image'|'tts'
//   contextLength?: number
//   favorite:     boolean
//   custom:       boolean
//   lastSeenIso:  string
//   source:       'remote-list'|'gguf-walk'|'manual'

import { useMemo, useState } from 'react';
import { Box, Pressable } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import { Icon } from '@reactjit/runtime/icons/Icon';
import {
  Eye, Brain, Wrench, Globe, Code, FileText,
  Star, RefreshCw, Pencil,
} from '@reactjit/runtime/icons/icons';
import { ProviderIcon } from '../../../component-gallery/components/model-card/ProviderIcon';
import { PROVIDER_ICONS } from '../../../component-gallery/components/model-card/providerIcons.generated';
import { Section, Field, Input, PillRow } from '../shared';
import { useSettingsCtx } from '../page';
import { fetchModelsFor, upsertRows, type Modality, type ModelRow } from '../lib/fetch';

type Capability = 'vision' | 'reasoning' | 'tools' | 'search' | 'code' | 'files';

const ALL_CAPS: Capability[] = ['vision', 'reasoning', 'tools', 'search', 'code', 'files'];

const CAP_CONFIG: Record<Capability, { icon: number[][]; color: string; label: string; hint: string }> = {
  vision:    { icon: Eye,      color: 'theme:tool',  label: 'Vision',    hint: 'Image input' },
  reasoning: { icon: Brain,    color: 'theme:lilac', label: 'Reasoning', hint: 'Extended thinking' },
  tools:     { icon: Wrench,   color: 'theme:warn',  label: 'Tools',     hint: 'Function calling' },
  search:    { icon: Globe,    color: 'theme:ok',    label: 'Search',    hint: 'Web access' },
  code:      { icon: Code,     color: 'theme:blue',  label: 'Code',      hint: 'Code generation' },
  files:     { icon: FileText, color: 'theme:atch',  label: 'Files',     hint: 'File analysis' },
};

// Heuristic — first capabilities for a fresh model row based on its remoteId.
// User can toggle anything afterwards.
function inferCaps(remoteId: string, modality: Modality): Capability[] {
  if (modality !== 'text') return [];
  const s = remoteId.toLowerCase();
  const caps = new Set<Capability>(['tools']);
  if (/(vision|vl|visual|4o|gpt-4|claude-3|claude-4|opus|sonnet|gemini|llava|pixtral)/.test(s)) caps.add('vision');
  if (/(o1|o3|o4|reasoner|thinking|reason|qwq|deepseek-r|grok-3)/.test(s)) caps.add('reasoning');
  if (/(claude|opus|sonnet|haiku|gpt-4|gpt-5|gemini|grok|deepseek-coder|coder)/.test(s)) caps.add('code');
  if (/(perplexity|sonar|search|web|browse)/.test(s)) caps.add('search');
  return Array.from(caps);
}

function capsOf(m: ModelRow): Capability[] {
  const v = (m as any).capabilities;
  if (Array.isArray(v)) return v.filter((c: any): c is Capability => ALL_CAPS.includes(c));
  return inferCaps(m.remoteId, m.modality);
}

const MODALITIES: Modality[] = ['text', 'embed', 'voice', 'image', 'tts'];
const MODALITY_LABEL: Record<Modality, string> = {
  text: 'Text', embed: 'Embedding', voice: 'Voice', image: 'Image', tts: 'TTS',
};

type FetchState = { status: 'idle' | 'busy' | 'ok' | 'fail'; message: string };
const IDLE: FetchState = { status: 'idle', message: '' };

function fmtAge(iso: string): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ─── Capability toggle button ────────────────────────────────────────

function CapabilityButton({ cap, active, onToggle }: {
  cap: Capability; active: boolean; onToggle: () => void;
}) {
  const cfg = CAP_CONFIG[cap];
  return (
    <Pressable onPress={onToggle} tooltip={`${cfg.label} — ${cfg.hint}${active ? ' (on)' : ' (off)'}`}>
      <Box style={{
        width: 26, height: 26,
        borderRadius: 6,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: active ? 'theme:bg2' : 'theme:bg1',
        borderWidth: 1,
        borderColor: active ? cfg.color : 'theme:rule',
        opacity: active ? 1 : 0.45,
      }}>
        <Icon icon={cfg.icon} size={13} color={active ? cfg.color : 'theme:inkDim'} strokeWidth={2} />
      </Box>
    </Pressable>
  );
}

// ─── Model card ──────────────────────────────────────────────────────

function fmtCtx(n?: number): string {
  if (!n) return '';
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m === Math.floor(m) ? `${m}M` : `${m.toFixed(1)}M`;
  }
  return `${Math.round(n / 1000)}k`;
}

// Cap a string to fit visually in the 212px text column inside the model
// card. Long .gguf paths or unbroken model ids would otherwise blow out the
// flex box (the text engine doesn't break inside a non-whitespace token).
function clip(s: string, max: number): string {
  if (!s) return '';
  if (s.length <= max) return s;
  // Mid-path ellipsis for paths so both ends stay legible.
  if (s.includes('/')) {
    const head = Math.max(6, Math.floor((max - 3) * 0.4));
    const tail = max - 3 - head;
    return `${s.slice(0, head)}…${s.slice(-tail)}`;
  }
  return `${s.slice(0, max - 1)}…`;
}

function ModelCard({ m, providerIconId, onToggleFav, onRename, onChangeModality, onToggleCap }: {
  m: ModelRow;
  providerIconId?: string;
  onToggleFav: () => void;
  onRename: (next: string) => void;
  onChangeModality: (next: Modality) => void;
  onToggleCap: (cap: Capability) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.displayName);
  const caps = capsOf(m);
  const subtext = m.contextLength ? `${fmtCtx(m.contextLength)} ctx · ${fmtAge(m.lastSeenIso)}` : fmtAge(m.lastSeenIso);

  return (
    <Box style={{
      width: 240, maxWidth: 240,
      flexShrink: 0, flexGrow: 0,
      flexDirection: 'column',
      paddingTop: 14, paddingBottom: 12, paddingLeft: 14, paddingRight: 14,
      gap: 8,
      borderRadius: 'theme:radiusLg',
      borderWidth: 1, borderColor: m.favorite ? 'theme:accent' : 'theme:rule',
      backgroundColor: 'theme:bg1',
      overflow: 'hidden',
    }}>
      {/* Header — provider icon + favorite */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {providerIconId && PROVIDER_ICONS[providerIconId] ? (
          <ProviderIcon providerId={providerIconId} size={32} />
        ) : (
          <Box style={{
            width: 32, height: 32, borderRadius: 8,
            backgroundColor: 'theme:bg2',
            borderWidth: 1, borderColor: 'theme:rule',
          }} />
        )}
        <Pressable onPress={onToggleFav} tooltip={m.favorite ? 'Unfavorite' : 'Favorite'}>
          <Box style={{
            width: 26, height: 26, borderRadius: 13,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'theme:bg2',
          }}>
            <Icon
              icon={Star}
              size={13}
              color={m.favorite ? 'theme:accent' : 'theme:inkDim'}
              strokeWidth={m.favorite ? 2.4 : 1.8}
            />
          </Box>
        </Pressable>
      </Box>

      {/* Name (click to rename) */}
      {editing ? (
        <Box style={{ flexDirection: 'column', gap: 6 }}>
          <Input value={draft} onChange={setDraft} placeholder={m.remoteId} />
          <Box style={{ flexDirection: 'row', gap: 6 }}>
            <S.Button onPress={() => { onRename(draft.trim() || m.remoteId); setEditing(false); }}>
              <S.ButtonLabel>Save</S.ButtonLabel>
            </S.Button>
            <S.ButtonOutline onPress={() => { setDraft(m.displayName); setEditing(false); }}>
              <S.ButtonOutlineLabel>Cancel</S.ButtonOutlineLabel>
            </S.ButtonOutline>
          </Box>
        </Box>
      ) : (
        <Pressable onPress={() => { setDraft(m.displayName); setEditing(true); }} tooltip={`${m.displayName} — click to rename`}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%' }}>
            <Box style={{ flexShrink: 1, minWidth: 0 }}>
              <S.Subheading noWrap>{clip(m.displayName, 22)}</S.Subheading>
            </Box>
            <Icon icon={Pencil} size={10} color="theme:inkDimmer" strokeWidth={2} />
          </Box>
        </Pressable>
      )}
      <S.Caption noWrap>{clip(m.remoteId, 30)}</S.Caption>
      <S.Caption noWrap>{subtext}</S.Caption>

      {/* Modality pills */}
      <PillRow<Modality>
        options={MODALITIES}
        labels={MODALITY_LABEL}
        value={m.modality}
        onChange={onChangeModality}
      />

      {/* Capability badges (text models only) */}
      {m.modality === 'text' && (
        <Box style={{
          flexDirection: 'row', gap: 6, marginTop: 4,
          paddingTop: 8,
          borderTopWidth: 1, borderTopColor: 'theme:rule',
        }}>
          {ALL_CAPS.map((c) => (
            <CapabilityButton
              key={c}
              cap={c}
              active={caps.includes(c)}
              onToggle={() => onToggleCap(c)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

// ─── Per-provider section ────────────────────────────────────────────

function ProviderModelsBlock({ conn, modelsForConn, onRefetch, fetching }: {
  conn: any;
  modelsForConn: ModelRow[];
  onRefetch: () => void;
  fetching: FetchState;
}) {
  const grouped = useMemo(() => {
    const g: Partial<Record<Modality, ModelRow[]>> = {};
    for (const m of modelsForConn) (g[m.modality] ||= []).push(m);
    for (const k of Object.keys(g) as Modality[]) {
      g[k]!.sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.displayName.localeCompare(b.displayName));
    }
    return g;
  }, [modelsForConn]);

  const { modelStore, reload } = useSettingsCtx();

  const updateRow = async (m: ModelRow, patch: Partial<ModelRow>) => {
    await modelStore.update(m.id, { ...m, ...patch });
    reload();
  };

  const toggleCap = async (m: ModelRow, cap: Capability) => {
    const cur = capsOf(m);
    const next = cur.includes(cap) ? cur.filter((c) => c !== cap) : [...cur, cap];
    await updateRow(m, { capabilities: next } as any);
  };

  return (
    <S.Card>
      <Box style={{ flexDirection: 'column', gap: 16 }}>
        {/* Provider header */}
        <Box style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          {conn.iconId && PROVIDER_ICONS[conn.iconId] ? (
            <ProviderIcon providerId={conn.iconId} size={40} />
          ) : null}
          <Box style={{ flexGrow: 1, flexDirection: 'column', gap: 2 }}>
            <S.Heading>{conn.label || conn.id}</S.Heading>
            <S.BodyDim>{modelsForConn.length} model{modelsForConn.length === 1 ? '' : 's'}</S.BodyDim>
          </Box>
          <Pressable onPress={fetching.status === 'busy' ? () => {} : onRefetch}>
            <Box style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingLeft: 14, paddingRight: 16, paddingTop: 9, paddingBottom: 9,
              borderRadius: 'theme:radiusMd',
              borderWidth: 1, borderColor: 'theme:rule',
              backgroundColor: 'theme:bg2',
            }}>
              <Icon icon={RefreshCw} size={13} color="theme:ink" strokeWidth={2} />
              <S.ButtonOutlineLabel>{fetching.status === 'busy' ? 'Fetching…' : 'Refetch'}</S.ButtonOutlineLabel>
            </Box>
          </Pressable>
        </Box>

        {fetching.status === 'fail' && (
          <S.AppProbeResult>
            <S.AppProbeFail>Fetch failed</S.AppProbeFail>
            <S.AppProbeMessage>{fetching.message}</S.AppProbeMessage>
          </S.AppProbeResult>
        )}
        {fetching.status === 'ok' && (
          <S.AppProbeResult>
            <S.AppProbeOk>{fetching.message}</S.AppProbeOk>
          </S.AppProbeResult>
        )}

        {modelsForConn.length === 0 && fetching.status !== 'busy' && (
          <S.BodyDim>No models yet — click Refetch to pull the live list.</S.BodyDim>
        )}

        {MODALITIES.map((mod) => {
          const rows = grouped[mod] || [];
          if (rows.length === 0) return null;
          return (
            <Box key={mod} style={{ flexDirection: 'column', gap: 10 }}>
              <S.Label>{MODALITY_LABEL[mod].toUpperCase()}</S.Label>
              <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {rows.map((m) => (
                  <ModelCard
                    key={m.id}
                    m={m}
                    providerIconId={conn.iconId}
                    onToggleFav={() => updateRow(m, { favorite: !m.favorite })}
                    onRename={(next) => updateRow(m, { displayName: next })}
                    onChangeModality={(next) => updateRow(m, { modality: next })}
                    onToggleCap={(cap) => toggleCap(m, cap)}
                  />
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
    </S.Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

export default function ModelsRoute() {
  const { connections, models, modelStore, reload } = useSettingsCtx();
  const [fetching, setFetching] = useState<Record<string, FetchState>>({});
  const [allBusy, setAllBusy] = useState(false);

  const byConn = useMemo(() => {
    const g: Record<string, ModelRow[]> = {};
    for (const m of models) (g[m.connectionId] ||= []).push(m as ModelRow);
    return g;
  }, [models]);

  const refetchOne = async (conn: any) => {
    setFetching((f) => ({ ...f, [conn.id]: { status: 'busy', message: '' } }));
    const r = await fetchModelsFor(conn);
    if (!r.ok) {
      setFetching((f) => ({ ...f, [conn.id]: { status: 'fail', message: r.message } }));
      return;
    }
    const u = await upsertRows(modelStore, r.rows);
    setFetching((f) => ({ ...f, [conn.id]: {
      status: 'ok',
      message: `${r.message}  ·  +${u.added} new, ${u.refreshed} refreshed`,
    } }));
    reload();
  };

  const refetchAll = async () => {
    setAllBusy(true);
    for (const c of connections) await refetchOne(c);
    setAllBusy(false);
  };

  return (
    <Section caption="Registry" title="Models">
      <Box style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        gap: 24, marginTop: -4,
      }}>
        <S.BodyDim style={{ flexShrink: 1 }}>
          {models.length} model{models.length === 1 ? '' : 's'} across {connections.length} provider{connections.length === 1 ? '' : 's'}.
          Star to favorite, click a name to rename, toggle capability badges per model.
        </S.BodyDim>
        {connections.length > 0 && (
          <Pressable onPress={allBusy ? () => {} : refetchAll}>
            <Box style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingLeft: 16, paddingRight: 18, paddingTop: 10, paddingBottom: 10,
              borderRadius: 'theme:radiusMd',
              backgroundColor: 'theme:accent',
              flexShrink: 0,
            }}>
              <Icon icon={RefreshCw} size={14} color="theme:bg" strokeWidth={2.4} />
              <S.ButtonLabel>{allBusy ? 'Fetching all…' : 'Refetch all'}</S.ButtonLabel>
            </Box>
          </Pressable>
        )}
      </Box>

      {connections.length === 0 && (
        <S.Card style={{ paddingTop: 56, paddingBottom: 56 }}>
          <Box style={{ alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <S.Heading>No providers yet</S.Heading>
            <S.BodyDim>Add one in Providers, then come back.</S.BodyDim>
          </Box>
        </S.Card>
      )}

      {connections.map((c: any) => (
        <ProviderModelsBlock
          key={c.id}
          conn={c}
          modelsForConn={byConn[c.id] || []}
          onRefetch={() => refetchOne(c)}
          fetching={fetching[c.id] || IDLE}
        />
      ))}
    </Section>
  );
}
