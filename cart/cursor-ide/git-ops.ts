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

export function gitCommit(workDir: string, message: string): { ok: boolean; output: string; error?: string } {
  try {
    const escaped = message.replace(/'/g, "'\\''");
    const raw = execRaw(`cd "${workDir}" && { git commit -m '${escaped}' 2>&1; echo __RC=$?; }`);
    const m = raw.match(/__RC=(-?\d+)\s*$/);
    const rc = m ? parseInt(m[1], 10) : -1;
    const output = m ? raw.slice(0, raw.length - m[0].length).trimEnd() : raw.trimEnd();
    if (rc === 0) return { ok: true, output };
    return { ok: false, output, error: output.split('\n').slice(-1)[0] || 'commit failed' };
  } catch (e: any) {
    return { ok: false, output: '', error: e?.message || String(e) };
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

export interface GitGraphLine {
  graph: string;
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export function gitLogGraph(workDir: string, count?: number): GitGraphLine[] {
  try {
    const n = count || 50;
    const SEP = '\x1f';
    const fmt = `${SEP}%H${SEP}%h${SEP}%s${SEP}%an${SEP}%ad`;
    const raw = execRaw(
      `cd "${workDir}" && git log --graph --all --date=short --pretty=format:"${fmt}" -n ${n} 2>/dev/null`,
    );
    const out: GitGraphLine[] = [];
    for (const line of raw.split('\n')) {
      const idx = line.indexOf(SEP);
      if (idx < 0) {
        // Pure graph line (merge bracket, empty, etc.)
        const g = line.replace(/\s+$/, '');
        if (g.length > 0) out.push({ graph: g, hash: '', shortHash: '', message: '', author: '', date: '' });
        continue;
      }
      const graph = line.slice(0, idx).replace(/\s+$/, '');
      const parts = line.slice(idx + 1).split(SEP);
      out.push({
        graph,
        hash: parts[0] || '',
        shortHash: parts[1] || '',
        message: parts[2] || '',
        author: parts[3] || '',
        date: parts[4] || '',
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function gitCherryPick(workDir: string, hash: string): { ok: boolean; error?: string } {
  try {
    execRaw(`cd "${workDir}" && git cherry-pick "${hash}" 2>&1`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function gitRevert(workDir: string, hash: string): { ok: boolean; error?: string } {
  try {
    execRaw(`cd "${workDir}" && git revert --no-edit "${hash}" 2>&1`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
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

export function gitDiscard(workDir: string, path: string, untracked?: boolean): { ok: boolean; error?: string } {
  try {
    if (untracked) {
      execRaw(`cd "${workDir}" && rm -rf -- "${path}" 2>&1`);
    } else {
      execRaw(`cd "${workDir}" && git checkout -- "${path}" 2>&1`);
    }
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

export interface GitStashEntry {
  index: number;
  ref: string;
  message: string;
}

export function gitStashList(workDir: string): GitStashEntry[] {
  try {
    const raw = execRaw(`cd "${workDir}" && git stash list 2>/dev/null`);
    const lines = trimLines(raw);
    return lines.map((line, i) => {
      const colon = line.indexOf(':');
      const ref = colon > 0 ? line.slice(0, colon).trim() : `stash@{${i}}`;
      const message = colon > 0 ? line.slice(colon + 1).trim() : line.trim();
      return { index: i, ref, message };
    });
  } catch {
    return [];
  }
}

export function gitStashApply(workDir: string, ref: string): { ok: boolean; error?: string } {
  try {
    execRaw(`cd "${workDir}" && git stash apply "${ref}" 2>&1`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function gitStashDrop(workDir: string, ref: string): { ok: boolean; error?: string } {
  try {
    execRaw(`cd "${workDir}" && git stash drop "${ref}" 2>&1`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function gitAmend(workDir: string, message?: string): { ok: boolean; error?: string } {
  try {
    if (message && message.trim()) {
      const escaped = message.replace(/'/g, "'\\''");
      execRaw(`cd "${workDir}" && git commit --amend -m '${escaped}' 2>&1`);
    } else {
      execRaw(`cd "${workDir}" && git commit --amend --no-edit 2>&1`);
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function gitBranchDelete(workDir: string, branch: string, force?: boolean): { ok: boolean; error?: string } {
  try {
    const flag = force ? '-D' : '-d';
    execRaw(`cd "${workDir}" && git branch ${flag} "${branch}" 2>&1`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function gitAheadBehind(workDir: string, branch: string): { ahead: number; behind: number } {
  try {
    const raw = execRaw(
      `cd "${workDir}" && git rev-list --left-right --count "${branch}@{upstream}...${branch}" 2>/dev/null`,
    ).trim();
    if (!raw) return { ahead: 0, behind: 0 };
    const parts = raw.includes('\t') ? raw.split('\t') : raw.split(/\s+/);
    if (parts.length < 2) return { ahead: 0, behind: 0 };
    return { behind: parseInt(parts[0], 10) || 0, ahead: parseInt(parts[1], 10) || 0 };
  } catch {
    return { ahead: 0, behind: 0 };
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
