import type { Breadcrumb, FileItem } from '../../types';

export function crumbPath(items: Breadcrumb[], idx: number): string {
  if (items[idx].kind === 'home') return '__landing__';
  if (items[idx].kind === 'workspace') return '.';
  if (items[idx].kind === 'settings') return '__settings__';
  const parts: string[] = [];
  for (let i = 2; i <= idx; i++) {
    parts.push(items[i].label);
  }
  return parts.join('/');
}

function parentPath(path: string): string {
  if (!path || path === '.' || path === '__landing__' || path === '__settings__') return '.';
  const idx = path.lastIndexOf('/');
  return idx >= 0 ? path.slice(0, idx) : '.';
}

export function siblingsForPath(path: string, files?: FileItem[]): FileItem[] {
  if (!files || files.length === 0) return [];
  const parent = parentPath(path);
  const out: FileItem[] = [];
  const seen: Record<string, boolean> = {};
  for (const f of files) {
    const p = parentPath(f.path);
    if (p === parent && f.path !== path) {
      if (!seen[f.path]) {
        seen[f.path] = true;
        out.push(f);
      }
    }
  }
  return out.sort((a: any, b: any) => a.name.localeCompare(b.name));
}

export function useBreadcrumbScope(items: Breadcrumb[], files: FileItem[]) {
  const scopes = items.map((_, idx) => {
    const path = crumbPath(items, idx);
    return siblingsForPath(path, files);
  });
  return { scopes, crumbPath };
}
