/**
 * <Fleet> — Multi-agent Claude Code panel for power users.
 *
 * Tight, information-dense interface. One window, N agents, independent
 * expand/collapse. Vivid status indicators. Inline permissions. No fluff.
 */

import React, { useState, useCallback } from 'react';
import { useRendererMode } from './context';
import { useFleet } from './useFleet';
import { Box, Text } from './primitives';
import { Pressable } from './Pressable';
import { Native } from './Native';
import { TextInput } from './TextInput';
import { usePixelArt } from './usePixelArt';
import type { FleetAgentConfig, FleetAgentState, FleetQuestion } from './useFleet';
import type { Style } from './types';

// ── Hoisted styles (zero allocation per render) ────────────────

const S = {
  root: { flexGrow: 1, flexDirection: 'column' } as const,
  hidden: { width: 0, height: 0, overflow: 'hidden' } as const,
  tileExpanded: { flexGrow: 1, flexDirection: 'column' } as const,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderLeftWidth: 2,
  } as const,
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 } as const,
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 } as const,
  permBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderTopWidth: 2,
  } as const,
  permBtns: { flexDirection: 'row', gap: 4 } as const,
  permBtn: {
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 5,
    paddingBottom: 5,
    borderRadius: 4,
    borderWidth: 1,
  } as const,
  canvas: { flexGrow: 1 } as const,
  prompt: {
    flexDirection: 'row',
    alignItems: 'start',
    flexShrink: 0,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 6,
    paddingBottom: 6,
    gap: 6,
    borderTopWidth: 2,
  } as const,
  autoAcceptBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'end',
    paddingRight: 10,
    paddingTop: 5,
    paddingBottom: 5,
    borderBottomWidth: 1,
  } as const,
  autoAcceptBtn: {
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 3,
    paddingBottom: 3,
    borderRadius: 3,
    borderWidth: 1,
  } as const,
};

// ── Colors (VIVID, electric) ──────────────────────────────────

const COLORS = {
  bg: '#080c1e',
  surface: '#0e1530',
  surfaceHover: '#172045',
  border: '#1e2e5a',
  borderActive: '#00ffff',
  text: '#d6e8ff',
  textDim: '#6e88c0',
  textMuted: '#3d5080',
  accent: '#00ffff',  // CYAN — electric, unmissable
  accentBright: '#00ffff',
  approve: '#00ff00',  // LIME — surgical green
  deny: '#ff0080',  // HOT PINK — unmissable
  warning: '#ffff00',  // YELLOW — screaming
};

const STATUS_COLORS: Record<string, string> = {
  idle: COLORS.textMuted,
  running: COLORS.approve,
  thinking: COLORS.warning,
  waiting_permission: COLORS.deny,
  stopped: COLORS.textMuted,
};

// Agent colors — VIVID, neon-bright per index
const AGENT_COLORS = ['#00ffff', '#00ff00', '#ffff00', '#ff00ff', '#ff0080', '#00ff88'];

const MODEL_LABELS: Record<string, string> = {
  sonnet: 'S4.6',
  opus: 'O4.6',
  haiku: 'H4.5',
};

// ── Pixel art status indicators (using usePixelArt) ─────────────

const StatusIndicator = React.memo(function StatusIndicator({
  status,
  color,
}: {
  status: string;
  color: string;
}) {
  // Pulse on active states
  const isPulsing = status === 'running' || status === 'thinking';
  const pulsOp = isPulsing ? 0.8 : 1;

  return (
    <Box
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: color,
        borderWidth: 2,
        borderColor: COLORS.bg,
        opacity: pulsOp,
      }}
    />
  );
});

// ── Permission bar (inline, no modal) ──────────────────────────

const PermissionBar = React.memo(function PermissionBar({
  action,
  target,
  question,
  onRespond,
}: {
  action: string;
  target: string;
  question: string;
  onRespond: (choice: number) => void;
}) {
  const label = question || `${action}: ${target}`;
  return (
    <Box
      style={{
        ...S.permBar,
        backgroundColor: COLORS.warning + '18',
        borderColor: COLORS.warning + '88',
      }}
    >
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexGrow: 1 }}>
        <Text style={{ fontSize: 9, color: COLORS.warning, fontWeight: 'bold' }}>
          ['PERM']
        </Text>
        <Text style={{ fontSize: 10, color: COLORS.text, flexGrow: 1, fontWeight: '500' }}>
          {label}
        </Text>
      </Box>
      <Box style={S.permBtns}>
        <Pressable
          onPress={() => onRespond(1)}
          style={{
            ...S.permBtn,
            backgroundColor: COLORS.approve,
            borderColor: COLORS.approve + '88',
          }}
        >
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: COLORS.bg }}>
            {'Y'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onRespond(2)}
          style={{
            ...S.permBtn,
            backgroundColor: COLORS.accent,
            borderColor: COLORS.accent + '88',
          }}
        >
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: COLORS.bg }}>
            {'A'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onRespond(3)}
          style={{
            ...S.permBtn,
            backgroundColor: COLORS.deny,
            borderColor: COLORS.deny + '88',
          }}
        >
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: COLORS.bg }}>
            {'N'}
          </Text>
        </Pressable>
      </Box>
    </Box>
  );
});

