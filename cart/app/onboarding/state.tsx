import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useCRUD } from '../db';
import { callHost } from '@reactjit/runtime/ffi';
import { traitsToAccommodations, accommodationsToTraits } from './traits';
import { fetchModelsFor, upsertRows } from '../settings/lib/fetch';

export const TOTAL_STEPS = 5;

// ── Dev seed ──────────────────────────────────────────────────────────
//
// Set true to seed a fully-completed user record on first boot, skipping
// onboarding entirely. Useful while iterating on the homepage. Defaults
// false so the real first-boot flow runs end-to-end.
const SEED_COMPLETED_USER = false;

// ── Storage keys ──────────────────────────────────────────────────────

const NS = 'app';
const USER_ID = 'user_local';
const SETTINGS_ID = 'settings_default';
const PRIVACY_ID = 'privacy_default';
const WORKSPACE_ID = 'ws_local';
const DEFAULT_USER_EMAIL = 'local@app';

// useCRUD's Schema<T> contract calls .parse(value) and uses its return.
// The data files in cart/component-gallery/data/* are JSON Schemas, not
// runtime parsers — we use identity passthrough here and lean on the
// writer side to keep the shape correct. Future work can lift these
// into ajv-backed parsers if drift becomes a problem.
const passthrough = { parse: (v) => v };

function nowIso() {
  return new Date().toISOString();
}

function safeCwd() {
  try { return callHost('__cwd', '/'); } catch { return '/'; }
}

// UI's three-way provider pick ↔ ConnectionKind.
function uiKindFromConnectionKind(connectionKind) {
  switch (connectionKind) {
    case 'claude-code-cli': return 'claude';
    case 'local-runtime':   return 'local';
    case 'anthropic-api-key':
    case 'openai-api-key':
    case 'kimi-api-key':    return 'api';
    default:                return null;
  }
}

function connectionKindForApiPick(endpoint) {
  const e = (endpoint || '').toLowerCase();
  if (e.includes('anthropic')) return 'anthropic-api-key';
  if (e.includes('moonshot') || e.includes('kimi')) return 'kimi-api-key';
  return 'openai-api-key';
}

function envVarForKind(kind) {
  switch (kind) {
    case 'anthropic-api-key': return 'ANTHROPIC_API_KEY';
    case 'openai-api-key':    return 'OPENAI_API_KEY';
    case 'kimi-api-key':      return 'KIMI_API_KEY';
    default:                  return null;
  }
}

function providerIdForKind(kind) {
  switch (kind) {
    case 'claude-code-cli':
    case 'anthropic-api-key': return 'anthropic';
    case 'openai-api-key':    return 'openai';
    case 'kimi-api-key':      return 'moonshot';
    case 'local-runtime':     return 'local';
    default:                  return 'local';
  }
}

function defaultCapabilities() {
  return {
    streaming: true, tools: false, thinking: false, vision: false,
    promptCache: false, batch: false,
  };
}

