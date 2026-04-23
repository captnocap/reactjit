import type { AIProviderType } from '../../../lib/ai/types';
import { getKeyForProvider } from '../../../lib/ai/keys';
import { useChat } from '../../../hooks/ai/useChat';
import {
  createSession,
  defaultSessionTitle,
  ensureSessionStore,
  exportSessionText,
  getActiveSessionId,
  loadSession,
  loadSessions,
  renameSession,
  saveSession,
  setActiveSessionId,
  upsertSessionFromMessages,
  type AiBoxSession,
} from '../SessionStorage';

function defaultModel(provider: AIProviderType): string {
  const key = getKeyForProvider(provider);
  return key?.models?.[0] || (provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o-mini');
}

export function useAiBox() {
  const [sessions, setSessions] = useState<AiBoxSession[]>(() => ensureSessionStore());
  const [activeId, setActiveId] = useState<string>(() => getActiveSessionId() || sessions[0]?.id || '');
  const activeSession = sessions.find((session) => session.id === activeId) || sessions[0] || null;
  const [streamingText, setStreamingText] = useState('');

  useEffect(() => {
    if (sessions.length === 0) {
      const first = createSession({ provider: 'openai', model: defaultModel('openai') });
      saveSession(first);
      setSessions([first]);
      setActiveId(first.id);
      setActiveSessionId(first.id);
    }
  }, [sessions.length]);

  useEffect(() => {
    if (!activeSession) return;
    setActiveSessionId(activeSession.id);
  }, [activeSession?.id]);

  const chat = useChat({
    provider: activeSession?.provider || 'openai',
    model: activeSession?.model || defaultModel(activeSession?.provider || 'openai'),
    initialMessages: activeSession?.messages || [],
    onChunk: (chunk) => setStreamingText((prev) => prev + chunk),
  });

  useEffect(() => {
    if (!activeSession) return;
    chat.setMessages(activeSession.messages.slice());
    setStreamingText('');
  }, [activeSession?.id]);

  useEffect(() => {
    if (chat.isStreaming) return;
    setStreamingText('');
  }, [chat.isStreaming]);

  const refreshSessions = useCallback(() => {
    const next = loadSessions();
    if (next.length > 0) {
      setSessions(next);
      return;
    }
    const created = saveSession(createSession({ provider: activeSession?.provider || 'openai', model: activeSession?.model || defaultModel(activeSession?.provider || 'openai') }));
    setSessions([created]);
    setActiveId(created.id);
    setActiveSessionId(created.id);
  }, [activeSession]);

  useEffect(() => {
    const current = loadSessions();
    if (current.length > 0) {
      setSessions(current);
      if (!current.some((session) => session.id === activeId)) {
        const nextId = current[0].id;
        setActiveId(nextId);
        setActiveSessionId(nextId);
      }
    }
  }, []);

  const persistActive = useCallback((patch: Partial<AiBoxSession>) => {
    if (!activeSession) return;
    const next = upsertSessionFromMessages(activeSession, {
      ...patch,
      messages: patch.messages || chat.messages,
      provider: patch.provider || activeSession.provider,
      model: patch.model || activeSession.model,
      title: patch.title || activeSession.title,
    });
    setSessions((prev) => [next, ...prev.filter((session) => session.id !== next.id)].sort((a, b) => b.updatedAt - a.updatedAt));
  }, [activeSession, chat.messages]);

  useEffect(() => {
    if (!activeSession) return;
    persistActive({
      messages: chat.messages,
      title: activeSession.title === 'New chat' ? defaultSessionTitle(chat.messages) : activeSession.title,
      provider: activeSession.provider,
      model: activeSession.model,
    });
  }, [chat.messages, activeSession?.id, activeSession?.title, activeSession?.provider, activeSession?.model]);

  const setActiveSession = useCallback((id: string) => {
    chat.stop();
    setActiveId(id);
    setActiveSessionId(id);
    const found = loadSession(id);
    if (found) chat.setMessages(found.messages.slice());
  }, [chat]);

  const createNewSession = useCallback(() => {
    chat.stop();
    const session = saveSession(createSession({ provider: activeSession?.provider || 'openai', model: activeSession?.model || defaultModel(activeSession?.provider || 'openai') }));
    setSessions((prev) => [session, ...prev.filter((item) => item.id !== session.id)].sort((a, b) => b.updatedAt - a.updatedAt));
    setActiveId(session.id);
    setActiveSessionId(session.id);
    chat.setMessages([]);
    return session.id;
  }, [activeSession, chat]);

  const renameActiveSession = useCallback((id: string, title: string) => {
    const renamed = renameSession(id, title);
    if (!renamed) return;
    setSessions((prev) => [renamed, ...prev.filter((item) => item.id !== renamed.id)].sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  const removeSession = useCallback((id: string) => {
    chat.stop();
    const next = sessions.filter((session) => session.id !== id);
    if (next.length === 0) {
      const session = saveSession(createSession({ provider: activeSession?.provider || 'openai', model: activeSession?.model || defaultModel(activeSession?.provider || 'openai') }));
      setSessions([session]);
      setActiveId(session.id);
      setActiveSessionId(session.id);
      chat.setMessages([]);
      return;
    }
    if (id === activeId) {
      const nextId = next[0].id;
      setActiveId(nextId);
      setActiveSessionId(nextId);
      chat.setMessages(next[0].messages.slice());
    }
    refreshSessions();
  }, [activeId, activeSession, chat, refreshSessions, sessions]);

  const updateProvider = useCallback((provider: AIProviderType) => {
    const model = defaultModel(provider);
    if (!activeSession) return;
    const next = saveSession({ ...activeSession, provider, model, updatedAt: Date.now() });
    setSessions((prev) => [next, ...prev.filter((session) => session.id !== next.id)].sort((a, b) => b.updatedAt - a.updatedAt));
  }, [activeSession]);

  const updateModel = useCallback((model: string) => {
    if (!activeSession) return;
    const next = saveSession({ ...activeSession, model, updatedAt: Date.now() });
    setSessions((prev) => [next, ...prev.filter((session) => session.id !== next.id)].sort((a, b) => b.updatedAt - a.updatedAt));
  }, [activeSession]);

  const send = useCallback(async (content: string) => {
    if (!content.trim()) return;
    await chat.send(content);
    if (activeSession) {
      const next = loadSession(activeSession.id);
      if (next) {
        setSessions((prev) => [next, ...prev.filter((session) => session.id !== next.id)].sort((a, b) => b.updatedAt - a.updatedAt));
      }
    }
  }, [activeSession, chat]);

  const exportSession = useCallback((id: string) => {
    const session = sessions.find((item) => item.id === id) || loadSession(id);
    return session ? exportSessionText(session) : '';
  }, [sessions]);

  const activeProvider = activeSession?.provider || 'openai';
  const activeModel = activeSession?.model || defaultModel(activeProvider);

  return {
    sessions,
    activeSession,
    activeSessionId: activeId,
    setActiveSession,
    createNewSession,
    renameSession: renameActiveSession,
    deleteSession: removeSession,
    exportSession,
    provider: activeProvider,
    model: activeModel,
    setProvider: updateProvider,
    setModel: updateModel,
    messages: chat.messages,
    send,
    stop: chat.stop,
    isLoading: chat.isLoading,
    isStreaming: chat.isStreaming,
    error: chat.error,
    streamingText,
  };
}
