import React, { useState, useCallback } from 'react';
import { Box, Text, Pressable, ScrollView, TextInput } from '@reactjit/core';
import { parseHtml, extractBody } from './htmlParser';
import { RenderHtml } from './htmlRenderer';
import type { HtmlNode } from './htmlParser';

// Proxy mode: browse (stealth Firefox) or direct (raw fetch)
const PROXY_URL = 'http://127.0.0.1:9876/browse';
const USE_PROXY = true; // Set false to use raw fetch (no stealth, gets blocked)

const DEFAULT_URL = 'https://news.ycombinator.com';

interface PageState {
  url: string;
  title: string;
  nodes: HtmlNode[];
  linkCount: number;
  textLength: number;
  mode: 'proxy' | 'direct';
}

function ToolbarButton({ label, onPress, disabled }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={{
        width: 32, height: 32,
        backgroundColor: disabled ? '#1e293b' : '#334155',
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{
        fontSize: 14,
        color: disabled ? '#475569' : '#e2e8f0',
        fontWeight: '700',
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function App() {
  const [urlInput, setUrlInput] = useState(DEFAULT_URL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<PageState | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const navigate = useCallback((url: string) => {
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      if (!normalizedUrl.includes('.')) {
        normalizedUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(normalizedUrl)}`;
      } else {
        normalizedUrl = 'https://' + normalizedUrl;
      }
    }

    setUrlInput(normalizedUrl);
    setLoading(true);
    setError(null);

    if (USE_PROXY) {
      // Route through browse's stealth Firefox
      const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(normalizedUrl)}`;
      fetch(proxyUrl)
        .then((res: any) => res.json())
        .then((data: any) => {
          if (data.error) {
            setError(data.error);
            setLoading(false);
            return;
          }

          // Parse the raw HTML for rich rendering
          const html = data.html || '';
          const parsed = parseHtml(html);
          const body = extractBody(parsed);

          const newPage: PageState = {
            url: data.url || normalizedUrl,
            title: data.title || normalizedUrl,
            nodes: body,
            linkCount: data.links?.length || 0,
            textLength: data.text?.length || 0,
            mode: 'proxy',
          };
          setPage(newPage);
          setLoading(false);

          setHistory(prev => {
            const newHistory = [...prev.slice(0, historyIndex + 1), normalizedUrl];
            setHistoryIndex(newHistory.length - 1);
            return newHistory;
          });
        })
        .catch((err: any) => {
          setError(`Proxy error: ${String(err)}. Is proxy.py running?`);
          setLoading(false);
        });
    } else {
      // Direct fetch (no stealth, will get blocked by bot detection)
      fetch(normalizedUrl)
        .then((res: any) => res.text())
        .then((html: string) => {
          const parsed = parseHtml(html);
          const body = extractBody(parsed);

          let title = normalizedUrl;
          const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          if (titleMatch) {
            title = titleMatch[1].replace(/\s+/g, ' ').trim();
          }

          const newPage: PageState = {
            url: normalizedUrl,
            title,
            nodes: body,
            linkCount: 0,
            textLength: 0,
            mode: 'direct',
          };
          setPage(newPage);
          setLoading(false);

          setHistory(prev => {
            const newHistory = [...prev.slice(0, historyIndex + 1), normalizedUrl];
            setHistoryIndex(newHistory.length - 1);
            return newHistory;
          });
        })
        .catch((err: any) => {
          setError(String(err));
          setLoading(false);
        });
    }
  }, [historyIndex]);

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      navigate(history[newIndex]);
    }
  }, [history, historyIndex, navigate]);

  const goForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      navigate(history[newIndex]);
    }
  }, [history, historyIndex, navigate]);

  const handleSubmit = useCallback(() => {
    navigate(urlInput);
  }, [urlInput, navigate]);

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#0f172a',
      flexDirection: 'column',
    }}>
      {/* Title bar */}
      <Box style={{
        width: '100%',
        height: 28,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderColor: '#1e293b',
      }}>
        <Text style={{ fontSize: 11, color: '#64748b' }}>
          {page ? page.title : 'ReactJIT Browser'}
        </Text>
      </Box>

      {/* Toolbar */}
      <Box style={{
        width: '100%',
        height: 44,
        backgroundColor: '#0f172a',
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 8,
        paddingRight: 8,
        gap: 6,
        borderBottomWidth: 1,
        borderColor: '#1e293b',
      }}>
        <ToolbarButton label="<" onPress={goBack} disabled={historyIndex <= 0} />
        <ToolbarButton label=">" onPress={goForward} disabled={historyIndex >= history.length - 1} />

        {/* URL bar */}
        <Box style={{
          flexGrow: 1,
          height: 30,
          backgroundColor: '#1e293b',
          borderRadius: 6,
          borderWidth: 1,
          borderColor: '#334155',
          justifyContent: 'center',
          paddingLeft: 10,
          paddingRight: 10,
        }}>
          <TextInput
            value={urlInput}
            onChangeText={setUrlInput}
            onSubmit={handleSubmit}
            style={{
              fontSize: 13,
              color: '#e2e8f0',
            }}
          />
        </Box>

        <Pressable
          onPress={handleSubmit}
          style={(state) => ({
            height: 30,
            paddingLeft: 14,
            paddingRight: 14,
            backgroundColor: state.pressed ? '#1d4ed8' : '#2563eb',
            borderRadius: 6,
            justifyContent: 'center',
            alignItems: 'center',
          })}
        >
          <Text style={{ fontSize: 13, color: '#ffffff', fontWeight: '700' }}>
            Go
          </Text>
        </Pressable>
      </Box>

      {/* Content area */}
      <Box style={{ flexGrow: 1, width: '100%' }}>
        {loading && (
          <Box style={{
            width: '100%', height: '100%',
            justifyContent: 'center', alignItems: 'center',
            gap: 8,
          }}>
            <Text style={{ fontSize: 16, color: '#64748b' }}>Loading...</Text>
            <Text style={{ fontSize: 11, color: '#475569' }}>
              {USE_PROXY ? 'via stealth Firefox' : 'direct fetch'}
            </Text>
          </Box>
        )}

        {error && !loading && (
          <Box style={{
            width: '100%', height: '100%',
            justifyContent: 'center', alignItems: 'center',
            padding: 20, gap: 8,
          }}>
            <Text style={{ fontSize: 16, color: '#ef4444', fontWeight: '700' }}>
              Failed to load page
            </Text>
            <Text style={{ fontSize: 12, color: '#94a3b8' }}>
              {error}
            </Text>
          </Box>
        )}

        {page && !loading && !error && (
          <ScrollView style={{ width: '100%', height: '100%' }}>
            <Box style={{ padding: 16, gap: 4 }}>
              <RenderHtml
                nodes={page.nodes}
                onNavigate={navigate}
                baseUrl={page.url}
              />
            </Box>
          </ScrollView>
        )}

        {!page && !loading && !error && (
          <Box style={{
            width: '100%', height: '100%',
            justifyContent: 'center', alignItems: 'center',
            gap: 12,
          }}>
            <Text style={{ fontSize: 22, color: '#e2e8f0', fontWeight: '700' }}>
              ReactJIT Browser
            </Text>
            <Text style={{ fontSize: 13, color: '#64748b' }}>
              {USE_PROXY
                ? 'Stealth mode: content fetched via Firefox, rendered in Love2D'
                : 'Direct mode: raw HTTP fetch'}
            </Text>
            <Box style={{ height: 12 }} />
            <Pressable
              onPress={() => navigate(DEFAULT_URL)}
              style={(state) => ({
                paddingLeft: 20, paddingRight: 20,
                paddingTop: 10, paddingBottom: 10,
                backgroundColor: state.pressed ? '#1d4ed8' : '#2563eb',
                borderRadius: 8,
              })}
            >
              <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: '700' }}>
                Open Hacker News
              </Text>
            </Pressable>
          </Box>
        )}
      </Box>

      {/* Status bar */}
      <Box style={{
        width: '100%',
        height: 22,
        backgroundColor: '#0f172a',
        borderTopWidth: 1,
        borderColor: '#1e293b',
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 10,
        paddingRight: 10,
        justifyContent: 'space-between',
      }}>
        <Text style={{ fontSize: 10, color: '#475569' }}>
          {loading ? 'Loading...' : page ? page.url : 'Ready'}
        </Text>
        <Text style={{ fontSize: 10, color: '#475569' }}>
          {page ? `${page.nodes.length} nodes | ${page.mode}` : ''}
        </Text>
      </Box>
    </Box>
  );
}
