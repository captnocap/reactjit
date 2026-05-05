export type SettingsSectionId = 'appearance' | 'editor' | 'scrolling' | 'terminal' | 'keybindings' | 'providers' | 'memory' | 'plugins' | 'about';

export interface SettingsSectionDef {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: string;
  tone: string;
  keywords: string[];
}

export interface SettingsSearchEntry {
  path: SettingsSectionId;
  label: string;
  keywords: string[];
  description: string;
}

export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  { id: 'appearance',  label: 'Appearance',  description: 'Theme, density, font scale',           icon: 'palette',  tone: '#a855f7', keywords: ['theme dark light sharp soft studio', 'ui scale font size zoom density', 'accent color highlight', 'animations motion reduce', 'compact chrome titlebar density', 'file glyphs icons sidebar', 'minimap code overview'] },
  { id: 'editor',      label: 'Editor',      description: 'Font size, tabs, wrap, line numbers',  icon: 'braces',   tone: '#3b82f6', keywords: ['font family monospace typeface', 'font size type scale', 'line height spacing leading', 'tab size indent width', 'insert spaces tabs indent character', 'word wrap soft line break', 'line numbers gutter', 'whitespace dots invisible characters', 'trim trailing whitespace', 'format on save prettier', 'scrollbars drag scroll panning sync'] },
  { id: 'scrolling',   label: 'Scrolling',   description: 'Scrollbars, drag panning, sync',      icon: 'mouse',    tone: '#22c55e', keywords: ['scrollbars overlay drag panning sync', 'terminal scrollback drag scroll history', 'chat message list drag scroll', 'search results drag scroll', 'diff side by side gutters sync', 'git commit list history drag scroll'] },
  { id: 'terminal',    label: 'Terminal',    description: 'Shell, font, cursor, scrollback',      icon: 'command',  tone: '#22c55e', keywords: ['shell bash zsh binary path', 'font family monospace typeface', 'font size scale', 'cursor shape block underline bar', 'cursor blink blinking', 'scrollback lines buffer history', 'bell beep alert', 'copy selection clipboard'] },
  { id: 'keybindings', label: 'Keybindings', description: 'Shortcuts and command palette',        icon: 'command',  tone: '#f97316', keywords: ['open settings command palette projects', 'toggle search terminal chat hot panel', 'new file save', 'refresh index workspace', 'new conversation send cycle stop agent'] },
  { id: 'providers',   label: 'Providers',   description: 'Models, API keys, default routing',    icon: 'globe',    tone: '#3b82f6', keywords: ['backend api cli claude kimi codex local', 'claude code cli anthropic messages', 'openai codex local ai', 'kimi moonshot k2', 'local endpoints ollama lmstudio llama.cpp vllm', 'http providers base url api key', 'default model routing'] },
  { id: 'memory',      label: 'Memory',      description: 'Variables, checkpoints, context',      icon: 'bot',      tone: '#a855f7', keywords: ['memory provider backend local sqlite session', 'context size tokens window', 'retention days age history', 'checkpoint limit cap history turns', 'auto checkpoint save on turn', 'semantic search embeddings', 'clear memory erase reset storage'] },
  { id: 'plugins',     label: 'Plugins',     description: 'Installed plugins, enable / disable',  icon: 'sparkles', tone: '#f97316', keywords: ['plugin directory scan rescan enable disable', 'javascript plugin loader manifest'] },
  { id: 'about',       label: 'About',       description: 'Version, build, capabilities',         icon: 'folder',   tone: '#eab308', keywords: ['version build sha platform runtime react esbuild home', 'host capabilities ffi store fs exec claude kimi localai'] },
];

function normalize(text: string): string {
  return String(text || '').trim().toLowerCase();
}

function entryHaystack(entry: SettingsSearchEntry): string {
  return normalize([entry.label, entry.description, ...entry.keywords].join(' '));
}

export function buildSettingsSearchIndex(): SettingsSearchEntry[] {
  return SETTINGS_SECTIONS.map((section) => ({
    path: section.id,
    label: section.label,
    keywords: section.keywords.slice(),
    description: section.description,
  }));
}

export function searchSettingsIndex(query: string): SettingsSearchEntry[] {
  const needle = normalize(query);
  if (!needle) return [];
  return buildSettingsSearchIndex().filter((entry) => entryHaystack(entry).includes(needle));
}

export function countSettingsSectionMatches(sectionId: SettingsSectionId, query: string): number {
  const needle = normalize(query);
  if (!needle) return 0;
  const section = SETTINGS_SECTIONS.find((item) => item.id === sectionId);
  if (!section) return 0;
  let count = 0;
  for (const keyword of section.keywords) {
    if (normalize(keyword).includes(needle)) count++;
  }
  if (normalize(section.label).includes(needle) || normalize(section.description).includes(needle)) count++;
  return count;
}

export function sectionForPath(path: string): SettingsSectionDef | null {
  return SETTINGS_SECTIONS.find((section) => section.id === path) || null;
}

