import type { Location, HistoryAdapter, MemoryHistoryOptions } from './types';

// ── Parse a path string into a Location ─────────────────

export function parsePath(path: string): Location {
  const hashIdx = path.indexOf('#');
  let hash = '';
  if (hashIdx >= 0) {
    hash = path.slice(hashIdx);
    path = path.slice(0, hashIdx);
  }

  const searchIdx = path.indexOf('?');
  let search = '';
  if (searchIdx >= 0) {
    search = path.slice(searchIdx);
    path = path.slice(0, searchIdx);
  }

  return { pathname: path || '/', search, hash };
}

export function locationToString(loc: Location): string {
  return loc.pathname + loc.search + loc.hash;
}

// ── Memory history (Love2D, terminal, testing) ──────────

export function createMemoryHistory(options?: MemoryHistoryOptions): HistoryAdapter {
  const entries = (options?.initialEntries ?? ['/']).map(parsePath);
  let index = options?.initialIndex ?? entries.length - 1;
  const listeners = new Set<(location: Location) => void>();

  function notify() {
    const loc = entries[index];
    for (const fn of listeners) fn(loc);
  }

  return {
    get location() {
      return entries[index];
    },

    push(path: string) {
      // Truncate forward entries
      entries.splice(index + 1);
      entries.push(parsePath(path));
      index = entries.length - 1;
      notify();
    },

    replace(path: string) {
      entries[index] = parsePath(path);
      notify();
    },

    back() {
      if (index > 0) {
        index--;
        notify();
      }
    },

    forward() {
      if (index < entries.length - 1) {
        index++;
        notify();
      }
    },

    subscribe(listener: (location: Location) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

// ── Browser history (web) ───────────────────────────────

export function createBrowserHistory(): HistoryAdapter {
  const listeners = new Set<(location: Location) => void>();

  function getLocation(): Location {
    return {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    };
  }

  function notify() {
    const loc = getLocation();
    for (const fn of listeners) fn(loc);
  }

  // Listen to browser back/forward
  window.addEventListener('popstate', notify);

  return {
    get location() {
      return getLocation();
    },

    push(path: string) {
      window.history.pushState(null, '', path);
      notify();
    },

    replace(path: string) {
      window.history.replaceState(null, '', path);
      notify();
    },

    back() {
      window.history.back();
      // popstate fires asynchronously, notify will happen via event listener
    },

    forward() {
      window.history.forward();
    },

    subscribe(listener: (location: Location) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
