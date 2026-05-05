// effect_tracker — wraps React.useEffect / useLayoutEffect so we can see
// which components are paying for them.
//
// Why: love2d banned useEffect entirely (`useLuaEffect`/`useMount`/etc.
// instead) because a single effect with an interval inside is enough to
// saturate the JS thread. ReactJIT inherited none of that hygiene; the
// gallery's atom grid has 74 effects across 30+ components and that's
// why the 'all' view crawls. Without per-component effect timing we
// keep guessing whether the cost is layout/paint or JS.
//
// The chart_stress benchmark (cart/chart_stress.tsx) confirmed it cold:
// 21fps with React/setInterval-in-useEffect vs 53fps with the latch
// driver that bypasses React entirely. Effects are the bottleneck.
//
// What this records, per component owner + hook kind:
//   - totalMs    — cumulative wall time spent inside the effect body
//   - runCount   — number of times the effect re-ran (mount + dep-flips)
//   - cleanupMs  — cumulative wall time inside cleanup callbacks
//   - depFlips   — { depIdx: count } of which dep index actually changed
//                  between calls (the smoking gun for unstable refs that
//                  retrigger expensive effects)
//
// Read it via globalThis.__getTopEffects(limit) — sorted desc by totalMs.
// Reset with globalThis.__resetEffectStats(). Both are designed for an
// overlay panel that polls every ~500ms.

type HookKind = 'effect' | 'layoutEffect';

type EffectStat = {
  owner: string;
  hookKind: HookKind;
  totalMs: number;
  runCount: number;
  cleanupMs: number;
  cleanupCount: number;
  depFlips: Record<number, number>;
  lastDeps: any[] | undefined;
  // Whether we've seen at least one call (used to suppress dep-flip
  // accounting on the very first call where there's no prior deps).
  seen: boolean;
};

const STATS = new Map<string, EffectStat>();

function statKey(owner: string, hookKind: HookKind): string {
  return owner + '::' + hookKind;
}

function getStat(owner: string, hookKind: HookKind): EffectStat {
  const key = statKey(owner, hookKind);
  let stat = STATS.get(key);
  if (!stat) {
    stat = {
      owner,
      hookKind,
      totalMs: 0,
      runCount: 0,
      cleanupMs: 0,
      cleanupCount: 0,
      depFlips: {},
      lastDeps: undefined,
      seen: false,
    };
    STATS.set(key, stat);
  }
  return stat;
}

// React 18+ exposes the current owner under one of these internal
// symbols depending on build (development / production / shared). Walk
// the candidates rather than hardcode one.
function getOwnerName(React: any): string {
  try {
    const internals =
      React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED ||
      React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    if (!internals) return '<no-internals>';

    // React 18 dev: ReactCurrentOwner.current
    const ownerLegacy = internals.ReactCurrentOwner?.current;
    if (ownerLegacy?.type) {
      const t = ownerLegacy.type;
      return t.displayName || t.name || '<anon>';
    }

    // React 19 alphas: A.getOwner() or H.getOwner()
    if (typeof internals.A?.getOwner === 'function') {
      const o = internals.A.getOwner();
      if (o?.type) return o.type.displayName || o.type.name || '<anon>';
    }
  } catch {}
  return '<unknown>';
}

function diffDeps(prev: any[] | undefined, next: any[] | undefined): number[] {
  if (!prev || !next) return [];
  if (prev.length !== next.length) return [-1];
  const flips: number[] = [];
  for (let i = 0; i < next.length; i += 1) {
    if (!Object.is(prev[i], next[i])) flips.push(i);
  }
  return flips;
}

