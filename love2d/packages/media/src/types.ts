/** A file entry from directory scanning or archive listing */
export interface MediaFile {
  /** Full path (or archive:entry path for archive contents) */
  path: string;
  /** Filename only */
  name: string;
  /** Size in bytes */
  size: number;
  /** Last modification timestamp (Unix seconds) */
  mtime?: number;
  /** Classified media type */
  type: MediaType;
  /** Where this file came from */
  source: 'filesystem' | 'archive';
  /** If source is 'archive', the archive file path */
  archivePath?: string;
  /** If source is 'archive', the entry path within the archive */
  archiveEntry?: string;
}

/** Supported media type classifications */
export type MediaType =
  | 'video'
  | 'audio'
  | 'image'
  | 'subtitle'
  | 'document'
  | 'archive'
  | 'metadata'
  | 'unknown';

/** Archive entry from listing */
export interface ArchiveEntry {
  /** Path within the archive */
  path: string;
  /** Size in bytes */
  size: number;
  /** Entry type */
  type: 'file' | 'directory' | 'symlink';
  /** Modification timestamp (Unix seconds) */
  mtime: number;
  /** Whether the entry is encrypted */
  encrypted: boolean;
}

/** Archive info summary */
export interface ArchiveInfo {
  totalEntries: number;
  totalSize: number;
  fileCount: number;
  dirCount: number;
  extensions: Record<string, number>;
}

/** Directory scan statistics */
export interface DirStats {
  total: number;
  byType: Partial<Record<MediaType, number>>;
  totalSize: number;
  largestFile: MediaFile | null;
}

/** Options for useMediaLibrary */
export interface MediaLibraryOptions {
  /** Scan recursively (default true) */
  recursive?: boolean;
  /** Maximum recursion depth (default 10) */
  maxDepth?: number;
  /** Auto-scan on mount (default true) */
  autoScan?: boolean;
  /** Filter by media types */
  filter?: MediaType[];
}

/** Options for useMediaIndex */
export interface MediaIndexOptions {
  /** Look inside archives (default true) */
  indexArchives?: boolean;
  /** Only index archives matching this pattern */
  archivePattern?: string;
  /** Filter results by media type */
  filter?: MediaType[];
}
