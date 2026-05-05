// =============================================================================
// PROXY CONFIGURATION — ported from SPEC_PROXY.md
// =============================================================================
// Simplified for ReactJIT: stores config + status, no actual proxy routing.
// (Routing would need host-level SOCKS/HTTP support.)

export type ProxyType = 'http' | 'socks5';

export interface ProxyConfig {
  id: string;
  nickname: string;
  type: ProxyType;
  hostname: string;
  port: number;
  username?: string;
  password?: string;
  isActive: boolean;
}

export interface ProxyStatus {
  isEnabled: boolean;
  activeConfig?: ProxyConfig;
  healthStatus: 'healthy' | 'degraded' | 'failed' | 'unknown';
  lastHealthCheck?: string;
  healthCheckMessage?: string;
}

// ── Persistence ──────────────────────────────────────────────────────────────

const STORE_PREFIX = 'sweatshop:proxy:';
const STORE_LIST_KEY = 'sweatshop:proxy:list';
const STORE_ACTIVE_KEY = 'sweatshop:proxy:active';

const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : () => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : () => {};

function proxyStoreKey(id: string): string {
  return STORE_PREFIX + id;
}

function loadProxyList(): string[] {
  const json = storeGet(STORE_LIST_KEY);
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

function saveProxyList(ids: string[]): void {
  storeSet(STORE_LIST_KEY, JSON.stringify(ids));
}

export function loadProxyConfig(id: string): ProxyConfig | null {
  const json = storeGet(proxyStoreKey(id));
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

export function saveProxyConfig(config: ProxyConfig): void {
  storeSet(proxyStoreKey(config.id), JSON.stringify(config));
  const list = loadProxyList();
  if (!list.includes(config.id)) {
    list.push(config.id);
    saveProxyList(list);
  }
  if (config.isActive) {
    // Deactivate others
    for (const otherId of list) {
      if (otherId !== config.id) {
        const other = loadProxyConfig(otherId);
        if (other && other.isActive) {
          other.isActive = false;
          storeSet(proxyStoreKey(otherId), JSON.stringify(other));
        }
      }
    }
    storeSet(STORE_ACTIVE_KEY, config.id);
  }
}

export function deleteProxyConfig(id: string): void {
  const list = loadProxyList().filter(i => i !== id);
  saveProxyList(list);
  storeSet(proxyStoreKey(id), '');
  const active = storeGet(STORE_ACTIVE_KEY);
  if (active === id) storeSet(STORE_ACTIVE_KEY, '');
}

export function listProxyConfigs(): ProxyConfig[] {
  return loadProxyList()
    .map(id => loadProxyConfig(id))
    .filter((c): c is ProxyConfig => c !== null);
}

export function getActiveProxyConfig(): ProxyConfig | null {
  const activeId = storeGet(STORE_ACTIVE_KEY);
  if (!activeId) return null;
  return loadProxyConfig(activeId);
}

export function setProxyActive(id: string | null): void {
  if (!id) {
    storeSet(STORE_ACTIVE_KEY, '');
    return;
  }
  const config = loadProxyConfig(id);
  if (config) {
    config.isActive = true;
    saveProxyConfig(config);
  }
}

export function getProxyStatus(): ProxyStatus {
  const active = getActiveProxyConfig();
  return {
    isEnabled: !!active,
    activeConfig: active || undefined,
    healthStatus: 'unknown',
  };
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createProxyConfig(data: {
  nickname: string;
  type: ProxyType;
  hostname: string;
  port: number;
  username?: string;
  password?: string;
}): ProxyConfig {
  return {
    id: 'proxy_' + Date.now(),
    nickname: data.nickname,
    type: data.type,
    hostname: data.hostname,
    port: data.port,
    username: data.username,
    password: data.password,
    isActive: false,
  };
}

export function validateProxyConfig(config: ProxyConfig): string | null {
  if (!config.hostname || config.hostname.trim() === '') return 'Hostname is required';
  if (config.port < 1 || config.port > 65535) return 'Port must be 1-65535';
  if (config.type !== 'http' && config.type !== 'socks5') return 'Type must be http or socks5';
  return null;
}