function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function installEffectTracker(React: any): void {
  if ((React as any).__effectTrackerInstalled) return;
  (React as any).__effectTrackerInstalled = true;

  // ── GLOBAL HOOKS (define FIRST so the overlay panel can read them
  //    even if the patching below errors out) ─────────────────────────
  (globalThis as any).__getTopEffects = function getTopEffects(limit: number): any[] {
    const cap = typeof limit === 'number' && limit > 0 ? limit : 20;
    const arr = Array.from(STATS.values());
    arr.sort((a, b) => b.totalMs - a.totalMs);
    return arr.slice(0, cap).map((s) => ({
      owner: s.owner,
      hookKind: s.hookKind,
      totalMs: Number(s.totalMs.toFixed(3)),
      avgMs: s.runCount > 0 ? Number((s.totalMs / s.runCount).toFixed(3)) : 0,
      runCount: s.runCount,
      cleanupMs: Number(s.cleanupMs.toFixed(3)),
      cleanupCount: s.cleanupCount,
      depFlips: { ...s.depFlips },
    }));
  };

  (globalThis as any).__getTopEffectsByRunCount = function getTopByRuns(limit: number): any[] {
    const cap = typeof limit === 'number' && limit > 0 ? limit : 20;
    const arr = Array.from(STATS.values());
    arr.sort((a, b) => b.runCount - a.runCount);
    return arr.slice(0, cap).map((s) => ({
      owner: s.owner,
      hookKind: s.hookKind,
      runCount: s.runCount,
      totalMs: Number(s.totalMs.toFixed(3)),
      depFlips: { ...s.depFlips },
    }));
  };

  (globalThis as any).__resetEffectStats = function resetEffectStats(): void {
    STATS.clear();
  };

  (globalThis as any).__effectStatsSummary = function summary(): {
    componentCount: number;
    totalRuns: number;
    totalMs: number;
  } {
    let totalRuns = 0;
    let totalMs = 0;
    for (const s of STATS.values()) {
      totalRuns += s.runCount;
      totalMs += s.totalMs;
    }
    return {
      componentCount: STATS.size,
      totalRuns,
      totalMs: Number(totalMs.toFixed(3)),
    };
  };

  if (typeof console !== 'undefined') {
    console.log('[effect_tracker] globals installed');
  }

  function wrap(origHook: Function, kind: HookKind): Function {
    return function patched(this: any, create: any, deps?: any[]): any {
      const owner = getOwnerName(React);
      const stat = getStat(owner, kind);

      // Dep-flip accounting (skip first call — there's nothing to diff).
      if (stat.seen) {
        const flips = diffDeps(stat.lastDeps, deps);
        for (const idx of flips) {
          stat.depFlips[idx] = (stat.depFlips[idx] || 0) + 1;
        }
      }
      stat.seen = true;
      stat.lastDeps = deps ? deps.slice() : deps;

      // Wrap the effect body so we time it on the eventual flush.
      function wrappedCreate(this: any, ...args: any[]): any {
        const t0 = now();
        const cleanup = create.apply(this, args);
        stat.totalMs += now() - t0;
        stat.runCount += 1;

        if (typeof cleanup === 'function') {
          const orig = cleanup;
          return function wrappedCleanup(this: any, ...cargs: any[]): any {
            const c0 = now();
            const r = orig.apply(this, cargs);
            stat.cleanupMs += now() - c0;
            stat.cleanupCount += 1;
            return r;
          };
        }
        return cleanup;
      }

      // Important: call origHook with the dispatcher as `this`. React's
      // dispatcher methods are real bound functions in some builds and
      // expect the dispatcher as receiver in others — covering both.
      return origHook.call(this, wrappedCreate, deps);
    };
  }

  // ── DISPATCHER PATCHING ────────────────────────────────────────────
  // useEffect calls all bottom out at:
  //   React.useEffect → resolveDispatcher().useEffect → dispatcher.useEffect
  // The dispatcher is held at internals.ReactCurrentDispatcher.current
  // and React swaps it on every render (mount/update/server variants).
  // We intercept the `current` setter and wrap each new dispatcher's
  // useEffect/useLayoutEffect in place. This catches calls regardless of
  // how cart code imports useEffect.
  //
  // Wrapped in a single try so a failure can't kill the rest of the
  // module (globals are already defined above).
  try {
    const internals =
      React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED ||
      React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

    if (typeof console !== 'undefined') {
      console.log('[effect_tracker] internals', !!internals,
        'ReactCurrentDispatcher', !!(internals && internals.ReactCurrentDispatcher));
    }

    if (internals) {
      const seen: WeakSet<object> = new WeakSet();
      const patchDispatcherInPlace = (d: any): any => {
        if (!d || typeof d !== 'object') return d;
        if (seen.has(d)) return d;
        seen.add(d);
        if (typeof d.useEffect === 'function') {
          d.useEffect = wrap(d.useEffect, 'effect');
        }
        if (typeof d.useLayoutEffect === 'function') {
          d.useLayoutEffect = wrap(d.useLayoutEffect, 'layoutEffect');
        }
        if (typeof console !== 'undefined') {
          console.log('[effect_tracker] dispatcher patched');
        }
        return d;
      };

      // Patch the currently-mounted dispatcher (if any).
      patchDispatcherInPlace(internals.ReactCurrentDispatcher?.current);

      // Intercept future swaps via a getter/setter pair on `current`.
      const slot = internals.ReactCurrentDispatcher;
      if (slot) {
        let stored = slot.current;
        Object.defineProperty(slot, 'current', {
          configurable: true,
          get() {
            return stored;
          },
          set(d) {
            stored = patchDispatcherInPlace(d);
          },
        });
        if (typeof console !== 'undefined') {
          console.log('[effect_tracker] dispatcher.current setter installed');
        }
      }
    }

    // Belt-and-suspenders: also patch the public exports for namespace-
    // import call sites.
    const origEffect = React.useEffect;
    const origLayoutEffect = React.useLayoutEffect;
    if (typeof origEffect === 'function') React.useEffect = wrap(origEffect, 'effect');
    if (typeof origLayoutEffect === 'function') React.useLayoutEffect = wrap(origLayoutEffect, 'layoutEffect');
  } catch (e) {
    if (typeof console !== 'undefined') {
      console.error('[effect_tracker] patching failed', e);
    }
  }
}

// CRITICAL: install at module init, NOT from runtime/index.tsx body.
//
// ESM imports hoist to the top, so when runtime/index.tsx does
// `import App from '@cart-entry'`, every cart module that
// `import { useEffect } from 'react'` does its destructure at that
// moment, capturing whatever React.useEffect is RIGHT THEN. If we
// wait until runtime/index.tsx body runs to patch, the cart bundle
// has already captured the original useEffect — and our patched
// version on React.useEffect never gets called.
//
// By patching here, at this module's init, we run during the import
// graph traversal — and effect_tracker is imported from runtime/index.tsx
// BEFORE @cart-entry, so React gets patched first.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React: any = require('react');
  installEffectTracker(React);
} catch (e) {
  // Don't let a tracker failure brick the runtime.
  if (typeof console !== 'undefined') {
    console.error('[effect_tracker] init failed', e);
  }
}
