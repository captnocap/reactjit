export type BrowserTabState = {
  id: string;
  url: string;
  title: string;
  loading: boolean;
};

let seq = 0;

export function createBrowserTab(url = '', title = ''): BrowserTabState {
  const nextUrl = String(url || '').trim();
  return {
    id: `browser-tab-${++seq}`,
    url: nextUrl,
    title: title || titleFromUrl(nextUrl),
    loading: false,
  };
}

export function titleFromUrl(url: string): string {
  const next = String(url || '').trim();
  if (!next) return 'New tab';
  try {
    const parsed = new URL(next);
    return parsed.hostname || next;
  } catch {
    return next.length > 32 ? next.slice(0, 29) + '…' : next;
  }
}

export function setTabLoading(tabs: BrowserTabState[], id: string, loading: boolean): BrowserTabState[] {
  return tabs.map((tab) => (tab.id === id ? { ...tab, loading } : tab));
}

export function setTabUrl(tabs: BrowserTabState[], id: string, url: string): BrowserTabState[] {
  const nextUrl = String(url || '').trim();
  return tabs.map((tab) => (tab.id === id ? { ...tab, url: nextUrl, title: nextUrl ? titleFromUrl(nextUrl) : 'New tab' } : tab));
}

export function setTabTitle(tabs: BrowserTabState[], id: string, title: string): BrowserTabState[] {
  const nextTitle = String(title || '').trim();
  return tabs.map((tab) => (tab.id === id ? { ...tab, title: nextTitle || titleFromUrl(tab.url) } : tab));
}

export function addBrowserTab(tabs: BrowserTabState[], tab?: BrowserTabState): BrowserTabState[] {
  return tabs.concat(tab || createBrowserTab());
}

export function removeBrowserTab(tabs: BrowserTabState[], id: string): BrowserTabState[] {
  return tabs.filter((tab) => tab.id !== id);
}

export function getBrowserTab(tabs: BrowserTabState[], id: string): BrowserTabState | null {
  return tabs.find((tab) => tab.id === id) || null;
}

export function firstTabId(tabs: BrowserTabState[]): string {
  return tabs[0]?.id || '';
}
