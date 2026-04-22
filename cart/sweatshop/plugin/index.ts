// ── Plugin System Barrel Export ──────────────────────────────────────

export type { PluginContext, LoadedPlugin, PluginCommand, PluginPanel, PluginNotification } from './types';
export { createPluginContext, setGlobalNotificationHandler } from './context';
export { loadPlugins, type PluginRegistry } from './loader';
