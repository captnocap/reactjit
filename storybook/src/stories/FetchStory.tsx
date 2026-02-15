import React, { useState, useCallback } from 'react';
import { Box, Text, Pressable, useFetch } from '../../../../packages/shared/src';

// Simple display for a fetch result
function ResultBox({ label, loading, error, data }: {
  label: string;
  loading: boolean;
  error: Error | null;
  data: any;
}) {
  return (
    <Box style={{
      backgroundColor: '#1e293b',
      borderRadius: 6,
      padding: 12,
      gap: 6,
    }}>
      <Text style={{ fontSize: 13, color: '#94a3b8' }}>{label}</Text>
      {loading && <Text style={{ fontSize: 12, color: '#f59e0b' }}>Loading...</Text>}
      {error && <Text style={{ fontSize: 12, color: '#ef4444' }}>{`Error: ${error.message}`}</Text>}
      {data && (
        <Text style={{ fontSize: 11, color: '#e2e8f0' }}>
          {typeof data === 'string' ? data : JSON.stringify(data, null, 2).slice(0, 300)}
        </Text>
      )}
      {!loading && !error && !data && (
        <Text style={{ fontSize: 12, color: '#475569' }}>No data yet</Text>
      )}
    </Box>
  );
}

// Manual fetch demo with a button
function ManualFetchDemo() {
  const [result, setResult] = useState<{ data?: any; error?: string; loading: boolean }>({ loading: false });

  const doFetch = useCallback(() => {
    setResult({ loading: true });
    fetch('https://httpbin.org/get?demo=ilovereact')
      .then((res: any) => res.json())
      .then((json: any) => setResult({ data: json, loading: false }))
      .catch((err: any) => setResult({ error: String(err), loading: false }));
  }, []);

  return (
    <Box style={{ gap: 8 }}>
      <Pressable onPress={doFetch} style={{
        backgroundColor: '#3b82f6',
        paddingLeft: 16, paddingRight: 16,
        paddingTop: 8, paddingBottom: 8,
        borderRadius: 6,
        alignSelf: 'flex-start',
      }}>
        <Text style={{ fontSize: 13, color: '#ffffff' }}>
          {result.loading ? 'Fetching...' : 'fetch() GET'}
        </Text>
      </Pressable>
      <ResultBox
        label="Manual fetch('https://httpbin.org/get')"
        loading={result.loading}
        error={result.error ? new Error(result.error) : null}
        data={result.data}
      />
    </Box>
  );
}

// useFetch hook demo
function UseFetchDemo() {
  const [url, setUrl] = useState<string | null>(null);
  const { data, error, loading } = useFetch<any>(url);

  const startFetch = useCallback(() => {
    setUrl('https://httpbin.org/ip');
  }, []);

  return (
    <Box style={{ gap: 8 }}>
      <Pressable onPress={startFetch} style={{
        backgroundColor: '#8b5cf6',
        paddingLeft: 16, paddingRight: 16,
        paddingTop: 8, paddingBottom: 8,
        borderRadius: 6,
        alignSelf: 'flex-start',
      }}>
        <Text style={{ fontSize: 13, color: '#ffffff' }}>
          {loading ? 'Loading...' : 'useFetch() hook'}
        </Text>
      </Pressable>
      <ResultBox
        label="useFetch('https://httpbin.org/ip')"
        loading={loading}
        error={error}
        data={data}
      />
    </Box>
  );
}

// POST request demo
function PostFetchDemo() {
  const [result, setResult] = useState<{ data?: any; error?: string; loading: boolean }>({ loading: false });

  const doPost = useCallback(() => {
    setResult({ loading: true });
    fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ framework: 'iLoveReact', target: 'love2d' }),
    })
      .then((res: any) => res.json())
      .then((json: any) => setResult({ data: json, loading: false }))
      .catch((err: any) => setResult({ error: String(err), loading: false }));
  }, []);

  return (
    <Box style={{ gap: 8 }}>
      <Pressable onPress={doPost} style={{
        backgroundColor: '#10b981',
        paddingLeft: 16, paddingRight: 16,
        paddingTop: 8, paddingBottom: 8,
        borderRadius: 6,
        alignSelf: 'flex-start',
      }}>
        <Text style={{ fontSize: 13, color: '#ffffff' }}>
          {result.loading ? 'Posting...' : 'fetch() POST'}
        </Text>
      </Pressable>
      <ResultBox
        label="POST to httpbin.org/post"
        loading={result.loading}
        error={result.error ? new Error(result.error) : null}
        data={result.data}
      />
    </Box>
  );
}

export function FetchStory() {
  return (
    <Box style={{
      width: '100%', height: '100%',
      padding: 20,
      gap: 16,
      backgroundColor: '#0f172a',
    }}>
      <Text style={{ fontSize: 18, color: '#f1f5f9' }}>fetch() — HTTP & Local Files</Text>
      <Text style={{ fontSize: 12, color: '#64748b' }}>
        Standard fetch() API backed by LuaSocket (HTTP) and love.filesystem (local paths)
      </Text>

      <ManualFetchDemo />
      <UseFetchDemo />
      <PostFetchDemo />
    </Box>
  );
}
