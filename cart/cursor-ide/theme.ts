export type WidthBand = 'minimum' | 'widget' | 'narrow' | 'medium' | 'desktop';

export const COLORS = {
  appBg: '#090d13',
  panelBg: '#0d1015',
  panelRaised: '#10151d',
  panelAlt: '#11161f',
  panelHover: '#121a24',
  border: '#1f2935',
  borderSoft: '#18202b',
  text: '#c9d2df',
  textBright: '#eef2f8',
  textDim: '#5d6a7c',
  textMuted: '#8ca0b8',
  blue: '#79c0ff',
  blueDeep: '#10213d',
  green: '#7ee787',
  greenDeep: '#102214',
  yellow: '#e6b450',
  yellowDeep: '#332200',
  orange: '#ffa657',
  orangeDeep: '#331608',
  red: '#ff7b72',
  redDeep: '#341316',
  purple: '#d2a8ff',
  purpleDeep: '#241233',
  grayChip: '#1d2330',
  grayDeep: '#1a1f2b',
};

export function widthBandForSize(w: number, h: number): WidthBand {
  if (w <= 360 || h <= 250) return 'minimum';
  if (w <= 560 || h <= 360) return 'widget';
  if (w <= 920) return 'narrow';
  if (w <= 1260) return 'medium';
  return 'desktop';
}

export function stripDotSlash(path: string): string {
  if (!path) return '';
  return path.startsWith('./') ? path.slice(2) : path;
}

export function baseName(path: string): string {
  if (!path) return '';
  if (path === '.') return 'workspace';
  const clean = path.endsWith('/') ? path.slice(0, -1) : path;
  const idx = clean.lastIndexOf('/');
  return idx >= 0 ? clean.slice(idx + 1) : clean;
}

export function parentPath(path: string): string {
  if (!path || path === '.' || path === '__landing__') return '.';
  const idx = path.lastIndexOf('/');
  return idx >= 0 ? path.slice(0, idx) : '.';
}

export function samePath(a: string, b: string): boolean {
  return stripDotSlash(a) === stripDotSlash(b);
}

export function inferFileType(path: string): string {
  if (path === '__landing__') return 'home';
  if (path === '__settings__') return 'settings';
  if (path === '.' || path.length === 0) return 'workspace';
  const name = baseName(path);
  if (name.includes('.c.tsz')) return 'component';
  if (name.includes('.cls.tsz')) return 'cls';
  if (name.includes('.script.tsz')) return 'script';
  if (name.includes('.mod.tsz')) return 'mod';
  if (name.includes('.app.tsz')) return 'app';
  if (name.includes('.tsz')) return 'tsz';
  const dot = name.lastIndexOf('.');
  if (dot < 0) return 'dir';
  return name.slice(dot + 1);
}

export function languageForType(type: string): string {
  if (type === 'settings') return 'Settings';
  if (type === 'component' || type === 'cls' || type === 'script' || type === 'mod' || type === 'app' || type === 'tsz') return 'TSZ';
  if (type === 'ts' || type === 'tsx') return 'TypeScript';
  if (type === 'js' || type === 'jsx') return 'JavaScript';
  if (type === 'zig') return 'Zig';
  if (type === 'md') return 'Markdown';
  if (type === 'json') return 'JSON';
  if (type === 'css') return 'CSS';
  if (type === 'sh') return 'Shell';
  if (type === 'home') return 'Workspace';
  return 'Plain Text';
}

export function fileTone(type: string): string {
  if (type === 'settings') return COLORS.purple;
  if (type === 'component') return COLORS.blue;
  if (type === 'cls') return COLORS.purple;
  if (type === 'script') return COLORS.green;
  if (type === 'mod') return COLORS.orange;
  if (type === 'app') return COLORS.red;
  if (type === 'tsz') return '#56d364';
  if (type === 'ts' || type === 'tsx') return '#2d62ff';
  if (type === 'js' || type === 'jsx') return COLORS.yellow;
  if (type === 'zig') return COLORS.orange;
  if (type === 'md') return COLORS.green;
  if (type === 'json') return '#56d364';
  if (type === 'css') return COLORS.purple;
  if (type === 'sh') return COLORS.blue;
  if (type === 'home') return '#2d62ff';
  if (type === 'workspace') return COLORS.green;
  if (type === 'dir') return '#4a5568';
  return '#6e6e6e';
}

export function fileGlyph(type: string): string {
  if (type === 'settings') return 'ST';
  if (type === 'component') return '{}';
  if (type === 'cls') return 'PL';
  if (type === 'script') return 'TS';
  if (type === 'mod') return 'PK';
  if (type === 'app') return 'ED';
  if (type === 'tsz') return '{}';
  if (type === 'ts' || type === 'tsx') return 'TS';
  if (type === 'js' || type === 'jsx') return 'JS';
  if (type === 'zig') return 'ZG';
  if (type === 'md') return 'MD';
  if (type === 'json') return 'JS';
  if (type === 'css') return 'PL';
  if (type === 'sh') return 'SH';
  if (type === 'home') return 'HM';
  if (type === 'workspace') return 'WS';
  if (type === 'dir') return 'FD';
  return 'TX';
}

export function statusLabel(code: string): string {
  if (code === '??') return 'new';
  if (code.includes('M')) return 'modified';
  if (code.includes('A')) return 'added';
  if (code.includes('D')) return 'deleted';
  if (code.includes('R')) return 'renamed';
  return 'dirty';
}

export function statusTone(code: string): string {
  if (code === '??') return '#2d62ff';
  if (code.includes('D')) return COLORS.red;
  if (code.includes('A')) return COLORS.green;
  if (code.includes('M')) return COLORS.yellow;
  return '#6e6e6e';
}

export function takeList<T>(list: T[], limit: number): T[] {
  if (limit <= 0 || list.length <= limit) return list;
  return list.slice(0, limit);
}

export function limitList<T>(list: T[], limit: number): T[] {
  if (limit <= 0 || list.length <= limit) return list;
  return list.slice(list.length - limit);
}

export function visibleTabs<T extends { id: string }>(list: T[], activeId: string, limit: number): T[] {
  if (limit <= 0 || list.length <= limit) return list;
  let out = limitList(list, limit);
  if (!out.some((tab) => tab.id === activeId)) {
    const active = list.find((tab) => tab.id === activeId);
    if (active) out = [...out.slice(1), active];
  }
  if (!out.some((tab) => tab.id === 'home')) {
    const home = list.find((tab) => tab.id === 'home');
    if (home) out = [home, ...out].slice(0, limit);
  }
  return out;
}

export function visibleBreadcrumbs<T>(list: T[], band: WidthBand): T[] {
  if (band === 'minimum') return [];
  if (band === 'widget' && list.length > 2) return [list[0], list[list.length - 1]];
  if (band === 'narrow' && list.length > 3) return [list[0], list[list.length - 2], list[list.length - 1]];
  return list;
}
