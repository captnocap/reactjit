/**
 * LLM Studio — Local model runner + API provider hub.
 *
 * Features:
 * - Local inference: Ollama, llama.cpp, vLLM via OpenAI-compatible API
 * - Cloud providers: OpenAI, Anthropic
 * - SQLite-persisted conversations and provider configs
 * - Model browser with search
 * - Settings: system prompt, temperature, max tokens
 * - Keyboard shortcuts: Ctrl+N, Ctrl+,, Escape
 * - Streaming chat with code block rendering
 * - Provider health indicator
 * - Multi-model compare: send same input to N models side-by-side, pick favorite
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Box, Text, Pressable, ScrollView, TextInput, Modal, Select,
  CodeBlock, useHotkey, Window,
} from '@reactjit/core';
import { useChat, useModels, type AIProviderType, type Message } from '@reactjit/ai';
import { AIMessageList, AIChatInput } from '@reactjit/ai';
// Import from subpaths to avoid pulling in TerminalSQLiteAdapter (needs node:sqlite)
import { StorageProvider, useCRUD } from '@reactjit/storage/hooks';
import { z } from '@reactjit/storage/schema';
import { MemoryAdapter } from '@reactjit/storage/adapters/memory';
import { useServer } from '@reactjit/server';
import { getProvider } from '@reactjit/ai';

// ── Color palette ────────────────────────────────────────────────────────────

const C = {
  bg: '#0c0c14',
  bgSidebar: '#0a0a12',
  bgElevated: '#141420',
  bgInput: '#1a1a2a',
  surface: '#1e1e30',
  surfaceHover: '#252540',
  surfaceActive: '#2a2a4a',
  border: '#2a2a40',
  text: '#e8e8f0',
  textMuted: '#8888a8',
  textDim: '#5a5a78',
  accent: '#6c5ce7',
  accentHover: '#7c6cf7',
  accentDim: '#4a3cb5',
  green: '#2ed573',
  greenDim: '#1a3a2a',
  red: '#ff4757',
  redDim: '#3a1a1a',
  yellow: '#ffa502',
};

// ── Types ────────────────────────────────────────────────────────────────────

interface Provider {
  id: string;
  name: string;
  type: AIProviderType;
  baseURL?: string;
  apiKey?: string;
  icon: string;
  healthy?: boolean;
}

interface ConversationRecord {
  id: string;
  title: string;
  providerId: string;
  model: string;
  messages: Message[];
  systemPrompt: string;
  updatedAt: number;
}

// ── Built-in providers ───────────────────────────────────────────────────────

const DEFAULT_PROVIDERS: Provider[] = [
  { id: 'ollama', name: 'Ollama', type: 'openai', baseURL: 'http://localhost:11434', icon: '\u{1F999}' },
  { id: 'llamacpp', name: 'llama.cpp', type: 'openai', baseURL: 'http://localhost:8080', icon: '\u{1F4BB}' },
  { id: 'vllm', name: 'vLLM', type: 'openai', baseURL: 'http://localhost:8000', icon: '\u26A1' },
  { id: 'lmstudio', name: 'LM Studio', type: 'openai', baseURL: 'http://localhost:1234', icon: '\u{1F9EA}' },
  { id: 'openai', name: 'OpenAI', type: 'openai', icon: '\u{1F916}' },
  { id: 'anthropic', name: 'Anthropic', type: 'anthropic', icon: '\u{1F9E0}' },
];

type View = 'chat' | 'compare' | 'providers' | 'models' | 'server';

// ── Schemas for SQLite persistence ───────────────────────────────────────────

const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  providerId: z.string(),
  model: z.string(),
  messages: z.string(), // JSON-serialized Message[]
  systemPrompt: z.string(),
  updatedAt: z.number(),
});

const providerSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  baseURL: z.string().optional(),
  apiKey: z.string().optional(),
  icon: z.string(),
});

// ── Storage adapter (singleton) ──────────────────────────────────────────────

// MemoryAdapter for now — upgrade to Love2DFileAdapter when bridge RPC is wired
const storageAdapter = new MemoryAdapter();

// ── Root wrapper with storage ────────────────────────────────────────────────

export function App() {
  return (
    <StorageProvider adapter={storageAdapter}>
      <LLMStudio />
    </StorageProvider>
  );
}

// ── Main app ─────────────────────────────────────────────────────────────────

function LLMStudio() {
  const [providers, setProviders] = useState<Provider[]>(DEFAULT_PROVIDERS);
  const [activeProviderId, setActiveProviderId] = useState('ollama');
  const [activeModel, setActiveModel] = useState('');
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [view, setView] = useState<View>('chat');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [serverEnabled, setServerEnabled] = useState(false);
  const [serverPort, setServerPort] = useState(5001);
  const [compareMode, setCompareMode] = useState(false);
  const [compareModels, setCompareModels] = useState<string[]>([]);
  const [poppedOutConvos, setPoppedOutConvos] = useState<string[]>([]);
  const [contextFiles, setContextFiles] = useState<{ name: string; content: string }[]>([]);
  const [renamingConvoId, setRenamingConvoId] = useState<string | null>(null);

  const activeProvider = providers.find(p => p.id === activeProviderId) || providers[0];

  // ── OpenAI-compatible proxy server ───────────────────
  const serverConfig = useMemo(() => {
    if (!serverEnabled) return null;
    return {
      port: serverPort,
      routes: [
        {
          path: '/v1/models',
          method: 'GET' as const,
          handler: async () => {
            // Forward to active provider's model list
            try {
              const baseURL = activeProvider.baseURL || 'https://api.openai.com';
              const res = await fetch(`${baseURL}/v1/models`, {
                headers: activeProvider.apiKey
                  ? { authorization: `Bearer ${activeProvider.apiKey}` }
                  : {},
              } as any);
              const body = await res.text();
              return {
                status: res.ok ? 200 : (res.status as number),
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body,
              };
            } catch (err: any) {
              return {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: { message: `Upstream error: ${err.message}`, type: 'proxy_error' } }),
              };
            }
          },
        },
        {
          path: '/v1/chat/completions',
          method: 'POST' as const,
          handler: async (req: any) => {
            // Forward chat completions to active provider
            try {
              const provider = getProvider(activeProvider.type);
              const body = JSON.parse(req.body || '{}');
              const messages = body.messages || [];
              const model = body.model || effectiveModel;
              const stream = body.stream || false;

              const formatted = provider.formatRequest(
                messages,
                {
                  provider: activeProvider.type,
                  model,
                  apiKey: activeProvider.apiKey,
                  baseURL: activeProvider.baseURL,
                  temperature: body.temperature ?? temperature,
                  maxTokens: body.max_tokens ?? maxTokens,
                },
                undefined,
                stream,
              );

              const res = await fetch(formatted.url, {
                method: formatted.method,
                headers: formatted.headers,
                body: formatted.body,
              } as any);

              const responseBody = await res.text();
              return {
                status: res.ok ? 200 : (res.status as number),
                headers: {
                  'Content-Type': stream ? 'text/event-stream' : 'application/json',
                  'Access-Control-Allow-Origin': '*',
                },
                body: responseBody,
              };
            } catch (err: any) {
              return {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: { message: `Proxy error: ${err.message}`, type: 'proxy_error' } }),
              };
            }
          },
        },
        {
          path: '/v1/completions',
          method: 'POST' as const,
          handler: async (req: any) => {
            // Forward legacy completions
            try {
              const baseURL = activeProvider.baseURL || 'https://api.openai.com';
              const res = await fetch(`${baseURL}/v1/completions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(activeProvider.apiKey ? { authorization: `Bearer ${activeProvider.apiKey}` } : {}),
                },
                body: req.body,
              } as any);
              const responseBody = await res.text();
              return {
                status: res.ok ? 200 : (res.status as number),
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: responseBody,
              };
            } catch (err: any) {
              return {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: { message: `Proxy error: ${err.message}` } }),
              };
            }
          },
        },
        {
          // CORS preflight
          path: '/v1/*',
          method: 'OPTIONS' as const,
          handler: async () => ({
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
            body: '',
          }),
        },
      ],
    };
  }, [serverEnabled, serverPort, activeProvider, effectiveModel, temperature, maxTokens]);

  const server = useServer(serverConfig);

  // ── CRUD for persistence ─────────────────────────────
  const convoCRUD = useCRUD('conversations', conversationSchema);
  const providerCRUD = useCRUD('custom_providers', providerSchema);

  // Load persisted conversations on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await convoCRUD.list();
        if (saved && saved.length > 0) {
          const hydrated: ConversationRecord[] = saved.map((s: any) => ({
            ...s,
            messages: JSON.parse(s.messages || '[]'),
          }));
          hydrated.sort((a, b) => b.updatedAt - a.updatedAt);
          setConversations(hydrated);
        }
      } catch { /* first run, no data */ }
    })();
  }, []);

  // Load custom providers on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await providerCRUD.list();
        if (saved && saved.length > 0) {
          const custom: Provider[] = saved.map((s: any) => ({
            ...s,
            type: s.type as AIProviderType,
          }));
          setProviders(prev => {
            const builtIn = prev.filter(p => !p.id.startsWith('custom_'));
            return [...builtIn, ...custom];
          });
        }
      } catch { /* first run */ }
    })();
  }, []);

  // ── Provider health checks ───────────────────────────
  useEffect(() => {
    const checkHealth = async () => {
      const updates = await Promise.all(
        providers.filter(p => p.baseURL).map(async (p) => {
          try {
            const res = await fetch(`${p.baseURL}/v1/models`, {
              signal: AbortSignal.timeout(3000),
            } as any);
            return { id: p.id, healthy: res.ok };
          } catch {
            return { id: p.id, healthy: false };
          }
        })
      );
      setProviders(prev => prev.map(p => {
        const update = updates.find(u => u.id === p.id);
        return update ? { ...p, healthy: update.healthy } : p;
      }));
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [providers.length]);

  // ── Model fetching ───────────────────────────────────
  const { models, loading: modelsLoading, error: modelsError, refetch: refetchModels } = useModels({
    provider: activeProvider.type,
    baseURL: activeProvider.baseURL,
    apiKey: activeProvider.apiKey,
  });

  // Derive effective model: if activeModel isn't in the current model list, fall back to first
  const effectiveModel = useMemo(() => {
    if (activeModel && models.some(m => m.id === activeModel)) return activeModel;
    return models.length > 0 ? models[0].id : '';
  }, [activeModel, models]);

  // ── Effective system prompt (includes file context) ──
  const effectiveSystemPrompt = useMemo(() => {
    if (contextFiles.length === 0) return systemPrompt;
    const fileBlock = contextFiles.map(f =>
      `<file name="${f.name}">\n${f.content}\n</file>`
    ).join('\n\n');
    return `${systemPrompt}\n\nThe user has attached the following files for context:\n\n${fileBlock}`;
  }, [systemPrompt, contextFiles]);

  // ── Chat hook ────────────────────────────────────────
  const chat = useChat({
    provider: activeProvider.type,
    model: effectiveModel,
    apiKey: activeProvider.apiKey,
    baseURL: activeProvider.baseURL,
    temperature,
    maxTokens,
    systemPrompt: effectiveSystemPrompt,
    initialMessages: activeConvoId
      ? conversations.find(c => c.id === activeConvoId)?.messages || []
      : [],
  });

  // ── Token estimation ─────────────────────────────────
  const tokenEstimate = useMemo(() => {
    const totalChars = chat.messages.reduce((sum, m) => {
      const content = typeof m.content === 'string' ? m.content : m.content.map(b => b.text || '').join('');
      return sum + content.length;
    }, 0);
    return Math.round(totalChars / 4); // rough estimate: 4 chars per token
  }, [chat.messages]);

  // ── Conversation management ──────────────────────────
  const persistConversation = useCallback(async (convo: ConversationRecord) => {
    try {
      const existing = await convoCRUD.get(convo.id);
      const serialized = { ...convo, messages: JSON.stringify(convo.messages) } as any;
      if (existing) {
        await convoCRUD.update(convo.id, serialized);
      } else {
        await convoCRUD.create(serialized);
      }
    } catch { /* storage might not be ready */ }
  }, [convoCRUD]);

  const newConversation = useCallback(() => {
    const id = `conv_${Date.now().toString(36)}`;
    const convo: ConversationRecord = {
      id, title: 'New Chat', providerId: activeProviderId,
      model: effectiveModel, messages: [], systemPrompt, updatedAt: Date.now(),
    };
    setConversations(prev => [convo, ...prev]);
    setActiveConvoId(id);
    chat.setMessages([]);
    persistConversation(convo);
  }, [activeProviderId, effectiveModel, systemPrompt, chat, persistConversation]);

  // Sync messages to conversation + persist
  useEffect(() => {
    if (activeConvoId && chat.messages.length > 0) {
      setConversations(prev => {
        const updated = prev.map(c => {
          if (c.id !== activeConvoId) return c;
          const firstUser = chat.messages.find(m => m.role === 'user');
          const title = firstUser && typeof firstUser.content === 'string'
            ? firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? '...' : '')
            : c.title;
          const updatedConvo = { ...c, title, messages: chat.messages, updatedAt: Date.now() };
          // Persist async (don't block render)
          persistConversation(updatedConvo);
          return updatedConvo;
        });
        return updated;
      });
    }
  }, [chat.messages, activeConvoId, persistConversation]);

  const selectConversation = useCallback((id: string) => {
    const convo = conversations.find(c => c.id === id);
    if (convo) {
      setActiveConvoId(id);
      setActiveProviderId(convo.providerId);
      setActiveModel(convo.model);
      setSystemPrompt(convo.systemPrompt);
      chat.setMessages(convo.messages);
    }
  }, [conversations, chat]);

  const deleteConversation = useCallback(async (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvoId === id) { setActiveConvoId(null); chat.setMessages([]); }
    try { await convoCRUD.delete(id); } catch { /* ok */ }
  }, [activeConvoId, chat, convoCRUD]);

  // Clone: duplicate entire conversation
  const cloneConversation = useCallback((id: string) => {
    const source = conversations.find(c => c.id === id);
    if (!source) return;
    const newId = `conv_${Date.now().toString(36)}`;
    const clone: ConversationRecord = {
      ...source, id: newId, title: `${source.title} (copy)`, updatedAt: Date.now(),
      messages: [...source.messages],
    };
    setConversations(prev => [clone, ...prev]);
    setActiveConvoId(newId);
    chat.setMessages(clone.messages);
    persistConversation(clone);
  }, [conversations, chat, persistConversation]);

  // Branch: fork from a specific message index
  const branchConversation = useCallback((fromIndex: number) => {
    if (!activeConvoId) return;
    const source = conversations.find(c => c.id === activeConvoId);
    if (!source) return;
    const newId = `conv_${Date.now().toString(36)}`;
    const branchedMessages = chat.messages.slice(0, fromIndex + 1);
    const branch: ConversationRecord = {
      ...source, id: newId,
      title: `${source.title} (branch @${fromIndex + 1})`,
      messages: branchedMessages, updatedAt: Date.now(),
    };
    setConversations(prev => [branch, ...prev]);
    setActiveConvoId(newId);
    chat.setMessages(branchedMessages);
    persistConversation(branch);
  }, [activeConvoId, conversations, chat, persistConversation]);

  // Rename conversation
  const renameConversation = useCallback((id: string, newTitle: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, title: newTitle };
      persistConversation(updated);
      return updated;
    }));
    setRenamingConvoId(null);
  }, [persistConversation]);

  // Pop out a conversation into its own window
  const popOutConversation = useCallback((id: string) => {
    if (!poppedOutConvos.includes(id)) {
      setPoppedOutConvos(prev => [...prev, id]);
    }
  }, [poppedOutConvos]);

  const closePopOut = useCallback((id: string) => {
    setPoppedOutConvos(prev => prev.filter(c => c !== id));
  }, []);

  // Edit a message in-place
  const editMessage = useCallback((index: number, newContent: string) => {
    const updated = chat.messages.map((m, i) =>
      i === index ? { ...m, content: newContent } : m
    );
    chat.setMessages(updated);
  }, [chat]);

  // Add file context
  const addContextFile = useCallback((name: string, content: string) => {
    setContextFiles(prev => [...prev, { name, content }]);
  }, []);

  const removeContextFile = useCallback((index: number) => {
    setContextFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ── Provider management ──────────────────────────────
  const [newPName, setNewPName] = useState('');
  const [newPURL, setNewPURL] = useState('');
  const [newPKey, setNewPKey] = useState('');
  const [newPType, setNewPType] = useState<AIProviderType>('openai');

  const addProvider = useCallback(async () => {
    if (!newPName || !newPURL) return;
    const id = `custom_${Date.now().toString(36)}`;
    const p: Provider = {
      id, name: newPName, type: newPType,
      baseURL: newPURL, apiKey: newPKey || undefined, icon: '\u{1F517}',
    };
    setProviders(prev => [...prev, p]);
    setNewPName(''); setNewPURL(''); setNewPKey('');
    setProviderModalOpen(false);
    try { await providerCRUD.create({ ...p, apiKey: p.apiKey || '' } as any); } catch { /* ok */ }
  }, [newPName, newPURL, newPKey, newPType, providerCRUD]);

  // ── Keyboard shortcuts ───────────────────────────────
  useHotkey('ctrl+n', () => { newConversation(); setView('chat'); });
  useHotkey('ctrl+comma', () => setSettingsOpen(v => !v));
  useHotkey('escape', () => {
    if (providerModalOpen) setProviderModalOpen(false);
    else if (settingsOpen) setSettingsOpen(false);
  });
  useHotkey('ctrl+1', () => setView('chat'));
  useHotkey('ctrl+2', () => setView('compare'));
  useHotkey('ctrl+3', () => setView('models'));
  useHotkey('ctrl+4', () => setView('providers'));
  useHotkey('ctrl+5', () => setView('server'));

  return (
    <Box style={{ width: '100%', height: '100%', flexDirection: 'row', backgroundColor: C.bg }}>
      {/* ── Left sidebar ── */}
      <Sidebar
        providers={providers} activeProviderId={activeProviderId}
        onSelectProvider={setActiveProviderId}
        conversations={conversations} activeConvoId={activeConvoId}
        onSelectConvo={selectConversation} onNewChat={newConversation}
        onDeleteConvo={deleteConversation}
        onCloneConvo={cloneConversation}
        onPopOutConvo={popOutConversation}
        onRenameConvo={renameConversation}
        renamingConvoId={renamingConvoId}
        onStartRename={setRenamingConvoId}
        view={view} onSetView={setView}
        onAddProvider={() => setProviderModalOpen(true)}
      />

      {/* ── Main content ── */}
      <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
        <TopBar
          provider={activeProvider} model={effectiveModel}
          models={models} modelsLoading={modelsLoading}
          onSelectModel={setActiveModel} onRefreshModels={refetchModels}
          settingsOpen={settingsOpen} onToggleSettings={() => setSettingsOpen(v => !v)}
          isStreaming={chat.isStreaming} onStop={chat.stop}
          tokenEstimate={tokenEstimate}
          compareMode={compareMode}
          onToggleCompare={() => {
            setCompareMode(v => !v);
            if (!compareMode) setView('compare');
            else setView('chat');
          }}
        />

        {(chat.error || modelsError) && (
          <Box style={{ padding: 8, paddingLeft: 16, backgroundColor: C.redDim, borderBottomWidth: 1, borderColor: C.red }}>
            <Text style={{ fontSize: 12, color: C.red }}>
              {chat.error?.message || modelsError?.message || 'Unknown error'}
            </Text>
          </Box>
        )}

        <Box style={{ flexGrow: 1, flexDirection: 'row' }}>
          {view === 'chat' && (
            <>
              <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
                {chat.messages.length === 0 ? (
                  <WelcomeScreen provider={activeProvider} model={effectiveModel} />
                ) : (
                  <AIMessageList
                    messages={chat.messages} isStreaming={chat.isStreaming}
                    style={{ flexGrow: 1 }}
                    renderMessage={(msg, i) => (
                      <FormattedMessage
                        key={i}
                        message={msg}
                        onCopy={() => {
                          const text = typeof msg.content === 'string'
                            ? msg.content
                            : msg.content.map(b => b.text || '').join('');
                          try { (globalThis as any).__rjitBridge?.rpc('clipboard:set', text); } catch {}
                        }}
                        onDelete={() => {
                          chat.setMessages(chat.messages.filter((_, mi) => mi !== i));
                        }}
                        onEdit={(newContent) => editMessage(i, newContent)}
                        onBranch={() => branchConversation(i)}
                        onRegenerate={msg.role === 'assistant' ? () => {
                          const preceding = chat.messages.slice(0, i);
                          const lastUser = [...preceding].reverse().find(m => m.role === 'user');
                          chat.setMessages(preceding);
                          if (lastUser) {
                            const text = typeof lastUser.content === 'string'
                              ? lastUser.content
                              : lastUser.content.map(b => b.text || '').join('');
                            setTimeout(() => chat.send(text), 50);
                          }
                        } : undefined}
                      />
                    )}
                  />
                )}
                {/* File context bar */}
                {contextFiles.length > 0 && (
                  <Box style={{
                    paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
                    borderTopWidth: 1, borderColor: C.border,
                    flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 9, color: C.textDim }}>Context:</Text>
                    {contextFiles.map((f, fi) => (
                      <Box key={fi} style={{
                        flexDirection: 'row', gap: 4, alignItems: 'center',
                        paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
                        backgroundColor: C.surface, borderRadius: 4,
                      }}>
                        <Text style={{ fontSize: 10, color: C.accent }}>{f.name}</Text>
                        <Text style={{ fontSize: 9, color: C.textDim }}>
                          {`${Math.round(f.content.length / 1024)}kb`}
                        </Text>
                        <Pressable onPress={() => removeContextFile(fi)}>
                          {({ hovered: xh }) => (
                            <Text style={{ fontSize: 9, color: xh ? C.red : C.textDim }}>x</Text>
                          )}
                        </Pressable>
                      </Box>
                    ))}
                  </Box>
                )}

                <Box style={{ padding: 12, borderTopWidth: 1, borderColor: C.border, gap: 6 }}>
                  <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Box style={{ flexGrow: 1 }}>
                      <AIChatInput
                        send={(text) => {
                          if (!activeConvoId) {
                            const id = `conv_${Date.now().toString(36)}`;
                            const convo: ConversationRecord = {
                              id, title: 'New Chat', providerId: activeProviderId,
                              model: effectiveModel, messages: [], systemPrompt, updatedAt: Date.now(),
                            };
                            setConversations(prev => [convo, ...prev]);
                            setActiveConvoId(id);
                            persistConversation(convo);
                          }
                          chat.send(text);
                        }}
                        isLoading={chat.isLoading}
                        placeholder={`Message ${activeProvider.name}${effectiveModel ? ` / ${effectiveModel}` : ''}...`}
                        sendColor={C.accent} autoFocus
                      />
                    </Box>
                    <FileContextButton onAddFile={addContextFile} />
                  </Box>
                </Box>
              </Box>

              {settingsOpen && (
                <SettingsPanel
                  systemPrompt={systemPrompt} onSystemPromptChange={setSystemPrompt}
                  temperature={temperature} onTemperatureChange={setTemperature}
                  maxTokens={maxTokens} onMaxTokensChange={setMaxTokens}
                  provider={activeProvider}
                  onProviderKeyChange={(key) => {
                    setProviders(prev => prev.map(p =>
                      p.id === activeProviderId ? { ...p, apiKey: key } : p
                    ));
                  }}
                />
              )}
            </>
          )}

          {view === 'compare' && (
            <CompareView
              models={models}
              compareModels={compareModels}
              onSetCompareModels={setCompareModels}
              provider={activeProvider}
              systemPrompt={systemPrompt}
              temperature={temperature}
              maxTokens={maxTokens}
              onPickResponse={(modelId, messages) => {
                // Switch to single chat with the picked model's output
                setActiveModel(modelId);
                setCompareMode(false);
                setView('chat');
                chat.setMessages(messages);
              }}
            />
          )}

          {view === 'models' && (
            <ModelBrowser
              models={models} loading={modelsLoading} error={modelsError}
              activeModel={effectiveModel}
              onSelectModel={(id) => { setActiveModel(id); setView('chat'); }}
              onRefresh={refetchModels} provider={activeProvider}
            />
          )}

          {view === 'providers' && (
            <ProviderManager
              providers={providers} activeId={activeProviderId}
              onSelect={setActiveProviderId}
              onAdd={() => setProviderModalOpen(true)}
              onRemove={async (id) => {
                setProviders(prev => prev.filter(p => p.id !== id));
                try { await providerCRUD.delete(id); } catch { /* ok */ }
              }}
              onUpdateKey={(id, key) => {
                setProviders(prev => prev.map(p => p.id === id ? { ...p, apiKey: key } : p));
              }}
            />
          )}

          {view === 'server' && (
            <ServerPanel
              serverEnabled={serverEnabled}
              onToggleServer={() => setServerEnabled(v => !v)}
              serverPort={serverPort}
              onPortChange={setServerPort}
              serverReady={server.ready}
              requests={server.requests}
              provider={activeProvider}
              model={effectiveModel}
              onStopServer={server.close}
            />
          )}
        </Box>
      </Box>

      {/* ── Add Provider Modal ── */}
      {providerModalOpen && (
        <Modal visible onClose={() => setProviderModalOpen(false)}>
          <Box style={{ width: 400, backgroundColor: C.bgElevated, borderRadius: 12, padding: 20, gap: 16 }}>
            <Text style={{ fontSize: 16, color: C.text, fontWeight: 'bold' }}>Add Provider</Text>
            <LabeledInput label="Name" value={newPName} onChange={setNewPName} placeholder="My Server" />
            <LabeledInput label="Base URL" value={newPURL} onChange={setNewPURL} placeholder="http://localhost:8080" />
            <LabeledInput label="API Key (optional)" value={newPKey} onChange={setNewPKey} placeholder="sk-..." />
            <Box style={{ gap: 4 }}>
              <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: 'bold' }}>Type</Text>
              <Select
                options={[
                  { value: 'openai', label: 'OpenAI-compatible' },
                  { value: 'anthropic', label: 'Anthropic' },
                ]}
                value={newPType}
                onValueChange={(v) => setNewPType(v as AIProviderType)}
              />
            </Box>
            <Box style={{ flexDirection: 'row', gap: 8, justifyContent: 'end' }}>
              <Btn label="Cancel" color={C.textMuted} bgColor={C.surface} onPress={() => setProviderModalOpen(false)} />
              <Btn label="Add Provider" color="#fff" bgColor={C.accent} onPress={addProvider} />
            </Box>
          </Box>
        </Modal>
      )}

      {/* ── Pop-out chat windows ── */}
      {poppedOutConvos.map(convoId => {
        const convo = conversations.find(c => c.id === convoId);
        if (!convo) return null;
        return (
          <PopOutChatWindow
            key={convoId}
            conversation={convo}
            provider={providers.find(p => p.id === convo.providerId) || activeProvider}
            systemPrompt={convo.systemPrompt}
            temperature={temperature}
            maxTokens={maxTokens}
            onClose={() => closePopOut(convoId)}
          />
        );
      })}
    </Box>
  );
}

