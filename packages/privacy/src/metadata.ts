import { rpc } from './rpc';
import type { FileMetadata } from './types';

export function stripMetadata(path: string, outputPath?: string): Promise<void> {
  return rpc<void>('privacy:meta:strip', { path, outputPath });
}

export async function readMetadata(path: string): Promise<FileMetadata> {
  const r = await rpc<{ metadata: FileMetadata }>('privacy:meta:read', { path });
  return r.metadata;
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/\.\.\//g, '')
    .replace(/\.\//g, '')
    .replace(/\0/g, '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .normalize('NFC')
    .trim();
}

export function normalizeTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
