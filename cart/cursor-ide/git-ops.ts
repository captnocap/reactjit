const host: any = globalThis as any;

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  branch: string;
}

export interface GitDiff {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  patch: string;
}

function execRaw(cmd: string): string {
  if (typeof host.__exec !== 'function') throw new Error('__exec not available');
  const out = host.__exec(cmd);
  return typeof out === 'string' ? out : String(out ?? '');
}

function trimLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
}

export function gitCommit(workDir: string, message: string): { ok: boolean; error?: string } {
  try {
    const escaped = message.replace(/'/g, "'\\''");
    execRaw(`cd "${workDir}" && git commit -m '${escaped}' 2>&1`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function gitPush(workDir: string, remote?: string, branch?: string): { ok: boolean; output: string; error?: string } {
  try {
    const out = execRaw(`cd "${workDir}" && git push ${remote || ''} ${branch || ''} 2>&1`);
    return { ok: true, output: out };
  } catch (e: any) {
    return { ok: false, output: '', error: e?.message || String(e) };
  }
}

export function gitPull(workDir: string, remote?: string, branch?: string): { ok: boolean; output: string; error?: string } {
  try {
    const out = execRaw(`cd "${workDir}" && git pull ${remote || ''} ${branch || ''} 2>&1`);
    return { ok: true, output: out };
  } catch (e: any) {
    return { ok: false, output: '', error: e?.message || String(e) };
  }
}

export function gitBranchList(workDir: string): { current: string; branches: string[] } {
  try {
    const raw = execRaw(`cd "${workDir}" && git branch -a 2>/dev/null`);
    const lines = trimLines(raw);
    let current = '';
    const branches: string[] = [];
    for (const line of lines) {
      if (line.startsWith('* ')) {
        current = line.slice(2).trim();
        branches.push(current);
      } else if (line.startsWith('  ')) {
        const name = line.slice(2).trim();
        if (name) branches.push(name);
      } else if (line.trim()) {
        const name = line.trim();
        if (name) branches.push(name);
      }
    }
    return { current: current || 'main', branches };
  } catch {
    return { current: 'main', branches: [] };
  }
}

export function gitCheckout(workDir: string, branch: string, create?: boolean): { ok: boolean; error?: string } {
  try {
    const flag = create ? '-b ' : '';
    execRaw(`cd "${workDir}" && git checkout ${flag}${branch} 2>&1`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function gitDiff(workDir: string, staged?: boolean): GitDiff[] {
  try {
    const flag = staged ? '--staged' : '';
    const statRaw = execRaw(`cd "${workDir}" && git diff --numstat ${flag} 2>/dev/null`);
    const statLines = trimLines(statRaw);
    const stats: Record<string, { additions: number; deletions: number }> = {};
    for (const line of statLines) {
      const parts = line.split('\t');
      if (parts.length < 3) continue;
      const add = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
      const del = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
      const path = parts[2];
      stats[path] = { additions: add, deletions: del };
    }

    const patchRaw = execRaw(`cd "${workDir}" && git diff ${flag} 2>/dev/null`);
    const diffs: GitDiff[] = [];
    const chunks = patchRaw.split('diff --git a/');
    for (const chunk of chunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;
      const firstLineEnd = trimmed.indexOf('\n');
      const firstLine = firstLineEnd >= 0 ? trimmed.slice(0, firstLineEnd) : trimmed;
      const pathMatch = firstLine.match(/^(.*?)\s+b\//);
      const path = pathMatch ? pathMatch[1] : firstLine;
      if (!path) continue;

      let status: GitDiff['status'] = 'modified';
      if (chunk.includes('new file mode')) status = 'added';
      else if (chunk.includes('deleted file mode')) status = 'deleted';
      else if (chunk.includes('rename from')) status = 'renamed';

      const s = stats[path] || { additions: 0, deletions: 0 };
      diffs.push({ path, status, additions: s.additions, deletions: s.deletions, patch: 'diff --git a/' + chunk });
    }

    return diffs;
  } catch {
    return [];
  }
}

export function gitDiffStats(workDir: string): { additions: number; deletions: number; files: number } {
  try {
    const raw = execRaw(`cd "${workDir}" && git diff --numstat 2>/dev/null`);
    const lines = trimLines(raw);
    let additions = 0;
    let deletions = 0;
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 2) continue;
      additions += parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
      deletions += parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
    }
    return { additions, deletions, files: lines.length };
  } catch {
    return { additions: 0, deletions: 0, files: 0 };
  }
}

export function gitLog(workDir: string, count?: number): GitCommitInfo[] {
  try {
    const n = count || 20;
    const fmt = '%H|%h|%s|%an|%ad|%D';
    const raw = execRaw(`cd "${workDir}" && git log --pretty=format:"${fmt}" --date=short -n ${n} 2>/dev/null`);
    const lines = trimLines(raw);
    const currentBranch = gitBranchList(workDir).current;
    return lines.map((line) => {
      const parts = line.split('|');
      return {
        hash: parts[0] || '',
        shortHash: parts[1] || '',
        message: parts[2] || '',
        author: parts[3] || '',
        date: parts[4] || '',
        branch: currentBranch,
      };
    });
  } catch {
    return [];
  }
}

export function gitStash(workDir: string, message?: string): { ok: boolean; error?: string } {
  try {
    const msg = message ? `-m '${message.replace(/'/g, "'\\''")}'` : '';
    execRaw(`cd "${workDir}" && git stash push ${msg} 2>&1`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function gitStashPop(workDir: string): { ok: boolean; error?: string } {
  try {
    execRaw(`cd "${workDir}" && git stash pop 2>&1`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function gitAdd(workDir: string, path: string): { ok: boolean; error?: string } {
  try {
    execRaw(`cd "${workDir}" && git add "${path}" 2>&1`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function gitReset(workDir: string, path: string): { ok: boolean; error?: string } {
  try {
    execRaw(`cd "${workDir}" && git reset HEAD "${path}" 2>&1`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function gitStatusList(workDir: string): { path: string; code: string; staged: boolean }[] {
  try {
    const raw = execRaw(`cd "${workDir}" && git status --porcelain 2>/dev/null`);
    const lines = trimLines(raw);
    return lines.map((line) => {
      const code = line.slice(0, 2);
      let path = line.slice(3);
      const renameIdx = path.indexOf(' -> ');
      if (renameIdx >= 0) path = path.slice(renameIdx + 4);
      const staged = code.charAt(0) !== ' ' && code.charAt(0) !== '?';
      return { path, code, staged };
    });
  } catch {
    return [];
  }
}
