/**
 * clipboard — system clipboard access.
 *
 * These globals are already registered by framework/qjs_runtime.zig (see
 * hostClipboardSet / hostClipboardGet), so this module is live today without
 * any Zig-side additions.
 */

import { callHost } from '../ffi';

/** Read the system clipboard as a UTF-8 string. */
export function get(): string {
  return callHost<string>('__clipboard_get', '');
}

/** Write a UTF-8 string to the system clipboard. */
export function set(value: string): void {
  callHost<void>('__clipboard_set', undefined as any, value);
}
