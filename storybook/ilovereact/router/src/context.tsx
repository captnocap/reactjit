import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { HistoryAdapter, Location, RouterState, NavigateOptions } from './types';
import { matchRoute } from './matcher';

// ── Router context ──────────────────────────────────────

const RouterContext = createContext<RouterState | null>(null);

// Tracks which route pattern matched, for useParams
const RouteParamsContext = createContext<Record<string, string>>({});

// Tracks the matched route's children for <Outlet>
const OutletContext = createContext<ReactNode | null>(null);

export { RouteParamsContext, OutletContext };

// ── RouterProvider ──────────────────────────────────────

export function RouterProvider({
  history,
  children,
}: {
  history: HistoryAdapter;
  children: ReactNode;
}) {
  const [location, setLocation] = useState<Location>(history.location);
  const historyRef = useRef(history);
  historyRef.current = history;

  useEffect(() => {
    return history.subscribe((loc) => {
      setLocation({ ...loc });
    });
  }, [history]);

  const navigate = useCallback((to: string, options?: NavigateOptions) => {
    if (options?.replace) {
      historyRef.current.replace(to);
    } else {
      historyRef.current.push(to);
    }
  }, []);

  const back = useCallback(() => {
    historyRef.current.back();
  }, []);

  const forward = useCallback(() => {
    historyRef.current.forward();
  }, []);

  const state: RouterState = {
    location,
    params: {},
    navigate,
    back,
    forward,
  };

  return React.createElement(RouterContext.Provider, { value: state }, children);
}

// ── Hooks ───────────────────────────────────────────────

export function useRouter(): RouterState {
  const router = useContext(RouterContext);
  if (!router) {
    throw new Error('useRouter must be used within a <RouterProvider>');
  }
  return router;
}

export function useNavigate(): (to: string, options?: NavigateOptions) => void {
  return useRouter().navigate;
}

export function useLocation(): Location {
  return useRouter().location;
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return useContext(RouteParamsContext) as T;
}

/**
 * Match the current location against a route pattern.
 * Returns [matched: boolean, params: Record<string, string>].
 */
export function useRoute(pattern: string): [boolean, Record<string, string>] {
  const { location } = useRouter();
  const result = matchRoute(pattern, location.pathname);
  return [result.matched, result.params];
}
