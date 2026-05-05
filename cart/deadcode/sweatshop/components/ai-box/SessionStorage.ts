import type { AIProviderType, Message } from '../../lib/ai/types';

const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : (_: string) => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : (_: string, __: string) => {};
const storeDel = typeof host.__store_del === 'function' ? host.__store_del : (_: string) => {};

const INDEX_KEY = 'ai-box:session:index';
const ACTIVE_KEY = 'ai-box:session:active';
const SESSION_PREFIX = 'ai-box:session:';
const DEFAULT_PROVIDER: AIProviderType = 'openai';

export type AiBoxSession = {
  id: string;
  title: string;
  provider: AIProviderType;
  model: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

function now(): number {
  return Date.now();
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = storeGet(key);
    if (raw == null || raw === '') return fallback;
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: any): void {
  try { storeSet(key, JSON.stringify(value)); } catch {}
}

function truncateLabel(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length > 42 ? trimmed.slice(0, 39) + '…' : trimmed;
}

function defaultModel(provider: AIProviderType): string {
  return provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o-mini';
}

export function defaultSessionTitle(messages: Message[]): string {
  const firstUser = messages.find((message) => message.role === 'user' && typeof message.content === 'string' && message.content.trim().length > 0);
  if (!firstUser || typeof firstUser.content !== 'string') return 'New chat';
  return truncateLabel(firstUser.content);
}

export function createSession(partial?: Partial<AiBoxSession>): AiBoxSession {
  const createdAt = partial?.createdAt || now();
  const provider = partial?.provider || DEFAULT_PROVIDER;
  const id = partial?.id || `session-${createdAt.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    title: partial?.title || 'New chat',
    provider,
    model: partial?.model || defaultModel(provider),
    messages: partial?.messages ? partial.messages.slice() : [],
    createdAt,
    updatedAt: partial?.updatedAt || createdAt,
  };
}

export function loadSessionIds(): string[] {
  return readJson<string[]>(INDEX_KEY, []);
}

export function loadSessions(): AiBoxSession[] {
  const ids = loadSessionIds();
  const sessions = ids
    .map((id) => loadSession(id))
    .filter((session): session is AiBoxSession => !!session);
  sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  return sessions;
}

export function loadSession(id: string): AiBoxSession | null {
  try {
    const raw = storeGet(SESSION_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(String(raw));
    if (!parsed || !parsed.id) return null;
    return {
      id: String(parsed.id),
      title: String(parsed.title || 'New chat'),
      provider: (parsed.provider || DEFAULT_PROVIDER) as AIProviderType,
      model: String(parsed.model || defaultModel((parsed.provider || DEFAULT_PROVIDER) as AIProviderType)),
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      createdAt: Number(parsed.createdAt || now()),
      updatedAt: Number(parsed.updatedAt || now()),
    };
  } catch {
    return null;
  }
}

function saveIndex(ids: string[]): void {
  writeJson(INDEX_KEY, ids);
}

export function saveSession(session: AiBoxSession): AiBoxSession {
  const next = { ...session, messages: session.messages.slice(), updatedAt: session.updatedAt || now() };
  storeSet(SESSION_PREFIX + next.id, JSON.stringify(next));
  const ids = loadSessionIds();
  if (!ids.includes(next.id)) saveIndex([next.id, ...ids]);
  return next;
}

export function deleteSession(id: string): void {
  try { storeDel(SESSION_PREFIX + id); } catch {}
  saveIndex(loadSessionIds().filter((existing) => existing !== id));
  const activeId = getActiveSessionId();
  if (activeId === id) setActiveSessionId('');
}

export function renameSession(id: string, title: string): AiBoxSession | null {
  const session = loadSession(id);
  if (!session) return null;
  return saveSession({ ...session, title: title.trim() || 'New chat', updatedAt: now() });
}

export function setActiveSessionId(id: string): void {
  try { if (id) storeSet(ACTIVE_KEY, id); else storeDel(ACTIVE_KEY); } catch {}
}

export function getActiveSessionId(): string {
  try { return String(storeGet(ACTIVE_KEY) || ''); } catch { return ''; }
}

export function ensureSessionStore(): AiBoxSession[] {
  const sessions = loadSessions();
  if (sessions.length > 0) return sessions;
  const created = saveSession(createSession());
  setActiveSessionId(created.id);
  return [created];
}

export function exportSessionText(session: AiBoxSession): string {
  return JSON.stringify(session, null, 2);
}

export function upsertSessionFromMessages(session: AiBoxSession, patch: Partial<AiBoxSession>): AiBoxSession {
  const next = {
    ...session,
    ...patch,
    messages: patch.messages ? patch.messages.slice() : session.messages.slice(),
    updatedAt: patch.updatedAt || now(),
  };
  if (!next.title || next.title === 'New chat') {
    next.title = defaultSessionTitle(next.messages);
  }
  return saveSession(next);
}
