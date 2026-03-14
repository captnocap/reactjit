/**
 * ConversationPanel — Slide-in left panel for conversation history.
 *
 * Shows conversations grouped by time (Today, Yesterday, This Week, Older).
 * Search bar at top. New chat button.
 */

import React, { useState } from 'react';
import { Box, Text, Pressable, TextInput, ScrollView, useClipboard } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';
import { V } from '../theme';
import type { Conversation } from '../types';
import type { Message } from '@reactjit/ai';

// ── Export Helpers ───────────────────────────────────────

function conversationToMarkdown(convo: Conversation): string {
  const lines = [`# ${convo.title}`, `Model: ${convo.model}`, ''];
  for (const msg of convo.messages) {
    if (msg.role === 'system') continue;
    const label = msg.role === 'user' ? '**You**' : msg.role === 'assistant' ? '**Vesper**' : `**${msg.role}**`;
    const text = typeof msg.content === 'string' ? msg.content : msg.content.map(b => b.text || '').join('');
    lines.push(`${label}:`, '', text, '', '---', '');
  }
  return lines.join('\n');
}

// ── Time Grouping ────────────────────────────────────────

function getTimeGroup(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const day = 86400000;
  if (diff < day) return 'Today';
  if (diff < day * 2) return 'Yesterday';
  if (diff < day * 7) return 'This Week';
  return 'Older';
}

function groupConversations(convos: Conversation[]): Map<string, Conversation[]> {
  const groups = new Map<string, Conversation[]>();
  const order = ['Today', 'Yesterday', 'This Week', 'Older'];
  for (const label of order) groups.set(label, []);

  const sorted = [...convos].sort((a, b) => b.updatedAt - a.updatedAt);
  for (const c of sorted) {
    const group = getTimeGroup(c.updatedAt);
    groups.get(group)!.push(c);
  }

  // Remove empty groups
  for (const [key, val] of groups) {
    if (val.length === 0) groups.delete(key);
  }
  return groups;
}

// ── Conversation Card ────────────────────────────────────

function ConvoCard({ convo, active, onSelect, onDelete, onExport }: {
  convo: Conversation;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const c = useThemeColors();
  // rjit-ignore-next-line
  const msgCount = convo.messages.filter(m => m.role !== 'system').length;

  return (
    <Pressable
      onPress={onSelect}
      style={(state) => ({
        width: '100%',
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 8,
        borderRadius: 4,
        backgroundColor: active
          ? V.accentSubtle
          : state.hovered
            ? 'rgba(255, 255, 255, 0.04)'
            : 'transparent',
        borderLeftWidth: active ? 2 : 0,
        borderLeftColor: V.accent,
        gap: 2,
      })}
    >
      <Box style={{
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: 13,
          fontWeight: active ? '700' : '400',
          color: active ? c.text : c.textSecondary,
        }}>
          {convo.title || 'New conversation'}
        </Text>
        <Text style={{ fontSize: 10, color: c.textDim }}>
          {`${msgCount} msgs`}
        </Text>
      </Box>
      <Box style={{
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: 10, color: c.textDim }}>
          {convo.model || 'no model'}
        </Text>
        {active && (
          <Box style={{ flexDirection: 'row', gap: 4 }}>
            <Pressable
              onPress={onExport}
              style={(state) => ({
                paddingLeft: 6, paddingRight: 6,
                paddingTop: 2, paddingBottom: 2,
                borderRadius: 3,
                backgroundColor: state.hovered ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              })}
            >
              <Text style={{ fontSize: 10, color: V.textDim }}>Export</Text>
            </Pressable>
            <Pressable
              onPress={onDelete}
              style={(state) => ({
                paddingLeft: 6, paddingRight: 6,
                paddingTop: 2, paddingBottom: 2,
                borderRadius: 3,
                backgroundColor: state.hovered ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              })}
            >
              <Text style={{ fontSize: 10, color: V.error }}>Delete</Text>
            </Pressable>
          </Box>
        )}
      </Box>
    </Pressable>
  );
}

// ── ConversationPanel ────────────────────────────────────

export interface ConversationPanelProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  visible: boolean;
}

export function ConversationPanel({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  visible,
}: ConversationPanelProps) {
  const [search, setSearch] = useState('');
  const c = useThemeColors();
  const { copy, copied } = useClipboard();

  const exportConversation = (convo: Conversation) => {
    const md = conversationToMarkdown(convo);
    copy(md);
  };

  if (!visible) return null;

  const filtered = search
    ? conversations.filter(cv =>
        cv.title.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const groups = groupConversations(filtered);

  return (
    <Box style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: 280,
      height: '100%',
      backgroundColor: V.bgAlt,
      borderRightWidth: 1,
      borderRightColor: V.border,
      flexDirection: 'column',
      zIndex: 10,
    }}>
      {/* Header + New Chat */}
      <Box style={{
        width: '100%',
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 10,
        paddingBottom: 8,
        gap: 8,
      }}>
        <Box style={{
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: c.text }}>
              Conversations
            </Text>
            {copied && (
              <Text style={{ fontSize: 10, color: V.success }}>Copied!</Text>
            )}
          </Box>
          <Pressable
            onPress={onNew}
            style={(state) => ({
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 4,
              paddingBottom: 4,
              borderRadius: 4,
              backgroundColor: state.hovered ? V.accent : V.accentSubtle,
            })}
          >
            <Text style={{
              fontSize: 11,
              fontWeight: '700',
              color: V.accent,
            }}>
              + New
            </Text>
          </Pressable>
        </Box>

        {/* Search */}
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search..."
          style={{
            width: '100%',
            fontSize: 12,
            backgroundColor: V.bgInset,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: V.borderSubtle,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 5,
            paddingBottom: 5,
            color: c.text,
          }}
        />
      </Box>

      {/* Conversation List */}
      <ScrollView style={{ flexGrow: 1, width: '100%' }}>
        <Box style={{ gap: 8, paddingLeft: 4, paddingRight: 4, paddingBottom: 12 }}>
          {[...groups.entries()].map(([label, convos]) => (
            <Box key={label} style={{ gap: 2 }}>
              <Text style={{
                fontSize: 10,
                fontWeight: '700',
                color: c.textDim,
                paddingLeft: 12,
                paddingTop: 6,
                paddingBottom: 2,
              }}>
                {label.toUpperCase()}
              </Text>
              {convos.map(cv => (
                <ConvoCard
                  key={cv.id}
                  convo={cv}
                  active={cv.id === activeId}
                  onSelect={() => onSelect(cv.id)}
                  onDelete={() => onDelete(cv.id)}
                  onExport={() => exportConversation(cv)}
                />
              ))}
            </Box>
          ))}

          {filtered.length === 0 && (
            <Box style={{
              paddingLeft: 12, paddingRight: 12,
              paddingTop: 24,
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 12, color: c.textDim }}>
                {search ? 'No matches' : 'No conversations yet'}
              </Text>
            </Box>
          )}
        </Box>
      </ScrollView>
    </Box>
  );
}
