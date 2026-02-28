/**
 * CommitHelperOverlay — read git status, draft a message, commit on approval.
 *
 * Flow:
 *   1. Open → fetch git:status + git:diff for the workspace
 *   2. Auto-draft a conventional-commit message from changed file paths
 *   3. User edits the message in TextInput
 *   4. "Stage & Commit" → shell:exec git add -A && git commit -m "..."
 *   5. Show result inline, close on success
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, Pressable, ScrollView, TextInput, useLoveRPC } from '@reactjit/core';
import { C } from '../theme';

const CWD = '/home/siah/creative/reactjit/workspace';

// ── Message drafter ──────────────────────────────────────────────────

interface GitFile { status: string; file: string }

const STATUS_LABELS: Record<string, string> = {
  M: 'modified', A: 'added', D: 'deleted', R: 'renamed',
  '?': 'untracked', '!': 'ignored',
};

function bucketFiles(files: GitFile[]) {
  const buckets: Record<string, string[]> = {};
  for (const f of files) {
    const parts = f.file.replace(/^workspace\//, '').split('/');
    const top   = parts.length > 1 ? parts[0] : 'root';
    (buckets[top] ??= []).push(f.file);
  }
  return buckets;
}

function draftMessage(files: GitFile[], branch: string): string {
  if (files.length === 0) return 'chore: minor updates';

  const buckets  = bucketFiles(files);
  const tops     = Object.keys(buckets).sort((a, b) =>
    buckets[b].length - buckets[a].length,
  );
  const dominant = tops[0] ?? 'workspace';
  const count    = files.length;

  // Detect type from dominant bucket
  const type = dominant === 'src'   ? 'feat'
             : dominant === 'lua'   ? 'fix'
             : dominant === 'test'  ? 'test'
             : dominant === 'docs'  ? 'docs'
             : 'chore';

  // Detect scope
  const scope = dominant === 'root' ? 'workspace'
              : dominant;

  // Subject
  const subject = count === 1
    ? `update ${files[0].file.split('/').pop()}`
    : `update ${count} files across ${tops.slice(0, 2).join(', ')}`;

  return `${type}(${scope}): ${subject}`;
}

// ── Status badge ─────────────────────────────────────────────────────

function StatusBadge({ code }: { code: string }) {
  const ch    = code.trim()[0] ?? '?';
  const color = ch === 'M' ? C.warning
              : ch === 'A' ? C.approve
              : ch === 'D' ? C.deny
              : ch === '?' ? C.textDim
              : C.textMuted;
  return (
    <Box style={{
      width: 18, alignItems: 'center',
      backgroundColor: color + '1a', borderRadius: 2,
      paddingTop: 1, paddingBottom: 1,
    }}>
      <Text style={{ fontSize: 9, color, fontWeight: 'bold' }}>{ch}</Text>
    </Box>
  );
}

// ── Overlay ──────────────────────────────────────────────────────────

type Phase = 'loading' | 'ready' | 'committing' | 'done' | 'error';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function CommitHelperOverlay({ visible, onClose }: Props) {
  const rpcStatus = useLoveRPC('git:status');
  const rpcDiff   = useLoveRPC('git:diff');
  const rpcExec   = useLoveRPC('shell:exec');

  const rpcStatusRef = useRef(rpcStatus); rpcStatusRef.current = rpcStatus;
  const rpcDiffRef   = useRef(rpcDiff);   rpcDiffRef.current   = rpcDiff;
  const rpcExecRef   = useRef(rpcExec);   rpcExecRef.current   = rpcExec;

  const [phase,   setPhase]   = useState<Phase>('loading');
  const [branch,  setBranch]  = useState('');
  const [files,   setFiles]   = useState<GitFile[]>([]);
  const [stat,    setStat]    = useState('');
  const [message, setMessage] = useState('');
  const [result,  setResult]  = useState('');

  // Fetch on open
  useEffect(() => {
    if (!visible) return;
    setPhase('loading');
    setResult('');

    (async () => {
      try {
        const [statusRes, diffRes] = await Promise.all([
          rpcStatusRef.current({ cwd: CWD }) as Promise<any>,
          rpcDiffRef.current({ cwd: CWD }) as Promise<any>,
        ]);

        const fetchedFiles: GitFile[] = statusRes?.files ?? [];
        const fetchedBranch: string   = statusRes?.branch ?? 'main';
        const fetchedStat: string     = diffRes?.stat ?? '';

        setFiles(fetchedFiles);
        setBranch(fetchedBranch);
        setStat(fetchedStat);
        setMessage(draftMessage(fetchedFiles, fetchedBranch));
        setPhase('ready');
      } catch (e: any) {
        setResult(String(e?.message ?? e));
        setPhase('error');
      }
    })();
  }, [visible]);

  const handleCommit = useCallback(async () => {
    if (!message.trim()) return;
    setPhase('committing');
    try {
      const escaped = message.replace(/"/g, '\\"').replace(/`/g, '\\`');
      const res = await rpcExecRef.current({
        command: `cd "${CWD}" && git add -A && git commit -m "${escaped}"`,
      }) as any;

      if (res?.ok || res?.exitCode === 0) {
        setResult(res?.output?.trim() || 'Committed.');
        setPhase('done');
      } else {
        setResult(res?.output?.trim() || `Exit ${res?.exitCode}`);
        setPhase('error');
      }
    } catch (e: any) {
      setResult(String(e?.message ?? e));
      setPhase('error');
    }
  }, [message]);

  const handleMessageChange = useCallback((t: string) => setMessage(t), []);

  if (!visible) return null;

  const busy = phase === 'loading' || phase === 'committing';

  return (
    <Box style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#000000bb',
    }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

      <Box style={{
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: phase === 'done' ? C.approve + '88'
                   : phase === 'error' ? C.deny + '88'
                   : C.border,
        borderRadius: 8,
        width: 540,
        maxHeight: 560,
        flexDirection: 'column',
      }}>

        {/* Header */}
        <Box style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          padding: 14, borderBottomWidth: 1, borderColor: C.border, flexShrink: 0,
        }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 12, color: C.text, fontWeight: 'bold' }}>{'COMMIT HELPER'}</Text>
            {branch ? (
              <Box style={{
                backgroundColor: C.accent + '1a', borderRadius: 3,
                paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1,
              }}>
                <Text style={{ fontSize: 9, color: C.accent }}>{branch}</Text>
              </Box>
            ) : null}
          </Box>
          <Pressable onPress={onClose}>
            <Text style={{ fontSize: 11, color: C.textMuted }}>{'✕'}</Text>
          </Pressable>
        </Box>

        {/* Loading */}
        {phase === 'loading' && (
          <Box style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: C.textDim }}>{'Reading git status…'}</Text>
          </Box>
        )}

        {/* Ready / committing */}
        {(phase === 'ready' || phase === 'committing') && (
          <>
            {/* Changed files */}
            <Box style={{ maxHeight: 180, flexShrink: 0 }}>
              <ScrollView style={{ flexGrow: 1 }}>
                <Box style={{ padding: 10, gap: 4 }}>
                  {files.length === 0 ? (
                    <Text style={{ fontSize: 10, color: C.textMuted, padding: 4 }}>
                      {'No changes staged or unstaged.'}
                    </Text>
                  ) : files.map((f, i) => (
                    <Box key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <StatusBadge code={f.status} />
                      <Text style={{ fontSize: 10, color: C.textDim, flexGrow: 1 }}>{f.file}</Text>
                    </Box>
                  ))}
                </Box>
              </ScrollView>
            </Box>

            {/* Diff stat */}
            {stat.trim() ? (
              <Box style={{
                paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
                borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, flexShrink: 0,
              }}>
                <Text style={{ fontSize: 9, color: C.textMuted }}>{stat.trim()}</Text>
              </Box>
            ) : null}

            {/* Message editor */}
            <Box style={{ padding: 12, gap: 6, flexShrink: 0 }}>
              <Text style={{ fontSize: 9, color: C.textMuted, fontWeight: 'bold' }}>{'COMMIT MESSAGE'}</Text>
              <TextInput
                value={message}
                onChangeText={handleMessageChange}
                placeholder="feat(scope): description"
                placeholderColor={C.textMuted}
                editable={!busy}
                style={{
                  fontSize: 12, color: C.text,
                  backgroundColor: C.bg,
                  borderRadius: 4, borderWidth: 1, borderColor: C.borderActive,
                  paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7,
                  height: 36,
                }}
              />
            </Box>

            {/* Actions */}
            <Box style={{
              flexDirection: 'row', gap: 8, justifyContent: 'flex-end',
              paddingLeft: 12, paddingRight: 12, paddingBottom: 14, flexShrink: 0,
            }}>
              <Pressable onPress={onClose} style={{
                paddingLeft: 14, paddingRight: 14, paddingTop: 7, paddingBottom: 7,
                borderWidth: 1, borderColor: C.border, borderRadius: 5,
              }}>
                <Text style={{ fontSize: 11, color: C.textMuted }}>{'Cancel'}</Text>
              </Pressable>
              <Pressable onPress={handleCommit} style={{
                paddingLeft: 18, paddingRight: 18, paddingTop: 7, paddingBottom: 7,
                backgroundColor: busy || !message.trim() ? C.approve + '33' : C.approve + '22',
                borderWidth: 1,
                borderColor: busy || !message.trim() ? C.border : C.approve,
                borderRadius: 5,
              }}>
                <Text style={{ fontSize: 11, color: busy ? C.textMuted : C.approve, fontWeight: 'bold' }}>
                  {phase === 'committing' ? 'Committing…' : 'Stage All & Commit'}
                </Text>
              </Pressable>
            </Box>
          </>
        )}

        {/* Done */}
        {phase === 'done' && (
          <Box style={{ padding: 24, gap: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, color: C.approve }}>{'✓'}</Text>
            <Text style={{ fontSize: 11, color: C.approve, fontWeight: 'bold' }}>{'Committed!'}</Text>
            <Box style={{
              backgroundColor: C.bg, borderRadius: 4, padding: 10, width: '100%',
            }}>
              <Text style={{ fontSize: 9, color: C.textDim }}>{result}</Text>
            </Box>
            <Pressable onPress={onClose} style={{
              paddingLeft: 20, paddingRight: 20, paddingTop: 7, paddingBottom: 7,
              backgroundColor: C.approve + '22', borderWidth: 1,
              borderColor: C.approve, borderRadius: 5,
            }}>
              <Text style={{ fontSize: 11, color: C.approve }}>{'Close'}</Text>
            </Pressable>
          </Box>
        )}

        {/* Error */}
        {phase === 'error' && (
          <Box style={{ padding: 20, gap: 10 }}>
            <Text style={{ fontSize: 11, color: C.deny, fontWeight: 'bold' }}>{'Commit failed'}</Text>
            <Box style={{ backgroundColor: C.bg, borderRadius: 4, padding: 10 }}>
              <Text style={{ fontSize: 9, color: C.textDim }}>{result}</Text>
            </Box>
            <Pressable onPress={() => setPhase('ready')} style={{
              paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
              borderWidth: 1, borderColor: C.border, borderRadius: 4, alignSelf: 'flex-start',
            }}>
              <Text style={{ fontSize: 10, color: C.textMuted }}>{'← back'}</Text>
            </Pressable>
          </Box>
        )}
      </Box>
    </Box>
  );
}
