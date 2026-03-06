/**
 * FleetPanel — boss-level multi-agent Claude management.
 *
 * Manages up to 4 subordinate Claude sessions (alpha, beta, gamma, delta).
 * Each worker runs in its own sessionId. I assign tasks, they execute.
 * One is "focused" at a time — shows its full canvas + prompt input.
 * All spawned workers keep their <Native type="ClaudeCode"> mounted so
 * sessions persist even when not focused.
 *
 * Permission requests float to the top regardless of focus — can't miss them.
 */
import React, { useState, useCallback, useRef } from 'react';
import { Box, Text, Pressable, Native, TextEditor } from '@reactjit/core';
import { useClaude } from '../hooks/useClaude';
import { PermissionModal } from '../components/PermissionModal';
import { C } from '../theme';

function statusColor(s: string): string {
  switch (s) {
    case 'running':            return C.approve;
    case 'thinking':           return C.warning;
    case 'waiting_permission': return C.deny;
    default:                   return C.textMuted;
  }
}

const WORKER_NAMES   = ['alpha', 'beta', 'gamma', 'delta'] as const;
type WorkerName = typeof WORKER_NAMES[number];

function workerColor(name: WorkerName): string {
  switch (name) {
    case 'alpha': return C.accent;
    case 'beta':  return C.approve;
    case 'gamma': return C.warning;
    case 'delta': return '#c87dff';
  }
}

// ── Individual worker slot ───────────────────────────────────────────

interface SlotProps {
  name: WorkerName;
  focused: boolean;
  onFocus: () => void;
  onStatusChange: (name: WorkerName, status: string) => void;
}

function WorkerSlot({ name, focused, onFocus, onStatusChange }: SlotProps) {
  const worker = useClaude();
  const [spawned, setSpawned] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [editorHeight, setEditorHeight] = useState(29);

  const sessionId = `worker-${name}`;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const wrappedStatusChange = useCallback((e: any) => {
    worker.onStatusChange(e);
    const s = e.status || e.state || 'idle';
    onStatusChangeRef.current(name, s);
  }, [worker.onStatusChange, name]);

  const handleSpawn = useCallback(() => {
    setSpawned(true);
  }, []);

  const handleKill = useCallback(() => {
    setSpawned(false);
    onStatusChangeRef.current(name, 'idle');
  }, [name]);

  const handleChange = useCallback((v: string) => {
    const lines = v.split('\n').length;
    const h = Math.min(100, lines * 29);
    if (h !== editorHeight) setEditorHeight(h);
  }, [editorHeight]);

  const handleSubmit = useCallback(() => {
    setEditorKey(k => k + 1);
    setEditorHeight(29);
  }, []);

  const dotColor    = workerColor(name);
  const statusColor = statusColor(worker.status);
  const isActive    = spawned && worker.status !== 'idle' && worker.status !== 'stopped';

  return (
    <Box style={{ flexGrow: focused ? 1 : 0, flexDirection: 'column' }}>

      {/* Always-mounted session (keeps Lua process alive) */}
      {spawned && (
        <Native
          type="ClaudeCode"
          workingDir="/home/siah/creative/reactjit/workspace"
          model="haiku"
          sessionId={sessionId}
          onStatusChange={wrappedStatusChange}
          onPermissionRequest={worker.onPerm}
          onPermissionResolved={worker.onPermResolved}
          onQuestionPrompt={worker.onQuestion}
        />
      )}

      {/* Row — clickable header showing worker identity + status */}
      <Pressable onPress={onFocus} style={{
        flexDirection:   'row',
        alignItems:      'center',
        gap:             8,
        paddingLeft:     10,
        paddingRight:    10,
        paddingTop:      6,
        paddingBottom:   6,
        borderBottomWidth: 1,
        borderColor:     focused ? dotColor + '44' : C.border,
        backgroundColor: focused ? dotColor + '0a' : 'transparent',
        flexShrink:      0,
      }}>
        {/* Identity dot */}
        <Box style={{
          width:           8,
          height:          8,
          borderRadius:    4,
          backgroundColor: isActive ? dotColor : dotColor + '44',
        }} />

        <Text style={{ fontSize: 10, color: isActive ? dotColor : C.textMuted, fontWeight: 'bold', flexGrow: 1 }}>
          {name.toUpperCase()}
        </Text>

        {/* Status badge */}
        {spawned && (
          <Box style={{
            backgroundColor: statusColor + '1a',
            borderRadius:    3,
            paddingLeft:     5,
            paddingRight:    5,
            paddingTop:      1,
            paddingBottom:   1,
          }}>
            <Text style={{ fontSize: 8, color: statusColor }}>{worker.status}</Text>
          </Box>
        )}

        {/* Spawn / kill */}
        {!spawned ? (
          <Pressable onPress={handleSpawn} style={{
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
            backgroundColor: dotColor + '1a',
            borderWidth: 1, borderColor: dotColor + '55', borderRadius: 3,
          }}>
            <Text style={{ fontSize: 8, color: dotColor }}>{'spawn'}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={handleKill} style={{
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
            borderWidth: 1, borderColor: C.border, borderRadius: 3,
          }}>
            <Text style={{ fontSize: 8, color: C.textMuted }}>{'kill'}</Text>
          </Pressable>
        )}
      </Pressable>

      {/* Canvas — only renders for the focused worker */}
      {focused && spawned && (
        <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
          <Native
            type="ClaudeCanvas"
            sessionId={sessionId}
            style={{ flexGrow: 1 }}
          />
          {/* Task input */}
          <Box style={{
            flexDirection:  'row',
            alignItems:     'flex-start',
            flexShrink:     0,
            padding:        6,
            gap:            6,
            borderTopWidth: 1,
            borderColor:    C.border,
            backgroundColor: C.bg,
          }}>
            <Text style={{ fontSize: 10, color: dotColor, paddingTop: 5 }}>{'\u276F'}</Text>
            <TextEditor
              key={editorKey}
              sessionId={sessionId}
              onChange={handleChange}
              onSubmit={handleSubmit}
              changeDelay={0.1}
              placeholder={`Task ${name}...`}
              lineNumbers={false}
              style={{
                flexGrow: 1,
                height: editorHeight,
                fontSize: 13,
                color: C.text,
                backgroundColor: C.surface,
                borderRadius: 5,
                borderWidth: 1,
                borderColor: dotColor + '44',
              }}
            />
          </Box>
        </Box>
      )}

      {focused && !spawned && (
        <Box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Text style={{ fontSize: 10, color: dotColor + '88' }}>{name}</Text>
          <Text style={{ fontSize: 9, color: C.textDim }}>{'not spawned'}</Text>
          <Pressable onPress={handleSpawn} style={{
            marginTop: 8,
            paddingLeft: 14, paddingRight: 14, paddingTop: 6, paddingBottom: 6,
            backgroundColor: dotColor + '1a',
            borderWidth: 1, borderColor: dotColor + '66', borderRadius: 5,
          }}>
            <Text style={{ fontSize: 10, color: dotColor }}>{'spawn worker'}</Text>
          </Pressable>
        </Box>
      )}

      {/* Permission modal — floats regardless of focus */}
      <PermissionModal perm={worker.perm} onRespond={worker.respond} />
    </Box>
  );
}

