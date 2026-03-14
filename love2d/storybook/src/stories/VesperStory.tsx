/**
 * VesperStory — Showcase of the Vesper AI Studio design system.
 *
 * Demonstrates the phosphor terminal aesthetic: near-black bg,
 * violet accent, role-coded message bubbles, provider health dots,
 * CRT post-processing, FlowParticles background, and CommandPalette.
 */

import React, { useState } from 'react';
import {
  Box, Text, Pressable, ScrollView, Markdown, TextInput,
  FlowParticles, CRT, CommandPalette,
} from '../../../packages/core/src';
import type { CommandDef } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';

// ── Vesper Palette ──────────────────────────────────────

const V = {
  bg:           '#0a0a0a',
  bgAlt:        '#0c0c10',
  bgElevated:   '#0e0e12',
  bgInset:      '#060608',
  accent:       '#8B5CF6',
  accentHover:  '#7C3AED',
  accentSubtle: 'rgba(139, 92, 246, 0.10)',
  user:         '#10B981',
  assistant:    '#F59E0B',
  tool:         '#06B6D4',
  success:      '#22C55E',
  error:        '#EF4444',
  text:         'rgba(255, 255, 255, 0.92)',
  textSecondary:'rgba(255, 255, 255, 0.60)',
  textDim:      'rgba(255, 255, 255, 0.40)',
  border:       'rgba(255, 255, 255, 0.08)',
  borderSubtle: 'rgba(255, 255, 255, 0.04)',
};

// ── Role colors ─────────────────────────────────────────

const ROLE_COLORS: Record<string, { accent: string; bg: string }> = {
  user:      { accent: V.user,      bg: 'rgba(16, 185, 129, 0.06)' },
  assistant: { accent: V.assistant,  bg: 'rgba(245, 158, 11, 0.06)' },
  tool:      { accent: V.tool,      bg: 'rgba(6, 182, 212, 0.06)' },
};

// ── Mock messages ───────────────────────────────────────

const MOCK_MESSAGES = [
  { role: 'user',      content: 'What is the difference between a JIT compiler and an AOT compiler?' },
  { role: 'assistant', content: '**JIT (Just-In-Time)** compiles code at runtime, right before execution. It can optimize based on actual usage patterns observed during the program\'s run.\n\n**AOT (Ahead-Of-Time)** compiles code before execution, typically during a build step. The compiled output is ready to run immediately without a compilation phase at startup.\n\n**Key trade-offs:**\n- JIT has slower startup but can achieve better peak performance via runtime profiling\n- AOT has faster startup and more predictable performance\n- LuaJIT is a prime example of JIT — it traces hot loops and compiles them to native machine code' },
  { role: 'user',      content: 'How does LuaJIT\'s trace compiler work?' },
  { role: 'assistant', content: 'LuaJIT uses **trace compilation**, which works differently from method-based JIT compilers:\n\n1. **Interpretation first** — code starts running in the interpreter\n2. **Hot loop detection** — when a loop back-edge is hit enough times, recording begins\n3. **Trace recording** — the JIT records the exact path through the code (one linear trace, no branches)\n4. **Compilation** — the trace is compiled to native x86/ARM machine code with guards for the assumptions made\n5. **Side traces** — if a guard fails often enough, a new trace branches from that point\n\nThis is why LuaJIT is so fast for numerical and loop-heavy code — it essentially converts your Lua into optimized assembly.' },
];

// ── Message Bubble ──────────────────────────────────────

function MessageBubble({ role, content }: { role: string; content: string }) {
  const colors = ROLE_COLORS[role] || ROLE_COLORS.assistant;

  return (
    <Box style={{
      width: '100%',
      backgroundColor: colors.bg,
      borderLeftWidth: 2,
      borderLeftColor: colors.accent,
      borderRadius: 4,
      paddingLeft: 12, paddingRight: 12,
      paddingTop: 8, paddingBottom: 8,
    }}>
      <Text style={{
        fontSize: 10,
        fontWeight: '700',
        color: colors.accent,
        paddingBottom: 4,
      }}>
        {role.toUpperCase()}
      </Text>
      {role === 'assistant' ? (
        <Markdown content={content} style={{ fontSize: 13 }} />
      ) : (
        <Text style={{ fontSize: 13, color: V.text }}>{content}</Text>
      )}
    </Box>
  );
}

