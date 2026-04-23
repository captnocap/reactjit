import { useCallback, useEffect, useMemo, useState } from 'react';
import { baseName, stripDotSlash } from '../../theme';

const host: any = globalThis as any;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : (_: string) => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : (_: string, __: string) => {};

const STORE_KEY = 'sweatshop.terminal.tabs';

export type TerminalLabelFormat = 'basename' | 'full' | 'custom';

export type TerminalTabRecord = {
  id: string;
  cwd: string;
  customLabel: string;
  dirty: boolean;
  unreadCount: number;
  createdAt: number;
  lastActiveAt: number;
};

export type TerminalTabsSettings = {
  maxTabs: number;
  labelFormat: TerminalLabelFormat;
  closeOnExit: boolean;
};

export type TerminalTabsState = {
  tabs: TerminalTabRecord[];
  activeIndex: number;
  settings: TerminalTabsSettings;
};

const DEFAULT_SETTINGS: TerminalTabsSettings = {
  maxTabs: 8,
  labelFormat: 'basename',
  closeOnExit: true,
};

function uid(prefix: string): string {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function normalizeTab(tab: any): TerminalTabRecord | null {
  if (!tab || typeof tab !== 'object') return null;
  const cwd = typeof tab.cwd === 'string' && tab.cwd ? tab.cwd : '.';
  return {
    id: typeof tab.id === 'string' && tab.id ? tab.id : uid('term'),
    cwd,
    customLabel: typeof tab.customLabel === 'string' ? tab.customLabel : '',
    dirty: !!tab.dirty,
    unreadCount: typeof tab.unreadCount === 'number' ? tab.unreadCount : 0,
    createdAt: typeof tab.createdAt === 'number' ? tab.createdAt : Date.now(),
    lastActiveAt: typeof tab.lastActiveAt === 'number' ? tab.lastActiveAt : Date.now(),
  };
}

function loadState(initialCwd: string): TerminalTabsState {
  let settings = { ...DEFAULT_SETTINGS };
  try {
    const raw = storeGet(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      settings = {
        maxTabs: typeof parsed?.settings?.maxTabs === 'number' ? parsed.settings.maxTabs : DEFAULT_SETTINGS.maxTabs,
        labelFormat: parsed?.settings?.labelFormat === 'full' || parsed?.settings?.labelFormat === 'custom' ? parsed.settings.labelFormat : DEFAULT_SETTINGS.labelFormat,
        closeOnExit: parsed?.settings?.closeOnExit === false ? false : DEFAULT_SETTINGS.closeOnExit,
      };
    }
  } catch {}
  return {
    tabs: [normalizeTab({ cwd: initialCwd })!],
    activeIndex: 0,
    settings,
  };
}

function saveState(state: TerminalTabsState): void {
  try {
    storeSet(STORE_KEY, JSON.stringify({
      tabs: state.tabs,
      activeIndex: state.activeIndex,
      settings: state.settings,
    }));
  } catch {}
}

function labelFor(tab: TerminalTabRecord, format: TerminalLabelFormat): string {
  if (format === 'custom' && tab.customLabel.trim()) return tab.customLabel.trim();
  if (format === 'full') return stripDotSlash(tab.cwd || '.');
  return baseName(tab.cwd || '.') || 'shell';
}

export function useTerminalTabs(initialCwd: string) {
  const [state, setState] = useState<TerminalTabsState>(() => loadState(initialCwd));

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!initialCwd || initialCwd === '.') return;
    setState((prev) => {
      const active = prev.tabs[Math.max(0, Math.min(prev.activeIndex, prev.tabs.length - 1))];
      if (active && active.cwd === initialCwd) return prev;
      const nextTab = normalizeTab({ cwd: initialCwd })!;
      nextTab.createdAt = Date.now();
      nextTab.lastActiveAt = Date.now();
      return {
        ...prev,
        tabs: [nextTab],
        activeIndex: 0,
      };
    });
  }, [initialCwd]);

  const tabs = state.tabs;
  const activeIndex = Math.max(0, Math.min(state.activeIndex, tabs.length - 1));

  const setTabsState = useCallback((next: Partial<TerminalTabsState> | ((prev: TerminalTabsState) => TerminalTabsState)) => {
    setState((prev) => {
      const value = typeof next === 'function' ? (next as any)(prev) : { ...prev, ...next };
      const tabsNext = value.tabs.length > 0 ? value.tabs : [normalizeTab({ cwd: initialCwd })!];
      const activeNext = Math.max(0, Math.min(value.activeIndex, tabsNext.length - 1));
      return { ...value, tabs: tabsNext, activeIndex: activeNext };
    });
  }, [initialCwd]);

  const createTab = useCallback((cwd?: string) => {
    setTabsState((prev) => {
      if (prev.tabs.length >= prev.settings.maxTabs) return prev;
      const nextTab = normalizeTab({ cwd: cwd || prev.tabs[prev.activeIndex]?.cwd || initialCwd });
      if (!nextTab) return prev;
      nextTab.createdAt = Date.now();
      nextTab.lastActiveAt = Date.now();
      return {
        ...prev,
        tabs: [...prev.tabs, nextTab],
        activeIndex: prev.tabs.length,
      };
    });
  }, [initialCwd, setTabsState]);

  const closeTab = useCallback((tabId: string) => {
    setTabsState((prev) => {
      if (prev.tabs.length <= 1) {
        const only = normalizeTab({ cwd: prev.tabs[0]?.cwd || initialCwd })!;
        return { ...prev, tabs: [only], activeIndex: 0 };
      }
      const index = prev.tabs.findIndex((tab) => tab.id === tabId);
      if (index < 0) return prev;
      const tabsNext = prev.tabs.filter((tab) => tab.id !== tabId);
      const activeIndexNext = index < prev.activeIndex ? prev.activeIndex - 1 : index === prev.activeIndex ? Math.min(index, tabsNext.length - 1) : prev.activeIndex;
      return { ...prev, tabs: tabsNext, activeIndex: activeIndexNext };
    });
  }, [initialCwd, setTabsState]);

  const duplicateTab = useCallback((tabId: string) => {
    setTabsState((prev) => {
      if (prev.tabs.length >= prev.settings.maxTabs) return prev;
      const tab = prev.tabs.find((item) => item.id === tabId);
      if (!tab) return prev;
      const nextTab = normalizeTab({
        cwd: tab.cwd,
        customLabel: tab.customLabel ? tab.customLabel + ' copy' : '',
      })!;
      nextTab.lastActiveAt = Date.now();
      return {
        ...prev,
        tabs: [...prev.tabs, nextTab],
        activeIndex: prev.tabs.length,
      };
    });
  }, [setTabsState]);

  const renameTab = useCallback((tabId: string, customLabel: string) => {
    setTabsState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((tab) => tab.id === tabId ? { ...tab, customLabel } : tab),
    }));
  }, [setTabsState]);

  const updateTab = useCallback((tabId: string, patch: Partial<TerminalTabRecord>) => {
    setTabsState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((tab) => tab.id === tabId ? { ...tab, ...patch } : tab),
    }));
  }, [setTabsState]);

  const setActive = useCallback((index: number) => {
    setTabsState((prev) => {
      if (prev.tabs.length === 0) return prev;
      const next = Math.max(0, Math.min(index, prev.tabs.length - 1));
      const tab = prev.tabs[next];
      return {
        ...prev,
        activeIndex: next,
        tabs: prev.tabs.map((item) => item.id === tab.id ? { ...item, dirty: false, unreadCount: 0, lastActiveAt: Date.now() } : item),
      };
    });
  }, [setTabsState]);

  const cycleTab = useCallback(() => {
    setTabsState((prev) => {
      if (prev.tabs.length <= 1) return prev;
      const next = (prev.activeIndex + 1) % prev.tabs.length;
      const tab = prev.tabs[next];
      return {
        ...prev,
        activeIndex: next,
        tabs: prev.tabs.map((item) => item.id === tab.id ? { ...item, dirty: false, unreadCount: 0, lastActiveAt: Date.now() } : item),
      };
    });
  }, [setTabsState]);

  const moveTab = useCallback((fromId: string, toId: string) => {
    setTabsState((prev) => {
      const from = prev.tabs.findIndex((tab) => tab.id === fromId);
      const to = prev.tabs.findIndex((tab) => tab.id === toId);
      if (from < 0 || to < 0 || from === to) return prev;
      const nextTabs = prev.tabs.slice();
      const [tab] = nextTabs.splice(from, 1);
      nextTabs.splice(to, 0, tab);
      const activeIndex = prev.activeIndex === from ? to : prev.activeIndex === to ? from : prev.activeIndex;
      return { ...prev, tabs: nextTabs, activeIndex };
    });
  }, [setTabsState]);

  const setLabelFormat = useCallback((labelFormat: TerminalLabelFormat) => {
    setTabsState((prev) => ({ ...prev, settings: { ...prev.settings, labelFormat } }));
  }, [setTabsState]);

  const setMaxTabs = useCallback((maxTabs: number) => {
    setTabsState((prev) => ({ ...prev, settings: { ...prev.settings, maxTabs: Math.max(1, Math.floor(maxTabs)) } }));
  }, [setTabsState]);

  const setCloseOnExit = useCallback((closeOnExit: boolean) => {
    setTabsState((prev) => ({ ...prev, settings: { ...prev.settings, closeOnExit } }));
  }, [setTabsState]);

  const setDirty = useCallback((tabId: string, dirty: boolean) => {
    setTabsState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((tab) => tab.id === tabId ? { ...tab, dirty, unreadCount: dirty ? Math.max(tab.unreadCount, 1) : 0 } : tab),
    }));
  }, [setTabsState]);

  const markUnread = useCallback((tabId: string) => {
    setTabsState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((tab) => tab.id === tabId ? { ...tab, dirty: true, unreadCount: (tab.unreadCount || 0) + 1 } : tab),
    }));
  }, [setTabsState]);

  const values = useMemo(() => {
    return tabs.map((tab, index) => ({
      ...tab,
      index,
      label: labelFor(tab, state.settings.labelFormat),
      active: index === activeIndex,
    }));
  }, [activeIndex, state.settings.labelFormat, tabs]);
  const activeTab = values[activeIndex] || null;

  return {
    tabs: values,
    activeIndex,
    activeTab,
    settings: state.settings,
    createTab,
    closeTab,
    duplicateTab,
    renameTab,
    updateTab,
    setActive,
    cycleTab,
    moveTab,
    setLabelFormat,
    setMaxTabs,
    setCloseOnExit,
    setDirty,
    markUnread,
  };
}