// ── Formatted message with markdown-like rendering ───────────────────────────

function FormattedMessage({ message, onCopy, onDelete, onRegenerate, onEdit, onBranch }: {
  message: Message;
  onCopy?: () => void;
  onDelete?: () => void;
  onRegenerate?: () => void;
  onEdit?: (newContent: string) => void;
  onBranch?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const content = typeof message.content === 'string'
    ? message.content
    : message.content.map(b => b.text || '').join('');

  if (message.role === 'system' || message.role === 'tool') return null;

  const isUser = message.role === 'user';
  const parts = parseMarkdown(content);

  const handleCopy = useCallback(() => {
    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [onCopy]);

  const startEdit = useCallback(() => {
    setEditText(content);
    setEditing(true);
  }, [content]);

  const commitEdit = useCallback(() => {
    if (editText.trim() && editText !== content) {
      onEdit?.(editText);
    }
    setEditing(false);
  }, [editText, content, onEdit]);

  return (
    <Pressable onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}>
      {() => (
        <Box style={{
          paddingLeft: isUser ? 60 : 16, paddingRight: isUser ? 16 : 60,
          paddingTop: 8, paddingBottom: 8,
        }}>
          {/* Role label + actions */}
          <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 4 }}>
            <Text style={{ fontSize: 10, color: C.textDim, fontWeight: 'bold' }}>
              {isUser ? 'You' : 'Assistant'}
            </Text>
            {hovered && !editing && (
              <Box style={{ flexDirection: 'row', gap: 4 }}>
                <MsgAction label={copied ? 'Copied' : 'Copy'} color={copied ? C.green : C.textDim} onPress={handleCopy} />
                {onEdit && <MsgAction label="Edit" color={C.textDim} onPress={startEdit} />}
                {onBranch && <MsgAction label="Branch" color={C.accent} onPress={onBranch} />}
                {!isUser && onRegenerate && (
                  <MsgAction label="Retry" color={C.textDim} onPress={onRegenerate} />
                )}
                {onDelete && <MsgAction label="Del" color={C.red} onPress={onDelete} />}
              </Box>
            )}
          </Box>

          {/* Content or editor */}
          {editing ? (
            <Box style={{ gap: 6 }}>
              <TextInput
                value={editText} onChangeText={setEditText}
                multiline
                style={{ backgroundColor: C.bgInput, borderRadius: 8, padding: 10, minHeight: 80 }}
                textStyle={{ color: C.text, fontSize: 13 }}
                autoFocus
              />
              <Box style={{ flexDirection: 'row', gap: 6 }}>
                <Btn label="Save" color="#fff" bgColor={C.accent} onPress={commitEdit} />
                <Btn label="Cancel" color={C.textMuted} bgColor={C.surface} onPress={() => setEditing(false)} />
              </Box>
            </Box>
          ) : (
            <Box style={{
              padding: 12, borderRadius: 10, gap: 6,
              backgroundColor: isUser ? C.surfaceActive : C.surface,
            }}>
              {parts.map((part, i) => {
                if (part.type === 'code') {
                  return <CodeBlock key={i} code={part.content} language={part.language} style={{ borderRadius: 6 }} />;
                }
                if (part.type === 'heading') {
                  return (
                    <Text key={i} style={{ fontSize: 15, color: C.text, fontWeight: 'bold', paddingTop: i > 0 ? 4 : 0 }}>
                      {part.content}
                    </Text>
                  );
                }
                if (part.type === 'bullet') {
                  return (
                    <Box key={i} style={{ flexDirection: 'row', gap: 6, paddingLeft: 4 }}>
                      <Text style={{ fontSize: 13, color: C.accent }}>*</Text>
                      <Text style={{ fontSize: 13, color: C.text, flexGrow: 1 }}>{part.content}</Text>
                    </Box>
                  );
                }
                return <RichText key={i} text={part.content} />;
              })}
            </Box>
          )}
        </Box>
      )}
    </Pressable>
  );
}

