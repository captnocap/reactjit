// cart/app/settings/page.jsx — full-fat settings surface, /settings route.
//
// Three visible panels (left → right):
//
//   [ shell side dock 360 ] [ settings nav 220 ] [ content (scrolling) ]
//
// The shell morph (state A → B) is owned by index.tsx; this file owns
// the inner two panels. Every editable surface mutates the gallery
// data graph via useCRUD; nothing here is hard-coded display except the
// section dispatch.
//
// Section coverage:
//   Profile      — User identity (displayName/email/bio/configPath/timezone)
//   Preferences  — Accommodations (toggles against onboarding/traits.js)
//   Providers    — Connection rows: kind picker (incl. openai-api-like),
//                  validation (no dup, key required for api kinds), live
//                  /v1/models probe for api kinds, model + context length
//                  + effort per connection
//   Defaults     — Settings.defaultConnectionId / defaultModelId, plus
//                  per-default effort + max-output-token override
//   Voice        — Whisper model downloads + the ensemble normalization
//                  layer that maps to useEnsembleTranscript's knobs
//   Embedding    — In-house llama_ffi or endpoint embedder; download UX
//                  for local .gguf files
//   Database     — Real probes (sqlite.open / pg.connect) per engine;
//                  pref-write only switches the "active" pref, the probe
//                  is the source of truth for whether the engine works
//   Privacy      — Editable proxy / tools allowlist / filesystem paths
//   Onboarding   — Read-only state plus Reset onboarding + Reset tour
//
// Components used (no hand-rolled atoms):
//   S.Card / S.Caption / S.Title / S.Body                — section shells
//   S.Button / S.ButtonLabel                              — primary action
//   S.ButtonOutline / S.ButtonOutlineLabel                — secondary action
//   S.AppFormShell / S.AppFormFieldCol / S.AppFormButtonRow / S.AppFormLabel
//   S.AppFormInput / S.AppFormInputMono                   — TextInputs
//   S.AppModelListBox / S.AppModelChoice(Active) / S.AppModelChoiceText(Active)
//   S.AppProbeResult / S.AppProbeOk / S.AppProbeFail / S.AppProbeMessage
//   S.AppTraitChip(Active) / S.AppTraitChipText(Active)   — toggle pills
//   S.NavPill / S.NavPillActive                           — section nav
//   S.KV / S.SectionLabel / S.InputWell / S.Chip
//
// Made-up fields removed by request:
//   - User.preferences.{responseDefault,elaborateOnAsk,emojiOk}
//   - Settings.defaultPresetId
//   - Privacy.telemetry.{outboundLogging,secretRedaction,providerTelemetryOptOut,localOnly}
//
// All write paths are async and reload via reloadKey to re-pull the row.

import { Box, Pressable, ScrollView } from '@reactjit/runtime/primitives';
import { classifiers as S } from '@reactjit/core';
import { useCRUD } from '@reactjit/runtime/hooks';
import { execAsync } from '@reactjit/runtime/hooks/process';
import * as sqlite from '@reactjit/runtime/hooks/sqlite';
import * as pg from '@reactjit/runtime/hooks/pg';
import * as embed from '@reactjit/runtime/hooks/embed';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useOnboarding } from '../onboarding/state';
import { useHudInsets } from '../shell';
import { TRAITS } from '../onboarding/traits';

const NS = 'app';
const USER_ID = 'user_local';
const SETTINGS_ID = 'settings_default';
const PRIVACY_ID = 'privacy_default';
const passthrough = { parse: (v) => v };

const NAV_ITEMS = [
  { id: 'profile',     label: 'Profile' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'providers',   label: 'Providers' },
  { id: 'defaults',    label: 'Defaults' },
  { id: 'voice',       label: 'Voice' },
  { id: 'embedding',   label: 'Embedding' },
  { id: 'database',    label: 'Database' },
  { id: 'privacy',     label: 'Privacy' },
  { id: 'onboarding',  label: 'Onboarding' },
];

// `openai-api-like` covers any HTTP server that speaks the OpenAI
// Chat Completions schema (vLLM / Ollama / LM-Studio / together /
// groq / openrouter / etc) — it's the request shape, not the vendor.
const CONNECTION_KINDS = [
  'claude-code-cli',
  'anthropic-api-key',
  'openai-api-key',
  'openai-api-like',
  'kimi-api-key',
  'local-runtime',
];

const CREDENTIAL_SOURCES = ['env', 'keychain', 'cli-session', 'file', 'none'];
const EFFORT_OPTIONS = ['minimal', 'low', 'medium', 'high'];

// Tool surface known to the framework. Privacy.tools allowed/denied lists
// pick from this — typing free-form names is a sharp edge we don't want.
const KNOWN_TOOLS = [
  'Read', 'Write', 'Edit', 'NotebookEdit',
  'Grep', 'Glob',
  'Bash', 'BashOutput', 'KillShell',
  'WebFetch', 'WebSearch',
  'TodoWrite',
  'Task',
];

const WHISPER_MODELS = [
  { id: 'tiny',   file: 'ggml-tiny.en-q5_1.bin',   approxMB: 31,  blurb: 'Fastest, lowest accuracy. Good for VAD-driven tap-to-transcribe.' },
  { id: 'base',   file: 'ggml-base.en-q5_1.bin',   approxMB: 57,  blurb: 'Default. Solid accuracy, low latency on CPU.' },
  { id: 'small',  file: 'ggml-small.en-q5_1.bin',  approxMB: 190, blurb: 'Higher accuracy. Noticeably slower on CPU.' },
  { id: 'medium', file: 'ggml-medium.en-q5_0.bin', approxMB: 540, blurb: 'Best accuracy. Slow without GPU. Q5_0 (Q5_1 isn\'t published).' },
];

const FETCH_SCRIPT = './scripts/fetch-whisper-models';

// Embedding model dir is user-configurable; this is just the default
// when nothing is set on User.preferences.embed.dir.
const DEFAULT_EMBED_DIR = '~/.reactjit/models/embed';

const DB_ENGINES = [
  { id: 'sqlite', label: 'SQLite',     defaultLocator: '~/.reactjit/app.sqlite', locatorLabel: 'File path' },
  { id: 'duckdb', label: 'DuckDB',     defaultLocator: '~/.reactjit/app.duckdb', locatorLabel: 'File path' },
  { id: 'pg',     label: 'PostgreSQL', defaultLocator: 'embedded',                locatorLabel: 'URI' },
];

// ─── Page ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const onb = useOnboarding();
  const insets = useHudInsets();
  const userStore       = useCRUD('user',       passthrough, { namespace: NS });
  const settingsStore   = useCRUD('settings',   passthrough, { namespace: NS });
  const privacyStore    = useCRUD('privacy',    passthrough, { namespace: NS });
  const connectionStore = useCRUD('connection', passthrough, { namespace: NS });

  const [active, setActive] = useState('profile');
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [privacy, setPrivacy] = useState(null);
  const [connections, setConnections] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await userStore.get(USER_ID).catch(() => null);
      const s = await settingsStore.get(SETTINGS_ID).catch(() => null);
      const p = await privacyStore.get(PRIVACY_ID).catch(() => null);
      const all = await connectionStore.list().catch(() => []);
      const conns = (all || []).filter((c) => c?.settingsId === SETTINGS_ID);
      if (cancelled) return;
      setUser(u || null);
      setSettings(s || null);
      setPrivacy(p || null);
      setConnections(conns);
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const ctx = {
    user, settings, privacy, connections, onb,
    userStore, settingsStore, privacyStore, connectionStore,
    reload,
  };

  return (
    <S.Page>
      <Box style={{ flexDirection: 'row', flexGrow: 1, height: '100%' }}>
        <SettingsNav active={active} onSelect={setActive} />
        <Box style={{
          flexGrow: 1, flexDirection: 'column',
          backgroundColor: 'theme:bg1',
          height: '100%', minWidth: 0,
        }}>
          <ScrollView showScrollbar style={{ width: '100%', height: '100%' }}>
            <Box style={{
              flexDirection: 'column',
              paddingTop: 32, paddingBottom: 64 + insets.bottom,
              paddingLeft: 32, paddingRight: 32,
            }}>
              <Box style={{ width: 760, maxWidth: '100%', flexDirection: 'column', gap: 16 }}>
                {active === 'profile'     && <ProfileSection {...ctx} />}
                {active === 'preferences' && <PreferencesSection {...ctx} />}
                {active === 'providers'   && <ProvidersSection {...ctx} />}
                {active === 'defaults'    && <DefaultsSection {...ctx} />}
                {active === 'voice'       && <VoiceSection {...ctx} />}
                {active === 'embedding'   && <EmbeddingSection {...ctx} />}
                {active === 'database'    && <DatabaseSection {...ctx} />}
                {active === 'privacy'     && <PrivacySection {...ctx} />}
                {active === 'onboarding'  && <OnboardingSection {...ctx} />}
              </Box>
            </Box>
          </ScrollView>
        </Box>
      </Box>
    </S.Page>
  );
}

function SettingsNav({ active, onSelect }) {
  return (
    <Box style={{
      width: 220, flexShrink: 0, height: '100%',
      flexDirection: 'column',
      borderRightWidth: 1, borderRightColor: 'theme:rule',
      backgroundColor: 'theme:bg',
    }}>
      <ScrollView showScrollbar style={{ width: '100%', height: '100%' }}>
        <Box style={{ flexDirection: 'column', paddingTop: 24, paddingBottom: 16, paddingLeft: 12, paddingRight: 12, gap: 4 }}>
          <Box style={{ paddingLeft: 8, paddingRight: 8, paddingBottom: 16 }}>
            <S.Caption>App</S.Caption>
            <S.Title>Settings</S.Title>
          </Box>
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === active;
            const Pill = isActive ? S.NavPillActive : S.NavPill;
            return (
              <Pill key={item.id} onPress={() => onSelect(item.id)}>
                <S.Body>{item.label}</S.Body>
              </Pill>
            );
          })}
        </Box>
      </ScrollView>
    </Box>
  );
}

// ─── Profile ──────────────────────────────────────────────────────

function ProfileSection({ user, userStore, reload, onb }) {
  const [draft, setDraft] = useState({
    displayName: '',
    email: '',
    bio: '',
    configPath: '',
    timezone: '',
  });
  const [saving, setSaving] = useState(false);

  // Hydrate draft when user row loads or changes id.
  useEffect(() => {
    setDraft({
      displayName: pickStrRaw(user?.displayName, onb.name),
      email: pickStrRaw(user?.email),
      bio: pickStrRaw(user?.bio),
      configPath: pickStrRaw(user?.configPath, onb.configPath),
      timezone: pickStrRaw(user?.preferences?.timezone),
    });
  }, [user?.id, user?.displayName, user?.email, user?.bio, user?.configPath, user?.preferences?.timezone]);

  const save = async () => {
    setSaving(true);
    const cur = user || { id: USER_ID, preferences: {} };
    const prefs = cur.preferences || {};
    const next = {
      ...cur,
      displayName: draft.displayName.trim() || undefined,
      email: draft.email.trim() || undefined,
      bio: draft.bio.trim() || undefined,
      configPath: draft.configPath.trim() || undefined,
      preferences: { ...prefs, timezone: draft.timezone.trim() || undefined },
    };
    await userStore.update(USER_ID, next);
    setSaving(false);
    reload();
  };

  return (
    <S.Card>
      <S.Caption>Profile</S.Caption>
      <S.Title>You</S.Title>
      <S.Body>Identity-grain fields. Saved to <S.Body>User</S.Body>; not affected by switching Settings profiles.</S.Body>

      <Box style={{ flexDirection: 'column', gap: 14, marginTop: 14 }}>
        <Field label="Display name">
          <Input value={draft.displayName} onChange={(v) => setDraft((d) => ({ ...d, displayName: v }))} placeholder="josiah" />
        </Field>
        <Field label="Email">
          <Input value={draft.email} onChange={(v) => setDraft((d) => ({ ...d, email: v }))} placeholder="you@example.com" />
        </Field>
        <Field label="Bio">
          <Input value={draft.bio} onChange={(v) => setDraft((d) => ({ ...d, bio: v }))} placeholder="One line about you. Folded into the assistant's system message." />
        </Field>
        <Field label="Config path">
          <Input mono value={draft.configPath} onChange={(v) => setDraft((d) => ({ ...d, configPath: v }))} placeholder="~/.app/config" />
        </Field>
        <Field label="Timezone">
          <Input mono value={draft.timezone} onChange={(v) => setDraft((d) => ({ ...d, timezone: v }))} placeholder="America/Chicago" />
        </Field>
      </Box>

      <S.AppFormButtonRow style={{ marginTop: 16, gap: 8 }}>
        <S.Button onPress={saving ? () => {} : save}>
          <S.ButtonLabel>{saving ? 'Saving…' : 'Save profile'}</S.ButtonLabel>
        </S.Button>
      </S.AppFormButtonRow>
    </S.Card>
  );
}

