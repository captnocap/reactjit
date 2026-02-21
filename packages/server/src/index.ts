// @reactjit/server — HTTP server primitive for ReactJIT
//
// Lua-side: lua/httpserver.lua (non-blocking TCP, static file serving, MIME detection, library indexing)
// React-side: hooks for server lifecycle, dynamic route handling, and media library indexing

export type {
  HttpRequest,
  HttpResponse,
  RouteHandler,
  Route,
  StaticRoute,
  ServerConfig,
  UseServerResult,
  FileCategory,
  IndexedFile,
  DirectoryStats,
  LibraryIndex,
  UseLibraryResult,
} from './types';

export {
  useServer,
  useStaticServer,
  useLibrary,
} from './hooks';