// ── Fleet panel ──────────────────────────────────────────────────────

interface FleetPanelProps {
  onActiveCountChange?: (count: number) => void;
}

export function FleetPanel({ onActiveCountChange }: FleetPanelProps) {
  const [focused, setFocused] = useState<WorkerName>('alpha');
  const [statuses, setStatuses] = useState<Record<WorkerName, string>>({
    alpha: 'idle', beta: 'idle', gamma: 'idle', delta: 'idle',
  });

  const onActiveRef = useRef(onActiveCountChange);
  onActiveRef.current = onActiveCountChange;

  const handleStatusChange = useCallback((name: WorkerName, status: string) => {
    setStatuses(prev => {
      const next = { ...prev, [name]: status };
      const active = Object.values(next).filter(s => s !== 'idle' && s !== 'stopped').length;
      onActiveRef.current?.(active);
      return next;
    });
  }, []);

  const activeCount = Object.values(statuses).filter(s => s !== 'idle' && s !== 'stopped').length;

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
      {/* Fleet header */}
      <Box style={{
        flexDirection:    'row',
        alignItems:       'center',
        justifyContent:   'space-between',
        paddingLeft:      12,
        paddingRight:     10,
        paddingTop:       7,
        paddingBottom:    7,
        borderBottomWidth: 1,
        borderColor:      C.border,
        flexShrink:       0,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'FLEET'}</Text>
          <Text style={{ fontSize: 8, color: C.textDim }}>{'haiku'}</Text>
          {activeCount > 0 && (
            <Box style={{
              backgroundColor: C.approve + '22',
              borderRadius:    3,
              paddingLeft:     5,
              paddingRight:    5,
              paddingTop:      1,
              paddingBottom:   1,
            }}>
              <Text style={{ fontSize: 8, color: C.approve }}>{`${activeCount} active`}</Text>
            </Box>
          )}
        </Box>

        {/* Focus switcher dots */}
        <Box style={{ flexDirection: 'row', gap: 5 }}>
          {WORKER_NAMES.map(name => (
            <Pressable key={name} onPress={() => setFocused(name)} style={{
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: focused === name ? workerColor(name) : workerColor(name) + '33',
            }} />
          ))}
        </Box>
      </Box>

      {/* Worker slots — focused one gets flexGrow:1, others are collapsed to header-only */}
      {WORKER_NAMES.map(name => (
        <WorkerSlot
          key={name}
          name={name}
          focused={focused === name}
          onFocus={() => setFocused(name)}
          onStatusChange={handleStatusChange}
        />
      ))}
    </Box>
  );
}
