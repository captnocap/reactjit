/**
 * DiffPanel — shows accumulated file changes for this session.
 *
 * Tracks which files were edited/written, +/- counts, and recent diff chunks.
 * Pure React — powered by useDiffAccumulator polling claude:classified.
 */
import React, { useState, useMemo } from 'react';
import { Box, Text, Pressable, ScrollView } from '@reactjit/core';
import { C } from '../theme';
import { useDiffAccumulator } from '../hooks/useDiffAccumulator';
import type { FileDiff } from '../hooks/useDiffAccumulator';

type FilterBucket = 'all' | 'src' | 'lua' | 'packages' | 'other';

function getBucket(path: string): Exclude<FilterBucket, 'all'> {
  if (/(?:^|\/)src\//.test(path))      return 'src';
  if (/(?:^|\/)lua\//.test(path))      return 'lua';
  if (/(?:^|\/)packages\//.test(path)) return 'packages';
  return 'other';
}

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

function FileRow({ file }: { file: FileDiff }) {
  const [expanded, setExpanded] = useState(false);
  const name = basename(file.path);
  const dir = file.path.length > name.length
    ? file.path.slice(0, file.path.length - name.length - 1)
    : '';

  return (
    <Pressable onPress={() => setExpanded(e => !e)} style={{
      borderBottomWidth: 1,
      borderColor: C.border + '33',
      paddingTop: 5,
      paddingBottom: 5,
      paddingLeft: 10,
      paddingRight: 10,
      backgroundColor: expanded ? C.surface + '44' : 'transparent',
    }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 8, color: C.textDim }}>{expanded ? '\u25BC' : '\u25B6'}</Text>
        <Box style={{ flexGrow: 1, gap: 1 }}>
          <Text style={{ fontSize: 10, color: C.text }}>{name}</Text>
          {dir.length > 0 && (
            <Text style={{ fontSize: 8, color: C.textDim }}>
              {dir.length > 40 ? '\u2026' + dir.slice(-38) : dir}
            </Text>
          )}
        </Box>
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {file.added > 0 && (
            <Text style={{ fontSize: 9, color: C.approve }}>{`+${file.added}`}</Text>
          )}
          {file.removed > 0 && (
            <Text style={{ fontSize: 9, color: C.deny }}>{`-${file.removed}`}</Text>
          )}
        </Box>
      </Box>

      {expanded && file.chunks.length > 0 && (
        <Box style={{ marginTop: 5, gap: 1, paddingLeft: 14 }}>
          {file.chunks.slice(-12).map((line, i) => {
            const isAdd = line.startsWith('+');
            const isRem = line.startsWith('-');
            const color = isAdd ? C.approve : isRem ? C.deny : C.textDim;
            const display = line.length > 70 ? line.slice(0, 70) + '\u2026' : line;
            return (
              <Text key={i} style={{ fontSize: 8, color, fontFamily: 'monospace' }}>
                {display || ' '}
              </Text>
            );
          })}
          {file.chunks.length > 12 && (
            <Text style={{ fontSize: 8, color: C.textDim }}>
              {`\u2026 ${file.chunks.length - 12} more`}
            </Text>
          )}
        </Box>
      )}
    </Pressable>
  );
}

const BUCKETS: FilterBucket[] = ['all', 'src', 'lua', 'packages', 'other'];

function bucketColor(bucket: FilterBucket): string {
  switch (bucket) {
    case 'all':      return C.accent;
    case 'src':      return C.approve;
    case 'lua':      return C.warning;
    case 'packages': return C.deny;
    case 'other':    return C.textDim;
  }
}

export function DiffPanel() {
  const { state, fileList, clear } = useDiffAccumulator();
  const [filter, setFilter] = useState<FilterBucket>('all');

  const counts = useMemo(() => {
    const c: Record<FilterBucket, number> = { all: fileList.length, src: 0, lua: 0, packages: 0, other: 0 };
    for (const f of fileList) c[getBucket(f.path)]++;
    return c;
  }, [fileList]);

  const visible = useMemo(() =>
    filter === 'all' ? fileList : fileList.filter(f => getBucket(f.path) === filter),
    [fileList, filter]
  );

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
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
          <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'DIFFS'}</Text>
          {fileList.length > 0 && (
            <Text style={{ fontSize: 8, color: C.textDim }}>
              {filter === 'all' ? `${fileList.length} files` : `${visible.length}/${fileList.length}`}
            </Text>
          )}
        </Box>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {state.totalAdded > 0 && (
            <Text style={{ fontSize: 9, color: C.approve }}>{`+${state.totalAdded}`}</Text>
          )}
          {state.totalRemoved > 0 && (
            <Text style={{ fontSize: 9, color: C.deny }}>{`-${state.totalRemoved}`}</Text>
          )}
          <Pressable onPress={clear} style={{
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
            borderWidth: 1, borderColor: C.border, borderRadius: 4,
          }}>
            <Text style={{ fontSize: 8, color: C.textMuted }}>{'clear'}</Text>
          </Pressable>
        </Box>
      </Box>

      {/* Filter chips — only when there are files */}
      {fileList.length > 0 && (
        <Box style={{
          flexDirection: 'row',
          gap: 4,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 5,
          paddingBottom: 5,
          borderBottomWidth: 1,
          borderColor: C.border + '44',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}>
          {BUCKETS.filter(b => b === 'all' || counts[b] > 0).map(b => {
            const active = filter === b;
            const color = bucketColor(b);
            return (
              <Pressable key={b} onPress={() => setFilter(b)} style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 2,
                paddingBottom: 2,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: active ? color + '88' : C.border + '44',
                backgroundColor: active ? color + '22' : 'transparent',
              }}>
                <Text style={{ fontSize: 9, color: active ? color : C.textMuted }}>{b}</Text>
                {b !== 'all' && (
                  <Text style={{ fontSize: 8, color: active ? color + 'cc' : C.textDim }}>
                    {String(counts[b])}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </Box>
      )}

      <ScrollView style={{ flexGrow: 1 }}>
        {visible.length === 0 && fileList.length === 0 ? (
          <Box style={{ padding: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: C.textDim }}>{'No file edits detected yet.'}</Text>
            <Text style={{ fontSize: 9, color: C.textDim + '88' }}>{'Watches Edit/Write tool calls.'}</Text>
          </Box>
        ) : visible.length === 0 ? (
          <Box style={{ padding: 16 }}>
            <Text style={{ fontSize: 10, color: C.textDim }}>{`No ${filter}/ files changed this session.`}</Text>
          </Box>
        ) : (
          visible.map(file => <FileRow key={file.path} file={file} />)
        )}
      </ScrollView>
    </Box>
  );
}
