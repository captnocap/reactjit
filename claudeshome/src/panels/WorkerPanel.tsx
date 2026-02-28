/**
 * WorkerPanel — a subordinate Claude session for grunt work.
 *
 * Spawns a second ClaudeCode instance with sessionId="worker".
 * I am the boss. It does what I tell it. I review and approve.
 * Use haiku model — cheap and fast for simple tasks.
 */
import React, { useState, useCallback } from 'react';
import { Box, Text, Pressable, Native, TextEditor, useLoveRPC } from '@reactjit/core';
import { C } from '../theme';
import { useClaude } from '../hooks/useClaude';
import { PermissionModal } from '../components/PermissionModal';

const STATUS_COLORS: Record<string, string> = {
  idle:               C.textMuted,
  running:            C.approve,
  thinking:           C.warning,
  waiting_permission: C.deny,
  stopped:            C.textMuted,
};

interface WorkerPanelProps {
  onStatusChange?: (status: string) => void;
  onSpawnedChange?: (spawned: boolean) => void;
}

export function WorkerPanel({ onStatusChange, onSpawnedChange }: WorkerPanelProps) {
  const worker = useClaude();
  const [editorKey, setEditorKey] = useState(0);
  const [editorHeight, setEditorHeight] = useState(29);
  const [spawned, setSpawned] = useState(false);

  // Bubble status up to Shell
  const onStatusChangeRef = React.useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const originalOnStatusChange = worker.onStatusChange;
  const wrappedOnStatusChange = useCallback((e: any) => {
    originalOnStatusChange(e);
    const s = e.status || e.state || 'idle';
    onStatusChangeRef.current?.(s);
  }, [originalOnStatusChange]);

  const handleSpawn = useCallback((v: boolean) => {
    setSpawned(v);
    onSpawnedChange?.(v);
  }, [onSpawnedChange]);

  const handleChange = useCallback((v: string) => {
    const lines = v.split('\n').length;
    const h = Math.min(120, lines * 29);
    if (h !== editorHeight) setEditorHeight(h);
  }, [editorHeight]);

  const handleSubmit = useCallback(() => {
    setEditorKey(k => k + 1);
    setEditorHeight(29);
  }, []);

  const statusColor = STATUS_COLORS[worker.status] ?? C.textMuted;

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
      {/* Header */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 12,
        paddingRight: 10,
        paddingTop: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderColor: C.border,
        flexShrink: 0,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'WORKER'}</Text>
          <Text style={{ fontSize: 8, color: C.textDim }}>{'haiku'}</Text>
          <Box style={{
            backgroundColor: statusColor + '22',
            borderRadius: 3,
            paddingLeft: 5,
            paddingRight: 5,
            paddingTop: 1,
            paddingBottom: 1,
          }}>
            <Text style={{ fontSize: 8, color: statusColor }}>{worker.status}</Text>
          </Box>
        </Box>

        <Box style={{ flexDirection: 'row', gap: 6 }}>
          {!spawned ? (
            <Pressable onPress={() => handleSpawn(true)} style={{
              paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
              backgroundColor: C.approve + '22',
              borderWidth: 1, borderColor: C.approve + '66', borderRadius: 4,
            }}>
              <Text style={{ fontSize: 9, color: C.approve }}>{'spawn worker'}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => handleSpawn(false)} style={{
              paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
              backgroundColor: C.deny + '11',
              borderWidth: 1, borderColor: C.border, borderRadius: 4,
            }}>
              <Text style={{ fontSize: 9, color: C.textMuted }}>{'kill worker'}</Text>
            </Pressable>
          )}
        </Box>
      </Box>

      {/* Worker canvas */}
      <Box style={{ flexGrow: 1, position: 'relative' }}>
        {spawned ? (
          <>
            {/* The worker ClaudeCode session — always mounted when spawned */}
            <Native
              type="ClaudeCode"
              workingDir="/home/siah/creative/reactjit/workspace"
              model="haiku"
              sessionId="worker"
              onStatusChange={wrappedOnStatusChange}
              onPermissionRequest={worker.onPerm}
              onPermissionResolved={worker.onPermResolved}
              onQuestionPrompt={worker.onQuestion}
            />
            <Native
              type="ClaudeCanvas"
              sessionId="worker"
              style={{ flexGrow: 1 }}
            />
          </>
        ) : (
          <Box style={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Text style={{ fontSize: 10, color: C.textDim }}>{'Worker not spawned.'}</Text>
            <Text style={{ fontSize: 9, color: C.textDim + '88' }}>{'Spawn to run subordinate tasks.'}</Text>
          </Box>
        )}
      </Box>

      {/* Permission modal for worker */}
      <PermissionModal perm={worker.perm} onRespond={worker.respond} />

      {/* Worker prompt input — only when spawned */}
      {spawned && (
        <Box style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          flexShrink: 0,
          padding: 6,
          gap: 6,
          borderTopWidth: 1,
          borderColor: C.border,
          backgroundColor: C.bg,
        }}>
          <Text style={{ fontSize: 10, color: C.warning, paddingTop: 5 }}>{'\u276F'}</Text>
          <TextEditor
            key={editorKey}
            sessionId="worker"
            onChange={handleChange}
            onSubmit={handleSubmit}
            changeDelay={0.1}
            placeholder="Task the worker..."
            lineNumbers={false}
            style={{
              flexGrow: 1,
              height: editorHeight,
              fontSize: 13,
              color: C.text,
              backgroundColor: C.surface,
              borderRadius: 5,
              borderWidth: 1,
              borderColor: C.border,
            }}
          />
        </Box>
      )}
    </Box>
  );
}
