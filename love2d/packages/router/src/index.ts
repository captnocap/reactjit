// ── History adapters ─────────────────────────────────────
export { createMemoryHistory, createBrowserHistory, parsePath, locationToString } from './history';

// ── Route matching ──────────────────────────────────────
export { matchRoute, scorePattern, findBestMatch } from './matcher';

// ── Router context + hooks ──────────────────────────────
export { RouterProvider, useRouter, useNavigate, useLocation, useParams, useRoute } from './context';

// ── Components ──────────────────────────────────────────
export { Route, Routes, Link, Outlet, Navigate } from './components';

// ── Types ───────────────────────────────────────────────
export type {
  Location,
  HistoryAdapter,
  MemoryHistoryOptions,
  RouteMatch,
  RouteDefinition,
  RouterState,
  NavigateOptions,
  RouterProviderProps,
  RouteProps,
  LinkProps,
} from './types';
