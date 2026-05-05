// ── Plugin System Types ──────────────────────────────────────────────

export type PluginCommand = {
  id: string;
  label: string;
  callback: () => void;
};

export type PluginPanel = {
  id: string;
  label: string;
  component: any; // React.ComponentType
};

export type PluginEventHandler = (...args: any[]) => void;

export type PluginNotification = {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  time: number;
};

export interface PluginContext {
  /** Plugin metadata */
  readonly pluginId: string;
  readonly pluginName: string;

  /** Register a command that appears in the command palette */
  registerCommand(id: string, label: string, callback: () => void): void;

  /** Unregister a command */
  unregisterCommand(id: string): void;

  /** Register a toggleable side panel */
  registerPanel(id: string, label: string, component: any): void;

  /** Unregister a panel */
  unregisterPanel(id: string): void;

  /** Subscribe to IDE events. Returns unsubscribe function. */
  on(event: string, handler: PluginEventHandler): () => void;

  /** Emit an event that other plugins can listen to */
  emit(event: string, ...args: any[]): void;

  /** Read a plugin-scoped setting (backed by localstore) */
  readSetting<T>(key: string, fallback?: T): T;

  /** Write a plugin-scoped setting */
  writeSetting<T>(key: string, value: T): void;

  /** Show a toast notification */
  showNotification(message: string, type?: PluginNotification['type']): void;

  /** Execute a shell command */
  exec(command: string): string;

  /** Read a file from disk */
  readFile(path: string): string;

  /** Write a file to disk */
  writeFile(path: string, content: string): boolean;

  /** Check if a path exists */
  pathExists(path: string): boolean;

  /** List directory entries */
  listDir(path: string): string[];

  /** Access React and primitives for building UI */
  readonly React: any;
  readonly primitives: any;
}

export type LoadedPlugin = {
  id: string;
  name: string;
  version: string;
  activate?: (ctx: PluginContext) => void;
  deactivate?: (ctx: PluginContext) => void;
  context: PluginContext;
};