function MsgAction({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      {({ hovered: h }) => (
        <Box style={{
          paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1,
          borderRadius: 3, backgroundColor: h ? C.surfaceHover : 'transparent',
        }}>
          <Text style={{ fontSize: 9, color, fontWeight: 'bold' }}>{label}</Text>
        </Box>
      )}
    </Pressable>
  );
}

// ── Markdown parser (lightweight) ────────────────────────────────────────────

type MarkdownPart =
  | { type: 'text'; content: string }
  | { type: 'code'; content: string; language?: string }
  | { type: 'heading'; content: string; level: number }
  | { type: 'bullet'; content: string };

function parseMarkdown(text: string): MarkdownPart[] {
  const parts: MarkdownPart[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...parseTextBlock(text.slice(lastIndex, match.index)));
    }
    parts.push({ type: 'code', content: match[2], language: match[1] || undefined });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(...parseTextBlock(text.slice(lastIndex)));
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
}

function parseTextBlock(text: string): MarkdownPart[] {
  const parts: MarkdownPart[] = [];
  const lines = text.split('\n');
  let currentText = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      if (currentText.trim()) { parts.push({ type: 'text', content: currentText.trim() }); currentText = ''; }
      parts.push({ type: 'heading', content: headingMatch[2], level: headingMatch[1].length });
      continue;
    }

    // Bullet points
    if (trimmed.match(/^[-*]\s+(.+)$/)) {
      if (currentText.trim()) { parts.push({ type: 'text', content: currentText.trim() }); currentText = ''; }
      parts.push({ type: 'bullet', content: trimmed.replace(/^[-*]\s+/, '') });
      continue;
    }

    // Numbered lists
    if (trimmed.match(/^\d+\.\s+(.+)$/)) {
      if (currentText.trim()) { parts.push({ type: 'text', content: currentText.trim() }); currentText = ''; }
      parts.push({ type: 'bullet', content: trimmed.replace(/^\d+\.\s+/, '') });
      continue;
    }

    currentText += line + '\n';
  }

  if (currentText.trim()) parts.push({ type: 'text', content: currentText.trim() });
  return parts;
}

