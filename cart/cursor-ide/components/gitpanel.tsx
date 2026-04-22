const React: any = require('react');
const { useState, useEffect } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../runtime/primitives';
import { COLORS } from '../theme';
import { Glyph, Pill } from './shared';
import {
  gitAdd,
  gitAheadBehind,
  gitAmend,
  gitBranchDelete,
  gitBranchList,
  gitCheckout,
  gitCherryPick,
  gitCommit,
  gitDiff,
  gitDiscard,
  gitDiffStats,
  gitLog,
  gitLogGraph,
  gitPull,
  gitPush,
  gitReset,
  gitRevert,
  gitStash,
  gitStashApply,
  gitStashDrop,
  gitStashList,
  gitStashPop,
  gitStatusList,
  type GitCommitInfo,
  type GitDiff,
  type GitGraphLine,
  type GitStashEntry,
} from '../git-ops';

function execRaw(cmd: string): string {
  const host: any = globalThis as any;
  if (typeof host.__exec !== 'function') return '';
  try {
    const out = host.__exec(cmd);
    return typeof out === 'string' ? out : String(out ?? '');
  } catch {
    return '';
  }
}

export function GitPanel(props: {
  workDir: string;
  gitBranch: string;
  changedCount: number;
  stagedCount: number;
  onRefresh?: () => void;
}) {
  const { workDir } = props;

  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState(props.gitBranch);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  const [commitMessage, setCommitMessage] = useState('');
  const [stagedFiles, setStagedFiles] = useState<{ path: string; code: string }[]>([]);
  const [unstagedFiles, setUnstagedFiles] = useState<{ path: string; code: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<GitDiff[]>([]);

  const [diffStats, setDiffStats] = useState({ additions: 0, deletions: 0, files: 0 });
  const [ahead, setAhead] = useState(0);
  const [behind, setBehind] = useState(0);

  const [logs, setLogs] = useState<GitCommitInfo[]>([]);
  const [stashes, setStashes] = useState<GitStashEntry[]>([]);
  const [graph, setGraph] = useState<GitGraphLine[]>([]);
  const [cherryPickHash, setCherryPickHash] = useState<string | null>(null);
  const [branchAheadBehind, setBranchAheadBehind] = useState<Record<string, { ahead: number; behind: number }>>({});
  const [errorBanner, setErrorBanner] = useState('');

  function loadAheadBehind() {
    const counts = execRaw(`cd "${workDir}" && git rev-list --left-right --count @{upstream}...HEAD 2>/dev/null`).trim();
    if (counts) {
      const parts = counts.includes('\t') ? counts.split('\t') : counts.split(' ');
      if (parts.length >= 2) {
        setBehind(parseInt(parts[0], 10) || 0);
        setAhead(parseInt(parts[1], 10) || 0);
      }
    } else {
      setAhead(0);
      setBehind(0);
    }
  }

  function refresh() {
    const branchInfo = gitBranchList(workDir);
    setBranches(branchInfo.branches);
    setCurrentBranch(branchInfo.current);

    const status = gitStatusList(workDir);
    const staged: { path: string; code: string }[] = [];
    const unstaged: { path: string; code: string }[] = [];
    for (const item of status) {
      if (item.staged) staged.push({ path: item.path, code: item.code });
      else unstaged.push({ path: item.path, code: item.code });
    }
    setStagedFiles(staged);
    setUnstagedFiles(unstaged);

    const allDiffs = gitDiff(workDir);
    setDiffs(allDiffs);

    setDiffStats(gitDiffStats(workDir));
    setLogs(gitLog(workDir, 50));
    setGraph(gitLogGraph(workDir, 50));
    setStashes(gitStashList(workDir));
    const ab: Record<string, { ahead: number; behind: number }> = {};
    for (const b of branchInfo.branches) {
      if (b.startsWith('remotes/')) continue;
      ab[b] = gitAheadBehind(workDir, b);
    }
    setBranchAheadBehind(ab);
    loadAheadBehind();
    setErrorBanner('');
    props.onRefresh?.();
  }

  useEffect(() => {
    refresh();
  }, [workDir]);

  function handleCommit() {
    if (!commitMessage.trim()) {
      setErrorBanner('Enter a commit message');
      return;
    }
    if (stagedFiles.length === 0) {
      setErrorBanner('Nothing staged — stage files before committing');
      return;
    }
    const res = gitCommit(workDir, commitMessage.trim());
    if (!res.ok) {
      setErrorBanner(res.error || 'Commit failed');
      return;
    }
    setCommitMessage('');
    refresh();
  }

  function handlePush() {
    const res = gitPush(workDir);
    if (!res.ok) setErrorBanner(res.error || 'Push failed');
    else refresh();
  }

  function handlePull() {
    const res = gitPull(workDir);
    if (!res.ok) setErrorBanner(res.error || 'Pull failed');
    else refresh();
  }

  function handleCheckout(branch: string) {
    const res = gitCheckout(workDir, branch);
    if (!res.ok) setErrorBanner(res.error || 'Checkout failed');
    else {
      setShowBranchDropdown(false);
      refresh();
    }
  }

  function handleCreateBranch(name: string) {
    if (!name.trim()) return;
    const res = gitCheckout(workDir, name.trim(), true);
    if (!res.ok) setErrorBanner(res.error || 'Create branch failed');
    else {
      setShowBranchDropdown(false);
      refresh();
    }
  }

  function handleAmend() {
    const res = gitAmend(workDir, commitMessage.trim() || undefined);
    if (!res.ok) setErrorBanner(res.error || 'Amend failed');
    else {
      setCommitMessage('');
      refresh();
    }
  }

  function handleDeleteBranch(branch: string) {
    if (branch === currentBranch) {
      setErrorBanner('Cannot delete the current branch');
      return;
    }
    const res = gitBranchDelete(workDir, branch);
    if (!res.ok) setErrorBanner(res.error || 'Delete branch failed');
    else refresh();
  }

  function handleStashApply(ref: string) {
    const res = gitStashApply(workDir, ref);
    if (!res.ok) setErrorBanner(res.error || 'Stash apply failed');
    else refresh();
  }

  function handleCherryPick(hash: string, targetBranch: string) {
    if (targetBranch && targetBranch !== currentBranch) {
      const co = gitCheckout(workDir, targetBranch);
      if (!co.ok) {
        setErrorBanner(co.error || 'Checkout target failed');
        return;
      }
    }
    const res = gitCherryPick(workDir, hash);
    setCherryPickHash(null);
    if (!res.ok) setErrorBanner(res.error || 'Cherry-pick failed');
    refresh();
  }

  function handleRevert(hash: string) {
    const res = gitRevert(workDir, hash);
    if (!res.ok) setErrorBanner(res.error || 'Revert failed');
    refresh();
  }

  function handleStashDrop(ref: string) {
    const res = gitStashDrop(workDir, ref);
    if (!res.ok) setErrorBanner(res.error || 'Stash drop failed');
    else refresh();
  }

  function handleDiscard(path: string, code: string) {
    const untracked = code === '??';
    const res = gitDiscard(workDir, path, untracked);
    if (!res.ok) setErrorBanner(res.error || 'Discard failed');
    refresh();
  }

  function toggleStage(path: string, isStaged: boolean) {
    if (isStaged) {
      const res = gitReset(workDir, path);
      if (!res.ok) setErrorBanner(res.error || 'Unstage failed');
    } else {
      const res = gitAdd(workDir, path);
      if (!res.ok) setErrorBanner(res.error || 'Stage failed');
    }
    refresh();
  }

  function selectedDiff(): GitDiff | null {
    if (!selectedFile) return null;
    return diffs.find((d) => d.path === selectedFile) || null;
  }

  function statusTone(code: string): string {
    if (code === '??') return COLORS.blue;
    if (code.includes('D')) return COLORS.red;
    if (code.includes('A')) return COLORS.green;
    if (code.includes('M')) return COLORS.yellow;
    return COLORS.textMuted;
  }

  function statusLabel(code: string): string {
    if (code === '??') return 'new';
    if (code.includes('M')) return 'mod';
    if (code.includes('A')) return 'add';
    if (code.includes('D')) return 'del';
    if (code.includes('R')) return 'ren';
    return code;
  }

  return (
    <Col style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      {/* Header */}
      <Row
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 12,
          borderBottomWidth: 1,
          borderColor: COLORS.borderSoft,
        }}
      >
        <Row style={{ alignItems: 'center', gap: 8 }}>
          <Glyph icon="git" tone={COLORS.green} backgroundColor="transparent" tiny={true} />
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
            Source Control
          </Text>
        </Row>
        <Pressable onPress={refresh}>
          <Text fontSize={10} color={COLORS.blue}>
            RF
          </Text>
        </Pressable>
      </Row>

      {/* Branch selector */}
      <Box style={{ padding: 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Pressable
          onPress={() => setShowBranchDropdown(!showBranchDropdown)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.panelRaised,
          }}
        >
          <Pill label={currentBranch} color={COLORS.green} tiny={true} />
          <Box style={{ flexGrow: 1 }} />
          <Text fontSize={10} color={COLORS.textDim}>
            {showBranchDropdown ? '▲' : '▼'}
          </Text>
        </Pressable>

        {showBranchDropdown && (
          <Col
            style={{
              marginTop: 6,
              gap: 4,
              padding: 8,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.panelRaised,
              maxHeight: 200,
            }}
          >
            <ScrollView style={{ flexGrow: 1 }}>
              <Col style={{ gap: 4 }}>
                {branches.filter((b) => !b.startsWith('remotes/')).map((b) => {
                  const ab = branchAheadBehind[b] || { ahead: 0, behind: 0 };
                  const isCurrent = b === currentBranch;
                  return (
                    <Row
                      key={b}
                      style={{
                        alignItems: 'center',
                        gap: 6,
                        padding: 6,
                        borderRadius: 8,
                        backgroundColor: isCurrent ? COLORS.panelHover : 'transparent',
                      }}
                    >
                      <Pressable onPress={() => handleCheckout(b)} style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
                        <Text fontSize={11} color={isCurrent ? COLORS.green : COLORS.text}>
                          {isCurrent ? '* ' + b : b}
                        </Text>
                      </Pressable>
                      {ab.ahead > 0 ? <Pill label={'↑' + ab.ahead} color={COLORS.blue} tiny={true} /> : null}
                      {ab.behind > 0 ? <Pill label={'↓' + ab.behind} color={COLORS.orange} tiny={true} /> : null}
                      {!isCurrent ? (
                        <Pressable onPress={() => handleDeleteBranch(b)}>
                          <Box
                            style={{
                              paddingLeft: 6,
                              paddingRight: 6,
                              paddingTop: 2,
                              paddingBottom: 2,
                              borderRadius: 4,
                              borderWidth: 1,
                              borderColor: COLORS.red,
                            }}
                          >
                            <Text fontSize={8} color={COLORS.red} style={{ fontWeight: 'bold' }}>
                              ✕
                            </Text>
                          </Box>
                        </Pressable>
                      ) : null}
                    </Row>
                  );
                })}
                <Box style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 4 }} />
                <NewBranchInput onCreate={handleCreateBranch} />
              </Col>
            </ScrollView>
          </Col>
        )}
      </Box>

      {/* Error banner */}
      {errorBanner ? (
        <Box style={{ padding: 10, backgroundColor: COLORS.redDeep }}>
          <Text fontSize={10} color={COLORS.red}>
            {errorBanner}
          </Text>
        </Box>
      ) : null}

      {/* Stats + Push/Pull */}
      <Row
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 10,
          paddingBottom: 10,
          gap: 8,
        }}
      >
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          {diffStats.additions > 0 ? (
            <Pill label={'+' + diffStats.additions} color={COLORS.green} tiny={true} />
          ) : null}
          {diffStats.deletions > 0 ? (
            <Pill label={'-' + diffStats.deletions} color={COLORS.red} tiny={true} />
          ) : null}
          <Pill label={diffStats.files + ' files'} color={COLORS.textDim} tiny={true} />
        </Row>
        <Row style={{ gap: 8 }}>
          {ahead > 0 ? (
            <Pressable onPress={handlePush}>
              <Pill label={'Push ' + ahead} color={COLORS.blue} tiny={true} />
            </Pressable>
          ) : null}
          {behind > 0 ? (
            <Pressable onPress={handlePull}>
              <Pill label={'Pull ' + behind} color={COLORS.orange} tiny={true} />
            </Pressable>
          ) : null}
        </Row>
      </Row>

      {/* Commit composer */}
      <Col style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 10, gap: 6 }}>
        <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Text fontSize={9} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
            MESSAGE
          </Text>
          <Text fontSize={9} color={COLORS.textDim}>
            {stagedFiles.length} staged
          </Text>
        </Row>
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Box style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
            <TextInput
              value={commitMessage}
              onChangeText={setCommitMessage}
              placeholder="Commit message (summary of staged changes)"
              fontSize={11}
              color={COLORS.text}
              style={{
                height: 34,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 8,
                paddingLeft: 10,
                backgroundColor: COLORS.panelBg,
              }}
            />
          </Box>
          <Pressable onPress={handleCommit}>
            <Box
              style={{
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 8,
                paddingBottom: 8,
                borderRadius: 8,
                backgroundColor:
                  commitMessage.trim() && stagedFiles.length > 0 ? COLORS.blueDeep : COLORS.panelRaised,
                borderWidth: 1,
                borderColor:
                  commitMessage.trim() && stagedFiles.length > 0 ? COLORS.blue : COLORS.border,
              }}
            >
              <Text
                fontSize={10}
                color={commitMessage.trim() && stagedFiles.length > 0 ? COLORS.blue : COLORS.textDim}
                style={{ fontWeight: 'bold' }}
              >
                Commit
              </Text>
            </Box>
          </Pressable>
          <Pressable onPress={handleAmend}>
            <Box
              style={{
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 8,
                paddingBottom: 8,
                borderRadius: 8,
                backgroundColor: COLORS.panelRaised,
                borderWidth: 1,
                borderColor: COLORS.yellow,
              }}
            >
              <Text fontSize={10} color={COLORS.yellow} style={{ fontWeight: 'bold' }}>
                Amend
              </Text>
            </Box>
          </Pressable>
        </Row>
      </Col>

      {/* File lists */}
      <Row style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
        {/* Staged */}
        <Col style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, borderRightWidth: 1, borderColor: COLORS.borderSoft }}>
          <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
            <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
              STAGED ({stagedFiles.length})
            </Text>
          </Box>
          <ScrollView style={{ flexGrow: 1, padding: 8 }}>
            <Col style={{ gap: 4 }}>
              {stagedFiles.map((f) => (
                <FileRow
                  key={f.path}
                  path={f.path}
                  code={f.code}
                  checked={true}
                  selected={selectedFile === f.path}
                  tone={statusTone(f.code)}
                  label={statusLabel(f.code)}
                  onToggle={() => toggleStage(f.path, true)}
                  onSelect={() => setSelectedFile(f.path)}
                  onDiscard={() => handleDiscard(f.path, f.code)}
                />
              ))}
            </Col>
          </ScrollView>
        </Col>

        {/* Unstaged */}
        <Col style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, borderRightWidth: 1, borderColor: COLORS.borderSoft }}>
          <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
            <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
              CHANGES ({unstagedFiles.length})
            </Text>
          </Box>
          <ScrollView style={{ flexGrow: 1, padding: 8 }}>
            <Col style={{ gap: 4 }}>
              {unstagedFiles.map((f) => (
                <FileRow
                  key={f.path}
                  path={f.path}
                  code={f.code}
                  checked={false}
                  selected={selectedFile === f.path}
                  tone={statusTone(f.code)}
                  label={statusLabel(f.code)}
                  onToggle={() => toggleStage(f.path, false)}
                  onSelect={() => setSelectedFile(f.path)}
                  onDiscard={() => handleDiscard(f.path, f.code)}
                />
              ))}
            </Col>
          </ScrollView>
        </Col>

        {/* Diff preview */}
        <Col style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
          <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
            <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
              DIFF
            </Text>
          </Box>
          <ScrollView style={{ flexGrow: 1, padding: 10 }}>
            {selectedDiff() ? (
              <Col style={{ gap: 4 }}>
                <Row style={{ gap: 6, marginBottom: 6 }}>
                  <Pill label={selectedDiff()!.status} color={COLORS.yellow} tiny={true} />
                  <Text fontSize={10} color={COLORS.textBright}>
                    {selectedDiff()!.path}
                  </Text>
                  <Pill label={'+' + selectedDiff()!.additions} color={COLORS.green} tiny={true} />
                  <Pill label={'-' + selectedDiff()!.deletions} color={COLORS.red} tiny={true} />
                </Row>
                <Text fontSize={9} color={COLORS.textDim} style={{ whiteSpace: 'pre-wrap' }}>
                  {selectedDiff()!.patch}
                </Text>
              </Col>
            ) : (
              <Text fontSize={10} color={COLORS.textDim}>
                Select a file to view diff
              </Text>
            )}
          </ScrollView>
        </Col>
      </Row>

      {/* Recent commits */}
      <Col style={{ borderTopWidth: 1, borderColor: COLORS.borderSoft, maxHeight: 320 }}>
        <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
          <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
            COMMIT GRAPH ({graph.length})
          </Text>
        </Box>
        <ScrollView style={{ flexGrow: 1, padding: 8 }}>
          <Col style={{ gap: 2 }}>
            {/* Working tree (dirty state) entry at top */}
            {(stagedFiles.length > 0 || unstagedFiles.length > 0) ? (
              <Row
                style={{
                  alignItems: 'center',
                  gap: 8,
                  padding: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: COLORS.yellow,
                  backgroundColor: COLORS.panelRaised,
                }}
              >
                <Text fontSize={10} color={COLORS.yellow} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                  ●
                </Text>
                <Text fontSize={9} color={COLORS.yellow} style={{ fontWeight: 'bold' }}>
                  WIP
                </Text>
                <Text fontSize={10} color={COLORS.textBright} style={{ flexShrink: 1, flexBasis: 0 }}>
                  Working tree — {stagedFiles.length} staged, {unstagedFiles.length} unstaged (+{diffStats.additions}/-{diffStats.deletions})
                </Text>
                <Box style={{ flexGrow: 1 }} />
                <Pill label={currentBranch} color={COLORS.green} tiny={true} />
              </Row>
            ) : null}

            {graph.map((g, i) => {
              const isHeadCommit = g.hash && logs.length > 0 && g.hash === logs[0].hash;
              if (!g.hash) {
                return (
                  <Row key={'gfx-' + i} style={{ alignItems: 'center', paddingLeft: 8 }}>
                    <Text fontSize={10} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>
                      {g.graph || ' '}
                    </Text>
                  </Row>
                );
              }
              const isOpen = cherryPickHash === g.hash;
              return (
                <Col key={g.hash} style={{ gap: 2 }}>
                  <Row
                    style={{
                      alignItems: 'center',
                      gap: 6,
                      padding: 6,
                      borderRadius: 6,
                      backgroundColor: isHeadCommit ? COLORS.panelHover : COLORS.panelRaised,
                    }}
                  >
                    <Text fontSize={10} color={COLORS.blue} style={{ fontFamily: 'monospace' }}>
                      {g.graph || '*'}
                    </Text>
                    <Text fontSize={9} color={COLORS.blue} style={{ fontWeight: 'bold' }}>
                      {g.shortHash}
                    </Text>
                    <Text fontSize={10} color={COLORS.textBright} style={{ flexShrink: 1, flexBasis: 0 }}>
                      {g.message}
                    </Text>
                    <Box style={{ flexGrow: 1 }} />
                    <Text fontSize={9} color={COLORS.textDim}>
                      {g.author}
                    </Text>
                    <Text fontSize={9} color={COLORS.textDim}>
                      {g.date}
                    </Text>
                    <Pressable onPress={() => setCherryPickHash(isOpen ? null : g.hash)}>
                      <Pill label="pick" color={COLORS.green} tiny={true} />
                    </Pressable>
                    <Pressable onPress={() => handleRevert(g.hash)}>
                      <Pill label="revert" color={COLORS.orange} tiny={true} />
                    </Pressable>
                  </Row>
                  {isOpen ? (
                    <Row
                      style={{
                        alignItems: 'center',
                        gap: 6,
                        paddingLeft: 24,
                        paddingRight: 8,
                        paddingBottom: 6,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Text fontSize={9} color={COLORS.textMuted}>
                        Cherry-pick {g.shortHash} onto:
                      </Text>
                      {branches.filter((b) => !b.startsWith('remotes/')).map((b) => (
                        <Pressable key={b} onPress={() => handleCherryPick(g.hash, b)}>
                          <Pill label={b} color={b === currentBranch ? COLORS.green : COLORS.blue} tiny={true} />
                        </Pressable>
                      ))}
                      <Pressable onPress={() => setCherryPickHash(null)}>
                        <Pill label="cancel" color={COLORS.textDim} tiny={true} />
                      </Pressable>
                    </Row>
                  ) : null}
                </Col>
              );
            })}
          </Col>
        </ScrollView>
      </Col>

      {/* Stash list */}
      {stashes.length > 0 ? (
        <Col style={{ borderTopWidth: 1, borderColor: COLORS.borderSoft, maxHeight: 140 }}>
          <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
            <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
              STASHES ({stashes.length})
            </Text>
          </Box>
          <ScrollView style={{ flexGrow: 1, padding: 8 }}>
            <Col style={{ gap: 4 }}>
              {stashes.map((s) => (
                <Row
                  key={s.ref}
                  style={{
                    alignItems: 'center',
                    gap: 8,
                    padding: 8,
                    borderRadius: 8,
                    backgroundColor: COLORS.panelRaised,
                  }}
                >
                  <Text fontSize={9} color={COLORS.yellow} style={{ fontWeight: 'bold' }}>
                    {s.ref}
                  </Text>
                  <Text fontSize={10} color={COLORS.text} style={{ flexShrink: 1, flexBasis: 0 }}>
                    {s.message}
                  </Text>
                  <Box style={{ flexGrow: 1 }} />
                  <Pressable onPress={() => handleStashApply(s.ref)}>
                    <Pill label="apply" color={COLORS.green} tiny={true} />
                  </Pressable>
                  <Pressable onPress={() => handleStashDrop(s.ref)}>
                    <Pill label="drop" color={COLORS.red} tiny={true} />
                  </Pressable>
                </Row>
              ))}
            </Col>
          </ScrollView>
        </Col>
      ) : null}

      {/* Stash actions */}
      <Row
        style={{
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          padding: 10,
          borderTopWidth: 1,
          borderColor: COLORS.borderSoft,
        }}
      >
        <Pressable
          onPress={() => {
            const res = gitStashPop(workDir);
            if (!res.ok) setErrorBanner(res.error || 'Stash pop failed');
            else refresh();
          }}
        >
          <Text fontSize={10} color={COLORS.orange}>
            Stash Pop
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            const res = gitStash(workDir);
            if (!res.ok) setErrorBanner(res.error || 'Stash failed');
            else refresh();
          }}
        >
          <Text fontSize={10} color={COLORS.yellow}>
            Stash
          </Text>
        </Pressable>
      </Row>
    </Col>
  );
}

