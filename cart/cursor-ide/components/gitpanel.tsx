const React: any = require('react');
const { useState, useEffect } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../runtime/primitives';
import { COLORS } from '../theme';
import { Glyph, Pill } from './shared';
import {
  gitAdd,
  gitBranchList,
  gitCheckout,
  gitCommit,
  gitDiff,
  gitDiffStats,
  gitLog,
  gitPull,
  gitPush,
  gitReset,
  gitStash,
  gitStashPop,
  gitStatusList,
  type GitCommitInfo,
  type GitDiff,
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
    setLogs(gitLog(workDir, 12));
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
                {branches.map((b) => (
                  <Pressable
                    key={b}
                    onPress={() => handleCheckout(b)}
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      backgroundColor: b === currentBranch ? COLORS.panelHover : 'transparent',
                    }}
                  >
                    <Text fontSize={11} color={b === currentBranch ? COLORS.green : COLORS.text}>
                      {b === currentBranch ? '* ' + b : b}
                    </Text>
                  </Pressable>
                ))}
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

      {/* Commit input */}
      <Row style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 10, gap: 8, alignItems: 'center' }}>
        <Box style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
          <TextInput
            value={commitMessage}
            onChangeText={setCommitMessage}
            placeholder="Commit message"
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
              backgroundColor: COLORS.blueDeep,
              borderWidth: 1,
              borderColor: COLORS.blue,
            }}
          >
            <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>
              Commit
            </Text>
          </Box>
        </Pressable>
      </Row>

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
      <Col style={{ borderTopWidth: 1, borderColor: COLORS.borderSoft, maxHeight: 180 }}>
        <Box style={{ padding: 10, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
          <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
            RECENT COMMITS
          </Text>
        </Box>
        <ScrollView style={{ flexGrow: 1, padding: 8 }}>
          <Col style={{ gap: 4 }}>
            {logs.map((log) => (
              <Row
                key={log.hash}
                style={{
                  alignItems: 'center',
                  gap: 8,
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: COLORS.panelRaised,
                }}
              >
                <Text fontSize={9} color={COLORS.blue} style={{ fontWeight: 'bold' }}>
                  {log.shortHash}
                </Text>
                <Text fontSize={10} color={COLORS.textBright} style={{ flexShrink: 1, flexBasis: 0 }}>
                  {log.message}
                </Text>
                <Box style={{ flexGrow: 1 }} />
                <Text fontSize={9} color={COLORS.textDim}>
                  {log.author}
                </Text>
                <Text fontSize={9} color={COLORS.textDim}>
                  {log.date}
                </Text>
              </Row>
            ))}
          </Col>
        </ScrollView>
      </Col>

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
