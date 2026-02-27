/**
 * useDiffAccumulator — accumulates diff tokens from claude:classified into
 * a structured per-file changelog for the current session.
 *
 * Strategy: poll classified rows, extract diff-context rows, detect file
 * headers from tool tokens (Read/Edit/Write patterns), group +/- lines.
 * Pure React — no Lua changes needed.
 */
import { useState, useEffect, useRef } from 'react';
import { useLoveRPC, useLuaInterval } from '@reactjit/core';

export interface FileDiff {
  path: string;
  added: number;
  removed: number;
  lastSeen: number; // timestamp
  chunks: string[]; // recent diff lines (capped)
}

export interface DiffState {
  files: Record<string, FileDiff>;
  totalAdded: number;
  totalRemoved: number;
  lastUpdated: number;
}

const EMPTY: DiffState = { files: {}, totalAdded: 0, totalRemoved: 0, lastUpdated: 0 };
const MAX_CHUNKS = 20;

// Extract file path from tool invocation text like:
//   "● Edit(src/App.tsx)" or "● Write(path/to/file)" or "● Read(path)"
function extractFilePath(text: string): string | null {
  const m = text.match(/(?:Edit|Write|MultiEdit)\(([^)]+)\)/);
  return m ? m[1].trim() : null;
}

function countDiff(chunks: string[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const c of chunks) {
    if (c.startsWith('+')) added++;
    else if (c.startsWith('-')) removed++;
  }
  return { added, removed };
}

export function useDiffAccumulator() {
  const rpcClassified = useLoveRPC('claude:classified');
  const rpcRef = useRef(rpcClassified);
  rpcRef.current = rpcClassified;

  const [state, setState] = useState<DiffState>(EMPTY);
  const prevRowsRef = useRef<Array<{ kind: string; text: string }>>([]);

  useEffect(() => {
    let alive = true;

    const poll = async () => {
      if (!alive) return;
      try {
        const res = await rpcRef.current({ session: 'default' }) as any;
        if (!res?.rows) return;

        const rows: Array<{ kind: string; text: string }> = (res.rows as any[]).map(r => ({
          kind: String(r.kind ?? ''),
          text: String(r.text ?? ''),
        }));

        // Only process if rows changed (detect new diff content)
        const prev = prevRowsRef.current;
        const newRows = rows.slice(prev.length);
        if (newRows.length === 0) return;
        prevRowsRef.current = rows;

        // Scan new rows for tool + diff pairs
        let currentFile: string | null = null;
        const fileUpdates: Record<string, string[]> = {};

        for (const row of newRows) {
          if (row.kind === 'tool') {
            const path = extractFilePath(row.text);
            if (path) currentFile = path;
          } else if (row.kind === 'diff' && currentFile) {
            if (!fileUpdates[currentFile]) fileUpdates[currentFile] = [];
            fileUpdates[currentFile].push(row.text);
          } else if (row.kind === 'result') {
            // result ends a tool call — reset current file after diffing
            // (keep currentFile for the result row, reset after)
            currentFile = null;
          }
        }

        if (Object.keys(fileUpdates).length === 0) return;

        setState(prev => {
          const next = { ...prev, files: { ...prev.files } };
          let totalAdded = prev.totalAdded;
          let totalRemoved = prev.totalRemoved;

          for (const [path, chunks] of Object.entries(fileUpdates)) {
            const counts = countDiff(chunks);
            const existing = next.files[path];
            const prevChunks = existing?.chunks ?? [];
            const merged = [...prevChunks, ...chunks].slice(-MAX_CHUNKS);
            next.files[path] = {
              path,
              added: (existing?.added ?? 0) + counts.added,
              removed: (existing?.removed ?? 0) + counts.removed,
              lastSeen: Date.now(),
              chunks: merged,
            };
            totalAdded += counts.added;
            totalRemoved += counts.removed;
          }

          return { ...next, totalAdded, totalRemoved, lastUpdated: Date.now() };
        });
      } catch {
        // silent
      }
    };

    return () => {
      alive = false;
    };
  }, []);

  useLuaInterval(1500, async () => {
    try {
      const res = await rpcRef.current({ session: 'default' }) as any;
      if (!res?.rows) return;

      const rows: Array<{ kind: string; text: string }> = (res.rows as any[]).map(r => ({
        kind: String(r.kind ?? ''),
        text: String(r.text ?? ''),
      }));

      // Only process if rows changed (detect new diff content)
      const prev = prevRowsRef.current;
      const newRows = rows.slice(prev.length);
      if (newRows.length === 0) return;
      prevRowsRef.current = rows;

      // Scan new rows for tool + diff pairs
      let currentFile: string | null = null;
      const fileUpdates: Record<string, string[]> = {};

      for (const row of newRows) {
        if (row.kind === 'tool') {
          const path = extractFilePath(row.text);
          if (path) currentFile = path;
        } else if (row.kind === 'diff' && currentFile) {
          if (!fileUpdates[currentFile]) fileUpdates[currentFile] = [];
          fileUpdates[currentFile].push(row.text);
        } else if (row.kind === 'result') {
          // result ends a tool call — reset current file after diffing
          // (keep currentFile for the result row, reset after)
          currentFile = null;
        }
      }

      if (Object.keys(fileUpdates).length === 0) return;

      setState(prev => {
        const next = { ...prev, files: { ...prev.files } };
        let totalAdded = prev.totalAdded;
        let totalRemoved = prev.totalRemoved;

        for (const [path, chunks] of Object.entries(fileUpdates)) {
          const counts = countDiff(chunks);
          const existing = next.files[path];
          const prevChunks = existing?.chunks ?? [];
          const merged = [...prevChunks, ...chunks].slice(-MAX_CHUNKS);
          next.files[path] = {
            path,
            added: (existing?.added ?? 0) + counts.added,
            removed: (existing?.removed ?? 0) + counts.removed,
            lastSeen: Date.now(),
            chunks: merged,
          };
          totalAdded += counts.added;
          totalRemoved += counts.removed;
        }

        return { ...next, totalAdded, totalRemoved, lastUpdated: Date.now() };
      });
    } catch {
      // silent
    }
  });

  return {
    state,
    fileList: Object.values(state.files).sort((a, b) => b.lastSeen - a.lastSeen),
    clear: () => { setState(EMPTY); prevRowsRef.current = []; },
  };
}
