import { LIMITS } from './constants';

export function isPlainObject(value: any): value is Record<string, any> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function safeString(value: any, max = LIMITS.safeStringMax): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    try { return JSON.stringify(value); } catch { return '[array]'; }
  }
  if (value === undefined) return '(undefined)';
  try {
    const s = JSON.stringify(value);
    return s.length <= max ? s : s.slice(0, max) + '…';
  } catch {
    return String(value);
  }
}

export function typeColor(value: any): string {
  if (value === null) return '#569cd6';
  if (value === undefined) return '#808080';
  if (typeof value === 'boolean') return '#569cd6';
  if (typeof value === 'number') return '#b5cea8';
  if (typeof value === 'string') return '#ce9178';
  return '#dcdcaa';
}

export function typeLabel(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  return typeof value;
}

export function parseTypedInput(raw: string): any {
  const trimmed = String(raw).trim();
  if (trimmed === '') return '';
  if (trimmed === 'null') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed[0] === '{' || trimmed[0] === '[') {
    try { return JSON.parse(trimmed); } catch {}
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

export function coerceHostId(id: number): number {
  return Math.min(Math.max(0, Math.floor(id || 0)), 65535);
}

export function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function looksLikeColor(value: any): boolean {
  if (typeof value !== 'string') return false;
  return /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value) || /^rgb(a?)/.test(value);
}

export function getTypeShort(type: string): string {
  if (type === 'Pressable') return 'P';
  if (type === 'ScrollView') return 'S';
  if (type === 'TextInput') return 'I';
  if (type === 'TextArea') return 'A';
  if (type === 'TextEditor') return 'E';
  if (type === 'Text') return 'T';
  if (type === 'Image') return 'IMG';
  if (type === 'View') return 'V';
  if (type === 'Box') return 'B';
  if (type === 'Row') return 'R';
  if (type === 'Col') return 'C';
  return type[0] || '?';
}

export function getTypeColor(type: string): string {
  if (type === 'Pressable') return '#c586c0';
  if (type === 'Text') return '#b5cea8';
  if (type === 'Image') return '#ce9178';
  if (type === 'View' || type === 'Box') return '#569cd6';
  if (type === 'ScrollView') return '#4ec9b0';
  if (type === 'TextInput' || type === 'TextArea' || type === 'TextEditor') return '#dcdcaa';
  if (type === 'Row' || type === 'Col') return '#569cd6';
  if (type === 'TextNode') return '#808080';
  return '#dcdcaa';
}

export function estimateSize(obj: any): number {
  try {
    return JSON.stringify(obj).length;
  } catch {
    return 0;
  }
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
