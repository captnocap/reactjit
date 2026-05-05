// gallery/local-router — drop-in shim for @reactjit/runtime/router that
// keeps all routing state inside React (not the host URL).
//
// Why: the runtime router shares one global URL across all <Router>
// instances. Mounting the gallery as a sub-route of cart/app meant the
// gallery's internal navigations (e.g. push('/atoms')) overwrote the
// outer URL and unmounted the gallery itself. This shim namespaces
// gallery navigation in a local React state tree so the outer URL stays
// pinned at /gallery while the gallery's own router decides what to
// render inside that view.
//
// API surface mirrors @reactjit/runtime/router exactly so gallery JSX
// (`<Route path="/stories/:id">`, `useRoute()`, `useNavigate()`) works
// unchanged — only the import line in cart/app/gallery/index.tsx swaps.

import * as React from 'react';
import { matchRoute } from '@reactjit/runtime/router';

type RouteParams = Record<string, string>;

interface LocalRouterCtx {
  path: string;
  params: RouteParams;
  hotKey: string;
  push: (p: string) => void;
  replace: (p: string) => void;
  back: () => void;
  forward: () => void;
}

const DEFAULT_HOT_KEY = 'local';

const Ctx = React.createContext<LocalRouterCtx>({
  path: '/',
  params: {},
  hotKey: DEFAULT_HOT_KEY,
  push: () => {},
  replace: () => {},
  back: () => {},
  forward: () => {},
});

export function Router({
  initialPath = '/',
  hotKey = DEFAULT_HOT_KEY,
  children,
}: {
  initialPath?: string;
  hotKey?: string;
  children?: any;
}): any {
  const [stack, setStack] = React.useState<string[]>([initialPath || '/']);
  const [cursor, setCursor] = React.useState(0);

  const push = React.useCallback((p: string) => {
    setStack((s) => {
      // Truncate any forward history when pushing a new path.
      const truncated = s.slice(0, cursor + 1);
      return [...truncated, p];
    });
    setCursor((c) => c + 1);
  }, [cursor]);

  const replace = React.useCallback((p: string) => {
    setStack((s) => {
      const next = s.slice();
      next[cursor] = p;
      return next;
    });
  }, [cursor]);

  const back = React.useCallback(() => {
    setCursor((c) => Math.max(0, c - 1));
  }, []);

  const forward = React.useCallback(() => {
    setCursor((c) => Math.min(stack.length - 1, c + 1));
  }, [stack.length]);

  const path = stack[cursor] || '/';
  const value: LocalRouterCtx = { path, params: {}, hotKey, push, replace, back, forward };

  return React.createElement(Ctx.Provider, { value }, children);
}

export function Route({
  path,
  fallback,
  children,
}: {
  path?: string;
  fallback?: boolean;
  children?: any;
}): any {
  const ctx = React.useContext(Ctx);
  if (fallback) {
    const matched = (ctx as any).__matched;
    if (matched) return null;
    return typeof children === 'function' ? children({}) : children;
  }
  if (!path) return null;
  const m = matchRoute(path, ctx.path);
  if (!m.matched) return null;
  (ctx as any).__matched = true;
  if (typeof children === 'function') return children(m.params);
  if (React.isValidElement(children)) {
    return React.cloneElement(children, { params: m.params });
  }
  return children;
}

export function useRoute(): { path: string; params: RouteParams; hotKey: string } {
  const ctx = React.useContext(Ctx);
  return { path: ctx.path, params: ctx.params, hotKey: ctx.hotKey };
}

export function useNavigate(): {
  push: (path: string) => void;
  replace: (path: string) => void;
  back: () => void;
  forward: () => void;
} {
  const ctx = React.useContext(Ctx);
  return { push: ctx.push, replace: ctx.replace, back: ctx.back, forward: ctx.forward };
}
