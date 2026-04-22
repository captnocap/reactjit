const React: any = require('react');
const { useEffect } = React;

import { undo, redo } from './undoStack';

// Window-level ctrl+z / ctrl+shift+z / ctrl+y. Mount once from the app
// shell. Skips events originating inside contenteditable / input /
// textarea / editor primitives so text fields keep their native undo.
//
// Scope reminder per spec: editor text editing has its own history.
// This handler does NOT route ctrl+z through our stack when the user is
// typing into an editable element.

function isEditable(target: any): boolean {
  if (!target) return false;
  const tag = String(target.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  // Framework primitives often render as nodes with a dataset flag — be
  // tolerant: honor any explicit opt-in we can detect.
  if (target.dataset && target.dataset.editable === 'true') return true;
  // TextEditor primitive uses role="textbox".
  const role = target.getAttribute ? target.getAttribute('role') : null;
  if (role === 'textbox') return true;
  return false;
}

export function useGlobalUndoHotkeys(): void {
  useEffect(() => {
    const target: any = (globalThis as any).window || globalThis;
    if (!target || typeof target.addEventListener !== 'function') return;

    const handler = (ev: any) => {
      if (!ev) return;
      const ctrl = !!(ev.ctrlKey || ev.metaKey);
      if (!ctrl) return;
      const key = String(ev.key || '').toLowerCase();

      const isUndo = key === 'z' && !ev.shiftKey;
      const isRedo = (key === 'z' && ev.shiftKey) || key === 'y';
      if (!isUndo && !isRedo) return;

      if (isEditable(ev.target)) return;

      if (typeof ev.preventDefault === 'function') ev.preventDefault();
      if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
      if (isUndo) undo();
      else if (isRedo) redo();
    };

    target.addEventListener('keydown', handler, true);
    return () => { target.removeEventListener('keydown', handler, true); };
  }, []);
}
