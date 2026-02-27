import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, ScrollView, Pressable, useLuaInterval } from '@reactjit/core';
import { C } from '../theme';
import { subscribe, getEntries } from '../lib/log-buffer';
import type { LogEntry } from '../lib/log-buffer';

// Force log-buffer to load (patches console on import)
import '../lib/log-buffer';

const LEVEL_COLOR: Record<string, string> = {
  log:   C.text,
  info:  C.accent,
  warn:  C.warning,
  error: C.deny,
};

const LEVEL_PREFIX: Record<string, string> = {
  log:   '·',
  info:  'i',
  warn:  '!',
  error: '✕',
};

function fmt(ts: number) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

type Tab = 'logs' | 'debug';

export function DebugPanel() {
  const [entries, setEntries] = useState<LogEntry[]>(getEntries);
  const [tab, setTab] = useState<Tab>('logs');
  const [debugSnap, setDebugSnap] = useState<Record<string, any>>({});
  const [filter, setFilter] = useState<string | null>(null);
  const scrollRef = useRef<any>(null);
  const autoScrollRef = useRef(true);

  // Subscribe to console output
  useEffect(() => subscribe(setEntries), []);

  // Poll __debug every 500ms (it's a plain object, not reactive)
  useLuaInterval(500, () => {
    setDebugSnap({ ...(globalThis as any).__debug });
  });

  const visible = filter
    ? entries.filter(e => e.level === filter)
    : entries;

  const errorCount  = entries.filter(e => e.level === 'error').length;
  const warnCount   = entries.filter(e => e.level === 'warn').length;

  const TabBtn = ({ id, label, badge }: { id: Tab; label: string; badge?: number }) => (
    <Pressable onPress={() => setTab(id)} style={{
      paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
      borderBottomWidth: tab === id ? 2 : 0,
      borderColor: C.accent,
    }}>
      <Box style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
        <Text style={{ fontSize: 10, color: tab === id ? C.accent : C.textDim, fontWeight: 'bold' }}>
          {label}
        </Text>
        {!!badge && (
          <Box style={{
            backgroundColor: C.deny + '33', borderRadius: 3,
            paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1,
          }}>
            <Text style={{ fontSize: 8, color: C.deny }}>{String(badge)}</Text>
          </Box>
        )}
      </Box>
    </Pressable>
  );

  const FilterBtn = ({ level }: { level: string | null }) => {
    const active = filter === level;
    const color = level ? LEVEL_COLOR[level] : C.textDim;
    return (
      <Pressable onPress={() => setFilter(active ? null : level)} style={{
        paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
        backgroundColor: active ? color + '22' : 'transparent',
        borderRadius: 3, borderWidth: 1,
        borderColor: active ? color + '66' : 'transparent',
      }}>
        <Text style={{ fontSize: 9, color: active ? color : C.textMuted }}>
          {level ?? 'all'}
        </Text>
      </Pressable>
    );
  };

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
      {/* Header */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderBottomWidth: 1, borderColor: C.border, flexShrink: 0,
      }}>
        <Box style={{ flexDirection: 'row' }}>
          <TabBtn id="logs"  label="LOGS"  badge={errorCount + warnCount} />
          <TabBtn id="debug" label="DEBUG" />
        </Box>
        <Pressable onPress={() => { entries.splice(0); setEntries([]); }} style={{
          paddingLeft: 8, paddingRight: 8,
        }}>
          <Text style={{ fontSize: 9, color: C.textMuted }}>{'clear'}</Text>
        </Pressable>
      </Box>

      {tab === 'logs' && (
        <>
          {/* Filter bar */}
          <Box style={{
            flexDirection: 'row', gap: 4, alignItems: 'center',
            paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
            borderBottomWidth: 1, borderColor: C.border, flexShrink: 0,
          }}>
            <FilterBtn level={null} />
            <FilterBtn level="log" />
            <FilterBtn level="info" />
            <FilterBtn level="warn" />
            <FilterBtn level="error" />
            <Text style={{ fontSize: 9, color: C.textMuted, flexGrow: 1, textAlign: 'right' }}>
              {`${visible.length} entries`}
            </Text>
          </Box>

          {/* Log entries */}
          <ScrollView ref={scrollRef} style={{ flexGrow: 1 }}>
            <Box style={{ padding: 4, gap: 1 }}>
              {visible.slice(-150).map(e => (
                <Box key={e.id} style={{
                  flexDirection: 'row', gap: 6, alignItems: 'flex-start',
                  paddingTop: 2, paddingBottom: 2, paddingLeft: 4, paddingRight: 4,
                  backgroundColor: e.level === 'error' ? C.deny + '0a' : e.level === 'warn' ? C.warning + '08' : 'transparent',
                  borderRadius: 2,
                }}>
                  <Text style={{ fontSize: 9, color: C.textMuted, flexShrink: 0 }}>{fmt(e.ts)}</Text>
                  <Text style={{ fontSize: 10, color: LEVEL_COLOR[e.level], flexShrink: 0, fontWeight: 'bold' }}>
                    {LEVEL_PREFIX[e.level]}
                  </Text>
                  <Text style={{ fontSize: 10, color: LEVEL_COLOR[e.level], flexGrow: 1 }}>
                    {e.text}
                  </Text>
                </Box>
              ))}
            </Box>
          </ScrollView>
        </>
      )}

      {tab === 'debug' && (
        <ScrollView style={{ flexGrow: 1 }}>
          <Box style={{ padding: 8, gap: 8 }}>
            {Object.keys(debugSnap).length === 0 ? (
              <Text style={{ fontSize: 11, color: C.textMuted }}>
                {'No debug data. Call useDebug(key, data) in any component.'}
              </Text>
            ) : (
              Object.entries(debugSnap).map(([key, val]) => (
                <Box key={key} style={{
                  gap: 4, borderLeftWidth: 2, borderColor: C.accentDim,
                  paddingLeft: 8,
                }}>
                  <Text style={{ fontSize: 10, color: C.accent, fontWeight: 'bold' }}>{key}</Text>
                  {Object.entries(val ?? {}).map(([k, v]) => (
                    <Box key={k} style={{ flexDirection: 'row', gap: 8 }}>
                      <Text style={{ fontSize: 9, color: C.textDim, flexShrink: 0 }}>{k}</Text>
                      <Text style={{ fontSize: 9, color: C.text }}>
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </Text>
                    </Box>
                  ))}
                </Box>
              ))
            )}
          </Box>
        </ScrollView>
      )}
    </Box>
  );
}
