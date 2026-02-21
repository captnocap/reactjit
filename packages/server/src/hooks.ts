/**
 * React hooks for the @reactjit/server HTTP server module.
 *
 * Lua-side: lua/httpserver.lua (non-blocking TCP server, static file serving)
 * React-side: hooks for server lifecycle, dynamic route handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLoveRPC, useLoveEvent } from '@reactjit/core';
import type {
  HttpRequest,
  HttpResponse,
  Route,
  StaticRoute,
  ServerConfig,
  UseServerResult,
  IndexedFile,
  LibraryIndex,
  DirectoryStats,
  UseLibraryResult,
} from './types';

// ============================================================================
// useServer — full HTTP server with static files and dynamic routes
// ============================================================================

/**
 * Start an HTTP server with static file serving and/or dynamic API routes.
 *
 * Static routes are handled entirely in Lua (zero bridge overhead — perfect
 * for media servers). Dynamic routes forward requests to React where your
 * handler function runs and returns a response.
 *
 * @example
 * // Media server with an API endpoint
 * const server = useServer({
 *   port: 8080,
 *   static: [{ path: '/music', root: '/home/user/music' }],
 *   routes: [
 *     {
 *       path: '/api/status',
 *       handler: () => ({
 *         status: 200,
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify({ up: true }),
 *       }),
 *     },
 *   ],
 * });
 */
export function useServer(config: ServerConfig | null): UseServerResult {
  const [ready, setReady] = useState(false);
  const [requests, setRequests] = useState<HttpRequest[]>([]);
  const serverIdRef = useRef<string | null>(null);
  const routesRef = useRef<Route[]>([]);

  const listenRpc = useLoveRPC('httpserver:listen');
  const respondRpc = useLoveRPC('httpserver:respond');
  const closeRpc = useLoveRPC('httpserver:close');

  // Keep routes ref current without triggering re-mount
  routesRef.current = config?.routes ?? [];

  useEffect(() => {
    if (!config) {
      setReady(false);
      setRequests([]);
      return;
    }

    const serverId = 'srv_' + config.port + '_' + Date.now();
    serverIdRef.current = serverId;

    // Build Lua-side route table
    const luaRoutes: Array<{ path: string; type: string; root?: string; method?: string }> = [];

    // Static routes
    if (config.static) {
      for (const s of config.static) {
        luaRoutes.push({ path: s.path, type: 'static', root: s.root });
      }
    }

    // Dynamic handler routes (Lua just needs the path pattern + method filter)
    if (config.routes) {
      for (const r of config.routes) {
        luaRoutes.push({ path: r.path, type: 'handler', method: r.method });
      }
    }

    listenRpc({ serverId, port: config.port, host: config.host, routes: luaRoutes })
      .then((result: any) => {
        if (result && !result.error) {
          setReady(true);
        } else {
          console.error('[useServer] Failed to start:', result?.error);
        }
      })
      .catch((err: any) => console.error('[useServer] RPC error:', err));

    return () => {
      if (serverIdRef.current) {
        closeRpc({ serverId: serverIdRef.current }).catch(() => {});
        serverIdRef.current = null;
        setReady(false);
        setRequests([]);
      }
    };
  }, [config?.port, config?.host]);

  // Handle incoming dynamic route requests from Lua
  useLoveEvent('httpserver:request', async (payload: any) => {
    // Only handle events for our server
    if (payload.serverId !== serverIdRef.current) return;

    const req: HttpRequest = {
      clientId: payload.clientId,
      serverId: payload.serverId,
      method: payload.method,
      path: payload.path,
      rawPath: payload.rawPath,
      query: payload.query || {},
      headers: payload.headers || {},
      body: payload.body || '',
      params: payload.params || {},
      route: payload.route || '',
    };

    // Track request
    setRequests((prev) => [req, ...prev].slice(0, 50));

    // Find matching handler
    const route = routesRef.current.find((r) => r.path === req.route);

    let response: HttpResponse;
    if (route) {
      try {
        response = await route.handler(req);
      } catch (err: any) {
        response = {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
          body: 'Internal Server Error: ' + (err?.message || String(err)),
        };
      }
    } else {
      response = { status: 404, body: 'Not Found' };
    }

    respondRpc({
      serverId: req.serverId,
      clientId: req.clientId,
      status: response.status,
      headers: response.headers || {},
      body: response.body || '',
    }).catch((err: any) => console.error('[useServer] respond error:', err));
  });

  const close = useCallback(() => {
    if (serverIdRef.current) {
      closeRpc({ serverId: serverIdRef.current }).catch(() => {});
      serverIdRef.current = null;
      setReady(false);
      setRequests([]);
    }
  }, [closeRpc]);

  return {
    ready,
    port: ready ? (config?.port ?? null) : null,
    requests,
    close,
  };
}

// ============================================================================
// useStaticServer — one-liner for serving a directory
// ============================================================================

