/**
 * fs — file system bindings backed by framework/fs.zig.
 *
 * Wraps Zig-registered globals with type-safe helpers. All ops are synchronous
 * — file I/O on local disk is fast and the main thread handles it fine for the
 * sizes typical carts deal with. For long-running work (multi-MB reads, large
 * directory walks), queue it behind a setTimeout(0) so the current frame
 * doesn't stall.
 *
 * Registration (Zig side, in qjs_app.zig:appInit or a shared registerAll):
 *
 *   qjs_runtime.registerHostFn("__fs_read", @ptrCast(&fs_read), 1);
 *   qjs_runtime.registerHostFn("__fs_write", @ptrCast(&fs_write), 2);
 *   qjs_runtime.registerHostFn("__fs_exists", @ptrCast(&fs_exists), 1);
 *   qjs_runtime.registerHostFn("__fs_list_json", @ptrCast(&fs_list_json), 1);
 *   qjs_runtime.registerHostFn("__fs_mkdir", @ptrCast(&fs_mkdir), 1);
 *   qjs_runtime.registerHostFn("__fs_remove", @ptrCast(&fs_remove), 1);
 *   qjs_runtime.registerHostFn("__fs_stat_json", @ptrCast(&fs_stat_json), 1);
 *
 * Paths are absolute or relative to the binary's working directory.
 */

import { callHost, callHostJson } from '../ffi';

/** Read a file as a UTF-8 string. Returns null if the file doesn't exist. */
export function readFile(path: string): string | null {
  return callHost<string | null>('__fs_read', null, path);
}

/** Write a UTF-8 string to a file (creating or truncating). Returns true on success. */
export function writeFile(path: string, content: string): boolean {
  return callHost<boolean>('__fs_write', false, path, content);
}

/** True if a file or directory exists at `path`. */
export function exists(path: string): boolean {
  return callHost<boolean>('__fs_exists', false, path);
}

/** List direct children of a directory (names only, no full paths). Empty array if not a directory. */
export function listDir(path: string): string[] {
  return callHostJson<string[]>('__fs_list_json', [], path);
}

/** Create a directory (and parents as needed). */
export function mkdir(path: string): boolean {
  return callHost<boolean>('__fs_mkdir', false, path);
}

/** Remove a file or empty directory. */
export function remove(path: string): boolean {
  return callHost<boolean>('__fs_remove', false, path);
}

export interface FsStat {
  size: number;
  mtimeMs: number;
  isDir: boolean;
}

/** Stat a file. Returns null if not found. */
export function stat(path: string): FsStat | null {
  return callHostJson<FsStat | null>('__fs_stat_json', null, path);
}
