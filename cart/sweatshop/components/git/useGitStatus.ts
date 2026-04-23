
import { gitStatusList, gitDiffStats, gitAheadBehind, gitBranchList } from '../../git-ops';

export interface GitStatusSnapshot {
  staged: { path: string; code: string }[];
  unstaged: { path: string; code: string }[];
  stats: { additions: number; deletions: number; files: number };
  ahead: number;
  behind: number;
  branch: string;
}

export function useGitStatus(workDir: string, intervalMs = 5000) {
  const [status, setStatus] = useState<GitStatusSnapshot>({
    staged: [], unstaged: [], stats: { additions: 0, deletions: 0, files: 0 }, ahead: 0, behind: 0, branch: 'main',
  });

  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const list = gitStatusList(workDir);
      const staged = list.filter((i) => i.staged).map((i) => ({ path: i.path, code: i.code }));
      const unstaged = list.filter((i) => !i.staged).map((i) => ({ path: i.path, code: i.code }));
      const stats = gitDiffStats(workDir);
      const branchInfo = gitBranchList(workDir);
      const ab = gitAheadBehind(workDir, branchInfo.current);
      setStatus({ staged, unstaged, stats, ahead: ab.ahead, behind: ab.behind, branch: branchInfo.current });
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [workDir, intervalMs]);

  return status;
}