// ── Question bar (inline) ──────────────────────────────────────

const QuestionBar = React.memo(function QuestionBar({
  question,
  onRespond,
}: {
  question: FleetQuestion;
  onRespond: (idx: number) => void;
}) {
  return (
    <Box
      style={{
        flexDirection: 'column',
        gap: 4,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 6,
        paddingBottom: 6,
        backgroundColor: COLORS.accent + '12',
        borderBottomWidth: 1,
        borderColor: COLORS.accent + '66',
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.text }}>
        {question.question}
      </Text>
      <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
        {question.options.map((opt, i) => (
          <Pressable
            key={`q-${i}`}
            onPress={() => onRespond(i + 1)}
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              borderRadius: 3,
              borderWidth: 1,
              backgroundColor: COLORS.surfaceHover,
              borderColor: COLORS.border,
            }}
          >
            <Text style={{ fontSize: 9, color: COLORS.text }}>
              {i + 1}. {opt.slice(0, 20)}
              {opt.length > 20 ? '…' : ''}
            </Text>
          </Pressable>
        ))}
      </Box>
    </Box>
  );
});

// ── Agent tile (density-first) ─────────────────────────────────

const AgentTile = React.memo(function AgentTile({
  agent,
  expanded,
  onToggle,
  agentIndex,
}: {
  agent: FleetAgentState;
  expanded: boolean;
  onToggle: () => void;
  agentIndex: number;
}) {
  const [editorKey, setEditorKey] = useState(0);
  const statusColor = STATUS_COLORS[agent.status] ?? COLORS.textMuted;
  const agentColor = AGENT_COLORS[agentIndex % AGENT_COLORS.length];
  const hasPerm = agent.perm !== null;
  const hasQuestion = agent.question !== null;

  const handleSubmit = useCallback(() => {
    setEditorKey(k => k + 1);
  }, []);

  return (
    <Box
      style={{
        flexGrow: expanded ? 1 : 0,
        flexDirection: 'column',
        flexShrink: expanded ? 0 : 1,
      }}
    >
      {/* Header — BRIGHT, high contrast */}
      <Pressable
        onPress={onToggle}
        style={{
          ...S.header,
          borderColor: hasPerm ? COLORS.warning : expanded ? agentColor : COLORS.border,
          borderLeftColor: agentColor,
          borderLeftWidth: expanded ? 4 : 2,
          borderBottomWidth: expanded ? 2 : 1,
          backgroundColor: expanded ? agentColor + '15' : 'transparent',
          paddingLeft: expanded ? 8 : 10,
        }}
      >
        <Box style={S.headerLeft}>
          {/* Expand/collapse chevron */}
          <Text
            style={{
              fontSize: 10,
              color: agentColor,
              fontWeight: 'bold',
              width: 8,
            }}
          >
            {expanded ? '⏷' : '⏶'}
          </Text>

          {/* Agent name — LOUD when expanded */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: 'bold',
              color: expanded ? agentColor : COLORS.textDim,
              letterSpacing: expanded ? 1 : 0,
            }}
          >
            {agent.label.toUpperCase()}
          </Text>

          {/* Model badge (compact) */}
          <Box
            style={{
              borderRadius: 2,
              paddingLeft: 4,
              paddingRight: 4,
              paddingTop: 1,
              paddingBottom: 1,
              backgroundColor: statusColor + '20',
              borderWidth: agent.status === 'running' || agent.status === 'thinking' ? 1 : 0,
              borderColor: statusColor,
            }}
          >
            <Text style={{ fontSize: 7, color: statusColor, fontWeight: 'bold' }}>
              {MODEL_LABELS[agent.model] ?? agent.model}
            </Text>
          </Box>

          {/* Status indicator — BRIGHT */}
          <Box
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: statusColor,
              borderWidth: 2,
              borderColor: COLORS.bg,
              boxShadow: `0 0 8px ${statusColor}40`,
            }}
          />

          {/* Status text — VIVID */}
          <Text style={{ fontSize: 9, color: statusColor, fontWeight: 'bold', letterSpacing: 0.5 }}>
            {agent.status.toUpperCase()}
          </Text>
        </Box>

        {/* Right: perm/question badge — SCREAMING COLORS */}
        <Box style={S.headerRight}>
          {hasPerm && (
            <Box
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: COLORS.warning,
                borderWidth: 2,
                borderColor: COLORS.bg,
                boxShadow: `0 0 12px ${COLORS.warning}88`,
              }}
            />
          )}
          {hasQuestion && !hasPerm && (
            <Box
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: COLORS.accent,
                borderWidth: 2,
                borderColor: COLORS.bg,
                boxShadow: `0 0 12px ${COLORS.accent}88`,
              }}
            />
          )}
        </Box>
      </Pressable>

      {/* Expanded body */}
      {expanded && (
        <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
          {/* Permission bar — GLOWING, unmissable */}
          {agent.perm && (
            <Box
              style={{
                ...S.permBar,
                backgroundColor: COLORS.warning + '25',
                borderColor: COLORS.warning,
                borderTopColor: COLORS.warning,
                borderBottomColor: COLORS.warning,
                boxShadow: `inset 0 0 20px ${COLORS.warning}30`,
              }}
            >
              <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexGrow: 1 }}>
                <Text style={{ fontSize: 10, color: COLORS.warning, fontWeight: 'bold', letterSpacing: 1 }}>
                  {'⚠ PERM'}
                </Text>
                <Text style={{ fontSize: 11, color: COLORS.warning, flexGrow: 1, fontWeight: 'bold' }}>
                  {agent.perm.question || `${agent.perm.action}: ${agent.perm.target}`}
                </Text>
              </Box>
              <Box style={S.permBtns}>
                <Pressable
                  onPress={() => agent.respond(1)}
                  style={{
                    ...S.permBtn,
                    backgroundColor: COLORS.approve,
                    borderColor: COLORS.approve,
                    borderWidth: 2,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000' }}>
                    {'YES'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => agent.respond(2)}
                  style={{
                    ...S.permBtn,
                    backgroundColor: COLORS.accentBright,
                    borderColor: COLORS.accentBright,
                    borderWidth: 2,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000' }}>
                    {'ALL'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => agent.respond(3)}
                  style={{
                    ...S.permBtn,
                    backgroundColor: COLORS.deny,
                    borderColor: COLORS.deny,
                    borderWidth: 2,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000' }}>
                    {'NO'}
                  </Text>
                </Pressable>
              </Box>
            </Box>
          )}

          {/* Question bar */}
          {agent.question && (
            <QuestionBar
              question={agent.question}
              onRespond={agent.respondQuestion}
            />
          )}

          {/* Canvas */}
          <Native
            type="ClaudeCanvas"
            sessionId={agent.id}
            style={S.canvas}
          />

          {/* Prompt input — BRIGHT border */}
          <Box
            style={{
              ...S.prompt,
              borderColor: agentColor,
              borderTopColor: agentColor,
              backgroundColor: COLORS.bg,
              borderTopWidth: 3,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                paddingTop: 3,
                fontWeight: 'bold',
                color: agentColor,
              }}
            >
              {'❯'}
            </Text>
            <TextInput
              key={editorKey}
              placeholder={`Task ${agent.label.toLowerCase()}...`}
              style={{
                flexGrow: 1,
                fontSize: 12,
                color: COLORS.text,
                backgroundColor: COLORS.surface,
                borderColor: COLORS.border,
                borderRadius: 4,
                borderWidth: 1,
              }}
              onSubmit={(text) => {
                agent.send(text);
                handleSubmit();
              }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
});

// ── Main Fleet component ───────────────────────────────────────

export interface FleetProps {
  workingDir: string;
  agents: FleetAgentConfig[];
  defaultExpanded?: string[];
  style?: Style;
}

export function Fleet({
  workingDir,
  agents: agentConfigs,
  defaultExpanded,
  style,
}: FleetProps) {
  const mode = useRendererMode();
  if (mode === 'web') return null;

  const fleet = useFleet({ workingDir, agents: agentConfigs });

  // Expanded state per agent
  const [expandedSet, setExpandedSet] = useState<Set<string>>(() => {
    if (defaultExpanded) return new Set(defaultExpanded);
    return new Set(agentConfigs[0] ? [agentConfigs[0].id] : []);
  });

  const toggle = useCallback((id: string) => {
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <Box style={{ ...S.root, ...style }}>
      {/* Hidden: always-mounted ClaudeCode sessions */}
      <Box style={S.hidden}>
        {fleet.agents.map(agent => (
          <Native
            key={`session-${agent.id}`}
            type="ClaudeCode"
            workingDir={
              agentConfigs.find(c => c.id === agent.id)?.workingDir ?? workingDir
            }
            model={agent.model}
            sessionId={agent.id}
            onStatusChange={agent.onStatusChange}
            onPermissionRequest={agent.onPermissionRequest}
            onPermissionResolved={agent.onPermissionResolved}
            onQuestionPrompt={agent.onQuestionPrompt}
          />
        ))}
      </Box>

      {/* Auto-accept toggle — BRIGHT */}
      <Box style={S.autoAcceptBar}>
        <Pressable
          onPress={fleet.toggleAutoAccept}
          style={{
            ...S.autoAcceptBtn,
            backgroundColor: fleet.autoAccept ? COLORS.approve : 'transparent',
            borderColor: COLORS.approve,
            borderWidth: 2,
          }}
        >
          <Text
            style={{
              fontSize: 9,
              color: fleet.autoAccept ? '#000' : COLORS.approve,
              fontWeight: 'bold',
              letterSpacing: 1,
            }}
          >
            {fleet.autoAccept ? 'AUTO_ON' : 'auto'}
          </Text>
        </Pressable>
      </Box>

      {/* Agent tiles */}
      {fleet.agents.map((agent, idx) => (
        <AgentTile
          key={`tile-${agent.id}`}
          agent={agent}
          expanded={expandedSet.has(agent.id)}
          onToggle={() => toggle(agent.id)}
          agentIndex={idx}
        />
      ))}
    </Box>
  );
}