// ─── Preferences ──────────────────────────────────────────────────

function PreferencesSection({ user, userStore, reload }) {
  const accs = Array.isArray(user?.preferences?.accommodations) ? user.preferences.accommodations : [];
  const activeIds = new Set(accs.map((a) => a.id));
  const [busy, setBusy] = useState(false);

  const toggle = async (traitId) => {
    setBusy(true);
    const cur = user || { id: USER_ID, preferences: {} };
    const prefs = cur.preferences || {};
    const accId = `acc_${traitId}`;
    let nextAccs;
    if (activeIds.has(accId)) {
      nextAccs = accs.filter((a) => a.id !== accId);
    } else {
      const t = TRAITS.find((tr) => tr.id === traitId);
      if (!t) { setBusy(false); return; }
      nextAccs = [...accs, { id: accId, label: t.label, note: t.note }];
    }
    await userStore.update(USER_ID, { ...cur, preferences: { ...prefs, accommodations: nextAccs } });
    setBusy(false);
    reload();
  };

  return (
    <S.Card>
      <S.Caption>Preferences</S.Caption>
      <S.Title>Accommodations</S.Title>
      <S.Body>Free-form traits the assistant calibrates around. These get folded into the user-baseline system message — not corrective rules, just honest context. Toggle to add or remove.</S.Body>

      <S.AppTraitGrid style={{ marginTop: 14, justifyContent: 'flex-start' }}>
        {TRAITS.map((t) => {
          const isOn = activeIds.has(`acc_${t.id}`);
          const Chip = isOn ? S.AppTraitChipActive : S.AppTraitChip;
          const Label = isOn ? S.AppTraitChipTextActive : S.AppTraitChipText;
          return (
            <Chip key={t.id} onPress={busy ? () => {} : () => toggle(t.id)}>
              <Label>{t.label}</Label>
            </Chip>
          );
        })}
      </S.AppTraitGrid>

      {accs.length > 0 ? (
        <Box style={{ flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <S.Caption>Active accommodations</S.Caption>
          {accs.map((a) => (
            <S.KV key={a.id}>
              <Box style={{ width: 140, flexShrink: 0 }}><S.Body>{a.label}</S.Body></Box>
              <Box style={{ flexGrow: 1, flexShrink: 1 }}><S.Body>{a.note}</S.Body></Box>
            </S.KV>
          ))}
        </Box>
      ) : null}
    </S.Card>
  );
}

// ─── Providers (connection rows) ──────────────────────────────────

function emptyDraft() {
  return {
    label: '',
    kind: 'anthropic-api-key',
    source: defaultSourceForKind('anthropic-api-key'),
    locator: defaultLocatorFor('anthropic-api-key'),
    endpoint: 'https://api.anthropic.com/v1',
    contextLength: 200000,
    effort: 'medium',
    chosenModel: '',
    probedModels: null,
    probeStatus: null,
    probeMessage: '',
  };
}

function ProvidersSection({ connections, settings, settingsStore, connectionStore, reload }) {
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

  return (
    <Box style={{ flexDirection: 'column', gap: 16 }}>
      <S.Card>
        <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <Box>
            <S.Caption>Providers</S.Caption>
            <S.Title>Connections</S.Title>
          </Box>
          {!adding ? (
            <S.Button onPress={() => { setAdding(true); setEditingId(null); }}>
              <S.ButtonLabel>+ Add connection</S.ButtonLabel>
            </S.Button>
          ) : (
            <S.ButtonOutline onPress={() => setAdding(false)}>
              <S.ButtonOutlineLabel>Cancel</S.ButtonOutlineLabel>
            </S.ButtonOutline>
          )}
        </Box>
        <S.Body>Each connection points the assistant at a credential source. Secrets aren't stored here — only where to find them. <S.Body>openai-api-like</S.Body> covers anything that speaks the OpenAI Chat Completions schema (vLLM / Ollama / LM-Studio / OpenRouter / etc).</S.Body>

        {adding ? (
          <Box style={{ marginTop: 14 }}>
            <ConnectionEditor
              initial={null}
              connections={connections}
              onSubmit={async (draft) => {
                const id = `conn_${Date.now().toString(36)}`;
                const now = new Date().toISOString();
                await connectionStore.create({
                  id,
                  settingsId: SETTINGS_ID,
                  providerId: providerIdForKind(draft.kind),
                  kind: draft.kind,
                  label: draft.label || labelForKind(draft.kind),
                  credentialRef: { source: draft.source, locator: draft.locator || undefined },
                  endpoint: needsEndpoint(draft.kind) ? (draft.endpoint || undefined) : undefined,
                  capabilities: defaultCapabilitiesFor(draft.kind),
                  status: 'active',
                  contextLength: draft.contextLength || undefined,
                  effort: draft.effort || undefined,
                  defaultModel: draft.chosenModel || undefined,
                  createdAt: now,
                });
                setAdding(false);
                reload();
              }}
              onCancel={() => setAdding(false)}
            />
          </Box>
        ) : null}
      </S.Card>

      {connections.length === 0 ? (
        <S.Card>
          <S.Body>No connections yet. Click <S.Body>+ Add connection</S.Body> to wire one.</S.Body>
        </S.Card>
      ) : null}

      {connections.map((c) => {
        const isEditing = editingId === c.id;
        const isDefault = settings?.defaultConnectionId === c.id;
        return (
          <S.Card key={c.id}>
            {isEditing ? (
              <ConnectionEditor
                initial={c}
                connections={connections}
                onSubmit={async (draft) => {
                  await connectionStore.update(c.id, {
                    label: draft.label,
                    kind: draft.kind,
                    providerId: providerIdForKind(draft.kind),
                    credentialRef: { source: draft.source, locator: draft.locator || undefined },
                    endpoint: needsEndpoint(draft.kind) ? (draft.endpoint || undefined) : undefined,
                    contextLength: draft.contextLength || undefined,
                    effort: draft.effort || undefined,
                    defaultModel: draft.chosenModel || undefined,
                  });
                  setEditingId(null);
                  reload();
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <ConnectionRowView
                conn={c}
                isDefault={isDefault}
                onEdit={() => { setEditingId(c.id); setAdding(false); }}
                onDelete={async () => {
                  await connectionStore.delete(c.id);
                  if (settings?.defaultConnectionId === c.id) {
                    await settingsStore.update(SETTINGS_ID, { ...settings, defaultConnectionId: undefined, defaultModelId: undefined });
                  }
                  reload();
                }}
                onMakeDefault={async () => {
                  await settingsStore.update(SETTINGS_ID, { ...settings, defaultConnectionId: c.id });
                  reload();
                }}
              />
            )}
          </S.Card>
        );
      })}
    </Box>
  );
}

function ConnectionRowView({ conn, isDefault, onEdit, onDelete, onMakeDefault }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cap = conn.capabilities || {};
  const capChips = [
    cap.streaming   && 'streaming',
    cap.tools       && 'tools',
    cap.thinking    && 'thinking',
    cap.vision      && 'vision',
    cap.promptCache && 'cache',
    cap.batch       && 'batch',
  ].filter(Boolean);

  return (
    <Box style={{ flexDirection: 'column', gap: 10 }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          <S.Title>{conn.label || labelForKind(conn.kind)}</S.Title>
          {isDefault ? <S.Chip><S.Body>default</S.Body></S.Chip> : null}
          <S.Chip><S.Body>{conn.status}</S.Body></S.Chip>
        </Box>
        <Box style={{ flexDirection: 'row', gap: 8 }}>
          {!isDefault ? (
            <S.ButtonOutline onPress={onMakeDefault}>
              <S.ButtonOutlineLabel>Make default</S.ButtonOutlineLabel>
            </S.ButtonOutline>
          ) : null}
          <S.ButtonOutline onPress={onEdit}>
            <S.ButtonOutlineLabel>Edit</S.ButtonOutlineLabel>
          </S.ButtonOutline>
          {confirmDelete ? (
            <>
              <S.ButtonOutline onPress={() => setConfirmDelete(false)}>
                <S.ButtonOutlineLabel>Cancel</S.ButtonOutlineLabel>
              </S.ButtonOutline>
              <S.Button onPress={onDelete}>
                <S.ButtonLabel>Confirm delete</S.ButtonLabel>
              </S.Button>
            </>
          ) : (
            <S.ButtonOutline onPress={() => setConfirmDelete(true)}>
              <S.ButtonOutlineLabel>Delete</S.ButtonOutlineLabel>
            </S.ButtonOutline>
          )}
        </Box>
      </Box>
      <S.KV>
        <Box style={{ width: 140, flexShrink: 0 }}><S.Body>Kind</S.Body></Box>
        <Box style={{ flexGrow: 1 }}><S.Body>{conn.kind}</S.Body></Box>
      </S.KV>
      <S.KV>
        <Box style={{ width: 140, flexShrink: 0 }}><S.Body>Provider</S.Body></Box>
        <Box style={{ flexGrow: 1 }}><S.Body>{conn.providerId}</S.Body></Box>
      </S.KV>
      <S.KV>
        <Box style={{ width: 140, flexShrink: 0 }}><S.Body>Credential</S.Body></Box>
        <Box style={{ flexGrow: 1 }}><S.Body>{fmtCredential(conn.credentialRef)}</S.Body></Box>
      </S.KV>
      {needsEndpoint(conn.kind) ? (
        <S.KV>
          <Box style={{ width: 140, flexShrink: 0 }}><S.Body>Endpoint</S.Body></Box>
          <Box style={{ flexGrow: 1 }}><S.Body>{pickStr(conn.endpoint)}</S.Body></Box>
        </S.KV>
      ) : null}
      {conn.defaultModel ? (
        <S.KV>
          <Box style={{ width: 140, flexShrink: 0 }}><S.Body>Default model</S.Body></Box>
          <Box style={{ flexGrow: 1 }}><S.Body>{conn.defaultModel}</S.Body></Box>
        </S.KV>
      ) : null}
      {conn.contextLength ? (
        <S.KV>
          <Box style={{ width: 140, flexShrink: 0 }}><S.Body>Context length</S.Body></Box>
          <Box style={{ flexGrow: 1 }}><S.Body>{conn.contextLength.toLocaleString()} tok</S.Body></Box>
        </S.KV>
      ) : null}
      {conn.effort ? (
        <S.KV>
          <Box style={{ width: 140, flexShrink: 0 }}><S.Body>Effort</S.Body></Box>
          <Box style={{ flexGrow: 1 }}><S.Body>{conn.effort}</S.Body></Box>
        </S.KV>
      ) : null}
      {capChips.length > 0 ? (
        <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {capChips.map((c) => <S.Chip key={c}><S.Body>{c}</S.Body></S.Chip>)}
        </Box>
      ) : null}
    </Box>
  );
}

function ConnectionEditor({ initial, connections, onSubmit, onCancel }) {
  const [draft, setDraft] = useState(() => {
    if (initial) {
      return {
        label: initial.label || '',
        kind: initial.kind,
        source: initial.credentialRef?.source || defaultSourceForKind(initial.kind),
        locator: initial.credentialRef?.locator || '',
        endpoint: initial.endpoint || defaultEndpointFor(initial.kind),
        contextLength: typeof initial.contextLength === 'number' ? initial.contextLength : defaultContextFor(initial.kind),
        effort: initial.effort || 'medium',
        chosenModel: initial.defaultModel || '',
        probedModels: null,
        probeStatus: null,
        probeMessage: '',
      };
    }
    return emptyDraft();
  });

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const onKindChange = (k) => update({
    kind: k,
    source: defaultSourceForKind(k),
    locator: defaultLocatorFor(k),
    endpoint: defaultEndpointFor(k),
    contextLength: defaultContextFor(k),
    probedModels: null, probeStatus: null, probeMessage: '',
  });

  const validation = validateConnectionDraft(draft, connections, initial?.id);

  const probe = async () => {
    update({ probeStatus: 'busy', probeMessage: '', probedModels: null });
    const r = await probeConnection(draft).catch((err) => ({ ok: false, message: String(err?.message || err) }));
    if (r.ok) {
      update({
        probeStatus: 'success',
        probeMessage: r.message || '',
        probedModels: r.models || null,
        chosenModel: draft.chosenModel || (r.models?.[0] || ''),
      });
    } else {
      update({ probeStatus: 'fail', probeMessage: r.message || 'Probe failed.' });
    }
  };

  return (
    <S.AppFormShell style={{ width: '100%', maxWidth: '100%' }}>
      <S.Caption>{initial ? 'Edit connection' : 'New connection'}</S.Caption>

      <S.AppFormFieldCol>
        <S.AppFormLabel>Label</S.AppFormLabel>
        <S.AppFormInput
          value={draft.label}
          onChange={inputHandler((v) => update({ label: v }))}
          placeholder={labelForKind(draft.kind)}
        />
      </S.AppFormFieldCol>

      <S.AppFormFieldCol>
        <S.AppFormLabel>Kind</S.AppFormLabel>
        <PillRow
          options={CONNECTION_KINDS}
          value={draft.kind}
          onChange={onKindChange}
        />
      </S.AppFormFieldCol>

      {needsEndpoint(draft.kind) ? (
        <S.AppFormFieldCol>
          <S.AppFormLabel>Endpoint</S.AppFormLabel>
          <S.AppFormInputMono
            value={draft.endpoint}
            onChange={inputHandler((v) => update({ endpoint: v }))}
            placeholder={defaultEndpointFor(draft.kind)}
          />
        </S.AppFormFieldCol>
      ) : null}

      <S.AppFormFieldCol>
        <S.AppFormLabel>Credential source</S.AppFormLabel>
        <PillRow
          options={CREDENTIAL_SOURCES}
          value={draft.source}
          onChange={(v) => update({ source: v })}
        />
      </S.AppFormFieldCol>

      <S.AppFormFieldCol>
        <S.AppFormLabel>Locator</S.AppFormLabel>
        <S.AppFormInputMono
          value={draft.locator}
          onChange={inputHandler((v) => update({ locator: v }))}
          placeholder={placeholderForLocator(draft.source)}
        />
        <S.AppFormLabel style={{ marginTop: 4 }}>{locatorHint(draft.source)}</S.AppFormLabel>
      </S.AppFormFieldCol>

      <S.AppFormFieldCol>
        <S.AppFormLabel>Context length (tokens)</S.AppFormLabel>
        <S.AppFormInputMono
          value={String(draft.contextLength || '')}
          onChange={inputHandler((v) => update({ contextLength: parseInt(v, 10) || 0 }))}
          placeholder="200000"
        />
      </S.AppFormFieldCol>

      <S.AppFormFieldCol>
        <S.AppFormLabel>Default reasoning effort</S.AppFormLabel>
        <PillRow
          options={EFFORT_OPTIONS}
          value={draft.effort}
          onChange={(v) => update({ effort: v })}
        />
      </S.AppFormFieldCol>

      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <S.Button onPress={draft.probeStatus === 'busy' ? () => {} : probe}>
          <S.ButtonLabel>{draft.probeStatus === 'busy' ? 'Probing…' : 'Probe connection'}</S.ButtonLabel>
        </S.Button>
        <S.AppFormLabel>Verifies the credential and lists models. Not required to save.</S.AppFormLabel>
      </Box>

      {draft.probeStatus === 'success' || draft.probeStatus === 'fail' ? (
        <S.AppProbeResult>
          {draft.probeStatus === 'success'
            ? <S.AppProbeOk>Probe succeeded</S.AppProbeOk>
            : <S.AppProbeFail>Probe failed</S.AppProbeFail>}
          {draft.probeMessage ? <S.AppProbeMessage>{draft.probeMessage}</S.AppProbeMessage> : null}
        </S.AppProbeResult>
      ) : null}

      {draft.probedModels ? (
        <S.AppFormFieldCol>
          <S.AppModelListLabel>Default model (from probe)</S.AppModelListLabel>
          <S.AppModelListBox style={{ height: draft.probedModels.length > 6 ? 220 : undefined, maxHeight: 220 }}>
            <ScrollView showScrollbar={draft.probedModels.length > 6} style={{ flexGrow: 1, minHeight: 0, width: '100%' }}>
              <Box style={{ flexDirection: 'column', gap: 4 }}>
                {draft.probedModels.map((m) => {
                  const isOn = m === draft.chosenModel;
                  const Choice = isOn ? S.AppModelChoiceActive : S.AppModelChoice;
                  const Text = isOn ? S.AppModelChoiceTextActive : S.AppModelChoiceText;
                  return (
                    <Choice key={m} onPress={() => update({ chosenModel: m })}>
                      <Text>{m}</Text>
                    </Choice>
                  );
                })}
              </Box>
            </ScrollView>
          </S.AppModelListBox>
        </S.AppFormFieldCol>
      ) : (
        <S.AppFormFieldCol>
          <S.AppFormLabel>Default model</S.AppFormLabel>
          <S.AppFormInputMono
            value={draft.chosenModel}
            onChange={inputHandler((v) => update({ chosenModel: v }))}
            placeholder="probe to populate, or type manually"
          />
        </S.AppFormFieldCol>
      )}

      {!validation.ok ? (
        <S.AppProbeResult>
          <S.AppProbeFail>Cannot save</S.AppProbeFail>
          <S.AppProbeMessage>{validation.message}</S.AppProbeMessage>
        </S.AppProbeResult>
      ) : null}

      <S.AppFormButtonRow style={{ gap: 8 }}>
        <S.ButtonOutline onPress={onCancel}>
          <S.ButtonOutlineLabel>Cancel</S.ButtonOutlineLabel>
        </S.ButtonOutline>
        <S.Button onPress={validation.ok ? () => onSubmit(draft) : () => {}}>
          <S.ButtonLabel>{initial ? 'Save changes' : 'Create connection'}</S.ButtonLabel>
        </S.Button>
      </S.AppFormButtonRow>
    </S.AppFormShell>
  );
}

function validateConnectionDraft(draft, connections, currentId) {
  if (!draft.label.trim() && !labelForKind(draft.kind)) {
    return { ok: false, message: 'Provide a label.' };
  }
  if (requiresKey(draft.kind) && draft.source !== 'cli-session' && draft.source !== 'none') {
    if (!draft.locator.trim()) {
      return { ok: false, message: 'API-key kinds need a credential locator (env var name, keychain id, or file path).' };
    }
  }
  if (needsEndpoint(draft.kind) && !draft.endpoint.trim()) {
    return { ok: false, message: 'OpenAI-style kinds need an endpoint URL.' };
  }
  // Dedup by (kind, locator). Same kind with the same credential
  // pointer is a duplicate; same kind with different locators is fine.
  const dup = connections.find((c) =>
    c.id !== currentId &&
    c.kind === draft.kind &&
    pickStrRaw(c.credentialRef?.locator) === draft.locator.trim()
  );
  if (dup) {
    return { ok: false, message: `Already exists: "${dup.label || dup.kind}" uses the same kind + locator.` };
  }
  return { ok: true, message: '' };
}

async function probeConnection(draft) {
  const kind = draft.kind;
  if (kind === 'claude-code-cli') {
    const r = await execAsync('claude --version').catch((err) => ({ code: 1, stdout: '', stderr: String(err?.message || err) }));
    if (r.code !== 0) {
      return { ok: false, message: (r.stderr || r.stdout || 'claude binary not found on PATH').split('\n').slice(-3).join('\n') };
    }
    return { ok: true, message: r.stdout.trim(), models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5'] };
  }
  if (kind === 'local-runtime') {
    // Probe a few common local OAI-shaped servers (Ollama, LM-Studio, vLLM).
    const tries = ['http://localhost:11434/v1/models', 'http://localhost:1234/v1/models', 'http://localhost:8000/v1/models'];
    for (const url of tries) {
      const r = await execAsync(`curl -fsS --max-time 3 "${url}"`).catch(() => null);
      if (r && r.code === 0) {
        const models = parseModelList(r.stdout);
        if (models.length > 0) return { ok: true, message: `Probed ${url}`, models };
      }
    }
    return { ok: false, message: 'No local runtime found at common ports (11434 / 1234 / 8000).' };
  }
  // HTTP api-key kinds — anthropic, openai, openai-api-like, kimi.
  const endpoint = (draft.endpoint || defaultEndpointFor(kind) || '').replace(/\/+$/, '');
  if (!endpoint) return { ok: false, message: 'Missing endpoint URL.' };
  const keyResolution = await resolveKey(draft);
  if (!keyResolution.ok) return { ok: false, message: keyResolution.message };
  const url = `${endpoint}/models`;
  const cmd = `curl -fsS --max-time 8 -H "${authHeaderFor(kind)}: ${keyResolution.value}" "${url}"`;
  const r = await execAsync(cmd).catch((err) => ({ code: 1, stdout: '', stderr: String(err?.message || err) }));
  if (r.code !== 0) {
    const tail = (r.stderr || r.stdout || '').split('\n').slice(-3).join('\n');
    return { ok: false, message: `GET ${url} failed.\n${tail}` };
  }
  const models = parseModelList(r.stdout);
  if (models.length === 0) return { ok: false, message: 'Endpoint replied but no models parsed.' };
  return { ok: true, message: `${models.length} models from ${url}`, models };
}

function authHeaderFor(kind) {
  if (kind === 'anthropic-api-key') return 'x-api-key';
  return 'Authorization: Bearer';
}

async function resolveKey(draft) {
  if (draft.source === 'env') {
    const r = await execAsync(`printf %s "$${draft.locator.replace(/[^A-Za-z0-9_]/g, '')}"`).catch(() => null);
    const val = (r?.stdout || '').trim();
    if (!val) return { ok: false, message: `Env var ${draft.locator} is unset or empty.` };
    return { ok: true, value: val };
  }
  if (draft.source === 'file') {
    const r = await execAsync(`cat "${draft.locator}" 2>/dev/null | head -1`).catch(() => null);
    const val = (r?.stdout || '').trim();
    if (!val) return { ok: false, message: `File ${draft.locator} is unreadable or empty.` };
    return { ok: true, value: val };
  }
  return { ok: false, message: `Source "${draft.source}" can't be resolved during a probe; use env or file for testing.` };
}

function parseModelList(stdout) {
  try {
    const obj = JSON.parse(stdout);
    if (Array.isArray(obj?.data)) return obj.data.map((m) => m.id || m.model).filter(Boolean);
    if (Array.isArray(obj?.models)) return obj.models.map((m) => m.id || m.name).filter(Boolean);
    if (Array.isArray(obj)) return obj.map((m) => m.id || m.name).filter(Boolean);
  } catch {
    /* fallthrough — return [] */
  }
  return [];
}

// ─── Defaults ─────────────────────────────────────────────────────

function DefaultsSection({ settings, settingsStore, connections, reload }) {
  const defaultConn = connections.find((c) => c.id === settings?.defaultConnectionId) || null;
  const [draft, setDraft] = useState({
    defaultConnectionId: settings?.defaultConnectionId || '',
    defaultModelId: settings?.defaultModelId || '',
    effort: settings?.defaultEffort || defaultConn?.effort || 'medium',
    maxOutputTokens: settings?.defaultMaxOutputTokens || 0,
  });

  useEffect(() => {
    setDraft({
      defaultConnectionId: settings?.defaultConnectionId || '',
      defaultModelId: settings?.defaultModelId || '',
      effort: settings?.defaultEffort || defaultConn?.effort || 'medium',
      maxOutputTokens: settings?.defaultMaxOutputTokens || 0,
    });
  }, [settings?.id, settings?.defaultConnectionId, settings?.defaultModelId, settings?.defaultEffort, settings?.defaultMaxOutputTokens]);

  const save = async () => {
    await settingsStore.update(SETTINGS_ID, {
      ...settings,
      defaultConnectionId: draft.defaultConnectionId || undefined,
      defaultModelId: draft.defaultModelId || undefined,
      defaultEffort: draft.effort || undefined,
      defaultMaxOutputTokens: draft.maxOutputTokens || undefined,
    });
    reload();
  };

  return (
    <S.Card>
      <S.Caption>Defaults</S.Caption>
      <S.Title>Assistant target</S.Title>
      <S.Body>The connection + model the supervisor input fires against. Reasoning effort and max-output-token cap apply to every default-routed request unless an activity overrides them.</S.Body>

      <Box style={{ flexDirection: 'column', gap: 14, marginTop: 14 }}>
        <S.AppFormFieldCol>
          <S.AppFormLabel>Default connection</S.AppFormLabel>
          {connections.length === 0 ? (
            <S.Body>No connections — add one in Providers.</S.Body>
          ) : (
            <PillRow
              options={connections.map((c) => c.id)}
              labels={connections.map((c) => c.label || labelForKind(c.kind))}
              value={draft.defaultConnectionId}
              onChange={(v) => setDraft((d) => ({ ...d, defaultConnectionId: v, defaultModelId: '' }))}
            />
          )}
        </S.AppFormFieldCol>

        <S.AppFormFieldCol>
          <S.AppFormLabel>Default model</S.AppFormLabel>
          <S.AppFormInputMono
            value={draft.defaultModelId}
            onChange={inputHandler((v) => setDraft((d) => ({ ...d, defaultModelId: v })))}
            placeholder={defaultConn?.defaultModel || 'probe a connection in Providers to populate'}
          />
          {defaultConn?.defaultModel ? (
            <S.AppFormLabel>Connection's saved default: <S.Body>{defaultConn.defaultModel}</S.Body>. Empty here = use the connection's default.</S.AppFormLabel>
          ) : null}
        </S.AppFormFieldCol>

        <S.AppFormFieldCol>
          <S.AppFormLabel>Reasoning effort</S.AppFormLabel>
          <PillRow
            options={EFFORT_OPTIONS}
            value={draft.effort}
            onChange={(v) => setDraft((d) => ({ ...d, effort: v }))}
          />
        </S.AppFormFieldCol>

        <S.AppFormFieldCol>
          <S.AppFormLabel>Max output tokens (0 = no override)</S.AppFormLabel>
          <S.AppFormInputMono
            value={String(draft.maxOutputTokens || '')}
            onChange={inputHandler((v) => setDraft((d) => ({ ...d, maxOutputTokens: parseInt(v, 10) || 0 })))}
            placeholder="0"
          />
        </S.AppFormFieldCol>
      </Box>

      <S.AppFormButtonRow style={{ marginTop: 16, gap: 8 }}>
        <S.Button onPress={save}>
          <S.ButtonLabel>Save defaults</S.ButtonLabel>
        </S.Button>
      </S.AppFormButtonRow>
    </S.Card>
  );
}

// ─── Voice (whisper + ensemble normalization) ─────────────────────

function VoiceSection({ user, userStore, reload }) {
  const [installed, setInstalled] = useState({});
  const [busy, setBusy] = useState({});
  const [logs, setLogs] = useState({});
  const [probeKey, setProbeKey] = useState(0);

  const voicePref = user?.preferences?.voice || {};
  const defaultModelPath = pickStr(voicePref.defaultModelPath);
  const mode = voicePref.mode === 'ensemble' ? 'ensemble'
    : voicePref.mode === 'escalating' ? 'escalating'
    : 'single';
  const baseTier = Array.isArray(voicePref.baseTier) && voicePref.baseTier.length > 0 ? voicePref.baseTier : ['tiny', 'base', 'small'];
  const escalationTier = Array.isArray(voicePref.escalationTier) && voicePref.escalationTier.length > 0 ? voicePref.escalationTier : ['medium'];
  const escalationThreshold = typeof voicePref.escalationThreshold === 'number' ? voicePref.escalationThreshold : 2;
  const anchorWindow = typeof voicePref.anchorWindow === 'number' ? voicePref.anchorWindow : 2;
  const showCandidates = voicePref.showCandidates !== false;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out = {};
      for (const m of WHISPER_MODELS) {
        const r = await execAsync(`stat -c '%s' "$HOME/.reactjit/models/${m.file}" 2>/dev/null || echo MISSING`).catch(() => null);
        if (cancelled) return;
        const txt = (r?.stdout || '').trim();
        if (txt && txt !== 'MISSING' && /^\d+$/.test(txt)) out[m.file] = { sizeBytes: parseInt(txt, 10) };
      }
      if (!cancelled) setInstalled(out);
    })();
    return () => { cancelled = true; };
  }, [probeKey]);

  const writePref = async (patch) => {
    const cur = user || { id: USER_ID, preferences: {} };
    const prefs = cur.preferences || {};
    await userStore.update(USER_ID, { ...cur, preferences: { ...prefs, voice: { ...(prefs.voice || {}), ...patch } } });
    reload();
  };

  const download = async (m) => {
    setBusy((b) => ({ ...b, [m.id]: 'downloading' }));
    setLogs((l) => ({ ...l, [m.id]: '' }));
    const r = await execAsync(`${FETCH_SCRIPT} ${m.id}`).catch((err) => ({ code: 1, stdout: '', stderr: String(err?.message || err) }));
    setLogs((l) => ({ ...l, [m.id]: (r.stderr || r.stdout || '').split('\n').slice(-6).join('\n') }));
    setBusy((b) => { const next = { ...b }; if (r.code === 0) delete next[m.id]; else next[m.id] = `error (exit ${r.code})`; return next; });
    setProbeKey((k) => k + 1);
  };

  const setDefaultModel = (m) => writePref({ defaultModelPath: `~/.reactjit/models/${m.file}` });
  const toggleTier = (tierKey, modelId) => {
    const cur = tierKey === 'baseTier' ? baseTier : escalationTier;
    const next = cur.includes(modelId) ? cur.filter((x) => x !== modelId) : [...cur, modelId];
    writePref({ [tierKey]: next });
  };

  const installedIds = WHISPER_MODELS.filter((m) => installed[m.file]).map((m) => m.id);
  const anyInstalled = installedIds.length > 0;

  return (
    <Box style={{ flexDirection: 'column', gap: 16 }}>
      <S.Card>
        <S.Caption>Voice · speech-to-text</S.Caption>
        <S.Title>Whisper models</S.Title>
        <S.Body>Models live in <S.Body>~/.reactjit/models/</S.Body>. Downloads run <S.Body>{FETCH_SCRIPT} &lt;name&gt;</S.Body> in the cart's working directory.</S.Body>

        <Box style={{ flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {WHISPER_MODELS.map((m) => {
            const inst = installed[m.file];
            const isInstalled = !!inst;
            const isDefault = defaultModelPath.endsWith(m.file);
            const state = busy[m.id];
            return (
              <S.InputWell key={m.id} style={{ gap: 6 }}>
                <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                    <S.Title>{m.id}</S.Title>
                    <S.Chip><S.Body>{isInstalled ? `installed · ${fmtBytes(inst.sizeBytes)}` : `not installed · ~${m.approxMB} MB`}</S.Body></S.Chip>
                    {isDefault ? <S.Chip><S.Body>default</S.Body></S.Chip> : null}
                  </Box>
                  <Box style={{ flexDirection: 'row', gap: 6 }}>
                    {isInstalled && !isDefault ? (
                      <S.ButtonOutline onPress={() => setDefaultModel(m)}>
                        <S.ButtonOutlineLabel>Make default</S.ButtonOutlineLabel>
                      </S.ButtonOutline>
                    ) : null}
                    <S.Button onPress={state === 'downloading' ? () => {} : () => download(m)}>
                      <S.ButtonLabel>{isInstalled ? 'Re-download' : (state === 'downloading' ? 'Downloading…' : 'Download')}</S.ButtonLabel>
                    </S.Button>
                  </Box>
                </Box>
                <S.Body>{m.file} — {m.blurb}</S.Body>
                {state && state !== 'downloading' ? <S.Body>{state}</S.Body> : null}
                {logs[m.id] ? (
                  <S.AppProbeResult><S.AppProbeMessage>{logs[m.id]}</S.AppProbeMessage></S.AppProbeResult>
                ) : null}
              </S.InputWell>
            );
          })}
        </Box>
      </S.Card>

      <S.Card>
        <S.Caption>Normalization</S.Caption>
        <S.Title>Transcription pipeline</S.Title>
        <S.Body>Single = one model, no consensus. Ensemble = N models in parallel + ROVER word voting. Escalating = ensemble plus a heavier tier when low-confidence words appear. Maps 1:1 to <S.Body>useEnsembleTranscript</S.Body>.</S.Body>

        <Box style={{ marginTop: 12 }}>
          <S.AppFormFieldCol>
            <S.AppFormLabel>Pipeline mode</S.AppFormLabel>
            <PillRow
              options={['single', 'ensemble', 'escalating']}
              labels={['Single model', 'Ensemble (vote)', 'Ensemble + escalation']}
              value={mode}
              onChange={(v) => writePref({ mode: v })}
            />
          </S.AppFormFieldCol>
        </Box>

        {!anyInstalled ? (
          <S.AppProbeResult style={{ marginTop: 12 }}>
            <S.AppProbeMessage>No whisper models installed yet — download at least one above before configuring.</S.AppProbeMessage>
          </S.AppProbeResult>
        ) : null}

        {mode !== 'single' && anyInstalled ? (
          <Box style={{ flexDirection: 'column', gap: 14, marginTop: 14 }}>
            <S.AppFormFieldCol>
              <S.AppFormLabel>Base ensemble — runs in parallel on every utterance</S.AppFormLabel>
              <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {WHISPER_MODELS.map((m) => {
                  const isOn = baseTier.includes(m.id);
                  const Chip = isOn ? S.AppTraitChipActive : S.AppTraitChip;
                  const Label = isOn ? S.AppTraitChipTextActive : S.AppTraitChipText;
                  return (
                    <Chip key={m.id} onPress={() => toggleTier('baseTier', m.id)} style={{ opacity: installed[m.file] ? 1 : 0.5 }}>
                      <Label>{m.id}{installed[m.file] ? '' : ' · missing'}</Label>
                    </Chip>
                  );
                })}
              </Box>
            </S.AppFormFieldCol>

            {mode === 'escalating' ? (
              <>
                <S.AppFormFieldCol>
                  <S.AppFormLabel>Escalation tier — runs sequentially when threshold trips</S.AppFormLabel>
                  <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {WHISPER_MODELS.map((m) => {
                      const isOn = escalationTier.includes(m.id);
                      const Chip = isOn ? S.AppTraitChipActive : S.AppTraitChip;
                      const Label = isOn ? S.AppTraitChipTextActive : S.AppTraitChipText;
                      return (
                        <Chip key={m.id} onPress={() => toggleTier('escalationTier', m.id)} style={{ opacity: installed[m.file] ? 1 : 0.5 }}>
                          <Label>{m.id}{installed[m.file] ? '' : ' · missing'}</Label>
                        </Chip>
                      );
                    })}
                  </Box>
                </S.AppFormFieldCol>

                <S.AppFormFieldCol>
                  <S.AppFormLabel>Escalation threshold (votes &lt;)</S.AppFormLabel>
                  <PillRow
                    options={[1, 2, 3, 4]}
                    labels={['1 — never', '2 — default', '3 — strict', '4 — paranoid']}
                    value={escalationThreshold}
                    onChange={(v) => writePref({ escalationThreshold: v })}
                  />
                </S.AppFormFieldCol>
              </>
            ) : null}

            <S.AppFormFieldCol>
              <S.AppFormLabel>Anchor match window</S.AppFormLabel>
              <PillRow
                options={[1, 2, 3]}
                labels={['±1 strict', '±2 default', '±3 loose']}
                value={anchorWindow}
                onChange={(v) => writePref({ anchorWindow: v })}
              />
            </S.AppFormFieldCol>

            <S.AppFormFieldCol>
              <S.AppFormLabel>Show inline candidates</S.AppFormLabel>
              <PillRow
                options={[true, false]}
                labels={['On', 'Off']}
                value={showCandidates}
                onChange={(v) => writePref({ showCandidates: v })}
              />
            </S.AppFormFieldCol>
          </Box>
        ) : null}
      </S.Card>
    </Box>
  );
}

// ─── Embedding ────────────────────────────────────────────────────

// HFBrowser — generic Hugging Face repo downloader. The user pastes
// any HF repo id (or a full HF URL); the UI lists every .gguf in the
// repo via HF's tree API and downloads on click. Nothing is hard-coded
// here — repo, sizes, and filenames all come from HF at browse time.
function HFBrowser({ dir, onDownloaded }) {
  const [repo, setRepo] = useState('');
  const [files, setFiles] = useState(null); // null = not browsed; [] = browsed empty
  const [browsing, setBrowsing] = useState(false);
  const [browseErr, setBrowseErr] = useState('');
  const [downloading, setDownloading] = useState({});
  const [logs, setLogs] = useState({});

  const normalizedRepo = (raw) => {
    const s = (raw || '').trim();
    if (!s) return '';
    // Accept full HF URLs (https://huggingface.co/<owner>/<name>) and
    // paths with /tree/main, /resolve/main, etc.
    const m = s.match(/^(?:https?:\/\/huggingface\.co\/)?([\w.-]+\/[\w.-]+)/);
    return m ? m[1] : s;
  };

  const browse = async () => {
    const r = normalizedRepo(repo);
    if (!r) return;
    setBrowsing(true);
    setBrowseErr('');
    setFiles(null);
    const url = `https://huggingface.co/api/models/${r}/tree/main`;
    const res = await execAsync(`curl -fsS --max-time 12 "${url}"`).catch((err) => ({ code: 1, stdout: '', stderr: String(err?.message || err) }));
    setBrowsing(false);
    if (res.code !== 0) {
      const tail = (res.stderr || res.stdout || '').split('\n').slice(-3).join('\n');
      setBrowseErr(`GET ${url} failed.\n${tail}`);
      return;
    }
    let parsed;
    try { parsed = JSON.parse(res.stdout); } catch { setBrowseErr('Failed to parse HF response.'); return; }
    if (!Array.isArray(parsed)) { setBrowseErr('Unexpected HF response shape.'); return; }
    const ggufs = parsed.filter((p) => p.type === 'file' && /\.gguf$/i.test(p.path));
    setFiles(ggufs);
  };

  const download = async (entry) => {
    const r = normalizedRepo(repo);
    if (!r) return;
    setDownloading((d) => ({ ...d, [entry.path]: true }));
    setLogs((l) => ({ ...l, [entry.path]: '' }));
    const url = `https://huggingface.co/${r}/resolve/main/${entry.path}`;
    const dest = `${shellExpand(dir)}/${entry.path}`;
    const cmd = `mkdir -p "$(dirname "${dest}")" && curl -L -f -C - --progress-bar -o "${dest}.partial" "${url}" && mv "${dest}.partial" "${dest}"`;
    const res = await execAsync(cmd).catch((err) => ({ code: 1, stdout: '', stderr: String(err?.message || err) }));
    setLogs((l) => ({ ...l, [entry.path]: (res.stderr || res.stdout || '').split('\n').slice(-6).join('\n') }));
    setDownloading((d) => { const next = { ...d }; delete next[entry.path]; return next; });
    if (res.code === 0 && typeof onDownloaded === 'function') onDownloaded();
  };

  return (
    <S.Card>
      <S.Caption>Hugging Face</S.Caption>
      <S.Title>Download a model</S.Title>
      <S.Body>Paste a HF repo id (e.g. <S.Body>nomic-ai/nomic-embed-text-v1.5-GGUF</S.Body>) or a full HF URL. The UI lists every <S.Body>.gguf</S.Body> in the repo and downloads the one you click straight into <S.Body>{dir}</S.Body>. Nothing is hard-coded — paste any GGUF repo on the Hub.</S.Body>

      <S.AppFormFieldCol style={{ marginTop: 12 }}>
        <S.AppFormLabel>Repo</S.AppFormLabel>
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ flexGrow: 1 }}>
            <S.AppFormInputMono value={repo} onChange={inputHandler(setRepo)} placeholder="owner/repo  or  https://huggingface.co/owner/repo" />
          </Box>
          <S.Button onPress={browsing ? () => {} : browse}>
            <S.ButtonLabel>{browsing ? 'Browsing…' : 'Browse'}</S.ButtonLabel>
          </S.Button>
        </Box>
      </S.AppFormFieldCol>

      {browseErr ? (
        <S.AppProbeResult style={{ marginTop: 12 }}>
          <S.AppProbeFail>Browse failed</S.AppProbeFail>
          <S.AppProbeMessage>{browseErr}</S.AppProbeMessage>
        </S.AppProbeResult>
      ) : null}

      {files && files.length === 0 ? (
        <S.AppProbeResult style={{ marginTop: 12 }}>
          <S.AppProbeMessage>No .gguf files in this repo.</S.AppProbeMessage>
        </S.AppProbeResult>
      ) : null}

      {files && files.length > 0 ? (
        <Box style={{ flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {files.map((f) => {
            const isBusy = !!downloading[f.path];
            return (
              <S.InputWell key={f.path} style={{ gap: 6 }}>
                <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                    <S.Title>{f.path}</S.Title>
                    {typeof f.size === 'number' ? <S.Chip><S.Body>{fmtBytes(f.size)}</S.Body></S.Chip> : null}
                  </Box>
                  <S.Button onPress={isBusy ? () => {} : () => download(f)}>
                    <S.ButtonLabel>{isBusy ? 'Downloading…' : 'Download'}</S.ButtonLabel>
                  </S.Button>
                </Box>
                {logs[f.path] ? (
                  <S.AppProbeResult><S.AppProbeMessage>{logs[f.path]}</S.AppProbeMessage></S.AppProbeResult>
                ) : null}
              </S.InputWell>
            );
          })}
        </Box>
      ) : null}
    </S.Card>
  );
}

// Embedding section — fully agnostic to what the user has on disk.
//
// Local mode: scans a user-configurable directory for *.gguf files and
// shows EXACTLY what's there — no hard-coded "known good" list. The
// dimension is probed live via embed.loadModel + embed.nDim, so the
// user sees the model's real n_embd, not a guess.
//
// Endpoint mode: just a model-id text field + an optional connection
// pointer. No hardcoded provider catalog; users who want the canonical
// list of OpenAI/Voyage/etc. embedders can probe their connection in
// Providers and copy the model id over.
function EmbeddingSection({ user, userStore, connections, reload }) {
  const pref = user?.preferences?.embed || {};
  const mode = pref.mode === 'endpoint' ? 'endpoint' : 'in-house';
  const dirPref = pickStrRaw(pref.dir, DEFAULT_EMBED_DIR);
  const modelPath = pickStrRaw(pref.modelPath);
  const endpointModelId = pickStrRaw(pref.modelId);
  const endpointConnId = pickStrRaw(pref.connectionId);

  const [dirDraft, setDirDraft] = useState(dirPref);
  const [files, setFiles] = useState([]); // [{ name, fullPath, sizeBytes }]
  const [scanState, setScanState] = useState({ status: 'idle', message: '' });
  const [dims, setDims] = useState({});   // fullPath → n_embd | 'busy' | 'error'
  const [customPath, setCustomPath] = useState('');
  const [endpointDraft, setEndpointDraft] = useState({
    modelId: endpointModelId,
    connectionId: endpointConnId,
  });

  useEffect(() => { setDirDraft(dirPref); }, [dirPref]);
  useEffect(() => {
    setEndpointDraft({ modelId: endpointModelId, connectionId: endpointConnId });
  }, [endpointModelId, endpointConnId]);

  const writePref = async (patch) => {
    const cur = user || { id: USER_ID, preferences: {} };
    const prefs = cur.preferences || {};
    await userStore.update(USER_ID, { ...cur, preferences: { ...prefs, embed: { ...(prefs.embed || {}), ...patch } } });
    reload();
  };

  const scan = async (dir) => {
    setScanState({ status: 'busy', message: '' });
    // Use find so subdirs work too. Keep it bounded.
    const cmd = `mkdir -p "${shellExpand(dir)}" 2>/dev/null; find "${shellExpand(dir)}" -maxdepth 3 -type f -name '*.gguf' -printf '%s\\t%p\\n' 2>/dev/null | sort -k2`;
    const r = await execAsync(cmd).catch((err) => ({ code: 1, stdout: '', stderr: String(err?.message || err) }));
    if (r.code !== 0) {
      setScanState({ status: 'fail', message: (r.stderr || r.stdout || '').split('\n').slice(-3).join('\n') });
      setFiles([]);
      return;
    }
    const lines = (r.stdout || '').split('\n').filter(Boolean);
    const out = lines.map((line) => {
      const tab = line.indexOf('\t');
      if (tab < 0) return null;
      const sizeBytes = parseInt(line.slice(0, tab), 10) || 0;
      const fullPath = line.slice(tab + 1);
      const name = fullPath.split('/').pop();
      return { name, fullPath, sizeBytes };
    }).filter(Boolean);
    setFiles(out);
    setScanState({ status: out.length > 0 ? 'success' : 'empty', message: out.length === 0 ? `No .gguf files under ${dir}.` : `${out.length} file${out.length === 1 ? '' : 's'} found.` });
  };

  // Initial scan on mount + when dir pref changes (after save).
  useEffect(() => {
    scan(dirPref);
  }, [dirPref]);

  const probeDim = async (fullPath) => {
    setDims((d) => ({ ...d, [fullPath]: 'busy' }));
    try {
      if (!embed.isAvailable || !embed.isAvailable()) {
        setDims((d) => ({ ...d, [fullPath]: 'unavailable' }));
        return;
      }
      const h = embed.loadModel(shellExpand(fullPath));
      if (!h || h === 0) {
        setDims((d) => ({ ...d, [fullPath]: 'load-failed' }));
        return;
      }
      const n = embed.nDim(h);
      embed.freeModel(h);
      setDims((d) => ({ ...d, [fullPath]: n }));
    } catch (err) {
      setDims((d) => ({ ...d, [fullPath]: `err: ${String(err?.message || err)}` }));
    }
  };

  return (
    <Box style={{ flexDirection: 'column', gap: 16 }}>
      <S.Card>
        <S.Caption>Embedding</S.Caption>
        <S.Title>Mode</S.Title>
        <S.Body>In-house runs the embedder locally via the llama runner — no network, vectors stay on disk. Endpoint fires embedding requests against a provider connection.</S.Body>
        <Box style={{ marginTop: 12 }}>
          <PillRow
            options={['in-house', 'endpoint']}
            labels={['In-house (local llama)', 'Endpoint (provider API)']}
            value={mode}
            onChange={(v) => writePref({ mode: v })}
          />
        </Box>
      </S.Card>

      {mode === 'in-house' ? (
        <>
          <S.Card>
            <S.Caption>Models directory</S.Caption>
            <S.Title>Where to look</S.Title>
            <S.Body>The settings UI scans this directory (and up to two levels deep) for <S.Body>*.gguf</S.Body> files. Whatever the user actually has on disk is the catalog; nothing is hard-coded.</S.Body>

            <S.AppFormFieldCol style={{ marginTop: 12 }}>
              <S.AppFormLabel>Path</S.AppFormLabel>
              <S.AppFormInputMono value={dirDraft} onChange={inputHandler(setDirDraft)} placeholder={DEFAULT_EMBED_DIR} />
            </S.AppFormFieldCol>

            <S.AppFormButtonRow style={{ marginTop: 12, gap: 8 }}>
              <S.ButtonOutline onPress={() => scan(dirDraft.trim() || DEFAULT_EMBED_DIR)}>
                <S.ButtonOutlineLabel>Rescan</S.ButtonOutlineLabel>
              </S.ButtonOutline>
              <S.Button onPress={() => writePref({ dir: dirDraft.trim() || undefined })}>
                <S.ButtonLabel>Save directory</S.ButtonLabel>
              </S.Button>
            </S.AppFormButtonRow>

            {scanState.status === 'fail' || scanState.status === 'empty' ? (
              <S.AppProbeResult>
                {scanState.status === 'fail' ? <S.AppProbeFail>Scan failed</S.AppProbeFail> : null}
                {scanState.message ? <S.AppProbeMessage>{scanState.message}</S.AppProbeMessage> : null}
              </S.AppProbeResult>
            ) : null}
          </S.Card>

          <HFBrowser dir={dirPref} onDownloaded={() => scan(dirPref)} />

          <S.Card>
            <S.Caption>Local embedders on disk</S.Caption>
            <S.Title>{files.length === 0 ? 'No .gguf files yet' : `${files.length} model${files.length === 1 ? '' : 's'}`}</S.Title>
            {files.length === 0 ? (
              <S.Body>Drop a <S.Body>.gguf</S.Body> embedder into the directory above (or any subdir up to 3 levels deep) and rescan. The Probe button per row uses the runtime's llama_ffi to read the actual <S.Body>n_embd</S.Body> from the file — no need to know the dimension up front.</S.Body>
            ) : (
              <S.Body>Probe per row to read the actual embedding dimension from the model. Make-default sets the active embedder. The path you make default is what consumers (retrieval layer, ingest, etc.) read.</S.Body>
            )}

            <Box style={{ flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {files.map((f) => {
                const isDefault = modelPath === f.fullPath;
                const dim = dims[f.fullPath];
                return (
                  <S.InputWell key={f.fullPath} style={{ gap: 6 }}>
                    <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                        <S.Title>{f.name}</S.Title>
                        <S.Chip><S.Body>{fmtBytes(f.sizeBytes)}</S.Body></S.Chip>
                        {typeof dim === 'number' ? <S.Chip><S.Body>{dim}d</S.Body></S.Chip> : null}
                        {dim === 'busy' ? <S.Chip><S.Body>probing…</S.Body></S.Chip> : null}
                        {typeof dim === 'string' && dim !== 'busy' ? <S.Chip><S.Body>{dim}</S.Body></S.Chip> : null}
                        {isDefault ? <S.Chip><S.Body>default</S.Body></S.Chip> : null}
                      </Box>
                      <Box style={{ flexDirection: 'row', gap: 6 }}>
                        <S.ButtonOutline onPress={() => probeDim(f.fullPath)}>
                          <S.ButtonOutlineLabel>{typeof dim === 'number' ? 'Re-probe' : 'Probe'}</S.ButtonOutlineLabel>
                        </S.ButtonOutline>
                        {!isDefault ? (
                          <S.Button onPress={() => writePref({ modelPath: f.fullPath, modelId: undefined, connectionId: undefined })}>
                            <S.ButtonLabel>Make default</S.ButtonLabel>
                          </S.Button>
                        ) : null}
                      </Box>
                    </Box>
                    <S.Body>{f.fullPath}</S.Body>
                  </S.InputWell>
                );
              })}
            </Box>

            <Box style={{ marginTop: 16, flexDirection: 'column', gap: 8 }}>
              <S.AppFormLabel>Or point at any .gguf elsewhere on disk</S.AppFormLabel>
              <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Box style={{ flexGrow: 1 }}>
                  <S.AppFormInputMono value={customPath} onChange={inputHandler(setCustomPath)} placeholder="/absolute/or/~tilde/path/to/embedder.gguf" />
                </Box>
                <S.ButtonOutline onPress={() => {
                  const v = customPath.trim();
                  if (!v) return;
                  probeDim(v);
                  setFiles((cur) => {
                    if (cur.some((c) => c.fullPath === v)) return cur;
                    return [...cur, { name: v.split('/').pop(), fullPath: v, sizeBytes: 0 }];
                  });
                  setCustomPath('');
                }}>
                  <S.ButtonOutlineLabel>Add path</S.ButtonOutlineLabel>
                </S.ButtonOutline>
                <S.Button onPress={() => {
                  const v = customPath.trim();
                  if (!v) return;
                  writePref({ modelPath: v, modelId: undefined, connectionId: undefined });
                  setCustomPath('');
                }}>
                  <S.ButtonLabel>Use as default</S.ButtonLabel>
                </S.Button>
              </Box>
            </Box>
          </S.Card>
        </>
      ) : (
        <S.Card>
          <S.Caption>Endpoint</S.Caption>
          <S.Title>Provider embedder</S.Title>
          <S.Body>Embedding requests reuse one of your provider connections. Pick the connection, then type the embedder model id the provider exposes — there's no canonical list (every provider names them differently and the catalog drifts faster than this UI could keep up).</S.Body>

          <Box style={{ flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <S.AppFormFieldCol>
              <S.AppFormLabel>Connection</S.AppFormLabel>
              {connections.length === 0 ? (
                <S.Body>No connections — add one in Providers first.</S.Body>
              ) : (
                <PillRow
                  options={connections.map((c) => c.id)}
                  labels={connections.map((c) => c.label || labelForKind(c.kind))}
                  value={endpointDraft.connectionId}
                  onChange={(v) => setEndpointDraft((d) => ({ ...d, connectionId: v }))}
                />
              )}
            </S.AppFormFieldCol>

            <S.AppFormFieldCol>
              <S.AppFormLabel>Model id</S.AppFormLabel>
              <S.AppFormInputMono
                value={endpointDraft.modelId}
                onChange={inputHandler((v) => setEndpointDraft((d) => ({ ...d, modelId: v })))}
                placeholder="provider-specific id (e.g. text-embedding-3-small)"
              />
              <S.AppFormLabel style={{ marginTop: 4 }}>Probe the connection in Providers to discover what model ids the endpoint actually serves; copy the embedder id back here.</S.AppFormLabel>
            </S.AppFormFieldCol>
          </Box>

          <S.AppFormButtonRow style={{ marginTop: 12, gap: 8 }}>
            <S.Button onPress={() => writePref({
              connectionId: endpointDraft.connectionId || undefined,
              modelId: endpointDraft.modelId.trim() || undefined,
              modelPath: undefined,
            })}>
              <S.ButtonLabel>Save endpoint default</S.ButtonLabel>
            </S.Button>
          </S.AppFormButtonRow>
        </S.Card>
      )}
    </Box>
  );
}

function shellExpand(p) {
  if (typeof p !== 'string') return '';
  if (p.startsWith('~/')) return `$HOME${p.slice(1)}`;
  return p;
}

// ─── Database ─────────────────────────────────────────────────────

function DatabaseSection({ user, userStore, reload }) {
  const pref = user?.preferences?.db || {};
  const activeEngine = pref.engine || 'sqlite';

  const [locators, setLocators] = useState({
    sqlite: pickStrRaw(pref.sqlitePath, '~/.reactjit/app.sqlite'),
    duckdb: pickStrRaw(pref.duckdbPath, '~/.reactjit/app.duckdb'),
    pg:     pickStrRaw(pref.pgUri, 'embedded'),
  });
  const [probes, setProbes] = useState({}); // engineId → { ok, message }
  const [busy, setBusy] = useState({});

  useEffect(() => {
    setLocators({
      sqlite: pickStrRaw(pref.sqlitePath, '~/.reactjit/app.sqlite'),
      duckdb: pickStrRaw(pref.duckdbPath, '~/.reactjit/app.duckdb'),
      pg:     pickStrRaw(pref.pgUri, 'embedded'),
    });
  }, [pref.sqlitePath, pref.duckdbPath, pref.pgUri]);

  const probe = async (engineId) => {
    setBusy((b) => ({ ...b, [engineId]: true }));
    let result;
    try {
      if (engineId === 'sqlite') {
        const path = expandHomePath(locators.sqlite);
        const h = sqlite.open(path);
        if (h && h !== 0) {
          sqlite.close(h);
          result = { ok: true, message: `Opened ${path}.` };
        } else {
          result = { ok: false, message: `sqlite.open returned ${h} for ${path}.` };
        }
      } else if (engineId === 'pg') {
        if (!pg.isAvailable || !pg.isAvailable()) {
          result = { ok: false, message: 'pg host bindings not registered in this build.' };
        } else {
          const uri = locators.pg === 'embedded' ? '' : locators.pg;
          const h = pg.connect(uri);
          if (h && h !== 0) {
            pg.close(h);
            result = { ok: true, message: uri ? `Connected to ${uri}.` : 'Connected to framework-spawned local pg.' };
          } else {
            result = { ok: false, message: `pg.connect returned ${h}.` };
          }
        }
      } else if (engineId === 'duckdb') {
        result = { ok: false, message: 'DuckDB libs are vendored under deps/duckdb but the runtime hook (runtime/hooks/duckdb.ts) is not yet exposed. Settings can store the engine choice; consumers cannot bind to it yet.' };
      }
    } catch (err) {
      result = { ok: false, message: String(err?.message || err) };
    }
    setProbes((p) => ({ ...p, [engineId]: result }));
    setBusy((b) => ({ ...b, [engineId]: false }));
  };

  const writePref = async (patch) => {
    const cur = user || { id: USER_ID, preferences: {} };
    const prefs = cur.preferences || {};
    await userStore.update(USER_ID, { ...cur, preferences: { ...prefs, db: { ...(prefs.db || {}), ...patch } } });
    reload();
  };

  const saveLocator = (engineId) => {
    if (engineId === 'sqlite') return writePref({ sqlitePath: locators.sqlite || undefined });
    if (engineId === 'duckdb') return writePref({ duckdbPath: locators.duckdb || undefined });
    if (engineId === 'pg')     return writePref({ pgUri:      locators.pg     || undefined });
  };

  return (
    <Box style={{ flexDirection: 'column', gap: 16 }}>
      <S.Card>
        <S.Caption>Database</S.Caption>
        <S.Title>Storage engines</S.Title>
        <S.Body>Three engines link into the runtime: SQLite + Postgres ship live host bindings; DuckDB has the libs vendored but no JS hook yet (a probe will say so honestly). Probe each engine to verify it's usable, then "Make active" to pin the pref consumers should read.</S.Body>

        <Box style={{ flexDirection: 'column', gap: 12, marginTop: 14 }}>
          {DB_ENGINES.map((d) => {
            const isActive = activeEngine === d.id;
            const probed = probes[d.id];
            const locatorKey = d.id === 'sqlite' ? 'sqlite' : d.id === 'duckdb' ? 'duckdb' : 'pg';
            return (
              <S.InputWell key={d.id} style={{ gap: 8 }}>
                <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                    <S.Title>{d.label}</S.Title>
                    {isActive ? <S.Chip><S.Body>active pref</S.Body></S.Chip> : null}
                    {probed?.ok ? <S.Chip><S.Body>probe ok</S.Body></S.Chip> : null}
                    {probed && !probed.ok ? <S.Chip><S.Body>probe fail</S.Body></S.Chip> : null}
                  </Box>
                  <Box style={{ flexDirection: 'row', gap: 6 }}>
                    {!isActive ? (
                      <S.ButtonOutline onPress={() => writePref({ engine: d.id })}>
                        <S.ButtonOutlineLabel>Make active</S.ButtonOutlineLabel>
                      </S.ButtonOutline>
                    ) : null}
                    <S.Button onPress={busy[d.id] ? () => {} : () => probe(d.id)}>
                      <S.ButtonLabel>{busy[d.id] ? 'Probing…' : 'Probe'}</S.ButtonLabel>
                    </S.Button>
                  </Box>
                </Box>

                <S.AppFormFieldCol>
                  <S.AppFormLabel>{d.locatorLabel}</S.AppFormLabel>
                  <S.AppFormInputMono
                    value={locators[locatorKey]}
                    onChange={inputHandler((v) => setLocators((m) => ({ ...m, [locatorKey]: v })))}
                    placeholder={d.defaultLocator}
                  />
                </S.AppFormFieldCol>

                <S.AppFormButtonRow style={{ gap: 8 }}>
                  <S.ButtonOutline onPress={() => saveLocator(d.id)}>
                    <S.ButtonOutlineLabel>Save location</S.ButtonOutlineLabel>
                  </S.ButtonOutline>
                </S.AppFormButtonRow>

                {probed ? (
                  <S.AppProbeResult>
                    {probed.ok
                      ? <S.AppProbeOk>Probe succeeded</S.AppProbeOk>
                      : <S.AppProbeFail>Probe failed</S.AppProbeFail>}
                    {probed.message ? <S.AppProbeMessage>{probed.message}</S.AppProbeMessage> : null}
                  </S.AppProbeResult>
                ) : null}
              </S.InputWell>
            );
          })}
        </Box>
      </S.Card>
    </Box>
  );
}

// ─── Privacy ──────────────────────────────────────────────────────

function PrivacySection({ privacy, privacyStore, reload }) {
  const [draft, setDraft] = useState(() => privacyDraftFrom(privacy));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(privacyDraftFrom(privacy));
  }, [privacy?.id, privacy?.updatedAt]);

  const save = async () => {
    if (!privacy) return;
    setBusy(true);
    await privacyStore.update(privacy.id, {
      ...privacy,
      proxy: {
        enabled: draft.proxyEnabled,
        url: draft.proxyEnabled ? (draft.proxyUrl.trim() || undefined) : undefined,
        authRef: draft.proxyEnabled ? (draft.proxyAuthRef.trim() || undefined) : undefined,
        caCertPath: draft.proxyEnabled ? (draft.proxyCaCert.trim() || undefined) : undefined,
      },
      tools: {
        mode: draft.toolMode,
        allowed: draft.allowed,
        denied: draft.denied,
      },
      filesystem: {
        exposedPaths: draft.exposedPaths,
        deniedPaths: draft.deniedPaths,
        readOnlyPaths: draft.readOnlyPaths.length > 0 ? draft.readOnlyPaths : undefined,
        maxFileSizeBytes: draft.maxFileSizeBytes || undefined,
      },
      updatedAt: new Date().toISOString(),
    });
    setBusy(false);
    reload();
  };

  if (!privacy) {
    return (
      <S.Card>
        <S.Caption>Privacy</S.Caption>
        <S.Title>Policy</S.Title>
        <S.Body>No privacy row yet — bootstrap will create one on first onboarding write.</S.Body>
      </S.Card>
    );
  }

  return (
    <Box style={{ flexDirection: 'column', gap: 16 }}>
      <S.Card>
        <S.Caption>Privacy · {privacy.label || 'Policy'}</S.Caption>
        <S.Title>Proxy</S.Title>
        <S.Body>Outbound HTTP routing. When enabled, every provider request goes through the proxy URL with the supplied credential reference.</S.Body>

        <Box style={{ flexDirection: 'column', gap: 12, marginTop: 12 }}>
          <S.AppFormFieldCol>
            <S.AppFormLabel>Enabled</S.AppFormLabel>
            <PillRow
              options={[true, false]}
              labels={['On', 'Off']}
              value={draft.proxyEnabled}
              onChange={(v) => setDraft((d) => ({ ...d, proxyEnabled: v }))}
            />
          </S.AppFormFieldCol>
          {draft.proxyEnabled ? (
            <>
              <S.AppFormFieldCol>
                <S.AppFormLabel>URL</S.AppFormLabel>
                <S.AppFormInputMono value={draft.proxyUrl} onChange={inputHandler((v) => setDraft((d) => ({ ...d, proxyUrl: v })))} placeholder="https://proxy.internal:8443" />
              </S.AppFormFieldCol>
              <S.AppFormFieldCol>
                <S.AppFormLabel>Auth ref</S.AppFormLabel>
                <S.AppFormInputMono value={draft.proxyAuthRef} onChange={inputHandler((v) => setDraft((d) => ({ ...d, proxyAuthRef: v })))} placeholder="env:WORK_PROXY_AUTH" />
              </S.AppFormFieldCol>
              <S.AppFormFieldCol>
                <S.AppFormLabel>CA cert path</S.AppFormLabel>
                <S.AppFormInputMono value={draft.proxyCaCert} onChange={inputHandler((v) => setDraft((d) => ({ ...d, proxyCaCert: v })))} placeholder="/etc/ssl/work-ca.pem" />
              </S.AppFormFieldCol>
            </>
          ) : null}
        </Box>
      </S.Card>

      <S.Card>
        <S.Caption>Tools</S.Caption>
        <S.Title>Allowlist / denylist</S.Title>
        <S.Body>Pick which tools the assistant may call. Mode determines whether the unlisted set defaults to "allowed" (denylist mode) or "blocked" (allowlist mode).</S.Body>

        <S.AppFormFieldCol style={{ marginTop: 12 }}>
          <S.AppFormLabel>Mode</S.AppFormLabel>
          <PillRow
            options={['allowlist', 'denylist']}
            value={draft.toolMode}
            onChange={(v) => setDraft((d) => ({ ...d, toolMode: v }))}
          />
        </S.AppFormFieldCol>

        <ChipToggleSet
          label={draft.toolMode === 'allowlist' ? 'Allowed tools' : 'Allowed tools (override denylist)'}
          options={KNOWN_TOOLS}
          value={draft.allowed}
          onChange={(next) => setDraft((d) => ({ ...d, allowed: next }))}
        />
        <ChipToggleSet
          label={draft.toolMode === 'denylist' ? 'Denied tools' : 'Denied tools (override allowlist)'}
          options={KNOWN_TOOLS}
          value={draft.denied}
          onChange={(next) => setDraft((d) => ({ ...d, denied: next }))}
        />
      </S.Card>

      <S.Card>
        <S.Caption>Filesystem</S.Caption>
        <S.Title>Exposed paths</S.Title>
        <S.Body>Roots the assistant may read/write under. Denied paths cut holes in the exposed roots; read-only paths are exposed but enforced read-only.</S.Body>

        <PathListEditor
          label="Exposed (read+write)"
          value={draft.exposedPaths}
          onChange={(next) => setDraft((d) => ({ ...d, exposedPaths: next }))}
          placeholder="/home/you/projects"
        />
        <PathListEditor
          label="Denied"
          value={draft.deniedPaths}
          onChange={(next) => setDraft((d) => ({ ...d, deniedPaths: next }))}
          placeholder="/home/you/.ssh"
        />
        <PathListEditor
          label="Read-only"
          value={draft.readOnlyPaths}
          onChange={(next) => setDraft((d) => ({ ...d, readOnlyPaths: next }))}
          placeholder="/home/you/projects/vendor"
        />

        <S.AppFormFieldCol style={{ marginTop: 12 }}>
          <S.AppFormLabel>Max file size bytes (0 = no cap)</S.AppFormLabel>
          <S.AppFormInputMono
            value={String(draft.maxFileSizeBytes || '')}
            onChange={inputHandler((v) => setDraft((d) => ({ ...d, maxFileSizeBytes: parseInt(v, 10) || 0 })))}
            placeholder="10000000"
          />
        </S.AppFormFieldCol>
      </S.Card>

      <S.Card>
        <S.AppFormButtonRow style={{ gap: 8 }}>
          <S.ButtonOutline onPress={() => setDraft(privacyDraftFrom(privacy))}>
            <S.ButtonOutlineLabel>Revert</S.ButtonOutlineLabel>
          </S.ButtonOutline>
          <S.Button onPress={busy ? () => {} : save}>
            <S.ButtonLabel>{busy ? 'Saving…' : 'Save privacy policy'}</S.ButtonLabel>
          </S.Button>
        </S.AppFormButtonRow>
      </S.Card>
    </Box>
  );
}

function privacyDraftFrom(p) {
  return {
    proxyEnabled: !!p?.proxy?.enabled,
    proxyUrl:     pickStrRaw(p?.proxy?.url),
    proxyAuthRef: pickStrRaw(p?.proxy?.authRef),
    proxyCaCert:  pickStrRaw(p?.proxy?.caCertPath),
    toolMode:     p?.tools?.mode === 'denylist' ? 'denylist' : 'allowlist',
    allowed:      Array.isArray(p?.tools?.allowed) ? [...p.tools.allowed] : [],
    denied:       Array.isArray(p?.tools?.denied)  ? [...p.tools.denied]  : [],
    exposedPaths: Array.isArray(p?.filesystem?.exposedPaths)  ? [...p.filesystem.exposedPaths]  : [],
    deniedPaths:  Array.isArray(p?.filesystem?.deniedPaths)   ? [...p.filesystem.deniedPaths]   : [],
    readOnlyPaths:Array.isArray(p?.filesystem?.readOnlyPaths) ? [...p.filesystem.readOnlyPaths] : [],
    maxFileSizeBytes: typeof p?.filesystem?.maxFileSizeBytes === 'number' ? p.filesystem.maxFileSizeBytes : 0,
  };
}

function ChipToggleSet({ label, options, value, onChange }) {
  return (
    <S.AppFormFieldCol style={{ marginTop: 12 }}>
      <S.AppFormLabel>{label}</S.AppFormLabel>
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {options.map((opt) => {
          const isOn = value.includes(opt);
          const Chip = isOn ? S.AppTraitChipActive : S.AppTraitChip;
          const Label = isOn ? S.AppTraitChipTextActive : S.AppTraitChipText;
          const toggle = () => onChange(isOn ? value.filter((x) => x !== opt) : [...value, opt]);
          return (
            <Chip key={opt} onPress={toggle}>
              <Label>{opt}</Label>
            </Chip>
          );
        })}
      </Box>
    </S.AppFormFieldCol>
  );
}

function PathListEditor({ label, value, onChange, placeholder }) {
  const [draftPath, setDraftPath] = useState('');
  return (
    <S.AppFormFieldCol style={{ marginTop: 12 }}>
      <S.AppFormLabel>{label}</S.AppFormLabel>
      <Box style={{ flexDirection: 'column', gap: 6 }}>
        {value.map((p, i) => (
          <Box key={`${p}-${i}`} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Box style={{ flexGrow: 1 }}>
              <S.AppFormInputMono
                value={p}
                onChange={inputHandler((v) => {
                  const next = [...value];
                  next[i] = v;
                  onChange(next);
                })}
              />
            </Box>
            <S.ButtonOutline onPress={() => onChange(value.filter((_, j) => j !== i))}>
              <S.ButtonOutlineLabel>Remove</S.ButtonOutlineLabel>
            </S.ButtonOutline>
          </Box>
        ))}
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ flexGrow: 1 }}>
            <S.AppFormInputMono
              value={draftPath}
              onChange={inputHandler(setDraftPath)}
              placeholder={placeholder}
            />
          </Box>
          <S.Button onPress={() => {
            const v = draftPath.trim();
            if (!v) return;
            onChange([...value, v]);
            setDraftPath('');
          }}>
            <S.ButtonLabel>Add</S.ButtonLabel>
          </S.Button>
        </Box>
      </Box>
    </S.AppFormFieldCol>
  );
}

// ─── Onboarding ───────────────────────────────────────────────────

function OnboardingSection({ user, userStore, onb, reload }) {
  const o = user?.onboarding || {};
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmTour, setConfirmTour] = useState(false);
  const totalSteps = typeof onb.totalSteps === 'number' ? onb.totalSteps : 5;

  const resetOnboarding = async () => {
    const cur = user || { id: USER_ID, preferences: {} };
    await userStore.update(USER_ID, {
      ...cur,
      onboarding: {
        status: 'pending',
        step: 0,
        startedAt: new Date().toISOString(),
        completedAt: undefined,
        skippedAt: undefined,
        tourStatus: undefined,
      },
    });
    setConfirmReset(false);
    reload();
  };

  const resetTour = async () => {
    const cur = user || { id: USER_ID, preferences: {} };
    const onbCur = cur.onboarding || {};
    await userStore.update(USER_ID, {
      ...cur,
      onboarding: { ...onbCur, tourStatus: 'pending' },
    });
    setConfirmTour(false);
    reload();
  };

  const stepIdx = typeof o.step === 'number' ? o.step : (typeof onb.step === 'number' ? onb.step : 0);

  return (
    <Box style={{ flexDirection: 'column', gap: 16 }}>
      <S.Card>
        <S.Caption>Onboarding</S.Caption>
        <S.Title>State</S.Title>
        <Box style={{ flexDirection: 'column', gap: 6, marginTop: 8 }}>
          <S.KV>
            <Box style={{ width: 140, flexShrink: 0 }}><S.Body>Status</S.Body></Box>
            <Box style={{ flexGrow: 1 }}><S.Body>{pickStr(o.status, onb.complete ? 'completed' : 'pending')}</S.Body></Box>
          </S.KV>
          <S.KV>
            <Box style={{ width: 140, flexShrink: 0 }}><S.Body>Step</S.Body></Box>
            <Box style={{ flexGrow: 1 }}><S.Body>{`${Math.min(stepIdx + 1, totalSteps)} / ${totalSteps}`}</S.Body></Box>
          </S.KV>
          <S.KV>
            <Box style={{ width: 140, flexShrink: 0 }}><S.Body>Started</S.Body></Box>
            <Box style={{ flexGrow: 1 }}><S.Body>{fmtDate(o.startedAt)}</S.Body></Box>
          </S.KV>
          <S.KV>
            <Box style={{ width: 140, flexShrink: 0 }}><S.Body>Completed</S.Body></Box>
            <Box style={{ flexGrow: 1 }}><S.Body>{fmtDate(o.completedAt)}</S.Body></Box>
          </S.KV>
          {o.skippedAt ? (
            <S.KV>
              <Box style={{ width: 140, flexShrink: 0 }}><S.Body>Skipped</S.Body></Box>
              <Box style={{ flexGrow: 1 }}><S.Body>{fmtDate(o.skippedAt)}</S.Body></Box>
            </S.KV>
          ) : null}
          <S.KV>
            <Box style={{ width: 140, flexShrink: 0 }}><S.Body>Tour</S.Body></Box>
            <Box style={{ flexGrow: 1 }}><S.Body>{pickStr(o.tourStatus, onb.tourStatus)}</S.Body></Box>
          </S.KV>
        </Box>
      </S.Card>

      <S.Card>
        <S.Caption>Reset</S.Caption>
        <S.Title>Restart onboarding</S.Title>
        <S.Body>Sets <S.Body>status=pending, step=0</S.Body> and clears the completed/skipped/tour timestamps. The next visit to <S.Body>/</S.Body> will land on Step 0. Your saved Profile / Preferences / Connections are NOT touched.</S.Body>
        <S.AppFormButtonRow style={{ marginTop: 12, gap: 8 }}>
          {confirmReset ? (
            <>
              <S.ButtonOutline onPress={() => setConfirmReset(false)}>
                <S.ButtonOutlineLabel>Cancel</S.ButtonOutlineLabel>
              </S.ButtonOutline>
              <S.Button onPress={resetOnboarding}>
                <S.ButtonLabel>Confirm restart</S.ButtonLabel>
              </S.Button>
            </>
          ) : (
            <S.ButtonOutline onPress={() => setConfirmReset(true)}>
              <S.ButtonOutlineLabel>Restart onboarding</S.ButtonOutlineLabel>
            </S.ButtonOutline>
          )}
        </S.AppFormButtonRow>
      </S.Card>

      <S.Card>
        <S.Caption>Reset</S.Caption>
        <S.Title>Re-arm tour</S.Title>
        <S.Body>Re-shows the post-onboarding tour banner by setting <S.Body>tourStatus=pending</S.Body>. Useful after major UI changes.</S.Body>
        <S.AppFormButtonRow style={{ marginTop: 12, gap: 8 }}>
          {confirmTour ? (
            <>
              <S.ButtonOutline onPress={() => setConfirmTour(false)}>
                <S.ButtonOutlineLabel>Cancel</S.ButtonOutlineLabel>
              </S.ButtonOutline>
              <S.Button onPress={resetTour}>
                <S.ButtonLabel>Confirm re-arm</S.ButtonLabel>
              </S.Button>
            </>
          ) : (
            <S.ButtonOutline onPress={() => setConfirmTour(true)}>
              <S.ButtonOutlineLabel>Re-arm tour</S.ButtonOutlineLabel>
            </S.ButtonOutline>
          )}
        </S.AppFormButtonRow>
      </S.Card>
    </Box>
  );
}

// ─── Local atoms (tiny helpers, only what isn't in the gallery) ───

function Field({ label, children }) {
  return (
    <S.AppFormFieldCol>
      <S.AppFormLabel>{label}</S.AppFormLabel>
      {children}
    </S.AppFormFieldCol>
  );
}

function Input({ value, onChange, placeholder, mono }) {
  const Inp = mono ? S.AppFormInputMono : S.AppFormInput;
  return <Inp value={value} onChange={inputHandler(onChange)} placeholder={placeholder || ''} />;
}

function PillRow({ options, labels, value, onChange }) {
  return (
    <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((opt, i) => {
        const isOn = opt === value;
        const Pill = isOn ? S.NavPillActive : S.NavPill;
        const text = labels?.[i] ?? String(opt);
        return (
          <Pill key={String(opt)} onPress={() => onChange(opt)}>
            <S.Body>{text}</S.Body>
          </Pill>
        );
      })}
    </Box>
  );
}

// TextInput's onChange has historically arrived as either a string or a
// {text} object across the framework's renderer paths — guard both.
function inputHandler(setter) {
  return (...args) => {
    const first = args[0];
    if (typeof first === 'string') return setter(first);
    if (first && typeof first === 'object' && typeof first.text === 'string') return setter(first.text);
  };
}

// ─── Helpers ──────────────────────────────────────────────────────

const EM_DASH = '—';

function pickStr(...candidates) {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c;
  }
  return EM_DASH;
}

function pickStrRaw(...candidates) {
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return '';
}

function fmtDate(iso) {
  if (typeof iso !== 'string' || iso.length === 0) return EM_DASH;
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]} UTC` : iso;
}

function fmtBytes(n) {
  if (typeof n !== 'number') return EM_DASH;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} GB`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)} KB`;
  return `${n} B`;
}

function fmtCredential(ref) {
  if (!ref) return EM_DASH;
  if (ref.source === 'none') return 'none';
  return `${ref.source}: ${pickStr(ref.locator)}`;
}

function expandHomePath(p) {
  if (typeof p !== 'string') return p;
  if (p.startsWith('~/')) return `${process?.env?.HOME || ''}${p.slice(1)}`;
  return p;
}

function providerIdForKind(kind) {
  if (kind === 'claude-code-cli' || kind === 'anthropic-api-key') return 'anthropic';
  if (kind === 'openai-api-key') return 'openai';
  if (kind === 'openai-api-like') return 'openai-compatible';
  if (kind === 'kimi-api-key') return 'moonshot';
  if (kind === 'local-runtime') return 'local';
  return 'unknown';
}

function labelForKind(kind) {
  switch (kind) {
    case 'claude-code-cli':   return 'Claude Code (subscription)';
    case 'anthropic-api-key': return 'Anthropic API key';
    case 'openai-api-key':    return 'OpenAI API key';
    case 'openai-api-like':   return 'OpenAI-compatible (custom endpoint)';
    case 'kimi-api-key':      return 'Kimi API key';
    case 'local-runtime':     return 'Local runtime';
    default:                  return kind;
  }
}

function defaultSourceForKind(kind) {
  if (kind === 'claude-code-cli') return 'cli-session';
  if (kind === 'local-runtime')   return 'none';
  return 'env';
}

function defaultLocatorFor(kind) {
  if (kind === 'claude-code-cli') return '~/.claude/';
  if (kind === 'anthropic-api-key') return 'ANTHROPIC_API_KEY';
  if (kind === 'openai-api-key')    return 'OPENAI_API_KEY';
  if (kind === 'openai-api-like')   return 'OPENAI_API_KEY';
  if (kind === 'kimi-api-key')      return 'KIMI_API_KEY';
  return '';
}

function defaultEndpointFor(kind) {
  if (kind === 'anthropic-api-key') return 'https://api.anthropic.com/v1';
  if (kind === 'openai-api-key')    return 'https://api.openai.com/v1';
  if (kind === 'openai-api-like')   return 'http://localhost:11434/v1';
  if (kind === 'kimi-api-key')      return 'https://api.moonshot.cn/v1';
  return '';
}

function defaultContextFor(kind) {
  if (kind === 'claude-code-cli' || kind === 'anthropic-api-key') return 200000;
  if (kind === 'openai-api-key' || kind === 'openai-api-like') return 128000;
  if (kind === 'kimi-api-key') return 200000;
  return 32000;
}

function placeholderForLocator(source) {
  switch (source) {
    case 'env':         return 'ANTHROPIC_API_KEY';
    case 'keychain':    return 'app.anthropic.api_key';
    case 'cli-session': return '~/.claude/';
    case 'file':        return '~/.config/app/openai.key';
    case 'none':        return '(unused)';
    default:            return '';
  }
}

function locatorHint(source) {
  switch (source) {
    case 'env':         return 'Env var name. The secret stays in your shell, not in the app DB.';
    case 'keychain':    return 'Keychain item identifier. Resolved at request time via the OS keychain.';
    case 'cli-session': return 'CLI auth directory (subscription session). The CLI manages the credential.';
    case 'file':        return 'Absolute path to a key file. Read at request time.';
    case 'none':        return 'No credential needed.';
    default:            return '';
  }
}

function defaultCapabilitiesFor(kind) {
  const base = { streaming: true, tools: true, thinking: true, vision: true, promptCache: true, batch: false };
  if (kind === 'kimi-api-key')        return { ...base, vision: false, promptCache: false };
  if (kind === 'anthropic-api-key')   return { ...base, batch: true };
  if (kind === 'openai-api-key')      return { ...base, batch: true };
  if (kind === 'openai-api-like')     return { ...base, batch: false, promptCache: false };
  if (kind === 'local-runtime')       return { streaming: true, tools: false, thinking: false, vision: false, promptCache: false, batch: false };
  return base;
}

function needsEndpoint(kind) {
  return kind === 'anthropic-api-key' || kind === 'openai-api-key' || kind === 'openai-api-like' || kind === 'kimi-api-key';
}

function requiresKey(kind) {
  return kind === 'anthropic-api-key' || kind === 'openai-api-key' || kind === 'openai-api-like' || kind === 'kimi-api-key';
}
