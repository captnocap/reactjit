const React: any = require('react');
const { useEffect, useState } = React;

import { Box, Col, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { BrowserToolbar } from './BrowserToolbar';
import { BrowserView } from './BrowserView';
import { TabBar } from './TabBar';
import {
  addBrowserTab,
  createBrowserTab,
  firstTabId,
  getBrowserTab,
  removeBrowserTab,
  setTabLoading,
  setTabTitle,
  setTabUrl,
  titleFromUrl,
} from '../../lib/browser/tabs';
import {
  BrowserHistoryState,
  canGoBack,
  canGoForward,
  createBrowserHistory,
  currentBrowserUrl,
  goBack as historyGoBack,
  goForward as historyGoForward,
  pushBrowserUrl,
} from '../../lib/browser/history';
import { httpGet, isHttpFetchAvailable, normalizeBrowserUrl, titleFromResponse, type BrowserPageState } from '../../lib/browser/navigation';

type PageMap = Record<string, BrowserPageState | null>;
type HistoryMap = Record<string, BrowserHistoryState>;

function loadingPage(url: string): BrowserPageState {
  return { loading: true, ok: false, url, finalUrl: url, status: 0, contentType: '', body: '', error: null };
}

export function BrowserPanel() {
  const [tabs, setTabs] = useState(() => [createBrowserTab()]);
  const [activeTabId, setActiveTabId] = useState('');
  const [histories, setHistories] = useState<HistoryMap>({});
  const [pages, setPages] = useState<PageMap>({});
  const httpAvailable = isHttpFetchAvailable();

  useEffect(() => {
    if (!activeTabId && tabs[0]) setActiveTabId(tabs[0].id);
  }, [tabs, activeTabId]);

  useEffect(() => {
    if (activeTabId && tabs.some((tab) => tab.id === activeTabId)) return;
    if (tabs[0]) setActiveTabId(tabs[0].id);
  }, [tabs, activeTabId]);

  const activeTab = getBrowserTab(tabs, activeTabId) || tabs[0] || null;
  const activeHistory = activeTab ? histories[activeTab.id] || createBrowserHistory(activeTab.url) : createBrowserHistory();
  const activePage = activeTab ? pages[activeTab.id] || null : null;

  const syncUrl = (value: string) => {
    if (!activeTab) return;
    setTabs((prev) => setTabUrl(prev, activeTab.id, value));
  };

  const loadUrl = async (url: string, historyMode: 'push' | 'replace' | 'none' = 'push') => {
    if (!activeTab) return;
    const next = normalizeBrowserUrl(url || activeTab.url);
    if (!next) {
      setPages((prev) => ({ ...prev, [activeTab.id]: null }));
      setTabs((prev) => setTabLoading(setTabUrl(prev, activeTab.id, ''), activeTab.id, false));
      return;
    }
    setTabs((prev) => setTabLoading(setTabUrl(prev, activeTab.id, next), activeTab.id, true));
    setPages((prev) => ({ ...prev, [activeTab.id]: loadingPage(next) }));
    const result = await httpGet(next);
    const nextTitle = titleFromResponse(result.finalUrl || next, result.body) || titleFromUrl(result.finalUrl || next);
    setTabs((prev) => setTabLoading(setTabTitle(setTabUrl(prev, activeTab.id, result.finalUrl || next), activeTab.id, nextTitle), activeTab.id, false));
    setPages((prev) => ({ ...prev, [activeTab.id]: { ...result, loading: false } }));
    if (historyMode !== 'none') {
      setHistories((prev) => {
        const current = prev[activeTab.id] || createBrowserHistory();
        const nextHistory = historyMode === 'replace'
          ? { stack: [result.finalUrl || next], index: 0 }
          : pushBrowserUrl(current, result.finalUrl || next);
        return { ...prev, [activeTab.id]: nextHistory };
      });
    }
  };

  const openNewTab = () => {
    const tab = createBrowserTab();
    setTabs((prev) => addBrowserTab(prev, tab));
    setActiveTabId(tab.id);
    setHistories((prev) => ({ ...prev, [tab.id]: createBrowserHistory() }));
    setPages((prev) => ({ ...prev, [tab.id]: null }));
  };

  const closeTab = (id: string) => {
    setTabs((prev) => {
      const remaining = removeBrowserTab(prev, id);
      if (remaining.length === 0) {
        const tab = createBrowserTab();
        setActiveTabId(tab.id);
        setHistories((next) => ({ ...next, [tab.id]: createBrowserHistory() }));
        setPages((next) => ({ ...next, [tab.id]: null }));
        return [tab];
      }
      if (activeTabId === id) setActiveTabId(remaining[0].id);
      return remaining;
    });
    setHistories((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPages((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const moveHistory = async (dir: 'back' | 'forward') => {
    if (!activeTab) return;
    const nextHistory = dir === 'back' ? historyGoBack(activeHistory) : historyGoForward(activeHistory);
    const url = currentBrowserUrl(nextHistory);
    setHistories((prev) => ({ ...prev, [activeTab.id]: nextHistory }));
    if (url) await loadUrl(url, 'none');
  };

  const reload = async () => {
    if (!activeTab) return;
    await loadUrl(activeTab.url, 'push');
  };

  const canBack = activeTab ? canGoBack(activeHistory) : false;
  const canForward = activeTab ? canGoForward(activeHistory) : false;

  return (
    <Col style={{ width: '100%', height: '100%', minHeight: 0, backgroundColor: COLORS.panelBg }}>
      <Box style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
        <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Browser</Text>
      </Box>
      <BrowserToolbar
        url={activeTab?.url || ''}
        loading={!!activePage?.loading}
        canBack={canBack}
        canForward={canForward}
        onUrlChange={syncUrl}
        onGo={() => { void loadUrl(activeTab?.url || '', 'push'); }}
        onBack={() => { void moveHistory('back'); }}
        onForward={() => { void moveHistory('forward'); }}
        onReload={() => { void reload(); }}
        onNewTab={openNewTab}
      />
      <TabBar
        tabs={tabs}
        activeTabId={activeTab?.id || firstTabId(tabs)}
        onSelect={setActiveTabId}
        onClose={closeTab}
      />
      <BrowserView tab={activeTab} page={activePage} httpAvailable={httpAvailable} />
    </Col>
  );
}

export default BrowserPanel;
