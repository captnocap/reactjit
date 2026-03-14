import React, { useState } from 'react';
import { Box, Text, ScrollView, Pressable, classifiers as S, useMount } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

const CHUNK_SIZE = 50; // lines per Text node

function useTextFile(path: string) {
  const [data, setData] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  // rjit-ignore-next-line
  useMount(() => {
    let cancelled = false;
    fetch(path)
      .then((res: any) => {
        if (!res.ok) throw new Error(`fetch failed: ${(res as any).error || `HTTP ${res.status}`}`);
        return res.text();
      })
      .then((text: string) => {
        if (!cancelled) { setData(text); setLoading(false); }
      })
      .catch((err: any) => {
        if (!cancelled) { setError(err instanceof Error ? err : new Error(String(err))); setLoading(false); }
      });
    return () => { cancelled = true; };
  });

  return { data, error, loading };
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable onPress={onPress} style={{
      backgroundColor: active ? c.primary : c.bgElevated,
      paddingLeft: 12, paddingRight: 12,
      paddingTop: 5, paddingBottom: 5,
      borderRadius: 4,
    }}>
      <Text style={{ fontSize: 11, color: active ? '#ffffff' : c.textSecondary }}>{label}</Text>
    </Pressable>
  );
}

export function LlmsTxtReader() {
  const c = useThemeColors();
  const { data: raw, loading, error } = useTextFile('llms.txt');
  const [mode, setMode] = useState<'single' | 'chunked'>('chunked');

  const lines = raw ? raw.split('\n') : [];

  const chunks: string[] = [];
  if (lines.length > 0) {
    for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
      chunks.push(lines.slice(i, i + CHUNK_SIZE).join('\n'));
    }
  }

  if (loading) {
    return (
      <S.FullCenter style={{ backgroundColor: c.bg }}>
        <Text style={{ fontSize: 14, color: c.textSecondary }}>Loading llms.txt...</Text>
      </S.FullCenter>
    );
  }

  if (error || !raw) {
    return (
      <S.FullCenter style={{ backgroundColor: c.bg, padding: 20 }}>
        <Text style={{ fontSize: 14, color: c.error }}>{`${error?.message || 'No data'}`}</Text>
      </S.FullCenter>
    );
  }

  const lineCount = lines.length;
  const sizeKB = Math.round(raw.length / 1024);

  return (
    <S.StoryRoot>
      {/* Header */}
      <S.RowCenterBorder style={{ height: 40, paddingLeft: 12, paddingRight: 12, gap: 10, borderBottomWidth: 1 }}>
        <Text style={{ fontSize: 13, color: c.textDim }}>
          {`llms.txt — ${lineCount} lines, ${sizeKB} KB`}
        </Text>
        <S.RowG4>
          <ModeButton
            label="1 node"
            active={mode === 'single'}
            onPress={() => setMode('single')}
          />
          <ModeButton
            label={`${chunks.length} chunks`}
            active={mode === 'chunked'}
            onPress={() => setMode('chunked')}
          />
        </S.RowG4>
        <S.StoryCap>
          {mode === 'single' ? 'brute force: 1 Text node, all content'
            : `${chunks.length} Text nodes, ${CHUNK_SIZE} lines each — paint culled`}
        </S.StoryCap>
      </S.RowCenterBorder>

      {/* Content */}
      <ScrollView style={{ width: '100%', height: '100%' }}>
        <Box style={{ padding: 12, backgroundColor: c.bg }}>
          {mode === 'single' ? (
            <S.StoryBreadcrumbActive>{raw}</S.StoryBreadcrumbActive>
          ) : (
            chunks.map((chunk, i) => (
              <S.StoryBreadcrumbActive key={i}>{chunk}</S.StoryBreadcrumbActive>
            ))
          )}
        </Box>
      </ScrollView>
    </S.StoryRoot>
  );
}