function FileRow(props: {
  path: string;
  code: string;
  checked: boolean;
  selected: boolean;
  tone: string;
  label: string;
  onToggle: () => void;
  onSelect: () => void;
  onDiscard?: () => void;
}) {
  return (
    <Pressable
      onPress={props.onSelect}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 8,
        borderRadius: 8,
        backgroundColor: props.selected ? COLORS.panelHover : COLORS.panelRaised,
      }}
    >
      <Pressable onPress={props.onToggle}>
        <Box
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            borderWidth: 1,
            borderColor: props.tone,
            backgroundColor: props.checked ? props.tone : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {props.checked ? (
            <Text fontSize={8} color={COLORS.appBg} style={{ fontWeight: 'bold' }}>
              ✓
            </Text>
          ) : null}
        </Box>
      </Pressable>
      <Text fontSize={9} color={props.tone} style={{ fontWeight: 'bold', minWidth: 28 }}>
        {props.label}
      </Text>
      <Text fontSize={10} color={props.selected ? COLORS.textBright : COLORS.text} style={{ flexShrink: 1, flexBasis: 0 }}>
        {props.path}
      </Text>
      {props.onDiscard ? (
        <Pressable onPress={props.onDiscard}>
          <Box
            style={{
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 2,
              paddingBottom: 2,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: COLORS.red,
            }}
          >
            <Text fontSize={8} color={COLORS.red} style={{ fontWeight: 'bold' }}>
              ✕
            </Text>
          </Box>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function NewBranchInput(props: { onCreate: (name: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <Row style={{ gap: 8, alignItems: 'center', padding: 6 }}>
      <Box style={{ flexGrow: 1 }}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="New branch..."
          fontSize={11}
          color={COLORS.text}
          style={{
            height: 30,
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: 6,
            paddingLeft: 8,
            backgroundColor: COLORS.panelBg,
          }}
        />
      </Box>
      <Pressable
        onPress={() => {
          props.onCreate(value);
          setValue('');
        }}
      >
        <Box
          style={{
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 6,
            backgroundColor: COLORS.greenDeep,
            borderWidth: 1,
            borderColor: COLORS.green,
          }}
        >
          <Text fontSize={9} color={COLORS.green} style={{ fontWeight: 'bold' }}>
            Create
          </Text>
        </Box>
      </Pressable>
    </Row>
  );
}
