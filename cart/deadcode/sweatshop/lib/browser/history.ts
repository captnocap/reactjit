export type BrowserHistoryState = {
  stack: string[];
  index: number;
};

export function createBrowserHistory(url = ''): BrowserHistoryState {
  return { stack: url ? [url] : [], index: url ? 0 : -1 };
}

export function currentBrowserUrl(history: BrowserHistoryState): string {
  if (history.index < 0) return '';
  return history.stack[history.index] || '';
}

export function canGoBack(history: BrowserHistoryState): boolean {
  return history.index > 0;
}

export function canGoForward(history: BrowserHistoryState): boolean {
  return history.index >= 0 && history.index < history.stack.length - 1;
}

export function pushBrowserUrl(history: BrowserHistoryState, url: string): BrowserHistoryState {
  const next = String(url || '').trim();
  if (!next) return history;
  const stack = history.stack.slice(0, history.index + 1);
  if (stack[stack.length - 1] !== next) stack.push(next);
  return { stack, index: stack.length - 1 };
}

export function replaceBrowserUrl(history: BrowserHistoryState, url: string): BrowserHistoryState {
  const next = String(url || '').trim();
  if (!next) return { stack: [], index: -1 };
  if (history.index < 0) return createBrowserHistory(next);
  const stack = history.stack.slice();
  stack[history.index] = next;
  return { stack, index: history.index };
}

export function goBack(history: BrowserHistoryState): BrowserHistoryState {
  if (!canGoBack(history)) return history;
  return { stack: history.stack.slice(), index: history.index - 1 };
}

export function goForward(history: BrowserHistoryState): BrowserHistoryState {
  if (!canGoForward(history)) return history;
  return { stack: history.stack.slice(), index: history.index + 1 };
}