// ── Rich text with inline code highlighting ──────────────────────────────────

function RichText({ text }: { text: string }) {
  // Split on inline code backticks and bold
  const segments = text.split(/(`[^`]+`)/g);

  if (segments.length === 1) {
    return <Text style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{text}</Text>;
  }

  return (
    <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      {segments.map((seg, i) => {
        if (seg.startsWith('`') && seg.endsWith('`')) {
          return (
            <Box key={i} style={{ backgroundColor: '#2a2a4a', borderRadius: 3, paddingLeft: 4, paddingRight: 4 }}>
              <Text style={{ fontSize: 12, color: '#a78bfa', fontFamily: 'monospace' }}>
                {seg.slice(1, -1)}
              </Text>
            </Box>
          );
        }
        return <Text key={i} style={{ fontSize: 13, color: C.text }}>{seg}</Text>;
      })}
    </Box>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  providers, activeProviderId, onSelectProvider,
  conversations, activeConvoId, onSelectConvo, onNewChat, onDeleteConvo,
  onCloneConvo, onPopOutConvo, onRenameConvo, renamingConvoId, onStartRename,
  view, onSetView, onAddProvider,
}: {
  providers: Provider[]; activeProviderId: string; onSelectProvider: (id: string) => void;
  conversations: ConversationRecord[]; activeConvoId: string | null;
  onSelectConvo: (id: string) => void; onNewChat: () => void; onDeleteConvo: (id: string) => void;
  onCloneConvo: (id: string) => void; onPopOutConvo: (id: string) => void;
  onRenameConvo: (id: string, title: string) => void;
  renamingConvoId: string | null; onStartRename: (id: string | null) => void;
  view: View; onSetView: (v: View) => void; onAddProvider: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const activeProvider = providers.find(p => p.id === activeProviderId);

  return (
    <Box style={{ width: 260, borderRightWidth: 1, borderColor: C.border, backgroundColor: C.bgSidebar, flexDirection: 'column' }}>
      {/* App title + status */}
      <Box style={{ padding: 16, paddingBottom: 8 }}>
        <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 18, color: C.text, fontWeight: 'bold' }}>LLM Studio</Text>
          {activeProvider && (
            <HealthDot healthy={activeProvider.healthy} />
          )}
        </Box>
        <Text style={{ fontSize: 11, color: C.textDim }}>Local & Cloud AI</Text>
      </Box>

      {/* Nav tabs */}
      <Box style={{ flexDirection: 'row', paddingLeft: 8, paddingRight: 8, gap: 4, paddingBottom: 8 }}>
        <NavTab label="Chat" active={view === 'chat'} onPress={() => onSetView('chat')} hint="1" />
        <NavTab label="Compare" active={view === 'compare'} onPress={() => onSetView('compare')} hint="2" />
        <NavTab label="Models" active={view === 'models'} onPress={() => onSetView('models')} hint="3" />
        <NavTab label="Providers" active={view === 'providers'} onPress={() => onSetView('providers')} hint="4" />
        <NavTab label="Server" active={view === 'server'} onPress={() => onSetView('server')} hint="5" />
      </Box>

      {/* Provider selector */}
      <Box style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 8 }}>
        <Select
          options={providers.map(p => ({
            value: p.id,
            label: `${p.icon} ${p.name}${p.healthy === true ? ' \u2022' : p.healthy === false ? ' \u25CB' : ''}`,
          }))}
          value={activeProviderId}
          onValueChange={onSelectProvider}
        />
      </Box>

      {/* New chat */}
      <Box style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 8 }}>
        <Pressable onPress={onNewChat}>
          {({ pressed, hovered }) => (
            <Box style={{
              padding: 8, borderRadius: 8, alignItems: 'center',
              flexDirection: 'row', justifyContent: 'center', gap: 6,
              backgroundColor: pressed ? C.accentDim : hovered ? C.accentHover : C.accent,
            }}>
              <Text style={{ fontSize: 13, color: '#fff', fontWeight: 'bold' }}>+ New Chat</Text>
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Ctrl+N</Text>
            </Box>
          )}
        </Pressable>
      </Box>

      {/* Search */}
      <Box style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 8 }}>
        <TextInput
          value={search} onChangeText={setSearch}
          placeholder="Search conversations..." placeholderColor={C.textDim}
          style={{ backgroundColor: C.bgInput, borderRadius: 6, padding: 6 }}
          textStyle={{ color: C.text, fontSize: 12 }}
        />
      </Box>

      {/* Conversation list */}
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ padding: 4, gap: 2 }}>
          {filtered.map(convo => (
            <Pressable key={convo.id} onPress={() => onSelectConvo(convo.id)}>
              {({ hovered }) => (
                <Box style={{
                  padding: 10, paddingLeft: 12, borderRadius: 6,
                  backgroundColor: convo.id === activeConvoId ? C.surfaceActive : hovered ? C.surfaceHover : 'transparent',
                  gap: 2,
                }}>
                  <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box style={{ flexGrow: 1 }}>
                      {renamingConvoId === convo.id ? (
                        <ConvoRenameInput
                          initialTitle={convo.title}
                          onCommit={(t) => onRenameConvo(convo.id, t)}
                          onCancel={() => onStartRename(null)}
                        />
                      ) : (
                        <Text style={{ fontSize: 13, color: convo.id === activeConvoId ? C.text : C.textMuted }} numberOfLines={1}>
                          {convo.title}
                        </Text>
                      )}
                      <Text style={{ fontSize: 10, color: C.textDim }}>{convo.model || 'no model'}</Text>
                    </Box>
                  </Box>
                  {hovered && renamingConvoId !== convo.id && (
                    <Box style={{ flexDirection: 'row', gap: 3, paddingTop: 2 }}>
                      <MsgAction label="Rename" color={C.textDim} onPress={() => onStartRename(convo.id)} />
                      <MsgAction label="Clone" color={C.textDim} onPress={() => onCloneConvo(convo.id)} />
                      <MsgAction label="Pop Out" color={C.accent} onPress={() => onPopOutConvo(convo.id)} />
                      <MsgAction label="Del" color={C.red} onPress={() => onDeleteConvo(convo.id)} />
                    </Box>
                  )}
                </Box>
              )}
            </Pressable>
          ))}
          {filtered.length === 0 && (
            <Box style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: C.textDim }}>
                {search ? 'No matches' : 'No conversations yet'}
              </Text>
            </Box>
          )}
        </Box>
      </ScrollView>

      {/* Footer: keyboard shortcuts hint */}
      <Box style={{ padding: 8, borderTopWidth: 1, borderColor: C.border }}>
        <Text style={{ fontSize: 9, color: C.textDim, textAlign: 'center' }}>
          Ctrl+N New  |  Ctrl+, Settings  |  Ctrl+1-5 Tabs
        </Text>
      </Box>
    </Box>
  );
}

// ── Health indicator ─────────────────────────────────────────────────────────

function HealthDot({ healthy }: { healthy?: boolean }) {
  const color = healthy === true ? C.green : healthy === false ? C.red : C.yellow;
  const label = healthy === true ? 'Connected' : healthy === false ? 'Offline' : 'Unknown';
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: 9, color: C.textDim }}>{label}</Text>
    </Box>
  );
}

// ── Top bar ──────────────────────────────────────────────────────────────────

function TopBar({
  provider, model, models, modelsLoading, onSelectModel, onRefreshModels,
  settingsOpen, onToggleSettings, isStreaming, onStop, tokenEstimate,
  compareMode, onToggleCompare,
}: {
  provider: Provider; model: string; models: { id: string; name: string }[];
  modelsLoading: boolean; onSelectModel: (id: string) => void; onRefreshModels: () => void;
  settingsOpen: boolean; onToggleSettings: () => void; isStreaming: boolean; onStop: () => void;
  tokenEstimate: number;
  compareMode: boolean; onToggleCompare: () => void;
}) {
  return (
    <Box style={{
      padding: 10, paddingLeft: 16, paddingRight: 16,
      borderBottomWidth: 1, borderColor: C.border,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: C.bgElevated,
    }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 14 }}>{provider.icon}</Text>
          <Text style={{ fontSize: 13, color: C.text, fontWeight: 'bold' }}>{provider.name}</Text>
          <HealthDot healthy={provider.healthy} />
        </Box>
        <Box style={{ width: 200 }}>
          {modelsLoading ? (
            <Text style={{ fontSize: 12, color: C.textDim }}>Loading models...</Text>
          ) : models.length > 0 ? (
            <Select
              options={models.map(m => ({ value: m.id, label: m.name }))}
              value={model} onValueChange={onSelectModel}
            />
          ) : (
            <Text style={{ fontSize: 12, color: C.textDim }}>No models found</Text>
          )}
        </Box>
        <Pressable onPress={onRefreshModels}>
          {({ hovered }) => (
            <Text style={{ fontSize: 12, color: hovered ? C.accent : C.textDim }}>Refresh</Text>
          )}
        </Pressable>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        {tokenEstimate > 0 && (
          <Text style={{ fontSize: 10, color: C.textDim }}>{`~${tokenEstimate} tokens`}</Text>
        )}
        {isStreaming && <Btn label="Stop" color={C.red} bgColor={C.redDim} onPress={onStop} />}
        <Btn
          label="Compare"
          color={compareMode ? '#fff' : C.textMuted}
          bgColor={compareMode ? C.accent : C.surface}
          onPress={onToggleCompare}
        />
        <Btn
          label="Settings"
          color={settingsOpen ? C.accent : C.textMuted}
          bgColor={settingsOpen ? C.surfaceActive : C.surface}
          onPress={onToggleSettings}
        />
      </Box>
    </Box>
  );
}

// ── Welcome screen ───────────────────────────────────────────────────────────

function WelcomeScreen({ provider, model }: { provider: Provider; model: string }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
      <Text style={{ fontSize: 48 }}>{provider.icon}</Text>
      <Text style={{ fontSize: 22, color: C.text, fontWeight: 'bold' }}>LLM Studio</Text>
      <Text style={{ fontSize: 14, color: C.textMuted }}>
        {`Connected to ${provider.name}${model ? ` / ${model}` : ''}`}
      </Text>
      <Box style={{ gap: 6, alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: C.textDim }}>Type a message below to start chatting</Text>
        <Text style={{ fontSize: 10, color: C.textDim }}>
          Conversations are saved automatically
        </Text>
      </Box>

      {/* Quick start tips */}
      <Box style={{ gap: 8, paddingTop: 16, width: 320 }}>
        <Box style={{ padding: 10, backgroundColor: C.surface, borderRadius: 8, gap: 2 }}>
          <Text style={{ fontSize: 11, color: C.accent, fontWeight: 'bold' }}>Local Models</Text>
          <Text style={{ fontSize: 10, color: C.textDim }}>
            Start Ollama, llama.cpp, or vLLM and select it from the sidebar
          </Text>
        </Box>
        <Box style={{ padding: 10, backgroundColor: C.surface, borderRadius: 8, gap: 2 }}>
          <Text style={{ fontSize: 11, color: C.accent, fontWeight: 'bold' }}>Cloud APIs</Text>
          <Text style={{ fontSize: 10, color: C.textDim }}>
            Add your API key in Settings (Ctrl+,) for OpenAI or Anthropic
          </Text>
        </Box>
        <Box style={{ padding: 10, backgroundColor: C.surface, borderRadius: 8, gap: 2 }}>
          <Text style={{ fontSize: 11, color: C.accent, fontWeight: 'bold' }}>Custom Endpoints</Text>
          <Text style={{ fontSize: 10, color: C.textDim }}>
            Add any OpenAI-compatible server from the Providers tab
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

// ── Settings panel ───────────────────────────────────────────────────────────

function SettingsPanel({
  systemPrompt, onSystemPromptChange, temperature, onTemperatureChange,
  maxTokens, onMaxTokensChange, provider, onProviderKeyChange,
}: {
  systemPrompt: string; onSystemPromptChange: (s: string) => void;
  temperature: number; onTemperatureChange: (n: number) => void;
  maxTokens: number; onMaxTokensChange: (n: number) => void;
  provider: Provider; onProviderKeyChange: (key: string) => void;
}) {
  // Common system prompt presets
  const presets = [
    { label: 'Default', prompt: 'You are a helpful assistant.' },
    { label: 'Coder', prompt: 'You are an expert programmer. Write clean, efficient code with clear explanations. Always include the language in code blocks.' },
    { label: 'Creative', prompt: 'You are a creative writing assistant. Be vivid, expressive, and original.' },
    { label: 'Concise', prompt: 'Be concise. Answer in as few words as possible while being complete.' },
  ];

  return (
    <ScrollView style={{
      width: 280, borderLeftWidth: 1, borderColor: C.border,
      backgroundColor: C.bgSidebar,
    }}>
      <Box style={{ padding: 16, gap: 16 }}>
        <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: C.text, fontWeight: 'bold' }}>Settings</Text>
          <Text style={{ fontSize: 9, color: C.textDim }}>Ctrl+,</Text>
        </Box>

        {/* System prompt presets */}
        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: 'bold' }}>System Prompt</Text>
          <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
            {presets.map(p => (
              <Pressable key={p.label} onPress={() => onSystemPromptChange(p.prompt)}>
                {({ hovered }) => (
                  <Box style={{
                    paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 4,
                    backgroundColor: systemPrompt === p.prompt ? C.accent : hovered ? C.surfaceHover : C.surface,
                  }}>
                    <Text style={{ fontSize: 9, color: systemPrompt === p.prompt ? '#fff' : C.textMuted }}>
                      {p.label}
                    </Text>
                  </Box>
                )}
              </Pressable>
            ))}
          </Box>
          <TextInput
            value={systemPrompt} onChangeText={onSystemPromptChange}
            placeholder="You are a helpful assistant..." placeholderColor={C.textDim}
            multiline
            style={{ backgroundColor: C.bgInput, borderRadius: 6, padding: 8, minHeight: 80 }}
            textStyle={{ color: C.text, fontSize: 12 }}
          />
        </Box>

        {/* Temperature */}
        <Box style={{ gap: 4 }}>
          <Box style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: 'bold' }}>Temperature</Text>
            <Text style={{ fontSize: 11, color: C.textDim }}>{temperature.toFixed(1)}</Text>
          </Box>
          <Box style={{ flexDirection: 'row', gap: 4 }}>
            {[0, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0].map(t => (
              <Pressable key={t} onPress={() => onTemperatureChange(t)}>
                {({ hovered }) => (
                  <Box style={{
                    paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3,
                    borderRadius: 4,
                    backgroundColor: temperature === t ? C.accent : hovered ? C.surfaceHover : C.surface,
                  }}>
                    <Text style={{ fontSize: 10, color: temperature === t ? '#fff' : C.textMuted }}>
                      {t.toFixed(1)}
                    </Text>
                  </Box>
                )}
              </Pressable>
            ))}
          </Box>
        </Box>

        {/* Max tokens */}
        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: 'bold' }}>Max Tokens</Text>
          <TextInput
            value={maxTokens.toString()}
            onChangeText={(text) => { const n = parseInt(text, 10); if (!isNaN(n) && n > 0) onMaxTokensChange(n); }}
            placeholder="4096" placeholderColor={C.textDim}
            style={{ backgroundColor: C.bgInput, borderRadius: 6, padding: 8 }}
            textStyle={{ color: C.text, fontSize: 12 }}
          />
        </Box>

        {/* API Key for cloud providers */}
        {(provider.type === 'anthropic' || provider.id === 'openai') && (
          <Box style={{ gap: 4 }}>
            <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: 'bold' }}>API Key</Text>
            <TextInput
              value={provider.apiKey || ''} onChangeText={onProviderKeyChange}
              placeholder={provider.type === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
              placeholderColor={C.textDim}
              style={{ backgroundColor: C.bgInput, borderRadius: 6, padding: 8 }}
              textStyle={{ color: C.text, fontSize: 12 }}
            />
          </Box>
        )}

        {/* Connection info */}
        <Box style={{ gap: 4, paddingTop: 8, borderTopWidth: 1, borderColor: C.border }}>
          <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: 'bold' }}>Connection</Text>
          {provider.baseURL && <Text style={{ fontSize: 10, color: C.textDim }}>{provider.baseURL}</Text>}
          <Text style={{ fontSize: 10, color: C.textDim }}>{`Provider: ${provider.type}`}</Text>
          <HealthDot healthy={provider.healthy} />
        </Box>
      </Box>
    </ScrollView>
  );
}

// ── Model browser ────────────────────────────────────────────────────────────

function ModelBrowser({
  models, loading, error, activeModel, onSelectModel, onRefresh, provider,
}: {
  models: { id: string; name: string }[]; loading: boolean; error: Error | null;
  activeModel: string; onSelectModel: (id: string) => void;
  onRefresh: () => void; provider: Provider;
}) {
  const [search, setSearch] = useState('');
  const [pullModel, setPullModel] = useState('');
  const [pulling, setPulling] = useState(false);
  const [pullStatus, setPullStatus] = useState('');

  const isOllama = provider.id === 'ollama';
  const filtered = search
    ? models.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    : models;

  const handlePull = useCallback(async () => {
    if (!pullModel.trim() || !isOllama) return;
    setPulling(true);
    setPullStatus(`Pulling ${pullModel}...`);
    try {
      const baseURL = provider.baseURL || 'http://localhost:11434';
      const res = await fetch(`${baseURL}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pullModel, stream: false }),
      } as any);
      if (res.ok) {
        setPullStatus(`${pullModel} pulled successfully`);
        setPullModel('');
        onRefresh();
      } else {
        const body = await res.text();
        setPullStatus(`Failed: ${body.slice(0, 100)}`);
      }
    } catch (err: any) {
      setPullStatus(`Error: ${err.message}`);
    }
    setPulling(false);
    setTimeout(() => setPullStatus(''), 5000);
  }, [pullModel, isOllama, provider.baseURL, onRefresh]);

  const handleDelete = useCallback(async (modelName: string) => {
    if (!isOllama) return;
    try {
      const baseURL = provider.baseURL || 'http://localhost:11434';
      await fetch(`${baseURL}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      } as any);
      onRefresh();
    } catch { /* ok */ }
  }, [isOllama, provider.baseURL, onRefresh]);

  return (
    <Box style={{ flexGrow: 1, padding: 20, gap: 16 }}>
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Text style={{ fontSize: 18, color: C.text, fontWeight: 'bold' }}>Models</Text>
          <Text style={{ fontSize: 12, color: C.textMuted }}>
            {`${provider.icon} ${provider.name} - ${models.length} models available`}
          </Text>
        </Box>
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <HealthDot healthy={provider.healthy} />
          <Btn label="Refresh" color={C.accent} bgColor={C.surface} onPress={onRefresh} />
        </Box>
      </Box>

      {/* Ollama pull section */}
      {isOllama && (
        <Box style={{ padding: 12, backgroundColor: C.surface, borderRadius: 8, gap: 8 }}>
          <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: 'bold' }}>Pull Model from Ollama</Text>
          <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Box style={{ flexGrow: 1 }}>
              <TextInput
                value={pullModel} onChangeText={setPullModel}
                onSubmit={handlePull}
                placeholder="e.g. llama3, mistral, codellama:13b" placeholderColor={C.textDim}
                style={{ backgroundColor: C.bgInput, borderRadius: 6, padding: 8 }}
                textStyle={{ color: C.text, fontSize: 12 }}
              />
            </Box>
            <Btn
              label={pulling ? 'Pulling...' : 'Pull'}
              color="#fff"
              bgColor={pulling ? C.textDim : C.accent}
              onPress={handlePull}
            />
          </Box>
          {pullStatus ? (
            <Text style={{ fontSize: 10, color: pullStatus.startsWith('Error') || pullStatus.startsWith('Failed') ? C.red : C.green }}>
              {pullStatus}
            </Text>
          ) : null}
        </Box>
      )}

      <TextInput
        value={search} onChangeText={setSearch}
        placeholder="Search models..." placeholderColor={C.textDim}
        style={{ backgroundColor: C.bgInput, borderRadius: 8, padding: 10 }}
        textStyle={{ color: C.text, fontSize: 13 }}
      />

      {loading ? (
        <Box style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: C.textMuted }}>Loading models...</Text>
        </Box>
      ) : error ? (
        <Box style={{ padding: 20, backgroundColor: C.redDim, borderRadius: 8, gap: 4 }}>
          <Text style={{ fontSize: 13, color: C.red }}>{`Failed to fetch: ${error.message}`}</Text>
          <Text style={{ fontSize: 11, color: C.textDim }}>
            {`Make sure ${provider.name} is running${provider.baseURL ? ` at ${provider.baseURL}` : ''}`}
          </Text>
        </Box>
      ) : (
        <ScrollView style={{ flexGrow: 1 }}>
          <Box style={{ gap: 4 }}>
            {filtered.map(m => (
              <Pressable key={m.id} onPress={() => onSelectModel(m.id)}>
                {({ hovered }) => (
                  <Box style={{
                    padding: 12, borderRadius: 8,
                    backgroundColor: m.id === activeModel ? C.surfaceActive : hovered ? C.surfaceHover : C.surface,
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <Box>
                      <Text style={{ fontSize: 13, color: C.text, fontWeight: m.id === activeModel ? 'bold' : 'normal' }}>
                        {m.name}
                      </Text>
                      <Text style={{ fontSize: 10, color: C.textDim }}>{m.id}</Text>
                    </Box>
                    <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      {m.id === activeModel && (
                        <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 4, backgroundColor: C.accent }}>
                          <Text style={{ fontSize: 10, color: '#fff', fontWeight: 'bold' }}>Active</Text>
                        </Box>
                      )}
                      {isOllama && hovered && (
                        <Pressable onPress={() => handleDelete(m.id)}>
                          {({ pressed: dp }) => (
                            <Box style={{
                              paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
                              borderRadius: 4, backgroundColor: dp ? C.red : C.redDim,
                            }}>
                              <Text style={{ fontSize: 9, color: C.red, fontWeight: 'bold' }}>Delete</Text>
                            </Box>
                          )}
                        </Pressable>
                      )}
                    </Box>
                  </Box>
                )}
              </Pressable>
            ))}
          </Box>
        </ScrollView>
      )}
    </Box>
  );
}

// ── Provider manager ─────────────────────────────────────────────────────────

function ProviderManager({
  providers, activeId, onSelect, onAdd, onRemove, onUpdateKey,
}: {
  providers: Provider[]; activeId: string; onSelect: (id: string) => void;
  onAdd: () => void; onRemove: (id: string) => void;
  onUpdateKey: (id: string, key: string) => void;
}) {
  return (
    <Box style={{ flexGrow: 1, padding: 20, gap: 16 }}>
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Text style={{ fontSize: 18, color: C.text, fontWeight: 'bold' }}>Providers</Text>
          <Text style={{ fontSize: 12, color: C.textMuted }}>Manage local and cloud AI providers</Text>
        </Box>
        <Btn label="+ Add Provider" color="#fff" bgColor={C.accent} onPress={onAdd} />
      </Box>

      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ gap: 8 }}>
          {providers.map(p => {
            const isLocal = ['ollama', 'llamacpp', 'vllm', 'lmstudio'].includes(p.id);
            return (
              <Box key={p.id} style={{
                padding: 16, borderRadius: 10, backgroundColor: C.surface,
                borderWidth: p.id === activeId ? 2 : 1,
                borderColor: p.id === activeId ? C.accent : C.border, gap: 8,
              }}>
                <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 20 }}>{p.icon}</Text>
                    <Box>
                      <Text style={{ fontSize: 14, color: C.text, fontWeight: 'bold' }}>{p.name}</Text>
                      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, color: C.textDim }}>
                          {isLocal ? `Local - ${p.baseURL}` : `Cloud - ${p.type}`}
                        </Text>
                        <HealthDot healthy={p.healthy} />
                      </Box>
                    </Box>
                  </Box>
                  <Box style={{ flexDirection: 'row', gap: 6 }}>
                    <Btn
                      label={p.id === activeId ? 'Active' : 'Use'}
                      color={p.id === activeId ? '#fff' : C.textMuted}
                      bgColor={p.id === activeId ? C.accent : C.surfaceHover}
                      onPress={() => onSelect(p.id)}
                    />
                    {p.id.startsWith('custom_') && (
                      <Btn label="Remove" color={C.red} bgColor={C.redDim} onPress={() => onRemove(p.id)} />
                    )}
                  </Box>
                </Box>
                {!isLocal && (
                  <Box style={{ gap: 4 }}>
                    <Text style={{ fontSize: 11, color: C.textMuted }}>API Key</Text>
                    <TextInput
                      value={p.apiKey || ''} onChangeText={(key) => onUpdateKey(p.id, key)}
                      placeholder="Enter API key..." placeholderColor={C.textDim}
                      style={{ backgroundColor: C.bgInput, borderRadius: 6, padding: 6 }}
                      textStyle={{ color: C.text, fontSize: 12 }}
                    />
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </ScrollView>
    </Box>
  );
}

// ── Server panel ─────────────────────────────────────────────────────────────

function ServerPanel({
  serverEnabled, onToggleServer, serverPort, onPortChange,
  serverReady, requests, provider, model, onStopServer,
}: {
  serverEnabled: boolean; onToggleServer: () => void;
  serverPort: number; onPortChange: (p: number) => void;
  serverReady: boolean; requests: any[];
  provider: Provider; model: string; onStopServer: () => void;
}) {
  return (
    <Box style={{ flexGrow: 1, padding: 20, gap: 16 }}>
      {/* Header */}
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Text style={{ fontSize: 18, color: C.text, fontWeight: 'bold' }}>API Server</Text>
          <Text style={{ fontSize: 12, color: C.textMuted }}>
            Serve your models as an OpenAI-compatible API
          </Text>
        </Box>
        <Pressable onPress={onToggleServer}>
          {({ hovered }) => (
            <Box style={{
              paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8,
              borderRadius: 8,
              backgroundColor: serverEnabled
                ? (hovered ? '#c0392b' : C.red)
                : (hovered ? C.greenDim : C.green),
            }}>
              <Text style={{ fontSize: 13, color: '#fff', fontWeight: 'bold' }}>
                {serverEnabled ? 'Stop Server' : 'Start Server'}
              </Text>
            </Box>
          )}
        </Pressable>
      </Box>

      {/* Status */}
      <Box style={{ padding: 16, backgroundColor: C.surface, borderRadius: 10, gap: 12 }}>
        <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: C.text, fontWeight: 'bold' }}>Status</Text>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Box style={{
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: serverReady ? C.green : serverEnabled ? C.yellow : C.red,
            }} />
            <Text style={{ fontSize: 12, color: serverReady ? C.green : serverEnabled ? C.yellow : C.textDim }}>
              {serverReady ? 'Running' : serverEnabled ? 'Starting...' : 'Stopped'}
            </Text>
          </Box>
        </Box>

        {/* Port config */}
        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: 'bold' }}>Port</Text>
          <TextInput
            value={serverPort.toString()}
            onChangeText={(text) => { const n = parseInt(text, 10); if (!isNaN(n) && n > 0 && n < 65536) onPortChange(n); }}
            placeholder="5001" placeholderColor={C.textDim}
            style={{ backgroundColor: C.bgInput, borderRadius: 6, padding: 8 }}
            textStyle={{ color: C.text, fontSize: 13 }}
          />
        </Box>

        {/* Active provider + model */}
        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: 'bold' }}>Proxying To</Text>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 14 }}>{provider.icon}</Text>
            <Text style={{ fontSize: 13, color: C.text }}>{provider.name}</Text>
            {model && <Text style={{ fontSize: 11, color: C.textDim }}>{`/ ${model}`}</Text>}
          </Box>
          {provider.baseURL && (
            <Text style={{ fontSize: 10, color: C.textDim }}>{provider.baseURL}</Text>
          )}
        </Box>
      </Box>

      {/* Endpoints */}
      <Box style={{ padding: 16, backgroundColor: C.surface, borderRadius: 10, gap: 8 }}>
        <Text style={{ fontSize: 13, color: C.text, fontWeight: 'bold' }}>Endpoints</Text>
        <Text style={{ fontSize: 11, color: C.textMuted }}>
          Other apps can connect using these URLs:
        </Text>
        {[
          { method: 'GET', path: '/v1/models', desc: 'List available models' },
          { method: 'POST', path: '/v1/chat/completions', desc: 'Chat completions (streaming supported)' },
          { method: 'POST', path: '/v1/completions', desc: 'Legacy completions' },
        ].map(ep => (
          <Box key={ep.path} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingTop: 4 }}>
            <Box style={{
              paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
              borderRadius: 4, backgroundColor: ep.method === 'GET' ? '#1a3a2a' : '#1a2a3a',
            }}>
              <Text style={{ fontSize: 9, color: ep.method === 'GET' ? C.green : '#5dade2', fontWeight: 'bold' }}>
                {ep.method}
              </Text>
            </Box>
            <Box>
              <Text style={{ fontSize: 12, color: C.accent, fontFamily: 'monospace' }}>
                {`http://localhost:${serverPort}${ep.path}`}
              </Text>
              <Text style={{ fontSize: 10, color: C.textDim }}>{ep.desc}</Text>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Usage example */}
      <Box style={{ padding: 16, backgroundColor: C.surface, borderRadius: 10, gap: 8 }}>
        <Text style={{ fontSize: 13, color: C.text, fontWeight: 'bold' }}>Usage</Text>
        <Text style={{ fontSize: 11, color: C.textMuted }}>Connect from any OpenAI-compatible client:</Text>
        <CodeBlock
          code={`curl http://localhost:${serverPort}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model || 'your-model'}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}
          language="bash"
          style={{ borderRadius: 6 }}
        />
        <Text style={{ fontSize: 11, color: C.textMuted, paddingTop: 4 }}>Python (OpenAI SDK):</Text>
        <CodeBlock
          code={`from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:${serverPort}/v1",
    api_key="not-needed"  # for local models
)

response = client.chat.completions.create(
    model="${model || 'your-model'}",
    messages=[{"role": "user", "content": "Hello!"}]
)`}
          language="python"
          style={{ borderRadius: 6 }}
        />
      </Box>

      {/* Request log */}
      {requests.length > 0 && (
        <Box style={{ padding: 16, backgroundColor: C.surface, borderRadius: 10, gap: 8 }}>
          <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: C.text, fontWeight: 'bold' }}>Request Log</Text>
            <Text style={{ fontSize: 10, color: C.textDim }}>{`${requests.length} requests`}</Text>
          </Box>
          <ScrollView style={{ maxHeight: 200 }}>
            <Box style={{ gap: 4 }}>
              {requests.slice(0, 20).map((req, i) => (
                <Box key={i} style={{
                  flexDirection: 'row', gap: 8, alignItems: 'center',
                  padding: 6, backgroundColor: C.bgInput, borderRadius: 4,
                }}>
                  <Box style={{
                    paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1,
                    borderRadius: 3, backgroundColor: req.method === 'GET' ? '#1a3a2a' : '#1a2a3a',
                  }}>
                    <Text style={{ fontSize: 8, color: req.method === 'GET' ? C.green : '#5dade2', fontWeight: 'bold' }}>
                      {req.method}
                    </Text>
                  </Box>
                  <Text style={{ fontSize: 11, color: C.text }}>{req.path}</Text>
                </Box>
              ))}
            </Box>
          </ScrollView>
        </Box>
      )}
    </Box>
  );
}

// ── Compare mode: side-by-side multi-model chat ─────────────────────────────

function CompareView({
  models, compareModels, onSetCompareModels, provider,
  systemPrompt, temperature, maxTokens, onPickResponse,
}: {
  models: { id: string; name: string }[];
  compareModels: string[];
  onSetCompareModels: (ids: string[]) => void;
  provider: Provider;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  onPickResponse: (modelId: string, messages: Message[]) => void;
}) {
  const [sharedInput, setSharedInput] = useState('');
  const [sendSignal, setSendSignal] = useState(0); // increment to trigger all columns

  const toggleModel = useCallback((id: string) => {
    onSetCompareModels(
      compareModels.includes(id)
        ? compareModels.filter(m => m !== id)
        : compareModels.length < 8 ? [...compareModels, id] : compareModels
    );
  }, [compareModels, onSetCompareModels]);

  const sendToAll = useCallback(() => {
    if (!sharedInput.trim() || compareModels.length === 0) return;
    setSendSignal(s => s + 1);
    setSharedInput('');
  }, [sharedInput, compareModels.length]);

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
      {/* Model selector strip */}
      <Box style={{ padding: 8, borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.bgElevated }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: 'bold' }}>Models:</Text>
          {models.map(m => {
            const selected = compareModels.includes(m.id);
            return (
              <Pressable key={m.id} onPress={() => toggleModel(m.id)}>
                {({ hovered }) => (
                  <Box style={{
                    paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
                    borderRadius: 4, borderWidth: 1,
                    borderColor: selected ? C.accent : C.border,
                    backgroundColor: selected ? C.accentDim : hovered ? C.surfaceHover : 'transparent',
                  }}>
                    <Text style={{ fontSize: 10, color: selected ? C.text : C.textMuted }}>
                      {m.name}
                    </Text>
                  </Box>
                )}
              </Pressable>
            );
          })}
          <Text style={{ fontSize: 9, color: C.textDim }}>
            {`${compareModels.length}/8 selected`}
          </Text>
        </Box>
      </Box>

      {/* Side-by-side columns */}
      {compareModels.length === 0 ? (
        <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 16, color: C.textMuted }}>Select models to compare</Text>
          <Text style={{ fontSize: 12, color: C.textDim }}>
            Pick 2-8 models above, then type a message below
          </Text>
        </Box>
      ) : (
        <Box style={{ flexGrow: 1, flexDirection: 'row' }}>
          {compareModels.map((modelId, idx) => (
            <CompareChatColumn
              key={modelId}
              modelId={modelId}
              modelName={models.find(m => m.id === modelId)?.name || modelId}
              provider={provider}
              systemPrompt={systemPrompt}
              temperature={temperature}
              maxTokens={maxTokens}
              sharedInput={sharedInput}
              sendSignal={sendSignal}
              isLast={idx === compareModels.length - 1}
              onPick={onPickResponse}
              columnColor={COMPARE_COLORS[idx % COMPARE_COLORS.length]}
            />
          ))}
        </Box>
      )}

      {/* Shared input bar */}
      <Box style={{ padding: 12, borderTopWidth: 1, borderColor: C.border, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Box style={{ flexGrow: 1 }}>
          <TextInput
            value={sharedInput}
            onChangeText={setSharedInput}
            onSubmit={sendToAll}
            placeholder={`Message ${compareModels.length} models simultaneously...`}
            placeholderColor={C.textDim}
            style={{ backgroundColor: C.bgInput, borderRadius: 8, padding: 10 }}
            textStyle={{ color: C.text, fontSize: 13 }}
          />
        </Box>
        <Pressable onPress={sendToAll}>
          {({ hovered }) => (
            <Box style={{
              paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8,
              borderRadius: 8,
              backgroundColor: compareModels.length > 0 ? (hovered ? C.accentHover : C.accent) : C.surface,
            }}>
              <Text style={{ fontSize: 13, color: '#fff', fontWeight: 'bold' }}>
                {`Send to ${compareModels.length}`}
              </Text>
            </Box>
          )}
        </Pressable>
      </Box>
    </Box>
  );
}

const COMPARE_COLORS = ['#6c5ce7', '#00b894', '#e17055', '#0984e3', '#fdcb6e', '#e84393', '#00cec9', '#636e72'];

function CompareChatColumn({
  modelId, modelName, provider, systemPrompt, temperature, maxTokens,
  sharedInput, sendSignal, isLast, onPick, columnColor,
}: {
  modelId: string;
  modelName: string;
  provider: Provider;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  sharedInput: string;
  sendSignal: number;
  isLast: boolean;
  onPick: (modelId: string, messages: Message[]) => void;
  columnColor: string;
}) {
  const chat = useChat({
    provider: provider.type,
    model: modelId,
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
    temperature,
    maxTokens,
    systemPrompt,
  });

  const lastSignal = useRef(0);

  // Send when signal changes (shared input broadcast)
  useEffect(() => {
    if (sendSignal > lastSignal.current && sharedInput.trim()) {
      lastSignal.current = sendSignal;
      chat.send(sharedInput);
    }
  }, [sendSignal]);

  // Get latest assistant message for the "pick" action
  const lastAssistant = useMemo(() => {
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      if (chat.messages[i].role === 'assistant') return chat.messages[i];
    }
    return null;
  }, [chat.messages]);

  return (
    <Box style={{
      flexGrow: 1, flexDirection: 'column',
      borderRightWidth: isLast ? 0 : 1, borderColor: C.border,
    }}>
      {/* Column header */}
      <Box style={{
        padding: 8, borderBottomWidth: 2, borderColor: columnColor,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: C.bgElevated,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: columnColor }} />
          <Text style={{ fontSize: 11, color: C.text, fontWeight: 'bold' }} numberOfLines={1}>
            {modelName}
          </Text>
        </Box>
        <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
          {chat.isStreaming && (
            <Text style={{ fontSize: 9, color: C.yellow }}>streaming...</Text>
          )}
          {lastAssistant && !chat.isStreaming && (
            <Pressable onPress={() => onPick(modelId, chat.messages)}>
              {({ hovered }) => (
                <Box style={{
                  paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2,
                  borderRadius: 4,
                  backgroundColor: hovered ? C.green : C.greenDim,
                }}>
                  <Text style={{ fontSize: 9, color: hovered ? '#fff' : C.green, fontWeight: 'bold' }}>
                    Pick
                  </Text>
                </Box>
              )}
            </Pressable>
          )}
        </Box>
      </Box>

      {/* Messages */}
      {chat.messages.length === 0 ? (
        <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: C.textDim }}>Waiting for input...</Text>
        </Box>
      ) : (
        <ScrollView style={{ flexGrow: 1 }}>
          <Box style={{ padding: 8, gap: 6 }}>
            {chat.messages.map((msg, i) => {
              if (msg.role === 'system' || msg.role === 'tool') return null;
              const text = typeof msg.content === 'string'
                ? msg.content
                : msg.content.map(b => b.text || '').join('');
              const isUser = msg.role === 'user';
              return (
                <Box key={i} style={{
                  padding: 8, borderRadius: 6, gap: 4,
                  backgroundColor: isUser ? C.surfaceActive : C.surface,
                }}>
                  <Text style={{ fontSize: 9, color: C.textDim, fontWeight: 'bold' }}>
                    {isUser ? 'You' : modelName}
                  </Text>
                  {parseMarkdown(text).map((part, pi) => {
                    if (part.type === 'code') {
                      return <CodeBlock key={pi} code={part.content} language={part.language} style={{ borderRadius: 4 }} />;
                    }
                    return (
                      <Text key={pi} style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>
                        {part.content}
                      </Text>
                    );
                  })}
                </Box>
              );
            })}
            {chat.isStreaming && (
              <Box style={{ padding: 4 }}>
                <Text style={{ fontSize: 10, color: columnColor }}>...</Text>
              </Box>
            )}
          </Box>
        </ScrollView>
      )}

      {/* Error display */}
      {chat.error && (
        <Box style={{ padding: 6, backgroundColor: C.redDim }}>
          <Text style={{ fontSize: 10, color: C.red }} numberOfLines={2}>
            {chat.error.message}
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ── Conversation rename input ─────────────────────────────────────────────────

function ConvoRenameInput({ initialTitle, onCommit, onCancel }: {
  initialTitle: string; onCommit: (title: string) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  return (
    <TextInput
      value={title} onChangeText={setTitle}
      onSubmit={() => onCommit(title.trim() || initialTitle)}
      autoFocus
      style={{ backgroundColor: C.bgInput, borderRadius: 4, padding: 4 }}
      textStyle={{ color: C.text, fontSize: 12 }}
    />
  );
}

// ── Pop-out chat window ──────────────────────────────────────────────────────

function PopOutChatWindow({ conversation, provider, systemPrompt, temperature, maxTokens, onClose }: {
  conversation: ConversationRecord;
  provider: Provider;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  onClose: () => void;
}) {
  const chat = useChat({
    provider: provider.type,
    model: conversation.model,
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
    temperature,
    maxTokens,
    systemPrompt,
    initialMessages: conversation.messages,
  });

  return (
    <Window
      title={`LLM Studio - ${conversation.title}`}
      width={700} height={550}
      onClose={onClose}
    >
      <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg, flexDirection: 'column' }}>
        {/* Header */}
        <Box style={{
          padding: 10, borderBottomWidth: 1, borderColor: C.border,
          backgroundColor: C.bgElevated, flexDirection: 'row', alignItems: 'center', gap: 8,
        }}>
          <Text style={{ fontSize: 14 }}>{provider.icon}</Text>
          <Text style={{ fontSize: 13, color: C.text, fontWeight: 'bold' }}>{conversation.title}</Text>
          <Text style={{ fontSize: 10, color: C.textDim }}>{conversation.model}</Text>
          {chat.isStreaming && <Text style={{ fontSize: 9, color: C.yellow }}>streaming...</Text>}
        </Box>

        {/* Messages */}
        <ScrollView style={{ flexGrow: 1 }}>
          <Box style={{ padding: 8, gap: 6 }}>
            {chat.messages.map((msg, i) => {
              if (msg.role === 'system' || msg.role === 'tool') return null;
              const text = typeof msg.content === 'string'
                ? msg.content
                : msg.content.map(b => b.text || '').join('');
              const isUser = msg.role === 'user';
              return (
                <Box key={i} style={{
                  paddingLeft: isUser ? 40 : 8, paddingRight: isUser ? 8 : 40,
                  paddingTop: 4, paddingBottom: 4,
                }}>
                  <Text style={{ fontSize: 9, color: C.textDim, fontWeight: 'bold', paddingBottom: 2 }}>
                    {isUser ? 'You' : 'Assistant'}
                  </Text>
                  <Box style={{
                    padding: 10, borderRadius: 8, gap: 4,
                    backgroundColor: isUser ? C.surfaceActive : C.surface,
                  }}>
                    {parseMarkdown(text).map((part, pi) => {
                      if (part.type === 'code') {
                        return <CodeBlock key={pi} code={part.content} language={part.language} style={{ borderRadius: 4 }} />;
                      }
                      return (
                        <Text key={pi} style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>
                          {part.content}
                        </Text>
                      );
                    })}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </ScrollView>

        {/* Input */}
        <Box style={{ padding: 10, borderTopWidth: 1, borderColor: C.border }}>
          <AIChatInput
            send={(text) => chat.send(text)}
            isLoading={chat.isLoading}
            placeholder={`Message ${provider.name} / ${conversation.model}...`}
            sendColor={C.accent} autoFocus
          />
        </Box>

        {/* Error */}
        {chat.error && (
          <Box style={{ padding: 6, backgroundColor: C.redDim }}>
            <Text style={{ fontSize: 10, color: C.red }}>{chat.error.message}</Text>
          </Box>
        )}
      </Box>
    </Window>
  );
}

// ── File context button ──────────────────────────────────────────────────────

function FileContextButton({ onAddFile }: { onAddFile: (name: string, content: string) => void }) {
  const [showModal, setShowModal] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');

  const handleAdd = useCallback(() => {
    if (!fileName.trim() || !fileContent.trim()) return;
    onAddFile(fileName.trim(), fileContent);
    setFileName('');
    setFileContent('');
    setShowModal(false);
  }, [fileName, fileContent, onAddFile]);

  return (
    <>
      <Pressable onPress={() => setShowModal(true)}>
        {({ hovered }) => (
          <Box style={{
            paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8,
            borderRadius: 8, backgroundColor: hovered ? C.surfaceHover : C.surface,
          }}>
            <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: 'bold' }}>+ File</Text>
          </Box>
        )}
      </Pressable>
      {showModal && (
        <Modal visible onClose={() => setShowModal(false)}>
          <Box style={{ width: 500, backgroundColor: C.bgElevated, borderRadius: 12, padding: 20, gap: 12 }}>
            <Text style={{ fontSize: 16, color: C.text, fontWeight: 'bold' }}>Add File Context</Text>
            <Text style={{ fontSize: 11, color: C.textMuted }}>
              Paste file content below. It will be included in the system prompt as context for the AI.
            </Text>
            <LabeledInput label="File Name" value={fileName} onChange={setFileName} placeholder="e.g. main.py, data.json" />
            <Box style={{ gap: 4 }}>
              <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: 'bold' }}>Content</Text>
              <TextInput
                value={fileContent} onChangeText={setFileContent}
                multiline
                placeholder="Paste file content here..."
                placeholderColor={C.textDim}
                style={{ backgroundColor: C.bgInput, borderRadius: 6, padding: 8, minHeight: 200 }}
                textStyle={{ color: C.text, fontSize: 12, fontFamily: 'monospace' }}
              />
            </Box>
            <Box style={{ flexDirection: 'row', gap: 8, justifyContent: 'end' }}>
              <Btn label="Cancel" color={C.textMuted} bgColor={C.surface} onPress={() => setShowModal(false)} />
              <Btn label="Add File" color="#fff" bgColor={C.accent} onPress={handleAdd} />
            </Box>
          </Box>
        </Modal>
      )}
    </>
  );
}

// ── Shared small components ──────────────────────────────────────────────────

function NavTab({ label, active, onPress, hint }: { label: string; active: boolean; onPress: () => void; hint?: string }) {
  return (
    <Pressable onPress={onPress}>
      {({ hovered }) => (
        <Box style={{
          paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: 6,
          backgroundColor: active ? C.surfaceActive : hovered ? C.surfaceHover : 'transparent',
          flexDirection: 'row', gap: 4, alignItems: 'center',
        }}>
          <Text style={{ fontSize: 11, color: active ? C.text : C.textMuted, fontWeight: active ? 'bold' : 'normal' }}>
            {label}
          </Text>
          {hint && <Text style={{ fontSize: 8, color: C.textDim }}>{hint}</Text>}
        </Box>
      )}
    </Pressable>
  );
}

function Btn({ label, color, bgColor, onPress }: { label: string; color: string; bgColor: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      {({ pressed, hovered }) => (
        <Box style={{
          paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5, borderRadius: 6,
          backgroundColor: pressed ? C.surfaceActive : hovered ? C.surfaceHover : bgColor,
        }}>
          <Text style={{ fontSize: 11, color, fontWeight: 'bold' }}>{label}</Text>
        </Box>
      )}
    </Pressable>
  );
}

function LabeledInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (s: string) => void; placeholder: string;
}) {
  return (
    <Box style={{ gap: 4 }}>
      <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: 'bold' }}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderColor={C.textDim}
        style={{ backgroundColor: C.bgInput, borderRadius: 6, padding: 8 }}
        textStyle={{ color: C.text, fontSize: 13 }}
      />
    </Box>
  );
}
