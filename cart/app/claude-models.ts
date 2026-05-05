// Claude model family + effort helpers. Shared by:
//
//   - cart/app/onboarding/Step2.jsx (ClaudeForm — initial setup)
//   - cart/app/settings/page.jsx    (ConnectionEditor — re-probe & re-pick)
//
// Two reasons it's not just `apply the inference-parameter catalog`:
//
//  1. Effort tiers vary per *model id*, not per kind. Latest Opus
//     exposes `xhigh` and `max`; older Opus has `max` but no `xhigh`;
//     Sonnet only goes up to `high`; Haiku has no effort tiers at all.
//     The catalog can't express that without a per-model row, and even
//     then it'd have to be regenerated as new models ship.
//
//  2. The Anthropic /v1/models response doesn't publish an `effort`
//     capability. We derive levels from the model id (which encodes the
//     family + version), not from a server-declared field.
//
// `applicableKinds` for the underlying API surface is correctly
// `['anthropic-api-key', 'claude-code-cli']` — both routes hit the same
// API, so the effort surface is identical between them.

export type ModelLike = { id: string; created_at?: string };

export const FAMILY_ORDER = ['opus', 'sonnet', 'haiku'] as const;
export const FAMILY_LABEL: Record<string, string> = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' };

export type ClaudeFamily = (typeof FAMILY_ORDER)[number];

export function familyOf(model: ModelLike | string | null | undefined): ClaudeFamily | null {
  const id = typeof model === 'string' ? model : (model && typeof model.id === 'string' ? model.id : '');
  if (!id) return null;
  for (const f of FAMILY_ORDER) {
    if (id.includes(f)) return f as ClaudeFamily;
  }
  return null;
}

// Strip `claude-<family>-` prefix and any trailing date suffix to get a
// human-readable version like "4.7" or "4.5".
export function versionLabel(model: ModelLike | string, family: ClaudeFamily | null): string {
  if (!model || !family) return '?';
  const id = typeof model === 'string' ? model : model.id;
  const trimmed = id.replace(`claude-${family}-`, '');
  const parts = trimmed.split('-');
  const ver: string[] = [];
  for (const p of parts) {
    if (/^\d{8}$/.test(p)) break;
    if (/^\d{1,2}$/.test(p)) ver.push(p);
    else break;
  }
  return ver.length ? ver.join('.') : trimmed;
}

// Parse `claude-opus-4-7` → [4, 7], `claude-opus-4-5-20251101` → [4, 5],
// `claude-opus-4-20250514` → [4, 0]. Returns null if no leading version
// can be extracted.
export function parseVersion(modelId: string, family: ClaudeFamily | null): [number, number] | null {
  if (!modelId || !family) return null;
  const trimmed = String(modelId).replace(`claude-${family}-`, '');
  const parts = trimmed.split('-');
  const ver: number[] = [];
  for (const p of parts) {
    if (/^\d{8}$/.test(p)) break;
    if (/^\d{1,2}$/.test(p)) ver.push(parseInt(p, 10));
    else break;
  }
  if (!ver.length) return null;
  while (ver.length < 2) ver.push(0);
  return [ver[0], ver[1]];
}

// Numeric "minor distance" between two parsed versions. Same major →
// diff of minors. Different major → Infinity (treat as too old).
export function minorDistance(latest: [number, number] | null, candidate: [number, number] | null): number {
  if (!latest || !candidate) return Infinity;
  if (latest[0] !== candidate[0]) return Infinity;
  return latest[1] - candidate[1];
}

// Returns models in this family newest-first, filtered by:
//   1. Out-of-tree allowlist (`statusById`) — `verified` rescues a
//      heuristic-dropped model; `rerouted` / `error` kills one the
//      heuristic kept.
//   2. Heuristic — drop anything more than 2 minor revs older than
//      the newest. Anthropic silently reroutes deprecated ids.
export function versionsForFamily<T extends ModelLike>(
  family: ClaudeFamily,
  models: T[],
  statusById?: Record<string, string> | null,
): T[] {
  const all = models
    .filter((m) => familyOf(m) === family)
    .sort((a, b) => {
      const ta = a.created_at || '';
      const tb = b.created_at || '';
      return tb.localeCompare(ta);
    });
  if (!all.length) return all;
  const latestVer = parseVersion(all[0].id, family);
  if (!latestVer) return all;
  return all.filter((m) => {
    const status = statusById ? statusById[m.id] : undefined;
    if (status === 'rerouted' || status === 'error') return false;
    if (status === 'verified') return true;
    const v = parseVersion(m.id, family);
    return minorDistance(latestVer, v) <= 2;
  });
}

// 1M-context support — true when the model can take the `[1m]` bracket
// suffix. Family-level rule; opus + sonnet only.
export function supports1M(model: ModelLike | string | null): boolean {
  const fam = familyOf(model);
  return fam === 'opus' || fam === 'sonnet';
}

// Effort levels per model. `opusLatestId` is the id of the newest Opus
// in the response — only that one gets `xhigh`. Empty result means no
// effort picker should render (Haiku).
export function effortLevelsFor(
  model: ModelLike | string | null,
  opusLatestId: string | null,
): string[] {
  const id = typeof model === 'string' ? model : (model && typeof model.id === 'string' ? model.id : '');
  if (!id) return [];
  const fam = familyOf(id);
  if (fam === 'haiku') return [];
  if (fam === 'sonnet') return ['low', 'medium', 'high'];
  if (fam === 'opus') {
    return id === opusLatestId
      ? ['low', 'medium', 'high', 'xhigh', 'max']
      : ['low', 'medium', 'high', 'max'];
  }
  return [];
}

// Pick the latest Opus id from a list of model objects (or just ids).
// Mirrors Step2's `versionsForFamily('opus', ...)[0]?.id`.
export function latestOpusId(
  models: Array<ModelLike | string>,
  statusById?: Record<string, string> | null,
): string | null {
  const objs: ModelLike[] = models.map((m) => (typeof m === 'string' ? { id: m } : m));
  const opusOnly = versionsForFamily('opus', objs, statusById);
  return opusOnly[0]?.id || null;
}
