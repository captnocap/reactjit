/**
 * AICanvasDemo — AI agent builds live interactive interfaces on a canvas.
 *
 * The chat history IS the canvas. Instead of text bubbles, the AI creates
 * dashboards, status pages, and interactive widgets in real-time using
 * canvas tools. The only "chat" UI is the input bar at the bottom.
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Box, Text, ScrollView, Pressable, TextInput } from '../../../packages/shared/src';
import { useChat, AIProvider } from '../../../packages/ai/src';
import type { AIProviderType, AIConfig, ToolDefinition } from '../../../packages/ai/src';

// ── Colors ──────────────────────────────────────────────

const BG = '#080c16';
const SURFACE = '#111827';
const CARD_BG = '#1a2235';
const CARD_BORDER = '#2a3548';
const ACCENT = '#3b82f6';
const TEXT_PRIMARY = '#e2e8f0';
const TEXT_DIM = '#64748b';
const TEXT_MUTED = '#94a3b8';
const GREEN = '#22c55e';
const AMBER = '#f59e0b';
const RED = '#ef4444';

// ── Canvas Node ─────────────────────────────────────────

interface CanvasNode {
  id: string;
  type: string;
  props: Record<string, any>;
  parentId?: string;
}

// ── Node Renderers ──────────────────────────────────────

function Children({ parentId, nodes, onAction }: {
  parentId: string; nodes: CanvasNode[]; onAction: (a: string) => void;
}) {
  const kids = nodes.filter(n => n.parentId === parentId);
  return <>{kids.map(n => <RenderNode key={n.id} node={n} nodes={nodes} onAction={onAction} />)}</>;
}

function RenderNode({ node, nodes, onAction }: {
  node: CanvasNode; nodes: CanvasNode[]; onAction: (a: string) => void;
}) {
  const p = node.props || {};

  switch (node.type) {
    case 'card':
      return (
        <Box style={{
          backgroundColor: CARD_BG, borderRadius: 8, padding: 12,
          borderWidth: 1, borderColor: CARD_BORDER, gap: 8, ...p.style,
        }}>
          {p.title && (
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: TEXT_PRIMARY }}>
              {p.title}
            </Text>
          )}
          {p.subtitle && (
            <Text style={{ fontSize: 11, color: TEXT_DIM }}>{p.subtitle}</Text>
          )}
          <Children parentId={node.id} nodes={nodes} onAction={onAction} />
        </Box>
      );

    case 'row':
      return (
        <Box style={{
          flexDirection: 'row', gap: p.gap || 8,
          flexWrap: p.wrap ? 'wrap' : undefined, ...p.style,
        }}>
          <Children parentId={node.id} nodes={nodes} onAction={onAction} />
        </Box>
      );

    case 'column':
      return (
        <Box style={{ gap: p.gap || 8, ...p.style }}>
          <Children parentId={node.id} nodes={nodes} onAction={onAction} />
        </Box>
      );

    case 'text':
      return (
        <Text style={{ fontSize: 13, color: TEXT_PRIMARY, lineHeight: 20, ...p.style }}>
          {p.content || ''}
        </Text>
      );

    case 'heading': {
      const sizes: Record<number, number> = { 1: 22, 2: 16, 3: 14 };
      const sz = sizes[p.level] || 16;
      return (
        <Text style={{ fontSize: sz, fontWeight: 'bold', color: TEXT_PRIMARY, ...p.style }}>
          {p.content || ''}
        </Text>
      );
    }

    case 'metric':
      return (
        <Box style={{ alignItems: 'center', padding: 4, ...p.style }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: p.color || ACCENT }}>
            {p.value || '\u2014'}
          </Text>
          <Text style={{ fontSize: 11, color: TEXT_DIM, marginTop: 2 }}>
            {p.label || ''}
          </Text>
        </Box>
      );

    case 'bar-chart': {
      const data: { label: string; value: number }[] = p.data || [];
      const max = p.maxValue || Math.max(...data.map(d => d.value), 1);
      const color = p.color || ACCENT;
      return (
        <Box style={{ gap: 6, ...p.style }}>
          {data.map((d, i) => {
            const pct = Math.min(100, (d.value / max) * 100);
            return (
              <Box key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 10, color: TEXT_DIM, width: 70 }}>{d.label}</Text>
                <Box style={{ flexGrow: 1, height: 18, backgroundColor: '#1e293b', borderRadius: 3 }}>
                  <Box style={{
                    height: 18, width: `${pct}%`,
                    backgroundColor: color, borderRadius: 3,
                  }} />
                </Box>
                <Text style={{ fontSize: 10, color: TEXT_MUTED, width: 36 }}>
                  {String(d.value)}
                </Text>
              </Box>
            );
          })}
        </Box>
      );
    }

    case 'progress-bar': {
      const val = Math.min(100, Math.max(0, p.value || 0));
      const color = p.color || ACCENT;
      return (
        <Box style={{ gap: 4, ...p.style }}>
          {p.label && (
            <Box style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ fontSize: 10, color: TEXT_DIM, flexGrow: 1 }}>{p.label}</Text>
              <Text style={{ fontSize: 10, color: TEXT_MUTED }}>{`${val}%`}</Text>
            </Box>
          )}
          <Box style={{ height: 8, backgroundColor: '#1e293b', borderRadius: 4 }}>
            <Box style={{
              height: 8, width: `${val}%`,
              backgroundColor: color, borderRadius: 4,
            }} />
          </Box>
        </Box>
      );
    }

    case 'sparkline': {
      const data: number[] = p.data || [];
      const max = Math.max(...data, 1);
      const h = p.height || 40;
      const color = p.color || ACCENT;
      return (
        <Box style={{
          flexDirection: 'row', alignItems: 'flex-end',
          height: h, gap: 1, ...p.style,
        }}>
          {data.map((v, i) => (
            <Box key={i} style={{
              flexGrow: 1,
              height: Math.max(2, (v / max) * h),
              backgroundColor: color, borderRadius: 1,
            }} />
          ))}
        </Box>
      );
    }

    case 'button':
      return (
        <Pressable
          onPress={() => onAction(p.action || p.label || 'button')}
          style={{
            backgroundColor: p.color || ACCENT,
            paddingLeft: 14, paddingRight: 14,
            paddingTop: 8, paddingBottom: 8,
            borderRadius: 6, alignSelf: 'flex-start', ...p.style,
          }}
        >
          <Text style={{ fontSize: 12, color: '#fff', fontWeight: 'bold' }}>
            {p.label || 'Button'}
          </Text>
        </Pressable>
      );

    case 'badge':
      return (
        <Box style={{
          backgroundColor: p.color || '#334155',
          paddingLeft: 8, paddingRight: 8,
          paddingTop: 3, paddingBottom: 3,
          borderRadius: 10, alignSelf: 'flex-start', ...p.style,
        }}>
          <Text style={{ fontSize: 10, color: '#fff' }}>{p.label || ''}</Text>
        </Box>
      );

    case 'status': {
      const dotColor = p.state === 'ok' ? GREEN : p.state === 'warning' ? AMBER : RED;
      return (
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, ...p.style }}>
          <Box style={{
            width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor,
          }} />
          <Text style={{ fontSize: 12, color: TEXT_PRIMARY }}>{p.label || ''}</Text>
        </Box>
      );
    }

    case 'divider':
      return <Box style={{ height: 1, backgroundColor: CARD_BORDER, ...p.style }} />;

    default:
      return (
        <Text style={{ fontSize: 10, color: RED }}>{'Unknown: ' + node.type}</Text>
      );
  }
}

// ── System Prompt ───────────────────────────────────────

const SYSTEM_PROMPT = `You are a visual UI builder. Users describe what they want, and you build it on a live canvas using tools. Do NOT write long explanations — just build and add a one-sentence summary.

COMPONENT TYPES (canvas_add):

Layout containers (nest children via parentId):
- card: Dashboard card. Props: { title?, subtitle?, style? }
- row: Horizontal layout. Props: { gap?, wrap?, style? }
- column: Vertical layout. Props: { gap?, style? }

Content:
- heading: Large text. Props: { content, level?: 1|2|3 }
- text: Body text. Props: { content }
- metric: Big number + label. Props: { value, label, color? }

Data visualization:
- bar-chart: Horizontal bars. Props: { data: [{label, value}], color? }
- progress-bar: 0-100 bar. Props: { value, label?, color? }
- sparkline: Mini chart. Props: { data: number[], color?, height? }

Interactive & Status:
- button: Clickable. Props: { label, color? }
- badge: Tag. Props: { label, color? }
- status: Dot + text. Props: { label, state: "ok"|"warning"|"error" }
- divider: Line separator.

BUILDING RULES:
1. Create a root row or column first, then nest cards inside it.
2. Use meaningful IDs: "cpu-card", "revenue-metric", "status-row".
3. Colors: "#3b82f6" blue, "#22c55e" green, "#f59e0b" amber, "#ef4444" red, "#8b5cf6" purple, "#06b6d4" cyan.
4. Build the layout first, then fill in content components.
5. For dashboards: row of cards, each with metrics + charts.
6. Keep text concise. This is visual, not a document.
7. Use canvas_get_state before modifying existing components.
8. When user clicks a button, you'll receive a message about it.`;

// ── Pill ────────────────────────────────────────────────

function Pill({ label, active, onPress }: {
  label: string; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{
      backgroundColor: active ? ACCENT : SURFACE,
      paddingLeft: 10, paddingRight: 10,
      paddingTop: 4, paddingBottom: 4,
      borderRadius: 4,
    }}>
      <Text style={{ fontSize: 11, color: active ? '#fff' : TEXT_MUTED }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Main Story ──────────────────────────────────────────

export function AICanvasStory() {
  // Config
  const [provider, setProvider] = useState<AIProviderType>('openai');
  const [model, setModel] = useState('gpt-4');
  const [apiKey, setApiKey] = useState('');
  const [showConfig, setShowConfig] = useState(true);

  // Canvas
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const setNodesRef = useRef(setNodes);
  setNodesRef.current = setNodes;

  // Input
  const [input, setInput] = useState('');

  // ── Canvas tools (stable refs, never recreated) ───────
  const tools = useMemo<ToolDefinition[]>(() => [
    {
      name: 'canvas_add',
      description: 'Add a component to the canvas. Nest inside containers using parentId.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique ID (e.g. "cpu-card")' },
          type: {
            type: 'string',
            enum: [
              'card', 'row', 'column', 'text', 'heading', 'metric',
              'bar-chart', 'progress-bar', 'sparkline',
              'button', 'badge', 'status', 'divider',
            ],
          },
          props: { type: 'object', description: 'Component properties' },
          parentId: { type: 'string', description: 'Parent container ID. Omit for root.' },
        },
        required: ['id', 'type'],
      },
      execute: async ({ id, type, props, parentId }: any) => {
        if (parentId && !nodesRef.current.find(n => n.id === parentId)) {
          return { error: `Parent "${parentId}" not found. Create it first.` };
        }
        const node: CanvasNode = { id, type, props: props || {}, parentId };
        setNodesRef.current(prev => [...prev.filter(n => n.id !== id), node]);
        return { success: true, id };
      },
    },
    {
      name: 'canvas_update',
      description: 'Update props of an existing component (merged with current props).',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          props: { type: 'object', description: 'Props to merge' },
        },
        required: ['id', 'props'],
      },
      execute: async ({ id, props }: any) => {
        if (!nodesRef.current.find(n => n.id === id)) {
          return { error: `"${id}" not found.` };
        }
        setNodesRef.current(prev =>
          prev.map(n => n.id === id ? { ...n, props: { ...n.props, ...props } } : n),
        );
        return { success: true, id };
      },
    },
    {
      name: 'canvas_remove',
      description: 'Remove a component and all its children.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      execute: async ({ id }: any) => {
        const gone = new Set<string>();
        function collect(nid: string) {
          gone.add(nid);
          nodesRef.current.filter(n => n.parentId === nid).forEach(n => collect(n.id));
        }
        collect(id);
        setNodesRef.current(prev => prev.filter(n => !gone.has(n.id)));
        return { success: true, removed: gone.size };
      },
    },
    {
      name: 'canvas_clear',
      description: 'Clear the entire canvas.',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        setNodesRef.current([]);
        return { success: true };
      },
    },
    {
      name: 'canvas_get_state',
      description: 'See all components currently on the canvas.',
      parameters: { type: 'object', properties: {} },
      execute: async () => ({ components: nodesRef.current }),
    },
  ], []);

  // ── AI config ─────────────────────────────────────────
  const config: AIConfig = {
    provider,
    model,
    apiKey: apiKey || undefined,
    baseURL: provider === 'custom' ? 'http://localhost:11434' : undefined,
    systemPrompt: SYSTEM_PROMPT,
  };

  const { messages, send, isLoading, isStreaming, error, stop } = useChat({
    ...config,
    tools,
    maxToolRounds: 30,
  });

  // Last assistant message for status bar
  const lastAssistant = [...messages]
    .reverse()
    .find(m => m.role === 'assistant' && typeof m.content === 'string' && m.content.trim());
  const statusText = typeof lastAssistant?.content === 'string'
    ? (lastAssistant.content.length > 120 ? lastAssistant.content.slice(0, 120) + '...' : lastAssistant.content)
    : '';

  // Button clicks feed back into the chat
  const handleAction = useCallback((action: string) => {
    if (!isLoading) {
      send(`[User clicked: "${action}"]`);
    }
  }, [isLoading, send]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    send(text);
  }, [input, isLoading, send]);

  return (
    <AIProvider config={config}>
      <Box style={{ width: '100%', height: '100%', backgroundColor: BG }}>
        {/* ── Header ─────────────────────────────────── */}
        <Box style={{ backgroundColor: SURFACE, borderBottomWidth: 1, borderColor: '#1e293b' }}>
          <Pressable
            onPress={() => setShowConfig(!showConfig)}
            style={{
              flexDirection: 'row', alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: 16, paddingRight: 16,
              paddingTop: 8, paddingBottom: 8,
              width: '100%',
            }}
          >
            <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: TEXT_PRIMARY }}>
                AI Canvas
              </Text>
              <Text style={{ fontSize: 10, color: TEXT_DIM }}>
                {nodes.length > 0 ? nodes.length + ' components' : 'empty'}
              </Text>
            </Box>
            <Text style={{ fontSize: 10, color: TEXT_DIM }}>
              {showConfig ? 'hide config' : 'config'}
            </Text>
          </Pressable>

          {showConfig && (
            <Box style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 10, gap: 8 }}>
              <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Pill label="OpenAI" active={provider === 'openai'} onPress={() => {
                  setProvider('openai'); setModel('gpt-4');
                }} />
                <Pill label="Anthropic" active={provider === 'anthropic'} onPress={() => {
                  setProvider('anthropic'); setModel('claude-sonnet-4-5-20250929');
                }} />
                <Pill label="Local" active={provider === 'custom'} onPress={() => {
                  setProvider('custom'); setModel('llama3');
                }} />
              </Box>
              <Box style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={model}
                  onChangeText={setModel}
                  placeholder="Model..."
                  style={{
                    fontSize: 11, color: TEXT_PRIMARY, backgroundColor: BG,
                    padding: 6, borderRadius: 4, width: 180, height: 28,
                  }}
                />
                <TextInput
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder={provider === 'custom' ? 'No key needed' : 'API key...'}
                  style={{
                    fontSize: 11, color: TEXT_PRIMARY, backgroundColor: BG,
                    padding: 6, borderRadius: 4, flexGrow: 1, height: 28,
                  }}
                />
              </Box>
            </Box>
          )}
        </Box>

        {/* ── Canvas ─────────────────────────────────── */}
        <ScrollView style={{ flexGrow: 1, padding: 16 }}>
          {nodes.length === 0 ? (
            <Box style={{
              justifyContent: 'center', alignItems: 'center', paddingTop: 100,
            }}>
              <Text style={{ fontSize: 20, color: TEXT_DIM, fontWeight: 'bold' }}>
                {isLoading ? 'Building...' : 'Empty Canvas'}
              </Text>
              <Text style={{ fontSize: 13, color: TEXT_DIM, marginTop: 8 }}>
                {config.apiKey || config.provider === 'custom'
                  ? 'Describe what you want to see'
                  : 'Add an API key, then describe what to build'}
              </Text>
              {!isLoading && (
                <Box style={{ marginTop: 24, gap: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: TEXT_MUTED }}>Try:</Text>
                  <Text style={{ fontSize: 11, color: ACCENT }}>
                    "build a server monitoring dashboard"
                  </Text>
                  <Text style={{ fontSize: 11, color: ACCENT }}>
                    "show me a project status board"
                  </Text>
                  <Text style={{ fontSize: 11, color: ACCENT }}>
                    "create a sales metrics overview"
                  </Text>
                </Box>
              )}
            </Box>
          ) : (
            <Box style={{ gap: 12 }}>
              {nodes.filter(n => !n.parentId).map(node => (
                <RenderNode
                  key={node.id}
                  node={node}
                  nodes={nodes}
                  onAction={handleAction}
                />
              ))}
            </Box>
          )}
        </ScrollView>

        {/* ── Status + Input ─────────────────────────── */}
        <Box style={{
          backgroundColor: SURFACE,
          borderTopWidth: 1, borderColor: '#1e293b',
          padding: 12, gap: 8,
        }}>
          {/* Status line */}
          {(statusText || error || isStreaming) && (
            <Box style={{
              flexDirection: 'row', alignItems: 'center',
              justifyContent: 'space-between', width: '100%',
            }}>
              <Text style={{
                fontSize: 11, flexShrink: 1,
                color: error ? RED : isStreaming ? ACCENT : GREEN,
              }}>
                {error ? error.message : isStreaming ? 'Building...' : statusText}
              </Text>
              {nodes.length > 0 && !isLoading && (
                <Pressable
                  onPress={() => setNodes([])}
                  style={{
                    paddingLeft: 8, paddingRight: 8,
                    paddingTop: 2, paddingBottom: 2,
                  }}
                >
                  <Text style={{ fontSize: 10, color: TEXT_DIM }}>Clear</Text>
                </Pressable>
              )}
            </Box>
          )}

          {/* Input bar */}
          <Box style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              placeholder="Describe what you want to build..."
              style={{
                flexGrow: 1, fontSize: 13, color: TEXT_PRIMARY,
                backgroundColor: BG, padding: 10, borderRadius: 6, height: 40,
              }}
            />
            {isLoading ? (
              <Pressable onPress={stop} style={{
                backgroundColor: RED,
                paddingLeft: 16, paddingRight: 16,
                borderRadius: 6, justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 12, color: '#fff' }}>Stop</Text>
              </Pressable>
            ) : (
              <Pressable onPress={handleSend} style={{
                backgroundColor: ACCENT,
                paddingLeft: 16, paddingRight: 16,
                borderRadius: 6, justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 12, color: '#fff' }}>Build</Text>
              </Pressable>
            )}
          </Box>
        </Box>
      </Box>
    </AIProvider>
  );
}
