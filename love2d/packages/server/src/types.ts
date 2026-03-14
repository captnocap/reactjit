// ============================================================================
// HTTP request / response types
// ============================================================================

export interface HttpRequest {
  clientId: number;
  serverId: string;
  method: string;
  path: string;
  rawPath: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string;
  params: Record<string, string>;
  route: string;
}

export interface HttpResponse {
  status: number;
  headers?: Record<string, string>;
  body?: string;
}

// ============================================================================
// Route definitions
// ============================================================================

export type RouteHandler = (req: HttpRequest) => HttpResponse | Promise<HttpResponse>;

export interface Route {
  /** HTTP method filter. Omit to match any method. */
  method?: string;
  /** Path pattern: /api/users/:id, /health, /files/* */
  path: string;
  /** Handler function — return a response object. */
  handler: RouteHandler;
}

export interface StaticRoute {
  /** URL prefix to match (e.g. "/media", "/"). */
  path: string;
  /** Absolute OS filesystem path to serve from (e.g. "/home/user/music"). */
  root: string;
}

// ============================================================================
// Server configuration
// ============================================================================

export interface ServerConfig {
  /** Port to listen on. */
  port: number;
  /** Bind address. Default: "0.0.0.0" (all interfaces). */
  host?: string;
  /** Dynamic routes handled in React. */
  routes?: Route[];
  /** Static file directories served directly from Lua (zero bridge overhead). */
  static?: StaticRoute[];
}

// ============================================================================
// Hook return types
// ============================================================================

export interface UseServerResult {
  /** True once the server socket is bound and listening. */
  ready: boolean;
  /** The port the server is listening on, or null if not ready. */
  port: number | null;
  /** Recent requests (most recent first, capped at 50). */
  requests: HttpRequest[];
  /** Manually shut down the server. */
  close: () => void;
}

// ============================================================================
// Library indexing types
// ============================================================================

export type FileCategory = 'audio' | 'video' | 'image' | 'document' | 'other';

export interface IndexedFile {
  /** Filename (e.g. "song.mp3"). */
  name: string;
  /** Absolute OS path. */
  path: string;
  /** Path relative to the indexed directory root. */
  relPath: string;
  /** File size in bytes. */
  size: number;
  /** Last modified time (epoch seconds). */
  modified: number;
  /** File extension, lowercase (e.g. "mp3"). */
  ext: string | null;
  /** Media category: audio, video, image, document, other. */
  category: FileCategory;
  /** Name of the directory this file belongs to. */
  dir: string;
}

export interface DirectoryStats {
  name: string;
  path: string;
  count: number;
  size: number;
}

export interface LibraryIndex {
  files: IndexedFile[];
  stats: {
    total: number;
    audio?: number;
    video?: number;
    image?: number;
    document?: number;
    other?: number;
  };
  directories: DirectoryStats[];
}

export interface UseLibraryResult {
  /** True once the server is listening and the index is built. */
  ready: boolean;
  /** The port the server is listening on, or null if not ready. */
  port: number | null;
  /** The full file index. */
  files: IndexedFile[];
  /** Index stats (counts by category). */
  stats: LibraryIndex['stats'];
  /** Per-directory stats. */
  directories: DirectoryStats[];
  /** Re-scan all directories and rebuild the index. */
  reindex: () => Promise<void>;
  /** Shut down the server. */
  close: () => void;
}