function defaultPrivacyRow() {
  return {
    id: PRIVACY_ID,
    settingsId: SETTINGS_ID,
    label: 'Default',
    proxy: { enabled: false },
    tools: {
      mode: 'allowlist',
      allowed: ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write', 'WebFetch', 'WebSearch'],
      denied: [],
    },
    filesystem: {
      exposedPaths: [],
      deniedPaths: ['~/.ssh', '~/.aws', '~/.gnupg'],
      maxFileSizeBytes: 10_000_000,
    },
    telemetry: {
      outboundLogging: true,
      secretRedaction: true,
      providerTelemetryOptOut: true,
      localOnly: false,
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function defaultSettingsRow() {
  return {
    id: SETTINGS_ID,
    userId: USER_ID,
    label: 'Default',
    privacyId: PRIVACY_ID,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function defaultWorkspaceRow() {
  return {
    id: WORKSPACE_ID,
    userId: USER_ID,
    label: 'Local',
    kind: 'sandbox',
    rootPath: safeCwd(),
    status: 'active',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function defaultUserRow() {
  return {
    id: USER_ID,
    email: DEFAULT_USER_EMAIL,
    activeSettingsId: SETTINGS_ID,
    createdAt: nowIso(),
    preferences: {
      responseDefault: 'concise',
      elaborateOnAsk: true,
      emojiOk: false,
      accommodations: [],
    },
    onboarding: {
      status: 'pending',
      step: 0,
      startedAt: nowIso(),
    },
  };
}

// Seed for SEED_COMPLETED_USER=true. Fully-onboarded record so the dev
// boots straight into the homepage without re-walking the flow.
function seededCompletedUserRow() {
  return {
    ...defaultUserRow(),
    displayName: 'dev',
    bio: 'Seeded by SEED_COMPLETED_USER. Edit at cart/app/onboarding/state.jsx.',
    configPath: '~/.app/config',
    preferences: {
      responseDefault: 'concise',
      elaborateOnAsk: true,
      emojiOk: false,
      accommodations: traitsToAccommodations(['detail', 'big_picture']),
    },
    onboarding: {
      status: 'completed',
      step: TOTAL_STEPS - 1,
      startedAt: nowIso(),
      completedAt: nowIso(),
      tourStatus: 'declined',
    },
  };
}

const Ctx = createContext({
  step: 0,
  totalSteps: TOTAL_STEPS,
  complete: false,
  loading: true,
  setStep: async () => {},
  markComplete: async () => {},
  markSkipped: async () => {},
  shouldPlayFirstStartAnimation: false,
  markFirstStartAnimationPlayed: () => {},
  homeEntryPlayed: false,
  markHomeEntryPlayed: () => {},
  tourStatus: null,
  acceptTour: async () => {},
  declineTour: async () => {},
  name: '',
  setName: async () => {},
  providerKind: null,
  setProviderKind: () => {},
  commitConnection: async () => {},
  traits: [],
  setTraits: async () => {},
  configPath: '',
  setConfigPath: async () => {},
  goal: '',
  setGoal: async () => {},
});

export function OnboardingProvider({ children }) {
  // ── Persistent stores ───────────────────────────────────────────────
  // One useCRUD per collection touched. Single namespace `app` so a
  // dev wipe (rm of the localstore file) clears everything cleanly.
  const userStore       = useCRUD('user',       passthrough, { namespace: NS });
  const settingsStore   = useCRUD('settings',   passthrough, { namespace: NS });
  const privacyStore    = useCRUD('privacy',    passthrough, { namespace: NS });
  const connectionStore = useCRUD('connection', passthrough, { namespace: NS });
  const goalStore       = useCRUD('goal',       passthrough, { namespace: NS });
  const workspaceStore  = useCRUD('workspace',  passthrough, { namespace: NS });
  const modelStore      = useCRUD('model',      passthrough, { namespace: NS });

  // ── In-memory optimistic cache ──────────────────────────────────────
  // Same shape state.jsx had pre-lock-in. Step components keep their
  // sync read patterns; the source of truth is whichever is freshest
  // (cache or disk on hydrate) — writes mirror to the relevant store.
  const [loading, setLoading] = useState(true);
  const [step, setStepState] = useState(0);
  const [complete, setComplete] = useState(false);
  const [name, setNameState] = useState('');
  const [providerKind, setProviderKindState] = useState(null);
  const [traits, setTraitsState] = useState([]);
  const [configPath, setConfigPathState] = useState('');
  const [goalText, setGoalState] = useState('');
  const [tourStatus, setTourStatusState] = useState(null);
  const [animationPlayedThisSession, setAnimationPlayedThisSession] = useState(false);
  const [homeEntryPlayed, setHomeEntryPlayed] = useState(false);

  // ── Bootstrap ───────────────────────────────────────────────────────
  // One pass on mount: read user_local, hydrate all in-memory slots from
  // it, follow the activeSettingsId → defaultConnectionId chain to
  // recover providerKind, fetch the latest user-origin Goal for goal
  // text. SEED_COMPLETED_USER short-circuits to the seed and skips the
  // rest of the flow.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let user = await userStore.get(USER_ID);
        if (!user && SEED_COMPLETED_USER) {
          await ensureSupportRecords();
          user = seededCompletedUserRow();
          await userStore.create(user);
        }
        if (cancelled) return;

        if (!user) {
          // Fresh boot. Defaults stand; first setter call seeds the
          // record. Just flip loading off so the UI can render.
          setLoading(false);
          return;
        }

        // Returning user — the first-start "Hello" animation has been
        // seen at least once, so suppress it on this and future boots.
        // We use the existence of the User row as the proxy for
        // `firstStartAnimationSeen` rather than a separate persisted
        // flag — it's the same signal at lower cost.
        setAnimationPlayedThisSession(true);

        if (typeof user.displayName === 'string') setNameState(user.displayName);
        if (typeof user.configPath === 'string') setConfigPathState(user.configPath);
        const accs = user.preferences?.accommodations;
        if (Array.isArray(accs)) setTraitsState(accommodationsToTraits(accs));

        const onb = user.onboarding || {};
        const stepIdx = Number.isInteger(onb.step) ? Math.max(0, Math.min(TOTAL_STEPS - 1, onb.step)) : 0;
        setStepState(stepIdx);
        const isTerminal = onb.status === 'completed' || onb.status === 'skipped';
        setComplete(isTerminal);
        if (typeof onb.tourStatus === 'string') setTourStatusState(onb.tourStatus);
        // Carryover animation should only fire right after Step5's exit
        // transition, not on every reload of an already-completed user.
        // When `complete` is hydrated from disk (vs flipped this session),
        // pretend the home entry has already played so IndexPage skips
        // <HomeEntry /> and goes straight to <HomeStatic />.
        if (isTerminal) setHomeEntryPlayed(true);

        // Recover providerKind via Settings → Connection.
        if (user.activeSettingsId) {
          try {
            const settings = await settingsStore.get(user.activeSettingsId);
            if (!cancelled && settings && settings.defaultConnectionId) {
              const conn = await connectionStore.get(settings.defaultConnectionId);
              if (!cancelled && conn) {
                const ui = uiKindFromConnectionKind(conn.kind);
                if (ui) setProviderKindState(ui);
              }
            }
          } catch {}
        }

        // Recover the goal text from the most recent user-origin Goal.
        try {
          const goals = await goalStore.list({
            where: { workspaceId: WORKSPACE_ID, originActor: 'user' },
            orderBy: 'createdAt',
            order: 'desc',
            limit: 1,
          });
          if (!cancelled && goals && goals[0] && typeof goals[0].statement === 'string') {
            setGoalState(goals[0].statement);
          }
        } catch {}
      } catch (e) {
        console.log('[onboarding] bootstrap failed: ' + (e && e.message ? e.message : String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────

  const ensureSupportRecords = async () => {
    // Idempotent seed of the workspace + privacy + settings rows. Goal
    // and Connection are user-data and don't have defaults — they get
    // created on demand by setGoal / commitConnection.
    const [ws, pr, st] = await Promise.all([
      workspaceStore.get(WORKSPACE_ID),
      privacyStore.get(PRIVACY_ID),
      settingsStore.get(SETTINGS_ID),
    ]);
    const tasks = [];
    if (!ws) tasks.push(workspaceStore.create(defaultWorkspaceRow()));
    if (!pr) tasks.push(privacyStore.create(defaultPrivacyRow()));
    if (!st) tasks.push(settingsStore.create(defaultSettingsRow()));
    if (tasks.length) await Promise.all(tasks);
  };

  const ensureUser = async () => {
    const existing = await userStore.get(USER_ID);
    if (existing) return existing;
    await ensureSupportRecords();
    const row = defaultUserRow();
    await userStore.create(row);
    return row;
  };

  const patchUser = async (partial) => {
    try {
      const cur = await ensureUser();
      await userStore.update(USER_ID, { ...cur, ...partial });
    } catch (e) {
      console.log('[onboarding] user patch failed: ' + (e && e.message ? e.message : String(e)));
    }
  };

  const patchUserOnboarding = async (partial) => {
    try {
      const cur = await ensureUser();
      const nextOnb = { ...(cur.onboarding || {}), ...partial };
      await userStore.update(USER_ID, { ...cur, onboarding: nextOnb });
    } catch (e) {
      console.log('[onboarding] onboarding patch failed: ' + (e && e.message ? e.message : String(e)));
    }
  };

  // ── Setters (sync optimistic cache + async write-through) ──────────

  const setStep = async (next) => {
    const clamped = Math.max(0, Math.min(TOTAL_STEPS - 1, next));
    setStepState((prev) => {
      if (clamped > prev) setAnimationPlayedThisSession(true);
      return clamped;
    });
    await patchUserOnboarding({ step: clamped });
  };

  const setName = async (next) => {
    const v = typeof next === 'string' ? next : '';
    setNameState(v);
    await patchUser({ displayName: v });
  };

  const setProviderKind = (kind) => {
    // In-memory only. The Connection row write happens at Step2's exit
    // (commitConnection). Holding back persistence here lets the user
    // try / un-try / retry tiles without churning Connection rows.
    setProviderKindState(kind);
  };

  const setTraits = async (next) => {
    const arr = Array.isArray(next) ? next : [];
    setTraitsState(arr);
    try {
      const cur = await ensureUser();
      const prefs = cur.preferences || {};
      const accommodations = traitsToAccommodations(arr);
      await userStore.update(USER_ID, { ...cur, preferences: { ...prefs, accommodations } });
    } catch (e) {
      console.log('[onboarding] setTraits write failed: ' + (e && e.message ? e.message : String(e)));
    }
  };

  const setConfigPath = async (next) => {
    const v = typeof next === 'string' ? next : '';
    setConfigPathState(v);
    await patchUser({ configPath: v });
  };

  const setGoal = async (next) => {
    const v = typeof next === 'string' ? next : '';
    setGoalState(v);
    if (v.trim().length === 0) return; // "I don't know" path — no row.
    try {
      await ensureUser();
      // One Goal row per onboarding completion. If a user-origin goal
      // already exists for this workspace, update its statement;
      // otherwise create. Keep the row minimal — Plan / Phase / Task
      // rows reference Goal.id, so dropping it would orphan downstream
      // records on an edit.
      const existing = await goalStore.list({
        where: { workspaceId: WORKSPACE_ID, originActor: 'user' },
        orderBy: 'createdAt',
        order: 'desc',
        limit: 1,
      });
      if (existing && existing[0]) {
        await goalStore.update(existing[0].id, {
          ...existing[0],
          statement: v,
          userTurnText: v,
          updatedAt: nowIso(),
        });
      } else {
        const ts = nowIso();
        await goalStore.create({
          id: 'goal_' + Math.random().toString(36).slice(2, 10),
          workspaceId: WORKSPACE_ID,
          originActor: 'user',
          userTurnText: v,
          statement: v,
          scopeDuration: 'long-term',
          status: 'open',
          createdAt: ts,
          updatedAt: ts,
        });
      }
    } catch (e) {
      console.log('[onboarding] setGoal write failed: ' + (e && e.message ? e.message : String(e)));
    }
  };

  // commitConnection — Step2 calls this from each form's lockedIn
  // useEffect. Writes the Connection row + patches Settings to point at
  // it as the default. Payload: { kind: 'api'|'claude'|'local',
  // endpoint?, apiKey?, model?, home? }.
  const commitConnection = async (payload) => {
    if (!payload || typeof payload !== 'object') return;
    try {
      await ensureUser();
      const uiKind = payload.kind;
      let connKind;
      let credentialRef;
      let label;
      if (uiKind === 'claude') {
        connKind = 'claude-code-cli';
        const home = typeof payload.home === 'string' ? payload.home.trim() : '';
        credentialRef = { source: 'cli-session', locator: home || '~/.claude/' };
        label = 'Claude Code (subscription)';
      } else if (uiKind === 'local') {
        connKind = 'local-runtime';
        const path = typeof payload.path === 'string' ? payload.path.trim() : '';
        credentialRef = path
          ? { source: 'file', locator: path }
          : { source: 'none' };
        label = 'Local runtime';
      } else {
        connKind = connectionKindForApiPick(payload.endpoint || '');
        const envVar = envVarForKind(connKind);
        credentialRef = envVar
          ? { source: 'env', locator: envVar }
          : { source: 'none' };
        label = connKind === 'anthropic-api-key' ? 'Anthropic Console (API key)'
              : connKind === 'kimi-api-key'      ? 'Kimi (API key)'
              : 'OpenAI (API key)';
      }

      const ts = nowIso();
      // Reuse the existing default Connection if its kind matches —
      // re-running commit shouldn't litter Connection rows.
      const settings = await settingsStore.get(SETTINGS_ID);
      const existingId = settings?.defaultConnectionId;
      let connId = existingId;
      if (existingId) {
        const existing = await connectionStore.get(existingId);
        if (!existing || existing.kind !== connKind) {
          // Wrong kind on file — delete the stale row and create a new one.
          if (existing) {
            try { await connectionStore.delete(existingId); } catch {}
          }
          connId = null;
        }
      }
      if (!connId) {
        connId = 'conn_' + Math.random().toString(36).slice(2, 10);
        await connectionStore.create({
          id: connId,
          settingsId: SETTINGS_ID,
          providerId: providerIdForKind(connKind),
          kind: connKind,
          label,
          credentialRef,
          capabilities: defaultCapabilities(),
          status: 'active',
          createdAt: ts,
          lastUsedAt: ts,
        });
      } else {
        await connectionStore.update(connId, {
          id: connId,
          settingsId: SETTINGS_ID,
          providerId: providerIdForKind(connKind),
          kind: connKind,
          label,
          credentialRef,
          capabilities: defaultCapabilities(),
          status: 'active',
          createdAt: ts,
          lastUsedAt: ts,
        });
      }

      const settingsRow = settings || defaultSettingsRow();
      const nextEffort = typeof payload.effort === 'string' && payload.effort
        ? payload.effort
        : settingsRow.defaultEffort;
      await settingsStore.update(SETTINGS_ID, {
        ...settingsRow,
        defaultConnectionId: connId,
        defaultModelId: typeof payload.model === 'string' && payload.model
          ? payload.model
          : settingsRow.defaultModelId,
        defaultEffort: nextEffort,
        updatedAt: ts,
      });

      // Populate the model catalog so Settings → Models isn't empty.
      // Same probe path the Settings UI uses; keeps onboarding's
      // "I picked a model" mental model consistent with what the user
      // sees post-onboarding. Failures are non-fatal — the user can
      // always re-fetch from Settings.
      try {
        const conn = await connectionStore.get(connId);
        if (conn) {
          const result = await fetchModelsFor(conn);
          if (result.ok && result.rows.length > 0) {
            await upsertRows(modelStore, result.rows);
          }
        }
      } catch (e) {
        console.log('[onboarding] model catalog fetch failed: ' + (e && e.message ? e.message : String(e)));
      }
    } catch (e) {
      console.log('[onboarding] commitConnection failed: ' + (e && e.message ? e.message : String(e)));
    }
  };

  // ── Terminal-state markers ──────────────────────────────────────────

  const markComplete = async () => {
    setComplete(true);
    setTourStatusState((prev) => prev == null ? 'pending' : prev);
    const ts = nowIso();
    try {
      const cur = await ensureUser();
      const onb = cur.onboarding || {};
      const tour = typeof onb.tourStatus === 'string' ? onb.tourStatus : 'pending';
      await userStore.update(USER_ID, {
        ...cur,
        onboarding: {
          ...onb,
          status: 'completed',
          completedAt: onb.completedAt || ts,
          tourStatus: tour,
        },
      });
    } catch (e) {
      console.log('[onboarding] markComplete write failed: ' + (e && e.message ? e.message : String(e)));
    }
  };

  const markSkipped = async () => {
    setComplete(true);
    setTourStatusState(null); // skipped users don't get a tour offer
    const ts = nowIso();
    try {
      const cur = await ensureUser();
      const onb = cur.onboarding || {};
      await userStore.update(USER_ID, {
        ...cur,
        onboarding: {
          ...onb,
          status: 'skipped',
          skippedAt: onb.skippedAt || ts,
        },
      });
    } catch (e) {
      console.log('[onboarding] markSkipped write failed: ' + (e && e.message ? e.message : String(e)));
    }
  };

  const acceptTour = async () => {
    setTourStatusState('accepted');
    await patchUserOnboarding({ tourStatus: 'accepted' });
  };

  const declineTour = async () => {
    setTourStatusState('declined');
    await patchUserOnboarding({ tourStatus: 'declined' });
  };

  // ── Session-only flags ──────────────────────────────────────────────

  const markFirstStartAnimationPlayed = () => {
    setAnimationPlayedThisSession(true);
  };

  const markHomeEntryPlayed = () => {
    setHomeEntryPlayed(true);
  };

  const value = {
    step,
    totalSteps: TOTAL_STEPS,
    complete,
    loading,
    setStep,
    markComplete,
    markSkipped,
    shouldPlayFirstStartAnimation: !complete && step === 0 && !animationPlayedThisSession,
    markFirstStartAnimationPlayed,
    homeEntryPlayed,
    markHomeEntryPlayed,
    tourStatus,
    acceptTour,
    declineTour,
    name,
    setName,
    providerKind,
    setProviderKind,
    commitConnection,
    traits,
    setTraits,
    configPath,
    setConfigPath,
    goal: goalText,
    setGoal,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnboarding() {
  return useContext(Ctx);
}
