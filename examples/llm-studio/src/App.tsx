/**
 * LLM Studio — Local model runner + API provider hub.
 *
 * Replaces LM Studio with a ReactJIT-native app that:
 * - Connects to local inference (Ollama, llama.cpp, vLLM) via OpenAI-compatible API
 * - Connects to cloud providers (OpenAI, Anthropic)
 * - Persistent conversations (in-memory for now, SQLite-ready)
 * - Model browser, settings, system prompts
 * - Streaming chat with tool support
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box, Text, Pressable, ScrollView, TextInput, Modal, Select,
} from '@reactjit/core';
import { useChat, useModels, type AIProviderType, type Message } from '@reactjit/ai';
import { AIMessageList, AIChatInput } from '@reactjit/ai';

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
  red: '#ff4757',
  redDim: '#3a1a1a',
};

// ── Types ────────────────────────────────────────────────────────────────────

interface Provider {
  id: string;
  name: string;
  type: AIProviderType;
  baseURL?: string;
  apiKey?: string;
  icon: string;
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

type View = 'chat' | 'providers' | 'models';

// ── App ──────────────────────────────────────────────────────────────────────

export function App() {
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

  const activeProvider = providers.find(p => p.id === activeProviderId) || providers[0];

  // ── Model fetching ───────────────────────────────────
  const { models, loading: modelsLoading, error: modelsError, refetch: refetchModels } = useModels({
    provider: activeProvider.type,
    baseURL: activeProvider.baseURL,
    apiKey: activeProvider.apiKey,
  });

  useEffect(() => {
    if (models.length > 0 && !activeModel) setActiveModel(models[0].id);
  }, [models, activeModel]);

  useEffect(() => { setActiveModel(''); }, [activeProviderId]);

  // ── Chat hook ────────────────────────────────────────
  const chat = useChat({
    provider: activeProvider.type,
    model: activeModel,
    apiKey: activeProvider.apiKey,
    baseURL: activeProvider.baseURL,
    temperature,
    maxTokens,
    systemPrompt,
    initialMessages: activeConvoId
      ? conversations.find(c => c.id === activeConvoId)?.messages || []
      : [],
  });

  // ── Conversation management ──────────────────────────
  const newConversation = useCallback(() => {
    const id = `conv_${Date.now().toString(36)}`;
    const convo: ConversationRecord = {
      id, title: 'New Chat', providerId: activeProviderId,
      model: activeModel, messages: [], systemPrompt, updatedAt: Date.now(),
    };
    setConversations(prev => [convo, ...prev]);
    setActiveConvoId(id);
    chat.setMessages([]);
  }, [activeProviderId, activeModel, systemPrompt, chat]);

  useEffect(() => {
    if (activeConvoId && chat.messages.length > 0) {
      setConversations(prev => prev.map(c => {
        if (c.id !== activeConvoId) return c;
        const firstUser = chat.messages.find(m => m.role === 'user');
        const title = firstUser && typeof firstUser.content === 'string'
          ? firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? '...' : '')
          : c.title;
        return { ...c, title, messages: chat.messages, updatedAt: Date.now() };
      }));
    }
  }, [chat.messages, activeConvoId]);

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

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvoId === id) { setActiveConvoId(null); chat.setMessages([]); }
  }, [activeConvoId, chat]);

  // ── Provider modal state ─────────────────────────────
  const [newPName, setNewPName] = useState('');
  const [newPURL, setNewPURL] = useState('');
  const [newPKey, setNewPKey] = useState('');
  const [newPType, setNewPType] = useState<AIProviderType>('openai');

  const addProvider = useCallback(() => {
    if (!newPName || !newPURL) return;
    const id = `custom_${Date.now().toString(36)}`;
    setProviders(prev => [...prev, {
      id, name: newPName, type: newPType,
      baseURL: newPURL, apiKey: newPKey || undefined, icon: '\u{1F517}',
    }]);
    setNewPName(''); setNewPURL(''); setNewPKey('');
    setProviderModalOpen(false);
  }, [newPName, newPURL, newPKey, newPType]);

  return (
    <Box style={{ width: '100%', height: '100%', flexDirection: 'row', backgroundColor: C.bg }}>
      {/* ── Left sidebar ── */}
      <Sidebar
        providers={providers} activeProviderId={activeProviderId}
        onSelectProvider={setActiveProviderId}
        conversations={conversations} activeConvoId={activeConvoId}
        onSelectConvo={selectConversation} onNewChat={newConversation}
        onDeleteConvo={deleteConversation}
        view={view} onSetView={setView}
        onAddProvider={() => setProviderModalOpen(true)}
      />

      {/* ── Main content ── */}
      <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
        <TopBar
          provider={activeProvider} model={activeModel}
          models={models} modelsLoading={modelsLoading}
          onSelectModel={setActiveModel} onRefreshModels={refetchModels}
          settingsOpen={settingsOpen} onToggleSettings={() => setSettingsOpen(v => !v)}
          isStreaming={chat.isStreaming} onStop={chat.stop}
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
                  <WelcomeScreen provider={activeProvider} model={activeModel} />
                ) : (
                  <AIMessageList messages={chat.messages} isStreaming={chat.isStreaming} style={{ flexGrow: 1 }} />
                )}
                <Box style={{ padding: 12, borderTopWidth: 1, borderColor: C.border }}>
                  <AIChatInput
                    send={chat.send} isLoading={chat.isLoading}
                    placeholder={`Message ${activeProvider.name}${activeModel ? ` / ${activeModel}` : ''}...`}
                    sendColor={C.accent} autoFocus
                  />
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

          {view === 'models' && (
            <ModelBrowser
              models={models} loading={modelsLoading} error={modelsError}
              activeModel={activeModel}
              onSelectModel={(id) => { setActiveModel(id); setView('chat'); }}
              onRefresh={refetchModels} provider={activeProvider}
            />
          )}

          {view === 'providers' && (
            <ProviderManager
              providers={providers} activeId={activeProviderId}
              onSelect={setActiveProviderId}
              onAdd={() => setProviderModalOpen(true)}
              onRemove={(id) => setProviders(prev => prev.filter(p => p.id !== id))}
              onUpdateKey={(id, key) => {
                setProviders(prev => prev.map(p => p.id === id ? { ...p, apiKey: key } : p));
              }}
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
    </Box>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  providers, activeProviderId, onSelectProvider,
  conversations, activeConvoId, onSelectConvo, onNewChat, onDeleteConvo,
  view, onSetView, onAddProvider,
}: {
  providers: Provider[]; activeProviderId: string; onSelectProvider: (id: string) => void;
  conversations: ConversationRecord[]; activeConvoId: string | null;
  onSelectConvo: (id: string) => void; onNewChat: () => void; onDeleteConvo: (id: string) => void;
  view: View; onSetView: (v: View) => void; onAddProvider: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  return (
    <Box style={{ width: 260, borderRightWidth: 1, borderColor: C.border, backgroundColor: C.bgSidebar, flexDirection: 'column' }}>
      <Box style={{ padding: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 18, color: C.text, fontWeight: 'bold' }}>LLM Studio</Text>
        <Text style={{ fontSize: 11, color: C.textDim }}>Local & Cloud AI</Text>
      </Box>

      {/* Nav tabs */}
      <Box style={{ flexDirection: 'row', paddingLeft: 8, paddingRight: 8, gap: 4, paddingBottom: 8 }}>
        <NavTab label="Chat" active={view === 'chat'} onPress={() => onSetView('chat')} />
        <NavTab label="Models" active={view === 'models'} onPress={() => onSetView('models')} />
        <NavTab label="Providers" active={view === 'providers'} onPress={() => onSetView('providers')} />
      </Box>

      {/* Provider selector */}
      <Box style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 8 }}>
        <Select
          options={providers.map(p => ({ value: p.id, label: `${p.icon} ${p.name}` }))}
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
              backgroundColor: pressed ? C.accentDim : hovered ? C.accentHover : C.accent,
            }}>
              <Text style={{ fontSize: 13, color: '#fff', fontWeight: 'bold' }}>+ New Chat</Text>
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
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <Box style={{ flexGrow: 1 }}>
                    <Text style={{ fontSize: 13, color: convo.id === activeConvoId ? C.text : C.textMuted }} numberOfLines={1}>
                      {convo.title}
                    </Text>
                    <Text style={{ fontSize: 10, color: C.textDim }}>{convo.model || 'no model'}</Text>
                  </Box>
                  {hovered && (
                    <Pressable onPress={() => onDeleteConvo(convo.id)}>
                      {({ pressed: dp }) => (
                        <Text style={{ fontSize: 12, color: dp ? C.red : C.textDim }}>x</Text>
                      )}
                    </Pressable>
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
    </Box>
  );
}

