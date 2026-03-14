/**
 * React hooks for media scanning, archive reading, and library indexing.
 *
 * All hooks delegate to Lua-side RPC handlers via the bridge.
 * Archive features require libarchive; scanning works everywhere.
 */

import { useState, useCallback, useRef } from 'react';
import { useLoveRPC, useLuaQuery } from '@reactjit/core';
import type {
  MediaFile,
  MediaType,
  ArchiveEntry,
  ArchiveInfo,
  DirStats,
  MediaLibraryOptions,
  MediaIndexOptions,
} from './types';

// ── Archive Hooks ──────────────────────────────────────

/**
 * List contents of an archive (RAR, ZIP, 7z, TAR, etc.).
 *
 * @example
 * const { entries, loading, error, refresh } = useArchive('/path/to/file.rar');
 */
export function useArchive(filepath: string | null) {
  const { data: raw, loading, error: rpcError, refetch } = useLuaQuery<ArchiveEntry[] | { error: string }>(
    'archive:list',
    filepath ? { file: filepath } : {},
    [filepath],
  );
  const entries = raw && !('error' in raw) ? raw as ArchiveEntry[] : [];
  const error = rpcError ?? (raw && 'error' in raw ? (raw as any).error : null);
  return { entries, loading, error, refresh: refetch };
}

/**
 * Get summary info about an archive.
 *
 * @example
 * const { info } = useArchiveInfo('/path/to/file.zip');
 * // info.totalEntries, info.totalSize, info.extensions
 */
export function useArchiveInfo(filepath: string | null) {
  const { data: raw, loading, error: rpcError } = useLuaQuery<ArchiveInfo | { error: string }>(
    'archive:info',
    filepath ? { file: filepath } : {},
    [filepath],
  );
  const info = raw && !('error' in raw) ? raw as ArchiveInfo : null;
  const error = rpcError ?? (raw && 'error' in raw ? (raw as any).error : null);
  return { info, loading, error };
}

/**
 * Read a single file from inside an archive.
 *
 * @example
 * const read = useArchiveRead();
 * const content = await read('/path/to/archive.rar', 'readme.txt');
 */
export function useArchiveRead() {
  const readRpc = useLoveRPC<{ content: string; size: number } | { error: string }>('archive:readEntry');

  return useCallback(
    async (filepath: string, entryPath: string, maxBytes?: number) => {
      const result = await readRpc({ file: filepath, entry: entryPath, maxBytes });
      if (result && 'error' in result) {
        throw new Error((result as any).error);
      }
      return (result as { content: string; size: number });
    },
    [readRpc],
  );
}

/**
 * Search archive entries matching a pattern.
 *
 * @example
 * const { matches } = useArchiveSearch('/path/to/file.rar', '%.mp4$');
 */
export function useArchiveSearch(filepath: string | null, pattern: string) {
  const { data: raw, loading } = useLuaQuery<ArchiveEntry[] | { error: string }>(
    'archive:search',
    filepath && pattern ? { file: filepath, pattern } : {},
    [filepath, pattern],
  );
  const matches = raw && !('error' in raw) ? raw as ArchiveEntry[] : [];
  return { matches, loading };
}

// ── Media Library Hooks ────────────────────────────────

/**
 * Scan a directory for media files.
 *
 * @example
 * const { files, stats, loading, rescan } = useMediaLibrary('/home/user/Movies');
 */
export function useMediaLibrary(
  directory: string | null,
  options?: MediaLibraryOptions,
) {
  const { data: raw, loading, error, refetch } = useLuaQuery<MediaFile[]>(
    'media:scan',
    directory ? {
      dir: directory,
      recursive: options?.recursive ?? true,
      maxDepth: options?.maxDepth ?? 10,
    } : {},
    [directory, options?.recursive, options?.maxDepth],
  );

  let files = raw ?? [];
  if (options?.filter?.length) {
    const allowed = new Set(options.filter);
    files = files.filter((f) => allowed.has(f.type as MediaType));
  }

  // Compute stats from files
  const stats: DirStats = {
    total: files.length,
    byType: {},
    totalSize: 0,
    largestFile: null,
  };
  for (const f of files) {
    stats.byType[f.type] = (stats.byType[f.type] || 0) + 1;
    stats.totalSize += f.size;
    if (!stats.largestFile || f.size > stats.largestFile.size) {
      stats.largestFile = f;
    }
  }

  return { files, stats, loading, error, rescan: refetch };
}

/**
 * Get quick stats about a directory without loading all files.
 *
 * @example
 * const { stats, loading } = useMediaStats('/home/user/Movies');
 */
export function useMediaStats(directory: string | null) {
  const { data: stats, loading } = useLuaQuery<DirStats>(
    'media:dirStats',
    directory ? { dir: directory } : {},
    [directory],
  );
  return { stats, loading };
}

/**
 * Deep index a directory, including contents of archives.
 * This is the "archive walker" — it looks inside RAR/ZIP/7z files.
 *
 * @example
 * const { index, loading } = useMediaIndex('/home/user/Downloads', {
 *   indexArchives: true,
 *   filter: ['video', 'audio'],
 * });
 */
export function useMediaIndex(
  directory: string | null,
  options?: MediaIndexOptions,
) {
  const { data: raw, loading, error, refetch } = useLuaQuery<MediaFile[]>(
    'media:indexDeep',
    directory ? {
      dir: directory,
      indexArchives: options?.indexArchives ?? true,
      archivePattern: options?.archivePattern,
    } : {},
    [directory, options?.indexArchives, options?.archivePattern],
  );

  let index = raw ?? [];
  if (options?.filter?.length) {
    const allowed = new Set(options.filter);
    index = index.filter((f) => allowed.has(f.type as MediaType));
  }

  return { index, loading, error, rescan: refetch };
}

// ── Utilities ──────────────────────────────────────────

/**
 * Classify a filename by its media type.
 * Runs locally — no RPC needed.
 */
const MEDIA_TYPES: Record<string, MediaType> = {
  // Video
  mp4: 'video', mkv: 'video', avi: 'video', mov: 'video', wmv: 'video',
  webm: 'video', flv: 'video', m4v: 'video', mpg: 'video', mpeg: 'video',
  ts: 'video', vob: 'video', ogv: 'video', '3gp': 'video',
  // Audio
  mp3: 'audio', flac: 'audio', ogg: 'audio', wav: 'audio', aac: 'audio',
  m4a: 'audio', wma: 'audio', opus: 'audio', aiff: 'audio', ape: 'audio',
  // Image
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', bmp: 'image',
  webp: 'image', svg: 'image', tiff: 'image', ico: 'image', heic: 'image',
  // Subtitle
  srt: 'subtitle', ass: 'subtitle', ssa: 'subtitle', sub: 'subtitle', vtt: 'subtitle',
  // Document
  pdf: 'document', epub: 'document', mobi: 'document', txt: 'document', md: 'document',
  // Archive
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive',
  gz: 'archive', bz2: 'archive', xz: 'archive', iso: 'archive',
  // Metadata
  nfo: 'metadata', xml: 'metadata',
};

export function classifyFile(filename: string): MediaType {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return 'unknown';
  return MEDIA_TYPES[ext] || 'unknown';
}

/**
 * Format bytes to human-readable size.
 */
export function formatSize(bytes: number): string {
  if (bytes >= 1099511627776) return (bytes / 1099511627776).toFixed(1) + ' TB';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}
