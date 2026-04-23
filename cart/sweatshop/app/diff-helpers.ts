export interface DiffHunk {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

export interface SideBySideRow {
  oldLine: number | null;
  newLine: number | null;
  oldText: string;
  newText: string;
  kind: 'context' | 'old' | 'new' | 'both';
}

export interface ParsedDiff {
  headerLines: string[];
  hunks: (DiffHunk & { rows: SideBySideRow[] })[];
}

export function parsePatch(patch: string): { headerLines: string[]; hunks: DiffHunk[] } {
  const lines = patch.split('\n');
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  const headerLines: string[] = [];
  let inHunk = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

    if (line.startsWith('@@')) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      const m = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
      if (m) {
        currentHunk = {
          header: line,
          oldStart: parseInt(m[1], 10),
          oldCount: parseInt(m[2] || '1', 10),
          newStart: parseInt(m[3], 10),
          newCount: parseInt(m[4] || '1', 10),
          lines: [],
        };
        inHunk = true;
      }
    } else if (inHunk && currentHunk) {
      if (line.length > 0 && /^[ \+\-\\]/.test(line)) {
        currentHunk.lines.push(line);
      } else if (line === '') {
        currentHunk.lines.push(' ' + line);
      } else {
        inHunk = false;
        hunks.push(currentHunk);
        currentHunk = null;
        headerLines.push(line);
      }
    } else {
      headerLines.push(line);
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return { headerLines, hunks };
}

export function alignHunk(hunk: DiffHunk): SideBySideRow[] {
  const rows: SideBySideRow[] = [];
  let oldLine = hunk.oldStart;
  let newLine = hunk.newStart;
  const deletes: { text: string; oldLine: number }[] = [];

  for (const line of hunk.lines) {
    const prefix = line.charAt(0);
    const text = line.slice(1);

    if (prefix === ' ') {
      while (deletes.length > 0) {
        const d = deletes.shift()!;
        rows.push({ oldLine: d.oldLine, newLine: null, oldText: d.text, newText: '', kind: 'old' });
      }
      rows.push({ oldLine, newLine, oldText: text, newText: text, kind: 'context' });
      oldLine++;
      newLine++;
    } else if (prefix === '-') {
      deletes.push({ text, oldLine: oldLine++ });
    } else if (prefix === '+') {
      if (deletes.length > 0) {
        const d = deletes.shift()!;
        rows.push({ oldLine: d.oldLine, newLine, oldText: d.text, newText: text, kind: 'both' });
        newLine++;
      } else {
        rows.push({ oldLine: null, newLine, oldText: '', newText: text, kind: 'new' });
        newLine++;
      }
    } else if (prefix === '\\') {
      // "No newline at end of file" marker — skip for display
    }
  }

  while (deletes.length > 0) {
    const d = deletes.shift()!;
    rows.push({ oldLine: d.oldLine, newLine: null, oldText: d.text, newText: '', kind: 'old' });
  }

  return rows;
}

export function parseSideBySide(patch: string): ParsedDiff {
  const parsed = parsePatch(patch);
  return {
    headerLines: parsed.headerLines,
    hunks: parsed.hunks.map((h) => ({ ...h, rows: alignHunk(h) })),
  };
}

export function hunkToText(hunk: DiffHunk): string {
  return [hunk.header, ...hunk.lines].join('\n');
}

export function copyToClipboard(text: string): void {
  const host: any = globalThis;
  try {
    if (typeof host.__clipboard_set === 'function') {
      host.__clipboard_set(text);
      return;
    }
  } catch {}
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      return;
    }
  } catch {}
  // Fallback for environments without clipboard API
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch {}
}