/**
 * Serve a directory over HTTP. One line, zero config.
 *
 * @example
 * // Serve your music library on the network
 * const server = useStaticServer(8080, '/home/user/music');
 *
 * @example
 * // Serve multiple directories
 * const server = useServer({
 *   port: 8080,
 *   static: [
 *     { path: '/music', root: '/home/user/music' },
 *     { path: '/photos', root: '/home/user/photos' },
 *   ],
 * });
 */
export function useStaticServer(
  port: number | null,
  root: string,
  host?: string
): UseServerResult {
  const config: ServerConfig | null = port != null
    ? { port, host, static: [{ path: '/', root }] }
    : null;
  return useServer(config);
}

// ============================================================================
// useLibrary — index directories + serve files + searchable API
// ============================================================================

/**
 * Index and serve a media library. Point at directories, get a server
 * with a browsable API and direct file access.
 *
 * Files are served directly from Lua (zero bridge overhead).
 * The index endpoint is also served from Lua with query filtering.
 *
 * @example
 * // One-liner media server with full library index
 * const library = useLibrary(8080, [
 *   '/home/user/music',
 *   '/home/user/movies',
 *   '/home/user/photos',
 * ]);
 *
 * // library.files — full file index
 * // library.stats — { total: 4200, audio: 3000, video: 800, image: 400 }
 * // library.reindex() — re-scan directories
 *
 * // Auto-served endpoints:
 * //   GET /files/music/Artist/Album/song.mp3  → actual file
 * //   GET /files/movies/film.mp4              → actual file
 * //   GET /api/library                        → full JSON index
 * //   GET /api/library?type=audio             → only audio files
 * //   GET /api/library?dir=music              → only from music dir
 * //   GET /api/library?q=beethoven            → search by name
 */
export function useLibrary(
  port: number | null,
  directories: string[],
  host?: string
): UseLibraryResult {
  const [ready, setReady] = useState(false);
  const [files, setFiles] = useState<IndexedFile[]>([]);
  const [stats, setStats] = useState<LibraryIndex['stats']>({ total: 0 });
  const [dirStats, setDirStats] = useState<DirectoryStats[]>([]);
  const serverIdRef = useRef<string | null>(null);
  const dirsRef = useRef<Array<{ path: string; name: string }>>([]);

  const listenRpc = useLoveRPC('httpserver:listen');
  const indexRpc = useLoveRPC('httpserver:index');
  const closeRpc = useLoveRPC('httpserver:close');

  useEffect(() => {
    if (port == null || directories.length === 0) {
      setReady(false);
      setFiles([]);
      setStats({ total: 0 });
      setDirStats([]);
      return;
    }

    const serverId = 'lib_' + port + '_' + Date.now();
    serverIdRef.current = serverId;

    // Build directory configs: derive name from last path segment
    const dirs = directories.map((dirPath) => {
      const name = dirPath.replace(/\/+$/, '').split('/').pop() || 'root';
      return { path: dirPath, name };
    });
    dirsRef.current = dirs;

    // Build routes: static routes for each directory + index endpoint
    const routes: Array<{ path: string; type: string; root?: string }> = [];

    // Each directory gets a /files/<name> static route
    for (const dir of dirs) {
      routes.push({ path: '/files/' + dir.name, type: 'static', root: dir.path });
    }

    // Index endpoint served directly from Lua
    routes.push({ path: '/api/library', type: 'index' });

    // Start server, then index
    listenRpc({ serverId, port, host, routes })
      .then((result: any) => {
        if (result?.error) {
          console.error('[useLibrary] Failed to start:', result.error);
          return;
        }
        // Trigger indexing
        return indexRpc({ serverId, dirs });
      })
      .then((index: any) => {
        if (index && !index.error) {
          setFiles(index.files || []);
          setStats(index.stats || { total: 0 });
          setDirStats(index.directories || []);
          setReady(true);
        } else if (index?.error) {
          console.error('[useLibrary] Index error:', index.error);
        }
      })
      .catch((err: any) => console.error('[useLibrary] Error:', err));

    return () => {
      if (serverIdRef.current) {
        closeRpc({ serverId: serverIdRef.current }).catch(() => {});
        serverIdRef.current = null;
        setReady(false);
      }
    };
  }, [port, directories.join(','), host]);

  const reindex = useCallback(async () => {
    if (!serverIdRef.current || dirsRef.current.length === 0) return;
    try {
      const index: any = await indexRpc({
        serverId: serverIdRef.current,
        dirs: dirsRef.current,
      });
      if (index && !index.error) {
        setFiles(index.files || []);
        setStats(index.stats || { total: 0 });
        setDirStats(index.directories || []);
      }
    } catch (err: any) {
      console.error('[useLibrary] Reindex error:', err);
    }
  }, [indexRpc]);

  const close = useCallback(() => {
    if (serverIdRef.current) {
      closeRpc({ serverId: serverIdRef.current }).catch(() => {});
      serverIdRef.current = null;
      setReady(false);
      setFiles([]);
      setStats({ total: 0 });
      setDirStats([]);
    }
  }, [closeRpc]);

  return {
    ready,
    port: ready ? port : null,
    files,
    stats,
    directories: dirStats,
    reindex,
    close,
  };
}
