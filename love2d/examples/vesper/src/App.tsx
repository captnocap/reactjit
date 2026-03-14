/**
 * Vesper — Flagship ReactJIT AI Studio.
 *
 * Root composition: Theme → Storage → AI → Shell → Views.
 * All compute that can be in Lua is in Lua (via useLuaQuery/useCRUD).
 * React only declares layout and state switches.
 */

import React, { useState } from 'react';
import { Box, useHotkey, useMount, useLocalStore, CommandPalette } from '@reactjit/core';
import type { CommandDef } from '@reactjit/core';
import { ThemeProvider } from '@reactjit/theme';
import { StorageProvider, MemoryAdapter } from '@reactjit/storage';
import { useChat, useModels } from '@reactjit/ai';
import { useSettingsRegistry } from '@reactjit/apis';

import './theme';  // side-effect: registers vesper theme
import { Shell } from './layout/Shell';
import { ChatView } from './views/ChatView';
import { CompareView } from './views/CompareView';
import { ConversationPanel } from './views/ConversationPanel';
import { SettingsView } from './views/SettingsView';
import { TerminalView } from './views/TerminalView';
import { ResearchView } from './views/ResearchView';
import { VesperBackground, VesperCRT } from './components/VesperEffects';
import type {
  ViewId, ProviderConfig, Conversation, AppSettings,
} from './types';
import { DEFAULT_PROVIDERS, DEFAULT_SETTINGS } from './types';
import { V } from './theme';

// ── Storage adapter ──────────────────────────────────────

const storageAdapter = new MemoryAdapter();

// ── VesperApp (inside providers) ─────────────────────────

