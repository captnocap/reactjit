import React, { useState, useMemo, useEffect } from 'react';
import { Box, Text, ScrollView, Pressable } from '../../../packages/shared/src';

const CHUNK_SIZE = 50; // lines per Text node

function useTextFile(path: string) {
  const [data, setData] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [path]);

  return { data, error, loading };
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{
      backgroundColor: active ? '#3b82f6' : '#1e293b',
      paddingLeft: 12, paddingRight: 12,
      paddingTop: 5, paddingBottom: 5,
      borderRadius: 4,
    }}>
      <Text style={{ fontSize: 11, color: active ? '#ffffff' : '#94a3b8' }}>{label}</Text>
    </Pressable>
  );
}

export function LlmsTxtReader() {
  const { data: raw, loading, error } = useTextFile('data/llms.txt');
  const [mode, setMode] = useState<'single' | 'chunked'>('chunked');

  const lines = useMemo(() => {
    if (!raw) return [];
    return raw.split('\n');
  }, [raw]);

  const chunks = useMemo(() => {
    if (lines.length === 0) return [];
    const result: string[] = [];
    for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
      result.push(lines.slice(i, i + CHUNK_SIZE).join('\n'));
    }
    return result;
  }, [lines]);

  if (loading) {
    return (
      <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 14, color: '#94a3b8' }}>Loading llms.txt...</Text>
      </Box>
    );
  }

  if (error || !raw) {
    return (
      <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 14, color: '#ef4444' }}>{`${error?.message || 'No data'}`}</Text>
      </Box>
    );
  }

  const lineCount = lines.length;
  const sizeKB = Math.round(raw.length / 1024);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f172a' }}>
      {/* Header */}
      <Box style={{
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 12, paddingRight: 12,
        gap: 10,
        borderBottomWidth: 1,
        borderColor: '#1e293b',
      }}>
        <Text style={{ fontSize: 13, color: '#64748b' }}>
          {`llms.txt — ${lineCount} lines, ${sizeKB} KB`}
        </Text>
        <Box style={{ flexDirection: 'row', gap: 4 }}>
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
        </Box>
        <Text style={{ fontSize: 9, color: '#475569' }}>
          {mode === 'single' ? 'brute force: 1 Text node, all content'
            : `${chunks.length} Text nodes, ${CHUNK_SIZE} lines each — paint culled`}
        </Text>
      </Box>

      {/* Content */}
      <ScrollView style={{ width: '100%', height: '100%' }}>
        <Box style={{ padding: 12, backgroundColor: '#0f172a' }}>
          {mode === 'single' ? (
            <Text style={{ fontSize: 9, color: '#cbd5e1' }}>{raw}</Text>
          ) : (
            chunks.map((chunk, i) => (
              <Text key={i} style={{ fontSize: 9, color: '#cbd5e1' }}>{chunk}</Text>
            ))
          )}
        </Box>
      </ScrollView>
    </Box>
  );
}
