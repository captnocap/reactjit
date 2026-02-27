/**
 * GitPanel — live git status, recent commits, and diff stat.
 *
 * Polls git:status and git:log every 15s.
 * Shows branch, working tree files, and last 5 commits.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, Pressable, ScrollView, useLoveRPC, useLuaInterval } from '@reactjit/core';
import { C } from '../theme';

const CWD = '/home/siah/creative/reactjit';

interface GitFile {
  status: string;
  file: string;
}

interface GitCommit {
  hash: string;
  subject: string;
  author: string;
  date: string;
}

interface GitData {
  branch: string;
  files: GitFile[];
  commits: GitCommit[];
  diffStat: string;
  loading: boolean;
  error: string | null;
  lastFetched: number;
}

const EMPTY: GitData = {
  branch: '',
  files: [],
  commits: [],
  diffStat: '',
  loading: true,
  error: null,
  lastFetched: 0,
};

// Status code → color + label
const STATUS_META: Record<string, { color: string; label: string }> = {
  'M ': { color: C.approve, label: 'S' },   // staged modified
  'A ': { color: C.approve, label: 'A' },   // staged added
  'D ': { color: C.deny,    label: 'D' },   // staged deleted
  'R ': { color: C.accent,  label: 'R' },   // renamed
  ' M': { color: C.warning, label: 'm' },   // unstaged modified
  ' D': { color: C.deny,    label: 'd' },   // unstaged deleted
  'MM': { color: C.warning, label: 'M' },   // both staged+unstaged
  '??': { color: C.textDim, label: '?' },   // untracked
};

function fileMeta(status: string) {
  return STATUS_META[status] ?? { color: C.textDim, label: status.trim().slice(0, 1) || '?' };
}

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

function relativeDir(path: string): string {
  const name = basename(path);
  const dir = path.slice(0, path.length - name.length - 1);
  if (!dir) return '';
  return dir.length > 36 ? '…' + dir.slice(-34) : dir;
}

function FileRow({ file }: { file: GitFile }) {
  const { color, label } = fileMeta(file.status);
  const name = basename(file.file);
  const dir = relativeDir(file.file);

  return (
    <Box style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 4,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderColor: C.border + '22',
    }}>
      <Box style={{
        width: 14,
        height: 14,
        borderRadius: 3,
        backgroundColor: color + '22',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 8, color, fontFamily: 'monospace', fontWeight: 'bold' }}>{label}</Text>
      </Box>
      <Box style={{ flexGrow: 1, gap: 1 }}>
        <Text style={{ fontSize: 10, color: C.text }}>{name}</Text>
        {dir.length > 0 && (
          <Text style={{ fontSize: 8, color: C.textDim }}>{dir}</Text>
        )}
      </Box>
    </Box>
  );
}

function CommitRow({ commit, isFirst }: { commit: GitCommit; isFirst: boolean }) {
  const shortHash = commit.hash.slice(0, 7);
  const subject = commit.subject.length > 60
    ? commit.subject.slice(0, 60) + '…'
    : commit.subject;

  return (
    <Box style={{
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 5,
      paddingBottom: 5,
      borderBottomWidth: 1,
      borderColor: C.border + '22',
      backgroundColor: isFirst ? C.surface + '33' : 'transparent',
      gap: 2,
    }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 8, color: C.accentDim, fontFamily: 'monospace' }}>{shortHash}</Text>
        <Text style={{ fontSize: 8, color: C.textDim }}>{commit.date}</Text>
      </Box>
      <Text style={{ fontSize: 10, color: isFirst ? C.text : C.textDim }}>{subject}</Text>
    </Box>
  );
}

export function GitPanel() {
  const [data, setData] = useState<GitData>(EMPTY);
  const [showFiles, setShowFiles] = useState(true);

  const statusRpc = useLoveRPC('git:status');
  const logRpc = useLoveRPC('git:log');
  const diffRpc = useLoveRPC('git:diff');

  const statusRef = useRef(statusRpc);
  const logRef = useRef(logRpc);
  const diffRef = useRef(diffRpc);
  statusRef.current = statusRpc;
  logRef.current = logRpc;
  diffRef.current = diffRpc;

  const refresh = useCallback(() => {
    setData(prev => ({ ...prev, loading: true, error: null }));

    const args = { cwd: CWD };

    Promise.all([
      statusRef.current(args),
      logRef.current({ cwd: CWD, count: 8 }),
      diffRef.current(args),
    ]).then(([status, log, diff]: any[]) => {
      setData({
        branch: status?.branch ?? '',
        files: status?.files ?? [],
        commits: log?.commits ?? [],
        diffStat: diff?.stat ?? '',
        loading: false,
        error: null,
        lastFetched: Date.now(),
      });
    }).catch((e: any) => {
      setData(prev => ({
        ...prev,
        loading: false,
        error: String(e?.message ?? e),
      }));
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useLuaInterval(15000, refresh);

  const staged = data.files.filter(f => f.status[0] !== ' ' && f.status[0] !== '?');
  const unstaged = data.files.filter(f => f.status[0] === ' ');
  const untracked = data.files.filter(f => f.status === '??');

  const timeAgo = data.lastFetched > 0
    ? Math.floor((Date.now() - data.lastFetched) / 1000) + 's ago'
    : '';

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column', backgroundColor: C.panelE }}>
      {/* Header */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 12,
        paddingRight: 10,
        paddingTop: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderColor: C.border,
        flexShrink: 0,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'GIT'}</Text>
          {data.branch.length > 0 && (
            <Box style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: C.accent + '18',
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 2,
              paddingBottom: 2,
              borderRadius: 4,
            }}>
              <Text style={{ fontSize: 8, color: C.textDim }}>{'⎇'}</Text>
              <Text style={{ fontSize: 9, color: C.accent }}>{data.branch}</Text>
            </Box>
          )}
          {data.loading && (
            <Text style={{ fontSize: 8, color: C.textDim }}>{'…'}</Text>
          )}
        </Box>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {timeAgo.length > 0 && (
            <Text style={{ fontSize: 8, color: C.textDim }}>{timeAgo}</Text>
          )}
          <Pressable onPress={refresh} style={{
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
            borderWidth: 1, borderColor: C.border, borderRadius: 4,
          }}>
            <Text style={{ fontSize: 8, color: C.textMuted }}>{'↻'}</Text>
          </Pressable>
        </Box>
      </Box>

      {data.error && (
        <Box style={{ padding: 10 }}>
          <Text style={{ fontSize: 9, color: C.deny }}>{data.error}</Text>
        </Box>
      )}

      <ScrollView style={{ flexGrow: 1 }}>
        {/* Working tree section */}
        {data.files.length > 0 && (
          <Box style={{ flexShrink: 0 }}>
            <Pressable onPress={() => setShowFiles(v => !v)} style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 6,
              paddingBottom: 6,
              borderBottomWidth: 1,
              borderColor: C.border + '44',
              backgroundColor: C.surface + '22',
            }}>
              <Text style={{ fontSize: 8, color: C.textDim }}>{showFiles ? '▼' : '▶'}</Text>
              <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: 'bold' }}>
                {'CHANGES'}
              </Text>
              <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {staged.length > 0 && (
                  <Text style={{ fontSize: 8, color: C.approve }}>{`${staged.length} staged`}</Text>
                )}
                {unstaged.length > 0 && (
                  <Text style={{ fontSize: 8, color: C.warning }}>{`${unstaged.length} modified`}</Text>
                )}
                {untracked.length > 0 && (
                  <Text style={{ fontSize: 8, color: C.textDim }}>{`${untracked.length} new`}</Text>
                )}
              </Box>
            </Pressable>

            {showFiles && data.files.map((f, i) => (
              <FileRow key={i} file={f} />
            ))}
          </Box>
        )}

        {data.files.length === 0 && !data.loading && !data.error && (
          <Box style={{ paddingLeft: 10, paddingTop: 8, paddingBottom: 4 }}>
            <Text style={{ fontSize: 9, color: C.approve }}>{'✓ clean working tree'}</Text>
          </Box>
        )}

        {/* Commits section */}
        {data.commits.length > 0 && (
          <Box style={{ flexShrink: 0 }}>
            <Box style={{
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 6,
              paddingBottom: 6,
              borderBottomWidth: 1,
              borderColor: C.border + '44',
              backgroundColor: C.surface + '22',
            }}>
              <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: 'bold' }}>{'COMMITS'}</Text>
            </Box>
            {data.commits.map((c, i) => (
              <CommitRow key={c.hash} commit={c} isFirst={i === 0} />
            ))}
          </Box>
        )}

        {/* Diff stat */}
        {data.diffStat.length > 0 && (
          <Box style={{ padding: 10, flexShrink: 0 }}>
            <Text style={{ fontSize: 8, color: C.textDim, fontFamily: 'monospace' }}>{data.diffStat}</Text>
          </Box>
        )}
      </ScrollView>
    </Box>
  );
}
