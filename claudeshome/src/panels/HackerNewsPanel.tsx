/**
 * HackerNewsPanel — live Hacker News top stories feed.
 *
 * Fetches top story IDs from HN API via shell:exec + curl,
 * then fetches individual story details. Refreshes every 5 minutes.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Text, Pressable, ScrollView, useLoveRPC, useLuaInterval } from '@reactjit/core';
import { C } from '../theme';

interface Story {
  id: number;
  title: string;
  url: string;
  score: number;
  by: string;
  time: number;
  descendants: number;
}

function timeAgo(unix: number): string {
  const secs = Math.floor(Date.now() / 1000) - unix;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function domainOf(url: string): string {
  try {
    const match = url.match(/^https?:\/\/([^/]+)/);
    return match ? match[1].replace(/^www\./, '') : '';
  } catch { return ''; }
}

export function HackerNewsPanel() {
  const exec = useLoveRPC('shell:exec');
  const execRef = useRef(exec);
  execRef.current = exec;

  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState(0);

  const fetchStories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch top story IDs
      const idsResult = await execRef.current({
        command: 'curl -s https://hacker-news.firebaseio.com/v0/topstories.json',
        maxOutput: 8192,
      }) as any;

      if (!idsResult?.ok || !idsResult.output) {
        setError('Failed to fetch story IDs');
        setLoading(false);
        return;
      }

      let ids: number[];
      try {
        ids = JSON.parse(idsResult.output);
      } catch {
        setError('Invalid response from HN API');
        setLoading(false);
        return;
      }

      // Fetch first 15 stories
      const top = ids.slice(0, 15);
      const fetchedStories: Story[] = [];

      for (const id of top) {
        try {
          const res = await execRef.current({
            command: `curl -s https://hacker-news.firebaseio.com/v0/item/${id}.json`,
            maxOutput: 4096,
          }) as any;

          if (res?.ok && res.output) {
            const story = JSON.parse(res.output);
            if (story?.title) {
              fetchedStories.push({
                id: story.id,
                title: story.title,
                url: story.url || '',
                score: story.score || 0,
                by: story.by || 'unknown',
                time: story.time || 0,
                descendants: story.descendants || 0,
              });
            }
          }
        } catch {}
      }

      setStories(fetchedStories);
      setLastFetched(Date.now());
      setLoading(false);
    } catch (err: any) {
      setError(String(err?.message ?? err));
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => { fetchStories(); }, [fetchStories]);

  // Refresh every 5 minutes (staggered: 307s)
  useLuaInterval(307000, fetchStories);

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
      {/* Header */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 8,
        borderBottomWidth: 1, borderColor: C.border, flexShrink: 0,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 10, color: '#ff6600', fontWeight: 'bold' }}>{'Y'}</Text>
          <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'HACKER NEWS'}</Text>
          {loading && <Text style={{ fontSize: 8, color: C.textDim }}>{'loading...'}</Text>}
        </Box>
        <Pressable onPress={fetchStories} style={{
          paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
          borderRadius: 3, borderWidth: 1, borderColor: C.border,
        }}>
          <Text style={{ fontSize: 8, color: C.textDim }}>{'refresh'}</Text>
        </Pressable>
      </Box>

      {/* Error */}
      {error && (
        <Box style={{ padding: 12 }}>
          <Text style={{ fontSize: 9, color: C.deny }}>{error}</Text>
        </Box>
      )}

      {/* Stories */}
      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ padding: 4, gap: 2 }}>
          {stories.map((story, idx) => (
            <Box key={story.id} style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
              paddingLeft: 8, paddingRight: 8,
              paddingTop: 5, paddingBottom: 5,
              borderBottomWidth: 1,
              borderColor: C.border + '22',
            }}>
              {/* Rank */}
              <Text style={{ fontSize: 8, color: C.textMuted, width: 16, textAlign: 'right', flexShrink: 0, paddingTop: 1 }}>
                {`${idx + 1}.`}
              </Text>

              {/* Content */}
              <Box style={{ flexGrow: 1, gap: 2 }}>
                <Text style={{ fontSize: 10, color: C.text, lineHeight: 14 }}>
                  {story.title}
                </Text>
                <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 8, color: '#ff6600' }}>{`${story.score}\u25B2`}</Text>
                  <Text style={{ fontSize: 8, color: C.textMuted }}>{story.by}</Text>
                  <Text style={{ fontSize: 8, color: C.textMuted }}>{timeAgo(story.time)}</Text>
                  {story.descendants > 0 && (
                    <Text style={{ fontSize: 8, color: C.textDim }}>{`${story.descendants} comments`}</Text>
                  )}
                  {story.url && (
                    <Text style={{ fontSize: 7, color: C.textMuted }}>{domainOf(story.url)}</Text>
                  )}
                </Box>
              </Box>
            </Box>
          ))}
          {stories.length === 0 && !loading && !error && (
            <Box style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: C.textDim }}>{'No stories loaded.'}</Text>
            </Box>
          )}
        </Box>
      </ScrollView>
    </Box>
  );
}