function VesperApp() {
  // ── API key settings overlay (F10) ─────────────────
  useSettingsRegistry();

  // ── Navigation ───────────────────────────────────────
  const [activeView, setActiveView] = useState<ViewId>('chat');
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── Settings (persisted to Lua-side local store) ─────
  const [settings, setSettings] = useLocalStore<AppSettings>('vesper:settings', DEFAULT_SETTINGS);

  // ── Providers ────────────────────────────────────────
  const [providers, setProviders] = useState<ProviderConfig[]>(DEFAULT_PROVIDERS);

  // rjit-ignore-next-line
  const activeProvider = providers.find(p => p.id === settings.activeProviderId) || providers[0];

  const updateProvider = (updated: ProviderConfig) => {
    setProviders(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  // ── Models ───────────────────────────────────────────
  const { models } = useModels({
    provider: activeProvider.type,
    apiKey: activeProvider.apiKey,
    baseURL: activeProvider.baseURL,
  });

  // rjit-ignore-next-line
  const activeModel = settings.activeModel && models.some(m => m.id === settings.activeModel)
    ? settings.activeModel
    : (models[0]?.id || '');

  // ── Chat ─────────────────────────────────────────────
  const chat = useChat({
    provider: activeProvider.type,
    model: activeModel,
    apiKey: activeProvider.apiKey,
    baseURL: activeProvider.baseURL,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
    systemPrompt: settings.systemPrompt || undefined,
  });

  // ── Conversations ────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);

  const newConversation = () => {
    const id = `conv-${Date.now().toString(36)}`;
    const convo: Conversation = {
      id,
      title: 'New conversation',
      providerId: activeProvider.id,
      model: activeModel,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations(prev => [convo, ...prev]);
    setActiveConvoId(id);
    chat.setMessages([]);
    setActiveView('chat');
  };

  const selectConversation = (id: string) => {
    // rjit-ignore-next-line
    const convo = conversations.find(c => c.id === id);
    if (!convo) return;
    setActiveConvoId(id);
    chat.setMessages(convo.messages);
    setActiveView('chat');
  };

  const deleteConversation = (id: string) => {
    // rjit-ignore-next-line
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvoId === id) {
      setActiveConvoId(null);
      chat.setMessages([]);
    }
  };

  // Sync messages back to active conversation
  const syncMessages = () => {
    if (!activeConvoId) return;
    setConversations(prev => prev.map(c => {
      if (c.id !== activeConvoId) return c;
      // rjit-ignore-next-line
      const firstUser = chat.messages.find(m => m.role === 'user');
      const title = firstUser
        ? (typeof firstUser.content === 'string' ? firstUser.content : 'Chat').slice(0, 60)
        : c.title;
      return { ...c, messages: chat.messages, title, updatedAt: Date.now() };
    }));
  };

  // Auto-create conversation on first send if none active
  const wrappedSend = async (content: string) => {
    if (!activeConvoId) {
      const id = `conv-${Date.now().toString(36)}`;
      const convo: Conversation = {
        id,
        title: content.slice(0, 60),
        providerId: activeProvider.id,
        model: activeModel,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setConversations(prev => [convo, ...prev]);
      setActiveConvoId(id);
    }
    await chat.send(content);
    syncMessages();
  };

  // ── Message actions ──────────────────────────────────
  const deleteMessage = (index: number) => {
    // rjit-ignore-next-line
    chat.setMessages(prev => prev.filter((_, i) => i !== index));
    syncMessages();
  };

  // ── Token estimate (rough: 4 chars per token) ───────
  // rjit-ignore-next-line
  const tokenEstimate = Math.round(
    chat.messages.reduce((sum, m) => {
      const t = typeof m.content === 'string' ? m.content : m.content.map(b => b.text || '').join('');
      return sum + t.length;
    }, 0) / 4
  );

  // ── Command Palette ─────────────────────────────────
  const [paletteOpen, setPaletteOpen] = useState(false);

  const commands: CommandDef[] = [
    { id: 'new-chat',      label: 'New Conversation',     shortcut: 'ctrl+n',  group: 'Chat',       action: newConversation },
    { id: 'history',       label: 'Toggle History',       shortcut: 'ctrl+h',  group: 'Chat',       action: () => setHistoryOpen(prev => !prev) },
    { id: 'view-chat',     label: 'Go to Chat',                                group: 'Navigate',   action: () => setActiveView('chat') },
    { id: 'view-compare',  label: 'Go to Compare',                             group: 'Navigate',   action: () => setActiveView('compare') },
    { id: 'view-terminal', label: 'Go to Terminal',                             group: 'Navigate',   action: () => setActiveView('terminal') },
    { id: 'view-research', label: 'Go to Research',                             group: 'Navigate',   action: () => setActiveView('research') },
    { id: 'view-settings', label: 'Go to Settings',       shortcut: 'ctrl+,',  group: 'Navigate',   action: () => setActiveView('settings') },
  ];

  // ── Keyboard shortcuts ───────────────────────────────
  useHotkey('ctrl+k', () => setPaletteOpen(prev => !prev));
  useHotkey('ctrl+n', newConversation);
  useHotkey('ctrl+h', () => setHistoryOpen(prev => !prev));
  useHotkey('ctrl+,', () => setActiveView('settings'));
  useHotkey('escape', () => {
    if (paletteOpen) setPaletteOpen(false);
    else if (historyOpen) setHistoryOpen(false);
    else if (activeView !== 'chat') setActiveView('chat');
  });

  // ── Health check on mount ────────────────────────────
  useMount(() => {
    providers.forEach(async (p) => {
      try {
        const baseURL = p.baseURL.replace(/\/$/, '');
        const headers: Record<string, string> = {};
        if (p.apiKey) headers['authorization'] = `Bearer ${p.apiKey}`;
        const res = await fetch(`${baseURL}/v1/models`, { headers } as any);
        updateProvider({ ...p, healthy: res.ok });
      } catch {
        updateProvider({ ...p, healthy: false });
      }
    });
  });

  // ── Render ───────────────────────────────────────────
  return (
    <Shell
      activeView={activeView}
      onNavigate={setActiveView}
      providerName={activeProvider.name}
      providerHealthy={activeProvider.healthy}
    >
      <Box style={{
        flexGrow: 1,
        width: '100%',
        position: 'relative',
      }}>
        {/* Ambient background effect */}
        <VesperBackground />

        {/* Conversation history panel (overlay) */}
        <ConversationPanel
          conversations={conversations}
          activeId={activeConvoId}
          onSelect={selectConversation}
          onNew={newConversation}
          onDelete={deleteConversation}
          visible={historyOpen}
        />

        {/* Main content */}
        {activeView === 'chat' && (
          <ChatView
            messages={chat.messages}
            send={wrappedSend}
            isLoading={chat.isLoading}
            isStreaming={chat.isStreaming}
            stop={chat.stop}
            error={chat.error}
            provider={activeProvider}
            model={activeModel}
            models={models}
            onSelectModel={(id) => setSettings(s => ({ ...s, activeModel: id }))}
            tokenEstimate={tokenEstimate}
            onDeleteMessage={deleteMessage}
          />
        )}
        {activeView === 'compare' && (
          <CompareView
            providers={providers}
            settings={settings}
          />
        )}
        {activeView === 'terminal' && <TerminalView />}
        {activeView === 'research' && (
          <ResearchView
            provider={activeProvider}
            settings={settings}
          />
        )}
        {activeView === 'settings' && (
          <SettingsView
            providers={providers}
            onUpdateProvider={updateProvider}
            settings={settings}
            onUpdateSettings={setSettings}
          />
        )}

        {/* CRT post-processing overlay */}
        <VesperCRT />

        {/* Command palette (full-screen overlay) */}
        <CommandPalette
          visible={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          commands={commands}
          placeholder="Search commands..."
          activeColor={V.accent}
          textColor="rgba(255, 255, 255, 0.92)"
          mutedColor="rgba(255, 255, 255, 0.40)"
          backgroundColor="rgba(10, 10, 10, 0.98)"
          overlayColor="rgba(0, 0, 0, 0.6)"
          borderColor={V.border}
        />
      </Box>
    </Shell>
  );
}

// ── Root ─────────────────────────────────────────────────

export function App() {
  return (
    <ThemeProvider defaultTheme="vesper">
      <StorageProvider adapter={storageAdapter}>
        <VesperApp />
      </StorageProvider>
    </ThemeProvider>
  );
}
