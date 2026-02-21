/**
 * AI Cortex — Three-panel AI cockpit with local LLM inference.
 *
 * Top-left:  3D brain mesh with generative effect backdrop (driven by model state)
 * Top-right: CRT-style think terminal streaming <think> blocks
 * Middle:    Chat canvas with streaming messages
 * Bottom:    Input bar + inference controls (sliders, tool toggles)
 *
 * Wires directly to the LLMAgent capability (experiments/llm/) for local inference.
 * Gracefully degrades when models aren't available.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box, Text, ScrollView, Pressable, TextInput, Slider, Switch,
  Constellation, Mycelium, Pipes, Voronoi, Contours,
  useBridge,
} from '../../../packages/shared/src';
import { Scene, Camera, Mesh, AmbientLight, DirectionalLight } from '../../../packages/3d/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Types ──────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface AgentState {
  phase: 'loading' | 'idle' | 'generating' | 'unavailable' | 'error';
  amplitude: number;
  tokensPerSec: number;
  memoriesUsed: number;
}

// ── Effect palette (cycles or can be model-chosen) ─────────

const effectList = [
  { name: 'Constellation', Component: Constellation },
  { name: 'Mycelium', Component: Mycelium },
  { name: 'Pipes', Component: Pipes },
  { name: 'Voronoi', Component: Voronoi },
  { name: 'Contours', Component: Contours },
] as const;

// ── CRT scanline overlay ───────────────────────────────────

function Scanlines() {
  return (
    <Box style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.05)',
      pointerEvents: 'none',
    }} />
  );
}

// ── Brain Panel ────────────────────────────────────────────

function BrainPanel({ agentState, effectIndex }: {
  agentState: AgentState;
  effectIndex: number;
}) {
  const [spin, setSpin] = useState(0);

  // Spin speed: slow idle, faster during generation
  useEffect(() => {
    const id = setInterval(() => {
      const baseSpeed = 0.008;
      const genBoost = agentState.phase === 'generating' ? 0.04 * agentState.amplitude : 0;
      setSpin(prev => prev + baseSpeed + genBoost);
    }, 16);
    return () => clearInterval(id);
  }, [agentState.phase, agentState.amplitude]);

  const Effect = effectList[effectIndex % effectList.length].Component;

  return (
    <Box style={{ flexGrow: 1, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#1a1a2e' }}>
      {/* Effect backdrop */}
      <Effect
        background
        speed={0.3 + agentState.amplitude * 0.7}
        amplitude={agentState.amplitude}
        beat={agentState.phase === 'generating' && agentState.tokensPerSec > 5}
      />

      {/* 3D brain */}
      <Scene
        style={{ width: '100%', height: '100%' }}
        backgroundColor="transparent"
      >
        <Camera position={[0, -250, 120]} lookAt={[0, 0, 80]} fov={0.8} />
        <AmbientLight color="#1a1a3e" intensity={0.3} />
        <DirectionalLight
          direction={[0.5, -0.3, 1]}
          color={agentState.phase === 'generating' ? '#89b4fa' : '#6c7086'}
          intensity={0.6 + agentState.amplitude * 0.8}
        />
        <Mesh
          model="assets/Brain.obj"
          color={agentState.phase === 'generating' ? '#89b4fa' : '#585b70'}
          wireframe
          fresnel={2 + agentState.amplitude * 3}
          opacity={0.85}
          rotation={[0, spin, 0]}
        />
      </Scene>

      {/* Phase label overlay */}
      <Box style={{
        position: 'absolute',
        bottom: 8, left: 8,
        paddingHorizontal: 8, paddingVertical: 3,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 4,
      }}>
        <Text style={{
          fontSize: 9,
          color: agentState.phase === 'generating' ? '#89b4fa' : '#6c7086',
        }}>
          {agentState.phase === 'generating'
            ? `${agentState.tokensPerSec.toFixed(1)} tok/s`
            : agentState.phase.toUpperCase()}
        </Text>
      </Box>
    </Box>
  );
}

