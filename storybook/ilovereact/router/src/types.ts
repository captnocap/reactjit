import type { ReactNode } from 'react';

// ── History ─────────────────────────────────────────────

export interface Location {
  pathname: string;
  search: string;
  hash: string;
}

export interface HistoryAdapter {
  readonly location: Location;
  push(path: string): void;
  replace(path: string): void;
  back(): void;
  forward(): void;
  subscribe(listener: (location: Location) => void): () => void;
}

export interface MemoryHistoryOptions {
  initialEntries?: string[];
  initialIndex?: number;
}

// ── Route matching ──────────────────────────────────────

export interface RouteMatch {
  matched: boolean;
  params: Record<string, string>;
  path: string;
}

export interface RouteDefinition {
  path: string;
  element: ReactNode;
  children?: RouteDefinition[];
}

// ── Router state ────────────────────────────────────────

export interface RouterState {
  location: Location;
  params: Record<string, string>;
  navigate: (to: string, options?: NavigateOptions) => void;
  back: () => void;
  forward: () => void;
}

export interface NavigateOptions {
  replace?: boolean;
}

// ── Component props ─────────────────────────────────────

export interface RouterProviderProps {
  history: HistoryAdapter;
  children: ReactNode;
}

export interface RouteProps {
  path: string;
  element: ReactNode;
}

export interface LinkProps {
  to: string;
  replace?: boolean;
  children: ReactNode;
  style?: any;
}
