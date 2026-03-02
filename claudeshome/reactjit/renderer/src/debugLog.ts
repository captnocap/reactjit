/**
 * debugLog.ts -- Channel-based debug logging for the TypeScript side
 *
 * Mirrors the Lua debug_log.lua module. Uses console.log which in QuickJS
 * gets routed through bridge_quickjs.lua and appears as [JS] ... in the
 * terminal, alongside Lua-side debug logs.
 *
 * Channels:
 *   recon    — React reconciler (createInstance, commitUpdate, flushToHost)
 *   dispatch — Event dispatcher (event routing, handler dispatch)
 *
 * Toggle from the Lua console:
 *   :log recon       (toggles via JS eval automatically)
 *   :log dispatch
 *
 * Or from JS eval in the console:
 *   __debugLog.toggle('recon')
 *   __debugLog.all(true)
 */

interface DebugLogModule {
  log(channel: string, msg: string): void;
  on(channel: string): void;
  off(channel: string): void;
  toggle(channel: string): boolean;
  all(enable: boolean): void;
  isOn(channel: string): boolean;
}

const channels: Record<string, boolean> = {
  recon: false,
  dispatch: false,
};

export const debugLog: DebugLogModule = {
  log(channel: string, msg: string): void {
    if (!channels[channel]) return;
    console.log(`[${channel}] ${msg}`);
  },

  on(channel: string): void {
    if (channel in channels) channels[channel] = true;
  },

  off(channel: string): void {
    if (channel in channels) channels[channel] = false;
  },

  toggle(channel: string): boolean {
    if (channel in channels) {
      channels[channel] = !channels[channel];
      return channels[channel];
    }
    return false;
  },

  all(enable: boolean): void {
    for (const ch in channels) {
      channels[ch] = enable;
    }
  },

  isOn(channel: string): boolean {
    return channels[channel] === true;
  },
};

// Expose on globalThis so the Lua console can toggle via JS eval
(globalThis as any).__debugLog = debugLog;