// ── Provider Badge ──────────────────────────────────────

function ProviderBadge({ name, healthy }: { name: string; healthy: boolean }) {
  return (
    <Box style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 8, paddingRight: 10,
      paddingTop: 4, paddingBottom: 4,
      borderRadius: 4,
      backgroundColor: V.bgElevated,
      borderWidth: 1,
      borderColor: V.borderSubtle,
    }}>
      <Box style={{
        width: 6, height: 6,
        borderRadius: 9999,
        backgroundColor: healthy ? V.success : V.error,
      }} />
      <Text style={{ fontSize: 11, color: V.textSecondary }}>{name}</Text>
    </Box>
  );
}

// ── Nav Tab ─────────────────────────────────────────────

function NavTab({ label, icon, active, onPress }: {
  label: string; icon: string; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={(state) => ({
        flexGrow: 1,
        flexBasis: 0,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 6, paddingBottom: 6,
        gap: 2,
        backgroundColor: state.hovered ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
      })}
    >
      <Text style={{ fontSize: 16, color: active ? V.accent : V.textDim }}>{icon}</Text>
      <Text style={{
        fontSize: 10,
        fontWeight: active ? '700' : '400',
        color: active ? V.accent : V.textDim,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── VesperStory ─────────────────────────────────────────

export function VesperStory() {
  const [activeTab, setActiveTab] = useState('chat');
  const [paletteOpen, setPaletteOpen] = useState(false);

  const commands: CommandDef[] = [
    { id: 'new',      label: 'New Conversation',  shortcut: 'ctrl+n', group: 'Chat',     action: () => {} },
    { id: 'history',  label: 'Toggle History',    shortcut: 'ctrl+h', group: 'Chat',     action: () => {} },
    { id: 'chat',     label: 'Go to Chat',                            group: 'Navigate', action: () => setActiveTab('chat') },
    { id: 'compare',  label: 'Go to Compare',                         group: 'Navigate', action: () => setActiveTab('compare') },
    { id: 'terminal', label: 'Go to Terminal',                        group: 'Navigate', action: () => setActiveTab('terminal') },
    { id: 'research', label: 'Go to Research',                        group: 'Navigate', action: () => setActiveTab('research') },
    { id: 'settings', label: 'Go to Settings',    shortcut: 'ctrl+,', group: 'Navigate', action: () => setActiveTab('settings') },
  ];

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: V.bg,
      flexDirection: 'column',
    }}>
      {/* Flow particles background */}
      <FlowParticles background speed={0.3} decay={0.015} reactive />

      {/* Top bar */}
      <Box style={{
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 16, paddingRight: 16,
        paddingTop: 8, paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: V.border,
      }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: V.text }}>
          Vesper
        </Text>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ProviderBadge name="Ollama" healthy />
          <Pressable
            onPress={() => setPaletteOpen(true)}
            style={(state) => ({
              paddingLeft: 8, paddingRight: 8,
              paddingTop: 3, paddingBottom: 3,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: V.borderSubtle,
              backgroundColor: state.hovered ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
            })}
          >
            <Text style={{ fontSize: 10, color: V.textDim }}>
              {'\u2318K'}
            </Text>
          </Pressable>
        </Box>
      </Box>

      {/* Content area */}
      <Box style={{ flexGrow: 1, width: '100%' }}>
        {activeTab === 'chat' && (
          <Box style={{ flexGrow: 1, width: '100%', flexDirection: 'column' }}>
            {/* Messages */}
            <ScrollView style={{ flexGrow: 1, width: '100%' }}>
              <Box style={{
                maxWidth: 720,
                width: '100%',
                paddingLeft: 16, paddingRight: 16,
                paddingTop: 12, paddingBottom: 12,
                gap: 10,
              }}>
                {MOCK_MESSAGES.map((msg, i) => (
                  <MessageBubble key={`msg-${i}`} role={msg.role} content={msg.content} />
                ))}
              </Box>
            </ScrollView>

            {/* Input area */}
            <Box style={{
              width: '100%',
              paddingLeft: 16, paddingRight: 16,
              paddingTop: 8, paddingBottom: 10,
              borderTopWidth: 1,
              borderTopColor: V.border,
              backgroundColor: V.bgAlt,
              gap: 6,
            }}>
              {/* Model bar */}
              <Box style={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}>
                <ProviderBadge name="Ollama" healthy />
                <Box style={{
                  paddingLeft: 8, paddingRight: 8,
                  paddingTop: 3, paddingBottom: 3,
                  borderRadius: 4,
                  backgroundColor: V.accentSubtle,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: V.accent }}>
                    llama3.2
                  </Text>
                </Box>
                <Box style={{ flexGrow: 1 }} />
                <Text style={{ fontSize: 10, color: V.textDim }}>
                  {'~842 tokens'}
                </Text>
              </Box>

              {/* Text input */}
              <Box style={{
                width: '100%',
                flexDirection: 'row',
                gap: 8,
                alignItems: 'flex-end',
              }}>
                <Box style={{ flexGrow: 1 }}>
                  <TextInput
                    value=""
                    onChangeText={() => {}}
                    placeholder="Message Vesper..."
                    style={{
                      width: '100%',
                      fontSize: 13,
                      backgroundColor: V.bgInset,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: V.border,
                      paddingLeft: 10, paddingRight: 10,
                      paddingTop: 8, paddingBottom: 8,
                      color: V.text,
                    }}
                  />
                </Box>
                <Pressable
                  onPress={() => {}}
                  style={(state) => ({
                    paddingLeft: 14, paddingRight: 14,
                    paddingTop: 8, paddingBottom: 8,
                    borderRadius: 6,
                    backgroundColor: state.hovered ? V.accentHover : V.accent,
                  })}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#ffffff' }}>
                    Send
                  </Text>
                </Pressable>
              </Box>
            </Box>
          </Box>
        )}

        {activeTab !== 'chat' && (
          <Box style={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 14, color: V.textDim }}>
              {`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} view`}
            </Text>
          </Box>
        )}
      </Box>

      {/* Bottom nav */}
      <Box style={{
        width: '100%',
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: V.border,
        backgroundColor: V.bg,
      }}>
        <NavTab label="Chat"     icon={'\u25C8'} active={activeTab === 'chat'}     onPress={() => setActiveTab('chat')} />
        <NavTab label="Compare"  icon={'\u2261'} active={activeTab === 'compare'}  onPress={() => setActiveTab('compare')} />
        <NavTab label="Terminal" icon={'\u25B7'} active={activeTab === 'terminal'} onPress={() => setActiveTab('terminal')} />
        <NavTab label="Research" icon={'\u25CB'} active={activeTab === 'research'} onPress={() => setActiveTab('research')} />
        <NavTab label="Settings" icon={'\u2699'} active={activeTab === 'settings'} onPress={() => setActiveTab('settings')} />
      </Box>

      {/* CRT overlay */}
      <CRT
        mask
        intensity={0.04}
        scanlineIntensity={0.08}
        curvature={0}
        rgbShift={0.5}
        vignette={0.15}
        flicker={0.01}
        shaderTint="#8B5CF6"
        shaderTintMix={0.03}
      />

      {/* Command palette */}
      <CommandPalette
        visible={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
        placeholder="Search commands..."
        activeColor={V.accent}
        textColor={V.text}
        mutedColor={V.textDim}
        backgroundColor="rgba(10, 10, 10, 0.98)"
        overlayColor="rgba(0, 0, 0, 0.6)"
        borderColor={V.border}
      />
    </Box>
  );
}