// ── Think Terminal (CRT style) ─────────────────────────────

function ThinkTerminal({ thinkBlocks }: { thinkBlocks: string[] }) {
  const scrollRef = useRef<any>(null);

  return (
    <Box style={{
      flexGrow: 1,
      backgroundColor: '#0a0a0a',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#1a2e1a',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <Box style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#0d120d',
        borderBottomWidth: 1,
        borderColor: '#1a2e1a',
      }}>
        <Text style={{ fontSize: 9, color: '#3a5a3a' }}>CORTEX MONITOR</Text>
        <Box style={{ flexDirection: 'row', gap: 4 }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: thinkBlocks.length > 0 ? '#22c55e' : '#374151' }} />
          <Text style={{ fontSize: 8, color: '#3a5a3a' }}>
            {thinkBlocks.length > 0 ? 'ACTIVE' : 'STANDBY'}
          </Text>
        </Box>
      </Box>

      {/* Think content */}
      <ScrollView style={{ flexGrow: 1, padding: 8 }}>
        {thinkBlocks.length === 0 ? (
          <Box style={{ padding: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: '#1a3a1a' }}>
              {'// awaiting cognitive process...'}
            </Text>
          </Box>
        ) : (
          thinkBlocks.map((block, i) => (
            <Box key={i} style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 8, color: '#2a4a2a', marginBottom: 2 }}>
                {`[THINK ${String(i + 1).padStart(3, '0')}]`}
              </Text>
              <Text style={{ fontSize: 10, color: '#22c55e', lineHeight: 15 }}>
                {block}
              </Text>
            </Box>
          ))
        )}
      </ScrollView>

      <Scanlines />
    </Box>
  );
}

// ── Message Bubble ─────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <Box style={{
      backgroundColor: isUser ? '#1e3a5f' : '#1a2332',
      padding: 10,
      borderRadius: 8,
      marginBottom: 6,
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '85%',
    }}>
      <Text style={{ fontSize: 9, color: '#6c7086', marginBottom: 3 }}>
        {isUser ? 'You' : 'Cortex'}
      </Text>
      <Text style={{ fontSize: 12, color: '#cdd6f4', lineHeight: 18 }}>
        {message.content}
      </Text>
    </Box>
  );
}

// ── Chat Canvas ────────────────────────────────────────────

function ChatCanvas({ messages, isGenerating, streamText }: {
  messages: Message[];
  isGenerating: boolean;
  streamText: string;
}) {
  return (
    <ScrollView style={{
      flexGrow: 1,
      backgroundColor: '#11111b',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#1e1e2e',
      padding: 10,
    }}>
      {messages.length === 0 && !isGenerating && (
        <Box style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: '#45475a' }}>
            Send a message to begin
          </Text>
          <Text style={{ fontSize: 10, color: '#313244', marginTop: 6 }}>
            Local inference via llama.cpp
          </Text>
        </Box>
      )}
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
      {isGenerating && streamText.length > 0 && (
        <Box style={{
          backgroundColor: '#1a2332',
          padding: 10,
          borderRadius: 8,
          marginBottom: 6,
          alignSelf: 'flex-start',
          maxWidth: '85%',
        }}>
          <Text style={{ fontSize: 9, color: '#6c7086', marginBottom: 3 }}>Cortex</Text>
          <Text style={{ fontSize: 12, color: '#cdd6f4', lineHeight: 18 }}>
            {streamText}
          </Text>
          <Text style={{ fontSize: 9, color: '#89b4fa', marginTop: 4 }}>generating...</Text>
        </Box>
      )}
    </ScrollView>
  );
}

// ── Control Bar ────────────────────────────────────────────