// ── Top bar ──────────────────────────────────────────────────────────────────

function TopBar({
  provider, model, models, modelsLoading, onSelectModel, onRefreshModels,
  settingsOpen, onToggleSettings, isStreaming, onStop,
}: {
  provider: Provider; model: string; models: { id: string; name: string }[];
  modelsLoading: boolean; onSelectModel: (id: string) => void; onRefreshModels: () => void;
  settingsOpen: boolean; onToggleSettings: () => void; isStreaming: boolean; onStop: () => void;
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
        {isStreaming && <Btn label="Stop" color={C.red} bgColor={C.redDim} onPress={onStop} />}
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
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
      <Text style={{ fontSize: 48 }}>{provider.icon}</Text>
      <Text style={{ fontSize: 22, color: C.text, fontWeight: 'bold' }}>LLM Studio</Text>
      <Text style={{ fontSize: 14, color: C.textMuted }}>
        {`Connected to ${provider.name}${model ? ` / ${model}` : ''}`}
      </Text>
      <Text style={{ fontSize: 12, color: C.textDim }}>Start a conversation below</Text>
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
  return (
    <Box style={{
      width: 280, borderLeftWidth: 1, borderColor: C.border,
      backgroundColor: C.bgSidebar, padding: 16, gap: 16,
    }}>
      <Text style={{ fontSize: 14, color: C.text, fontWeight: 'bold' }}>Settings</Text>

      <Box style={{ gap: 4 }}>
        <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: 'bold' }}>System Prompt</Text>
        <TextInput
          value={systemPrompt} onChangeText={onSystemPromptChange}
          placeholder="You are a helpful assistant..." placeholderColor={C.textDim}
          multiline
          style={{ backgroundColor: C.bgInput, borderRadius: 6, padding: 8, minHeight: 80 }}
          textStyle={{ color: C.text, fontSize: 12 }}
        />
      </Box>

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

      <Box style={{ gap: 4, paddingTop: 8, borderTopWidth: 1, borderColor: C.border }}>
        <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: 'bold' }}>Connection</Text>
        {provider.baseURL && <Text style={{ fontSize: 10, color: C.textDim }}>{provider.baseURL}</Text>}
        <Text style={{ fontSize: 10, color: C.textDim }}>{`Provider type: ${provider.type}`}</Text>
      </Box>
    </Box>
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
  const filtered = search
    ? models.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    : models;

  return (
    <Box style={{ flexGrow: 1, padding: 20, gap: 16 }}>
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Text style={{ fontSize: 18, color: C.text, fontWeight: 'bold' }}>Models</Text>
          <Text style={{ fontSize: 12, color: C.textMuted }}>
            {`${provider.icon} ${provider.name} - ${models.length} models available`}
          </Text>
        </Box>
        <Btn label="Refresh" color={C.accent} bgColor={C.surface} onPress={onRefresh} />
      </Box>

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
        <Box style={{ padding: 20, backgroundColor: C.redDim, borderRadius: 8 }}>
          <Text style={{ fontSize: 13, color: C.red }}>{`Failed to fetch: ${error.message}`}</Text>
          <Text style={{ fontSize: 11, color: C.textDim, paddingTop: 4 }}>
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
                    {m.id === activeModel && (
                      <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 4, backgroundColor: C.accent }}>
                        <Text style={{ fontSize: 10, color: '#fff', fontWeight: 'bold' }}>Active</Text>
                      </Box>
                    )}
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
                      <Text style={{ fontSize: 10, color: C.textDim }}>
                        {isLocal ? `Local - ${p.baseURL}` : `Cloud - ${p.type}`}
                      </Text>
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

// ── Shared small components ──────────────────────────────────────────────────

function NavTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      {({ hovered }) => (
        <Box style={{
          paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: 6,
          backgroundColor: active ? C.surfaceActive : hovered ? C.surfaceHover : 'transparent',
        }}>
          <Text style={{ fontSize: 11, color: active ? C.text : C.textMuted, fontWeight: active ? 'bold' : 'normal' }}>
            {label}
          </Text>
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
