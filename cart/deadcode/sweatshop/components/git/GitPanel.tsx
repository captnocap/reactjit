
import { Box, Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';
import { Glyph } from '../shared';
import { GitChanges } from './GitChanges';
import { GitCommitComposer } from './GitCommitComposer';
import { GitHistory } from './GitHistory';
import { GitStash } from './GitStash';
import { GitBranches } from './GitBranches';
import { useGitOps, type GitCommitInfo, type GitGraphLine, type GitStashEntry } from './useGitOps';

const TABS = [
  { id: 'changes', label: 'Changes' },
  { id: 'history', label: 'History' },
  { id: 'stash', label: 'Stash' },
  { id: 'branches', label: 'Branches' },
];

export function GitPanel(props: {
  workDir: string;
  gitBranch: string;
  changedCount: number;
  stagedCount: number;
  onRefresh?: () => void;
}) {
  const ops = useGitOps(props.workDir);
  const [tab, setTab] = useState('changes');
  const [commitMessage, setCommitMessage] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [commitOutput, setCommitOutput] = useState<{ ok: boolean; text: string } | null>(null);
  const [errorBanner, setErrorBanner] = useState('');

  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState(props.gitBranch);
  const [staged, setStaged] = useState<{ path: string; code: string }[]>([]);
  const [unstaged, setUnstaged] = useState<{ path: string; code: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<any[]>([]);
  const [stagedDiffs, setStagedDiffs] = useState<any[]>([]);
  const [diffStats, setDiffStats] = useState({ additions: 0, deletions: 0, files: 0 });
  const [ahead, setAhead] = useState(0);
  const [behind, setBehind] = useState(0);
  const [logs, setLogs] = useState<GitCommitInfo[]>([]);
  const [graph, setGraph] = useState<GitGraphLine[]>([]);
  const [stashes, setStashes] = useState<GitStashEntry[]>([]);
  const [branchAheadBehind, setBranchAheadBehind] = useState<Record<string, { ahead: number; behind: number }>>({});

  function refresh() {
    const bi = ops.branchList();
    setBranches(bi.branches);
    setCurrentBranch(bi.current);
    const s = ops.statusList();
    setStaged(s.filter((i) => i.staged).map((i) => ({ path: i.path, code: i.code })));
    setUnstaged(s.filter((i) => !i.staged).map((i) => ({ path: i.path, code: i.code })));
    setDiffs(ops.diff());
    setStagedDiffs(ops.diff(true));
    setDiffStats(ops.diffStats());
    setLogs(ops.log(50));
    setGraph(ops.logGraph(50));
    setStashes(ops.stashList());
    const ab: Record<string, { ahead: number; behind: number }> = {};
    for (const b of bi.branches) {
      if (!b.startsWith('remotes/')) ab[b] = ops.aheadBehind(b);
    }
    setBranchAheadBehind(ab);
    const upstream = ops.aheadBehind(bi.current);
    setAhead(upstream.ahead);
    setBehind(upstream.behind);
    setErrorBanner('');
    props.onRefresh?.();
  }

  useEffect(() => { refresh(); }, [props.workDir]);

  function run<T>(fn: () => { ok: boolean; error?: string } | { ok: boolean; output: string; error?: string }, then?: () => void) {
    const res = fn() as any;
    if (!res.ok) setErrorBanner(res.error || 'Failed');
    else { setErrorBanner(''); then?.(); }
    refresh();
  }

  const suggestions = Array.from(new Set(logs.slice(0, 30).map((l) => l.message).filter((m) => m && m.toLowerCase().includes(commitMessage.trim().toLowerCase()) && m !== commitMessage))).slice(0, 6);

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      <Row style={{ alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Row style={{ alignItems: 'center', gap: 8 }}>
          <Glyph icon="git" tone={COLORS.green} backgroundColor="transparent" tiny={true} />
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Source Control</Text>
        </Row>
        <Pressable onPress={refresh}><Text fontSize={10} color={COLORS.blue}>RF</Text></Pressable>
      </Row>

      {errorBanner ? (
        <Box style={{ padding: 10, backgroundColor: COLORS.redDeep }}>
          <Text fontSize={10} color={COLORS.red}>{errorBanner}</Text>
        </Box>
      ) : null}

      {/* Tabs */}
      <Row style={{ borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={{
              paddingLeft: 14,
              paddingRight: 14,
              paddingTop: 8,
              paddingBottom: 8,
              borderBottomWidth: 2,
              borderBottomColor: tab === t.id ? COLORS.blue : 'transparent',
              backgroundColor: tab === t.id ? COLORS.panelAlt : COLORS.panelBg,
            }}
          >
            <Text fontSize={11} color={tab === t.id ? COLORS.textBright : COLORS.text}>{t.label}</Text>
          </Pressable>
        ))}
      </Row>

      {tab === 'changes' && (
        <>
          <GitCommitComposer
            message={commitMessage}
            onChange={setCommitMessage}
            onCommit={() => {
              if (!commitMessage.trim()) { setErrorBanner('Enter a commit message'); return; }
              if (staged.length === 0) { setErrorBanner('Nothing staged'); return; }
              const r = ops.commit(commitMessage.trim());
              setCommitOutput({ ok: r.ok, text: r.output || '' });
              if (!r.ok) setErrorBanner(r.error || 'Commit failed');
              else setCommitMessage('');
              refresh();
            }}
            onAmend={() => run(() => ops.amend(commitMessage.trim() || undefined), () => setCommitMessage(''))}
            stagedCount={staged.length}
            suggestions={suggestions}
            showSuggest={showSuggest}
            onToggleSuggest={setShowSuggest}
            output={commitOutput}
            onDismissOutput={() => setCommitOutput(null)}
            diffStats={diffStats}
            ahead={ahead}
            behind={behind}
            onPush={() => run(() => ops.push())}
            onPull={() => run(() => ops.pull())}
          />
          <GitChanges
            staged={staged}
            unstaged={unstaged}
            diffs={diffs}
            stagedDiffs={stagedDiffs}
            selectedFile={selectedFile}
            onToggle={(path, isStaged) => run(() => isStaged ? ops.reset(path) : ops.add(path))}
            onSelect={setSelectedFile}
            onDiscard={(path, code) => run(() => ops.discard(path, code === '??'))}
          />
        </>
      )}

      {tab === 'history' && (
        <GitHistory
          logs={logs}
          graph={graph}
          branches={branches}
          currentBranch={currentBranch}
          onCherryPick={(hash, branch) => {
            if (branch !== currentBranch) {
              const co = ops.checkout(branch);
              if (!co.ok) { setErrorBanner(co.error || 'Checkout failed'); return; }
            }
            run(() => ops.cherryPick(hash));
          }}
          onRevert={(hash) => run(() => ops.revert(hash))}
        />
      )}

      {tab === 'stash' && (
        <GitStash
          stashes={stashes}
          onApply={(ref) => run(() => ops.stashApply(ref))}
          onDrop={(ref) => run(() => ops.stashDrop(ref))}
          onPop={() => run(() => ops.stashPop())}
          onStash={() => run(() => ops.stash())}
        />
      )}

      {tab === 'branches' && (
        <GitBranches
          branches={branches}
          currentBranch={currentBranch}
          aheadBehind={branchAheadBehind}
          onCheckout={(b) => run(() => ops.checkout(b))}
          onDelete={(b) => {
            if (b === currentBranch) { setErrorBanner('Cannot delete current branch'); return; }
            run(() => ops.branchDelete(b));
          }}
          onCreate={(name) => run(() => ops.checkout(name, true))}
        />
      )}
    </Col>
  );
}
