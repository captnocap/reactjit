/**
 * Save an Intent AST as a self-contained TSX cart on disk.
 *
 * Computes the relative import path from the target file to the
 * intent-surface components directory, runs the printer, mkdirs the parent
 * directory if needed, and writes the file.
 */

import type { Node } from './parser';
import { printIntentCart } from './printer';
import { writeFile, mkdir, exists } from '../hooks/fs';

const INTENT_SURFACE_DIR = 'cart/app/gallery/components/intent-surface';

export interface SaveResult {
  ok: boolean;
  path: string;
  error?: string;
}

/**
 * @param nodes parsed Intent AST
 * @param targetPath path relative to repo root, e.g. "cart/lifted/foo.tsx"
 */
export function saveIntentCart(nodes: Node[], targetPath: string): SaveResult {
  if (!targetPath.endsWith('.tsx')) {
    return { ok: false, path: targetPath, error: 'path must end in .tsx' };
  }

  const parentDir = parentOf(targetPath);
  if (parentDir && !exists(parentDir)) {
    if (!mkdir(parentDir)) {
      return { ok: false, path: targetPath, error: `mkdir failed: ${parentDir}` };
    }
  }

  const importBase = relativePath(parentDir, INTENT_SURFACE_DIR);
  const tsx = printIntentCart(nodes, { importBase });

  const wrote = writeFile(targetPath, tsx);
  if (!wrote) {
    return { ok: false, path: targetPath, error: 'writeFile failed' };
  }
  return { ok: true, path: targetPath };
}

function parentOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

/**
 * Compute the relative import path from `from` (a directory) to `to` (a directory).
 * Both are repo-relative paths with forward slashes.
 *
 *   relativePath('cart/lifted', 'cart/app/gallery/components/intent-surface')
 *     === '../component-gallery/components/intent-surface'
 */
function relativePath(fromDir: string, toDir: string): string {
  const from = fromDir.split('/').filter(Boolean);
  const to = toDir.split('/').filter(Boolean);

  // Drop common prefix.
  let i = 0;
  while (i < from.length && i < to.length && from[i] === to[i]) i++;

  const ups = from.length - i;
  const downs = to.slice(i);

  const parts: string[] = [];
  for (let k = 0; k < ups; k++) parts.push('..');
  parts.push(...downs);

  if (parts.length === 0) return '.';
  // If first segment is not '..', JSX/TS module resolution requires './' prefix.
  if (parts[0] !== '..') return './' + parts.join('/');
  return parts.join('/');
}