function ControlBar({
  input, setInput, onSend, isGenerating,
  temperature, setTemperature,
  topP, setTopP,
  maxTokens, setMaxTokens,
  tools, toggleTool,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  isGenerating: boolean;
  temperature: number;
  setTemperature: (v: number) => void;
  topP: number;
  setTopP: (v: number) => void;
  maxTokens: number;
  setMaxTokens: (v: number) => void;
  tools: { name: string; enabled: boolean }[];
  toggleTool: (name: string) => void;
}) {
  const c = useThemeColors();

  return (
    <Box style={{
      backgroundColor: '#181825',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#1e1e2e',
      padding: 10,
      gap: 8,
    }}>
      {/* Input row */}
      <Box style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={onSend}
          placeholder="Type a message..."
          style={{
            flexGrow: 1,
            fontSize: 13,
            color: '#cdd6f4',
            backgroundColor: '#11111b',
            padding: 10,
            borderRadius: 6,
            height: 38,
          }}
        />
        <Pressable
          onPress={onSend}
          style={{
            backgroundColor: isGenerating ? '#45475a' : '#89b4fa',
            paddingHorizontal: 16,
            borderRadius: 6,
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 12, color: isGenerating ? '#6c7086' : '#11111b', fontWeight: 'bold' }}>
            {isGenerating ? '...' : 'Send'}
          </Text>
        </Pressable>
      </Box>

      {/* Sliders row */}
      <Box style={{ flexDirection: 'row', gap: 16, width: '100%', alignItems: 'center' }}>
        {/* Temperature */}
        <Box style={{ flexGrow: 1, gap: 2 }}>
          <Text style={{ fontSize: 8, color: '#6c7086' }}>{`Temp: ${temperature.toFixed(2)}`}</Text>
          <Slider
            value={temperature}
            minimumValue={0}
            maximumValue={2}
            step={0.05}
            onValueChange={setTemperature}
            activeTrackColor="#89b4fa"
          />
        </Box>
        {/* Top P */}
        <Box style={{ flexGrow: 1, gap: 2 }}>
          <Text style={{ fontSize: 8, color: '#6c7086' }}>{`Top P: ${topP.toFixed(2)}`}</Text>
          <Slider
            value={topP}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            onValueChange={setTopP}
            activeTrackColor="#a6e3a1"
          />
        </Box>
        {/* Max Tokens */}
        <Box style={{ flexGrow: 1, gap: 2 }}>
          <Text style={{ fontSize: 8, color: '#6c7086' }}>{`Tokens: ${maxTokens}`}</Text>
          <Slider
            value={maxTokens}
            minimumValue={64}
            maximumValue={2048}
            step={64}
            onValueChange={setMaxTokens}
            activeTrackColor="#f5c2e7"
          />
        </Box>
      </Box>

      {/* Tool toggles */}
      {tools.length > 0 && (
        <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Text style={{ fontSize: 8, color: '#6c7086' }}>Tools:</Text>
          {tools.map(tool => (
            <Box key={tool.name} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Switch
                value={tool.enabled}
                onValueChange={() => toggleTool(tool.name)}
                trackColor={{ true: '#89b4fa', false: '#313244' }}
                thumbColor="#cdd6f4"
              />
              <Text style={{ fontSize: 9, color: tool.enabled ? '#cdd6f4' : '#45475a' }}>
                {tool.name}
              </Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// ── Main Story ─────────────────────────────────────────────

export function AICortexStory() {
  const bridge = useBridge();

  // Agent state
  const [agentState, setAgentState] = useState<AgentState>({
    phase: 'loading',
    amplitude: 0,
    tokensPerSec: 0,
    memoriesUsed: 0,
  });

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinkBlocks, setThinkBlocks] = useState<string[]>([]);
  const [streamText, setStreamText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Input state
  const [input, setInput] = useState('');

  // Config state
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);
  const [maxTokens, setMaxTokens] = useState(512);
  const [tools, setTools] = useState([
    { name: 'calculate', enabled: true },
  ]);

  // Effect cycling
  const [effectIndex, setEffectIndex] = useState(0);

  // Poll agent status on mount
  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      try {
        const status = await bridge.rpc('agent:status', {}) as any;
        if (mounted && status) {
          setAgentState(prev => ({
            ...prev,
            phase: status.phase || prev.phase,
          }));
        }
      } catch {
        // Agent not available yet
      }
    };
    checkStatus();
    return () => { mounted = false; };
  }, [bridge]);

  // Listen for capability events
  useEffect(() => {
    const unsub = bridge.on('capability', (event: any) => {
      const p = event.payload || event;
      switch (p.handler) {
        case 'onReady':
          setAgentState(prev => ({
            ...prev,
            phase: p.available ? 'idle' : 'unavailable',
          }));
          break;

        case 'onStateChange':
          setAgentState({
            phase: p.phase || 'idle',
            amplitude: p.amplitude || 0,
            tokensPerSec: p.tokensPerSec || 0,
            memoriesUsed: p.memoriesUsed || 0,
          });
          if (p.phase === 'generating') {
            setIsGenerating(true);
          }
          break;

        case 'onToken':
          setStreamText(p.fullText || '');
          break;

        case 'onThink':
          if (p.thought) {
            setThinkBlocks(prev => [...prev, p.thought]);
          }
          break;

        case 'onDone':
          setIsGenerating(false);
          if (p.response) {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: p.response,
              timestamp: Date.now(),
            }]);
          }
          setStreamText('');
          // Cycle effect on completion
          setEffectIndex(prev => prev + 1);
          break;

        case 'onError':
          setIsGenerating(false);
          setAgentState(prev => ({ ...prev, phase: 'error' }));
          if (p.error) {
            setMessages(prev => [...prev, {
              role: 'system',
              content: `Error: ${p.error}`,
              timestamp: Date.now(),
            }]);
          }
          break;
      }
    });
    return unsub;
  }, [bridge]);

  // Send message
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isGenerating) return;

    setInput('');
    setMessages(prev => [...prev, {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }]);
    setStreamText('');

    try {
      // Update config before sending
      await bridge.rpc('agent:configure', {
        temperature,
        topP,
        maxTokens,
      });
      await bridge.rpc('agent:send', { message: text });
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Failed to send: ${err?.message || 'unknown error'}`,
        timestamp: Date.now(),
      }]);
    }
  }, [input, isGenerating, bridge, temperature, topP, maxTokens]);

  // Toggle tool
  const toggleTool = useCallback((name: string) => {
    setTools(prev => prev.map(t =>
      t.name === name ? { ...t, enabled: !t.enabled } : t
    ));
  }, []);

  const isUnavailable = agentState.phase === 'unavailable';

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#11111b', padding: 8, gap: 8 }}>
      {/* LLMAgent capability node (non-visual, drives events) */}
      {/* This renders a capability node that the Lua side picks up */}
      {/* For now, the capability loads via Capabilities.loadAll() */}

      {/* Top row: Brain + Think Terminal */}
      <Box style={{ flexDirection: 'row', gap: 8, height: '35%' }}>
        <BrainPanel agentState={agentState} effectIndex={effectIndex} />
        <ThinkTerminal thinkBlocks={thinkBlocks} />
      </Box>

      {/* Chat canvas */}
      <ChatCanvas
        messages={messages}
        isGenerating={isGenerating}
        streamText={streamText}
      />

      {/* Unavailable banner */}
      {isUnavailable && (
        <Box style={{
          backgroundColor: '#2d1b1b',
          padding: 8,
          borderRadius: 6,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 11, color: '#f38ba8' }}>
            LLM stack not available. Place GGUF models in experiments/llm/ and run with LD_LIBRARY_PATH.
          </Text>
        </Box>
      )}

      {/* Control bar */}
      <ControlBar
        input={input}
        setInput={setInput}
        onSend={handleSend}
        isGenerating={isGenerating}
        temperature={temperature}
        setTemperature={setTemperature}
        topP={topP}
        setTopP={setTopP}
        maxTokens={maxTokens}
        setMaxTokens={setMaxTokens}
        tools={tools}
        toggleTool={toggleTool}
      />
    </Box>
  );
}
